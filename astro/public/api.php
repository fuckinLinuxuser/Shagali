<?php
// Секреты (хеш пароля админа) живут в shagali-config.php вне корня сайта:
//   прод:      /var/www/u3413841/data/shagali-config.php
//   локально/тесты: путь в переменной окружения SHAGALI_CONFIG
// Шаблон — shagali-config.example.php в корне репозитория. В этом файле секретов нет.
define('ALLOWED_ORIGIN', 'https://shagali.ru');

header("Content-Type: application/json; charset=utf-8");
header("Vary: Origin");
// CORS: только свой домен, никакого "*" на методах записи.
if (($_SERVER['HTTP_ORIGIN'] ?? '') === ALLOWED_ORIGIN) {
    header("Access-Control-Allow-Origin: " . ALLOWED_ORIGIN);
    header("Access-Control-Allow-Credentials: true");
    header("Access-Control-Allow-Methods: GET, POST, PUT, DELETE, OPTIONS");
    header("Access-Control-Allow-Headers: Content-Type, X-CSRF-Token");
}
if (($_SERVER['REQUEST_METHOD'] ?? '') === 'OPTIONS') {
    http_response_code(204);
    exit;
}

define('ALLOWED_IMAGE_EXT', ['jpg' => 'image/jpeg', 'jpeg' => 'image/jpeg', 'png' => 'image/png', 'webp' => 'image/webp', 'gif' => 'image/gif']);
define('ALLOWED_VIDEO_EXT', ['mp4' => 'video/mp4', 'webm' => 'video/webm', 'mov' => 'video/quicktime']);
define('MAX_UPLOAD_BYTES', 25 * 1024 * 1024);

$posts_file = __DIR__ . '/posts.json';
$images_dir = __DIR__ . '/images/castings';
$videos_dir = __DIR__ . '/videos';

// Создаем папки, если их нет
if (!file_exists($images_dir)) mkdir($images_dir, 0755, true);
if (!file_exists($videos_dir)) mkdir($videos_dir, 0755, true);

function readPosts($file) {
    if (!file_exists($file)) return [];
    $data = file_get_contents($file);
    return json_decode($data, true) ?: [];
}

function savePosts($file, $posts) {
    file_put_contents($file, json_encode($posts, JSON_UNESCAPED_UNICODE | JSON_PRETTY_PRINT));
}

function jsonError($code, $message) {
    http_response_code($code);
    echo json_encode(["error" => $message], JSON_UNESCAPED_UNICODE);
    exit;
}

function loadConfig() {
    $path = getenv('SHAGALI_CONFIG') ?: dirname(__DIR__, 2) . '/shagali-config.php';
    if (!is_file($path)) return null;
    $config = include $path;
    return is_array($config) ? $config : null;
}

function startAdminSession() {
    if (session_status() === PHP_SESSION_ACTIVE) return;
    $https = !empty($_SERVER['HTTPS']) || ($_SERVER['HTTP_X_FORWARDED_PROTO'] ?? '') === 'https';
    session_set_cookie_params([
        'lifetime' => 0,
        'path' => '/',
        'secure' => $https,
        'httponly' => true,
        'samesite' => 'Lax',
    ]);
    session_start();
}

// Запись только для админа: сессия (иначе 401) + CSRF-токен в заголовке X-CSRF-Token (иначе 403).
function requireAdminSession() {
    startAdminSession();
    if (empty($_SESSION['admin'])) jsonError(401, "Unauthorized");
}

function requireAdminWrite() {
    requireAdminSession();
    $sent = (string)($_SERVER['HTTP_X_CSRF_TOKEN'] ?? '');
    $expected = (string)($_SESSION['csrf'] ?? '');
    if ($expected === '' || !hash_equals($expected, $sent)) jsonError(403, "Bad CSRF token");
}

// Проверяет расширение и реальное (не заявленное клиентом) содержимое файла.
// Возвращает безопасное расширение или null, если файл не прошел проверку.
function validateUpload($file, $allowedByExt) {
    if ($file['size'] > MAX_UPLOAD_BYTES) return null;
    $ext = strtolower(pathinfo($file['name'], PATHINFO_EXTENSION));
    if (!isset($allowedByExt[$ext])) return null;

    $finfo = finfo_open(FILEINFO_MIME_TYPE);
    $realMime = finfo_file($finfo, $file['tmp_name']);
    finfo_close($finfo);

    if ($realMime !== $allowedByExt[$ext]) return null;
    return $ext;
}

$method = $_SERVER['REQUEST_METHOD'];

// Хак для парсинга PUT с файлами в PHP
if ($method === 'POST' && isset($_GET['_method']) && $_GET['_method'] === 'PUT') {
    $method = 'PUT';
}

$id_param = isset($_GET['id']) ? (int)$_GET['id'] : null;

