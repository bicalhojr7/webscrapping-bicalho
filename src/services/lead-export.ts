import * as XLSX from "xlsx";
import type { LeadRecord } from "../domain/lead.js";
import { normalizeBrazilPhone } from "../domain/phone.js";

export function buildLeadXlsx(leads: LeadRecord[]): Buffer {
  const rows = leads.map((lead) => ({
    "Empresa": lead.companyName,
    "Telefone": normalizeBrazilPhone(lead.phoneNumber)
  }));

  const worksheet = XLSX.utils.json_to_sheet(rows);
  
  // Largura das colunas no excel para ficar confortavel
  worksheet["!cols"] = [
    { wch: 45 }, 
    { wch: 18 }  
  ];

  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, "Lista Leads");

  // Escreve diretamente pra Buffer Binário do .xlsx
  return XLSX.write(workbook, { bookType: "xlsx", type: "buffer" });
}
