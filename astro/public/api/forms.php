<?php
// POST /api/forms.php — лист ожидания (type=waitlist) и обратная связь (type=feedback).
// Ответы: 201 сохранено · 200 honeypot (молча, ничего не пишем) · 422 ошибки полей · 429 лимит · 405 не POST · 500 сбой сервера.
// Защита: honeypot (поле website), минимальное время заполнения, лимит 5 запросов в минуту с IP (хранится хеш),
// PDO с подготовленными запросами. Согласие на обработку ПДн обязательно: пишутся момент и версия политики.
require __DIR__ . '/_db.php';

const MIN_FILL_MS = 3000;
const RATE_LIMIT = 5;
const RATE_WINDOW_SEC = 60;
const POLICY_VERSION_DEFAULT = '2026-11-draft'; // заменить версией реальной политики (/privacy) — задача 2.3

header('Content-Type: application/json; charset=utf-8');
header('Cache-Control: no-store');

function reply(int $code, array $body): never {
    http_response_code($code);
    echo json_encode($body, JSON_UNESCAPED_UNICODE);
    exit;
}

if (($_SERVER['REQUEST_METHOD'] ?? '') !== 'POST') {
    header('Allow: POST');
    reply(405, ['error' => 'Method not allowed']);
}

$in = [];
if (stripos($_SERVER['CONTENT_TYPE'] ?? '', 'application/json') !== false) {
    $decoded = json_decode(file_get_contents('php://input') ?: '', true);
    $in = is_array($decoded) ? $decoded : [];
} else {
    $in = $_POST;
}
$str = static fn(string $k): string => is_scalar($in[$k] ?? null) ? trim((string)$in[$k]) : '';

// Honeypot: человек поле не видит. Бота не огорчаем — отвечаем «ок» и ничего не сохраняем.
if ($str('website') !== '') reply(200, ['ok' => true]);

try {
    $pdo = shagali_db();

    // Лимит по IP (только REMOTE_ADDR: заголовкам прокси верить нельзя). В БД — соль + SHA-256.
    $salt = (string)(shagali_config()['rate_salt'] ?? '');
    $ipHash = hash('sha256', $salt . ($_SERVER['REMOTE_ADDR'] ?? ''));
    $pdo->exec('DELETE FROM rate_limit WHERE hit_at < NOW() - INTERVAL 1 HOUR');
    $hits = $pdo->prepare('SELECT COUNT(*) FROM rate_limit WHERE ip_hash = ? AND hit_at > NOW() - INTERVAL ' . RATE_WINDOW_SEC . ' SECOND');
    $hits->execute([$ipHash]);
    if ((int)$hits->fetchColumn() >= RATE_LIMIT) {
        header('Retry-After: ' . RATE_WINDOW_SEC);
        reply(429, ['error' => 'Слишком много запросов, попробуйте через минуту']);
    }
    $pdo->prepare('INSERT INTO rate_limit (ip_hash) VALUES (?)')->execute([$ipHash]);

    // Валидация
    $errors = [];
    $type = $str('type');
    if (!in_array($type, ['waitlist', 'feedback'], true)) $errors['type'] = 'Неизвестная форма';

    $name = $str('name');
    if ($name === '' || mb_strlen($name) > 120) $errors['name'] = 'Укажите имя (до 120 символов)';

    $email = $str('email');
    if (mb_strlen($email) > 254 || !filter_var($email, FILTER_VALIDATE_EMAIL)) $errors['email'] = 'Укажите корректный email';

    $city = $str('city');
    if (mb_strlen($city) > 120) $errors['city'] = 'Слишком длинное название города';
    $project = $str('project');
    if (mb_strlen($project) > 255) $errors['project'] = 'Слишком длинный текст';
    $message = $str('message');
    if ($type === 'feedback' && ($message === '' || mb_strlen($message) > 5000)) $errors['message'] = 'Напишите сообщение (до 5000 символов)';

    if (!in_array($in['consent'] ?? null, [true, 1, '1', 'true', 'on'], true)) $errors['consent'] = 'Нужно согласие на обработку персональных данных';

    $filled = $in['filled_ms'] ?? null; // сколько форма была открыта у посетителя; поле подделать можно, но простого бота оно отсекает
    if (!is_numeric($filled) || (float)$filled < MIN_FILL_MS) $errors['time'] = 'Форма отправлена слишком быстро';

    if ($errors) reply(422, ['ok' => false, 'errors' => $errors]);

    $version = (string)(shagali_config()['policy_version'] ?? POLICY_VERSION_DEFAULT);
    if ($type === 'waitlist') {
        $pdo->prepare('INSERT INTO waitlist (name, email, city, project, consent_at, consent_version) VALUES (?, ?, ?, ?, NOW(), ?)')
            ->execute([$name, $email, $city ?: null, $project ?: null, $version]);
    } else {
        $pdo->prepare('INSERT INTO feedback (name, email, city, message, consent_at, consent_version) VALUES (?, ?, ?, ?, NOW(), ?)')
            ->execute([$name, $email, $city ?: null, $message, $version]);
    }
} catch (Throwable $e) {
    error_log('forms.php: ' . get_class($e)); // без текста исключения: в нём могут быть данные запроса
    reply(500, ['error' => 'Не удалось сохранить, попробуйте позже']);
}

// Письмо заказчику. Тема постоянная, пользовательский ввод только в теле (иначе — инъекция заголовков).
// Сбой отправки не отменяет заявку: она уже в БД.
$to = (string)(shagali_config()['notify_email'] ?? '');
if ($to !== '') {
    $label = $type === 'waitlist' ? 'Лист ожидания' : 'Обратная связь';
    $lines = ["Форма: $label", "Имя: $name", "Email: $email"];
    if ($city !== '') $lines[] = "Город: $city";
    if ($type === 'waitlist' && $project !== '') $lines[] = "Проект: $project";
    if ($type === 'feedback') $lines[] = "Сообщение:\n$message";
    $subject = '=?UTF-8?B?' . base64_encode("Заявка с сайта: $label") . '?=';
    $headers = "Content-Type: text/plain; charset=UTF-8\r\nReply-To: $email";
    if (!@mail($to, $subject, implode("\n", $lines), $headers)) error_log('forms.php: mail() не отправил письмо');
}

reply(201, ['ok' => true]);
