// test-day-extraction.mjs
// Test unitario para la función extractMetadataFromPath (lógica de extracción de día)
// Simula el motor sin dependencias de Electron.

// ── Replica de constantes ────────────────────────────────────────────────────
const MONTH_NAMES = [
  'enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio',
  'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'
];

// ── Replica de extractMetadataFromPath (solo la lógica de fecha) ─────────────
function extractDateFromPath(filePath) {
  const pathParts = filePath.split(/[\\\/]/).filter(p => p.trim() !== '');

  let year = '';
  let month = '';
  let monthNum = '';
  let day = '';

  for (let i = 0; i < pathParts.length; i++) {
    const part = pathParts[i];
    const partLower = part.toLowerCase();
    const isFile = i === pathParts.length - 1; // Último segmento = carpeta COTU

    if (!isFile) {
      // Año
      if (/^\d{4}$/.test(part)) {
        year = part;
      } else if (!year) {
        const yMatch = part.match(/\b(20\d{2})\b/);
        if (yMatch) year = yMatch[1];
      }

      // Mes
      const monthIndex = MONTH_NAMES.findIndex(m => partLower.includes(m));
      if (monthIndex >= 0) {
        month = MONTH_NAMES[monthIndex].charAt(0).toUpperCase() + MONTH_NAMES[monthIndex].slice(1);
        monthNum = (monthIndex + 1).toString().padStart(2, '0');
      } else if (/^(0?[1-9]|1[0-2])$/.test(part)) {
        const mInt = parseInt(part);
        month = MONTH_NAMES[mInt - 1].charAt(0).toUpperCase() + MONTH_NAMES[mInt - 1].slice(1);
        monthNum = mInt.toString().padStart(2, '0');
      }

      // Fix Día v2: ÚLTIMO número válido en el path gana (igual que month).
      const dayMatches = part.match(/\b(0?[1-9]|[12]\d|3[01])\b/g);
      if (dayMatches && dayMatches.length > 0) {
        day = dayMatches[0].padStart(2, '0');
      }
    }
  }

  // Fallback año/mes/día si no se encontraron
  const now = new Date();
  if (!year) year = now.getFullYear().toString();
  if (!month) { month = 'Enero'; monthNum = '01'; }
  if (!day) day = '01';

  return `${day}/${monthNum}/${year}`;
}

// ── Casos de prueba ──────────────────────────────────────────────────────────
const tests = [
  {
    name: 'BUG PRINCIPAL: 04 ABRIL\\21 ABRIL → día debe ser 21',
    path: 'C:\\FACTURACION\\2026\\04 ABRIL\\21 ABRIL\\BOLIVAR\\COTU1234',
    expected: '21/04/2026',
  },
  {
    name: 'Carpeta solo de mes: 04 ABRIL → día cae por defecto del número',
    path: 'C:\\FACTURACION\\2026\\04 ABRIL\\BOLIVAR\\COTU5678',
    expected: '04/04/2026',
  },
  {
    name: 'Primer día del mes: 04 ABRIL\\01 ABRIL',
    path: 'C:\\FACTURACION\\2026\\04 ABRIL\\01 ABRIL\\COLSANITAS\\COTU0001',
    expected: '01/04/2026',
  },
  {
    name: 'Último día del mes: 04 ABRIL\\30 ABRIL',
    path: 'C:\\FACTURACION\\2026\\04 ABRIL\\30 ABRIL\\ESTADO\\COTU9999',
    expected: '30/04/2026',
  },
  {
    name: 'Año anterior: 03 MARZO\\15 MARZO',
    path: 'C:\\FACTURACION\\2025\\03 MARZO\\15 MARZO\\SURA\\COTU0042',
    expected: '15/03/2025',
  },
  {
    name: 'Sin subcarpeta de día (mes sin número): ABRIL\\BOLIVAR',
    path: 'C:\\FACTURACION\\2026\\ABRIL\\BOLIVAR\\COTU1111',
    expected: '01/04/2026', // Sin día → fallback '01'
  },
  {
    name: 'Día 20 ABRIL (penúltimo en la lista)',
    path: 'C:\\FACTURACION\\2026\\04 ABRIL\\20 ABRIL\\MAPFRE\\COTU2020',
    expected: '20/04/2026',
  },
  {
    name: 'Diciembre fin de año: 12 DICIEMBRE\\31 DICIEMBRE',
    path: 'C:\\FACTURACION\\2026\\12 DICIEMBRE\\31 DICIEMBRE\\LIBERTY\\COTU3112',
    expected: '31/12/2026',
  },
  {
    name: 'Número de aseguradora en ruta no confunde el día',
    path: 'C:\\FACTURACION\\2026\\04 ABRIL\\08 ABRIL\\HDI\\COTU0808',
    expected: '08/04/2026',
  },
];

// ── Ejecutar tests ────────────────────────────────────────────────────────────
let passed = 0;
let failed = 0;

console.log('\n╔══════════════════════════════════════════════════════════╗');
console.log('║       COTU Analytics — Test Extracción de Fecha          ║');
console.log('╚══════════════════════════════════════════════════════════╝\n');

for (const test of tests) {
  const result = extractDateFromPath(test.path);
  const ok = result === test.expected;
  if (ok) {
    passed++;
    console.log(`  ✅  ${test.name}`);
    console.log(`       → ${result}\n`);
  } else {
    failed++;
    console.log(`  ❌  ${test.name}`);
    console.log(`       Esperado: ${test.expected}`);
    console.log(`       Obtenido: ${result}\n`);
  }
}

console.log('──────────────────────────────────────────────────────────');
console.log(`  Resultado: ${passed}/${tests.length} tests pasaron`);
if (failed === 0) {
  console.log('  🎉 TODOS LOS TESTS PASARON — listo para build\n');
  process.exit(0);
} else {
  console.log(`  ⚠️  ${failed} test(s) fallaron — revisar antes de build\n`);
  process.exit(1);
}
