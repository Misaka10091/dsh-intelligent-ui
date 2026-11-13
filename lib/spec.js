/**
 * Pure spec validation for `intelligent_ui`. Kept framework-free so it can be
 * unit-tested without the DSH host (`@deepseek-ai/dsh-tools` only exists inside
 * the running Harness process).
 */

/**
 * Validate the model-supplied spec just enough that the Client never receives a
 * structure it cannot render. Returns a compact summary the tool reports back.
 * @param {unknown} spec
 * @returns {{ title: string, blocks: number }}
 */
export function inspectSpec(spec) {
  if (spec === null || typeof spec !== 'object' || Array.isArray(spec)) {
    throw new Error('intelligent_ui requires `spec` to be an object')
  }
  const blocks = /** @type {{ blocks?: unknown }} */ (spec).blocks
  if (!Array.isArray(blocks) || blocks.length === 0) {
    throw new Error('intelligent_ui requires `spec.blocks` to be a non-empty array')
  }
  const bad = blocks.find(
    (block) =>
      block === null ||
      typeof block !== 'object' ||
      typeof (/** @type {{ type?: unknown }} */ (block).type) !== 'string',
  )
  if (bad !== undefined) throw new Error('every block needs a string `type`')
  const rawTitle = /** @type {{ title?: unknown }} */ (spec).title
  return { title: typeof rawTitle === 'string' ? rawTitle : '', blocks: blocks.length }
}
