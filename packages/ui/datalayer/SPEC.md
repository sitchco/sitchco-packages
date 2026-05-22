# @sitchco/datalayer Spec

## Axioms

1. **Framework-agnostic.** The package depends only on standard DOM, `window.dataLayer`, and `localStorage`. It does not import any framework, UI library, or host-app code. Any consumer that can call into JS in the browser can use it.
2. **Pure where possible; side effects are confined.** Side effects are limited to (a) appending to `window.dataLayer`, (b) reading/writing `localStorage` under one fixed key, (c) mutating outbound `<a href>` values, and (d) registering one document-level click listener and one `MutationObserver` per active decorator.
3. **Author intent is sacred.** URL query params present on a link at first decoration are recorded per-link and never overwritten by the library — not by initial decoration, not by `update()`, not by `clear()`.
4. **Allowlist gating is mandatory.** The outbound decorator never writes a key to a link or to storage unless that key is in the decorator's allowlist for that domain (per-link writes) or the union allowlist (storage writes via `update()` / `captureUrlParams()`).
5. **Storage is best-effort.** All `localStorage` reads, writes, and removes are wrapped against throws. Quota errors, disabled storage (private browsing), and malformed JSON all degrade silently — the in-memory state continues to drive decoration on the current page.
6. **Domain matching is precise.** A configured `domain` matches a link's `hostname` iff `hostname === domain || hostname.endsWith('.' + domain)`. No regex, no fuzzy prefix matching, no protocol or path semantics.
7. **Stale custom click keys are explicitly nulled.** Custom fields contributed by `data-gtm` JSON on one click are explicitly set to `null` on the next click if absent, so GTM's recursive variable merge does not retain stale values.
8. **Plain navigation clicks push synchronously.** A click that will cause the page to unload (plain left-click on a same-tab `<a href>` or `<button type="submit">`) skips the async `beforeResolve` barrier and pushes immediately, so the event survives unload.
9. **First-match-wins for overlapping domain rules.** When two configured domains both match a link's hostname, the first in config order is used. No allowlist merging.

---

## Chosen Approach

### Public exports

All exports live in `src/index.ts`.

| Export | Kind | Contract |
|---|---|---|
| `pushEvent` | function `(data, element?) => void` | Lazily initializes `window.dataLayer`. Resolves `context` from the element's ancestors via `resolveContext()` (or sets `context: null` if no element). Spreads `data`, attaches `context`, appends to `window.dataLayer`. |
| `resolveContext` | function `(element) => string` | Walks the ancestor chain and joins context contributions from `data-gtm` (non-JSON), `id`, `aria-label`, and `aria-labelledby` with `" > "` in document order (root → leaf). Returns `''` if no contextful ancestor exists. |
| `registerClickTracker` | function `(pushEvent, config?) => CleanupFn` | Attaches one delegated `click` listener at the document level. On tracked clicks, builds a `ClickPayload` and calls `pushEvent`. Returns a cleanup function that removes the listener. |
| `resolveClickPayload` | function `(element) => ClickPayload` | Pure helper. Returns the payload the click tracker would build for `element`, without dispatching or mutating state. |
| `registerOutboundDecorator` | function `(config) => OutboundDecoratorHandle` | Boots the outbound decorator: tears down any prior decorator, builds the per-domain and union allowlists, decorates the current document, and attaches a `MutationObserver` to decorate inserted links. Returns a handle with `update`, `clear`, and `cleanup`. |
| `captureUrlParams` | function `() => void` | Reads the current page URL's query string, filters through the active decorator's union allowlist, and feeds the result through the active handle's `update()`. No-op when no decorator is registered. |
| `doEnhancedEcommerce` | function `(pushEvent, event, items, extra?) => void` | Emits the GA4-required clear/push pair: a `{ event: '', ecommerce: null }` push followed by `{ event, ecommerce: { ...extra, items } }`. |
| `resolveAriaLabelledBy` | function `(element) => string` | Resolves `aria-labelledby` (space-separated IDs) by looking up each referenced element and joining their `textContent` with a single space. Returns `''` if the attribute is missing or no IDs resolve. |
| Types (all exported) | — | `PushEvent`, `DataLayerEvent`, `ClickData`, `ClickPayload`, `ClickTrackerConfig`, `CleanupFn`, `OutboundDecoratorHandle`, `OutboundDomainEntry`, `OutboundDecoratorConfig`, `GA4EcommerceItem`, `GA4EcommerceEvent`. |

### Wire shape expected from the host

The package reads two browser globals and does not require any host-injected data of its own:

