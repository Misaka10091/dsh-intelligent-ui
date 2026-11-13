/**
 * Pure `intelligent_ui` tool definition — no DSH imports so it can be unit-tested.
 * `index.js` wraps this with the host's `defineTool` factory.
 */
import { inspectSpec } from './spec.js'

export const SPEC_DESCRIPTION = [
  'A declarative UI component tree rendered as an interactive card in the chat.',
  'Shape: { version: 1, title?: string, subtitle?: string, meta?: Pill[], blocks: Block[] }.',
  'Supported block types (each an object with a "type" field):',
  '  • "heading" { title, subtitle? }',
  '  • "text" { text }  — plain text; blank lines separate paragraphs.',
  '  • "meta" { items: [{ icon?, text, tone? }] }  — small info pills.',
  '  • "map" { center?: [lat,lng], zoom?, markers?: [{ id?, label, lat, lng, tone? }], route?: [[lat,lng], ...] }',
  '      Drawn as a self-contained schematic map (no network tiles).',
  '  • "timeline" { items: [{ time, title, desc?, tag? }] }',
  '  • "gallery" { items: [{ src, title?, caption? }] }  — images; graceful fallback if a URL fails.',
  '  • "table" { columns: string[], rows: (string|number)[][], caption? }',
  '  • "chart" { kind: "bar"|"line"|"pie", labels: string[], series: number[] | { name, values }[], unit? }',
  '  • "calculator" { label?, min, max, step?, value, unit?, formula }',
  '      A local slider that recomputes `formula` on the fly with NO model call.',
  '      `formula` is a tiny arithmetic expression over `v` (the slider value),',
  '      e.g. "v * 0.75" or "v * 12". Only numbers and + - * / ( ) are allowed.',
  '  • "form" { id?, title?, description?, fields: Field[], submitLabel?, submitTemplate? }',
  '      Field: { type: "segmented"|"radioCards"|"select"|"checkbox"|"slider"|"time"|"text"|"textarea",',
  '               name, label, value?, options?: [{ value, label, desc? }], min?, max?, step?, placeholder?, multiple? }',
  '      Interactions update local state only. Clicking submit composes a message from',
  '      `submitTemplate` (use {{name}} placeholders; omit it for an auto summary) and',
  '      places it in the user’s composer so the user can send it back to you.',
  'Keep blocks focused and readable; prefer 3-8 blocks. Use real content (place names,',
  'times, prices, photo URLs) rather than placeholder text. Do not put secrets in specs.',
].join('\n')

/**
 * Build the plain tool definition object.
 *
 * IMPORTANT: `output.render` MUST return an ARRAY of content blocks
 * (`[{ type: 'text', text: … }]`). Returning a bare string makes the host tool
 * pipeline throw `content.some is not a function`, no `tool/result` is recorded,
 * and the client card never receives a settled block to render.
 * @returns {object}
 */
export function buildToolDefinition() {
  return {
    name: 'intelligent_ui',
    description:
      'Render an interactive answer as a UI card in the chat instead of long Markdown. ' +
      'Use it for plans, itineraries, comparisons, dashboards, forms, quizzes or anything a user ' +
      'should scan or change rather than read. After calling it, keep your prose to one or two ' +
      'sentences; put the details in the card rather than restating them in Markdown.\n\n' +
      SPEC_DESCRIPTION,
    parameters: {
      spec: {
        type: 'json',
        required: true,
        description: 'The component tree. See the tool description for the full block schema.',
      },
    },
    output: {
      schema: {
        type: 'object',
        additionalProperties: false,
        properties: {
          title: { type: 'string', required: true },
          blocks: { type: 'integer', required: true },
        },
      },
      render: (_args, value) => [
        {
          type: 'text',
          text: `Rendered an interactive UI card${value.title ? `: ${value.title}` : ''} (${value.blocks} blocks).`,
        },
      ],
    },
    execute(args) {
      return inspectSpec(args.spec)
    },
  }
}
