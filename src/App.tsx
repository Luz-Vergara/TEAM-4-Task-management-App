/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { onAuthStateChanged } from 'firebase/auth';
import { 
  doc, 
  getDoc, 
  collection, 
  query, 
  where, 
  onSnapshot, 
  setDoc, 
  addDoc, 
  deleteDoc, 
  orderBy,
  updateDoc
} from 'firebase/firestore';
import { auth, db } from './firebase';
import { 
  UserProfile, 
  Workspace, 
  Channel, 
  Task, 
  ActivityLog, 
  TaskStatus, 
  TaskPriority, 
  UserRole,
  Comment
} from './types';
import { logActivity, parseSizeToBytes } from './utils';

// UI Components
import AuthScreen from './components/AuthScreen';
import Sidebar from './components/Sidebar';
import Dashboard from './components/Dashboard';
import ChannelView from './components/ChannelView';
import TaskModal from './components/TaskModal';
import AdminPanel from './components/AdminPanel';
import NotificationModal from './components/NotificationModal';
import EmailSandbox from './components/EmailSandbox';
import TargetsPerformance from './components/TargetsPerformance';
import PWAInstallPrompt from './components/PWAInstallPrompt';
import TaskOverview from './components/TaskOverview';

import { dispatchNotification } from './utils/notifications';

import { Loader2, Sparkles, Hash, Plus, X, AlertTriangle, Bell, UserPlus, MessageSquare, ArrowUpRight, Trash2, CheckCircle2 } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

import { useWorkspaceSubscriptions, ToastNotification } from './hooks/useWorkspaceSubscriptions';

