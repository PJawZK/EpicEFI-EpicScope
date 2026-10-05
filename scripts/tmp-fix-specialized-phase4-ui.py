from pathlib import Path
p = Path('apps/web/src/pages/specialized-analyzer-suite-view.ts')
s = p.read_text(encoding='utf-8')
old = """  const optionNumber = (key: string, fallback?: number): number | undefined => {\n    const input = optionInput(key);\n    if (!input || input.value.trim() === '') return fallback;\n    const value = Number(input.value);\n    return Number.isFinite(value) ? value : fallback;\n  };"""
new = """  function optionNumber(key: string): number | undefined;\n  function optionNumber(key: string, fallback: number): number;\n  function optionNumber(key: string, fallback?: number): number | undefined {\n    const input = optionInput(key);\n    if (!input || input.value.trim() === '') return fallback;\n    const value = Number(input.value);\n    return Number.isFinite(value) ? value : fallback;\n  }"""
if old not in s:
    raise SystemExit('optionNumber anchor not found')
p.write_text(s.replace(old, new, 1), encoding='utf-8')
