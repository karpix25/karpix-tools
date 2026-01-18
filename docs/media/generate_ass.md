# Эндпоинт генерации субтитров ASS (v1)

## 1. Обзор

Эндпоинт `/v1/media/generate/ass` является частью Media API и отвечает за генерацию файла субтитров ASS (Advanced SubStation Alpha) из медиафайла (обычно видео или аудио). Он принимает URL-адрес медиа и различные параметры стилизации субтитров. Эндпоинт использует сервис `generate_ass_captions_v1` для генерации ASS-файла, который затем загружается в облачное хранилище, а URL-адрес возвращается в ответе.

## 2. Эндпоинт (Endpoint)

**URL:** `/v1/media/generate/ass`
**Метод:** `POST`

## 3. Запрос

### Заголовки (Headers)

- `x-api-key`: Обязательно. Ключ API для аутентификации.

### Параметры тела запроса

Тело запроса должно быть объектом JSON со следующими свойствами:
> **Примечание:** Параметры `canvas_width` и `canvas_height` рекомендуются для аудиофайлов (например, MP3), чтобы контролировать размер холста субтитров.

- `media_url` (string, обязательно): URL-адрес медиафайла для генерации субтитров.
- `canvas_width` (integer, необязательно): Ширина холста субтитров в пикселях.
- `canvas_height` (integer, необязательно): Высота холста субтитров в пикселях.
- `settings` (object, необязательно): Объект с параметрами стилизации. См. схему ниже.
- `replace` (array, необязательно): Массив объектов `find` и `replace` для текстовых замен в субтитрах.
- `exclude_time_ranges` (array, необязательно): Время, которое нужно пропустить при генерации. Каждый элемент должен содержать:
  - `start`: (string, обязательно) Время начала в формате `чч:мм:сс.мс`.
  - `end`: (string, обязательно) Время окончания в формате `чч:мм:сс.мс` (должно быть больше `start`).
- `language` (string, необязательно): Код языка (например, "ru", "en"). По умолчанию "auto".
- `webhook_url` (string, необязательно): URL для уведомления вехуком по завершении.
- `id` (string, необязательно): Идентификатор запроса.

#### Схема настроек (Settings Schema)

```json
{
    "type": "object",
    "properties": {
        "line_color": {"type": "string"},
        "word_color": {"type": "string"},
        "outline_color": {"type": "string"},
        "all_caps": {"type": "boolean"},
        "max_words_per_line": {"type": "integer"},
        "x": {"type": "integer"},
        "y": {"type": "integer"},
        "position": {
            "type": "string",
            "enum": [
                "bottom_left", "bottom_center", "bottom_right",
                "middle_left", "middle_center", "middle_right",
                "top_left", "top_center", "top_right"
            ]
        },
        "alignment": {
            "type": "string",
            "enum": ["left", "center", "right"]
        },
        "font_family": {"type": "string"},
        "font_size": {"type": "integer"},
        "bold": {"type": "boolean"},
        "italic": {"type": "boolean"},
        "underline": {"type": "boolean"},
        "strikeout": {"type": "boolean"},
        "style": {
            "type": "string",
            "enum": [
                "classic",     // Весь текст отображается сразу
                "karaoke",     // Подсветка слов последовательно
                "highlight",   // Подсветка текущего слова (весь текст виден)
                "underline",   // Подчеркивание текущего слова
                "word_by_word" // По одному слову за раз
            ]
        },
        "outline_width": {"type": "integer"},
        "spacing": {"type": "integer"},
        "angle": {"type": "integer"},
        "shadow_offset": {"type": "integer"}
    },
    "additionalProperties": false
}
```

### Примеры запросов

#### Пример 1: Базовая генерация субтитров
```json
{
    "media_url": "https://example.com/video.mp4"
}
```
Этот запрос автоматически транскрибирует медиа и создаст белые субтитры внизу по центру.

#### Пример 2: Пользовательская стилизация
```json
{
    "media_url": "https://example.com/video.mp4",
    "settings": {
        "style": "classic",
        "line_color": "#FFFFFF",
        "outline_color": "#000000",
        "position": "bottom_center",
        "alignment": "center",
        "font_family": "Arial",
        "font_size": 24,
        "bold": true
    }
}
```

