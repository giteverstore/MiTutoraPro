#!/usr/bin/env bash
set -euo pipefail
umask 077

readonly FC_VERSION='v1.16.1'
readonly FC_TARBALL_SHA256='382a02a869e4d6d5cb14c40577f9545e8458021ea8b0b2d3fc10ec14d9c242e6'
readonly PYTHON_VERSION='3.14.0'
readonly PYTHON_TARBALL_SHA256='2299dae542d395ce3883aca00d3c910307cd68e0b2f7336098c8e7b7eee9f3e9'
readonly KERNEL_VERSION='6.18.44'
readonly KERNEL_SHA256='d0fa6b694b32c9d12c5b1575180c888d9c83ff8955d21fe74debb4fe4832db22'
readonly ROOTFS_BASE_SHA256='b7f9ecb1298bfc6897d7af13f0689be1d623dee9644f86a1df4332744b4dd281'
readonly BUILD_ROOT='/var/tmp/mitutora-python-runtime-build'
readonly INSTALL_ROOT='/opt/mitutora-judge'
readonly SOURCE_DATE_EPOCH='1788307200'
readonly FILESYSTEM_UUID='6d697475-746f-4272-8000-000000000001'
readonly FC_SOURCE="https://github.com/firecracker-microvm/firecracker/releases/download/${FC_VERSION}/firecracker-${FC_VERSION}-x86_64.tgz"
readonly PYTHON_SOURCE="https://www.python.org/ftp/python/${PYTHON_VERSION}/Python-${PYTHON_VERSION}.tar.xz"
readonly S3='https://s3.amazonaws.com/spec.ccfc.min'
readonly CI_PREFIX='firecracker-ci/20260902-a6146c8bb213-0/'
readonly KERNEL_KEY="${CI_PREFIX}x86_64/vmlinux-${KERNEL_VERSION}"
readonly ROOTFS_KEY="${CI_PREFIX}x86_64/ubuntu-24.04.squashfs"
readonly BUILD_PACKAGES=(
  build-essential ca-certificates curl jq xz-utils squashfs-tools e2fsprogs zstd
  nodejs libbz2-dev libffi-dev liblzma-dev libncurses-dev libreadline-dev
  libsqlite3-dev libssl-dev libuuid1 uuid-dev zlib1g-dev
)

export SOURCE_DATE_EPOCH
export LANG=C.UTF-8
export LC_ALL=C.UTF-8
export TZ=UTC

sudo rm -rf -- "$BUILD_ROOT"
mkdir -p "$BUILD_ROOT"
cd "$BUILD_ROOT"

sudo apt-get update -qq
sudo DEBIAN_FRONTEND=noninteractive apt-get install -y --no-install-recommends \
  "${BUILD_PACKAGES[@]}"

curl --fail --location --silent --show-error \
  "$FC_SOURCE" \
  --output firecracker.tgz
printf '%s  %s\n' "$FC_TARBALL_SHA256" firecracker.tgz | sha256sum --check --status
tar -xzf firecracker.tgz
readonly FC_RELEASE_DIR="$BUILD_ROOT/release-${FC_VERSION}-x86_64"
test "$("$FC_RELEASE_DIR/firecracker-${FC_VERSION}-x86_64" --version | head -1 | awk '{print $2}')" = "$FC_VERSION"
test "$("$FC_RELEASE_DIR/jailer-${FC_VERSION}-x86_64" --version | head -1 | awk '{print $2}')" = "$FC_VERSION"

curl -fsSL "${S3}/${KERNEL_KEY}" -o vmlinux
curl -fsSL "${S3}/${ROOTFS_KEY}" -o ubuntu.squashfs
printf '%s  %s\n' "$KERNEL_SHA256" vmlinux | sha256sum --check --status
printf '%s  %s\n' "$ROOTFS_BASE_SHA256" ubuntu.squashfs | sha256sum --check --status

curl --fail --location --silent --show-error \
  "$PYTHON_SOURCE" \
  --output "Python-${PYTHON_VERSION}.tar.xz"
printf '%s  %s\n' "$PYTHON_TARBALL_SHA256" "Python-${PYTHON_VERSION}.tar.xz" | sha256sum --check --status
tar -xf "Python-${PYTHON_VERSION}.tar.xz"
cd "Python-${PYTHON_VERSION}"
./configure --prefix=/usr --without-ensurepip --disable-test-modules
make -j2
cd "$BUILD_ROOT"

unsquashfs -d rootfs ubuntu.squashfs >/dev/null
sudo make -C "Python-${PYTHON_VERSION}" DESTDIR="$BUILD_ROOT/rootfs" altinstall >/dev/null
sudo install -D -o root -g root -m 0555 /tmp/mitutora-python-judge/functions/src/python-judge/guest/python_test_harness.py \
  "$BUILD_ROOT/rootfs/opt/mitutora/python_test_harness.py"
