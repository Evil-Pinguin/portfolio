# Подключение портфолио к базе данных в XAMPP

Документ для агента/разработчика, который будет подключать сайт к локальной базе данных.
Сейчас всё хранится в `localStorage` браузера (см. `public/app.js`, функции `load()` и `save()`).
Цель: перенести хранение в MySQL/MariaDB из XAMPP через небольшое PHP API.

---

## 1. Что уже есть

| Файл | Что внутри |
|---|---|
| `public/` | Статический фронтенд (HTML/CSS/JS). Деплоится на Vercel. |
| `public/app.js` | Вся логика. Данные — объекты `state.projects` (см. раздел 4). |
| `public/icons/` | Встроенные иконки (логотипы, категории, ссылки, темы). Это **статические** файлы, в БД не нужны. |
| `db/schema.sql` | SQL-схема базы: таблицы, внешние ключи, стандартные категории. |
| `docs/XAMPP.md` | Этот файл. |

---

## 2. Установка и запуск XAMPP (Windows)

1. Скачать XAMPP с apachefriends.org (версия с PHP 8.x).
2. Установить в `C:\xampp` (без пробелов в пути).
3. Открыть **XAMPP Control Panel** и нажать **Start** у:
   - **Apache** (порты 80 и 443),
   - **MySQL** (порт 3306).
   Оба должны стать зелёными.
4. Открыть **http://localhost/phpmyadmin** — должна открыться панель MySQL.

Если Apache не стартует: порт 80 занят (часто Skype/IIS). Остановить конфликтующую службу или поменять порт в `C:\xampp\apache\conf\httpd.conf` (`Listen 8080`).

### Безопасность (важно)
По умолчанию у MySQL в XAMPP пользователь `root` **без пароля**. Для локальной разработки это допустимо, но:
- создайте отдельного пользователя только для проекта (шаг 3),
- не открывайте порты 80/3306 наружу (без VPN/туннеля).

---

## 3. Создание базы и пользователя

### 3.1. Импорт схемы
1. В phpMyAdmin открыть вкладку **Импорт**.
2. Выбрать файл `db/schema.sql` → **Вперёд**.
3. Появится база `portfolio` с 7 таблицами: `categories`, `projects`, `project_history`, `project_goals`, `project_tasks`, `project_links`, `project_images`, `settings`.

> Если база уже создана вручную — проверьте, что имена таблиц и колонок совпадают со схемой, либо приведите её к схеме. Скрипт безопасен для повторного запуска (`IF NOT EXISTS`, `INSERT IGNORE`).

### 3.2. Пользователь для приложения
В phpMyAdmin → **Пользователи** → **Добавить пользователя**:
- имя: `portfolio_app`, хост: `localhost`, пароль — сгенерируйте свой;
- права: выбрать базу `portfolio` и отметить **SELECT, INSERT, UPDATE, DELETE**.

Далее PHP подключается под этим пользователем, а не под `root`.

---

## 4. Соответствие данных и таблиц

Текущая структура объекта проекта в JS (сохраняем её в API, чтобы фронтенд менялся минимально):

```js
{
  id, title, version, category,          // category — id категории (site|game|education|other|c...)
  icon,                                   // путь к картинке, напр. "icons/icon-rocket.png" или "uploads/xxx.webp"
  description,
  goals:   [{ id, text }],
  tasks:   [{ id, text, done }],
  links:   [{ id, type: "github"|"site"|"project", label, url }],
  images:  [{ id, src }],                 // src = "uploads/xxx.webp" (раньше был data:...)
  history: [{ version, title, date }],    // новые сверху
  created, updated                        // ISO-даты
}
```

| Поле JS | Таблица | Колонка |
|---|---|---|
| `id`, `title`, `version`, `category`, `icon`, `description`, `created`, `updated` | `projects` | `id, title, version, category_id, icon, description, created_at, updated_at` |
| `goals[]` | `project_goals` | `id, text, position` |
| `tasks[]` | `project_tasks` | `id, text, done, position` |
| `links[]` | `project_links` | `id, type, label, url, position` |
| `images[]` | `project_images` | `id, file_path, position` |
| `history[]` | `project_history` | `version, title, changed_at` |
| свои категории | `categories` | `id, label, is_default=0` |
| тема | `settings` | `name='theme'`, `value='light'|'dark'` |

Поля `created`/`updated` в JS — ISO-строки, в MySQL — `DATETIME`. API должен конвертировать (`date('c', ...)` в PHP).

---

## 5. PHP API (что нужно написать)

