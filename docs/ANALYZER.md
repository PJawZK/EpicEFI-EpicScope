# Analyzer

EpicScope Analyzer answers tuning questions from log evidence rather than replacing Logger or Histogram.

## Shared workflow

Specialized analyzers resolve semantic channel roles from the loaded INI/log where possible while keeping every mapping visible and manually overridable. Scope can be Full Log, the current Logger A/B range, or a saved Logger range. Event rows preserve a route back to the source evidence in Logger.

## Event-aligned evidence

Idle and AE / MAP Predict use event-aligned evidence graphs. Each detected event is aligned to `t=0` at event onset. The aggregate view draws the median response with a 10–90% envelope so repeated behavior and event-to-event variation can be inspected together. Selecting an event row shows that event alone; **All events** restores the aggregate view. Double-click or Enter on an event opens its source window in Logger, while a normal click keeps the user in Analyzer for evidence inspection.

This is the first evidence-graph implementation. Later Analyzer phases should reuse the same interaction model for Boost, Ignition, Fuel/Injector, Trigger/Sync and range comparisons rather than introducing separate navigation behavior.
