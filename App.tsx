
import React, { useState, useEffect } from 'react';
import { Layout } from './components/Layout';
import { ReportEditor } from './components/ReportEditor';
import { User, ServiceReport, Customer } from './types';
import { saveLocalReport, getAllLocalReports } from './services/db';
import { generateEdgeCaseReportContent } from './services/geminiService';
import { fetchCustomerDirectory } from './services/workDriveService';
import { generateUUID } from './utils/helpers';
import { generateHTML, generateMarkdown } from './utils/exportUtils';
import { supabase, getUserProfile } from './src/lib/supabase';

// Mock Auth for Fallback
const MOCK_USER: User = {
    email: 'tech@xovrcncparts.com',
    name: 'Alex Technician',
    role: 'ADMIN'
};

const App: React.FC = () => {
    const [user, setUser] = useState<User | null>(null);
    const [view, setView] = useState<'list' | 'editor'>('list');
    const [currentReportId, setCurrentReportId] = useState<string | undefined>(undefined);
    const [generating, setGenerating] = useState(false);
    const [reports, setReports] = useState<ServiceReport[]>([]);
    const [loadingReports, setLoadingReports] = useState(false);
    const [authLoading, setAuthLoading] = useState(true);

    // Manual Login State (Dev Fallback)
    const [showManualLogin, setShowManualLogin] = useState(false);
    const [manualName, setManualName] = useState('');
    const [manualEmail, setManualEmail] = useState('');

    // Check Supabase session on mount
    useEffect(() => {
        const checkSession = async () => {
            try {
                const { data: { session } } = await supabase.auth.getSession();

                if (session?.user) {
                    // Get profile with role from our profiles table
                    const profile = await getUserProfile(session.user.id);

                    setUser({
                        email: session.user.email || '',
                        name: profile?.name || session.user.user_metadata?.full_name || session.user.email || '',
                        picture: session.user.user_metadata?.avatar_url,
                        role: (profile?.role?.toUpperCase() as 'ADMIN' | 'USER' | 'SUPER_ADMIN') || 'USER'
                    });
                }
            } catch (error) {
                console.error('Session check error:', error);
            } finally {
                setAuthLoading(false);
            }
        };

        checkSession();

        // Listen for auth changes
        const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
            if (event === 'SIGNED_IN' && session?.user) {
                const profile = await getUserProfile(session.user.id);

                setUser({
                    email: session.user.email || '',
                    name: profile?.name || session.user.user_metadata?.full_name || session.user.email || '',
                    picture: session.user.user_metadata?.avatar_url,
                    role: (profile?.role?.toUpperCase() as 'ADMIN' | 'USER' | 'SUPER_ADMIN') || 'USER'
                });
            } else if (event === 'SIGNED_OUT') {
                setUser(null);
            }
        });

        return () => subscription.unsubscribe();
    }, []);

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

    const handleGoogleLogin = async () => {
        try {
            const { error } = await supabase.auth.signInWithOAuth({
                provider: 'google',
                options: {
                    redirectTo: window.location.origin
                }
            });
            if (error) {
                console.error('Google login error:', error);
                alert('Failed to sign in with Google: ' + error.message);
            }
        } catch (err) {
            console.error('OAuth error:', err);
        }
    };

    const handleLogout = async () => {
        await supabase.auth.signOut();
        setUser(null);
    };

    const handleDemoLogin = () => {
        setUser(MOCK_USER);
    };

    const handleManualLogin = (e: React.FormEvent) => {
        e.preventDefault();
        if (manualName && manualEmail) {
            setUser({
                name: manualName,
                email: manualEmail,
                role: 'ADMIN',
                picture: `https://ui-avatars.com/api/?name=${manualName}`
            });
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
                createdBy: user?.email || '',
                technicianName: user?.name || '',
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
    if (authLoading) {
        return (
            <div className="h-screen flex items-center justify-center bg-slate-950">
                <div className="text-center">
                    <i className="fa-solid fa-circle-notch fa-spin text-red-500 text-3xl mb-4"></i>
                    <p className="text-slate-400">Loading...</p>
                </div>
            </div>
        );
    }

    if (!user) {
        return (
            <div className="h-screen flex items-center justify-center bg-slate-950 p-4">
                <div className="bg-slate-900 border border-slate-800 p-8 rounded-xl shadow-2xl text-center max-w-sm w-full transition-all">
                    <div className="text-4xl text-red-500 mb-4"><i className="fa-solid fa-screwdriver-wrench"></i></div>
                    <h1 className="text-2xl font-bold text-white mb-2">XOVR Service Pro</h1>
                    <p className="text-slate-400 mb-6">Sign in to generate technician profile</p>

                    {!showManualLogin ? (
                        <>
                            {/* Supabase Google Sign In */}
                            <button
                                onClick={handleGoogleLogin}
                                className="w-full bg-white text-gray-700 font-medium py-2.5 px-4 rounded-lg shadow-sm hover:bg-gray-100 flex items-center justify-center gap-3 transition-colors border border-gray-300"
                            >
                                <svg className="w-5 h-5" viewBox="0 0 24 24">
                                    <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                                    <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                                    <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
                                    <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
                                </svg>
                                Sign in with Google
                            </button>

                            <div className="relative flex py-4 items-center">
                                <div className="flex-grow border-t border-slate-700"></div>
                                <span className="flex-shrink-0 mx-4 text-slate-500 text-xs uppercase">Or</span>
                                <div className="flex-grow border-t border-slate-700"></div>
                            </div>

                            <button onClick={handleDemoLogin} className="w-full bg-slate-800 border border-slate-700 text-slate-200 font-medium py-2.5 px-4 rounded-lg shadow-sm hover:bg-slate-700 hover:border-slate-600 flex items-center justify-center gap-2 text-sm transition-colors">
                                <i className="fa-solid fa-user-ninja"></i>
                                Demo Account
                            </button>

                            <div className="mt-4">
                                <button
                                    onClick={() => setShowManualLogin(true)}
                                    className="text-xs text-red-500 hover:text-red-400 hover:underline"
                                >
                                    Login with specific email (Dev Mode)
                                </button>
                            </div>
                        </>
                    ) : (
                        <form onSubmit={handleManualLogin} className="space-y-4 text-left animate-fade-in">
                            <div>
                                <label className="block text-xs font-bold text-slate-400 mb-1">Your Name</label>
                                <input
                                    required
                                    type="text"
                                    value={manualName}
                                    onChange={e => setManualName(e.target.value)}
                                    className="w-full bg-slate-800 border border-slate-700 rounded-lg p-2.5 text-sm text-white placeholder:text-slate-500 focus:ring-red-500 focus:border-red-500"
                                    placeholder="e.g. Dustin Tech"
                                />
                            </div>
                            <div>
                                <label className="block text-xs font-bold text-slate-400 mb-1">Email Address</label>
                                <input
                                    required
                                    type="email"
                                    value={manualEmail}
                                    onChange={e => setManualEmail(e.target.value)}
                                    className="w-full bg-slate-800 border border-slate-700 rounded-lg p-2.5 text-sm text-white placeholder:text-slate-500 focus:ring-red-500 focus:border-red-500"
                                    placeholder="e.g. dustin@xovrcncparts.com"
                                />
                            </div>
                            <button type="submit" className="w-full bg-red-600 text-white font-medium py-2.5 px-4 rounded-lg shadow-sm hover:bg-red-500 mt-2 text-sm transition-colors">
                                Sign In Manually
                            </button>
                            <button
                                type="button"
                                onClick={() => setShowManualLogin(false)}
                                className="w-full text-slate-500 hover:text-slate-300 text-xs mt-2"
                            >
                                Cancel
                            </button>
                        </form>
                    )}
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
                    loadReports();
                }}
            />
        );
    }

    return (
        <Layout user={user} onLogout={handleLogout} title="Dashboard" actions={
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
                    {user.role === 'ADMIN' && (
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
                    )}
                </div>
            </div>
        </Layout>
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
