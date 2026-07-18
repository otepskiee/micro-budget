#!/usr/bin/env python3
"""Build Micro Budget's concept design.

Injects the inlined @font-face data-URIs (src/fonts.css) into the body-only
template (src/index.template.html) and emits two artifacts:

  index.html                 -> standalone document, open it in any browser
  build/artifact_body.html   -> body-only (style + markup + script) for the
                                claude.ai Artifact tool, which supplies its own
                                <!doctype>/<head>/<body> wrapper.

Everything is self-contained: no runtime network requests, fonts embedded.
"""
import pathlib

ROOT = pathlib.Path(__file__).parent
TPL = (ROOT / "src" / "index.template.html").read_text(encoding="utf-8")
FONTS = (ROOT / "src" / "fonts.css").read_text(encoding="utf-8")

MARKER = "/*__FONTS__*/"
if MARKER not in TPL:
    raise SystemExit("font marker not found in template")
body = TPL.replace(MARKER, FONTS)

# body-only, for the Artifact tool
build_dir = ROOT / "build"
build_dir.mkdir(exist_ok=True)
(build_dir / "artifact_body.html").write_text(body, encoding="utf-8")

# standalone document, for the repo / direct opening
HEAD = """<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="color-scheme" content="light">
<title>Micro Budget — The Ledger-Tape</title>
<meta name="description" content="Concept design for Micro Budget: a daily budgeter with a travel mode. Your day prints itself as a receipt-tape, and the stops you forgot to log come back as gaps to recover.">
</head>
<body>
"""
(ROOT / "index.html").write_text(HEAD + body + "\n</body>\n</html>\n", encoding="utf-8")

size = len((ROOT / "index.html").read_text(encoding="utf-8")) // 1024
print(f"built index.html ({size} KB) and build/artifact_body.html")
