
import { ServiceReport, Issue, Attachment, PartEntry } from '../types';

export const generateHTML = (report: ServiceReport): string => {
  const logoUrl = "https://qtrypzzcjebvfcihiynt.supabase.co/storage/v1/object/public/base44-prod/public/6942d9eb36db1e00f69ccffb/ffd8b423f_xovr-logo.png";

  const css = `
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #1e293b; background: #f8fafc; padding: 20px; }
    .container { max-width: 900px; margin: 0 auto; background: white; border-radius: 12px; box-shadow: 0 1px 3px rgba(0,0,0,0.1); overflow: hidden; }
    .header { background: #262626; color: white; padding: 30px; border-bottom: 4px solid #B91C1C; }
    .logo { height: 60px; margin-bottom: 15px; }
    .header h1 { font-size: 24px; margin-bottom: 5px; }
    .header p { opacity: 0.9; font-size: 14px; }
    .meta-section { display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 20px; padding: 20px 30px; background: #f8fafc; border-bottom: 1px solid #e2e8f0; }
    .meta-item { }
    .meta-item label { font-size: 11px; text-transform: uppercase; letter-spacing: 0.5px; color: #64748b; display: block; margin-bottom: 4px; }
    .meta-item span { font-weight: 600; color: #1e293b; }
    .summary { padding: 20px 30px; border-bottom: 1px solid #e2e8f0; }
    .summary h3 { font-size: 14px; text-transform: uppercase; letter-spacing: 0.5px; color: #64748b; margin-bottom: 10px; }
    .summary p { color: #475569; font-size: 14px; white-space: pre-wrap; }
    .issues { padding: 20px 30px; }
    .issues > h3 { font-size: 14px; text-transform: uppercase; letter-spacing: 0.5px; color: #64748b; margin-bottom: 20px; }
    .issue { border: 1px solid #e2e8f0; border-radius: 8px; margin-bottom: 20px; overflow: hidden; page-break-inside: avoid; }
    .issue-header { background: #f8fafc; padding: 15px; display: flex; align-items: center; gap: 10px; border-bottom: 1px solid #e2e8f0; }
    .issue-number { background: #1e293b; color: white; font-size: 11px; font-weight: 600; padding: 2px 8px; border-radius: 4px; }
    .issue-title { font-weight: 600; flex: 1; font-size: 14px; }
    .badge { font-size: 11px; padding: 2px 8px; border-radius: 4px; font-weight: 500; }
    .badge.resolved { background: #dcfce7; color: #166534; }
    .badge.unresolved { background: #fef3c7; color: #92400e; }
    .issue-meta { padding: 10px 15px; background: #fafafa; border-bottom: 1px solid #f1f5f9; }
    .category { font-size: 12px; color: #64748b; font-weight: 500; text-transform: uppercase; }
    .section { padding: 15px; border-top: 1px solid #f1f5f9; }
    .issue-meta + .section { border-top: none; }
    .section h4 { font-size: 13px; font-weight: 600; color: #475569; margin-bottom: 10px; }
    .section p { color: #64748b; font-size: 14px; margin-bottom: 8px; white-space: pre-wrap; }
    .section ol { padding-left: 20px; }
    .section ul { padding-left: 20px; }
    .section li { margin-bottom: 8px; color: #475569; font-size: 13px; }
    .section table { width: 100%; border-collapse: collapse; font-size: 13px; }
    .section th, .section td { text-align: left; padding: 8px 12px; border-bottom: 1px solid #e2e8f0; }
    .section th { background: #f8fafc; font-weight: 600; color: #64748b; }
    .section.warning { background: #fef3c7; }
    .section.follow-up { background: #dbeafe; }
    .photos { display: grid; grid-template-columns: repeat(auto-fill, minmax(180px, 1fr)); gap: 10px; margin-top: 8px; margin-bottom: 8px; }
    .photo-item { border: 1px solid #e2e8f0; border-radius: 6px; overflow: hidden; background: white; }
    .photo-item img { width: 100%; height: 140px; object-fit: cover; display: block; }
    .photo-title { font-weight: 600; color: #1e293b; padding: 8px 12px 0 12px; margin: 0; font-size: 12px; }
    .caption { color: #64748b; padding: 4px 12px 8px 12px; margin: 0; font-size: 11px; }
    .footer { padding: 20px 30px; background: #f8fafc; text-align: center; font-size: 12px; color: #64748b; border-top: 1px solid #e2e8f0; }
    .parts-global { margin-top: 30px; padding: 0 30px 30px 30px; }
    .parts-global h3 { font-size: 14px; text-transform: uppercase; letter-spacing: 0.5px; color: #64748b; margin-bottom: 15px; }
    @media print { body { background: white; padding: 0; } .container { box-shadow: none; max-width: 100%; } .issue { page-break-inside: avoid; } }
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
                        <img src="${a.data || a.url || ''}" alt="${a.fileName || 'Image'}" />
                        ${a.caption ? `<p class="caption">${a.caption}</p>` : ''}
                    </div>
                `;
            } else {
                return `
                    <div class="photo-item" style="display:flex; align-items:center; justify-content:center; height:140px; background:#f9f9f9; color:#666; font-size:12px; padding:10px; text-align:center;">
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
        <div class="section">
          <h4>Parts / Consumables</h4>
          <table>
            <tr><th>Part #</th><th>Qty</th><th>Description</th><th>Notes</th></tr>
            ${parts.map(p => `
              <tr>
                <td>${p.partNumber || '-'}</td>
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
    
    // Filters for specific fields
    const getFieldPhotos = (ref: string) => atts.filter(a => a.bucket === 'issue_photos' && a.fieldRef === ref);
    // Fallback for legacy general issue photos or drag-dropped without specific field
    const getGeneralPhotos = () => atts.filter(a => a.bucket === 'issue_photos' && !a.fieldRef);
    
    // Filter for other media buckets (Media Tab in modal)
    const getBucketPhotos = (bucket: string) => atts.filter(a => a.bucket === bucket);
    
    const otherMediaBuckets = ['created_media', 'received_media', 'wechat', 'old_backup', 'new_backup', 'other'];
    const hasOtherMedia = atts.some(a => otherMediaBuckets.includes(a.bucket));
    
    return `
    <div class="issue">
      <div class="issue-header">
        <span class="issue-number">#${index + 1}</span>
        <span class="issue-title">${issue.title || 'Untitled Issue'}</span>
        <span class="badge ${isResolved ? 'resolved' : 'unresolved'}">
          ${isResolved ? 'Resolved' : 'Unresolved'}
        </span>
      </div>
      <div class="issue-meta">
        <span class="category">${issue.category || 'General'}</span>
        ${issue.urgency && !isResolved ? `<span style="float:right; font-size:11px; font-weight:bold; color:#b91c1c;">Priority: ${issue.urgency}</span>` : ''}
      </div>
      
      <div class="section">
        <h4>Problem Description</h4>
        ${renderAttachments(getFieldPhotos('issueTitle'))}
        
        <p>${issue.description || 'No description provided.'}</p>
        ${renderAttachments(getFieldPhotos('description'))}
        
        ${/* Render general photos that aren't tied to a specific field */ ''}
        ${renderAttachments(getGeneralPhotos())}

        ${issue.troubleshootingSteps && issue.troubleshootingSteps.length > 0 ? `
           <div style="margin-top: 15px;">
             <strong>Troubleshooting Steps Taken:</strong>
             <ol style="margin-top:5px;">
               ${issue.troubleshootingSteps.map(s => `
                 <li>
                    ${s.text}
                    ${renderAttachments(getFieldPhotos(s.id))}
                 </li>
               `).join('')}
             </ol>
           </div>
        ` : ''}
      </div>

      ${isResolved ? `
        <div class="section" style="background:#f8fafc;">
          <h4>Resolution</h4>
          ${issue.solutionSummary ? `
             <div style="margin-bottom: 12px;">
               <p><strong>Summary:</strong> ${issue.solutionSummary}</p>
               ${renderAttachments(getFieldPhotos('solutionSummary'))}
             </div>
          ` : ''}
          
          <div style="margin-bottom: 12px;">
            <p><strong>Root Cause:</strong> ${issue.rootCause || 'Not recorded'}</p>
            ${renderAttachments(getFieldPhotos('rootCause'))}
          </div>

          <div style="margin-bottom: 12px;">
            <p><strong>Fix Applied:</strong> ${issue.fixApplied || 'Not recorded'}</p>
            ${renderAttachments(getFieldPhotos('fixApplied'))}
          </div>
          
          ${issue.verifiedBy ? `
              <div style="margin-bottom: 12px;">
                  <p><strong>Verified By:</strong> ${issue.verifiedBy}</p>
                  ${renderAttachments(getFieldPhotos('verifiedBy'))}
              </div>
          ` : ''}

          ${issue.notes ? `
              <div style="margin-bottom: 12px;">
                  <p><strong>Notes:</strong> ${issue.notes}</p>
                  ${renderAttachments(getFieldPhotos('notes'))}
              </div>
          ` : ''}
        </div>
      ` : ''}
      
      ${/* Show Proposed Fixes if unresolved or if they exist with photos */ !isResolved && issue.proposedFixes && issue.proposedFixes.length > 0 ? `
          <div class="section">
             <h4>Proposed Fixes</h4>
             <ul>
               ${issue.proposedFixes.map(f => `
                 <li>
                    ${f.text}
                    ${renderAttachments(getFieldPhotos(f.id))}
                 </li>
               `).join('')}
             </ul>
          </div>
      ` : ''}

      ${renderPartsTable(issue.parts)}
      
      ${/* Render other buckets if they exist */ hasOtherMedia ? `
        <div class="section">
            <h4>Attached Media</h4>
            ${otherMediaBuckets.map(b => {
                const photos = getBucketPhotos(b);
                if (photos.length === 0) return '';
                const titleMap: Record<string, string> = {
                    'created_media': 'Created Media',
                    'received_media': 'Received Media',
                    'wechat': 'WeChat Screenshots',
                    'old_backup': 'Old Machine Backup',
                    'new_backup': 'New Machine Backup',
                    'other': 'Other Files'
                };
                return `
                    <div style="margin-bottom: 15px;">
                        <h5 style="font-size: 12px; color: #64748b; margin-bottom: 5px; text-transform: uppercase;">${titleMap[b] || b}</h5>
                        ${renderAttachments(photos)}
                    </div>
                `;
            }).join('')}
        </div>
      ` : ''}
      
      ${issue.followUpRequired ? `
        <div class="section follow-up">
           <h4>Follow-up Required</h4>
           <p>This issue has been flagged for further attention from the office.</p>
        </div>
      ` : ''}
    </div>
  `};

  return `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Service Report - ${report.customer?.companyName || 'XOVR Tools'}</title>
  <style>${css}</style>
</head>
<body>
  <div class="container">
    <div class="header">
      <img src="${logoUrl}" alt="XOVR Tools Logo" class="logo" />
      <h1>Service Report</h1>
      <p>${report.customer?.companyName || ''} • ${report.machine?.modelNumber || 'Unknown Model'}</p>
    </div>
    
    <div class="meta-section">
      <div class="meta-item">
        <label>Technician</label>
        <span>${report.technicianName}</span>
      </div>
      <div class="meta-item">
        <label>Date</label>
        <span>${report.arrivalDate}</span>
      </div>
      <div class="meta-item">
        <label>Customer Contact</label>
        <span>${report.customer?.contactPerson || 'N/A'}</span>
      </div>
      <div class="meta-item">
        <label>Machine Serial</label>
        <span>${report.machine?.serialNumber || 'N/A'}</span>
      </div>
      <div class="meta-item">
        <label>Report ID</label>
        <span>${report.reportId || 'DRAFT'}</span>
      </div>
    </div>
    
    ${report.summary ? `
      <div class="summary">
        <h3>Summary / Reason for Visit</h3>
        <p>${report.summary}</p>
        ${renderAttachments(report.attachments, a => a.bucket === 'summary')}
      </div>
    ` : ''}
    
    <div class="issues">
      <h3>Issues (${report.issues?.length || 0})</h3>
      ${(report.issues || []).map((issue, idx) => renderIssue(issue, idx)).join('')}
    </div>

    ${report.parts && report.parts.length > 0 ? `
      <div class="parts-global">
        <h3>General Parts Used (Not tied to specific issues)</h3>
        <table>
            <tr><th>Part #</th><th>Qty</th><th>Description</th><th>Notes</th></tr>
            ${report.parts.map(p => `
              <tr>
                <td>${p.partNumber || '-'}</td>
                <td>${p.quantity}</td>
                <td>${p.description}</td>
                <td>${p.notes || ''}</td>
              </tr>
            `).join('')}
        </table>
      </div>
    ` : ''}

    <div class="footer">
      Generated on ${new Date().toLocaleDateString()} at ${new Date().toLocaleTimeString()} by XOVR Tools Service Pro
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
**Date:** ${report.arrivalDate || ''}

## Machine
* Model: ${report.machine?.modelNumber || ''}
* Serial: ${report.machine?.serialNumber || ''}
* Controller: ${report.machine?.controllerType || ''}

## Summary
${report.summary || ''}

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
