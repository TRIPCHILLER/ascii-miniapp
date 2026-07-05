# ASCII VISOR — changelog audit

Период: 2025-12-04 → текущий main

> **Статус документа:** неполный черновик, требует повторного запуска в окружении с настоящим `origin/main`.
>
> Причина: в текущем checkout нет remote `origin`; команда `git fetch origin main` завершилась ошибкой `fatal: 'origin' does not appear to be a git repository`. Поэтому ниже нельзя честно утверждать, что аудит проведён по реальному `origin/main`. Анализ сделан по доступной локальной ветке `work`, которая содержит main-like историю с merge-коммитами PR, но должна быть перепроверена на настоящем `origin/main` перед публичным использованием.

## 0. Надёжность аудита

### Что реально было проверено

- Рабочая директория: `/workspace/ascii-miniapp`.
- Текущая ветка: `work`.
- Remote `origin`: отсутствует.
- `git fetch origin main`: **не выполнен**, потому что `origin` не настроен.
- База анализа: локальная история текущей ветки `work`.
- Период git-запросов: `--since="2025-12-04T00:00:00"`.
- Просмотрено по локальной истории:
  - all commits: **180** записей;
  - first-parent / merge-like history: **99** записей;
  - commits по ключевым словам из задачи: **104** записи;
  - месяцы с коммитами в доступной истории: **май 2026** и **июль 2026**.

### Ограничения

- Это **не полный аудит origin/main**. Перед подготовкой публичного поста нужно повторить аудит в окружении, где доступен настоящий `origin/main`.
- В локальной истории за период не обнаружены коммиты декабря 2025, января 2026, февраля 2026, марта 2026, апреля 2026 и июня 2026. Это может означать либо отсутствие изменений в этих месяцах, либо неполную локальную историю.
- Первый доступный merge-коммит периода — `b418b34` / PR #399 от 2026-05-13 — выглядит как крупное внесение уже существующего проекта: много файлов добавлены сразу. Из-за этого часть ранних изменений нельзя восстановить по отдельным PR внутри текущей локальной истории.
- Все выводы ниже нужно считать материалом для последующей редакторской подготовки, а не готовым публичным changelog.
- Для непонятных изменений использована пометка **требует ручной проверки**.
- Всё, что связано с ARG/Pong/скрытой игрой, вынесено в приватный раздел и не используется как публичный тезис.

### Команды, которые нужно повторить в идеальном окружении

```bash
git fetch origin main
git log --since="2025-12-04T00:00:00" --date=short --pretty=format:"%h | %ad | %s" origin/main
git log --first-parent --since="2025-12-04T00:00:00" --date=short --pretty=format:"%h | %ad | %s" origin/main
git show --stat <hash>
git show --name-only <hash>
git show --summary <hash>
```

## 1. Публично важные изменения

Это потенциальный материал для пользовательского update-поста. Раздел очищен от ARG/Pong/скрытой игры.

### 1.1 Интерфейс и удобство

