/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { collection, query, where, orderBy, onSnapshot, doc, updateDoc, writeBatch, getDocs, deleteDoc } from 'firebase/firestore';
import { db } from '../firebase';
import { UserProfile, Notification as WorkspaceNotification, UserNotificationSettings, Task } from '../types';
import { DEFAULT_NOTIFICATION_SETTINGS } from '../utils/notifications';
import { Bell, Mail, Monitor, X, Eye, AlertCircle, Settings, Check, Trash2, ArrowLeft, ExternalLink, FileText, MessageSquare, Calendar, User, Clock, ArrowRight, ArrowUpCircle } from 'lucide-react';

interface NotificationModalProps {
  isOpen: boolean;
  onClose: () => void;
  userProfile: UserProfile;
  onUpdateProfile: (updatedProfile: UserProfile) => void;
  tasks?: Task[];
  onOpenTask?: (task: Task) => void;
}

export default function NotificationModal({
  isOpen,
  onClose,
  userProfile,
  onUpdateProfile,
  tasks = [],
  onOpenTask
}: NotificationModalProps) {
  const [activeTab, setActiveTab] = useState<'inbox' | 'settings'>('inbox');
  const [notifications, setNotifications] = useState<WorkspaceNotification[]>([]);
  const [selectedNotification, setSelectedNotification] = useState<WorkspaceNotification | null>(null);
  const [permissionStatus, setPermissionStatus] = useState<string>(
    typeof window !== 'undefined' && 'Notification' in window ? Notification.permission : 'unsupported'
  );
  
  // Settings local state
  const currentSettings = userProfile.notificationSettings || DEFAULT_NOTIFICATION_SETTINGS;
  const [pwaEnabled, setPwaEnabled] = useState(currentSettings.pwaEnabled);
  const [emailEnabled, setEmailEnabled] = useState(currentSettings.emailEnabled);
  const [onTaskCreated, setOnTaskCreated] = useState(currentSettings.onTaskCreated);
  const [onTaskStatusChanged, setOnTaskStatusChanged] = useState(currentSettings.onTaskStatusChanged);
  const [onCommentAdded, setOnCommentAdded] = useState(currentSettings.onCommentAdded);
  const [onTaskDeleted, setOnTaskDeleted] = useState(currentSettings.onTaskDeleted);
  
  const [isSaving, setIsSaving] = useState(false);
  const [successMessage, setSuccessMessage] = useState('');

  // Sync settings state when userProfile changes
  useEffect(() => {
    const freshSettings = userProfile.notificationSettings || DEFAULT_NOTIFICATION_SETTINGS;
    setPwaEnabled(freshSettings.pwaEnabled);
    setEmailEnabled(freshSettings.emailEnabled);
    setOnTaskCreated(freshSettings.onTaskCreated);
    setOnTaskStatusChanged(freshSettings.onTaskStatusChanged);
    setOnCommentAdded(freshSettings.onCommentAdded);
    setOnTaskDeleted(freshSettings.onTaskDeleted);
  }, [userProfile]);

  // Read notifications from Firestore in real-time
  useEffect(() => {
    if (!isOpen || !userProfile) return;

    const notifRef = collection(db, 'workspaces', userProfile.workspaceId, 'notifications');
    // Workspace Administrators can see all notification dispatches in the workspace to monitor status,
    // while standard users only see notifications dispatched to themselves.
    const q = userProfile.role === 'admin'
      ? query(notifRef, orderBy('createdAt', 'desc'))
      : query(
          notifRef,
          where('recipientUid', '==', userProfile.uid),
          orderBy('createdAt', 'desc')
        );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const list: WorkspaceNotification[] = [];
      snapshot.forEach((doc) => {
        list.push({ id: doc.id, ...doc.data() } as WorkspaceNotification);
      });
      setNotifications(list);
    }, (error) => {
      console.error('Error fetching notifications:', error);
    });

    return () => unsubscribe();
  }, [isOpen, userProfile]);

  if (!isOpen) return null;

  // Request native browser notification permission
  const requestPWAPermission = async () => {
    if (!('Notification' in window)) {
      alert('This browser does not support desktop notifications.');
      return;
    }

    try {
      const permission = await Notification.requestPermission();
      setPermissionStatus(permission);
      if (permission === 'granted') {
        setPwaEnabled(true);
        // Show test notification
        new Notification('VibeCheck Notifications Enabled!', {
          body: 'You will now receive instant desktop PWA alerts for workflow edits.',
          icon: '/favicon.ico'
        });
      } else if (permission === 'denied') {
        alert('Notification permission was denied. Please update your browser settings to allow notifications for this site.');
      }
    } catch (e) {
      console.error('Error requesting notification permission:', e);
    }
  };

  // Save updated settings to Firestore
  const handleSaveSettings = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    setIsSaving(true);
    setSuccessMessage('');

    try {
      const userRef = doc(db, 'users', userProfile.uid);
      const updatedSettings: UserNotificationSettings = {
        pwaEnabled,
        emailEnabled,
        onTaskCreated,
        onTaskStatusChanged,
        onCommentAdded,
        onTaskDeleted
      };

      await updateDoc(userRef, {
        notificationSettings: updatedSettings
      });

      onUpdateProfile({
        ...userProfile,
        notificationSettings: updatedSettings
      });

      setSuccessMessage('Notification preferences updated successfully!');
      setTimeout(() => setSuccessMessage(''), 3000);
    } catch (error) {
      console.error('Error saving notification preferences:', error);
      alert('Failed to save settings.');
    } finally {
      setIsSaving(false);
    }
  };

  // Mark all notifications as read
  const handleMarkAllAsRead = async () => {
    try {
      const batch = writeBatch(db);
      notifications.forEach((notif) => {
        if (!notif.isRead) {
          const ref = doc(db, 'workspaces', userProfile.workspaceId, 'notifications', notif.id);
          batch.update(ref, { isRead: true });
        }
      });
      await batch.commit();
    } catch (err) {
      console.error('Error marking all as read:', err);
    }
  };

  // Delete notification
  const handleDeleteNotification = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      const ref = doc(db, 'workspaces', userProfile.workspaceId, 'notifications', id);
      await deleteDoc(ref);
      if (selectedNotification?.id === id) {
        setSelectedNotification(null);
      }
    } catch (err) {
      console.error('Error deleting notification:', err);
    }
  };

  // Select notification and mark it as read
  const handleSelectNotification = async (notif: WorkspaceNotification) => {
    setSelectedNotification(notif);
    if (!notif.isRead) {
      try {
        const ref = doc(db, 'workspaces', userProfile.workspaceId, 'notifications', notif.id);
        await updateDoc(ref, { isRead: true });
      } catch (err) {
        console.error('Error marking notification as read:', err);
      }
    }
  };

  return (
    <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center z-50 p-4 select-none animate-in fade-in duration-200">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-4xl h-[650px] flex overflow-hidden border border-slate-100 animate-in zoom-in-95 duration-200">
        
        {/* Left Side Navigation & Settings Panel */}
        <div className="w-80 bg-slate-50 border-r border-slate-100 flex flex-col shrink-0">
          <div className="p-6 border-b border-slate-100 flex items-center justify-between">
            <div className="flex items-center space-x-2.5">
              <div className="p-2 bg-teal-50 rounded-xl">
                <Bell className="w-5 h-5 text-teal-600" />
              </div>
              <div>
                <h3 className="font-extrabold text-slate-800 text-base">Alert & Mail Hub</h3>
                <p className="text-[10px] text-slate-400 font-medium">Configure PWA & Email</p>
              </div>
            </div>
          </div>

          <div className="p-4 space-y-1 flex-1">
            <button
              onClick={() => {
                setActiveTab('inbox');
                setSelectedNotification(null);
              }}
              className={`w-full flex items-center space-x-3 px-4 py-3 rounded-xl text-xs font-bold transition-all text-left ${
                activeTab === 'inbox' && !selectedNotification
                  ? 'bg-white text-teal-600 shadow-sm border border-slate-100'
                  : 'text-slate-600 hover:bg-slate-100'
              }`}
            >
              <Bell className="w-4 h-4 shrink-0" />
              <span>Notification Feed ({notifications.filter(n => !n.isRead).length} unread)</span>
            </button>

            <button
              onClick={() => {
                setActiveTab('settings');
                setSelectedNotification(null);
              }}
              className={`w-full flex items-center space-x-3 px-4 py-3 rounded-xl text-xs font-bold transition-all text-left ${
                activeTab === 'settings'
                  ? 'bg-white text-teal-600 shadow-sm border border-slate-100'
                  : 'text-slate-600 hover:bg-slate-100'
              }`}
            >
              <Settings className="w-4 h-4 shrink-0" />
              <span>Notification Settings</span>
            </button>
          </div>

          {/* Connected Mail Tag */}
          <div className="p-4 mx-4 mt-4 mb-2 bg-teal-50/50 rounded-xl border border-teal-100/50">
            <div className="flex items-center gap-2.5">
              <div className="p-1.5 bg-teal-500 rounded-lg text-white">
                <Mail className="w-3.5 h-3.5" />
              </div>
              <div className="overflow-hidden">
                <p className="text-[9px] font-bold text-teal-800 uppercase tracking-wider">Connected Gmail Address</p>
                <p className="text-xs font-bold text-slate-700 truncate" title={userProfile.email}>{userProfile.email}</p>
              </div>
            </div>
          </div>

          {/* Mobile Access QR Code Card */}
          <div className="mx-4 mb-4 p-4 bg-slate-100 rounded-xl border border-slate-200/50 flex flex-col items-center text-center">
            <div className="flex items-center justify-between w-full mb-2">
              <span className="text-[9px] font-bold text-slate-500 uppercase tracking-wider">📱 Open on Mobile</span>
              <span className="bg-indigo-100 text-indigo-700 font-extrabold text-[8px] px-1.5 py-0.5 rounded-full uppercase tracking-wider">
                Real-time Sync
              </span>
            </div>
            
            <div className="bg-white p-2 rounded-lg shadow-sm border border-slate-200/50 mb-2">
              <img 
                src={`https://api.qrserver.com/v1/create-qr-code/?size=110x110&color=0f172a&data=${encodeURIComponent(window.location.origin)}`}
                alt="Scan to open on phone"
                className="w-[100px] h-[100px]"
                referrerPolicy="no-referrer"
              />
            </div>
            
            <p className="text-[10px] text-slate-500 leading-normal font-medium">
              Scan with your phone to open, tap <strong>"Add to Home Screen"</strong> to install as a PWA, and authorize mobile notifications!
            </p>
          </div>
        </div>

        {/* Right Side Work Area */}
        <div className="flex-1 flex flex-col min-w-0 bg-white">
          
          {/* Header */}
          <div className="h-[73px] border-b border-slate-100 px-6 flex items-center justify-between shrink-0">
            <div className="flex items-center space-x-2">
              {selectedNotification && (
                <button
                  onClick={() => setSelectedNotification(null)}
                  className="p-1.5 hover:bg-slate-50 text-slate-400 hover:text-slate-700 rounded-lg mr-1 transition cursor-pointer"
                >
                  <ArrowLeft className="w-4 h-4" />
                </button>
              )}
              <h4 className="font-bold text-slate-800 text-sm">
                {selectedNotification
                  ? 'Email Notification Sandbox'
                  : activeTab === 'inbox'
                  ? 'Notification Dispatch History'
                  : 'Configure Multi-Channel Alerting'}
              </h4>
            </div>
            
            <div className="flex items-center gap-2">
              {activeTab === 'inbox' && !selectedNotification && notifications.length > 0 && (
                <button
                  onClick={handleMarkAllAsRead}
                  className="px-3 py-1.5 text-xs text-slate-500 hover:bg-slate-50 rounded-lg transition font-bold border border-slate-200 cursor-pointer"
                >
                  Mark all read
                </button>
              )}
              <button
                onClick={onClose}
                className="p-1.5 hover:bg-slate-50 text-slate-400 hover:text-slate-700 rounded-lg transition cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Content Area */}
          <div className="flex-1 overflow-y-auto min-h-0">
            
            {/* EMAIL PREVIEW SANDBOX (When a notification log is clicked) */}
            {selectedNotification ? (
              (() => {
                const liveTask = selectedNotification.taskId
                  ? tasks.find((t) => t.id === selectedNotification.taskId)
                  : tasks.find((t) => t.title && selectedNotification.emailSubject?.includes(t.title));

                const taskTitle = liveTask?.title || selectedNotification.taskTitle || "Archived Task";
                const taskDesc = liveTask?.description || selectedNotification.taskDescription || "";
                const taskStatus = liveTask?.status || selectedNotification.taskStatus || "";
                const taskPriority = liveTask?.priority || selectedNotification.taskPriority || "";
                const taskDueDate = liveTask?.dueDate || selectedNotification.taskDueDate || "";

                // Determine action metadata
                let actionLabel = "Workspace Action";
                let actionBg = "bg-slate-50 border-slate-100 text-slate-700";
                let ActionIconComp = Bell;

                switch (selectedNotification.action) {
                  case 'task_created':
                    actionLabel = "Task Created";
                    actionBg = "bg-emerald-50 border-emerald-100 text-emerald-700";
                    ActionIconComp = ArrowUpCircle;
                    break;
                  case 'task_status_changed':
                    actionLabel = "Status Updated";
                    actionBg = "bg-blue-50 border-blue-100 text-blue-700";
                    ActionIconComp = Clock;
                    break;
                  case 'comment_added':
                    actionLabel = "Comment Added";
                    actionBg = "bg-purple-50 border-purple-100 text-purple-700";
                    ActionIconComp = MessageSquare;
                    break;
                  case 'task_deleted':
                    actionLabel = "Task Deleted";
                    actionBg = "bg-rose-50 border-rose-100 text-rose-700";
                    ActionIconComp = Trash2;
                    break;
                  case 'user_joined':
                    actionLabel = "Member Joined";
                    actionBg = "bg-teal-50 border-teal-100 text-teal-700";
                    ActionIconComp = User;
                    break;
                }

                return (
                  <div className="h-full flex flex-col bg-slate-50 overflow-y-auto">
                    {/* Simulated Email Envelope Header or Action Header */}
                    <div className="bg-white border-b border-slate-200 p-5 shrink-0 flex flex-col space-y-3 shadow-sm font-sans">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <span className={`px-2.5 py-1 rounded-lg text-xs font-bold border flex items-center gap-1.5 ${actionBg}`}>
                            <ActionIconComp className="w-3.5 h-3.5" />
                            {actionLabel}
                          </span>
                          {liveTask ? (
                            <span className="bg-teal-500/10 text-teal-700 border border-teal-500/15 font-bold text-[10px] px-2 py-0.5 rounded-md uppercase tracking-wider">
                              Live In Workspace
                            </span>
                          ) : (
                            <span className="bg-slate-150 text-slate-500 border border-slate-200/80 font-bold text-[10px] px-2 py-0.5 rounded-md uppercase tracking-wider">
                              Archived/Deleted
                            </span>
                          )}
                        </div>
                        <span className="text-xs font-semibold text-slate-400">
                          {new Date(selectedNotification.createdAt).toLocaleString()}
                        </span>
                      </div>

                      <div className="flex flex-col space-y-1.5">
                        <h4 className="font-extrabold text-slate-800 text-base leading-snug">
                          {selectedNotification.details}
                        </h4>
                        <div className="flex items-center gap-1 text-xs text-slate-500">
                          <span className="font-semibold text-slate-600">Triggered by:</span>
                          <span className="font-bold text-slate-700">{selectedNotification.senderName}</span>
                          <span className="text-slate-300">•</span>
                          <span className="font-semibold text-slate-600">Delivered to:</span>
                          <span className="font-bold text-slate-700 text-slate-600">{selectedNotification.recipientName} ({selectedNotification.recipientEmail})</span>
                        </div>
                      </div>
                    </div>

                    {/* Workspace Task details view */}
                    <div className="p-6 space-y-6 flex-1 max-w-2xl mx-auto w-full font-sans">
                      
                      {/* Interactive Task Details Card */}
                      <div className="space-y-4">
                        <div className="bg-white border border-slate-200 rounded-xl p-6 shadow-sm space-y-5">
                          <div className="flex items-center justify-between">
                            <h5 className="text-[11px] font-bold text-slate-400 uppercase tracking-widest flex items-center gap-1">
                              <FileText className="w-3.5 h-3.5 text-slate-400" /> Related Task Info
                            </h5>
                            {liveTask && (
                              <span className="bg-teal-500/10 text-teal-600 font-bold text-[9px] px-1.5 py-0.5 rounded uppercase">
                                Interactive State
                              </span>
                            )}
                          </div>

                          {/* Trigger Event Specific info if comment was added */}
                          {selectedNotification.action === 'comment_added' && (
                            <div className="p-3.5 bg-purple-50 border border-purple-100/50 rounded-xl text-xs text-slate-600 space-y-1.5">
                              <span className="font-bold text-purple-800 flex items-center gap-1.5">
                                <MessageSquare className="w-3.5 h-3.5 text-purple-600" /> Conversation Comment Added
                              </span>
                              <p className="italic text-[11px] leading-relaxed text-slate-700">
                                "{selectedNotification.details.split(' commented: ')[1] || selectedNotification.details}"
                              </p>
                            </div>
                          )}

                          {/* Task Details Card body */}
                          <div className="space-y-4">
                            <div>
                              <h3 className="text-base font-extrabold text-slate-800 tracking-tight leading-snug">
                                {taskTitle || "Unavailable"}
                              </h3>
                              <p className="text-xs text-slate-500 mt-1.5 leading-relaxed">
                                {taskDesc || "No task description details captured in this log snapshot."}
                              </p>
                            </div>

                            {/* Task properties table */}
                            <div className="grid grid-cols-2 gap-3.5 pt-4 border-t border-slate-100 text-xs">
                              <div className="p-2.5 bg-slate-50 rounded-lg">
                                <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider block">Workflow Status</span>
                                <span className="font-bold text-slate-700 uppercase mt-0.5 block">
                                  {taskStatus || "N/A"}
                                </span>
                              </div>

                              <div className="p-2.5 bg-slate-50 rounded-lg">
                                <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider block">Priority Tier</span>
                                <span className={`font-bold uppercase mt-0.5 block ${
                                  taskPriority === 'high' ? 'text-rose-500' : taskPriority === 'medium' ? 'text-amber-500' : taskPriority === 'low' ? 'text-emerald-500' : 'text-slate-500'
                                }`}>
                                  {taskPriority || "N/A"}
                                </span>
                              </div>

                              {taskDueDate && (
                                <div className="p-2.5 bg-slate-50 rounded-lg col-span-2 flex items-center gap-2">
                                  <Calendar className="w-4 h-4 text-slate-400 shrink-0" />
                                  <div>
                                    <span className="text-[9px] text-slate-400 font-bold uppercase tracking-wider block">Due Date</span>
                                    <span className="font-bold text-slate-700">{taskDueDate}</span>
                                  </div>
                                </div>
                              )}
                            </div>

                            {/* Action Trigger button to open Task Modal */}
                            {liveTask && onOpenTask ? (
                              <div className="pt-3">
                                <button
                                  type="button"
                                  onClick={() => onOpenTask(liveTask)}
                                  className="w-full py-3 px-4 bg-teal-600 hover:bg-teal-700 text-white font-extrabold text-xs rounded-xl shadow-sm hover:shadow transition flex items-center justify-center gap-2 cursor-pointer group"
                                >
                                  <span>Open Interactive Task & Comments</span>
                                  <ExternalLink className="w-4 h-4 transition group-hover:translate-x-0.5" />
                                </button>
                              </div>
                            ) : (
                              <div className="p-3 bg-amber-50 border border-amber-100 rounded-xl text-amber-800 text-[11px] leading-relaxed flex items-start gap-1.5 mt-2">
                                <AlertCircle className="w-4 h-4 shrink-0 text-amber-500 mt-0.5" />
                                <span>
                                  <strong>Task Not Editable:</strong> This task has been deleted, archived, or is no longer in the active workspace. This view displays the historical snapshot from the time of the action.
                                </span>
                              </div>
                            )}
                          </div>
                        </div>
                      </div>

                    </div>
                  </div>
                );
              })()
            ) : activeTab === 'inbox' ? (
              /* NOTIFICATION FEED LIST */
              <div className="p-6 h-full flex flex-col">
                {notifications.length === 0 ? (
                  <div className="flex-1 flex flex-col items-center justify-center text-center p-8">
                    <div className="w-12 h-12 bg-slate-50 rounded-2xl flex items-center justify-center mb-4">
                      <Bell className="w-6 h-6 text-slate-300" />
                    </div>
                    <h5 className="font-bold text-slate-700 text-sm">No notification logs yet</h5>
                    <p className="text-xs text-slate-400 max-w-sm mt-1">
                      Whenever you or your team make updates to tasks, comments, or workflow stages, dispatched alerts will record and display here in real-time.
                    </p>
                  </div>
                ) : (
                  <div className="space-y-2">
                    <p className="text-[11px] text-slate-400 font-medium px-1 pb-2">
                      Click any dispatch record below to view the styled HTML Email Template that would be sent directly to your Gmail account.
                    </p>
                    <div className="border border-slate-100 rounded-xl overflow-hidden divide-y divide-slate-100">
                      {notifications.map((notif) => (
                        <div
                          key={notif.id}
                          onClick={() => handleSelectNotification(notif)}
                          className={`p-4 flex items-start justify-between gap-4 transition hover:bg-slate-50 cursor-pointer ${
                            !notif.isRead ? 'bg-teal-50/20 font-medium border-l-4 border-l-teal-500' : 'bg-white'
                          }`}
                        >
                          <div className="flex items-start space-x-3 min-w-0">
                            <div className={`p-2 rounded-lg shrink-0 mt-0.5 ${
                              !notif.isRead ? 'bg-teal-500/10 text-teal-600' : 'bg-slate-100 text-slate-400'
                            }`}>
                              <Bell className="w-4 h-4" />
                            </div>
                            <div className="min-w-0">
                              <div className="flex items-center gap-2 flex-wrap">
                                <span className="text-xs font-bold text-slate-800">
                                  {notif.senderName}
                                  {userProfile.role === 'admin' && (
                                    <span className="text-slate-450 font-normal">
                                      {" "}&rarr; notified <strong>{notif.recipientName}</strong> ({notif.recipientEmail})
                                    </span>
                                  )}
                                </span>
                                <span className="text-[10px] text-slate-400">
                                  {new Date(notif.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                </span>
                                {!notif.isRead && (
                                  <span className="bg-teal-500 text-white font-extrabold text-[8px] px-1.5 py-0.5 rounded-full uppercase tracking-wider scale-90">
                                    New
                                  </span>
                                )}
                              </div>
                              <p className="text-xs text-slate-600 mt-1 line-clamp-1">{notif.details}</p>
                              
                              <div className="flex items-center gap-3 mt-2">
                                <span className={`text-[9px] font-extrabold uppercase px-1.5 py-0.5 rounded flex items-center gap-1 ${
                                  notif.emailDelivered 
                                    ? 'bg-emerald-50 text-emerald-600 border border-emerald-200/50' 
                                    : 'bg-slate-50 text-slate-400 border border-slate-200/50'
                                }`}>
                                  <Mail className="w-2.5 h-2.5" /> Email Sent
                                </span>
                                <span className={`text-[9px] font-extrabold uppercase px-1.5 py-0.5 rounded flex items-center gap-1 ${
                                  notif.pwaDelivered 
                                    ? 'bg-blue-50 text-blue-600 border border-blue-200/50' 
                                    : 'bg-slate-50 text-slate-400 border border-slate-200/50'
                                }`}>
                                  <Monitor className="w-2.5 h-2.5" /> PWA Alerted
                                </span>
                              </div>
                            </div>
                          </div>

                          <div className="flex items-center gap-1 shrink-0">
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                handleSelectNotification(notif);
                              }}
                              className="p-1 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-md transition cursor-pointer"
                              title="Preview Email template"
                            >
                              <Eye className="w-4 h-4" />
                            </button>
                            <button
                              onClick={(e) => handleDeleteNotification(notif.id, e)}
                              className="p-1 text-slate-400 hover:text-rose-500 hover:bg-rose-50 rounded-md transition cursor-pointer"
                              title="Delete notification"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            ) : (
              /* NOTIFICATION SETTINGS PANEL */
              <form onSubmit={handleSaveSettings} className="p-6 space-y-6">
                
                {/* Success Message Banner */}
                {successMessage && (
                  <div className="p-3.5 bg-emerald-50 border border-emerald-100 rounded-xl flex items-center space-x-2.5 text-xs text-emerald-700 font-semibold animate-in slide-in-from-top-2">
                    <Check className="w-4 h-4 text-emerald-600 shrink-0" />
                    <span>{successMessage}</span>
                  </div>
                )}

                {/* Primary Channels Settings */}
                <div className="space-y-4">
                  <h5 className="text-xs font-bold text-slate-400 uppercase tracking-wider">Communication Channels</h5>
                  
                  {/* PWA / Native Browser Notifications Toggle */}
                  <div className="p-4 bg-slate-50 hover:bg-slate-100/50 rounded-2xl border border-slate-100/80 transition-all flex items-start justify-between gap-4">
                    <div className="flex gap-3.5">
                      <div className="p-2.5 bg-indigo-50 text-indigo-600 rounded-xl shrink-0 mt-0.5">
                        <Monitor className="w-5 h-5" />
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-bold text-slate-800 text-xs">PWA Push Alerts</span>
                          <span className={`text-[8px] font-extrabold uppercase px-1.5 py-0.5 rounded-full ${
                            permissionStatus === 'granted' 
                              ? 'bg-emerald-50 text-emerald-600 border border-emerald-100' 
                              : 'bg-amber-50 text-amber-600 border border-amber-100'
                          }`}>
                            Browser Status: {permissionStatus}
                          </span>
                        </div>
                        <p className="text-slate-400 text-[10px] mt-1 leading-relaxed">
                          Receive interactive browser push alerts instantly, even when looking at other tabs. Click 'Request/Enable' to authorize.
                        </p>
                        
                        {permissionStatus !== 'granted' && (
                          <button
                            type="button"
                            onClick={requestPWAPermission}
                            className="mt-2.5 px-3 py-1 bg-indigo-600 hover:bg-indigo-700 text-white font-extrabold text-[9px] rounded-lg shadow-sm transition cursor-pointer uppercase tracking-wider"
                          >
                            Authorize Browser Push
                          </button>
                        )}
                      </div>
                    </div>
                    
                    <label className="relative inline-flex items-center cursor-pointer mt-1 select-none">
                      <input 
                        type="checkbox" 
                        checked={pwaEnabled} 
                        onChange={(e) => setPwaEnabled(e.target.checked)}
                        className="sr-only peer" 
                      />
                      <div className="w-9 h-5 bg-slate-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-teal-500"></div>
                    </label>
                  </div>

                  {/* Email Notifications Toggle */}
                  <div className="p-4 bg-slate-50 hover:bg-slate-100/50 rounded-2xl border border-slate-100/80 transition-all flex items-start justify-between gap-4">
                    <div className="flex gap-3.5">
                      <div className="p-2.5 bg-teal-50 text-teal-600 rounded-xl shrink-0 mt-0.5">
                        <Mail className="w-5 h-5" />
                      </div>
                      <div>
                        <span className="font-bold text-slate-800 text-xs">Email Delivery Queue</span>
                        <p className="text-slate-400 text-[10px] mt-1 leading-relaxed">
                          Dispatches automated HTML transactional workflow alerts directly to your account email address (<strong>{userProfile.email}</strong>) in real-time.
                        </p>
                      </div>
                    </div>
                    
                    <label className="relative inline-flex items-center cursor-pointer mt-1 select-none">
                      <input 
                        type="checkbox" 
                        checked={emailEnabled} 
                        onChange={(e) => setEmailEnabled(e.target.checked)}
                        className="sr-only peer" 
                      />
                      <div className="w-9 h-5 bg-slate-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-teal-500"></div>
                    </label>
                  </div>
                </div>

                {/* Event Actions Settings */}
                <div className="space-y-3.5">
                  <h5 className="text-xs font-bold text-slate-400 uppercase tracking-wider">Trigger Events</h5>
                  
                  <div className="border border-slate-100 rounded-2xl p-4 divide-y divide-slate-100 space-y-3">
                    
                    {/* On Task Created */}
                    <div className="flex items-center justify-between pt-1 pb-1 select-none">
                      <div>
                        <p className="text-xs font-bold text-slate-700">When new tasks are created</p>
                        <p className="text-[10px] text-slate-400 mt-0.5">Trigger notifications immediately upon workspace assignment</p>
                      </div>
                      <input 
                        type="checkbox" 
                        checked={onTaskCreated} 
                        onChange={(e) => setOnTaskCreated(e.target.checked)}
                        className="rounded text-teal-500 focus:ring-teal-500 h-4 w-4 border-slate-300 transition cursor-pointer"
                      />
                    </div>

                    {/* On Task Status Changed */}
                    <div className="flex items-center justify-between pt-3 pb-1 select-none">
                      <div>
                        <p className="text-xs font-bold text-slate-700">When status transitions occur</p>
                        <p className="text-[10px] text-slate-400 mt-0.5">{"Transition updates (e.g. TODO -> REVIEW -> COMPLETED)"}</p>
                      </div>
                      <input 
                        type="checkbox" 
                        checked={onTaskStatusChanged} 
                        onChange={(e) => setOnTaskStatusChanged(e.target.checked)}
                        className="rounded text-teal-500 focus:ring-teal-500 h-4 w-4 border-slate-300 transition cursor-pointer"
                      />
                    </div>

                    {/* On Comment Added */}
                    <div className="flex items-center justify-between pt-3 pb-1 select-none">
                      <div>
                        <p className="text-xs font-bold text-slate-700">When discussion comments are added</p>
                        <p className="text-[10px] text-slate-400 mt-0.5">Comments or logs added by members inside any tasks</p>
                      </div>
                      <input 
                        type="checkbox" 
                        checked={onCommentAdded} 
                        onChange={(e) => setOnCommentAdded(e.target.checked)}
                        className="rounded text-teal-500 focus:ring-teal-500 h-4 w-4 border-slate-300 transition cursor-pointer"
                      />
                    </div>

                    {/* On Task Deleted */}
                    <div className="flex items-center justify-between pt-3 pb-1 select-none">
                      <div>
                        <p className="text-xs font-bold text-slate-700">When tasks are archived or deleted</p>
                        <p className="text-[10px] text-slate-400 mt-0.5">Crucial removal alert for system record changes</p>
                      </div>
                      <input 
                        type="checkbox" 
                        checked={onTaskDeleted} 
                        onChange={(e) => setOnTaskDeleted(e.target.checked)}
                        className="rounded text-teal-500 focus:ring-teal-500 h-4 w-4 border-slate-300 transition cursor-pointer"
                      />
                    </div>

                  </div>
                </div>

                {/* Submit Action */}
                <div className="flex items-center justify-end pt-2 border-t border-slate-100">
                  <button
                    type="submit"
                    disabled={isSaving}
                    className="px-5 py-2 bg-teal-600 hover:bg-teal-700 disabled:bg-slate-300 text-white text-xs font-extrabold rounded-xl transition shadow-sm cursor-pointer"
                  >
                    {isSaving ? 'Saving Settings...' : 'Save Preferences'}
                  </button>
                </div>
              </form>
            )}

          </div>
        </div>

      </div>
    </div>
  );
}
