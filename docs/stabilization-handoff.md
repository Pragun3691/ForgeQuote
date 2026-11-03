# Stabilization before T03 - 2026-11-03

Owner approved this focused checkpoint, not T03 multipart implementation. Starting clean HEAD: d83323bb60b50b39f82c79613f461172ccc8ff61. Existing main/T02/T03 refs matched; used feature/T03-multipart-quotations without reset or recreation.

## Changes

- tests/browser-rfq.smoke.js: wait for the RFQ reference input to become enabled after asynchronous rate-key loading; retain all behavioral assertions.
- apps/web/src/styles.css: responsive Excel evidence grid/cards, min-width bounds and wrapping for long unbroken content.
- tests/browser-xlsx.smoke.js: legal maximum-length identifier/description import; assert evidence cards and paragraphs do not clip at 320, 390 and 1280px; confirm review does not save an extra receipt. Existing import/correction/confirmation/retry/manual fallback assertions remain.
- docs/deployment.md: migration 005, current object/trigger/function inventory, approved local procedure and actual save blocker.
- docs/current-status.md, docs/learning-log.md and this handoff: results and limits.

No endpoints, dependencies, financial policies/formulas, migration files, rates, snapshots, grants source or application save behavior changed. No deployment/push.

## Development migration and blocker

Verified both configured connections target local forgequote_dev on PostgreSQL port 5432; actual maintenance identity postgres differs from runtime forgequote_app. Existing 001-004 ledger checksums matched source, with only 005 pending. Applied existing unchanged migration using npm.cmd run db:migrate, then reviewed grants using npm.cmd run db:grant-runtime. Both passed; npm.cmd run db:check-permissions passed its ordinary grant checks while warning that users/sessions remain runtime-owned. Credentials stayed private.

Actual application readiness and estimator login returned 200. Synthetic RFQ creation through authenticated, CSRF-protected POST returned 503; sanitized service diagnostic identified SQLSTATE 42501 on users. Runtime owns users, has SELECT but lacks UPDATE; a read-only EXPLAIN SELECT 1 FROM public.users FOR KEY SHARE reproduces 42501. The receipt user foreign-key check encounters this existing ownership/privilege combination. Stopped further development writes; did not broaden permissions or change ownership. Creating/reopening a new RFQ in development is **not verified** and remains blocked pending separate approval.

Existing public object ownership and all preexisting non-session row digests were preserved, allowing exactly the new 005 migration ledger row. Session changes from authorized login are expected. Zero stabilization RFQs and zero receipt rows remain after failed transactions. Existing development data was not reset/truncated/deleted. No migrations/grants/data changes were made to existing forgequote_test, MedReach or cloud databases.

## Verification

| Check | Actual result |
| --- | --- |
| npm.cmd test | 78/78 passed |
| npm.cmd run test:costing | 33/33 passed; all nine unchanged financial goldens |
| npm.cmd run test:db | 81/81 passed |
| npm.cmd run test:browser:rfq | Three consecutive passes |
| npm.cmd run test:browser:xlsx | Passed including 320/390/1280px evidence, correction, confirmation, retry and fallback |
| npm.cmd run test:browser:ai:association | Passed; mocked provider |
| npm.cmd run test:browser:ai | Passed; mocked provider |
| npm.cmd run test:browser:quotation | Passed including persisted goldens/recovery/restart |
| npm.cmd run test:browser | Authentication passed |
| npm.cmd run check:api | 40 modules passed |
| node --check, both changed browser scripts | Passed |
| npm.cmd run build | Passed |
| npm.cmd run test:production | 1/1 passed |
| Real development RFQ create/reopen | FAILED/BLOCKED: 503 / 42501 users; no partial records |

The new long-content regression first failed at 390px before the CSS change, then passed at all three widths. Independent AI availability/rate-key requests explain why checking the form immediately after the AI status was timing-sensitive. Disposable fixtures and a uniquely named temporary parent database isolated the full integration/browser run; generated databases were removed. No live Gemini request was made or claimed. Development preservation check harnesses required allowing the expected new migration ledger row and using the same JSONB digest representation as the baseline; the corrected comparison passed.

## Limits and owner checks

The development foreign-key privilege blocker remains; ordinary grant checks and health readiness do not exercise every insert path. Existing runtime ownership of users/sessions also remains unsuitable for public deployment. No T03 feature, PDF intake, deployment or provider changes started.

1. Why must the RFQ test wait for the form gate independently of AI availability?
2. Why can a page fit a mobile viewport while a long identifier inside one card still clips?
3. Why can readiness and ordinary grant checks pass while an actual receipt insert fails on a referenced user row?
