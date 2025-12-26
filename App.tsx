import React, { useState, useEffect } from 'react';
import { Layout } from './components/Layout';
import { ReportEditor } from './components/ReportEditor';
import { ServiceReport, Customer } from './types';
import { saveLocalReport, getAllLocalReports } from './services/db';
import { generateEdgeCaseReportContent } from './services/geminiService';
import { fetchCustomerDirectory } from './services/workDriveService';
import { generateUUID } from './utils/helpers';
import { generateHTML, generateMarkdown } from './utils/exportUtils';
import { useAuth, RequireAuth, RequireAdmin, LoginPage } from './src/auth';
import { AuthDebugPanel } from './src/components/AuthDebugPanel';

const App: React.FC = () => {
    const { user, loading, signOut } = useAuth();
    const [view, setView] = useState<'list' | 'editor'>('list');
    const [currentReportId, setCurrentReportId] = useState<string | undefined>(undefined);
    const [generating, setGenerating] = useState(false);
    const [reports, setReports] = useState<ServiceReport[]>([]);
    const [loadingReports, setLoadingReports] = useState(false);

    // Initial Load of Reports
    useEffect(() => {
        if (user && view === 'list') {
            loadReports();
        }
    }, [user, view]);

    const loadReports = async () => {
        setLoadingReports(true);
        try {
            const data = await getAllLocalReports();
            const sorted = data.sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());
            setReports(sorted);
        } catch (e) {
            console.error("Failed to load reports", e);
        } finally {
            setLoadingReports(false);
        }
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
        if (!user) return;
        setGenerating(true);
        try {
            const aiData = await generateEdgeCaseReportContent();
            const customers = await fetchCustomerDirectory();
            const randomCustomer: Customer = customers[0] || {
                id: 'mock',
                companyName: 'Mock Corp',
                contactPerson: 'Mock Contact',
                position: 'Manager',
                address: '123 Mock Blvd',
                phone: '555-0123'
            };

            const newId = generateUUID();
            const now = new Date().toISOString();

            const newReport: ServiceReport = {
                id: newId,
                status: 'DRAFT',
                createdAt: now,
                updatedAt: now,
                createdBy: user.email,
                technicianName: user.name,
                arrivalDate: now.split('T')[0],
                departureDate: '',
                serviceTypes: ['Billable Repair', 'Emergency'],
                customer: randomCustomer,
                machine: aiData.machine || { serialNumber: 'UNK', modelNumber: 'UNK', machineType: 'UNK', controllerType: 'UNK', softwareVersion: '' },
                summary: aiData.summary || "Auto-generated stress test report.",
                attachments: [],
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

    // Show loading while checking auth
    if (loading) {
        return (
            <div className="h-screen flex items-center justify-center bg-slate-950">
                <div className="text-center">
                    <i className="fa-solid fa-circle-notch fa-spin text-red-500 text-3xl mb-4"></i>
                    <p className="text-slate-400">Loading...</p>
                </div>
            </div>
        );
    }

    // Show login page if not authenticated
    if (!user) {
        return <LoginPage />;
    }

    // Editor view
    if (view === 'editor') {
        return (
            <ReportEditor
                reportId={currentReportId}
                userEmail={user.email}
                userName={user.name}
                onClose={() => {
                    setView('list');
                    setCurrentReportId(undefined);
                    loadReports();
                }}
            />
        );
    }

    // Dashboard view
    return (
        <>
        <AuthDebugPanel />
        <Layout user={user} onLogout={signOut} title="Dashboard" actions={
            <button onClick={() => { setCurrentReportId(undefined); setView('editor'); }} className="bg-green-600 text-white px-3 py-1.5 rounded-md text-xs font-semibold shadow hover:bg-green-500 transition-colors flex items-center gap-1.5">
                <i className="fa-solid fa-plus"></i>
                <span>New Report</span>
            </button>
        }>
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* Main Dashboard Area */}
                <div className="lg:col-span-2 space-y-6">
                    <div className="bg-slate-900 border border-slate-800 rounded-xl shadow-lg p-5">
                        <div className="flex justify-between items-center mb-3">
                             <h2 className="text-base font-semibold text-white">Recent Reports</h2>
                             <button onClick={loadReports} className="text-slate-500 hover:text-red-500 transition-colors text-sm"><i className="fa-solid fa-rotate-right"></i></button>
                        </div>

                        {loadingReports ? (
                            <div className="py-6 text-center text-slate-500 text-xs"><i className="fa-solid fa-circle-notch fa-spin"></i> Loading...</div>
                        ) : reports.length === 0 ? (
                            <div className="border border-dashed border-slate-700 rounded-lg p-6 text-center">
                                <p className="text-slate-500 italic text-xs">No recent reports found locally.</p>
                                <button onClick={() => { setCurrentReportId(undefined); setView('editor'); }} className="mt-2 text-red-500 hover:underline text-xs">Create your first report</button>
                            </div>
                        ) : (
                            <div className="space-y-2">
                                {reports.map(report => (
                                    <div
                                        key={report.id}
                                        onClick={() => { setCurrentReportId(report.id); setView('editor'); }}
                                        className="border border-slate-700 rounded-lg p-3 hover:border-red-500/50 hover:bg-slate-800/50 transition-all cursor-pointer bg-slate-800/30 group relative"
                                    >
                                        <div className="flex justify-between items-start mb-1.5">
                                            <div>
                                                <h3 className="font-bold text-white text-sm">
                                                    {report.customer?.companyName || 'Unassigned Customer'}
                                                </h3>
                                                <div className="text-[10px] text-slate-500 flex items-center gap-2">
                                                    <span><i className="fa-regular fa-calendar mr-1"></i> {report.arrivalDate}</span>
                                                    <span>•</span>
                                                    <span className="font-mono">{report.reportId || 'Draft'}</span>
                                                </div>
                                            </div>
                                            <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${report.status === 'COMPLETED' ? 'bg-green-500/20 text-green-400 border border-green-500/30' : 'bg-slate-700 text-slate-400 border border-slate-600'}`}>
                                                {report.status}
                                            </span>
                                        </div>
                                        <div className="text-xs text-slate-400 line-clamp-2 mb-1.5">
                                            {report.summary || 'No summary provided...'}
                                        </div>

                                        {/* Actions Footer */}
                                        <div className="flex justify-between items-center text-[10px] text-slate-500 border-t border-slate-700 pt-1.5 mt-1.5">
                                            <span>Issues: {report.issues?.length || 0}</span>

                                            {report.status === 'COMPLETED' && (
                                                <div className="flex space-x-2">
                                                    <button
                                                        onClick={(e) => downloadArtifact(e, report, 'html')}
                                                        className="text-red-400 hover:text-red-300 bg-red-500/10 px-2 py-0.5 rounded border border-red-500/20"
                                                        title="Download HTML Report"
                                                    >
                                                        HTML
                                                    </button>
                                                    <button
                                                        onClick={(e) => downloadArtifact(e, report, 'json')}
                                                        className="text-slate-400 hover:text-slate-300 bg-slate-700 px-2 py-0.5 rounded border border-slate-600"
                                                        title="Download JSON Data"
                                                    >
                                                        JSON
                                                    </button>
                                                </div>
                                            )}

                                            {report.status !== 'COMPLETED' && (
                                                <span className="group-hover:text-red-500 transition-colors">Open <i className="fa-solid fa-chevron-right ml-1"></i></span>
                                            )}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>

                    <h3 className="text-xs font-bold text-slate-500 uppercase tracking-wide">System Status</h3>
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                        <StatusCard icon="fa-wifi" label="WorkDrive Connection" status="Connected" color="green" />
                        <StatusCard icon="fa-database" label="Local Cache" status="Active" color="green" />
                        <StatusCard icon="fa-bolt" label="Gemini AI" status="Ready" color="red" />
                    </div>
                </div>

                {/* Admin / Sidebar Area */}
                <div className="space-y-4">
                    <RequireAdmin silent>
                        <div className="bg-slate-900 border border-slate-800 text-white rounded-xl shadow-lg p-4">
                            <h3 className="font-bold text-xs uppercase tracking-wider mb-3 border-b border-slate-700 pb-2 flex items-center text-red-500">
                                <i className="fa-solid fa-user-shield mr-2"></i> Admin Tools
                            </h3>
                            <p className="text-[10px] text-slate-400 mb-3">
                                Use these tools to manage system configuration and stress-test the application.
                            </p>

                            <div className="space-y-2">
                                <button
                                    onClick={handleGenerateTestReport}
                                    disabled={generating}
                                    className="w-full bg-red-600 hover:bg-red-500 disabled:bg-red-900 disabled:text-red-300 text-white text-xs font-medium py-2 px-2.5 rounded-lg flex items-center justify-between transition-colors"
                                >
                                    <span>
                                        {generating ? <i className="fa-solid fa-circle-notch fa-spin mr-1.5"></i> : <i className="fa-solid fa-robot mr-1.5"></i>}
                                        {generating ? 'Generating...' : 'Gen. Edge Case Report'}
                                    </span>
                                    <i className="fa-solid fa-chevron-right text-[10px] opacity-50"></i>
                                </button>

                                <button className="w-full bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-300 text-xs font-medium py-2 px-2.5 rounded-lg flex items-center justify-between transition-colors">
                                    <span><i className="fa-solid fa-users-gear mr-1.5"></i> Manage Techs</span>
                                    <i className="fa-solid fa-chevron-right text-[10px] opacity-50"></i>
                                </button>

                                <button className="w-full bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-300 text-xs font-medium py-2 px-2.5 rounded-lg flex items-center justify-between transition-colors">
                                    <span><i className="fa-solid fa-list-check mr-1.5"></i> Edit Categories</span>
                                    <i className="fa-solid fa-chevron-right text-[10px] opacity-50"></i>
                                </button>
                            </div>
                        </div>
                    </RequireAdmin>
                </div>
            </div>
        </Layout>
        </>
    );
};

const StatusCard: React.FC<{icon: string, label: string, status: string, color: string}> = ({icon, label, status, color}) => (
    <div className="bg-slate-900 border border-slate-800 p-3 rounded-xl shadow-lg flex items-center space-x-2.5">
        <div className={`w-8 h-8 rounded-lg bg-${color}-500/20 flex items-center justify-center text-${color}-400 border border-${color}-500/30 text-sm`}>
            <i className={`fa-solid ${icon}`}></i>
        </div>
        <div>
            <div className="text-[10px] text-slate-500 uppercase">{label}</div>
            <div className="font-semibold text-white text-sm">{status}</div>
        </div>
    </div>
);

export default App;
