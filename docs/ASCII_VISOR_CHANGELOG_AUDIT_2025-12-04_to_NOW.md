# ASCII VISOR — changelog audit

Период: 2025-12-04 → текущий `origin/main`

> **Статус:** полный аудит сейчас невозможен.
>
> Этот документ намеренно **не выдаёт локальную историю за настоящий `origin/main`**. По требованию задачи анализ был остановлен после неуспешной попытки получить реальную ветку GitHub.

## 0. Надёжность аудита

### Что было сделано

1. Проверен список remote:

```bash
git remote -v
```

На момент проверки remote `origin` отсутствовал.

2. Добавлен настоящий GitHub remote:

```bash
git remote add origin https://github.com/TRIPCHILLER/ascii-miniapp.git
```

3. Выполнена обязательная попытка получить `origin/main`:

```bash
git fetch origin main --tags
```

Результат:

```text
fatal: unable to access 'https://github.com/TRIPCHILLER/ascii-miniapp.git/': CONNECT tunnel failed, response 403
```

4. Проверено состояние shallow checkout:

```bash
git rev-parse --is-shallow-repository
```

Результат:

```text
true
```

5. Проверка истории `origin/main` невозможна, потому что ref `origin/main` не был загружен:

```bash
git log --since="2025-12-04T00:00:00" --date=short --pretty=format:"%h | %ad | %s" origin/main
```

Результат:

```text
fatal: ambiguous argument 'origin/main': unknown revision or path not in the working tree.
```

### Итог по надёжности

- `origin` удалось добавить локально.
- `origin/main` получить **не удалось** из-за сетевой ошибки доступа к GitHub: `CONNECT tunnel failed, response 403`.
- Репозиторий в текущем окружении является shallow checkout.
- Количество реально просмотренных коммитов `origin/main`: **0**.
- Покрытые месяцы по настоящему `origin/main`: **0 месяцев**.
- Полный changelog-аудит за период 2025-12-04 → текущий `origin/main` в этом окружении **невозможен**.
- Предыдущая локальная история ветки `work` не используется как источник полного аудита, потому что задача прямо требует настоящий `origin/main` и запрещает выдавать неполный анализ за полный.

### Что нужно сделать в окружении с доступом к GitHub

Повторить команды:

```bash
git remote -v
git fetch origin main --tags
git fetch --unshallow origin main || git fetch origin main --depth=10000
git log --since="2025-12-04T00:00:00" --date=short --pretty=format:"%h | %ad | %s" origin/main
git log --first-parent --since="2025-12-04T00:00:00" --date=short --pretty=format:"%h | %ad | %s" origin/main
```

После этого нужно убедиться, что история содержит не только май и июль 2026, а также месяцы декабря 2025, января, февраля, марта, апреля, мая, июня и июля 2026 — если в эти месяцы действительно были изменения.

## 1. Публично важные изменения

Полный раздел не заполнен, потому что настоящий `origin/main` недоступен.

Для будущего аудита нужно отдельно раскрыть только подтверждённые по `origin/main` пользовательские изменения:

### 1.1 Интерфейс и UX

Проверить по истории `index.html`, `styles.css`, `ascii.js`:

- панели и блоки управления;
- кнопки режимов;
- popup и модалки;
- поведение закрытия;
- этапы процесса;
- тексты ошибок и статусов;
- любые UX-улучшения, видимые пользователю.

### 1.2 Палитра, цвета и стили

Проверить по истории `ascii.js`, `styles.css`, `index.html`:

- палитры;
- color swatches;
- выбор цвета текста и фона;
- сохранение пользовательского стиля;
- custom style;
- изменения визуального оформления;
- какие изменения относятся к обычному UI, а какие — к скрытым/игровым экранам.

### 1.3 Шрифты и визуальный стиль

Проверить по истории `assets/`, `styles.css`, `ascii.js`, `backend/renderTelegramVideo.js`:

- BetterVCR;
- MS Gothic;
- PxPlus IBM VGA / IBM VGA;
- CJK/font stack;
- читаемость ASCII-вывода;
- соответствие браузерного и Telegram/MP4-рендера.

### 1.4 Фото / Live / Camera

Проверить по истории `ascii.js`, `index.html`, `styles.css`, `assets/`:

- photo mode;
- live camera;
- camera permissions;
- preview;
- save PNG;
- zoom/pan/crop, если такие изменения есть;
- фиксы поведения камеры и файлов.

### 1.5 Видео / GIF / MP4

Проверить по истории `ascii.js`, `backend/server.js`, `backend/renderTelegramVideo.js`, `backend/renderQueue.js`, `backend/renderLimits.js`:

- video render;
- GIF, если он реально менялся;
- MP4;
- background render;
- очередь;
- повторный render без перевыбора файла;
- качество glyph/font render;
- Telegram delivery.

### 1.6 Telegram-бот и сообщения

Проверить по истории `backend/server.js`, `backend/store.js`, `ascii.js`:

- статусы render;
- редактируемые сообщения;
- удаление временных плашек;
- caption под видео;
- копируемые ошибки;
- понятность bot-сообщений;
- Telegram Stars / purchase flow, если это публичный пользовательский сценарий.

### 1.7 Наборы символов / визуальные режимы

Проверить по истории `ascii.js`, `index.html`, `styles.css`:

