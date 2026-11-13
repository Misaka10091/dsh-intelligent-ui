/**
 * dsh-intelligent-ui — Client half (Web).
 *
 * Placement (why this shape):
 *   A tool renderer registered in `tool.call.toolview` lives INSIDE the host's
 *   collapsible "process" group. After a turn completes that group is folded
 *   (`hidden="until-found"`, zero height), so a full card rendered there is not
 *   painted. Therefore:
 *     • The FULL answer card is rendered in `conversation.chat.turnTail`, a
 *       session-scoped list that sits OUTSIDE the process group. It reads the
 *       host's already-assembled tool-call blocks for that turn through a
 *       keyed hook backed by the Chat node store (`turnDataSource`), so there is
 *       no extra session fold, no DOM scan and no duplicate tool reducer.
 *     • `tool.call.toolview` keeps a COMPACT status/diagnostic row only.
 *   Both surfaces read the same recorded call identity; the tail is keyed by
 *   callId, so reload / fork / session switch rebuild it from the log without a
 *   model call.
 *
 * Local interactions (sliders, filters, form fields, calculator) update React
 * state only. An explicit submit composes a message and writes it through the
 * tail slot's own session-bound `inputActions.setDraft`, so it can only ever
 * touch the originating session's composer. If no writer is available the form
 * shows an explicit copy fallback — never an unconditional clipboard write.
 */

