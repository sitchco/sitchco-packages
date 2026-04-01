---
"@sitchco/datalayer": patch
---

Fix stale custom attributes persisting across dataLayer click events. Custom fields from `data-gtm` JSON payloads (e.g. `production`, `date`, `price`) are now explicitly nulled on the next `site_click` if absent from the new payload, preventing GTM's recursive merge from retaining values from a previous click.
