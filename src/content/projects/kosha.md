---
title: 'Kosha'
subtitle: 'Mobile-first personal investment + loan tracker'
order: 3
featured: true
liveUrl: 'https://kjanghel.github.io/Kosha/'
repoUrl: 'https://github.com/kjanghel/Kosha'
tags: ['React', 'TypeScript', 'Supabase', 'PWA']
---

A mobile-first PWA for tracking personal investments and loans in a single unified portfolio. Google sign-in, transaction logging, net-worth view, per-account XIRR, and account sharing with editors by email.

Stack: React 18 + TypeScript + Vite + Tailwind + Supabase (Postgres + Auth + RLS) + GitHub Pages. Free-tier only.

Notable pieces: XIRR via Newton-Raphson, single `accounts` table with a `kind` discriminator for investments vs loans, `security definer` SQL helpers to prevent RLS recursion, and an invite-flow that auto-links pending invites on sign-in.
