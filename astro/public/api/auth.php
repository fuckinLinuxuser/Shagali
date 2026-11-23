<?php
// /api/auth.php?action=… — личный кабинет: регистрация, подтверждение почты, вход, выход, сброс пароля.
//   GET : csrf, me (всегда 200: user = null, если не вошёл)
//   POST: register, verify, login, logout, reset_request, reset_confirm, delete_account   (все — с заголовком X-CSRF-Token)
// Ответы: JSON. 201/200 успех · 400 неверный токен · 401 не вошёл/неверные данные · 403 нет CSRF или почта не подтверждена ·
// 405/404 · 422 ошибки полей · 429 лимит. Пароль — только password_hash; токены писем — в БД только SHA-256.
require_once __DIR__ . '/_auth.php';
require_once __DIR__ . '/_mail.php';

const LOGIN_MAX_FAILS = 5;       // неудач на одну почту
const LOGIN_WINDOW_MIN = 15;     // за окно
const LOGIN_IP_MAX_FAILS = 30;   // неудач с одного IP (защита от перебора по многим почтам)
const FORM_RATE_MAX = 10;        // регистраций и сбросов в минуту с IP
const MIN_PASSWORD = 8;
// Хеш нужен, чтобы время ответа для неизвестной почты не выдавало, что её нет.
const DUMMY_HASH = '$2y$12$RhUe.KEqWpvXUfo1UU.TKOaBwOZl/4t.uKYszj/gftUVi1IPDwne.';

header('Content-Type: application/json; charset=utf-8');
header('Cache-Control: no-store');

$action = (string)($_GET['action'] ?? '');
$method = $_SERVER['REQUEST_METHOD'] ?? '';
$GET_ACTIONS = ['csrf', 'me'];
$POST_ACTIONS = ['register', 'verify', 'login', 'logout', 'reset_request', 'reset_confirm', 'delete_account'];
if (!in_array($action, array_merge($GET_ACTIONS, $POST_ACTIONS), true)) auth_json(404, ['error' => 'Unknown action']);
$expected = in_array($action, $GET_ACTIONS, true) ? 'GET' : 'POST';
if ($method !== $expected) {
    header("Allow: $expected");
    auth_json(405, ['error' => 'Method not allowed']);
}

try {
    $pdo = shagali_db();
    $ip = auth_hash($_SERVER['REMOTE_ADDR'] ?? '');

    if ($action === 'csrf') auth_json(200, ['csrf' => auth_csrf_token()]);
    if ($action === 'me') auth_me($pdo);

    auth_require_csrf();
    $in = auth_input();
    match ($action) {
        'register' => auth_register($pdo, $in, $ip),
        'verify' => auth_verify($pdo, $in),
        'login' => auth_login($pdo, $in, $ip),
        'logout' => auth_logout(),
        'reset_request' => auth_reset_request($pdo, $in, $ip),
        'reset_confirm' => auth_reset_confirm($pdo, $in),
        'delete_account' => auth_delete_account($pdo, $in),
    };
} catch (Throwable $e) {
    error_log('auth.php: ' . get_class($e)); // без текста: в нём бывают данные запроса
    auth_json(500, ['error' => 'Ошибка сервера, попробуйте позже']);
}

function auth_form_rate(PDO $pdo, string $ip): void {
    $pdo->exec('DELETE FROM rate_limit WHERE hit_at < NOW() - INTERVAL 1 HOUR');
    $q = $pdo->prepare('SELECT COUNT(*) FROM rate_limit WHERE ip_hash = ? AND hit_at > NOW() - INTERVAL 60 SECOND');
    $q->execute([$ip]);
    if ((int)$q->fetchColumn() >= FORM_RATE_MAX) {
        header('Retry-After: 60');
        auth_json(429, ['error' => 'Слишком много запросов, попробуйте через минуту']);
    }
    $pdo->prepare('INSERT INTO rate_limit (ip_hash) VALUES (?)')->execute([$ip]);
}

function auth_new_token(): array {
    $token = bin2hex(random_bytes(32));
    return [$token, hash('sha256', $token)];
}

function auth_user_public(array $u): array {
    return [
        'email' => $u['email'], 'last_name' => $u['last_name'], 'first_name' => $u['first_name'],
        'city' => $u['city'], 'phone' => $u['phone'],
    ];
}

function auth_me(PDO $pdo): never {
    auth_session();
    $id = (int)($_SESSION['uid'] ?? 0);
    if ($id > 0) {
        $q = $pdo->prepare('SELECT email, last_name, first_name, city, phone FROM users WHERE id = ? AND email_verified_at IS NOT NULL');
        $q->execute([$id]);
        if ($u = $q->fetch()) auth_json(200, ['user' => auth_user_public($u), 'csrf' => auth_csrf_token()]);
    }
    // 200, а не 401: страницы проверяют сессию на каждой загрузке, и 401 шумел бы в консоли браузера (как /api.php?action=status)
    auth_json(200, ['user' => null, 'csrf' => auth_csrf_token()]);
}

