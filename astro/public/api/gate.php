<?php
// POST /api/gate.php {"password": "..."} — вход на закрытый сайт (заглушка «в разработке»).
// 200 + cookie shagali_preview=1 · 401 неверный пароль · 429 слишком много неудач · 405 не POST · 503 пароль на сервере не задан.
// Хеш пароля — в shagali-config.php вне корня сайта (ключ gate_password_hash, создаётся password_hash). В репозитории пароля нет.
// ВАЖНО: cookie лишь признак «входил» для заглушки — страницы сайта это не защищает (их отдаёт nginx статикой).
require __DIR__ . '/_db.php';

const MAX_FAILS = 10;
const WINDOW_SEC = 600;

header('Content-Type: application/json; charset=utf-8');
header('Cache-Control: no-store');

function gate_reply(int $code, array $body): never {
    http_response_code($code);
    echo json_encode($body, JSON_UNESCAPED_UNICODE);
    exit;
}

if (($_SERVER['REQUEST_METHOD'] ?? '') !== 'POST') {
    header('Allow: POST');
    gate_reply(405, ['error' => 'Method not allowed']);
}

$config = shagali_config();
$hash = (string)($config['gate_password_hash'] ?? '');
if ($hash === '') gate_reply(503, ['error' => 'Вход не настроен']);

// Лимит неудачных попыток с IP: файл во временной папке, в нём только время попыток (IP — лишь в хеше имени файла).
$key = hash('sha256', (string)($config['rate_salt'] ?? '') . ($_SERVER['REMOTE_ADDR'] ?? ''));
$file = sys_get_temp_dir() . '/shagali-gate-' . substr($key, 0, 32);
$now = time();
$fails = [];
if (is_file($file)) {
    $decoded = json_decode((string)@file_get_contents($file), true);
    if (is_array($decoded)) $fails = array_values(array_filter($decoded, static fn($t) => is_int($t) && $t > $now - WINDOW_SEC));
}
if (count($fails) >= MAX_FAILS) {
    header('Retry-After: ' . WINDOW_SEC);
    gate_reply(429, ['error' => 'Слишком много попыток']);
}

$in = json_decode(file_get_contents('php://input') ?: '', true);
$password = is_array($in) && is_string($in['password'] ?? null) ? $in['password'] : '';

if ($password === '' || !password_verify($password, $hash)) {
    $fails[] = $now;
    @file_put_contents($file, json_encode($fails), LOCK_EX);
    usleep(400000); // притормаживаем перебор
    gate_reply(401, ['error' => 'Неверный пароль']);
}

setcookie('shagali_preview', '1', [
    'expires' => $now + 60 * 60 * 24 * 30,
    'path' => '/',
    'secure' => !empty($_SERVER['HTTPS']) || ($_SERVER['HTTP_X_FORWARDED_PROTO'] ?? '') === 'https',
    'httponly' => false, // читает скрипт заглушки
    'samesite' => 'Lax',
]);
gate_reply(200, ['ok' => true]);
