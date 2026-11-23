-- 001_init: формы сайта (лист ожидания, обратная связь), лимит запросов, учёт миграций.
-- Применение: php sql/migrate.php (стенд делает это сам) или один раз вручную в phpMyAdmin на reg.ru.
-- Время везде UTC. В таблицах форм — согласие на обработку ПДн: момент и версия текста политики (152-ФЗ).

CREATE TABLE IF NOT EXISTS schema_migrations (
  version    VARCHAR(100) NOT NULL PRIMARY KEY,
  applied_at DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS waitlist (
  id              INT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  name            VARCHAR(120) NOT NULL,
  email           VARCHAR(254) NOT NULL,
  city            VARCHAR(120) NULL,
  project         VARCHAR(255) NULL,
  consent_at      DATETIME     NOT NULL,
  consent_version VARCHAR(40)  NOT NULL,
  created_at      DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  KEY idx_waitlist_email (email)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS feedback (
  id              INT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  name            VARCHAR(120) NOT NULL,
  email           VARCHAR(254) NOT NULL,
  city            VARCHAR(120) NULL,
  message         TEXT         NOT NULL,
  consent_at      DATETIME     NOT NULL,
  consent_version VARCHAR(40)  NOT NULL,
  created_at      DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Лимит запросов с IP: хранится только соль+SHA-256 адреса, записи старше часа удаляются самим API.
CREATE TABLE IF NOT EXISTS rate_limit (
  id      BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  ip_hash CHAR(64)        NOT NULL,
  hit_at  DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP,
  KEY idx_rate_limit (ip_hash, hit_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

INSERT IGNORE INTO schema_migrations (version) VALUES ('001_init');
