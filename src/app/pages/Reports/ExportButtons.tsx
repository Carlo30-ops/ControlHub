import { Download, FileSpreadsheet, FileText } from "lucide-react";
import { Button } from "../../components/ui/button";
import { Invoice } from "../../../shared/types";
import { buildCSV } from "./utils";
import * as XLSX from "xlsx";
import { format as formatDate } from "date-fns";
import { toast } from "sonner";

interface ExportButtonsProps {
  filteredInvoices: Invoice[];
  totalAmount: number;
  settings: any;
}

export function ExportButtons({ filteredInvoices, totalAmount, settings }: ExportButtonsProps) {
  const handleExportCSV = async () => {
    try {
      const csvContent = buildCSV(filteredInvoices, settings.columns);
      if (window.electronAPI?.exportFile) {
        const res = await window.electronAPI.exportFile({
          defaultFilename: `Reporte_Auditoria_COTU_${formatDate(new Date(), "yyyyMMdd")}.csv`,
          content: csvContent,
          filters: [{ name: "Archivo CSV", extensions: ["csv"] }],
        });
        if (res.success) toast.success("Reporte CSV exportado con éxito");
      } else {
        const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
        const url = URL.createObjectURL(blob);
        const link = document.createElement("a");
        link.setAttribute("href", url);
        link.setAttribute("download", `Reporte_Auditoria_COTU_${formatDate(new Date(), "yyyyMMdd")}.csv`);
        link.style.visibility = 'hidden';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        toast.success("CSV descargado");
      }
    } catch (err) {
      toast.error("Error al exportar CSV");
    }
  };

  const handleExportExcel = async () => {
    try {
      const data = filteredInvoices.map((inv) => ({
        "N° Factura": inv.invoiceNumber,
        "Compañía": inv.company,
        "Día": inv.date.split("/")[0],
        "Mes": inv.month,
        "Año": inv.year,
        "Fecha": inv.date,
        "Detalle": inv.detail,
        "Monto (COP)": inv.amount,
        "Ruta": inv.filePath,
      }));

      const worksheet = XLSX.utils.json_to_sheet(data);
      const workbook = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(workbook, worksheet, "Resultados");
      
      const excelBuffer = XLSX.write(workbook, { bookType: "xlsx", type: "array" });
      
      if (window.electronAPI?.exportFile) {
        const res = await window.electronAPI.exportFile({
          defaultFilename: `Reporte_Auditoria_COTU_${formatDate(new Date(), "yyyyMMdd")}.xlsx`,
          content: new Uint8Array(excelBuffer),
          filters: [{ name: "Libro de Excel", extensions: ["xlsx"] }],
        });
        if (res.success) toast.success("Reporte Excel exportado con éxito");
      } else {
        XLSX.writeFile(workbook, `Reporte_Auditoria_COTU_${formatDate(new Date(), "yyyyMMdd")}.xlsx`);
        toast.success("Excel descargado");
      }
    } catch (err) {
      toast.error("Error al exportar Excel");
    }
  };

  return (
    <>
      <Button variant="outline" size="sm" onClick={handleExportCSV}>
        <FileSpreadsheet className="w-4 h-4 mr-2" />
        CSV
      </Button>
      <Button variant="outline" size="sm" onClick={handleExportExcel}>
        <Download className="w-4 h-4 mr-2" />
        Excel
      </Button>
    </>
  );
}
