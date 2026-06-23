// ─────────────────────────────────────────────────────────────────────────────
// pathResolver.ts — Resolución combinatoria de rutas por fecha
// ─────────────────────────────────────────────────────────────────────────────

export const MONTH_NAMES = [
  'enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio',
  'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'
];

export async function resolveTargetDayFolder(basePath: string, targetDate: Date): Promise<string | null> {
  if (!window.electronAPI?.checkPathExists) {
    console.warn('[PRE-PROBE] checkPathExists no disponible, fallback a full scan');
    return null;
  }

  try {
    const year = targetDate.getFullYear().toString();
    const monthIndex = targetDate.getMonth();
    const monthNum = String(monthIndex + 1).padStart(2, '0');
    const monthNameUpper = MONTH_NAMES[monthIndex].toUpperCase();
    const dayNum = String(targetDate.getDate()).padStart(2, '0');

    console.log('[PRE-PROBE] buscando:', { year, monthNum, monthNameUpper, dayNum, basePath });

    const monthFolderCandidates = [
      `${monthNum}-${monthNameUpper}`,
      `${monthNum}-DE ${monthNameUpper}`,
      `${monthNum}. ${monthNameUpper}`,
      `${monthNum} ${monthNameUpper}`,
    ];

    const dayFolderCandidates = [
      `${dayNum} DE ${monthNameUpper}`,
      `${dayNum} ${monthNameUpper}`,
      `${dayNum}`,
    ];

    // 1) Intentar estructura clásica: basePath\\YEAR\\MONTH_FOLDER\\DAY_FOLDER
    for (const monthFolder of monthFolderCandidates) {
      for (const dayFolder of dayFolderCandidates) {
        const candidate = `${basePath}\\${year}\\${monthFolder}\\${dayFolder}`;
        console.log('[PRE-PROBE] probando (con año):', candidate);
        const result = await window.electronAPI.checkPathExists(candidate);
        console.log('[PRE-PROBE] resultado:', { candidate, exists: result?.exists });
        if (result?.exists) {
          console.log('[PRE-PROBE] ✅ ENCONTRADO (con año):', candidate);
          return candidate;
        }
      }
    }

    // 2) Intentar variantes con el mes como carpeta raíz (sin año)
    const monthSimpleCandidates = [monthNameUpper, monthNum, ...monthFolderCandidates];
    for (const monthFolder of monthSimpleCandidates) {
      for (const dayFolder of dayFolderCandidates) {
        const candidate = `${basePath}\\${monthFolder}\\${dayFolder}`;
        console.log('[PRE-PROBE] probando (sin año):', candidate);
        const result = await window.electronAPI.checkPathExists(candidate);
        console.log('[PRE-PROBE] resultado:', { candidate, exists: result?.exists });
        if (result?.exists) {
          console.log('[PRE-PROBE] ✅ ENCONTRADO (sin año):', candidate);
          return candidate;
        }
      }
    }

    // 3) Si no encontramos por nombre exacto, buscar carpetas inmediatas que contengan el mes
    try {
      if (window.electronAPI?.readDirectory) {
        const listRes = await window.electronAPI.readDirectory(basePath, { maxDepth: 1 });
        const uniqueDirs = new Set<string>();
        for (const f of listRes.files || []) {
          const rel = f.filePath.replace(basePath, '').replace(/^\\|\//, '');
          const parts = rel.split(/[\\\/]/).filter(Boolean);
          if (parts.length > 0) uniqueDirs.add(parts[0]);
        }

        for (const dirName of Array.from(uniqueDirs)) {
          const dnUpper = dirName.toUpperCase();
          if (dnUpper.includes(monthNameUpper) || dnUpper === monthNum || dnUpper.startsWith(monthNum)) {
            for (const dayFolder of dayFolderCandidates) {
              const candidate = `${basePath}\\${dirName}\\${dayFolder}`;
              console.log('[PRE-PROBE] probando (child probe):', candidate);
              const result = await window.electronAPI.checkPathExists(candidate);
              console.log('[PRE-PROBE] resultado:', { candidate, exists: result?.exists });
              if (result?.exists) {
                console.log('[PRE-PROBE] ✅ ENCONTRADO (child probe):', candidate);
                return candidate;
              }
            }
          }
        }
      }
    } catch (err) {
      console.warn('[PRE-PROBE] child probe failed:', err);
    }

    console.log('[PRE-PROBE] ❌ no match found, usando full scan');
  } catch (err) {
    console.warn('[PRE-PROBE] resolveTargetDayFolder error:', err);
  }

  return null;
}

export async function resolveTargetMonthFolder(basePath: string, targetDate: Date): Promise<string | null> {
  if (!window.electronAPI?.checkPathExists) {
    return null;
  }

  const year = targetDate.getFullYear().toString();
  const monthIndex = targetDate.getMonth();
  const monthNum = String(monthIndex + 1).padStart(2, '0');
  const monthNameUpper = MONTH_NAMES[monthIndex].toUpperCase();

  const monthFolderCandidates = [
    `${monthNum}-${monthNameUpper}`,
    `${monthNum}-DE ${monthNameUpper}`,
    `${monthNum}. ${monthNameUpper}`,
    `${monthNum} ${monthNameUpper}`,
    monthNameUpper,
    monthNum,
  ];

  for (const monthFolder of monthFolderCandidates) {
    const candidate = `${basePath}\\${year}\\${monthFolder}`;
    const result = await window.electronAPI.checkPathExists(candidate);
    if (result?.exists) {
      console.log('[PRE-PROBE] ✅ ENCONTRADO mes (con año):', candidate);
      return candidate;
    }
  }

  for (const monthFolder of monthFolderCandidates) {
    const candidate = `${basePath}\\${monthFolder}`;
    const result = await window.electronAPI.checkPathExists(candidate);
    if (result?.exists) {
      console.log('[PRE-PROBE] ✅ ENCONTRADO mes (sin año):', candidate);
      return candidate;
    }
  }

  try {
    const yearPath = `${basePath}\\${year}`;
    const yearExists = await window.electronAPI.checkPathExists(yearPath);
    if (yearExists?.exists && window.electronAPI?.readDirectory) {
      const listRes = await window.electronAPI.readDirectory(yearPath, { maxDepth: 1 });
      const uniqueDirs = new Set<string>();
      for (const f of listRes.files || []) {
        const rel = f.filePath.replace(yearPath, '').replace(/^\\|\//, '');
        const parts = rel.split(/[\\\/]/).filter(Boolean);
        if (parts.length > 0) uniqueDirs.add(parts[0]);
      }

      for (const dirName of Array.from(uniqueDirs)) {
        const dnUpper = dirName.toUpperCase();
        if (dnUpper.includes(monthNameUpper) || dnUpper === monthNum || dnUpper.startsWith(monthNum)) {
          const candidate = `${yearPath}\\${dirName}`;
          console.log('[PRE-PROBE] ✅ ENCONTRADO mes por child probe en año:', candidate);
          return candidate;
        }
      }
    }
  } catch (err) {
    console.warn('[PRE-PROBE] child probe month failed:', err);
  }

  return null;
}

export async function resolveTargetRangeFolder(basePath: string, startDate: Date, endDate: Date): Promise<string | null> {
  if (!window.electronAPI?.checkPathExists) {
    return null;
  }

  const basename = basePath.replace(/[\\\/]+$/, '').split(/[\\\/]/).pop()?.toUpperCase() || '';
  const startYear = startDate.getFullYear();
  const endYear = endDate.getFullYear();

  if (startDate.getTime() === endDate.getTime()) {
    return resolveTargetDayFolder(basePath, startDate);
  }

  if (basename === String(startYear) || basename === String(endYear)) {
    const baseExists = await window.electronAPI.checkPathExists(basePath);
    if (baseExists?.exists) {
      return basePath;
    }
  }

  if (startDate.getFullYear() === endDate.getFullYear()) {
    if (startDate.getMonth() === endDate.getMonth()) {
      const monthPath = await resolveTargetMonthFolder(basePath, startDate);
      if (monthPath) {
        return monthPath;
      }
    }

    const yearPath = `${basePath}\\${startYear}`;
    const yearExists = await window.electronAPI.checkPathExists(yearPath);
    if (yearExists?.exists) {
      console.log('[PRE-PROBE] ✅ ENCONTRADO año para rango:', yearPath);
      return yearPath;
    }
  }

  return null;
}
