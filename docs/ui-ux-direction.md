# UI/UX direction (proposed; timebox ~90 min)

- A calm, professional **industrial costing workspace**, not a generic marketing dashboard.
- Desktop-first, with a usable collapsed nav and horizontally scrollable detailed tables on small screens.
- Light interface, neutrals, single restrained teal/blue accent; design tokens and shared components.
- RFQ list: customer, due date, assigned estimator, status, next action; filters/search.
- Intake: extracted text/source on left; editable AI suggestions with confidence *only if calibrated* and verified source snippets on right.
- Costing screen: part + routing controls, editable volumes, aligned money columns, live breakdown, fixed Save Draft / Submit action, visible rate effective date and version.
- Approval screen: proposed vs approved, threshold reasoning, who acted, audit trail.
- Quote screen: frozen rate versions and PDF preview/download; no recalculation from latest rates.
- Loading/empty/errors, keyboard tab order, readable form labels and helpful validation.
- Get references for interaction patterns, not literal copies; prioritize cost-table information density over animations.

**Review gate:** approve typography, navigation, dashboard/list hierarchy, costing workspace wireframe, and AI confirmation pattern before big frontend implementation.

Milestone 7 first-workspace direction/implementation plan was approved by the owner. Implemented a light teal RFQ register, stored part facts, editable costing inputs, saved-result volume/financial tables, provenance, version navigation and explicit failure/recovery states. Desktop and 390px Chrome screenshots were inspected; detailed tables scroll horizontally. No dashboard/AI confirmation UI or extensive redesign. Dedicated polish and later features remain behind the next review.
