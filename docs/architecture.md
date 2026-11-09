# ForgeQuote architecture - current implemented product

Maintenance addition (ADR 0029): explicit process-start `MAINTENANCE_MODE=true` selects a DB/session/provider-free 503 application before route installation. Default false preserves normal workflows. Liveness is separate from strict 008 readiness and a new deployment-health gate, which accepts healthy maintenance on 007 while requiring normal 008 readiness for reopening. The release protocol requires positive old-process termination and database drain; changing an environment variable is not a global fence. See `maintenance-release-runbook.md` for bootstrap order, provider uncertainties and rollback restrictions.

This describes the local implementation through accepted M1-M6 and the owner-approved M7/M8 frontend assignment. Earlier numbered backend milestones and frontend M1-M8 are different sequences. This document does not claim a cloud deployment or multi-tenant isolation.

## Runtime and trust boundaries

React/Vite JavaScript runs against Express JSON and binary routes on one production origin; local Vite proxies /api. PostgreSQL stores users/sessions, RFQs/parts/routing, append-only rate versions, immutable quotation snapshots/receipts, lifecycle events and terminal outcomes. Node decimal.js implements the approved finance contract. Existing PDFKit/font assets generate customer and INTERNAL PDFs from saved values.

Authenticated server sessions supply actors; active role, Origin/CSRF and idempotency checks protect writes. The client never supplies authorization, calculated quotation prices, actors or decision timestamps. Estimators create RFQs/costings and submit/issue quotations. Sales Head appends rate versions, approves/rejects and records terminal RFQ outcomes. Both active demo roles can inspect saved quotations and permitted documents. See ADR-0004/0006/0014/0017 for the exact contracts and trusted-runtime limitations.

## Intake and financial persistence

Manual intake supports 1-20 parts and six explicitly chosen internal rate keys per part. Excel import is deterministic and returns worksheet/cell evidence; it makes no provider call. Gemini proposes fields from synthetic text only after both consent gates. Server schema, source-section association and exact evidence verification precede editable review. Applying a suggestion does not save an RFQ or assign an authoritative material rate key. Raw source, workbook bytes and evidence remain transient. RFQ PDF intake is not implemented. See ADR-0008/0009/0010/0025/0026.

RFQ creation and quotation saving persist exact request intent before POST in actor/entity-scoped sessionStorage. Unknown outcomes freeze conflicting actions and require explicit same-key recovery. A new calculation is deliberate. Requests use decimal-string transport; no frontend money arithmetic, current-master substitution or automatic mutation retry exists.

Quotation services resolve rates at the pricing date and atomically persist inputs, resolved rate IDs/values/effective starts, formula version, three scenarios and totals. Reads of historical quotations use these immutable snapshots. Current working quantities/margins and live rate masters do not rewrite saved results. PostgreSQL guards and independent financial goldens enforce the accepted contract. See costing-spec.md, quotation-persistence.md and ADR-0002/0003/0005/0012.

## Decisions, documents and outcomes

Lifecycle status derives from append-only quotation_events, separate from the snapshot's original draft status. Submission at or below the saved INR 25,00,000 ex-GST annual baseline clears automatically; strictly above requires Sales Head. Only the current approved version can issue. Decisions and issuance bind their exact version; concurrent/new-version checks remain server-side. Same-key replay returns the original result before new-action eligibility checks. See ADR-0014.

Customer PDF GET requires a current issued version and an allowlisted customer projection. INTERNAL PDF GET permits saved historical/unissued versions and includes costs, margins, routing and provenance with repeated confidentiality labels. Neither renderer recalculates finance or writes snapshots. Authenticated binary fetches preserve filenames, no-store/nosniff handling, limits and visible errors. Frontend progress is document-specific; leaving a version aborts its pending download. See ADR-0015/0017/0027.

RFQ status is estimating until actual issuance, then sent; an append-only terminal outcome takes precedence. Sent is not evidence of an email delivery. Sales Head may record won, or lost with a required reason; reopening/correction is unsupported. There is no email/ERP integration. See ADR-0017.

Subsequent rule (ADR 0028): allocation, version insertion, lifecycle transitions and outcome recording share a quotation-header row lock. API guards and migration 008 SQL triggers reject future quotation writes after Won/Lost. Successful same-key receipts precede terminal checks; snapshots, history and PDF eligibility remain unchanged. Writes require READ COMMITTED semantics; stronger-isolation direct writes fail closed against stale-snapshot bypasses. Additive live metadata exposes version `lifecycleStatus` and lifecycle `rfqOutcome`. Closed approvals are excluded; both-role UI preserves retained inputs and exact-request recovery while explaining read-only closure.

## Frontend ownership and navigation

App owns authentication. AppShell owns branding/navigation presentation and deliberate task focus; WorkspaceDrafts supplies an authenticated-lifetime memory store and unload markers. One hash parser/navigation helper preserves existing URLs and browser history. Register/approval and rate filters use returned data with URL state; they are not server pagination.

Workspace retains one intake and rates subtree across internal navigation. RfqCreate owns the manual form and final review; stable UI-only part IDs never enter API bodies. RfqWorkspace owns costing drafts, selected-version read guards and submission recovery. Controlled child components render these values without a second draft model. QuoteResults/SavedCostingInputs read saved snapshots only.

RateAuthor and workflow-specific action owners retain their existing serializers/replay policies. Rejection and outcome reasons use memory drafts; recorded pending intent has precedence. Presentation helpers show exact rate previews, decision confirmation and read-only recovery summaries. Only known server success justifies saved wording. Background reads do not move focus. See ADR-0021 through ADR-0027 and milestone handoffs.

Tokens, base controls, workflow layouts, shell and login have ordered CSS layers. The charcoal/forest/ivory identity with restrained crimson remains. Native controls/details/dialogs, named scroll regions, focus indicators and reduced-motion handling are used without a component-library dependency. Long financial tables remain intentionally scrollable.

## Operations, verification and limits

Runtime uses restricted credentials; maintenance provisioning/migrations/grants remain a separate reviewed operation. /api/health/live is DB-independent; /api/health/ready verifies database readiness. Production configuration rejects maintenance/test/seed credentials and insecure database TLS. See ADR-0007 and deployment.md for prepared hosting configuration and actual deployment evidence; this frontend assignment performs no deployment.

Writable regression fixtures guard local disposable *_test targets and use synthetic data. API/security/financial tests, actual Chrome role journeys, production startup and rendered PDF inspection provide local evidence. Gemini is mocked in deterministic tests. Physical devices, Safari/Firefox, screen-reader user testing, cloud HTTPS/TLS and live provider connectivity are not newly verified here.

Ordinary unsent drafts live in the authenticated tab, not a backend draft service. Sign-out/session teardown ends that lifetime; submitted intent retains its existing same-tab storage recovery. Provider source is never persisted by the UI. Organization identity/membership/isolation, invitations, pagination, accounting/legal invoice compliance and ERP remain separate scope. No tenant picker can substitute for server isolation.
