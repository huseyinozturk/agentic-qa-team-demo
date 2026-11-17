import test from 'node:test';
import assert from 'node:assert/strict';
import { classify } from '../src/classify.ts';

test('classification rules', () => {
  assert.equal(classify('Maestro driver did not start within 120s'), 'driver');
  assert.equal(classify('Element not found: Id matching regex: buy-confirm-button'), 'selector');
  assert.equal(classify('Assertion is false: otp-delivered-banner is visible', { backendOtpDelayMs: 30000 }), 'env');
  assert.equal(classify('Assertion is false: wallet-balance-text "USD 100.00" is visible (found "USD 200.00")'), 'app');
  assert.equal(classify('backend unreachable (ECONNREFUSED)'), 'env');
  assert.equal(classify('Unknown command: tapon'), 'test');
});
