
import React, { useState, useEffect, useCallback, useRef } from 'react';
import { ServiceReport, Issue, Customer, Attachment, JOB_TYPES, ISSUE_CATEGORIES, PartEntry } from '../types';
import { saveLocalReport, getLocalReport } from '../services/db';
import { getNextReportId, fetchCustomerDirectory, saveReportFiles, uploadFileToWorkDrive } from '../services/workDriveService';
import { generateHTML, generateMarkdown } from '../utils/exportUtils';
import { IssueModal } from './IssueModal';
import { analyzeImage, transcribeAudio, getCoordinatesForAddress, extractMachineInfoFromImage } from '../services/geminiService';
import { generateUUID, processFile } from '../utils/helpers';

interface EditorProps {
  reportId?: string; // If editing existing
  userEmail: string;
  userName: string;
  onClose: () => void;
}

const emptyReport = (email: string, name: string): ServiceReport => ({
  id: generateUUID(),
  status: 'DRAFT',
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
  createdBy: email,
  technicianName: name,
  arrivalDate: new Date().toISOString().split('T')[0],
  departureDate: '',
  serviceTypes: [],
  customer: { id: '', companyName: '', contactPerson: '', position: '', address: '', phone: '' },
  machine: { serialNumber: '', modelNumber: '', machineType: '', controllerType: '', softwareVersion: '' },
  summary: '',
  attachments: [],
  issues: [],
  parts: [],
  followUpRequired: false,
  designSuggestion: { current: '', problem: '', change: '' },
  internalSuggestion: '',
  toolsBought: [],
  toolsUsed: [],
  newNameplates: [],
  _syncState: { lastSaved: new Date().toISOString(), dirty: false, uploadQueue: [], version: 1, isOffline: false }
});

