// ─────────────────────────────────────────────────────────────────────────────
// invoiceFilters.ts — Lógica de filtrado de facturas para Reports
// ─────────────────────────────────────────────────────────────────────────────

import { Invoice } from "../../shared/types";

export interface InvoiceFilterOptions {
  searchQuery: string;
  companyFilter: string;
  yearFilter: string;
  monthFilter: string;
  minAmount?: string;
  maxAmount?: string;
}

export function filterInvoices(
  invoices: Invoice[],
  options: InvoiceFilterOptions
): Invoice[] {
  const { searchQuery, companyFilter, yearFilter, monthFilter, minAmount, maxAmount } = options;
  const min = minAmount ? parseFloat(minAmount) : null;
  const max = maxAmount ? parseFloat(maxAmount) : null;

  return invoices.filter((invoice) => {
    const matchesSearch = 
      invoice.invoiceNumber.toLowerCase().includes(searchQuery.toLowerCase()) || 
      invoice.company.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesCompany = companyFilter === "all" || invoice.company === companyFilter;
    const matchesYear = yearFilter === "all" || invoice.year === yearFilter;
    const matchesMonth = monthFilter === "all" || invoice.month === monthFilter;
    const matchesMin = min === null || invoice.amount >= min;
    const matchesMax = max === null || invoice.amount <= max;
    
    return matchesSearch && matchesCompany && matchesYear && matchesMonth && matchesMin && matchesMax;
  });
}

export type SortKey = "invoiceNumber" | "company" | "month" | "year" | "amount" | "day";
export type SortDir = "asc" | "desc";

export function sortInvoices(
  invoices: Invoice[],
  sortKey: SortKey | null,
  sortDir: SortDir
): Invoice[] {
  if (!sortKey) return invoices;
  
  return [...invoices].sort((a, b) => {
    let aVal = a[sortKey as keyof Invoice] ?? "";
    let bVal = b[sortKey as keyof Invoice] ?? "";
    if (sortKey === "amount") { 
      aVal = Number(aVal); 
      bVal = Number(bVal); 
    }
    if (aVal < bVal) return sortDir === "asc" ? -1 : 1;
    if (aVal > bVal) return sortDir === "asc" ? 1 : -1;
    return 0;
  });
}

export function getUniqueInvoices(invoices: Invoice[]): Invoice[] {
  return invoices.filter(inv => !inv.isDuplicate);
}

export function calculateTotalAmount(invoices: Invoice[]): number {
  return invoices.reduce((sum, inv) => sum + (inv.amount || 0), 0);
}

export function hasActiveFilters(options: InvoiceFilterOptions, sortKey: SortKey | null): boolean {
  return Boolean(
    options.searchQuery || 
    options.companyFilter !== "all" || 
    options.yearFilter !== "all" || 
    options.monthFilter !== "all" || 
    options.minAmount || 
    options.maxAmount || 
    sortKey !== null
  );
}
