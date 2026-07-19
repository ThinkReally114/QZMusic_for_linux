#!/bin/bash
set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"
OUT_DIR="$SCRIPT_DIR/build"

TAGLIB_ROOT="${TAGLIB_ROOT:-/usr}"
TAGLIB_INCLUDE="$TAGLIB_ROOT/include"
TAGLIB_LIB="-ltag"

echo "Building taglib_reader_cli for Linux..."

mkdir -p "$OUT_DIR"

g++ -std=c++17 -O2 \
    -I"$TAGLIB_INCLUDE" \
    "$SCRIPT_DIR/taglib_reader_cli_linux.cpp" \
    -o "$OUT_DIR/taglib_reader_cli" \
    $TAGLIB_LIB \
    -lstdc++fs

chmod +x "$OUT_DIR/taglib_reader_cli"

echo "Built $OUT_DIR/taglib_reader_cli"
