/**
 * Тестовый скрипт для проверки работы API экспорта JSONL
 *
 * Примеры использования:
 *
 * 1. Создание JSONL файла:
 *    curl -X GET http://localhost:3000/api/export-jsonl
 *
 * 2. Получение последнего JSONL файла:
 *    curl -X GET http://localhost:3000/api/export-jsonl/latest -o user_events_latest.jsonl
 *
 * 3. Получение списка JSONL файлов:
 *    curl -X GET http://localhost:3000/api/export-jsonl/files
 */

console.log("Тестовый скрипт для проверки API экспорта JSONL");
console.log("\nДоступные команды:");
console.log(
  "1. Создать JSONL файл: curl -X GET http://localhost:3000/api/export-jsonl",
);
console.log(
  "2. Скачать последний JSONL файл: curl -X GET http://localhost:3000/api/export-jsonl/latest -o user_events_latest.jsonl",
);
console.log(
  "3. Получить список JSONL файлов: curl -X GET http://localhost:3000/api/export-jsonl/files",
);
console.log("\nФайлы будут сохранены в директорию backend/data/");