- `window.dataLayer` — created lazily if absent. The package only appends; it never overwrites.
- `window.location.hostname` and `window.location.search` — used for outbound-vs-internal classification and URL param capture.

Decoration configuration is passed as a function argument (`OutboundDecoratorConfig`):

```ts
{
  domains?: Array<{ domain: string; extraParams?: string[] }>;
}
```

Each `domain` is a hostname-only string (the package normalizes trim/case on registered domains before matching). Each `extraParams` is a list of param-name tokens; tokens that don't match `/^[A-Za-z0-9_-]+$/` are silently filtered out of the per-domain allowlist on registration.

### Click tracking

**Trackable elements** match the selector `a, button, input[type=submit], [data-button]` (via `Element.closest()` from the click target). For `<a>` elements with a non-http(s) protocol (e.g. `mailto:`, `tel:`, `javascript:`), the tracker still emits a `site_click` event with `url` preserved verbatim and `direction: null` — only the outbound-vs-internal classification is suppressed.

**Opt-out:** an element with `data-gtm="0"` or `data-gtm="false"` is never tracked. The opt-out is checked before `beforeResolve` runs and before any DOM reads.

**Base click fields** (always emitted on every tracked click, in `payload.click`):

| Field | Type | Source |
|---|---|---|
| `label` | string | Resolution chain: `data-gtm.label` (JSON) → `aria-label` → resolved `aria-labelledby` text → `title` → `<input>` value → element `textContent` (whitespace collapsed, truncated). |
| `direction` | `'internal' \| 'outbound' \| null` | For links only: `'internal'` if hostname matches `window.location.hostname`, else `'outbound'`. `null` for non-link tracked elements. |
| `url` | `string \| null` | For outbound links: `origin + pathname + search + hash`. For internal links: `pathname + search + hash`. `null` for non-links. |
| `expanded` | `boolean \| null` | Read from `aria-expanded` post-`beforeResolve`. Coerced to `null` for any value other than the strings `"true"` or `"false"`. |
| `pressed` | `boolean \| null` | Read from `aria-pressed` post-`beforeResolve`. Coerced to `null` for any value other than `"true"` or `"false"` — including `"mixed"`. |

**Custom fields:** any non-reserved, non-null, non-empty-string keys from a valid `data-gtm` JSON object on the element are spread into `payload.click` alongside the base fields. Reserved keys (excluded from spread) are: `label`, `direction`, `url`, `expanded`, `pressed`, plus the prototype-pollution guards `__proto__`, `constructor`, `prototype`. `null` is reserved for the stale-key nulling channel; empty strings are filtered to reduce noise.

**Stale-key nulling.** Each click tracker instance remembers the set of custom keys it emitted on the previous tracked click. On the next tracked click, any keys that were present then but absent now are explicitly emitted as `null`. This forces GTM's recursive merge to clear them. Nulling happens once per disappearance; a key that has already been nulled is not nulled again until it reappears and disappears again.

**`beforeResolve` async barrier.** Before any DOM read for the click payload, the tracker awaits `config.beforeResolve(element)`. The default implementation yields one `requestAnimationFrame` so framework-driven ARIA flips have a chance to land before the read. Consumers can override to await arbitrary async work (e.g. identity resolution). Errors thrown from `beforeResolve` are caught and swallowed; the payload is built and pushed using the DOM state observed at that moment.

**Plain-navigation fast path.** If the click will unload the page — a left-click with no modifiers and no `preventDefault()`, on an `<a href>` with no `target` (or `target="_self"`) or a `<button type="submit">` — `beforeResolve` is skipped entirely and the event is dispatched synchronously. ARIA flips that haven't already landed will not be observed in this case, by design.

### Outbound decoration

**Registration.** `registerOutboundDecorator(config)`:

1. Tears down any prior decorator (disconnects observer, cancels pending debounce, sets the prior handle to inactive), except when `config.domains` is empty or omitted (in which case the prior decorator survives and a no-op handle is returned).
2. Builds per-domain allowlists: each is `UTM_DEFAULTS ∪ filterTokens(domain.extraParams)`. `UTM_DEFAULTS` is the fixed set `{utm_source, utm_medium, utm_campaign, utm_term, utm_content}`. Tokens that don't match the param-name regex are dropped silently.
3. Builds the **union allowlist** — the set union of every domain's per-domain allowlist. This is the gating set for `update()` and `captureUrlParams()` writes.
4. Reads any previously stored params (`getStoredOutboundParams()`) into the active in-memory map.
5. Decorates every existing outbound link (`document.querySelectorAll('a[href]')` filtered by `isHttpLink` and a hostname match).
6. Attaches a `MutationObserver` to `document.body` with `{ childList: true, subtree: true }` that decorates newly inserted links **immediately** (not via the 250 ms debounce; only `update()` and `clear()` are debounced).
7. Stores a closure as the "active capture" so a subsequent `captureUrlParams()` call has somewhere to write.

