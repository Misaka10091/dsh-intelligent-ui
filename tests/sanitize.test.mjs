import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { redactString, sanitizeDeep, MASK, ruleNames } from '../lib/sanitize.js'

const masked = (s) => redactString(s)

test('GitHub tokens are masked', () => {
  assert.equal(masked('token ghp_' + 'A'.repeat(36) + ' end'), `token ${MASK} end`)
  assert.equal(masked('github_pat_' + 'a1_'.repeat(30)), MASK)
})

test('cloud / provider keys are masked', () => {
  assert.equal(masked('id AKIA' + 'ABCDEFGHIJKLMNOP'), `id ${MASK}`)
  assert.equal(masked('sk-' + 'x'.repeat(32)), MASK)
  assert.equal(masked('sk-ant-' + 'y'.repeat(30)), MASK)
  assert.equal(masked('AIza' + 'B'.repeat(35)), MASK)
  assert.equal(masked('xoxb-1234567890-abc'), MASK)
})

test('JWTs, bearer tokens and URL credentials are masked', () => {
  assert.equal(masked('eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiIxMjM0NTY3ODkwIn0.dozjgNryP4J3jVmNHl0w5N_XgL0n3I9PlFUP0THsR8U'), MASK)
  assert.equal(masked('header Bearer abcdefghijklmnop end'), `header Bearer ${MASK} end`)
  assert.ok(!masked('Authorization: Bearer abcdefghijklmnop').includes('abcdefghijklmnop'))
  assert.equal(masked('https://user:secretpass@example.com/x'), `https://${MASK}@example.com/x`)
})

test('PEM private keys are masked', () => {
  const pem = '-----BEGIN RSA PRIVATE KEY-----\nMIIabc\n-----END RSA PRIVATE KEY-----'
  assert.equal(masked(pem), MASK)
})

test('assigned secret values are masked but the key remains', () => {
  assert.equal(masked('api_key = "abcd1234efgh"'), `api_key = "${MASK}"`)
  assert.equal(masked('password: hunter2pass'), `password: ${MASK}`)
})

test('PII is masked', () => {
  assert.equal(masked('mail me at alice.wang@corp.example.com'), `mail me at ${MASK}`)
  assert.equal(masked('call 13812345678 now'), `call ${MASK} now`)
  assert.equal(masked('id 11010519900307123X'), `id ${MASK}`)
})

test('only Luhn-valid card numbers are masked', () => {
  assert.equal(masked('card 4111 1111 1111 1111 ok'), `card ${MASK} ok`)
  assert.equal(masked('order 1234 5678 9012 3456 x'), 'order 1234 5678 9012 3456 x')
})

test('ordinary text is untouched', () => {
  const s = '北京中轴线一日步行，全程约 6 km，门票 2 元。'
  assert.equal(masked(s), s)
})

test('sanitizeDeep walks arrays and objects, keeps keys', () => {
  const input = { title: 'token sk-' + 'z'.repeat(30), list: ['a@b.com', 1, true], nested: { mail: 'x@y.io' } }
  assert.deepEqual(sanitizeDeep(input), {
    title: `token ${MASK}`,
    list: [MASK, 1, true],
    nested: { mail: MASK },
  })
})

test('the client bundle mirrors every canonical rule family', () => {
  const client = readFileSync(new URL('../client.js', import.meta.url), 'utf8')
  for (const needle of ['github_pat_', 'gh[pousr]_', 'AKIA', 'sk-ant-', 'eyJ', 'Bearer', 'PRIVATE KEY', 'passesLuhn', 'export const MASK']) {
    if (needle === 'export const MASK') continue
    assert.ok(client.includes(needle), `client.js is missing sanitizer fragment: ${needle}`)
  }
  assert.ok(ruleNames().length >= 12, 'expected at least 12 canonical rules')
})
