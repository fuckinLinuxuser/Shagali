<?php
// Шаблон серверного конфига. Реальный файл создаётся вручную ВНЕ корня сайта:
//   прод: /var/www/u3413841/data/shagali-config.php
// и в репозиторий не попадает. Секретов в этом шаблоне нет.
//
// Хеш пароля админки генерируется на своей машине (пароль не попадает ни в чат, ни в git):
//   php -r 'echo password_hash(trim(fgets(STDIN)), PASSWORD_DEFAULT), "\n";'
return [
    'admin_password_hash' => '',
];