#### Пример 3: Караоке-стиль с расширенными параметрами
```json
{
    "media_url": "https://example.com/video.mp4",
    "settings": {
        "line_color": "#FFFFFF",
        "word_color": "#FFFF00",
        "outline_color": "#000000",
        "all_caps": false,
        "max_words_per_line": 10,
        "position": "bottom_center",
        "alignment": "center",
        "font_family": "Arial",
        "font_size": 24,
        "bold": false,
        "italic": false,
        "style": "karaoke",
        "outline_width": 2,
        "shadow_offset": 2
    },
    "replace": [
        {
            "find": "эм",
            "replace": ""
        }
    ],
    "webhook_url": "https://example.com/webhook",
    "id": "request-123",
    "language": "ru"
}
```

#### Пример 4: Исключение временных диапазонов
```json
{
    "media_url": "https://example.com/video.mp4",
    "settings": {
        "style": "classic",
        "line_color": "#FFFFFF",
        "outline_color": "#000000",
        "position": "bottom_center",
        "font_family": "Arial",
        "font_size": 24
    },
    "exclude_time_ranges": [
        { "start": "00:00:10.000", "end": "00:00:20.000" }
    ]
}
```

#### Пример 5: Генерация субтитров для аудиофайла (MP3)
```json
{
    "canvas_width": 1280,
    "canvas_height": 720,
    "media_url": "https://example.com/audio.mp3",
    "settings": {
        "style": "classic",
        "font_family": "Arial",
        "font_size": 32,
        "line_color": "#FFFFFF",
        "outline_color": "#000000"
    }
}
```

### Пример cURL

```bash
curl -X POST \
     -H "x-api-key: YOUR_API_KEY" \
     -H "Content-Type: application/json" \
     -d '{
        "media_url": "https://example.com/video.mp4",
        "settings": {
            "line_color": "#FFFFFF",
            "word_color": "#FFFF00",
            "outline_color": "#000000",
            "all_caps": false,
            "max_words_per_line": 10,
            "position": "bottom_center",
            "alignment": "center",
            "font_family": "Arial",
            "font_size": 24,
            "style": "karaoke",
            "outline_width": 2
        },
        "id": "custom-request-id"
    }' \
    https://your-api-endpoint.com/v1/media/generate/ass
```

## 4. Ответ

### Успешный ответ

Ответ будет объектом JSON со следующими свойствами:

- `code` (integer): Код HTTP (200 при успехе).
- `id` (string): Идентификатор запроса.
- `job_id` (string): Уникальный ID задачи.
- `response` (string): URL-адрес сгенерированного ASS-файла в облаке.
- `message` (string): Сообщение об успехе.
- `pid` (integer): ID процесса воркера.
- `queue_id` (integer): ID используемой очереди.
- `run_time` (float): Время обработки (сек).
- `queue_time` (float): Время ожидания в очереди (сек).
- `total_time` (float): Общее время (сек).
- `queue_length` (integer): Текущая длина очереди.
- `build_number` (string): Номер сборки.

Пример:

```json
{
    "code": 200,
    "id": "request-123",
    "job_id": "d290f1ee-6c54-4b01-90e6-d701748f0851",
    "response": "https://cloud.example.com/generated-subtitles.ass",
    "message": "success",
    "pid": 12345,
    "queue_id": 140682639937472,
    "run_time": 2.345,
    "queue_time": 0.010,
    "total_time": 2.355,
    "queue_length": 0,
    "build_number": "1.0.0"
}
```

### Ответы с ошибками

#### Ошибка параметров (400)
Возвращается при отсутствии обязательных полей или неверном формате.

#### Ошибка шрифта (400)
Возвращается, если запрашиваемый шрифт недоступен, вместе со списком доступных шрифтов.

#### Ошибка сервера (500)
Возвращается при непредвиденном сбое во время генерации.

## 5. Обработка ошибок

Эндпоинт обрабатывает типичные ошибки (шрифты, параметры, сбои серверов). При переполнении очереди возвращается ошибка 429 Too Many Requests.

## 6. Примечания по использованию

- `media_url` должен быть доступен.
- Настройки `settings` позволяют кастомизировать стиль, позицию и поведение субтитров.
- Параметр `replace` полезен для исправления слов или цензуры.
- Для аудиофайлов обязательно указывайте `canvas_width` и `canvas_height`.

## 7. Общие проблемы

- Недоступный `media_url`.
- Запрос несуществующего шрифта.
- Отсутствие размеров холста для аудио-файлов.
- Ошибки очереди (429).

## 8. Лучшие практики

- Проверяйте доступность медиа перед запросом.
- Используйте вебхуки для асинхронного получения результатов.
- Указывайте осмысленные `id` для отслеживания задач.
- Используйте кэширование результатов для часто запрашиваемого контента.
