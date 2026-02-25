# Backend Guide (server.js + store.js navigation by @section)

В `backend/server.js` и `backend/store.js` добавлены якоря:

```js
// @section SECTION_NAME

Пользуйся поиском @section чтобы быстро прыгать по коду.

backend/server.js — Sections
@section IMPORTS_AND_PROCESS_BOOTSTRAP

Импорты, чтение env, начальная подготовка процесса (база конфигов).

@section REFERRAL_DATABASE_LAYER

Работа с реферальными/пользовательскими данными (слой хранения/индексации).

@section RATE_LIMITER_GUARDS

Ограничения частоты/антиспам/гварды, чтобы не убивать бота нагрузкой.

@section STORE_INTEGRATION_AND_FFMPEG_RUNNER

Связка с store.js + запуск внешних утилит/ffmpeg (если используется на сервере).

@section TEXT_UTILS_AND_COPYWRITING

Текстовые шаблоны, ответы, генерация сообщений.

@section EXPRESS_BOOTSTRAP_AND_CORS

Поднятие Express и настройки CORS (если сервер отдаёт HTTP endpoints).

@section MEDIA_CONVERSION_PIPELINE

Пайплайн конвертаций медиа (обработка входа/выхода, вызовы CLI).

@section TELEGRAM_INITDATA_VALIDATION

Проверка Telegram initData (безопасность WebApp).

@section MINIAPP_HTTP_API_ROUTES

HTTP роуты miniapp (эндпоинты, которые использует WebApp/клиент).

@section ADMIN_HTTP_ROUTES

Админские HTTP роуты (если есть).

@section TELEGRAM_BILLING_AND_MESSAGE_UTILS

Утилиты оплаты/звёзд/сервисных сообщений бота.

@section TELEGRAM_WEBHOOK_HANDLER

Webhook хендлер: приём апдейтов и маршрутизация.

@section FALLBACK_AND_SERVER_START

Фоллбеки, старт сервера, запуск слушателя.

backend/store.js — Sections
@section IMPORTS_AND_RUNTIME_CONFIG

Импорты, runtime-конфиги, env, пути и базовые настройки.

@section PERSISTENCE_FILES_AND_LOADERS

Файлы хранения/загрузчики данных (персистентность).

@section BALANCE_STATE_API

Баланс и операции над ним (ядро экономики).

@section USERNAME_INDEX_API

Индекс юзернеймов/сопоставления пользователей (если используется).

@section LOCAL_HELPERS

Локальные утилиты (мелкие функции).

@section CONVERSION_EXECUTION

Запуск конвертаций/выполнения внешних команд (если store этим занимается).

@section TELEGRAM_DOCUMENT_UPLOAD_PRIMARY

Основная отправка документов в Telegram.

@section TELEGRAM_DOCUMENT_UPLOAD_LEGACY_DUPLICATE

Дублирующая/legacy-версия отправки (пока оставляем как есть).

@section VIDEO_PROBE_METADATA

Чтение метаданных видео (probe).

@section TELEGRAM_VIDEO_UPLOAD

Загрузка/отправка видео в Telegram.

@section MODULE_EXPORTS

Экспорт функций модуля наружу.

Quick “Where to change”

Webhook / команды / роуты → backend/server.js

Баланс / списания / рефералка → backend/store.js → BALANCE_STATE_API

Валидация initData → backend/server.js → TELEGRAM_INITDATA_VALIDATION

Отправка файлов/видео → backend/store.js → TELEGRAM_*_UPLOAD
