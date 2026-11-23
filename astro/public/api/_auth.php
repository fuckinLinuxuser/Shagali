<?php
// Общее для личного кабинета: сессия, CSRF, ответы JSON, хеши для лимитов. Файл с «_» закрыт из веба (.htaccess).
require_once __DIR__ . '/_db.php';

const POLICY_VERSION_DEFAULT = '2026-11-draft'; // та же версия, что в forms.php и src/data/operator.json (сверяет тест)

function auth_json(int $code, array $body = []): never {
    http_response_code($code);
    echo json_encode($body, JSON_UNESCAPED_UNICODE);
    exit;
}

function auth_is_https(): bool {
    return !empty($_SERVER['HTTPS']) || ($_SERVER['HTTP_X_FORWARDED_PROTO'] ?? '') === 'https';
}

// Сессия кабинета: cookie HttpOnly, Secure (на https), SameSite=Lax. Отдельное имя — не пересекается с сессией админки.
function auth_session(): void {
    if (session_status() === PHP_SESSION_ACTIVE) return;
    session_name('shagali_sid');
    session_set_cookie_params([
        'lifetime' => 0,
        'path' => '/',
        'secure' => auth_is_https(),
        'httponly' => true,
        'samesite' => 'Lax',
    ]);
    session_start();
}

function auth_csrf_token(): string {
    auth_session();
    if (empty($_SESSION['csrf'])) $_SESSION['csrf'] = bin2hex(random_bytes(16));
    return $_SESSION['csrf'];
}

// Любой POST — только с токеном из сессии в заголовке X-CSRF-Token.
function auth_require_csrf(): void {
    auth_session();
    $sent = (string)($_SERVER['HTTP_X_CSRF_TOKEN'] ?? '');
    $expected = (string)($_SESSION['csrf'] ?? '');
    if ($expected === '' || !hash_equals($expected, $sent)) auth_json(403, ['error' => 'Bad CSRF token']);
}

function auth_input(): array {
    $decoded = json_decode(file_get_contents('php://input') ?: '', true);
    return is_array($decoded) ? $decoded : [];
}

function auth_str(array $in, string $key): string {
    return is_scalar($in[$key] ?? null) ? trim((string)$in[$key]) : '';
}

// Соль + SHA-256: в БД лимитов нет ни почты, ни IP в открытом виде.
function auth_hash(string $value): string {
    return hash('sha256', (string)(shagali_config()['rate_salt'] ?? '') . '|' . $value);
}

function auth_site_url(): string {
    return rtrim((string)(shagali_config()['site_url'] ?? 'https://shagali.ru'), '/');
}

function auth_policy_version(): string {
    return (string)(shagali_config()['policy_version'] ?? POLICY_VERSION_DEFAULT);
}

const BACKSTAGE_MIN_USES = 10; // с стольких использований агентского кода открывается закулисье

// Какие обязательные поля профиля пусты (ключи полей). Пока что-то пусто — промокод не показываем.
function auth_profile_missing(array $user): array {
    return array_values(array_filter(['last_name', 'first_name', 'city', 'phone'], static fn($k) => trim((string)($user[$k] ?? '')) === ''));
}

// Агентский код пользователя (или null): код, число использований, открыто ли закулисье.
function auth_agent(PDO $pdo, int $userId): ?array {
    $q = $pdo->prepare('SELECT code, uses FROM agent_codes WHERE user_id = ?');
    $q->execute([$userId]);
    $row = $q->fetch();
    if (!$row) return null;
    return ['code' => $row['code'], 'uses' => (int)$row['uses'], 'backstage' => (int)$row['uses'] >= BACKSTAGE_MIN_USES];
}

// Вошедший пользователь (id) с подтверждённой почтой или 0.
function auth_current_user_id(PDO $pdo): int {
    auth_session();
    $id = (int)($_SESSION['uid'] ?? 0);
    if ($id < 1) return 0;
    $q = $pdo->prepare('SELECT 1 FROM users WHERE id = ? AND email_verified_at IS NOT NULL');
    $q->execute([$id]);
    return $q->fetchColumn() ? $id : 0;
}