export default function App() {
  const [currentUser, setCurrentUser] = useState<any>(null);
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);

  const {
    workspace,
    channels,
    members,
    tasks,
    comments,
    logs,
    unreadNotifsCount,
    toasts,
    setToasts
  } = useWorkspaceSubscriptions({ userProfile });

  // Navigation state
  const [activeView, setActiveView] = useState<'dashboard' | 'channel' | 'admin' | 'dispatches' | 'targets' | 'all-tasks'>('dashboard');
  const [selectedChannelId, setSelectedChannelId] = useState<string | null>(null);
  
  // Modals state
  const [activeTaskForModal, setActiveTaskForModal] = useState<Task | null>(null);
  const [isTaskModalOpen, setIsTaskModalOpen] = useState(false);
  const [highlightedCommentId, setHighlightedCommentId] = useState<string | null>(null);
  const [taskModalInitialStatus, setTaskModalInitialStatus] = useState<TaskStatus>(TaskStatus.TODO);
  const [isCreateChannelOpen, setIsCreateChannelOpen] = useState(false);
  const [isNotificationModalOpen, setIsNotificationModalOpen] = useState(false);
  const [parentChannelId, setParentChannelId] = useState<string | null>(null);

  // Simple Add Channel states
  const [newChName, setNewChName] = useState('');
  const [newChDesc, setNewChDesc] = useState('');
  const [chError, setChError] = useState('');

  // App initialization and session monitoring
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      setLoading(true);
      if (user) {
        setCurrentUser(user);
        // Fetch profile
        const userDocRef = doc(db, 'users', user.uid);
        const userDoc = await getDoc(userDocRef);
        if (userDoc.exists()) {
          const profile = userDoc.data() as UserProfile;
          const userEmail = profile.email || user.email || '';
          if (
            userEmail && 
            (userEmail.toLowerCase() === 'lmvergara@tesda.com' || 
             userEmail.toLowerCase() === 'lmvergara@tesda.gov.ph') && 
            profile.role !== UserRole.ADMIN
          ) {
            const updatedProfile = { ...profile, role: UserRole.ADMIN };
            await setDoc(userDocRef, updatedProfile);
            setUserProfile(updatedProfile);
          } else {
            setUserProfile(profile);
          }
        } else {
          // Fallback if auth is live but profile isn't indexed yet
          setUserProfile(null);
        }
      } else {
        setCurrentUser(null);
        setUserProfile(null);
      }
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  // Auto-select 'general' or first channel on load, or fallback if selected channel is deleted
  useEffect(() => {
    if (channels.length > 0) {
      const channelExists = channels.some((c) => c.id === selectedChannelId);
      if (!selectedChannelId || !channelExists) {
        const general = channels.find((c) => c.name === 'general');
        setSelectedChannelId(general ? general.id : channels[0].id);
      }
    }
  }, [channels, selectedChannelId]);

  const handleAuthSuccess = (profile: UserProfile) => {
    setUserProfile(profile);
  };

  const handleSelectChannel = (channelId: string) => {
    setSelectedChannelId(channelId);
    setActiveView('channel');
  };

  const handleSelectView = (view: 'dashboard' | 'channel' | 'admin' | 'dispatches' | 'targets' | 'all-tasks') => {
    setActiveView(view);
  };

  const handleAddTaskClick = (status: TaskStatus = TaskStatus.TODO) => {
    setTaskModalInitialStatus(status);
    setActiveTaskForModal(null);
    setIsTaskModalOpen(true);
  };

  const handleSelectTaskDetails = (task: Task) => {
    setActiveTaskForModal(task);
    setIsTaskModalOpen(true);
  };

  // Create or Edit a Task in Firestore
  const handleSaveTask = async (taskData: Partial<Task>, shouldCloseModal: boolean = true) => {
    if (!userProfile) return;

    try {
      const wId = userProfile.workspaceId;
      const tasksRef = collection(db, 'workspaces', wId, 'tasks');
      const isNew = !activeTaskForModal;

      const taskId = isNew 
        ? 'task-' + Math.random().toString(36).substr(2, 9)
        : activeTaskForModal.id;

      const taskDocRef = doc(tasksRef, taskId);

      if (isNew) {
        // Create full Task object
        const finalTask: Task = {
          id: taskId,
          workspaceId: wId,
          channelId: taskData.channelId || selectedChannelId || 'general',
          title: taskData.title || 'Untitled Task',
          description: taskData.description || '',
          assignedUserId: taskData.assignedUserId || '',
          creatorId: userProfile.uid,
          priority: taskData.priority || TaskPriority.MEDIUM,
          status: taskData.status || TaskStatus.TODO,
          dueDate: taskData.dueDate || '',
          targetId: taskData.targetId !== undefined ? taskData.targetId : null,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
          completedAt: (taskData.status === TaskStatus.COMPLETED) ? new Date().toISOString() : undefined,
          attachments: taskData.attachments || []
        };

        await setDoc(taskDocRef, finalTask);

        await logActivity(
          wId,
          userProfile.uid,
          userProfile.name,
          'task_created',
          `Created task "${finalTask.title}" inside channel #${taskData.channelId || selectedChannelId}`
        );

        await dispatchNotification(
          wId,
          'task_created',
          `Created task "${finalTask.title}" inside channel #${taskData.channelId || selectedChannelId}`,
          { uid: userProfile.uid, name: userProfile.name },
          finalTask
        );
      } else {
        // Enforce transition rules for status updates:
        // 1. Completed tasks are fully locked from status changes.
        // 2. Tasks cannot be moved back to "To Do".
        if (taskData.status && taskData.status !== activeTaskForModal.status) {
          if (activeTaskForModal.status === TaskStatus.COMPLETED) {
            delete taskData.status;
          } else if (taskData.status === TaskStatus.TODO && activeTaskForModal.status !== TaskStatus.TODO) {
            delete taskData.status;
          }
        }

        // Update task parameters
        const updatePayload: any = {
          ...taskData,
          updatedAt: new Date().toISOString()
        };

        if (taskData.status === TaskStatus.COMPLETED && activeTaskForModal.status !== TaskStatus.COMPLETED) {
          updatePayload.completedAt = new Date().toISOString();
        }

        await updateDoc(taskDocRef, updatePayload);

        // Fetch user name for logger detail if task changed assignee
        const updatedTitle = taskData.title || activeTaskForModal.title;
        let logDetail = `Updated task "${updatedTitle}" parameters`;
        let isStatusUpdate = false;
        if (taskData.status && taskData.status !== activeTaskForModal.status) {
          logDetail = `Transitioned task "${updatedTitle}" to status "${taskData.status}"`;
          isStatusUpdate = true;
        }

        await logActivity(
          wId,
          userProfile.uid,
          userProfile.name,
          'task_updated',
          logDetail
        );

        await dispatchNotification(
          wId,
          isStatusUpdate ? 'task_status_changed' : 'task_status_changed', // Maps to status changed trigger
          logDetail,
          { uid: userProfile.uid, name: userProfile.name },
          { ...activeTaskForModal, ...taskData } as Task
        );
      }

      if (shouldCloseModal) {
        setIsTaskModalOpen(false);
        setActiveTaskForModal(null);
      } else if (activeTaskForModal) {
        const freshDoc = await getDoc(taskDocRef);
        if (freshDoc.exists()) {
          setActiveTaskForModal({ id: freshDoc.id, ...freshDoc.data() } as Task);
        } else {
          setActiveTaskForModal(prev => prev ? { ...prev, ...taskData } as Task : null);
        }
      }
    } catch (e) {
      console.error('Error saving task:', e);
    }
  };

  // Delete task completely
  const handleDeleteTask = async (taskId: string) => {
    if (!userProfile) return;
    try {
      const wId = userProfile.workspaceId;
      const taskDocRef = doc(db, 'workspaces', wId, 'tasks', taskId);
      
      const targetTask = tasks.find(t => t.id === taskId);
      await deleteDoc(taskDocRef);

      await logActivity(
        wId,
        userProfile.uid,
        userProfile.name,
        'task_deleted',
        `Deleted task "${targetTask?.title || taskId}"`
      );

      await dispatchNotification(
        wId,
        'task_deleted',
        targetTask?.title || taskId,
        { uid: userProfile.uid, name: userProfile.name }
      );

      setIsTaskModalOpen(false);
      setActiveTaskForModal(null);
    } catch (e) {
      console.error('Error deleting task:', e);
    }
  };

  // Update Task Status directly from board quick switcher
  const handleUpdateTaskStatus = async (task: Task, newStatus: TaskStatus) => {
    if (!userProfile) return;

    // Strict business rules for task transitions:
    // 1. Completed tasks cannot be moved.
    if (task.status === TaskStatus.COMPLETED) {
      console.warn("Completed tasks cannot be moved or have their status changed.");
      return;
    }
    // 2. Tasks cannot be moved back to To Do status.
    if (newStatus === TaskStatus.TODO && task.status !== TaskStatus.TODO) {
      console.warn("Tasks that are in progress or under review cannot be moved back to the To Do list.");
      return;
    }

    try {
      const wId = userProfile.workspaceId;
      const taskDocRef = doc(db, 'workspaces', wId, 'tasks', task.id);
      
      await updateDoc(taskDocRef, {
        status: newStatus,
        updatedAt: new Date().toISOString()
      });

      await logActivity(
        wId,
        userProfile.uid,
        userProfile.name,
        'task_status_transitioned',
        `Moved task "${task.title}" to "${newStatus}"`
      );

      await dispatchNotification(
        wId,
        'task_status_changed',
        `Moved task "${task.title}" to "${newStatus}"`,
        { uid: userProfile.uid, name: userProfile.name },
        { ...task, status: newStatus } as Task
      );
    } catch (e) {
      console.error('Error transitioning task status:', e);
    }
  };

  // Simple Create Channel from sidebar shortcut
  const handleCreateChannelSidebar = async (e: React.FormEvent) => {
    e.preventDefault();
    setChError('');
    if (!newChName.trim() || !userProfile) return;

    try {
      const wId = userProfile.workspaceId;
      const channelId = newChName.trim().toLowerCase().replace(/[^a-z0-9]+/g, '-');
      const channelsRef = collection(db, 'workspaces', wId, 'channels');

      const data = {
        id: channelId,
        workspaceId: wId,
        name: newChName.trim(),
        description: newChDesc.trim() || 'No description',
        isArchived: false,
        assignedLeaderId: '',
        createdAt: new Date().toISOString(),
        parentId: parentChannelId || undefined
      };

      await setDoc(doc(channelsRef, channelId), data);

      await logActivity(
        wId,
        userProfile.uid,
        userProfile.name,
        'channel_created',
        `Created channel #${data.name}`
      );

      setNewChName('');
      setNewChDesc('');
      setIsCreateChannelOpen(false);
      setSelectedChannelId(channelId);
      setActiveView('channel');
    } catch (err: any) {
      console.error('Error creating channel:', err);
      setChError(err.message || 'Error creating channel');
    }
  };

  // Archive channel from channel view
  const handleArchiveChannelView = async () => {
    if (!userProfile || !selectedChannelId) return;
    try {
      const wId = userProfile.workspaceId;
      const chRef = doc(db, 'workspaces', wId, 'channels', selectedChannelId);
      await updateDoc(chRef, { isArchived: true });

      const chName = channels.find(c => c.id === selectedChannelId)?.name || selectedChannelId;
      await logActivity(
        wId,
        userProfile.uid,
        userProfile.name,
        'channel_archived',
        `Archived channel #${chName}`
      );

      // Select 'general' as fallback
      const general = channels.find(c => c.name === 'general');
      setSelectedChannelId(general ? general.id : null);
      setActiveView('dashboard');
    } catch (e) {
      console.error('Error archiving channel:', e);
    }
  };

  const handleLogout = () => {
    setUserProfile(null);
    setCurrentUser(null);
  };

  // Render Loader screen
  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 text-slate-800 flex flex-col items-center justify-center font-sans space-y-4">
        <Loader2 className="w-8 h-8 text-teal-500 animate-spin" />
        <div className="text-sm text-slate-500 font-medium">Booting Synapse Workspace...</div>
      </div>
    );
  }

  // Render Auth screen if not logged in
  if (!userProfile) {
    return <AuthScreen onAuthSuccess={handleAuthSuccess} />;
  }

  // Active channel details object
  const activeChannelObj = channels.find((c) => c.id === selectedChannelId);

  // Real-time Firebase Storage calculations
  const totalStorageBytes = (() => {
    let totalBytes = 0;
    tasks.forEach(task => {
      if (task.attachments) {
        task.attachments.forEach(att => {
          if (att.type === 'file') {
            totalBytes += parseSizeToBytes(att.size, att.rawSize);
          }
        });
      }
    });
    comments.forEach(comment => {
      if (comment.attachments) {
        comment.attachments.forEach(att => {
          if (att.type === 'file') {
            totalBytes += parseSizeToBytes(att.size, att.rawSize);
          }
        });
      }
    });
    return totalBytes;
  })();

  const allUploadedAttachments = (() => {
    const list: any[] = [];
    tasks.forEach(task => {
      if (task.attachments) {
        task.attachments.forEach(att => {
          if (att.type === 'file') {
            list.push({
              ...att,
              sourceType: 'task',
              sourceId: task.id,
              sourceTitle: task.title,
            });
          }
        });
      }
    });
    comments.forEach(comment => {
      if (comment.attachments) {
        comment.attachments.forEach(att => {
          if (att.type === 'file') {
            list.push({
              ...att,
              sourceType: 'comment',
              sourceId: comment.taskId || '',
              sourceTitle: comment.taskId ? 'Task Comment' : 'Channel Chat',
            });
          }
        });
      }
    });
    return list;
  })();

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 flex flex-col md:flex-row font-sans overflow-hidden">
      {/* Sidebar navigation */}
      <Sidebar
        userProfile={userProfile}
        workspaceName={workspace?.name || 'Synapse Project room'}
        workspaceJoinCode={workspace?.joinCode}
        channels={channels}
        selectedChannelId={selectedChannelId}
        activeView={activeView}
        members={members}
        unreadNotifsCount={unreadNotifsCount}
        storageBytes={totalStorageBytes}
        allAttachments={allUploadedAttachments}
        onSelectChannel={handleSelectChannel}
        onSelectView={handleSelectView}
        onAddChannel={() => { setParentChannelId(null); setIsCreateChannelOpen(true); }}
        onAddSubChannel={(parentId) => { setParentChannelId(parentId); setIsCreateChannelOpen(true); }}
        onLogout={handleLogout}
        onOpenNotifications={() => setIsNotificationModalOpen(true)}
      />

      {/* Main Workspace Frame container */}
      <div className="flex-1 flex flex-col h-screen overflow-hidden relative">
        {activeView === 'dashboard' && (
          <Dashboard
            userProfile={userProfile}
            tasks={tasks}
            members={members}
            channels={channels}
            logs={logs}
            onSelectTask={handleSelectTaskDetails}
            onSelectView={handleSelectView}
          />
        )}

        {activeView === 'admin' && (
          <AdminPanel
            userProfile={userProfile}
            workspace={workspace}
            members={members}
            channels={channels}
            tasks={tasks}
            onRefreshWorkspaceData={() => {}}
          />
        )}

        {activeView === 'dispatches' && (
          <EmailSandbox
            userProfile={userProfile}
            tasks={tasks}
            onOpenTask={(task) => {
              handleSelectTaskDetails(task);
            }}
          />
        )}

        {activeView === 'targets' && (
          <TargetsPerformance
            userProfile={userProfile}
            channels={channels}
            members={members}
            tasks={tasks}
          />
        )}

        {activeView === 'all-tasks' && (
          <TaskOverview
            userProfile={userProfile}
            tasks={tasks}
            members={members}
            channels={channels}
            onSelectTask={handleSelectTaskDetails}
          />
        )}

        {activeView === 'channel' && activeChannelObj && (
          <ChannelView
            userProfile={userProfile}
            channel={activeChannelObj}
            members={members}
            tasks={tasks}
            onAddTask={handleAddTaskClick}
            onSelectTask={handleSelectTaskDetails}
            onEditTask={handleSelectTaskDetails}
            onDeleteTask={handleDeleteTask}
            onUpdateTaskStatus={handleUpdateTaskStatus}
            onArchiveChannel={handleArchiveChannelView}
          />
        )}
      </div>

      {/* ==================== POPUP: INTERACTIVE TASK MODAL ==================== */}
      {isTaskModalOpen && (
        <TaskModal
          userProfile={userProfile}
          task={activeTaskForModal}
          channelId={selectedChannelId || 'general'}
          initialStatus={taskModalInitialStatus}
          members={members}
          onClose={() => {
            setIsTaskModalOpen(false);
            setActiveTaskForModal(null);
            setHighlightedCommentId(null);
          }}
          onSaveTask={handleSaveTask}
          onDeleteTask={handleDeleteTask}
          highlightedCommentId={highlightedCommentId}
        />
      )}

      {/* ==================== POPUP: ADD CHANNEL DIALOG ==================== */}
      {isCreateChannelOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="fixed inset-0 bg-black/40 backdrop-blur-sm" onClick={() => setIsCreateChannelOpen(false)} />
          <div className="bg-white rounded-2xl border border-slate-200 w-full max-w-md p-6 relative z-10 space-y-4 shadow-xl animate-in fade-in duration-200">
            <div className="flex items-center justify-between pb-2 border-b border-slate-100">
              <div className="flex items-center space-x-2 text-teal-500">
                <Hash className="w-5 h-5" />
                <h3 className="font-bold text-slate-800 text-sm">
                  {parentChannelId ? 'Create a Sub-channel' : 'Create a Project Channel'}
                </h3>
              </div>
              {parentChannelId && (
                <p className="text-xs text-slate-500 font-medium">
                  Parent: #{channels.find(c => c.id === parentChannelId)?.name}
                </p>
              )}
              <button
                onClick={() => setIsCreateChannelOpen(false)}
                className="p-1 hover:bg-slate-100 rounded-lg text-slate-400 hover:text-slate-800 transition cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {chError && (
              <div className="p-3 bg-rose-50 border border-rose-200 text-rose-700 text-xs rounded-lg flex gap-1.5 items-start">
                <AlertTriangle className="w-4 h-4 text-rose-500 shrink-0 mt-0.5" />
                <span>{chError}</span>
              </div>
            )}

            <form onSubmit={handleCreateChannelSidebar} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1">Channel Name</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. feedback, web-testing"
                  value={newChName}
                  onChange={(e) => setNewChName(e.target.value)}
                  className="w-full bg-slate-100 border-none rounded-lg py-2.5 px-3 text-xs text-slate-800 focus:outline-none focus:ring-1 focus:ring-teal-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1">Purpose / Description</label>
                <textarea
                  placeholder="Describe the scope or goals of this channel..."
                  value={newChDesc}
                  onChange={(e) => setNewChDesc(e.target.value)}
                  rows={3}
                  className="w-full bg-slate-100 border-none rounded-lg py-2 px-3 text-xs text-slate-800 focus:outline-none focus:ring-1 focus:ring-teal-500 resize-none"
                />
              </div>

              <div className="flex justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setIsCreateChannelOpen(false)}
                  className="px-4 py-2 border border-slate-200 rounded-lg text-xs text-slate-500 hover:text-slate-800 hover:bg-slate-100 transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={!newChName.trim()}
                  className="px-5 py-2 bg-slate-900 hover:bg-slate-800 text-white rounded-lg text-xs font-bold transition disabled:opacity-50"
                >
                  Create Channel
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {isNotificationModalOpen && (
        <NotificationModal
          isOpen={isNotificationModalOpen}
          onClose={() => setIsNotificationModalOpen(false)}
          userProfile={userProfile}
          onUpdateProfile={(updated) => setUserProfile(updated)}
          tasks={tasks}
          onOpenTask={(task, commentId) => {
            setIsNotificationModalOpen(false);
            setHighlightedCommentId(commentId || null);
            handleSelectTaskDetails(task);
          }}
          onSelectChannel={(channelId) => {
            handleSelectChannel(channelId);
          }}
        />
      )}

      {/* Global PWA Install Trigger / Prompt Banner */}
      <PWAInstallPrompt />

      {/* ==================== REAL-TIME TOAST NOTIFICATION POPUPS ==================== */}
      <div className="fixed bottom-6 right-6 z-[9999] flex flex-col gap-3 w-full max-w-sm pointer-events-none">
        <AnimatePresence>
          {toasts.map((toast) => {
            // Get action-specific styles
            let ActionIcon = Bell;
            let themeClass = 'border-l-teal-500 bg-white';
            let iconBgClass = 'bg-teal-50 text-teal-600';

            if (toast.action === 'task_created') {
              ActionIcon = Sparkles;
              themeClass = 'border-l-teal-500 bg-white';
              iconBgClass = 'bg-teal-50 text-teal-600';
            } else if (toast.action === 'task_status_changed') {
              ActionIcon = ArrowUpRight;
              themeClass = 'border-l-amber-500 bg-white';
              iconBgClass = 'bg-amber-50 text-amber-600';
            } else if (toast.action === 'comment_added') {
              ActionIcon = MessageSquare;
              themeClass = 'border-l-blue-500 bg-white';
              iconBgClass = 'bg-blue-50 text-blue-600';
            } else if (toast.action === 'task_deleted') {
              ActionIcon = Trash2;
              themeClass = 'border-l-rose-500 bg-white';
              iconBgClass = 'bg-rose-50 text-rose-600';
            } else if (toast.action === 'user_joined') {
              ActionIcon = UserPlus;
              themeClass = 'border-l-emerald-500 bg-white';
              iconBgClass = 'bg-emerald-50 text-emerald-600';
            }

            return (
              <motion.div
                key={toast.id}
                layout
                initial={{ opacity: 0, y: 50, scale: 0.9 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, x: 100, scale: 0.9 }}
                transition={{ type: 'spring', stiffness: 350, damping: 25 }}
                className={`pointer-events-auto flex gap-3 border-l-4 shadow-xl border border-slate-100/80 rounded-xl p-4 w-full relative overflow-hidden group ${themeClass}`}
              >
                {/* Icon wrapper */}
                <div className={`p-2 rounded-lg shrink-0 flex items-center justify-center h-9 w-9 ${iconBgClass}`}>
                  <ActionIcon className="w-5 h-5" />
                </div>

                {/* Content */}
                <div className="flex-1 min-w-0 pr-4">
                  <div className="font-bold text-slate-800 text-xs mb-0.5 flex items-center justify-between">
                    <span>{toast.senderName}</span>
                    <span className="text-[10px] text-slate-400 font-normal">Just now</span>
                  </div>
                  <p className="text-[11px] text-slate-600 leading-relaxed font-medium">
                    {toast.details}
                  </p>
                </div>

                {/* Dismiss button */}
                <button
                  onClick={() => setToasts((prev) => prev.filter((t) => t.id !== toast.id))}
                  className="absolute top-3 right-3 p-1 rounded-md text-slate-300 hover:text-slate-600 hover:bg-slate-50 transition opacity-0 group-hover:opacity-100 cursor-pointer"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </motion.div>
            );
          })}
        </AnimatePresence>
      </div>
    </div>
  );
}
