#!/usr/bin/env sh
# Install Chromium's shared-library dependencies for prerendering in Vercel CI.
#
# Vercel's build image is Amazon Linux 2023 and ships without Chromium's system
# libraries (libnspr4.so, libnss3.so, …), so a freshly-installed Playwright
# browser fails to launch. Playwright's own `--with-deps` can't fix this here —
# it only knows apt-get, which the image doesn't have.
#
# Scoped to Vercel via the VERCEL env var so local/dev builds (macOS, etc.) skip
# it entirely. A missing package manager or a failed install exits non-zero on
# purpose: a visible failure in the build log is diagnosable; a silent one is not.
set -e

if [ "$VERCEL" != "1" ]; then
  echo "ℹ️  Not on Vercel (VERCEL != 1) — skipping Chromium system dependency install."
  exit 0
fi

PKGS="nss nspr expat glib2 dbus-libs atk at-spi2-atk at-spi2-core cups-libs libdrm mesa-libgbm libxkbcommon libXcomposite libXdamage libXext libXfixes libXrandr alsa-lib pango cairo"

echo "📦 Installing Chromium system dependencies on Vercel (Amazon Linux 2023)..."
if command -v dnf >/dev/null 2>&1; then
  dnf install -y $PKGS
elif command -v microdnf >/dev/null 2>&1; then
  microdnf install -y $PKGS
elif command -v yum >/dev/null 2>&1; then
  yum install -y $PKGS
else
  echo "❌ No dnf/microdnf/yum on the build image — cannot install Chromium deps." >&2
  exit 1
fi
echo "✅ Chromium system dependencies installed."
