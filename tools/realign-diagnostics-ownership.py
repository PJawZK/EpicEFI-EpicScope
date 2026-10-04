from pathlib import Path

old_bound = Path('core/diagnostics/bound-cache-observability.ts')
bound = old_bound.read_text()
bound = bound.replace("import { BoundNumericChannelDataSource } from '../channels/channel-binding';", "import { BoundNumericChannelDataSource } from './channel-binding';", 1)
Path('core/channels/bound-cache-observability.ts').write_text(bound)

old_decode = Path('core/diagnostics/channel-decode-performance.ts')
Path('core/parsers/mlg/channel-decode-performance.ts').write_text(old_decode.read_text())

replacements = {
    'apps/web/src/adapters/blob-byte-source.ts': (
        "../../../../core/diagnostics/bound-cache-observability",
        "../../../../core/channels/bound-cache-observability",
    ),
    'tests/channels/bound-cache-observability.test.ts': (
        "../../core/diagnostics/bound-cache-observability",
        "../../core/channels/bound-cache-observability",
    ),
    'core/parsers/mlg/mlg-channel-data.ts': (
        "../../diagnostics/channel-decode-performance",
        "./channel-decode-performance",
    ),
    'apps/web/src/components/performance-diagnostics.ts': (
        "../../../../core/diagnostics/channel-decode-performance",
        "../../../../core/parsers/mlg/channel-decode-performance",
    ),
}
for name, (old, new) in replacements.items():
    p = Path(name)
    s = p.read_text()
    if old not in s:
        raise SystemExit(f'missing import in {name}')
    p.write_text(s.replace(old, new, 1))

old_bound.unlink()
old_decode.unlink()
