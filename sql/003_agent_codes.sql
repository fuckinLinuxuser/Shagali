-- 003_agent_codes: агентские коды. Админ выдаёт пользователю уникальный код и раз в неделю вносит число использований
-- (данные берутся из кабинета cbiletom вручную). При uses >= 10 пользователю открывается «закулисье».
CREATE TABLE IF NOT EXISTS agent_codes (
  id         INT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  user_id    INT UNSIGNED NOT NULL,
  code       VARCHAR(40)  NOT NULL,
  uses       INT UNSIGNED NOT NULL DEFAULT 0,
  updated_at DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  created_at DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY uq_agent_user (user_id),
  UNIQUE KEY uq_agent_code (code)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

INSERT IGNORE INTO schema_migrations (version) VALUES ('003_agent_codes');
