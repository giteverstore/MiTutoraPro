#!/bin/sh
set -eu
export HOME=/tmp
compile_started=$(date +%s%3N)
set +e
timeout -k 1s 15s rustc --edition=2024 -C debuginfo=1 /work/main.rs -o /work/program
code=$?
set -e
printf '__YCODERS_TIMING__:compile:%s\n' "$(( $(date +%s%3N) - compile_started ))" >&2
if [ "$code" -ne 0 ]; then [ "$code" -eq 124 ] && exit 122; exit 2; fi
run_started=$(date +%s%3N)
set +e
timeout -k 1s 10s /work/program < /work/stdin.txt
code=$?
set -e
printf '__YCODERS_TIMING__:run:%s\n' "$(( $(date +%s%3N) - run_started ))" >&2
if [ "$code" -ne 0 ]; then [ "$code" -eq 124 ] && exit 124; exit 3; fi
