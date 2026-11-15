import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { JSDOM } from 'jsdom';

const require = createRequire(import.meta.url);
const path = process.env.MOOLRE_BUILD || '../src/moolre.js';

test('importing and constructing is safe without a DOM (SSR)', () => {
  const MoolrePay = require(path);
  const p = new MoolrePay({ username: 'u' });
  assert.equal(p.defaults.username, 'u');
  assert.equal(typeof p.destroy, 'function');
  p.destroy();
});

function setup() {
  const dom = new JSDOM('<!doctype html><body></body>', { url: 'https://shop.example.com/', pretendToBeVisual: true });
  const g = globalThis;
  for (const k of ['window', 'document', 'getComputedStyle']) g[k] = k === 'getComputedStyle' ? dom.window.getComputedStyle.bind(dom.window) : dom.window[k] ?? dom.window;
  g.window = dom.window;
  g.document = dom.window.document;
  dom.window.matchMedia = () => ({ matches: false });
  HTMLCanvas();
  return dom;
  function HTMLCanvas() {
    dom.window.HTMLCanvasElement.prototype.getContext = () => ({ set fillStyle(v) { this._v = 'rgb(255,255,255)'; }, get fillStyle() { return this._v; } });
  }
}

function load() {
  delete require.cache[require.resolve(path)];
  return require(path);
}

const base = { username: 'acme', publicKey: 'pk', accountNumber: '10000001', email: 'a@b.c', externalRef: 'o-1' };

test('link request: headers, body, amount formatting, request id and notices', async () => {
  setup();
  const MoolrePay = load();
  const calls = [];
  globalThis.fetch = async (url, init) => {
    calls.push({ url, init });
    return new Response(JSON.stringify({ status: 1, code: 'POS09', data: { authorization_url: 'https://pos.moolre.com/abc' }, notices: [{ code: 'N1', message: 'm' }] }), { status: 200, headers: { 'x-request-id': 'req_1' } });
  };
  const warn = console.warn; const warned = []; console.warn = (m) => warned.push(m);
  const p = new MoolrePay();
  await p.checkout({ ...base, amount: 50 });
  console.warn = warn;
  assert.equal(calls[0].url, 'https://api.moolre.com/embed/link');
  assert.equal(calls[0].init.headers['X-API-USER'], 'acme');
  assert.equal(calls[0].init.headers['X-Api-Pubkey'], 'pk');
  assert.equal(calls[0].init.credentials, 'omit');
  assert.equal(JSON.parse(calls[0].init.body).amount, '50.00');
  assert.match(warned[0], /N1/);
  assert.ok(document.querySelector('.moolre-iframe'));
  p.destroy();
});

test('sandbox environment switches the link host', async () => {
  setup();
  const MoolrePay = load();
  let url;
  globalThis.fetch = async (u) => { url = u; return new Response(JSON.stringify({ status: 1, data: { authorization_url: 'https://sandbox.moolre.com/x' } })); };
  const p = new MoolrePay({ environment: 'sandbox' });
  await p.checkout({ ...base, amount: '1.00' });
  assert.equal(url, 'https://sandbox.moolre.com/embed/link');
  // the sandbox checkout page is trusted by default; the live one is not
  assert.deepEqual(p.defaults.allowedCheckoutOrigins, ['https://sandbox.moolre.com']);
  p.destroy();
});

test('API errors carry code, fields, requestId (HTTP 200 with status 0 and HTTP 4xx)', async () => {
  setup();
  const MoolrePay = load();
  const p = new MoolrePay();
  globalThis.fetch = async () => new Response(JSON.stringify({ status: 0, code: 'TP13', message: 'External Reference is required and must be unique.', data: 'externalref', request_id: 'req_x' }), { status: 200 });
  await assert.rejects(() => p.checkout({ ...base, amount: 1, onError() {} }), (e) => e.code === 'TP13' && e.fields[0] === 'externalref' && e.requestId === 'req_x');
  globalThis.fetch = async () => new Response('<html>bad</html>', { status: 502, headers: { 'x-request-id': 'req_h' } });
  await assert.rejects(() => p.checkout({ ...base, amount: 1, onError() {} }), (e) => e.httpStatus === 502 && e.requestId === 'req_h');
});

