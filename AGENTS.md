# ASCII VISOR (TRIPCHILLER) — Agent Guide

## Что это
Проект состоит из двух частей:
1) WebApp (frontend) — конвертер фото/видео/камера → ASCII в браузере, с интеграцией Telegram WebApp.
2) Bot/Backend (telegram) — логика звёзд/платежей/баланса/команд (server.js + store.js).

## Главные файлы и ответственность
### Frontend
- index.html — разметка UI (контролы, кнопки режимов, контейнеры, overlay/busy).
- styles.css — стили UI.
- ascii.js — вся логика WebApp: состояние, режимы (live/photo/video), рендер ASCII, камера/файлы, Telegram WebApp API, оверлеи.

### Backend (Telegram bot)
- backend/server.js — обработчики Telegram API / команды / вебхук(если есть) / выдача WebApp / коммуникация.
- backend/store.js — экономика: баланс, списания, пополнения, рефералка, лимиты, админ-команды.

### Static
- assets/ — шрифты/иконки.

## Правила изменений (ВАЖНО)
- Не переписывать ascii.js целиком. Только минимальные патчи точечно.
- Перед изменениями: найди точку входа (функцию/хендлер), кратко опиши текущее поведение, затем предложи патч.
- Любые изменения store.js — максимально осторожно:
  - не ломать списания/баланс
  - не менять форматы данных без миграции
  - всегда описывать риски и как проверить
- Не добавлять секреты в репозиторий (BOT_TOKEN, ключи, приватные URL). Всё через env.

## Как мы работаем
- Сначала план (если задача > 30 минут или трогает store/server): шаги + список файлов.
- Потом патч.
- Потом чеклист проверки (ручные шаги + команды, если есть).

## Где смотреть, если “что-то сломалось”
- UI/кнопки/режимы: index.html + styles.css
- поведение конвертации/камера/рендер: ascii.js
- списания/баланс/команды: backend/store.js + backend/server.js

## Language
- All PR descriptions, summaries, and human-facing explanations MUST be in Russian.
- If the user prompt is in English, still write PR text in Russian.
- Code identifiers stay in English.
