#!/bin/bash
# Quills & Scrolls — one-click launcher for Mac.
# Double-click this file. On the first run it installs everything it needs
# (a private copy of Node.js if your Mac doesn't have one, then the app files)
# and then it starts the app and opens your browser. Nothing to download by hand.

cd "$(dirname "$0")" || exit 1

NODE_VERSION="v20.18.1"

# ── 1. Make sure Node.js is available ────────────────────────────────────────
if command -v node >/dev/null 2>&1; then
  : # Node is already installed on this Mac — use it.
elif [ -x ".runtime/node/bin/node" ]; then
  # A private copy was installed on a previous run — use it.
  export PATH="$PWD/.runtime/node/bin:$PATH"
else
  echo ""
  echo "Setting up Node.js (first time only, please wait a minute)..."
  case "$(uname -m)" in
    arm64) NODE_ARCH="arm64" ;;   # Apple Silicon (M1/M2/M3...)
    *)     NODE_ARCH="x64"   ;;   # Intel
  esac
  URL="https://nodejs.org/dist/$NODE_VERSION/node-$NODE_VERSION-darwin-$NODE_ARCH.tar.gz"
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

# ── 2. Install the app files (first time only) ───────────────────────────────
if [ ! -d node_modules ]; then
  echo ""
  echo "Installing app files (first time only, may take a minute)..."
  if ! npm install; then
    echo ""
    echo "Something went wrong installing the app files."
    read -n 1 -s -r -p "Press any key to close..."
    exit 1
  fi
fi

# ── 3. Start the app and open the browser ────────────────────────────────────
echo ""
echo "Clearing any previous sessions..."
lsof -ti:5173 | xargs kill -9 2>/dev/null
lsof -ti:5174 | xargs kill -9 2>/dev/null
sleep 1

echo "Starting Quills & Scrolls..."
npm run dev &

echo "Waiting for the app to be ready..."
until curl -s http://127.0.0.1:5173 > /dev/null && curl -s http://127.0.0.1:5174/api/characters > /dev/null; do
  sleep 1
done

echo "Ready! Opening your browser..."
open http://localhost:5173
wait
