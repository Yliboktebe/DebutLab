#!/usr/bin/env tsx
import { resolve } from "node:path";
import { convertDebutFile, updateCatalog, getDebutMetadata } from "./converter.js";

const CONTENT_TREES = resolve("content/trees");
const PUBLIC_CONTENT = resolve("public/content");
const CATALOG_PATH = resolve("public/content/catalog.json");

async function main() {
  const args = process.argv.slice(2);
  const debutId = args[0];
  
  if (!debutId) {
    console.error("Usage: tsx convert.ts <debut-id>");
    console.error("Example: tsx convert.ts sicilian");
    process.exit(1);
  }
  
  const inputPath = resolve(CONTENT_TREES, `${debutId}.json`);
  const outputPath = resolve(PUBLIC_CONTENT, "demo", `${debutId}.v1.json`);
  
  try {
    console.log(`🔄 Converting ${debutId}...`);
    
    // Получаем метаданные дебюта
    const metadata = getDebutMetadata(debutId);
    
    // Конвертируем файл
    const stats = await convertDebutFile(
      inputPath,
      outputPath, 
      metadata.name,
      metadata.tags
    );
    
    console.log(`✅ Converted ${debutId}:`);
    console.log(`   Branches: ${stats.branches}`);
    console.log(`   Size: ${stats.sizeKB} KB`);
    console.log(`   Output: ${outputPath}`);
    
    // Обновляем каталог
    await updateCatalog(
      CATALOG_PATH,
      debutId,
      metadata.name,
      metadata.tags.includes("white") ? "white" : "black",
      metadata.tags,
      `demo/${debutId}.v1.json`,
      stats.branches,
      stats.sizeKB
    );
    
    console.log(`📝 Updated catalog: ${CATALOG_PATH}`);
    console.log(`🎉 Conversion completed successfully!`);
    
  } catch (error) {
    console.error(`❌ Error converting ${debutId}:`, error);
    process.exit(1);
  }
}

main();

