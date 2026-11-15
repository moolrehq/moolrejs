# Changelog

## 1.1.0

Built on top of the unreleased "Secure checkout URLs and iframe payment events" and "server-side payment verification" changes (`allowedCheckoutOrigins`, exact-origin and iframe-window message checks, `externalRef` match on success, README verification section), which are included in this release.

Added
- TypeScript definitions (`src/moolre.d.ts`).
- `environment: "sandbox"` option (link request goes to `https://sandbox.moolre.com/embed`).
- `destroy()` and Escape-to-close.
- SSR safety: constructing or importing no longer touches `document`; styles are installed when the first modal opens.
- `timeoutMs` (default 30000) and `credentials: "omit"` on the link request; `apiBase` must be https.
- Structured errors with `code`, `fields`, `requestId`, `httpStatus` (also for HTTP 200 responses with `status: 0`); `TIMEOUT` and `NETWORK` codes; API `notices` logged once per response.
- Numeric `amount` is sent as a two-decimal string.
- Modal iframe gets `referrerpolicy` and a `title`.
- Pinned `terser` devDependency, jsdom tests, `publishConfig.provenance`.

Behaviour changes for existing integrations
- Inherited from the 2026-11-11 security commits: checkout URLs must be https on an `allowedCheckoutOrigins` origin (default `https://pos.moolre.com`; subdomain wildcards no longer accepted); events must come from the active checkout iframe; `onSuccess` is dropped when the reported reference differs from `externalRef`; callbacks run after the modal closes.
- `allowedOrigins` entries in the old `.moolre.com` form still work, but only as an extra filter.
- A link-creation response with `status: 0` now rejects with the API's message and code instead of "Missing authorization_url".
- `apiBase` over plain http is refused (except localhost).

## 1.0.2

Initial public release on npm.
