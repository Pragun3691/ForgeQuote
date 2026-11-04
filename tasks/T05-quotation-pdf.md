# T05 - Customer quotation PDF

Owner authorized focused implementation, local tests, documentation and commit without another plan approval on 2026-11-05. Clean main and fetched origin/main both contain accepted T04 at 47e226e. Branch: feature/T05-quotation-pdf. No push/merge/cloud work.

## Plan and data flow

Add customer-only projection and PDF renderer, bundled licensed font assets, authenticated GET download endpoint and a compact download control in the existing lifecycle panel. Reuse saved version/lifecycle reads with an internal shared transaction client. Add PDF content/layout, PostgreSQL/API and browser-download tests, preserve all nine goldens, update status/learning/ADR/handoff.

Session actor -> current active demo role -> shared quotation-header lock -> immutable snapshot + lifecycle reads -> issued/current eligibility -> customer field allowlist -> PDFKit A4 buffer -> attachment response. PDF generation never writes snapshots/events, resolves live rates, accepts client prices or computes financial totals.

Assumptions: both existing active demo roles can download; only current issued versions produce final PDFs; superseded issued history remains inspectable but its final download is denied. No optional draft preview. Customer information means the stored customer name because addresses/tax identities are not in the accepted snapshot. Do not invent customer/seller legal details, commercial terms or validity dates.

## Verification, risk and release

Single/multipart issued PDFs, long-description pagination, exact saved scenario prices/quantities/totals, rupee/font embedding, issue/pricing date and version binding, no internal fields/attachments/metadata leakage, all unissued/rejected/stale/anonymous/disabled access denied, unchanged historical output after master/config changes, Chrome downloads for both roles and visible retry errors. Include existing unit/DB/browser/build/startup suites and all nine costing goldens.

Runtime uses pure Node PDFKit and fontkit with bundled OFL Noto Sans files; no Chromium/Python/native renderer needed in production. PDF.js is a dev-only independent parser. Long documents are bounded to 40 pages/4 MiB and 20 components/scenario; unsupported glyphs fail visibly. Read locks are held through buffer assembly; downloads are limited to 20/actor/15 minutes in one process. Font coverage is Latin/Greek/Cyrillic plus rupee, not every writing system.

No migration, schema/grant, formula, snapshot-write, lifecycle-write, Neon or Render change. Existing 006 deployment prerequisite remains. Handoff: docs/t05-handoff.md; decision: ADR-0015. STOP after T05 commit.
