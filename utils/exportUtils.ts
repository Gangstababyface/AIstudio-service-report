
import { ServiceReport, Issue, Attachment, PartEntry } from '../types';
import JSZip from 'jszip';

export const generateHTML = (report: ServiceReport): string => {
  const logoUrl = "https://qtrypzzcjebvfcihiynt.supabase.co/storage/v1/object/public/base44-prod/public/6942d9eb36db1e00f69ccffb/ffd8b423f_xovr-logo.png";

  const css = `
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { font-family: 'Helvetica Neue', Arial, sans-serif; line-height: 1.5; color: #333; background: #eef2f6; padding: 20px; -webkit-print-color-adjust: exact; }
    .container { max-width: 900px; margin: 0 auto; background: white; box-shadow: 0 4px 6px rgba(0,0,0,0.1); }
    
    /* Brand Header */
    .header { background: #111827; color: white; padding: 40px; display: flex; justify-content: space-between; align-items: center; border-bottom: 5px solid #dc2626; }
    .header-info h1 { font-size: 28px; font-weight: 800; letter-spacing: -0.5px; text-transform: uppercase; margin: 0; }
    .header-info p { color: #9ca3af; font-size: 14px; margin-top: 5px; font-weight: 500; }
    .logo { height: 50px; background: white; padding: 5px; border-radius: 4px; }

    /* Meta Grid */
    .meta-section { display: grid; grid-template-columns: repeat(3, 1fr); gap: 1px; background: #e5e7eb; border-bottom: 1px solid #e5e7eb; }
    .meta-item { background: white; padding: 12px 20px; }
    .meta-item label { font-size: 10px; text-transform: uppercase; letter-spacing: 1px; color: #6b7280; display: block; margin-bottom: 4px; font-weight: 700; }
    .meta-item span { font-size: 13px; font-weight: 600; color: #111827; display: block; }

    /* Summary Box */
    .summary { padding: 30px; background: #fff; border-bottom: 1px solid #e5e7eb; }
    .section-title { font-size: 13px; text-transform: uppercase; letter-spacing: 1px; color: #dc2626; font-weight: 800; margin-bottom: 15px; border-bottom: 2px solid #f3f4f6; padding-bottom: 8px; }
    .summary p { color: #374151; font-size: 14px; white-space: pre-wrap; }

    /* Recommendations Grid */
    .rec-grid { display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 20px; margin-top: 15px; }
    .rec-item label { display: block; font-size: 10px; font-weight: 700; color: #6b7280; text-transform: uppercase; margin-bottom: 5px; }
    .rec-item div { font-size: 13px; color: #1f2937; background: #f9fafb; padding: 10px; border-radius: 4px; border: 1px solid #e5e7eb; min-height: 60px; }

    /* Lists (Tools/Nameplates) */
    .lists-container { display: grid; grid-template-columns: 1fr 1fr; gap: 20px; margin-top: 20px; }
    .list-box h4 { font-size: 11px; font-weight: 700; color: #4b5563; text-transform: uppercase; margin-bottom: 8px; border-bottom: 1px solid #e5e7eb; padding-bottom: 4px; }
    .list-box ul { list-style: none; padding: 0; }
    .list-box li { font-size: 13px; color: #374151; padding: 4px 0; border-bottom: 1px dashed #f3f4f6; }
    .list-box li:last-child { border-bottom: none; }

    /* Issues */
    .issues { padding: 30px; background: #f9fafb; }
    .issue { background: white; border: 1px solid #e5e7eb; margin-bottom: 25px; box-shadow: 0 1px 2px rgba(0,0,0,0.05); page-break-inside: avoid; }
    
    .issue-header { background: #f3f4f6; padding: 15px 20px; display: flex; align-items: center; gap: 12px; border-bottom: 1px solid #e5e7eb; }
    .issue-number { background: #1f2937; color: white; font-size: 12px; font-weight: 700; padding: 3px 8px; border-radius: 2px; }
    .issue-title { font-weight: 700; flex: 1; font-size: 15px; color: #111827; }
    .badge { font-size: 11px; padding: 4px 10px; border-radius: 12px; font-weight: 700; text-transform: uppercase; }
    .badge.resolved { background: #ecfdf5; color: #047857; border: 1px solid #a7f3d0; }
    .badge.unresolved { background: #fef2f2; color: #b91c1c; border: 1px solid #fecaca; }

    .issue-content { padding: 20px; }
    .sub-section { margin-bottom: 20px; }
    .sub-header { font-size: 11px; font-weight: 700; color: #6b7280; text-transform: uppercase; margin-bottom: 8px; }
    .text-block { font-size: 14px; color: #4b5563; line-height: 1.6; }

    .resolution-box { background: #f0fdf4; border: 1px solid #bbf7d0; padding: 15px; border-radius: 4px; margin-top: 15px; }
    .resolution-title { color: #166534; font-weight: 700; font-size: 12px; text-transform: uppercase; margin-bottom: 8px; }

    /* Tables */
    table { width: 100%; border-collapse: collapse; font-size: 13px; margin-top: 10px; }
    th { background: #1f2937; color: white; text-align: left; padding: 10px; font-weight: 600; text-transform: uppercase; font-size: 11px; }
    td { padding: 10px; border-bottom: 1px solid #e5e7eb; color: #374151; }
    tr:last-child td { border-bottom: none; }

    /* Photos */
    .photos { display: grid; grid-template-columns: repeat(auto-fill, minmax(180px, 1fr)); gap: 10px; margin-top: 10px; }
    .photo-item { border: 1px solid #e5e7eb; background: white; padding: 4px; }
    .photo-item img { width: 100%; height: 140px; object-fit: cover; display: block; }
    .caption { font-size: 11px; color: #6b7280; padding: 4px; text-align: center; }

    .footer { background: #111827; color: #9ca3af; padding: 20px; text-align: center; font-size: 11px; }
    
    @media print { 
      body { background: white; padding: 0; } 
      .container { box-shadow: none; max-width: 100%; }
      .header { -webkit-print-color-adjust: exact; background: #111827 !important; color: white !important; }
      .issue-number, th { background: #1f2937 !important; color: white !important; }
      .rec-item div { border: 1px solid #ccc !important; }
    }
  `;

  // Helper to render attachment images
  const renderAttachments = (attachments: Attachment[], filterFn?: (a: Attachment) => boolean) => {
    if (!attachments) return '';
    const relevant = attachments.filter(a => !!a && (filterFn ? filterFn(a) : true));
    if (relevant.length === 0) return '';
    
    const isWebImage = (type: string) => /image\/(jpeg|png|gif|webp|bmp)/i.test(type);

    return `
      <div class="photos">
        ${relevant.map(a => {
            if (isWebImage(a.fileType) || (a.data && a.data.startsWith('data:image/'))) {
                return `
                    <div class="photo-item">
                        <img src="${a.data || a.url || ''}" alt="${a.fileName}" />
                        ${a.caption ? `<div class="caption">${a.caption}</div>` : ''}
                    </div>
                `;
            } else {
                return `
                    <div class="photo-item" style="display:flex; align-items:center; justify-content:center; height:140px; background:#f3f4f6; color:#6b7280; font-size:11px; text-align:center;">
                        <div>
                           <strong>FILE</strong><br/>${a.fileName}
                        </div>
                    </div>
                `;
            }
        }).join('')}
      </div>
    `;
  };

  const renderPartsTable = (parts: PartEntry[]) => {
      if (!parts || parts.length === 0) return '';
      return `
        <div class="sub-section">
          <div class="sub-header">Parts / Consumables</div>
          <table>
            <tr><th>Part #</th><th>Qty</th><th>Description</th><th>Notes</th></tr>
            ${parts.map(p => `
              <tr>
                <td style="font-family: monospace; font-weight:600;">${p.partNumber || '-'}</td>
                <td>${p.quantity}</td>
                <td>${p.description}</td>
                <td>${p.notes || ''}</td>
              </tr>
            `).join('')}
          </table>
        </div>
      `;
  };

  const renderIssue = (issue: Issue, index: number) => {
    if (!issue) return '';
    const atts = issue.attachments || [];
    const isResolved = issue.resolved;
    
    const getFieldPhotos = (ref: string) => atts.filter(a => a.bucket === 'issue_photos' && a.fieldRef === ref);
    const getGeneralPhotos = () => atts.filter(a => a.bucket === 'issue_photos' && !a.fieldRef);
    
    return `
    <div class="issue">
      <div class="issue-header">
        <span class="issue-number">#${index + 1}</span>
        <span class="issue-title">${issue.title || 'Untitled Issue'}</span>
        <span class="badge ${isResolved ? 'resolved' : 'unresolved'}">
          ${isResolved ? 'Resolved' : 'Open Issue'}
        </span>
      </div>
      
      <div class="issue-content">
        <div class="sub-section">
          <div class="sub-header">Problem Description <span style="font-weight:400; color:#9ca3af;">— ${issue.category}</span></div>
          <div class="text-block">${issue.description || 'No description provided.'}</div>
          ${renderAttachments(getFieldPhotos('issueTitle'))}
          ${renderAttachments(getFieldPhotos('description'))}
          ${renderAttachments(getGeneralPhotos())}
        </div>

        ${issue.troubleshootingSteps && issue.troubleshootingSteps.length > 0 ? `
           <div class="sub-section">
             <div class="sub-header">Troubleshooting Steps</div>
             <ul style="padding-left: 20px; font-size: 14px; color: #4b5563;">
               ${issue.troubleshootingSteps.map(s => `
                 <li style="margin-bottom:4px;">
                    ${s.text}
                    ${renderAttachments(getFieldPhotos(s.id))}
                 </li>
               `).join('')}
             </ul>
           </div>
        ` : ''}

        ${isResolved ? `
          <div class="resolution-box">
            <div class="resolution-title">Resolution</div>
            
            ${issue.solutionSummary ? `
               <div style="margin-bottom: 12px; font-style: italic; color: #1f2937;">
                 ${issue.solutionSummary}
               </div>
            ` : ''}
            
            <div style="font-size: 13px; display: grid; grid-template-columns: 100px 1fr; gap: 8px; margin-bottom: 8px;">
               <div style="font-weight: 700;">Root Cause:</div>
               <div>${issue.rootCause || '-'}</div>
            </div>
            ${renderAttachments(getFieldPhotos('rootCause'))}

            <div style="font-size: 13px; display: grid; grid-template-columns: 100px 1fr; gap: 8px; margin-bottom: 8px;">
               <div style="font-weight: 700;">Fix Applied:</div>
               <div>${issue.fixApplied || '-'}</div>
            </div>
            ${renderAttachments(getFieldPhotos('fixApplied'))}
          </div>
        ` : ''}

        ${renderPartsTable(issue.parts)}
      </div>
    </div>
  `};

  const hasRecommendations = report.designSuggestion.current || report.designSuggestion.problem || report.designSuggestion.change;
  const hasTools = (report.toolsBought && report.toolsBought.length > 0) || (report.toolsUsed && report.toolsUsed.length > 0);
  const hasNameplates = report.newNameplates && report.newNameplates.length > 0;

  return `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Service Report - ${report.customer?.companyName || 'XOVR'}</title>
  <style>${css}</style>
</head>
<body>
  <div class="container">
    <div class="header">
      <div class="header-info">
        <h1>Service Report</h1>
        <p>${report.customer?.companyName || 'Unknown Customer'} • ${report.machine?.modelNumber || 'Machine'}</p>
      </div>
      <img src="${logoUrl}" alt="XOVR Logo" class="logo" />
    </div>
    
    <div class="meta-section">
      <div class="meta-item">
        <label>Technician</label>
        <span>${report.technicianName}</span>
      </div>
      <div class="meta-item">
        <label>Arrival Date</label>
        <span>${report.arrivalDate}</span>
      </div>
      <div class="meta-item">
        <label>Departure Date</label>
        <span>${report.departureDate || 'N/A'}</span>
      </div>
      <div class="meta-item">
        <label>Report ID</label>
        <span style="font-family: monospace;">${report.reportId || 'DRAFT'}</span>
      </div>
      <div class="meta-item">
        <label>Customer Contact</label>
        <span>${report.customer?.contactPerson || 'N/A'}</span>
      </div>
      <div class="meta-item">
        <label>Service Type</label>
        <span>${report.serviceTypes.join(', ') || 'General Service'}</span>
      </div>
      <div class="meta-item">
        <label>Machine Serial</label>
        <span style="font-family: monospace;">${report.machine?.serialNumber || 'N/A'}</span>
      </div>
      <div class="meta-item">
        <label>Controller</label>
        <span>${report.machine?.controllerType || 'N/A'}</span>
      </div>
      <div class="meta-item">
        <label>Software Ver</label>
        <span>${report.machine?.softwareVersion || 'N/A'}</span>
      </div>
    </div>
    
    ${report.summary ? `
      <div class="summary">
        <div class="section-title">Visit Summary</div>
        <p>${report.summary}</p>
        ${renderAttachments(report.attachments, a => a.bucket === 'summary')}
        
        ${hasRecommendations ? `
            <div class="section-title" style="margin-top:20px; color:#4b5563; border-color:#e5e7eb;">Design & Process Recommendations</div>
            <div class="rec-grid">
                <div class="rec-item">
                    <label>Current Implementation</label>
                    <div>${report.designSuggestion.current || '-'}</div>
                </div>
                <div class="rec-item">
                    <label>Problem Identified</label>
                    <div>${report.designSuggestion.problem || '-'}</div>
                </div>
                <div class="rec-item">
                    <label>Recommended Change</label>
                    <div>${report.designSuggestion.change || '-'}</div>
                </div>
            </div>
        ` : ''}

        ${(hasTools || hasNameplates) ? `
            <div class="lists-container">
                ${(report.toolsBought && report.toolsBought.length > 0) ? `
                    <div class="list-box">
                        <h4>Tools & Supplies Bought</h4>
                        <ul>
                            ${report.toolsBought.map(t => `<li>${t.text}</li>`).join('')}
                        </ul>
                    </div>
                ` : ''}
                
                ${(report.toolsUsed && report.toolsUsed.length > 0) ? `
                    <div class="list-box">
                        <h4>Tools & Consumables Used</h4>
                        <ul>
                            ${report.toolsUsed.map(t => `<li>${t.text}</li>`).join('')}
                        </ul>
                    </div>
                ` : ''}

                ${(report.newNameplates && report.newNameplates.length > 0) ? `
                    <div class="list-box">
                        <h4>Nameplates Needed</h4>
                        <ul>
                            ${report.newNameplates.map(t => `<li>${t.text}</li>`).join('')}
                        </ul>
                    </div>
                ` : ''}
            </div>
        ` : ''}
      </div>
    ` : ''}
    
    <div class="issues">
      <div class="section-title" style="color: #4b5563; border-color: #e5e7eb;">Reported Issues (${report.issues?.length || 0})</div>
      ${(report.issues || []).map((issue, idx) => renderIssue(issue, idx)).join('')}
    </div>

    ${report.parts && report.parts.length > 0 ? `
      <div class="summary">
        <div class="section-title">General Parts List</div>
        <table>
            <tr><th>Part #</th><th>Qty</th><th>Description</th><th>Notes</th></tr>
            ${report.parts.map(p => `
              <tr>
                <td style="font-family: monospace; font-weight:600;">${p.partNumber || '-'}</td>
                <td>${p.quantity}</td>
                <td>${p.description}</td>
                <td>${p.notes || ''}</td>
              </tr>
            `).join('')}
        </table>
      </div>
    ` : ''}

    <div class="footer">
      Generated by XOVR CNC Service Pro • ${new Date().toLocaleDateString()}
    </div>
  </div>
</body>
</html>
  `;
};

