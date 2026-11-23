<?php
// Общее для PHP-скриптов API: конфиг и подключение к БД. Секреты — только в shagali-config.php вне корня сайта:
//   прод: /var/www/u3413841/data/shagali-config.php, стенд/тесты: путь в SHAGALI_CONFIG. Шаблон — shagali-config.example.php.
// Файл начинается с «_» и закрыт из веба в .htaccess.

// Заголовки безопасности для всех ответов PHP-скриптов, которые подключают этот файл.
header('X-Content-Type-Options: nosniff');
header('Referrer-Policy: strict-origin-when-cross-origin');

function shagali_config(): array {
    static $config = null;
    if ($config !== null) return $config;
    $path = getenv('SHAGALI_CONFIG') ?: dirname(__DIR__, 3) . '/shagali-config.php';
    $loaded = is_file($path) ? include $path : null;
    return $config = is_array($loaded) ? $loaded : [];
}

function shagali_db(): PDO {
    $db = shagali_config()['db'] ?? null;
    if (!is_array($db) || empty($db['dsn'])) throw new RuntimeException('db config missing');
    return new PDO($db['dsn'], $db['user'] ?? '', $db['pass'] ?? '', [
        PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
        PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
        PDO::ATTR_EMULATE_PREPARES => false,
        PDO::MYSQL_ATTR_INIT_COMMAND => "SET NAMES utf8mb4, time_zone = '+00:00'",
    ]);
}
