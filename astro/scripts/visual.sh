#!/bin/sh
# Скриншот-тесты в Linux-контейнере Playwright — той же версии и платформы (linux/amd64), что в CI.
# Нужен поднятый стенд: (cd astro && npm run build) && docker compose up -d
#   sh scripts/visual.sh                       — сверить с базой
#   sh scripts/visual.sh --update-snapshots    — переснять базу (после осознанных изменений вида)
# Доп. аргументы передаются в playwright test.
set -e
cd "$(dirname "$0")/.."

PW_VERSION=$(node -p "require('@playwright/test/package.json').version")
IMAGE="mcr.microsoft.com/playwright:v${PW_VERSION}-noble"

# Стенд снаружи контейнера: в CI — localhost (host-сеть), на Mac — host.docker.internal.
if [ "$(uname)" = "Linux" ]; then
  NET="--network host"; STAND="${STAND_URL:-http://localhost:8080}"
else
  NET=""; STAND="${STAND_URL:-http://host.docker.internal:8080}"
fi

# node_modules хоста не монтируем (на Mac там бинарники под macOS) — свои ставятся в том контейнера.
docker run --rm --platform linux/amd64 $NET \
  -e CI="${CI:-}" -e STAND_URL="$STAND" -e PW_VISUAL=1 \
  -v "$PWD":/work -v shagali-pw-node-modules:/work/node_modules -w /work \
  "$IMAGE" sh -c "npm ci --no-audit --no-fund --loglevel=error && npx playwright test tests/e2e/visual.spec.ts $*"
