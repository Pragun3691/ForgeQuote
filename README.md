# ForgeQuote — RFQ-to-Quote Costing

An **individual** IsoCode Labs take-home project. Internal development target: **6 Nov 2026**; contingency feature-freeze: **8 Nov 2026**; external submission deadline: **9 Nov 2026, 23:59 IST**.

## Goal

Build one honest, working end-to-end RFQ → verified intake → deterministic costing at 2–3 volumes → approval gate → issued PDF quote, using versioned rates and auditable snapshots. Seed only **synthetic/anonymized** customer data.

## What this ZIP contains

Planning scaffold and acceptance cases — **not a functioning application**. Do not claim features are implemented until they are tested. Initial implementation happens on `feature/T01-thin-slice` after reviewing the T01 plan.

## Start (Windows PowerShell)

```powershell
# Extract the ZIP so that AGENTS.md is directly inside ForgeQuote/
cd ForgeQuote
git init
git add .
git commit -m "chore: add project scaffold and engineering specs"
git switch -c feature/T01-thin-slice
```

Then hand the coding assistant `AGENTS.md`, `docs/costing-spec.md`, `docs/golden-cases.md`, and `tasks/T01-thin-slice.md`. Ask for a plan **before edits**.

## Definition of complete

See `docs/requirements.md` and `tasks/T01-thin-slice.md`. This repo should progress through small reviewable commits, tests, and real deployed slices. Keep a working build throughout.
