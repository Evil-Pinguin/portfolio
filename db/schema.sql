-- ==========================================================
-- База данных портфолио (MySQL / MariaDB, XAMPP)
-- Импорт: phpMyAdmin -> вкладка «Импорт» -> выбрать этот файл.
-- Кодировка: utf8mb4 (нужна для кириллицы и эмодзи).
-- ==========================================================

CREATE DATABASE IF NOT EXISTS portfolio
  CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
USE portfolio;

-- Категории: 4 стандартные + пользовательские (добавляются кнопкой «+»)
CREATE TABLE IF NOT EXISTS categories (
  id          VARCHAR(40)  NOT NULL PRIMARY KEY,
  label       VARCHAR(24)  NOT NULL,
  is_default  TINYINT(1)   NOT NULL DEFAULT 0,
  sort_order  INT          NOT NULL DEFAULT 0,
  created_at  DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB;

INSERT IGNORE INTO categories (id, label, is_default, sort_order) VALUES
  ('site',      'Сайт',     1, 1),
  ('game',      'Игра',     1, 2),
  ('education', 'Обучение', 1, 3),
  ('other',     'Другое',   1, 4);

-- Проекты
CREATE TABLE IF NOT EXISTS projects (
  id           VARCHAR(40)  NOT NULL PRIMARY KEY,
  title        VARCHAR(120) NOT NULL,
  version      VARCHAR(20)  NOT NULL DEFAULT '1.0',
  category_id  VARCHAR(40)  NOT NULL DEFAULT 'other',
  icon         VARCHAR(255) NOT NULL DEFAULT 'icons/category-other.png',
  description  TEXT,
  created_at   DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at   DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT fk_projects_category
    FOREIGN KEY (category_id) REFERENCES categories(id)
    ON UPDATE CASCADE ON DELETE RESTRICT,
  INDEX idx_projects_category (category_id)
) ENGINE=InnoDB;

-- История названия (новые записи — сверху; текущая версия = первая)
CREATE TABLE IF NOT EXISTS project_history (
  id          INT AUTO_INCREMENT PRIMARY KEY,
  project_id  VARCHAR(40)  NOT NULL,
  version     VARCHAR(20)  NOT NULL,
  title       VARCHAR(120) NOT NULL,
  changed_at  DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_history_project
    FOREIGN KEY (project_id) REFERENCES projects(id)
    ON DELETE CASCADE,
  INDEX idx_history_project (project_id, changed_at)
) ENGINE=InnoDB;

-- Цели
CREATE TABLE IF NOT EXISTS project_goals (
  id          VARCHAR(40)  NOT NULL PRIMARY KEY,
  project_id  VARCHAR(40)  NOT NULL,
  text        VARCHAR(500) NOT NULL,
  position    INT          NOT NULL DEFAULT 0,
  CONSTRAINT fk_goals_project
    FOREIGN KEY (project_id) REFERENCES projects(id)
    ON DELETE CASCADE,
  INDEX idx_goals_project (project_id, position)
) ENGINE=InnoDB;

-- Задачи
CREATE TABLE IF NOT EXISTS project_tasks (
  id          VARCHAR(40)  NOT NULL PRIMARY KEY,
  project_id  VARCHAR(40)  NOT NULL,
  text        VARCHAR(500) NOT NULL,
  done        TINYINT(1)   NOT NULL DEFAULT 0,
  position    INT          NOT NULL DEFAULT 0,
  CONSTRAINT fk_tasks_project
    FOREIGN KEY (project_id) REFERENCES projects(id)
    ON DELETE CASCADE,
  INDEX idx_tasks_project (project_id, position)
) ENGINE=InnoDB;

-- Ссылки: github | site | project
CREATE TABLE IF NOT EXISTS project_links (
  id          VARCHAR(40)  NOT NULL PRIMARY KEY,
  project_id  VARCHAR(40)  NOT NULL,
  type        ENUM('github', 'site', 'project') NOT NULL,
  label       VARCHAR(120) NOT NULL,
  url         VARCHAR(500) NOT NULL,
  position    INT          NOT NULL DEFAULT 0,
  CONSTRAINT fk_links_project
    FOREIGN KEY (project_id) REFERENCES projects(id)
    ON DELETE CASCADE,
  INDEX idx_links_project (project_id, position)
) ENGINE=InnoDB;

-- Фото проекта: в БД хранится только путь к файлу в папке uploads/
CREATE TABLE IF NOT EXISTS project_images (
  id          VARCHAR(40)  NOT NULL PRIMARY KEY,
  project_id  VARCHAR(40)  NOT NULL,
  file_path   VARCHAR(255) NOT NULL,
  position    INT          NOT NULL DEFAULT 0,
  created_at  DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_images_project
    FOREIGN KEY (project_id) REFERENCES projects(id)
    ON DELETE CASCADE,
  INDEX idx_images_project (project_id, position)
) ENGINE=InnoDB;

-- Общие настройки (тема и т.п.). Ключи API сюда НЕ кладём — см. docs/XAMPP.md
CREATE TABLE IF NOT EXISTS settings (
  name   VARCHAR(64) NOT NULL PRIMARY KEY,
  value  TEXT
) ENGINE=InnoDB;
