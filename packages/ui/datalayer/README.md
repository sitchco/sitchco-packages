# @sitchco/datalayer

Framework-agnostic GTM data layer utilities. Captures URL params, decorates outbound links, and pushes events into `window.dataLayer`. No WordPress or framework coupling — works identically in any browser context.

## Outbound link decoration

`registerOutboundDecorator(config)` returns an imperative handle so callers can push runtime-sourced param values (e.g. an identity-service result) into the decoration pipeline after registration.

```ts
import { registerOutboundDecorator } from '@sitchco/datalayer';

const handle = registerOutboundDecorator({
    domains: [
        { domain: 'partner.com', extraParams: ['vid'] },
        { domain: 'example.com', extraParams: ['tess'] },
    ],
});

// Later — once an async source resolves:
handle.update({ vid: 'visitor-abc' });

// Remove a single key (e.g. on logout):
handle.clear(['vid']);

// Wipe everything (in-memory, localStorage, and library-written URL keys):
handle.clear();

// Detach observer and cancel any pending debounced re-decoration:
handle.cleanup();
```

### `OutboundDecoratorHandle`

| Member | Behavior |
|---|---|
| `update(values)` | Merge `values` into in-memory state (runtime wins on collision) and into `localStorage['outbound_params']`. Schedules a debounced re-decoration of the document. |
| `clear(keys?)` | With `keys`: remove those keys from in-memory state, `localStorage`, and previously-decorated links. Without `keys`: full wipe — including URL-captured values. Schedules a debounced re-decoration. |
| `cleanup()` | Disconnect the `MutationObserver`, cancel any pending debounced pass, and turn subsequent `update`/`clear` calls into no-ops. |

If `config.domains` is empty or omitted the handle's methods are all no-ops.

### Author-placed params are protected

The decorator captures each link's original `href` query keys the first time it sees the link. Those keys are never written or deleted by the decorator — `update`/`clear` only touch keys the library added itself. Editors can hand-author destination params without fear of them being clobbered by runtime updates.

### UTM keys propagate universally

`utm_source`, `utm_medium`, `utm_campaign`, `utm_term`, and `utm_content` are always allowed on every configured outbound domain, regardless of per-domain `extraParams` declarations. A call like `handle.update({ utm_source: 'fb' })` therefore propagates to **every** configured domain. Non-UTM keys (e.g. `vid`, `tess`) still require explicit declaration on each domain's `extraParams`.

### Persistence semantics

Runtime values written via `update()` are persisted to `localStorage['outbound_params']` and survive in-session navigations. `captureUrlParams()` reads allowlisted params from the current URL and merges them into the stored blob — URL values win on collision but keys absent from the URL are preserved, so sticky storage carries across page loads.

Persistence is best-effort: when `localStorage` is unavailable (private browsing, quota exceeded, blocked storage), writes from `update()` silently fail. The handle's in-memory state continues to drive link decoration for the current page, so same-page outbound clicks still receive the runtime values. However, those values may not survive a full-page navigation, since recovery on the next page depends on reading them back from storage. Earlier failed writes are not retroactively persisted once storage becomes available again — only subsequent `update()` calls will be written.

### Debounce

Document-wide re-decorations triggered by `update`/`clear` are debounced (~250ms trailing) to coalesce bursts of consumer activity. Subtree decoration triggered by the `MutationObserver` for newly-inserted DOM runs immediately.
