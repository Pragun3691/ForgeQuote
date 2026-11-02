# ADR-0002 — Costing and rounding policy

- **Status:** PROPOSED (owner approval required)
- **Decision:** See `docs/costing-spec.md`; HALF_UP monetary line rounding; sum rounded lines; gross-margin selling price; ex-GST approval at > ₹25 lakh, evaluated at customer's stated annual quantity (100% tier).
- **Why:** Reproducible paise-accurate PDFs and independent golden tests; clean separation of financial code from AI extraction.
- **Consequences:** Quote results can vary by a paise compared with schemes that only round once at the end; document formula version and every line.
- **Open:** GST rate, exact rate master keys, batch-size non-divisible rule, approval path for below-threshold quotes.
