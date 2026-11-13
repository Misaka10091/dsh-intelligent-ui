/**
 * Client bundle regression tests.
 *
 * Load the REAL client.js in a vm with a captured `window.__ModuleLoader__` and
 * a small stateful React stub, then exercise the actually-registered slot
 * components (behaviour, not string greps):
 *   - both slots registered (compact tool row + turn tail); no composer bridge
 *   - tail selector: settled native + nested/PTC, skips pending/error,
 *     per-turn placement, multiple calls in recorded order
 *   - compact row never renders a full card
 *   - form submit composes resolved text and calls session-bound
 *     inputActions.setDraft; without a writer it shows an explicit copy fallback
 *   - registration `inject` wires the keyedHooks toolCalls source
 */
import { test } from 'node:test'
import assert from 'node:assert/strict'
import vm from 'node:vm'
import { readFileSync } from 'node:fs'

const SRC = readFileSync(new URL('../client.js', import.meta.url), 'utf8')

function makeReact() {
  const Fragment = Symbol('Fragment')
  const flat = (arr) => arr.flat(Infinity).filter((x) => x !== undefined && x !== null && x !== false && x !== true)
  const h = (type, props, ...children) => ({ type, props: props || {}, children: flat(children) })
  const store = new Map()
  let current = null
  let index = 0
  return {
    createElement: h,
    Fragment,
    useRef: (v) => ({ current: v }),
    useMemo: (fn) => fn(),
    useEffect: () => {},
    useCallback: (fn) => fn,
    memo: (c) => c,
    /** Test-only: start a component's hook slot list. */
    __begin(fn) { current = fn; index = 0 },
    useState(init) {
      const arr = store.get(current) || []
      const i = index
      index += 1
      if (i >= arr.length) arr[i] = typeof init === 'function' ? init() : init
      store.set(current, arr)
      const set = (next) => { arr[i] = typeof next === 'function' ? next(arr[i]) : next }
      return [arr[i], set]
    },
  }
}

function loadClient() {
  let def = null
  const doc = {
    createElement: () => ({ setAttribute() {}, remove() {}, style: {}, dataset: {} }),
    head: { appendChild() {}, querySelector: () => null },
    querySelector: () => null,
    addEventListener() {},
    removeEventListener() {},
  }
  const windowObj = {
    __ModuleLoader__: { load: (d) => { def = d } },
    addEventListener() {},
    removeEventListener() {},
    dispatchEvent() {},
  }
  const ctx = { window: windowObj, document: doc, navigator: { language: 'zh-CN' }, console, setTimeout, clearTimeout }
  vm.createContext(ctx)
  vm.runInContext(SRC, ctx, { filename: 'client.js' })
  // DSH can evaluate a rebuilt client artifact again in the same document.
  // This used to throw: Identifier 'STYLES' has already been declared.
  vm.runInContext(SRC, ctx, { filename: 'client.js (reload)' })
  assert.ok(def && typeof def.factory === 'function', 'module loader must capture a factory')
  const React = makeReact()
  const plugin = def.factory((name) => {
    if (name === 'react') return React
    throw new Error('unexpected require: ' + name)
  })
  return { plugin, React }
}

const TURN_DATA = {}
const chatSnapshot = {
  last: null,
  nodes: {
    turnDataSource: (turn, kind) => {
      chatSnapshot.last = { turn, kind }
      return { getSnapshot: () => TURN_DATA[turn] || [], subscribe: () => () => {} }
    },
  },
}

function mount(chatTarget = { getSnapshot: () => chatSnapshot }) {
  const { plugin, React } = loadClient()
  const regs = {}
  const fakeCtx = {
    effect: (fn) => { try { const d = fn(); if (typeof d === 'function') d() } catch { /* ignore */ } return () => {} },
    slots: {
      inject: (_name, fn) => { fn() },
      register: (opts, comp) => { regs[`${opts.name}#${opts.key || opts.id || ''}`] = { opts, comp }; return () => {} },
    },
    sessions: { binding: (id) => (id ? { id } : undefined) },
    uiConversation: { binding: () => ({ target: () => chatTarget }) },
  }
  plugin.apply(fakeCtx)
  return { plugin, regs, React }
}

