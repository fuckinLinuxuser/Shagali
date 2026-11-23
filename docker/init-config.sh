#!/bin/sh
# Создаёт docker/config.local.php (в .gitignore) с тестовыми значениями для стенда, если файла нет или он без блока 'db'.
# Пароль админки стенда: local-admin-pw. Реквизиты БД — те же, что в docker-compose.yml (MYSQL_ROOT_PASSWORD). Только для localhost.
# Письма на стенде не отправляются (notify_email пуст).
set -e
cd "$(dirname "$0")"
if [ -f config.local.php ] && grep -q "'db'" config.local.php; then echo "docker/config.local.php уже есть"; exit 0; fi
HASH=$(php -r 'echo password_hash("local-admin-pw", PASSWORD_DEFAULT);')
cat > config.local.php <<PHP
<?php
return [
    'admin_password_hash' => '$HASH',
    'db' => ['dsn' => 'mysql:host=db;dbname=shagali;charset=utf8mb4', 'user' => 'root', 'pass' => 'local-root-only'],
    'rate_salt' => 'local-stand-salt',
    'notify_email' => '',
];
PHP
echo "создан docker/config.local.php"
