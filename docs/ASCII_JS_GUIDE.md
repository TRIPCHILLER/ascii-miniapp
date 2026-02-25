# ASCII.JS Guide (navigation by @section)

В `ascii.js` добавлены якоря навигации вида:

```js
// @section SECTION_NAME

Ими удобно пользоваться через поиск @section.

Sections
@section UTILS

Утилиты и мелкие помощники (querySelector shorthand, mobile detection, orientation lock, т.п.)

@section STATE_CONFIG

Объект state и дефолтные параметры (камера, ширина, контраст, базовые пресеты).

@section STYLE_PRESETS_FONTS

Font stacks, пресеты шрифтов/измерения, применяемые к отображению ASCII.

@section TELEGRAM_WEBAPP_API

Интеграция с Telegram WebApp API (tg, expand, MainButton, взаимодействие с контейнером Telegram).

@section UI_INTERACTION_GUARDS

Запрет выделения текста/контекстного меню и прочие защитные UI-ограничения.

@section MODE_LIVE_CAMERA

Вспышка/torch и элементы, связанные с live-режимом камеры (подсветка, иконки, доступность).

@section CAMERA_STREAM_LIFECYCLE

Запуск/остановка камеры, переиспользование разрешений, управление media stream.

@section ASCII_RENDER_ENGINE

Основной рендер ASCII (конвертация пикселей → символы, плотность, математика отображения).

@section VIEWPORT_CROP_FULLSCREEN

Логика “вписывания”/crop в viewport, зум/масштабирование видимой области.

@section FULLSCREEN_CONTROLS

Полноэкранный режим (tap-to-exit / double tap и т.п.)

@section UI_BINDINGS

Основная связка UI: обработчики контролов, кнопок, переключателей.

@section STAGE_GESTURES

Жесты на “сцене” (pinch-zoom, pan, тач-управление).

@section MODE_SWITCHING

Переключение режимов (нижние кнопки режимов, правила переходов).

@section MODE_PHOTO

Выбор/загрузка фото, обработка photo-ветки.

@section MODE_VIDEO_GIF

Выбор/загрузка видео, ветка GIF как часть видео-пайплайна (парсинг в кадры / обычное видео).

@section COLOR_PALETTES_PICKER

Палитры / колорпикер / сетки цветов / прозрачный фон и всё, что связано с цветом.

@section EXPORT_SAVE_SHARE

Экспорт и сохранение результатов (png/video/прочее), общие save-хелперы.

@section BOOTSTRAP_INIT

Стартовая инициализация приложения, первичный запуск, wiring на загрузке.

Quick “Where to change”

UI стили/позиции → styles.css

текст/структура кнопок → index.html

камера / потоки → CAMERA_STREAM_LIFECYCLE

рендер ASCII → ASCII_RENDER_ENGINE

палитры/цвет/прозрачность → COLOR_PALETTES_PICKER

экспорт → EXPORT_SAVE_SHARE

Telegram MainButton/интеграция → TELEGRAM_WEBAPP_API
