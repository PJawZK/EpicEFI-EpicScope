from pathlib import Path
p = Path('core/parsers/mlg/mlg-channel-data.ts')
s = p.read_text().replace('displayValue(', 'displayMlgValue(').replace('decodeRawValue(', 'decodeMlgRawValue(')
p.write_text(s)
