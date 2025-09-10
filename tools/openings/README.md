# Генератор дебютов

Система для автоматической генерации деревьев дебютов на основе данных Lichess Explorer и Stockfish Cloud Eval.

## Архитектура

- `build.ts` - CLI для запуска генерации
- `generator.ts` - рекурсивный обход позиций и отбор ходов
- `lichess.ts` - HTTP-клиент к explorer.lichess.ovh и cloud-eval
- `chess.ts` - работа с FEN и применением ходов (chess.js)
- `filters.ts` - правила отбора (частота, покрытие, engine)
- `writer.ts` - маппинг в UI v1 и запись файлов
- `cache.ts` - on-disk кэш ответов API (FEN->JSON)
- `types.ts` - общие типы и контракты

## Использование

1. Настройте конфигурацию в `content/openings.config.json`
2. Запустите генерацию:
   ```bash
   npm run generate-openings
   ```

## Конфигурация

Основные параметры в `content/openings.config.json`:

- `speeds` - временные контроли (rapid, classical)
- `ratings` - рейтинговые группы (2000, 2200, 2500)
- `maxPlies` - максимальная глубина (16 полуходов)
- `coverage` - покрытие на узле (85%)
- `minGamesByDepth` - минимум партий по глубине
- `topNByDepth` - количество топ-ходов по глубине
- `engine` - настройки Stockfish Cloud Eval

## Результат

Сгенерированные файлы сохраняются в `content/trees/` в формате JSON, совместимом с UI v1.
