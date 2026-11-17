// Thin client for the local mock backend. All data is fake.
const BASE = process.env.EXPO_PUBLIC_API_URL ?? 'http://localhost:4010';

export type Property = { id: string; name: string; city: string; pricePerToken: number; totalTokens: number };
export type Holding = { propertyId: string; name: string; tokens: number; value: number };
export type Portfolio = { holdings: Holding[]; totalValue: number };

let token = '';
export const setToken = (t: string) => { token = t; };

async function call<T>(method: string, path: string, body?: unknown): Promise<{ status: number; data: T }> {
  const res = await fetch(BASE + path, {
    method,
    headers: { 'content-type': 'application/json', ...(token ? { authorization: `Bearer ${token}` } : {}) },
    body: body ? JSON.stringify(body) : undefined,
  });
  return { status: res.status, data: (await res.json()) as T };
}

export const api = {
  requestOtp: (email: string) => call('POST', '/otp/request', { email }),
  otpDelivered: (email: string) => call<{ delivered: boolean }>('GET', `/otp/status?email=${encodeURIComponent(email)}`),
  verifyOtp: (email: string, code: string) => call<{ token?: string }>('POST', '/otp/verify', { email, code }),
  wallet: () => call<{ balance: number }>('GET', '/wallet'),
  topUp: (amount: number) => call<{ balance?: number; error?: string }>('POST', '/wallet/topup', { amount }),
  properties: () => call<Property[]>('GET', '/properties'),
  buy: (propertyId: string, tokens: number) =>
    call<{ balance?: number; error?: string }>('POST', '/orders', { propertyId, tokens }),
  portfolio: () => call<Portfolio>('GET', '/portfolio'),
};
