<?php
/*
 * API портфолио. Адрес: http://localhost/portfolio-api/api.php/<маршрут>
 *
 *  GET    /categories              список категорий
 *  POST   /categories              {label}           новая категория
 *  DELETE /categories/{id}                           удалить свою категорию (проекты -> other)
 *
 *  GET    /projects                все проекты (с целями, задачами, ссылками, историей)
 *  POST   /projects                {объект проекта}  создать/сохранить проект
 *  PUT    /projects/{id}           {объект проекта}  сохранить проект целиком
 *  DELETE /projects/{id}                             удалить проект
 *
 *  POST   /import                  [проекты...]      импорт из localStorage
 *
 * Фото (images) пока не трогаются этим API: они будут в отдельном шаге загрузки файлов.
 */

require __DIR__ . '/db.php';
$cfg = require __DIR__ . '/config.php';

// --- CORS: разрешаем только свои адреса фронтенда ---
// Изменения (POST/PUT/DELETE) принимаются только с своих адресов (localhost).
// Публичные адреса (public_read_origins, например Vercel) могут только читать (GET).
$origin = $_SERVER['HTTP_ORIGIN'] ?? '';
$isWrite = ($_SERVER['REQUEST_METHOD'] ?? 'GET') !== 'GET';
$readOnlyOrigins = $cfg['public_read_origins'] ?? [];
if ($origin !== '' && (in_array($origin, $cfg['allowed_origins'], true)
    || (!$isWrite && in_array($origin, $readOnlyOrigins, true)))) {
    header('Access-Control-Allow-Origin: ' . $origin);
    header('Vary: Origin');
}
header('Access-Control-Allow-Methods: GET, POST, PUT, DELETE, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type');
header('Content-Type: application/json; charset=utf-8');

if (($_SERVER['REQUEST_METHOD'] ?? '') === 'OPTIONS') {
    http_response_code(204);
    exit;
}
if ($isWrite && !in_array($origin, $cfg['allowed_origins'], true)) {
    http_response_code(403);
    echo json_encode(['error' => 'Изменения принимаются только с localhost'], JSON_UNESCAPED_UNICODE);
    exit;
}

// --- helpers ---
function out($data, int $code = 200): void {
    http_response_code($code);
    echo json_encode($data, JSON_UNESCAPED_UNICODE);
    exit;
}
class ApiError extends Exception {
    public int $status;
    public function __construct(string $msg, int $status = 400) {
        parent::__construct($msg);
        $this->status = $status;
    }
}
// Бросаем исключение, а не выходим: импорт сможет пропустить один плохой проект
function fail(string $msg, int $code = 400): void {
    throw new ApiError($msg, $code);
}
function body(): array {
    $d = json_decode(file_get_contents('php://input') ?: '', true);
    if (!is_array($d)) fail('Ожидается JSON в теле запроса');
    return $d;
}
function txt($v, int $max): string {
    return mb_substr(trim((string)($v ?? '')), 0, $max);
}
function validId($v): bool {
    return is_string($v) && preg_match('/^[A-Za-z0-9_-]{1,40}$/', $v) === 1;
}
function newId(): string {
    return bin2hex(random_bytes(12));
}
function childId($v): string {
    return validId($v) ? $v : newId();
}
// ISO-строка из JS -> DATETIME для MySQL
function dt($v): ?string {
    if (!$v) return null;
    $t = strtotime((string)$v);
    return $t ? date('Y-m-d H:i:s', $t) : null;
}
// DATETIME -> ISO для JS
function iso(?string $v): ?string {
    return $v ? date('c', strtotime($v)) : null;
}
function inTx(PDO $pdo, callable $fn) {
    $pdo->beginTransaction();
    try {
        $r = $fn();
        $pdo->commit();
        return $r;
    } catch (Throwable $e) {
        $pdo->rollBack();
        throw $e;
    }
}

