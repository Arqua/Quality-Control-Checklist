import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';
import * as FileSystem from 'expo-file-system/legacy';
import { ChecklistInstance, ChecklistResult, Project, Template, TemplateItem } from '@/types/database';

export async function generateChecklistPDF(
  checklist: ChecklistInstance,
  results: ChecklistResult[],
  templateItems: TemplateItem[],
  project: Project,
  template: Template
): Promise<string> {
  const resultRows = results
    .map(
      (r) => {
        const item = templateItems.find((ti) => ti.id === r.template_item_id);
        return `
    <tr>
      <td style="border: 1px solid #ddd; padding: 8px; text-align: left;">${item?.description_text || 'Unknown'}</td>
      <td style="border: 1px solid #ddd; padding: 8px; text-align: center;">${r.status === 'PASS' ? '✓' : '✗'}</td>
      <td style="border: 1px solid #ddd; padding: 8px;">${r.comments || '-'}</td>
    </tr>
  `;
      }
    )
    .join('');

  const html = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <title>Checklist Report</title>
      <style>
        body {
          font-family: Arial, sans-serif;
          color: #333;
          margin: 20px;
        }
        h1 { color: #004E89; margin-bottom: 5px; }
        h2 { color: #004E89; font-size: 16px; margin-top: 15px; margin-bottom: 5px; }
        .header { border-bottom: 2px solid #FF6B35; padding-bottom: 10px; margin-bottom: 20px; }
        .info-grid {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 15px;
          margin-bottom: 20px;
          font-size: 14px;
        }
        .info-item { }
        .info-label { font-weight: bold; color: #004E89; }
        table {
          width: 100%;
          border-collapse: collapse;
          margin-top: 10px;
          font-size: 13px;
        }
        th {
          background-color: #004E89;
          color: white;
          padding: 8px;
          text-align: left;
          font-weight: bold;
        }
        td {
          border: 1px solid #ddd;
          padding: 8px;
        }
        .pass { background-color: #e8f5e9; }
        .fail { background-color: #ffebee; }
        .summary {
          margin-top: 20px;
          padding: 10px;
          background-color: #f5f5f5;
          border-left: 4px solid #FF6B35;
        }
      </style>
    </head>
    <body>
      <div class="header">
        <h1>QC Checklist Report</h1>
        <p>Construction Site Inspection</p>
      </div>

      <div class="info-grid">
        <div class="info-item">
          <div class="info-label">Project:</div>
          <div>${project.name}</div>
        </div>
        <div class="info-item">
          <div class="info-label">Location:</div>
          <div>${project.location}</div>
        </div>
        <div class="info-item">
          <div class="info-label">Template:</div>
          <div>${template.name}</div>
        </div>
        <div class="info-item">
          <div class="info-label">Division:</div>
          <div>${template.division}</div>
        </div>
        <div class="info-item">
          <div class="info-label">Date:</div>
          <div>${new Date(checklist.created_at).toLocaleDateString()}</div>
        </div>
        <div class="info-item">
          <div class="info-label">Status:</div>
          <div>${checklist.status === 'COMPLETED' ? 'Completed' : 'In Progress'}</div>
        </div>
      </div>

      <h2>Inspection Results</h2>
      <table>
        <thead>
          <tr>
            <th>Item</th>
            <th>Status</th>
            <th>Comments</th>
          </tr>
        </thead>
        <tbody>
          ${resultRows}
        </tbody>
      </table>

      <div class="summary">
        <h2 style="margin-top: 0;">Summary</h2>
        <p>Total Items: ${results.length}</p>
        <p>Passed: ${results.filter((r) => r.status === 'PASS').length}</p>
        <p>Failed: ${results.filter((r) => r.status === 'FAIL').length}</p>
        <p style="margin-bottom: 0;">
          ${
            results.filter((r) => r.status === 'FAIL').length === 0
              ? '<strong style="color: green;">✓ All items passed</strong>'
              : '<strong style="color: red;">✗ Some items require attention</strong>'
          }
        </p>
      </div>

      <div style="margin-top: 30px; padding-top: 20px; border-top: 1px solid #ddd; font-size: 12px; color: #666;">
        <p>Generated on ${new Date().toLocaleString()}</p>
      </div>
    </body>
    </html>
  `;

  try {
    const { uri } = await Print.printToFileAsync({
      html,
      base64: false,
    });
    return uri;
  } catch (error) {
    console.error('PDF generation failed:', error);
    throw new Error('Failed to generate PDF');
  }
}

export async function shareChecklist(pdfUri: string, checklistName: string) {
  try {
    const fileName = `${checklistName}-${Date.now()}.pdf`;
    const newUri = `${FileSystem.documentDirectory}${fileName}`;
    await FileSystem.copyAsync({ from: pdfUri, to: newUri });

    await Sharing.shareAsync(newUri, {
      mimeType: 'application/pdf',
      dialogTitle: `Share ${checklistName}`,
      UTI: 'com.adobe.pdf',
    });
  } catch (error) {
    console.error('Sharing failed:', error);
    throw new Error('Failed to share PDF');
  }
}