export const generateMarkdown = (report: ServiceReport): string => {
  return `# Service Report ${report.reportId || 'DRAFT'}
**Technician:** ${report.technicianName || ''}
**Customer:** ${report.customer?.companyName || ''}
**Date:** ${report.arrivalDate || ''} to ${report.departureDate || ''}

## Machine
* Model: ${report.machine?.modelNumber || ''}
* Serial: ${report.machine?.serialNumber || ''}
* Controller: ${report.machine?.controllerType || ''}
* Software: ${report.machine?.softwareVersion || ''}

## Summary
${report.summary || ''}

## Recommendations
* **Current:** ${report.designSuggestion.current}
* **Problem:** ${report.designSuggestion.problem}
* **Change:** ${report.designSuggestion.change}

## Additional Items
* **Tools Bought:** ${report.toolsBought.map(t => t.text).join(', ')}
* **Tools Used:** ${report.toolsUsed.map(t => t.text).join(', ')}
* **Nameplates Needed:** ${report.newNameplates.map(t => t.text).join(', ')}

## Issues
${(report.issues || []).filter(i => !!i).map((i, idx) => `
### ${idx + 1}. ${i.title || 'Untitled'} (${i.resolved ? 'RESOLVED' : 'OPEN'})
**Category:** ${i.category}
**Urgency:** ${i.urgency}

${i.description || ''}

${i.resolved ? `
**Resolution:**
* Root Cause: ${i.rootCause}
* Fix: ${i.fixApplied}
* Verified By: ${i.verifiedBy || 'N/A'}
* Notes: ${i.notes || ''}
* Summary: ${i.solutionSummary}
` : ''}

${i.troubleshootingSteps && i.troubleshootingSteps.length > 0 ? `
**Troubleshooting Steps:**
${i.troubleshootingSteps.map(s => `* ${s.text}`).join('\n')}
` : ''}
`).join('\n')}
`;
};

