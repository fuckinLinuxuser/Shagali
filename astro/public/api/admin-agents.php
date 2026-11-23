<?php
// /api/admin-agents.php — агентские коды (только админ, сессия /admin; не-админу — 403).
//   GET                                  → {"codes": [{code, uses, email, updated_at}]}
//   POST {"action":"issue","email":…}    → 201 {"code": …}   (404 нет такого пользователя, 409 код уже выдан)
//   POST {"action":"set_uses","code":…,"uses": N} → 200      (404 нет кода, 422 N не целое 0…100000)
// POST — с заголовком X-CSRF-Token админской сессии. Раз в неделю админ вносит число использований из кабинета cbiletom;
// при 10 и более пользователю открывается закулисье (api/backstage.php).
require __DIR__ . '/_db.php';

header('Content-Type: application/json; charset=utf-8');
header('Cache-Control: no-store');

function agents_json(int $code, array $body): never {
    http_response_code($code);
    echo json_encode($body, JSON_UNESCAPED_UNICODE);
    exit;
}

$https = !empty($_SERVER['HTTPS']) || ($_SERVER['HTTP_X_FORWARDED_PROTO'] ?? '') === 'https';
session_set_cookie_params(['lifetime' => 0, 'path' => '/', 'secure' => $https, 'httponly' => true, 'samesite' => 'Lax']);
session_start(); // та же сессия, что у /api.php и /admin
if (empty($_SESSION['admin'])) agents_json(403, ['error' => 'Forbidden']);

$method = $_SERVER['REQUEST_METHOD'] ?? '';
try {
    $pdo = shagali_db();
    if ($method === 'GET') {
        $rows = $pdo->query('SELECT a.code, a.uses, a.updated_at, u.email FROM agent_codes a JOIN users u ON u.id = a.user_id ORDER BY a.id')->fetchAll();
        agents_json(200, ['codes' => array_map(static fn($r) => ['code' => $r['code'], 'uses' => (int)$r['uses'], 'email' => $r['email'], 'updated_at' => $r['updated_at']], $rows)]);
    }
    if ($method !== 'POST') {
        header('Allow: GET, POST');
        agents_json(405, ['error' => 'Method not allowed']);
    }

    $sent = (string)($_SERVER['HTTP_X_CSRF_TOKEN'] ?? '');
    $expected = (string)($_SESSION['csrf'] ?? '');
    if ($expected === '' || !hash_equals($expected, $sent)) agents_json(403, ['error' => 'Bad CSRF token']);

    $in = json_decode(file_get_contents('php://input') ?: '', true);
    $in = is_array($in) ? $in : [];
    $action = is_string($in['action'] ?? null) ? $in['action'] : '';

    if ($action === 'issue') {
        $email = mb_strtolower(trim(is_string($in['email'] ?? null) ? $in['email'] : ''));
        $q = $pdo->prepare('SELECT id FROM users WHERE email = ?');
        $q->execute([$email]);
        $userId = (int)$q->fetchColumn();
        if ($userId < 1) agents_json(404, ['error' => 'Пользователь не найден']);
        $has = $pdo->prepare('SELECT 1 FROM agent_codes WHERE user_id = ?');
        $has->execute([$userId]);
        if ($has->fetchColumn()) agents_json(409, ['error' => 'У пользователя уже есть код']);
        $alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // без путаницы 0/O, 1/I
        for ($try = 0; $try < 10; $try++) {
            $code = '';
            for ($i = 0; $i < 8; $i++) $code .= $alphabet[random_int(0, strlen($alphabet) - 1)];
            try {
                $pdo->prepare('INSERT INTO agent_codes (user_id, code) VALUES (?, ?)')->execute([$userId, $code]);
                agents_json(201, ['code' => $code]);
            } catch (PDOException $e) {
                if (($e->errorInfo[1] ?? 0) !== 1062) throw $e; // не дубль — настоящая ошибка
            }
        }
        agents_json(500, ['error' => 'Не удалось создать код']);
    }

    if ($action === 'set_uses') {
        $uses = $in['uses'] ?? null;
        if (!is_int($uses) || $uses < 0 || $uses > 100000) agents_json(422, ['error' => 'Число использований — целое от 0 до 100000']);
        $code = is_string($in['code'] ?? null) ? $in['code'] : '';
        $u = $pdo->prepare('UPDATE agent_codes SET uses = ? WHERE code = ?');
        $u->execute([$uses, $code]);
        $exists = $pdo->prepare('SELECT 1 FROM agent_codes WHERE code = ?');
        $exists->execute([$code]);
        if (!$exists->fetchColumn()) agents_json(404, ['error' => 'Код не найден']);
        agents_json(200, ['ok' => true]);
    }
    agents_json(400, ['error' => 'Unknown action']);
} catch (Throwable $e) {
    error_log('admin-agents.php: ' . get_class($e));
    agents_json(500, ['error' => 'Ошибка сервера']);
}
