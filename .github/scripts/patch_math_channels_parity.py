from pathlib import Path
p=Path('.github/scripts/temp_math_channels_research_parity.py')
text=p.read_text()
old="""replace_once(\n    'apps/web/src/pages/histogram-math-channels-view.ts',\n    \"import type { ChannelDefinition, NumericChannelRange } from '../../../../core/log-model/log-types';\",\n    \"import type { ChannelDefinition } from '../../../../core/log-model/log-types';\",\n)\n"""
if text.count(old)!=1: raise SystemExit(f'import-removal anchor count {text.count(old)}')
text=text.replace(old,'',1)
old2="""    const historical = evaluateCalculatedFieldRange(compileCalculatedField('[A] - [A-1]'), new Map([\\n      ['A', source],\\n      ['A-1', { range: source, sampleOffset: 1 }],\\n    ]));"""
new2="""    const historical = evaluateCalculatedFieldRange(compileCalculatedField('[A] - [A-1]'), new Map<string, NumericChannelRange | { range: NumericChannelRange; sampleOffset: number }>([\\n      ['A', source],\\n      ['A-1', { range: source, sampleOffset: 1 }],\\n    ]));"""
if text.count(old2)!=1: raise SystemExit(f'test-map anchor count {text.count(old2)}')
text=text.replace(old2,new2,1)
p.write_text(text)
