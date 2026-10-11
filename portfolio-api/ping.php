<?php
// Проверка: подключение к базе и права пользователя portfolio_app
header('Content-Type: text/html; charset=utf-8');
require __DIR__ . '/db.php';
try {
    $pdo = db();
    $n = $pdo->query('SELECT COUNT(*) AS n FROM categories')->fetch()['n'];
    $rows = $pdo->query('SELECT id, label FROM categories ORDER BY sort_order')->fetchAll();
    echo '<h2>Подключение работает</h2>';
    echo '<p>Категорий в базе: <b>' . (int)$n . '</b></p><ul>';
    foreach ($rows as $r) echo '<li>' . htmlspecialchars($r['id'] . ' — ' . $r['label']) . '</li>';
    echo '</ul>';
} catch (Throwable $e) {
    http_response_code(500);
    echo '<h2>Ошибка подключения</h2><pre>' . htmlspecialchars($e->getMessage()) . '</pre>';
}
