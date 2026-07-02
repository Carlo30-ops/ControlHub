import { Invoice } from "../../../shared/types";
import { formatCOPFull } from "../../utils/formatters";

export function getDayFromDate(date: string): number {
  const parts = date.split("/");
  return parts.length === 3 ? parseInt(parts[0], 10) || 0 : 0;
}

export interface CsvColumnOptions {
  invoiceNumber?: boolean;
  company?: boolean;
  detail?: boolean;
  amount?: boolean;
  filePath?: boolean;
}

export function buildCSV(invoices: Invoice[], columns: CsvColumnOptions): string {
  const headers = [];
  if (columns.invoiceNumber) headers.push("N° Factura");
  if (columns.company) headers.push("Compañía");
  headers.push("Día", "Mes", "Año", "Fecha");
  if (columns.detail) headers.push("Detalle");
  if (columns.amount) headers.push("Monto");
  if (columns.filePath) headers.push("Ruta");

  const rows = invoices.map((inv) => {
    const cells = [];
    if (columns.invoiceNumber) cells.push(`"${inv.invoiceNumber}"`);
    if (columns.company) cells.push(`"${inv.company}"`);
    cells.push(`"${getDayFromDate(inv.date)}"`, `"${inv.month}"`, `"${inv.year}"`, `"${inv.date}"`);
    if (columns.detail) cells.push(`"${inv.detail.replace(/"/g, '""')}"`);
    if (columns.amount) cells.push(inv.amount || "0");
    if (columns.filePath) cells.push(`"${inv.filePath.replace(/"/g, '""')}"`);
    return cells.join(",");
  });

  return "\uFEFF" + [headers.join(","), ...rows].join("\r\n");
}

export function generateReportHTML(filteredInvoices: Invoice[], totalAmount: number, dateStr: string): string {
  const companyStats = filteredInvoices.reduce((acc: Record<string, { count: number; total: number }>, inv) => {
    if (!acc[inv.company]) acc[inv.company] = { count: 0, total: 0 };
    acc[inv.company].count += 1;
    acc[inv.company].total += inv.amount || 0;
    return acc;
  }, {});

  const rowsHtml = filteredInvoices.slice(0, 10).map(inv => `
    <tr>
      <td style="padding:6px;border-bottom:1px solid #e6eef8">${inv.invoiceNumber}</td>
      <td style="padding:6px;border-bottom:1px solid #e6eef8">${inv.company}</td>
      <td style="padding:6px;border-bottom:1px solid #e6eef8">${inv.date}</td>
      <td style="padding:6px;border-bottom:1px solid #e6eef8;text-align:right">${inv.amount > 0 ? formatCOPFull(inv.amount) : '—'}</td>
    </tr>
  `).join('');

  const distributionHtml = Object.entries(companyStats)
    .sort(([, a], [, b]) => b.count - a.count)
    .slice(0, 8)
    .map(([name, d]) => `<li>${name}: ${d.count} facturas (${formatCOPFull(d.total)})</li>`)
    .join('');

  return `
    <!doctype html>
    <html>
    <head>
      <meta charset="utf-8" />
      <title>Reporte Analítico de Auditoría COTU</title>
      <style>
        body { font-family: Arial, Helvetica, sans-serif; color:#0f172a; }
        .header { margin:20px 0 }
        .metrics { margin:10px 0 }
        table { width:100%; border-collapse:collapse; margin-top:8px }
        th { text-align:left; padding:8px; background:#f8fafc }
        td { padding:6px }
      </style>
    </head>
    <body>
      <h1>REPORTE ANALÍTICO DE AUDITORÍA COTU</h1>
      <div class="header">Generado el: ${dateStr}</div>
      <h2>Métricas Clave</h2>
      <div class="metrics">
        <p>Total Facturas Auditadas: ${filteredInvoices.length}</p>
        <p>Monto Total: ${formatCOPFull(totalAmount)}</p>
        <p>Aseguradoras Detectadas: ${new Set(filteredInvoices.map(i => i.company)).size}</p>
        <p>Tasa de Extracción Correcta: ${filteredInvoices.length > 0 ? Math.round((filteredInvoices.filter(i => i.amount > 0).length / filteredInvoices.length) * 100) : 0}%</p>
      </div>
      <h2>Distribución por Aseguradora</h2>
      <ul>${distributionHtml}</ul>
      <h2>Detalle de Auditoría (muestra)</h2>
      <table>
        <thead>
          <tr><th>N° Factura</th><th>Aseguradora</th><th>Fecha</th><th style="text-align:right">Monto (COP)</th></tr>
        </thead>
        <tbody>
          ${rowsHtml}
        </tbody>
      </table>
      ${filteredInvoices.length > 10 ? `<p>... y ${filteredInvoices.length - 10} facturas más en el reporte general.</p>` : ''}
    </body>
    </html>
  `;
}
