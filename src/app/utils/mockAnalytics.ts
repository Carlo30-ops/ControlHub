import { Invoice, ScanStats } from "../contexts/DataContext";

export interface DashboardData {
  totalInvoices: number;
  uniqueCompanies: number;
  topCompanyName: string;
  topCompanyCount: number;
  totalAmount: number;
  topCompanies: { name: string; value: number; fullName: string }[];
  companyPieData: { name: string; value: number; fullName: string }[];
  yearData: { name: string; value: number }[];
  monthlyTrend: { month: string; invoices: number }[];
  prevTotal: number | null;
  prevCompanies: number | null;
  amountSuccess: number;
  amountFailed: number;
  extractionRate: number | null;
  prevTopCompany?: string | null;
}

// Datos mock tipados estrictamente según las interfaces compartidas de DataContext
export const MOCK_INVOICES: Invoice[] = [
  {
    id: "mock-inv-1",
    invoiceNumber: "COTU 000123",
    company: "SURA",
    month: "Junio",
    year: "2024",
    detail: "Servicios Médicos Premium",
    filePath: "C:\\Facturas\\SURA\\2024\\Junio\\COTU 000123.pdf",
    amount: 15420000,
    date: "12/06/2024",
  },
  {
    id: "mock-inv-2",
    invoiceNumber: "COTU 000124",
    company: "BOLIVAR",
    month: "Junio",
    year: "2024",
    detail: "Factura de Rehabilitación Física",
    filePath: "C:\\Facturas\\BOLIVAR\\2024\\Junio\\COTU 000124.pdf",
    amount: 8500000,
    date: "15/06/2024",
  }
];

export const MOCK_SCAN_STATS: ScanStats = {
  totalFilesProcessed: 1250,
  skippedByExtension: 0,
  skippedByDateRange: 0,
  skippedDuplicates: 0,
  duplicatesLog: [],
  amountExtractionSuccess: 1200,
  amountExtractionFailed: 50,
};

export const MOCK_DASHBOARD_DATA: DashboardData = {
  totalInvoices: 1250,
  uniqueCompanies: 18,
  topCompanyName: "SURA",
  topCompanyCount: 450,
  totalAmount: 154200000,
  topCompanies: [
    { name: "SURA", value: 450, fullName: "SURA" },
    { name: "BOLIVAR", value: 320, fullName: "BOLIVAR" },
    { name: "ALLIANZ", value: 210, fullName: "ALLIANZ" },
  ],
  companyPieData: [
    { name: "SURA", value: 450, fullName: "SURA" },
    { name: "BOLIVAR", value: 320, fullName: "BOLIVAR" },
    { name: "ALLIANZ", value: 210, fullName: "ALLIANZ" },
    { name: "Otros", value: 270, fullName: "Otras aseguradoras" },
  ],
  yearData: [
    { name: "2023", value: 400 },
    { name: "2024", value: 850 },
  ],
  monthlyTrend: [
    { month: "Ene", invoices: 45 },
    { month: "Feb", invoices: 52 },
    { month: "Mar", invoices: 48 },
    { month: "Abr", invoices: 70 },
    { month: "May", invoices: 65 },
    { month: "Jun", invoices: 88 },
    { month: "Jul", invoices: 92 },
    { month: "Ago", invoices: 85 },
  ],
  prevTotal: 1100,
  prevCompanies: 15,
  amountSuccess: MOCK_SCAN_STATS.amountExtractionSuccess,
  amountFailed: MOCK_SCAN_STATS.amountExtractionFailed,
  extractionRate: 96,
  prevTopCompany: "BOLIVAR",
};