// --- сохранение одного проекта (вызывается внутри транзакции) ---
function saveProject(PDO $pdo, array $p, ?string $forcedId = null): string {
    $id = $forcedId ?? (validId($p['id'] ?? null) ? $p['id'] : newId());

    $title = txt($p['title'] ?? '', 120);
    if ($title === '') fail('Пустое название проекта');

    $icon = txt($p['icon'] ?? 'icons/category-other.png', 255);
    // Своя картинка (data:...) пока не хранится в базе: иконку в БД не трогаем
    $saveIcon = strpos($icon, 'data:') !== 0;

    // Категория должна существовать, иначе — other
    $cat = txt($p['category'] ?? 'other', 40);
    $chk = $pdo->prepare('SELECT 1 FROM categories WHERE id = ?');
    $chk->execute([$cat]);
    if (!$chk->fetch()) $cat = 'other';

    $now = date('Y-m-d H:i:s');
    $created = dt($p['created'] ?? null) ?? $now;
    $updated = dt($p['updated'] ?? null) ?? $now;

    $cols = ['id', 'title', 'version', 'category_id', 'description', 'created_at', 'updated_at'];
    $vals = [$id, $title, txt($p['version'] ?? '1.0', 20), $cat, (string)($p['description'] ?? ''), $created, $updated];
    $upd  = 'title = VALUES(title), version = VALUES(version), category_id = VALUES(category_id),
             description = VALUES(description), updated_at = VALUES(updated_at)';
    if ($saveIcon) {
        $cols[] = 'icon';
        $vals[] = $icon;
        $upd .= ', icon = VALUES(icon)';
    }
    $sql = 'INSERT INTO projects (' . implode(', ', $cols) . ') VALUES (' . implode(', ', array_fill(0, count($cols), '?')) . ')
            ON DUPLICATE KEY UPDATE ' . $upd;
    $pdo->prepare($sql)->execute($vals);

    // Дочерние таблицы: заменяем целиком (проще и надёжнее для личного проекта)
    foreach (['project_goals', 'project_tasks', 'project_links', 'project_history'] as $t) {
        $pdo->prepare("DELETE FROM $t WHERE project_id = ?")->execute([$id]);
    }

    $ins = $pdo->prepare('INSERT INTO project_goals (id, project_id, text, position) VALUES (?, ?, ?, ?)');
    $pos = 0;
    foreach (($p['goals'] ?? []) as $g) {
        $t = txt($g['text'] ?? '', 500);
        if ($t === '') continue;
        $ins->execute([childId($g['id'] ?? null), $id, $t, $pos++]);
    }

    $ins = $pdo->prepare('INSERT INTO project_tasks (id, project_id, text, done, position) VALUES (?, ?, ?, ?, ?)');
    $pos = 0;
    foreach (($p['tasks'] ?? []) as $t0) {
        $t = txt($t0['text'] ?? '', 500);
        if ($t === '') continue;
        $ins->execute([childId($t0['id'] ?? null), $id, $t, !empty($t0['done']) ? 1 : 0, $pos++]);
    }

    $ins = $pdo->prepare('INSERT INTO project_links (id, project_id, type, label, url, position) VALUES (?, ?, ?, ?, ?, ?)');
    $pos = 0;
    foreach (($p['links'] ?? []) as $l) {
        $url = txt($l['url'] ?? '', 500);
        if ($url === '') continue;
        if (!preg_match('#^https?://#i', $url)) $url = 'https://' . $url;
        $type = in_array($l['type'] ?? '', ['github', 'site', 'project'], true) ? $l['type'] : 'project';
        $label = txt($l['label'] ?? '', 120) ?: $type;
        $ins->execute([childId($l['id'] ?? null), $id, $type, $label, $url, $pos++]);
    }

    // История: в JS новые записи сверху. Вставляем от старых к новым,
    // чтобы больший id означал более новую запись (сортировка ORDER BY id DESC).
    $ins = $pdo->prepare('INSERT INTO project_history (project_id, version, title, changed_at) VALUES (?, ?, ?, ?)');
    $hist = array_reverse(array_values($p['history'] ?? []));
    foreach ($hist as $h) {
        $ins->execute([
            $id, txt($h['version'] ?? '1.0', 20), txt($h['title'] ?? $title, 120),
            dt($h['date'] ?? null) ?? $now,
        ]);
    }

    return $id;
}

// --- чтение всех проектов в формате, который понимает app.js ---
function loadProjects(PDO $pdo): array {
    $projects = $pdo->query('SELECT * FROM projects ORDER BY created_at DESC, id')->fetchAll();

    $group = function (string $sql) use ($pdo): array {
        $map = [];
        foreach ($pdo->query($sql)->fetchAll() as $row) {
            $pid = $row['project_id'];
            unset($row['project_id']);
            $map[$pid][] = $row;
        }
        return $map;
    };
    $goals  = $group('SELECT id, project_id, text FROM project_goals ORDER BY position, id');
    $tasks  = $group('SELECT id, project_id, text, done FROM project_tasks ORDER BY position, id');
    $links  = $group('SELECT id, project_id, type, label, url FROM project_links ORDER BY position, id');
    $images = $group('SELECT id, project_id, file_path AS src FROM project_images ORDER BY position, id');
    $hist   = $group('SELECT project_id, version, title, changed_at FROM project_history ORDER BY id DESC');

    $out = [];
    foreach ($projects as $p) {
        $id = $p['id'];
        $out[] = [
            'id' => $id,
            'title' => $p['title'],
            'version' => $p['version'],
            'category' => $p['category_id'],
            'icon' => $p['icon'],
            'description' => $p['description'] ?? '',
            'goals' => $goals[$id] ?? [],
            'tasks' => array_map(fn($t) => ['id' => $t['id'], 'text' => $t['text'], 'done' => (bool)$t['done']], $tasks[$id] ?? []),
            'links' => $links[$id] ?? [],
            'images' => $images[$id] ?? [],
            'history' => array_map(fn($h) => ['version' => $h['version'], 'title' => $h['title'], 'date' => iso($h['changed_at'])], $hist[$id] ?? []),
            'created' => iso($p['created_at']),
            'updated' => iso($p['updated_at']),
        ];
    }
    return $out;
}

