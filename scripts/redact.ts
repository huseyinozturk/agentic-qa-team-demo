// Redaction of secret-like values. Used by fetch.ts so no agent ever sees a raw secret.
export const PATTERNS: { name: string; re: RegExp }[] = [
  { name: 'jwt', re: /\beyJ[A-Za-z0-9_-]{5,}\.[A-Za-z0-9_-]{5,}\.[A-Za-z0-9_-]*/g },
  { name: 'auth-header', re: /(Authorization:\s*(?:Bearer|Basic)\s+)[^\s'"]+/gi },
  { name: 'key-value', re: /\b((?:api[_-]?key|token|secret|password|passwd)\s*[=:]\s*)[^\s'",;]+/gi },
  { name: 'vendor-prefix', re: /\b(?:sk|pk|xox[abpr]|ghp|AKIA)[-_A-Za-z0-9]{12,}/g },
];

export function redact(text: string): { text: string; hits: Record<string, number> } {
  const hits: Record<string, number> = {};
  let out = text;
  for (const { name, re } of PATTERNS) {
    out = out.replace(re, (...m) => {
      hits[name] = (hits[name] ?? 0) + 1;
      const prefix = typeof m[1] === 'string' && !/^\d+$/.test(m[1]) ? m[1] : '';
      return `${prefix}[REDACTED:${name}]`;
    });
  }
  return { text: out, hits };
}

// Heuristic hint for the Watcher: text that reads like an instruction aimed at an agent.
// It is only a hint. The agents treat ALL tracker and chat text as data either way.
export const INJECTION_HINTS = [
  /ignore (all |your )?(previous|prior)/i,
  /system note/i,
  /already approved/i,
  /\b(push (the )?(current )?branch|environment variables|api[_ ]?key)\b.*\b(reply|post|paste|comment|value)\b|\b(reply|post|paste)\b.*\b(api[_ ]?key|environment variables)\b/i,
];
export const looksLikeInstruction = (s: string) => INJECTION_HINTS.some((re) => re.test(s));
