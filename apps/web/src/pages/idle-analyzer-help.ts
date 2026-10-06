interface HelpEntry {
  readonly title: string;
  readonly text: string;
}

const CONTROL_HELP: readonly [RegExp, HelpEntry][] = [
  [/^Idle system$/i, { title: 'Idle system', text: 'Chooses which idle-control layer to focus on. Combined shows every available layer. RPM Control is the outer loop that decides requested idle-air position. DC Valve Control is the inner position loop that makes the physical DC valve follow that request. IAC, ETB and Ignition isolate those actuator/helper paths.' }],
  [/^RPM(?: · Engine)?$/i, { title: 'RPM', text: 'Measured engine speed. This is the actual value compared with Idle target. For idle quality, use RPM error, sag depth and recovery metrics rather than RPM mean alone.' }],
  [/^Idle target(?: · Engine)?$/i, { title: 'Idle target', text: 'The RPM target requested by the ECU. RPM error is calculated as actual RPM minus this target, so negative error means the engine is below target.' }],
  [/^Base idle position/i, { title: 'Base idle position', text: 'Outer-loop feed-forward/base airflow request before closed-loop idle correction is added. If closed-loop correction stays strongly biased at steady idle, this base calibration is usually the first place to investigate.' }],
  [/^Closed-loop correction/i, { title: 'Closed-loop correction', text: 'Correction produced by the outer idle RPM controller. A persistent non-zero correction indicates the base airflow request is not carrying the engine at target by itself. Mean absolute and RMS values show controller workload without positive/negative action cancelling out.' }],
  [/^Final idle position/i, { title: 'Final idle position', text: 'Final requested idle-air position after base request and idle corrections are combined. This becomes the actuator target used by the selected idle-air hardware path.' }],
  [/^P term/i, { title: 'RPM-control P term', text: 'Proportional correction from current RPM error. It reacts immediately to how far RPM is from target. Large P activity means the controller is correcting substantial instantaneous error; too much can create oscillation.' }],
  [/^I term/i, { title: 'RPM-control I term', text: 'Integral correction accumulated from persistent RPM error. Its signed mean is especially useful: a sustained positive or negative value indicates the controller repeatedly needs the same correction, often pointing to base airflow/feed-forward bias.' }],
  [/^D term/i, { title: 'RPM-control D term', text: 'Derivative correction based on how rapidly the error is changing. It is mainly transient damping, so its signed mean is not very informative. Mean absolute or RMS effort is more useful for judging how active it is.' }],
  [/^Valve target/i, { title: 'DC valve target', text: 'Requested physical DC idle-valve position. This is the command the inner valve-position controller tries to follow. Compare it with Valve position to decide whether an idle problem originates in the outer RPM loop or the valve/actuator loop.' }],
  [/^Valve position/i, { title: 'DC valve position', text: 'Measured physical valve position feedback. Good tracking means it follows Valve target closely. Large lag or error while the target moves correctly points toward DC valve PID, bias/feed-forward, wiring, mechanics or actuator limits.' }],
  [/^DC Bias \/ feed-forward/i, { title: 'DC Bias / feed-forward', text: 'Runtime feed-forward motor effort from the DC idle bias curve. In DC_IdleValve mode the firmware evaluates dcIdleBiasBins/dcIdleBiasValues at dcIdleTarget and exposes the result through etbFeedForward. It is the baseline effort before position PID correction.' }],
  [/^Position P term/i, { title: 'DC position P term', text: 'Proportional term of the inner DC valve position controller. It reacts to current valve target-versus-position error, not engine RPM error.' }],
  [/^Position I term/i, { title: 'DC position I term', text: 'Integral term of the DC valve position controller. A persistent signed I correction while valve tracking eventually succeeds is strong evidence that the DC Bias/feed-forward curve is under- or over-driving the motor in that position range.' }],
  [/^Position D term/i, { title: 'DC position D term', text: 'Derivative term of the DC valve position controller. It mainly damps rapid position-error changes. Judge it by transient/absolute activity rather than signed mean.' }],
  [/^Position-controller output/i, { title: 'DC position-controller output', text: 'Final output of the inner DC valve position controller. Mean gives the operating effort; RMS emphasizes larger excursions. Compare it with DC Bias and DC PID terms to see how much correction is being added around feed-forward.' }],
  [/^IAC valve duty/i, { title: 'IAC valve duty', text: 'Idle-air valve command/duty where available. Use it to check actuator demand and possible headroom/saturation during sag and recovery.' }],
  [/^ETB idle target/i, { title: 'ETB idle target', text: 'Electronic-throttle target including idle contribution. Compare with ETB position to see whether the throttle actuator follows the idle request.' }],
  [/^ETB position/i, { title: 'ETB position', text: 'Measured electronic-throttle position. Tracking error versus ETB target identifies actuator-following problems separately from the outer idle controller.' }],
  [/^ETB idle contribution/i, { title: 'ETB idle contribution', text: 'Idle-specific electronic-throttle contribution. This shows how much of the final throttle request is being supplied by the idle-control path.' }],
  [/^Ignition advance/i, { title: 'Ignition advance', text: 'Actual ignition advance during the analyzed idle events. Spark can be used as a fast idle torque actuator, so timing movement around sag/recovery can explain RPM response even when airflow changes little.' }],
  [/^Idle ignition correction/i, { title: 'Idle ignition correction', text: 'Idle-specific spark correction where logged. Use it to see how much fast torque correction the ignition helper contributes during RPM disturbances.' }],
  [/^Scope$/i, { title: 'Scope', text: 'Selects which part of the log is analyzed. Full log uses every decoded sample; saved/ranged scopes restrict all metrics and detected events to that source interval.' }],
  [/^Sag threshold RPM$/i, { title: 'Sag threshold RPM', text: 'Defines when a low-RPM event begins. With 100 RPM, an event starts when actual RPM is at least 100 RPM below Idle target. Raise it to detect only larger disturbances; lower it to include smaller dips.' }],
  [/^Settled band RPM$/i, { title: 'Settled band RPM', text: 'Defines recovery. Recovery is complete when RPM returns within ± this many RPM of target. A smaller band is stricter and usually produces longer recovery times.' }],
];

