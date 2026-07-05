# ASCII VISOR — changelog audit
Период: 2025-12-04 → текущий main

> Основа аудита: `git log --first-parent --since="2025-12-04T00:00:00"`, `git show --stat` по важным merge/update-коммитам и просмотр затронутых файлов. В локальной копии нет remote `origin`, поэтому `git fetch origin main` не был выполнен: Git вернул ошибку `'origin' does not appear to be a git repository`. Анализ проведён по текущему HEAD ветки `work`, который содержит историю main-подобной ветки до `1520389`.

## 1. Краткое резюме

После публичного UPDATE 4.10 проект заметно сместился от «конвертера в браузере» к более комплексной системе: Mini App + Telegram-бот + фоновый серверный рендер + игровой/ARG-слой.

Что стало лучше для пользователя:

- **Новые визуальные режимы P1X3L2 и D0TS2.** Добавлены отдельные canvas/shape-наборы для пиксельного и точечного вывода, затем доработаны швы, плотность, зум/панорама и маршрутизация preview. Старые P1X3L/D0TS убраны из UI.
- **Видео-рендер в Telegram стал отдельным пайплайном.** Появились `/api/render-video-job`, очередь, лимиты, статусы, отправка MP4 в чат, обработка ошибок и trace через `clientRenderId`.
- **MP4-результат стал визуально стабильнее.** Добавлены шрифты, glyph renderer, font atlas/frontend glyph atlas и fallback-режимы, чтобы backend-видео лучше совпадало с фронтендом.
- **Pong / ARG стал полноценнее.** Добавлены профиль игрока, имя, аватар, палитра, статистика, лидерборд, boss/mutation overlays, fast-forward intro и серия исправлений зависаний.
- **Экономика импульсов расширилась.** Pong начал начислять импульсы, появился утешительный бонус, обновлены `/buy_energy`, invoice confirm flow, Telegram-тексты и backend smoke-тесты.
- **Бот стал понятнее.** Улучшены сообщения, HTML-форматирование, статусы, кнопки и диагностика Telegram/axios ошибок.

Внутренние изменения: `backend/renderTelegramVideo.js`, `backend/renderQueue.js`, `backend/renderLimits.js`, новые ассеты/шрифты, тесты Pong economy/profile, логирование и deploy/workflow база.

## 2. Главные пользовательские изменения

### Интерфейс и UX

**Что изменилось.** PR #455, #459, #461, #469, #470 и отдельные update-коммиты меняли `index.html`, `styles.css` и `ascii.js`: helper-логика фронтенда, Telegram-интеграция, состояния кнопок, модалки, статусы и UI-полировка. Финально #484 убрал устаревшие P1X3L/D0TS из выбора.

**Почему важно.** Пользователь видит меньше устаревших пунктов и понятнее понимает, какой режим активен.

**Как ощущается.** Интерфейс стал чище, а действия — менее «слепыми»: меньше странных состояний кнопок и модальных окон.

**Подтверждают:** #455 `531ef66`, #459 `6e3c464`, #461 `8f241b1`, #469 `793b772`, #470 `02bbae5`, #484 `1520389`.

### Фото / live preview

**Что изменилось.** Явных PR с названием только про live/photo нет, но `ascii.js` активно менялся вместе с frontend-helper, Telegram-состояниями и новыми shape-наборами. Большие update/reformat-коммиты `b086534`, `01f6d7e`, `d4909fc` требуют ручной проверки.

**Почему важно.** Новые визуальные режимы должны одинаково вести себя в preview, фото и видео.

**Как ощущается.** Вероятно — стабильнее переключение режимов и preview для новых наборов; точные отличия live/photo нужно проверить вручную.

**Подтверждают:** `531ef66`, `6e3c464`, `793b772`, `02bbae5`, `d4909fc`. **Требует ручной проверки.**

### Видео-рендер

**Что изменилось.** Добавлен backend-пайплайн Telegram-видео: renderer, очередь, лимиты, endpoint `/api/render-video-job`, статусы job, отправка результата и сообщения об ошибках. После этого renderer несколько раз дорабатывался: glyph renderer, font rendering fixes, atlas renderer, frontend glyph atlas.

**Почему важно.** Видео — самый тяжёлый сценарий. Серверный job-подход снижает риск зависаний Mini App и даёт контролируемую доставку MP4 в Telegram.

**Как ощущается.** Пользователь запускает рендер, получает состояние процесса и итоговый файл в чате; при сбое появляется диагностируемая ошибка.

**Подтверждают:** #462 `518c2a0`, #463 `ce8477b`, #464 `619a944`, #465 `5ded1fc`, #466 `ed4634f`, #467 `cfd7d62`, #468 `ee4935f`, #471 `e71b923`, #472 `d537bc5`, #474 `bb99191`, #475 `c935773`, #476 `a7849d1`.

### Telegram-бот и сообщения в чате

**Что изменилось.** `backend/server.js` получил много правок: форматирование Pong/ARG сообщений, `/buy_energy` меню и тексты, invoice confirm flow, admin-only `/emoji_id`, статусы render-job, ошибки и служебные сообщения.

**Почему важно.** Telegram-бот — главный канал обратной связи. Даже маленькая ошибка HTML или кнопок ломает пользовательский путь.

