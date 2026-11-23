#!/bin/sh
# Запуск сайта локально: сборка → Docker (PHP 8.3 + Apache + MySQL) → http://localhost:8080
#
#   ./start-site.sh              сайт с тестовыми данными (Тестоград, билеты, фильтр городов) — для разработки
#   ./start-site.sh --prod       сайт с боевыми данными, как на проде
#   ./start-site.sh --no-build   без пересборки (если код не менялся)
#   ./start-site.sh --no-open    не открывать браузер
#   ./start-site.sh --stop       остановить контейнеры
set -e
cd "$(dirname "$0")"

URL="http://localhost:8080"
MODE=stand
BUILD=1
OPEN=1

for arg in "$@"; do
  case "$arg" in
    --prod) MODE=prod ;;
    --no-build) BUILD=0 ;;
    --no-open) OPEN=0 ;;
    --stop)
      docker compose down
      exit 0
      ;;
    -h|--help)
      sed -n '2,8p' "$0" | sed 's/^# \{0,1\}//'
      exit 0
      ;;
    *)
      echo "Неизвестный параметр: $arg (справка: ./start-site.sh --help)" >&2
      exit 1
      ;;
  esac
done

# 1. Docker. На Mac при необходимости запускаем Docker Desktop и ждём, пока он поднимется.
if ! docker info >/dev/null 2>&1; then
  if [ "$(uname)" = "Darwin" ]; then
    echo "Запускаю Docker Desktop…"
    open -a Docker
  fi
  for _ in $(seq 1 60); do
    docker info >/dev/null 2>&1 && break
    sleep 3
  done
  docker info >/dev/null 2>&1 || {
    echo "Docker не отвечает. Запустите Docker Desktop и повторите." >&2
    exit 1
  }
fi

# 2. Зависимости и сборка сайта
if [ ! -d astro/node_modules ]; then
  echo "Ставлю зависимости…"
  (cd astro && npm ci)
fi

if [ "$MODE" = "prod" ]; then
  DIST=dist
  BUILD_CMD="build"
else
  DIST=dist-stand
  BUILD_CMD="build:stand"
fi

if [ "$BUILD" = "1" ]; then
  echo "Собираю сайт ($BUILD_CMD)…"
  (cd astro && npm run "$BUILD_CMD")
elif [ ! -d "astro/$DIST" ]; then
  echo "Нет astro/$DIST — запустите без --no-build." >&2
  exit 1
fi

# 3. Конфиг стенда (docker/config.local.php, в .gitignore) — создаётся один раз
sh docker/init-config.sh

# 4. Контейнеры. Веб пересоздаётся, чтобы подхватить свежую сборку; база данных не трогается.
STAND_DIST="$DIST" docker compose up -d --force-recreate web

# 5. Ждём, пока сайт ответит
printf "Жду ответа сайта"
for _ in $(seq 1 30); do
  if curl -s -o /dev/null "$URL/"; then
    echo
    echo "Готово: $URL ($MODE)"
    [ "$OPEN" = "1" ] && [ "$(uname)" = "Darwin" ] && open "$URL"
    exit 0
  fi
  printf "."
  sleep 1
done
echo
echo "Сайт не ответил за 30 секунд. Логи: docker compose logs web" >&2
exit 1
