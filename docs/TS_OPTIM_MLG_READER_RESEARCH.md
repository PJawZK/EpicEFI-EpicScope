# TS-Optim evidence bridge: original MLG reader — 2026-11-10

Research only, on EpicScope `ui/idle-analyzer-html-integration`, base `473c6fa199a43039271fcda8702b3fd98e10adf2`. No EpicScope runtime or numerical algorithm change. No vendor application execution, ECU interaction or vendor binary modification.

**Principal finding:** the original bundled reader uses a materially different time policy. It preserves a recorded field named exactly `Time`; only when that field is absent does it append a synthesized header-clock `Time`. Its header accumulator treats **any non-increasing** tick value, including equality, as a wrap. EpicScope currently derives its canonical timeline from header ticks using a **half-modulus** rollover test, even when recorded `Time` is present. These are confirmed static implementation differences, not a validated recommendation to replace one policy with the other.

## 1. What previous TS-Optim work establishes

Read first: [HANDOFF](https://github.com/PJawZK/TS-Optim/blob/972e5e6a8dda2c24e24ff39e57ca5e2d322315ce/docs/HANDOFF.md), [TS-COVERAGE](https://github.com/PJawZK/TS-Optim/blob/972e5e6a8dda2c24e24ff39e57ca5e2d322315ce/research/TS-COVERAGE.md), [TS-021](https://github.com/PJawZK/TS-Optim/blob/972e5e6a8dda2c24e24ff39e57ca5e2d322315ce/research/TS-021-ORIGINAL-WHOLE-DISTRIBUTION-PASS-A.md), [TS-022](https://github.com/PJawZK/TS-Optim/blob/972e5e6a8dda2c24e24ff39e57ca5e2d322315ce/research/TS-022-CRITICAL-OPERATION-PASS-B1.md).

TS-021 establishes original distribution identity and structural inventory: 17 JARs, 7,517 compiled classes, 51,694 declarations; main JAR 4,410 classes. `MegaLogViewer` is bundled in the main JAR even though a separate manifest-referenced MegaLogViewer JAR is absent. Its entrypoint survey is not reader behavior verification. TS-022 explicitly leaves the random-access/compressed candidates' actual `.mlg/.msl` ownership unresolved. `ak.aa`, `bI.a` and `G.bP` must not be selected as MLG owners just from read/compression references.

The reusable assets are SHA-pinned LFS inputs, `jvm_index.py`, targeted `javap` tools and evidence discipline. Full structural shard completion does not promote the logging subsystem to behavior-understood. Existing TS-Optim coverage/Gate 1 remains unchanged; no TS-Optim files were edited.

## 2. Verified inputs and inspection method

Actual separate research checkout: TS-Optim branch `setup/epicwolf-rea-foundation`, commit **`972e5e6a8dda2c24e24ff39e57ca5e2d322315ce`**. The branch advanced between initial remote discovery and cloning; the clone reflog pins the actual checkout used. Archive/main-JAR hashes were independently checked locally:

- Clean original archive: `4f4781a6ff90127ef36672cc43d3edc78c4f61ef682dca38a02f9e17e652517f`.
- Original `TunerStudioMS.jar`: `3ebafb867fef3722816e768879501845904f81bc5e13249c77d170e9adf61cf8`.

Only that clean distribution LFS object was retrieved. Installed-state/project archives were not downloaded. Only main/support JAR members were extracted into `/workspace/epicscope-ts-reader-research/vendor/`. Original source archives/JARs were never edited, repacked or committed.

JDK 21.0.12.1 `java -m jdk.jdeps/com.sun.tools.javap.Main -c -p -s` inspected class bytes without initializing/executing vendor classes. Private disassembly remains outside Git. Reviewed predicates include method descriptors, branch destinations, field writes, timestamp-call ordering, registration/factory dispatch and field decoder behavior—not just symbolic counts. [Provenance](reference/ts-mlg-reader-2026-11-10/PROVENANCE.json) pins 13 relevant class hashes. The accompanying verifier rechecks selected bytecode predicates; passing it is not a general semantic proof.

## 3. Entry point to actual reader ownership

| Boundary | Exact static evidence | Qualification |
|---|---|---|
| `MegaLogViewer.main([String])V` | constructs `ao.cd` at 1400; eligible command-line load invokes `ao.cd.a([String],boolean)` at 1556 | Startup branches/file eligibility exist; not every launch loads a file. |
| `ao.cd.<init>()V` | `h.b.a().a(String,String)` at 540–549 configures application readers/features | Configuration-dependent paths remain distinct; no edition/registration state altered. |
| `h.b.a(String,String)V` | registers `W.X.I`→`ak.ao` at 294–302, with additional configuration branches registering the same reader | `h.c.run` 308–316 and `h.d.run` 264–272 also register it. Registration evidence, not proof all paths execute. |
| `ao.cd.a([String],Z)V` | general log branch calls `ao.aX.a([String],Z)` at 189 | Earlier branches handle other file types. |
| `ao.aX.a([String],Z)V` | constructs data-loader thread `g.b` at 70–78 | Thread ownership, not acquisition/ECU ownership. |
| `g.b.b([String])LW/n;` | factory `W.W.a(File)` at 154–159; read schema `W.V.b()` at 459; row `W.V.c()` at 2176 | Symbolic base-type calls resolved through inspected registered reader. No broad runtime reachability claim. |
| `W.X.a(File)String` | `.mlg` suffix branch 78–90 returns `W.X.I` | Classifier is followed into factory, not mistaken for decoding. |
| `W.W.a(File)LW/V;` | classify 0–7, open returned reader at 16; `a(String)` obtains registered class and instantiates it at 55 | Dynamic registry is a limit; inspected application registrations supply `ak.ao`. |
| `ak.ao.a(String)Z` | reads file; verifies MLVLG magic at 81–145; reads version at 146–159 | This identifies actual binary MLG ownership rather than a name heuristic. |

The reader accepts versions up to 3 and selects 55/89-byte field descriptors based on version (open offsets 214–247). This pass does not establish all v3 behavior. EpicScope's supported v1/v2 semantics must not be expanded just from that limit check.

## 4. Verified decoding and clock behavior

### Header representation and resolution

`ak.ao.<init>()V` constructs two-byte arrays for type/counter and clock at offsets 60–71; initializes accumulator `p=0`, previous tick `q=-1` at 131–138. In `c()[F`, marker blocks read their clock and call `c(int)` at 173–178; type-0 data blocks call it at 237–242 **before checksum validation**.

The clock bytes are passed to `bH.c.a(byte[],int,int,boolean,boolean)` with big-endian/unsigned arguments. The helper's shift loop (55–102) and optional sign-extension branch (102–149) were inspected. This verifies unsigned 16-bit big-endian input in this call path.

`ak.ao.c(int)long`:

- Previous `q==-1`: accumulator zero, first tick establishes origin (0–13).
- Current > previous: branch 16–43 adds tick difference ×10 to accumulator.
- Current **<= previous**: branch at **21 `if_icmple 46`**, then 46–76 adds `(65536 + current − previous) ×10`.
- 79–88 stores previous tick and returns accumulated value.

`ak.ar.a(byte[])float` reads accumulator `p`, converts to float and divides by **1,000,000** (0–11). Thus the accumulator is in microseconds, and the header tick resolution is **10 µs = 0.01 ms**. There is no half-modulus test in this reviewed helper. Equality follows the wrap branch. This is confirmed instruction-level behavior, not evidence equality universally means a physical rollover.

### Existing `Time` field versus synthesized fallback

`ak.ao.b()Iterator` builds schema/converters, then tests for exact `Time` at 1073–1083. The helper `a(List,String)Z` uses `String.equals`. Presence branches directly to 1149, skipping synthesis. Absence appends a seconds-labeled `Time` descriptor and an `ak.ar` converter at 1086–1143. Existing fields use their payload converters; `ak.aq.a(byte[])F` uses `Float.intBitsToFloat` for the float case (67–78).

Therefore **stored `Time` is not replaced by the header accumulator at this reader boundary**. `g.b` resolves a mapped Time field at 2126–2172 and has additional Time handling/normalization at 2757–2798. It also has a preference-controlled `timeGapsOn` branch at 2808–3154. Field mappings, normalization, calculated fields, gap insertion and downstream chart-axis behavior were not fully audited. Do not equate reader output directly with a screenshot's displayed duration or prove a particular user's MLV preferences from these branches.

## 5. Counters, checksums and recovery boundaries

In `ak.ao.c()[F`, 47–127 compares expected byte counter with the observed byte, logs a mismatch and updates expectation from observation. Then 127–135 increments and narrows with `i2b`, giving ordinary modulo-256 rollover. A counter mismatch alone does not throw or establish missing measurements on this path. Both marker and data blocks traverse that check. This supports treating +22 startup patterns as observations rather than exact loss counts; it does not establish the writer's decimation/global-counter semantics.

Payload checksum loop 261–304 adds payload bytes modulo 256 and compares the stored checksum. This matches EpicScope's checksum arithmetic for standard records. The vendor calls it CRC, but it is an additive byte checksum, not an independently verified polynomial CRC.

On mismatch, 405–416 invokes `m()Z` resynchronization; success recursively reads another row. `m()` inspects consecutive candidate CRC/counter records with mark/reset and attempts three candidates; the original stream position and `j` accounting are separate from clock `p/q` state. This pass does not prove all resynchronization paths or exact row retention. If resynchronization returns false, the reviewed `c()` control flow falls through into conversion at 417; that is a static possible path, **not a claim this occurred for any supplied file**.

EpicScope instead retains original indices/offsets and invalid-attempt evidence with explicit CRC eligibility and retry classification. Byte-checksum equivalence is **not** equivalence of error recovery, retained rows, warnings or time accumulation through damaged input. Do not copy vendor resynchronization as an EpicScope fix.

## 6. Numerical comparison with EpicScope

EpicScope's fixed and general scanner paths in `core/parsers/mlg/mlg-records.ts` unwrap only a negative delta whose magnitude exceeds 32768 ticks; equal ticks add zero and smaller negative deltas remain canonical regressions. Its canonical sample times and time-range queries use that header-derived array. A recorded `Time` channel is exposed as data, not selected as canonical time authority. General-path marker handling also differs: it projects from current epoch with a nonnegative clamp and does not feed the marker tick back into the data-record previous-tick state.

| Raw transition | Reviewed reader header-helper step | EpicScope step | Status |
|---|---:|---:|---|
| 100→200 | +1.00 ms | +1.00 ms | Equivalent arithmetic |
| 65530→4 | +0.10 ms | +0.10 ms | Equivalent ordinary rollover |
| 38102→5876 (CHDL 49→50) | +333.10 ms | −322.26 ms | Confirmed rule difference |
| 100→100 | +655.36 ms | 0 ms | Confirmed equality difference; do not copy blindly |
| 40000→7232 | +327.68 ms | −327.68 ms | Exact half-modulus difference |
| 1→40001 | +400 ms | +400 ms | Equivalent forward arithmetic |

[Reference cases](reference/ts-mlg-reader-2026-11-10/NUMERICAL_REFERENCE_CASES.json) were independently checked as arithmetic. They are not vendor-runtime tests.

All three supplied logs have a first payload field `Time`, type 7, seconds, scale 1/transform 0. Their complete CRC-eligible decoded Time series have **zero backward steps**; equality is common (13,078 / 28,887 / 15,597 adjacent valid pairs respectively). These recorded equalities are distinct from equal *raw header ticks*. The observed Time sample count, exact float32 endpoints and descriptor metadata are retained in [recording comparison](reference/ts-mlg-reader-2026-11-10/RECORDING_COMPARISON.json).

| Complete recording | EpicScope canonical last ms | Recorded Time last−first, ms | Arithmetic model of reader header rule over indexed data records, ms |
|---|---:|---:|---:|
| CHDL | 769,102.13 | 780,886.969745 | 788,762.93 |
| October 25 | 2,272,475.84 | 2,274,393.066406 | 2,796,763.84 |
| November 1 | 1,449,624.35 | 1,449,581.054688 | 1,612,153.63 |

The last column includes a full wrap for equal raw ticks (12, 797, 248). It is a **header-only arithmetic model**, not a simulation of the complete reader: marker timing, resynchronization, skipped/repeated rows, loader normalization, float rounding and chart preferences can change actual outputs. It does not claim the original app displays those durations. The stored Time endpoints were decoded with EpicScope's existing channel decoder; the vendor's actual outputs were not executed/completely compared.

CHDL stored Time closely supports the prior all-*falling*-ticks rollover candidate (~780,898.61 ms), but its ~11.64 ms difference and independent channel update cadence remain to be explained. That correlation is stronger evidence than appearance of monotonicity alone. It does not justify replacing the timeline without a dedicated source-authority design and full-record numerical tests. November's close canonical/stored-Time agreement likewise does not prove the time policies are identical.

## 7. Established conclusions and next boundary

**Established:** original input/class identity; actual binary reader ownership; 16-bit unsigned big-endian header decoding; 10 µs tick; non-increasing helper branch; stored Time preservation/synthesis condition; counter mismatch handling and byte rollover; additive checksum arithmetic; materially different time-source policy from current EpicScope.

**Not established:** physical ECU clock truth, writer semantics for every counter advance, a universal interpretation of equal ticks, identical corruption/retry handling, actual end-to-end MLV chart duration/appearance, or equivalence with another separately released MegaLogViewer version. The findings concern the reader bundled in the exact original TunerStudio MS 3.3.01 distribution. No claim of vendor defects or TS-Optim whole-application semantic coverage is made.

The next justified investigation is **time-source authority**: compare complete stored Time and header histories by original index, including duplicates, invalid values, CRC/retry groups, marker blocks and reload/worker consumers; inspect mapped-Time/normalization consumers or perform an explicitly scoped offline original-reader replay if needed. Define fallback/ambiguity behavior for missing/unusable Time separately. Do not silently sort/reindex, replace validity, or implement the unconditional-wrap helper merely to mimic the bundled reader.

## 8. Reuse and validation

Run `python docs/reference/ts-mlg-reader-2026-11-10/verify_private_evidence.py ORIGINAL_JAR /absolute/private/output` with a JDK containing `jdk.jdeps`. It rejects the wrong JAR and output inside EpicScope, re-disassembles 13 pinned classes without vendor execution, and checks seven selected evidence predicates. Full disassembly stays private/outside Git. Only hashes, descriptors, offsets, factual numerical evidence and independently authored tooling are committed here; no archives, class files or decompiled vendor source.

Validation performed: archive/main-JAR SHA verification; 13 class hashes; seven selected pinned-bytecode checks; six arithmetic cases; complete-recording Time-channel comparisons; `git diff --check`; clean TS-Optim worktree. Research evidence/scripts are outside runtime imports. No full application build/browser rerun was needed for this documentation/research-only task; no runtime validation result is inferred from static inspection. Private work area: `/workspace/epicscope-ts-reader-research/`.