sudo install -D -o root -g root -m 0555 /tmp/mitutora-python-judge/scripts/judge/mitutora-init \
  "$BUILD_ROOT/rootfs/usr/local/bin/mitutora-init"
test -x "$BUILD_ROOT/rootfs/usr/bin/setpriv"
test -x "$BUILD_ROOT/rootfs/sbin/poweroff" || test -x "$BUILD_ROOT/rootfs/usr/sbin/poweroff"
sudo rm -rf -- "$BUILD_ROOT/rootfs/usr/local/lib/python${PYTHON_VERSION%.*}/test" \
  "$BUILD_ROOT/rootfs/usr/lib/python${PYTHON_VERSION%.*}/test" \
  "$BUILD_ROOT/rootfs/usr/lib/python${PYTHON_VERSION%.*}/ensurepip" \
  "$BUILD_ROOT/rootfs/root/.cache" "$BUILD_ROOT/rootfs/tmp/"*
sudo rm -rf -- "$BUILD_ROOT/rootfs/etc/ssh" "$BUILD_ROOT/rootfs/root/.ssh"
sudo rm -rf -- \
  "$BUILD_ROOT/rootfs/usr/lib/python3/dist-packages/boto3" \
  "$BUILD_ROOT/rootfs/usr/lib/python3/dist-packages/boto3-"*.egg-info \
  "$BUILD_ROOT/rootfs/usr/lib/python3/dist-packages/botocore" \
  "$BUILD_ROOT/rootfs/usr/lib/python3/dist-packages/botocore-"*.egg-info
sudo find "$BUILD_ROOT/rootfs/home" -mindepth 2 -maxdepth 2 -type d -name .ssh -exec rm -rf -- {} + 2>/dev/null || true
sudo rm -f -- "$BUILD_ROOT/rootfs/usr/bin/curl" "$BUILD_ROOT/rootfs/usr/bin/scp" \
  "$BUILD_ROOT/rootfs/usr/bin/sftp" "$BUILD_ROOT/rootfs/usr/bin/socat" \
  "$BUILD_ROOT/rootfs/usr/bin/ssh" "$BUILD_ROOT/rootfs/usr/bin/ssh-add" \
  "$BUILD_ROOT/rootfs/usr/bin/ssh-agent" "$BUILD_ROOT/rootfs/usr/bin/ssh-copy-id" \
  "$BUILD_ROOT/rootfs/usr/bin/ssh-keygen" "$BUILD_ROOT/rootfs/usr/bin/ssh-keyscan" \
  "$BUILD_ROOT/rootfs/usr/sbin/sshd"
printf '\n' | sudo tee "$BUILD_ROOT/rootfs/etc/machine-id" >/dev/null
printf 'nameserver 0.0.0.0\n' | sudo tee "$BUILD_ROOT/rootfs/etc/resolv.conf" >/dev/null
sudo rm -rf -- "$BUILD_ROOT/rootfs/var/log/"* "$BUILD_ROOT/rootfs/var/lib/apt/lists/"*
if sudo find "$BUILD_ROOT/rootfs" \( -name pip -o -name pip3 -o -name pip3.14 -o -name ensurepip \) | grep -q .; then
  echo 'Unexpected pip/ensurepip content in runtime image.' >&2
  exit 1
fi
for forbidden in \
  usr/bin/curl usr/bin/wget usr/bin/ssh usr/bin/scp usr/bin/sftp usr/bin/socat \
  usr/bin/nc usr/bin/ncat usr/bin/nmap usr/bin/gcc usr/bin/cc usr/bin/g++ \
  usr/bin/make usr/bin/git usr/sbin/sshd; do
  test ! -e "$BUILD_ROOT/rootfs/$forbidden" || { echo "Unexpected runtime tool: $forbidden" >&2; exit 1; }
done
if sudo find "$BUILD_ROOT/rootfs" -xdev -type f \( \
  -name 'id_rsa' -o -name 'id_ed25519' -o -name 'application_default_credentials.json' \
  -o -name '.netrc' -o -name '.npmrc' -o -name '.pypirc' -o -name 'credentials.json' \
  -o -name 'firebase-debug.log' \) -print -quit | grep -q .; then
  echo 'Credential-shaped file found in runtime image.' >&2
  exit 1
fi
sudo grep -rIlE --binary-files=without-match \
  'BEGIN (RSA |EC |OPENSSH )?PRIVATE KEY|FIREBASE_SERVICE_ACCOUNT_JSON|HF_TOKEN|refresh_token' \
  "$BUILD_ROOT/rootfs" > "$BUILD_ROOT/secret-content-matches.txt" || true
if test -s "$BUILD_ROOT/secret-content-matches.txt"; then
  echo 'Secret-shaped content found in runtime image.' >&2
  exit 1
