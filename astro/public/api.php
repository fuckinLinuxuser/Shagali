<?php
header("Content-Type: application/json");
header("Access-Control-Allow-Origin: *");
header("Access-Control-Allow-Methods: GET, POST, PUT, DELETE, OPTIONS");
header("Access-Control-Allow-Headers: Content-Type");

$posts_file = __DIR__ . '/posts.json';
$images_dir = __DIR__ . '/images';
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

$method = $_SERVER['REQUEST_METHOD'];
$uri = $_SERVER['REQUEST_URI'];

// Хак для парсинга PUT с файлами в PHP
if ($method === 'POST' && isset($_GET['_method']) && $_GET['_method'] === 'PUT') {
    $method = 'PUT';
}

// Получаем ID из query-строки (например, api.php?id=123)
$id_param = isset($_GET['id']) ? (int)$_GET['id'] : null;

// ====================== GET ======================
if ($method === 'GET') {
    $posts = readPosts($posts_file);
    if ($id_param) {
        foreach ($posts as $post) {
            if ($post['id'] === $id_param) {
                echo json_encode($post);
                exit;
            }
        }
        http_response_code(404);
        echo json_encode(["error" => "Not found"]);
    } else {
        echo json_encode($posts);
    }
    exit;
}

// ====================== POST & PUT ======================
if ($method === 'POST' || $method === 'PUT') {
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
    $timestamp = time() * 1000; // аналог Date.now()
    $slug = preg_replace('/[^a-zа-я0-9]+/u', '-', mb_strtolower($title));

    $coverPath = '';
    $mainPath = '';
    $isVideo = false;

    // Загрузка обложки
    if (isset($_FILES['coverImage']) && $_FILES['coverImage']['error'] === UPLOAD_ERR_OK) {
        $ext = pathinfo($_FILES['coverImage']['name'], PATHINFO_EXTENSION) ?: 'jpg';
        $filename = "{$slug}-cover-{$timestamp}.{$ext}";
        if (move_uploaded_file($_FILES['coverImage']['tmp_name'], "{$images_dir}/{$filename}")) {
            $coverPath = "/images/{filename}";
        }
    }

    // Загрузка медиа
    if (isset($_FILES['mainMedia']) && $_FILES['mainMedia']['error'] === UPLOAD_ERR_OK) {
        $mime = $_FILES['mainMedia']['type'];
        $isVideo = strpos($mime, 'video/') === 0;
        $folder = $isVideo ? $videos_dir : $images_dir;
        $web_folder = $isVideo ? 'videos' : 'images';
        $ext = pathinfo($_FILES['mainMedia']['name'], PATHINFO_EXTENSION) ?: ($isVideo ? 'mp4' : 'jpg');
        $filename = "{$slug}-main-{$timestamp}.{$ext}";
        if (move_uploaded_file($_FILES['mainMedia']['tmp_name'], "{$folder}/{$filename}")) {
            $mainPath = "/{$web_folder}/{$filename}";
        }
    }

    if ($method === 'POST') {
        // Создание
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
        // Редактирование (PUT)
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