- P1X3L2;
- D0TS2;
- старые P1X3L/D0TS;
- custom charset;
- Katakana;
- blocks;
- dots;
- pixel modes;
- какие режимы публичные, а какие относятся к скрытому/сырому flow.

### 1.8 Экономика и импульсы

Проверить по истории `backend/store.js`, `backend/server.js`, `ascii.js`:

- публичные покупки;
- баланс;
- списания за фото/видео;
- Telegram Stars;
- понятность ошибок баланса;
- не смешивать с hidden game rewards.

## 2. Технические фиксы не для широкой публики

Не заполнено без `origin/main`.

В будущем аудите сюда нужно вынести:

- `clientRenderId`;
- внутренние logs и diagnostics;
- queue internals;
- render status storage;
- helper/refactor;
- axios/server errors;
- workflow/deploy;
- tests/smoke checks;
- `node --check` и другие технические проверки.

## 3. Скрытое / НЕ ДЛЯ ПУБЛИКАЦИИ

Не заполнено без `origin/main`.

В будущем аудите сюда нужно вынести всё, что связано с:

- Pong;
- ARG;
- boss;
- mutation;
- hidden game;
- leaderboard;
- player profile;
- avatar customization;
- hidden game economy.

Эти изменения нельзя включать в публичные разделы и нельзя делать главным тезисом публичного обновления.

## 4. Хронология по месяцам

Настоящая хронология по `origin/main` не собрана, потому что `origin/main` недоступен.

### Декабрь 2025

- Не проверено по `origin/main`.

### Январь 2026

- Не проверено по `origin/main`.

### Февраль 2026

- Не проверено по `origin/main`.

### Март 2026

- Не проверено по `origin/main`.

### Апрель 2026

- Не проверено по `origin/main`.

### Май 2026

- Не проверено по `origin/main`.

### Июнь 2026

- Не проверено по `origin/main`.

### Июль 2026

- Не проверено по `origin/main`.

## 5. Что можно вынести в большой публичный пост

Пока ничего нельзя утверждать как результат полного аудита `origin/main`.

После успешного fetch нужно выбрать только подтверждённые публичные тезисы без ARG/Pong:

- крупные пользовательские фичи;
- заметные UX-улучшения;
- улучшения стабильности фото/live/video;
- новые визуальные режимы;
- улучшения Telegram-результатов;
- улучшения палитры, шрифтов и стилей;
- понятные изменения экономики и покупок, если они относятся к публичному flow.

## 6. Что не стоит выносить в пост

Даже после полного аудита не выносить в публичный пост:

- внутреннюю диагностику;
- временные багфиксы;
- server/helper/refactor changes;
- queue internals;
- deploy/workflow шум;
- тестовые изменения;
- скрытую игру;
- ARG/Pong;
- hidden game economy;
- leaderboard/profile/avatar customization, если это часть скрытого flow.

## 7. Что требует ручной проверки

После повторного запуска аудита на настоящем `origin/main` вручную проверить:

- фото-save;
- live camera;
- video render;
- повторный video render без перевыбора;
- GIF flow, если он есть;
- MP4 quality;
- Telegram delivery;
- Telegram captions/status;
- P1X3L2;
- D0TS2;
- custom charset;
- Katakana/blocks/dots modes;
- палитру;
- swatches;
- сохранение стилей;
- custom style;
- шрифты BetterVCR / MS Gothic / IBM VGA / CJK;
- покупки;
- баланс;
- списания за фото/видео;
- Telegram Stars.

## 8. Raw data

### 8.1 Просмотренные PR/commit hash по настоящему `origin/main`

Не собраны: `origin/main` не загружен.

### 8.2 Часто меняющиеся файлы по настоящему `origin/main`

Не собраны: `origin/main` не загружен.

Файлы, которые нужно отдельно анализировать после успешного fetch:

- `ascii.js`;
- `styles.css`;
- `index.html`;
- `assets/`;
- `backend/server.js`;
- `backend/store.js`;
- `backend/renderTelegramVideo.js`;
- `backend/renderQueue.js`;
- `backend/renderLimits.js`.

### 8.3 Команды для raw data после восстановления доступа

```bash
git log --since="2025-12-04T00:00:00" --date=short --pretty=format:"%h | %ad | %s" origin/main

git log --first-parent --since="2025-12-04T00:00:00" --date=short --pretty=format:"%h | %ad | %s" origin/main

git log --since="2025-12-04T00:00:00" --name-only --pretty=format: origin/main | sed '/^$/d' | sort | uniq -c | sort -nr

for path in ascii.js styles.css index.html assets backend/server.js backend/store.js backend/renderTelegramVideo.js backend/renderQueue.js backend/renderLimits.js; do
  echo "## $path"
  git log --since="2025-12-04T00:00:00" --date=short --pretty=format:'%h | %ad | %s' origin/main -- "$path"
done
```

### 8.4 Ключевые слова для повторного поиска

`palette`, `color`, `swatch`, `style`, `custom style`, `font`, `modal`, `popup`, `settings`, `UI`, `UX`, `camera`, `live`, `photo`, `save`, `export`, `gif`, `video`, `crop`, `zoom`, `pan`, `telegram`, `render`, `queue`, `upload`, `status`, `ascii`, `charset`, `dots`, `pixel`, `blocks`, `katakana`, `custom`.
