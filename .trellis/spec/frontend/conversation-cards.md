# Conversation card contracts

## 1. Scope / trigger

Applies to generated UI cards that are part of an answer. Tool execution views belong to a collapsible process; they are not a persistent answer surface. Verified against installed DSH 0.2.2-rc.1. Do not silently advertise older runtime compatibility without testing it.

## 2. Signatures

- Register execution status at `ctx.slots.register({name: 'tool.call.toolview', key: 'intelligent_ui'}, ToolStatus)`.
- Register the answer at `ctx.slots.register({name: 'conversation.chat.turnTail', id: 'dsh-intelligent-ui-answer'}, Answer)` through `ctx.slots.inject`.
- Tail owner props: `{turn, seq, openFile}`. `turn` is an object; `turn.turn` is its numeric identity. Session-standard props supply selector hooks and inputActions.
- Chat data: `snapshot.locations.getTurn(turnNo)` returns node keys, `snapshot.nodes.get(key)` reads a node, and tool-call nodes carry `{root}` in `node.data`.
- Alternative per-turn source: `snapshot.nodes.turnDataSource(turnNo, 'tool-call')` yields arrays of `{root}` data. A plugin-defined keyed hook must receive `String(turn.turn)` as its key.

## 3. Contracts

The host owns call/result pairing, transient settlement, process folding, history and nested PTC topology. Consume assembled blocks; do not independently refold events or scan another plugin's DOM to obtain application state.

A successful settled block has `kind: 'tool-result'`, `isError !== true`, the tool name, `callId`, and recorded arguments in `call.argsRaw`. `subCalls` contains nested calls using the same lifecycle contract. Calls without their argument event can have `call: null`; do not fabricate a spec. Preserve call order, deduplicate by callId, and key card elements by callId.

Full cards live only in the turn-tail; process views show compact status, preventing two independent forms for one call. Form handoff uses its own Session-scoped `inputActions.setDraft(text)`; do not broadcast unscoped window events or silently replace a missing writer with apparent success.

## 4. Validation and error matrix

| Input / lifecycle | Answer behavior |
| --- | --- |
| Preparing or running call | Status only; no successful answer |
| Settled success with valid spec | One answer card in originating Turn |
| Failed or interrupted result | Execution diagnostic; no successful card |
| Missing/malformed spec arguments | Skip or explicit unavailable state; never crash the slot |
| Nested successful call beneath a failed parent | Determine the child by its own result, not the parent's status |
| Process expanded/collapsed | Same single answer card |
| Missing composer writer | Explicit feedback and a deliberate fallback action |

## 5. Good / base / bad cases

- Base: one native call, one completed turn, collapsed process and a painted answer.
- Good: several turns, repeated titles and nested calls, restored by reload and Session navigation without model regeneration.
- Bad: DOM count is positive while ancestors use `hidden="until-found"`; this is the reported failure, not a successful render.

## 6. Required tests

Exercise successful, pending, failed, unavailable and nested tool blocks; per-turn selection; callId deduplication; compact process output; and form handoff success/failure. Browser acceptance waits for turn completion, leaves the process collapsed, reloads, navigates away/back, expands/collapses, and verifies the originating composer. Assert painted visibility and inspect a screenshot; DOM count alone is insufficient. Local form edits are not persisted across reload unless a separate state persistence feature is explicitly added.

## 7. Wrong vs correct

Wrong: render the entire interactive answer only in `tool.call.toolview`, then declare success as soon as `querySelectorAll('[data-dsh-intelligent-ui]').length > 0`.

Correct: render full cards in `conversation.chat.turnTail`, preserve compact tool diagnostics, and verify after completion:

```js
const card = document.querySelector('[data-slot="conversation.chat.turnTail"] [data-dsh-intelligent-ui]')
if (!card?.checkVisibility({contentVisibilityAuto: true})) throw new Error('answer is hidden')
for (let node = card; node; node = node.parentElement) {
  if (node.hidden) throw new Error('answer is inside a hidden ancestor')
}
```

## Why earlier fixes were insufficient

The initial Host fix corrected `output.render` from a string to a content-block array, but this did not change placement. A subsequent browser probe stopped when a card first appeared during generation and read an old hidden card as success. Both cross-layer placement and the completed/reloaded lifecycle must be verified. Keep temporary source extracts in system temporary storage; Trellis contains only task artifacts and reusable project specifications.
