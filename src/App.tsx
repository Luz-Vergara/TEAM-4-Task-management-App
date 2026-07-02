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
  UserRole 
} from './types';
import { logActivity } from './utils';

// UI Components
import AuthScreen from './components/AuthScreen';
import Sidebar from './components/Sidebar';
import Dashboard from './components/Dashboard';
import ChannelView from './components/ChannelView';
import TaskModal from './components/TaskModal';
import AdminPanel from './components/AdminPanel';
import NotificationModal from './components/NotificationModal';

import { dispatchNotification } from './utils/notifications';

import { Loader2, Sparkles, Hash, Plus, X, AlertTriangle } from 'lucide-react';

export default function App() {
  const [currentUser, setCurrentUser] = useState<any>(null);
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const [workspace, setWorkspace] = useState<Workspace | null>(null);
  const [channels, setChannels] = useState<Channel[]>([]);
  const [members, setMembers] = useState<UserProfile[]>([]);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [logs, setLogs] = useState<ActivityLog[]>([]);

  // Navigation state
  const [activeView, setActiveView] = useState<'dashboard' | 'channel' | 'admin'>('dashboard');
  const [selectedChannelId, setSelectedChannelId] = useState<string | null>(null);
  
  // Modals state
  const [activeTaskForModal, setActiveTaskForModal] = useState<Task | null>(null);
  const [isTaskModalOpen, setIsTaskModalOpen] = useState(false);
  const [taskModalInitialStatus, setTaskModalInitialStatus] = useState<TaskStatus>(TaskStatus.TODO);
  const [isCreateChannelOpen, setIsCreateChannelOpen] = useState(false);
  const [isNotificationModalOpen, setIsNotificationModalOpen] = useState(false);

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
          setUserProfile(userDoc.data() as UserProfile);
        } else {
          // Fallback if auth is live but profile isn't indexed yet
          setUserProfile(null);
        }
      } else {
        setCurrentUser(null);
        setUserProfile(null);
        setWorkspace(null);
        setChannels([]);
        setMembers([]);
        setTasks([]);
        setLogs([]);
      }
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  // Sync workspace and other collection data when user profile is verified
  useEffect(() => {
    if (!userProfile) return;

    setLoading(true);
    const wId = userProfile.workspaceId;

    // 1. Fetch Workspace Details
    const workspaceRef = doc(db, 'workspaces', wId);
    const unsubWorkspace = onSnapshot(workspaceRef, (snap) => {
      if (snap.exists()) {
        setWorkspace(snap.data() as Workspace);
      } else {
        setWorkspace({
          id: wId,
          name: 'Demo Workspace',
          createdBy: 'system',
          createdAt: new Date().toISOString()
        });
      }
    });

    // 2. Real-time Channels listener
    const channelsRef = collection(db, 'workspaces', wId, 'channels');
    const unsubChannels = onSnapshot(channelsRef, (snapshot) => {
      const chList: Channel[] = [];
      snapshot.forEach((doc) => {
        chList.push(doc.data() as Channel);
      });
      setChannels(chList);
      
      // Auto-select 'general' or first channel on load if no channel selected
      if (chList.length > 0 && !selectedChannelId) {
        const general = chList.find((c) => c.name === 'general');
        setSelectedChannelId(general ? general.id : chList[0].id);
      }
    });

    // 3. Real-time Members listener
    const usersQuery = query(collection(db, 'users'), where('workspaceId', '==', wId));
    const unsubMembers = onSnapshot(usersQuery, (snapshot) => {
      const mList: UserProfile[] = [];
      snapshot.forEach((doc) => {
        mList.push(doc.data() as UserProfile);
      });
      setMembers(mList);
    });

    // 4. Real-time Tasks listener
    const tasksRef = collection(db, 'workspaces', wId, 'tasks');
    const unsubTasks = onSnapshot(tasksRef, (snapshot) => {
      const tList: Task[] = [];
      snapshot.forEach((doc) => {
        tList.push({ id: doc.id, ...doc.data() } as Task);
      });
      setTasks(tList);
    });

    // 5. Real-time Logs listener
    const logsRef = collection(db, 'workspaces', wId, 'logs');
    const logsQuery = query(logsRef, orderBy('createdAt', 'desc'));
    const unsubLogs = onSnapshot(logsQuery, (snapshot) => {
      const lList: ActivityLog[] = [];
      snapshot.forEach((doc) => {
        lList.push({ id: doc.id, ...doc.data() } as ActivityLog);
      });
      setLogs(lList);
    });

    // 6. Real-time Notifications listener for desktop PWA push
    const notificationsRef = collection(db, 'workspaces', wId, 'notifications');
    const notifsQuery = query(
      notificationsRef,
      where('recipientUid', '==', userProfile.uid),
      orderBy('createdAt', 'desc')
    );
    const appLoadTime = new Date().toISOString();
    const seenNotifIds = new Set<string>();
    const unsubNotifs = onSnapshot(notifsQuery, (snapshot) => {
      snapshot.docChanges().forEach((change) => {
        if (change.type === 'added') {
          const data = change.doc.data() as any;
          if (data.createdAt > appLoadTime && !seenNotifIds.has(change.doc.id)) {
            seenNotifIds.add(change.doc.id);
            const settings = userProfile.notificationSettings || { pwaEnabled: true };
            if (settings.pwaEnabled && 'Notification' in window && Notification.permission === 'granted') {
              try {
                new Notification(`VibeCheck: ${data.senderName}`, {
                  body: data.details,
                  icon: '/favicon.ico'
                });
              } catch (err) {
                console.error('Error firing desktop alert:', err);
              }
            }
          }
        }
      });
    });

    setLoading(false);

    return () => {
      unsubWorkspace();
      unsubChannels();
      unsubMembers();
      unsubTasks();
      unsubLogs();
      unsubNotifs();
    };
  }, [userProfile]);

  const handleAuthSuccess = (profile: UserProfile) => {
    setUserProfile(profile);
  };

  const handleSelectChannel = (channelId: string) => {
    setSelectedChannelId(channelId);
    setActiveView('channel');
  };

  const handleSelectView = (view: 'dashboard' | 'channel' | 'admin') => {
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
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
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
        // Update task parameters
        const updatePayload = {
          ...taskData,
          updatedAt: new Date().toISOString()
        };

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
        name: newChName.trim().toLowerCase(),
        description: newChDesc.trim() || 'No description',
        isArchived: false,
        assignedLeaderId: '',
        createdAt: new Date().toISOString()
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
        onSelectChannel={handleSelectChannel}
        onSelectView={handleSelectView}
        onAddChannel={() => setIsCreateChannelOpen(true)}
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
          }}
          onSaveTask={handleSaveTask}
          onDeleteTask={handleDeleteTask}
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
                <h3 className="font-bold text-slate-800 text-sm">Create a Project Channel</h3>
              </div>
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
        />
      )}
    </div>
  );
}
