# 🚀 Развёртывание Vibely с Docker

Полное руководство для развёртывания сайта на своём сервере или облачном хостинге для сбора пользовательских данных.

---

## Требования

- **Docker** 20.10+
- **Docker Compose** 2.0+
- **Linux сервер** (рекомендуется Ubuntu 20.04+)
- **4GB RAM** минимум (8GB+ рекомендуется)
- **30GB свободного места** на диске

### Установка Docker (Ubuntu/Debian)

```bash
# Обновляем пакеты
sudo apt-get update
sudo apt-get install -y docker.io docker-compose

# Добавляем текущего пользователя в группу docker
sudo usermod -aG docker $USER
newgrp docker

# Проверяем установку
docker --version
docker-compose --version
```

---

## Шаг 1: Подготовка конфигурации

### Клонируем репозиторий на сервер

```bash
git clone https://github.com/your-repo/vibely.git
cd vibely
```

### Создаём файл конфигурации

```bash
cp .env.docker.example .env.docker
nano .env.docker
```

**Что нужно заполнить в `.env.docker`:**

```bash
# 1. Пароль для базы данных (изменить!)
DB_PASSWORD=ваш_надежный_пароль_из_20_символов

# 2. Токены от Yandex Music (обязательно!)
# https://music.yandex.ru/settings → Приложения → API
YANDEX_ACCESS_TOKEN=your_token_here
YANDEX_USER_ID=your_user_id_here

# 3. Генерируем криптографически безопасные JWT секреты
# openssl rand -base64 32
JWT_SECRET=wG8xK9pL2mN5qR7sT9uV1wX3yZ4aB6cD8eF0gH2jK4lM6nO8pQ0sR2tU4vW6xY8zA
JWT_REFRESH_SECRET=zB2cD4eF6gH8iJ0kL2mN4oP6qR8sT0uV2wX4yZ6aB8cD0eF2gH4iJ6kL8mN0oP2

# 4. (Опционально) GPU поддержка
AI_DEVICE=cpu  # или cuda если есть NVIDIA GPU
```

---

## Шаг 2: Запуск Docker контейнеров

### Быстрый старт (все сервисы)

```bash
# Делаем скрипт исполняемым
chmod +x docker-entrypoint.sh

# Запускаем инициализацию
./docker-entrypoint.sh
```

Или вручную:

```bash
# Загружаем переменные из .env.docker
set -a
source .env.docker
set +a

# Запускаем контейнеры
docker-compose up -d

# Проверяем статус
docker-compose ps
```

**Ожидаемый результат:**

```
NAME              STATUS
vibely-db         Up 30s (healthy)
vibely-api        Up 25s
vibely-web        Up 20s
vibely-ai         Up 15s
```

### Проверяем что всё работает

```bash
# Frontend
curl http://localhost:3000

# Backend
curl http://localhost:3001/api/test

# AI
curl http://localhost:8000/health
```

---

## Шаг 3: Первое обучение модели

После первого запуска нужно обучить модель:

```bash
# Подключаемся к контейнеру AI
docker exec -it vibely-ai bash

# Обучаем модель на синтетических данных
python train.py

# Выходим
exit
```

Модель будет сохранена в `ai/user_encoder.pt` (автоматически подмонтирована).

---

## Шаг 4: Настройка доменного имени (опционально)

Если хотите чтобы сайт был доступен по красивому адресу:

### Вариант A: Использование Nginx (рекомендуется)

```bash
# Создаём контейнер Nginx
docker run -d \
  --name vibely-nginx \
  --network vibely-network \
  -p 80:80 \
  -p 443:443 \
  -v $(pwd)/nginx.conf:/etc/nginx/conf.d/default.conf:ro \
  nginx:alpine

# Смотрим логи
docker logs vibely-nginx
```

### Вариант B: Использование Let's Encrypt + Certbot

```bash
# Устанавливаем certbot
sudo apt-get install -y certbot

# Получаем бесплатный SSL сертификат
sudo certbot certonly --standalone \
  -d your-domain.com \
  -d www.your-domain.com

# Обновляем nginx.conf и перезагружаем Nginx
docker exec vibely-nginx nginx -s reload
```

### DNS настройки

У вашего хостера (GoDaddy, Namecheap и т.д.) установите A record:

```
A record: your-domain.com → IP_ВАШЕГО_СЕРВЕРА
CNAME:    www.your-domain.com → your-domain.com
```

---

## Шаг 5: Регулярное переобучение модели

### Вручную (один раз)

```bash
# Получаем JWT токен (авторизуемся как админ)
JWT_TOKEN=$(curl -X POST http://localhost:3001/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username":"admin","password":"admin"}' \
  | jq -r '.accessToken')

# Переобучаем модель
docker exec vibely-ai bash -c \
  "JWT_TOKEN=$JWT_TOKEN python retrain.py \
   --backend-url http://api:3001 \
   --token $JWT_TOKEN"
```

