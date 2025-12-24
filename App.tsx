
import React, { useState, useEffect } from 'react';
import { Layout } from './components/Layout';
import { ReportEditor } from './components/ReportEditor';
import { User, ServiceReport, Issue, PartEntry, Customer } from './types';
import { saveLocalReport, getAllLocalReports } from './services/db';
import { generateEdgeCaseReportContent } from './services/geminiService';
import { fetchCustomerDirectory } from './services/workDriveService';
import { generateUUID } from './utils/helpers';
import { generateHTML, generateMarkdown } from './utils/exportUtils';

// Define window.google for TypeScript
declare global {
  interface Window {
    google: any;
  }
}

// Mock Auth for Fallback
const MOCK_USER: User = {
    email: 'tech@xovrcncparts.com',
    name: 'Alex Technician',
    role: 'ADMIN' 
};

const DEFAULT_CLIENT_ID = "592806790454-8jaqbc8js7481d72tk6ltde2fj60hmlb.apps.googleusercontent.com";

const App: React.FC = () => {
    const [user, setUser] = useState<User | null>(null);
    const [view, setView] = useState<'list' | 'editor'>('list');
    const [currentReportId, setCurrentReportId] = useState<string | undefined>(undefined);
    const [generating, setGenerating] = useState(false);
    const [reports, setReports] = useState<ServiceReport[]>([]);
    const [loadingReports, setLoadingReports] = useState(false);
    
    // Auth Configuration State
    const [clientId, setClientId] = useState(DEFAULT_CLIENT_ID);
    const [scriptLoaded, setScriptLoaded] = useState(false);
    const [showAuthConfig, setShowAuthConfig] = useState(false);

    // Initial Load of Reports
    useEffect(() => {
        if (user && view === 'list') {
            loadReports();
        }
    }, [user, view]);

    // robust script loading check
    useEffect(() => {
        const checkScript = () => {
            if (window.google?.accounts?.id) {
                setScriptLoaded(true);
                return true;
            }
            return false;
        };

        if (!checkScript()) {
            const timer = setInterval(() => {
                if (checkScript()) clearInterval(timer);
            }, 200);
            return () => clearInterval(timer);
        }
    }, []);

    // Google Auth Initialization
    useEffect(() => {
        if (!user && scriptLoaded && clientId) {
            const handleCredentialResponse = (response: any) => {
                try {
                    // Decode JWT Payload
                    const base64Url = response.credential.split('.')[1];
                    const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
                    const jsonPayload = decodeURIComponent(window.atob(base64).split('').map(function(c) {
                        return '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2);
                    }).join(''));

                    const payload = JSON.parse(jsonPayload);

                    setUser({
                        email: payload.email,
                        name: payload.name,
                        picture: payload.picture,
                        role: 'ADMIN' // Default to Admin for this demo app
                    });
                } catch (e) {
                    console.error("Failed to decode Google Credential", e);
                    alert("Failed to decode Google login token.");
                }
            };

            try {
                window.google.accounts.id.initialize({
                    client_id: clientId,
                    callback: handleCredentialResponse,
                    auto_select: false,
                    cancel_on_tap_outside: true
                });

                const btnParent = document.getElementById("googleSignInBtn");
                if (btnParent) {
                    btnParent.innerHTML = ''; // Clear previous instances
                    window.google.accounts.id.renderButton(
                        btnParent,
                        { theme: "outline", size: "large", width: 280, text: "signin_with" }
                    );
                }
            } catch (err) {
                console.error("Google Auth Init Error:", err);
            }
        }
    }, [user, scriptLoaded, clientId]);

    const loadReports = async () => {
        setLoadingReports(true);
        try {
            const data = await getAllLocalReports();
            // Sort by updatedAt descending (newest first)
            const sorted = data.sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());
            setReports(sorted);
        } catch (e) {
            console.error("Failed to load reports", e);
        } finally {
            setLoadingReports(false);
        }
    };

    const handleDemoLogin = () => {
        setUser(MOCK_USER);
    };

    const downloadArtifact = (e: React.MouseEvent, report: ServiceReport, type: 'html' | 'json' | 'md') => {
        e.stopPropagation();
        let content = '';
        let mime = '';
        let ext = '';

        try {
            if (type === 'html') {
                content = generateHTML(report);
                mime = 'text/html';
                ext = 'html';
            } else if (type === 'md') {
                content = generateMarkdown(report);
                mime = 'text/markdown';
                ext = 'md';
            } else {
                // remove private sync state
                const { _syncState, ...clean } = report;
                content = JSON.stringify(clean, null, 2);
                mime = 'application/json';
                ext = 'json';
            }

            const filename = `ServiceReport_${report.reportId || 'Draft'}_${report.customer?.companyName || 'Unknown'}.${ext}`;
            const blob = new Blob([content], { type: mime });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = filename;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(url);
        } catch (err) {
            alert("Error generating artifact: " + err);
        }
    };

    const handleGenerateTestReport = async () => {
        setGenerating(true);
        try {
            // 1. Fetch AI Content
            const aiData = await generateEdgeCaseReportContent();
            
            // 2. Fetch a random customer to attach
            const customers = await fetchCustomerDirectory();
            const randomCustomer: Customer = customers[0] || { 
                id: 'mock', 
                companyName: 'Mock Corp',
                contactPerson: 'Mock Contact',
                position: 'Manager',
                address: '123 Mock Blvd',
                phone: '555-0123'
            };

            // 3. Construct full report object
            const newId = generateUUID();
            const now = new Date().toISOString();
            
            const newReport: ServiceReport = {
                id: newId,
                status: 'DRAFT',
                createdAt: now,
                updatedAt: now,
                createdBy: user?.email || '',
                technicianName: user?.name || '',
                arrivalDate: now.split('T')[0],
                departureDate: '',
                serviceTypes: ['Billable Repair', 'Emergency'],
                customer: randomCustomer,
                machine: aiData.machine || { serialNumber: 'UNK', modelNumber: 'UNK', machineType: 'UNK', controllerType: 'UNK', softwareVersion: '' },
                summary: aiData.summary || "Auto-generated stress test report.",
                attachments: [], // Start empty, could generate mock attachments if needed
                parts: [],
                followUpRequired: true,
                designSuggestion: { current: '', problem: '', change: '' },
                internalSuggestion: 'Check AI generated content for accuracy.',
                toolsBought: [],
                toolsUsed: [],
                newNameplates: [],
                issues: (aiData.issues || []).map((iss: any) => ({
                    id: generateUUID(),
                    title: iss.title || 'Untitled Issue',
                    category: iss.category || 'Not Specified',
                    resolved: !!iss.resolved,
                    urgency: iss.urgency || 'Medium',
                    description: iss.description || '',
                    proposedFixes: (iss.proposedFixes || []).map((t: string) => ({ id: generateUUID(), text: t })),
                    troubleshootingSteps: (iss.troubleshootingSteps || []).map((t: string) => ({ id: generateUUID(), text: t })),
                    rootCause: iss.rootCause || '',
                    fixApplied: iss.fixApplied || '',
                    verifiedBy: iss.verifiedBy || '',
                    notes: iss.notes || '',
                    solutionSummary: iss.solutionSummary || '',
                    attachments: [],
                    parts: [],
                    addToMfgReport: Math.random() > 0.5,
                    followUpRequired: Math.random() > 0.8
                })),
                _syncState: { lastSaved: now, dirty: true, uploadQueue: [], version: 1, isOffline: false }
            };

            // 4. Save and Open
            await saveLocalReport(newReport);
            setCurrentReportId(newId);
            setView('editor');

        } catch (e) {
            console.error(e);
            alert("Failed to generate report: " + e);
        } finally {
            setGenerating(false);
        }
    };

    if (!user) {
        return (
            <div className="h-screen flex items-center justify-center bg-gray-100 p-4">
                <div className="bg-white p-8 rounded-lg shadow-lg text-center max-w-sm w-full">
                    <div className="text-4xl text-brand-600 mb-4"><i className="fa-solid fa-screwdriver-wrench"></i></div>
                    <h1 className="text-2xl font-bold text-gray-800 mb-2">XOVR Service Pro</h1>
                    <p className="text-gray-500 mb-6">Sign in to generate technician profile</p>
                    
                    {/* Google Sign In Container */}
                    <div className="flex justify-center mb-4 min-h-[40px] relative">
                        {!scriptLoaded && (
                            <div className="absolute inset-0 flex items-center justify-center text-gray-400 text-sm">
                                <i className="fa-solid fa-circle-notch fa-spin mr-2"></i> Loading Auth...
                            </div>
                        )}
                        <div id="googleSignInBtn"></div>
                    </div>

                    <div className="relative flex py-2 items-center">
                        <div className="flex-grow border-t border-gray-300"></div>
                        <span className="flex-shrink-0 mx-4 text-gray-400 text-xs uppercase">Or</span>
                        <div className="flex-grow border-t border-gray-300"></div>
                    </div>

                    <button onClick={handleDemoLogin} className="w-full bg-gray-50 border border-gray-300 text-gray-700 font-medium py-2 px-4 rounded shadow-sm hover:bg-gray-100 flex items-center justify-center gap-2 mt-2 text-sm">
                        <i className="fa-solid fa-user-ninja"></i>
                        Demo Account
                    </button>
                    
                    {/* Config Toggle */}
                    <div className="mt-8 pt-4 border-t border-gray-100">
                        <button 
                            onClick={() => setShowAuthConfig(!showAuthConfig)} 
                            className="text-xs text-gray-400 hover:text-gray-600 flex items-center justify-center w-full"
                        >
                            <i className="fa-solid fa-gear mr-1"></i> 
                            {showAuthConfig ? 'Hide Configuration' : 'Configuration'}
                        </button>
                        
                        {showAuthConfig && (
                            <div className="mt-3 text-left">
                                <label className="block text-xs font-bold text-gray-500 mb-1">Google Client ID</label>
                                <input 
                                    type="text" 
                                    value={clientId}
                                    onChange={(e) => setClientId(e.target.value)}
                                    className="w-full text-xs border rounded p-2 bg-gray-50 text-gray-600 break-all"
                                />
                                <p className="text-[10px] text-gray-400 mt-1">
                                    If you see "401 invalid_client", your current domain/port is not whitelisted for this ID.
                                </p>
                            </div>
                        )}
                    </div>
                </div>
            </div>
        );
    }

    if (view === 'editor') {
        return (
            <ReportEditor 
                reportId={currentReportId}
                userEmail={user.email} 
                userName={user.name} 
                onClose={() => {
                    setView('list');
                    setCurrentReportId(undefined);
                    loadReports(); // Refresh list on return
                }} 
            />
        );
    }

    return (
        <Layout user={user} onLogout={() => setUser(null)} title="Dashboard" actions={
            <div className="flex gap-2">
                <button onClick={() => { setCurrentReportId(undefined); setView('editor'); }} className="bg-brand-600 text-white px-4 py-2 rounded text-sm font-medium shadow hover:bg-brand-700">
                    <i className="fa-solid fa-plus mr-2"></i> New Report
                </button>
            </div>
        }>
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* Main Dashboard Area */}
                <div className="lg:col-span-2 space-y-6">
                    <div className="bg-white border rounded shadow-sm p-6">
                        <div className="flex justify-between items-center mb-4">
                             <h2 className="text-lg font-medium text-gray-900">Recent Reports</h2>
                             <button onClick={loadReports} className="text-gray-400 hover:text-brand-600"><i className="fa-solid fa-rotate-right"></i></button>
                        </div>
                        
                        {loadingReports ? (
                            <div className="py-8 text-center text-gray-400"><i className="fa-solid fa-circle-notch fa-spin"></i> Loading...</div>
                        ) : reports.length === 0 ? (
                            <div className="border border-dashed border-gray-200 rounded p-8 text-center">
                                <p className="text-gray-400 italic">No recent reports found locally.</p>
                                <button onClick={() => { setCurrentReportId(undefined); setView('editor'); }} className="mt-2 text-brand-600 hover:underline text-sm">Create your first report</button>
                            </div>
                        ) : (
                            <div className="space-y-3">
                                {reports.map(report => (
                                    <div 
                                        key={report.id} 
                                        onClick={() => { setCurrentReportId(report.id); setView('editor'); }}
                                        className="border rounded p-4 hover:shadow-md transition-shadow cursor-pointer bg-white group relative"
                                    >
                                        <div className="flex justify-between items-start mb-2">
                                            <div>
                                                <h3 className="font-bold text-gray-800">
                                                    {report.customer?.companyName || 'Unassigned Customer'}
                                                </h3>
                                                <div className="text-xs text-gray-500 flex items-center gap-2">
                                                    <span><i className="fa-regular fa-calendar mr-1"></i> {report.arrivalDate}</span>
                                                    <span>•</span>
                                                    <span>{report.reportId || 'Draft'}</span>
                                                </div>
                                            </div>
                                            <span className={`px-2 py-1 rounded text-xs font-bold ${report.status === 'COMPLETED' ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-600'}`}>
                                                {report.status}
                                            </span>
                                        </div>
                                        <div className="text-sm text-gray-600 line-clamp-2 mb-2">
                                            {report.summary || 'No summary provided...'}
                                        </div>
                                        
                                        {/* Actions Footer */}
                                        <div className="flex justify-between items-center text-xs text-gray-400 border-t pt-2 mt-2">
                                            <span>Issues: {report.issues?.length || 0}</span>
                                            
                                            {report.status === 'COMPLETED' && (
                                                <div className="flex space-x-2">
                                                    <button 
                                                        onClick={(e) => downloadArtifact(e, report, 'html')}
                                                        className="text-brand-600 hover:underline bg-brand-50 px-2 py-0.5 rounded border border-brand-100"
                                                        title="Download HTML Report"
                                                    >
                                                        HTML
                                                    </button>
                                                    <button 
                                                        onClick={(e) => downloadArtifact(e, report, 'json')}
                                                        className="text-gray-600 hover:underline bg-gray-50 px-2 py-0.5 rounded border border-gray-200"
                                                        title="Download JSON Data"
                                                    >
                                                        JSON
                                                    </button>
                                                </div>
                                            )}
                                            
                                            {report.status !== 'COMPLETED' && (
                                                <span className="group-hover:text-brand-600">Open <i className="fa-solid fa-chevron-right ml-1"></i></span>
                                            )}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>

                    <h3 className="text-sm font-bold text-gray-500 uppercase tracking-wide">System Status</h3>
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                        <StatusCard icon="fa-wifi" label="WorkDrive Connection" status="Connected" color="green" />
                        <StatusCard icon="fa-database" label="Local Cache" status="Active" color="green" />
                        <StatusCard icon="fa-bolt" label="Gemini AI" status="Ready" color="purple" />
                    </div>
                </div>

                {/* Admin / Sidebar Area */}
                <div className="space-y-6">
                    {user.role === 'ADMIN' && (
                        <div className="bg-slate-800 text-white rounded-lg shadow p-5">
                            <h3 className="font-bold text-sm uppercase tracking-wider mb-4 border-b border-slate-600 pb-2 flex items-center">
                                <i className="fa-solid fa-user-shield mr-2"></i> Admin Tools
                            </h3>
                            <p className="text-xs text-slate-300 mb-4">
                                Use these tools to manage system configuration and stress-test the application.
                            </p>
                            
                            <div className="space-y-3">
                                <button 
                                    onClick={handleGenerateTestReport}
                                    disabled={generating}
                                    className="w-full bg-indigo-600 hover:bg-indigo-700 disabled:bg-indigo-800 text-white text-sm font-medium py-2 px-3 rounded flex items-center justify-between transition-colors"
                                >
                                    <span>
                                        {generating ? <i className="fa-solid fa-circle-notch fa-spin mr-2"></i> : <i className="fa-solid fa-robot mr-2"></i>}
                                        {generating ? 'Generating...' : 'Gen. Edge Case Report'}
                                    </span>
                                    <i className="fa-solid fa-chevron-right text-xs opacity-50"></i>
                                </button>

                                <button className="w-full bg-slate-700 hover:bg-slate-600 text-slate-200 text-sm font-medium py-2 px-3 rounded flex items-center justify-between transition-colors">
                                    <span><i className="fa-solid fa-users-gear mr-2"></i> Manage Techs</span>
                                    <i className="fa-solid fa-chevron-right text-xs opacity-50"></i>
                                </button>
                                
                                <button className="w-full bg-slate-700 hover:bg-slate-600 text-slate-200 text-sm font-medium py-2 px-3 rounded flex items-center justify-between transition-colors">
                                    <span><i className="fa-solid fa-list-check mr-2"></i> Edit Categories</span>
                                    <i className="fa-solid fa-chevron-right text-xs opacity-50"></i>
                                </button>
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </Layout>
    );
};

const StatusCard: React.FC<{icon: string, label: string, status: string, color: string}> = ({icon, label, status, color}) => (
    <div className="bg-white p-4 rounded border shadow-sm flex items-center space-x-3">
        <div className={`w-10 h-10 rounded-full bg-${color}-100 flex items-center justify-center text-${color}-600`}>
            <i className={`fa-solid ${icon}`}></i>
        </div>
        <div>
            <div className="text-xs text-gray-500 uppercase">{label}</div>
            <div className="font-semibold">{status}</div>
        </div>
    </div>
);

export default App;
