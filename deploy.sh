#!/bin/bash
# Скрипт деплоя на сервер
# Запускать на сервере: bash deploy.sh

set -e  # остановить при любой ошибке

DEPLOY_DIR="${DEPLOY_DIR:-/var/www/vekpmt-portal}"
echo "=== Деплой сервисного портала ==="
echo "Папка: $DEPLOY_DIR"

# 1. Обновить код
echo "→ Обновление кода..."
cd "$DEPLOY_DIR"
git pull origin main

# 2. Backend — зависимости через npm ci (воспроизводимая сборка)
echo "→ Установка зависимостей backend..."
cd "$DEPLOY_DIR/backend"
npm ci --omit=dev

# 3. Создать папку uploads если её нет
echo "→ Проверка папки uploads..."
mkdir -p "$DEPLOY_DIR/backend/uploads/avatars"
mkdir -p "$DEPLOY_DIR/backend/uploads/attachments"
mkdir -p "$DEPLOY_DIR/backend/uploads/documents"

# 4. Frontend — сборка
echo "→ Сборка frontend..."
cd "$DEPLOY_DIR/frontend"
npm ci
npm run build

# 5. Перезапуск backend через PM2
echo "→ Перезапуск backend..."
cd "$DEPLOY_DIR/backend"
pm2 reload vekpmt-portal --update-env 2>/dev/null \
  || pm2 start src/index.js --name vekpmt-portal \
     --max-memory-restart 500M \
     --log-date-format "YYYY-MM-DD HH:mm:ss"

pm2 save

# 6. Reload nginx
echo "→ Перезагрузка nginx..."
sudo nginx -t && sudo systemctl reload nginx

echo "=== Деплой завершён ✓ ==="
