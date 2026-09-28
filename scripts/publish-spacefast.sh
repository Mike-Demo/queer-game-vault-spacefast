#!/usr/bin/env bash
# Publishes the QueerCade SpaceFast migration to a preview space.
#
# Builds the standalone SPA (vite.spa.config.ts), renames spa.html to
# index.html, generates sitemap.xml from the Sanity catalog, and publishes it
# with the Functions backend. SPA routes are rewritten to /index.html via
# _redirects. Static SEO/AEO files (llms.txt, openapi.json, agent.json,
# carbon.txt, robots.txt) are copied from public/.
#
# Usage: ./scripts/publish-spacefast.sh [space-slug] [message]
set -euo pipefail

SPACE="${1:-queercade-preview}"
MESSAGE="${2:-preview publish}"
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
OUT="$(mktemp -d)/sf-publish"

cd "$ROOT"
bun x vite build --config vite.spa.config.ts

# Static SEO/AEO assets from the public catalog (sitemap, openapi, agent.json, llms-full).
bun scripts/generate-static-assets.ts dist-spa

rm -rf "$OUT"
mkdir -p "$OUT"
cp -a dist-spa/. "$OUT/"
mv "$OUT/spa.html" "$OUT/index.html"
cp -a functions sf.jsonc "$OUT/"

# SEO/AEO + identity files served from the site root.
for f in llms.txt openapi.json .well-known/agent.json carbon.txt robots.txt; do
  if [ -f "public/$f" ]; then
    mkdir -p "$OUT/$(dirname "$f")"
    cp "public/$f" "$OUT/$f"
  fi
done

# SPA fallback: serve index.html for client-side routes.
cat > "$OUT/_redirects" <<'EOF'
/ /index.html 200
/library /index.html 200
/collections /index.html 200
/collections/* /index.html 200
/games/* /index.html 200
/discover /index.html 200
/about /index.html 200
/licenses /index.html 200
/developers /index.html 200
/emoji /index.html 200
/my-library /index.html 200
/settings /index.html 200
/profile/* /index.html 200
/auth /index.html 200
EOF

sf publish "$OUT" --space "$SPACE" -m "$MESSAGE" -y --wait
