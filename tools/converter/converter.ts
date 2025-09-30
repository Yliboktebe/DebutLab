import { readFile, writeFile, mkdir } from "node:fs/promises";
import { join } from "node:path";
import { GeneratedDebutFile, UiDebutFile, UiBranch, CatalogItem } from "./types.js";
import { createBranchName, getBranchType, createBranchId } from "./chess-utils.js";

/**
 * Конвертирует сгенерированный файл дебюта в формат UI v1
 */
export async function convertDebutFile(
  inputPath: string, 
  outputPath: string,
  debutName: string,
  tags: string[]
): Promise<{ branches: number; sizeKB: number }> {
  
  // Читаем исходный файл
  const inputData = JSON.parse(await readFile(inputPath, "utf8")) as GeneratedDebutFile;
  
  // Конвертируем ветки
  const uiBranches: UiBranch[] = inputData.branches.map((branch, index) => {
    const branchName = createBranchName(branch.ucis, branch.startFen);
    const branchType = getBranchType(index, inputData.branches.length);
    const branchId = createBranchId(inputData.id, branch.ucis, index);
    
    return {
      id: branchId,
      type: branchType,
      name: branchName,
      startFen: "startpos", // Всегда используем startpos для UI
      ucis: branch.ucis,
      minPly: branch.ucis.length
    };
  });
  
  // Создаем UI v1 файл
  const uiFile: UiDebutFile = {
    schema: "debutlab.debut.v1",
    id: inputData.id,
    name: debutName,
    side: inputData.side,
    tags: tags,
    branches: uiBranches
  };
  
  // Создаем директорию если не существует
  await mkdir(join(outputPath, ".."), { recursive: true });
  
  // Записываем файл
  const jsonContent = JSON.stringify(uiFile, null, 2);
  await writeFile(outputPath, jsonContent, "utf8");
  
  // Возвращаем статистику
  const sizeKB = Math.round(Buffer.byteLength(jsonContent, "utf8") / 1024);
  
  return {
    branches: uiBranches.length,
    sizeKB: sizeKB
  };
}

/**
 * Создает или обновляет запись в каталоге
 */
export async function updateCatalog(
  catalogPath: string,
  debutId: string,
  debutName: string,
  side: "white" | "black",
  tags: string[],
  filePath: string,
  branches: number,
  sizeKB: number
): Promise<void> {
  
  let catalog: any;
  
  try {
    const catalogContent = await readFile(catalogPath, "utf8");
    catalog = JSON.parse(catalogContent);
  } catch (error) {
    // Если файл не существует, создаем новый
    catalog = {
      schema: "debutlab.catalog.v1",
      updatedAt: new Date().toISOString(),
      debuts: []
    };
  }
  
  // Ищем существующую запись
  const existingIndex = catalog.debuts.findIndex((d: any) => d.id === debutId);
  
  const catalogItem: CatalogItem = {
    id: debutId,
    name: debutName,
    side: side,
    tags: tags,
    file: filePath,
    hash: `sha256-${Date.now()}`, // Простой хэш для демонстрации
    branches: branches,
    approxSizeKB: sizeKB
  };
  
  if (existingIndex >= 0) {
    // Обновляем существующую запись
    catalog.debuts[existingIndex] = catalogItem;
  } else {
    // Добавляем новую запись
    catalog.debuts.push(catalogItem);
  }
  
  // Обновляем время последнего изменения
  catalog.updatedAt = new Date().toISOString();
  
  // Записываем обновленный каталог
  await writeFile(catalogPath, JSON.stringify(catalog, null, 2), "utf8");
}

/**
 * Получает метаданные дебюта на основе ID
 */
export function getDebutMetadata(debutId: string): { name: string; tags: string[] } {
  const metadata: Record<string, { name: string; tags: string[] }> = {
    "sicilian": {
      name: "Сицилианская защита",
      tags: ["black", "popular", "vs-e4", "generated"]
    },
    "ruy-lopez": {
      name: "Испанская партия", 
      tags: ["white", "classical", "vs-e5", "generated"]
    },
    "queens-gambit": {
      name: "Ферзевый гамбит",
      tags: ["white", "classical", "vs-d5", "generated"]
    },
    "central": {
      name: "Центральный дебют",
      tags: ["white", "classical", "vs-e5", "generated"]
    }
  };
  
  return metadata[debutId] || {
    name: debutId.charAt(0).toUpperCase() + debutId.slice(1),
    tags: ["generated"]
  };
}

