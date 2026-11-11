#!/bin/bash
# Copies the Homebrew whisper.cpp build into vendor/whisper/darwin-<arch>/ as a self-contained folder:
# every library path is rewritten to @loader_path so the app runs on Macs without Homebrew.
set -euo pipefail
ARCH=$(uname -m)
OUT="$(cd "$(dirname "$0")/.." && pwd)/vendor/whisper/darwin-$ARCH"
BREW=$(brew --prefix)
rm -rf "$OUT"; mkdir -p "$OUT"
cp "$BREW/opt/whisper.cpp/bin/whisper-cli" "$BREW/opt/whisper.cpp/bin/whisper-vad-speech-segments" "$OUT/"
cp "$BREW/opt/whisper.cpp/lib/libwhisper.1.dylib" "$OUT/"
cp "$BREW/opt/ggml/lib/libggml.0.dylib" "$BREW/opt/ggml/lib/libggml-base.0.dylib" "$OUT/"
cp "$BREW/opt/libomp/lib/libomp.dylib" "$OUT/"
cp "$BREW"/opt/ggml/libexec/libggml-*.so "$OUT/"
chmod u+w "$OUT"/*
for f in "$OUT"/*; do
  name=$(basename "$f")
  case "$name" in *.dylib) install_name_tool -id "@loader_path/$name" "$f" 2>/dev/null;; esac
  for dep in $(otool -L "$f" | tail -n +2 | awk '{print $1}' | grep -E '^(/opt/homebrew|@rpath)'); do
    install_name_tool -change "$dep" "@loader_path/$(basename "$dep")" "$f" 2>/dev/null
  done
  # Drop Homebrew rpaths.
  for rp in $(otool -l "$f" | awk '/LC_RPATH/{getline;getline;print $2}'); do install_name_tool -delete_rpath "$rp" "$f" 2>/dev/null || true; done
  codesign --force --sign - "$f" 2>/dev/null
done
# ggml has Homebrew's backend folder compiled in and searches it before the app's own folder.
# Point it at an always-empty folder so only the bundled backends load.
python3 - "$OUT/libggml.0.dylib" <<'PY'
import re, sys
p = sys.argv[1]; b = bytearray(open(p, 'rb').read())
for m in list(re.finditer(rb'/opt/homebrew/[^\x00]*libexec', b)):
    new = b'/var/empty'; n = m.end() - m.start()
    b[m.start():m.end()] = new + b'\x00' * (n - len(new))
open(p, 'wb').write(b)
PY
codesign --force --sign - "$OUT/libggml.0.dylib"
cp "$BREW/opt/whisper.cpp/LICENSE" "$OUT/LICENSE-whisper.cpp.txt"
echo "Bundled whisper.cpp into $OUT"
otool -L "$OUT/whisper-cli" "$OUT/libggml-base.0.dylib" | grep -v /usr/lib | grep -v /System
