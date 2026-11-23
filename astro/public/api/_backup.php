<?php
// Дамп БД для ежедневного бэкапа. Запуск — только из консоли (планировщик reg.ru):
//   php /var/www/u3413841/data/www/shagali.ru/api/_backup.php
// Конфиг (shagali-config.php): 'backup_dir' — папка ВНЕ корня сайта (обязательно), 'backup_keep_days' — сколько дней хранить (по умолчанию 14).
// Результат: <backup_dir>/shagali-ГГГГММДД-ЧЧММСС.sql.gz (права 600). Восстановление: gunzip -c файл | mysql -u… -p… база. См. docs/BACKUP.md.
// Дамп содержит ПДн — папку не публиковать и не отправлять в сторонние сервисы (152-ФЗ).
if (PHP_SAPI !== 'cli') {
    http_response_code(403);
    exit;
}
require __DIR__ . '/_db.php';

function backup_fail(string $msg): never {
    fwrite(STDERR, "backup: $msg\n");
    exit(1);
}

$config = shagali_config();
$dir = rtrim((string)($config['backup_dir'] ?? ''), '/');
if ($dir === '') backup_fail("в shagali-config.php не задан 'backup_dir'");
if (!is_dir($dir) && !mkdir($dir, 0700, true)) backup_fail("не удалось создать $dir");
$keepDays = max(1, (int)($config['backup_keep_days'] ?? 14));

try {
    $pdo = shagali_db();
} catch (Throwable $e) {
    backup_fail('нет подключения к БД');
}

$ident = static fn(string $name): string => '`' . str_replace('`', '``', $name) . '`';
$final = $dir . '/shagali-' . gmdate('Ymd-His') . '.sql.gz';
$tmp = $final . '.part';
$gz = gzopen($tmp, 'wb9');
if (!$gz) backup_fail("не удалось записать $tmp");
chmod($tmp, 0600);

gzwrite($gz, "-- Дамп БД shagali, " . gmdate('Y-m-d H:i:s') . " UTC\nSET NAMES utf8mb4;\nSET FOREIGN_KEY_CHECKS = 0;\nSET time_zone = '+00:00';\n\n");
$tables = $pdo->query("SHOW FULL TABLES WHERE Table_type = 'BASE TABLE'")->fetchAll(PDO::FETCH_COLUMN);
foreach ($tables as $table) {
    $t = $ident($table);
    $create = $pdo->query("SHOW CREATE TABLE $t")->fetch(PDO::FETCH_NUM)[1];
    gzwrite($gz, "DROP TABLE IF EXISTS $t;\n$create;\n\n");
    $offset = 0;
    do {
        $rows = $pdo->query("SELECT * FROM $t LIMIT 500 OFFSET $offset")->fetchAll(PDO::FETCH_NUM);
        if (!$rows) break;
        $values = array_map(static function (array $row) use ($pdo): string {
            return '(' . implode(',', array_map(static function ($v) use ($pdo) {
                if ($v === null) return 'NULL';
                if (is_int($v) || is_float($v)) return (string)$v;
                return $pdo->quote((string)$v);
            }, $row)) . ')';
        }, $rows);
        gzwrite($gz, "INSERT INTO $t VALUES\n" . implode(",\n", $values) . ";\n");
        $offset += 500;
    } while (count($rows) === 500);
    gzwrite($gz, "\n");
}
gzwrite($gz, "SET FOREIGN_KEY_CHECKS = 1;\n");
gzclose($gz);
if (!rename($tmp, $final)) backup_fail('не удалось сохранить файл дампа');

// Ротация: старше keep_days удаляем
foreach (glob($dir . '/shagali-*.sql.gz') ?: [] as $old) {
    if ($old !== $final && filemtime($old) < time() - $keepDays * 86400) @unlink($old);
}
echo $final . "\n";
