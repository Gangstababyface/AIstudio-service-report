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
        
        // --- 1. Deep Merge with Defaults (Prevent Partial Objects) ---
        // We create a fresh empty report and overlay existing data on top.
        // This ensures missing fields (like 'softwareVersion' on machine) are present as empty strings.
        
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

  if (loading) return <div className="p-10 flex justify-center"><div className="animate-spin-slow text-4xl"><i className="fa-solid fa-gear"></i></div></div>;

  return (
    <div className="flex flex-col h-full">
      {/* Toolbar */}
      <div className="bg-white border-b px-6 py-3 flex justify-between items-center sticky top-0 z-40">
        <button onClick={onClose} className="text-gray-500 hover:text-gray-700">
            <i className="fa-solid fa-arrow-left mr-2"></i> Back
        </button>
        <div className="flex items-center space-x-4">
            <span className={`text-sm font-medium ${isError ? 'text-red-600' : 'text-gray-500'}`}>
                {statusMsg}
            </span>
            <button 
                onClick={() => saveDraft()} 
                disabled={saving}
                className="bg-white border border-gray-300 text-gray-700 px-4 py-2 rounded shadow-sm hover:bg-gray-50 disabled:opacity-50"
            >
                {saving ? '...' : 'Save Draft'}
            </button>
            <button 
                onClick={handleComplete} 
                disabled={saving}
                className="bg-brand-600 text-white px-4 py-2 rounded shadow-sm hover:bg-brand-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center"
            >
                {saving ? <i className="fa-solid fa-circle-notch fa-spin mr-2"></i> : <i className="fa-solid fa-check-double mr-2"></i>}
                Complete & Export
            </button>
        </div>
      </div>

      <div className="flex-1 overflow-auto p-6 space-y-6">
        
        {/* 1. Tech & Dates */}
        <Section title="Technician & Dates" isOpen={sections.tech} onToggle={() => toggleSection('tech')}>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                    <label className="block text-sm font-medium text-gray-700">Technician</label>
                    <input disabled value={report.technicianName} className="mt-1 block w-full rounded border-gray-300 bg-gray-100 p-2" />
                </div>
                <div>
                    <label className="block text-sm font-medium text-gray-700">Arrival Date</label>
                    <input type="date" value={report.arrivalDate} onChange={e => handleChange('arrivalDate', e.target.value)} className="mt-1 block w-full rounded border border-gray-300 p-2" />
                </div>
                <div>
                    <label className="block text-sm font-medium text-gray-700">Departure (Est.)</label>
                    <input type="date" value={report.departureDate} onChange={e => handleChange('departureDate', e.target.value)} className="mt-1 block w-full rounded border border-gray-300 p-2" />
                </div>
            </div>
        </Section>

        {/* 2. Service Type */}
        <Section title="Service Type" isOpen={sections.service} onToggle={() => toggleSection('service')}>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                {JOB_TYPES.map(type => (
                    <label key={type} className="flex items-center space-x-2 p-2 border rounded hover:bg-gray-50 cursor-pointer">
                        <input 
                            type="checkbox" 
                            checked={report.serviceTypes.includes(type)}
                            onChange={e => {
                                const newTypes = e.target.checked 
                                    ? [...report.serviceTypes, type]
                                    : report.serviceTypes.filter(t => t !== type);
                                handleChange('serviceTypes', newTypes);
                            }}
                            className="text-brand-600 focus:ring-brand-500 rounded"
                        />
                        <span className="text-sm">{type}</span>
                    </label>
                ))}
            </div>
        </Section>

        {/* 3. Customer */}
        <Section title="Customer Information" isOpen={sections.customer} onToggle={() => toggleSection('customer')}>
            <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 mb-1">Select Existing Customer (Optional)</label>
                <select onChange={handleCustomerSelect} className="w-full border-gray-300 rounded shadow-sm p-2 border">
                    <option value="">-- Select --</option>
                    {customers.map(c => <option key={c.id} value={c.id}>{c.companyName}</option>)}
                </select>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <Input label="Company Name" value={report.customer?.companyName || ''} onChange={v => handleChange('customer.companyName', v)} />
                <Input label="Contact Person" value={report.customer?.contactPerson || ''} onChange={v => handleChange('customer.contactPerson', v)} />
                <Input label="Position" value={report.customer?.position || ''} onChange={v => handleChange('customer.position', v)} />
                <Input label="Phone" value={report.customer?.phone || ''} onChange={v => handleChange('customer.phone', v)} />
                <div className="md:col-span-2">
                    <label className="block text-sm font-medium text-gray-700">Address</label>
                    <div className="flex gap-2">
                        <textarea rows={3} className="mt-1 block w-full rounded border border-gray-300 p-2" value={report.customer?.address || ''} onChange={e => handleChange('customer.address', e.target.value)} />
                        <button onClick={async () => {
                            const coords = await getCoordinatesForAddress(report.customer?.address || '');
                            if (coords) alert(`Verified Location: ${coords.lat}, ${coords.lng}`);
                            else alert("Could not verify address");
                        }} className="mt-1 px-3 bg-gray-100 border rounded hover:bg-gray-200 text-sm h-fit self-start py-2" title="Verify Address with Gemini Maps"><i className="fa-solid fa-map-location-dot"></i></button>
                    </div>
                </div>
            </div>
        </Section>

        {/* 4. Machine */}
        <Section title="Machine Information" isOpen={sections.machine} onToggle={() => toggleSection('machine')}>
            <div className="flex justify-between items-start mb-4">
                 <div></div>
                 <div className="text-right">
                    <button 
                        onClick={() => nameplateInputRef.current?.click()}
                        disabled={scanningNameplate}
                        className="flex items-center text-sm bg-brand-50 text-brand-700 px-3 py-1 rounded border border-brand-200 hover:bg-brand-100 disabled:opacity-50 mb-1"
                    >
                        {scanningNameplate ? <i className="fa-solid fa-circle-notch fa-spin mr-2"></i> : <i className="fa-solid fa-camera mr-2"></i>}
                        {scanningNameplate ? 'Scanning...' : 'Scan Nameplate'}
                    </button>
                    <div className="text-[10px] text-gray-400">Photo will be attached to report</div>
                    <input type="file" accept="image/*" ref={nameplateInputRef} className="hidden" onChange={handleNameplateScan} />
                </div>
            </div>

            {/* Display Attached Nameplates */}
            <div className="mb-4">
                 <div className="flex flex-wrap gap-2">
                    {(report.attachments || []).filter(a => a.fieldRef === 'machineNameplate').map(att => (
                        <div key={att.id} className="relative group w-24 h-24 border rounded overflow-hidden shadow-sm">
                             <img src={att.data || att.url} alt="Nameplate" className="w-full h-full object-cover" />
                             <button onClick={() => removeAttachment(att.id)} className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 flex items-center justify-center text-white transition-opacity">
                                <i className="fa-solid fa-trash"></i>
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

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                <Input label="Serial Number" value={report.machine?.serialNumber || ''} onChange={v => handleChange('machine.serialNumber', v)} />
                <Input label="Model Number" value={report.machine?.modelNumber || ''} onChange={v => handleChange('machine.modelNumber', v)} />
                <Input label="Machine Type" value={report.machine?.machineType || ''} onChange={v => handleChange('machine.machineType', v)} />
                <Input label="Controller Type" value={report.machine?.controllerType || ''} onChange={v => handleChange('machine.controllerType', v)} />
                <Input label="Software Version" value={report.machine?.softwareVersion || ''} onChange={v => handleChange('machine.softwareVersion', v)} />
            </div>
        </Section>

        {/* 5. Summary */}
        <Section title="Summary / Reason for Visit" isOpen={sections.summary} onToggle={() => toggleSection('summary')}>
            <div className="relative">
                <textarea 
                    className="w-full border border-gray-300 rounded p-3 min-h-[200px]" 
                    placeholder="Describe the overall purpose of the visit..."
                    value={report.summary}
                    onChange={e => handleChange('summary', e.target.value)}
                />
                <button 
                    onClick={recording ? stopAudioRecording : startAudioRecording}
                    className={`absolute bottom-3 right-3 p-2 rounded-full shadow-lg ${recording ? 'bg-red-500 animate-pulse text-white' : 'bg-brand-500 text-white hover:bg-brand-600'}`}
                    title="Dictate with Gemini"
                >
                    <i className={`fa-solid ${recording ? 'fa-stop' : 'fa-microphone'}`}></i>
                </button>
            </div>
        </Section>

        {/* 6. Issues */}
        <Section title="Report Issues" isOpen={sections.issues} onToggle={() => toggleSection('issues')}>
            {report.issues.length === 0 ? (
                <div className="text-center py-8 bg-gray-50 border-2 border-dashed border-gray-200 rounded">
                    <p className="text-gray-500 mb-3">No issues added yet.</p>
                    <button onClick={() => setActiveIssueId('new')} className="text-brand-600 font-medium hover:underline">+ Add Your First Issue</button>
                </div>
            ) : (
                <div className="space-y-3">
                    {report.issues.map(issue => (
                        <div key={issue.id} onClick={() => setActiveIssueId(issue.id)} className="bg-white border rounded p-4 flex justify-between items-center cursor-pointer hover:shadow-md transition-shadow">
                            <div>
                                <h4 className="font-medium text-lg">{issue.title}</h4>
                                <span className="text-sm text-gray-500">{issue.category}</span>
                            </div>
                            <div className="flex items-center space-x-2">
                                {!issue.resolved && (
                                    <span className={`px-2 py-1 rounded text-xs font-bold text-white ${
                                        issue.urgency === 'Critical' ? 'bg-red-600' : 
                                        issue.urgency === 'High' ? 'bg-orange-500' : 'bg-yellow-500'
                                    }`}>{issue.urgency}</span>
                                )}
                                <span className={`px-2 py-1 rounded text-xs font-bold ${issue.resolved ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}>
                                    {issue.resolved ? 'RESOLVED' : 'OPEN'}
                                </span>
                                <i className="fa-solid fa-chevron-right text-gray-300 ml-2"></i>
                            </div>
                        </div>
                    ))}
                    <button onClick={() => setActiveIssueId('new')} className="w-full py-3 border-2 border-dashed border-gray-300 text-gray-500 rounded hover:border-brand-500 hover:text-brand-500 font-medium transition-colors">
                        + Add Issue
                    </button>
                </div>
            )}
        </Section>

        {/* 7. Parts (Global) */}
        <Section title="Parts" isOpen={sections.parts} onToggle={() => toggleSection('parts')}>
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
        <Section title="Other Information" isOpen={sections.other} onToggle={() => toggleSection('other')}>
            <div className="space-y-8">
                {/* Follow Up */}
                <div className="flex items-center justify-between border p-4 rounded bg-yellow-50">
                    <div>
                        <span className="font-bold text-gray-800 block">Follow Up Required</span>
                        <span className="text-sm text-gray-500">Flag for office admin attention</span>
                    </div>
                    <input 
                        type="checkbox" 
                        className="w-6 h-6 text-brand-600 rounded focus:ring-brand-500" 
                        checked={report.followUpRequired} 
                        onChange={e => handleChange('followUpRequired', e.target.checked)} 
                    />
                </div>

                {/* Design Suggestion */}
                <div className="border rounded-lg p-5 bg-gray-50/50">
                     <h4 className="font-bold text-gray-700 mb-4 border-b pb-2">Design Suggestion</h4>
                     <div className="grid grid-cols-1 gap-4">
                         <TextArea label="Current Implementation" value={report.designSuggestion.current} onChange={v => handleChange('designSuggestion.current', v)} rows={3} />
                         <TextArea label="Problem Identified" value={report.designSuggestion.problem} onChange={v => handleChange('designSuggestion.problem', v)} rows={3} />
                         <TextArea label="Suggested Change" value={report.designSuggestion.change} onChange={v => handleChange('designSuggestion.change', v)} rows={3} />
                     </div>
                </div>
                
                {/* Internal Suggestion */}
                <TextArea label="Internal Suggestion (Not shared with customer)" value={report.internalSuggestion} onChange={v => handleChange('internalSuggestion', v)} rows={4} />

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

const Section: React.FC<{title: string, isOpen: boolean, onToggle: () => void, children: React.ReactNode}> = ({title, isOpen, onToggle, children}) => (
    <div className="bg-white border rounded shadow-sm overflow-hidden">
        <div className="px-6 py-4 bg-gray-50 border-b flex justify-between items-center cursor-pointer select-none" onClick={onToggle}>
            <h3 className="text-lg font-semibold text-gray-800">{title}</h3>
            <div className="flex items-center space-x-3">
                <button className="text-xs font-medium text-brand-600 uppercase tracking-wide bg-white border border-brand-200 px-2 py-1 rounded shadow-sm hover:bg-brand-50">
                    {isOpen ? 'Save & Collapse' : 'Expand'}
                </button>
                <i className={`fa-solid fa-chevron-down transition-transform ${isOpen ? 'rotate-180' : ''}`}></i>
            </div>
        </div>
        {isOpen && <div className="p-6">{children}</div>}
    </div>
);

const Input: React.FC<{label: string, value: string, onChange: (v: string) => void}> = ({label, value, onChange}) => (
    <div>
        <label className="block text-sm font-medium text-gray-700 uppercase tracking-wide text-xs mb-1">{label}</label>
        <input type="text" value={value} onChange={e => onChange(e.target.value)} className="mt-1 block w-full rounded border border-gray-300 p-2 focus:border-brand-500 focus:ring-brand-500" />
    </div>
);

const TextArea: React.FC<{label: string, value: string, onChange: (v: string) => void, rows?: number}> = ({label, value, onChange, rows=3}) => (
    <div>
        <label className="block text-sm font-medium text-gray-700 uppercase tracking-wide text-xs mb-1">{label}</label>
        <textarea 
            rows={rows}
            value={value} 
            onChange={e => onChange(e.target.value)} 
            className="mt-1 block w-full rounded border border-gray-300 p-2 focus:border-brand-500 focus:ring-brand-500" 
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
        <div className="border rounded-lg overflow-hidden bg-white shadow-sm">
            <div className="bg-gray-50 px-4 py-3 border-b flex justify-between items-center">
                <h4 className="font-bold text-gray-700 uppercase tracking-wide text-sm">General Parts List</h4>
                <button onClick={onAdd} className="text-xs bg-white border border-gray-300 px-2 py-1 rounded hover:bg-brand-50 hover:text-brand-600 hover:border-brand-300 transition-colors">
                    <i className="fa-solid fa-plus mr-1"></i> Add Part
                </button>
            </div>
            
            {parts.length === 0 ? (
                <div className="p-6 text-center text-gray-400 text-sm">No parts listed</div>
            ) : (
                <div className="overflow-x-auto">
                    <table className="w-full text-sm text-left">
                        <thead className="bg-gray-50 text-gray-500 font-medium">
                            <tr>
                                <th className="px-4 py-2 w-1/4">Part #</th>
                                <th className="px-4 py-2 w-1/3">Description</th>
                                <th className="px-4 py-2 w-20">Qty</th>
                                <th className="px-4 py-2">Notes</th>
                                <th className="w-10"></th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100">
                            {parts.map(part => (
                                <tr key={part.id}>
                                    <td className="p-2"><input className="w-full border rounded px-2 py-1" value={part.partNumber} onChange={e => onUpdate(part.id, 'partNumber', e.target.value)} placeholder="Part #" /></td>
                                    <td className="p-2"><input className="w-full border rounded px-2 py-1" value={part.description} onChange={e => onUpdate(part.id, 'description', e.target.value)} placeholder="Desc" /></td>
                                    <td className="p-2"><input className="w-full border rounded px-2 py-1" value={part.quantity} onChange={e => onUpdate(part.id, 'quantity', e.target.value)} /></td>
                                    <td className="p-2"><input className="w-full border rounded px-2 py-1" value={part.notes} onChange={e => onUpdate(part.id, 'notes', e.target.value)} placeholder="Notes" /></td>
                                    <td className="p-2 text-center"><button onClick={() => onRemove(part.id)} className="text-gray-300 hover:text-red-500"><i className="fa-solid fa-trash"></i></button></td>
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
        <div className="border rounded bg-white">
            <div className="flex justify-between items-center bg-gray-50 px-3 py-2 border-b">
                <span className="text-sm font-bold text-gray-600 uppercase tracking-wide">{title}</span>
                <button onClick={handleAdd} className="text-brand-600 hover:text-brand-700"><i className="fa-solid fa-plus"></i></button>
            </div>
            <div className="p-3 space-y-2">
                {items.length === 0 && <p className="text-xs text-gray-400 italic">None added</p>}
                {items.map(item => (
                    <div key={item.id} className="flex gap-2">
                        <input 
                            className="flex-1 border rounded px-2 py-1 text-sm" 
                            value={item.text} 
                            onChange={e => handleUpdate(item.id, e.target.value)}
                            placeholder="Enter item..."
                        />
                        <button onClick={() => handleDelete(item.id)} className="text-gray-400 hover:text-red-500"><i className="fa-solid fa-xmark"></i></button>
                    </div>
                ))}
            </div>
        </div>
    );
};