# Конвертер дебютов

Конвертер для преобразования сгенерированных файлов дебютов в формат UI v1.

## Архитектура

- `types.ts` - типы для обоих форматов (сгенерированный и UI v1)
- `chess-utils.ts` - утилиты для работы с шахматными ходами
- `converter.ts` - основная логика конвертации
- `convert.ts` - CLI для конвертации одного дебюта
- `convert-all.ts` - CLI для конвертации всех дебютов

## Использование

### Конвертация одного дебюта:
```bash
tsx tools/converter/convert.ts sicilian
```

### Конвертация всех дебютов:
```bash
tsx tools/converter/convert-all.ts
```

## Что делает конвертер

1. **Читает** сгенерированный файл из `content/trees/`
2. **Преобразует** формат в UI v1:
   - Добавляет обязательные поля: `schema`, `name`, `tags`
   - Создает читаемые названия веток из UCI ходов
   - Определяет тип ветки (`main_line` или `alternative`)
   - Генерирует уникальные ID для веток
   - Вычисляет `minPly` для каждой ветки
3. **Сохраняет** в `public/content/demo/`
4. **Обновляет** каталог `public/content/catalog.json`

## Форматы

### Входной формат (сгенерированный):
```json
{
  "id": "sicilian",
  "side": "black",
  "branches": [
    {
      "id": "mf9svsjv-g",
      "startFen": "rnbqkbnr/pp1ppppp/8/2p5/4P3/8/PPPP1PPP/RNBQKBNR w KQkq - 0 2",
      "ucis": ["e2e4", "c7c5", ...]
    }
  ],
  "meta": { ... }
}
```

### Выходной формат (UI v1):
```json
{
  "schema": "debutlab.debut.v1",
  "id": "sicilian",
  "name": "Сицилианская защита",
  "side": "black",
  "tags": ["black", "popular", "vs-e4", "generated"],
  "branches": [
    {
      "id": "sicilian-0001-abc12345",
      "type": "main_line",
      "name": "1.e4 c5 2.Nf3 d6 3.d4 cxd4 4.Nxd4 Nf6...",
      "startFen": "startpos",
      "ucis": ["e2e4", "c7c5", ...],
      "minPly": 8
    }
  ]
}
```