If `config.domains` is empty or omitted, registration returns a **no-op handle** — no observer is attached, no listeners are registered, and all handle methods are no-ops. No prior decorator is torn down in this case either.

**Matching.** For each `<a href>`:

- The link is skipped if `!isHttpLink(link)` (non-http(s) scheme) or `hostname === window.location.hostname` (internal).
- The hostname is matched against each configured domain in config order using `hostname === domain || hostname.endsWith('.' + domain)`. The first matching rule wins; the link is decorated using that rule's per-domain allowlist.

**Per-link write logic.** On every decoration pass for a matched link:

1. On the link's first decoration, the set of param keys present in its current URL is captured into a per-link `WeakMap` — these are "author-owned."
2. For each `(key, value)` in the active in-memory params:
   - Skip if `value === ''`.
   - Skip if `key` is not in this domain's allowlist.
   - Skip if `key` is author-owned for this link.
   - Otherwise, set `url.searchParams.set(key, value)`.
3. For each key currently on the URL that is in this domain's allowlist:
   - Skip if author-owned.
   - Skip if `activeParams[key]` is truthy.
   - Otherwise, delete it from the URL.
4. Write the updated URL back to `link.href`.

**Handle API:**

| Method | Signature | Contract |
|---|---|---|
| `update` | `(values: Record<string,string>) => void` | Filters `values` through the **union allowlist**. Merges the filtered values into the in-memory map (runtime wins on collision). Calls `updateStoredOutboundParams()` with the filtered values (merge into storage). Schedules a 250 ms trailing debounced full-document re-decoration. No-op after `cleanup()`. |
| `clear` | `(keys?: string[]) => void` | With `keys`: removes those keys from in-memory and storage (next debounced pass deletes them from links). Without `keys`: wipes in-memory entirely and removes the storage entry. Author-owned keys on links are never touched. Schedules a debounced re-decoration. No-op after `cleanup()`. |
| `cleanup` | `() => void` | Disconnects the observer, cancels any pending debounced re-decoration, sets the handle inactive (so subsequent `update`/`clear` are no-ops), and clears the package-level "prior teardown" and "active capture" pointers if they still reference this handle. Idempotent. |

### URL param capture

`captureUrlParams()` is a parameterless function. It reads `window.location.search`, projects only keys that are in the **union allowlist** of the currently registered decorator, and routes the result through `handle.update()`. When no decorator is registered (or after the registered decorator was cleaned up), `captureUrlParams()` is a no-op.

Because the routing path is `handle.update()`, the URL-captured values participate in allowlist gating, storage merging (URL wins on collision with existing storage), debounced re-decoration, and storage-error swallowing identically to any other `update()` call.

### Storage

The functions below describe internal package implementation, not the public API. Tests reach them via deep imports; consumers should drive storage exclusively through the public `handle` and `captureUrlParams` surface.

| Aspect | Value |
|---|---|
| Storage key | `outbound_params` |
| Storage shape | Flat JSON object: `Record<string, string>` |
| Persistence | No expiry; persists across reloads. |
| Read | `getStoredOutboundParams()` returns `{}` on missing entry, non-object JSON, malformed JSON, or storage errors. Non-string values inside the object are filtered out. |
| Write | `updateStoredOutboundParams(values)` merges into the existing blob (runtime values win). Errors swallowed. |
| Targeted remove | `removeStoredOutboundParams(keys)` removes only those keys; if the resulting blob is empty, the entire entry is removed. Errors swallowed. |
| Full remove | `removeStoredOutboundParams()` removes the entry entirely. Errors swallowed. |

Storage is a fan-out for cross-page persistence: subsequent page loads read it via `registerOutboundDecorator`'s initialization step.

### Enhanced ecommerce

`doEnhancedEcommerce(pushEvent, event, items, extra?)` emits two pushes in order:

1. `pushEvent({ event: '', ecommerce: null })` — GA4's "clear previous ecommerce" sentinel.
2. `pushEvent({ event, ecommerce: { ...extra, items } })` — the actual event.

Neither push resolves context (no element argument is passed). Both will appear in `window.dataLayer` with `context: null`.

### Utility exports

