/**
 * Formateadores centralizados para valores monetarios y fechas
 */

/**
 * Formatea un valor numérico como moneda COP (Pesos Colombianos)
 * @param value - Valor numérico a formatear
 * @returns String formateado como moneda COP (ej: "$1.5M", "$500K", "$10,000")
 */
export function formatCOP(value: number): string {
  if (value === 0) return "—";
  if (value >= 1_000_000_000) return `$${(value / 1_000_000_000).toFixed(1)}B`;
  if (value >= 1_000_000) return `$${(value / 1_000_000).toFixed(1)}M`;
  if (value >= 1_000) return `$${(value / 1_000).toFixed(0)}K`;
  return `$${value.toLocaleString("es-CO")}`;
}

/**
 * Formatea un valor numérico como moneda COP con formato completo
 * @param value - Valor numérico a formatear
 * @returns String formateado como moneda COP completa (ej: "$1,500,000")
 */
export function formatCOPFull(value: number): string {
  if (!value || value === 0) return "—";
  return new Intl.NumberFormat("es-CO", {
    style: "currency",
    currency: "COP",
    minimumFractionDigits: 0,
  }).format(value);
}
