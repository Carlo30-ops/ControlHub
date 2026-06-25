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

export function calcChange(current: number, prev: number | null): { text: string; positive: boolean | null } {
  if (prev === null || prev === 0) return { text: "—", positive: null };
  const pct = ((current - prev) / prev) * 100;
  return { text: `${pct >= 0 ? "+" : ""}${pct.toFixed(1)}%`, positive: pct >= 0 };
}
