<?php
// Применяет sql/*.sql, которых ещё нет в schema_migrations. Запуск из CLI: php sql/migrate.php <путь к astro/public/api>
// Стенд вызывает его при старте контейнера. На проде первая миграция применяется вручную (см. комментарий в 001_init.sql).
if (PHP_SAPI !== 'cli') { http_response_code(403); exit; }

require rtrim($argv[1] ?? '/var/www/html/api', '/') . '/_db.php';

$pdo = null;
for ($i = 0; $i < 30 && !$pdo; $i++) { // MySQL в контейнере поднимается дольше PHP
    try { $pdo = shagali_db(); } catch (Throwable $e) { sleep(2); }
}
if (!$pdo) { fwrite(STDERR, "migrate: БД недоступна\n"); exit(1); }

$pdo->exec('CREATE TABLE IF NOT EXISTS schema_migrations (version VARCHAR(100) NOT NULL PRIMARY KEY, applied_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4');
$done = $pdo->query('SELECT version FROM schema_migrations')->fetchAll(PDO::FETCH_COLUMN);
$files = glob(__DIR__ . '/*.sql');
sort($files);
foreach ($files as $file) {
    $version = basename($file, '.sql');
    if (in_array($version, $done, true)) continue;
    $pdo->exec(file_get_contents($file));
    $pdo->prepare('INSERT IGNORE INTO schema_migrations (version) VALUES (?)')->execute([$version]);
    echo "migrate: применена $version\n";
}
