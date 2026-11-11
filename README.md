# Moolre Inline JavaScript SDK

Use the Moolre Inline SDK to create a payment link and show the Moolre checkout in a modal.

## Install

```bash
npm install @moolre/moolrejs
```

## Quick start

> [!WARNING]
> **Verify payment on your server before fulfilling an order.** `onSuccess` is a browser notification, not proof of payment. Check the transaction's status, reference, amount, currency, and receiving account with Moolre from your backend. See [Required server-side payment verification](#required-server-side-payment-verification).

```js
import MoolrePay from "@moolre/moolrejs";

const popup = new MoolrePay();

await popup.checkout({
  username: "MOOLRE_USERNAME",
  publicKey: "MOOLRE_PUBLIC_KEY",
  accountNumber: "MOOLRE_ACCOUNT_NUMBER",
  amount: 50,
  email: "customer@example.com",
  externalRef: `order_${Date.now()}`,
  currency: "GHS",
  // Ask your backend to verify payment before marking the order paid.
  onSuccess: (transaction) => console.log("Checkout reported success; server verification required", transaction),
  onCancel: () => console.log("Payment cancelled"),
  onError: (error) => console.error("Payment error", error),
});
```

## Required server-side payment verification

**Before marking an order paid or delivering goods, your backend must fetch the authoritative transaction from Moolre and verify:**

- **Status:** the transaction was successfully paid.
- **Reference:** it exactly matches the reference stored for this order.
- **Amount and currency:** both match the order's expected payment.
- **Receiving account:** payment went to the expected merchant account.
- **Environment:** the transaction belongs to the expected live or sandbox environment.

Make fulfillment idempotent so repeated notifications cannot deliver an order twice, and reject replays for cancelled or refunded orders. Browser-supplied amounts, callbacks, and public identifiers cannot authorize fulfillment. Keep verification credentials on your server.

## Set defaults

Set merchant details once if you create more than one checkout.

```js
import MoolrePay from "@moolre/moolrejs";

const popup = new MoolrePay({
  username: "MOOLRE_USERNAME",
  publicKey: "MOOLRE_PUBLIC_KEY",
  accountNumber: "MOOLRE_ACCOUNT_NUMBER",
});

await popup.checkout({
  amount: 50,
  email: "customer@example.com",
  externalRef: "order_123",
});
```

You can also use `popup.setup({ ... })`. Values passed to `checkout()` or `preloadTransaction()` override the defaults.

## Preload checkout

```js
const openPayment = await popup.preloadTransaction({
  amount: 50,
  email: "customer@example.com",
  externalRef: "order_123",
});

document.querySelector("#pay-now").addEventListener("click", openPayment);
```

## Options

| Option | Required when creating a link | Description |
| --- | --- | --- |
| `username` | Yes | Your Moolre username. Sent as `X-API-USER`. |
| `publicKey` | Yes | Your Moolre public API key. |
| `accountNumber` | Yes | Merchant account number. |
| `amount` | Yes | Payment amount. |
| `email` | Yes | Customer email address. |
| `externalRef` | Yes | Unique transaction reference. |
| `currency` | No | Currency code. Defaults to `GHS`. |
| `metadata` | No | Extra payment metadata. |
| `callbackUrl` | No | Callback URL for payment updates. |
| `redirectUrl` | No | URL to redirect to after completion. |
| `mode` | No | Payment mode. Defaults to `payment`. |
| `reusable` | No | Whether the generated link can be reused. |
| `iframeHeight` | No | Checkout modal height. Defaults to `630px`. |
| `allowedCheckoutOrigins` | No | Exact HTTPS checkout origins. Defaults to `["https://pos.moolre.com"]`. Configure additional trusted hosted checkout origins explicitly. Wildcards and domain suffixes are rejected. |
| `allowedOrigins` | No | Optional additional restriction on message origins. Messages must always come from the active iframe and its exact checkout URL origin. |
| `paymentUrl` | No | Existing payment URL. When supplied, the SDK does not call the link API and API credentials are not required. |

## Events

| Callback | When it runs |
| --- | --- |
| `onLoad` | The checkout iframe has loaded. |
| `onSuccess` | The hosted checkout reports success. **Server-side payment verification is required before fulfillment.** See [verification requirements](#required-server-side-payment-verification). |
| `onError` | Validation, network, or payment errors occur. |
| `onCancel` | The customer closes or cancels the checkout. |
| `onClose` | The modal is manually closed. |

## Browser and API requirements

Checkout URLs supplied through `paymentUrl` or returned by the link API must use HTTPS, contain no embedded credentials, and match `allowedCheckoutOrigins` exactly (including port). The same rules apply to preloading. Only configure origins you trust to host payment checkout; never build this allowlist from customer input.

When `externalRef` is supplied, success messages must include a matching string in `data.externalref`, `data.externalRef`, or `data.reference` (or the same field at the top level when no `data` wrapper is used). Missing or mismatched references are ignored. Supply `externalRef` when using an existing `paymentUrl` too. Without it, messages are bound to the active iframe and origin only. Hosted checkout integrations must emit the reference to use this stricter contract.

This package is intended for browser applications bundled with a tool such as Vite, Webpack, or Rollup. The minified browser asset is included at `public/v1/moolre.js`; copy it to your own static assets if you need to load it with a script tag.

The Moolre API must allow browser preflight requests to `POST /embed/link`, including these request headers:

```http
Access-Control-Allow-Headers: Content-Type, X-API-USER, X-Api-Pubkey
```

`username` and `publicKey` are client-side identifiers. Never include a Moolre private key in browser code.

## License

MIT. See [LICENSE](LICENSE).
