// Suggests a failure class from an error message. A human confirms it (see docs/design.md).
import type { FailureClass } from './lib.ts';

export type Hints = { backendOtpDelayMs?: number };

export function classify(error: string, hints: Hints = {}): FailureClass {
  if (/driver|did not start|device (is )?(offline|not found)|UiAutomator|XCTest|simulator (is )?not booted/i.test(error)) return 'driver';
  if (/ECONNREFUSED|ETIMEDOUT|backend unreachable|network request failed/i.test(error)) return 'env';
  if (hints.backendOtpDelayMs && /otp/i.test(error)) return 'env';
  if (/Unknown command|Invalid flow|YAML|syntax error|variable .* (is )?not defined/i.test(error)) return 'test';
  if (/Element not found|No (visible )?elements? (found )?matching|Id matching regex/i.test(error)) return 'selector';
  if (/Assertion|expected|but found|is false/i.test(error)) return 'app';
  return 'test';
}
