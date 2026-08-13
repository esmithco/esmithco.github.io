#!/usr/bin/env bash
set -euo pipefail

message="${1:-Add or update personal site content}"
(cd books && node generate-index.mjs)
git add .
git commit -m "$message" || { echo "Nothing new to publish."; exit 0; }
git push