fi
sudo grep -rIlE --binary-files=without-match \
  'synthetic-square-suite|practice-fund-variables-001|practice-fund-variables-002' \
  "$BUILD_ROOT/rootfs" > "$BUILD_ROOT/protected-content-matches.txt" || true
if test -s "$BUILD_ROOT/protected-content-matches.txt"; then
  echo 'Protected judge content found in runtime image.' >&2
  exit 1
fi
test "$(sudo chroot "$BUILD_ROOT/rootfs" /usr/bin/python3.14 --version 2>&1)" = "Python ${PYTHON_VERSION}"
sudo chroot --userspec=1001:1001 "$BUILD_ROOT/rootfs" \
  /usr/bin/python3.14 -I -B -c 'import sys; assert sys.version_info[:3] == (3, 14, 0)'

sudo find "$BUILD_ROOT/rootfs" -xdev -print0 | sudo xargs -0 touch -h -d "@${SOURCE_DATE_EPOCH}"

truncate -s 1536M rootfs.ext4
sudo env E2FSPROGS_FAKE_TIME="$SOURCE_DATE_EPOCH" mkfs.ext4 -q -F \
  -U "$FILESYSTEM_UUID" \
  -E "hash_seed=${FILESYSTEM_UUID},lazy_itable_init=0,lazy_journal_init=0" \
  -d rootfs rootfs.ext4
sudo e2fsck -fn rootfs.ext4 >/dev/null

sudo install -d -o root -g root -m 0755 "$INSTALL_ROOT/bin" "$INSTALL_ROOT/runtime"
sudo install -o root -g root -m 0555 "$FC_RELEASE_DIR/firecracker-${FC_VERSION}-x86_64" "$INSTALL_ROOT/bin/firecracker"
sudo install -o root -g root -m 0555 "$FC_RELEASE_DIR/jailer-${FC_VERSION}-x86_64" "$INSTALL_ROOT/bin/jailer"
sudo install -o root -g root -m 0444 vmlinux "$INSTALL_ROOT/runtime/vmlinux"
sudo install -o root -g root -m 0444 rootfs.ext4 "$INSTALL_ROOT/runtime/rootfs.ext4"

dpkg-query -W -f='${binary:Package}\t${Version}\n' "${BUILD_PACKAGES[@]}" \
  | LC_ALL=C sort | sudo tee "$INSTALL_ROOT/runtime/build-packages.tsv" >/dev/null
sudo sh -c "find '$BUILD_ROOT/rootfs' -xdev -type f -print0 | LC_ALL=C sort -z | xargs -0 sha256sum" \
  | sed "s#  $BUILD_ROOT/rootfs/#  ./#" \
  | sudo tee "$INSTALL_ROOT/runtime/guest-files.sha256" >/dev/null
if test -s "$BUILD_ROOT/rootfs/var/lib/dpkg/status"; then
  sudo dpkg-query --admindir="$BUILD_ROOT/rootfs/var/lib/dpkg" -W -f='${binary:Package}\t${Version}\n' \
    | LC_ALL=C sort | sudo tee "$INSTALL_ROOT/runtime/guest-packages.tsv" >/dev/null
  readonly GUEST_PACKAGE_INVENTORY='dpkg-status'
else
  printf '%s\n' 'Base image does not retain dpkg package metadata; guest-files.sha256 is authoritative.' \
    | sudo tee "$INSTALL_ROOT/runtime/guest-packages.tsv" >/dev/null
  readonly GUEST_PACKAGE_INVENTORY='filesystem-sha256'
fi
sudo find /etc/apt -type f -exec sha256sum {} + | LC_ALL=C sort \
  | sudo tee "$INSTALL_ROOT/runtime/builder-apt-inputs.sha256" >/dev/null
sudo chmod 0444 "$INSTALL_ROOT/runtime/"*.tsv "$INSTALL_ROOT/runtime/"*.sha256

readonly KERNEL_SHA="$(sha256sum vmlinux | cut -d' ' -f1)"
readonly ROOTFS_SHA="$(sha256sum rootfs.ext4 | cut -d' ' -f1)"
readonly HARNESS_SHA="$(sha256sum /tmp/mitutora-python-judge/functions/src/python-judge/guest/python_test_harness.py | cut -d' ' -f1)"
readonly PYTHON_SOURCE_SHA="$(sha256sum "Python-${PYTHON_VERSION}.tar.xz" | cut -d' ' -f1)"
readonly INIT_SHA="$(sha256sum /tmp/mitutora-python-judge/scripts/judge/mitutora-init | cut -d' ' -f1)"
readonly BUILD_SCRIPT_SHA="$(sha256sum /tmp/mitutora-python-judge/scripts/judge/build-python-firecracker-runtime.sh | cut -d' ' -f1)"
readonly RUNTIME_SHA="$(printf '%s\0%s\0%s\0%s\0%s\0' "$PYTHON_VERSION" "$FC_VERSION" "$KERNEL_SHA" "$ROOTFS_SHA" "$HARNESS_SHA" | sha256sum | cut -d' ' -f1)"
readonly BUILDER_OS="$(. /etc/os-release && printf '%s-%s' "$ID" "$VERSION_ID")"
readonly BUILDER_ARCH="$(uname -m)"
readonly ROOTFS_BYTES="$(stat -c %s rootfs.ext4)"
readonly FILESYSTEM_TYPE="$(sudo blkid -s TYPE -o value rootfs.ext4)"

