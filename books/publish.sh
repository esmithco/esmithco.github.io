#!/usr/bin/env bash
set -euo pipefail

message="${1:-Add or update book notes}"
node generate-index.mjs
git add index.html notes
git commit -m "$message" || { echo "Nothing new to publish."; exit 0; }
git push