**Как ощущается.** Команды, покупка энергии, результаты Pong/ARG и ошибки рендера стали понятнее и аккуратнее.

**Подтверждают:** #423 `fec22e1`, #424 `8ea2aca`, #425 `e695d13`, #426 `e438d98`, #430 `904f862`, #432 `d5c97e1`, #434 `553f4d2`, #435 `9be42f5`, #472 `d537bc5`, #475 `c935773`, #476 `a7849d1`.

### Сохранение результатов

**Что изменилось.** Для видео подтверждён новый серверный MP4-путь. Для PNG/save отдельного явного PR в периоде нет.

**Почему важно.** В публичном посте не стоит обещать новую PNG-фичу без smoke-test.

**Как ощущается.** Можно уверенно говорить про улучшенный MP4/Telegram result; PNG-сохранение пометить как сценарий для проверки.

**Подтверждают:** #462–#468 для MP4. PNG/save — **требует ручной проверки**.

### Наборы символов / новые визуальные режимы

**Что изменилось.** Добавлен P1X3L2 pixel set, затем он дорабатывался как pixel-tile render: исправлены зум/панорама, снижена плотность квадратиков, убраны видимые швы, ослаблено слипание ярких областей. Добавлен D0TS2 canvas-набор кружков и исправлена маршрутизация preview D0TS2 как shape-режима.

**Почему важно.** Это самый «публичный» блок: новые режимы сразу меняют картинку.

**Как ощущается.** Результаты становятся более графическими: не только текст, но пиксельные квадраты и точки.

**Подтверждают:** #477 `765f0eb`, #478 `cd3b7ea`, #479 `16aeab3`, #480 `f7a52b4`, #481 `2cd219f`, #482 `e9d98c9`, #483 `8cdfbb9`, #484 `1520389`.

### P1X3L2 / D0TS2 / tile-render

**Что изменилось.** P1X3L2 прошёл цепочку итераций от набора до tile-render. D0TS2 добавлен как отдельный shape-mode и сразу получил bugfix rendering route.

**Почему важно.** Это не только смена charset-строки, а отдельная логика canvas/shape вывода.

**Как ощущается.** Больше ощущения «модульной графики»: квадраты, точки, плотность, швы и поведение зума/панорамы стали частью визуального стиля.

**Подтверждают:** #477–#484.

### Crop / zoom / pan

**Что изменилось.** В #478 явно указано исправление зума/панорамы для P1X3L2. В backend video filter есть технический crop для подготовки MP4-кадра, но отдельной пользовательской crop-фичи история не подтверждает.

**Почему важно.** Можно говорить про исправление zoom/pan в P1X3L2, но нельзя обещать новый ручной crop UI.

**Как ощущается.** P1X3L2 должен лучше вести себя при кадрировании/масштабировании. Ручной crop/zoom/pan — **требует проверки**.

**Подтверждают:** #478 `cd3b7ea`; backend crop — #462 и последующие.

### Экономика / импульсы / списания

**Что изменилось.** Добавлена экономика импульсов для Pong, smoke-тесты, утешительный бонус за 0 wins, обновлены `/buy_energy` кнопки/тексты и invoice confirm flow. Store менялся точечно.

**Почему важно.** Баланс и начисления — чувствительная часть продукта.

**Как ощущается.** Pong/ARG сильнее связан с экономикой VISOR: игра становится источником импульсов и частью общего прогресса.

**Подтверждают:** #413 `3146a7f`, #414 `e6c9073`, #420 `8da4329`, #424 `8ea2aca`, #425 `e695d13`, #426 `e438d98`, #476 `a7849d1`.

### Pong / ARG / профиль

**Что изменилось.** Добавлены кастомизация профиля, avatar colors/images, сохранение имени, layout статистики, текущий игрок в таблице. Отдельно: L33D nicknames, boss intro, fast-forward ARG intro, visual randomness, mutation overlay, micro-vibrations и серия фиксов зависаний на bot/boss score 3.

**Почему важно.** Pong/ARG стал не просто пасхалкой, а отдельным игровым слоем с профилем и наградами.

**Как ощущается.** Больше персонализации, атмосферы и меньше критичных зависаний.

**Подтверждают:** #399–#422, #427–#448.

### Сервер / deploy / стабильность

**Что изменилось.** Базовый импорт добавил workflow/deploy/env example/backend guide. Позже появились очередь рендера, лимиты, renderer, тесты и диагностика Telegram/render job.

**Почему важно.** Это не всегда видно пользователю, но повышает устойчивость тяжёлых сценариев.

**Как ощущается.** Меньше молчаливых сбоев и больше понятных статусов.

**Подтверждают:** `edf833a`, #414 `e6c9073`, #415 `86eadca`, #462 `518c2a0`, #471 `e71b923`, #475 `c935773`, #476 `a7849d1`.

### Багфиксы и диагностика

**Что изменилось.** Исправлялись leaderboard-клики, кнопки, модалки, сохранение имени, цвета аватара, Telegram axios logging, форматирование сообщений, зависания Pong/ARG, overlay lifecycle, D0TS2 rendering и статусы серверного рендера.

