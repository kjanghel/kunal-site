---
title: "Two tools, not 496: building an MCP server for a real API"
description: "Fine-grained tools feel right. For a real API with hundreds of operations, they're the wrong unit. Five decisions that mattered."
date: 2026-08-11
draft: true
tags: ["mcp", "rag", "ai-agents", "api-design"]
---

496 operations, 250K tokens of YAML, one AI agent — and two tools to drive all of it. That number isn't a benchmark; it's the shape of the problem. When you wire an AI agent into a real API rather than a tutorial toy, the architecture has to earn every decision.

This is from a system I built at my day job to let an AI agent drive our team's internal API. Employer and product deliberately kept out of this post — the patterns are what generalize.

Five decisions mattered more than any other: how to expose the API surface to the LLM, how to get the agent the right spec context without blowing up cost, where to draw the write boundary, how to layer auth correctly, and how to make the whole chain traceable when something breaks at 2am. Here they are, in the order I'd defend them.

## Two tools, not N

For an OpenAPI spec with hundreds of operations, expose two tools — not one tool per endpoint.

The spec I was working with is 20,596 lines, 190 paths, 496 operations across 77 tag categories — roughly 250K tokens of structured YAML. The naive approach is to register each endpoint as its own MCP tool so the LLM can call them directly. It sounds clean. It isn't.

The problem is context. MCP clients send every tool's schema to the LLM on every request. With 496 operations, that's all of them, all the time, before the agent has even picked one. Context blows up immediately, and the LLM starts chaining calls chaotically because it's trying to navigate a schema wall rather than reason about intent.

I settled on two tools instead. `discover_endpoint` takes a free-text intent and runs RAG over the spec to return the three best candidate operations — method, path, parameter list. `make_api_call` takes a method and path and actually executes the call. The LLM does semantic routing in natural language: "list my applications" becomes a `discover_endpoint` call, not a direct invocation of one of 496 endpoints.

Fine-grained tools feel like good API design. For an MCP server fronting a large API, they're the wrong unit entirely.

## RAG over the spec, not the spec in the prompt

`discover_endpoint` works because the spec isn't in the prompt. It's indexed, and only the relevant slice comes back per request.

Why not just send the spec? Three reasons. Cost: 250K tokens on every call adds up fast. Latency: that volume slows the model before it touches your actual question. Quality: this is the underrated one. LLMs navigate 250K tokens of structured YAML unreliably — attention is diffuse, and the right operation drowns in noise.

Three design details make the retrieval work:

**Hybrid retrieval — FAISS plus BM25.** FAISS does semantic similarity over embeddings; BM25 does lexical scoring over operation text. You need both. Semantic search handles paraphrase well but fumbles on exact terms. BM25 catches the query that says `rate_limit` in the path when FAISS decided something unrelated was closer.

**Chunk unit is an operation, not a text window.** The indexer emits one document per operation — method, path, parameters, description, all together. Splitting an operation across a chunk boundary produces garbage matches.

**Smart path fallback in `/lookup`.** Resolved path first, templated path second. When the agent says `/apps/1021442276` and the spec has `/apps/{id}`, the template scanner catches it. Strict segment count and trailing slash — no false positives.

RAG can miss. The mitigation is deliberate: when `/lookup` returns nothing, `make_api_call` forwards to the upstream API anyway. The API is the source of truth, not the index.

Having the right operation is only half the problem — the other half is what you permit the agent to do with it.

## Read-only by default. Blocked writes return a runnable request.

Default to GET. If the agent attempts a write, the API gateway blocks it and returns the exact request the caller would have made — a structured envelope the agent can hand to a human to approve.

This pattern isn't specific to security products. Any API where writes are hard to undo benefits from it: invoices, deploys, configuration changes, tickets, deletes. The shape of the envelope is the same in every case — method, URL, headers, body. What changes is the stakes.

