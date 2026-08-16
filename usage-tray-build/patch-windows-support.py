from pathlib import Path
import sys

path = Path(sys.argv[1])
text = path.read_text(encoding="utf-8")

old_ids = '''  "factory",\n  "windsurf",'''
new_ids = '''  "factory",\n  "opencode-go",\n  "windsurf",'''
if old_ids not in text:
    raise SystemExit("WINDOWS_V1_PROVIDER_IDS insertion point not found")
text = text.replace(old_ids, new_ids, 1)

old_block = '''  "opencode-go": {\n    status: "deferred",\n    detectionStrategy: "Unix local-share auth and sqlite database under `~/.local/share/opencode`.",\n    dependencies: ["OpenCode Go local files", "sqlite3"],\n    note: "OpenCode Go currently assumes a Unix local-share layout and needs a Windows storage strategy first.",\n  },'''
new_block = '''  "opencode-go": {\n    status: "v1",\n    detectionStrategy: "Reads OpenCode auth.json from the Windows user profile (with LocalAppData fallback) and queries the authenticated `/zen/go/v1/usage` API.",\n    dependencies: ["OpenCode Go API key", "network access"],\n    note: "No local OpenCode Go API key was detected. Sign in to OpenCode Go first so auth.json contains an `opencode-go` key.",\n  },'''
if old_block not in text:
    raise SystemExit("OpenCode Go deferred support block not found")
text = text.replace(old_block, new_block, 1)

old_detection = '''    /^No ZAI_API_KEY found\\./i,\n    /^Start .+ and try again\\./i,'''
new_detection = '''    /^No ZAI_API_KEY found\\./i,\n    /^OpenCode Go not detected\\b/i,\n    /^Start .+ and try again\\./i,'''
if old_detection not in text:
    raise SystemExit("detection-gap insertion point not found")
text = text.replace(old_detection, new_detection, 1)

if '"opencode-go": {\n    status: "v1"' not in text:
    raise SystemExit("OpenCode Go was not marked v1")
if "Unix local-share layout and needs a Windows storage strategy" in text:
    raise SystemExit("stale planned-for-Windows message remains")

path.write_text(text, encoding="utf-8")
print("Patched OpenCode Go Windows support gate")
