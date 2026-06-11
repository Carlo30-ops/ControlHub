import { Invoice } from "../contexts/DataContext";

// Aseguradoras reales sincronizadas con el motor de escaneo
const companies = [
  "Sura",
  "Positiva",
  "Solidaria",
  "HDI",
  "AXA",
  "Liberty",
  "Seguros del Estado",
  "Bolivar",
  "Mapfre",
  "Mundial",
  "Equidad",
  "Allianz",
];

const months = [
  "Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio",
  "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre",
];

const details = [
  "Factura COTU servicio médico hospitalario",
  "Factura COTU rehabilitación física",
  "Factura COTU medicamentos prescritos",
  "Factura COTU consulta especialista",
  "Factura COTU procedimiento quirúrgico",
  "Factura COTU urgencias",
  "Factura COTU imagen diagnóstica",
  "Factura COTU terapia ambulatoria",
  "Factura COTU atención domiciliaria",
  "Factura COTU laboratorio clínico",
];

function randomDate(start: Date, end: Date): Date {
  return new Date(start.getTime() + Math.random() * (end.getTime() - start.getTime()));
}

function padNumber(num: number, size: number): string {
  let s = num.toString();
  while (s.length < size) s = "0" + s;
  return s;
}

function generateFilePath(company: string, year: string, month: string, invoiceNum: string): string {
  const companyFolder = company.replace(/[^a-zA-Z0-9\s]/g, "").trim();
  return `C:\\Facturas\\${companyFolder}\\${year}\\${month}\\COTU ${invoiceNum}.pdf`;
}

export function generateMockInvoices(count: number, dateRange?: { start: Date; end: Date }): Invoice[] {
  const invoices: Invoice[] = [];
  const startDate = dateRange?.start || new Date(2023, 0, 1);
  const endDate = dateRange?.end || new Date();

  for (let i = 0; i < count; i++) {
    const invoiceDate = randomDate(startDate, endDate);
    const year = invoiceDate.getFullYear().toString();
    const monthIndex = invoiceDate.getMonth();
    const month = months[monthIndex];
    const invoiceNum = padNumber(Math.floor(Math.random() * 999999) + 1, 6);
    const company = companies[Math.floor(Math.random() * companies.length)];

    const day = String(Math.floor(Math.random() * 28) + 1).padStart(2, '0');
    const monthNumStr = String(monthIndex + 1).padStart(2, '0');

    invoices.push({
      id: `invoice-${Date.now()}-${i}-${Math.random().toString(36).substr(2, 9)}`,
      invoiceNumber: `COTU ${invoiceNum}`,
      company,
      month,
      year,
      detail: details[Math.floor(Math.random() * details.length)],
      filePath: generateFilePath(company, year, month, invoiceNum),
      amount: Math.round((Math.random() * 5000000 + 50000) * 100) / 100,
      date: `${day}/${monthNumStr}/${year}`, // Fix #14: campo date requerido
    });
  }

  return invoices.sort((a, b) => {
    if (a.year !== b.year) return parseInt(b.year) - parseInt(a.year);
    if (a.month !== b.month) return months.indexOf(b.month) - months.indexOf(a.month);
    return a.invoiceNumber.localeCompare(b.invoiceNumber);
  });
}

export function scanInvoices(
  _type: "day" | "week" | "month" | "year" | "custom",
  dateRange: { start: Date; end: Date },
  _basePath: string
): Promise<{ invoices: Invoice[]; duration: number }> {
  return new Promise((resolve) => {
    const startTime = Date.now();
    setTimeout(() => {
      const count = Math.floor(Math.random() * 200) + 50;
      const invoices = generateMockInvoices(count, dateRange);
      resolve({ invoices, duration: Date.now() - startTime });
    }, 2000 + Math.random() * 1500);
  });
}

export function getExamplePaths(): string[] {
  return [
    "C:\\Documentos\\Facturas",
    "C:\\Users\\Admin\\Desktop\\COTU_2024",
    "D:\\Empresa\\Contabilidad\\Facturas",
    "C:\\Archivos\\Seguros\\COTU",
    "\\\\Servidor\\Compartido\\Facturas",
  ];
}
