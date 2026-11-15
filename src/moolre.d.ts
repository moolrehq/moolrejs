export interface MoolreError extends Error {
  /** Moolre application code, e.g. TP13, or TIMEOUT / NETWORK for transport failures. */
  code?: string;
  /** Request fields the API complained about. */
  fields?: string[];
  /** Quote this when contacting Moolre support. */
  requestId?: string | null;
  httpStatus?: number;
}

export interface MoolreDefaults {
  username?: string;
  /** Public key only. Never put a private key in browser code. */
  publicKey?: string;
  accountNumber?: string;
  /** 'sandbox' points the link request at https://sandbox.moolre.com/embed. Default 'live'. */
  environment?: 'live' | 'sandbox';
  apiBase?: string;
  checkoutBase?: string;
  iframeHeight?: string;
  /** Abort the link request after this many ms. Default 30000. */
  timeoutMs?: number;
  /** Exact https origins the checkout iframe may load and post events from. Default ['https://pos.moolre.com']. */
  allowedCheckoutOrigins?: string[];
}

export interface CheckoutOptions extends MoolreDefaults {
  amount?: number | string;
  email?: string;
  externalRef?: string;
  currency?: 'GHS' | 'NGN' | string;
  description?: string;
  metadata?: Record<string, unknown>;
  callbackUrl?: string;
  redirectUrl?: string;
  mode?: string;
  reusable?: boolean;
  /** Optional extra restriction on event origins (narrows allowedCheckoutOrigins; never widens it). */
  allowedOrigins?: string[];
  /** Existing payment URL (https, an allowedCheckoutOrigins origin). No API credentials are needed. */
  paymentUrl?: string;
  onLoad?(info: { message: string; url: string }): void;
  /** A browser event, not proof of payment: always verify on your server before fulfilling. */
  onSuccess?(transaction: unknown): void;
  onError?(error: MoolreError | unknown): void;
  onCancel?(): void;
  onClose?(): void;
}

export default class MoolrePay {
  constructor(defaults?: MoolreDefaults);
  defaults: MoolreDefaults;
  setup(opts?: MoolreDefaults): MoolreDefaults;
  checkout(options?: CheckoutOptions): Promise<void>;
  preloadTransaction(options?: CheckoutOptions): Promise<() => void>;
  /** Remove the modal, listeners and any preloaded iframe. */
  destroy(): void;
}
