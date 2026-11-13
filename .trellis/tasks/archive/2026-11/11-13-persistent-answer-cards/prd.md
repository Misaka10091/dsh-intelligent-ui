# Persistent intelligent UI answers

## Goal

Keep successfully generated intelligent UI cards visible in the conversation after a turn completes, with its execution process collapsed, and after reloading or returning to the session.

## Requirements

- Render the answer independently of the collapsible tool execution process.
- Reuse recorded, successful intelligent_ui calls and the host's existing conversation model; recover existing cards without model regeneration.
- Preserve native tool diagnostics, per-turn placement, session isolation and form-to-composer handoff.
- Use supported bundle/slot extension points. If a core change is necessary, isolate it as a reviewable patch; do not modify the installed ASAR.
- Keep browser probes and extracted dependencies in system temporary storage, outside Trellis metadata.

## Acceptance criteria

- [x] Reproduce the report and distinguish DOM presence from painted visibility through ancestors.
- [x] An existing completed session displays its card while the process header remains collapsed.
- [x] Refresh and session navigation restore the same card without another model call.
- [x] Expanding/collapsing the process does not hide the answer card or produce a second full card.
- [x] Multiple turns and nested tool calls retain correct placement; failed/pending tools are not presented as successful answers.
- [x] Form selections remain local; explicit submission fills only the originating session's composer with resolved text.
- [x] A fresh tool call remains visible after its turn completes.
- [x] Syntax, regression tests and browser screenshot/visibility checks pass.

## Evidence

Chrome CDP on the test profile, 2026-11-13: `.dsh-iui-card` exists but ancestors at the process root/body and tool flow row have `hidden="until-found"` and zero height. The completed process header has `aria-expanded="false"`. The tail slot is outside that process.
