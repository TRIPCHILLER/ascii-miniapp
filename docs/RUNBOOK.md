# ASCII MINIAPP — Runbook (Deploy / Ops)

Этот документ отвечает на вопросы:
- как запустить/перезапустить backend (Telegram bot)
- где смотреть логи
- где лежат env-переменные (BOT_TOKEN / TG_SECRET)
- как безопасно обновлять код

---

## 0) Что где лежит

Repo:
- Frontend: `index.html`, `styles.css`, `ascii.js`, `assets/`
- Backend: `backend/server.js`, `backend/store.js`

Server (Timecloud VPS):
- Node.js
- PM2 (процессы)
- (опционально) Nginx reverse proxy

---

## 1) Подключение к серверу (SSH)

Обычно:
```bash
ssh root@YOUR_SERVER_IP
