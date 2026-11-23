<?php
// GET /api/admin-export.php?type=waitlist|feedback|users — выгрузка в CSV для заказчика. Только админ (сессия /admin).
// 401 без сессии · 400 неизвестный тип · 405 не GET. CSV: разделитель «;» и UTF-8 BOM (Excel открывает без «кракозябр»),
// значения, начинающиеся с = + - @, экранируются апострофом (защита от формул при открытии в Excel).
require __DIR__ . '/_db.php';

const EXPORTS = [
    'waitlist' => ['id', 'name', 'email', 'city', 'project', 'consent_at', 'consent_version', 'created_at'],
    'feedback' => ['id', 'name', 'email', 'city', 'message', 'consent_at', 'consent_version', 'created_at'],
    'users' => ['id', 'email', 'last_name', 'first_name', 'city', 'phone', 'email_verified_at', 'consent_at', 'consent_version', 'created_at'],
];

function export_fail(int $code, string $msg): never {
    http_response_code($code);
    header('Content-Type: application/json; charset=utf-8');
    echo json_encode(['error' => $msg], JSON_UNESCAPED_UNICODE);
    exit;
}

if (($_SERVER['REQUEST_METHOD'] ?? '') !== 'GET') {
    header('Allow: GET');
    export_fail(405, 'Method not allowed');
}

// Та же сессия админа, что в /api.php (параметры cookie совпадают).
$https = !empty($_SERVER['HTTPS']) || ($_SERVER['HTTP_X_FORWARDED_PROTO'] ?? '') === 'https';
session_set_cookie_params(['lifetime' => 0, 'path' => '/', 'secure' => $https, 'httponly' => true, 'samesite' => 'Lax']);
session_start();
if (empty($_SESSION['admin'])) export_fail(401, 'Unauthorized');

$type = (string)($_GET['type'] ?? '');
if (!isset(EXPORTS[$type])) export_fail(400, 'Unknown export type');

function csv_cell($value): string {
    $s = (string)($value ?? '');
    if ($s !== '' && strpbrk($s[0], "=+-@\t\r") !== false) $s = "'" . $s;
    return preg_match('/[;"\r\n]|^\s|\s$/u', $s) || str_contains($s, ',') ? '"' . str_replace('"', '""', $s) . '"' : $s;
}

try {
    $columns = EXPORTS[$type];
    // $type проверен по белому списку выше, значения в запрос не подставляются
    $rows = shagali_db()->query('SELECT ' . implode(', ', $columns) . " FROM $type ORDER BY id")->fetchAll();
} catch (Throwable $e) {
    error_log('admin-export.php: ' . get_class($e));
    export_fail(500, 'Ошибка сервера');
}

header('Content-Type: text/csv; charset=utf-8');
header('Content-Disposition: attachment; filename="' . $type . '-' . gmdate('Y-m-d') . '.csv"');
header('Cache-Control: no-store');
echo "\xEF\xBB\xBF" . implode(';', $columns) . "\r\n";
foreach ($rows as $row) echo implode(';', array_map('csv_cell', $row)) . "\r\n";
