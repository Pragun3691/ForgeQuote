# Final selected-version consistency check - November 8, 2026

Owner approved Tier 2 visuals subject to this check. Work remains uncommitted on feature/forgequote-ui-redesign; STOP for owner review. No push, merge or deployment.

## Finding and correction

The reported screenshot was a genuine stale selector-list bug, not merely a screenshot taken between requests. The Sales Head had already opened the RFQ while only version 1 existed. A separate test actor then created version 2. Navigating to its URL changed only the hash, so the RFQ component stayed mounted: the selected snapshot refreshed, but its RFQ/version-list effect depended only on RFQ ID. Thus all saved financial/input/lifecycle panels correctly showed version 2 while the selector still contained only version 1, with no active entry. A new regression reproduced that exact failure before the correction (`Selected saved version must exist ... 0 !== 1`).

Only application file changed for the fix: `apps/web/src/Workspace.jsx`.

- Load the requested immutable snapshot, then refresh the existing RFQ metadata and require the selected version in that list before exposing saved panels.
- Keep metadata refresh separate from one-time form/recovery initialization, preserving unsaved estimator values and exact pending requests.
- Prevent older RFQ responses from overwriting newer metadata using a read-sequence token. Ignore aborted snapshot/metadata replies.
- Render baseline, saved inputs, saved totals and the keyed lifecycle component only from a snapshot matching the rendered target ID. This also hides prior-version financial data immediately during a selection change, before effects execute.
- Clear loading when selection is cleared. Preserve explicit retry/errors, immutable snapshots and all existing request/approval/auth/PDF behavior.

No endpoint, database/schema, dependency, formula, persisted financial value or issuance/approval rule changed. A version switch adds a refresh through the existing RFQ GET; if loading fails, saved data is withheld with the existing error/retry flow rather than shown under a mismatched selection.

## Verification

New `tests/browser-version-consistency.smoke.js` uses real restricted-role PostgreSQL fixtures and Chrome. It verifies:

- Both roles switch between version 1 (issued, saved baseline ₹2,69,46,000.00) and version 2 (draft, ₹3,01,850.00), including exact unit cost/price, annual totals and saved 180,000 versus 1,000 quantities.
- A version appended by another actor appears after same-RFQ URL navigation; a delayed older RFQ refresh cannot remove it again.
- Delayed metadata withholds financial panels; abandoned snapshot/lifecycle replies cannot replace the current selection during rapid switching.
- A DOM observer detects any rendered selector/panel identity mismatch. Ready-state assertions additionally match the selected URL ID; browser hash mutation before hashchange delivery is not treated as an inconsistent rendered selector.
- Unsaved estimator margin/quantity and sessionStorage stay unchanged. Both saved snapshot responses remain identical before/after navigation. No quotation/outcome write request occurs during the check.

Commands:

- `node .tmp/t06-run.mjs tests/browser-version-consistency.smoke.js`: PASS after reproducing the failure before the fix.
- `node .tmp/version-consistency-run.mjs`: 7/7 PASS (new version-consistency test plus existing quotation, lifecycle, PDF, final-workflows, RFQ and focused UI suites).
- `npm.cmd run test:costing`: 33/33 PASS, all nine financial goldens unchanged.
- `npm.cmd run build`: PASS.
- `npm.cmd run test:production`: 1/1 PASS.
- `git diff --check`: PASS.

All checks use disposable local fixtures, not existing application/cloud data. Navigation is read-only; test setup deliberately appends two synthetic immutable versions before validating them. No snapshot is overwritten or recalculated to match labels.

## Consistent captures and changed files

- [Version 2 selected, 1440px](../.tmp/version-consistency/selected-version-2-1440.png)
- [Version 2 selected, 390px](../.tmp/version-consistency/selected-version-2-390.png)

The active Version 2 selector, saved annual baseline, approval panel, saved inputs and annual financial totals all refer to version 2. The RFQ can correctly remain sent because an earlier version was issued; RFQ outcome and the selected version's draft lifecycle remain separate facts. The earlier reported capture was copied into `.tmp/version-consistency/reported-saved-inputs-1440.png` before relevant suites regenerate the older capture path.

This check changes Workspace, the new version-consistency test, this report, current-status, learning-log, ADR-0019 and the Tier 2 handoff pointer. Previous Tier 1/Tier 2 work is preserved. Earlier Tier 2 review patches are retained before refreshing current patches. Windows Chrome only; no new production/browser coverage claim.

Owner understanding questions: Why does a same-RFQ hash change leave the original list stale? Why must metadata refresh avoid form initialization? Why can the RFQ be sent while selected version 2 remains draft?
