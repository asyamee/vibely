# ⚡ Быстрый старт: Vibely в Docker

Развёрнуть сайт на своём сервере за 15 минут.

---

## На локальной машине (для тестирования)

```bash
# 1. Клонируем или скачиваем проект
cd vibely

# 2. Создаём конфиг
cp .env.docker.example .env.docker
# ⚠️ Отредактируйте .env.docker:
# nano .env.docker
# Минимум: YANDEX_ACCESS_TOKEN, YANDEX_USER_ID, DB_PASSWORD

# 3. Запускаем всё
docker-compose up -d

# 4. Ждём 30 секунд пока БД стартует

# 5. Открываем в браузере
# http://localhost:3000  ← Frontend
# http://localhost:3001/api/test  ← API
# http://localhost:8000/health  ← AI
```

**Готово!** Сайт работает локально.

---

## На облачном сервере (DigitalOcean, Hetzner, AWS и т.д.)

### Шаг 1: Создаём Ubuntu 20.04+ сервер (2GB RAM минимум)

### Шаг 2: SSH и установка Docker

```bash
# Подключаемся к серверу
ssh root@your.server.ip

# Обновляем пакеты
apt-get update && apt-get upgrade -y

# Устанавливаем Docker
apt-get install -y docker.io docker-compose

# Добавляем пользователя в группу docker
usermod -aG docker $(whoami)

# Проверяем
docker --version
```

### Шаг 3: Загружаем проект

```bash
# Клонируем
git clone https://github.com/your-repo/vibely.git
cd vibely

# Создаём конфиг с реальными данными
cat > .env.docker << 'EOF'
DB_PASSWORD=your_secure_password_here
YANDEX_ACCESS_TOKEN=your_yandex_token
YANDEX_USER_ID=your_user_id
JWT_SECRET=$(openssl rand -base64 32)
JWT_REFRESH_SECRET=$(openssl rand -base64 32)
AI_DEVICE=cpu
EOF

# Проверяем (⚠️ не коммитьте!)
cat .env.docker
```

### Шаг 4: Запуск

```bash
# Делаем скрипт исполняемым
chmod +x docker-entrypoint.sh

# Запускаем
./docker-entrypoint.sh

# Или вручную
docker-compose up -d

# Проверяем что всё запустилось
docker-compose ps

# Смотрим логи (Ctrl+C чтобы выйти)
docker-compose logs -f
```

### Шаг 5: Настраиваем доменное имя

```bash
# Получаем IP сервера
curl ifconfig.me

# У своего хостера добавляем A record:
# Имя: @  (или ваш поддомен)
# Значение: YOUR.SERVER.IP

# Проверяем резолвинг (через ~5 минут)
nslookup your-domain.com
```

### Шаг 6: SSL (Let's Encrypt)

```bash
# Устанавливаем certbot
apt-get install -y certbot python3-certbot-nginx

# Получаем сертификат
certbot certonly --standalone -d your-domain.com -d www.your-domain.com

# Обновляем nginx.conf и перезагружаем
docker exec vibely-nginx nginx -s reload
```

---

## Проверяем что работает

```bash
# Фронтенд
curl https://your-domain.com

# API
curl https://your-domain.com/api/test

# AI (опционально)
curl https://your-domain.com/ai/health
```

---

## Получаем JWT токен для переобучения

```bash
# Регистрируемся через фронтенд или:
curl -X POST https://your-domain.com/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "your@email.com",
    "password": "your_password"
  }'

# Копируем accessToken из ответа
```

## Переобучаем модель (каждый день)

```bash
# Вручную:
JWT_TOKEN=your_token_here
docker exec vibely-ai python retrain.py \
  --backend-url http://api:3001 \
  --token $JWT_TOKEN

# Или через cron (автоматически в 2:00 AM):
(crontab -l 2>/dev/null; echo "0 2 * * * cd /path/to/vibely && JWT_TOKEN=your_token docker exec vibely-ai python retrain.py --backend-url http://api:3001 --token $JWT_TOKEN") | crontab -
```

---

## Полезные команды

```bash
# Смотрим логи
docker-compose logs -f api      # Backend
docker-compose logs -f web      # Frontend
docker-compose logs -f ai       # AI

# Перезагружаем сервисы
docker-compose restart

# Останавливаем
docker-compose down

# Проверяем ресурсы
docker stats

# Бэкап БД
docker exec vibely-db pg_dump -U vibely_user -d vibely > backup.sql

# Подключаемся к контейнеру
docker exec -it vibely-api bash
```

---

## Мониторинг (опционально)

Если хотите видеть метрики сервера:

```bash
# Используем docker-compose-prod.yml вместо docker-compose.yml
docker-compose -f docker-compose-prod.yml up -d

# Grafana доступна на http://your-domain.com:3002
# (если добавить проксирование в nginx)
# Логин: admin
# Пароль: (смотрите в .env.docker GRAFANA_PASSWORD)
```

---

## Troubleshooting

| Проблема | Решение |
|----------|---------|
| "Connection refused" | `docker-compose restart` и дождитесь 30 сек |
| "Permission denied" | `sudo usermod -aG docker $USER` и переподключитесь |
| "No space left on device" | `docker system prune` (удалить неиспользуемые образы) |
| "Database password incorrect" | Проверьте .env.docker совпадает с БД |
| "YANDEX токен не работает" | Получите новый на https://music.yandex.ru |

---

## Что дальше?

1. **Собирайте данные!** Поделитесь ссылкой и попросите людей оценить треки
2. **Переобучайте модель** каждый день: `cron job`
3. **Смотрите метрики** в Grafana (опционально)
4. **Масштабируйте** если много пользователей: используйте `docker-compose-prod.yml`

---

**Готово!** Ваш сайт работает и собирает данные 🎉

Полное руководство: смотрите `DEPLOY.md`
