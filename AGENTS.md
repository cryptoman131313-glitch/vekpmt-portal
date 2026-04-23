# AGENTS.md — vekpmt-portal

Контекстный файл для AI-агентов, работающих с этим репозиторием.

## Назначение проекта

**vekpmt-portal** — сервисный портал «Эффективная Техника». Полнофункциональное веб-приложение для управления сервисным обслуживанием оборудования (B2B). Двойная роль:

- **Админ-панель** — для директоров, менеджеров и инженеров (управление клиентами, оборудованием, тикетами, документами)
- **Личный кабинет клиента** — для зарегистрированных клиентов (отслеживание оборудования, создание заявок, доступ к документам)

## Стек технологий

| Слой | Технологии |
|------|-----------|
| Backend | Node.js (>=18), Express 4, PostgreSQL (pg), JWT, bcryptjs, multer, nodemailer |
| Frontend | React 18, TypeScript, Vite, Tailwind CSS, Axios, lucide-react |
| Деплой | Nginx (SSL), PM2, Beget VPS |
| Тесты | Jest, Supertest |
| CI | GitHub Actions (Node 18, 20) |

## Структура проекта

```
vekpmt-portal/
├── backend/
│   ├── src/
│   │   ├── app.js              # Express app (без listen, экспортируется для тестов)
│   │   ├── index.js            # Точка входа сервера
│   │   ├── middleware/
│   │   │   └── auth.js         # JWT auth, RBAC (authMiddleware, requireRole, clientAuth)
│   │   ├── routes/
│   │   │   ├── auth.js         # Login, reset password
│   │   │   ├── tickets.js      # Тикеты (CRUD, сообщения, вложения, история)
│   │   │   ├── clients.js      # Клиенты (CRM)
│   │   │   ├── equipment.js    # Оборудование
│   │   │   ├── documents.js    # Документы
│   │   │   ├── users.js        # Сотрудники
│   │   │   ├── registrations.js # Регистрация клиентов
│   │   │   ├── settings.js     # Системные настройки
│   │   │   └── calendar.js     # Календарь событий
│   │   └── db/
│   │       ├── pool.js         # PostgreSQL connection pool
│   │       └── migrate.js      # Миграции (idempotent)
│   ├── __tests__/              # API-тесты (Jest + Supertest)
│   └── package.json
├── frontend/
│   ├── src/
│   │   ├── App.tsx             # Роутинг, guards (AdminGuard, ClientGuard)
│   │   ├── api/client.ts       # Axios с auth interceptor
│   │   ├── context/AuthContext.tsx
│   │   ├── pages/admin/        # Страницы админ-панели
│   │   ├── pages/client/       # Страницы ЛК клиента
│   │   └── components/
│   ├── tailwind.config.js      # Бренд: #CC0033 (red), #003399 (blue)
│   └── package.json
├── .github/workflows/test.yml  # CI: тесты на push/PR
├── nginx.conf                  # Production nginx config
└── deploy.sh                   # Деплой-скрипт (git pull, build, PM2 restart)
```

## Архитектура

### Backend

- **Монолитный Express API** на порту 3001
- **PostgreSQL** — 21+ таблиц, все запросы через параметризованные `$N` плейсхолдеры (без ORM)
- **JWT-аутентификация** с двумя типами токенов:
  - `type: 'user'` — сотрудники (24h TTL)
  - `type: 'client'` — клиенты (7d TTL)
- **RBAC**: 3 роли (`director`, `manager`, `engineer`) + гранулярные JSONB permissions
- **Rate limiting**: 200 req/15min общий, 10 req/15min на auth

### Frontend

- **React SPA** с `react-router-dom` v6
- Guard-компоненты для разделения admin/client зон
- AuthContext — единый контекст авторизации
- Axios interceptor — автоматический Bearer token, редирект на /login при 401

### База данных (ключевые таблицы)

- `users` — сотрудники (role, permissions JSONB)
- `clients` — компании-клиенты
- `client_users` — учётные записи клиентов (отдельная таблица от users)
- `tickets` — заявки на обслуживание
- `ticket_types` — типы заявок с автостатусами
- `messages` — сообщения в тикетах (каналы: appeal, service, notes)
- `equipment` — оборудование (characteristics JSONB)
- `documents`, `attachments`, `notifications`, `ticket_history`, `calendar_events`

## Команды

```bash
# Backend
cd backend
npm install          # Установка зависимостей
npm run dev          # Dev-сервер (nodemon)
npm start            # Production-запуск
npm test             # Прогон тестов
npm run migrate      # Создание/обновление схемы БД

# Frontend
cd frontend
npm install
npm run dev          # Vite dev-сервер (порт 5173)
npm run build        # Production-сборка
```

## Соглашения

- Все SQL-запросы используют параметризованные `$N` плейсхолдеры (ОБЯЗАТЕЛЬНО)
- Комментарии и пользовательские сообщения об ошибках — на русском языке
- Snake_case для колонок БД, camelCase для JS/TS
- `app.js` — Express app без listen (для тестируемости через supertest)
- `index.js` — точка входа, env-проверки + запуск сервера
- Rate limiting отключается при `NODE_ENV=test`
