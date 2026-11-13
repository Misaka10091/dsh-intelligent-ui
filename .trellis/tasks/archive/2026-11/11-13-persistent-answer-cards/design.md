# Design: persistent answer cards

## Boundary

The behavior gap is placement: a business tool renderer is inside the host's process disclosure and therefore cannot own a persistent answer. The card renderer and DSL need no redesign.

Use `conversation.chat.turnTail`, a session-scoped list outside the process group. Read the host's assembled tool blocks by turn through the existing Chat selector hook. Reuse its call/result pairing and recursive subCalls; do not reread event logs, scan DOM for data, or duplicate the tool reducer. Keep `tool.call.toolview` as a compact execution status/diagnostic row. Both surfaces share recorded call identity.

Expected edits: client.js (tail selector, compact tool row, shared card body and session-bound composer callback); package.json (declare Chat client dependency); tests (exercise slot dispatch/turn selectors with settled, pending, failed and nested tool blocks); README.md (document placement, truthful plugin boundary and browser verification). Core modules and installed ASAR remain untouched unless source inspection proves the slot lacks required data.

## State and lifecycle

The host owns Conversation snapshots and turn locations. Successful settled intelligent_ui calls produce one card each, keyed by callId, in recorded order. Running/preparing/failed calls remain execution diagnostics. Existing completed sessions use the same data as fresh calls, including after reload. A mounted tail card owns local form/calculator state. Composer handoff must carry the originating session identity or use the tail's own standard inputActions, without a global unscoped event.

## Risks and rollout

Validate exact slot props from the installed version before implementation. Avoid taking card DOM existence as visibility evidence: inspect ancestors and element.checkVisibility({contentVisibilityAuto:true}) and a screenshot after completion. Check default process folding and refresh/session-switch lifecycles. Deploy only through the linked test bundle, restart only the managed test job if necessary. Rollback is restoring the previous client artifact/bundle version; logs and model inputs remain compatible.
