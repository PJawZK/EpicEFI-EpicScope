# Native Idle Stability — region-management checkpoint

Continues `ui/idle-analyzer-html-integration` from `da2337c7202ac36c63c5ed3c28bf9b78e7e181e9`. Implements the approved bounded next workflow from the frozen HTML: native region management, inclusion/exclusion, independent graph focus, and union analysis. No other diagnostic modes, tune changes, main merge, HTML modifications, new framework, observers or global event listeners.

## Accepted behavior

- **Manage regions** opens a scoped native dialog. Discovered candidates and manual intervals share one typed source-bound list, limited to200 regions. Names and bounds can be edited with Apply; invalid/empty/nonfinite/reversed/out-of-source edits leave previous definitions/results intact. Delete, Include all and Exclude all are available.
- Newly discovered candidates start **excluded**, requiring review. Rediscovery adds distinct recorded bounds without overwriting previous edits or inclusion choices. Existing rows remain snapshots of explicitly selected intervals; changing discovery settings does not silently requalify them. The discovery cap/total count remain explicit.
- The existing Channels / region → **Use manual region** action now creates the same managed definition. Its Manual region scope references that region ID, so manager edits update its bounds; there is no second detached manual-range owner.
- **Analysis scope → Included regions** explicitly enables combined analysis. Full Log, Current A/B, Logger saved ranges and explicit Manual region remain independent scope choices. Inclusion checkboxes affect the Included regions scope; they do not filter Full Log silently.
- **View** and manager/marker View actions change graph focus only. An excluded region can be inspected while metrics still describe included regions. The recorded-window card and assessment label that distinction. Per-view graph pan/zoom/Fit and trace toggles remain presentation-only.
- Included regions are green, excluded regions gray/dashed, and the viewed region has a blue outline on the existing source timeline. Markers are actual source-time bounds, not fabricated events. Marker click/keyboard activation views that interval. **Shift-drag** selects Logger A/B through the existing shared gesture owner; handles retain existing editing behavior. In Included regions mode, a committed Logger drag changes the viewed A/B, preserving included definitions and union metrics.
- **↗ Logger** opens the viewed bounds through the current source-bound `openRangeInLogger`. Graph focus alone does not secretly rewrite Logger A/B. No second Logger or saved-range store is introduced.
- Empty inclusion is explicit zero samples / unavailable statistics. It never falls back to Full Log. Deleting the final managed Manual region leaves an empty included scope instead of silently analyzing everything.

## Owners and retained data

| Concern | Owner |
|---|---|
| Canonical recording, parser/worker, catalog, original indices, bytes/storage, accepted A/B and navigation | Existing Logger/context/source pipeline, unchanged |
| Source-bound region definitions and inclusion | `idle-region-session.ts`; no recorded arrays or persistence |
| Dialog and explicit draft acceptance | `idle-region-manager.ts`, scoped delegated handlers and native dialog keyboard behavior |
| Source/context generation, retained evidence and result authority | Existing `idle-analyzer-view.ts` boundary |
| Inclusive interval union and membership | `core/analysis/idle-regions.ts` + existing `analyzeIdleStability` |
| Stability mathematics | Existing `analyzeIdle`, aggregators and tracking; sample sigma/error conventions unchanged |
| Focused graph data | Existing plot/viewport helpers; `sliceNumericRangeByTime` makes zero-copy typed-array views retaining source indices/validity |

A managed workflow retains one source-bound full-channel batch (references to existing returned numeric ranges, not another raw-log store). An already accepted full batch is reused. Union inclusion/bounds changes calculate once over that batch; no full source read/analysis per region. A purely presentational focus/name change or unchanged union does not recalculate Stability. Creating excluded candidates while Full Log is accepted retains its analysis. Full retained batches are keyed by source identity/revision, captured sample count, catalog and selected roles; partial coverage is not promoted to full retained evidence.

Changing source identity or data revision retires definitions, cached evidence, focus and pending work. Catalog/role changes invalidate channel evidence. Same-source navigation retains the list, focus and accepted metrics; hidden views defer work, reject stale completions and close the modal so it cannot cover another domain. Old completion cannot install an earlier inclusion set after a newer edit. Saved region restoration across reload is not implemented in this stage.

## Numerical contract and independent references

