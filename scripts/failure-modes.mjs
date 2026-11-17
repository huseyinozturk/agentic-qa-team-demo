// Shows the mock backend's switchable failure modes, including the seeded duplicate-webhook bug.
// Starts the backend in-process on a random port; nothing to install, no device.
import { createServer, OTP_CODE } from '../mock-backend/server.mjs';

const { server } = createServer({ otpDelayMs: 1500 });
await new Promise((r) => server.listen(0, r));
const base = `http://localhost:${server.address().port}`;
const call = async (method, path, body, token) => {
  const res = await fetch(base + path, { method, headers: { 'content-type': 'application/json', ...(token ? { authorization: `Bearer ${token}` } : {}) }, body: body ? JSON.stringify(body) : undefined });
  return { status: res.status, body: await res.json() };
};
const mode = (m) => call('POST', '/admin/mode', { mode: m });
const login = async () => { await call('POST', '/otp/request', { email: 'demo@example.test' }); return (await call('POST', '/otp/verify', { email: 'demo@example.test', code: OTP_CODE })).body.token; };

console.log('1. normal: top up 100 ->', JSON.stringify((await call('POST', '/wallet/topup', { amount: 100 }, await login())).body));
await call('POST', '/admin/reset');

await mode('otp-delay');
await call('POST', '/otp/request', { email: 'demo@example.test' });
const early = await call('POST', '/otp/verify', { email: 'demo@example.test', code: OTP_CODE });
console.log(`2. otp-delay: verify right away -> HTTP ${early.status} ${early.body.error}`);
await new Promise((r) => setTimeout(r, 1600));
console.log(`   ...after the delay -> HTTP ${(await call('POST', '/otp/verify', { email: 'demo@example.test', code: OTP_CODE })).status}`);
await call('POST', '/admin/reset');

const t1 = await login();
await mode('payment-declined');
const declined = await call('POST', '/wallet/topup', { amount: 100 }, t1);
console.log(`3. payment-declined: top up 100 -> HTTP ${declined.status} ${declined.body.error}; balance stays ${(await call('GET', '/wallet', null, t1)).body.balance}`);
await call('POST', '/admin/reset');

const t2 = await login();
await mode('duplicate-webhook');
const dup = await call('POST', '/wallet/topup', { amount: 100 }, t2);
console.log(`4. duplicate-webhook: top up 100 -> balance ${dup.body.balance}  <-- SEEDED BUG 1: expected 100 (event de-duplication missing)`);
server.close();
