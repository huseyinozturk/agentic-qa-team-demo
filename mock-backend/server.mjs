// Mock backend for the TokenEstate demo. In-memory, fake data only.
//
// Failure modes (switch with POST /admin/mode {"mode": "..."}):
//   none               normal behaviour
//   otp-delay          the OTP "e-mail" arrives after OTP_DELAY_MS (default 15000)
//   payment-declined   every wallet top-up is declined (HTTP 402)
//   duplicate-webhook  the payment provider delivers the same webhook twice
//
// SEEDED BUG #1 (see docs/seeded-bugs.md): the webhook handler does not de-duplicate
// events, so a duplicate webhook credits the wallet twice. Set FIX_SEEDED_BUGS=1 to
// get the corrected behaviour.
import http from 'node:http';

export const MODES = ['none', 'otp-delay', 'payment-declined', 'duplicate-webhook'];
export const OTP_CODE = '123456'; // fixed on purpose: this is a mock

const PROPERTIES = [
  { id: 'prop-harbour-01', name: 'Harbour View Apartments', city: 'Demo City', pricePerToken: 25, totalTokens: 10000 },
  { id: 'prop-oakline-02', name: 'Oakline Office Block', city: 'Sample Town', pricePerToken: 12.5, totalTokens: 40000 },
];

export function createServer(opts = {}) {
  const otpDelayMs = opts.otpDelayMs ?? Number(process.env.OTP_DELAY_MS ?? 15000);
  const fixBugs = opts.fixSeededBugs ?? process.env.FIX_SEEDED_BUGS === '1';
  const log = opts.log ?? (() => {});

  const state = { mode: 'none', users: new Map(), otps: new Map(), sessions: new Map(), seenEvents: new Set(), eventSeq: 0 };

  const user = (email) => {
    if (!state.users.has(email)) state.users.set(email, { email, balance: 0, holdings: {} });
    return state.users.get(email);
  };

  function handleWebhook(evt) {
    // SEEDED BUG #1: de-duplication is missing unless FIX_SEEDED_BUGS=1.
    if (fixBugs && state.seenEvents.has(evt.id)) return;
    state.seenEvents.add(evt.id);
    user(evt.email).balance += evt.amount;
    log(`webhook ${evt.id} credited ${evt.amount} to ${evt.email}`);
  }

  const send = (res, code, body) => {
    res.writeHead(code, { 'content-type': 'application/json' });
    res.end(JSON.stringify(body));
  };
  const readBody = (req) =>
    new Promise((resolve) => {
      let raw = '';
      req.on('data', (c) => (raw += c));
      req.on('end', () => {
        try { resolve(raw ? JSON.parse(raw) : {}); } catch { resolve({}); }
      });
    });
  const authed = (req) => {
    const t = (req.headers.authorization ?? '').replace('Bearer ', '');
    const email = state.sessions.get(t);
    return email ? user(email) : null;
  };

  const server = http.createServer(async (req, res) => {
    const url = new URL(req.url, 'http://localhost');
    const route = `${req.method} ${url.pathname}`;
    const body = req.method === 'POST' ? await readBody(req) : {};
    log(`${route} mode=${state.mode}`);

    if (route === 'GET /health') return send(res, 200, { ok: true, mode: state.mode });
    if (route === 'POST /admin/mode') {
      if (!MODES.includes(body.mode)) return send(res, 400, { error: 'unknown_mode', modes: MODES });
      state.mode = body.mode;
      return send(res, 200, { mode: state.mode });
    }
    if (route === 'POST /admin/reset') {
      state.users.clear(); state.otps.clear(); state.sessions.clear(); state.seenEvents.clear();
      state.mode = 'none';
      return send(res, 200, { reset: true });
    }

    if (route === 'POST /otp/request') {
      if (!body.email) return send(res, 400, { error: 'email_required' });
      const delay = state.mode === 'otp-delay' ? otpDelayMs : 0;
      state.otps.set(body.email, { readyAt: Date.now() + delay });
      return send(res, 200, { sent: true });
    }
    if (route === 'GET /otp/status') {
      const o = state.otps.get(url.searchParams.get('email'));
      return send(res, 200, { delivered: !!o && Date.now() >= o.readyAt });
    }
    if (route === 'POST /otp/verify') {
      const o = state.otps.get(body.email);
      if (!o || Date.now() < o.readyAt) return send(res, 425, { error: 'otp_not_delivered' });
      if (body.code !== OTP_CODE) return send(res, 401, { error: 'invalid_code' });
      const token = `mock-session-${state.sessions.size + 1}`;
      state.sessions.set(token, body.email);
      return send(res, 200, { token });
    }

    if (route === 'GET /properties') return send(res, 200, PROPERTIES);
    const m = url.pathname.match(/^\/properties\/([\w-]+)$/);
    if (req.method === 'GET' && m) {
      const p = PROPERTIES.find((x) => x.id === m[1]);
      return p ? send(res, 200, p) : send(res, 404, { error: 'not_found' });
    }

    const u = authed(req);
    if (!u) return send(res, 401, { error: 'unauthorized' });

    if (route === 'GET /wallet') return send(res, 200, { balance: u.balance });
    if (route === 'POST /wallet/topup') {
      const amount = Number(body.amount);
      if (!(amount > 0)) return send(res, 400, { error: 'invalid_amount' });
      if (state.mode === 'payment-declined') return send(res, 402, { error: 'payment_declined' });
      const evt = { id: `evt_${++state.eventSeq}`, email: u.email, amount };
      handleWebhook(evt);
      if (state.mode === 'duplicate-webhook') handleWebhook(evt); // provider retries
      return send(res, 200, { balance: u.balance });
    }
    if (route === 'POST /orders') {
      const p = PROPERTIES.find((x) => x.id === body.propertyId);
      const tokens = Math.floor(Number(body.tokens));
      if (!p || !(tokens > 0)) return send(res, 400, { error: 'invalid_order' });
      const cost = tokens * p.pricePerToken;
      if (cost > u.balance) return send(res, 409, { error: 'insufficient_balance', balance: u.balance, cost });
      u.balance -= cost;
      u.holdings[p.id] = (u.holdings[p.id] ?? 0) + tokens;
      return send(res, 200, { balance: u.balance, tokens: u.holdings[p.id] });
    }
    if (route === 'GET /portfolio') {
      const holdings = Object.entries(u.holdings).map(([id, tokens]) => {
        const p = PROPERTIES.find((x) => x.id === id);
        return { propertyId: id, name: p.name, tokens, value: tokens * p.pricePerToken };
      });
      return send(res, 200, { holdings, totalValue: holdings.reduce((s, h) => s + h.value, 0) });
    }
    return send(res, 404, { error: 'not_found' });
  });
  return { server, state };
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const port = Number(process.env.PORT ?? 4010);
  const { server } = createServer({ log: (m) => process.env.QUIET ? null : console.log(`[mock-backend] ${m}`) });
  server.listen(port, () => console.log(`[mock-backend] listening on http://localhost:${port}`));
}
