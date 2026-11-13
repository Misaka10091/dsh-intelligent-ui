import { test } from 'node:test'
import assert from 'node:assert/strict'
import { inspectSpec } from '../lib/spec.js'

test('accepts a minimal spec and reports block count', () => {
  assert.deepEqual(inspectSpec({ title: 'Hi', blocks: [{ type: 'text', text: 'x' }] }), { title: 'Hi', blocks: 1 })
})

test('rejects non-object spec', () => {
  assert.throws(() => inspectSpec(null), /object/)
  assert.throws(() => inspectSpec([]), /object/)
})

test('rejects empty or missing blocks', () => {
  assert.throws(() => inspectSpec({}), /non-empty array/)
  assert.throws(() => inspectSpec({ blocks: [] }), /non-empty array/)
})

test('rejects a block without a string type', () => {
  assert.throws(() => inspectSpec({ blocks: [{ type: 3 }] }), /string `type`/)
})
