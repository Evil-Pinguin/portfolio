<?php
// Скопируйте этот файл в config.php и впишите свой пароль.
// config.php не попадает в git (см. .gitignore).
return [
    'host'    => '127.0.0.1',
    'db'      => 'portfolio',
    'user'    => 'portfolio_app',
    'pass'    => 'ВАШ_ПАРОЛЬ',
    'charset' => 'utf8mb4',
    'allowed_origins' => ['http://localhost:3000', 'http://127.0.0.1:3000'],
    // Публичные адреса, которым разрешено только чтение (например https://имя.vercel.app)
    'public_read_origins' => [],
];