// --- маршрутизация ---
$pdo = db();
$method = $_SERVER['REQUEST_METHOD'] ?? 'GET';
$path = trim($_SERVER['PATH_INFO'] ?? '', '/');
$parts = $path === '' ? [] : explode('/', $path);
$res = $parts[0] ?? '';

try {
    // ----- категории -----
    if ($res === 'categories' && $method === 'GET') {
        $rows = $pdo->query('SELECT id, label, is_default FROM categories ORDER BY sort_order, created_at')->fetchAll();
        out(array_map(fn($r) => ['id' => $r['id'], 'label' => $r['label'], 'isDefault' => (bool)$r['is_default']], $rows));
    }

    if ($res === 'categories' && $method === 'POST') {
        $label = txt(body()['label'] ?? '', 24);
        if ($label === '') fail('Введите название категории');
        $dup = $pdo->prepare('SELECT 1 FROM categories WHERE LOWER(label) = LOWER(?)');
        $dup->execute([$label]);
        if ($dup->fetch()) fail('Такая категория уже есть');
        $id = 'c' . bin2hex(random_bytes(6));
        $pdo->prepare('INSERT INTO categories (id, label, is_default, sort_order)
                       VALUES (?, ?, 0, (SELECT COALESCE(MAX(c.sort_order), 4) + 1 FROM categories c))')
            ->execute([$id, $label]);
        out(['id' => $id, 'label' => $label, 'isDefault' => false], 201);
    }

    if ($res === 'categories' && $method === 'DELETE') {
        $id = $parts[1] ?? '';
        $st = $pdo->prepare('SELECT is_default FROM categories WHERE id = ?');
        $st->execute([$id]);
        $row = $st->fetch();
        if (!$row) fail('Категория не найдена', 404);
        if ($row['is_default']) fail('Стандартную категорию нельзя удалить');
        inTx($pdo, function () use ($pdo, $id) {
            $pdo->prepare("UPDATE projects SET category_id = 'other' WHERE category_id = ?")->execute([$id]);
            $pdo->prepare('DELETE FROM categories WHERE id = ?')->execute([$id]);
        });
        out(['ok' => true]);
    }

    // ----- проекты -----
    if ($res === 'projects' && $method === 'GET') {
        out(loadProjects($pdo));
    }

    if ($res === 'projects' && $method === 'POST') {
        $id = inTx($pdo, fn() => saveProject($pdo, body()));
        out(['ok' => true, 'id' => $id], 201);
    }

    if ($res === 'projects' && $method === 'PUT') {
        $id = $parts[1] ?? '';
        if (!validId($id)) fail('Некорректный id');
        $exists = $pdo->prepare('SELECT 1 FROM projects WHERE id = ?');
        $exists->execute([$id]);
        if (!$exists->fetch()) fail('Проект не найден', 404);
        inTx($pdo, fn() => saveProject($pdo, body(), $id));
        out(['ok' => true, 'id' => $id]);
    }

    if ($res === 'projects' && $method === 'DELETE') {
        $id = $parts[1] ?? '';
        if (!validId($id)) fail('Некорректный id');
        // Дочерние записи удалятся каскадно (ON DELETE CASCADE)
        $pdo->prepare('DELETE FROM projects WHERE id = ?')->execute([$id]);
        out(['ok' => true]);
    }

    // ----- импорт из localStorage -----
    if ($res === 'import' && $method === 'POST') {
        $list = json_decode(file_get_contents('php://input') ?: '', true);
        if (!is_array($list)) fail('Ожидается JSON-массив проектов');
        $imported = 0;
        $errors = [];
        foreach ($list as $p) {
            try {
                inTx($pdo, fn() => saveProject($pdo, is_array($p) ? $p : []));
                $imported++;
            } catch (Throwable $e) {
                $errors[] = ($p['title'] ?? '?') . ': ' . $e->getMessage();
            }
        }
        out(['imported' => $imported, 'errors' => $errors]);
    }

    fail('Маршрут не найден', 404);
} catch (ApiError $e) {
    out(['error' => $e->getMessage()], $e->status);
} catch (PDOException $e) {
    out(['error' => 'Ошибка базы данных: ' . $e->getMessage()], 500);
}
