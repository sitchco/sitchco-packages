# @sitchco/datalayer

## 0.2.0

### Minor Changes

- a2876e7: Reworked outbound URL forwarding and click tracking.

  - Replaced the single-purpose UTM capture with a configurable per-domain outbound-params system, and split the original `landing-params` API into `captureOutboundParams` (URL capture) and `registerOutboundDecorator` (link decoration) so the forwarded params can be updated at runtime.
  - Hardened the click tracker against navigation unload: dataLayer pushes now survive page transitions, and the previous `toggle` field is split into separate `expanded` and `pressed` ARIA signals.
  - Added `SPEC.md` documenting the package's public surface and behavior.

  Breaking: the `landing-params` export has been renamed to `outbound-params`, and the click tracker's `toggle` payload field is replaced by `expanded` / `pressed`.

## 0.1.3

### Patch Changes

- 5ce09a3: Fix stale custom attributes persisting across dataLayer click events. Custom fields from `data-gtm` JSON payloads (e.g. `production`, `date`, `price`) are now explicitly nulled on the next `site_click` if absent from the new payload, preventing GTM's recursive merge from retaining values from a previous click.

## 0.1.2

### Patch Changes

- f7645b1: Remove arbitrary 100-character limit on GTM context strings. The limit was based on GA4 constraints but context is only used in GTM for trigger filtering and is not passed to GA4 directly.

## 0.1.1

### Patch Changes

- Initial release
