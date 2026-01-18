# CLAUDE.md

Этот файл содержит руководства для Claude Code (claude.ai/code) при работе с кодом в этом репозитории.

## Обзор

No-Code Architects Toolkit API — это API для обработки медиа на базе Flask, который выполняет конвертацию аудио/видео, транскрибацию, перевод, наложение субтитров и интеграцию с облачными хранилищами. Поддерживает развертывание в Docker, Google Cloud Platform и Digital Ocean.

## Архитектура

### Основные компоненты

- **[app.py](app.py)** — основное приложение Flask с обработкой задач через очередь.
  - Создает очередь задач для асинхронной обработки.
  - Предоставляет декоратор `queue_task` для обработчиков маршрутов.
  - Поддерживает GCP Cloud Run Jobs для длительных задач.
  - Автоматически регистрирует blueprints из директории `routes/`.

- **[app_utils.py](app_utils.py)** — основные утилиты.
  - `validate_payload()` — декоратор для валидации JSON-схем.
  - `queue_task_wrapper()` — оборачивает маршруты для обработки в очереди.
  - `discover_and_register_blueprints()` — автопоиск и регистрация Flask blueprints.
  - `log_job_status()` — логирует статус задачи в LOCAL_STORAGE_PATH/jobs.

- **[config.py](config.py)** — конфигурация окружения.
  - Валидирует переменные окружения для каждого провайдера хранилища.
  - Настраивает API_KEY, пути хранения и учетные данные облака.

### Поток обработки запроса

1. Запрос попадает на маршрут в `routes/v1/{category}/{action}.py`.
2. Декоратор `@authenticate` проверяет заголовок X-API-Key.
3. `@validate_payload()` проверяет JSON на соответствие схеме.
4. `@queue_task_wrapper()` определяет путь обработки:
   - **Нет webhook_url**: Выполняется синхронно, возвращает результат сразу.
   - **Есть webhook_url**: Задача ставится в очередь, возвращается 202, вебхук отправляется по завершении.
   - **GCP_JOB_NAME + webhook_url**: Запускается Cloud Run Job, возвращается 202.
   - **CLOUD_RUN_JOB (env)**: Выполняется синхронно в контексте задачи.

5. Маршрут вызывает функцию сервиса в `services/v1/{category}/{action}.py`.
6. Сервис обрабатывает медиа, загружает в облако и возвращает результат.
7. Маршрут возвращает кортеж: `(response_data, endpoint_string, status_code)`.

### Режимы обработки задач

**Внутренняя очередь процесса** (По умолчанию)
- Одна очередь на рабочий процесс (worker).
- Фоновый поток обрабатывает задачи последовательно.
- `MAX_QUEUE_LENGTH` ограничивает размер очереди (0 = безлимитно).

**GCP Cloud Run Jobs** (Опционально)
- Установите `GCP_JOB_NAME` и `GCP_JOB_LOCATION` для включения.
- Требуется `webhook_url` в теле запроса.
- Запускает Cloud Run Job с эндпоинтом и данными в переменных окружения.
- Задача выполняется независимо и отправляет вебхук.

**Синхронно** (Без очереди)
- Используется, если `webhook_url` не предоставлен.
- Запрос блокируется до завершения обработки.

### Динамическая регистрация маршрутов

Маршруты обнаруживаются автоматически в папке `routes/`. Ручная регистрация в [app.py](app.py) не требуется.

**Соглашение о Blueprint:**
```python
from flask import Blueprint
from app_utils import validate_payload, queue_task_wrapper
from services.authentication import authenticate

v1_category_action_bp = Blueprint('v1_category_action', __name__)

@v1_category_action_bp.route('/v1/category/action', methods=['POST'])
@authenticate
@validate_payload(schema_dict)
@queue_task_wrapper(bypass_queue=False)
def action_handler(job_id, data):
    # Реализация
    return result, "/v1/category/action", 200
```

См. [docs/adding_routes.md](docs/adding_routes.md) для подробного руководства.

### Абстракция облачного хранилища

[services/cloud_storage.py](services/cloud_storage.py) предоставляет единый интерфейс:
- Определяет провайдера по переменным окружения.
- GCP: Требует `GCP_SA_CREDENTIALS`, `GCP_BUCKET_NAME`.
- S3: Требует `S3_ENDPOINT_URL`, `S3_ACCESS_KEY`, `S3_SECRET_KEY`, `S3_BUCKET_NAME`, `S3_REGION`.
- Digital Ocean: Извлекает бакет/регион из URL эндпоинта, если не указаны.

Функции сервиса вызывают `upload_file(local_path)`, которая возвращает публичный URL.

## Команды для разработки

### Локальная разработка

```bash
# Установка зависимостей
pip install -r requirements.txt

# Запуск сервера разработки (порт 8080)
python app.py

# Или через gunicorn
gunicorn --config gunicorn.conf.py app:app
```

### Docker

```bash
# Сборка образа
docker build -t no-code-architects-toolkit .

# Запуск контейнера
docker run -p 8080:8080 \
  -e API_KEY=your_key \
  -e S3_ENDPOINT_URL=... \
  no-code-architects-toolkit
```

### Тестирование

API использует Postman. Шаблон доступен по адресу: https://bit.ly/49Gkh61

Тестовый эндпоинт:
```bash
curl -X POST http://localhost:8080/v1/toolkit/test \
  -H "X-API-Key: your_key"
```

## Переменные окружения

**Обязательные:**
- `API_KEY` — ключ аутентификации.

**Хранилище (выберите одно):**

GCP Storage:
- `GCP_SA_CREDENTIALS` — JSON-ключ сервисного аккаунта.
- `GCP_BUCKET_NAME` — имя бакета GCS.

S3-совместимые:
- `S3_ENDPOINT_URL`, `S3_ACCESS_KEY`, `S3_SECRET_KEY`, `S3_BUCKET_NAME`, `S3_REGION`.

**Опциональные:**
- `LOCAL_STORAGE_PATH` — временное хранилище (по умолчанию: /tmp).
- `MAX_QUEUE_LENGTH` — макс. кол-во задач (0 = без ограничений).
- `GUNICORN_WORKERS`, `GUNICORN_TIMEOUT`.
- `GCP_JOB_NAME`, `GCP_JOB_LOCATION`.

## Ключевые паттерны

- Маршруты: `routes/v1/{category}/{action}.py`.
- Сервисы: `services/v1/{category}/{action}.py`.
- Документация: `docs/{category}/{action}.md`.
- Формат возврата: `(response_dict, endpoint_string, http_status_code)`.
- Статусы задач: `queued`, `running`, `done`, `failed`, `submitted`.

## Добавление новых функций

1. Создайте сервис в `services/v1/{category}/{action}.py`.
2. Создайте маршрут в `routes/v1/{category}/{action}.py`.
3. Добавьте JSON-схему валидации.
4. Добавьте документацию в `docs/{category}/{action}.md`.
5. Обновите [README.md](README.md).

См. [docs/adding_routes.md](docs/adding_routes.md) для полного руководства.

## Руководства по развертыванию

- Digital Ocean: [docs/cloud-installation/do.md](docs/cloud-installation/do.md).
- Google Cloud Run: [docs/cloud-installation/gcp.md](docs/cloud-installation/gcp.md).
- Общий Docker: [docker-compose.md](docker-compose.md).
- Локально с MinIO + n8n: [docker-compose.local.minio.n8n.md](docker-compose.local.minio.n8n.md).
