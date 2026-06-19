/**
 * scripts/loadTest.ts — Load test CLI para parsing PDF (Node puro, sin Electron)
 *
 * Uso: npm run load-test
 *
 * Recorre FACTURA DE MUESTRA, procesa PDFs con pdf-parse en dos fases
 * (baseline: 100 archivos, full: todos) y guarda métricas en metrics/.
 */

import fs from 'node:fs';
import fsPromises from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import { performance } from 'node:perf_hooks';
// @ts-expect-error — pdf-parse no tiene tipos oficiales
import pdfParse from 'pdf-parse';

// ─────────────────────────────────────────────────────────────────────────────
// Configuración
// ─────────────────────────────────────────────────────────────────────────────

const SAMPLE_DIR = path.join(process.cwd(), 'FACTURA DE MUESTRA');

const METRICS_DIR = path.join(process.cwd(), 'metrics');
const BASELINE_COUNT = 100;

// ─────────────────────────────────────────────────────────────────────────────
// Tipos
// ─────────────────────────────────────────────────────────────────────────────

interface MemorySnapshot {
  rss: number;
  heapTotal: number;
  heapUsed: number;
  external: number;
}

interface MemoryDelta {
  rss: number;
  heapTotal: number;
  heapUsed: number;
  external: number;
}

interface FileMetric {
  file: string;
  durationMs: number;
  success: boolean;
  textLength: number;
  pageCount: number;
  error?: string;
}

interface PhaseResult {
  phase: string;
  fileCount: number;
  durationMs: number;
  memoryDelta: MemoryDelta;
  cpuDelta: { user: number; system: number };
  perFile: FileMetric[];
  successCount: number;
  errorCount: number;
}

interface LoadTestReport {
  generatedAt: string;
  sampleDir: string;
  totalPdfsFound: number;
  nodeVersion: string;
  platform: string;
  cpuCount: number;
  phases: PhaseResult[];
}

// ─────────────────────────────────────────────────────────────────────────────
// Parsing PDF — mismo patrón que electron/pdfWorker.ts y diagnose_pdf.mjs
// ─────────────────────────────────────────────────────────────────────────────