export const ReportEditor: React.FC<EditorProps> = ({ reportId, userEmail, userName, onClose }) => {
  const [report, setReport] = useState<ServiceReport>(emptyReport(userEmail, userName));
  const [loading, setLoading] = useState(true);
  const [statusMsg, setStatusMsg] = useState('');
  const [isError, setIsError] = useState(false);
  const [saving, setSaving] = useState(false);
  const [scanningNameplate, setScanningNameplate] = useState(false);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [activeIssueId, setActiveIssueId] = useState<string | null>(null);
  
  // Audio state
  const [recording, setRecording] = useState(false);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);

  // Refs
  const nameplateInputRef = useRef<HTMLInputElement>(null);

  // Sections open state
  const [sections, setSections] = useState({
    tech: true,
    service: true,
    customer: true,
    machine: true,
    summary: true,
    issues: true,
    parts: false,
    other: false
  });

  // Load Data
  useEffect(() => {
    const init = async () => {
      // Load customers
      try {
        const custs = await fetchCustomerDirectory();
        setCustomers(custs);
      } catch (e) { console.error("Failed to load customers", e); }

      if (reportId) {
        const local = await getLocalReport(reportId);
        if (local) {
             // Basic structure check
             const safeReport = { ...local };
             setReport(safeReport);
        }
      }
      setLoading(false);
    };
    init();
  }, [reportId]);

  // Autosave Logic
  useEffect(() => {
    const timer = setInterval(() => {
      if (report._syncState?.dirty) {
        saveDraft(true); // silent
      }
    }, 30000); // 30s
    return () => clearInterval(timer);
  }, [report]);

  // Unsaved changes warning
  useEffect(() => {
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      if (report._syncState?.dirty) {
        e.preventDefault();
        e.returnValue = '';
      }
    };
    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [report._syncState?.dirty]);

  const saveDraft = async (silent = false) => {
    if (!silent) {
        setSaving(true);
        setStatusMsg("Saving draft...");
        setIsError(false);
    }
    
    try {
        const updated = { ...report, updatedAt: new Date().toISOString() };
        if (updated._syncState) {
            updated._syncState.dirty = false;
            updated._syncState.lastSaved = new Date().toISOString();
        }
        await saveLocalReport(updated);
        setReport(updated);
        
        // Background generation of artifacts for draft
        try {
             // Shallow sanitation for draft
             const draftReport = {
                 ...updated,
                 customer: { ...emptyReport('','').customer, ...(updated.customer || {}) },
                 machine: { ...emptyReport('','').machine, ...(updated.machine || {}) },
             };
             
             const artifacts = {
                html: generateHTML(draftReport),
                md: generateMarkdown(draftReport),
                json: JSON.stringify(draftReport, null, 2),
                manifest: JSON.stringify({ id: updated.id, version: 1 }), 
                audit: JSON.stringify([]) 
            };
            await saveReportFiles(updated, artifacts as any);
        } catch(e) {
            console.warn("Background sync failed", e);
        }
        
        if (!silent) setStatusMsg("Draft saved");
    } catch (e) {
        if (!silent) {
            setStatusMsg("Failed to save draft");
            setIsError(true);
        }
    } finally {
        if (!silent) setSaving(false);
    }
  };

  const handleChange = (field: string, value: any) => {
    setReport(prev => {
      const clone = { ...prev };
      const parts = field.split('.');
      if (parts.length === 1) (clone as any)[field] = value;
      else if (parts.length === 2) (clone as any)[parts[0]][parts[1]] = value;
      
      if (clone._syncState) clone._syncState.dirty = true;
      return clone;
    });
  };

  const toggleSection = (section: keyof typeof sections) => {
    // Save on collapse
    if (sections[section]) saveDraft(true);
    setSections(prev => ({ ...prev, [section]: !prev[section] }));
  };

  const handleCustomerSelect = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const c = customers.find(c => c.id === e.target.value);
    if (c) {
      setReport(prev => ({
        ...prev,
        customer: { ...c },
        _syncState: { ...prev._syncState, dirty: true } as any
      }));
    }
  };

  const removeAttachment = (id: string) => {
    setReport(prev => ({
        ...prev,
        attachments: (prev.attachments || []).filter(a => a.id !== id),
        _syncState: { ...prev._syncState, dirty: true } as any
    }));
  };

  const handleNameplateScan = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setScanningNameplate(true);

    const newAttachment: Attachment = {
        id: generateUUID(),
        fileName: file.name,
        fileType: file.type,
        size: file.size,
        url: URL.createObjectURL(file), // Transient
        data: undefined, // Filled below
        bucket: 'summary', 
        fieldRef: 'machineNameplate', 
        uploaded: false,
        uploading: true,
        issueId: undefined
    };

    setReport(prev => ({
        ...prev,
        attachments: [...(prev.attachments || []), newAttachment]
    }));

    try {
        // Process file (convert HEIC if needed)
        const { data, type } = await processFile(file);
        
        // Extract info from Base64
        const base64 = data.split(',')[1];
        const info = await extractMachineInfoFromImage(base64, type);
            
        setReport(prev => ({
            ...prev,
            machine: {
                ...prev.machine,
                serialNumber: info.serialNumber || prev.machine.serialNumber,
                modelNumber: info.modelNumber || prev.machine.modelNumber,
                machineType: info.machineType || prev.machine.machineType
            },
            attachments: (prev.attachments || []).map(a => a.id === newAttachment.id ? { 
                ...a, 
                uploaded: true, 
                uploading: false,
                data: data, // Store full data URI
                fileType: type // Update type to jpeg if converted
            } : a),
            _syncState: { ...prev._syncState, dirty: true } as any
        }));
        
        setScanningNameplate(false);
        if(nameplateInputRef.current) nameplateInputRef.current.value = '';
    } catch (err) {
        console.error("Scan failed", err);
        setScanningNameplate(false);
        setReport(prev => ({
            ...prev,
            attachments: (prev.attachments || []).filter(a => a.id !== newAttachment.id) // Remove if failed
        }));
    }
  };

  const handleComplete = async () => {
    // Non-blocking status update
    setSaving(true);
    setStatusMsg("Validating report data...");
    setIsError(false);
    
    try {
        let finalReport = { ...report };
        
        const template = emptyReport(finalReport.createdBy, finalReport.technicianName);
        
        finalReport.machine = {
            ...template.machine,
            ...(finalReport.machine || {})
        };
        
        finalReport.customer = {
            ...template.customer,
            ...(finalReport.customer || {})
        };

        finalReport.attachments = (finalReport.attachments || []).filter(Boolean);
        finalReport.parts = (finalReport.parts || []).filter(Boolean);
        finalReport.serviceTypes = (finalReport.serviceTypes || []).filter(Boolean);
        
        // Sanitize Issues: Deep Map
        finalReport.issues = (finalReport.issues || []).filter(Boolean).map(i => ({
            ...i,
            attachments: (i.attachments || []).filter(Boolean),
            parts: (i.parts || []).filter(Boolean),
            proposedFixes: (i.proposedFixes || []).filter(Boolean),
            troubleshootingSteps: (i.troubleshootingSteps || []).filter(Boolean)
        }));

        // --- 2. Assign ID ---
        if (!finalReport.reportId) {
           setStatusMsg("Assigning report ID...");
           const id = await getNextReportId(new Date().getFullYear());
           finalReport.reportId = id;
        }

        finalReport.status = 'COMPLETED';
        finalReport.updatedAt = new Date().toISOString();

        // --- 3. Save Local ---
        setStatusMsg("Saving locally...");
        await saveLocalReport(finalReport);
        setReport(finalReport);

        // --- 4. Generate & Export ---
        setStatusMsg("Generating documents...");
        
        // Extract sync state to keep JSON clean
        const { _syncState, ...jsonReport } = finalReport;

        let html = "", md = "";
        try {
            html = generateHTML(finalReport);
            md = generateMarkdown(finalReport);
        } catch (genErr: any) {
            console.error("Export Generation Error", genErr);
            throw new Error(`Failed to generate HTML/MD: ${genErr.message}`);
        }

        const artifacts = {
            html,
            md,
            json: JSON.stringify(jsonReport, null, 2),
            manifest: JSON.stringify({ id: finalReport.id, final: true }),
            audit: JSON.stringify([])
        };

        setStatusMsg("Uploading to WorkDrive...");
        await saveReportFiles(finalReport, artifacts as any);
        
        setStatusMsg("Done!");
        setSaving(false);
        
        // Delay close slightly so user sees success
        setTimeout(() => {
            onClose();
        }, 1000);
        
    } catch (e: any) {
        console.error("Completion Critical Failure", e);
        setSaving(false);
        setIsError(true);
        setStatusMsg(`Error: ${e.message || "Unknown completion error"}`);
    }
  };

  const startAudioRecording = async () => {
    try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        mediaRecorderRef.current = new MediaRecorder(stream);
        audioChunksRef.current = [];
        mediaRecorderRef.current.ondataavailable = (event) => audioChunksRef.current.push(event.data);
        mediaRecorderRef.current.onstop = async () => {
            const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
            setStatusMsg("Transcribing...");
            setSaving(true);
            const text = await transcribeAudio(audioBlob);
            setReport(prev => ({
                ...prev,
                summary: (prev.summary + ' ' + text).trim(),
                _syncState: { ...prev._syncState, dirty: true } as any
            }));
            setSaving(false);
            setStatusMsg("");
            stream.getTracks().forEach(t => t.stop());
        };
        mediaRecorderRef.current.start();
        setRecording(true);
    } catch (e) {
        alert("Microphone access denied or error.");
    }
  };

  const stopAudioRecording = () => {
    mediaRecorderRef.current?.stop();
    setRecording(false);
  };

  if (loading) return <div className="p-10 flex justify-center"><div className="animate-spin-slow text-4xl text-brand-600"><i className="fa-solid fa-gear"></i></div></div>;

  return (
    <div className="flex flex-col h-full bg-slate-100">
      {/* Toolbar */}
      <div className="bg-white border-b px-6 py-4 flex justify-between items-center sticky top-0 z-40 shadow-sm">
        <div className="flex items-center gap-4">
            <button onClick={onClose} className="text-slate-500 hover:text-slate-800 transition-colors">
                <i className="fa-solid fa-arrow-left mr-2"></i> Back
            </button>
            <div className="h-6 w-px bg-slate-200 mx-2 hidden sm:block"></div>
            <div className="hidden sm:block">
                <h2 className="text-lg font-bold text-slate-800 leading-none">{report.customer?.companyName || 'New Report'}</h2>
                <div className="text-xs text-slate-400 mt-1 font-mono">{report.reportId || 'DRAFT'}</div>
            </div>
        </div>
        
        <div className="flex items-center space-x-3">
            <span className={`text-xs font-semibold mr-2 ${isError ? 'text-red-600' : 'text-slate-400'}`}>
                {statusMsg}
            </span>
            <button 
                onClick={() => saveDraft()} 
                disabled={saving}
                className="bg-white border border-slate-300 text-slate-700 px-4 py-2 rounded shadow-sm hover:bg-slate-50 disabled:opacity-50 text-sm font-medium"
            >
                {saving ? '...' : 'Save Draft'}
            </button>
            <button 
                onClick={handleComplete} 
                disabled={saving}
                className="bg-brand-600 text-white px-5 py-2 rounded shadow hover:bg-brand-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center text-sm font-bold tracking-wide transition-all active:scale-95"
            >
                {saving ? <i className="fa-solid fa-circle-notch fa-spin mr-2"></i> : <i className="fa-solid fa-check-double mr-2"></i>}
                COMPLETE
            </button>
        </div>
      </div>

      <div className="flex-1 overflow-auto p-4 sm:p-8 space-y-6 max-w-6xl mx-auto w-full">
        
        {/* 1. Tech & Dates */}
        <Section title="Technician & Logistics" isOpen={sections.tech} onToggle={() => toggleSection('tech')} icon="fa-user-clock">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div>
                    <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Technician</label>
                    <div className="flex items-center bg-slate-100 border border-slate-200 rounded p-2 text-slate-700">
                        <i className="fa-solid fa-user-circle mr-2 text-slate-400"></i>
                        {report.technicianName}
                    </div>
                </div>
                <div>
                    <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Arrival Date</label>
                    <input type="date" value={report.arrivalDate} onChange={e => handleChange('arrivalDate', e.target.value)} className="block w-full rounded border-slate-300 shadow-sm focus:border-brand-500 focus:ring-brand-500 sm:text-sm" />
                </div>
                <div>
                    <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Departure (Est.)</label>
                    <input type="date" value={report.departureDate} onChange={e => handleChange('departureDate', e.target.value)} className="block w-full rounded border-slate-300 shadow-sm focus:border-brand-500 focus:ring-brand-500 sm:text-sm" />
                </div>
            </div>
        </Section>

        {/* 2. Service Type */}
        <Section title="Service Classification" isOpen={sections.service} onToggle={() => toggleSection('service')} icon="fa-tags">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                {JOB_TYPES.map(type => (
                    <label key={type} className={`flex items-center space-x-2 p-3 border rounded cursor-pointer transition-all ${report.serviceTypes.includes(type) ? 'bg-brand-50 border-brand-200 text-brand-800' : 'hover:bg-slate-50 border-slate-200'}`}>
                        <input 
                            type="checkbox" 
                            checked={report.serviceTypes.includes(type)}
                            onChange={e => {
                                const newTypes = e.target.checked 
                                    ? [...report.serviceTypes, type]
                                    : report.serviceTypes.filter(t => t !== type);
                                handleChange('serviceTypes', newTypes);
                            }}
                            className="text-brand-600 focus:ring-brand-500 rounded border-gray-300"
                        />
                        <span className="text-sm font-medium">{type}</span>
                    </label>
                ))}
            </div>
        </Section>

        {/* 3. Customer */}
        <Section title="Customer Information" isOpen={sections.customer} onToggle={() => toggleSection('customer')} icon="fa-building">
            <div className="bg-slate-50 p-4 rounded-lg border border-slate-200 mb-6">
                <label className="block text-xs font-bold text-slate-500 uppercase mb-2">Load Existing Customer</label>
                <select onChange={handleCustomerSelect} className="w-full border-slate-300 rounded shadow-sm focus:border-brand-500 focus:ring-brand-500 text-sm">
                    <option value="">-- Select from Directory --</option>
                    {customers.map(c => <option key={c.id} value={c.id}>{c.companyName}</option>)}
                </select>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <Input label="Company Name" value={report.customer?.companyName || ''} onChange={v => handleChange('customer.companyName', v)} />
                <Input label="Contact Person" value={report.customer?.contactPerson || ''} onChange={v => handleChange('customer.contactPerson', v)} />
                <Input label="Position / Title" value={report.customer?.position || ''} onChange={v => handleChange('customer.position', v)} />
                <Input label="Phone Number" value={report.customer?.phone || ''} onChange={v => handleChange('customer.phone', v)} />
                <div className="md:col-span-2">
                    <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Site Address</label>
                    <div className="flex gap-2">
                        <textarea rows={2} className="block w-full rounded border-slate-300 shadow-sm focus:border-brand-500 focus:ring-brand-500 sm:text-sm" value={report.customer?.address || ''} onChange={e => handleChange('customer.address', e.target.value)} />
                        <button onClick={async () => {
                            const coords = await getCoordinatesForAddress(report.customer?.address || '');
                            if (coords) alert(`Verified Location: ${coords.lat}, ${coords.lng}`);
                            else alert("Could not verify address");
                        }} className="px-4 bg-white border border-slate-300 rounded hover:bg-slate-50 text-slate-600" title="Verify Address with Gemini Maps"><i className="fa-solid fa-map-location-dot"></i></button>
                    </div>
                </div>
            </div>
        </Section>

        {/* 4. Machine */}
        <Section title="Machine Data" isOpen={sections.machine} onToggle={() => toggleSection('machine')} icon="fa-industry">
            <div className="flex justify-between items-center mb-6 bg-slate-50 p-3 rounded border border-slate-200">
                 <div className="text-xs text-slate-500 font-medium px-2">Ensure Serial # matches physical nameplate</div>
                 <div className="text-right">
                    <button 
                        onClick={() => nameplateInputRef.current?.click()}
                        disabled={scanningNameplate}
                        className="flex items-center text-xs font-bold uppercase tracking-wide bg-white text-brand-600 px-3 py-2 rounded border border-brand-200 hover:bg-brand-50 disabled:opacity-50 transition-colors shadow-sm"
                    >
                        {scanningNameplate ? <i className="fa-solid fa-circle-notch fa-spin mr-2"></i> : <i className="fa-solid fa-camera mr-2"></i>}
                        {scanningNameplate ? 'Analyzing...' : 'Scan Nameplate'}
                    </button>
                    <input type="file" accept="image/*" ref={nameplateInputRef} className="hidden" onChange={handleNameplateScan} />
                </div>
            </div>

            {/* Display Attached Nameplates */}
            <div className="mb-4">
                 <div className="flex flex-wrap gap-4">
                    {(report.attachments || []).filter(a => a.fieldRef === 'machineNameplate').map(att => (
                        <div key={att.id} className="relative group w-32 h-24 border border-slate-200 rounded-lg overflow-hidden shadow-sm bg-white">
                             <img src={att.data || att.url} alt="Nameplate" className="w-full h-full object-cover" />
                             <button onClick={() => removeAttachment(att.id)} className="absolute top-1 right-1 w-6 h-6 bg-red-600 text-white rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity shadow-md">
                                <i className="fa-solid fa-trash text-xs"></i>
                            </button>
                            {att.uploading && (
                                <div className="absolute inset-0 bg-white/70 flex items-center justify-center">
                                    <i className="fa-solid fa-circle-notch fa-spin text-brand-600"></i>
                                </div>
                            )}
                        </div>
                    ))}
                 </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                <Input label="Serial Number" value={report.machine?.serialNumber || ''} onChange={v => handleChange('machine.serialNumber', v)} />
                <Input label="Model Number" value={report.machine?.modelNumber || ''} onChange={v => handleChange('machine.modelNumber', v)} />
                <Input label="Machine Type" value={report.machine?.machineType || ''} onChange={v => handleChange('machine.machineType', v)} />
                <Input label="Controller Type" value={report.machine?.controllerType || ''} onChange={v => handleChange('machine.controllerType', v)} />
                <Input label="Software Version" value={report.machine?.softwareVersion || ''} onChange={v => handleChange('machine.softwareVersion', v)} />
            </div>
        </Section>

        {/* 5. Summary */}
        <Section title="Executive Summary / Scope" isOpen={sections.summary} onToggle={() => toggleSection('summary')} icon="fa-file-signature">
            <div className="relative">
                <textarea 
                    className="w-full border-slate-300 rounded shadow-sm p-4 min-h-[160px] focus:border-brand-500 focus:ring-brand-500 text-sm leading-relaxed" 
                    placeholder="Describe the overall purpose of the visit, initial observations, and outcome..."
                    value={report.summary}
                    onChange={e => handleChange('summary', e.target.value)}
                />
                <button 
                    onClick={recording ? stopAudioRecording : startAudioRecording}
                    className={`absolute bottom-4 right-4 p-3 rounded-full shadow-lg transition-all ${recording ? 'bg-red-500 animate-pulse text-white' : 'bg-slate-800 text-white hover:bg-brand-600'}`}
                    title="Dictate with Gemini"
                >
                    <i className={`fa-solid ${recording ? 'fa-stop' : 'fa-microphone'}`}></i>
                </button>
            </div>
        </Section>

        {/* 6. Issues */}
        <Section title="Report Issues" isOpen={sections.issues} onToggle={() => toggleSection('issues')} icon="fa-list-ul">
            {report.issues.length === 0 ? (
                <div className="text-center py-10 bg-slate-50 border-2 border-dashed border-slate-200 rounded-lg">
                    <div className="text-slate-300 text-4xl mb-3"><i className="fa-solid fa-clipboard-check"></i></div>
                    <p className="text-slate-500 mb-4 font-medium">No issues documented yet.</p>
                    <button onClick={() => setActiveIssueId('new')} className="text-white bg-brand-600 px-4 py-2 rounded shadow hover:bg-brand-700 text-sm font-bold">
                        <i className="fa-solid fa-plus mr-2"></i> Add First Issue
                    </button>
                </div>
            ) : (
                <div className="space-y-4">
                    {report.issues.map((issue, idx) => (
                        <div key={issue.id} onClick={() => setActiveIssueId(issue.id)} className="bg-white border border-slate-200 rounded-lg p-5 flex justify-between items-center cursor-pointer hover:shadow-md hover:border-brand-300 transition-all group">
                            <div className="flex items-center gap-4">
                                <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold ${issue.resolved ? 'bg-green-100 text-green-700' : 'bg-slate-100 text-slate-600'}`}>
                                    {idx + 1}
                                </div>
                                <div>
                                    <h4 className="font-bold text-slate-800 group-hover:text-brand-700 transition-colors">{issue.title || 'Untitled Issue'}</h4>
                                    <div className="flex items-center gap-2 mt-1">
                                        <span className="text-xs text-slate-500 font-mono uppercase">{issue.category}</span>
                                        {!issue.resolved && (
                                            <span className={`px-1.5 py-0.5 rounded text-[10px] font-bold text-white uppercase tracking-wider ${
                                                issue.urgency === 'Critical' ? 'bg-red-600' : 
                                                issue.urgency === 'High' ? 'bg-orange-500' : 'bg-yellow-500'
                                            }`}>{issue.urgency}</span>
                                        )}
                                    </div>
                                </div>
                            </div>
                            <div className="flex items-center space-x-3">
                                <span className={`px-2 py-1 rounded text-xs font-bold border ${issue.resolved ? 'bg-green-50 text-green-700 border-green-200' : 'bg-white text-slate-500 border-slate-200'}`}>
                                    {issue.resolved ? 'RESOLVED' : 'OPEN'}
                                </span>
                                <i className="fa-solid fa-chevron-right text-slate-300 group-hover:text-brand-500 transition-colors"></i>
                            </div>
                        </div>
                    ))}
                    <button onClick={() => setActiveIssueId('new')} className="w-full py-3 border-2 border-dashed border-slate-300 text-slate-500 rounded-lg hover:border-brand-500 hover:text-brand-600 font-bold uppercase tracking-wide text-xs transition-colors mt-4">
                        + Add Another Issue
                    </button>
                </div>
            )}
        </Section>

        {/* 7. Parts (Global) */}
        <Section title="Parts" isOpen={sections.parts} onToggle={() => toggleSection('parts')} icon="fa-cogs">
            <PartsList 
                parts={report.parts} 
                onAdd={() => {
                     const newPart: PartEntry = { id: generateUUID(), partNumber: '', description: '', quantity: '1', notes: '', type: 'used' };
                     handleChange('parts', [...report.parts, newPart]);
                }}
                onRemove={(id) => handleChange('parts', report.parts.filter(p => p.id !== id))}
                onUpdate={(id, field, val) => {
                     handleChange('parts', report.parts.map(p => p.id === id ? { ...p, [field]: val } : p));
                }}
            />
        </Section>

        {/* 8. Other Information */}
        <Section title="Follow Up & Suggestions" isOpen={sections.other} onToggle={() => toggleSection('other')} icon="fa-clipboard-list">
            <div className="space-y-8">
                {/* Follow Up */}
                <div className="flex items-center justify-between border border-yellow-200 p-5 rounded-lg bg-yellow-50">
                    <div className="flex items-start gap-3">
                        <div className="text-yellow-600 mt-1"><i className="fa-solid fa-bell"></i></div>
                        <div>
                            <span className="font-bold text-slate-800 block">Follow Up Required</span>
                            <span className="text-sm text-slate-600">Flag this report for office admin attention</span>
                        </div>
                    </div>
                    <label className="relative inline-flex items-center cursor-pointer">
                        <input type="checkbox" className="sr-only peer" checked={report.followUpRequired} onChange={e => handleChange('followUpRequired', e.target.checked)} />
                        <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-yellow-500"></div>
                    </label>
                </div>

                {/* Design Suggestion */}
                <div className="border border-slate-200 rounded-lg p-6 bg-white shadow-sm">
                     <h4 className="font-bold text-slate-800 mb-4 border-b border-slate-100 pb-2 flex items-center gap-2">
                        <i className="fa-solid fa-lightbulb text-brand-600"></i> Design/Process Suggestion
                     </h4>
                     <div className="grid grid-cols-1 gap-5">
                         <TextArea label="Current Implementation" value={report.designSuggestion.current} onChange={v => handleChange('designSuggestion.current', v)} rows={2} />
                         <TextArea label="Problem Identified" value={report.designSuggestion.problem} onChange={v => handleChange('designSuggestion.problem', v)} rows={2} />
                         <TextArea label="Suggested Change" value={report.designSuggestion.change} onChange={v => handleChange('designSuggestion.change', v)} rows={2} />
                     </div>
                </div>
                
                {/* Internal Suggestion */}
                <div className="bg-slate-50 p-4 rounded border border-slate-200">
                    <TextArea label="Internal Notes (Not shared with customer)" value={report.internalSuggestion} onChange={v => handleChange('internalSuggestion', v)} rows={3} />
                </div>

                {/* Tools & Nameplates Lists */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <StringList title="Tools/Supplies Bought" items={report.toolsBought} onChange={items => handleChange('toolsBought', items)} />
                    <StringList title="Tools/Supplies Used" items={report.toolsUsed} onChange={items => handleChange('toolsUsed', items)} />
                    <div className="md:col-span-2">
                        <StringList title="New Nameplates Needed" items={report.newNameplates} onChange={items => handleChange('newNameplates', items)} />
                    </div>
                </div>
            </div>
        </Section>
        
      </div>

      {activeIssueId && (
        <IssueModal 
            issueId={activeIssueId} 
            existingIssues={report.issues}
            onSave={(issue) => {
                setReport(prev => {
                    const exists = prev.issues.find(i => i.id === issue.id);
                    let newIssues = prev.issues;
                    if (exists) {
                        newIssues = prev.issues.map(i => i.id === issue.id ? issue : i);
                    } else {
                        newIssues = [...prev.issues, issue];
                    }
                    return { ...prev, issues: newIssues, _syncState: { ...prev._syncState, dirty: true } as any };
                });
                setActiveIssueId(null);
            }} 
            onClose={() => setActiveIssueId(null)} 
        />
      )}
    </div>
  );
};

// --- Subcomponents ---

const Section: React.FC<{title: string, isOpen: boolean, onToggle: () => void, icon?: string, children: React.ReactNode}> = ({title, isOpen, onToggle, icon, children}) => (
    <div className="bg-white border border-slate-200 rounded-lg shadow-sm overflow-hidden transition-all">
        <div className={`px-6 py-4 flex justify-between items-center cursor-pointer select-none ${isOpen ? 'bg-slate-50 border-b border-slate-100' : 'bg-white hover:bg-slate-50'}`} onClick={onToggle}>
            <div className="flex items-center gap-3">
                {icon && <div className="w-8 h-8 rounded bg-slate-100 text-slate-500 flex items-center justify-center"><i className={`fa-solid ${icon}`}></i></div>}
                <h3 className="text-lg font-bold text-slate-800">{title}</h3>
            </div>
            <div className="flex items-center space-x-3">
                <i className={`fa-solid fa-chevron-down text-slate-400 transition-transform duration-300 ${isOpen ? 'rotate-180' : ''}`}></i>
            </div>
        </div>
        {isOpen && <div className="p-6 animate-fade-in">{children}</div>}
    </div>
);

const Input: React.FC<{label: string, value: string, onChange: (v: string) => void}> = ({label, value, onChange}) => (
    <div>
        <label className="block text-xs font-bold text-slate-500 uppercase mb-1 tracking-wide">{label}</label>
        <input type="text" value={value} onChange={e => onChange(e.target.value)} className="block w-full rounded border-slate-300 shadow-sm focus:border-brand-500 focus:ring-brand-500 sm:text-sm" />
    </div>
);

const TextArea: React.FC<{label: string, value: string, onChange: (v: string) => void, rows?: number}> = ({label, value, onChange, rows=3}) => (
    <div>
        <label className="block text-xs font-bold text-slate-500 uppercase mb-1 tracking-wide">{label}</label>
        <textarea 
            rows={rows}
            value={value} 
            onChange={e => onChange(e.target.value)} 
            className="block w-full rounded border-slate-300 shadow-sm focus:border-brand-500 focus:ring-brand-500 sm:text-sm" 
        />
    </div>
);

const PartsList: React.FC<{
    parts: PartEntry[];
    onAdd: () => void;
    onUpdate: (id: string, field: keyof PartEntry, val: string) => void;
    onRemove: (id: string) => void;
}> = ({ parts, onAdd, onUpdate, onRemove }) => {
    return (
        <div className="border border-slate-200 rounded-lg overflow-hidden bg-white shadow-sm">
            <div className="bg-slate-50 px-4 py-3 border-b border-slate-200 flex justify-between items-center">
                <h4 className="font-bold text-slate-700 uppercase tracking-wide text-xs">Parts Inventory</h4>
                <button onClick={onAdd} className="text-xs bg-white border border-slate-300 px-3 py-1 rounded hover:bg-brand-50 hover:text-brand-600 hover:border-brand-300 transition-colors shadow-sm font-medium">
                    <i className="fa-solid fa-plus mr-1"></i> Add Item
                </button>
            </div>
            
            {parts.length === 0 ? (
                <div className="p-8 text-center text-slate-400 text-sm bg-white">No parts added to this report.</div>
            ) : (
                <div className="overflow-x-auto">
                    <table className="w-full text-sm text-left">
                        <thead className="bg-slate-100 text-slate-500 font-bold uppercase text-xs">
                            <tr>
                                <th className="px-4 py-3 w-1/4">Part #</th>
                                <th className="px-4 py-3 w-1/3">Description</th>
                                <th className="px-4 py-3 w-20">Qty</th>
                                <th className="px-4 py-3">Notes</th>
                                <th className="w-10"></th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100 bg-white">
                            {parts.map(part => (
                                <tr key={part.id} className="hover:bg-slate-50">
                                    <td className="p-2"><input className="w-full border-slate-300 rounded px-2 py-1 text-sm font-mono" value={part.partNumber} onChange={e => onUpdate(part.id, 'partNumber', e.target.value)} placeholder="XXX-XXX" /></td>
                                    <td className="p-2"><input className="w-full border-slate-300 rounded px-2 py-1 text-sm" value={part.description} onChange={e => onUpdate(part.id, 'description', e.target.value)} placeholder="Part Name" /></td>
                                    <td className="p-2"><input className="w-full border-slate-300 rounded px-2 py-1 text-sm text-center" value={part.quantity} onChange={e => onUpdate(part.id, 'quantity', e.target.value)} /></td>
                                    <td className="p-2"><input className="w-full border-slate-300 rounded px-2 py-1 text-sm" value={part.notes} onChange={e => onUpdate(part.id, 'notes', e.target.value)} placeholder="Optional" /></td>
                                    <td className="p-2 text-center"><button onClick={() => onRemove(part.id)} className="text-slate-300 hover:text-red-500 transition-colors"><i className="fa-solid fa-trash"></i></button></td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            )}
        </div>
    );
};

const StringList: React.FC<{
    title: string;
    items: {id: string, text: string}[];
    onChange: (items: {id: string, text: string}[]) => void;
}> = ({ title, items, onChange }) => {
    const handleAdd = () => {
        onChange([...items, { id: generateUUID(), text: '' }]);
    };
    const handleUpdate = (id: string, text: string) => {
        onChange(items.map(i => i.id === id ? { ...i, text } : i));
    };
    const handleDelete = (id: string) => {
        onChange(items.filter(i => i.id !== id));
    };

    return (
        <div className="border border-slate-200 rounded bg-white shadow-sm h-full flex flex-col">
            <div className="flex justify-between items-center bg-slate-50 px-3 py-2 border-b border-slate-200 rounded-t">
                <span className="text-xs font-bold text-slate-600 uppercase tracking-wide">{title}</span>
                <button onClick={handleAdd} className="text-brand-600 hover:text-brand-700 bg-white border border-slate-200 w-6 h-6 flex items-center justify-center rounded shadow-sm text-xs"><i className="fa-solid fa-plus"></i></button>
            </div>
            <div className="p-3 space-y-2 flex-1">
                {items.length === 0 && <p className="text-xs text-slate-400 italic text-center py-2">List is empty</p>}
                {items.map(item => (
                    <div key={item.id} className="flex gap-2">
                        <input 
                            className="flex-1 border-slate-300 rounded px-2 py-1 text-sm focus:border-brand-500 focus:ring-brand-500" 
                            value={item.text} 
                            onChange={e => handleUpdate(item.id, e.target.value)}
                            placeholder="Type here..."
                        />
                        <button onClick={() => handleDelete(item.id)} className="text-slate-300 hover:text-red-500 px-1"><i className="fa-solid fa-xmark"></i></button>
                    </div>
                ))}
            </div>
        </div>
    );
};
