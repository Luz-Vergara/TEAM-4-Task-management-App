/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useRef } from 'react';
import { Channel, Task, UserProfile, UserRole, TaskStatus, TaskPriority, Comment } from '../types';
import { 
  Hash, 
  MessageSquare, 
  CheckSquare, 
  Plus, 
  Calendar, 
  User, 
  UserPlus,
  Send, 
  Clock, 
  ChevronRight, 
  Settings, 
  Trash2, 
  Edit,
  ShieldAlert,
  Archive,
  MessageCircleOff,
  CornerDownRight,
  Eye
} from 'lucide-react';
import { formatDate, formatRelativeTime } from '../utils';
import { collection, getDocs, addDoc, query, where, onSnapshot, orderBy, doc, updateDoc, deleteDoc } from 'firebase/firestore';
import { db } from '../firebase';

interface ChannelViewProps {
  userProfile: UserProfile;
  channel: Channel;
  members: UserProfile[];
  tasks: Task[];
  onAddTask: (status?: TaskStatus) => void;
  onSelectTask: (task: Task) => void;
  onEditTask: (task: Task) => void;
  onDeleteTask: (taskId: string) => void;
  onUpdateTaskStatus: (task: Task, newStatus: TaskStatus) => void;
  onArchiveChannel?: () => void;
}