const SUMMARY_HELP: Readonly<Record<string, HelpEntry>> = {
  'Idle system': { title: 'Idle system', text: 'The currently selected controller layer used to choose which optional evidence channels are included.' },
  'Scope': { title: 'Scope', text: 'The log interval used for this result. Compare like-for-like scopes when judging tune changes.' },
  'Coverage': { title: 'Coverage', text: 'Complete means the required decoded evidence covers the selected scope. Partial decoded means at least one selected trace does not fully cover it, so interpret aggregates with that limitation in mind.' },
  'RPM mean': { title: 'RPM mean', text: 'Average measured RPM over the scope. Useful as operating-point context, but it can hide oscillation because high and low deviations cancel.' },
  'Target mean': { title: 'Target mean', text: 'Average commanded idle target over the scope. Mostly context for RPM tracking; it is not itself a quality score.' },
  'RPM error MAE / RMSE': { title: 'RPM error MAE / RMSE', text: 'MAE is the average absolute distance from target. RMSE weights large excursions more heavily. Lower is generally better; RMSE much larger than MAE indicates occasional large errors/sags rather than only small continuous error.' },
  'Worst sag': { title: 'Worst sag', text: 'Largest negative RPM error among detected sag events. More negative means a deeper drop below target.' },
  'Median recovery': { title: 'Median recovery', text: 'Median time from the end of the threshold-defined sag until RPM returns inside the Settled band. Median is used so one unusual event does not dominate the result.' },
  'Base / CL / final position': { title: 'Base / closed-loop / final position', text: 'Three outer-loop operating values shown together: base feed-forward request / closed-loop RPM correction / final requested idle-air position. A persistent CL value in one direction suggests the base request needs correction.' },
  'CL effort |mean| / RMS': { title: 'Closed-loop effort', text: '|mean| here is mean absolute correction, so positive and negative activity cannot cancel. RMS emphasizes larger corrections. Low values mean the base request is doing more of the steady work; high values mean closed-loop is working harder.' },
  'RPM PID |P| / |I| / |D|': { title: 'RPM PID mean absolute effort', text: 'Average absolute P/I/D contribution of the outer RPM controller. Use this to compare how much each term works without sign cancellation. It is a workload measure, not a direct good/bad score.' },
  'RPM PID RMS P / I / D': { title: 'RPM PID RMS effort', text: 'Root-mean-square P/I/D activity. RMS penalizes peaks more strongly than mean absolute effort, so it highlights aggressive or spiky controller action.' },
  'RPM I mean': { title: 'RPM I mean', text: 'Signed average integral correction in the outer RPM loop. Persistent non-zero I is particularly useful for diagnosing a base airflow/feed-forward bias.' },
  'DC target / position mean': { title: 'DC target / position mean', text: 'Average commanded and measured DC valve position. Similar means alone do not prove good tracking; use DC position MAE/RMSE for that.' },
  'DC position MAE / RMSE': { title: 'DC valve tracking MAE / RMSE', text: 'Error between actual valve position and dcIdleTarget. Lower is better. If RPM control is poor but these remain low, the valve is following commands and the problem is more likely in the outer RPM control request.' },
  'DC position error − / +': { title: 'DC valve maximum tracking error', text: 'Largest negative and positive position errors. Negative means actual valve position fell below target; positive means it exceeded target. Asymmetry can reveal opening-versus-closing response differences.' },
  'DC Bias mean': { title: 'DC Bias mean', text: 'Average runtime feed-forward motor effort from the DC Bias curve. It describes the operating region; by itself it does not tell whether the curve is correct. Judge it together with valve tracking and DC I/PID correction.' },
  'DC PID |P| / |I| / |D|': { title: 'DC position PID mean absolute effort', text: 'Average absolute inner position-controller corrections. Large sustained effort, especially I, means feed-forward/bias is not carrying enough of the motor load or the actuator is difficult to move.' },
  'DC I mean': { title: 'DC position I mean', text: 'Signed average inner-loop integral correction. This is one of the most useful DC Bias tuning indicators: persistent positive or negative I suggests the bias curve is respectively under- or over-driving the motor in that operating region.' },
  'DC output mean / RMS': { title: 'DC controller output mean / RMS', text: 'Average and RMS final inner-controller output. RMS rises with larger output excursions and is useful for spotting a controller that must work aggressively even when the mean looks ordinary.' },
  'IAC valve mean': { title: 'IAC valve mean', text: 'Average IAC command over the scope. Use mainly for operating-point/headroom context; event traces and extrema are more useful for transient behavior.' },
  'ETB target / position': { title: 'ETB target / position', text: 'Average electronic-throttle target and actual position. Compare their event traces to judge actuator following; averages can hide transient lag.' },
  'ETB contribution': { title: 'ETB contribution', text: 'Average idle-specific ETB contribution. Use it to understand how much idle torque/airflow demand is being handled by throttle.' },
  'Ign advance / correction': { title: 'Ignition advance / idle correction', text: 'Average ignition timing and idle-specific timing correction. This provides context for how much fast torque control is assisting airflow-based idle control.' },
  'Sag events': { title: 'Sag events', text: 'Number of detected events crossing the Sag threshold inside the selected scope. More events is not automatically worse if the scope contains more clutch/load disturbances; compare matched tests.' },
  'Input samples': { title: 'Input samples', text: 'Number of source samples presented to the Idle analysis after applying the selected scope. Use this with Coverage when judging whether two results have comparable evidence.' },
};

