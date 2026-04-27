#!/bin/bash
# Скрипт для переобучения модели в Docker
# Используется для регулярного обновления embeddings

set -e

BACKEND_URL=${BACKEND_URL:-"http://api:3001"}
JWT_TOKEN=${JWT_TOKEN:-""}
MODEL_PATH=${MODEL_PATH:-"ai/user_encoder.pt"}

echo "🤖 Переобучение модели Vibely"
echo "Backend: $BACKEND_URL"
echo "Model:   $MODEL_PATH"
echo ""

if [ -z "$JWT_TOKEN" ]; then
    echo "❌ JWT_TOKEN не установлен!"
    echo "Используйте: JWT_TOKEN=your_token ./scripts/retrain-model.sh"
    exit 1
fi

cd ai

echo "🔄 Запускаю переобучение..."
python retrain.py \
    --backend-url "$BACKEND_URL" \
    --model-path "$MODEL_PATH" \
    --epochs 50 \
    --batch-size 8 \
    --token "$JWT_TOKEN"

echo ""
echo "✅ Переобучение завершено!"
echo "📊 Проверьте логи выше на наличие ошибок"
