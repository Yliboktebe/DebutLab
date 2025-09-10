# Использование генератора дебютов

## Быстрый старт

1. **Тестовая генерация** (рекомендуется для начала):
   ```bash
   npm run generate-openings-test
   ```
   Создает небольшое дерево дебюта с глубиной 4 полухода.

2. **Полная генерация**:
   ```bash
   npm run generate-openings
   ```
   Создает полные деревья дебютов согласно основному конфигу.

## Конфигурация

### Основной конфиг: `content/openings.config.json`
- `maxPlies: 16` - максимальная глубина
- `coverage: 0.85` - покрытие 85% партий на каждом узле
- `minGamesByDepth` - минимум партий по глубине
- `topNByDepth` - количество топ-ходов по глубине
- `engine.useCloud: true` - использование Stockfish Cloud Eval

### Тестовый конфиг: `content/openings.config.test.json`
- `maxPlies: 4` - малая глубина для быстрого тестирования
- `engine.useCloud: false` - без Cloud Eval для скорости

## Результаты

Сгенерированные файлы сохраняются в `content/trees/`:
- `sicilian-test.json` - тестовый файл
- `sicilian.json` - полный файл сицилианской защиты
- `ruy-lopez.json` - полный файл испанской партии

## Структура файла

```json
{
  "id": "sicilian-test",
  "side": "black",
  "branches": [
    {
      "id": "unique-id",
      "startFen": "rnbqkbnr/pp1ppppp/8/2p5/4P3/8/PPPP1PPP/RNBQKBNR w KQkq - 0 2",
      "ucis": ["e2e4", "c7c5", "g1f3", "b8c6"]
    }
  ],
  "meta": {
    "source": "lichess",
    "filters": { ... },
    "version": 1
  }
}
```

## Кэширование

API ответы кэшируются в `.cache/openings/` для ускорения повторных запусков.

## Обработка ошибок

- Некорректные UCI ходы автоматически пропускаются с предупреждениями
- Ошибки API обрабатываются gracefully
- Cloud Eval 404 ошибки игнорируются (позиция не в облаке)
