/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { collection, query, where, orderBy, onSnapshot, doc, updateDoc, writeBatch, deleteDoc } from 'firebase/firestore';
import { db } from '../firebase';
import { UserProfile, Notification as WorkspaceNotification, UserNotificationSettings, Task } from '../types';
import { DEFAULT_NOTIFICATION_SETTINGS, checkAndGenerateDueSoonOverdueNotifications } from '../utils/notifications';
import { Bell, Settings, X, ArrowLeft, ExternalLink, FileText, MessageSquare, Calendar, User, Clock, Target, Trash2, CheckCircle2, Circle } from 'lucide-react';

interface NotificationModalProps {
  isOpen: boolean;
  onClose: () => void;
  userProfile: UserProfile;
  onUpdateProfile: (updatedProfile: UserProfile) => void;
  tasks?: Task[];
  onOpenTask?: (task: Task, commentId?: string | null) => void;
  onSelectChannel?: (channelId: string) => void;
}

function formatRelativeTime(dateString: string): string {
  try {
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffSec = Math.floor(diffMs / 1000);
    const diffMin = Math.floor(diffSec / 60);
    const diffHr = Math.floor(diffMin / 60);
    const diffDays = Math.floor(diffHr / 24);

    if (diffSec < 5) return 'Just now';
    if (diffSec < 60) return `${diffSec} seconds ago`;
    if (diffMin < 60) return `${diffMin} ${diffMin === 1 ? 'minute' : 'minutes'} ago`;
    if (diffHr < 24) return `${diffHr} ${diffHr === 1 ? 'hour' : 'hours'} ago`;
    return `${diffDays} ${diffDays === 1 ? 'day' : 'days'} ago`;
  } catch (e) {
    return 'Recently';
  }
}

