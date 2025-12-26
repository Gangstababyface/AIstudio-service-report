
import React, { useState, useEffect, useRef } from 'react';
import { Issue, ISSUE_CATEGORIES, Attachment, PartEntry } from '../types';
import { generateSolutionSummary, analyzeImage, transcribeAudio } from '../services/geminiService';
import { uploadFileToWorkDrive } from '../services/workDriveService';
import { generateUUID, processFile } from '../utils/helpers';

interface ModalProps {
    issueId: string;
    existingIssues: Issue[];
    onSave: (issue: Issue) => void;
    onClose: () => void;
}

const emptyIssue: Issue = {
    id: '', // Set on creation
    title: '',
    category: 'Not Specified',
    resolved: false,
    urgency: 'Medium',
    description: '',
    proposedFixes: [],
    troubleshootingSteps: [],
    rootCause: '',
    fixApplied: '',
    verifiedBy: '',
    notes: '',
    solutionSummary: '',
    attachments: [],
    parts: [],
    addToMfgReport: false,
    followUpRequired: false,
};

export const IssueModal: React.FC<ModalProps> = ({ issueId, existingIssues, onSave, onClose }) => {
    const [issue, setIssue] = useState<Issue>(emptyIssue);
    const [tab, setTab] = useState<'details' | 'solutions' | 'media' | 'parts' | 'other'>('details');
    const [analyzing, setAnalyzing] = useState(false);
    
    // Audio Recording State
    const [activeRecordingField, setActiveRecordingField] = useState<string | null>(null);
    const mediaRecorderRef = useRef<MediaRecorder | null>(null);
    const audioChunksRef = useRef<Blob[]>([]);

    useEffect(() => {
        if (issueId === 'new') {
            setIssue({ ...emptyIssue, id: generateUUID() });
        } else {
            const found = existingIssues.find(i => i.id === issueId);
            if (found) setIssue(JSON.parse(JSON.stringify(found)));
        }
    }, [issueId]);

    const handleChange = (field: keyof Issue, value: any) => {
        setIssue(prev => ({ ...prev, [field]: value }));
    };

    // --- Audio Handlers ---
    const toggleRecording = async (field: keyof Issue) => {
        if (activeRecordingField === field) {
            // Stop Recording
            mediaRecorderRef.current?.stop();
            setActiveRecordingField(null);
        } else {
            // Start Recording
            if (activeRecordingField) return; // Prevent multiple recordings

            try {
                const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
                const mediaRecorder = new MediaRecorder(stream);
                mediaRecorderRef.current = mediaRecorder;
                audioChunksRef.current = [];

                mediaRecorder.ondataavailable = (event) => {
                    audioChunksRef.current.push(event.data);
                };

                mediaRecorder.onstop = async () => {
                    const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
                    // Show some loading state if needed, but for now we rely on the text appearing
                    try {
                        const text = await transcribeAudio(audioBlob);
                        if (text) {
                            setIssue(prev => {
                                const currentVal = (prev[field] as string) || '';
                                const spacer = currentVal && !currentVal.endsWith(' ') ? ' ' : '';
                                return { ...prev, [field]: currentVal + spacer + text };
                            });
                        }
                    } catch (err) {
                        console.error("Transcription failed", err);
                        alert("Failed to transcribe audio.");
                    }
                    
                    // Cleanup
                    stream.getTracks().forEach(t => t.stop());
                };

                mediaRecorder.start();
                setActiveRecordingField(field as string);
            } catch (err) {
                console.error("Mic access denied", err);
                alert("Microphone access denied or not available.");
            }
        }
    };

    // --- List Handlers ---
    const handleListChange = (listName: 'proposedFixes' | 'troubleshootingSteps', id: string, text: string) => {
        setIssue(prev => ({
            ...prev,
            [listName]: prev[listName].map(item => item.id === id ? { ...item, text } : item)
        }));
    };

    const handleListAdd = (listName: 'proposedFixes' | 'troubleshootingSteps') => {
        setIssue(prev => ({
            ...prev,
            [listName]: [...prev[listName], { id: generateUUID(), text: '' }]
        }));
    };

    const handleListDelete = (listName: 'proposedFixes' | 'troubleshootingSteps', id: string) => {
        setIssue(prev => ({
            ...prev,
            [listName]: prev[listName].filter(item => item.id !== id)
        }));
    };

    // --- Media Handlers ---
    const handleFileUpload = async (files: FileList | null, bucket: Attachment['bucket'], fieldRef?: string) => {
        if (!files) return;
        
        // 1. Create temporary placeholders for UI responsiveness
        const newAttachments: Attachment[] = Array.from(files).map(file => ({
            id: generateUUID(),
            fileName: file.name,
            fileType: file.type,
            size: file.size,
            url: URL.createObjectURL(file), // Transient preview
            data: undefined, // Will be filled async
            bucket,
            fieldRef, 
            uploaded: false,
            uploading: true,
            issueId: issue.id
        }));

        setIssue(prev => ({ ...prev, attachments: [...prev.attachments, ...newAttachments] }));

        // 2. Process files: Convert to Base64 (handling HEIC -> JPEG) AND simulate upload
        const processedAttachments = await Promise.all(
            Array.from(files).map(async (file, index) => {
                const att = newAttachments[index];
                try {
                    // Convert to Base64 (handles HEIC)
                    const { data, type, name } = await processFile(file);
                    
                    // Simulate WorkDrive Upload delay
                    await new Promise(r => setTimeout(r, 800 + Math.random() * 500));
                    
                    return {
                        ...att,
                        data: data, // Valid Base64 (JPEG if original was HEIC)
                        fileType: type, // Updated mime type
                        fileName: name, // Updated extension
                        uploaded: true,
                        uploading: false
                    };
                } catch (err) {
                    console.error("File processing failed", err);
                    return { ...att, uploading: false, error: "Failed to process" };
                }
            })
        );

        // 3. Update state with processed data
        setIssue(prev => ({
            ...prev,
            attachments: prev.attachments.map(existing => {
                const processed = processedAttachments.find(p => p.id === existing.id);
                return processed ? processed : existing;
            })
        }));
    };

    const removeAttachment = (id: string) => {
        setIssue(prev => ({ ...prev, attachments: prev.attachments.filter(a => a.id !== id) }));
    };

    // --- Part Handlers ---
    const addPart = (type: PartEntry['type']) => {
        const newPart: PartEntry = {
            id: generateUUID(),
            partNumber: '',
            description: '',
            quantity: '1',
            notes: '',
            type
        };
        setIssue(prev => ({ ...prev, parts: [...prev.parts, newPart] }));
    };

    const updatePart = (id: string, field: keyof PartEntry, value: string) => {
        setIssue(prev => ({
            ...prev,
            parts: prev.parts.map(p => p.id === id ? { ...p, [field]: value } : p)
        }));
    };

    const removePart = (id: string) => {
        setIssue(prev => ({ ...prev, parts: prev.parts.filter(p => p.id !== id) }));
    };

    // --- AI ---
    const generateAiSummary = async () => {
        setAnalyzing(true);
        const summary = await generateSolutionSummary(issue.rootCause, issue.fixApplied, issue.notes);
        if (summary) handleChange('solutionSummary', summary);
        setAnalyzing(false);
    };

    // Tabs
    const tabs = [
        { id: 'details', label: 'Details' },
        { id: 'solutions', label: 'Solutions' },
        { id: 'media', label: 'Media' },
        { id: 'parts', label: 'Parts' },
        { id: 'other', label: 'Other' }
    ];

    return (
        <div className="fixed inset-0 bg-black/70 z-50 flex items-center justify-center p-4">
            <div className="bg-slate-900 w-full max-w-5xl h-[95vh] rounded-lg shadow-2xl flex flex-col border border-slate-700">

                {/* Header */}
                <div className="px-6 py-4 border-b border-slate-700 flex justify-between items-center bg-slate-800 rounded-t-lg">
                    <div className="flex items-center space-x-3">
                         <div className={`p-2 rounded-full ${issue.resolved ? 'bg-green-900/50 text-green-400' : 'bg-amber-900/50 text-amber-400'}`}>
                            <i className={`fa-solid ${issue.resolved ? 'fa-check' : 'fa-circle-exclamation'}`}></i>
                         </div>
                         <div>
                            <h2 className="text-xl font-bold text-white">{issueId === 'new' ? 'New Issue' : 'Edit Issue'}</h2>
                            <p className="text-xs text-slate-400">{issue.title || 'Untitled'}</p>
                         </div>
                    </div>

                    <div className="flex items-center space-x-4">
                        <div className="flex items-center">
                            <span className="text-sm font-medium text-slate-400 mr-3">Resolved</span>
                            <button
                                onClick={() => handleChange('resolved', !issue.resolved)}
                                className={`w-12 h-6 rounded-full p-1 transition-colors relative ${issue.resolved ? 'bg-green-600' : 'bg-slate-600'}`}
                            >
                                <div className={`w-4 h-4 bg-white rounded-full shadow-sm transform transition-transform ${issue.resolved ? 'translate-x-6' : ''}`}></div>
                            </button>
                        </div>
                        <button onClick={onClose} className="text-slate-500 hover:text-white"><i className="fa-solid fa-xmark text-xl"></i></button>
                    </div>
                </div>

                {/* Tab Bar */}
                <div className="flex overflow-x-auto border-b border-slate-700 px-4 bg-slate-800 gap-1">
                    {tabs.map(t => (
                        <button
                            key={t.id}
                            onClick={() => setTab(t.id as any)}
                            className={`px-3 py-2 text-xs sm:text-sm font-medium flex items-center gap-1.5 whitespace-nowrap transition-colors flex-shrink-0 ${
                                tab === t.id
                                    ? 'text-white border-b-2 border-red-500'
                                    : 'text-slate-400 hover:text-slate-200 border-b-2 border-transparent'
                            }`}
                        >
                            {t.id === 'details' && <i className="fa-regular fa-file-lines"></i>}
                            {t.id === 'solutions' && <i className="fa-regular fa-lightbulb"></i>}
                            {t.id === 'media' && <i className="fa-regular fa-image"></i>}
                            {t.id === 'parts' && <i className="fa-solid fa-box-open"></i>}
                            {t.id === 'other' && <i className="fa-solid fa-wrench"></i>}
                            {t.label}
                        </button>
                    ))}
                </div>

                {/* Content */}
                <div className="flex-1 overflow-y-auto p-8 bg-slate-900">
                    
                    {tab === 'details' && (
                        <div className="space-y-6 max-w-3xl mx-auto">
                            <Input 
                                id="issueTitle"
                                label="Issue Title" 
                                value={issue.title} 
                                onChange={v => handleChange('title', v)} 
                                placeholder="e.g. Servo Motor Overheat" 
                                onUpload={(files) => handleFileUpload(files, 'issue_photos', 'issueTitle')}
                                attachments={issue.attachments.filter(a => a.fieldRef === 'issueTitle')}
                                onRemoveAttachment={removeAttachment}
                            />
                            
                            <div>
                                <label className="block text-sm font-medium text-slate-300">Category</label>
                                <select
                                    value={issue.category}
                                    onChange={e => handleChange('category', e.target.value)}
                                    className="mt-1 block w-full rounded bg-slate-800 border-slate-600 text-white p-2 focus:ring-red-500 focus:border-red-500"
                                >
                                    {ISSUE_CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
                                </select>
                            </div>

                            <ResolutionField 
                                id="description"
                                label="Observation / Problem Description"
                                value={issue.description}
                                onChange={v => handleChange('description', v)}
                                placeholder="Describe exactly what was observed..."
                                rows={8}
                                onUpload={(files) => handleFileUpload(files, 'issue_photos', 'description')}
                                attachments={issue.attachments.filter(a => a.fieldRef === 'description')}
                                onRemoveAttachment={removeAttachment}
                                onToggleRecord={() => toggleRecording('description')}
                                isRecording={activeRecordingField === 'description'}
                            />
                        </div>
                    )}

                    {tab === 'solutions' && (
                        <div className="space-y-10 max-w-4xl mx-auto">
                            <ListSection 
                                title="PROPOSED FIXES"
                                subtitle="Recommendations from others"
                                items={issue.proposedFixes}
                                emptyLabel="No proposed fixes yet"
                                btnLabel="Add Fix"
                                onAdd={() => handleListAdd('proposedFixes')}
                                onChange={(id, txt) => handleListChange('proposedFixes', id, txt)}
                                onDelete={(id) => handleListDelete('proposedFixes', id)}
                                onUpload={(id, files) => handleFileUpload(files, 'issue_photos', id)}
                                getAttachments={(id) => issue.attachments.filter(a => a.fieldRef === id)}
                                onRemoveAttachment={removeAttachment}
                            />

                            <ListSection 
                                title="TROUBLESHOOTING STEPS"
                                subtitle="What was tried"
                                items={issue.troubleshootingSteps}
                                emptyLabel="No troubleshooting steps yet"
                                btnLabel="Add Step"
                                onAdd={() => handleListAdd('troubleshootingSteps')}
                                onChange={(id, txt) => handleListChange('troubleshootingSteps', id, txt)}
                                onDelete={(id) => handleListDelete('troubleshootingSteps', id)}
                                onUpload={(id, files) => handleFileUpload(files, 'issue_photos', id)}
                                getAttachments={(id) => issue.attachments.filter(a => a.fieldRef === id)}
                                onRemoveAttachment={removeAttachment}
                            />

                            {!issue.resolved && (
                                <div className="border-2 border-amber-700 rounded-lg p-6 relative bg-amber-900/20">
                                    <div className="flex items-center gap-3 mb-2 text-amber-500 font-bold uppercase tracking-wider text-sm">
                                        <i className="fa-solid fa-triangle-exclamation"></i>
                                        Issue Urgency
                                    </div>
                                    <p className="text-xs text-slate-400 mb-3">Classify the priority of this unresolved issue</p>
                                    <select
                                        value={issue.urgency}
                                        onChange={e => handleChange('urgency', e.target.value)}
                                        className="block w-full rounded bg-slate-800 border-amber-600 text-white shadow-sm p-3 focus:border-amber-500 focus:ring-amber-500"
                                    >
                                        <option value="Low">Low - Whenever</option>
                                        <option value="Medium">Medium - Soon</option>
                                        <option value="High">High - Urgent</option>
                                        <option value="Critical">Critical - Immediate</option>
                                    </select>
                                </div>
                            )}

                            {issue.resolved ? (
                                <div className="border-2 border-green-700 rounded-lg p-6 bg-green-900/20">
                                    <h3 className="text-green-400 font-bold uppercase tracking-wider text-sm mb-1">
                                        Resolution - What Actually Fixed It
                                    </h3>
                                    <p className="text-xs text-slate-400 mb-6">Final solution that resolved the issue</p>

                                    <div className="space-y-6">
                                        <ResolutionField
                                            id="rootCause"
                                            label="Root Cause"
                                            placeholder="What was actually wrong?"
                                            value={issue.rootCause}
                                            onChange={v => handleChange('rootCause', v)}
                                            rows={4}
                                            onUpload={(files) => handleFileUpload(files, 'issue_photos', 'rootCause')}
                                            attachments={issue.attachments.filter(a => a.fieldRef === 'rootCause')}
                                            onRemoveAttachment={removeAttachment}
                                            onToggleRecord={() => toggleRecording('rootCause')}
                                            isRecording={activeRecordingField === 'rootCause'}
                                        />
                                        <ResolutionField
                                            id="fixApplied"
                                            label="Fix Applied"
                                            placeholder="The specific action that resolved it"
                                            value={issue.fixApplied}
                                            onChange={v => handleChange('fixApplied', v)}
                                            rows={4}
                                            onUpload={(files) => handleFileUpload(files, 'issue_photos', 'fixApplied')}
                                            attachments={issue.attachments.filter(a => a.fieldRef === 'fixApplied')}
                                            onRemoveAttachment={removeAttachment}
                                            onToggleRecord={() => toggleRecording('fixApplied')}
                                            isRecording={activeRecordingField === 'fixApplied'}
                                        />
                                        <ResolutionField
                                            id="verifiedBy"
                                            label="Verified By"
                                            placeholder="Who confirmed it's working?"
                                            value={issue.verifiedBy}
                                            onChange={v => handleChange('verifiedBy', v)}
                                            onUpload={(files) => handleFileUpload(files, 'issue_photos', 'verifiedBy')}
                                            attachments={issue.attachments.filter(a => a.fieldRef === 'verifiedBy')}
                                            onRemoveAttachment={removeAttachment}
                                        />
                                        <ResolutionField
                                            id="notes"
                                            label="Notes"
                                            placeholder="Any gotchas or things to watch for..."
                                            value={issue.notes}
                                            onChange={v => handleChange('notes', v)}
                                            rows={4}
                                            onUpload={(files) => handleFileUpload(files, 'issue_photos', 'notes')}
                                            attachments={issue.attachments.filter(a => a.fieldRef === 'notes')}
                                            onRemoveAttachment={removeAttachment}
                                            onToggleRecord={() => toggleRecording('notes')}
                                            isRecording={activeRecordingField === 'notes'}
                                        />
                                    </div>

                                    <div className="mt-4 pt-4 border-t border-green-700">
                                        <div className="flex justify-between items-center mb-1">
                                            <label className="block text-sm font-medium text-slate-300">Solution Summary (Customer Facing)</label>
                                            <button onClick={generateAiSummary} disabled={analyzing} className="text-xs bg-purple-900/50 text-purple-400 px-2 py-1 rounded hover:bg-purple-800 flex items-center border border-purple-700">
                                                <i className={`fa-solid fa-wand-magic-sparkles mr-1 ${analyzing ? 'fa-spin' : ''}`}></i> Generate with AI
                                            </button>
                                        </div>
                                        <textarea rows={4} value={issue.solutionSummary} onChange={e => handleChange('solutionSummary', e.target.value)} className="block w-full rounded bg-slate-800 border-slate-600 text-white p-2 placeholder:text-slate-500" placeholder="A polished summary of the fix..." />
                                    </div>
                                </div>
                            ) : (
                                <div className="border border-slate-700 rounded-lg p-6 bg-slate-800 text-slate-500">
                                    <div className="flex items-center gap-2 font-bold text-sm uppercase mb-1">
                                        <i className="fa-solid fa-lock"></i>
                                        Resolution - What Actually Fixed It
                                    </div>
                                    <p className="text-xs">Mark issue as resolved (top right) to document the final solution</p>
                                </div>
                            )}
                        </div>
                    )}

                    {tab === 'media' && (
                        <div className="max-w-6xl mx-auto space-y-8">
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                <MediaBucket title="Issue Photos" bucket="issue_photos" attachments={issue.attachments} onUpload={handleFileUpload} onRemove={removeAttachment} />
                                <MediaBucket title="Created Digital Media" bucket="created_media" attachments={issue.attachments} onUpload={handleFileUpload} onRemove={removeAttachment} />
                                <MediaBucket title="Received Digital Media" bucket="received_media" attachments={issue.attachments} onUpload={handleFileUpload} onRemove={removeAttachment} />
                                <MediaBucket title="WeChat Screenshots" bucket="wechat" attachments={issue.attachments} onUpload={handleFileUpload} onRemove={removeAttachment} />
                                <MediaBucket title="Old Machine Backup" bucket="old_backup" attachments={issue.attachments} onUpload={handleFileUpload} onRemove={removeAttachment} />
                                <MediaBucket title="New Machine Backup" bucket="new_backup" attachments={issue.attachments} onUpload={handleFileUpload} onRemove={removeAttachment} />
                            </div>
                        </div>
                    )}

                    {tab === 'parts' && (
                        <div className="max-w-5xl mx-auto space-y-8">
                            <PartsList title="Parts Used" type="used" parts={issue.parts} onAdd={() => addPart('used')} onUpdate={updatePart} onRemove={removePart} />
                            <PartsList title="Parts Needed" type="needed" parts={issue.parts} onAdd={() => addPart('needed')} onUpdate={updatePart} onRemove={removePart} />
                            <PartsList title="Waiting on Parts" type="waiting" parts={issue.parts} onAdd={() => addPart('waiting')} onUpdate={updatePart} onRemove={removePart} />
                        </div>
                    )}

                    {tab === 'other' && (
                        <div className="max-w-3xl mx-auto space-y-6">
                            <div className="bg-slate-800 border border-slate-700 rounded-lg p-4 flex justify-between items-center shadow-lg">
                                <div>
                                    <h4 className="font-bold text-white">Follow Up Required</h4>
                                    <p className="text-sm text-slate-400">Flag this issue for office follow-up</p>
                                </div>
                                <button
                                    onClick={() => handleChange('followUpRequired', !issue.followUpRequired)}
                                    className={`w-12 h-6 rounded-full p-1 transition-colors relative ${issue.followUpRequired ? 'bg-red-600' : 'bg-slate-600'}`}
                                >
                                    <div className={`w-4 h-4 bg-white rounded-full shadow-sm transform transition-transform ${issue.followUpRequired ? 'translate-x-6' : ''}`}></div>
                                </button>
                            </div>

                            <div className="bg-slate-800 border border-slate-700 rounded-lg p-4 flex justify-between items-center shadow-lg">
                                <div>
                                    <h4 className="font-bold text-white">Add to MFG Report</h4>
                                    <p className="text-sm text-slate-400">Include this issue in the manufacturer report artifact</p>
                                </div>
                                <button
                                    onClick={() => handleChange('addToMfgReport', !issue.addToMfgReport)}
                                    className={`w-12 h-6 rounded-full p-1 transition-colors relative ${issue.addToMfgReport ? 'bg-red-600' : 'bg-slate-600'}`}
                                >
                                    <div className={`w-4 h-4 bg-white rounded-full shadow-sm transform transition-transform ${issue.addToMfgReport ? 'translate-x-6' : ''}`}></div>
                                </button>
                            </div>
                        </div>
                    )}

                </div>

                {/* Footer */}
                <div className="px-6 py-4 border-t border-slate-700 bg-slate-800 rounded-b-lg flex justify-end space-x-3">
                    <button onClick={onClose} className="px-4 py-2 bg-slate-700 border border-slate-600 rounded text-slate-300 hover:bg-slate-600 font-medium">Cancel</button>
                    <button onClick={() => onSave(issue)} className="px-6 py-2 bg-red-600 text-white rounded shadow hover:bg-red-500 font-medium flex items-center">
                        <i className="fa-regular fa-floppy-disk mr-2"></i> Save Issue
                    </button>
                </div>

            </div>
        </div>
    );
};

// --- Subcomponents ---

const FieldAttachments: React.FC<{
    attachments: Attachment[];
    onRemove: (id: string) => void;
}> = ({ attachments, onRemove }) => {
    if (!attachments || attachments.length === 0) return null;
    return (
        <div className="flex flex-wrap gap-2 mt-2">
            {attachments.map(att => (
                <div key={att.id} className="relative group w-16 h-16 border border-slate-600 rounded overflow-hidden bg-slate-800">
                    {att.fileType.startsWith('image/') ? (
                        <img src={att.data || att.url} alt={att.fileName} className="w-full h-full object-cover" />
                    ) : (
                         <div className="w-full h-full flex items-center justify-center bg-slate-800 text-slate-500 text-xs text-center p-1 break-words leading-tight">
                            <div>
                                <i className="fa-regular fa-file mb-1"></i>
                                <div>{att.fileName.split('.').pop()}</div>
                            </div>
                        </div>
                    )}
                    <button onClick={() => onRemove(att.id)} className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 flex items-center justify-center text-white transition-opacity">
                        <i className="fa-solid fa-xmark text-sm"></i>
                    </button>
                    {att.uploading && (
                         <div className="absolute inset-0 bg-slate-900/70 flex items-center justify-center">
                            <i className="fa-solid fa-circle-notch fa-spin text-red-500 text-xs"></i>
                        </div>
                    )}
                </div>
            ))}
        </div>
    );
};

const Input: React.FC<{
    id?: string;
    label: string;
    value: string;
    onChange: (v: string) => void;
    placeholder?: string;
    onUpload?: (files: FileList | null) => void;
    attachments?: Attachment[];
    onRemoveAttachment?: (id: string) => void;
}> = ({label, value, onChange, placeholder, onUpload, attachments, onRemoveAttachment, id}) => {
    const fileInputRef = useRef<HTMLInputElement>(null);
    return (
        <div className="relative">
            <label className="block text-sm font-bold text-slate-300 uppercase tracking-wide mb-1">{label}</label>
            <div className="relative">
                <input
                    type="text"
                    value={value}
                    onChange={e => onChange(e.target.value)}
                    className="block w-full rounded bg-slate-800 border-slate-600 text-white p-2 pr-10 focus:ring-red-500 focus:border-red-500 placeholder:text-slate-500"
                    placeholder={placeholder}
                />
                {onUpload && (
                    <button
                        className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-500 hover:text-red-500 p-1"
                        onClick={() => fileInputRef.current?.click()}
                        title="Add Photo"
                    >
                        <i className="fa-solid fa-camera"></i>
                    </button>
                )}
            </div>
            {onUpload && <input type="file" ref={fileInputRef} hidden onChange={e => onUpload(e.target.files)} />}
            {attachments && onRemoveAttachment && <FieldAttachments attachments={attachments} onRemove={onRemoveAttachment} />}
        </div>
    );
};

const ListSection: React.FC<{
    title: string;
    subtitle: string;
    items: {id: string, text: string}[];
    emptyLabel: string;
    btnLabel: string;
    onAdd: () => void;
    onChange: (id: string, val: string) => void;
    onDelete: (id: string) => void;
    onUpload: (id: string, files: FileList | null) => void;
    getAttachments: (id: string) => Attachment[];
    onRemoveAttachment: (id: string) => void;
}> = ({ title, subtitle, items, emptyLabel, btnLabel, onAdd, onChange, onDelete, onUpload, getAttachments, onRemoveAttachment }) => (
    <div>
        <div className="flex justify-between items-start mb-4">
            <div>
                <h3 className="font-bold text-slate-300 uppercase tracking-wide">{title}</h3>
                <p className="text-xs text-slate-500">{subtitle}</p>
            </div>
            <button onClick={onAdd} className="text-sm border border-slate-600 rounded px-3 py-1 hover:bg-red-600 hover:border-red-600 hover:text-white text-slate-400 bg-slate-800 transition-colors">
                <i className="fa-solid fa-plus mr-1"></i> {btnLabel}
            </button>
        </div>

        {items.length === 0 ? (
            <div className="text-center text-slate-500 py-4 text-sm font-medium">
                {emptyLabel}
            </div>
        ) : (
            <div className="space-y-4">
                {items.map(item => (
                    <div key={item.id}>
                        <div className="flex gap-2 items-start">
                            <input
                                value={item.text}
                                onChange={(e) => onChange(item.id, e.target.value)}
                                className="flex-1 rounded bg-slate-800 border-slate-600 text-white p-2 text-sm focus:ring-red-500 focus:border-red-500 placeholder:text-slate-500"
                                placeholder="Enter details..."
                                autoFocus={item.text === ''}
                            />
                             {/* File Input Wrapper */}
                             <label className="text-slate-500 hover:text-red-500 px-2 py-2 cursor-pointer">
                                <i className="fa-solid fa-camera"></i>
                                <input type="file" hidden onChange={e => onUpload(item.id, e.target.files)} />
                             </label>
                            <button onClick={() => onDelete(item.id)} className="text-slate-500 hover:text-red-500 px-2 py-2">
                                <i className="fa-solid fa-trash"></i>
                            </button>
                        </div>
                        <FieldAttachments attachments={getAttachments(item.id)} onRemove={onRemoveAttachment} />
                    </div>
                ))}
            </div>
        )}
    </div>
);

const ResolutionField: React.FC<{
    id?: string;
    label: string;
    value: string;
    onChange: (val: string) => void;
    placeholder?: string;
    rows?: number;
    onUpload?: (files: FileList | null) => void;
    attachments?: Attachment[];
    onRemoveAttachment?: (id: string) => void;
    onToggleRecord?: () => void;
    isRecording?: boolean;
}> = ({ label, value, onChange, placeholder, rows = 2, onUpload, attachments, onRemoveAttachment, onToggleRecord, isRecording }) => {
    const fileInputRef = useRef<HTMLInputElement>(null);
    return (
        <div>
            <label className="block text-sm font-bold text-slate-400 mb-1">{label}</label>
            <div className="bg-slate-800 p-1 rounded border border-slate-600 focus-within:ring-2 focus-within:ring-red-500/50 focus-within:border-red-500 relative">
                 <textarea
                    rows={rows}
                    className="block w-full border-none bg-transparent p-2 resize-none focus:ring-0 text-white placeholder-slate-500 sm:text-sm"
                    placeholder={placeholder}
                    value={value}
                    onChange={e => onChange(e.target.value)}
                />
                <div className="mt-1 flex items-center space-x-2">
                     <button
                        onClick={() => fileInputRef.current?.click()}
                        className="inline-flex items-center px-2 py-1 border border-slate-600 shadow-sm text-xs font-medium rounded text-slate-400 bg-slate-700 hover:bg-slate-600 hover:text-white transition-colors"
                     >
                        <i className="fa-solid fa-arrow-up-from-bracket mr-1"></i> Add Photo
                     </button>
                     {onToggleRecord && (
                         <button
                            onClick={onToggleRecord}
                            className={`inline-flex items-center px-2 py-1 border shadow-sm text-xs font-medium rounded transition-colors ${
                                isRecording
                                ? 'bg-red-900/50 border-red-600 text-red-400 animate-pulse'
                                : 'bg-slate-700 border-slate-600 text-slate-400 hover:bg-slate-600 hover:text-white'
                            }`}
                         >
                            <i className={`fa-solid ${isRecording ? 'fa-stop' : 'fa-microphone'} mr-1`}></i>
                            {isRecording ? 'Stop Recording' : 'Dictate'}
                         </button>
                     )}
                     {onUpload && <input type="file" ref={fileInputRef} hidden onChange={e => onUpload(e.target.files)} />}
                </div>
            </div>
            {attachments && onRemoveAttachment && <FieldAttachments attachments={attachments} onRemove={onRemoveAttachment} />}
        </div>
    );
};

const MediaBucket: React.FC<{
    title: string;
    bucket: Attachment['bucket'];
    attachments: Attachment[];
    onUpload: (files: FileList | null, bucket: Attachment['bucket']) => void;
    onRemove: (id: string) => void;
}> = ({ title, bucket, attachments, onUpload, onRemove }) => {
    const relevant = attachments.filter(a => a.bucket === bucket);
    const inputRef = useRef<HTMLInputElement>(null);

    return (
        <div
            className="border-2 border-dashed border-slate-600 rounded-lg p-4 bg-slate-800 hover:bg-slate-700 hover:border-slate-500 transition-colors cursor-pointer min-h-[150px] flex flex-col"
            onClick={() => inputRef.current?.click()}
            onDragOver={e => e.preventDefault()}
            onDrop={e => {
                e.preventDefault();
                onUpload(e.dataTransfer.files, bucket);
            }}
        >
            <div className="flex justify-between items-start mb-2 pointer-events-none">
                <h4 className="font-bold text-slate-300 text-sm uppercase">{title}</h4>
                <span className="bg-slate-700 text-slate-400 text-xs px-2 py-0.5 rounded-full">{relevant.length}</span>
            </div>

            <input type="file" multiple className="hidden" ref={inputRef} onChange={e => onUpload(e.target.files, bucket)} />

            {relevant.length === 0 ? (
                <div className="flex-1 flex flex-col items-center justify-center text-slate-500 pointer-events-none">
                    <i className="fa-solid fa-cloud-arrow-up text-2xl mb-1"></i>
                    <span className="text-xs">Drag files or click to upload</span>
                </div>
            ) : (
                <div className="grid grid-cols-3 gap-2 mt-2" onClick={e => e.stopPropagation()}>
                    {relevant.map(att => (
                        <div key={att.id} className="relative group bg-slate-900 border border-slate-600 rounded overflow-hidden aspect-square flex items-center justify-center">
                            {att.fileType.startsWith('image/') ? (
                                <img src={att.data || att.url} alt={att.fileName} className="w-full h-full object-cover" />
                            ) : (
                                <div className="text-center p-1">
                                    <i className="fa-regular fa-file text-xl text-slate-500 mb-1"></i>
                                    <p className="text-[9px] truncate w-full px-1 text-slate-400">{att.fileName}</p>
                                </div>
                            )}

                            {/* Overlay */}
                            <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center space-x-2">
                                <button onClick={() => onRemove(att.id)} className="text-white hover:text-red-400"><i className="fa-solid fa-trash"></i></button>
                            </div>

                            {att.uploading && (
                                <div className="absolute inset-0 bg-slate-900/80 flex items-center justify-center">
                                    <i className="fa-solid fa-circle-notch fa-spin text-red-500"></i>
                                </div>
                            )}
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
};

const PartsList: React.FC<{
    title: string;
    type: PartEntry['type'];
    parts: PartEntry[];
    onAdd: () => void;
    onUpdate: (id: string, field: keyof PartEntry, val: string) => void;
    onRemove: (id: string) => void;
}> = ({ title, type, parts, onAdd, onUpdate, onRemove }) => {
    const relevant = parts.filter(p => p.type === type);

    return (
        <div className="border border-slate-700 rounded-lg overflow-hidden bg-slate-800 shadow-lg">
            <div className="bg-slate-800 px-4 py-3 border-b border-slate-700 flex justify-between items-center">
                <h4 className="font-bold text-slate-300 uppercase tracking-wide text-sm">{title}</h4>
                <button onClick={onAdd} className="text-xs bg-slate-700 border border-slate-600 text-slate-300 px-2 py-1 rounded hover:bg-red-600 hover:text-white hover:border-red-600 transition-colors">
                    <i className="fa-solid fa-plus mr-1"></i> Add Part
                </button>
            </div>

            {relevant.length === 0 ? (
                <div className="p-6 text-center text-slate-500 text-sm">No parts listed</div>
            ) : (
                <div className="overflow-x-auto">
                    <table className="w-full text-sm text-left">
                        <thead className="bg-slate-700 text-slate-400 font-medium">
                            <tr>
                                <th className="px-4 py-2 w-1/4">Part #</th>
                                <th className="px-4 py-2 w-1/3">Description</th>
                                <th className="px-4 py-2 w-20">Qty</th>
                                <th className="px-4 py-2">Notes</th>
                                <th className="w-10"></th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-700">
                            {relevant.map(part => (
                                <tr key={part.id} className="hover:bg-slate-700">
                                    <td className="p-2"><input className="w-full bg-slate-900 border-slate-600 text-white rounded px-2 py-1 placeholder:text-slate-500" value={part.partNumber} onChange={e => onUpdate(part.id, 'partNumber', e.target.value)} placeholder="Part #" /></td>
                                    <td className="p-2"><input className="w-full bg-slate-900 border-slate-600 text-white rounded px-2 py-1 placeholder:text-slate-500" value={part.description} onChange={e => onUpdate(part.id, 'description', e.target.value)} placeholder="Desc" /></td>
                                    <td className="p-2"><input className="w-full bg-slate-900 border-slate-600 text-white rounded px-2 py-1 text-center" value={part.quantity} onChange={e => onUpdate(part.id, 'quantity', e.target.value)} /></td>
                                    <td className="p-2"><input className="w-full bg-slate-900 border-slate-600 text-white rounded px-2 py-1 placeholder:text-slate-500" value={part.notes} onChange={e => onUpdate(part.id, 'notes', e.target.value)} placeholder="Notes" /></td>
                                    <td className="p-2 text-center"><button onClick={() => onRemove(part.id)} className="text-slate-500 hover:text-red-500"><i className="fa-solid fa-trash"></i></button></td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            )}
        </div>
    );
};
