# ADR-0010 - Narrow deterministic Excel RFQ import

Status: ACCEPTED by owner's T02.3 authorization, 2026-11-03; starts at clean fad3d79 on feature/T02-ai-rfq-intake. Excel only; PDF feasibility is read-only and PDF implementation needs separate approval.

Decision: use exact-pinned yauzl 3.4.0 + saxes 6.0.0 for a deliberately narrow transitional OOXML table reader, rather than general spreadsheet interpretation or Gemini. Decode stored numeric tokens as strings and validate against unchanged manual bounds. Reject formulas even with cached values, numeric formats that change displayed meaning, hidden/ambiguous structures, unknown headers and any invalid record. Resolve workbook relationships/shared strings/explicit coordinates; report worksheet/cell/header evidence. No silent row skipping except truly blank rows.

Only source bytes and suggestions are transient. Estimator deliberately copies imported parts into existing editable manual form, preserves manual RFQ headers, selects internal keys, corrects gaps and confirms before unchanged T02.1 atomic/idempotent save. Material text never resolves keys. Excel import never invokes Gemini, calculates prices or saves a document/RFQ itself. Existing Gemini text pipeline remains unchanged.

Authenticate/authorize/CSRF before binary buffering, exact file/MIME/structure validation, 2 MiB upload, 20 MiB actual expanded ZIP limit/100 entries, bounded XML, no external fetch/DTD/entities, checksum checks and terminable worker/deadline protect the new route. Limits and workers are intentionally process-local; not a general hardened document-processing service. No migrations, ownership/grant changes, formulas or historical-snapshot changes.

Tradeoffs: narrow headers, one populated visible worksheet, General numeric format and plain text identifiers; no formula evaluation, arbitrary templates, column mapping, stored source audit or recovery of precision already lost by Excel. Two small parser dependencies avoid numeric Number conversions but require a small amount of explainable OOXML handling. saxes upstream archival is a maintenance risk; advisory audit reports zero known vulnerabilities at this checkpoint.

Verification and exact contract/manifest: docs/t02-3-handoff.md. Parser, security, disposable PostgreSQL and real Chrome review/save/recovery tests passed; nine financial goldens unchanged. Read-only PDF.js assessment finds pipeline reuse plausible but canvas-free runtime compatibility unverified; defer PDF intake. Quotation PDF generation remains a separate later feature. No deployment/purchase; STOP.