export default function ChannelView({
  userProfile,
  channel,
  members,
  tasks,
  onAddTask,
  onSelectTask,
  onEditTask,
  onDeleteTask,
  onUpdateTaskStatus,
  onArchiveChannel
}: ChannelViewProps) {
  const [activeTab, setActiveTab] = useState<'tasks' | 'discussion'>('tasks');
  const [messages, setMessages] = useState<Comment[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [sending, setSending] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Filter tasks belonging only to this channel
  const channelTasks = tasks.filter((t) => t.channelId === channel.id);

  // Group tasks by status
  const tasksByStatus = {
    [TaskStatus.TODO]: channelTasks.filter((t) => t.status === TaskStatus.TODO),
    [TaskStatus.IN_PROGRESS]: channelTasks.filter((t) => t.status === TaskStatus.IN_PROGRESS),
    [TaskStatus.REVIEW]: channelTasks.filter((t) => t.status === TaskStatus.REVIEW),
    [TaskStatus.COMPLETED]: channelTasks.filter((t) => t.status === TaskStatus.COMPLETED),
  };

  // Fetch channel-level messages (comments where taskId is empty)
  useEffect(() => {
    const commentsRef = collection(db, 'workspaces', channel.workspaceId, 'comments');
    const q = query(
      commentsRef,
      where('channelId', '==', channel.id),
      where('taskId', '==', ''), // empty taskId means channel discussion
      orderBy('createdAt', 'asc')
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const msgs: Comment[] = [];
      snapshot.forEach((doc) => {
        msgs.push({ id: doc.id, ...doc.data() } as Comment);
      });
      setMessages(msgs);
    }, (error) => {
      console.error("Error fetching channel discussions:", error);
    });

    return () => unsubscribe();
  }, [channel.id, channel.workspaceId]);

  // Scroll to bottom of discussions
  useEffect(() => {
    if (activeTab === 'discussion') {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages, activeTab]);

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newMessage.trim() || sending) return;

    setSending(true);
    try {
      const commentsRef = collection(db, 'workspaces', channel.workspaceId, 'comments');
      await addDoc(commentsRef, {
        workspaceId: channel.workspaceId,
        channelId: channel.id,
        taskId: '', // Channel discussion
        userId: userProfile.uid,
        userName: userProfile.name,
        userRole: userProfile.role,
        content: newMessage.trim(),
        createdAt: new Date().toISOString()
      });
      setNewMessage('');
    } catch (err) {
      console.error('Error sending channel message:', err);
    } finally {
      setSending(false);
    }
  };

  const getPriorityColor = (p: TaskPriority) => {
    switch (p) {
      case TaskPriority.HIGH:
        return 'bg-rose-50 text-rose-600 border-rose-100';
      case TaskPriority.MEDIUM:
        return 'bg-amber-50 text-amber-600 border-amber-100';
      default:
        return 'bg-slate-100 text-slate-500 border-slate-200';
    }
  };

  const getMemberName = (uid: string) => {
    const m = members.find((u) => u.uid === uid);
    return m ? m.name : 'Unassigned';
  };

  const getMemberInitials = (uid: string) => {
    const m = members.find((u) => u.uid === uid);
    if (!m) return '?';
    const parts = m.name.split(' ');
    if (parts.length > 1) return (parts[0][0] + parts[1][0]).toUpperCase();
    return m.name[0].toUpperCase();
  };

  // Determine permissions
  const canModifyTasks = userProfile.role === UserRole.ADMIN || userProfile.role === UserRole.LEADER;

  return (
    <div className="flex-1 flex flex-col bg-white text-slate-900 font-sans h-full overflow-hidden">
      {/* Channel Header Banner */}
      <div className="p-4 md:px-6 bg-white border-b border-slate-200 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 shrink-0">
        <div>
          <div className="flex items-center space-x-2">
            <Hash className="w-5 h-5 text-teal-500" />
            <h1 className="text-lg font-bold text-slate-900 capitalize">{channel.name}</h1>
            {channel.assignedLeaderId && (
              <span className="text-[10px] bg-teal-500/10 text-teal-600 px-2 py-0.5 rounded border border-teal-500/20 font-bold ml-2">
                Lead Assigned
              </span>
            )}
          </div>
          <p className="text-xs text-slate-500 mt-0.5 truncate max-w-2xl">{channel.description}</p>
        </div>

        {/* Action Controls & Tab Selector */}
        <div className="flex items-center space-x-3">
          <div className="bg-slate-100 p-1 rounded-lg border border-slate-200 flex">
            <button
              onClick={() => setActiveTab('tasks')}
              className={`flex items-center space-x-1.5 px-3 py-1.5 rounded-md text-xs font-semibold transition ${
                activeTab === 'tasks'
                  ? 'bg-white text-slate-900 shadow-sm border border-slate-200/50'
                  : 'text-slate-500 hover:text-slate-900'
              }`}
            >
              <CheckSquare className="w-3.5 h-3.5" />
              <span>Tasks Board</span>
            </button>
            <button
              onClick={() => setActiveTab('discussion')}
              className={`flex items-center space-x-1.5 px-3 py-1.5 rounded-md text-xs font-semibold transition ${
                activeTab === 'discussion'
                  ? 'bg-white text-slate-900 shadow-sm border border-slate-200/50'
                  : 'text-slate-500 hover:text-slate-900'
              }`}
            >
              <MessageSquare className="w-3.5 h-3.5" />
              <span>Discussion chat</span>
            </button>
          </div>

          {/* Admin Archive Channel Action */}
          {userProfile.role === UserRole.ADMIN && channel.name !== 'general' && onArchiveChannel && (
            <button
              onClick={onArchiveChannel}
              title="Archive Channel"
              className="p-1.5 bg-slate-100 hover:bg-rose-50 text-slate-500 hover:text-rose-600 rounded-lg border border-slate-200 transition cursor-pointer"
            >
              <Archive className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>

      {/* Main Container Area */}
      <div className="flex-1 overflow-hidden relative">
        {activeTab === 'tasks' ? (
          /* ==================== KANBAN BOARD VIEW ==================== */
          <div className="h-full overflow-x-auto p-4 md:p-6 flex space-x-4 items-start select-none scrollbar-thin bg-slate-50">
            {/* Columns loop */}
            {(Object.keys(tasksByStatus) as TaskStatus[]).map((status) => {
              const statusTasks = tasksByStatus[status];

              // Customize Column headers
              let colTitle = '';
              let colColor = '';
              let colBulletColor = '';

              if (status === TaskStatus.TODO) {
                colTitle = 'To Do';
                colColor = 'text-slate-500';
                colBulletColor = 'bg-slate-400';
              } else if (status === TaskStatus.IN_PROGRESS) {
                colTitle = 'In Progress';
                colColor = 'text-amber-500';
                colBulletColor = 'bg-amber-500';
              } else if (status === TaskStatus.REVIEW) {
                colTitle = 'For Review';
                colColor = 'text-purple-500';
                colBulletColor = 'bg-purple-500';
              } else {
                colTitle = 'Completed';
                colColor = 'text-emerald-500';
                colBulletColor = 'bg-emerald-500';
              }

              return (
                <div 
                  key={status} 
                  className="w-72 max-h-full flex flex-col bg-white rounded-xl border border-slate-200 p-4 shrink-0 shadow-sm"
                >
                  {/* Column Header */}
                  <div className="flex items-center justify-between pb-3 mb-3 border-b border-slate-100 shrink-0">
                    <div className="flex items-center space-x-2">
                      <div className={`w-2 h-2 rounded-full ${colBulletColor}`} />
                      <h3 className={`font-bold text-xs uppercase tracking-wider ${colColor}`}>
                        {colTitle}
                      </h3>
                      <span className="text-[10px] bg-slate-100 text-slate-500 px-1.5 py-0.5 rounded font-bold font-mono border border-slate-200/50">
                        {statusTasks.length}
                      </span>
                    </div>

                    {/* Quick Task Creation shortcut */}
                    {canModifyTasks && (
                      <button
                        onClick={() => onAddTask(status)}
                        className="p-1 hover:bg-slate-100 rounded-md text-slate-400 hover:text-slate-800 transition"
                      >
                        <Plus className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>

                  {/* Tasks Cards Container */}
                  <div className="flex-1 overflow-y-auto space-y-2.5 pr-0.5 scrollbar-thin max-h-[calc(100vh-250px)]">
                    {statusTasks.map((task) => {
                      const todayStr = new Date().toISOString().split('T')[0];
                      const isOverdue = task.status !== TaskStatus.COMPLETED && task.dueDate && task.dueDate < todayStr;
                      const hasUserPermissionToTransition = canModifyTasks || task.assignedUserId === userProfile.uid;

                      return (
                        <div
                          key={task.id}
                          className="bg-white hover:bg-slate-50 p-4 rounded-xl border border-slate-200 hover:border-teal-300 shadow-sm transition duration-150 relative group flex flex-col justify-between cursor-pointer space-y-3"
                          onClick={() => onSelectTask(task)}
                        >
                          {/* Title & Options */}
                          <div className="space-y-1">
                            <div className="flex items-start justify-between gap-1.5">
                              <h4 className="font-bold text-xs leading-snug text-slate-900 group-hover:text-teal-600 transition line-clamp-2">
                                {task.title}
                              </h4>
                            </div>
                            <p className="text-[11px] text-slate-500 line-clamp-2 leading-relaxed">
                              {task.description}
                            </p>
                          </div>

                          {/* Priority, due dates, assignee row */}
                          <div className="flex items-center justify-between border-t border-slate-100 pt-2 shrink-0">
                            <div className="flex flex-wrap gap-1 items-center">
                              {/* Priority badge */}
                              <span className={`px-1.5 py-0.5 rounded text-[9px] font-bold uppercase border ${getPriorityColor(task.priority)}`}>
                                {task.priority}
                              </span>

                              {/* Overdue Warning / Calendar */}
                              {task.dueDate && (
                                <span className={`flex items-center space-x-1 text-[10px] ${
                                  isOverdue ? 'text-rose-500 font-semibold' : 'text-slate-400'
                                }`}>
                                  <Calendar className="w-3 h-3" />
                                  <span>{formatDate(task.dueDate)}</span>
                                </span>
                              )}
                            </div>

                            {/* Assignee Circle */}
                            <div 
                              title={`Assigned to ${getMemberName(task.assignedUserId)}`}
                              className="w-5 h-5 rounded-full bg-slate-100 border border-slate-200 text-[9px] font-bold text-slate-600 flex items-center justify-center shrink-0"
                            >
                              {getMemberInitials(task.assignedUserId)}
                            </div>
                          </div>

                          {/* Quick Change Status Dropdown for board navigation */}
                          {hasUserPermissionToTransition && (
                            <div className="flex items-center justify-between border-t border-slate-100 pt-2 shrink-0" onClick={(e) => e.stopPropagation()}>
                              <span className="text-[10px] text-slate-400">Quick Status:</span>
                              <select
                                value={task.status}
                                onChange={(e) => onUpdateTaskStatus(task, e.target.value as TaskStatus)}
                                className="bg-slate-100 border border-slate-200 rounded px-1.5 py-0.5 text-[10px] text-teal-600 focus:outline-none cursor-pointer font-bold uppercase tracking-wider"
                              >
                                <option value={TaskStatus.TODO}>To Do</option>
                                <option value={TaskStatus.IN_PROGRESS}>In Prog</option>
                                <option value={TaskStatus.REVIEW}>Review</option>
                                <option value={TaskStatus.COMPLETED}>Done</option>
                              </select>
                            </div>
                          )}
                        </div>
                      );
                    })}

                    {/* Column Empty states */}
                    {statusTasks.length === 0 && (
                      <div className="border border-dashed border-slate-200 bg-slate-50/50 rounded-xl py-8 px-4 text-center space-y-2">
                        <CheckSquare className="w-5 h-5 text-slate-400 mx-auto" />
                        <span className="text-[11px] text-slate-400 block italic">Empty Column</span>
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          /* ==================== CHAT STREAM ==================== */
          <div className="h-full flex flex-col bg-slate-50 overflow-hidden">
            {/* Messages Area */}
            <div className="flex-1 overflow-y-auto p-4 md:p-6 space-y-4">
              <div className="space-y-1.5 pb-4 border-b border-slate-200 mb-4 bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
                <div className="text-sm font-bold text-slate-900 flex items-center gap-1.5">
                  <Hash className="w-4 h-4 text-teal-500" />
                  <span>Welcome to #{channel.name}!</span>
                </div>
                <p className="text-xs text-slate-500 leading-relaxed">
                  This is the start of the #{channel.name} channel discussion stream. Ask questions, post progress reports, or coordinate with team leaders and members here.
                </p>
              </div>

              {messages.map((msg) => {
                const getRoleBadge = (role: UserRole) => {
                  switch (role) {
                    case UserRole.ADMIN:
                      return 'bg-teal-50 text-teal-600 border border-teal-100';
                    case UserRole.LEADER:
                      return 'bg-amber-50 text-amber-600 border border-amber-100';
                    default:
                      return 'bg-slate-100 text-slate-500 border border-slate-200';
                  }
                };

                const getInitials = (name: string) => {
                  if (!name) return '?';
                  const parts = name.split(' ');
                  if (parts.length > 1) return (parts[0][0] + parts[1][0]).toUpperCase();
                  return name[0].toUpperCase();
                };

                return (
                  <div key={msg.id} className="flex items-start space-x-3 text-sm hover:bg-slate-100/50 p-2 rounded-lg transition duration-150">
                    <div className="w-8 h-8 rounded-lg bg-teal-500/10 text-teal-600 font-bold border border-teal-500/20 flex items-center justify-center shrink-0 uppercase">
                      {getInitials(msg.userName)}
                    </div>
                    <div className="space-y-1 overflow-hidden flex-1">
                      <div className="flex flex-wrap items-baseline gap-2">
                        <strong className="text-slate-900 font-bold text-xs">{msg.userName}</strong>
                        <span className={`text-[9px] font-bold uppercase px-1.5 py-0.2 rounded border ${getRoleBadge(msg.userRole)}`}>
                          {msg.userRole}
                        </span>
                        <span className="text-[10px] text-slate-400 font-mono">
                          {formatRelativeTime(msg.createdAt)}
                        </span>
                      </div>
                      <p className="text-slate-700 text-xs leading-relaxed whitespace-pre-wrap">
                        {msg.content}
                      </p>
                    </div>
                  </div>
                );
              })}
              <div ref={messagesEndRef} />
            </div>

            {/* Input Send Area */}
            <form onSubmit={handleSendMessage} className="p-4 bg-white border-t border-slate-200 flex items-center space-x-2 shrink-0">
              <input
                type="text"
                placeholder={`Post update to #${channel.name}...`}
                value={newMessage}
                onChange={(e) => setNewMessage(e.target.value)}
                disabled={sending}
                className="flex-1 bg-slate-100 border-none rounded-lg py-2 px-3 text-xs text-slate-800 placeholder:text-slate-400 focus:outline-none focus:ring-1 focus:ring-teal-500 transition"
              />
              <button
                type="submit"
                disabled={sending || !newMessage.trim()}
                className="p-2 bg-teal-500 hover:bg-teal-600 text-white rounded-lg transition flex items-center justify-center disabled:opacity-50"
              >
                <Send className="w-4 h-4" />
              </button>
            </form>
          </div>
        )}
      </div>
    </div>
  );
}