export const generateZipPackage = async (report: ServiceReport): Promise<Blob> => {
    const zip = new JSZip();
    
    // 1. Metadata & Data
    const { _syncState, ...cleanReport } = report;
    zip.file(`report_${report.reportId || 'draft'}.json`, JSON.stringify(cleanReport, null, 2));
    zip.file(`report_${report.reportId || 'draft'}.html`, generateHTML(report));
    zip.file(`report_${report.reportId || 'draft'}.md`, generateMarkdown(report));
    
    // 2. Images folder
    const imgFolder = zip.folder("attachments");
    
    // Collect all attachments from top-level and issues
    const allAttachments = [
        ...(report.attachments || []),
        ...(report.issues || []).flatMap(i => i.attachments || [])
    ];
    
    // Deduplicate by ID to avoid saving same file twice if referenced multiple times
    const uniqueAttachments = Array.from(new Map(allAttachments.map(item => [item.id, item])).values());

    uniqueAttachments.forEach(att => {
        if (att.data) {
            // Remove header "data:image/jpeg;base64," if present
            const parts = att.data.split(',');
            const base64Data = parts.length > 1 ? parts[1] : parts[0];
            
            if (base64Data) {
                // Try to determine extension safely
                let ext = "bin";
                if (att.fileType === "image/jpeg" || att.fileType === "image/jpg") ext = "jpg";
                else if (att.fileType === "image/png") ext = "png";
                else if (att.fileName.includes(".")) ext = att.fileName.split('.').pop() || "bin";
                
                // Sanitize filename
                const safeName = att.fileName.replace(/[^a-z0-9.]/gi, '_');
                const filename = `${att.id.substring(0,8)}_${safeName}`;
                
                imgFolder?.file(filename, base64Data, {base64: true});
            }
        }
    });
    
    return await zip.generateAsync({type: "blob"});
}