**Почему важно.** Это не всегда «новые фичи», но именно они делают продукт предсказуемым.

**Как ощущается.** Меньше зависаний, меньше странных UI-состояний, легче понять ошибку.

**Подтверждают:** #399–#406, #411–#418, #432–#448, #483.

## 3. Подробная хронология

| Дата | Commit / PR | Файлы | Что изменилось | Тип изменения |
|---|---|---|---|---|
| 2026-05-13 | `edf833a` | много файлов, assets, backend, workflow | Крупный базовый импорт проекта: frontend, backend, ассеты, deploy/workflow, guide/env example. | infra |
| 2026-05-13 | #399 `b418b34` | `ascii.js`, `styles.css` | Исправлены действия кнопок leaderboard. | bugfix |
| 2026-05-13 | #400 `09ad938` | `ascii.js` | Исправлено поведение кнопки/символа `]`; точная семантика требует ручной проверки. | bugfix |
| 2026-05-13 | #401 `5590345` | `ascii.js`, `styles.css` | Исправлено открытие окна кастомизации. | bugfix |
| 2026-05-13 | #402 `a772683` | `ascii.js`, `styles.css` | Полировка дизайна модалки кастомизации и палитры. | UX |
| 2026-05-13 | #403 `8455770` | `styles.css` | Выравнивание заголовка модалки и состояния кнопок. | UX |
| 2026-05-13 | `03b5f9b`, `68cd3c8` | `assets/player_avatar.svg` | Удаление и повторное добавление avatar asset. | visual |
| 2026-05-13 | #404 `4f203af` | `styles.css` | Исправлен цвет текста в pressed-состоянии кнопок. | UX |
| 2026-05-13 | #405 `e308600` | `ascii.js`, `styles.css` | Обновлена подсветка текущего игрока в таблице статистики. | UX |
| 2026-05-14 | #406 `f9a3159` | `ascii.js` | Убран auto-focus из name/avatar modal. | UX |
| 2026-05-14 | #407 `7eb155c` | `ascii.js`, `styles.css` | Рефактор layout статистики игрока. | refactor |
| 2026-05-14 | #408 `9410868` | `ascii.js`, `styles.css` | Обновлены layout и naming экрана статистики. | UX |
| 2026-05-14 | #409 `a34bf8f` | `ascii.js`, `backend/pongStore.js`, `styles.css` | Изменён формат отображения системного имени и размер аватара. | UX |
| 2026-05-14 | #410 `524789f` | `ascii.js`, `styles.css` | Добавлена кастомизация профиля игрока. | feature |
| 2026-05-14 | #411 `885808c` | `ascii.js`, `styles.css` | Исправления после добавления пользовательских аватаров. | bugfix |
| 2026-05-14 | #412 `803f8af` | `ascii.js`, `backend/server.js` | Диагностика сохранения профиля игрока. | diagnostics |
| 2026-05-14 | #413 `3146a7f` | `backend/pongStore.js`, `backend/server.js` | Реализована экономика импульсов для Pong. | economy |
| 2026-05-14 | #414 `e6c9073` | tests, store/server, package | Добавлен backend smoke-test для Pong economy. | diagnostics |
| 2026-05-14 | #415 `86eadca` | `backend/server.js` | Улучшено логирование Telegram/axios ошибок. | diagnostics |
| 2026-05-14 | #416 `78224bf` | `ascii.js`, `backend/server.js` | Исправлена смена цвета аватара. | bugfix |
| 2026-05-14 | #417 `64cc9ab` | `ascii.js`, `backend/server.js` | Оптимизировано хранение кастомных аватаров. | backend |
| 2026-05-14 | #418 `f9f2b0a` | `backend/pongStore.js`, test | Исправлена логика хранения nickname игрока, добавлен тест. | bugfix |
| 2026-05-14 | `b086534` | `ascii.js` | Большой update/reformat без ясного сообщения; требует ручной проверки. | refactor |
| 2026-05-14 | #419 `ae5efde` | `ascii.js`, `backend/server.js` | Обновлены тексты ответов Pong/ARG. | UX |
| 2026-05-14 | #420 `8da4329` | `ascii.js`, economy test, server | Добавлен утешительный бонус за 0 wins в Pong. | economy |
| 2026-05-14 | #421 `b5c85b5` | `ascii.js` | Рефактор easter egg effect logic. | refactor |
| 2026-05-14 | #422 `462628f` | `ascii.js` | Обновлена последовательность boss intro pop-up. | visual |
| 2026-05-14 | #423 `fec22e1` | `backend/server.js` | Добавлена admin-only команда `/emoji_id`. | backend |
| 2026-05-14 | #424 `8ea2aca` | `backend/server.js` | Обновлены кнопки в меню `/buy_energy`. | economy |
| 2026-05-14 | #425 `e695d13` | `backend/server.js` | Обновлены Telegram-тексты `/buy_energy`. | economy |
| 2026-05-14 | #426 `e438d98` | `backend/server.js` | Исправлен invoice confirm flow для `/buy_energy`. | economy |
| 2026-05-14 | #427 `33c4a33` | `ascii.js` | Применён L33D-фильтр к Pong nicknames. | visual |
| 2026-05-14 | #428 `3e47a0a` | `ascii.js` | Настроен timing easter scroll effect. | UX |
| 2026-05-14 | #429 `6733475` | `ascii.js` | Исправлено сохранение имени в edit self window. | bugfix |
| 2026-05-14 | #430 `904f862` | `backend/server.js` | Форматирование Telegram-сообщений Pong/ARG. | UX |
| 2026-05-14 | #431 `5b24d5d` | `ascii.js` | Настроена acceleration curve для easter scroll. | UX |
| 2026-05-14 | `697716e`–`babb8a5` | `backend/server.js` | Серия мелких update server.js; по сообщениям неясно, требует ручной проверки. | backend |
| 2026-05-14 | #432 `d5c97e1` | `backend/server.js` | Исправлено форматирование ARG-сообщения. | bugfix |
| 2026-05-14 | #433 `7a9e2e6` | `ascii.js` | Добавлен fast-forward для ARG intro. | UX |
| 2026-05-14 | `01f6d7e` | `ascii.js` | Большой update/reformat без ясного сообщения; требует ручной проверки. | refactor |
| 2026-05-14 | #434–#435 `553f4d2`, `9be42f5` | `backend/server.js` | Исправлено форматирование финальной quote в ARG run message. | bugfix |
| 2026-05-14 | #436 `2d49fa0` | `ascii.js` | Обновлена визуальная случайность boss для Pong/ARG. | visual |
| 2026-05-14 | #437 `1e4d1ce` | `ascii.js` | Добавлен boss render mutation overlay. | visual |
| 2026-05-14 | #438 `c4f17c5` | `ascii.js` | Добавлены micro-vibrations для mutation overlay. | visual |
| 2026-05-14 | #439 `13b8553` | `ascii.js` | Исправлена инверсия boss render после смены preset. | bugfix |
| 2026-05-15 | #440 `c115af8` | `ascii.js` | Исправлен boss render после первой победы. | bugfix |
| 2026-05-15 | #441 `37f08fe` | `ascii.js` | Ускорена печать boss intro. | UX |
| 2026-05-15 | #442 `6dfd31b` | `ascii.js` | Исправлены формат pop-up текста boss и countdown transition. | bugfix |
| 2026-05-15 | #443–#445 `4789a15`, `1690ad8`, `40f9f6c` | `ascii.js` | Серия исправлений зависаний игры на счёте bot/boss 3. | bugfix |
| 2026-05-15 | #446 `cad5fec` | `ascii.js` | Исправлен scope `pushArgDebug` в finish flow. | diagnostics |
| 2026-05-15 | #447 `8e74747` | `ascii.js` | Исправлен lifecycle ARG/Pong mutation overlay. | bugfix |
| 2026-05-15 | #448 `18a3810` | `ascii.js` | Исправлен mutation overlay после победы игрока. | bugfix |
| 2026-07-01 | #455 `531ef66` | `ascii.js`, `index.html` | Добавлен/обновлён frontend helper. | UX |
| 2026-07-01 | #459 `6e3c464` | `ascii.js`, `index.html` | Frontend PR: вероятно UI/helper изменения; требует ручной проверки деталей. | UX |
| 2026-07-01 | #461 `8f241b1` | `ascii.js`, `index.html`, `styles.css` | Frontend polish после PR #460/main. | UX |
| 2026-07-01 | #462 `518c2a0` | render queue/limits/video/server/styles | Добавлен Telegram background render: очередь, лимиты, renderer, server route. | feature |
| 2026-07-01 | #463 `ce8477b` | `backend/renderTelegramVideo.js` | Доработан glyph renderer. | visual |
| 2026-07-01 | #464 `619a944` | `backend/renderTelegramVideo.js` | Существенная доработка renderTelegramVideo. | backend |
| 2026-07-01 | `3734246`, `f4ef277`, `febac35` | fonts | Добавлены/переименованы шрифты BetterVCR и PxPlus IBM VGA. | visual |
| 2026-07-01 | #465 `5ded1fc` | `backend/renderTelegramVideo.js` | Исправлены проблемы font rendering в MP4 output. | bugfix |
| 2026-07-01 | #466 `ed4634f` | `backend/renderTelegramVideo.js` | Добавлен/доработан atlas renderer. | visual |
| 2026-07-01 | #467 `cfd7d62` | `ascii.js`, `backend/renderTelegramVideo.js` | Генерация frontend glyph atlas и передача на backend. | feature |
| 2026-07-01 | #468 `ee4935f` | `ascii.js`, `backend/renderTelegramVideo.js` | Доработка glyph atlas интеграции. | visual |
| 2026-07-01 | #469 `793b772` | `ascii.js`, `index.html` | Telegram-related frontend изменения. | backend |
| 2026-07-01 | `7a799b4`–`f7a77a7` | `ascii.js`, `index.html` | Серия мелких update-коммитов frontend; часть — вероятный reformat/точечные правки. | refactor |
| 2026-07-01 | #470 `02bbae5` | `ascii.js`, `index.html`, `styles.css` | UX-правки. | UX |
| 2026-07-01 | `73dc487`, `098f7bf` | `backend/server.js` | Мелкие server updates; детали требуют ручной проверки. | backend |
| 2026-07-02 | `2941fd3` | `backend/renderLimits.js` | Изменён render limit. | infra |
| 2026-07-02 | `c615a65`, `d856f19` | `ascii.js`, `index.html` | Мелкие frontend updates. | UX |
| 2026-07-03 | #471 `e71b923` | `ascii.js`, `backend/server.js` | Endpoint `/api/render-video-job` и фронтенд-интеграция. | feature |
| 2026-07-03 | #472 `d537bc5` | `ascii.js`, `backend/server.js` | Telegram/render integration: больше статусов/обработки. | backend |
| 2026-07-03 | #473 `9e5b738` | `ascii.js` | Удалён popup-блок; точный эффект требует ручной проверки. | UX |
| 2026-07-03 | #474 `bb99191` | `ascii.js`, `backend/server.js` | UX + server changes around Telegram/render. | UX |
| 2026-07-03 | #475 `c935773` | `backend/server.js` | Улучшения Telegram/status логики. | backend |
| 2026-07-03 | #476 `a7849d1` | `backend/server.js`, `backend/store.js` | Telegram status и точечное изменение store. | backend |
| 2026-07-03 | `efbb91d` | `backend/server.js` | Мелкий server update. | backend |
| 2026-07-03 | #477 `765f0eb` | `ascii.js`, `index.html` | Добавлен новый P1X3L2 pixel set. | visual |
| 2026-07-03 | #478 `cd3b7ea` | `ascii.js` | P1X3L2: исправлены зум/панорама, снижена плотность квадратиков. | visual |
| 2026-07-03 | #479 `16aeab3` | `ascii.js` | P1X3L2 доработан как pixel-tile render. | visual |
| 2026-07-05 | #480 `f7a52b4` | `ascii.js` | Убраны видимые швы в P1X3L2. | visual |
| 2026-07-05 | #481 `2cd219f` | `ascii.js` | Ослаблено слипание ярких областей в P1X3L2. | visual |
| 2026-07-05 | #482 `e9d98c9` | `ascii.js`, `index.html` | Добавлен D0TS2 canvas-набор пиксельных кружков. | visual |
| 2026-07-05 | #483 `8cdfbb9` | `ascii.js` | Исправлена маршрутизация preview D0TS2 как shape-режима. | bugfix |
| 2026-07-05 | #484 `1520389` | `ascii.js`, `index.html` | Убраны устаревшие P1X3L и D0TS из UI, добавлена миграция на P1X3L2/D0TS2. | UX |

