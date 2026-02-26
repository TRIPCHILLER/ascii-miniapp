# DEPLOY RUNBOOK (Production)

## Истина (что считается продом)
- Прод-бэкенд запускается PM2 процессом: `ascii-uploader`
- Скрипт процесса: `/opt/trip-bot/backend/server.js`
- Репозиторий на сервере: `/opt/trip-bot`
- Деплой-триггер: любой push/merge в `main` (GitHub Actions)

## Как происходит деплой (автоматически)
GitHub Actions делает на сервере:
1) `git pull --ff-only` в `/opt/trip-bot`
2) `node --check backend/server.js` и `backend/store.js`
3) `pm2 restart ascii-uploader`
4) `pm2 save`

## Ручной деплой (если Actions временно недоступны)
На сервере:
```bash
cd /opt/trip-bot
git pull --ff-only
pm2 restart ascii-uploader
pm2 save
Если “изменения не применились” (проверки)
1) Сервер на нужном коммите?
cd /opt/trip-bot
git rev-parse --short HEAD
git log -1 --oneline
2) PM2 запускает правильный файл?
pm2 describe ascii-uploader | sed -n '1,160p'

Ищем script path → должно быть /opt/trip-bot/backend/server.js.

3) Есть ли правка в прод-файле?
grep -n "УНИКАЛЬНАЯ_ФРАЗА_ИЛИ_МЕТКА" /opt/trip-bot/backend/server.js
4) Логи после рестарта
pm2 logs ascii-uploader --lines 200
Правило безопасности

Правим только tracked-файлы проекта (server.js/store.js/фронт).
Никакие .env, node_modules, локальные бэкапы и логи в git не коммитим.
