#!/bin/bash
# Downloads the official whisper.cpp Windows x64 build (CPU) into vendor/whisper/win32-x64/.
set -euo pipefail
TAG=b5454
OUT="$(cd "$(dirname "$0")/.." && pwd)/vendor/whisper/win32-x64"
TMP=$(mktemp -d)
curl -sL --retry 5 -o "$TMP/w.zip" "https://github.com/ggml-org/whisper.cpp/releases/download/$TAG/whisper-bin-x64.zip"
rm -rf "$OUT"; mkdir -p "$OUT"
unzip -q -j "$TMP/w.zip" 'Release/whisper-cli.exe' 'Release/whisper-vad-speech-segments.exe' 'Release/whisper.dll' 'Release/ggml*.dll' -d "$OUT"
rm -rf "$TMP"
ls "$OUT"