// Client artifacts may be evaluated again during a plugin reload. Keep all
// declarations local so one reload cannot collide with the previous script.
;(() => {
const STYLES = `
.dsh-iui-card{--dsh-iui-radius:14px;display:flex;flex-direction:column;gap:14px;padding:16px;border-radius:var(--dsh-iui-radius);
  background:var(--dsw-alias-bg-base,var(--dsw-specific-input-major,#fff));
  border:1px solid var(--dsw-alias-border-l1,rgba(127,127,127,.22));
  color:var(--dsw-alias-label-primary,inherit);box-sizing:border-box;max-width:100%}
.dsh-iui-head{display:flex;flex-direction:column;gap:4px}
.dsh-iui-title{font-size:20px;line-height:1.3;font-weight:650;letter-spacing:-.01em}
.dsh-iui-subtitle{font-size:13.5px;line-height:1.55;color:var(--dsw-alias-label-secondary,inherit)}
.dsh-iui-pills{display:flex;flex-wrap:wrap;gap:8px}
.dsh-iui-pill{display:inline-flex;align-items:center;gap:6px;height:26px;padding:0 11px;border-radius:999px;
  background:var(--dsw-alias-interactive-bg-hover,rgba(127,127,127,.1));font-size:12.5px;color:var(--dsw-alias-label-secondary,inherit)}
.dsh-iui-pill svg{width:14px;height:14px}
.dsh-iui-section-title{font-size:13px;font-weight:600;color:var(--dsw-alias-label-secondary,inherit);margin-bottom:8px}
.dsh-iui-p{font-size:14px;line-height:1.72;color:var(--dsw-alias-label-primary,inherit);margin:0}
.dsh-iui-p + .dsh-iui-p{margin-top:9px}
.dsh-iui-strong{font-weight:650}
.dsh-iui-link{color:var(--dsw-alias-state-business-primary,#4f6bff);text-decoration:none}
.dsh-iui-link:hover{text-decoration:underline}

.dsh-iui-map{position:relative;border-radius:12px;overflow:hidden;border:1px solid var(--dsw-alias-border-l1,rgba(127,127,127,.2));background:var(--dsw-alias-bg-module-platform,#eef1f6)}
.dsh-iui-map svg{display:block;width:100%;height:auto}
.dsh-iui-map-grid{stroke:var(--dsw-alias-border-l1,rgba(120,130,150,.28));stroke-width:1}
.dsh-iui-map-block{fill:var(--dsw-alias-bg-base,rgba(255,255,255,.55))}
.dsh-iui-map-route{fill:none;stroke:#4f6bff;stroke-width:3;stroke-linejoin:round;stroke-linecap:round;stroke-dasharray:0}
.dsh-iui-map-pin{stroke:#fff;stroke-width:2}
.dsh-iui-map-pin-text{fill:#fff;font-size:11px;font-weight:700;text-anchor:middle;dominant-baseline:central}
.dsh-iui-map-label{fill:var(--dsw-alias-label-secondary,#5a6472);font-size:10.5px;text-anchor:middle}
.dsh-iui-legend{display:flex;flex-wrap:wrap;gap:10px;padding:10px 2px 0;font-size:12px;color:var(--dsw-alias-label-secondary,inherit)}
.dsh-iui-legend i{display:inline-block;width:8px;height:8px;border-radius:50%;margin-right:5px;vertical-align:middle}

.dsh-iui-timeline{list-style:none;margin:0;padding:0}
.dsh-iui-tl{position:relative;padding:0 0 16px 26px}
.dsh-iui-tl:last-child{padding-bottom:0}
.dsh-iui-tl:before{content:'';position:absolute;left:6px;top:4px;bottom:-2px;width:2px;background:var(--dsw-alias-border-l2,rgba(127,127,127,.24))}
.dsh-iui-tl:last-child:before{display:none}
.dsh-iui-tl-dot{position:absolute;left:0;top:3px;width:14px;height:14px;border-radius:50%;border:3px solid var(--dsw-alias-state-business-primary,#4f6bff);background:var(--dsw-alias-bg-base,#fff);box-sizing:border-box}
.dsh-iui-tl-time{font-size:12px;font-weight:650;color:var(--dsw-alias-state-business-primary,#4f6bff);letter-spacing:.02em}
.dsh-iui-tl-title{font-size:14px;font-weight:600;margin-top:1px}
.dsh-iui-tl-desc{font-size:13px;line-height:1.6;color:var(--dsw-alias-label-secondary,inherit);margin-top:3px}
.dsh-iui-tag{display:inline-block;margin-top:6px;font-size:11px;padding:1px 8px;border-radius:999px;background:var(--dsw-alias-interactive-bg-hover,rgba(127,127,127,.12));color:var(--dsw-alias-label-tertiary,inherit)}

.dsh-iui-gallery{display:flex;gap:12px;overflow-x:auto;padding-bottom:4px;scroll-snap-type:x mandatory}
.dsh-iui-shot{flex:0 0 auto;width:200px;scroll-snap-align:start;border-radius:12px;overflow:hidden;border:1px solid var(--dsw-alias-border-l1,rgba(127,127,127,.2));background:var(--dsw-alias-bg-base,#fff)}
.dsh-iui-shot-img{position:relative;width:100%;height:126px;background:linear-gradient(135deg,#c7d2fe,#a7f3d0)}
.dsh-iui-shot-img img{width:100%;height:100%;object-fit:cover;display:block}
.dsh-iui-shot-fallback{position:absolute;inset:0;display:flex;align-items:center;justify-content:center;color:rgba(255,255,255,.9);font-size:12px}
.dsh-iui-shot-body{padding:9px 11px}
.dsh-iui-shot-title{font-size:13px;font-weight:600}
.dsh-iui-shot-cap{font-size:11.5px;color:var(--dsw-alias-label-tertiary,inherit);margin-top:2px;line-height:1.45}

.dsh-iui-table-wrap{overflow-x:auto;border:1px solid var(--dsw-alias-border-l1,rgba(127,127,127,.2));border-radius:10px}
.dsh-iui-table{width:100%;border-collapse:collapse;font-size:13px}
.dsh-iui-table th,.dsh-iui-table td{text-align:left;padding:9px 12px;border-bottom:1px solid var(--dsw-alias-border-l1,rgba(127,127,127,.16));white-space:nowrap}
.dsh-iui-table th{font-weight:600;color:var(--dsw-alias-label-secondary,inherit);background:var(--dsw-alias-interactive-bg-hover,rgba(127,127,127,.06))}
.dsh-iui-table tr:last-child td{border-bottom:0}

.dsh-iui-chart svg{display:block;width:100%;height:auto}
.dsh-iui-chart-axis{stroke:var(--dsw-alias-border-l2,rgba(127,127,127,.3));stroke-width:1}
.dsh-iui-chart-label{fill:var(--dsw-alias-label-tertiary,#7a8494);font-size:10px;text-anchor:middle}
.dsh-iui-chart-val{fill:var(--dsw-alias-label-secondary,#5a6472);font-size:10px;text-anchor:middle}
.dsh-iui-calc{display:flex;flex-direction:column;gap:10px;padding:14px;border-radius:12px;background:var(--dsw-alias-interactive-bg-hover,rgba(127,127,127,.06))}
.dsh-iui-calc-row{display:flex;align-items:baseline;justify-content:space-between;gap:12px}
.dsh-iui-calc-val{font-size:22px;font-weight:700;color:var(--dsw-alias-state-business-primary,#4f6bff);font-variant-numeric:tabular-nums}
.dsh-iui-calc-label{font-size:13px;color:var(--dsw-alias-label-secondary,inherit)}
.dsh-iui-range{width:100%;accent-color:var(--dsw-alias-state-business-primary,#4f6bff)}

.dsh-iui-form{display:flex;flex-direction:column;gap:16px;padding:16px;border-radius:12px;border:1px solid var(--dsw-alias-border-l1,rgba(127,127,127,.2));background:var(--dsw-alias-bg-module-platform,rgba(127,127,127,.03))}
.dsh-iui-form-head{display:flex;flex-direction:column;gap:3px}
.dsh-iui-form-title{font-size:15px;font-weight:650}
.dsh-iui-form-desc{font-size:12.5px;color:var(--dsw-alias-label-secondary,inherit);line-height:1.5}
.dsh-iui-field{display:flex;flex-direction:column;gap:8px}
.dsh-iui-field-label{font-size:13px;font-weight:600}
.dsh-iui-seg{display:inline-flex;gap:4px;padding:3px;border-radius:10px;background:var(--dsw-alias-interactive-bg-hover,rgba(127,127,127,.1));align-self:flex-start}
.dsh-iui-seg button{border:0;background:0 0;padding:6px 14px;border-radius:8px;font:inherit;font-size:12.5px;cursor:pointer;color:var(--dsw-alias-label-secondary,inherit)}
.dsh-iui-seg button[data-on="true"]{background:var(--dsw-alias-bg-base,#fff);color:var(--dsw-alias-label-primary,inherit);box-shadow:0 1px 2px rgba(0,0,0,.12);font-weight:600}
.dsh-iui-cards{display:grid;grid-template-columns:repeat(auto-fit,minmax(150px,1fr));gap:10px}
.dsh-iui-rc{text-align:left;border:1px solid var(--dsw-alias-border-l1,rgba(127,127,127,.28));background:var(--dsw-alias-bg-base,#fff);border-radius:10px;padding:11px 12px;cursor:pointer;font:inherit;color:inherit}
.dsh-iui-rc[data-on="true"]{border-color:var(--dsw-alias-state-business-primary,#4f6bff);box-shadow:0 0 0 1px var(--dsw-alias-state-business-primary,#4f6bff) inset}
.dsh-iui-rc-t{font-size:13px;font-weight:600}
.dsh-iui-rc-d{font-size:11.5px;color:var(--dsw-alias-label-tertiary,inherit);margin-top:3px;line-height:1.45}
.dsh-iui-input,.dsh-iui-select{width:100%;box-sizing:border-box;font:inherit;font-size:13px;padding:9px 11px;border-radius:9px;
  border:1px solid var(--dsw-alias-border-l2,rgba(127,127,127,.32));background:var(--dsw-alias-bg-base,#fff);color:inherit;outline:none}
.dsh-iui-input:focus,.dsh-iui-select:focus{border-color:var(--dsw-alias-state-business-primary,#4f6bff)}
.dsh-iui-checks{display:flex;flex-wrap:wrap;gap:8px 16px}
.dsh-iui-check{display:inline-flex;align-items:center;gap:7px;font-size:13px;cursor:pointer}
.dsh-iui-check input{width:15px;height:15px;accent-color:var(--dsw-alias-state-business-primary,#4f6bff)}
.dsh-iui-submit{align-self:flex-start;border:0;border-radius:10px;padding:10px 18px;font:inherit;font-size:13.5px;font-weight:600;cursor:pointer;
  background:var(--dsw-alias-state-business-primary,#111827);color:var(--dsw-alias-label-primary-foreground,#fff)}
.dsh-iui-submit:hover{filter:brightness(1.06)}
.dsh-iui-submit:disabled{opacity:.55;cursor:default}
.dsh-iui-feedback{font-size:12.5px;color:var(--dsw-alias-state-success-label,#1f9d55);line-height:1.5}
.dsh-iui-feedback[data-error="true"]{color:var(--dsw-alias-state-error-primary,#e5484d)}
.dsh-iui-preview{margin-top:8px;padding:10px 12px;border-radius:9px;background:var(--dsw-alias-interactive-bg-hover,rgba(127,127,127,.08));font-size:12px;line-height:1.55;white-space:pre-wrap;color:var(--dsw-alias-label-secondary,inherit)}
.dsh-iui-copy{margin-left:8px;border:0;background:0 0;color:var(--dsw-alias-state-business-primary,#4f6bff);cursor:pointer;font:inherit;font-size:12px;padding:0}
.dsh-iui-skeleton{height:64px;border-radius:12px;background:linear-gradient(90deg,var(--dsw-alias-interactive-bg-hover,rgba(127,127,127,.08)) 25%,rgba(127,127,127,.16) 37%,var(--dsw-alias-interactive-bg-hover,rgba(127,127,127,.08)) 63%);
  background-size:400% 100%;animation:dsh-iui-shimmer 1.4s ease infinite}
@keyframes dsh-iui-shimmer{0%{background-position:100% 50%}100%{background-position:0 50%}}
@media (prefers-reduced-motion:reduce){.dsh-iui-skeleton{animation:none}}
.dsh-iui-fallback{padding:10px 0;font-size:13px;color:var(--dsw-alias-label-tertiary,inherit);white-space:pre-wrap}

/* Compact tool row (inside the folded process group). */
.dsh-iui-row{display:flex;align-items:center;gap:6px;min-height:22px;font-size:12.5px;color:var(--dsw-alias-label-secondary,inherit);min-width:0}
.dsh-iui-row-dot{width:7px;height:7px;border-radius:50%;background:var(--dsw-alias-state-business-primary,#4f6bff);flex:0 0 auto}
.dsh-iui-row[data-state="error"]{color:var(--dsw-alias-state-error-primary,#e5484d)}
.dsh-iui-row[data-state="error"] .dsh-iui-row-dot{background:var(--dsw-alias-state-error-primary,#e5484d)}
.dsh-iui-row[data-state="preparing"] .dsh-iui-row-dot{background:var(--dsw-alias-label-tertiary,#8a93a3)}
.dsh-iui-row-title{font-weight:600;flex:0 0 auto}
.dsh-iui-row-sep{opacity:.5;flex:0 0 auto}
.dsh-iui-row-summary{min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}

/* Answer cards in the turn tail (outside the folded process group). */
.dsh-iui-tail{display:flex;flex-direction:column;gap:16px}
.dsh-iui-tail-item{display:flex;flex-direction:column;min-width:0}
`

// ---------------------------------------------------------------------------
// Sanitizer (mirror of lib/sanitize.js; kept identical for the browser bundle).
// ---------------------------------------------------------------------------
const MASK = '***'
const STRING_RULES = [
  { re: /-----BEGIN (?:[A-Z0-9 ]+ )?PRIVATE KEY-----[\s\S]*?-----END (?:[A-Z0-9 ]+ )?PRIVATE KEY-----/g, replace: () => MASK },
  { re: /\bgithub_pat_[0-9A-Za-z_]{20,}\b/g, replace: () => MASK },
  { re: /\bgh[pousr]_[0-9A-Za-z]{20,}\b/g, replace: () => MASK },
  { re: /\b(?:AKIA|ASIA|AGPA|AIDA|AROA|AIPA|ANPA|ANVA|ABIA|ACCA)[0-9A-Z]{16}\b/g, replace: () => MASK },
  { re: /\bxox[baprs]-[0-9A-Za-z-]{10,}\b/g, replace: () => MASK },
  { re: /\bAIza[0-9A-Za-z_-]{35}\b/g, replace: () => MASK },
  { re: /\bsk-ant-[0-9A-Za-z_-]{20,}\b/g, replace: () => MASK },
  { re: /\bsk-(?:proj-)?[A-Za-z0-9_-]{20,}\b/g, replace: () => MASK },
  { re: /\beyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{8,}\b/g, replace: () => MASK },
  { re: /\bBearer\s+[A-Za-z0-9._~+/-]{12,}=*/gi, replace: () => `Bearer ${MASK}` },
  { re: /\b([a-z][a-z0-9+.-]*:\/\/)[^\s/@:]+:[^\s/@]+@/gi, replace: (_m, s) => `${s}${MASK}@` },
  {
    re: /\b(api[_-]?key|apikey|secret|client[_-]?secret|access[_-]?token|refresh[_-]?token|token|password|passwd|pwd|authorization)\b(\s*[:=]\s*)(["']?)([^\s"',;]{6,})/gi,
    replace: (_m, k, sep, q) => `${k}${sep}${q}${MASK}`,
  },
]
const PII_RULES = [
  { re: /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}\b/g, replace: () => MASK },
  { re: /\b\d{17}[\dXx]\b/g, replace: () => MASK },
  { re: /\b1[3-9]\d{9}\b/g, replace: () => MASK },
]
function passesLuhn(digits) {
  if (digits.length < 13 || digits.length > 19) return false
  let sum = 0
  let dbl = false
  for (let i = digits.length - 1; i >= 0; i -= 1) {
    let d = digits.charCodeAt(i) - 48
    if (d < 0 || d > 9) return false
    if (dbl) { d *= 2; if (d > 9) d -= 9 }
    sum += d
    dbl = !dbl
  }
  return sum % 10 === 0
}
function redactString(input) {
  if (typeof input !== 'string' || input === '') return input
  let out = input
  for (const r of STRING_RULES) out = out.replace(r.re, r.replace)
  for (const r of PII_RULES) out = out.replace(r.re, r.replace)
  out = out.replace(/\b(?:\d[ -]?){12,18}\d\b/g, (c) => (passesLuhn(c.replace(/[^0-9]/g, '')) ? MASK : c))
  return out
}
function sanitizeDeep(value) {
  if (typeof value === 'string') return redactString(value)
  if (Array.isArray(value)) return value.map(sanitizeDeep)
  if (value !== null && typeof value === 'object') {
    const out = {}
    for (const k of Object.keys(value)) out[k] = sanitizeDeep(value[k])
    return out
  }
  return value
}

// ---------------------------------------------------------------------------
window.__ModuleLoader__.load({
  id: 'dsh-intelligent-ui',
  factory(require) {
    const React = require('react')
    const h = React.createElement
    const useState = React.useState

    const isZh = () => typeof navigator !== 'undefined' && /^zh/i.test(navigator.language || '')
    const L = (zh, en) => (isZh() ? zh : en)

    const TONES = {
      info: '#4f6bff', success: '#1f9d55', warning: '#d99000', danger: '#e5484d', muted: '#8a93a3',
    }
    const tone = (t) => TONES[t] || TONES.info

    // Inline icons used by pills (no emoji, vector only).
    const ICONS = {
      walk: h => h('path', { key: 'p', d: 'M13 5a1.5 1.5 0 1 0 0-3 1.5 1.5 0 0 0 0 3zM9 22l2-5 2 2v5m0-14-3 4-2 1m8 2 2 4' }),
      clock: h => h('circle', { key: 'c', cx: 12, cy: 12, r: 8.5 }),
      pin: h => h('path', { key: 'p', d: 'M12 21s7-6.2 7-11a7 7 0 1 0-14 0c0 4.8 7 11 7 11zM12 10.5a1.5 1.5 0 1 0 0-3 1.5 1.5 0 0 0 0 3z' }),
      ticket: h => h('path', { key: 'p', d: 'M4 9a2 2 0 0 0 2-2h12a2 2 0 0 0 2 2v2a2 2 0 0 0 0 4v2a2 2 0 0 0-2 2H6a2 2 0 0 0-2-2v-2a2 2 0 0 0 0-4V9z' }),
      info: h => h('path', { key: 'p', d: 'M12 8h.01M11 12h1v4h1' }),
      star: h => h('path', { key: 'p', d: 'M12 3l2.5 5.5L20 9.3l-4 4 1 5.7-5-2.7-5 2.7 1-5.7-4-4 5.5-.8z' }),
    }
    function PillIcon({ name }) {
      const draw = ICONS[name]
      if (!draw) return null
      return h('svg', {
        viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', strokeWidth: 1.7,
        strokeLinecap: 'round', strokeLinejoin: 'round', 'aria-hidden': true,
      }, draw(h))
    }

    // -----------------------------------------------------------------------
    // Tiny, eval-free arithmetic parser for the calculator block.
    // -----------------------------------------------------------------------
    function evalFormula(src, v) {
      const s = String(src)
      let i = 0
      const peek = () => s[i]
      const skip = () => { while (i < s.length && /\s/.test(s[i])) i += 1 }
      function expr() {
        let val = term()
        for (;;) {
          skip()
          const c = peek()
          if (c === '+' || c === '-') { i += 1; const r = term(); val = c === '+' ? val + r : val - r }
          else return val
        }
      }
      function term() {
        let val = factor()
        for (;;) {
          skip()
          const c = peek()
          if (c === '*' || c === '/') { i += 1; const r = factor(); val = c === '*' ? val * r : val / r }
          else return val
        }
      }
      function factor() {
        skip()
        if (peek() === '-') { i += 1; return -factor() }
        if (peek() === '(') { i += 1; const val = expr(); skip(); if (peek() === ')') i += 1; return val }
        if (peek() === 'v' || peek() === 'V') { i += 1; return v }
        let start = i
        while (i < s.length && /[0-9.]/.test(s[i])) i += 1
        if (start === i) throw new Error('bad formula')
        return parseFloat(s.slice(start, i))
      }
      const result = expr()
      skip()
      if (i !== s.length) throw new Error('trailing input')
      return result
    }
    function fmtNum(n) {
      if (!isFinite(n)) return '—'
      const r = Math.round(n * 100) / 100
      return String(r)
    }

    // -----------------------------------------------------------------------
    // Block renderers
    // -----------------------------------------------------------------------
    function Heading({ block }) {
      return h('div', { className: 'dsh-iui-head' },
        block.title ? h('div', { className: 'dsh-iui-title' }, redactString(String(block.title))) : null,
        block.subtitle ? h('div', { className: 'dsh-iui-subtitle' }, redactString(String(block.subtitle))) : null)
    }

    function TextBlock({ block }) {
      const raw = redactString(String(block.text ?? ''))
      const paras = raw.split(/\n{2,}/)
      return h('div', null, paras.map((p, idx) => h('p', { key: idx, className: 'dsh-iui-p' }, p)))
    }

    function Meta({ block, specMeta }) {
      const items = Array.isArray(block.items) ? block.items : specMeta
      if (!Array.isArray(items) || items.length === 0) return null
      return h('div', { className: 'dsh-iui-pills' }, items.map((it, idx) =>
        h('span', { key: idx, className: 'dsh-iui-pill' },
          it && it.icon ? h(PillIcon, { name: it.icon }) : null,
          h('span', null, redactString(String((it && it.text) ?? ''))))))
    }

    function MapBlock({ block }) {
      const markers = (Array.isArray(block.markers) ? block.markers : [])
        .filter((m) => m && isFinite(Number(m.lat)) && isFinite(Number(m.lng)))
        .map((m, idx) => ({ ...m, lat: Number(m.lat), lng: Number(m.lng), n: idx + 1 }))
      const route = (Array.isArray(block.route) ? block.route : [])
        .filter((p) => Array.isArray(p) && isFinite(Number(p[0])) && isFinite(Number(p[1])))
        .map((p) => [Number(p[0]), Number(p[1])])
      const pts = markers.map((m) => [m.lat, m.lng]).concat(route)
      const W = 640, H = 320, PADX = 46, PADY = 40
      let minLat = 39.88, maxLat = 39.95, minLng = 116.34, maxLng = 116.44
      if (pts.length) {
        minLat = Math.min(...pts.map((p) => p[0])); maxLat = Math.max(...pts.map((p) => p[0]))
        minLng = Math.min(...pts.map((p) => p[1])); maxLng = Math.max(...pts.map((p) => p[1]))
      }
      const spanLat = maxLat - minLat || 0.01
      const spanLng = maxLng - minLng || 0.01
      const padLat = spanLat * 0.18, padLng = spanLng * 0.18
      minLat -= padLat; maxLat += padLat; minLng -= padLng; maxLng += padLng
      const x = (lng) => PADX + ((lng - minLng) / (maxLng - minLng)) * (W - PADX * 2)
      const y = (lat) => H - PADY - ((lat - minLat) / (maxLat - minLat)) * (H - PADY * 2)
      const routePts = route.map((p) => `${x(p[1]).toFixed(1)},${y(p[0]).toFixed(1)}`).join(' ')
      const grid = []
      for (let gx = PADX; gx <= W - PADX; gx += 78) grid.push(h('line', { key: `v${gx}`, className: 'dsh-iui-map-grid', x1: gx, y1: PADY / 2, x2: gx, y2: H - PADY / 2 }))
      for (let gy = PADY; gy <= H - PADY; gy += 64) grid.push(h('line', { key: `h${gy}`, className: 'dsh-iui-map-grid', x1: PADX / 2, y1: gy, x2: W - PADX / 2, y2: gy }))
      return h('div', { className: 'dsh-iui-map' },
        h('svg', { viewBox: `0 0 ${W} ${H}`, role: 'img', 'aria-label': L('路线示意图', 'Route map') },
          h('rect', { x: 0, y: 0, width: W, height: H, className: 'dsh-iui-map-block', opacity: 0 }),
          grid,
          routePts ? h('polyline', { className: 'dsh-iui-map-route', points: routePts }) : null,
          markers.map((m) => h('g', { key: m.n },
            h('circle', { className: 'dsh-iui-map-pin', cx: x(m.lng), cy: y(m.lat), r: 12, fill: tone(m.tone) }),
            h('text', { className: 'dsh-iui-map-pin-text', x: x(m.lng), y: y(m.lat) }, String(m.n)),
            h('text', { className: 'dsh-iui-map-label', x: x(m.lng), y: y(m.lat) + 24 }, redactString(String(m.label ?? '')))))),
        markers.length ? h('div', { className: 'dsh-iui-legend' }, markers.map((m) =>
          h('span', { key: m.n }, h('i', { style: { background: tone(m.tone) } }), `${m.n}. ${redactString(String(m.label ?? ''))}`))) : null)
    }

    function Timeline({ block }) {
      const items = Array.isArray(block.items) ? block.items : []
      return h('ul', { className: 'dsh-iui-timeline' }, items.map((it, idx) =>
        h('li', { key: idx, className: 'dsh-iui-tl' },
          h('span', { className: 'dsh-iui-tl-dot' }),
          it && it.time ? h('div', { className: 'dsh-iui-tl-time' }, redactString(String(it.time))) : null,
          it && it.title ? h('div', { className: 'dsh-iui-tl-title' }, redactString(String(it.title))) : null,
          it && it.desc ? h('div', { className: 'dsh-iui-tl-desc' }, redactString(String(it.desc))) : null,
          it && it.tag ? h('span', { className: 'dsh-iui-tag' }, redactString(String(it.tag))) : null)))
    }

    function Shot({ item }) {
      const [failed, setFailed] = useState(false)
      return h('div', { className: 'dsh-iui-shot' },
        h('div', { className: 'dsh-iui-shot-img' },
          !failed && item && item.src
            ? h('img', { src: String(item.src), alt: redactString(String(item.title ?? '')), loading: 'lazy', onError: () => setFailed(true) })
            : h('div', { className: 'dsh-iui-shot-fallback' }, item && item.title ? redactString(String(item.title)) : L('图片', 'Image'))),
        h('div', { className: 'dsh-iui-shot-body' },
          item && item.title ? h('div', { className: 'dsh-iui-shot-title' }, redactString(String(item.title))) : null,
          item && item.caption ? h('div', { className: 'dsh-iui-shot-cap' }, redactString(String(item.caption))) : null))
    }
    function Gallery({ block }) {
      const items = Array.isArray(block.items) ? block.items : []
      return h('div', { className: 'dsh-iui-gallery' }, items.map((it, idx) => h(Shot, { key: idx, item: it })))
    }

    function TableBlock({ block }) {
      const cols = Array.isArray(block.columns) ? block.columns : []
      const rows = Array.isArray(block.rows) ? block.rows : []
      return h('div', null,
        block.caption ? h('div', { className: 'dsh-iui-section-title' }, redactString(String(block.caption))) : null,
        h('div', { className: 'dsh-iui-table-wrap' },
          h('table', { className: 'dsh-iui-table' },
            h('thead', null, h('tr', null, cols.map((c, i) => h('th', { key: i }, redactString(String(c)))))),
            h('tbody', null, rows.map((row, ri) =>
              h('tr', { key: ri }, (Array.isArray(row) ? row : []).map((cell, ci) =>
                h('td', { key: ci }, redactString(String(cell ?? ''))))))))))
    }

    function ChartBlock({ block }) {
      const kind = block.kind === 'line' || block.kind === 'pie' ? block.kind : 'bar'
      const labels = (Array.isArray(block.labels) ? block.labels : []).map((x) => redactString(String(x)))
      let series = block.series
      if (Array.isArray(series) && series.length && typeof series[0] === 'object' && series[0] !== null) series = series[0].values
      series = Array.isArray(series) ? series.map(Number).filter((n) => isFinite(n)) : []
      const W = 560, H = 220, PAD = 34
      const maxV = Math.max(1, ...series.map((n) => Math.abs(n)))
      const n = series.length
      if (kind === 'pie') {
        const total = series.reduce((a, b) => a + Math.max(0, b), 0) || 1
        const cx = W / 2, cy = H / 2, r = Math.min(cx, cy) - 12
        let acc = 0
        const colors = ['#4f6bff', '#1f9d55', '#d99000', '#e5484d', '#8b5cf6', '#0ea5e9', '#ec4899', '#14b8a6']
        const arcs = series.map((val, i) => {
          const frac = Math.max(0, val) / total
          const a0 = acc * Math.PI * 2 - Math.PI / 2
          acc += frac
          const a1 = acc * Math.PI * 2 - Math.PI / 2
          const large = frac > 0.5 ? 1 : 0
          const x0 = cx + r * Math.cos(a0), y0 = cy + r * Math.sin(a0)
          const x1 = cx + r * Math.cos(a1), y1 = cy + r * Math.sin(a1)
          const d = `M ${cx} ${cy} L ${x0} ${y0} A ${r} ${r} 0 ${large} 1 ${x1} ${y1} Z`
          return h('path', { key: i, d, fill: colors[i % colors.length] })
        })
        return h('div', { className: 'dsh-iui-chart' },
          h('svg', { viewBox: `0 0 ${W} ${H}`, role: 'img', 'aria-label': block.title || 'chart' }, arcs),
          h('div', { className: 'dsh-iui-legend' }, labels.map((lab, i) =>
            h('span', { key: i }, h('i', { style: { background: ['#4f6bff', '#1f9d55', '#d99000', '#e5484d', '#8b5cf6', '#0ea5e9', '#ec4899', '#14b8a6'][i % 8] } }), `${lab} ${fmtNum(series[i] ?? 0)}`))))
      }
      const innerW = W - PAD * 2, innerH = H - PAD * 2
      const bw = innerW / Math.max(1, n)
      const nodes = []
      nodes.push(h('line', { key: 'axis', className: 'dsh-iui-chart-axis', x1: PAD, y1: H - PAD, x2: W - PAD, y2: H - PAD }))
      if (kind === 'bar') {
        series.forEach((val, i) => {
          const bh = (Math.abs(val) / maxV) * innerH
          nodes.push(h('rect', { key: `b${i}`, x: PAD + i * bw + bw * 0.2, y: H - PAD - bh, width: bw * 0.6, height: bh, rx: 4, fill: '#4f6bff' }))
          nodes.push(h('text', { key: `v${i}`, className: 'dsh-iui-chart-val', x: PAD + i * bw + bw / 2, y: H - PAD - bh - 5 }, fmtNum(val)))
        })
      } else {
        const pts = series.map((val, i) => [PAD + i * bw + bw / 2, H - PAD - (Math.abs(val) / maxV) * innerH])
        nodes.push(h('polyline', { key: 'line', points: pts.map((p) => `${p[0].toFixed(1)},${p[1].toFixed(1)}`).join(' '), fill: 'none', stroke: '#4f6bff', strokeWidth: 2.5, strokeLinejoin: 'round' }))
        pts.forEach((p, i) => nodes.push(h('circle', { key: `d${i}`, cx: p[0], cy: p[1], r: 3.5, fill: '#4f6bff' })))
      }
      labels.forEach((lab, i) => nodes.push(h('text', { key: `l${i}`, className: 'dsh-iui-chart-label', x: PAD + i * bw + bw / 2, y: H - PAD + 16 }, lab)))
      return h('div', { className: 'dsh-iui-chart' }, h('svg', { viewBox: `0 0 ${W} ${H}`, role: 'img', 'aria-label': block.title || 'chart' }, nodes))
    }

    function Calculator({ block }) {
      const min = Number.isFinite(Number(block.min)) ? Number(block.min) : 0
      const max = Number.isFinite(Number(block.max)) ? Number(block.max) : 10
      const step = Number.isFinite(Number(block.step)) ? Number(block.step) : 1
      const [v, setV] = useState(Number.isFinite(Number(block.value)) ? Number(block.value) : min)
      let result = '—'
      try { result = fmtNum(evalFormula(block.formula || 'v', v)) } catch { result = '—' }
      return h('div', { className: 'dsh-iui-calc' },
        h('div', { className: 'dsh-iui-calc-row' },
          h('span', { className: 'dsh-iui-calc-label' }, redactString(String(block.label ?? L('拖动计算', 'Adjust')))),
          h('span', { className: 'dsh-iui-calc-val' }, result, block.unit ? h('span', { style: { fontSize: '13px', marginLeft: '4px', color: 'inherit', fontWeight: 500 } }, redactString(String(block.unit))) : null)),
        h('input', {
          className: 'dsh-iui-range', type: 'range', min, max, step, value: v,
          'aria-label': redactString(String(block.label ?? 'value')),
          onChange: (e) => setV(Number(e.target.value)),
        }),
        h('div', { className: 'dsh-iui-calc-label' }, `${redactString(String(block.unit ?? ''))} ${v}`))
    }

    function fieldValueToString(value) {
      if (Array.isArray(value)) return value.join(L('、', ', '))
      return value == null ? '' : String(value)
    }

    function copyText(text) {
      try {
        if (typeof navigator !== 'undefined' && navigator.clipboard && navigator.clipboard.writeText) {
          navigator.clipboard.writeText(text).catch(() => {})
          return true
        }
      } catch { /* ignore */ }
      return false
    }

    function Form({ block, onCompose }) {
      const fields = Array.isArray(block.fields) ? block.fields : []
      const init = {}
      for (const f of fields) {
        if (!f || !f.name) continue
        if (f.type === 'checkbox') init[f.name] = Array.isArray(f.value) ? f.value.slice() : []
        else init[f.name] = f.value != null ? f.value : (f.type === 'segmented' || f.type === 'radioCards' ? ((f.options && f.options[0] && f.options[0].value) ?? '') : '')
      }
      const [values, setValues] = useState(init)
      const [submitted, setSubmitted] = useState(null)
      const set = (name, val) => setValues((prev) => ({ ...prev, [name]: val }))
      const toggle = (name, val) => setValues((prev) => {
        const list = Array.isArray(prev[name]) ? prev[name].slice() : []
        const at = list.indexOf(val)
        if (at >= 0) list.splice(at, 1); else list.push(val)
        return { ...prev, [name]: list }
      })
      const compose = () => {
        // Lookup by field name AND label, so `{{任意字段}}` (including non-ASCII
        // names like {{体力}}) resolves regardless of which the model wrote.
        const lookup = {}
        for (const f of fields) {
          if (!f || !f.name) continue
          lookup[f.name] = values[f.name]
          if (f.label != null) lookup[String(f.label)] = values[f.name]
        }
        const resolve = (key) => {
          const k = String(key).trim()
          if (Object.prototype.hasOwnProperty.call(lookup, k)) return fieldValueToString(lookup[k])
          if (Object.prototype.hasOwnProperty.call(lookup, key)) return fieldValueToString(lookup[key])
          for (const f of fields) {
            if (!f || !f.name) continue
            const label = String(f.label ?? '')
            if (label === k || label.startsWith(k) || k.startsWith(label)) return fieldValueToString(values[f.name])
          }
          return ''
        }
        let text
        if (typeof block.submitTemplate === 'string' && block.submitTemplate) {
          text = block.submitTemplate.replace(/\{\{\s*([^{}]+?)\s*\}\}/gu, (_m, key) => resolve(key))
        } else {
          const parts = []
          for (const f of fields) {
            if (!f || !f.name) continue
            const val = fieldValueToString(values[f.name])
            if (val) parts.push(`${redactString(String(f.label ?? f.name))}：${val}`)
          }
          text = `${L('[智能界面提交] 我的偏好：', '[Intelligent UI submit] My preferences: ')}${parts.join('；')}`
        }
        text = redactString(text)
        // Session-bound writer (tail slot's own inputActions). No global event.
        const ok = typeof onCompose === 'function' ? onCompose(text) === true : false
        setSubmitted({ ok, text })
      }
      let feedback = null
      if (submitted) {
        feedback = h('div', { className: 'dsh-iui-feedback', 'data-error': submitted.ok ? 'false' : 'true' },
          submitted.ok
            ? L('已填入输入框，按 Enter 发送。', 'Placed in the composer; press Enter to send.')
            : h('span', null,
                L('无法自动填入，请复制这条请求：', 'Could not fill the composer; copy this request: '),
                h('button', { type: 'button', className: 'dsh-iui-copy', onClick: () => copyText(submitted.text) }, L('复制', 'Copy'))))
      }
      return h('div', { className: 'dsh-iui-form' },
        (block.title || block.description) ? h('div', { className: 'dsh-iui-form-head' },
          block.title ? h('div', { className: 'dsh-iui-form-title' }, redactString(String(block.title))) : null,
          block.description ? h('div', { className: 'dsh-iui-form-desc' }, redactString(String(block.description))) : null) : null,
        fields.map((f, idx) => renderField(f, idx, values, set, toggle)),
        h('div', null,
          h('button', { type: 'button', className: 'dsh-iui-submit', onClick: compose }, redactString(String(block.submitLabel ?? L('提交', 'Submit')))),
          feedback,
          submitted && !submitted.ok ? h('div', { className: 'dsh-iui-preview' }, submitted.text) : null))
    }

    function renderField(f, idx, values, set, toggle) {
      if (!f || !f.name) return null
      const label = h('div', { className: 'dsh-iui-field-label' }, redactString(String(f.label ?? f.name)))
      const val = values[f.name]
      if (f.type === 'segmented') {
        return h('div', { key: idx, className: 'dsh-iui-field' }, label,
          h('div', { className: 'dsh-iui-seg', role: 'group' }, (f.options || []).map((o, i) =>
            h('button', { key: i, type: 'button', 'data-on': val === o.value ? 'true' : 'false', onClick: () => set(f.name, o.value) }, redactString(String(o.label ?? o.value))))))
      }
      if (f.type === 'radioCards') {
        return h('div', { key: idx, className: 'dsh-iui-field' }, label,
          h('div', { className: 'dsh-iui-cards' }, (f.options || []).map((o, i) =>
            h('button', { key: i, type: 'button', className: 'dsh-iui-rc', 'data-on': val === o.value ? 'true' : 'false', onClick: () => set(f.name, o.value) },
              h('div', { className: 'dsh-iui-rc-t' }, redactString(String(o.label ?? o.value))),
              o.desc ? h('div', { className: 'dsh-iui-rc-d' }, redactString(String(o.desc))) : null))))
      }
      if (f.type === 'select') {
        return h('div', { key: idx, className: 'dsh-iui-field' }, label,
          h('select', { className: 'dsh-iui-select', value: val ?? '', onChange: (e) => set(f.name, e.target.value) },
            (f.options || []).map((o, i) => h('option', { key: i, value: o.value }, redactString(String(o.label ?? o.value))))))
      }
      if (f.type === 'checkbox') {
        const arr = Array.isArray(val) ? val : []
        return h('div', { key: idx, className: 'dsh-iui-field' }, label,
          h('div', { className: 'dsh-iui-checks' }, (f.options || []).map((o, i) =>
            h('label', { key: i, className: 'dsh-iui-check' },
              h('input', { type: 'checkbox', checked: arr.includes(o.value), onChange: () => toggle(f.name, o.value) }),
              redactString(String(o.label ?? o.value))))))
      }
      if (f.type === 'slider') {
        return h('div', { key: idx, className: 'dsh-iui-field' }, label,
          h('input', { className: 'dsh-iui-range', type: 'range', min: f.min ?? 0, max: f.max ?? 10, step: f.step ?? 1, value: val ?? f.min ?? 0, onChange: (e) => set(f.name, Number(e.target.value)) }),
          h('div', { className: 'dsh-iui-calc-label' }, String(val ?? f.min ?? 0)))
      }
      if (f.type === 'textarea') {
        return h('div', { key: idx, className: 'dsh-iui-field' }, label,
          h('textarea', { className: 'dsh-iui-input', rows: 3, placeholder: f.placeholder ? redactString(String(f.placeholder)) : '', value: val ?? '', onChange: (e) => set(f.name, e.target.value) }))
      }
      const inputType = f.type === 'time' ? 'time' : 'text'
      return h('div', { key: idx, className: 'dsh-iui-field' }, label,
        h('input', { className: 'dsh-iui-input', type: inputType, placeholder: f.placeholder ? redactString(String(f.placeholder)) : '', value: val ?? '', onChange: (e) => set(f.name, e.target.value) }))
    }

    // -----------------------------------------------------------------------
    // Spec / call selection
    // -----------------------------------------------------------------------
    function specFromArgsRaw(argsRaw) {
      if (typeof argsRaw !== 'string' || argsRaw === '') return null
      try {
        const parsed = JSON.parse(argsRaw)
        const spec = parsed && parsed.spec
        if (spec && typeof spec === 'object') return sanitizeDeep(spec)
      } catch { /* ignore */ }
      return null
    }

    function argsRawOfToolView(block) {
      if (!block || typeof block !== 'object') return ''
      if ('kind' in block) return (block.call && block.call.argsRaw) || ''
      return block.argsRaw || ''
    }

    function toolState(block) {
      if (!block || !('kind' in block)) return block && block.phase !== 'preparing' ? 'running' : 'preparing'
      if (block.error && block.error.code === 'interrupted') return 'stopped'
      return block.isError || block.error || (block.meta && block.meta.stopped === true) ? 'error' : 'ok'
    }

    const EMPTY_TOOL_CALLS = Object.freeze([])
    function toolCallsSource(chat, turnKey) {
      const turnNumber = Number(turnKey)
      const source = chat.getSnapshot()?.nodes.turnDataSource(turnNumber, 'tool-call')
      if (source) return source
      // A target can be unavailable while its binding is being restored. Keep a
      // live subscription, so the temporary empty result recovers on its own.
      return {
        getSnapshot: () => chat.getSnapshot()?.nodes.turnDataSource(turnNumber, 'tool-call').getSnapshot() ?? EMPTY_TOOL_CALLS,
        subscribe: (listener) => chat.subscribe(listener),
      }
    }

    /**
     * Walk the host-assembled tool-call node data for one turn and collect each
     * SETTLED, SUCCESSFUL intelligent_ui call, keyed by callId, in recorded order.
     * Pending (no `kind`) and failed/interrupted (`isError`) calls are skipped so
     * they stay execution diagnostics only. Recursive `subCalls` cover PTC.
     * @param {Array<{root?: object}>} toolCallData
     */
    function collectIntelligentUiCards(toolCallData) {
      const out = []
      const seen = new Set()
      const visit = (block, depth) => {
        if (!block || typeof block !== 'object' || depth > 32) return
        if (
          block.callId &&
          block.call &&
          block.call.name === 'intelligent_ui' &&
          toolState(block) === 'ok'
        ) {
          const raw = block.call.argsRaw
          if (typeof raw === 'string' && raw !== '' && !seen.has(block.callId)) {
            seen.add(block.callId)
            out.push({ callId: block.callId, argsRaw: raw })
          }
        }
        if (Array.isArray(block.subCalls)) for (const child of block.subCalls) visit(child, depth + 1)
      }
      const entries = Array.isArray(toolCallData) ? toolCallData : []
      for (const entry of entries) {
        const root = entry && entry.root
        if (root) visit(root, 0)
      }
      return out
    }

    function makeComposeHandler(inputActions) {
      return (text) => {
        if (typeof text !== 'string' || text === '') return false
        if (inputActions && typeof inputActions.setDraft === 'function') {
          try {
            inputActions.setDraft(text)
            return true
          } catch { return false }
        }
        return false
      }
    }

    // -----------------------------------------------------------------------
    // Compact tool view (inside the collapsible process group).
    // -----------------------------------------------------------------------
    function IntelligentUiRow(props) {
      const phase = props && props.phase
      const block = props && props.block
      if (phase === 'preparing') {
        return h('div', { className: 'dsh-iui-row', 'data-tool': 'intelligent_ui', 'data-state': 'preparing' },
          h('span', { className: 'dsh-iui-row-dot' }),
          h('span', { className: 'dsh-iui-row-title' }, L('智能界面 · 渲染中…', 'Intelligent UI · preparing…')))
      }
      const spec = specFromArgsRaw(argsRawOfToolView(block))
      const state = toolState(block)
      const isError = state === 'error' || state === 'stopped'
      const title = spec && spec.title ? String(spec.title) : ''
      const count = spec && Array.isArray(spec.blocks) ? spec.blocks.length : 0
      return h('div', { className: 'dsh-iui-row', 'data-tool': 'intelligent_ui', 'data-state': state },
        h('span', { className: 'dsh-iui-row-dot' }),
        h('span', { className: 'dsh-iui-row-title' }, isError ? L('智能界面 · 生成失败', 'Intelligent UI · failed') : L('智能界面', 'Intelligent UI')),
        title ? h('span', { className: 'dsh-iui-row-sep' }, '·') : null,
        title ? h('span', { className: 'dsh-iui-row-summary' }, redactString(title)) : null,
        (!isError && count > 0) ? h('span', { className: 'dsh-iui-row-sep' }, '·') : null,
        (!isError && count > 0) ? h('span', { className: 'dsh-iui-row-summary' }, L(`${count} 个区块`, `${count} blocks`)) : null)
    }

    // -----------------------------------------------------------------------
    // Full answer body (shared): rendered only from the turn tail.
    // -----------------------------------------------------------------------
    function IntelligentUiBody({ spec, onCompose }) {
      if (!spec || !Array.isArray(spec.blocks) || spec.blocks.length === 0) return null
      const blocks = spec.blocks
      return h('div', { className: 'dsh-iui-card', 'data-dsh-intelligent-ui': '' },
        (spec.title || spec.subtitle) ? h(Heading, { block: { title: spec.title, subtitle: spec.subtitle } }) : null,
        spec.meta ? h(Meta, { block: { items: spec.meta }, specMeta: spec.meta }) : null,
        blocks.map((b, idx) => {
          if (!b || typeof b !== 'object') return null
          switch (b.type) {
            case 'heading': return h(Heading, { key: idx, block: b })
            case 'text': return h(TextBlock, { key: idx, block: b })
            case 'meta': return h(Meta, { key: idx, block: b })
            case 'map': return h(MapBlock, { key: idx, block: b })
            case 'timeline': return h(Timeline, { key: idx, block: b })
            case 'gallery': return h(Gallery, { key: idx, block: b })
            case 'table': return h(TableBlock, { key: idx, block: b })
            case 'chart': return h(ChartBlock, { key: idx, block: b })
            case 'calculator': return h(Calculator, { key: idx, block: b })
            case 'form': return h(Form, { key: idx, block: b, onCompose })
            default: return null
          }
        }))
    }

    // -----------------------------------------------------------------------
    // Turn tail: the persistent answer surface (outside the process group).
    // `useToolCalls` is the keyed hook from the registration `inject`; it returns
    // the host-assembled tool-call node DATA for one turn (each `{ root }`).
    // -----------------------------------------------------------------------
    function IntelligentUiTail(props) {
      // The slot supplies a Turn object; the keyed source takes its number.
      const turn = props && props.turn ? props.turn.turn : undefined
      const entries = props && typeof props.useToolCalls === 'function'
        ? props.useToolCalls(String(turn))
        : null
      const cards = collectIntelligentUiCards(entries)
      if (cards.length === 0) return null
      const compose = makeComposeHandler(props ? props.inputActions : undefined)
      return h('div', { className: 'dsh-iui-tail', 'data-turn-tail-iui': String(turn) },
        cards.map((card) => {
          const spec = specFromArgsRaw(card.argsRaw)
          if (!spec) return null
          return h('div', { key: card.callId, className: 'dsh-iui-tail-item', 'data-call-id': card.callId },
            h(IntelligentUiBody, { spec, onCompose: compose }))
        }))
    }

    return {
      inject: ['slots', 'sessions', 'uiConversation'],
      apply(ctx) {
        ctx.effect(() => {
          const el = document.createElement('style')
          el.setAttribute('data-plugin', 'dsh-intelligent-ui')
          el.textContent = STYLES
          document.head.appendChild(el)
          return () => el.remove()
        })
        // Compact execution/diagnostic row inside the process group.
        ctx.slots.inject('tool.call.toolview', () =>
          ctx.slots.register({ name: 'tool.call.toolview', key: 'intelligent_ui' }, IntelligentUiRow))
        // Persistent full answer card OUTSIDE the process group, per turn.
        ctx.slots.inject('conversation.chat.turnTail', () =>
          ctx.slots.register({
            name: 'conversation.chat.turnTail',
            id: 'dsh-intelligent-ui-tail',
            inject: (sessionId) => {
              const binding = ctx.sessions.binding(sessionId)
              if (binding === undefined) return { keyedHooks: {} }
              const chat = ctx.uiConversation.binding(binding).target('chat')
              return {
                keyedHooks: {
                  toolCalls: (turnKey) => toolCallsSource(chat, turnKey),
                },
              }
            },
          }, IntelligentUiTail))
      },
    }
  },
})
})()