export default function NotificationModal({
  isOpen,
  onClose,
  userProfile,
  onUpdateProfile,
  tasks = [],
  onOpenTask,
  onSelectChannel
}: NotificationModalProps) {
  const [activeTab, setActiveTab] = useState<'inbox' | 'settings'>('inbox');
  const [notifications, setNotifications] = useState<WorkspaceNotification[]>([]);
  const [selectedNotification, setSelectedNotification] = useState<WorkspaceNotification | null>(null);
  const [subFilter, setSubFilter] = useState<'all' | 'unread' | 'mentions' | 'tasks' | 'targets'>('all');
  
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

  // Run dynamic due soon / overdue scans when opening Notification Center
  useEffect(() => {
    if (isOpen && userProfile && tasks.length > 0) {
      checkAndGenerateDueSoonOverdueNotifications(userProfile.workspaceId, userProfile, tasks);
    }
  }, [isOpen, userProfile, tasks]);

  // Read personal notifications from Firestore in real-time
  useEffect(() => {
    if (!isOpen || !userProfile) return;

    const notifRef = collection(db, 'workspaces', userProfile.workspaceId, 'notifications');
    // Personal Notifications: Only load notifications intended for the logged-in user
    const q = query(
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
      console.error('Error saving preferences:', error);
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

  const handleOpenRelatedTask = (notif: WorkspaceNotification) => {
    if (!notif.taskId) return;
    
    // Mark as read first
    if (!notif.isRead) {
      const ref = doc(db, 'workspaces', userProfile.workspaceId, 'notifications', notif.id);
      updateDoc(ref, { isRead: true }).catch(err => console.error(err));
    }

    // Try finding the matching task
    const liveTask = tasks.find(t => t.id === notif.taskId);
    if (liveTask) {
      // Open exact channel if provided
      if (notif.channelId && onSelectChannel) {
        onSelectChannel(notif.channelId);
      }
      if (onOpenTask) {
        onOpenTask(liveTask, notif.commentId);
      }
    } else {
      alert('This task has been archived, deleted, or is no longer in this workspace.');
    }
  };

  // Filtering Logic
  const filteredNotifications = notifications.filter((notif) => {
    if (subFilter === 'unread') return !notif.isRead;
    if (subFilter === 'mentions') return notif.notificationType === 'mention_comment';
    if (subFilter === 'tasks') {
      return notif.notificationType?.startsWith('task_') || 
             notif.notificationType === 'comment_added' || 
             notif.notificationType === 'mention_comment';
    }
    if (subFilter === 'targets') {
      return notif.notificationType?.startsWith('target_') || 
             notif.notificationType === 'target_assigned' || 
             notif.notificationType === 'target_progress';
    }
    return true; // 'all'
  });

  return (
    <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center z-50 p-4 select-none animate-in fade-in duration-200">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-4xl h-[650px] flex overflow-hidden border border-slate-100 animate-in zoom-in-95 duration-200">
        
        {/* Left Sidebar Layout */}
        <div className="w-72 bg-slate-50 border-r border-slate-100 flex flex-col shrink-0">
          <div className="p-6 border-b border-slate-100 flex items-center justify-between">
            <div className="flex items-center space-x-2.5">
              <div className="p-2 bg-teal-50 rounded-xl">
                <Bell className="w-5 h-5 text-teal-600" />
              </div>
              <div>
                <h3 className="font-extrabold text-slate-800 text-base">Notification Center</h3>
                <p className="text-[10px] text-slate-400 font-medium">Your personal workspace notifications</p>
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
              <span>Workspace Inbox ({notifications.filter(n => !n.isRead).length} unread)</span>
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
              <span>Configure Settings</span>
            </button>
          </div>

          {/* Simple Clean Guide Card in Page Margin */}
          <div className="m-4 p-4 bg-slate-100 border border-slate-200/50 rounded-xl text-center">
            <p className="text-[10px] text-slate-500 leading-normal font-medium">
              This panel aggregates all personal mentions, direct task assignments, target updates, and due status alerts intended for you.
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
                  ? 'Notification Details'
                  : activeTab === 'inbox'
                  ? 'Your Activity Feed'
                  : 'Configure Alerting Events'}
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
            
            {/* NOTIFICATION DETAILS PANEL */}
            {selectedNotification ? (
              (() => {
                const liveTask = selectedNotification.taskId
                  ? tasks.find((t) => t.id === selectedNotification.taskId)
                  : null;

                const taskTitle = liveTask?.title || selectedNotification.taskTitle || "Unavailable Task";
                const taskDesc = liveTask?.description || selectedNotification.taskDescription || "";
                const taskStatus = liveTask?.status || selectedNotification.taskStatus || "";
                const taskPriority = liveTask?.priority || selectedNotification.taskPriority || "";
                const taskDueDate = liveTask?.dueDate || selectedNotification.taskDueDate || "";

                // Determine action metadata
                let actionLabel = "Workspace Action";
                let actionBg = "bg-slate-50 border-slate-100 text-slate-700";
                let ActionIconComp = Bell;

                switch (selectedNotification.notificationType) {
                  case 'task_assigned':
                    actionLabel = "Task Assigned";
                    actionBg = "bg-emerald-50 border-emerald-100 text-emerald-700";
                    ActionIconComp = User;
                    break;
                  case 'mention_comment':
                    actionLabel = "Mentioned In Comment";
                    actionBg = "bg-purple-50 border-purple-100 text-purple-700";
                    ActionIconComp = MessageSquare;
                    break;
                  case 'comment_added':
                    actionLabel = "New Comment";
                    actionBg = "bg-indigo-50 border-indigo-100 text-indigo-700";
                    ActionIconComp = MessageSquare;
                    break;
                  case 'task_status_changed':
                    actionLabel = "Status Updated";
                    actionBg = "bg-blue-50 border-blue-100 text-blue-700";
                    ActionIconComp = Clock;
                    break;
                  case 'task_due_soon':
                    actionLabel = "Task Due Soon";
                    actionBg = "bg-amber-50 border-amber-100 text-amber-700";
                    ActionIconComp = Calendar;
                    break;
                  case 'task_overdue':
                    actionLabel = "Task Overdue";
                    actionBg = "bg-rose-50 border-rose-100 text-rose-700";
                    ActionIconComp = Clock;
                    break;
                  case 'target_assigned':
                    actionLabel = "Target Assigned";
                    actionBg = "bg-teal-50 border-teal-100 text-teal-700";
                    ActionIconComp = Target;
                    break;
                  case 'target_progress':
                    actionLabel = "Target Progress";
                    actionBg = "bg-cyan-50 border-cyan-100 text-cyan-700";
                    ActionIconComp = Target;
                    break;
                }

                return (
                  <div className="h-full flex flex-col bg-slate-50 overflow-y-auto">
                    <div className="bg-white border-b border-slate-200 p-5 shrink-0 flex flex-col space-y-3 shadow-sm">
                      <div className="flex items-center justify-between">
                        <span className={`px-2.5 py-1 rounded-lg text-xs font-bold border flex items-center gap-1.5 ${actionBg}`}>
                          <ActionIconComp className="w-3.5 h-3.5" />
                          {actionLabel}
                        </span>
                        <span className="text-xs font-semibold text-slate-400">
                          {new Date(selectedNotification.createdAt).toLocaleString()}
                        </span>
                      </div>

                      <div className="flex flex-col space-y-1.5">
                        <h4 className="font-extrabold text-slate-800 text-base leading-snug">
                          {selectedNotification.message || selectedNotification.details}
                        </h4>
                        <div className="flex items-center gap-2 text-xs text-slate-500">
                          <span className="font-semibold text-slate-600">Performed by:</span>
                          <span className="font-bold text-slate-700">{selectedNotification.senderName}</span>
                          {selectedNotification.channelName && (
                            <>
                              <span className="text-slate-300">•</span>
                              <span className="font-semibold text-slate-600">Channel:</span>
                              <span className="font-bold text-slate-700">#{selectedNotification.channelName}</span>
                            </>
                          )}
                        </div>
                      </div>
                    </div>

                    <div className="p-6 space-y-6 flex-1 max-w-2xl mx-auto w-full">
                      <div className="bg-white border border-slate-200 rounded-xl p-6 shadow-sm space-y-4">
                        <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                          <h5 className="text-[11px] font-bold text-slate-400 uppercase tracking-widest flex items-center gap-1">
                            <FileText className="w-3.5 h-3.5 text-slate-400" /> Reference Detail
                          </h5>
                          {liveTask && (
                            <span className="bg-teal-500/10 text-teal-700 border border-teal-500/15 font-bold text-[10px] px-2 py-0.5 rounded-md uppercase">
                              Active Task
                            </span>
                          )}
                        </div>

                        {selectedNotification.notificationType === 'comment_added' && (
                          <div className="p-3.5 bg-purple-50 border border-purple-100/50 rounded-xl text-xs text-slate-600">
                            <span className="font-bold text-purple-800 flex items-center gap-1.5 mb-1.5">
                              <MessageSquare className="w-3.5 h-3.5 text-purple-600" /> Discussion Comment
                            </span>
                            <p className="italic text-[11px] leading-relaxed text-slate-700">
                              "{selectedNotification.details.split(' commented: ')[1] || selectedNotification.details}"
                            </p>
                          </div>
                        )}

                        <div className="space-y-4">
                          <div>
                            <h3 className="text-base font-extrabold text-slate-800 tracking-tight leading-snug">
                              {taskTitle}
                            </h3>
                            {taskDesc && (
                              <p className="text-xs text-slate-500 mt-1.5 leading-relaxed">
                                {taskDesc}
                              </p>
                            )}
                          </div>

                          {selectedNotification.taskId && (
                            <div className="grid grid-cols-2 gap-3.5 pt-4 border-t border-slate-100 text-xs">
                              {taskStatus && (
                                <div className="p-2.5 bg-slate-50 rounded-lg">
                                  <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider block font-semibold">Workflow Status</span>
                                  <span className="font-bold text-slate-700 uppercase mt-0.5 block">
                                    {taskStatus}
                                  </span>
                                </div>
                              )}

                              {taskPriority && (
                                <div className="p-2.5 bg-slate-50 rounded-lg">
                                  <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider block font-semibold">Priority Tier</span>
                                  <span className={`font-bold uppercase mt-0.5 block ${
                                    taskPriority === 'high' ? 'text-rose-500' : taskPriority === 'medium' ? 'text-amber-500' : 'text-emerald-500'
                                  }`}>
                                    {taskPriority}
                                  </span>
                                </div>
                              )}

                              {taskDueDate && (
                                <div className="p-2.5 bg-slate-50 rounded-lg col-span-2 flex items-center gap-2">
                                  <Calendar className="w-4 h-4 text-slate-400 shrink-0" />
                                  <div>
                                    <span className="text-[9px] text-slate-400 font-bold uppercase tracking-wider block font-semibold">Due Date</span>
                                    <span className="font-bold text-slate-700">{taskDueDate}</span>
                                  </div>
                                </div>
                              )}
                            </div>
                          )}

                          {selectedNotification.taskId && liveTask && onOpenTask && (
                            <div className="pt-3">
                              <button
                                type="button"
                                onClick={() => {
                                  onClose();
                                  handleOpenRelatedTask(selectedNotification);
                                }}
                                className="w-full py-3 px-4 bg-teal-600 hover:bg-teal-700 text-white font-extrabold text-xs rounded-xl shadow-sm transition flex items-center justify-center gap-2 cursor-pointer"
                              >
                                <span>Go to Related Channel & Task</span>
                                <ExternalLink className="w-4 h-4" />
                              </button>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })()
            ) : activeTab === 'inbox' ? (
              /* NOTIFICATION FEED LIST */
              <div className="p-6 h-full flex flex-col">
                
                {/* Horizontal Filter Tabs bar */}
                <div className="flex items-center gap-1.5 border-b border-slate-100 pb-4 mb-4 overflow-x-auto shrink-0 select-none">
                  {(['all', 'unread', 'mentions', 'tasks', 'targets'] as const).map((filter) => {
                    const label = filter.charAt(0).toUpperCase() + filter.slice(1);
                    const isActive = subFilter === filter;
                    return (
                      <button
                        key={filter}
                        onClick={() => setSubFilter(filter)}
                        className={`px-3.5 py-1.5 text-xs font-bold rounded-lg border transition cursor-pointer shrink-0 ${
                          isActive
                            ? 'bg-slate-900 border-slate-900 text-white shadow-sm'
                            : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'
                        }`}
                      >
                        {label}
                      </button>
                    );
                  })}
                </div>

                {filteredNotifications.length === 0 ? (
                  <div className="flex-1 flex flex-col items-center justify-center text-center p-8 select-none">
                    <div className="w-12 h-12 bg-slate-50 rounded-2xl flex items-center justify-center mb-4">
                      <Bell className="w-6 h-6 text-slate-300" />
                    </div>
                    <h5 className="font-bold text-slate-700 text-sm">No notifications found</h5>
                    <p className="text-xs text-slate-400 max-w-sm mt-1">
                      No matching personal notifications were found in your feed at this time.
                    </p>
                  </div>
                ) : (
                  <div className="space-y-3.5">
                    <div className="border border-slate-100 rounded-xl overflow-hidden divide-y divide-slate-100">
                      {filteredNotifications.map((notif) => {
                        // Check if task exists and resolving variables
                        const isComment = notif.notificationType === 'comment_added' || notif.notificationType === 'mention_comment';
                        const isTarget = notif.notificationType === 'target_assigned' || notif.notificationType === 'target_progress';
                        const isTaskAssigned = notif.notificationType === 'task_assigned';

                        let highlightLabel = "";
                        if (isComment) highlightLabel = "Comment";
                        else if (isTarget) highlightLabel = "Target Metric";
                        else if (isTaskAssigned) highlightLabel = "Task Assignment";
                        else highlightLabel = "Workspace Update";

                        return (
                          <div
                            key={notif.id}
                            onClick={() => handleSelectNotification(notif)}
                            className={`p-4 flex items-start justify-between gap-4 transition hover:bg-slate-50/80 cursor-pointer ${
                              !notif.isRead ? 'bg-slate-50 border-l-4 border-l-teal-500' : 'bg-white'
                            }`}
                          >
                            <div className="flex items-start space-x-3 min-w-0">
                              <div className={`p-2 rounded-xl shrink-0 mt-0.5 ${
                                !notif.isRead ? 'bg-teal-500/10 text-teal-600 font-semibold' : 'bg-slate-100 text-slate-400'
                              }`}>
                                {isTarget ? <Target className="w-4 h-4" /> : <Bell className="w-4 h-4" />}
                              </div>
                              
                              <div className="min-w-0 flex-1">
                                <div className="flex items-center gap-2 flex-wrap mb-1">
                                  <span className="text-xs font-bold text-slate-800">
                                    {notif.senderName}
                                  </span>
                                  <span className="text-[10px] text-slate-400 font-medium">
                                    {formatRelativeTime(notif.createdAt)}
                                  </span>
                                  {!notif.isRead && (
                                    <span className="bg-blue-600 text-white font-extrabold text-[8px] px-1.5 py-0.5 rounded-full uppercase tracking-wider scale-90">
                                      New
                                    </span>
                                  )}
                                  {highlightLabel && (
                                    <span className="bg-slate-100 text-slate-500 text-[8px] font-bold px-1.5 py-0.5 rounded">
                                      {highlightLabel}
                                    </span>
                                  )}
                                </div>

                                <p className="text-xs font-semibold text-slate-700 leading-snug">
                                  {notif.message || notif.details}
                                </p>

                                {/* Channel and Target details matching layout request */}
                                <div className="flex flex-col gap-1 mt-2 text-[11px] text-slate-500 font-medium border-l-2 border-slate-100 pl-2">
                                  {notif.channelName && (
                                    <div>
                                      Channel: <span className="font-bold text-slate-600">#{notif.channelName}</span>
                                    </div>
                                  )}
                                  {notif.taskTitle && (
                                    <div>
                                      Task: <span className="font-bold text-slate-600">"{notif.taskTitle}"</span>
                                    </div>
                                  )}
                                </div>
                              </div>
                            </div>

                            <div className="flex items-center gap-1 shrink-0 self-center">
                              {notif.taskId && (
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handleOpenRelatedTask(notif);
                                  }}
                                  className="p-1.5 text-slate-400 hover:text-teal-600 hover:bg-teal-50 rounded-lg transition cursor-pointer"
                                  title="Open Related Task"
                                >
                                  <ExternalLink className="w-3.5 h-3.5" />
                                </button>
                              )}
                              <button
                                onClick={(e) => handleDeleteNotification(notif.id, e)}
                                className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition cursor-pointer"
                                title="Delete Notification"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          </div>
                        );
                      })}
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
                    <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                    <span>{successMessage}</span>
                  </div>
                )}

                {/* Primary Channels Settings */}
                <div className="space-y-4">
                  <h5 className="text-xs font-bold text-slate-400 uppercase tracking-wider">Communication Channels</h5>
                  
                  {/* Native Push Alerts Toggle */}
                  <div className="p-4 bg-slate-50 rounded-2xl border border-slate-100 transition-all flex items-start justify-between gap-4">
                    <div className="flex gap-3.5">
                      <div className="p-2.5 bg-indigo-50 text-indigo-600 rounded-xl shrink-0 mt-0.5">
                        <Bell className="w-5 h-5" />
                      </div>
                      <div>
                        <span className="font-bold text-slate-800 text-xs block">In-App Push Alerts</span>
                        <p className="text-slate-400 text-[10px] mt-1 leading-relaxed">
                          Receive instant, high-visibility notifications directly within the TEAM 4 Hub platform interface.
                        </p>
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
                  <div className="p-4 bg-slate-50 rounded-2xl border border-slate-100 transition-all flex items-start justify-between gap-4">
                    <div className="flex gap-3.5">
                      <div className="p-2.5 bg-teal-50 text-teal-600 rounded-xl shrink-0 mt-0.5">
                        <Clock className="w-5 h-5" />
                      </div>
                      <div>
                        <span className="font-bold text-slate-800 text-xs block">Email Dispatch Queue</span>
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
                        <p className="text-[10px] text-slate-400 mt-0.5">Comments or mentions inside active tasks</p>
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
                        <p className="text-[10px] text-slate-400 mt-0.5">Crucial removal alerts for system record changes</p>
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
