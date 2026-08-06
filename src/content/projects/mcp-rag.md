---
title: 'MCP Server with RAG'
subtitle: 'Natural-language API access for WAAS'
order: 1
featured: true
tags: ['AI', 'MCP', 'RAG', 'Security', 'Python']
---

Sole architect of the POC → team lead through production hardening (2026).

Designed and built an MCP server (Python, MCP framework over Streamable HTTP at `/mcp`) so Claude and any MCP-compatible agent can answer natural-language questions like *"how many applications do I have for account 123?"* against the WAAS v4 control plane.

Built a RAG pipeline over a 20,596-line OpenAPI spec (190 paths, 496 operations, 77 tag categories): YAML parsing, `$ref` denormalization, per-operation chunking, OpenAI embeddings, in-memory vector search with optional tag-name keyword boost, read-only filter for Phase-2 safety.

Built a 21-intent evaluation harness (positive + low-confidence negative cases) targeting top-1 ≥ 80%, top-3 ≥ 95%, p95 retrieval <500 ms. Implemented JWKS-based access-token validation and per-account authorization on every tool call; zero auth weakening across POC vs production modes.

Packaged as three Docker services (retrieval, MCP, gateway) with Kustomize overlays for `public` (multi-agent POC) and `private` (VPC-only via internal transit gateway) deployment. Single image, one-line cutover. Content-hash-based vector-index rebuild on spec change: ~30 s cold boot, instant warm.
