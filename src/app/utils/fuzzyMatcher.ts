// ─────────────────────────────────────────────────────────────────────────────
// fuzzyMatcher.ts — Motor de Matching Difuso para Aseguradoras
// ─────────────────────────────────────────────────────────────────────────────
import Fuse from "fuse.js";

/**
 * Base de datos de aseguradoras conocidas con sus aliases
 */
export const KNOWN_INSURERS: Record<string, string[]> = {
  'ALFA': ['alfa'],
  'ALLIANZ': ['allianz'],
  'AURORA': ['aurora'],
  'AXXA COLPATRIA': ['axa', 'colpatria', 'axxa', 'axxa colpatria'],
  'BOLIVAR': ['bolivar', 'seguros bolivar'],
  'CENFAR': ['cenfar'],
  'COLMENA': ['colmena'],
  'COLSANITAS': ['colsanitas', 'sanitas'],
  'EQUIDAD': ['equidad'],
  'ESTADO': ['seguros del estado', 'estado', 'seg estado'],
  'ESTADO SOAT': ['estado soat', 'soat estado'],
  'HDI': ['hdi'],
  'IPS WTA LATAM S.A.S': ['wta', 'ips wta', 'latam'],
  'LIBERTY': ['liberty'],
  'MAPFRE': ['mapfre'],
  'MEDIPORT': ['mediport'],
  'MUNDIAL': ['mundial'],
  'POSITIVA': ['positiva'],
  'PREVISORA': ['previsora'],
  'SOAT SURA': ['soat sura', 'sura soat'],
  'SOLIDARIA': ['solidaria'],
  'SURA': ['sura', 'suramericana'],
};

/**
 * Crea motor Fuse para matching de aseguradoras (una instancia por escaneo)
 * @param customInsurers - Aseguradoras personalizadas con aliases
 * @returns Instancia de Fuse configurada para matching difuso
 */
export function createFuzzyEngine(
  customInsurers?: { name: string; aliases: string[]; amountLabels?: string[] }[]
): Fuse<{ name: string; alias: string }> {
  const list: { name: string; alias: string }[] = [];

  if (customInsurers) {
    customInsurers.forEach(ci => {
      ci.aliases.forEach(al => {
        if (al.trim()) list.push({ name: ci.name, alias: al.trim().toLowerCase() });
      });
      list.push({ name: ci.name, alias: ci.name.toLowerCase() });
    });
  }

  Object.entries(KNOWN_INSURERS).forEach(([canon, aliases]) => {
    aliases.forEach(al => list.push({ name: canon, alias: al }));
  });

  return new Fuse(list, { keys: ['alias'], threshold: 0.25, ignoreLocation: true });
}
