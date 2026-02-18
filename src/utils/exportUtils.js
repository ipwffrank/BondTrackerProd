import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import * as XLSX from 'xlsx';

// Export to PDF
export function exportToPDF(data, columns, filename, title) {
  const doc = new jsPDF();
  
  // Add title
  doc.setFontSize(16);
  doc.text(title, 14, 15);
  
  // Add date
  doc.setFontSize(10);
  doc.text(`Generated: ${new Date().toLocaleDateString()}`, 14, 22);
  
  // Prepare table data
  const tableData = data.map(item => 
    columns.map(col => {
      const value = item[col.field];
      if (value instanceof Date) {
        return value.toLocaleDateString();
      }
      if (value === null || value === undefined) {
        return '-';
      }
      return String(value);
    })
  );
  
  // Generate table using autoTable
  autoTable(doc, {
    head: [columns.map(col => col.header)],
    body: tableData,
    startY: 30,
    styles: { fontSize: 8, cellPadding: 3 },
    headStyles: { fillColor: [99, 102, 241], textColor: 255, fontStyle: 'bold' },
    alternateRowStyles: { fillColor: [245, 247, 250] },
    margin: { top: 30 }
  });
  
  // Save
  doc.save(`${filename}.pdf`);
}

// Export to Excel
export function exportToExcel(data, columns, filename, sheetName) {
  // Prepare data with headers
  const worksheetData = [
    columns.map(col => col.header),
    ...data.map(item => 
      columns.map(col => {
        const value = item[col.field];
        if (value instanceof Date) {
          return value.toLocaleDateString();
        }
        if (value === null || value === undefined) {
          return '-';
        }
        return value;
      })
    )
  ];
  
  // Create worksheet
  const worksheet = XLSX.utils.aoa_to_sheet(worksheetData);
  
  // Set column widths
  worksheet['!cols'] = columns.map(() => ({ wch: 15 }));
  
  // Create workbook
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, sheetName || 'Data');
  
  // Save
  XLSX.writeFile(workbook, `${filename}.xlsx`);
}
