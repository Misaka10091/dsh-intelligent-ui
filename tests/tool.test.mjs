import { test } from 'node:test'
import assert from 'node:assert/strict'
import { buildToolDefinition } from '../lib/tool.js'

const spec = { title: 'Plan', blocks: [{ type: 'text', text: 'hi' }] }

test('definition exposes the wire tool name', () => {
  assert.equal(buildToolDefinition().name, 'intelligent_ui')
})

test('execute returns a compact summary', () => {
  const def = buildToolDefinition()
  assert.deepEqual(def.execute({ spec }), { title: 'Plan', blocks: 1 })
})

test('execute rejects a malformed spec', () => {
  const def = buildToolDefinition()
  assert.throws(() => def.execute({ spec: { blocks: [] } }), /non-empty array/)
})

test('output.render returns a content-block ARRAY (regression: content.some)', () => {
  const def = buildToolDefinition()
  const out = def.output.render({ spec }, { title: 'Plan', blocks: 1 })
  assert.ok(Array.isArray(out), 'render must return an array, not a string')
  assert.equal(out.length, 1)
  assert.equal(out[0].type, 'text')
  assert.equal(typeof out[0].text, 'string')
  assert.match(out[0].text, /Plan/)
})
