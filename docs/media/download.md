# Документация API эндпоинта для загрузки медиа

## Обзор

Эндпоинт `/v1/BETA/media/download` предоставляет мощный интерфейс для загрузки медиа-контента из различных онлайн-источников с использованием библиотеки yt-dlp. Этот эндпоинт является частью медиа-сервисов версии 1, позволяя пользователям загружать видео, извлекать аудио, а также получать миниатюры и субтитры с поддерживаемых платформ. Эндпоинт обрабатывает аутентификацию, валидацию запросов и ставит задачи в очередь для обработки, что делает его пригодным для ресурсоемких загрузок без блокировки основного потока приложения.

## Эндпоинт (Endpoint)

- **URL**: `/v1/BETA/media/download`
- **Метод**: `POST`
- **Blueprint**: `v1_media_download_bp`

## Запрос

### Заголовки (Headers)

- `x-api-key`: Обязательно для аутентификации (обрабатывается декоратором `@authenticate`)

### Параметры тела запроса

#### Обязательные параметры

| Параметр | Тип | Описание |
|-----------|------|-------------|
| `media_url` | string (формат URI) | URL медиа-файла для загрузки |

#### Необязательные параметры

| Параметр | Тип | Описание |
|-----------|------|-------------|
| `webhook_url` | string (формат URI) | URL для получения результата по завершении обработки |
| `id` | string | Пользовательский идентификатор для отслеживания запроса |
| `cookie` | string | Путь к файлу cookie, URL к файлу или строка cookie в формате Netscape |
| `cloud_upload` | boolean | Если true (по умолчанию), загруженное медиа будет отправлено в облако. Если false, будет возвращен прямой URL для скачивания. |

#### Опции формата (необязательно)

```json
"format": {
  "quality": "string",     // Спецификация качества (например, "best")
  "format_id": "string",   // Конкретный ID формата
  "resolution": "string",  // Разрешение (например, "720p")
  "video_codec": "string", // Предпочтительный видеокодек
  "audio_codec": "string"  // Предпочтительный аудиокодек
}
```

#### Опции аудио (необязательно)

```json
"audio": {
  "extract": boolean,      // Извлекать ли аудио
  "format": "string",      // Формат аудио (например, "mp3", "m4a")
  "quality": "string"      // Качество аудио
}
```

#### Опции миниатюр (необязательно)

```json
"thumbnails": {
  "download": boolean,     // Загружать ли миниатюры
  "download_all": boolean, // Загружать ли все доступные миниатюры
  "formats": ["string"],   // Массив форматов миниатюр для загрузки
  "convert": boolean,      // Конвертировать ли миниатюры
  "embed_in_audio": boolean // Встраивать ли миниатюры в аудиофайлы
}
```

#### Опции субтитров (необязательно)

```json
"subtitles": {
  "download": boolean,     // Загружать ли субтитры
  "languages": ["string"], // Массив кодов языков для субтитров
  "format": "string",      // Формат субтитров (например, 'srt', 'vtt', 'json3')
  "cloud_upload": boolean  // Загружать ли субтитры в облако (по умолчанию true)
}
```

#### Опции загрузки (необязательно)

```json
"download": {
  "max_filesize": integer, // Максимальный размер файла в байтах
  "rate_limit": "string",  // Лимит скорости загрузки (например, "50K")
  "retries": integer       // Количество попыток повтора загрузки
}
```

### Пример запроса

```json
{
  "media_url": "https://www.youtube.com/watch?v=dQw4w9WgXcQ",
  "webhook_url": "https://example.com/webhook",
  "id": "custom-request-123",
  "cookie": "# Netscape HTTP Cookie File\n.youtube.com\tTRUE\t/\tFALSE\t0\tCONSENT\tYES+cb",
  "cloud_upload": true,
  "format": {
    "quality": "best",
    "resolution": "720p"
  },
  "audio": {
    "extract": true,
    "format": "mp3"
  },
  "thumbnails": {
    "download": true
  },
  "subtitles": {
    "download": true,
    "languages": ["en", "ru"],
    "format": "srt",
    "cloud_upload": true
  }
}
```

### Пример команды cURL

```bash
curl -X POST \
  https://api.example.com/v1/BETA/media/download \
  -H 'Content-Type: application/json' \
  -H 'x-api-key: your-api-key-here' \
  -d '{
    "media_url": "https://www.youtube.com/watch?v=dQw4w9WgXcQ",
    "webhook_url": "https://example.com/webhook",
    "id": "custom-request-123",
    "cookie": "# Netscape HTTP Cookie File\n.youtube.com\tTRUE\t/\tFALSE\t0\tCONSENT\tYES+cb",
    "cloud_upload": true,
    "format": {
      "quality": "best",
      "resolution": "720p"
    },
    "audio": {
      "extract": true,
      "format": "mp3"
    },
    "thumbnails": {
      "download": true
    },
    "subtitles": {
      "download": true,
      "languages": ["en", "ru"],
      "format": "srt",
      "cloud_upload": true
    }
  }'
```

## Ответ

### Немедленный ответ (при использовании вебхука)

При указании `webhook_url` API поставит задачу в очередь и немедленно вернет ответ с кодом 202:

