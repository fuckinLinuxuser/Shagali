#!/bin/sh
# Создаёт docker/config.local.php (в .gitignore) с тестовыми значениями для стенда, если файла нет или он без блока 'db'.
# Пароль админки стенда: local-admin-pw, пароль входа на закрытый сайт (заглушка): stand-gate-pw. Реквизиты БД — те же, что в docker-compose.yml (MYSQL_ROOT_PASSWORD). Только для localhost.
# Письма на стенде уходят в mailpit (http://localhost:8025), наружу ничего не отправляется (notify_email пуст).
set -e
cd "$(dirname "$0")"
if [ -f config.local.php ] && grep -q "'db'" config.local.php && grep -q "'gate_password_hash'" config.local.php && grep -q "'smtp'" config.local.php; then echo "docker/config.local.php уже есть"; exit 0; fi
HASH=$(php -r 'echo password_hash("local-admin-pw", PASSWORD_DEFAULT);')
GATE=$(php -r 'echo password_hash("stand-gate-pw", PASSWORD_DEFAULT);')
cat > config.local.php <<PHP
<?php
return [
    'admin_password_hash' => '$HASH',
    'db' => ['dsn' => 'mysql:host=db;dbname=shagali;charset=utf8mb4', 'user' => 'root', 'pass' => 'local-root-only'],
    'gate_password_hash' => '$GATE',
    'rate_salt' => 'local-stand-salt',
    // Письма стенда уходят в mailpit (http://localhost:8025), наружу ничего не отправляется.
    'smtp' => ['host' => 'mailpit', 'port' => 1025],
    'site_url' => 'http://localhost:8080',
    'mail_from' => 'no-reply@localhost',
    'notify_email' => '',
];
PHP
echo "создан docker/config.local.php"