function allNodes(node, out = []) {
  if (Array.isArray(node)) { for (const n of node) allNodes(n, out); return out }
  if (node && typeof node === 'object') {
    out.push(node)
    for (const c of node.children || []) allNodes(c, out)
  }
  return out
}
function render(node, React) {
  if (Array.isArray(node)) return node.flatMap((n) => render(n, React))
  if (node === null || node === undefined || typeof node !== 'object') return node
  if (typeof node.type === 'function') {
    const props = { ...node.props }
    if (node.children && node.children.length) props.children = node.children.length === 1 ? node.children[0] : node.children
    if (React && React.__begin) React.__begin(node.type)
    return render(node.type(props), React)
  }
  return { type: node.type, props: node.props, children: (node.children || []).flatMap((n) => render(n, React)) }
}
const byClass = (tree, cls) => allNodes(tree).filter((n) => n.props && n.props.className === cls)
const raw = (spec) => JSON.stringify({ spec })

const SPEC = {
  version: 1,
  title: '北京中轴线',
  blocks: [
    { type: 'text', text: 'hello' },
    {
      type: 'form',
      title: '偏好',
      fields: [
        { type: 'segmented', name: 'pace', label: '节奏', value: '标准', options: [{ value: '标准', label: '标准' }, { value: '轻松', label: '轻松' }] },
        { type: 'time', name: 'start', label: '出发时间', value: '07:00' },
        { type: 'checkbox', name: 'care', label: '最在意', value: ['古建筑'], options: [{ value: '古建筑', label: '古建筑' }, { value: '摄影', label: '摄影' }] },
      ],
      submitTemplate: '节奏={{节奏}}；出发={{出发时间}}；在意={{最在意}}',
      submitLabel: '重排',
    },
  ],
}

const settled = (callId, spec, extra = {}) => ({ callId, kind: 'tool-result', call: { name: 'intelligent_ui', argsRaw: raw(spec) }, isError: false, subCalls: [], ...extra })

test('registers a compact tool row and a turn-tail card; no composer bridge', () => {
  const { plugin, regs } = mount()
  assert.ok(regs['tool.call.toolview#intelligent_ui'], 'tool view registered for intelligent_ui')
  assert.ok(regs['conversation.chat.turnTail#dsh-intelligent-ui-tail'], 'turn tail registered')
  for (const key of Object.keys(regs)) assert.ok(!key.startsWith('conversation.input.dock'), 'bridge must be removed')
  assert.equal(plugin.inject.slice().sort().join(','), 'sessions,slots,uiConversation')
})

test('compact tool row renders status text, never a full card', () => {
  const { regs, React } = mount()
  const Row = regs['tool.call.toolview#intelligent_ui'].comp
  const ok = render(Row({ phase: 'result', block: settled('c1', SPEC) }), React)
  assert.equal(byClass(ok, 'dsh-iui-card').length, 0, 'compact row must not render the card body')
  const row = allNodes(ok).find((n) => n.props && n.props['data-tool'] === 'intelligent_ui')
  assert.ok(row)
  assert.equal(row.props['data-state'], 'ok')
  const err = render(Row({ phase: 'result', block: { callId: 'c', kind: 'tool-result', call: { name: 'intelligent_ui', argsRaw: raw(SPEC) }, isError: true, subCalls: [] } }), React)
  const errRow = allNodes(err).find((n) => n.props && n.props['data-tool'] === 'intelligent_ui')
  assert.equal(errRow.props['data-state'], 'error')
})

test('tail renders one card per settled successful call (native)', () => {
  const { regs, React } = mount()
  const Tail = regs['conversation.chat.turnTail#dsh-intelligent-ui-tail'].comp
  const tree = render(Tail({ turn: { turn: 1, status: 'closed' }, useToolCalls: () => [{ root: settled('c1', SPEC) }], inputActions: { setDraft() {} } }), React)
  assert.equal(allNodes(tree).filter((n) => n.props && 'data-dsh-intelligent-ui' in n.props).length, 1)
  assert.equal(allNodes(tree).filter((n) => n.props && n.props['data-call-id'] === 'c1').length, 1)
})