```json
{
  "code": 202,
  "id": "custom-request-123",
  "job_id": "550e8400-e29b-41d4-a716-446655440000",
  "message": "processing",
  "pid": 12345,
  "queue_id": 67890,
  "max_queue_length": "unlimited",
  "queue_length": 3,
  "build_number": "1.0.123"
}
```

### Успешный ответ (без вебхука или при вызове вебхука)

```json
{
  "code": 200,
  "id": "custom-request-123",
  "job_id": "550e8400-e29b-41d4-a716-446655440000",
  "response": {
    "media": {
      "media_url": "https://storage.example.com/media/video-123.mp4",
      "title": "Never Gonna Give You Up",
      "format_id": "22",
      "ext": "mp4",
      "resolution": "720p",
      "filesize": 12345678,
      "width": 1280,
      "height": 720,
      "fps": 30,
      "video_codec": "avc1.4d401f",
      "audio_codec": "mp4a.40.2",
      "upload_date": "20090325",
      "duration": 212,
      "view_count": 1234567890,
      "uploader": "Rick Astley",
      "uploader_id": "RickAstleyVEVO",
      "description": "Official music video for Rick Astley - Never Gonna Give You Up"
    },
    "thumbnails": [
      {
        "id": "default",
        "image_url": "https://storage.example.com/media/thumbnail-123.jpg",
        "width": 1280,
        "height": 720,
        "original_format": "jpg",
        "converted": false
      }
    ]
  },
  "message": "success",
  "pid": 12345,
  "queue_id": 67890,
  "run_time": 5.123,
  "queue_time": 0.456,
  "total_time": 5.579,
  "queue_length": 2,
  "build_number": "1.0.123"
}
```

### Ответы с ошибками

#### Некорректный запрос (400)

```json
{
  "code": 400,
  "id": "custom-request-123",
  "job_id": "550e8400-e29b-41d4-a716-446655440000",
  "message": "Invalid request: 'media_url' is a required property",
  "pid": 12345,
  "queue_id": 67890,
  "queue_length": 2,
  "build_number": "1.0.123"
}
```

#### Ошибка аутентификации (401)

```json
{
  "code": 401,
  "message": "Invalid API key",
  "build_number": "1.0.123"
}
```

#### Очередь заполнена (429)

```json
{
  "code": 429,
  "id": "custom-request-123",
  "job_id": "550e8400-e29b-41d4-a716-446655440000",
  "message": "MAX_QUEUE_LENGTH (100) reached",
  "pid": 12345,
  "queue_id": 67890,
  "queue_length": 100,
  "build_number": "1.0.123"
}
```

#### Ошибка сервера (500)

```json
{
  "code": 500,
  "id": "custom-request-123",
  "job_id": "550e8400-e29b-41d4-a716-446655440000",
  "message": "Error during download process - HTTP Error 403: Forbidden",
  "pid": 12345,
  "queue_id": 67890,
  "queue_length": 2,
  "build_number": "1.0.123"
}
```

## Обработка ошибок

Эндпоинт обрабатывает различные сценарии:

- **Отсутствие обязательных параметров**: Ошибка 400.
- **Некорректный формат параметров**: Ошибка 400.
- **Ошибка аутентификации**: Ошибка 401.
- **Лимиты очереди**: Ошибка 429 при заполнении очереди.
- **Ошибки загрузки**: Ошибка 500 с деталями сбоя.
- **Ошибки источника медиа**: Ошибка 500, если источник недоступен или ограничен.

## Примечания по использованию

1. **Использование вебхуков**: 
   - С `webhook_url` запрос обрабатывается асинхронно.
   - Без `webhook_url` запрос выполняется синхронно, что может привести к долгому ожиданию.

2. **Выбор формата**:
   - Опции `format` позволяют детально настроить качество загружаемого медиа.

3. **Извлечение аудио**:
   - `audio.extract: true` позволяет получить только аудиодорожку.
   - Укажите `audio.format` для выбора формата (например, "mp3").

4. **Работа с миниатюрами**:
   - При `thumbnails.download: true` API предоставит ссылки на превью.

5. **Ограничение скорости**:
   - `download.rate_limit` позволяет контролировать скорость загрузки (например, "50K" для 50 КБ/с).

## Общие проблемы

1. **Гео-ограниченный контент**: Некоторое медиа может быть недоступно в определенных регионах.
2. **Ограничение частоты запросов**: Источники могут блокировать частые загрузки.
3. **Загрузка очень больших файлов**: Может произойти таймаут.
4. **Доступность форматов**: Не все форматы доступны для всех источников.
5. **Ошибки вебхуков**: Если ваш URL недоступен, вы не получите результат.

## Лучшие практики

1. **Используйте вебхуки для больших загрузок**, чтобы избежать таймаутов.
2. **Указывайте ограничения формата**, чтобы не качать лишний объем данных.
3. **Запрашивайте миниатюры только при необходимости**.
4. **Реализуйте логику повторных попыток** на стороне клиента.
5. **Следите за длиной очереди (`queue_length`)** для понимания нагрузки на систему.
6. **Устанавливайте разумные лимиты скорости**, чтобы не быть заблокированными источниками.
7. **Валидируйте URL** перед отправкой.
8. **Сохраняйте полученное медиа**: Облачные ссылки могут иметь ограниченный срок жизни.