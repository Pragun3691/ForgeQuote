# ADR-0017 - Authored rate versions, RFQ outcomes and internal costing PDF

Accepted under the owner's already-approved final-requirements continuation, 2026-11-05. Supersedes ADR-0016's prohibition on all application rate writes. ADR-0002 formulas and all nine financial goldens remain unchanged. No C1 audit context exists in this checkout; no broader audit completion is claimed.

## Rate authoring

Sales Head alone may POST /api/rates/:id/versions for an existing key, with exact fields value (decimal string), effectiveFrom (date) and reason (trimmed, 1-1000 characters, no control characters), and a UUID Idempotency-Key. Values accept nonnegative plain decimals with at most 12 integer and six fractional digits, matching existing NUMERIC(18,6). Reject overprecision before coercion; no rounding, binary-float conversion or silent default. Zero is an explicit supported value. No new keys, edits, deletes, cancellations or backdated application versions.

The accepted forward-only policy permits today or later on the database's Asia/Kolkata clock, strictly later than that key's latest recorded start, including any future start. Thus a future version cannot be followed by insertion into the gap before it. SQL lead-derived exclusive ends and unique key/start still prevent overlaps. Saved quotations retain their rate IDs, resolved values and effective starts. New calculations use the unchanged pricing-date resolver.

Migration 007 adds nullable raw_value, actor_user_id, reason and submission_key to rate_versions. Legacy rows are preserved without invented authors. A complete-provenance constraint and INSERT trigger validate raw text before assigning NEW.value, active Sales Head and dates. Runtime receives only INSERT(id,rate_key_id,effective_from,raw_value,actor_user_id,reason,submission_key), never value or created_at. Existing UPDATE/DELETE/TRUNCATE guards remain. Only the trusted table-owner maintenance path may insert legacy rows without provenance, preserving synthetic seeding/import compatibility; it is not exposed over HTTP.

Within one transaction the service rechecks role, locks actor/request, checks replay, locks rate key, validates latest start/today and appends. Same actor/key and normalized decimal/reason/date intent returns the original ID before date checks; changed intent conflicts. Key locking plus uniqueness protects distinct concurrent requests. The SQL trigger also takes the same key lock. No automatic retry follows an uncertain COMMIT. Browser sessionStorage preserves exact path/body/key through refresh; explicit retry recovers committed responses.

As with the existing snapshot/event services, runtime credentials are a trusted application-service boundary, not per-human SQL identities: direct runtime SQL can name another active Sales Head. Server sessions supply actors; clients cannot set actor IDs or timestamps. Maintenance-owned tables, exact cloud ACL checking and no runtime elevated memberships remain required.

## RFQ status and terminal outcome

Read status derives from immutable facts: an rfq_outcomes row wins; otherwise any issued event for any quotation version of the RFQ means sent; otherwise estimating. Creating drafts/submitting/approving does not imply sent. Older actual issuance remains sent after a newer draft is saved. Legacy rfqs.status and owner_label are preserved; no quotation event is rewritten.

Sales Head POST /api/rfqs/:id/outcomes records won, or lost plus a required reason. Both are terminal. One append-only row per RFQ is the complete terminal-outcome history for this workflow; correcting or reopening outcomes is unsupported. Each row stores actor, database timestamp, reason and request UUID. Service and SQL trigger require actual issuance and active Sales Head. RFQ advisory locks and primary/unique constraints serialize opposing decisions. Exact replay precedes terminal validation; different intent conflicts. Runtime INSERT excludes occurred_at and cannot mutate/delete/truncate outcomes. Same Origin/CSRF and existing actor-based write limit apply.

Register/detail show assignedEstimator from the original intake actor's username, falling back to preserved owner_label for legacy fixtures. This is display of existing assignment, not a reassignment feature. Detail displays actor-attributed terminal history. Refresh status explicitly retrieves decisions made in other sessions.

## Internal report and customer confidentiality

Authenticated GET /api/quote-versions/:id/internal-pdf permits active Estimator and Sales Head for any saved version, including draft/rejected/superseded. It uses only the existing immutable snapshot reader; no rate/master joins, costing, GST recomputation, issuance or database writes. It includes saved inputs, routing revision, per-scenario quantities/batch plans, seven cost lines, cost/selling totals, margins, six rate IDs/values/effective starts, formula version, saved timestamp and illustrative GST/totals. Only effective starts were saved historically; do not invent an effective end from today's master history. INTERNAL / CONFIDENTIAL repeats on every page and the filename starts INTERNAL-. Saved creation time also fixes PDF metadata.

The existing customer projection/renderer/service remain unchanged. Customer download still requires a current issued version and excludes costs, margins and rate provenance. The browser offers distinct customer and internal download buttons. Both endpoints use authenticated no-store/nosniff attachments and the bounded PDF limiter. Internal renderer uses already-bundled PDFKit/fonts, measured wrapping/repeated headers/footers, 8 MiB and 100-page limits, explicit unsupported-text/missing-data/oversize errors, and no filesystem writes in production. No new dependency or external document service.

Deployment requires pending 007 and reviewed column grants/function privileges before the new application starts; readiness requires 007. Strict inventory becomes 18 tables, seven functions and 34 enabled triggers. Only disposable local databases were migrated/tested. No Neon, Render, push, merge or deployment authorized in this continuation.
