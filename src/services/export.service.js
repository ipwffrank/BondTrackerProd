import * as XLSX from 'xlsx';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { logAudit } from './audit.service';

// Excel/Sheets will evaluate any cell that starts with = + - @ \t \r as a
// formula on open. A client name like "=WEBSERVICE(...)" in an exported XLSX
// could exfiltrate data from whoever opens the file. Prefix these with a
// single quote so the cell is treated as literal text.
function sanitizeCell(value) {
  if (value == null) return value;
  if (typeof value !== 'string') return value;
  return /^[=+\-@\t\r]/.test(value) ? `'${value}` : value;
}

export const exportService = {
  // Internal helper to log export audit events (non-blocking)
  _logExport(orgId, { action, format, recordCount, userId, userName, userEmail }) {
    if (!orgId) return;
    logAudit(orgId, {
      action,
      details: `Exported ${recordCount} records in ${format} format`,
      userId: userId || '',
      userName: userName || '',
      userEmail: userEmail || '',
    }).catch(() => {});
  },

  // Export Activities to Excel
  exportActivitiesToExcel(activities, organizationName, auditContext) {
    try {
      const data = activities.map(a => ({
        'Date': a.createdAt?.toDate ? a.createdAt.toDate().toLocaleDateString() : (a.createdAt ? new Date(a.createdAt).toLocaleDateString() : ''),
        'Client': sanitizeCell(a.clientName || ''),
        'Bond': sanitizeCell(a.bondName || a.ticker || ''),
        'ISIN': sanitizeCell(a.isin || ''),
        'Direction': a.direction || '',
        'Size (MM)': a.size || 0,
        'Currency': a.currency || 'USD',
        'Price': a.price || '',
        'Added By': sanitizeCell(a.addedByName || a.addedBy || ''),
        'Notes': sanitizeCell(a.notes || '')
      }));

      const worksheet = XLSX.utils.json_to_sheet(data);
      const workbook = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(workbook, worksheet, 'Activities');

      worksheet['!cols'] = [
        { wch: 12 },
        { wch: 25 },
        { wch: 20 },
        { wch: 15 },
        { wch: 10 },
        { wch: 10 },
        { wch: 10 },
        { wch: 10 },
        { wch: 20 },
        { wch: 30 }
      ];

      const filename = `${organizationName}_Activities_${new Date().toISOString().split('T')[0]}.xlsx`;
      XLSX.writeFile(workbook, filename);

      if (auditContext?.orgId) {
        this._logExport(auditContext.orgId, {
          action: 'export_activities_excel', format: 'Excel',
          recordCount: activities.length, ...auditContext,
        });
      }
    } catch (error) {
      alert('Failed to export Excel file: ' + error.message);
    }
  },

  // Export Activities to PDF
  exportActivitiesToPDF(activities, organizationName, auditContext) {
    try {
      const doc = new jsPDF('landscape');
      
      doc.setFontSize(18);
      doc.text(`${organizationName} - Activities Report`, 14, 15);
      
      doc.setFontSize(10);
      doc.text(`Generated: ${new Date().toLocaleString()}`, 14, 22);
      
      const tableData = activities.map(a => [
        a.createdAt ? new Date(a.createdAt).toLocaleDateString() : '',
        a.clientName || '',
        a.bondName || a.ticker || '',
        a.direction || '',
        `${a.size || 0} MM`,
        a.currency || 'USD',
        a.price || '',
        a.addedByName || a.addedBy || ''
      ]);

      autoTable(doc, {
        startY: 28,
        head: [['Date', 'Client', 'Bond', 'Direction', 'Size', 'Currency', 'Price', 'Added By']],
        body: tableData,
        theme: 'grid',
        styles: { fontSize: 8, cellPadding: 2 },
        headStyles: { fillColor: [99, 102, 241], fontStyle: 'bold' },
        columnStyles: {
          0: { cellWidth: 25 },
          1: { cellWidth: 40 },
          2: { cellWidth: 35 },
          3: { cellWidth: 25 },
          4: { cellWidth: 20 },
          5: { cellWidth: 20 },
          6: { cellWidth: 20 },
          7: { cellWidth: 35 }
        }
      });

      const filename = `${organizationName}_Activities_${new Date().toISOString().split('T')[0]}.pdf`;
      doc.save(filename);

      if (auditContext?.orgId) {
        this._logExport(auditContext.orgId, {
          action: 'export_activities_pdf', format: 'PDF',
          recordCount: activities.length, ...auditContext,
        });
      }
    } catch (error) {
      alert('Failed to export PDF file: ' + error.message);
    }
  },

  // Export Clients to Excel
  exportClientsToExcel(clients, organizationName, auditContext) {
    try {
      const data = clients.map(c => ({
        'Client Name': sanitizeCell(c.name || ''),
        'Type': sanitizeCell(c.type || ''),
        'Region': sanitizeCell(c.region || ''),
        'Sales Coverage': sanitizeCell(c.salesCoverage || ''),
        'Contact Email': sanitizeCell(c.contactEmail || ''),
        'Contact Phone': sanitizeCell(c.contactPhone || ''),
        'Notes': sanitizeCell(c.notes || ''),
        'Added By': sanitizeCell(c.addedByName || c.addedBy || ''),
        'Date Added': c.createdAt?.toDate ? c.createdAt.toDate().toLocaleDateString() : (c.createdAt ? new Date(c.createdAt).toLocaleDateString() : '')
      }));

      const worksheet = XLSX.utils.json_to_sheet(data);
      const workbook = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(workbook, worksheet, 'Clients');

      worksheet['!cols'] = [
        { wch: 30 },
        { wch: 15 },
        { wch: 12 },
        { wch: 20 },
        { wch: 25 },
        { wch: 18 },
        { wch: 40 },
        { wch: 20 },
        { wch: 12 }
      ];

      const filename = `${organizationName}_Clients_${new Date().toISOString().split('T')[0]}.xlsx`;
      XLSX.writeFile(workbook, filename);

      if (auditContext?.orgId) {
        this._logExport(auditContext.orgId, {
          action: 'export_clients_excel', format: 'Excel',
          recordCount: clients.length, ...auditContext,
        });
      }
    } catch (error) {
      alert('Failed to export Excel file: ' + error.message);
    }
  },

  // Export Clients to PDF
  exportClientsToPDF(clients, organizationName, auditContext) {
    try {
      const doc = new jsPDF('landscape');
      
      doc.setFontSize(18);
      doc.text(`${organizationName} - Clients Report`, 14, 15);
      
      doc.setFontSize(10);
      doc.text(`Generated: ${new Date().toLocaleString()}`, 14, 22);
      doc.text(`Total Clients: ${clients.length}`, 14, 28);
      
      const tableData = clients.map(c => [
        c.name || '',
        c.type || '',
        c.region || '',
        c.salesCoverage || '',
        c.contactEmail || '',
        c.contactPhone || ''
      ]);

      autoTable(doc, {
        startY: 35,
        head: [['Client Name', 'Type', 'Region', 'Sales Coverage', 'Email', 'Phone']],
        body: tableData,
        theme: 'grid',
        styles: { fontSize: 9, cellPadding: 3 },
        headStyles: { fillColor: [16, 185, 129], fontStyle: 'bold' },
        columnStyles: {
          0: { cellWidth: 50 },
          1: { cellWidth: 35 },
          2: { cellWidth: 25 },
          3: { cellWidth: 40 },
          4: { cellWidth: 50 },
          5: { cellWidth: 35 }
        }
      });

      const filename = `${organizationName}_Clients_${new Date().toISOString().split('T')[0]}.pdf`;
      doc.save(filename);

      if (auditContext?.orgId) {
        this._logExport(auditContext.orgId, {
          action: 'export_clients_pdf', format: 'PDF',
          recordCount: clients.length, ...auditContext,
        });
      }
    } catch (error) {
      alert('Failed to export PDF file: ' + error.message);
    }
  },

  // Export Analytics to PDF
  exportAnalyticsToPDF(analytics, organizationName, dateRange, auditContext) {
    try {
      const doc = new jsPDF();
      
      doc.setFontSize(20);
      doc.text(`${organizationName}`, 14, 15);
      doc.setFontSize(16);
      doc.text('Analytics Report', 14, 23);
      
      doc.setFontSize(10);
      doc.text(`Report Period: ${dateRange}`, 14, 30);
      doc.text(`Generated: ${new Date().toLocaleString()}`, 14, 36);
      
      doc.setFontSize(14);
      doc.text('Key Metrics', 14, 46);
      
      doc.setFontSize(11);
      let yPos = 54;
      doc.text(`Total Activities: ${analytics.totalActivities}`, 20, yPos);
      yPos += 7;
      doc.text(`Total Volume: $${analytics.totalVolume}MM`, 20, yPos);
      yPos += 7;
      doc.text(`Average Deal Size: $${analytics.avgDealSize}MM`, 20, yPos);
      yPos += 7;
      doc.text(`Active Clients: ${analytics.topClients.length}`, 20, yPos);
      
      yPos += 12;
      doc.setFontSize(14);
      doc.text('Volume by Direction', 14, yPos);
      yPos += 8;
      
      doc.setFontSize(11);
      doc.text(`BUY: $${analytics.volumeByDirection.BUY.toFixed(2)}MM (${analytics.countByDirection.BUY} activities)`, 20, yPos);
      yPos += 7;
      doc.text(`SELL: $${analytics.volumeByDirection.SELL.toFixed(2)}MM (${analytics.countByDirection.SELL} activities)`, 20, yPos);
      yPos += 7;
      doc.text(`TWO-WAY: $${analytics.volumeByDirection['TWO-WAY'].toFixed(2)}MM (${analytics.countByDirection['TWO-WAY']} activities)`, 20, yPos);
      
      yPos += 15;
      doc.setFontSize(14);
      doc.text('Top Clients by Volume', 14, yPos);
      
      const clientTableData = analytics.topClients.slice(0, 10).map((c, idx) => [
        `${idx + 1}`,
        c.name,
        `$${c.volume.toFixed(2)}MM`
      ]);

      autoTable(doc, {
        startY: yPos + 5,
        head: [['Rank', 'Client', 'Volume']],
        body: clientTableData,
        theme: 'grid',
        styles: { fontSize: 10, cellPadding: 3 },
        headStyles: { fillColor: [147, 51, 234], fontStyle: 'bold' },
        columnStyles: {
          0: { cellWidth: 20, halign: 'center' },
          1: { cellWidth: 120 },
          2: { cellWidth: 40, halign: 'right' }
        }
      });

      const filename = `${organizationName}_Analytics_${new Date().toISOString().split('T')[0]}.pdf`;
      doc.save(filename);

      if (auditContext?.orgId) {
        this._logExport(auditContext.orgId, {
          action: 'export_analytics_pdf', format: 'PDF',
          recordCount: analytics.totalActivities || 0, ...auditContext,
        });
      }
    } catch (error) {
      alert('Failed to export PDF file: ' + error.message);
    }
  },

  // Export Analytics Summary to Excel
  exportAnalyticsToExcel(analytics, organizationName, dateRange, auditContext) {
    try {
      const workbook = XLSX.utils.book_new();
      
      const summaryData = [
        ['Analytics Report'],
        ['Organization', organizationName],
        ['Report Period', dateRange],
        ['Generated', new Date().toLocaleString()],
        [],
        ['Key Metrics'],
        ['Total Activities', analytics.totalActivities],
        ['Total Volume (MM)', analytics.totalVolume],
        ['Average Deal Size (MM)', analytics.avgDealSize],
        ['Active Clients', analytics.topClients.length],
        [],
        ['Volume by Direction'],
        ['Direction', 'Volume (MM)', 'Activity Count'],
        ['BUY', analytics.volumeByDirection.BUY.toFixed(2), analytics.countByDirection.BUY],
        ['SELL', analytics.volumeByDirection.SELL.toFixed(2), analytics.countByDirection.SELL],
        ['TWO-WAY', analytics.volumeByDirection['TWO-WAY'].toFixed(2), analytics.countByDirection['TWO-WAY']]
      ];
      
      const summarySheet = XLSX.utils.aoa_to_sheet(summaryData);
      XLSX.utils.book_append_sheet(workbook, summarySheet, 'Summary');
      
      const clientsData = analytics.topClients.map((c, idx) => ({
        'Rank': idx + 1,
        'Client': c.name,
        'Volume (MM)': c.volume.toFixed(2)
      }));

      const clientsSheet = XLSX.utils.json_to_sheet(clientsData);
      XLSX.utils.book_append_sheet(workbook, clientsSheet, 'Top Clients');
      
      if (analytics.timeline && analytics.timeline.length > 0) {
        const timelineData = analytics.timeline.map(t => ({
          'Date': t.date,
          'Activities': t.count
        }));
        
        const timelineSheet = XLSX.utils.json_to_sheet(timelineData);
        XLSX.utils.book_append_sheet(workbook, timelineSheet, 'Timeline');
      }

      const filename = `${organizationName}_Analytics_${new Date().toISOString().split('T')[0]}.xlsx`;
      XLSX.writeFile(workbook, filename);

      if (auditContext?.orgId) {
        this._logExport(auditContext.orgId, {
          action: 'export_analytics_excel', format: 'Excel',
          recordCount: analytics.totalActivities || 0, ...auditContext,
        });
      }
    } catch (error) {
      alert('Failed to export Excel file: ' + error.message);
    }
  },

  // Export Pipeline to Excel
  exportPipelineToExcel(issues, organizationName, auditContext) {
    try {
      const data = issues.map(issue => ({
        'Issuer': sanitizeCell(issue.issuer || ''),
        'Bond Type': sanitizeCell(issue.bondType || ''),
        'Expected Size (MM)': issue.expectedSize || 0,
        'Currency': issue.currency || 'USD',
        'Maturity': sanitizeCell(issue.maturity || ''),
        'Coupon (%)': issue.coupon || '',
        'Status': issue.status || '',
        'Bookrunners': sanitizeCell(issue.bookrunners?.join(', ') || ''),
        'Pricing Date': sanitizeCell(issue.pricingDate || ''),
        'Notes': sanitizeCell(issue.notes || ''),
        'Added By': sanitizeCell(issue.addedByName || issue.addedBy || ''),
        'Date Added': issue.createdAt?.toDate ? issue.createdAt.toDate().toLocaleDateString() : (issue.createdAt ? new Date(issue.createdAt).toLocaleDateString() : '')
      }));

      const worksheet = XLSX.utils.json_to_sheet(data);
      const workbook = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(workbook, worksheet, 'Pipeline');

      worksheet['!cols'] = [
        { wch: 30 },
        { wch: 15 },
        { wch: 15 },
        { wch: 10 },
        { wch: 12 },
        { wch: 10 },
        { wch: 15 },
        { wch: 40 },
        { wch: 15 },
        { wch: 30 },
        { wch: 20 },
        { wch: 12 }
      ];

      const filename = `${organizationName}_Pipeline_${new Date().toISOString().split('T')[0]}.xlsx`;
      XLSX.writeFile(workbook, filename);

      if (auditContext?.orgId) {
        this._logExport(auditContext.orgId, {
          action: 'export_pipeline_issues_excel', format: 'Excel',
          recordCount: issues.length, ...auditContext,
        });
      }
    } catch (error) {
      alert('Failed to export Excel file: ' + error.message);
    }
  },

  // Export Pipeline to PDF
  exportPipelineToPDF(issues, organizationName, auditContext) {
    try {
      const doc = new jsPDF('landscape');
      
      doc.setFontSize(18);
      doc.text(`${organizationName} - Pipeline Report`, 14, 15);
      
      doc.setFontSize(10);
      doc.text(`Generated: ${new Date().toLocaleString()}`, 14, 22);
      doc.text(`Total Issues: ${issues.length}`, 14, 28);
      
      const tableData = issues.map(issue => [
        issue.issuer || '',
        issue.bondType || '',
        `${issue.expectedSize || 0} MM`,
        issue.currency || 'USD',
        issue.maturity || '',
        issue.status || '',
        issue.bookrunners?.slice(0, 2).join(', ') || ''
      ]);

      autoTable(doc, {
        startY: 35,
        head: [['Issuer', 'Type', 'Size', 'Currency', 'Maturity', 'Status', 'Bookrunners']],
        body: tableData,
        theme: 'grid',
        styles: { fontSize: 8, cellPadding: 2 },
        headStyles: { fillColor: [99, 102, 241], fontStyle: 'bold' },
        columnStyles: {
          0: { cellWidth: 45 },
          1: { cellWidth: 30 },
          2: { cellWidth: 25 },
          3: { cellWidth: 20 },
          4: { cellWidth: 25 },
          5: { cellWidth: 30 },
          6: { cellWidth: 50 }
        }
      });

      const filename = `${organizationName}_Pipeline_${new Date().toISOString().split('T')[0]}.pdf`;
      doc.save(filename);

      if (auditContext?.orgId) {
        this._logExport(auditContext.orgId, {
          action: 'export_pipeline_issues_pdf', format: 'PDF',
          recordCount: issues.length, ...auditContext,
        });
      }
    } catch (error) {
      alert('Failed to export PDF file: ' + error.message);
    }
  }
};
