-- 002_users: личный кабинет — пользователи, подтверждение почты, сброс пароля, неудачные входы.
-- Пароль хранится только хешем (password_hash). Токены писем — только SHA-256 от токена (сам токен знает лишь получатель письма).
-- Согласие на обработку ПДн: момент и версия текста политики (152-ФЗ). Время везде UTC.

CREATE TABLE IF NOT EXISTS users (
  id                INT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  email             VARCHAR(254) NOT NULL,
  password_hash     VARCHAR(255) NOT NULL,
  last_name         VARCHAR(100) NOT NULL,
  first_name        VARCHAR(100) NOT NULL,
  city              VARCHAR(120) NOT NULL,
  phone             VARCHAR(20)  NOT NULL,
  email_verified_at DATETIME     NULL,
  verify_token_hash CHAR(64)     NULL,
  verify_expires    DATETIME     NULL,
  reset_token_hash  CHAR(64)     NULL,
  reset_expires     DATETIME     NULL,
  consent_at        DATETIME     NOT NULL,
  consent_version   VARCHAR(40)  NOT NULL,
  created_at        DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY uq_users_email (email),
  KEY idx_users_verify (verify_token_hash),
  KEY idx_users_reset (reset_token_hash)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Неудачные входы: хеши почты и IP, а не сами значения. Записи старше суток удаляет API.
CREATE TABLE IF NOT EXISTS login_attempts (
  id           BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  email_hash   CHAR(64)        NOT NULL,
  ip_hash      CHAR(64)        NOT NULL,
  attempted_at DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP,
  KEY idx_attempts_email (email_hash, attempted_at),
  KEY idx_attempts_ip (ip_hash, attempted_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

INSERT IGNORE INTO schema_migrations (version) VALUES ('002_users');