### Автоматически (раз в день через cron)

```bash
# Открываем crontab
crontab -e

# Добавляем строку (переобучение каждый день в 2:00 AM)
0 2 * * * /home/user/vibely/scripts/retrain-model.sh

# Сохраняем (Ctrl+X → Y → Enter)
```

**Или используем Docker cron контейнер:**

```bash
# Смотри docker-compose-cron.yml ниже
```

---

## Шаг 6: Мониторинг и логирование

### Смотрим логи

```bash
# Все сервисы
docker-compose logs -f

# Конкретный сервис
docker-compose logs -f api
docker-compose logs -f web
docker-compose logs -f ai

# Последние 100 строк
docker-compose logs --tail=100 api
```

### Проверяем ресурсы

```bash
# CPU и память
docker stats

# Размер образов
docker images
```

---

## Шаг 7: Резервные копии

### Бэкап базы данных

```bash
# Создаём бэкап PostgreSQL
docker exec vibely-db pg_dump \
  -U vibely_user -d vibely \
  -F c > backup_$(date +%Y%m%d_%H%M%S).dump

# Восстанавливаем из бэкапа
docker exec -i vibely-db pg_restore \
  -U vibely_user -d vibely < backup_20240422_143022.dump
```

### Бэкап модели и данных

```bash
# Архивируем AI модель и события
tar -czf vibely_data_$(date +%Y%m%d).tar.gz \
  ai/user_encoder.pt \
  ai/data/

# Загружаем на облако (например AWS S3)
aws s3 cp vibely_data_20240422.tar.gz s3://your-bucket/
```

---

## Масштабирование

### Когда нужно масштабировать?

- Если **фронтенд медленный** → добавьте ещё инстансов frontend контейнеров
- Если **API перегружен** → добавьте load balancer (HAProxy, Nginx)
- Если **AI медленная** → используйте GPU (`AI_DEVICE=cuda`)
- Если **база медленная** → добавьте индексы или используйте read replicas

### Улучшенная docker-compose с масштабированием

```yaml
# docker-compose-prod.yml
version: '3.8'

services:
  # ... остальные сервисы ...
  
  api:
    # ... конфигурация ...
    deploy:
      replicas: 3  # 3 инстанса API
  
  web:
    deploy:
      replicas: 2  # 2 инстанса Frontend
```

Запуск:
```bash
docker-compose -f docker-compose-prod.yml up -d
```

---

## Полезные команды

```bash
# Остановить все контейнеры
docker-compose down

# Перезагрузить сервисы
docker-compose restart

# Пересобрать образы (после изменения кода)
docker-compose build && docker-compose up -d

# Удалить всё (база, образы, volumes)
docker-compose down -v

# Подключиться к консоли контейнера
docker exec -it vibely-api bash
docker exec -it vibely-ai bash

# Просмотр размера данных
du -sh vibely_data_*
df -h  # Общее место на диске
```

---

## Troubleshooting

### Frontend не загружается

```bash
docker-compose logs web
# Проверь: NEXT_PUBLIC_BACKEND_URL указывает на правильный API
```

### API не может подключиться к БД

```bash
docker-compose logs api
# Проверь: DATABASE_URL правильный, DB_PASSWORD совпадает
# Дождись пока PostgreSQL стартует: docker-compose logs postgres
```

### AI выдаёт ошибку "model not found"

```bash
# Проверяем что модель скопирована
docker exec vibely-ai ls -la user_encoder.pt

# Если не существует, обучаем
docker exec vibely-ai python train.py
```

### High CPU/Memory использование

```bash
# Смотрим какой контейнер грузит
docker stats

# Если AI: отключаем GPU и используем CPU
# Если API: масштабируем через docker-compose-prod.yml
```

---

## Production чеклист

- [ ] Изменены все пароли в `.env.docker`
- [ ] JWT секреты сгенерированы через `openssl rand -base64 32`
- [ ] Установлены правильные YANDEX токены
- [ ] Настроен doméname с DNS
- [ ] Установлены SSL сертификаты (Let's Encrypt)
- [ ] Включен firewall и открыты только необходимые порты (80, 443)
- [ ] Настроены автоматические бэкапы базы
- [ ] Включен мониторинг (опционально: Prometheus, Grafana)
- [ ] Настроено переобучение модели (cron job)
- [ ] Протестирована регистрация и оценивание
- [ ] Проверены логи всех контейнеров

---

## Дополнительные ресурсы

- Docker docs: https://docs.docker.com/
- Docker Compose: https://docs.docker.com/compose/
- Nginx: https://nginx.org/
- Let's Encrypt: https://letsencrypt.org/
- PostgreSQL: https://www.postgresql.org/

---

## Поддержка

Если возникают проблемы:

1. Проверь логи: `docker-compose logs -f`
2. Перезагрузи контейнеры: `docker-compose restart`
3. Проверь ресурсы: `docker stats`
4. Смотри раздел Troubleshooting выше
