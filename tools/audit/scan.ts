#!/usr/bin/env tsx
/**
 * Code metrics scanner for audit purposes
 * Collects: LOC per file, long functions (>60 lines), any-type usage
 */

import fg from 'fast-glob';
import * as fs from 'fs/promises';
import * as path from 'path';

interface FunctionMetric {
  name: string;
  startLine: number;
  endLine: number;
  lines: number;
  file: string;
}

interface FileMetric {
  file: string;
  loc: number;
  anyCount: number;
  longFunctions: FunctionMetric[];
}

interface ScanResult {
  scannedAt: string;
  totalFiles: number;
  totalLoc: number;
  totalAnyCount: number;
  totalLongFunctions: number;
  files: FileMetric[];
  longFunctionsList: FunctionMetric[];
}

const LONG_FUNCTION_THRESHOLD = 60;

async function scanFile(filePath: string): Promise<FileMetric> {
  const content = await fs.readFile(filePath, 'utf-8');
  const lines = content.split('\n');
  
  const metric: FileMetric = {
    file: filePath,
    loc: lines.length,
    anyCount: 0,
    longFunctions: [],
  };

  // Count 'any' types (simple regex, may have false positives)
  const anyMatches = content.match(/:\s*any\b/g);
  metric.anyCount = anyMatches ? anyMatches.length : 0;

  // Detect long functions (simple heuristic)
  const longFunctions = detectLongFunctions(lines, filePath);
  metric.longFunctions = longFunctions;

  return metric;
}

function detectLongFunctions(lines: string[], filePath: string): FunctionMetric[] {
  const functions: FunctionMetric[] = [];
  let inFunction = false;
  let functionStart = 0;
  let braceCount = 0;
  let functionName = '';

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    
    // Simple function detection (heuristic)
    if (!inFunction) {
      const funcMatch = line.match(/(?:function|const|let|var)\s+(\w+)\s*(?:=\s*)?(?:\([^)]*\)|<[^>]*>)\s*(?:=>)?\s*\{/);
      const methodMatch = line.match(/^\s*(?:async\s+)?(\w+)\s*\([^)]*\)\s*(?::\s*[^{]+)?\s*\{/);
      
      if (funcMatch || methodMatch) {
        functionName = (funcMatch || methodMatch)![1];
        functionStart = i + 1; // 1-based line numbers
        inFunction = true;
        braceCount = 1;
      }
    } else {
      // Count braces to find function end
      for (const char of line) {
        if (char === '{') braceCount++;
        if (char === '}') braceCount--;
      }
      
      if (braceCount === 0) {
        const functionEnd = i + 1;
        const functionLines = functionEnd - functionStart + 1;
        
        if (functionLines > LONG_FUNCTION_THRESHOLD) {
          functions.push({
            name: functionName,
            startLine: functionStart,
            endLine: functionEnd,
            lines: functionLines,
            file: filePath,
          });
        }
        
        inFunction = false;
      }
    }
  }

  return functions;
}

async function main() {
  console.log('Starting codebase scan...');
  
  const files = await fg('src/**/*.{ts,tsx,js,jsx}', {
    cwd: process.cwd(),
    ignore: ['**/*.d.ts', '**/*.test.ts', '**/*.test.tsx'],
  });

  console.log(`Found ${files.length} files to scan`);

  const fileMetrics: FileMetric[] = [];
  
  for (const file of files) {
    const metric = await scanFile(file);
    fileMetrics.push(metric);
  }

  // Aggregate results
  const longFunctionsList = fileMetrics.flatMap(f => f.longFunctions);
  
  const result: ScanResult = {
    scannedAt: new Date().toISOString(),
    totalFiles: fileMetrics.length,
    totalLoc: fileMetrics.reduce((sum, f) => sum + f.loc, 0),
    totalAnyCount: fileMetrics.reduce((sum, f) => sum + f.anyCount, 0),
    totalLongFunctions: longFunctionsList.length,
    files: fileMetrics.sort((a, b) => b.loc - a.loc), // Sort by LOC descending
    longFunctionsList: longFunctionsList.sort((a, b) => b.lines - a.lines),
  };

  // Write results
  const outPath = path.join(process.cwd(), 'tools/audit/out/scan.json');
  await fs.writeFile(outPath, JSON.stringify(result, null, 2), 'utf-8');
  
  console.log('\n📊 Scan Results:');
  console.log(`  Total files: ${result.totalFiles}`);
  console.log(`  Total LOC: ${result.totalLoc}`);
  console.log(`  Total 'any' types: ${result.totalAnyCount}`);
  console.log(`  Long functions (>${LONG_FUNCTION_THRESHOLD} lines): ${result.totalLongFunctions}`);
  console.log(`\n✅ Report saved to: ${outPath}`);
}

main().catch(console.error);