test('tail skips pending and failed calls', () => {
  const { regs, React } = mount()
  const Tail = regs['conversation.chat.turnTail#dsh-intelligent-ui-tail'].comp
  const pending = { callId: 'p', phase: 'start', name: 'intelligent_ui', argsRaw: raw(SPEC) }
  const failed = settled('f', SPEC, { isError: true })
  const tree = render(Tail({ turn: { turn: 1, status: 'closed' }, useToolCalls: () => [{ root: pending }, { root: failed }], inputActions: { setDraft() {} } }), React)
  assert.equal(tree, null, 'no cards for pending/failed')
})

test('tail walks nested PTC subCalls', () => {
  const { regs, React } = mount()
  const Tail = regs['conversation.chat.turnTail#dsh-intelligent-ui-tail'].comp
  const root = { callId: 'ptc', kind: 'tool-result', call: { name: 'run_code', argsRaw: '{}' }, isError: false, subCalls: [settled('c2', SPEC)] }
  const tree = render(Tail({ turn: { turn: 2, status: 'closed' }, useToolCalls: () => [{ root }], inputActions: { setDraft() {} } }), React)
  const cards = allNodes(tree).filter((n) => n.props && n.props['data-call-id'])
  assert.equal(cards.length, 1)
  assert.equal(cards[0].props['data-call-id'], 'c2')
})

test('tail respects per-turn placement and multiple calls in order', () => {
  const { regs, React } = mount()
  const Tail = regs['conversation.chat.turnTail#dsh-intelligent-ui-tail'].comp
  const perTurn = { 5: [{ root: settled('a', SPEC) }, { root: settled('b', SPEC) }], 9: [{ root: settled('z', SPEC) }] }
  const useToolCalls = (k) => perTurn[k] || []
  const ids = (tree) => allNodes(tree).filter((n) => n.props && n.props['data-call-id']).map((n) => n.props['data-call-id']).join(',')
  assert.equal(ids(render(Tail({ turn: { turn: 5, status: 'closed' }, useToolCalls, inputActions: { setDraft() {} } }), React)), 'a,b')
  assert.equal(ids(render(Tail({ turn: { turn: 9, status: 'closed' }, useToolCalls, inputActions: { setDraft() {} } }), React)), 'z')
})