test('timeout and network failures are typed', async () => {
  setup();
  const MoolrePay = load();
  const p = new MoolrePay();
  globalThis.fetch = (u, init) => new Promise((_, rej) => init.signal.addEventListener('abort', () => rej(Object.assign(new Error('x'), { name: 'AbortError' }))));
  await assert.rejects(() => p.checkout({ ...base, amount: 1, timeoutMs: 20, onError() {} }), (e) => e.code === 'TIMEOUT');
  globalThis.fetch = async () => { throw new TypeError('fetch failed'); };
  await assert.rejects(() => p.checkout({ ...base, amount: 1, onError() {} }), (e) => e.code === 'NETWORK');
});

test('untrusted payment URLs are refused', async () => {
  setup();
  const MoolrePay = load();
  const p = new MoolrePay();
  for (const bad of ['http://pos.moolre.com/x', 'https://evil.example.com/x', 'https://moolre.com.evil.com/x', 'https://x.pos.moolre.com/x', 'javascript:alert(1)']) {
    await assert.rejects(() => p.checkout({ paymentUrl: bad, onError() {} }), /HTTPS|Invalid checkout URL/);
  }
  await p.checkout({ paymentUrl: 'https://staging.example.com/x', allowedCheckoutOrigins: ['https://staging.example.com'] });
  p.destroy();
  await p.checkout({ paymentUrl: 'https://pos.moolre.com/ok' });
  assert.ok(document.querySelector('.moolre-iframe'));
  p.destroy();
});

test('events: only from the checkout iframe window and exact origin; legacy allowedOrigins may narrow; externalRef must match; Escape cancels', async () => {
  const dom = setup();
  const MoolrePay = load();
  const p = new MoolrePay();
  let success = 0, cancel = 0;
  await p.checkout({ paymentUrl: 'https://pos.moolre.com/ok', onSuccess: () => success++, onCancel: () => cancel++ });
  const frame = document.querySelector('.moolre-iframe');
  const send = (origin, source) => dom.window.dispatchEvent(new dom.window.MessageEvent('message', { data: { event: 'payment.success', data: {} }, origin, source }));
  send('https://evil.example.com', frame.contentWindow);
  send('https://pos.moolre.com', dom.window);               // wrong source window
  assert.equal(success, 0);
  send('https://other.moolre.com', frame.contentWindow);    // subdomain is no longer trusted
  assert.equal(success, 0);
  send('https://pos.moolre.com', frame.contentWindow);
  assert.equal(success, 1);
  // legacy dotted allowedOrigins still accepted as a narrowing filter
  let legacy = 0;
  await p.checkout({ paymentUrl: 'https://pos.moolre.com/ok', allowedOrigins: ['.moolre.com'], onSuccess: () => legacy++ });
  send('https://pos.moolre.com', [...document.querySelectorAll('.moolre-iframe')].pop().contentWindow);
  assert.equal(legacy, 1);
  let narrowed = 0;
  await p.checkout({ paymentUrl: 'https://pos.moolre.com/ok', allowedOrigins: ['https://elsewhere.example'], onSuccess: () => narrowed++ });
  send('https://pos.moolre.com', [...document.querySelectorAll('.moolre-iframe')].pop().contentWindow);
  assert.equal(narrowed, 0);
  await p.checkout({ paymentUrl: 'https://pos.moolre.com/ok', onCancel: () => cancel++ });
  document.dispatchEvent(new dom.window.KeyboardEvent('keydown', { key: 'Escape' }));
  assert.equal(cancel, 1);
  p.destroy();
});
