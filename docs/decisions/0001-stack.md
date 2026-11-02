# ADR-0001 — Technology stack

- **Status:** ACCEPTED - owner authorization, 2026-11-02
- **Decision:** React + Vite + JavaScript; Express + Node.js; PostgreSQL through pg; decimal.js for financial arithmetic. Node test runner and real PostgreSQL integration tests. Same-origin deployment; PostgreSQL-backed sessions and two demo roles before public writes. No ORM. PDF is a later task.
- **Reasoning:** Owner has previously worked with React, Node/Express and PostgreSQL; using known tools reduces deadline risk. Keep frontend/backend contracts straightforward.
- **Trade-offs:** More deployed components than server-rendered UI; Node monetary arithmetic demands special handling; must ship a thin end-to-end slice early.
- **Revisit if:** Unfamiliar language/tooling materially slows implementation. Do not change stack casually after T01.
