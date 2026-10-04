from pathlib import Path

for name in ['SHOULD_NOT_EXIST.tmp', 'cleanup-note.tmp']:
    path = Path(name)
    if path.exists():
        path.unlink()
