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
