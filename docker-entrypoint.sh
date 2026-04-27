#!/bin/bash
set -e

echo "🚀 Vibely Docker Stack Initialization"

# Создаём .env.docker если не существует
if [ ! -f ".env.docker" ]; then
    echo "📝 Создаю .env.docker из примера..."
    if [ -f ".env.docker.example" ]; then
        cp .env.docker.example .env.docker
        echo "⚠️  ВАЖНО: Отредактируйте .env.docker и установите реальные значения!"
        echo "   особенно: YANDEX_ACCESS_TOKEN, YANDEX_USER_ID, JWT_SECRET"
        exit 1
    fi
fi

echo "✅ Конфигурация готова"
echo ""
echo "🐳 Запускаю Docker контейнеры..."
docker-compose -f docker-compose.yml up -d

echo ""
echo "⏳ Ожидаю инициализации PostgreSQL (30 сек)..."
sleep 30

echo ""
echo "✅ Контейнеры запущены!"
echo ""
echo "📍 URLs:"
echo "   Frontend:  http://localhost:3000"
echo "   API:       http://localhost:3001/api"
echo "   AI:        http://localhost:8000"
echo "   Database:  postgresql://localhost:5432/vibely"
echo ""
echo "📋 Полезные команды:"
echo "   docker-compose logs -f api          # Логи backend"
echo "   docker-compose logs -f web          # Логи frontend"
echo "   docker-compose logs -f ai           # Логи AI сервиса"
echo "   docker-compose ps                   # Статус контейнеров"
echo "   docker-compose down                 # Остановить все контейнеры"