const GRAPH_HELP: HelpEntry = {
  title: 'Aligned evidence graph',
  text: 'Each event is aligned so t=0 is sag onset. The colored line is the median value at each relative time. E toggles the 10th–90th percentile envelope, showing event-to-event spread. Click a trace name to hide/show that line. Idle uses Engine response and Controller / actuator panes. Important: each trace is independently autoscaled vertically, so compare timing and shape between different signals, not their vertical height. RPM envelope is enabled by default; other Idle envelopes start off for readability.',
};

const STYLE_ID = 'idle-analyzer-inline-help-style';
const ROOTS = new WeakSet<HTMLElement>();

function ensureStyle(): void {
  if (document.getElementById(STYLE_ID)) return;
  const style = document.createElement('style');
  style.id = STYLE_ID;
  style.textContent = `
    .idle-analyzer-info { display:inline-grid; place-items:center; width:14px; height:14px; margin-left:4px; padding:0; border:1px solid #385465; border-radius:50%; background:#101d28; color:#8eabb9; font:700 9px/1 system-ui,sans-serif; cursor:pointer; vertical-align:middle; text-transform:none; letter-spacing:0; }
    .idle-analyzer-info:hover, .idle-analyzer-info:focus-visible { border-color:#5d879c; color:#d9edf5; outline:none; background:#153040; }
    .specialized-analyzer-summary > div { position:relative; }
    .specialized-analyzer-summary > div > .idle-analyzer-info { position:absolute; top:5px; right:5px; }
    .specialized-analyzer-controls label > span, .specialized-analyzer-options-grid label > span { display:inline-flex; align-items:center; }
  `;
  document.head.append(style);
}

