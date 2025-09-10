#!/usr/bin/env tsx
import { readdir } from "node:fs/promises";
import { resolve, basename, extname } from "node:path";
import { convertDebutFile, updateCatalog, getDebutMetadata } from "./converter.js";

const CONTENT_TREES = resolve("content/trees");
const PUBLIC_CONTENT = resolve("public/content");
const CATALOG_PATH = resolve("public/content/catalog.json");

async function main() {
  try {
    console.log("🔄 Converting all debut files...");
    
    // Получаем список всех .json файлов в content/trees
    const files = await readdir(CONTENT_TREES);
    const jsonFiles = files.filter(file => extname(file) === ".json");
    
    if (jsonFiles.length === 0) {
      console.log("❌ No JSON files found in content/trees/");
      return;
    }
    
    console.log(`📁 Found ${jsonFiles.length} files to convert:`);
    jsonFiles.forEach(file => console.log(`   - ${file}`));
    console.log();
    
    let totalBranches = 0;
    let totalSize = 0;
    
    // Конвертируем каждый файл
    for (const file of jsonFiles) {
      const debutId = basename(file, ".json");
      const inputPath = resolve(CONTENT_TREES, file);
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
        
        console.log(`✅ ${debutId}: ${stats.branches} branches, ${stats.sizeKB} KB`);
        
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
        
        totalBranches += stats.branches;
        totalSize += stats.sizeKB;
        
      } catch (error) {
        console.error(`❌ Error converting ${debutId}:`, error);
      }
    }
    
    console.log();
    console.log("📊 Summary:");
    console.log(`   Files converted: ${jsonFiles.length}`);
    console.log(`   Total branches: ${totalBranches}`);
    console.log(`   Total size: ${totalSize} KB`);
    console.log(`📝 Catalog updated: ${CATALOG_PATH}`);
    console.log("🎉 All conversions completed!");
    
  } catch (error) {
    console.error("❌ Error:", error);
    process.exit(1);
  }
}

main();