// ====================== АВТОРИЗАЦИЯ ======================
$action = $_GET['action'] ?? '';
if ($action === 'login' && $method === 'POST') {
    $config = loadConfig();
    if (!$config || empty($config['admin_password_hash'])) jsonError(500, "Server is not configured");
    $input = json_decode(file_get_contents('php://input'), true);
    $password = is_array($input) ? (string)($input['password'] ?? '') : '';
    if ($password === '' || !password_verify($password, $config['admin_password_hash'])) {
        usleep(400000); // притормаживаем перебор
        jsonError(401, "Wrong password");
    }
    startAdminSession();
    session_regenerate_id(true);
    $_SESSION['admin'] = true;
    $_SESSION['csrf'] = bin2hex(random_bytes(32));
    echo json_encode(["success" => true, "csrf" => $_SESSION['csrf']]);
    exit;
}
// Проба «есть ли живая сессия» для страницы /admin: всегда 200, чтобы не шуметь 401 в консоли.
if ($action === 'status' && $method === 'GET') {
    startAdminSession();
    echo json_encode(empty($_SESSION['admin'])
        ? ["authenticated" => false]
        : ["authenticated" => true, "csrf" => $_SESSION['csrf']]);
    exit;
}
if ($action === 'csrf' && $method === 'GET') {
    requireAdminSession();
    echo json_encode(["csrf" => $_SESSION['csrf']]);
    exit;
}
if ($action === 'logout' && $method === 'POST') {
    requireAdminWrite();
    $_SESSION = [];
    session_destroy();
    echo json_encode(["success" => true]);
    exit;
}

// ====================== GET ======================
if ($method === 'GET') {
    $posts = readPosts($posts_file);
    if ($id_param) {
        foreach ($posts as $post) {
            if ($post['id'] === $id_param) {
                echo json_encode($post, JSON_UNESCAPED_UNICODE);
                exit;
            }
        }
        http_response_code(404);
        echo json_encode(["error" => "Not found"]);
    } else {
        echo json_encode($posts, JSON_UNESCAPED_UNICODE);
    }
    exit;
}

// ====================== POST & PUT ======================
if ($method === 'POST' || $method === 'PUT') {
    requireAdminWrite();

    $title = $_POST['title'] ?? '';
    $date = $_POST['date'] ?? '';
    $shortText = $_POST['shortText'] ?? '';
    $fullText = $_POST['fullText'] ?? '';
    
    if (!$title || !$date || !$shortText || !$fullText) {
        http_response_code(400);
        echo json_encode(["error" => "Missing fields"]);
        exit;
    }

    $posts = readPosts($posts_file);
    $timestamp = time() * 1000; 
    $slug = preg_replace('/[^a-zа-я0-9]+/u', '-', mb_strtolower($title));

    $coverPath = '';
    $mainPath = '';
    $isVideo = false;

    // Загрузка обложки (только изображения, расширение и MIME проверяются по содержимому файла)
    if (isset($_FILES['coverImage']) && $_FILES['coverImage']['error'] === UPLOAD_ERR_OK) {
        $ext = validateUpload($_FILES['coverImage'], ALLOWED_IMAGE_EXT);
        if (!$ext) {
            http_response_code(400);
            echo json_encode(["error" => "Недопустимый файл обложки: разрешены только jpg, jpeg, png, webp, gif"]);
            exit;
        }
        $filename = "{$slug}-cover-{$timestamp}.{$ext}";
        if (move_uploaded_file($_FILES['coverImage']['tmp_name'], "{$images_dir}/{$filename}")) {
            $coverPath = "/images/castings/{$filename}";
        }
    }

    // Загрузка медиа (изображение или видео — определяется по реальному расширению/MIME)
    if (isset($_FILES['mainMedia']) && $_FILES['mainMedia']['error'] === UPLOAD_ERR_OK) {
        $imageExt = validateUpload($_FILES['mainMedia'], ALLOWED_IMAGE_EXT);
        $videoExt = $imageExt ? null : validateUpload($_FILES['mainMedia'], ALLOWED_VIDEO_EXT);

        if (!$imageExt && !$videoExt) {
            http_response_code(400);
            echo json_encode(["error" => "Недопустимый медиафайл: разрешены jpg, jpeg, png, webp, gif, mp4, webm, mov"]);
            exit;
        }

        $isVideo = (bool)$videoExt;
        $ext = $isVideo ? $videoExt : $imageExt;
        $folder = $isVideo ? $videos_dir : $images_dir;
        $web_folder = $isVideo ? 'videos' : 'images/castings';

        $filename = "{$slug}-main-{$timestamp}.{$ext}";
        if (move_uploaded_file($_FILES['mainMedia']['tmp_name'], "{$folder}/{$filename}")) {
            $mainPath = "/{$web_folder}/{$filename}";
        }
    }

    if ($method === 'POST') {
        array_unshift($posts, [
            "id" => $timestamp,
            "title" => $title,
            "date" => $date,
            "shortText" => $shortText,
            "fullText" => $fullText,
            "coverImage" => $coverPath,
            "mainMedia" => $mainPath,
            "isVideo" => $isVideo
        ]);
        http_response_code(201);
    } else {
        $found = false;
        foreach ($posts as &$post) {
            if ($post['id'] === $id_param) {
                $post['title'] = $title;
                $post['date'] = $date;
                $post['shortText'] = $shortText;
                $post['fullText'] = $fullText;
                if ($coverPath) $post['coverImage'] = $coverPath;
                if ($mainPath) {
                    $post['mainMedia'] = $mainPath;
                    $post['isVideo'] = $isVideo;
                }
                $found = true;
                break;
            }
        }
        if (!$found) {
            http_response_code(404);
            echo json_encode(["error" => "Not found"]);
            exit;
        }
    }

    savePosts($posts_file, $posts);
    echo json_encode(["success" => true]);
    exit;
}

// ====================== DELETE ======================
if ($method === 'DELETE') {
    requireAdminWrite();

    if (!$id_param) {
        http_response_code(400);
        echo json_encode(["error" => "Missing ID"]);
        exit;
    }
    $posts = readPosts($posts_file);
    $filtered = array_filter($posts, function($p) use ($id_param) {
        return $p['id'] !== $id_param;
    });
    savePosts($posts_file, array_values($filtered));
    echo json_encode(["success" => true]);
    exit;
}