from pathlib import Path

p = Path('apps/web/src/adapters/mlg-column-sidecar-v1.ts')
s = p.read_text()
old = 'const TARGET_STRIPE_BYTES = 64;'
new = 'const TARGET_STRIPE_BYTES = 16;'
if old not in s:
    raise SystemExit('TARGET_STRIPE_BYTES anchor not found')
s = s.replace(old, new, 1)
p.write_text(s)