## 4. Список крупных фич для будущего поста

- Добавлены новые визуальные режимы **P1X3L2** и **D0TS2**.
- Улучшен tile/shape-render для P1X3L2: зум/панорама, плотность, швы, яркие области.
- Исправлен preview/render D0TS2.
- Старые P1X3L/D0TS убраны из UI.
- Появился серверный MP4-рендер для Telegram через job endpoint, очередь и статусы.
- Glyph atlas/font atlas улучшили соответствие видео-результата фронтенду.
- Pong/ARG получил профиль, аватар, кастомизацию и обновлённую статистику.
- Импульсы интегрированы в Pong/ARG-награды и сообщения.
- Исправлены зависания и ошибки overlay в boss flow.
- Обновлены тексты и кнопки Telegram-бота, особенно вокруг `/buy_energy`.

## 5. Технические изменения, которые не стоит выносить в пост

- Большие update/reformat-коммиты `b086534`, `01f6d7e`, `d4909fc` — не превращать в публичные фичи без ручной проверки.
- `clientRenderId`, status map, TTL cleanup и подробные logContext — разработческая диагностика.
- `backend/renderQueue.js` и `backend/renderLimits.js` — упоминать только как «стабильнее серверный рендер».
- Axios/Telegram error logging — внутренняя диагностика.
- Admin-only `/emoji_id` — не пользовательская фича.
- Smoke-тесты `backend/pong.economy.test.js` и `backend/pong.profile-name.test.js` — важны для качества, но не для публичного «что нового».
- Font fallback/atlas internals, probe ink ratio, missing glyph metrics — не выносить отдельно.
- Deploy/workflow/env example изменения — внутреннее.
- Мелкие server/frontend update-коммиты без содержательного сообщения — не использовать как доказательство публичных фич.

