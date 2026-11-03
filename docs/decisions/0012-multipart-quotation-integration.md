# ADR-0012 - Complete RFQ quotation HTTP and workspace integration

- Status: ACCEPTED under owner's T03 plan/implementation approval, 2026-11-03.
- Extends ADR-0006's single-part HTTP/UI restriction; ADR-0005 snapshot architecture and approved financial policies remain unchanged.

## HTTP contract

Existing estimator-only POST /api/rfqs/:id/quote-versions accepts either the legacy flat body or:

```json
{
  "pricingDate": "2026-11-02",
  "parts": [{
    "partId": "26110100-0000-4000-8000-000000000022",
    "routingRevisionId": "26110100-0000-4000-8000-000000000023",
    "marginPercent": "20",
    "tierQuantities": {"50": "90000", "100": "180000", "150": "270000"}
  }]
}
```

parts has 1-20 entries. Each RFQ part ID must appear exactly once, independent of array ordering. Unknown fields, duplicate normalized UUIDs, omitted/foreign parts, invalid margin/quantity/date, cross-part routing or missing rates fail visibly; no partial quotation is committed. Route IDs select existing one-operation routing revisions; no arbitrary routing interpreter/editor is introduced. The 100% quantity supplies requestedAnnualQty for this quotation only; original RFQ facts remain unchanged.

Only POST to the UUID RFQ quotation path receives 64 KiB JSON allowance, including an optional trailing slash. Existing RFQ/extraction allowances and ordinary 4 KiB endpoints remain. All existing session/current-role, estimator, Origin, CSRF, throttling and redacted error handling remain. New save returns 201; exact replay 200/original version ID; changed canonical payload on the same actor/key 409. GET /api/quote-versions/:id retains its contract: parts and totals contain all saved results; annualValueExGst is the saved combined 100% ex-GST taxable value.

## Canonicalization and atomic history

Normalized multipart entries sort by stable part UUID before hashing. Fixed field order and numeric-string normalization remain; array presentation order does not change identity. Legacy one-part canonical bytes remain unchanged (frozen SHA-256 regression); the equivalent new one-part array also replays the same receipt. Replay lookup still precedes current-master validation, preserving recovery after master changes. Do not recanonicalize or reshape an uncertain browser payload before sending it.

Remove only the HTTP single-part gate. The existing quotation service already enforces full ID-set coverage, selected route membership and effective rates in one master-resolution statement. It invokes the unchanged decimal engine separately for each component and persists all component inputs, selected rates, three tiers, totals and receipt using the existing shared client/transaction. Failure rolls back every part, version counter and key. No schema or grants change.

Financial aggregation is unchanged: each rounded ex-GST unit selling price times its scenario quantity contributes to the combined taxable subtotal. GST is rounded once on that combined subtotal, then added. Never sum unit prices across different parts or replace quotation GST with a sum of independently rounded part GST. Nine original golden cases stay unchanged. No approval threshold logic is implemented; only the existing saved baseline value is shown explicitly.

## Workspace and boundaries

One pricing date, repeated compact per-part routing/margin/quantity controls identified by stable IDs, and one calculate/save action. Saved results reuse the existing component/totals renderer. Legacy flat and new array pending records keep their exact body/key across refresh, session expiry and unknown outcomes. Saved results always come from the immutable snapshot; editing/new calculation creates a new version. Sales head remains read only. No pricing in React, import changes, dependencies, approval/PDF, deployment or design overhaul.