function matchingHelp(text: string, entries: readonly [RegExp, HelpEntry][]): HelpEntry | undefined {
  return entries.find(([pattern]) => pattern.test(text))?.[1];
}

function addButton(host: HTMLElement, help: HelpEntry, show: (help: HelpEntry) => void): void {
  if (host.querySelector(':scope > .idle-analyzer-info')) return;
  const button = document.createElement('button');
  button.type = 'button';
  button.className = 'idle-analyzer-info';
  button.textContent = 'i';
  button.title = `Explain ${help.title}`;
  button.setAttribute('aria-label', `Explain ${help.title}`);
  button.addEventListener('click', (event) => {
    event.preventDefault();
    event.stopPropagation();
    show(help);
  });
  host.append(button);
}

export function ensureIdleAnalyzerHelp(canvas: HTMLCanvasElement): void {
  const root = canvas.closest<HTMLElement>('.specialized-analyzer-view');
  if (!root || ROOTS.has(root)) return;
  ROOTS.add(root);
  ensureStyle();

  const guidance = root.querySelector<HTMLElement>('.specialized-analyzer-guidance');
  const guidanceTitle = root.querySelector<HTMLElement>('[data-specialized="guidance-title"]');
  const guidanceText = root.querySelector<HTMLElement>('[data-specialized="guidance-text"]');
  if (!guidance || !guidanceTitle || !guidanceText) return;

  const show = (help: HelpEntry): void => {
    guidance.hidden = false;
    guidanceTitle.textContent = help.title;
    guidanceText.textContent = help.text;
    guidance.scrollIntoView({ block: 'nearest' });
  };

  const decorate = (): void => {
    const title = root.querySelector<HTMLElement>('[data-specialized="title"]')?.textContent ?? '';
    if (!/^Idle\b/i.test(title)) return;

    for (const span of root.querySelectorAll<HTMLElement>('.specialized-analyzer-controls label > span, .specialized-analyzer-options-grid label > span')) {
      const help = matchingHelp(span.textContent?.trim() ?? '', CONTROL_HELP);
      if (help) addButton(span, help, show);
    }

    for (const card of root.querySelectorAll<HTMLElement>('.specialized-analyzer-summary > div')) {
      const label = card.querySelector<HTMLElement>(':scope > span')?.textContent?.trim();
      if (!label) continue;
      const help = SUMMARY_HELP[label];
      if (help) addButton(card, help, show);
    }

    const evidenceHeader = root.querySelector<HTMLElement>('.specialized-analyzer-evidence > header > div');
    if (evidenceHeader) addButton(evidenceHeader, GRAPH_HELP, show);
    canvas.title = 'Idle aligned evidence: click a trace name to show/hide it; click E to toggle the 10–90% envelope.';
  };

  decorate();
  const observer = new MutationObserver(() => decorate());
  observer.observe(root, { childList: true, subtree: true });
}
