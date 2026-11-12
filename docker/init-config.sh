#!/bin/sh
# Создаёт docker/config.local.php (в .gitignore) с тестовым паролем админки стенда, если файла ещё нет.
# Пароль стенда: local-admin-pw (только для localhost; прод-пароль задаётся отдельно).
set -e
cd "$(dirname "$0")"
if [ -f config.local.php ]; then echo "docker/config.local.php уже есть"; exit 0; fi
HASH=$(php -r 'echo password_hash("local-admin-pw", PASSWORD_DEFAULT);')
printf "<?php\nreturn ['admin_password_hash' => '%s'];\n" "$HASH" > config.local.php
echo "создан docker/config.local.php"
