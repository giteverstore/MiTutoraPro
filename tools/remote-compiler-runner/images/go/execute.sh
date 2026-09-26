#!/bin/sh
set -eu
export HOME=/tmp GOCACHE=/opt/ycoders-go-cache GOMODCACHE=/tmp/go-mod GOPROXY=off GOSUMDB=off CGO_ENABLED=0
compile_started=$(date +%s%3N)
set +e
timeout -k 1s 15s go build -buildvcs=false -o /work/program /work/main.go
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
