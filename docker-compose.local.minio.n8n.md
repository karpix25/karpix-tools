# Локальная разработка с MinIO и n8n

Этот набор конфигураций предоставляет полную среду разработки для No Code Architect Toolkit с интегрированным хранилищем MinIO (совместимо с S3) и автоматизацией воркфлоу в n8n.

## Что включено

- **NCA Toolkit**: Собирается локально из исходников (образ не требуется).
- **MinIO**: Объектное хранилище с веб-консолью для управления файлами.
- **n8n**: Платформа автоматизации для соединения и оркестрации сервисов.
- **Выделенная сеть**: Все сервисы общаются внутри Docker-сети.
- **Постоянное хранение**: Данные сохраняются между перезапусками контейнеров.

## Предварительные условия

- Установленные Docker и Docker Compose.
- Git.
- Минимум 2 ГБ оперативной памяти.
- Минимум 5 ГБ свободного места на диске.

---

## Быстрый старт

### 1. Подготовка конфигурации

Скопируйте файл примера и настройте его:

```bash
cp .env.local.minio.n8n.example .env.local.minio.n8n
```

Отредактируйте `.env.local.minio.n8n`, если нужно. Настройки по умолчанию подходят для большинства случаев.

### 2. Запуск среды

```bash
docker compose -f docker-compose.local.minio.n8n.yml up -d
```

### 3. Доступ к приложениям

- **NCA Toolkit API**: http://localhost:8080
- **n8n Workflow Interface**: http://localhost:5678
- **MinIO Console**: http://localhost:9001
  - Логин: `minioadmin`
  - Пароль: `minioadmin123`

### 4. Проверка

Протестируйте API:

```bash
curl -H "x-api-key: local-dev-key-123" http://localhost:8080/v1/toolkit/test
```

---

## Настройка окружения

Файл `.env.local.minio.n8n` содержит:
- Настройки приложения (имя, домен, API_KEY).
- Настройки MinIO S3 (ключи, бакет, регион).
- Конфигурацию n8n.

---

## Детали сервисов

### NCA Toolkit (Порт 8080)
- Собирается из локального Dockerfile.
- Использует MinIO для файлов.

### MinIO (Порты 9000, 9001)
- **API Endpoint**: http://localhost:9000.
- **Бакет**: `nca-toolkit-local` (создается автоматически, публичный доступ).

### n8n (Порт 5678)
- Директория `./local-files` смонтирована для быстрого доступа к файлам.

---

## Процесс разработки

### Изменение кода
1. Отредактируйте код в папке проекта.
2. Пересоберите контейнер:
   ```bash
   docker compose -f docker-compose.local.minio.n8n.yml build ncat
   docker compose -f docker-compose.local.minio.n8n.yml up -d
   ```

### Просмотр логов
```bash
docker compose -f docker-compose.local.minio.n8n.yml logs -f ncat
```

---

## Взаимодействие сервисов

Внутри сети Docker:
- n8n → NCA Toolkit: `http://ncat:8080`
- n8n → MinIO: `http://minio:9000`
- NCA Toolkit → MinIO: `http://minio:9000`

**Важно:** В n8n всегда используйте `http://ncat:8080`, а не localhost.

---

## Сохранение данных

Данные сохраняются в Docker volumes:
- `storage`, `logs` (для NCA Toolkit).
- `minio_data`.
- `n8n_data`.
- Папка `./local-files`.

---

## Устранение неполадок

### Сервисы не запускаются
Проверьте статус и логи:
```bash
docker compose -f docker-compose.local.minio.n8n.yml ps
docker compose -f docker-compose.local.minio.n8n.yml logs
```

### Конфликты портов
Если порты 8080 или 5678 заняты, измените их в `docker-compose.local.minio.n8n.yml`.

---

## Завершение работы

```bash
# Остановить все
docker compose -f docker-compose.local.minio.n8n.yml down

# Удалить всё вместе с данными
docker compose -f docker-compose.local.minio.n8n.yml down -v
```