# ASCII MINIAPP — Runbook (Deploy / Ops)

Этот документ — короткая шпаргалка по серверу и перезапуску бота.

---

## 0) Наши реальные параметры

VPS: Timecloud  
Путь проекта на сервере:
- `/opt/trip-bot`

PM2 процесс:
- `ascii-uploader`

Бот работает через:
- Webhook

---

## 1) Подключение к серверу

```bash
ssh root@<YOUR_SERVER_IP>
