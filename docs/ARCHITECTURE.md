# ASCII MINIAPP — Architecture Overview

## 1. Общая схема проекта

Проект состоит из двух частей:

1) Frontend (WebApp inside Telegram)
2) Backend (Telegram Bot API + Economy logic)

---

## 2. Поток работы пользователя

### Сценарий 1 — Пользователь запускает WebApp

User (Telegram)
   ↓
Telegram WebApp
   ↓
index.html loads
   ↓
ascii.js initializes app state
   ↓
User selects mode (photo / live / video)
   ↓
ASCII rendering runs locally in browser

Важно:
- Конвертация изображения происходит на клиенте (в браузере).
- Backend не участвует в рендере ASCII.

---

### Сценарий 2 — Списания / Баланс / Команды

User (Telegram)
   ↓
Telegram Bot
   ↓
server.js handles update
   ↓
store.js updates balance
   ↓
Response sent back to user

store.js отвечает за:
- списания
- пополнения
- рефералку
- админ-команды
- лимиты

server.js отвечает за:
- обработку апдейтов Telegram
- маршрутизацию команд
- связь WebApp ↔ Bot

---

## 3. Frontend структура

### index.html
UI-скелет приложения:
- кнопки режимов
- контейнеры рендера
- overlay / busy элементы
- подключение ascii.js

### styles.css
Визуальное оформление:
- layout
- цвета
- кнопки
- состояния

### ascii.js
Главный движок WebApp:
- управление состоянием
- логика режимов
- обработка камеры
- загрузка фото / видео
- генерация ASCII
- интеграция Telegram WebApp API

---

## 4. Backend структура

### backend/server.js
- Telegram API обработка
- команды
- связь с store.js
- запуск WebApp

### backend/store.js
- экономика
- баланс пользователей
- списания
- звёзды
- рефералка

⚠ ВАЖНО:
store.js — критически важный файл.
Изменения требуют осторожности.

---

## 5. Где искать проблемы

UI сломался → index.html / styles.css  
Рендер ведёт себя странно → ascii.js  
Баланс не списывается → store.js  
Команды не работают → server.js  

---

## 6. Окружение

Проект размещён на Timecloud VPS.

Используется:
- Node.js
- PM2
- Telegram Bot API
- Environment variables (BOT_TOKEN, TG_SECRET)
