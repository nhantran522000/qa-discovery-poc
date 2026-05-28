#!/usr/bin/env bash
# Apply the v2 change-set to the live site (docs/) to simulate "the product changed".
# Run from the repo root:  bash changeset-v2/apply-v2.sh
# Then commit + push so GitHub Pages redeploys, and run the detection pass.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

echo "Applying v2 change-set into docs/ ..."

# CHANGE 1, 2, 3: overwrite the three modified pages.
cp changeset-v2/docs/index.html     docs/index.html
cp changeset-v2/docs/dashboard.html docs/dashboard.html
cp changeset-v2/docs/profile.html   docs/profile.html

# CHANGE 4: add the brand-new feature page.
cp changeset-v2/docs/activity-log.html docs/activity-log.html

# Bump the route map so the crawler discovers the new page.
cp changeset-v2/routes.v2.json routes.json

echo "Done. Changed: index.html, dashboard.html, profile.html (+ new activity-log.html, routes.json)."
echo "Unchanged controls: settings.html, residents.html"
echo
echo "Next:  git add -A && git commit -m 'feat: v2 change-set' && git push"
