<?php
/*
 * Выгрузка для публичного сайта (Vercel). Открыть в браузере:
 *   http://localhost/portfolio-api/export.php
 * Браузер скачает файл portfolio.json. Его содержимое попадает в public/data/portfolio.json.
 */
$base = 'http://localhost/portfolio-api/api.php';
$cats = json_decode(file_get_contents($base . '/categories'), true);
$projects = json_decode(file_get_contents($base . '/projects'), true);
if (!is_array($cats) || !is_array($projects)) {
    http_response_code(500);
    header('Content-Type: text/plain; charset=utf-8');
    echo 'Не удалось прочитать базу. Проверьте, что запущены Apache и MySQL.';
    exit;
}
header('Content-Type: application/json; charset=utf-8');
header('Content-Disposition: attachment; filename="portfolio.json"');
echo json_encode(['categories' => $cats, 'projects' => $projects], JSON_UNESCAPED_UNICODE | JSON_PRETTY_PRINT);