Расположение: `C:\xampp\htdocs\portfolio-api\` → адрес `http://localhost/portfolio-api/`.

Файлы:
- `config.php` — параметры подключения к БД. **Не коммитить в git** (добавить в `.gitignore`).
- `db.php` — `PDO` с `utf8mb4`, `ERRMODE_EXCEPTION`, `FETCH_ASSOC`, подготовленные запросы.
- `index.php` — роутер (или отдельные файлы на эндпоинт).
- `uploads/` — папка для фото (права на запись для Apache).

Пример `config.php`:
```php
<?php
return [
  'host' => '127.0.0.1',
  'db'   => 'portfolio',
  'user' => 'portfolio_app',
  'pass' => 'ВАШ_ПАРОЛЬ',
  'charset' => 'utf8mb4',
  'allowed_origins' => ['http://localhost:3000', 'http://127.0.0.1:3000'],
];
```

### 5.1. Эндпоинты

| Метод | Путь | Назначение |
|---|---|---|
| GET | `/api/projects` | Все проекты с целями, задачами, ссылками, фото, историей (вложенный JSON) |
| POST | `/api/projects` | Создать проект (тело — объект проекта) |
| GET | `/api/projects/{id}` | Один проект |
| PUT | `/api/projects/{id}` | Обновить поля (title/category/icon/description). **Если title изменился — сервер сам поднимает версию** (minor +1, как `bump()` в JS) и добавляет запись в `project_history` |
| DELETE | `/api/projects/{id}` | Удалить проект (каскадно удалит цели, задачи, ссылки, фото-записи). Файлы фото удалить с диска вручную |
| POST | `/api/projects/{id}/goals` | Добавить цель `{text}` |
| DELETE | `/api/goals/{id}` | Удалить цель |
| POST | `/api/projects/{id}/tasks` | Добавить задачу `{text}` |
| PATCH | `/api/tasks/{id}` | Изменить `{done}` или `{text}` |
| DELETE | `/api/tasks/{id}` | Удалить задачу |
| POST | `/api/projects/{id}/links` | Добавить ссылку `{type,label,url}` (url с `https://` — проверять на сервере) |
| DELETE | `/api/links/{id}` | Удалить ссылку |
| POST | `/api/projects/{id}/images` | Загрузка фото: `multipart/form-data`, поле `file`. Сохранить в `uploads/`, вернуть `{id, src}` |
| DELETE | `/api/images/{id}` | Удалить запись и файл |
| GET | `/api/categories` | Список категорий (стандартные + свои) |
| POST | `/api/categories` | Новая категория `{label}`: проверка длины ≤ 24 и уникальности без учёта регистра |
| DELETE | `/api/categories/{id}` | Удалить свою категорию (`is_default=0`). Проекты перевести в `other` **в одной транзакции** |
| GET/PUT | `/api/settings/{name}` | Например, тема |
| POST | `/api/import` | Однократный импорт данных из `localStorage` (JSON того же формата, что `state.projects`) |

### 5.2. Правила, которые должны совпадать с фронтендом
- **Версия:** `1.0 → 1.1 → 1.2`: увеличивается minor при смене названия; при возврате к старому названию («Вернуть») — тоже новая версия.
- **Пустое название** не сохранять (вернуть последнее из истории).
- **Цели/задачи без дублей** в рамках одного проекта (сравнение без учёта регистра) — на случай генерации ИИ.
- **Категории:** длина ≤ 24, нельзя «Сайт» и «сайт» одновременно; стандартные `site, game, education, other` нельзя удалить.
- **Лимиты:** текст ≤ 500 символов, название ≤ 120, фото — webp, ≤ 800–1400 px (как сейчас в `resizeImage`).
- Все запросы — подготовленные выражения (`PDO::prepare`), никакой склейки SQL.
- Ответы JSON, `Content-Type: application/json; charset=utf-8`.

### 5.3. Настройки PHP (`C:\xampp\php\php.ini`)
- `upload_max_filesize = 10M`
- `post_max_size = 12M`
- `date.timezone = Asia/Yakutsk` (или ваш часовой пояс)
- после правок перезапустить Apache.

### 5.4. Apache
- Включить `mod_rewrite` и `mod_headers` (в `httpd.conf` раскомментировать строки).
- CORS: в ответах API отдавать `Access-Control-Allow-Origin` только для `allowed_origins`, и обрабатывать `OPTIONS` (preflight) с `Access-Control-Allow-Headers: Content-Type`.

---

## 6. Изменения во фронтенде (`public/app.js`)

