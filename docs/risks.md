# Risk register

| Risk | Preventive action | Fallback |
|---|---|---|
| Late integration/deploy | Deploy minimal frontend/API/Postgres from first slice; smoke test daily | Keep fewer screens and stable core |
| Arithmetic inconsistency | Independently specified golden cases, fixed decimal rounding | Block quote issue if failing tests |
| AI hallucinations/confidentiality | Synthetic fixtures, verified snippets, human confirmation, provider terms check | Manual entry; report extraction failure honestly |
| Rate gaps/overlaps | DB constraint or transactional protection, boundary tests | Refuse pricing and show clear error |
| Quote edits after approval | Immutable quote versions, server checks | Create revision; invalidate old pending approval |
| Time overrun | Finish core before extras; feature freeze Nov 6 target, Nov 8 contingency | Omit optional import/routing search |
| Interview inability to defend code | Learning log, predictions before coding, demo and 3 Qs per task | Spend time tracing each API and decision |