function auth_register(PDO $pdo, array $in, string $ip): never {
    auth_form_rate($pdo, $ip);
    $errors = [];
    $email = mb_strtolower(auth_str($in, 'email'));
    if (mb_strlen($email) > 254 || !filter_var($email, FILTER_VALIDATE_EMAIL)) $errors['email'] = 'Укажите корректный email';
    $password = is_string($in['password'] ?? null) ? $in['password'] : '';
    if (mb_strlen($password) < MIN_PASSWORD || mb_strlen($password) > 200) $errors['password'] = 'Пароль — от ' . MIN_PASSWORD . ' символов';
    $last = auth_str($in, 'last_name');
    if ($last === '' || mb_strlen($last) > 100) $errors['last_name'] = 'Укажите фамилию';
    $first = auth_str($in, 'first_name');
    if ($first === '' || mb_strlen($first) > 100) $errors['first_name'] = 'Укажите имя';
    $city = auth_str($in, 'city');
    if ($city === '' || mb_strlen($city) > 120) $errors['city'] = 'Укажите город';
    $phone = preg_replace('/\D+/', '', auth_str($in, 'phone')) ?? '';
    if (strlen($phone) === 11 && $phone[0] === '8') $phone = '7' . substr($phone, 1);
    if (strlen($phone) < 10 || strlen($phone) > 15) $errors['phone'] = 'Укажите телефон';
    if (!in_array($in['consent'] ?? null, [true, 1, '1', 'true', 'on'], true)) $errors['consent'] = 'Нужно согласие на обработку персональных данных';
    if ($errors) auth_json(422, ['ok' => false, 'errors' => $errors]);

    $q = $pdo->prepare('SELECT id FROM users WHERE email = ?');
    $q->execute([$email]);
    if ($q->fetch()) {
        // Ответ тот же, что при успехе (иначе по форме можно проверять, кто зарегистрирован); владельцу почты — письмо.
        shagali_send_mail($email, 'Вы уже зарегистрированы',
            "Эта почта уже есть на сайте Мир За Сценой.\nВойти: " . auth_site_url() . "/lk/login\nЗабыли пароль: " . auth_site_url() . "/lk/reset\n");
        auth_json(201, ['ok' => true]);
    }

    [$token, $tokenHash] = auth_new_token();
    $pdo->prepare('INSERT INTO users (email, password_hash, last_name, first_name, city, phone, verify_token_hash, verify_expires, consent_at, consent_version)
                   VALUES (?, ?, ?, ?, ?, ?, ?, NOW() + INTERVAL 24 HOUR, NOW(), ?)')
        ->execute([$email, password_hash($password, PASSWORD_DEFAULT), $last, $first, $city, $phone, $tokenHash, auth_policy_version()]);
    shagali_send_mail($email, 'Подтвердите почту',
        "Здравствуйте, $first!\nЧтобы завершить регистрацию, подтвердите почту (ссылка действует 24 часа):\n"
        . auth_site_url() . "/lk/verify?token=$token\n\nЕсли это были не вы, просто проигнорируйте письмо.\n");
    auth_json(201, ['ok' => true]);
}

function auth_verify(PDO $pdo, array $in): never {
    $token = auth_str($in, 'token');
    if (!preg_match('/^[a-f0-9]{64}$/', $token)) auth_json(400, ['error' => 'Ссылка недействительна или устарела']);
    $u = $pdo->prepare('UPDATE users SET email_verified_at = NOW(), verify_token_hash = NULL, verify_expires = NULL
                        WHERE verify_token_hash = ? AND verify_expires > NOW()');
    $u->execute([hash('sha256', $token)]);
    if ($u->rowCount() !== 1) auth_json(400, ['error' => 'Ссылка недействительна или устарела']);
    auth_json(200, ['ok' => true]);
}

function auth_login(PDO $pdo, array $in, string $ip): never {
    $email = mb_strtolower(auth_str($in, 'email'));
    $password = is_string($in['password'] ?? null) ? $in['password'] : '';
    $emailKey = auth_hash($email);

    $pdo->exec('DELETE FROM login_attempts WHERE attempted_at < NOW() - INTERVAL 1 DAY');
    $byEmail = $pdo->prepare('SELECT COUNT(*) FROM login_attempts WHERE email_hash = ? AND attempted_at > NOW() - INTERVAL ' . LOGIN_WINDOW_MIN . ' MINUTE');
    $byEmail->execute([$emailKey]);
    $byIp = $pdo->prepare('SELECT COUNT(*) FROM login_attempts WHERE ip_hash = ? AND attempted_at > NOW() - INTERVAL ' . LOGIN_WINDOW_MIN . ' MINUTE');
    $byIp->execute([$ip]);
    if ((int)$byEmail->fetchColumn() >= LOGIN_MAX_FAILS || (int)$byIp->fetchColumn() >= LOGIN_IP_MAX_FAILS) {
        header('Retry-After: ' . (LOGIN_WINDOW_MIN * 60));
        auth_json(429, ['error' => 'Слишком много неудачных попыток. Попробуйте позже.']);
    }

    $q = $pdo->prepare('SELECT id, password_hash, email_verified_at FROM users WHERE email = ?');
    $q->execute([$email]);
    $user = $q->fetch() ?: null;
    $ok = password_verify($password, $user['password_hash'] ?? DUMMY_HASH) && $user !== null;
    if (!$ok) {
        $pdo->prepare('INSERT INTO login_attempts (email_hash, ip_hash) VALUES (?, ?)')->execute([$emailKey, $ip]);
        auth_json(401, ['error' => 'Неверная почта или пароль']);
    }
    if ($user['email_verified_at'] === null) auth_json(403, ['error' => 'Подтвердите почту: мы отправили письмо со ссылкой']);

    $pdo->prepare('DELETE FROM login_attempts WHERE email_hash = ?')->execute([$emailKey]);
    auth_session();
    session_regenerate_id(true); // защита от фиксации сессии
    $_SESSION['uid'] = (int)$user['id'];
    $_SESSION['csrf'] = bin2hex(random_bytes(16));
    auth_json(200, ['ok' => true, 'csrf' => $_SESSION['csrf']]);
}

function auth_logout(): never {
    auth_session();
    $_SESSION = [];
    $p = session_get_cookie_params();
    setcookie(session_name(), '', ['expires' => time() - 3600, 'path' => $p['path'], 'secure' => $p['secure'], 'httponly' => true, 'samesite' => 'Lax']);
    session_destroy();
    auth_json(200, ['ok' => true]);
}

function auth_reset_request(PDO $pdo, array $in, string $ip): never {
    auth_form_rate($pdo, $ip);
    $email = mb_strtolower(auth_str($in, 'email'));
    $q = $pdo->prepare('SELECT id, first_name FROM users WHERE email = ? AND email_verified_at IS NOT NULL');
    $q->execute([$email]);
    if ($u = $q->fetch()) {
        [$token, $hash] = auth_new_token();
        $pdo->prepare('UPDATE users SET reset_token_hash = ?, reset_expires = NOW() + INTERVAL 1 HOUR WHERE id = ?')->execute([$hash, $u['id']]);
        shagali_send_mail($email, 'Сброс пароля',
            "Здравствуйте, {$u['first_name']}!\nЧтобы задать новый пароль, перейдите по ссылке (действует 1 час):\n"
            . auth_site_url() . "/lk/reset?token=$token\n\nЕсли вы не запрашивали сброс, просто проигнорируйте письмо.\n");
    }
    auth_json(200, ['ok' => true]); // тот же ответ для любой почты
}

function auth_reset_confirm(PDO $pdo, array $in): never {
    $password = is_string($in['password'] ?? null) ? $in['password'] : '';
    if (mb_strlen($password) < MIN_PASSWORD || mb_strlen($password) > 200) {
        auth_json(422, ['ok' => false, 'errors' => ['password' => 'Пароль — от ' . MIN_PASSWORD . ' символов']]);
    }
    $token = auth_str($in, 'token');
    if (!preg_match('/^[a-f0-9]{64}$/', $token)) auth_json(400, ['error' => 'Ссылка недействительна или устарела']);
    // Токен гасится тем же запросом, что меняет пароль: второй раз он не сработает. Сброс подтверждает и владение почтой.
    $u = $pdo->prepare('UPDATE users SET password_hash = ?, reset_token_hash = NULL, reset_expires = NULL,
                        email_verified_at = COALESCE(email_verified_at, NOW())
                        WHERE reset_token_hash = ? AND reset_expires > NOW()');
    $u->execute([password_hash($password, PASSWORD_DEFAULT), hash('sha256', $token)]);
    if ($u->rowCount() !== 1) auth_json(400, ['error' => 'Ссылка недействительна или устарела']);
    auth_json(200, ['ok' => true]);
}

// Удаление аккаунта (152-ФЗ): нужен вход и текущий пароль. Вместе с пользователем удаляются заявки с его почты
// (лист ожидания и обратная связь), сессия закрывается.
function auth_delete_account(PDO $pdo, array $in): never {
    auth_session();
    $id = (int)($_SESSION['uid'] ?? 0);
    if ($id < 1) auth_json(401, ['error' => 'Не выполнен вход']);
    $q = $pdo->prepare('SELECT email, password_hash FROM users WHERE id = ?');
    $q->execute([$id]);
    $u = $q->fetch();
    $password = is_string($in['password'] ?? null) ? $in['password'] : '';
    if (!$u || !password_verify($password, $u['password_hash'])) auth_json(401, ['error' => 'Неверный пароль']);

    $pdo->beginTransaction();
    $pdo->prepare('DELETE FROM waitlist WHERE email = ?')->execute([$u['email']]);
    $pdo->prepare('DELETE FROM feedback WHERE email = ?')->execute([$u['email']]);
    $pdo->prepare('DELETE FROM users WHERE id = ?')->execute([$id]);
    $pdo->commit();
    auth_logout();
}