Included bounds are validated, sorted and merged **only where overlapping/touching**. Gaps remain excluded. Each original recorded sample is considered once, with binary membership lookup against the normalized interval union. Inclusive endpoints do not duplicate shared samples. Invalid original records inside the union remain invalid evidence. No interpolation, invented samples, time weighting, confidence or idle qualification is introduced.

Reference case at100ms cadence: RPM `[900,1000,1100,2000,900,1000]`, target1000, regions0–100ms,100–200ms,400–500ms. The union selects original indices0,1,2,4,5, excluding the2,000RPM intervening sample. Expected:5 samples, mean980RPM, sample sigma√7000RPM, RMSE√6000RPM and40% within±40RPM. Empty regions select zero. An independent320,459sample case with overlap plus a disjoint gap selects270,460 unique samples without spreading or double counting.

## Validation and real-browser evidence

- `npm run build`: passed (TypeScript and production Vite bundle). Existing >500kB chunk warning remains.
- `npm test -- --maxWorkers=1`: **1,039 tests /145 files passed**.
- Focused staged/fallback Chromium: **166 checks /14 groups passed**.
- `CHROME_NO_SANDBOX=1 BROWSER_RESULTS_DIR=/workspace/epicscope-idle-native-stage4/full-browser npm run test:browser`: **1,517 checks /168 groups passed**, including22 Idle checks per worker configuration. Brush code/assertions unchanged.
- Coverage includes overlap/gap math, explicitly empty inclusion, >320k samples, manual-control/manager ownership, invalid edits, inclusion metadata when the union is unchanged, excluded graph focus, retained reads, source revision replacement, obsolete async completion, hidden modal retirement, and Logger A/B drag preserving union analysis.
- Five frozen HTML hashes, checkpoint links and `git diff --check` verified.

Artifacts stay outside Git under `/workspace/epicscope-idle-native-stage4/`; private INI/MLG bytes are not committed.

Final built-app Chromium smoke with the supplied INI and real October25 recording prefix passed:

- INI accepted with2,539catalog channels and4existing diagnostic issues; canonical RPM/target/controller mappings resolved.
- Full source:2,000indexed records /1,995trusted RPM-target pairs; sigma18.72RPM and RMSE18.76RPM unchanged.
- Included manual intervals5–10s and8–15s produce one5–15s union with**810 unique valid pairs**. Including the overlapping full-source candidate restores exactly1,995samples; excluding all produces zero. Restoring just those two manual regions restores810.
- Viewing the excluded full-source candidate keeps the810sample union and explicitly labels the viewed interval excluded. Source-time markers display all three real definitions.
- Native Shift-drag selects Logger A/B5.073–20.292s with1,258valid pairs; preview leaves metrics unchanged. Wheel/pan/Home and original-index hover remain functional.
- Shared shell remains exactly one header/footer with unchanged colors. No uncaught browser exceptions. At390px the document remains390px wide; the native manager fits12–378px (366px) and its800px table scrolls internally in348px. Native Escape closes it.
- Desktop manager/workspace and live-resized narrow manager screenshots inspected. Artifacts: `production-with-ini/{result.json,manager.png,regions.png,manager-narrow.png,narrow.png}`.

Initial focused Chromium checks passed in both staged and fallback configurations. One subsequent browser retry hit a DevTools startup connection timeout before any test module ran; the unchanged retry is recorded separately from successful gates. An intermediate typecheck caught an optional retained-evidence narrowing error; the guard was corrected before final build/validation.

## Remaining scope / manual acceptance

This is the region-management checkpoint, not complete HTML parity. Purpose tags, split/merge controls, multiple-recording comparison, persistence/restoration, throttle/temperature/load qualification, additional modes and test plans remain deferred. Region bounds remain read-only recording selections; no tune table or ECU writes are exposed. Full-log hardware/performance validation on the user's October21 recording is not replaced by the smaller October25 prefix.

Review the preview commit before testing: create/edit overlapping and disjoint regions, toggle inclusion, view an excluded interval, verify combined metrics and empty selection, use Shift-drag/handles and ↗ Logger, then navigate through Logger/VE and back. Test dialog keyboard/narrow layout and source replacement. Stop for manual acceptance before the next phase or any main merge.
