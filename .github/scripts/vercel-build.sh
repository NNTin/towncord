#!/bin/bash
set -euo pipefail

# Install Python dependencies (matches deploy.yml)
pip install --break-system-packages pillow==10.3.0

# Install Aseprite CLI (matches deploy.yml)
RELEASE_TAG="v1.3.17"
ASSET_NAME="Aseprite-v1.3.17-Linux.zip"
EXPECTED_SHA256="6cf84e38dfc74bc0f20346d57f7158689823044759de620abe24321d2d7870e9"
RELEASE_API_URL="https://api.github.com/repos/NNTin/aseprite-builder/releases/tags/${RELEASE_TAG}"
ZIP_PATH="/tmp/aseprite.zip"
INSTALL_DIR="/tmp/aseprite"

ASSET_API_URL="$(
  curl -fsSL \
    -H "Authorization: Bearer ${REPO_TOKEN}" \
    -H "Accept: application/vnd.github+json" \
    "$RELEASE_API_URL" | \
  python3 -c "import json,sys; asset='${ASSET_NAME}'; release=json.load(sys.stdin); print(next((a.get('url','') for a in release.get('assets',[]) if a.get('name')==asset), ''))"
)"

if [ -z "$ASSET_API_URL" ]; then
  echo "Error: Could not find asset '${ASSET_NAME}' in release '${RELEASE_TAG}'." >&2
  exit 1
fi

curl -fsSL \
  -H "Authorization: Bearer ${REPO_TOKEN}" \
  -H "Accept: application/octet-stream" \
  "$ASSET_API_URL" \
  -o "$ZIP_PATH"

echo "${EXPECTED_SHA256}  ${ZIP_PATH}" | sha256sum -c -

mkdir -p "$INSTALL_DIR"
unzip -q "$ZIP_PATH" -d "$INSTALL_DIR"
chmod +x "$INSTALL_DIR/aseprite"
export PATH="$INSTALL_DIR:$PATH"
"$INSTALL_DIR/aseprite" --version

# Build frontend
npm run build:frontend
