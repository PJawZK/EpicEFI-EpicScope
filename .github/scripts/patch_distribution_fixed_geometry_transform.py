from pathlib import Path
p=Path('.github/scripts/temp_distribution_fixed_geometry.py')
text=p.read_text()
old="""replace_once('tests/web/histogram-distribution-storage.test.ts',
\"      binCount: '24',\\n      display: 'cumulative',\",
\"      binCount: '24',\\n      fixedMin: '0',\\n      fixedMax: '250',\\n      fixedWidth: '5',\\n      display: 'cumulative',\")"""
new="""replace_once('tests/web/histogram-distribution-storage.test.ts',
\"      metric: 'percent' as const, binMode: 'manual' as const, binCount: '32', display: 'cumulative' as const,\",
\"      metric: 'percent' as const, binMode: 'fixed' as const, binCount: '32', fixedMin: '0', fixedMax: '250', fixedWidth: '5', display: 'cumulative' as const,\")"""
if text.count(old)!=1: raise SystemExit(f'storage transform patch anchor count {text.count(old)}')
text=text.replace(old,new,1)
old2="""replace_once('tests/web/histogram-distribution-csv.test.ts',
\"        rejectedSampleCount: 5,\\n      }],\",
\"        rejectedSampleCount: 5,\\n        outsideGeometrySampleCount: 3,\\n      }],\")
replace_once('tests/web/histogram-distribution-csv.test.ts',
\"    expect(exported.csv).toContain('100,95,5');\",
\"    expect(exported.csv).toContain('100,95,5,3');\")"""
new2="""replace_once('tests/web/histogram-distribution-csv.test.ts',
\"inputSampleCount: 5, eligibleSampleCount: 4, rejectedSampleCount: 1 },\",
\"inputSampleCount: 5, eligibleSampleCount: 4, rejectedSampleCount: 1, outsideGeometrySampleCount: 2 },\")
replace_once('tests/web/histogram-distribution-csv.test.ts',
\"    expect(result.csv).toContain(',5,4,1');\",
\"    expect(result.csv).toContain(',5,4,1,2');\")"""
if text.count(old2)!=1: raise SystemExit(f'csv transform patch anchor count {text.count(old2)}')
text=text.replace(old2,new2,1)
p.write_text(text)