- **`resolveContext(element)`** — described above under public exports.
- **`resolveAriaLabelledBy(element)`** — described above. Joins resolved text with a single space.
- **`resolveClickPayload(element)`** — synchronous, pure variant of the click tracker's payload builder. Useful for testing and for custom dispatchers. Does not honor the opt-out (`data-gtm="0"`) check because there is no event to skip; consumers are expected to apply opt-out themselves if they need it.

### Types

All public types live in `src/types.ts` and are re-exported from `src/index.ts`:

- `PushEvent` — `(data: DataLayerEvent, element?: Element) => void`
- `DataLayerEvent` — `{ event?: string; [key: string]: unknown }`
- `ClickData` — `{ label?, direction?, url?, expanded?, pressed?, [key]: unknown }`
- `ClickPayload` — `DataLayerEvent & { event: 'site_click'; click: ClickData }`
- `ClickTrackerConfig` — `{ beforeResolve?: (el: Element) => Promise<void> | void }`
- `CleanupFn` — `() => void`
- `OutboundDomainEntry` — `{ domain: string; extraParams?: string[] }`
- `OutboundDecoratorConfig` — `{ domains?: OutboundDomainEntry[] }`
- `OutboundDecoratorHandle` — `{ update, clear, cleanup }`
- `GA4EcommerceItem` — `{ item_id, item_name, price?, quantity?, item_category?, item_brand?, [key]: unknown }`
- `GA4EcommerceEvent` — `DataLayerEvent & { ecommerce: { items: GA4EcommerceItem[]; [key]: unknown } }`

---

## Constraints (Must-NOT)

1. **Must not overwrite an author-placed URL param.** A key present in a link's `href` at first decoration is captured into a per-link `WeakMap` and is never written or deleted by the library — not by initial decoration, not by `update()`, not by `clear()`. Consumers must not mutate `href` on tracked anchors post-decoration; SPA-style URL swaps should replace the element rather than rewriting the attribute.
2. **Must not write a key that is not allowlisted.** Per-link writes use the matched domain's per-domain allowlist; `update()` and `captureUrlParams()` writes use the union allowlist.
3. **Must not match a false-positive hostname.** `evilpartner.com` does not match `partner.com`. The suffix match requires the literal `.` before the configured domain.
4. **Must not decorate a same-hostname (internal) link** — even if the configured domain matches the current page's hostname.
5. **Must not throw on storage errors.** Quota exceeded, disabled storage, blocked permission, malformed JSON, and removal failure all degrade to a no-op.
6. **Must not persist a non-allowlisted key on `update()`.** Filtering happens before the storage merge.
7. **Must not persist an empty-string value** on writes from `update()` — empty strings signal removal on next re-decoration.
8. **Must not race plain-navigation click events.** Plain left-clicks that unload the page bypass `beforeResolve` and push synchronously.
9. **Must not retain stale `data-gtm` custom keys in GTM.** Custom keys present on the previous tracked click but absent on the current one are explicitly emitted as `null`.
10. **Must not allow `data-gtm` JSON to override reserved click fields.** `label`, `direction`, `url`, `expanded`, and `pressed` are reserved from the JSON spread. `label` is honored only via the resolution chain's first link (`data-gtm.label`), not via the spread.
11. **Must not expose prototype-pollution-prone keys.** `__proto__`, `constructor`, and `prototype` are stripped from the spread set.
12. **Must not push more than one click event per tracked click.** A single delegated listener guards against multiple dispatches.
13. **Must not coalesce a `MutationObserver`-driven decoration with the 250 ms debounce.** Newly inserted links are decorated immediately on the next observer callback; only `update()` and `clear()` use the debounce.
14. **Must not retain prior-decorator state after re-registration.** `registerOutboundDecorator` tears down the prior decorator's observer, debounce, and active-capture pointer before initializing the new one.

---

## Scenarios

### `pushEvent`

#### S1. First push initializes `window.dataLayer`

**Trigger:** `pushEvent({ event: 'site_click' })` is called on a page where `window.dataLayer` is undefined.

**Expected:** `window.dataLayer` is created as `[]`. The event `{ event: 'site_click', context: null }` is appended.

**Must NOT:** Throw. Overwrite an existing `window.dataLayer`.

#### S2. Push with an element resolves context

**Trigger:** `pushEvent({ event: 'site_click', click: { label: 'Buy' } }, buttonEl)` where `buttonEl` lives under `<section data-gtm="Hero">`.

**Expected:** Pushed event has `context: 'Hero'`. The `data` is spread first, then `context` is added.

### `resolveContext`

#### S3. Multi-ancestor breadcrumb

**Trigger:** Resolve from a button nested inside `<section id="hero"><div aria-label="CTA Row">…</div></section>`.

