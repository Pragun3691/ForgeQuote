# ADR-0026: Source review, explicit application and request ownership

Status: implemented under the owner's combined M5/M6 approval, 2026-11-09.

Extraction verification is a server result, not human approval or confidence. Keep both Gemini consent checkboxes, provider terms/disclosures, the unpaid-tier synthetic-only restriction, the warning about personal/customer/NDA data, and the statement that AI never calculates prices. Source editing clears the old review and both consents. No live provider call is required by automated tests.

Allow an individual server-verified normalized value to be applied only when every evidence span is still valid against the exact submitted source using the existing UTF-16, end-exclusive evidence helper. Client checks only reject values; they never promote an ambiguous, unsupported or missing value. Use the same guard for bulk application. Do not fuzzy-search, infer confidence, guess missing values or normalize decimal strings in the browser.

Header application names the specific header field. Part application requires an explicitly selected existing manual part identified by its stable UI identity. Removing a target disables application instead of silently retargeting another part at that index. Replacing a populated field requires review. Individual application preserves all other fields and rate keys. Customer material remains informational; it cannot become an internal rate key or an extra API field.

Bulk application explains replacement and clearing of keys. It produces editable working inputs with inline validation and explicit final review, never an automatic RFQ POST. Confirmed bulk application deliberately focuses the manual validation summary. Individual application and background reads do not steal focus. Feedback claims application only after confirmation. Source text, file bytes and evidence remain transient; only the existing reviewed RFQ submission intent uses sessionStorage.

Excel retains deterministic parsing, synthetic-data attestation, 2 MiB/20-part limits, exact worksheet/cell/header evidence, and no Gemini calls. Add file feedback, row review links, field status presentation and a clear route from missing cells to manual corrections. The server continues to reject invalid workbooks. Do not add spreadsheet editing or a second draft model.

Every extraction/import request owns its controller. Results, errors, 401 handling and completion must belong to the current noncancelled request; an old finally block cannot unlock or clear a newer request. Cancellation releases the manual form immediately and leaves the existing persistent fallback notice. Explicit retry starts a new source request, not an RFQ save.

No provider policy, endpoint, schema, financial formula, authorization, dependency or deployment change. Evidence: intake-review tests, M6 browser acceptance, existing Gemini/association/Excel suites and combined handoff.
