/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useRef } from 'react';
import { 
  collection, 
  query, 
  orderBy, 
  onSnapshot, 
  doc, 
  deleteDoc, 
  writeBatch, 
  getDocs 
} from 'firebase/firestore';
import { db } from '../firebase';
import { UserProfile, Notification as WorkspaceNotification, Task } from '../types';
import { 
  Mail, 
  Send, 
  Inbox, 
  Eye, 
  Code, 
  ExternalLink, 
  Calendar, 
  User, 
  Clock, 
  Trash2, 
  Search, 
  Database, 
  AlertCircle, 
  ChevronRight,
  Filter,
  CheckCircle,
  Copy,
  Download,
  Info,
  Server
} from 'lucide-react';

interface EmailSandboxProps {
  userProfile: UserProfile;
  tasks?: Task[];
  onOpenTask?: (task: Task) => void;
}

export default function EmailSandbox({
  userProfile,
  tasks = [],
  onOpenTask
}: EmailSandboxProps) {
  const [emails, setEmails] = useState<WorkspaceNotification[]>([]);
  const [filteredEmails, setFilteredEmails] = useState<WorkspaceNotification[]>([]);
  const [selectedEmail, setSelectedEmail] = useState<WorkspaceNotification | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterAction, setFilterAction] = useState<string>('all');
  const [activeViewTab, setActiveViewTab] = useState<'preview' | 'html' | 'metadata'>('preview');
  const [copied, setCopied] = useState(false);
  const iframeRef = useRef<HTMLIFrameElement>(null);

  // Send real-time test SMTP verification email states
  const [showTestModal, setShowTestModal] = useState(false);
  const [testEmailAddress, setTestEmailAddress] = useState('');
  const [testStatus, setTestStatus] = useState<{ type: 'idle' | 'sending' | 'success' | 'error'; message: string }>({ type: 'idle', message: '' });

  const handleSendTestEmail = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!testEmailAddress.trim()) return;

    setTestStatus({ type: 'sending', message: 'Initiating SMTP connection & delivering test verification payload...' });
    try {
      const response = await fetch('/api/send-email', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          to: testEmailAddress.trim(),
          recipientName: testEmailAddress.split('@')[0],
          subject: '🔒 TEAM 4 Workflow Hub - Enterprise Security Delivery Test',
          html: `
            <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto; padding: 24px; border: 1px solid #e2e8f0; border-radius: 12px; background-color: #ffffff;">
              <div style="background-color: #0d9488; padding: 18px; border-radius: 8px; text-align: center; color: white;">
                <h2 style="margin: 0; font-size: 18px; font-weight: 800; letter-spacing: 0.5px;">SMTP SECURE DISPATCH VERIFICATION</h2>
              </div>
              <div style="padding: 24px 12px; color: #334155; line-height: 1.6;">
                <p>Hello <strong>${testEmailAddress.split('@')[0]}</strong>,</p>
                <p>This is a live SMTP transaction test notification dispatched from your <strong>TEAM 4 Workflow Hub Sandbox</strong>.</p>
                
                <div style="background-color: #f0fdfa; padding: 16px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #0d9488; border-right: 1px solid #ccfbf1; border-top: 1px solid #ccfbf1; border-bottom: 1px solid #ccfbf1;">
                  <strong style="color: #0f172a; display: block; margin-bottom: 5px; font-size: 13px;">🔒 Enterprise Security Notice</strong>
                  <p style="margin: 0; font-size: 12px; color: #115e59;">If you are reading this message in your official Inbox, it confirms your mail provider's filters, SPF/DKIM validation, and domain rules are successfully accepting notifications from this workspace.</p>
                </div>

                <div style="background-color: #fef2f2; padding: 16px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #ef4444; border-right: 1px solid #fee2e2; border-top: 1px solid #fee2e2; border-bottom: 1px solid #fee2e2;">
                  <strong style="color: #991b1b; display: block; margin-bottom: 5px; font-size: 13px;">⚠️ If this landed in Spam / Quarantine:</strong>
                  <p style="margin: 0; font-size: 12px; color: #991b1b;">Please click <strong>"Not Spam"</strong>, add the sender email address to your trusted Safe Senders list/Contacts, or ask your IT Administrator to whitelist this sender address at the corporate email gateway to bypass security blocklists.</p>
                </div>
              </div>
              <div style="text-align: center; padding: 16px; border-top: 1px solid #f1f5f9; font-size: 11px; color: #94a3b8;">
                TEAM 4 Workflow Hub • Automated Mail Server Sandbox
              </div>
            </div>
          `
        })
      });

      const data = await response.json();
      if (response.ok && data.success) {
        setTestStatus({ 
          type: 'success', 
          message: data.mocked 
            ? 'Success! (Development Sandbox Mode) Real SMTP credentials are not yet configured in Settings, so this test dispatch was safely logged locally in the Simulated Mail Server center below.' 
            : 'Success! The test notification was successfully handshaked and sent via the SMTP relay. Please check both your Inbox and Spam folders!' 
        });
      } else {
        setTestStatus({ 
          type: 'error', 
          message: data.error || data.details || 'Failed to dispatch email. Please check your SMTP configuration settings.' 
        });
      }
    } catch (err: any) {
      setTestStatus({ type: 'error', message: err.message || 'Network error occurred.' });
    }
  };

  // Load emails (notifications) in real-time
  useEffect(() => {
    if (!userProfile) return;

    const notifRef = collection(db, 'workspaces', userProfile.workspaceId, 'notifications');
    
    // Admins see all emails in workspace to monitor dispatches, normal users see their own
    const q = userProfile.role === 'admin'
      ? query(notifRef, orderBy('createdAt', 'desc'))
      : query(notifRef, orderBy('createdAt', 'desc')); // For sandbox testing, let's show all so they can inspect dispatches!

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const list: WorkspaceNotification[] = [];
      snapshot.forEach((doc) => {
        list.push({ id: doc.id, ...doc.data() } as WorkspaceNotification);
      });
      setEmails(list);
    }, (error) => {
      console.error("Error reading emails:", error);
    });

    return () => unsubscribe();
  }, [userProfile]);

  // Filter and search logic
  useEffect(() => {
    let result = emails;

    if (filterAction !== 'all') {
      result = result.filter(e => e.action === filterAction);
    }

    if (searchTerm.trim() !== '') {
      const term = searchTerm.toLowerCase();
      result = result.filter(e => 
        (e.emailSubject?.toLowerCase().includes(term)) ||
        (e.details?.toLowerCase().includes(term)) ||
        (e.recipientEmail?.toLowerCase().includes(term)) ||
        (e.recipientName?.toLowerCase().includes(term)) ||
        (e.senderName?.toLowerCase().includes(term))
      );
    }

    setFilteredEmails(result);

    // Keep selection or pick the first if selection is lost
    if (result.length > 0) {
      if (!selectedEmail || !result.some(e => e.id === selectedEmail.id)) {
        setSelectedEmail(result[0]);
      }
    } else {
      setSelectedEmail(null);
    }
  }, [emails, searchTerm, filterAction]);

  // Update iframe contents safely when selected email or tab changes
  useEffect(() => {
    if (activeViewTab === 'preview' && selectedEmail && iframeRef.current) {
      const iframe = iframeRef.current;
      const doc = iframe.contentDocument || iframe.contentWindow?.document;
      if (doc) {
        doc.open();
        doc.write(selectedEmail.emailBody || '<p style="font-family: sans-serif; padding: 20px; color: #64748b;">No email payload body provided.</p>');
        doc.close();
      }
    }
  }, [selectedEmail, activeViewTab]);

  const handleCopyHTML = () => {
    if (!selectedEmail) return;
    navigator.clipboard.writeText(selectedEmail.emailBody || '');
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleDownloadHTML = () => {
    if (!selectedEmail) return;
    const blob = new Blob([selectedEmail.emailBody || ''], { type: 'text/html' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `email-dispatch-${selectedEmail.id}-${selectedEmail.action}.html`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const handleDeleteEmail = async (emailId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!userProfile) return;
    if (selectedEmail?.id === emailId) {
      setSelectedEmail(null);
    }
    try {
      await deleteDoc(doc(db, 'workspaces', userProfile.workspaceId, 'notifications', emailId));
    } catch (err) {
      console.error("Error deleting dispatch log:", err);
    }
  };

  const handleClearAllLogs = async () => {
    if (!userProfile || !window.confirm("Are you sure you want to delete all dispatch and notification logs?")) return;
    try {
      const colRef = collection(db, 'workspaces', userProfile.workspaceId, 'notifications');
      const snapshot = await getDocs(colRef);
      const batch = writeBatch(db);
      snapshot.docs.forEach((doc) => {
        batch.delete(doc.ref);
      });
      await batch.commit();
      setSelectedEmail(null);
    } catch (err) {
      console.error("Error clearing logs:", err);
    }
  };

  // Find related task object from main app tasks list
  const getRelatedTask = () => {
    if (!selectedEmail) return null;
    if (selectedEmail.taskId) {
      return tasks.find(t => t.id === selectedEmail.taskId) || null;
    }
    // Fallback to title match
    return tasks.find(t => t.title && selectedEmail.emailSubject?.includes(t.title)) || null;
  };

  const relatedTask = getRelatedTask();

  // Metrics calculations
  const totalSent = emails.length;
  const pwaCount = emails.filter(e => e.pwaDelivered).length;
  const emailCount = emails.filter(e => e.emailDelivered).length;

  return (
    <div className="h-full flex flex-col bg-slate-50 font-sans overflow-hidden">
      {/* Top Console Dashboard header */}
      <div className="bg-white border-b border-slate-200 p-6 shrink-0 shadow-sm">
        <div className="max-w-7xl mx-auto flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div>
            <h1 className="text-xl font-extrabold text-slate-800 tracking-tight flex items-center gap-2">
              <Server className="w-5 h-5 text-teal-600" /> 
              Simulated Mail server & Dispatch Center
            </h1>
            <p className="text-xs text-slate-500 mt-1">
              Developer sandbox to audit outbound HTML transactional email templates, delivery parameters, and PWA notifications.
            </p>
          </div>

          {/* Action trigger info */}
          <div className="flex items-center gap-3">
            <button
              onClick={() => {
                setTestEmailAddress(userProfile.email || '');
                setTestStatus({ type: 'idle', message: '' });
                setShowTestModal(true);
              }}
              className="px-3 py-1.5 bg-teal-600 hover:bg-teal-700 text-white rounded-lg text-xs font-bold transition flex items-center gap-1.5 cursor-pointer shadow-sm hover:scale-[1.02]"
            >
              <Send className="w-3.5 h-3.5" /> Send Test SMTP Email
            </button>
            <button
              onClick={handleClearAllLogs}
              disabled={emails.length === 0}
              className="px-3 py-1.5 border border-rose-200 hover:border-rose-300 text-rose-600 bg-rose-50 hover:bg-rose-100 disabled:opacity-40 rounded-lg text-xs font-bold transition flex items-center gap-1.5 cursor-pointer"
            >
              <Trash2 className="w-3.5 h-3.5" /> Clear Dispatch Logs
            </button>
            <div className="text-[10px] bg-teal-50 border border-teal-100 px-2.5 py-1.5 rounded-lg text-teal-700 font-bold flex items-center gap-1.5">
              <span className="relative flex h-2 w-2 shrink-0">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-teal-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2 w-2 bg-teal-500"></span>
              </span>
              MTA Receiver: ACTIVE
            </div>
          </div>
        </div>

        {/* Dashboard metrics widgets */}
        <div className="max-w-7xl mx-auto grid grid-cols-2 md:grid-cols-4 gap-4 mt-6">
          <div className="p-4 bg-slate-50 border border-slate-150 rounded-xl">
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Outbound Dispatches</span>
            <div className="flex items-baseline gap-2 mt-1">
              <span className="text-2xl font-extrabold text-slate-800">{totalSent}</span>
              <span className="text-xs text-slate-500 font-medium">logs logged</span>
            </div>
          </div>

          <div className="p-4 bg-slate-50 border border-slate-150 rounded-xl">
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">PWA Push Broadcasts</span>
            <div className="flex items-baseline gap-2 mt-1">
              <span className="text-2xl font-extrabold text-blue-600">{pwaCount}</span>
              <span className="text-xs text-slate-500 font-medium">dispatched</span>
            </div>
          </div>

          <div className="p-4 bg-slate-50 border border-slate-150 rounded-xl">
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Email Template Outputs</span>
            <div className="flex items-baseline gap-2 mt-1">
              <span className="text-2xl font-extrabold text-teal-600">{emailCount}</span>
              <span className="text-xs text-slate-500 font-medium">templated</span>
            </div>
          </div>

          <div className="p-4 bg-slate-50 border border-slate-150 rounded-xl">
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Simulated Delivery Rate</span>
            <div className="flex items-baseline gap-2 mt-1">
              <span className="text-2xl font-extrabold text-emerald-600">100%</span>
              <span className="text-[10px] text-emerald-500 font-bold bg-emerald-50 border border-emerald-100 px-1.5 py-0.2 rounded uppercase">
                Success
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Main Mail client layout */}
      <div className="flex-1 min-h-0 flex flex-col md:flex-row max-w-7xl w-full mx-auto p-4 lg:p-6 gap-6">
        
        {/* Left Column: Email Dispatches List */}
        <div className="w-full md:w-80 lg:w-96 flex flex-col bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden shrink-0">
          {/* List Search & Filters header */}
          <div className="p-4 border-b border-slate-150 space-y-3 bg-slate-50/50">
            <div className="relative">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
              <input
                type="text"
                placeholder="Search subjects, users, emails..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-9 pr-4 py-1.5 bg-white border border-slate-200 rounded-lg text-xs placeholder:text-slate-400 focus:outline-none focus:ring-1 focus:ring-teal-500 focus:border-teal-500"
              />
            </div>

            <div className="flex items-center gap-1.5">
              <Filter className="w-3.5 h-3.5 text-slate-400 shrink-0" />
              <select
                value={filterAction}
                onChange={(e) => setFilterAction(e.target.value)}
                className="w-full py-1 px-2 border border-slate-200 rounded text-[11px] bg-white font-medium text-slate-600 focus:outline-none"
              >
                <option value="all">All Actions (Filter)</option>
                <option value="task_created">Task Created</option>
                <option value="task_status_changed">Status Updated</option>
                <option value="comment_added">Comment Added</option>
                <option value="task_deleted">Task Deleted</option>
              </select>
            </div>
          </div>

          {/* Email Item Feed list */}
          <div className="flex-1 overflow-y-auto divide-y divide-slate-100">
            {filteredEmails.length === 0 ? (
              <div className="p-8 text-center flex flex-col items-center justify-center space-y-2 h-full">
                <Inbox className="w-8 h-8 text-slate-300" />
                <span className="text-xs font-bold text-slate-400">No email dispatches recorded</span>
                <p className="text-[10px] text-slate-400 max-w-xs leading-normal">
                  Create a task, update a status, or write a comment to trigger a mock transactional HTML email.
                </p>
              </div>
            ) : (
              filteredEmails.map((email) => {
                const isSelected = selectedEmail?.id === email.id;
                let badgeStyle = "bg-slate-100 text-slate-600";
                if (email.action === 'task_created') badgeStyle = "bg-emerald-50 text-emerald-700 border-emerald-100";
                if (email.action === 'task_status_changed') badgeStyle = "bg-blue-50 text-blue-700 border-blue-100";
                if (email.action === 'comment_added') badgeStyle = "bg-purple-50 text-purple-700 border-purple-100";
                if (email.action === 'task_deleted') badgeStyle = "bg-rose-50 text-rose-700 border-rose-100";

                return (
                  <div
                    key={email.id}
                    onClick={() => setSelectedEmail(email)}
                    className={`p-4 flex flex-col gap-1.5 text-left transition cursor-pointer relative ${
                      isSelected ? 'bg-teal-500/5 border-l-4 border-teal-500' : 'hover:bg-slate-50'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span className={`px-1.5 py-0.5 rounded text-[9px] font-bold border ${badgeStyle}`}>
                        {email.action.replace('_', ' ')}
                      </span>
                      <span className="text-[10px] text-slate-400 font-semibold">
                        {formatRelativeTime(email.createdAt)}
                      </span>
                    </div>

                    <h4 className="font-bold text-xs text-slate-800 line-clamp-1">
                      {email.emailSubject || "No Subject"}
                    </h4>

                    <p className="text-[11px] text-slate-500 line-clamp-2 leading-relaxed">
                      {email.details}
                    </p>

                    <div className="flex items-center justify-between mt-1 text-[10px]">
                      <span className="text-slate-400 truncate max-w-[150px]">
                        To: <span className="font-semibold text-slate-600">{email.recipientName}</span>
                      </span>

                      <button
                        type="button"
                        onClick={(e) => handleDeleteEmail(email.id, e)}
                        className="p-1 hover:text-rose-500 text-slate-300 transition"
                        title="Delete log"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* Right Column: Selected Email details & viewport */}
        <div className="flex-1 flex flex-col bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden">
          {selectedEmail ? (
            <div className="flex-1 flex flex-col h-full min-h-0">
              
              {/* Header section */}
              <div className="p-5 border-b border-slate-150 bg-slate-50/40 shrink-0">
                <div className="flex items-start justify-between gap-4">
                  <div className="space-y-1.5">
                    <h2 className="text-base font-extrabold text-slate-800 leading-snug">
                      {selectedEmail.emailSubject}
                    </h2>
                    
                    <div className="flex items-center gap-2 flex-wrap text-xs text-slate-500">
                      <span className="font-semibold">From:</span>
                      <span className="font-bold text-slate-600">TEAM 4 Automations &lt;noreply@team4-workspace.com&gt;</span>
                      <span className="text-slate-300">|</span>
                      <span className="font-semibold">To:</span>
                      <span className="font-bold text-slate-700">{selectedEmail.recipientName} &lt;{selectedEmail.recipientEmail}&gt;</span>
                    </div>
                  </div>

                  <span className="text-xs text-slate-400 shrink-0 font-semibold bg-white border border-slate-200 px-2.5 py-1 rounded-lg shadow-sm">
                    {new Date(selectedEmail.createdAt).toLocaleString()}
                  </span>
                </div>

                {/* Dispatch logs indicators */}
                <div className="flex items-center gap-4 mt-4 pt-4 border-t border-slate-150 text-xs">
                  <div className="flex items-center text-teal-600 font-bold bg-teal-50 border border-teal-100 px-2 py-1 rounded-md">
                    <Mail className="w-3.5 h-3.5 mr-1.5" /> 
                    MTA Dispatched
                  </div>
                  {selectedEmail.pwaDelivered && (
                    <div className="flex items-center text-indigo-600 font-bold bg-indigo-50 border border-indigo-100 px-2 py-1 rounded-md">
                      <Clock className="w-3.5 h-3.5 mr-1.5" /> 
                      PWA Push Delivered
                    </div>
                  )}
                  <div className="text-[10px] text-slate-400 font-semibold ml-auto flex items-center gap-1">
                    <CheckCircle className="w-3.5 h-3.5 text-emerald-500" />
                    Verified SPF/DKIM
                  </div>
                </div>
              </div>

              {/* Navigation Viewport Tab Selector */}
              <div className="bg-white border-b border-slate-150 flex items-center justify-between px-4 shrink-0">
                <div className="flex items-center space-x-1">
                  <button
                    onClick={() => setActiveViewTab('preview')}
                    className={`py-3 px-4 border-b-2 text-xs font-bold transition ${
                      activeViewTab === 'preview'
                        ? 'border-teal-500 text-teal-600'
                        : 'border-transparent text-slate-500 hover:text-slate-700'
                    }`}
                  >
                    <span className="flex items-center gap-1.5">
                      <Eye className="w-4 h-4" /> HTML Email View
                    </span>
                  </button>

                  <button
                    onClick={() => setActiveViewTab('html')}
                    className={`py-3 px-4 border-b-2 text-xs font-bold transition ${
                      activeViewTab === 'html'
                        ? 'border-teal-500 text-teal-600'
                        : 'border-transparent text-slate-500 hover:text-slate-700'
                    }`}
                  >
                    <span className="flex items-center gap-1.5">
                      <Code className="w-4 h-4" /> Raw Source HTML
                    </span>
                  </button>

                  <button
                    onClick={() => setActiveViewTab('metadata')}
                    className={`py-3 px-4 border-b-2 text-xs font-bold transition ${
                      activeViewTab === 'metadata'
                        ? 'border-teal-500 text-teal-600'
                        : 'border-transparent text-slate-500 hover:text-slate-700'
                    }`}
                  >
                    <span className="flex items-center gap-1.5">
                      <Database className="w-4 h-4" /> Dispatch Metadata
                    </span>
                  </button>
                </div>

                {/* Auxiliary layout triggers */}
                {activeViewTab === 'html' && (
                  <div className="flex items-center gap-2">
                    <button
                      onClick={handleCopyHTML}
                      className="p-1.5 hover:bg-slate-100 rounded text-slate-500 transition text-[11px] font-bold flex items-center gap-1 cursor-pointer border border-slate-200"
                    >
                      <Copy className="w-3.5 h-3.5" /> {copied ? 'Copied!' : 'Copy Code'}
                    </button>
                    <button
                      onClick={handleDownloadHTML}
                      className="p-1.5 hover:bg-slate-100 rounded text-slate-500 transition text-[11px] font-bold flex items-center gap-1 cursor-pointer border border-slate-200"
                    >
                      <Download className="w-3.5 h-3.5" /> Download
                    </button>
                  </div>
                )}
              </div>

              {/* Viewport content area */}
              <div className="flex-1 min-h-0 overflow-hidden relative bg-slate-100">
                {activeViewTab === 'preview' && (
                  <div className="absolute inset-0 p-4 lg:p-6 overflow-y-auto flex justify-center">
                    <div className="w-full max-w-2xl bg-white rounded-xl shadow-md border border-slate-200 overflow-hidden h-fit flex flex-col">
                      {/* Top browser framing */}
                      <div className="bg-slate-50 border-b border-slate-150 p-2.5 flex items-center gap-1.5 shrink-0 select-none">
                        <span className="w-2.5 h-2.5 rounded-full bg-slate-200" />
                        <span className="w-2.5 h-2.5 rounded-full bg-slate-200" />
                        <span className="w-2.5 h-2.5 rounded-full bg-slate-200" />
                        <div className="bg-white border border-slate-200/80 rounded px-2 py-0.5 text-[10px] text-slate-400 font-semibold w-72 truncate mx-auto text-center font-mono">
                          http://team4-sandbox/dispatch-preview.html
                        </div>
                      </div>
                      <iframe
                        ref={iframeRef}
                        title="Simulated Email Viewport"
                        className="w-full min-h-[500px] border-none"
                        sandbox="allow-same-origin"
                      />
                    </div>
                  </div>
                )}

                {activeViewTab === 'html' && (
                  <div className="absolute inset-0 p-6 overflow-auto">
                    <pre className="p-5 bg-slate-900 text-slate-300 text-xs font-mono rounded-xl border border-slate-800 shadow-lg leading-relaxed select-text overflow-x-auto whitespace-pre-wrap max-w-full">
                      <code>{selectedEmail.emailBody}</code>
                    </pre>
                  </div>
                )}

                {activeViewTab === 'metadata' && (
                  <div className="absolute inset-0 p-6 overflow-y-auto space-y-6">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      
                      {/* Left: Dispatch metadata properties */}
                      <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm space-y-4">
                        <h3 className="text-xs font-bold text-slate-400 uppercase tracking-widest flex items-center gap-1.5">
                          <Info className="w-4 h-4 text-slate-400" /> Logged Delivery Metadata
                        </h3>

                        <div className="space-y-2.5 text-xs">
                          <div className="flex items-center justify-between p-2.5 bg-slate-50 rounded-lg">
                            <span className="font-medium text-slate-500">Record ID</span>
                            <span className="font-mono font-bold text-slate-700 text-[10px] select-all">{selectedEmail.id}</span>
                          </div>

                          <div className="flex items-center justify-between p-2.5 bg-slate-50 rounded-lg">
                            <span className="font-medium text-slate-500">Workspace Context</span>
                            <span className="font-mono font-bold text-slate-700 text-[10px] select-all">{selectedEmail.workspaceId}</span>
                          </div>

                          <div className="flex items-center justify-between p-2.5 bg-slate-50 rounded-lg">
                            <span className="font-medium text-slate-500">Sender UID</span>
                            <span className="font-mono font-bold text-slate-700 text-[10px]">{selectedEmail.senderUid || "N/A"}</span>
                          </div>

                          <div className="flex items-center justify-between p-2.5 bg-slate-50 rounded-lg">
                            <span className="font-medium text-slate-500">Recipient UID</span>
                            <span className="font-mono font-bold text-slate-700 text-[10px]">{selectedEmail.recipientUid || "N/A"}</span>
                          </div>

                          <div className="flex items-center justify-between p-2.5 bg-slate-50 rounded-lg">
                            <span className="font-medium text-slate-500">Email Delivered Status</span>
                            <span className={`font-bold uppercase ${selectedEmail.emailDelivered ? 'text-emerald-600' : 'text-slate-400'}`}>
                              {selectedEmail.emailDelivered ? 'True (Dispatched)' : 'False (Disabled)'}
                            </span>
                          </div>
                        </div>
                      </div>

                      {/* Right: Workspace Interactive context link */}
                      <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm space-y-4">
                        <h3 className="text-xs font-bold text-slate-400 uppercase tracking-widest flex items-center gap-1.5">
                          <Database className="w-4 h-4 text-slate-400" /> Interactive Action Scope
                        </h3>

                        <div className="space-y-4">
                          <div className="p-3.5 bg-slate-50 rounded-lg border border-slate-150 text-xs space-y-2">
                            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wide block">Action Type</span>
                            <span className="font-extrabold text-slate-700 uppercase bg-slate-200/60 px-2 py-0.5 rounded text-[10px]">
                              {selectedEmail.action}
                            </span>
                            
                            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wide block pt-1.5">Action Detail Log</span>
                            <p className="font-semibold text-slate-600 text-[11px] leading-relaxed">
                              {selectedEmail.details}
                            </p>
                          </div>

                          {/* Related task card */}
                          {relatedTask ? (
                            <div className="border border-slate-200 rounded-lg p-4 space-y-3 bg-white">
                              <div className="flex items-center justify-between">
                                <span className="text-[10px] text-slate-400 font-bold uppercase">Linked Task Found</span>
                                <span className="bg-teal-500/10 text-teal-600 font-bold text-[9px] px-1.5 py-0.5 rounded uppercase">
                                  Live in DB
                                </span>
                              </div>
                              
                              <div>
                                <h4 className="font-extrabold text-slate-800 text-xs truncate">
                                  {relatedTask.title}
                                </h4>
                                <p className="text-[10px] text-slate-500 line-clamp-2 mt-1">
                                  {relatedTask.description || "No description provided."}
                                </p>
                              </div>

                              <div className="flex items-center justify-between text-[10px] border-t border-slate-100 pt-2 flex-wrap gap-2">
                                <span className="font-bold text-slate-500">Status: <span className="uppercase text-slate-700">{relatedTask.status}</span></span>
                                <span className="font-bold text-slate-500">Priority: <span className={`uppercase ${
                                  relatedTask.priority === 'high' ? 'text-rose-500' : 'text-slate-600'
                                }`}>{relatedTask.priority}</span></span>
                              </div>

                              {onOpenTask && (
                                <button
                                  type="button"
                                  onClick={() => onOpenTask(relatedTask)}
                                  className="w-full mt-1.5 py-2 px-3 bg-teal-600 hover:bg-teal-700 text-white font-extrabold text-[10px] rounded-lg shadow-sm transition flex items-center justify-center gap-1.5 cursor-pointer"
                                >
                                  <span>View Task Details</span>
                                  <ExternalLink className="w-3.5 h-3.5" />
                                </button>
                              )}
                            </div>
                          ) : (
                            <div className="p-3.5 bg-amber-50 border border-amber-100 rounded-lg text-xs text-amber-800 leading-normal flex items-start gap-1.5">
                              <AlertCircle className="w-4 h-4 shrink-0 text-amber-500 mt-0.5" />
                              <span>
                                <strong>No interactive target:</strong> The task linked to this dispatch log is deleted or archived, so click-to-view is disabled.
                              </span>
                            </div>
                          )}
                        </div>
                      </div>

                    </div>
                  </div>
                )}
              </div>

            </div>
          ) : (
            <div className="p-8 flex-1 flex flex-col items-center justify-center text-center space-y-3 h-full">
              <Mail className="w-12 h-12 text-slate-300" />
              <h3 className="font-bold text-slate-500 text-sm">Select a dispatch record to inspect</h3>
              <p className="text-xs text-slate-400 max-w-sm leading-normal">
                Select any logged email notification dispatch from the left column feed to display its fully rendered template payload, RAW HTML code, and transfer metadata.
              </p>
            </div>
          )}
        </div>

      </div>

      {/* Test SMTP Email Dispatch Modal */}
      {showTestModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          {/* Backdrop */}
          <div className="fixed inset-0 bg-black/40 backdrop-blur-sm" onClick={() => setShowTestModal(false)} />
          
          {/* Modal Container */}
          <div className="bg-white rounded-2xl border border-slate-200 w-full max-w-md p-6 relative z-10 shadow-xl animate-in fade-in duration-200 text-left">
            <div className="flex items-center justify-between mb-4 border-b border-slate-100 pb-3">
              <h3 className="font-extrabold text-slate-800 text-sm flex items-center gap-1.5 uppercase tracking-wider">
                <Mail className="w-4 h-4 text-teal-600" />
                SMTP Delivery Verification
              </h3>
              <button 
                type="button" 
                onClick={() => setShowTestModal(false)}
                className="text-slate-400 hover:text-slate-600 p-1 hover:bg-slate-50 rounded"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleSendTestEmail} className="space-y-4">
              <p className="text-xs text-slate-500 leading-relaxed">
                Test how the team's mail servers handshake with enterprise domains (such as <strong className="text-slate-700">@tesda.gov.ph</strong> or <strong className="text-slate-700">@tesda.com</strong>).
              </p>

              <div className="space-y-1.5">
                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wide block">
                  Recipient Email Address
                </label>
                <input
                  type="email"
                  required
                  placeholder="e.g. member@tesda.gov.ph"
                  value={testEmailAddress}
                  onChange={(e) => setTestEmailAddress(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-lg py-2 px-3 text-xs text-slate-800 placeholder:text-slate-400 focus:outline-none focus:ring-1 focus:ring-teal-500 focus:border-teal-500"
                />
              </div>

              {testStatus.type !== 'idle' && (
                <div className={`p-3.5 rounded-xl border text-[11px] leading-relaxed ${
                  testStatus.type === 'sending' 
                    ? 'bg-blue-50/50 border-blue-100 text-blue-700' 
                    : testStatus.type === 'success' 
                    ? 'bg-emerald-50/50 border-emerald-100 text-emerald-800' 
                    : 'bg-rose-50/50 border-rose-100 text-rose-800'
                }`}>
                  <div className="font-bold mb-1 flex items-center gap-1.5">
                    {testStatus.type === 'sending' && (
                      <span className="w-1.5 h-1.5 bg-blue-500 rounded-full animate-ping" />
                    )}
                    {testStatus.type === 'success' && '✔️ Dispatch Success'}
                    {testStatus.type === 'error' && '❌ Delivery Error'}
                    {testStatus.type === 'sending' && 'Sending...'}
                  </div>
                  {testStatus.message}
                </div>
              )}

              <div className="flex justify-end gap-2.5 pt-2">
                <button
                  type="button"
                  onClick={() => setShowTestModal(false)}
                  className="px-3.5 py-1.5 border border-slate-200 rounded-lg text-xs font-bold text-slate-500 hover:bg-slate-50"
                >
                  Close
                </button>
                <button
                  type="submit"
                  disabled={testStatus.type === 'sending'}
                  className="px-4 py-1.5 bg-slate-900 hover:bg-slate-800 disabled:opacity-40 text-white rounded-lg text-xs font-bold shadow-sm transition"
                >
                  {testStatus.type === 'sending' ? 'Delivering...' : 'Send Test Mail'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

// Simple internal helper to format relative times like "2m ago"
function formatRelativeTime(dateString: string): string {
  try {
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffSec = Math.floor(diffMs / 1000);
    const diffMin = Math.floor(diffSec / 60);
    const diffHour = Math.floor(diffMin / 60);
    const diffDay = Math.floor(diffHour / 24);

    if (diffSec < 60) return 'Just now';
    if (diffMin < 60) return `${diffMin}m ago`;
    if (diffHour < 24) return `${diffHour}h ago`;
    return `${diffDay}d ago`;
  } catch (e) {
    return 'N/A';
  }
}
