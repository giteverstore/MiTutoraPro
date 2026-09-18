#!/usr/bin/env bash
set -euo pipefail
printf 'ARCH=%s\n' "$(uname -m)"
test -c /dev/kvm && echo 'KVM=YES' || echo 'KVM=NO'
test -r /dev/kvm && test -w /dev/kvm && echo 'KVM_ACCESS=YES' || echo 'KVM_ACCESS=NO'
printf 'CGROUP_FS=%s\n' "$(stat -fc %T /sys/fs/cgroup)"
grep -qE 'vmx|svm' /proc/cpuinfo && echo 'NESTED_CPU=YES' || echo 'NESTED_CPU=NO'
. /etc/os-release
printf 'OS_ID=%s\nOS_VERSION=%s\n' "$ID" "$VERSION_ID"
printf 'CPU_COUNT=%s\n' "$(nproc)"
awk '/MemTotal/{print "MEMORY_KIB=" $2}' /proc/meminfo
accounts="$(curl -fsS -H 'Metadata-Flavor: Google' --max-time 2 http://metadata.google.internal/computeMetadata/v1/instance/service-accounts/ 2>/dev/null || true)"
test -z "$accounts" && echo 'SERVICE_ACCOUNT_CREDENTIALS=ABSENT' || echo 'SERVICE_ACCOUNT_CREDENTIALS=PRESENT'
