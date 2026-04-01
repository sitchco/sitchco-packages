# @sitchco/datalayer

## 0.1.3

### Patch Changes

- 5ce09a3: Fix stale custom attributes persisting across dataLayer click events. Custom fields from `data-gtm` JSON payloads (e.g. `production`, `date`, `price`) are now explicitly nulled on the next `site_click` if absent from the new payload, preventing GTM's recursive merge from retaining values from a previous click.

## 0.1.2

### Patch Changes

- f7645b1: Remove arbitrary 100-character limit on GTM context strings. The limit was based on GA4 constraints but context is only used in GTM for trigger filtering and is not passed to GA4 directly.

## 0.1.1

### Patch Changes

- Initial release