test('form submit writes resolved text to the session-bound composer', () => {
  const { regs, React } = mount()
  const Tail = regs['conversation.chat.turnTail#dsh-intelligent-ui-tail'].comp
  const calls = []
  const props = { turn: { turn: 1, status: 'closed' }, useToolCalls: () => [{ root: settled('c1', SPEC) }], inputActions: { setDraft: (t) => calls.push(t) } }
  const tree = render(Tail(props), React)
  const submit = byClass(tree, 'dsh-iui-submit')[0]
  assert.ok(submit, 'has submit button')
  submit.props.onClick()
  assert.equal(calls.length, 1)
  assert.match(calls[0], /节奏=标准/)
  assert.match(calls[0], /出发=07:00/)
  assert.match(calls[0], /在意=古建筑/)
  assert.ok(!/\{\{/.test(calls[0]), 'no unresolved placeholders')
  const after = render(Tail(props), React)
  const feedback = byClass(after, 'dsh-iui-feedback')[0]
  assert.ok(feedback, 'shows submit feedback')
  assert.equal(feedback.props['data-error'], 'false')
})

test('form without a writer shows an explicit copy fallback', () => {
  const { regs, React } = mount()
  const Tail = regs['conversation.chat.turnTail#dsh-intelligent-ui-tail'].comp
  const props = { turn: { turn: 1, status: 'closed' }, useToolCalls: () => [{ root: settled('c1', SPEC) }] }
  const tree = render(Tail(props), React)
  byClass(tree, 'dsh-iui-submit')[0].props.onClick()
  const after = render(Tail(props), React)
  const feedback = byClass(after, 'dsh-iui-feedback')[0]
  assert.ok(feedback, 'shows failure feedback')
  assert.equal(feedback.props['data-error'], 'true')
  const copy = byClass(after, 'dsh-iui-copy')[0]
  assert.ok(copy, 'offers an explicit copy action')
  assert.doesNotThrow(() => copy.props.onClick(), 'copy fallback must not throw without clipboard')
  const preview = byClass(after, 'dsh-iui-preview')[0]
  assert.ok(preview, 'shows the composed text to copy')
})

test('interrupted/stopped results never become successful answers or status rows', () => {
  const { regs, React } = mount()
  const Tail = regs['conversation.chat.turnTail#dsh-intelligent-ui-tail'].comp
  const Row = regs['tool.call.toolview#intelligent_ui'].comp
  for (const extra of [{ error: { code: 'interrupted' } }, { meta: { stopped: true } }]) {
    const block = settled('stopped', SPEC, extra)
    const tree = render(Tail({ turn: { turn: 1 }, useToolCalls: () => [{ root: block }] }), React)
    assert.equal(tree, null)
    const row = byClass(render(Row({ phase: 'result', block }), React), 'dsh-iui-row')[0]
    assert.notEqual(row.props['data-state'], 'ok')
  }
})

test('unavailable and malformed arguments do not render empty cards or crash', () => {
  const { regs, React } = mount()
  const Tail = regs['conversation.chat.turnTail#dsh-intelligent-ui-tail'].comp
  for (const argsRaw of ['', '{', 'null', '{}', '{"spec":{}}', '{"spec":{"blocks":[]}}']) {
    const block = settled('bad', SPEC, { call: { name: 'intelligent_ui', argsRaw } })
    const tree = render(Tail({ turn: { turn: 1 }, useToolCalls: () => [{ root: block }] }), React)
    assert.equal(byClass(tree, 'dsh-iui-card').length, 0)
  }
  assert.equal(render(Tail({ turn: { turn: 1 }, useToolCalls: () => [{ root: settled('missing', SPEC, { call: null }) }] }), React), null)
})

test('an initially unavailable Chat source stays subscribed and recovers', () => {
  let snapshot
  let listener
  let disposed = false
  const { regs } = mount({
    getSnapshot: () => snapshot,
    subscribe: (next) => { listener = next; return () => { disposed = true } },
  })
  const source = regs['conversation.chat.turnTail#dsh-intelligent-ui-tail'].opts.inject('sess').keyedHooks.toolCalls('3')
  assert.equal(source.getSnapshot().length, 0)
  assert.equal(source.getSnapshot(), source.getSnapshot(), 'empty snapshots must be reference-stable')
  let changes = 0
  const dispose = source.subscribe(() => { changes += 1 })
  TURN_DATA[3] = [{ root: settled('restored', SPEC) }]
  snapshot = chatSnapshot
  listener()
  assert.equal(changes, 1)
  assert.equal(source.getSnapshot(), TURN_DATA[3])
  dispose()
  assert.ok(disposed)
  delete TURN_DATA[3]
})

test('registration inject wires a keyedHooks toolCalls source for the turn', () => {
  const { regs } = mount()
  const opts = regs['conversation.chat.turnTail#dsh-intelligent-ui-tail'].opts
  assert.equal(typeof opts.inject, 'function')
  const injected = opts.inject('sess-1')
  assert.ok(injected && injected.keyedHooks && typeof injected.keyedHooks.toolCalls === 'function')
  TURN_DATA[3] = [{ root: settled('c1', SPEC) }]
  const source = injected.keyedHooks.toolCalls('3')
  assert.equal(chatSnapshot.last.turn, 3)
  assert.equal(chatSnapshot.last.kind, 'tool-call')
  assert.equal(source.getSnapshot(), TURN_DATA[3])
  delete TURN_DATA[3]
})
