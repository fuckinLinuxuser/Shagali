<?php
// GET /api/health.php — на каком шаге сломана настройка сервера. Только булевы значения и категория ошибки подключения:
// ни путей, ни логинов, ни паролей, ни текстов исключений. 200 и ok:true, когда всё готово; иначе ok:false (код тоже 200 —
// страница диагностическая, а не проверка живости).
require __DIR__ . '/_db.php';

header('Content-Type: application/json; charset=utf-8');
header('Cache-Control: no-store');
if (($_SERVER['REQUEST_METHOD'] ?? '') !== 'GET') {
    http_response_code(405);
    header('Allow: GET');
    echo json_encode(['error' => 'Method not allowed']);
    exit;
}

const HEALTH_TABLES = ['schema_migrations', 'waitlist', 'feedback', 'rate_limit', 'users', 'login_attempts', 'agent_codes'];
const HEALTH_KEYS = ['rate_salt', 'site_url', 'mail_from', 'notify_email', 'gate_password_hash', 'admin_password_hash'];

$config = shagali_config();
$out = [
    'ok' => false,
    'config_file' => $config !== [],
    'db_config' => is_array($config['db'] ?? null) && !empty($config['db']['dsn']),
    'db_connect' => false,
    'db_error' => null,
    'tables' => array_fill_keys(HEALTH_TABLES, false),
    'keys' => [],
];
foreach (HEALTH_KEYS as $k) $out['keys'][$k] = isset($config[$k]) && $config[$k] !== '';

if ($out['db_config']) {
    try {
        $pdo = shagali_db();
        $out['db_connect'] = true;
        $existing = $pdo->query('SHOW TABLES')->fetchAll(PDO::FETCH_COLUMN);
        foreach (HEALTH_TABLES as $t) $out['tables'][$t] = in_array($t, $existing, true);
    } catch (Throwable $e) {
        $code = $e instanceof PDOException ? (int)($e->errorInfo[1] ?? 0) : 0;
        $out['db_error'] = match (true) {
            $code === 1045 => 'access_denied',       // неверный логин или пароль
            $code === 1044 => 'no_privileges',       // пользователь не привязан к базе
            $code === 1049 => 'unknown_database',    // нет такой базы
            in_array($code, [2002, 2003, 2006], true) => 'unreachable', // сервер БД недоступен (хост/порт)
            default => 'other',
        };
    }
}
$out['ok'] = $out['config_file'] && $out['db_config'] && $out['db_connect'] && !in_array(false, $out['tables'], true)
    && $out['keys']['rate_salt'] && $out['keys']['site_url'] && $out['keys']['mail_from'];
echo json_encode($out, JSON_UNESCAPED_UNICODE);
