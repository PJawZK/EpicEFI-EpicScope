# Idle Stability — scope authority and discovery feedback checkpoint

Continues `ui/idle-analyzer-html-integration` from `17bfb857a8e1112108b9af53e9fad6dcbf3f65ac`, following an action-based investigation with native Chromium controls. Scope: correct the demonstrated workflow ambiguity and understated/misleading discovery feedback. No numerical, source ownership, persistence, worker, tune-writing, diagnostic-rule or comparison changes.

## Changed behavior

- A strip immediately above the metric cards explicitly states **Metrics: Full Log**, a selected Logger/manual scope, or **Metrics: Combined included regions(N)**. Checked regions that are not the current scope are explicitly marked **not applied to these metrics**.
- A nearby **Analyze included regions** action uses the existing region manager's apply operation. It does not silently change scope when a checkbox is checked and does not add a second analysis owner.
- The region manager states the current metric scope and whether its checked definitions are applied. Its existing analyze action remains available, including explicit empty inclusion.
- **View** is labeled **Graph focus**. A note above the graph states the focused interval, its included/excluded status and the metric scope. Combined overview explicitly explains that it spans intervals and intervening gaps while gap samples are excluded from metrics. No extra graph transformation or fabricated masking is added.
- Discovery has a visible inline result area below the toolbar and a **Review candidates** action opening the existing native manager. It reports found count, new excluded definitions added and retained inclusion choices; the existing bounded-list limit remains explicit.
- Zero matches say **No candidates match these settings**, suggest a higher ceiling/shorter duration, and explicitly preserve managed definitions. They no longer claim that new excluded regions were added. Discovery settings changes mark suggestions pending refresh. The manager labels candidate rows conceptually as retained snapshots, not current qualification.
- Discovery progress/results/errors now use their own feedback area. Successful discovery and zero matches do not replace analytical readiness in the assessment header. Retired/hidden completions continue to be rejected by the existing generation boundary.

Only Idle's current view, scoped manager and scoped CSS are changed. Existing Logger source/navigation authority, union membership, sigma/RMSE conventions, role mapping, graph LOD and retained full-batch behavior remain unchanged. No new observers, global listeners or generic instrumentation.

## Reproduced behavior and acceptance evidence

The prior read-only native-action investigation found that checking two regions while Full Log remained selected left1,995 samples on screen; explicit included analysis selected771 samples. That was a workflow ambiguity, not a reproduced one-region union-calculation defect. Candidate results were only bottom text/dropdown, and zero matches still claimed new excluded regions.

Final built-app native mouse/keyboard actions (visible EpicScope menu, native selects, actual field typing and button clicks) used the supplied INI and October25 real MLG prefix:

- The INI loaded2,539catalog channels with4existing diagnostics. The prefix contains2,000indexed /1,995trusted RPM-target pairs.
- Manual0–5s and15–20s intervals are visibly marked not applied while Full Log remains active. The new action beside the metrics applies them, producing **771** valid union samples.
- Viewing either interval leaves **771**; excluding the first gives **434**, restoring it returns **771**. All regions including the full-source candidate give **1,995**, and excluding all gives **0**. Existing union semantics are preserved.
- Find candidates at1,200RPM/8s reports one candidate and exposes Review; native Review opens the existing manager. At500RPM it reports zero, hides Review, preserves managed snapshots and leaves analytical status **Recorded evidence**.
- The top metric authority and graph-focus explanation agree with actual scope at each step. Assessment paragraphs remain the existing descriptive Stability content; data-driven diagnostic/tuning suggestions are not claimed implemented.
- Existing Diagnostics Performance and Timeline UI were opened after union and each graph-focus change. Retained `idle.stability.request` count stayed at**2**, accepted count at**2**, and each captured physical-read counter stayed unchanged (ordered report counters1,1,1,0; overlapping layers must not be summed). No application instrumentation was added.
- Successful native desktop sequence recorded no uncaught browser exceptions. Screenshots and structured per-action state are retained outside Git.

## Validation

- `npm run build`: passed (TypeScript + production Vite bundle); existing >500kB bundle warning remains.
- `npm test -- --maxWorkers=1`: **1,039 tests /145 files passed**.
- Focused staged/fallback Chromium: **166 checks /14 groups passed**.
- `CHROME_NO_SANDBOX=1 BROWSER_RESULTS_DIR=/workspace/epicscope-idle-feedback/full-browser npm run test:browser`: **1,517 checks /168 groups passed**, including22 Idle checks in each worker configuration. Existing Brush behavior/assertions unchanged.
- Native390px production actions passed: visible Review opened the manager, two manually entered intervals produced771combined samples, native Escape closed it, and document scrollWidth remained390px. Narrow feedback screenshot inspected.
- Five frozen HTML hashes, documentation links and `git diff --check` verified.
- Native desktop production actions and existing Diagnostics snapshots passed with zero uncaught browser exceptions. The visible Review and metric-strip apply controls were used, not direct application-handler invocation.

Browser artifacts/scripts and private-source evidence are outside Git under `/workspace/epicscope-idle-feedback/`; the source recording/INI are not committed.

Focused regression coverage checks: unapplied versus combined scope labels, the new explicit apply action, overview gap explanation, excluded graph focus versus metric scope, review opening the existing manager, truthful zero matches, retained snapshots, analytical status preservation and existing stale-source/hidden-completion rules. Existing Logger/VE/Brush boundaries remain covered by the full browser gate.

## Remaining boundary

This checkpoint completes the agreed scope/discovery feedback correction. Qualified data-dependent Stability findings/next-test logic, warm/throttle qualification, remaining HTML diagnostic modes, split/merge/purpose tags, persistence and two-recording comparison remain separate stages. Current A/B still means Logger bounds inside one recording. No automatic tuning advice, tune changes, ECU writes or Burn.

The user's complete October21 recording remains unavailable here; the real prefix and native controls provide workflow evidence, not a full-log hardware benchmark. Review the updated preview's scope strip, apply action, graph-focus explanation and discovery outcomes before the next feature stage. No main merge.
