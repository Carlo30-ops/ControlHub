import { Search, Filter, X } from "lucide-react";
import { Input } from "../../components/ui/input";
import { Button } from "../../components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "../../components/ui/select";
import { MONTHS_ORDER } from "../../constants";

interface FiltersPanelProps {
  searchQuery: string;
  setSearchQuery: (value: string) => void;
  companyFilter: string;
  setCompanyFilter: (value: string) => void;
  yearFilter: string;
  setYearFilter: (value: string) => void;
  monthFilter: string;
  setMonthFilter: (value: string) => void;
  minAmount: string;
  setMinAmount: (value: string) => void;
  maxAmount: string;
  setMaxAmount: (value: string) => void;
  clearFilters: () => void;
  companies: string[];
  years: string[];
  hasFilters: boolean;
}

export function FiltersPanel({
  searchQuery,
  setSearchQuery,
  companyFilter,
  setCompanyFilter,
  yearFilter,
  setYearFilter,
  monthFilter,
  setMonthFilter,
  minAmount,
  setMinAmount,
  maxAmount,
  setMaxAmount,
  clearFilters,
  companies,
  years,
  hasFilters,
}: FiltersPanelProps) {
  return (
    <div className="space-y-4">
      <div className="flex gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="Buscar por N° factura, compañía..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10"
          />
        </div>
        {hasFilters && (
          <Button variant="ghost" size="sm" onClick={clearFilters}>
            <X className="w-4 h-4 mr-2" />
            Limpiar
          </Button>
        )}
      </div>

      <div className="flex flex-wrap gap-2">
        <Select value={companyFilter} onValueChange={setCompanyFilter}>
          <SelectTrigger className="w-[180px]">
            <SelectValue placeholder="Compañía" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todas</SelectItem>
            {companies.map((c) => (
              <SelectItem key={c} value={c}>
                {c}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select value={yearFilter} onValueChange={setYearFilter}>
          <SelectTrigger className="w-[120px]">
            <SelectValue placeholder="Año" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos</SelectItem>
            {years.map((y) => (
              <SelectItem key={y} value={y}>
                {y}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select value={monthFilter} onValueChange={setMonthFilter}>
          <SelectTrigger className="w-[140px]">
            <SelectValue placeholder="Mes" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos</SelectItem>
            {MONTHS_ORDER.map((m) => (
              <SelectItem key={m} value={m}>
                {m}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Input
          placeholder="Monto mín"
          value={minAmount}
          onChange={(e) => setMinAmount(e.target.value)}
          className="w-[120px]"
          type="number"
        />

        <Input
          placeholder="Monto máx"
          value={maxAmount}
          onChange={(e) => setMaxAmount(e.target.value)}
          className="w-[120px]"
          type="number"
        />
      </div>
    </div>
  );
}
