@echo off
echo === Установка Сервисный Портал ===

echo.
echo [1/3] Устанавливаем зависимости backend...
cd backend
npm install
cd ..

echo.
echo [2/3] Устанавливаем зависимости frontend...
cd frontend
npm install
cd ..

echo.
echo [3/3] Копируем .env файл...
copy backend\.env.example backend\.env

echo.
echo === Готово! ===
echo.
echo Следующие шаги:
echo 1. Настройте backend\.env (DB_HOST, DB_USER, DB_PASSWORD, JWT_SECRET)
echo 2. Создайте базу данных PostgreSQL: vekpmt_portal
echo 3. Запустите миграции: cd backend && npm run migrate
echo 4. Запустите backend: cd backend && npm run dev
echo 5. Запустите frontend: cd frontend && npm run dev
echo 6. Откройте http://localhost:5173
echo.
pause
