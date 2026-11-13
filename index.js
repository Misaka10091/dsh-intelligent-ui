/**
 * dsh-intelligent-ui — Host half.
 *
 * Registers ONE model-facing tool, `intelligent_ui`. The model calls it with a
 * declarative component-tree `spec`; the Client renders the full answer in
 * `conversation.chat.turnTail`, outside the collapsible execution process.
 * The keyed `tool.call.toolview` slot retains a compact diagnostic row.
 *
 * Tool arguments and results already have a durable Session lifecycle. Reusing
 * the host's assembled tool-call model keeps cards replayable across reload and
 * fork without adding a custom Session event type or duplicating event folding.
 *
 * This file only touches the tools registry through `apply`; the DSH source is
 * never modified. The definition itself lives in `./lib/tool.js` (pure/testable).
 */

import { defineTool } from '@deepseek-ai/dsh-tools'
import { buildToolDefinition } from './lib/tool.js'

/** Stable Loader identity (must match cordis.patch.yml row `name`). */
export const name = 'dsh-intelligent-ui'

/** Services required before mounting. */
export const inject = ['tools']

/**
 * Host plugin entry point.
 * @param {import('@deepseek-ai/cordis').Context} ctx
 */
export function apply(ctx) {
  ctx.tools.register(defineTool(buildToolDefinition()))
}
