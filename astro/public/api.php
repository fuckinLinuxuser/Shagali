<?php
// Пароль администратора хранится только здесь (серверный файл, клиенту не отдаётся).
// Проверка — PBKDF2-SHA256, без внешних расширений PHP.
define('ADMIN_PASSWORD_SALT', 'e45202a9233478cf8d6c0169d6b70b95');
define('ADMIN_PASSWORD_HASH', 'd970f54b36bb2126a4a14366b31bff6a5c74da119fa9061403490fe59a1bc914');
define('ADMIN_PASSWORD_ITERATIONS', 100000);

session_set_cookie_params([
    'lifetime' => 0,
    'path' => '/',
    'secure' => !empty($_SERVER['HTTPS']),
    'httponly' => true,
    'samesite' => 'Lax',
]);
session_start();

header("Content-Type: application/json; charset=utf-8");
header("Access-Control-Allow-Origin: *");
header("Access-Control-Allow-Methods: GET, POST, PUT, DELETE, OPTIONS");
header("Access-Control-Allow-Headers: Content-Type");

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

function requireAdminSession() {
    if (empty($_SESSION['admin'])) {
        http_response_code(401);
        echo json_encode(["error" => "Unauthorized"]);
        exit;
    }
}

function verifyAdminPassword($password) {
    $computed = hash_pbkdf2('sha256', (string)$password, ADMIN_PASSWORD_SALT, ADMIN_PASSWORD_ITERATIONS);
    return hash_equals(ADMIN_PASSWORD_HASH, $computed);
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

$action = $_GET['action'] ?? '';

// ====================== Аутентификация ======================
if ($method === 'POST' && $action === 'login') {
    $body = json_decode(file_get_contents('php://input'), true) ?: [];
    $password = $body['password'] ?? ($_POST['password'] ?? '');

    // Небольшая задержка усложняет перебор пароля
    usleep(300000);

    if (verifyAdminPassword($password)) {
        $_SESSION['admin'] = true;
        session_regenerate_id(true);
        echo json_encode(["success" => true]);
    } else {
        http_response_code(401);
        echo json_encode(["error" => "Неверный пароль"]);
    }
    exit;
}

if ($method === 'POST' && $action === 'logout') {
    $_SESSION = [];
    session_destroy();
    echo json_encode(["success" => true]);
    exit;
}

if ($method === 'GET' && $action === 'check') {
    echo json_encode(["authenticated" => !empty($_SESSION['admin'])]);
    exit;
}

$id_param = isset($_GET['id']) ? (int)$_GET['id'] : null;

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
    requireAdminSession();

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
    requireAdminSession();

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