## 6. Возможные формулировки для публичного поста

### Короткий Telegram-пост

ASCII VISOR получил большой внутренний апдейт после UPDATE 4.10: новые визуальные режимы P1X3L2 и D0TS2, улучшенный серверный рендер видео в Telegram, более стабильный MP4-вывод, профиль и кастомизация в Pong/ARG, импульсы, бонусы и много фиксов зависаний/сообщений. Это не один «косметический» патч, а пачка изменений, которые делают VISOR заметно стабильнее и живее.

### Большой Telegram-пост

После UPDATE 4.10 в ASCII VISOR накопилось много изменений. Самое заметное — новые визуальные режимы P1X3L2 и D0TS2: больше пиксельной и точечной графики, меньше устаревших вариантов в интерфейсе. Отдельно был усилен видео-рендер: теперь тяжёлые Telegram-видео проходят через серверный job pipeline, очередь, статусы и улучшенный glyph/font atlas, чтобы результат в MP4 был ближе к тому, что видно во фронтенде.

Pong/ARG тоже сильно вырос: появились профиль игрока, кастомизация имени и аватара, обновлённая статистика, импульсы за раны, утешительный бонус и более атмосферные boss/mutation эффекты. Параллельно закрыта серия неприятных зависаний на boss/bot score 3 и исправлены сообщения бота.