When `make_api_call` forwards a non-GET to the gateway, the gateway returns HTTP 200 with a `write_operations_not_permitted` body containing a fully-formed `request` block: the resolved URL, auth headers (with the caller's live token), query params, and body. Nothing is inferred or reconstructed later. The agent can present that block verbatim: *"Here's the exact request that would run — approve to send."* Human-in-the-loop without a modal dialog. No silent failures, no guessing at what almost happened.

The honest tradeoff: widening from GET-only to writes is not a one-line config flip in practice. The gateway side is trivial — update `ALLOWED_METHODS`. The agent side isn't. You need a confirmation-UX pattern that actually blocks execution until a human says yes. Ship the gateway change and the UX together, or you've just removed the guardrail.

Of course, the gateway only sees requests that auth has already let through — and auth is more than one check.

## Auth is three things, not one

Identity, entitlement, and resource ownership are three separate checks. Collapsing them into one JWT validation is where multi-tenant leaks come from.

Here's the order they run:

**Identity.** The IDP verifies the JWT signature and lifetime against JWKS. This answers one narrow question: is this token real and unexpired? It says nothing about what the caller is allowed to do.

**Entitlement.** A separate account-membership service verifies that the caller is entitled to act on the tenant they're addressing — the active-tenant header in the request. This answers: can this user act on this tenant? It's a distinct check from identity. A valid token for a real user doesn't mean that user belongs to the account they're claiming.

**Resource ownership.** The upstream API re-validates independently — both the JWT and the account membership. It doesn't inherit trust from our middleware. This answers: is this specific resource actually owned by that tenant?

> The double-validation upstream is intentional — we can't fully trust our own middleware.

The honest tradeoff: three checks means more network calls per request. The mitigation is to TTL-cache the entitlement check — it changes rarely, and a ~60s cache cuts meaningful latency. Don't cache identity or resource ownership; those threat models don't allow it.

## One request id, whole chain

None of this matters if you can't reconstruct what happened — a missing `rid` in half the logs under load is harder to debug than the bug itself.

One id per request, generated in the MCP auth middleware, threaded through every log line and every downstream call. `grep rid=abc123def456` in `kubectl logs` returns the entire lifetime of a single agent question — auth to retrieval to gateway to upstream API. Both downstream clients forward it via `X-Request-Id`; the id survives service boundaries.

Five choices shaped how that works in practice.

**12-char hex, not a full UUID.** The `new_request_id` docstring: *"Short enough to grep, wide enough to avoid collisions across the kind of request volume we see."* A full UUID in every log line is visual noise.

**Plain-text `key=value`, not JSON.** The module docstring: *"Format is single-line `key=value` so it's grep-friendly under `kubectl logs` without a JSON tool."* The primary consumer is an engineer at 2am who doesn't want to pipe output through `jq`.

**`ContextVar`, not thread-local.** Async Python. `threading.local` silently vanishes across `await` boundaries. That failure mode doesn't announce itself; it shows up as half the logs missing the `rid`, on a Wednesday afternoon, under load.

**No `.start` log line, only `.done`.** The `timed` context manager docstring: *"No `.start` line — it doubled the log volume without adding signal."* One line per stage with `took_ms`. Errors get `<event>.error` with the traceback.

**Silence the noise floor.** `uvicorn.access`, `httpx`, and the low-level MCP framework loggers are bumped to WARNING so structured events — `tool.call`, `tool.return`, `retrieval.search.done` — become the signal, not the exception.

The shop with traceable logs is the shop where new hires ship in week one.

## What I'd change on v2

No system ships done — including this one. Five things I'd change if this graduated from POC to a hardened service:

**Cache the entitlement check (TTL ~60s).** Every tool call round-trips to the account-membership service. That check changes rarely; a short TTL cuts ~150ms per request. Tradeoff flagged in the auth section above, deferred because correctness came first.

**Add a cross-encoder reranker between retrieval and the top-K matches.** FAISS plus BM25 gets recall. A reranker gets precision. That gap is where retrieval quality actually lives.

**Persistent audit log writer.** Container-scoped logs today — gone when the pod restarts. No compliance story, no long-term queryability.

**Rate limiting at this layer.** Upstream rate-limits callers. A direct attacker hitting the MCP server itself isn't rate-limited by anything we own.

**Expand the retrieval eval set.** Five hand-curated intents today. Needs 30+ before it's a real CI quality gate.

If you're building an MCP server, start with two coarse tools and a strict default. Everything else can be added — that first choice is hard to undo.
