#!/bin/bash
# Скрипт деплоя на сервер service.vekpmt.ru
# Запускать на сервере: bash deploy.sh

set -e  # остановить при любой ошибке

DEPLOY_DIR="/var/www/vekpmt-portal"
echo "=== Деплой сервисного портала ==="

# 1. Обновить код
echo "→ Обновление кода..."
cd $DEPLOY_DIR
git pull origin main

# 2. Backend — только зависимости, БЕЗ миграций
echo "→ Установка зависимостей backend..."
cd $DEPLOY_DIR/backend
npm install --omit=dev

# 3. Frontend — сборка
echo "→ Сборка frontend..."
cd $DEPLOY_DIR/frontend
npm install
npm run build

# 4. Перезапуск backend через PM2
echo "→ Перезапуск backend..."
pm2 reload vekpmt-portal --update-env || pm2 start src/index.js --name vekpmt-portal --cwd $DEPLOY_DIR/backend

# 5. Reload nginx
echo "→ Перезагрузка nginx..."
sudo nginx -t && sudo systemctl reload nginx

echo "=== Деплой завершён ✓ ==="
echo "Сайт: https://service.vekpmt.ru"
