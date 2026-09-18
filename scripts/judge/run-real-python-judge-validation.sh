#!/usr/bin/env bash
set -euo pipefail

readonly REPOSITORY_ROOT='/tmp/mitutora-python-judge'
cd "$REPOSITORY_ROOT"
exec node scripts/judge/run-python-judge-validation.mjs