- В доступной истории есть базовая сборка интерфейса WebApp: `index.html`, `styles.css`, `ascii.js`, набор SVG-кнопок, звуков и вспомогательные страницы `privacy.html` / `pro.html` появились в крупном merge `b418b34` / PR #399. Что именно из этого было новым относительно 2025-12-04 — **требует повторной проверки на origin/main**.
- В июле добавлялись и правились элементы UX для фонового Telegram/video render:
  - frontend helper для render job (`15bad93`, PR #455);
  - передача render config с фронтенда (`5aff82d`, PR #459);
  - портирование frontend-очереди render job (`b866560`, PR #461);
  - отделение helper от обычного save flow (`3beaa6a`, PR #461);
  - улучшение feedback UX (`0e80476`, PR #470);
  - ручное закрытие popup очереди (`07e0088`, PR #473);
  - более понятные статусы background render (`c95a80c`, PR #474).
- Менялись `index.html`, `styles.css` и `ascii.js`, то есть часть изменений была видна пользователю как новые кнопки/плашки/состояния интерфейса. Конкретный финальный вид нужно проверить вручную в браузере.
- По локальной истории видно несколько прямых `Update index.html` / `Update ascii.js` 2026-07-01—2026-07-05 без подробных сообщений. Их пользовательский эффект **требует ручной проверки**.

### 1.2 Палитра, цвета и стили

- В доступной локальной истории главный явный блок по цветам/палитре относится к приватной зоне customize/profile: `f5dd4ce` / PR #402 — «видимая палитра в customize modal», а также pressed-state и цветовые правки кнопок (`e251104` / PR #404). Так как эти изменения связаны с leaderboard/customize и пересекаются со скрытой частью, в публичный пост их можно использовать только после ручного подтверждения, что они относятся к обычному пользовательскому UI.
- Цветовые/стилевые правки также затрагивали `styles.css` в мае: выравнивание popup, pressed-state кнопок, выделение текущего игрока, layout статистики, avatar/customize styles. В публичные блоки лучше не выносить, если не подтверждено, что это не ARG/Pong.
- В июле `styles.css` менялся для Telegram background render UX (`62f2e7b`, `b866560`, `0e80476`), что можно публично описывать как улучшение состояния/плашек фонового рендера после проверки UI.
- Пользовательские темы/сохранение кастомного стиля в локальной истории явно не раскрыты отдельными коммитами. **Требует ручной проверки** через сравнение с настоящим `origin/main` и через код `ascii.js`.

### 1.3 Шрифты и визуальный стиль

- В крупном merge `b418b34` присутствуют шрифты `BetterVCR.woff2`, `BetterVCR2.woff2`, `Cica-Regular.woff2`, `Konkovo.woff2`, `MS Gothic.woff2`, `PxPlus IBM VGA.woff2`, `basis33.regular.woff2`. Это важная визуальная база проекта, но по текущей локальной истории нельзя доказать, какие из них появились именно после 2025-12-04.
- 2026-07-01 добавлялись/переименовывались font assets, включая `PxPlus IBM VGA.ttf` (`3734246`, `f4ef277`, `febac35`). Это связано с улучшением серверного/Telegram MP4-рендера.
- Для Telegram video render добавлялись/исправлялись системный font renderer, glyph scaling, font atlas и frontend glyph atlas:
  - `08e7f08` / PR #464 — system font renderer;
  - `2977c4e` / PR #463 — glyph scaling;
  - `f84460f` / PR #465 — fallback, если font renderer пустой;
  - `7b489e4` / PR #466 — font atlas;
  - `2aea128` / PR #467 — frontend glyph atlas;
  - `713109b` / PR #468 — clipping glyph atlas.
- Публичный тезис: улучшалась читаемость/похожесть Telegram-видео на браузерный ASCII-рендер. Формулировку нужно подтвердить визуальным сравнением до/после.

### 1.4 Фото / Live / Camera

- В локальной истории базового merge `b418b34` присутствуют camera assets (`camera_button.svg`, active/circle variants), timer/flash icons, shutter sound и frontend `ascii.js`, но нет отдельной подробной истории фото/live/camera после 2025-12-04.
- Явное публичное изменение по сохранению изображения: `f937b9d` / PR #477 — исправление PNG save для P1X3L2 canvas.
- Возможные изменения zoom/pan/crop в публичном photo/live flow по доступным commit message не подтверждены. Есть crop в коммите `dc0d2b2`, но он относится к avatar pipeline и должен оставаться в приватном блоке до проверки.
- Перед публикацией обязательно руками проверить:
  - фото-загрузку;
  - live camera;
  - camera permissions;
  - save PNG;
  - поведение canvas-режимов P1X3L2/D0TS2.

### 1.5 Видео / GIF / MP4

- В июле появился большой блок Telegram/background video render:
  - frontend test helper для render job (`15bad93`, PR #455);
  - отправка render config с frontend (`5aff82d`, PR #459);
  - frontend render queue (`b866560`, PR #461);
  - helper вынесен из обычного save flow (`3beaa6a`, PR #461);
  - backend background render отполирован и заменён guarded queue (`62f2e7b`, `c983f6f`, PR #462);
  - cleanup render job и grid width chars (`ee75c62`, PR #462);
  - renderer glyph scaling / system font renderer / atlas fixes (`2977c4e`, `08e7f08`, `f84460f`, `7b489e4`, `2aea128`, `713109b`);
  - preflight перед Telegram background render (`8f0f539`, PR #469);
  - подключение background render к сохранению видео (`f7b6738`, PR #469);
  - retry/status handling (`9de264e`, PR #472);
  - diagnostics render job (`4952a58`, PR #471);
  - temporary status messages (`172d398`, PR #476).
- Публично можно описывать как: «появился/усилился фоновый рендер видео для Telegram, с очередью, статусами, предзапусковой проверкой и более стабильной доставкой результата» — но слово «появился» требует проверки, если функция существовала раньше.
- GIF в доступной локальной истории отдельными коммитами не раскрыт. **Требует ручной проверки**.
- MP4 явно затронут через `fix-font-rendering-issues-in-mp4-output` / PR #465 и `backend/renderTelegramVideo.js`.

### 1.6 Telegram-бот и сообщения

- В июле улучшались сообщения и статусы Telegram background render:
  - `0e80476` / PR #470 — feedback UX;
  - `9423c1f`, `3e9b555`, `172d398` / PR #475—#476 — редактирование/переходы/временность статусных сообщений;
  - `9de264e` / PR #472 — retry status handling;
  - `c95a80c` / PR #474 — более понятный UX статуса;
  - `efbb91d`, `098f7bf`, `73dc487` — прямые `Update server.js`, детали требуют ручной проверки.
- Из майских публичных bot-изменений можно аккуратно упоминать `/buy_energy`: обновление текста и кнопок меню покупки импульсов (`4748265`, `4fc1a54`, `7332b35`, PR #424—#426). Это не связано напрямую с ARG/Pong, но нужно проверить фактический пользовательский flow.
- Harden Telegram axios error logging (`241d8fd`, PR #415) — лучше оставить техническим пунктом, не для публичного поста.

### 1.7 Наборы символов / визуальные режимы

- В июле добавлен и доведён P1X3L2:
  - `63b1a58` / PR #477 — P1X3L2 canvas shape charset;
  - `f937b9d` / PR #477 — PNG save для P1X3L2 canvas;
  - `fd20fdb` / PR #478 — preview transform;
  - `19ed351` / PR #479 — pixel tile rendering;
  - `205f945` / PR #480 — seams;
  - `cf626ba` / PR #481 — pixel sizes.
- В июле добавлен/исправлен D0TS2:
  - `6d7479f` / PR #482 — D0TS2 shape tile charset;
  - `9b6a343` / PR #483 — preview routing.
- Старые P1X3L и D0TS удалены из UI (`99ad588`, PR #484), чтобы не держать устаревшие варианты рядом с новыми.
- Katakana упоминается в майских коммитах в контексте скрытого boss/ARG render, поэтому не выносится в публичный блок без отдельной ручной проверки обычного ASCII-режима.
- Custom charset в доступной истории отдельно не подтверждён. **Требует ручной проверки**.

### 1.8 Экономика и импульсы

- Публично безопасный блок: изменения `/buy_energy` в Telegram — кнопки, тексты, формат подтверждения invoice (`4748265`, `4fc1a54`, `7332b35`, PR #424—#426).
- `backend/store.js` в локальной истории менялся мало: базовый merge `b418b34`, runtime-зависимости backend (`27cd6af`) и render status messages (`172d398`). Прямых публичных изменений баланса/списаний для обычного фото/видео flow по commit message не видно.
- ARG/Pong-награды и игровые импульсы не включать в публичный блок.
- Перед постом проверить понятность списаний за фото/видео, баланс перед render и Telegram Stars purchases вручную.

## 2. Технические фиксы НЕ для широкой публики

- Диагностика video render job: `4952a58` / PR #471.
- Queue internals и guarded backend render queue: `c983f6f`, `ee75c62`, `backend/renderQueue.js`, `backend/renderLimits.js`.
- Preflight/background render internals: `8f0f539`, `f7b6738`.
- Font renderer fallback/glyph atlas clipping/scaling: важны для качества, но как технические детали лучше не выносить в публичный пост полностью.
- Telegram axios error logging и split long messages: `241d8fd` / PR #415.
- Runtime dependencies backend / backend smoke tests around hidden economy: `27cd6af`, PR #414.
- Workflow/deploy и docs из базового merge `b418b34`.
- Прямые `Update server.js`, `Update ascii.js`, `Update index.html`, `Update renderLimits.js` без описания — требуют ручной проверки перед любой публичной формулировкой.

## 3. Скрытое / НЕ ДЛЯ ПУБЛИКАЦИИ

> В публичный пост это не включать. Не делать ARG/Pong одним из главных тезисов обновления.

- Большой майский блок PR #399—#448 связан со скрытой игрой/ARG/Pong, leaderboard, player profile, avatar customization, boss intro, mutation overlays, hidden economy и debug flow.
- Примеры приватных изменений:
  - leaderboard/customize modal, current player highlight, profile name/avatar flow (`#399`—`#412`);
  - Pong economy, impulses accrual, post-run summary, consolation bonus (`#413`, `#420`);
  - Telegram ARG/Pong message formatting (`#419`, `#430`, `#432`, `#434`, `#435`);
  - boss intro, mutation overlay, hidden visual randomness, Katakana boss render (`#421`—`#423`, `#436`—`#448`);
  - freezes/crashes/debug in hidden match finish flow (`#443`—`#448`).
- Даже если часть этих изменений выглядит как UX/palette/modal/style, в публичные разделы их нельзя переносить без явного подтверждения, что элемент относится к обычному ASCII VISOR flow.

## 4. Хронология по месяцам

### Декабрь 2025

- В доступной локальной истории коммитов за декабрь 2025 не найдено.
- Вывод: данных недостаточно; требуется повторный аудит по `origin/main`.

### Январь 2026

- В доступной локальной истории коммитов за январь 2026 не найдено.
- Вывод: данных недостаточно; требуется повторный аудит по `origin/main`.

### Февраль 2026

- В доступной локальной истории коммитов за февраль 2026 не найдено.
- Вывод: данных недостаточно; требуется повторный аудит по `origin/main`.

### Март 2026

- В доступной локальной истории коммитов за март 2026 не найдено.
- Вывод: данных недостаточно; требуется повторный аудит по `origin/main`.

### Апрель 2026

- В доступной локальной истории коммитов за апрель 2026 не найдено.
- Вывод: данных недостаточно; требуется повторный аудит по `origin/main`.

### Май 2026

- Найдено 107 коммитов в локальной истории.
- Главный блок: PR #399—#448.
- Затронутые файлы: `ascii.js`, `styles.css`, `backend/server.js`, `backend/store.js`, `backend/pongStore.js`, `assets/`, docs, workflow/deploy.
- Публично пригодное с осторожностью:
  - базовая структура WebApp и assets попали в историю через PR #399, но новизна относительно 2025-12-04 не доказана;
  - `/buy_energy` Telegram UI texts/buttons/invoice confirm (`#424`—`#426`) — можно рассмотреть для публичного блока про импульсы после ручной проверки;
  - отдельные pressed-state/style/modal fixes выглядят пользовательски заметными, но почти все связаны с скрытым leaderboard/profile/customize.
- НЕ ДЛЯ ПУБЛИКАЦИИ:
  - Pong/ARG profile, leaderboard, hidden economy, boss/mutation overlays, freeze fixes, hidden Telegram summaries.

### Июнь 2026

- В доступной локальной истории коммитов за июнь 2026 не найдено.
- Вывод: данных недостаточно; требуется повторный аудит по `origin/main`.

### Июль 2026

- Найдено 74 коммита в локальной истории.
- Главный публичный блок: Telegram/background video render, MP4/font rendering, queue/status UX, P1X3L2 и D0TS2.
- Затронутые файлы:
  - `ascii.js` — frontend render helper/queue/status UI, P1X3L2/D0TS2;
  - `index.html` — UI элементы render/P1X3L2/D0TS2;
  - `styles.css` — render feedback/popup/status styling;
  - `backend/server.js` — render job/status/Telegram delivery;
  - `backend/renderTelegramVideo.js` — MP4/glyph/font renderer;
  - `backend/renderQueue.js` / `backend/renderLimits.js` — очередь и лимиты;
  - `assets/` — font assets.
- Что пользователь мог заметить:
  - более понятный процесс фонового рендера видео в Telegram;
  - статусы и popup render queue;
  - стабильнее повторные/ошибочные состояния video render;
  - лучшее качество glyph/font rendering в MP4;
  - новые visual charset modes P1X3L2 и D0TS2;
  - удаление старых P1X3L/D0TS из UI.

## 5. Что можно вынести в большой публичный пост

- «ASCII VISOR стал удобнее»: улучшены состояния, popup и обратная связь вокруг фонового video render.
- «Видео в Telegram стало стабильнее»: очередь, preflight, retry/status handling, временные статусные сообщения.
- «MP4/Telegram render стал визуально ближе к браузерному»: font renderer, glyph atlas, scaling/clipping fixes.
- «Новые визуальные режимы»: P1X3L2 и D0TS2 как новые shape/pixel/dots-подходы к ASCII-выводу.
- «Меньше устаревших вариантов в UI»: старые P1X3L/D0TS удалены из интерфейса.
- «Сохранение результата улучшалось»: P1X3L2 canvas PNG save fix.
- «Telegram purchase/impulse UX стал понятнее»: только после ручной проверки `/buy_energy` и без упоминания скрытых наград.
- «Большая визуальная база со шрифтами и терминальным стилем»: упоминать аккуратно, потому что по локальной истории не доказано, что все шрифты добавлены именно в период аудита.

## 6. Что не стоит выносить в пост

- Внутреннюю диагностику render job и server logs.
- Queue internals, render status storage, cleanup details, renderLimits internals.
- Axios error logging и split long messages.
- Node/backend dependency cleanup и smoke tests.
- Прямые `Update ...` без понятного пользовательского эффекта.
- Любые временные багфиксы, которые пользователь не должен видеть как самостоятельную фичу.
- Всё, что связано с Pong/ARG/hidden game/boss/mutation/profile/leaderboard/game economy/avatar customization.

## 7. Что требует ручной проверки

- Фото-save: обычный PNG save и P1X3L2 canvas PNG save.
- Live camera: запуск камеры, разрешения, переключение режимов.
- Video render: полный путь выбора видео → render → результат.
- Повторный video render без перевыбора исходного файла.
- P1X3L2: preview, canvas render, seams, pixel sizes, save.
- D0TS2: shape tile charset и preview routing.
- Палитра: что доступно обычному пользователю, что относится только к hidden customize.
- Сохранение стилей/custom styles: наличие и стабильность не подтверждены commit messages.
- Telegram captions/status: временные сообщения, редактирование, удаление, понятность ошибок.
- Импульсы: списания за фото/видео, баланс, `/buy_energy`, Telegram Stars invoices.
- Шрифты: BetterVCR / MS Gothic / IBM VGA / CJK в обычном UI и в MP4 render.
- GIF: отдельной истории не найдено; проверить, есть ли актуальный GIF flow.

## 8. Raw data

### 8.1 Просмотренные PR / merge-like commits в доступной локальной истории

- `b418b34` — 2026-05-13 — Merge pull request #399 — fix leaderboard button click actions / крупный baseline import.
- `09ad938`—`18a3810` — 2026-05-13—2026-05-15 — PR #400—#448, преимущественно hidden ARG/Pong/profile/leaderboard/boss/mutation блок.
- `531ef66` — 2026-07-01 — PR #455 — frontend helper for render job.
- `6e3c464` — 2026-07-01 — PR #459 — render config from frontend helper.
- `8f241b1` — 2026-07-01 — PR #461 — frontend render queue/helper.
- `518c2a0` — 2026-07-01 — PR #462 — Telegram background render backend/queue polish.
- `ce8477b` — 2026-07-01 — PR #463 — glyph renderer scaling.
- `619a944` — 2026-07-01 — PR #464 — system font renderer for Telegram ASCII video.
- `5ded1fc` — 2026-07-01 — PR #465 — MP4 font rendering fallback.
- `ed4634f` — 2026-07-01 — PR #466 — font atlas for Telegram video renderer.
- `cfd7d62` — 2026-07-01 — PR #467 — frontend glyph atlas generation.
- `ee4935f` — 2026-07-01 — PR #468 — frontend glyph atlas clipping.
- `793b772` — 2026-07-01 — PR #469 — Telegram background render connection/preflight.
- `02bbae5` — 2026-07-01 — PR #470 — Telegram render feedback UX.
- `e71b923` — 2026-07-03 — PR #471 — `/api/render-video-job` diagnostics.
- `d537bc5` — 2026-07-03 — PR #472 — Telegram video render retry status handling.
- `9e5b738` — 2026-07-03 — PR #473 — queued render popup manual.
- `bb99191` — 2026-07-03 — PR #474 — background render status UX.
- `c935773` — 2026-07-03 — PR #475 — Telegram status transition/message edits.
- `a7849d1` — 2026-07-03 — PR #476 — temporary render status messages.
- `765f0eb` — 2026-07-03 — PR #477 — P1X3L2 canvas shape charset / PNG save.
- `cd3b7ea` — 2026-07-03 — PR #478 — P1X3L2 preview transform.
- `16aeab3` — 2026-07-03 — PR #479 — P1X3L2 pixel tile rendering.
- `f7a52b4` — 2026-07-05 — PR #480 — P1X3L2 tile seams.
- `2cd219f` — 2026-07-05 — PR #481 — P1X3L2 pixel sizes.
- `e9d98c9` — 2026-07-05 — PR #482 — D0TS2 shape tile charset.
- `8cdfbb9` — 2026-07-05 — PR #483 — D0TS2 preview routing.
- `1520389` — 2026-07-05 — PR #484 — remove old P1X3L/D0TS from UI.

### 8.2 Список просмотренных commit hash

Полный список all commits по локальной ветке за период содержит 180 записей. Наиболее релевантные для публичного аудита:

- `15bad93`, `5aff82d`, `b866560`, `3beaa6a`, `62f2e7b`, `c983f6f`, `ee75c62`, `2977c4e`, `08e7f08`, `f84460f`, `7b489e4`, `2aea128`, `713109b`, `f7b6738`, `8f0f539`, `0e80476`, `4952a58`, `9de264e`, `07e0088`, `c95a80c`, `9423c1f`, `3e9b555`, `172d398`.
- P1X3L2/D0TS2: `63b1a58`, `f937b9d`, `fd20fdb`, `19ed351`, `205f945`, `cf626ba`, `6d7479f`, `9b6a343`, `99ad588`.
- `/buy_energy` / публичная экономика: `4748265`, `4fc1a54`, `7332b35`.
- Шрифты/assets/render quality: `3734246`, `f4ef277`, `febac35`, плюс commits по renderer выше.
- Приватный hidden block: PR #399—#448 и связанные commits не перечисляются как публичные тезисы.

### 8.3 Файлы, которые чаще всего менялись

По `git log --name-only` в локальной истории с 2025-12-04:

- `ascii.js` — 65 изменений.
- `backend/server.js` — 34 изменения.
- `styles.css` — 15 изменений.
- `index.html` — 15 изменений.
- `backend/renderTelegramVideo.js` — 9 изменений.
- `backend/pongStore.js` — 6 изменений.
- `backend/store.js` — 4 изменения.
- `assets/player_avatar.svg` — 4 изменения.
- `backend/renderQueue.js` — 2 изменения.
- `backend/renderLimits.js` — 2 изменения.
- `docs/`, `backend/BACKEND_GUIDE.md`, `.github/workflows/deploy.yml`, `assets/` — затронуты в baseline/import и отдельных июльских font uploads.

### 8.4 Ключевые слова, по которым отдельно искалась история

`palette`, `color`, `swatch`, `style`, `font`, `modal`, `popup`, `settings`, `UI`, `UX`, `camera`, `live`, `photo`, `save`, `export`, `gif`, `video`, `crop`, `zoom`, `pan`, `telegram`, `render`, `queue`, `upload`, `status`, `ascii`, `charset`, `dots`, `pixel`, `blocks`, `katakana`, `custom`.

Результат: 104 commit entries в локальной истории. Основные публичные находки — video/render/status/font/P1X3L2/D0TS2; palette/modal/customize в основном пересекаются с приватным hidden block и требуют ручной проверки.
