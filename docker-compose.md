# Установка No Code Architect Toolkit с помощью Docker

Использование Docker для установки No Code Architect Toolkit дает следующие преимущества:
- Чистая изолированная среда.
- Упрощение процесса настройки.
- Отсутствие проблем с совместимостью между ОС благодаря стабильному окружению Docker.

> **Информация**  
> Если ваш домен/поддомен уже направлен на сервер, начните со шага 2.  
> Если Docker и Docker-Compose уже установлены, начните со шага 3.

---

## 1. Настройка DNS

Направьте ваш домен или поддомен на сервер. Добавьте A-запись:

- **Тип**: A  
- **Имя**: Ваш домен/поддомен  
- **IP-адрес**: `<IP_ВАШЕГО_СЕРВЕРА>`  

---

## 2. Установка Docker

Инструкции для Ubuntu:

### Репозиторий Docker
```bash
sudo apt-get update
sudo apt-get install ca-certificates curl
sudo install -m 0755 -d /etc/apt/keyrings
sudo curl -fsSL https://download.docker.com/linux/ubuntu/gpg -o /etc/apt/keyrings/docker.asc
sudo chmod a+r /etc/apt/keyrings/docker.asc

echo "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.asc] https://download.docker.com/linux/ubuntu $(. /etc/os-release && echo "$VERSION_CODENAME") stable" | sudo tee /etc/apt/sources.list.d/docker.list > /dev/null
sudo apt-get update
```

### Пакеты Docker
```bash
sudo apt-get install docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin
```

---

## 3. Создание файла Docker Compose

Создайте файл `docker-compose.yml` и вставьте конфигурацию.

### С поддержкой SSL (через Traefik)
Автоматическое получение сертификатов Let's Encrypt:

```yaml
services:
  traefik:
    image: "traefik"
    restart: unless-stopped
    command:
      - "--api.insecure=true"
      - "--providers.docker=true"
      - "--entrypoints.web.address=:80"
      - "--entrypoints.web.http.redirections.entryPoint.to=websecure"
      - "--entrypoints.websecure.address=:443"
      - "--certificatesresolvers.mytlschallenge.acme.tlschallenge=true"
      - "--certificatesresolvers.mytlschallenge.acme.email=${SSL_EMAIL}"
      - "--certificatesresolvers.mytlschallenge.acme.storage=/letsencrypt/acme.json"
    ports:
      - "80:80"
      - "443:443"
    volumes:
      - traefik_data:/letsencrypt
      - /var/run/docker.sock:/var/run/docker.sock:ro
  ncat:
    image: stephengpope/no-code-architects-toolkit:latest
    env_file:
      - .env
    labels:
      - traefik.enable=true
      - traefik.http.routers.ncat.rule=Host(`${APP_DOMAIN}`)
      - traefik.http.routers.ncat.tls=true
      - traefik.http.routers.ncat.tls.certresolver=mytlschallenge
    volumes:
      - storage:/var/www/html/storage/app
      - logs:/var/www/html/storage/logs
    restart: unless-stopped

volumes:
  traefik_data:
  storage:
  logs:
```

---

## 4. Создание файла `.env`

Создайте `.env` и настройте переменные:

```env
APP_NAME=NCAToolkit
APP_DEBUG=false
APP_DOMAIN=example.com
APP_URL=https://${APP_DOMAIN}
SSL_EMAIL=user@example.com
API_KEY=ваш_ключ_здесь

# Выберите хранилище (S3 или GCP)
#S3_ACCESS_KEY=...
#GCP_SA_CREDENTIALS=...
```

---

## 5. Запуск Docker Compose

```bash
docker compose up -d
```

Логи в реальном времени:
```bash
docker compose logs -f
```

Перезапуск для обновления настроек:
```bash
docker compose up -d --force-recreate ncat
```

---

## 6. Готово

No Code Architect Toolkit теперь доступен по вашему URL.
Например: [https://example.com](https://example.com)
