<?php
// /api/backstage.php — закрытый контент («закулисье»). Файлы лежат ВНЕ dist и вне корня сайта (конфиг 'backstage_dir'),
// отдаются только вошедшему пользователю, у которого агентский код набрал 10+ использований. Иначе — 403.
//   ?list=1       → {"files": [имя, …]}
//   ?file=<имя>   → файл (поддерживается Range — для видео). Только имена вида name.ext из белого списка расширений.
require_once __DIR__ . '/_auth.php';

const BACKSTAGE_TYPES = [
    'jpg' => 'image/jpeg', 'jpeg' => 'image/jpeg', 'png' => 'image/png', 'webp' => 'image/webp',
    'mp4' => 'video/mp4', 'webm' => 'video/webm', 'pdf' => 'application/pdf', 'txt' => 'text/plain; charset=utf-8',
];

function bs_fail(int $code, string $msg): never {
    http_response_code($code);
    header('Content-Type: application/json; charset=utf-8');
    echo json_encode(['error' => $msg], JSON_UNESCAPED_UNICODE);
    exit;
}

header('Cache-Control: private, no-store');
header('X-Content-Type-Options: nosniff');
if (($_SERVER['REQUEST_METHOD'] ?? '') !== 'GET') {
    header('Allow: GET');
    bs_fail(405, 'Method not allowed');
}

try {
    $pdo = shagali_db();
    $uid = auth_current_user_id($pdo);
    $agent = $uid > 0 ? auth_agent($pdo, $uid) : null;
} catch (Throwable $e) {
    error_log('backstage.php: ' . get_class($e));
    bs_fail(500, 'Ошибка сервера');
}
if (!$agent || !$agent['backstage']) bs_fail(403, 'Forbidden'); // нет сессии или нет доступа — одинаково

$dir = (string)(shagali_config()['backstage_dir'] ?? '');
if ($dir === '' || !is_dir($dir)) bs_fail(503, 'Закулисье не настроено');
$dir = rtrim((string)realpath($dir), '/');

if (isset($_GET['list'])) {
    $files = [];
    foreach (scandir($dir) ?: [] as $f) {
        if (preg_match('/^[A-Za-z0-9][A-Za-z0-9._-]{0,99}$/', $f) && isset(BACKSTAGE_TYPES[strtolower(pathinfo($f, PATHINFO_EXTENSION))]) && is_file("$dir/$f")) $files[] = $f;
    }
    header('Content-Type: application/json; charset=utf-8');
    echo json_encode(['files' => $files], JSON_UNESCAPED_UNICODE);
    exit;
}

$name = is_string($_GET['file'] ?? null) ? $_GET['file'] : '';
if (!preg_match('/^[A-Za-z0-9][A-Za-z0-9._-]{0,99}$/', $name) || str_contains($name, '..')) bs_fail(400, 'Некорректное имя файла');
$ext = strtolower(pathinfo($name, PATHINFO_EXTENSION));
if (!isset(BACKSTAGE_TYPES[$ext])) bs_fail(400, 'Тип файла не поддерживается');
$path = realpath("$dir/$name");
if ($path === false || !is_file($path) || !str_starts_with($path, $dir . '/')) bs_fail(404, 'Файл не найден');

$size = filesize($path);
$start = 0;
$end = $size - 1;
if (preg_match('/^bytes=(\d*)-(\d*)$/', (string)($_SERVER['HTTP_RANGE'] ?? ''), $m) && ($m[1] !== '' || $m[2] !== '')) {
    if ($m[1] === '') { $start = max(0, $size - (int)$m[2]); }
    else { $start = (int)$m[1]; if ($m[2] !== '') $end = min($end, (int)$m[2]); }
    if ($start > $end || $start >= $size) {
        header("Content-Range: bytes */$size");
        bs_fail(416, 'Range not satisfiable');
    }
    http_response_code(206);
    header("Content-Range: bytes $start-$end/$size");
}
header('Content-Type: ' . BACKSTAGE_TYPES[$ext]);
header('Accept-Ranges: bytes');
header('Content-Length: ' . ($end - $start + 1));
$fh = fopen($path, 'rb');
fseek($fh, $start);
$left = $end - $start + 1;
while ($left > 0 && !feof($fh)) {
    $chunk = fread($fh, min(8192, $left));
    if ($chunk === false) break;
    echo $chunk;
    $left -= strlen($chunk);
}
fclose($fh);