jq -n \
  --arg pythonVersion "$PYTHON_VERSION" \
  --arg firecrackerVersion "${FC_VERSION#v}" \
  --arg guestKernelVersion "$KERNEL_VERSION" \
  --arg kernelDigest "$KERNEL_SHA" \
  --arg rootfsDigest "$ROOTFS_SHA" \
  --arg runtimeDigest "$RUNTIME_SHA" \
  --arg harnessDigest "$HARNESS_SHA" \
  --arg guestInitDigest "$INIT_SHA" \
  --arg imageBuildScriptDigest "$BUILD_SCRIPT_SHA" \
  --arg pythonSourceDigest "$PYTHON_SOURCE_SHA" \
  --arg firecrackerArchiveDigest "$FC_TARBALL_SHA256" \
  --arg rootfsBaseDigest "$ROOTFS_BASE_SHA256" \
  --arg firecrackerSource "$FC_SOURCE" \
  --arg pythonSource "$PYTHON_SOURCE" \
  --arg kernelSource "${S3}/${KERNEL_KEY}" \
  --arg rootfsSource "${S3}/${ROOTFS_KEY}" \
  --arg builderOs "$BUILDER_OS" \
  --arg builderArchitecture "$BUILDER_ARCH" \
  --arg guestPackageInventory "$GUEST_PACKAGE_INVENTORY" \
  --arg filesystemFormat "$FILESYSTEM_TYPE" \
  --argjson imageSizeBytes "$ROOTFS_BYTES" \
  --arg runtimePolicyVersion 'python-firecracker-v1' \
  --arg imageConstructionTimestamp "$(date -u +%Y-%m-%dT%H:%M:%SZ)" \
  '{schemaVersion:1,imageConstructionTimestamp:$imageConstructionTimestamp,builder:{os:$builderOs,architecture:$builderArchitecture},pythonVersion:$pythonVersion,firecrackerVersion:$firecrackerVersion,guestKernelVersion:$guestKernelVersion,firecrackerArchiveDigest:$firecrackerArchiveDigest,kernelDigest:$kernelDigest,rootfsBaseDigest:$rootfsBaseDigest,rootfsDigest:$rootfsDigest,runtimeDigest:$runtimeDigest,harnessDigest:$harnessDigest,guestInitDigest:$guestInitDigest,imageBuildScriptDigest:$imageBuildScriptDigest,pythonSourceDigest:$pythonSourceDigest,firecrackerSource:$firecrackerSource,pythonSource:$pythonSource,kernelSource:$kernelSource,rootfsSource:$rootfsSource,packageManagerInputs:{buildPackages:"build-packages.tsv",aptSources:"builder-apt-inputs.sha256",guestInventory:"guest-packages.tsv",guestFileInventory:"guest-files.sha256",guestInventoryKind:$guestPackageInventory},filesystemFormat:$filesystemFormat,imageSizeBytes:$imageSizeBytes,runtimePolicyVersion:$runtimePolicyVersion,audit:{credentials:"ABSENT",secrets:"ABSENT",protectedContent:"ABSENT",networkClientTools:"ABSENT",compilerToolchain:"ABSENT",nonRootExecution:"VERIFIED"}}' \
  | sudo tee "$INSTALL_ROOT/runtime/manifest.json" >/dev/null
sudo chmod 0444 "$INSTALL_ROOT/runtime/manifest.json"

sudo tar --sort=name --sparse --numeric-owner --owner=0 --group=0 \
  --mtime="@${SOURCE_DATE_EPOCH}" --pax-option=delete=atime,delete=ctime \
  -C "$INSTALL_ROOT" -I 'zstd -10 -T0' -cf "$BUILD_ROOT/mitutora-python-firecracker-runtime.tar.zst" bin runtime
sudo chmod 0444 "$BUILD_ROOT/mitutora-python-firecracker-runtime.tar.zst"
sha256sum "$BUILD_ROOT/mitutora-python-firecracker-runtime.tar.zst" \
  | sudo tee "$INSTALL_ROOT/runtime/artifact.sha256" >/dev/null

jq '{status:"ready",pythonVersion,firecrackerVersion,guestKernelVersion}' "$INSTALL_ROOT/runtime/manifest.json"
