# vekpmt-portal

Сервисный портал «Эффективная Техника» — веб-приложение для управления сервисным обслуживанием оборудования.

## Возможности

### Админ-панель (сотрудники)
- **Тикетная система** — создание заявок, назначение инженеров, автостатусы, три канала сообщений (обращение / служебный / примечания)
- **CRM клиентов** — карточки компаний, контактная информация, реквизиты для счетов
- **Оборудование** — каталог с характеристиками, привязка к клиентам
- **Документооборот** — загрузка и хранение документов по клиентам и оборудованию
- **Календарь** — общие и личные события
- **Регистрация клиентов** — заявки с reCAPTCHA, одобрение менеджером
- **Управление сотрудниками** — роли (директор / менеджер / инженер), гранулярные права доступа

### Личный кабинет (клиенты)
- Просмотр оборудования и документов
- Создание и отслеживание сервисных заявок
- Переписка с сервисной службой
- Управление профилем и реквизитами

## Стек технологий

| Слой | Технологии |
|------|-----------|
| Backend | Node.js, Express, PostgreSQL, JWT, bcryptjs |
| Frontend | React 18, TypeScript, Vite, Tailwind CSS |
| Деплой | Nginx, PM2 |
| Тесты | Jest, Supertest |
| CI | GitHub Actions |

## Быстрый старт

### Требования

- Node.js >= 18
- PostgreSQL

### Установка

```bash
# Клонирование
git clone https://github.com/cryptoman131313-glitch/vekpmt-portal.git
cd vekpmt-portal

# Backend
cd backend
cp .env.example .env        # Настроить переменные окружения
npm install
npm run migrate              # Создание таблиц и начальных данных
npm run dev                  # Запуск dev-сервера (порт 3001)

# Frontend (в отдельном терминале)
cd frontend
npm install
npm run dev                  # Запуск Vite dev-сервера (порт 5173)
```

### Переменные окружения (backend)

| Переменная | Описание | Пример |
|-----------|----------|--------|
| `DB_HOST` | Хост PostgreSQL | `localhost` |
| `DB_PORT` | Порт PostgreSQL | `5432` |
| `DB_NAME` | Имя базы данных | `vekpmt` |
| `DB_USER` | Пользователь БД | `postgres` |
| `DB_PASSWORD` | Пароль БД | `secret` |
| `JWT_SECRET` | Секрет для JWT (минимум 32 символа) | `your-long-secret-key...` |
| `FRONTEND_URL` | URL фронтенда (для CORS) | `http://localhost:5173` |
| `SMTP_HOST` | SMTP-сервер (для сброса пароля) | `smtp.mail.ru` |
| `SMTP_USER` | Email отправителя | `noreply@vekpmt.ru` |
| `SMTP_PASS` | Пароль SMTP | `password` |

## Структура проекта

```
vekpmt-portal/
├── backend/                    # Node.js + Express API
│   ├── src/
│   │   ├── app.js              # Express-приложение
│   │   ├── index.js            # Точка входа
│   │   ├── middleware/auth.js  # JWT, RBAC
│   │   ├── routes/             # API-маршруты
│   │   └── db/                 # PostgreSQL (pool, миграции)
│   └── __tests__/              # API-тесты
├── frontend/                   # React + TypeScript + Vite
│   └── src/
│       ├── pages/admin/        # Админ-панель
│       ├── pages/client/       # ЛК клиента
│       └── components/         # Общие компоненты
├── .github/workflows/          # CI (GitHub Actions)
├── nginx.conf                  # Конфигурация Nginx
└── deploy.sh                   # Скрипт деплоя
```

## API

Base URL: `/api`

| Метод | Маршрут | Описание | Авторизация |
|-------|---------|----------|-------------|
| POST | `/auth/login` | Вход сотрудника | - |
| POST | `/auth/client/login` | Вход клиента | - |
| GET | `/auth/me` | Текущий пользователь | Bearer |
| GET | `/tickets` | Список заявок | Bearer (staff) |
| POST | `/tickets` | Создать заявку | Bearer (staff) |
| GET | `/tickets/:id` | Карточка заявки | Bearer (staff) |
| PATCH | `/tickets/:id` | Обновить заявку | Bearer (staff) |
| POST | `/tickets/client/new` | Создать заявку (клиент) | Bearer (client) |
| GET | `/tickets/client/list` | Заявки клиента | Bearer (client) |
| GET | `/clients` | Список клиентов | Bearer (staff) |
| POST | `/clients` | Создать клиента | Bearer (staff) |
| GET | `/equipment` | Список оборудования | Bearer (staff) |
| GET | `/documents` | Список документов | Bearer (staff) |
| GET | `/health` | Health check | - |

## Тестирование

```bash
cd backend
npm test
```

51 API-тест покрывает: auth, clients, tickets, health check.

## Деплой

Проект деплоится на Beget VPS через `deploy.sh`:

```bash
./deploy.sh    # git pull, npm ci, build, PM2 restart, nginx reload
```

## Безопасность

- Все SQL-запросы параметризованы (`$N` плейсхолдеры)
- JWT с алгоритмом HS256, секрет минимум 32 символа
- Пароли хешируются через bcrypt (12 раундов)
- Rate limiting: 200 req/15min (общий), 10 req/15min (auth)
- Helmet для security headers
- CORS whitelist
- Валидация MIME-типов и расширений при загрузке файлов
- Токены сброса пароля с TTL 1 час

## Лицензия

Проприетарный проект.
