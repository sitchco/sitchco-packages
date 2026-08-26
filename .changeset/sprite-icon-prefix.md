---
'@sitchco/module-builder': patch
---

List only `icon-` prefixed sprite symbols in `sprite-icons.json`

A module's `assets/images/svg-sprite/` directory is not an icon directory — every SVG in it goes into the sprite, but only the `icon-` prefixed ones are icons. The sprite build previously listed all of them, so a decorative shape dropped in that directory turned up as a choice in the ACF icon picker, where it could never render: the PHP side asks the sprite for `#icon-{name}`, which an unprefixed symbol does not answer to.

Unprefixed SVGs still go into `sprite.svg` and stay reachable by a direct `<use href="#{id}">` — that is now the supported way to ship a shape without polluting the picker.