**Expected:** Returns `'hero > CTA Row'` — root-to-leaf order, joined by `' > '`.

#### S4. `data-gtm="0"` and `data-gtm="false"` ancestors are skipped

**Trigger:** Ancestor has `data-gtm="0"`.

**Expected:** That ancestor contributes nothing to context (it's the opt-out marker).

#### S5. JSON `data-gtm` ancestors are skipped from context

**Trigger:** Ancestor has `data-gtm='{"label":"X"}'`.

**Expected:** That ancestor does not contribute to context (its JSON contributes to click payload only, not breadcrumb).

### `registerClickTracker`

#### S6. Tracked click on a button pushes `site_click`

**Trigger:** Tracker registered; click on `<button>Buy</button>`.

**Expected:** `window.dataLayer` receives `{ event: 'site_click', click: { label: 'Buy', direction: null, url: null, expanded: null, pressed: null }, context: null }` (after `beforeResolve` resolves).

#### S7. Tracked click on an outbound `<a>`

**Trigger:** Click on `<a href="https://example.com/page">…</a>` from a page on `roundabout.org`.

**Expected:** `click.direction === 'outbound'`; `click.url === 'https://example.com/page'`.

#### S8. Tracked click on an internal `<a>`

**Trigger:** Click on `<a href="/about">…</a>`.

**Expected:** `click.direction === 'internal'`; `click.url === '/about'` (origin omitted).

#### S9. `aria-expanded` is read post-`beforeResolve`

**Trigger:** Button starts with `aria-expanded="false"`; `beforeResolve` flips it to `"true"` before resolving.

**Expected:** `click.expanded === true`.

#### S10. `aria-pressed="mixed"` coerces to `null`

**Trigger:** Click on a button with `aria-pressed="mixed"`.

**Expected:** `click.pressed === null`.

#### S11. Both ARIA fields read independently

**Trigger:** Element has both `aria-expanded="true"` and `aria-pressed="false"`.

**Expected:** `click.expanded === true`; `click.pressed === false`.

#### S12. Missing ARIA → both fields are `null`

**Trigger:** Plain button with no ARIA attributes.

**Expected:** `click.expanded === null`; `click.pressed === null`.

#### S13. `data-gtm` JSON spreads custom fields

**Trigger:** Element has `data-gtm='{"label":"Override","promo":"summer"}'`.

**Expected:** `click.label === 'Override'` (via chain); `click.promo === 'summer'` (via spread).

#### S14. `data-gtm` JSON cannot override base fields

**Trigger:** Element has `data-gtm='{"direction":"hijack","expanded":"hijack","url":"hijack"}'`.

**Expected:** Base fields take values from the DOM/computation, not the JSON. The hijack keys do not appear in the payload.

#### S15. Stale custom keys are nulled on the next click

**Trigger:** Click 1 on an element with `data-gtm='{"production":"Hadestown"}'`. Click 2 on a different element with no `data-gtm` custom keys.

**Expected:** Click 2's payload includes `click.production: null`.

#### S16. Once nulled, a key is not nulled again

**Trigger:** After S15, click 3 on yet another element with no custom keys.

**Expected:** Click 3's payload does not include `production` at all.

#### S17. Plain left-click on an `<a>` pushes synchronously

**Trigger:** Plain left-click (no modifiers, default not prevented) on a same-tab `<a href="https://example.com">`.

**Expected:** The event is pushed before the navigation begins; `beforeResolve` is **not** awaited (even a custom one is skipped).

#### S18. Modifier or `target="_blank"` click awaits `beforeResolve`

**Trigger:** Cmd-click on `<a href>` or click on `<a target="_blank">`.

**Expected:** The page won't unload; `beforeResolve` is awaited normally before payload assembly.

#### S19. `<button type="submit">` click pushes synchronously

**Trigger:** Plain click on a submit button (form will submit and unload).

**Expected:** Synchronous push; `beforeResolve` skipped.

#### S20. Cleanup removes the listener

**Trigger:** Register tracker, click (1 push), call cleanup, click again.

**Expected:** Only 1 push total. No further events tracked.

### Non-trackable clicks

#### N1. Click on a non-trackable element

**Trigger:** Click on a `<div>` not matched by the trackable selector.

**Expected:** No push. `beforeResolve` is not called.

#### N2. Opted-out element with `data-gtm="0"` or `"false"`

**Trigger:** Click on a button bearing `data-gtm="0"`.

**Expected:** No push. `beforeResolve` is not called for that element.

#### N3. Non-http(s) link

**Trigger:** Click on `<a href="mailto:hello@example.com">` or `<a href="tel:+15551234">`.

**Expected:** A `site_click` event is pushed with `click.url` preserved verbatim (e.g. `'mailto:hello@example.com'`) and `click.direction === null`. The outbound classification is suppressed for non-http(s) schemes, but the click is still tracked.

### `registerOutboundDecorator`

#### S21. Decorate existing outbound link to a configured domain

**Trigger:** `localStorage` holds `{ utm_source: 'google' }`. Register with `domains: [{ domain: 'partner.com' }]`. Page contains `<a href="https://partner.com/page">`.

**Expected:** On registration, the link's href becomes `https://partner.com/page?utm_source=google`.

#### S22. UTM defaults flow to every configured domain

**Trigger:** Two configured domains, neither declaring `extraParams`. Stored params include all 5 UTM keys.

**Expected:** Both domains' links receive all 5 UTM keys on decoration.

#### S23. `extraParams` are domain-scoped

**Trigger:** Configure `partner.com` with `extraParams: ['session_hash']` and `other.com` with `extraParams: ['shop_id']`. Storage holds `{ utm_source: 'g', session_hash: 'h', shop_id: 's' }`.

**Expected:** `partner.com` link gets `utm_source` and `session_hash` (no `shop_id`). `other.com` link gets `utm_source` and `shop_id` (no `session_hash`).

#### S24. First-match-wins for overlapping rules

**Trigger:** Configure `partner.com` (extras `session_hash`) then `shop.partner.com` (extras `shop_id`). Click a link to `shop.partner.com`.

**Expected:** The link receives `session_hash` (from the first matching rule), not `shop_id`.

#### S25. Subdomain matching

**Trigger:** Configure `partner.com`. Page contains links to `partner.com`, `www.partner.com`, `shop.partner.com`.

**Expected:** All three are matched and decorated.

#### S26. False-positive suffix is not matched

**Trigger:** Configure `partner.com`. Page contains `<a href="https://evilpartner.com">`.

**Expected:** No decoration; the link is left alone.

#### S27. Same-hostname (internal) links are not decorated

**Trigger:** Configure the site's own hostname in `domains`. Page contains `<a href="/path">` and `<a href="https://OWN.HOST/path">`.

**Expected:** Neither is decorated (internal classification short-circuits).

#### S28. Author-placed params are protected

**Trigger:** Link is `<a href="https://partner.com/?utm_source=manual">`. Storage holds `{ utm_source: 'google' }`.

**Expected:** The link's `utm_source` remains `manual`. The library never overwrites.

#### S29. Newly inserted links are decorated immediately

**Trigger:** Decorator registered. A script inserts `<a href="https://partner.com/page">` into the DOM.

**Expected:** The new link is decorated on the next observer callback (synchronously after insertion, no debounce).

#### S30. Empty `domains` returns a no-op handle

**Trigger:** `registerOutboundDecorator({ domains: [] })` or `registerOutboundDecorator({})`.

**Expected:** Returned handle's `update`, `clear`, and `cleanup` are no-ops. No observer attached. No prior decorator torn down.

#### S31. Re-registration tears down the prior decorator

**Trigger:** Register decorator A; later register decorator B.

**Expected:** A's observer is disconnected; A's pending debounce is cancelled; A's handle becomes inactive. B's observer and capture are active.

#### S31a. Register-time storage prune against the active allowlist

**Trigger:** `localStorage['outbound_params']` holds `{ utm_source: 'g', session_id: 'abc' }`. Call `registerOutboundDecorator` with a `unionAllowed` allowlist that includes `utm_source` but not `session_id`.

**Expected:** During registration, `session_id` is pruned from both the in-memory active params and the persisted storage blob. Decorated links never receive `session_id`. Stale values cannot resurrect on a future re-registration that re-adds the same key name.

### `handle.update`

#### S32. Allowlisted update writes through

**Trigger:** Configured `extraParams: ['vid']`. Call `handle.update({ vid: 'v1' })`.

**Expected:** Storage gains `vid: 'v1'`. After 250 ms, matching links gain `?vid=v1` (subject to author protection and per-domain allowlist).

#### S33. Non-allowlisted keys are dropped before storage

**Trigger:** Call `handle.update({ vid: 'v1', random_key: 'x' })`. Only `vid` is in any domain's allowlist.

**Expected:** Storage gains only `vid`. `random_key` is not written to storage and never appears on a link.

#### S34. Update merges with existing storage

**Trigger:** Storage has `{ utm_source: 'google' }`. Call `handle.update({ vid: 'v1' })`.

**Expected:** Storage becomes `{ utm_source: 'google', vid: 'v1' }`.

#### S35. Bursts of updates are coalesced

**Trigger:** Call `handle.update(...)` three times within 250 ms.

**Expected:** Only one re-decoration runs (after the debounce trailing edge). All three values are merged into storage before the re-decoration.

#### S36. Empty-string value removes the key from links

**Trigger:** Link has `?vid=v1` (library-written). Call `handle.update({ vid: '' })`.

**Expected:** After re-decoration, `vid` is removed from the link's URL. The library treats `''` as "no value."

#### S37. Storage error doesn't break in-memory decoration

**Trigger:** `localStorage.setItem` throws (quota or permission). Call `handle.update({ vid: 'v1' })`.

**Expected:** The error is swallowed. In-memory params still include `vid`; the next re-decoration writes `vid` to matching links.

#### S38. Update after cleanup is a no-op

**Trigger:** Call `handle.cleanup()`, then `handle.update({ vid: 'v1' })`.

**Expected:** No storage write. No re-decoration. No throw.

### `handle.clear`

#### S39. Targeted clear removes those keys

**Trigger:** Storage has `{ utm_source: 'g', vid: 'v1' }`. Call `handle.clear(['vid'])`.

**Expected:** Storage becomes `{ utm_source: 'g' }`. After re-decoration, `vid` is removed from links; `utm_source` remains.

#### S40. Unscoped clear wipes everything

**Trigger:** Call `handle.clear()` (no args).

**Expected:** Storage entry removed entirely. After re-decoration, all library-written params are stripped from links. Author-placed params remain untouched.

#### S41. `clear([])` is a no-op

**Trigger:** Call `handle.clear([])`.

**Expected:** Returns immediately with no state change — no storage I/O, no scheduled re-decoration pass.

#### S42. Clear after cleanup is a no-op

**Trigger:** `handle.cleanup()` then `handle.clear()`.

**Expected:** No state change.

### `captureUrlParams`

#### S43. URL params are captured through the active decorator

**Trigger:** Decorator registered with union allowlist `{ utm_source, vid, tess }`. URL is `?utm_source=google&tess=abc&random=x`. Call `captureUrlParams()`.

**Expected:** Storage merges in `{ utm_source: 'google', tess: 'abc' }`. `random` is ignored (not allowlisted).

#### S44. Capture is sticky on empty URL

**Trigger:** Storage has `{ utm_source: 'facebook' }`. URL has no allowlisted params. Call `captureUrlParams()`.

**Expected:** Storage unchanged. (The capture closure short-circuits when no allowlisted params are present in the URL, so no `update()` call is made.)

#### S45. URL wins on collision

**Trigger:** Storage has `{ utm_source: 'facebook' }`. URL is `?utm_source=google`. Call `captureUrlParams()`.

**Expected:** Storage becomes `{ utm_source: 'google' }`.

#### S46. No decorator registered

**Trigger:** Call `captureUrlParams()` with no decorator registered (or after cleanup).

**Expected:** No-op. No storage write. No throw.

### `doEnhancedEcommerce`

#### S47. Two-push GA4 contract

**Trigger:** `doEnhancedEcommerce(pushEvent, 'view_item', [{ item_id: 'A', item_name: 'A' }])`.

**Expected:** `window.dataLayer` receives, in order: `{ event: '', ecommerce: null, context: null }` then `{ event: 'view_item', ecommerce: { items: [...] }, context: null }`.

#### S48. `extra` is merged into `ecommerce`

**Trigger:** Pass `extra = { transaction_id: 'T-1', value: 29.99 }`.

**Expected:** The second push's `ecommerce` is `{ transaction_id: 'T-1', value: 29.99, items: [...] }`. `items` is always last in the spread, so an `items` key in `extra` is overridden.

### `resolveAriaLabelledBy`

#### S49. Multi-ID join

**Trigger:** Element has `aria-labelledby="lbl-1 lbl-2"`; the referenced elements have text "Search" and "the site".

**Expected:** Returns `"Search the site"`.

#### S50. Missing IDs are skipped silently

**Trigger:** `aria-labelledby="missing"`.

**Expected:** Returns `""`. No throw.

---

## Edge Cases

| Edge case | Behavior |
|---|---|
| `window.dataLayer` pre-exists | Appended to; never replaced. |
| `pushEvent` called with no element | `context: null` is set. |
| `data-gtm="0"` ancestor in context chain | Skipped from breadcrumb. |
| Deeply nested ancestors with context | All contribute; joined in document order. No depth limit. |
| Click on `<a href="mailto:…">`, `tel:`, or `javascript:` URI | Tracked: `site_click` pushed with `url` preserved verbatim and `direction: null`. |
| Click target deep inside a tracked element | `closest()` finds the trackable ancestor; payload uses that ancestor. |
| Whitespace and newlines in element `textContent` | Collapsed to single spaces in the label. |
| Very long `textContent` | Truncated to a fixed maximum length when used as label. |
| Invalid JSON in `data-gtm` | Treated as no custom fields; no throw. |
| Reserved key in `data-gtm` JSON (`label`, `direction`, `url`, `expanded`, `pressed`) | Stripped from spread; `data-gtm.label` is honored only by the label chain. |
| Prototype-pollution key in `data-gtm` JSON | `__proto__`, `constructor`, `prototype` stripped from spread. |
| `aria-pressed="mixed"` | Coerced to `null`. |
| `aria-expanded` or `aria-pressed` with any value other than `"true"`/`"false"` | Coerced to `null`. |
| Custom `beforeResolve` throws | Caught and swallowed; payload built and pushed using whatever DOM state was observed. |
| Plain nav click with a custom `beforeResolve` | `beforeResolve` is **not** called; sync push. |
| Tracker registered twice (without cleanup) | Each registration attaches a separate listener; clicks fire both. (Caller's responsibility.) |
| Decorator config with an `extraParams` token that fails the regex | Dropped from that domain's allowlist on registration. |
| Decorator config `domains` is omitted vs `[]` | Both produce a no-op handle. |
| Link with malformed `href` (URL constructor throws) | Decoration of that link is skipped silently. |
| Link to a configured domain via a different protocol scheme | Skipped (non-http(s)). |
| Link to a hostname matching multiple rules | First-match-wins by config order. |
| `evilpartner.com` vs configured `partner.com` | No match — the suffix check requires `.` before the configured value. |
| Storage corruption (non-JSON value) | Read returns `{}`. Subsequent writes overwrite the corrupt blob. |
| Storage object has non-string values | Filtered out on read; only string values surface in the in-memory map. |
| `localStorage` disabled (private browsing, blocked) | All read/write/remove operations swallow errors; decoration proceeds in-memory only. |
| `clear(['key'])` after which the storage blob is empty | The entire storage entry is removed (rather than left as `{}`). |
| `update()` value of empty string for a key already on a link | Next debounced pass deletes the key from the link's URL. |
| `update()` then `cleanup()` before debounce fires | The pending re-decoration is cancelled; storage write already happened. |
| `MutationObserver` callback during pending debounce | Newly inserted links are decorated immediately and independently of the debounced full pass. |
| Re-registering decorator while the prior debounce is pending | Prior debounce is cancelled; prior observer is disconnected; new decorator initializes cleanly. |
| `doEnhancedEcommerce` with empty `items` array | Still emits both pushes; `items: []` is preserved. |
| `aria-labelledby` referencing an element with no `textContent` | That ID contributes nothing; surrounding IDs still join normally. |

---

## Out of Scope

- **Concurrent decorators on one page.** The package assumes a single active decorator; re-registration tears the prior one down. Two long-lived decorators is unsupported.
- **Per-link decoration opt-out.** No `data-no-decorate` or similar. Author-placed params are protected, but the decorator does not honor a "skip this link" marker.
- **Wildcard, regex, or path-based domain matching.** Only exact-and-subdomain matching is supported.
- **Subdomain exclusion.** Configuring `partner.com` always matches all subdomains. No syntax to scope to an exact hostname.
- **Param-value validation.** Only param **names** are regex-validated. Param values are written as-is (URL-encoded by `URLSearchParams.set`).
- **Tri-state ARIA preservation.** `aria-pressed="mixed"` coerces to `null`; the click payload has no representation for tri-state.
- **`role="switch"` (`aria-checked`) and listbox (`aria-selected`) tracking.** Only `aria-expanded` and `aria-pressed` are read into the click payload.
- **Capture-time element awareness.** `captureUrlParams()` does not accept an element argument; the captured values' downstream use is determined by the decorator, not by the call site.
- **Cross-tab synchronization of storage.** No `storage`-event listener; updates in one tab do not propagate to other tabs in real time.
- **Storage expiry / TTL.** Stored params persist indefinitely until cleared.
- **Storage isolation across consumers.** A single fixed key (`outbound_params`) is used; multiple consumers on one page share storage.
- **`doEnhancedEcommerce` context resolution.** Both ecommerce pushes carry `context: null`; the helper does not accept an element argument.
- **Synchronous-by-default click tracking.** All non-navigation clicks await `beforeResolve` (which at minimum yields one rAF). Consumers who want strictly synchronous tracking must use `resolveClickPayload` and dispatch themselves.