1. **Заменить `load()` и `save()`** на загрузку через `fetch('http://localhost/portfolio-api/api/...')`.
   Адрес вынести в одну константу `API_BASE`.
2. Большинство функций сейчас синхронные и вызывают `save()` — сделать их `async` и `await` вызовы API.
   Для точечных действий (добавить цель, отметить задачу) вызывать соответствующий эндпоинт и обновлять локальный `state`.
3. **Загрузка фото**: вместо `resizeImage` → `dataURL` отправлять `File` через `FormData` в `POST /images`. Сжатие можно оставить на клиенте (`resizeImage` возвращает Blob).
4. **Категории**: при старте грузить `GET /api/categories` вместо `loadCategories()` из localStorage; добавление/удаление — через POST/DELETE.
5. **Тема и состояние интерфейса** (`portfolio-ui`) — можно оставить в `localStorage` (это настройки браузера), либо перенести в `settings`.
6. **Ключ Groq** — см. раздел 8.
7. Миграция: кнопка «Импортировать из браузера» (вызывает `POST /api/import` с содержимым `localStorage['portfolio-projects-v1']`) — один раз, чтобы не потерять уже созданные проекты.

Проверка: после правок `node --check public/app.js` и тестовый прогон в браузере (CRUD проекта, цели, задачи, фото, категории, перезагрузка страницы).

---

## 7. Запуск всего вместе

1. XAMPP: Apache и MySQL — **Start**.
2. Фронтенд: `cd public && python -m http.server 3000 --bind 0.0.0.0` → открыть http://localhost:3000.
3. API: проверить в браузере `http://localhost/portfolio-api/api/categories` — должен вернуться JSON.

### Важно про Vercel
Сайт на **https://portfolio-evil-pin.vercel.app/** работает в браузере пользователя, а не на вашем ПК. Обращение к `http://localhost/...` с Vercel **не сработает**: адрес `localhost` — это компьютер посетителя, а не база. Варианты:
- **Для работы дома** — запускать фронтенд локально (шаг 2) и открывать `http://localhost:3000`.
- **Публичный доступ** — туннель (ngrok, Cloudflare Tunnel) на Apache. Это открывает базу в интернет: нужны пароли, ограничение `allowed_origins`, HTTPS, и лучше — отдельный хостинг БД. Решение за владельцем проекта.

---

## 8. Ключ API Groq

Сейчас ключ хранится в `localStorage` браузера. Для варианта с БД рекомендуется:
- **не класть ключ в таблицу `settings`** и **не коммитить в git**;
- хранить его в `config.php` (`'groq_key' => '...'`) и проксировать запросы к Groq через `POST /api/ai/generate` и `POST /api/ai/describe` — тогда ключ не виден в браузере.
- Модель по умолчанию: `openai/gpt-oss-120b` (альтернатива `openai/gpt-oss-20b`). Адрес: `https://api.groq.com/openai/v1/chat/completions`.

---

## 9. Чек-лист для агента

- [ ] XAMPP: Apache и MySQL запущены, phpMyAdmin открывается.
- [ ] `db/schema.sql` импортирован, 8 таблиц созданы, 4 стандартные категории есть.
- [ ] Пользователь `portfolio_app` создан с правами только на базу `portfolio`.
- [ ] `config.php` создан и добавлен в `.gitignore`.
- [ ] `http://localhost/portfolio-api/api/categories` возвращает JSON.
- [ ] CRUD проектов, целей, задач, ссылок, категорий работает через API (проверить curl или Postman).
- [ ] Загрузка фото сохраняет файл в `uploads/` и запись в `project_images`.
- [ ] При смене названия создаётся запись в `project_history` и версия растёт.
- [ ] Удаление категории переводит проекты в `other`.
- [ ] `public/app.js` ходит в API, `node --check` проходит, сценарий проверен в браузере.
- [ ] Импорт старых данных из `localStorage` выполнен.
- [ ] Ключ Groq вынесен на сервер (или осознанно оставлен в браузере).
- [ ] Документ обновлён (`docs/XAMPP.md`), изменения запушены в ветку `arena/ec5084e2-portfolio`.

---

## 10. Что ещё нужно от владельца

- Название базы и пользователя, которые уже созданы (если отличаются от `portfolio` и `portfolio_app`).
- Нужен ли доступ с Vercel (туннель) или достаточно локальной работы.
- Нужна ли авторизация (пароль на вход в портфолио), сейчас её нет: любой, у кого есть доступ к API, может менять данные.
