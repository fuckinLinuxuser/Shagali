<?php
// Отправка писем. Конфиг (shagali-config.php): 'smtp' => ['host' => ..., 'port' => ...] — простой SMTP без авторизации и TLS
// (стенд: mailpit); без 'smtp' — штатный mail() хостинга. 'mail_from' — адрес отправителя.
// Темы и тексты писем строит вызывающий код; пользовательский ввод в заголовки не попадает.
require_once __DIR__ . '/_db.php';

function shagali_send_mail(string $to, string $subject, string $text): bool {
    $config = shagali_config();
    $from = (string)($config['mail_from'] ?? 'no-reply@shagali.ru');
    if (!filter_var($to, FILTER_VALIDATE_EMAIL) || preg_match('/[\r\n]/', $to . $subject)) return false;
    $encodedSubject = '=?UTF-8?B?' . base64_encode($subject) . '?=';

    $smtp = $config['smtp'] ?? null;
    if (!is_array($smtp) || empty($smtp['host'])) {
        return @mail($to, $encodedSubject, $text, "From: $from\r\nContent-Type: text/plain; charset=UTF-8");
    }

    $fp = @stream_socket_client('tcp://' . $smtp['host'] . ':' . ($smtp['port'] ?? 25), $errno, $errstr, 5);
    if (!$fp) return false;
    stream_set_timeout($fp, 5);
    $read = static function () use ($fp): string {
        $out = '';
        while (($line = fgets($fp, 515)) !== false) {
            $out .= $line;
            if (strlen($line) < 4 || $line[3] === ' ') break;
        }
        return $out;
    };
    $cmd = static function (string $c) use ($fp, $read): string { fwrite($fp, $c . "\r\n"); return $read(); };

    $read();
    $cmd('HELO shagali.local');
    $cmd("MAIL FROM:<$from>");
    $ok = str_starts_with($cmd("RCPT TO:<$to>"), '25');
    $cmd('DATA');
    $body = "From: $from\r\nTo: $to\r\nSubject: $encodedSubject\r\nMIME-Version: 1.0\r\nContent-Type: text/plain; charset=UTF-8\r\n"
        . "Content-Transfer-Encoding: base64\r\n\r\n" . chunk_split(base64_encode($text));
    fwrite($fp, $body . "\r\n.\r\n");
    $ok = $ok && str_starts_with($read(), '250');
    $cmd('QUIT');
    fclose($fp);
    return $ok;
}
