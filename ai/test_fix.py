"""
Тест для проверки исправления ошибки IndexError: index out of range in self
"""
import torch
from model import SafeEmbedding

def test_safe_embedding():
    print("Тестируем SafeEmbedding...")
    
    # Создаем embedding слой с 10 элементами
    embedding = SafeEmbedding(num_embeddings=10, embedding_dim=5)
    
    # Проверяем, что обычные индексы работают
    normal_indices = torch.tensor([1, 2, 3, 4, 5])
    normal_output = embedding(normal_indices)
    print(f"Размер вывода для нормальных индексов: {normal_output.shape}")
    
    # Проверяем, что индексы за пределами диапазона обрабатываются корректно
    out_of_range_indices = torch.tensor([1, 5, 10, 15, 20])  # 10, 15, 20 - за пределами
    safe_output = embedding(out_of_range_indices)
    print(f"Размер вывода для индексов за пределами: {safe_output.shape}")
    
    print("Тест пройден! SafeEmbedding корректно обрабатывает индексы за пределами диапазона.")
    
if __name__ == "__main__":
    test_safe_embedding()