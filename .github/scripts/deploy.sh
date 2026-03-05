#!/usr/bin/env bash
# ============================================================================
# Towncord Deployment Build Script
# ============================================================================
#
# Usage:
#   bash .github/scripts/deploy.sh <version>
#
# Output:
#   Creates a 'build' directory structure:
#   - build/index.html  (root router with hash-based routing)
#   - build/{version}/  (versioned application files)
#   - build/versions.json
#
# ============================================================================

set -euo pipefail

VERSION="${1:?Usage: deploy.sh <version>}"

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"
BUILD_DIR="$REPO_ROOT/build"
VERSION_DIR="$BUILD_DIR/$VERSION"
DIST_DIR="$REPO_ROOT/apps/frontend/dist"
INDEX_HTML="$BUILD_DIR/index.html"
VERSIONS_JSON="$BUILD_DIR/versions.json"

echo "============================================================"
echo "Towncord Deployment Build Script"
echo "============================================================"
echo "Version:    $VERSION"
echo "Repo root:  $REPO_ROOT"
echo "Build dir:  $BUILD_DIR"
echo ""

# ------------------------------------------------------------
# Create version directory
# ------------------------------------------------------------
mkdir -p "$VERSION_DIR"
echo "Created $VERSION_DIR"

# ------------------------------------------------------------
# Copy dist files
# ------------------------------------------------------------
if [[ ! -d "$DIST_DIR" ]]; then
  echo "ERROR: dist directory not found at $DIST_DIR" >&2
  exit 1
fi

cp -r "$DIST_DIR/." "$VERSION_DIR/"
echo "Copied dist to $VERSION_DIR"

# ------------------------------------------------------------
# Create root index.html (hash-based version router)
# ------------------------------------------------------------
cat > "$INDEX_HTML" << HTMLEOF
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Towncord</title>
  <style>
    body {
      margin: 0;
      padding: 0;
      background: #181213;
      color: white;
      font-family: Arial, sans-serif;
    }
    #loading {
      position: fixed;
      top: 50%;
      left: 50%;
      transform: translate(-50%, -50%);
      text-align: center;
    }
    #content {
      width: 100vw;
      height: 100vh;
      border: none;
      display: none;
    }
    .version-info {
      position: fixed;
      top: 10px;
      left: 10px;
      background: rgba(0,0,0,0.7);
      padding: 5px 10px;
      border-radius: 5px;
      font-size: 12px;
      z-index: 1000;
    }
  </style>
</head>
<body>
  <div id="loading">
    <div>Loading Towncord...</div>
    <div id="version-display"></div>
  </div>
  <div class="version-info" id="version-info" style="display: none;"></div>
  <iframe id="content" src=""></iframe>

  <script>
    const DEFAULT_VERSION = '$VERSION';

    function getCurrentVersion() {
      const hash = window.location.hash.slice(1);
      return hash || DEFAULT_VERSION;
    }

    function setVersion(version) {
      if (window.location.hash.slice(1) !== version) {
        window.location.hash = version;
      }
    }

    function loadVersion(version) {
      const versionDisplay = document.getElementById('version-display');
      const versionInfo = document.getElementById('version-info');
      const content = document.getElementById('content');
      const loading = document.getElementById('loading');

      const existingError = loading.querySelector('.error-content');
      if (existingError) existingError.remove();

      versionDisplay.textContent = 'Version: ' + version;
      versionInfo.textContent = 'v' + version;

      loading.style.display = 'block';
      content.style.display = 'none';
      versionInfo.style.display = 'none';

      fetch(version + '/')
        .then(response => {
          if (!response.ok) throw new Error('Version ' + version + ' not found (' + response.status + ')');

          content.src = version + '/';
          content.onload = function() {
            loading.style.display = 'none';
            content.style.display = 'block';
            versionInfo.style.display = 'block';
          };
          setTimeout(() => {
            if (loading.style.display !== 'none') content.onload();
          }, 5000);
        })
        .catch(error => {
          console.error('Version load error:', error);
          versionDisplay.textContent = 'Version: ' + version + ' (Not Found)';

          const errorContent = document.createElement('div');
          errorContent.className = 'error-content';
          errorContent.innerHTML =
            '<div style="color:#ff6b6b;margin-top:20px;">' +
              '<h3>Version Not Found</h3>' +
              '<p>Version "' + version + '" does not exist.</p>' +
            '</div>' +
            '<div style="margin-top:15px;">' +
              '<button onclick="window.switchToVersion(\'' + DEFAULT_VERSION + '\')" style="background:#4ECDC4;color:white;border:none;padding:10px 20px;margin:5px;border-radius:5px;cursor:pointer;font-size:14px;">Go to Default Version</button>' +
              '<button onclick="history.back()" style="background:#95E1D3;color:#333;border:none;padding:10px 20px;margin:5px;border-radius:5px;cursor:pointer;font-size:14px;">Go Back</button>' +
            '</div>' +
            '<div style="margin-top:20px;font-size:12px;color:#888;"><p>Error: ' + error.message + '</p></div>';

          loading.appendChild(errorContent);
          loading.style.display = 'block';
          content.style.display = 'none';
          versionInfo.style.display = 'none';
        });
    }

    window.switchToVersion = function(version) {
      setVersion(version);
      loadVersion(version);
    };

    window.addEventListener('hashchange', function() {
      loadVersion(getCurrentVersion());
    });

    document.addEventListener('DOMContentLoaded', function() {
      if (!window.location.hash) setVersion(DEFAULT_VERSION);
      loadVersion(getCurrentVersion());
    });
  </script>
</body>
</html>
HTMLEOF

echo "Created $INDEX_HTML"

# ------------------------------------------------------------
# Create/update versions.json
# ------------------------------------------------------------
EXISTING_VERSIONS="[]"

# Try to read existing versions.json from gh-pages branch
git fetch origin gh-pages:gh-pages 2>/dev/null || true
if git show gh-pages:versions.json > /tmp/existing_versions.json 2>/dev/null; then
  EXISTING_VERSIONS="$(cat /tmp/existing_versions.json)"
  echo "Found existing versions.json"
else
  echo "No existing versions.json (first deployment?)"
fi

# Append version if not already present, then write
node - << JSEOF
const fs = require('fs');
const versions = JSON.parse('$EXISTING_VERSIONS');
if (!versions.includes('$VERSION')) versions.push('$VERSION');
fs.writeFileSync('$VERSIONS_JSON', JSON.stringify(versions));
console.log('Written versions.json:', JSON.stringify(versions));
JSEOF

echo ""
echo "============================================================"
echo "Done. Build structure:"
echo "  $BUILD_DIR"
echo "  $VERSION_DIR"
echo "  $INDEX_HTML"
echo "  $VERSIONS_JSON"
echo "============================================================"
