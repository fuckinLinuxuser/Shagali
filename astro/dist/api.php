<?php
header("Content-Type: application/json; charset=utf-8");
header("Access-Control-Allow-Origin: *");
header("Access-Control-Allow-Methods: GET, POST, PUT, DELETE, OPTIONS");
header("Access-Control-Allow-Headers: Content-Type, X-Admin-Token");

// Секретный токен для админ-панели. Должен совпадать со значением
// ADMIN_TOKEN в src/pages/admin.astro. Смените оба значения при компрометации.
define('ADMIN_TOKEN', 'c8f2b6e4a1d94f7c9b3e5a0d2f6c8b41');

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

function requireAdminToken() {
    $headers = function_exists('getallheaders') ? getallheaders() : [];
    $token = $headers['X-Admin-Token'] ?? $headers['X-admin-token'] ?? ($_SERVER['HTTP_X_ADMIN_TOKEN'] ?? '');
    if (!hash_equals(ADMIN_TOKEN, (string)$token)) {
        http_response_code(401);
        echo json_encode(["error" => "Unauthorized"]);
        exit;
    }
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
    requireAdminToken();

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
    requireAdminToken();

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