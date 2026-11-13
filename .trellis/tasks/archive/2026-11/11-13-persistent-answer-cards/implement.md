# Execution

- [x] Reproduce using the authorized Chrome CDP test tab and inspect hidden ancestors.
- [x] Verify turnTail and Chat snapshot contracts from the installed runtime.
- [x] Move the full answer card to the tail slot; keep compact process diagnostics.
- [x] Scope form handoff to the originating session; preserve existing DSL.
- [x] Add regression tests for completed/native/nested tool selection, failures, multiple turns and handoff.
- [x] Run npm run check and npm test.
- [x] Refresh test profile Client artifacts; restart only its managed job if required.
- [x] Browser-check the existing failed session: collapsed process, visible card, reload, navigation, expand/collapse, form submission.
- [x] Browser-check a new minimal intelligent_ui turn through completion.
- [x] Capture a painted card screenshot and update README/spec and task outcomes.

Rollback: restore old Client entry and manifest if activation fails; never patch app.asar or overwrite a profile composition.

## Verification outcome (2026-11-13)

- Release metadata: 0.1.1, installed API verified on DSH 0.2.2-rc.1.
- npm run check: passed. npm test: 30/30 passed. npm pack --dry-run --json: 13 runtime/documentation entries, no test/browser artifacts.
- Original session (32b95e37): before fix, card was inside three hidden ancestors; after fix, visible=true, tail=true, hiddenAncestors=[], process aria-expanded=false. Reload, expand/collapse, navigation away/back and resolved form handoff passed.
- Fresh session (a533ef68): one intelligent_ui call; waited for turn/end, process collapsed, full answer remained visible. Full refresh passed. Chinese form submit produced exactly `请按紧凑节奏调整` and did not leak that draft into the original session.
- Final Chrome lifecycle run: no exceptions or console errors from the run. Historical console entries are excluded by their timestamps rather than mistaken for current failures.
- Screenshots: artifacts/persistent-answer.png and artifacts/fresh-completed-answer.png; visually inspected. Chrome left on the original reported session at its now-visible answer card.
- Independent review resolved stopped/interrupted-result filtering, transient source subscription recovery, malformed arguments and stale README bridge descriptions.
- Existing managed test job continues serving port 49513. No DSH core patch, ASAR mutation or production-profile configuration change was needed for this repair.