Внутри стало больше диагностики: статусы рендера, trace/clientRenderId, логирование ошибок Telegram, тесты экономики Pong. Это не всегда видно снаружи, но именно такие вещи делают VISOR устойчивее.

### Список “что нового”

- P1X3L2 — новый пиксельный визуальный режим.
- D0TS2 — новый точечный визуальный режим.
- Старые P1X3L/D0TS убраны из выбора.
- Серверный MP4-рендер для Telegram получил очередь, статусы и обработку ошибок.
- Glyph atlas/font atlas улучшили соответствие видео-результата фронтенду.
- Pong/ARG получил профиль, аватар, кастомизацию и обновлённую статистику.
- Импульсы теперь интегрированы в Pong/ARG-награды и сообщения.
- Исправлены зависания и ошибки overlay в boss flow.
- Обновлены тексты и кнопки Telegram-бота, особенно вокруг `/buy_energy`.

### Атмосферная версия в стиле ASCII VISOR

Ядро VISOR было перепрошито. Старые контуры P1X3L/D0TS ушли в архив, на их месте поднялись P1X3L2 и D0TS2 — более плотные, более модульные, более резкие. Видео больше не бросается в пустоту: оно проходит через очередь, атлас глифов и серверный ритуал сборки, после чего возвращается в Telegram уже как готовый артефакт.

Внутри ARG-зоны ожил профиль: имя, аватар, импульсы, статистика, boss-сцены и mutation-overlay стали стабильнее. Несколько старых зависаний были выжжены из цикла. Бот научился говорить аккуратнее, а система — оставлять следы ошибок для диагностики.

## 7. Риски / что нужно проверить перед публикацией

- **P1X3L2**: фото, live preview, видео, tile/shape соответствие, zoom/pan.
- **D0TS2**: проверить, что #483 устранил проблему на фото и видео.
- **Видео-рендер**: короткое и среднее видео, очередь, получение MP4 в Telegram, повторный запуск.
- **Сохранение PNG**: проверить отдельно, потому что явного PR про новую save-логику нет.
- **Telegram-чат**: статусы рендера, ошибки, финальные сообщения, HTML-разметка.
- **Импульсы**: начисление за Pong, утешительный бонус, баланс после покупки, рефералка.
- **Pong/ARG**: boss score 3, победа игрока, overlay lifecycle, fast-forward intro.
- **Профиль игрока**: сохранение имени, цвета аватара, avatar image limits.
- **Mini App cache**: убедиться, что новые `index.html`/`ascii.js`/ассеты не кэшируются старой версией.
- **GitHub Pages / deploy**: проверить, если публичный rollout зависит от workflow из периода.
- **Большие reformat/update-коммиты**: не приписывать им фичи без ручного smoke-test.

## 8. Appendix: raw commit list

