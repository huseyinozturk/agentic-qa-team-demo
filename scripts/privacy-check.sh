#!/usr/bin/env bash
# Fails if the repo contains anything that looks like private or company-specific information.
#  - blocked terms are stored base64-encoded so this public file does not spell them out
#  - add your own terms (one regex per line) to .privacy-terms.local (git-ignored)
set -u
cd "$(dirname "$0")/.."

# base64 of: company name, product name, vendor-key prefix, two personal handles, a first name
ENCODED_TERMS=(cHJ5cGNv c3VwZXJhcHA= YmF1bWludA== aHVzZXlpbg== b3p0dXJr ZnJhbmNlc2Nv)
# plain patterns: tracker keys of real projects, decision/ADR numbers, a word that collides with a product name
PLAIN_TERMS=('\bONB-[0-9]' '\bINV-[0-9]' '\bMINT-[0-9]' '\bBAU[A-Z]*-[0-9]' '\bADR-?[0-9]+\b' '\bD[0-9]{2}\b' '\bmint\b' '/Users/[A-Za-z0-9._-]+' 'internal\.' '\.atlassian\.net' 'figma\.com/(file|design)' 'hooks\.slack\.com')
SECRET_TERMS=('sk-ant-[A-Za-z0-9]{8,}' 'xox[abprs]-[0-9A-Za-z-]{8,}' 'AKIA[0-9A-Z]{12,}' 'ghp_[A-Za-z0-9]{20,}' '-----BEGIN [A-Z ]*PRIVATE KEY-----')

fail=0
files() { git ls-files -co --exclude-standard 2>/dev/null | grep -v -e '^node_modules/' -e '^\.git/' -e 'package-lock\.json$'; }
report() { echo "privacy-check: $1"; fail=1; }

# 1. blocked terms (case-insensitive) in file names and contents
for enc in "${ENCODED_TERMS[@]}"; do
  term=$(printf %s "$enc" | base64 -d)
  if files | grep -i -- "$term" >/dev/null; then report "a file name matches a blocked term"; fi
  if files | xargs grep -I -n -i -E -- "$term" 2>/dev/null | grep -v '^scripts/privacy-check.sh:' | head -3 | grep .; then report "a blocked term appears in file contents"; fi
done
for re in "${PLAIN_TERMS[@]}"; do
  hits=$(files | xargs grep -I -n -E -- "$re" 2>/dev/null | grep -v '^scripts/privacy-check.sh:' | head -3)
  [ -n "$hits" ] && { echo "$hits"; report "pattern $re"; }
done
if [ -f .privacy-terms.local ]; then
  while IFS= read -r re; do
    [ -z "$re" ] && continue
    hits=$(files | xargs grep -I -n -i -E -- "$re" 2>/dev/null | head -3)
    [ -n "$hits" ] && { echo "$hits"; report "local term (hidden)"; }
  done < .privacy-terms.local
fi

# 2. secrets (the one fake JWT in fixtures/tracker.json is planted on purpose and allowed)
for re in "${SECRET_TERMS[@]}"; do
  hits=$(files | xargs grep -I -n -E -- "$re" 2>/dev/null | grep -v '^scripts/privacy-check.sh:' | head -3)
  [ -n "$hits" ] && { echo "$hits"; report "secret-like value: $re"; }
done

# 3. URLs and e-mail addresses: only placeholder or well-known documentation hosts
url_hits=$(files | xargs grep -I -n -o -E "https?://[A-Za-z0-9._~:/?#@!$&*+,;=%-]+" 2>/dev/null \
  | grep -v '^scripts/privacy-check.sh:' \
  | grep -v -E '://(localhost|127\.0\.0\.1|[a-z.-]*example\.(test|com)|docs\.expo\.dev|expo\.dev|docs\.maestro\.dev|maestro\.mobile\.dev|docs\.claude\.com|code\.claude\.com|claude\.com|www\.anthropic\.com|nodejs\.org|github\.com|mermaid\.js\.org|www\.w3\.org)' | head -5)
[ -n "$url_hits" ] && { echo "$url_hits"; report "URL outside the allowlist"; }
mail_hits=$(files | xargs grep -I -n -o -E "[A-Za-z0-9._%+-]+@[A-Za-z0-9-]+\.[A-Za-z.]+" 2>/dev/null | grep -v -E '@(example\.(test|com)|users\.noreply\.github\.com)' | grep -v -e '^scripts/privacy-check.sh:' -e 'noreply@anthropic.com' | head -5)
[ -n "$mail_hits" ] && { echo "$mail_hits"; report "e-mail address outside example.test"; }

# 4. no screenshots or real run data
shots=$(files | grep -i -E '\.(png|jpe?g|gif|webp|heic)$' | head -3)
[ -n "$shots" ] && { echo "$shots"; report "image files are not allowed (no screenshots)"; }

if [ "$fail" -eq 0 ]; then echo "privacy-check: OK ($(files | wc -l | tr -d ' ') files scanned)"; else echo "privacy-check: FAILED"; fi
exit "$fail"
