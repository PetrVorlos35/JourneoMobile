#!/usr/bin/env bash
# Po úpravě .ts/.tsx v src/: ESLint na soubor + typecheck celého projektu.
# Chyby vrátí Claudovi (exit 2 + stderr), jinak mlčí.
f=$(jq -r '.tool_response.filePath // .tool_input.file_path // empty')
case "$f" in
  */JourneoMobile/src/*.ts|*/JourneoMobile/src/*.tsx) ;;
  *) exit 0 ;;
esac
cd "$(dirname "$0")/../.." || exit 0
out=$(npx eslint --max-warnings=0 "$f" 2>&1); lint_failed=$?
tsc_out=$(npx tsc --noEmit 2>&1); tsc_failed=$?
if [ $lint_failed -ne 0 ] || [ $tsc_failed -ne 0 ]; then
  {
    echo "Kontrola po úpravě $f selhala:"
    [ $lint_failed -ne 0 ] && echo "$out"
    [ $tsc_failed -ne 0 ] && echo "$tsc_out" | head -40
  } >&2
  exit 2
fi
exit 0
