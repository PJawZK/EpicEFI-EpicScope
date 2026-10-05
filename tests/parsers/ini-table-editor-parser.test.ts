import { describe, expect, it } from 'vitest';
import { parseIniTableEditorDefinitions } from '../../core/parsers/ini/ini-table-editor-parser';

describe('parseIniTableEditorDefinitions', () => {
  it('maps TableEditor zBins to explicit x/y bins and runtime channels', () => {
    const parsed = parseIniTableEditorDefinitions(`
[TableEditor]
  table = boostTableTbl, boostMapOpen, "Boost control duty cycle (open loop)", 1
    xyLabels = "RPMValue", something
    xBins = boostRpmBins, RPMValue
    yBins = boostOpenLoopLoadBins, boostOpenLoopYAxisValue
    zBins = boostTableOpenLoop

  table = boostClosedTbl, boostMapClosed, "Boost target", 1
    xBins = boostRpmBins, RPMValue
    yBins = boostClosedLoopLoadBins, boostClosedLoopYAxisValue
    zBins = boostTableClosedLoop
[CurveEditor]
`);
    expect(parsed).toEqual([
      {
        tableId: 'boostTableTbl', mapId: 'boostMapOpen', title: 'Boost control duty cycle (open loop)', page: 1,
        xBins: 'boostRpmBins', xChannel: 'RPMValue', yBins: 'boostOpenLoopLoadBins', yChannel: 'boostOpenLoopYAxisValue', zBins: 'boostTableOpenLoop',
      },
      {
        tableId: 'boostClosedTbl', mapId: 'boostMapClosed', title: 'Boost target', page: 1,
        xBins: 'boostRpmBins', xChannel: 'RPMValue', yBins: 'boostClosedLoopLoadBins', yChannel: 'boostClosedLoopYAxisValue', zBins: 'boostTableClosedLoop',
      },
    ]);
  });

  it('ignores commented-out table definitions', () => {
    const parsed = parseIniTableEditorDefinitions(`
[TableEditor]
; table = disabledTbl, disabledMap, "Disabled", 1
;   xBins = disabledX, x
;   yBins = disabledY, y
;   zBins = disabledZ
  table = liveTbl, liveMap, "Live", 1 ; trailing comment
    xBins = liveX, xLive
    yBins = liveY, yLive
    zBins = liveZ
`);
    expect(parsed).toHaveLength(1);
    expect(parsed[0]?.zBins).toBe('liveZ');
  });
});
