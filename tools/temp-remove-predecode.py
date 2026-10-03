from pathlib import Path
import subprocess

BASE='939062aefa667605a44d31e7c40ebec71e350180'

def show(path):
    return subprocess.check_output(['git','show',f'{BASE}:{path}'], text=True)

Path('apps/web/src/pages/logger-page.ts').write_text(show('apps/web/src/pages/logger-page.ts'))
Path('apps/web/src/adapters/persistent-channel-cache.ts').write_text(show('apps/web/src/adapters/persistent-channel-cache.ts'))
Path('tests/web/persistent-channel-cache.test.ts').write_text(show('tests/web/persistent-channel-cache.test.ts'))
for p in [
    Path('apps/web/src/performance/opportunistic-predecode.ts'),
    Path('tests/web/opportunistic-predecode.test.ts'),
]:
    if p.exists():
        p.unlink()
