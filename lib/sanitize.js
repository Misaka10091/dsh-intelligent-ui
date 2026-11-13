/**
 * dsh-intelligent-ui — data desensitization (脱敏).
 *
 * Rules follow GitHub's approach:
 *  - Secret patterns mirror GitHub Secret Scanning's well-known token families
 *    (ghp_/gho_/ghu_/ghs_/ghr_, github_pat_, AKIA…, xox*, AIza…, sk-…,
 *    sk-ant-…, JWTs, opaque Bearer tokens, PEM private keys).
 *  - Matches are replaced with the literal mask `***`, the same token GitHub
 *    Actions uses when a registered secret appears in a log line.
 *
 * PII (email, CN mobile, CN resident id, bank card with Luhn check) is masked
 * too, because an "intelligent UI" may echo user data back into a card.
 *
 * This module is pure (no DOM, no Node APIs). `client.js` carries a byte-for-byte
 * mirror of `redactString`/`sanitizeDeep` for the browser bundle; keep them in
 * sync (tests/sanitize.test.mjs asserts the canonical behaviour).
 */

export const MASK = '***'

/** Text patterns applied in order (most specific first). */
const STRING_RULES = [
  // PEM private keys (multi-line) must go before generic "assigned" rules.
  {
    name: 'pem-private-key',
    re: /-----BEGIN (?:[A-Z0-9 ]+ )?PRIVATE KEY-----[\s\S]*?-----END (?:[A-Z0-9 ]+ )?PRIVATE KEY-----/g,
    replace: () => MASK,
  },
  // GitHub personal access / OAuth / app / refresh tokens.
  { name: 'github-pat', re: /\bgithub_pat_[0-9A-Za-z_]{20,}\b/g, replace: () => MASK },
  { name: 'github-token', re: /\bgh[pousr]_[0-9A-Za-z]{20,}\b/g, replace: () => MASK },
  // AWS access key ids.
  { name: 'aws-access-key-id', re: /\b(?:AKIA|ASIA|AGPA|AIDA|AROA|AIPA|ANPA|ANVA|ABIA|ACCA)[0-9A-Z]{16}\b/g, replace: () => MASK },
  // Slack.
  { name: 'slack-token', re: /\bxox[baprs]-[0-9A-Za-z-]{10,}\b/g, replace: () => MASK },
  // Google API key.
  { name: 'google-api-key', re: /\bAIza[0-9A-Za-z_-]{35}\b/g, replace: () => MASK },
  // Anthropic before OpenAI (sk-ant- starts with sk-).
  { name: 'anthropic-key', re: /\bsk-ant-[0-9A-Za-z_-]{20,}\b/g, replace: () => MASK },
  // OpenAI / compatible provider keys.
  { name: 'openai-key', re: /\bsk-(?:proj-)?[A-Za-z0-9_-]{20,}\b/g, replace: () => MASK },
  // JWT (header.payload.signature).
  { name: 'jwt', re: /\beyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{8,}\b/g, replace: () => MASK },
  // Opaque bearer tokens.
  { name: 'bearer', re: /\bBearer\s+[A-Za-z0-9._~+/-]{12,}=*/gi, replace: (m) => `Bearer ${MASK}` },
  // Credentials embedded in a URL (scheme://user:pass@host).
  {
    name: 'url-credentials',
    re: /\b([a-z][a-z0-9+.-]*:\/\/)[^\s/@:]+:[^\s/@]+@/gi,
    replace: (_m, scheme) => `${scheme}${MASK}@`,
  },
  // key = value / key: value for secret-sounding names.
  {
    name: 'assigned-secret',
    re: /\b(api[_-]?key|apikey|secret|client[_-]?secret|access[_-]?token|refresh[_-]?token|token|password|passwd|pwd|authorization)\b(\s*[:=]\s*)(["']?)([^\s"',;]{6,})/gi,
    replace: (_m, key, sep, quote) => `${key}${sep}${quote}${MASK}`,
  },
]

/** Sensitive PII patterns. */
const PII_RULES = [
  { name: 'email', re: /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}\b/g, replace: () => MASK },
  { name: 'cn-resident-id', re: /\b\d{17}[\dXx]\b/g, replace: () => MASK },
  { name: 'cn-mobile', re: /\b1[3-9]\d{9}\b/g, replace: () => MASK },
]

const RULES = [...STRING_RULES, ...PII_RULES]

/**
 * True when a run of digits is a plausible card number (Luhn valid, 13-19 digits).
 * Avoids masking arbitrary long numbers that merely look like cards.
 * @param {string} digits
 */
function passesLuhn(digits) {
  if (digits.length < 13 || digits.length > 19) return false
  let sum = 0
  let double = false
  for (let i = digits.length - 1; i >= 0; i -= 1) {
    let d = digits.charCodeAt(i) - 48
    if (d < 0 || d > 9) return false
    if (double) {
      d *= 2
      if (d > 9) d -= 9
    }
    sum += d
    double = !double
  }
  return sum % 10 === 0
}

/**
 * Mask bank-card-like sequences that pass Luhn, keeping the original separators.
 * @param {string} text
 */
function redactCards(text) {
  return text.replace(/\b(?:\d[ -]?){12,18}\d\b/g, (candidate) => {
    const digits = candidate.replace(/[^0-9]/g, '')
    return passesLuhn(digits) ? MASK : candidate
  })
}

/**
 * Redact one string.
 * @param {string} input
 * @returns {string}
 */
export function redactString(input) {
  if (typeof input !== 'string' || input.length === 0) return input
  let out = input
  for (const rule of RULES) {
    out = out.replace(rule.re, rule.replace)
  }
  out = redactCards(out)
  return out
}

/**
 * Deep-redact a JSON-like value. Strings are masked; arrays/objects are cloned.
 * Object keys are left intact (they are structure, not user data).
 * @template T
 * @param {T} value
 * @returns {T}
 */
export function sanitizeDeep(value) {
  if (typeof value === 'string') return /** @type {any} */ (redactString(value))
  if (Array.isArray(value)) return /** @type {any} */ (value.map((item) => sanitizeDeep(item)))
  if (value !== null && typeof value === 'object') {
    const out = {}
    for (const [k, v] of Object.entries(value)) out[k] = sanitizeDeep(v)
    return /** @type {any} */ (out)
  }
  return value
}

/**
 * Names of the rule set, for diagnostics / docs.
 * @returns {string[]}
 */
export function ruleNames() {
  return RULES.map((r) => r.name)
}
