#!/bin/bash
# Quills & Scrolls — one-click launcher for Mac.
# Double-click this file. On the first run it installs everything it needs
# (a private copy of Node.js if your Mac doesn't have one, then the app files)
# and then it starts the app and opens your browser. Nothing to download by hand.

cd "$(dirname "$0")" || exit 1

NODE_VERSION="v24.22.3"

# Exit code 0 if the given node is 22.12 or newer (what the app's tools need)
node_new_enough() {
  "$1" -e "const [a,b]=process.versions.node.split('.').map(Number);process.exit(a>22||(a===22&&b>=12)?0:1)" 2>/dev/null
}

# ── 1. Make sure a recent enough Node.js is available ────────────────────────
if command -v node >/dev/null 2>&1 && node_new_enough node; then
  : # This Mac's own Node.js is recent enough — use it.
elif [ -x ".runtime/node/bin/node" ] && [ "$(.runtime/node/bin/node -v)" = "$NODE_VERSION" ]; then
  # The private copy from an earlier run is the right version — use it.
  export PATH="$PWD/.runtime/node/bin:$PATH"
else
  echo ""
  echo "Setting up Node.js (only needed once, please wait a minute)..."
  case "$(uname -m)" in
    arm64) NODE_ARCH="arm64" ;;   # Apple Silicon (M1/M2/M3...)
    *)     NODE_ARCH="x64"   ;;   # Intel
  esac
  URL="https://nodejs.org/dist/$NODE_VERSION/node-$NODE_VERSION-darwin-$NODE_ARCH.tar.gz"
  # An older private copy is replaced
  rm -rf .runtime/node ".runtime/node-$NODE_VERSION-darwin-$NODE_ARCH"
  mkdir -p .runtime
  if curl -fL "$URL" -o .runtime/node.tar.gz \
     && tar -xzf .runtime/node.tar.gz -C .runtime \
     && mv ".runtime/node-$NODE_VERSION-darwin-$NODE_ARCH" .runtime/node; then
    rm -f .runtime/node.tar.gz
    export PATH="$PWD/.runtime/node/bin:$PATH"
  else
    echo ""
    echo "Could not set up Node.js automatically (are you online?)."
    echo "You can also install it yourself from https://nodejs.org and try again."
    read -n 1 -s -r -p "Press any key to close..."
    exit 1
  fi
fi

# ── 2. Install the app files (first time, and again after an update) ────────
# A copy of package-lock.json is kept after each install; if the current one differs,
# the app's files changed (an update) and are installed again.
if [ ! -d node_modules ] || ! node -e "const fs=require('fs');try{process.exit(fs.readFileSync('package-lock.json','utf8')===fs.readFileSync('node_modules/.qs-installed-lock','utf8')?0:1)}catch(e){process.exit(1)}" 2>/dev/null; then
  echo ""
  echo "Installing app files (may take a minute)..."
  if ! npm install; then
    echo ""
    echo "Something went wrong installing the app files."
    read -n 1 -s -r -p "Press any key to close..."
    exit 1
  fi
  node -e "require('fs').copyFileSync('package-lock.json','node_modules/.qs-installed-lock')"
fi

# ── 3. Start the app and open the browser ────────────────────────────────────
echo ""
echo "Clearing any previous sessions..."
lsof -ti:5173 | xargs kill -9 2>/dev/null
lsof -ti:5174 | xargs kill -9 2>/dev/null
sleep 1

echo "Starting Quills & Scrolls..."
# npm start builds the app first when it has changed (a few seconds), then serves it on port 5173
npm start &

echo "Waiting for the app to be ready..."
# "localhost", which curl tries over IPv6 and IPv4
until curl -s http://localhost:5173/api/characters > /dev/null; do
  sleep 1
done

echo "Ready! Opening your browser..."
open http://localhost:5173
wait
