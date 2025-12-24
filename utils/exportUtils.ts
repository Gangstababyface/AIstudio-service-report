import { ServiceReport, Issue, Attachment } from '../types';

export const generateHTML = (report: ServiceReport): string => {
  const css = `
    body { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; color: #333; line-height: 1.6; max-width: 900px; margin: 0 auto; padding: 20px; }
    h1 { color: #0056b3; border-bottom: 2px solid #0056b3; padding-bottom: 10px; }
    h2 { background: #f4f4f4; padding: 10px; border-left: 5px solid #0056b3; margin-top: 30px; }
    h3 { color: #444; margin-top: 20px; }
    .grid { display: grid; grid-template-columns: 1fr 1fr; gap: 20px; margin-bottom: 20px; }
    .label { font-weight: bold; color: #555; }
    .value { margin-bottom: 5px; }
    .issue-card { border: 1px solid #ddd; padding: 15px; border-radius: 5px; margin-bottom: 20px; }
    .issue-header { display: flex; justify-content: space-between; align-items: center; border-bottom: 1px solid #eee; padding-bottom: 10px; margin-bottom: 10px; }
    .badge { padding: 4px 8px; border-radius: 4px; font-size: 0.8em; font-weight: bold; }
    .resolved { background: #d4edda; color: #155724; }
    .unresolved { background: #f8d7da; color: #721c24; }
    .img-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(150px, 1fr)); gap: 10px; margin-top: 10px; }
    .img-container { text-align: center; }
    img { max-width: 100%; border: 1px solid #ccc; padding: 2px; }
    .file-block { border: 1px dashed #ccc; padding: 10px; text-align: center; font-size: 0.8em; background: #f9f9f9; word-break: break-all; }
    table { width: 100%; border-collapse: collapse; margin-top: 10px; }
    th, td { border: 1px solid #ddd; padding: 8px; text-align: left; }
    th { background-color: #f2f2f2; }
  `;

  // Helper to render attachment images OR file blocks
  const renderAttachments = (attachments: Attachment[], filterFn?: (a: Attachment) => boolean) => {
    if (!attachments) return '';
    // Safely filter: remove nulls/undefined first, then apply filterFn if exists
    const relevant = attachments.filter(a => !!a && (filterFn ? filterFn(a) : true));
    if (relevant.length === 0) return '';
    
    // Check if web-safe image (jpeg, png, gif, webp)
    const isWebImage = (type: string) => /image\/(jpeg|png|gif|webp|bmp)/i.test(type);

    return `
      <div class="img-grid">
        ${relevant.map(a => {
            if (isWebImage(a.fileType) || (a.data && a.data.startsWith('data:image/'))) {
                // Render as Image
                return `
                    <div class="img-container">
                        <img src="${a.data || a.url || ''}" alt="${a.fileName || 'Image'}" loading="lazy" />
                        <div style="font-size:0.7em; color:#777;">${a.fileName || ''}</div>
                    </div>
                `;
            } else {
                // Render as File Block
                return `
                    <div class="file-block">
                        <strong>FILE:</strong><br/>
                        ${a.fileName || 'Unknown File'}
                    </div>
                `;
            }
        }).join('')}
      </div>
    `;
  };

  const renderIssue = (issue: Issue) => {
    if (!issue) return '';
    const atts = issue.attachments || [];
    return `
    <div class="issue-card">
      <div class="issue-header">
        <h3>${issue.title || 'Untitled'} <span style="font-size:0.8em; color:#666">(${issue.category || 'General'})</span></h3>
        <span class="badge ${issue.resolved ? 'resolved' : 'unresolved'}">${issue.resolved ? 'RESOLVED' : 'OPEN'}</span>
      </div>
      
      <p><strong>Observation:</strong><br/>${issue.description || ''}</p>
      ${renderAttachments(atts, a => a.bucket === 'issue_photos' && a.fieldRef === 'description')}
      
      ${atts.length > 0 ? `
         <div style="margin-top:10px;">
           <strong>Other Issue Media:</strong>
           ${renderAttachments(atts, a => !a.fieldRef)}
         </div>
      ` : ''}

      ${issue.resolved ? `
        <div style="background:#f9f9f9; padding:10px; margin-top:10px;">
          <h4>Resolution</h4>
          <p><strong>Root Cause:</strong> ${issue.rootCause || ''}</p>
          ${renderAttachments(atts, a => a.fieldRef === 'rootCause')}
          
          <p><strong>Fix Applied:</strong> ${issue.fixApplied || ''}</p>
          ${renderAttachments(atts, a => a.fieldRef === 'fixApplied')}
          
          <p><strong>Verified By:</strong> ${issue.verifiedBy || ''}</p>
          <p><strong>Summary:</strong> ${issue.solutionSummary || ''}</p>
        </div>
      ` : ''}
    </div>
  `};

  return `
    <!DOCTYPE html>
    <html>
    <head><title>Service Report ${report.reportId || 'Draft'}</title><style>${css}</style></head>
    <body>
      <h1>Service Report: ${report.reportId || 'DRAFT'}</h1>
      
      <div class="grid">
        <div>
          <div class="label">Customer</div>
          <div class="value">${report.customer?.companyName || ''}</div>
          <div class="value">${report.customer?.address || ''}</div>
          <div class="value">${report.customer?.contactPerson || ''} (${report.customer?.phone || ''})</div>
        </div>
        <div>
          <div class="label">Service Details</div>
          <div class="value"><strong>Tech:</strong> ${report.technicianName || ''}</div>
          <div class="value"><strong>Date:</strong> ${report.arrivalDate || ''}</div>
          <div class="value"><strong>Status:</strong> ${report.status || 'DRAFT'}</div>
        </div>
      </div>

      <h2>Machine Information</h2>
      <div class="grid">
        <div><span class="label">Model:</span> ${report.machine?.modelNumber || ''}</div>
        <div><span class="label">Serial:</span> ${report.machine?.serialNumber || ''}</div>
        <div><span class="label">Controller:</span> ${report.machine?.controllerType || ''}</div>
      </div>
      ${renderAttachments(report.attachments || [], a => a.fieldRef === 'machineNameplate')}

      <h2>Summary / Reason for Visit</h2>
      <p>${report.summary || ''}</p>
      ${renderAttachments(report.attachments || [], a => a.bucket === 'summary' && a.fieldRef !== 'machineNameplate')}

      <h2>Issues & Resolutions</h2>
      ${(report.issues || []).length === 0 ? '<p>No issues recorded.</p>' : (report.issues || []).filter(i => !!i).map(renderIssue).join('')}

      <h2>Parts Used</h2>
      ${(report.parts || []).length > 0 ? `
        <table>
          <thead><tr><th>Part #</th><th>Description</th><th>Qty</th><th>Notes</th></tr></thead>
          <tbody>
            ${report.parts.filter(p => !!p).map(p => `<tr><td>${p.partNumber || ''}</td><td>${p.description || ''}</td><td>${p.quantity || ''}</td><td>${p.notes || ''}</td></tr>`).join('')}
          </tbody>
        </table>
      ` : '<p>No parts recorded.</p>'}
      
      <hr/>
      <p style="text-align:center; font-size:0.8em; color:#999;">Generated by XOVR Tools — Service Report Pro</p>
    </body>
    </html>
  `;
};

export const generateMarkdown = (report: ServiceReport): string => {
  return `# Service Report ${report.reportId || 'DRAFT'}
**Technician:** ${report.technicianName || ''}
**Customer:** ${report.customer?.companyName || ''}
**Date:** ${report.arrivalDate || ''}

## Machine
* Model: ${report.machine?.modelNumber || ''}
* Serial: ${report.machine?.serialNumber || ''}
* Controller: ${report.machine?.controllerType || ''}

## Summary
${report.summary || ''}

## Issues
${(report.issues || []).filter(i => !!i).map(i => `
### ${i.title || 'Untitled'} (${i.resolved ? 'RESOLVED' : 'OPEN'})
${i.description || ''}
${i.resolved ? `**Resolution:** ${i.solutionSummary || ''}` : ''}
`).join('\n')}
`;
};