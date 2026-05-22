---
"@sitchco/datalayer": minor
---

Reworked outbound URL forwarding and click tracking.

- Replaced the single-purpose UTM capture with a configurable per-domain outbound-params system, and split the original `landing-params` API into `captureOutboundParams` (URL capture) and `registerOutboundDecorator` (link decoration) so the forwarded params can be updated at runtime.
- Hardened the click tracker against navigation unload: dataLayer pushes now survive page transitions, and the previous `toggle` field is split into separate `expanded` and `pressed` ARIA signals.
- Added `SPEC.md` documenting the package's public surface and behavior.

Breaking: the `landing-params` export has been renamed to `outbound-params`, and the click tracker's `toggle` payload field is replaced by `expanded` / `pressed`.
