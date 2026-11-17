import test from 'node:test';
import assert from 'node:assert/strict';
import { createServer, OTP_CODE } from '../server.mjs';

async function boot(opts = {}) {
  const { server } = createServer({ otpDelayMs: 300, ...opts });
  await new Promise((r) => server.listen(0, r));
  const base = `http://localhost:${server.address().port}`;
  const call = async (method, path, body, token) => {
    const res = await fetch(base + path, {
      method,
      headers: { 'content-type': 'application/json', ...(token ? { authorization: `Bearer ${token}` } : {}) },
      body: body ? JSON.stringify(body) : undefined,
    });
    return { status: res.status, body: await res.json() };
  };
  const login = async () => {
    await call('POST', '/otp/request', { email: 'a@example.test' });
    const r = await call('POST', '/otp/verify', { email: 'a@example.test', code: OTP_CODE });
    return r.body.token;
  };
  return { server, call, login };
}

test('happy path: top-up and buy', async () => {
  const { server, call, login } = await boot();
  const t = await login();
  assert.equal((await call('POST', '/wallet/topup', { amount: 500 }, t)).body.balance, 500);
  const buy = await call('POST', '/orders', { propertyId: 'prop-harbour-01', tokens: 10 }, t);
  assert.equal(buy.body.balance, 250);
  assert.equal((await call('GET', '/portfolio', null, t)).body.totalValue, 250);
  server.close();
});

test('otp-delay: verify is refused until the delay has passed', async () => {
  const { server, call } = await boot();
  await call('POST', '/admin/mode', { mode: 'otp-delay' });
  await call('POST', '/otp/request', { email: 'a@example.test' });
  assert.equal((await call('POST', '/otp/verify', { email: 'a@example.test', code: OTP_CODE })).status, 425);
  await new Promise((r) => setTimeout(r, 350));
  assert.equal((await call('POST', '/otp/verify', { email: 'a@example.test', code: OTP_CODE })).status, 200);
  server.close();
});

test('payment-declined: top-up returns 402 and balance is unchanged', async () => {
  const { server, call, login } = await boot();
  const t = await login();
  await call('POST', '/admin/mode', { mode: 'payment-declined' });
  assert.equal((await call('POST', '/wallet/topup', { amount: 100 }, t)).status, 402);
  assert.equal((await call('GET', '/wallet', null, t)).body.balance, 0);
  server.close();
});

test('SEEDED BUG #1: duplicate webhook double-credits the wallet', async () => {
  const { server, call, login } = await boot();
  const t = await login();
  await call('POST', '/admin/mode', { mode: 'duplicate-webhook' });
  assert.equal((await call('POST', '/wallet/topup', { amount: 100 }, t)).body.balance, 200); // bug
  server.close();
});

test('with FIX_SEEDED_BUGS the duplicate webhook is ignored', async () => {
  const { server, call, login } = await boot({ fixSeededBugs: true });
  const t = await login();
  await call('POST', '/admin/mode', { mode: 'duplicate-webhook' });
  assert.equal((await call('POST', '/wallet/topup', { amount: 100 }, t)).body.balance, 100);
  server.close();
});

test('insufficient balance is refused', async () => {
  const { server, call, login } = await boot();
  const t = await login();
  assert.equal((await call('POST', '/orders', { propertyId: 'prop-harbour-01', tokens: 5 }, t)).status, 409);
  server.close();
});