async function parsePdfFile(
  pdfPath: string,
  maxPages?: number
): Promise<{ text: string; pageCount: number }> {
  const dataBuffer = await fsPromises.readFile(pdfPath);
  const options = maxPages ? { max: maxPages } : undefined;
  const data = await pdfParse(dataBuffer, options);
  return {
    text: data.text ?? '',
    pageCount: data.numpages ?? 0,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Utilidades
// ─────────────────────────────────────────────────────────────────────────────

function collectPdfFiles(dir: string): string[] {
  const results: string[] = [];

  const walk = (currentDir: string) => {
    const entries = fs.readdirSync(currentDir, { withFileTypes: true });
    for (const entry of entries) {
      const fullPath = path.join(currentDir, entry.name);
      if (entry.isDirectory()) {
        walk(fullPath);
      } else if (entry.isFile() && entry.name.toLowerCase().endsWith('.pdf')) {
        results.push(fullPath);
      }
    }
  };

  walk(dir);
  return results.sort();
}

function diffMemory(before: MemorySnapshot, after: MemorySnapshot): MemoryDelta {
  return {
    rss: after.rss - before.rss,
    heapTotal: after.heapTotal - before.heapTotal,
    heapUsed: after.heapUsed - before.heapUsed,
    external: after.external - before.external,
  };
}

function formatBytes(bytes: number): string {
  const sign = bytes < 0 ? '-' : '';
  const abs = Math.abs(bytes);
  if (abs >= 1024 * 1024) return `${sign}${(abs / (1024 * 1024)).toFixed(2)} MB`;
  if (abs >= 1024) return `${sign}${(abs / 1024).toFixed(2)} KB`;
  return `${sign}${abs} B`;
}

function formatDuration(ms: number): string {
  if (ms >= 60_000) return `${(ms / 60_000).toFixed(2)} min`;
  if (ms >= 1000) return `${(ms / 1000).toFixed(2)} s`;
  return `${ms.toFixed(0)} ms`;
}

function timestampForFilename(): string {
  return new Date().toISOString().replace(/[:.]/g, '-');
}

async function runPhase(phaseName: string, files: string[]): Promise<PhaseResult> {
  console.log(`\n[LOAD TEST] Fase "${phaseName}": ${files.length} archivos`);

  const startMem = process.memoryUsage();
  const startCpu = process.cpuUsage();
  const phaseStart = performance.now();
  const perFile: FileMetric[] = [];

  for (let i = 0; i < files.length; i++) {
    const filePath = files[i];
    const fileStart = performance.now();
    let metric: FileMetric;

    try {
      const { text, pageCount } = await parsePdfFile(filePath);
      metric = {
        file: filePath,
        durationMs: performance.now() - fileStart,
        success: true,
        textLength: text.length,
        pageCount,
      };
    } catch (err) {
      metric = {
        file: filePath,
        durationMs: performance.now() - fileStart,
        success: false,
        textLength: 0,
        pageCount: 0,
        error: err instanceof Error ? err.message : String(err),
      };
      console.error(`  [ERROR] ${path.basename(filePath)}: ${metric.error}`);
    }

    perFile.push(metric);

    if ((i + 1) % 25 === 0 || i + 1 === files.length) {
      console.log(`  Progreso: ${i + 1}/${files.length}`);
    }
  }

  const phaseEnd = performance.now();
  const endMem = process.memoryUsage();
  const endCpu = process.cpuUsage(startCpu);

  const successCount = perFile.filter((f) => f.success).length;
  const errorCount = perFile.length - successCount;

  console.log(
    `  Completado: ${formatDuration(phaseEnd - phaseStart)} | ` +
    `OK: ${successCount} | Errores: ${errorCount}`
  );

  return {
    phase: phaseName,
    fileCount: files.length,
    durationMs: phaseEnd - phaseStart,
    memoryDelta: diffMemory(startMem, endMem),
    cpuDelta: { user: endCpu.user, system: endCpu.system },
    perFile,
    successCount,
    errorCount,
  };
}

function buildMarkdownReport(report: LoadTestReport): string {
  const lines: string[] = [
    '# Load Test Report — ControlHub PDF Parsing',
    '',
    `**Generado:** ${report.generatedAt}`,
    `**Directorio:** \`${report.sampleDir}\``,
    `**PDFs encontrados:** ${report.totalPdfsFound}`,
    `**Node:** ${report.nodeVersion} | **Plataforma:** ${report.platform} | **CPUs:** ${report.cpuCount}`,
    '',
  ];

  for (const phase of report.phases) {
    const avgMs =
      phase.fileCount > 0
        ? phase.perFile.reduce((sum, f) => sum + f.durationMs, 0) / phase.fileCount
        : 0;

    lines.push(`## Fase: ${phase.phase}`);
    lines.push('');
    lines.push(`| Métrica | Valor |`);
    lines.push(`|---------|-------|`);
    lines.push(`| Archivos procesados | ${phase.fileCount} |`);
    lines.push(`| Exitosos | ${phase.successCount} |`);
    lines.push(`| Errores | ${phase.errorCount} |`);
    lines.push(`| Duración total | ${formatDuration(phase.durationMs)} |`);
    lines.push(`| Promedio por archivo | ${avgMs.toFixed(1)} ms |`);
    lines.push(`| Δ RSS | ${formatBytes(phase.memoryDelta.rss)} |`);
    lines.push(`| Δ Heap Used | ${formatBytes(phase.memoryDelta.heapUsed)} |`);
    lines.push(`| CPU user (µs) | ${phase.cpuDelta.user.toLocaleString('es-CO')} |`);
    lines.push(`| CPU system (µs) | ${phase.cpuDelta.system.toLocaleString('es-CO')} |`);
    lines.push('');

    const slowest = [...phase.perFile].sort((a, b) => b.durationMs - a.durationMs).slice(0, 5);
    if (slowest.length > 0) {
      lines.push('### Top 5 más lentos');
      lines.push('');
      for (const f of slowest) {
        lines.push(`- \`${path.basename(f.file)}\` — ${f.durationMs.toFixed(0)} ms${f.error ? ` (ERROR: ${f.error})` : ''}`);
      }
      lines.push('');
    }
  }

  return lines.join('\n');
}

// ─────────────────────────────────────────────────────────────────────────────
// Main
// ─────────────────────────────────────────────────────────────────────────────

async function main(): Promise<void> {
  console.log('[LOAD TEST] ControlHub PDF Load Test');
  console.log('[LOAD TEST] Escaneando:', SAMPLE_DIR);

  if (!fs.existsSync(SAMPLE_DIR)) {
    console.error(`[LOAD TEST] ERROR: Directorio no encontrado: ${SAMPLE_DIR}`);
    process.exit(1);
  }

  const allPdfFiles = collectPdfFiles(SAMPLE_DIR);
  console.log(`[LOAD TEST] PDFs encontrados: ${allPdfFiles.length}`);

  if (allPdfFiles.length === 0) {
    console.error('[LOAD TEST] ERROR: No se encontraron archivos PDF.');
    process.exit(1);
  }

  const phases = [
    { name: 'baseline', files: allPdfFiles.slice(0, BASELINE_COUNT) },
    { name: 'full', files: allPdfFiles },
  ];

  const phaseResults: PhaseResult[] = [];
  for (const { name, files } of phases) {
    phaseResults.push(await runPhase(name, files));
  }

  const report: LoadTestReport = {
    generatedAt: new Date().toISOString(),
    sampleDir: SAMPLE_DIR,
    totalPdfsFound: allPdfFiles.length,
    nodeVersion: process.version,
    platform: `${os.platform()} ${os.arch()}`,
    cpuCount: os.cpus().length,
    phases: phaseResults,
  };

  if (!fs.existsSync(METRICS_DIR)) {
    fs.mkdirSync(METRICS_DIR, { recursive: true });
  }

  const ts = timestampForFilename();
  const jsonPath = path.join(METRICS_DIR, `loadtest_${ts}.json`);
  const mdPath = path.join(METRICS_DIR, `loadtest_report_${ts}.md`);

  fs.writeFileSync(jsonPath, JSON.stringify(report, null, 2), 'utf-8');
  fs.writeFileSync(mdPath, buildMarkdownReport(report), 'utf-8');

  console.log('\n[LOAD TEST] Resultados guardados:');
  console.log('  JSON:', jsonPath);
  console.log('  MD:  ', mdPath);
  console.log('[LOAD TEST] Finalizado.');
}

main().catch((err) => {
  console.error('[LOAD TEST] Error fatal:', err);
  process.exit(1);
});
