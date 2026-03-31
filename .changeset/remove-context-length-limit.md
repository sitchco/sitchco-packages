---
"@sitchco/datalayer": patch
---

Remove arbitrary 100-character limit on GTM context strings. The limit was based on GA4 constraints but context is only used in GTM for trigger filtering and is not passed to GA4 directly.