- `1520389` — 2026-07-05 — Merge pull request #484 from TRIPCHILLER/codex/remove-old-p1x3l-and-d0ts-from-ui
- `8cdfbb9` — 2026-07-05 — Merge pull request #483 from TRIPCHILLER/codex/fix-d0ts2-rendering-issue
- `e9d98c9` — 2026-07-05 — Merge pull request #482 from TRIPCHILLER/codex/-d0ts2
- `2cd219f` — 2026-07-05 — Merge pull request #481 from TRIPCHILLER/codex/-p1x3l2-swe7p5
- `f7a52b4` — 2026-07-05 — Merge pull request #480 from TRIPCHILLER/codex/-p1x3l2-yibory
- `16aeab3` — 2026-07-03 — Merge pull request #479 from TRIPCHILLER/codex/-p1x3l2-pixel-tile
- `cd3b7ea` — 2026-07-03 — Merge pull request #478 from TRIPCHILLER/codex/-p1x3l2
- `765f0eb` — 2026-07-03 — Merge pull request #477 from TRIPCHILLER/codex/add-new-p1x3l2-pixel-set
- `efbb91d` — 2026-07-03 — Update server.js
- `a7849d1` — 2026-07-03 — Merge pull request #476 from TRIPCHILLER/codex/-telegram-status
- `c935773` — 2026-07-03 — Merge pull request #475 from TRIPCHILLER/codex/-telegram-i7yb6s
- `bb99191` — 2026-07-03 — Merge pull request #474 from TRIPCHILLER/codex/-ux-lot3uu
- `9e5b738` — 2026-07-03 — Merge pull request #473 from TRIPCHILLER/codex/-popup
- `d537bc5` — 2026-07-03 — Merge pull request #472 from TRIPCHILLER/codex/-telegram-34qnsy
- `e71b923` — 2026-07-03 — Merge pull request #471 from TRIPCHILLER/codex/-/api/render-video-job
- `d856f19` — 2026-07-02 — Update index.html
- `c615a65` — 2026-07-02 — Update ascii.js
- `2941fd3` — 2026-07-02 — Update renderLimits.js
- `098f7bf` — 2026-07-01 — Update server.js
- `73dc487` — 2026-07-01 — Update server.js
- `d37b17c` — 2026-07-01 — Update ascii.js
- `02bbae5` — 2026-07-01 — Merge pull request #470 from TRIPCHILLER/codex/-ux
- `f7a77a7` — 2026-07-01 — Update index.html
- `e714d4b` — 2026-07-01 — Update ascii.js
- `56ed655` — 2026-07-01 — Update index.html
- `d4909fc` — 2026-07-01 — Update ascii.js
- `7a799b4` — 2026-07-01 — Update index.html
- `793b772` — 2026-07-01 — Merge pull request #469 from TRIPCHILLER/codex/-telegram
- `ee4935f` — 2026-07-01 — Merge pull request #468 from TRIPCHILLER/codex/-glyphatlas
- `cfd7d62` — 2026-07-01 — Merge pull request #467 from TRIPCHILLER/codex/implement-frontend-glyph-atlas-generation
- `ed4634f` — 2026-07-01 — Merge pull request #466 from TRIPCHILLER/codex/-atlas
- `5ded1fc` — 2026-07-01 — Merge pull request #465 from TRIPCHILLER/codex/fix-font-rendering-issues-in-mp4-output
- `febac35` — 2026-07-01 — Add files via upload
- `f4ef277` — 2026-07-01 — Rename PxPlus IBM VGA 9x16.ttf to PxPlus IBM VGA.ttf
- `3734246` — 2026-07-01 — Add files via upload
- `619a944` — 2026-07-01 — Merge pull request #464 from TRIPCHILLER/codex/-rendertelegramvideo.js
- `ce8477b` — 2026-07-01 — Merge pull request #463 from TRIPCHILLER/codex/-glyph-renderer
- `518c2a0` — 2026-07-01 — Merge pull request #462 from TRIPCHILLER/codex/polish-telegram-background-render
- `8f241b1` — 2026-07-01 — Merge pull request #461 from TRIPCHILLER/codex/-frontend-pr-#460-main
- `6e3c464` — 2026-07-01 — Merge pull request #459 from TRIPCHILLER/codex/-pr-#458-main
- `531ef66` — 2026-07-01 — Merge pull request #455 from TRIPCHILLER/codex/-frontend-helper-main
- `18a3810` — 2026-05-15 — Merge pull request #448 from TRIPCHILLER/codex/fix-mutation-overlay-after-player-win
- `8e74747` — 2026-05-15 — Merge pull request #447 from TRIPCHILLER/codex/fix-arg/pong-mutation-overlay-lifecycle
- `cad5fec` — 2026-05-15 — Merge pull request #446 from TRIPCHILLER/codex/fix-pushargdebug-scope-in-finish-flow
- `40f9f6c` — 2026-05-15 — Merge pull request #445 from TRIPCHILLER/codex/fix-game-freeze-at-boss-score-3
- `1690ad8` — 2026-05-15 — Merge pull request #444 from TRIPCHILLER/codex/fix-arg/pong-freeze-at-bot-score-3
- `4789a15` — 2026-05-15 — Merge pull request #443 from TRIPCHILLER/codex/fix-critical-game-freeze-at-bot-score-3
- `6dfd31b` — 2026-05-15 — Merge pull request #442 from TRIPCHILLER/codex/fix-boss-pop-up-text-formatting-and-countdown-transition
- `37f08fe` — 2026-05-15 — Merge pull request #441 from TRIPCHILLER/codex/speed-up-boss-intro-printing
- `c115af8` — 2026-05-15 — Merge pull request #440 from TRIPCHILLER/codex/fix-boss-render-after-first-victory
- `13b8553` — 2026-05-14 — Merge pull request #439 from TRIPCHILLER/codex/fix-boss-render-inversion-after-preset-change
- `c4f17c5` — 2026-05-14 — Merge pull request #438 from TRIPCHILLER/codex/add-micro-vibrations-to-mutation-overlay
- `1e4d1ce` — 2026-05-14 — Merge pull request #437 from TRIPCHILLER/codex/add-boss-render-mutation-overlay
- `2d49fa0` — 2026-05-14 — Merge pull request #436 from TRIPCHILLER/codex/update-boss-visual-randomness-for-pong/arg
- `9be42f5` — 2026-05-14 — Merge pull request #435 from TRIPCHILLER/codex/fix-formatting-of-final-quote-in-composeargrunmessage
- `553f4d2` — 2026-05-14 — Merge pull request #434 from TRIPCHILLER/codex/fix-final-quote-formatting-in-composeargrunmessage
- `01f6d7e` — 2026-05-14 — Update ascii.js
- `7a9e2e6` — 2026-05-14 — Merge pull request #433 from TRIPCHILLER/codex/add-fast-forward-mechanic-for-arg-intro
- `d5c97e1` — 2026-05-14 — Merge pull request #432 from TRIPCHILLER/codex/fix-arg-message-formatting-in-server.js
- `babb8a5` — 2026-05-14 — Update server.js
- `915b5f8` — 2026-05-14 — Update server.js
- `c3ff7f8` — 2026-05-14 — Update server.js
- `697716e` — 2026-05-14 — Update server.js
- `5b24d5d` — 2026-05-14 — Merge pull request #431 from TRIPCHILLER/codex/adjust-acceleration-curve-for-easter-scroll
- `904f862` — 2026-05-14 — Merge pull request #430 from TRIPCHILLER/codex/format-telegram-message-for-pong/arg
- `6733475` — 2026-05-14 — Merge pull request #429 from TRIPCHILLER/codex/fix-name-saving-in-edit-self-window
- `3e47a0a` — 2026-05-14 — Merge pull request #428 from TRIPCHILLER/codex/adjust-easter-scroll-effect-timing
- `33c4a33` — 2026-05-14 — Merge pull request #427 from TRIPCHILLER/codex/apply-l33d-filter-to-pong-nicknames
- `e438d98` — 2026-05-14 — Merge pull request #426 from TRIPCHILLER/codex/fix-invoice-confirm-flow-for-/buy_energy
- `e695d13` — 2026-05-14 — Merge pull request #425 from TRIPCHILLER/codex/update-telegram-/buy_energy-ui-texts
- `8ea2aca` — 2026-05-14 — Merge pull request #424 from TRIPCHILLER/codex/update-buttons-in-/buy_energy-menu
- `fec22e1` — 2026-05-14 — Merge pull request #423 from TRIPCHILLER/codex/add-admin-only-/emoji_id-command
- `462628f` — 2026-05-14 — Merge pull request #422 from TRIPCHILLER/codex/update-boss-intro-pop-up-sequence
- `b5c85b5` — 2026-05-14 — Merge pull request #421 from TRIPCHILLER/codex/refactor-easter-egg-effect-logic
- `8da4329` — 2026-05-14 — Merge pull request #420 from TRIPCHILLER/codex/add-consolation-bonus-for-zero-wins-in-pong
- `ae5efde` — 2026-05-14 — Merge pull request #419 from TRIPCHILLER/codex/update-texts-in-pong/arg-responses
- `b086534` — 2026-05-14 — Update ascii.js
- `f9f2b0a` — 2026-05-14 — Merge pull request #418 from TRIPCHILLER/codex/fix-player-nickname-storage-logic
- `64cc9ab` — 2026-05-14 — Merge pull request #417 from TRIPCHILLER/codex/optimize-storage-for-custom-avatars
- `78224bf` — 2026-05-14 — Merge pull request #416 from TRIPCHILLER/codex/fix-avatar-color-change-bug
- `86eadca` — 2026-05-14 — Merge pull request #415 from TRIPCHILLER/codex/fix-telegram/axios-error-logging
- `e6c9073` — 2026-05-14 — Merge pull request #414 from TRIPCHILLER/codex/add-backend-smoke-test-for-pong-economy
- `3146a7f` — 2026-05-14 — Merge pull request #413 from TRIPCHILLER/codex/implement-impulse-economy-for-pong-game
- `803f8af` — 2026-05-14 — Merge pull request #412 from TRIPCHILLER/codex/debug-player-profile-saving-issues
- `885808c` — 2026-05-14 — Merge pull request #411 from TRIPCHILLER/codex/fix-bugs-after-adding-user-avatars
- `524789f` — 2026-05-14 — Merge pull request #410 from TRIPCHILLER/codex/add-player-profile-customization-features
- `a34bf8f` — 2026-05-14 — Merge pull request #409 from TRIPCHILLER/codex/update-system-name-display-format-and-avatar-size
- `9410868` — 2026-05-14 — Merge pull request #408 from TRIPCHILLER/codex/update-statistics-screen-layout-and-naming
- `7eb155c` — 2026-05-14 — Merge pull request #407 from TRIPCHILLER/codex/refactor-player-statistics-layout
- `f9a3159` — 2026-05-14 — Merge pull request #406 from TRIPCHILLER/codex/remove-auto-focus-from-name/avatar-modal
- `e308600` — 2026-05-13 — Merge pull request #405 from TRIPCHILLER/codex/update-current-player-highlight-in-stats-table
- `4f203af` — 2026-05-13 — Merge pull request #404 from TRIPCHILLER/codex/fix-pressed-state-text-color-for-buttons
- `68cd3c8` — 2026-05-13 — Add files via upload
- `03b5f9b` — 2026-05-13 — Delete assets/player_avatar.svg
- `8455770` — 2026-05-13 — Merge pull request #403 from TRIPCHILLER/codex/fix-modal-header-alignment-and-button-states
- `a772683` — 2026-05-13 — Merge pull request #402 from TRIPCHILLER/codex/polish-customize-modal-design-and-palette
- `5590345` — 2026-05-13 — Merge pull request #401 from TRIPCHILLER/codex/fix-customize-modal-not-opening
- `09ad938` — 2026-05-13 — Merge pull request #400 from TRIPCHILLER/codex/fix-button-behaviour-for-]
- `b418b34` — 2026-05-13 — Merge pull request #399 from TRIPCHILLER/codex/fix-leaderboard-button-click-actions
- `edf833a` — 2026-05-13 — Delete asciidemotrack.mp3
