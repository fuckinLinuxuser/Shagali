# Стенд как на reg.ru: Apache + PHP 8.3 + pdo_mysql и работающий .htaccess (AllowOverride, expires, headers, deflate).
FROM php:8.3-apache
RUN docker-php-ext-install pdo_mysql \
 && a2enmod headers expires deflate \
 && sed -i 's/AllowOverride None/AllowOverride All/' /etc/apache2/apache2.conf
