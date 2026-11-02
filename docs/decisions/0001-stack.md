# ADR-0001 — Technology stack

- **Status:** PROPOSED (owner approval required)
- **Decision:** React + Vite frontend (JavaScript unless owner confirms TypeScript fluency); Node.js + Express backend; PostgreSQL; dedicated decimal arithmetic library for calculations; tests with a current Node test runner and API integration tests; PDF generated on server.
- **Reasoning:** Owner has previously worked with React, Node/Express and PostgreSQL; using known tools reduces deadline risk. Keep frontend/backend contracts straightforward.
- **Trade-offs:** More deployed components than server-rendered UI; Node monetary arithmetic demands special handling; must ship a thin end-to-end slice early.
- **Revisit if:** Unfamiliar language/tooling materially slows implementation. Do not change stack casually after T01.
