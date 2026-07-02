/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useRef } from 'react';
import { Task, UserProfile, UserRole, TaskStatus, TaskPriority, Comment, Attachment, StatusHistoryEntry } from '../types';
import { 
  X, 
  Trash2, 
  Edit, 
  Calendar, 
  User, 
  Tag, 
  AlertTriangle, 
  Plus, 
  Send, 
  MessageSquare,
  Bookmark,
  Activity,
  UserCheck,
  Clock,
  ExternalLink,
  Lock,
  Paperclip,
  Link2,
  FileText,
  FileSpreadsheet,
  FileImage,
  File,
  UploadCloud,
  Globe
} from 'lucide-react';
import { formatDate, formatRelativeTime, logActivity } from '../utils';
import { dispatchNotification } from '../utils/notifications';
import { collection, addDoc, query, where, orderBy, onSnapshot } from 'firebase/firestore';
import { db } from '../firebase';

interface TaskModalProps {
  userProfile: UserProfile;
  task: Task | null; // If null, means creating a new task
  channelId: string;
  initialStatus?: TaskStatus;
  members: UserProfile[];
  onClose: () => void;
  onSaveTask: (taskData: Partial<Task>, shouldCloseModal?: boolean) => void;
  onDeleteTask?: (taskId: string) => void;
}

export default function TaskModal({
  userProfile,
  task,
  channelId,
  initialStatus = TaskStatus.TODO,
  members,
  onClose,
  onSaveTask,
  onDeleteTask
}: TaskModalProps) {
  const [isEditing, setIsEditing] = useState(task === null);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [assignedUserId, setAssignedUserId] = useState('');
  const [priority, setPriority] = useState<TaskPriority>(TaskPriority.MEDIUM);
  const [status, setStatus] = useState<TaskStatus>(initialStatus);
  const [dueDate, setDueDate] = useState('');

  // Workflow Action state
  const [workflowRemarks, setWorkflowRemarks] = useState('');
  const [isTransitioning, setIsTransitioning] = useState(false);

  // Task comments state
  const [comments, setComments] = useState<Comment[]>([]);
  const [newComment, setNewComment] = useState('');
  const [sendingComment, setSendingComment] = useState(false);
  const commentsEndRef = useRef<HTMLDivElement>(null);

  // Dual Attachment states
  const [taskAttachments, setTaskAttachments] = useState<Attachment[]>([]);
  const [commentAttachments, setCommentAttachments] = useState<Attachment[]>([]);
  const [driveUrl, setDriveUrl] = useState('');
  const [driveName, setDriveName] = useState('');
  const [showDriveForm, setShowDriveForm] = useState(false);
  const [driveForComment, setDriveForComment] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  const formatBytes = (bytes: number) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>, isForComment: boolean) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 1.5 * 1024 * 1024) {
      alert("File is too large! For files larger than 1.5MB, please upload to Google Drive and attach the Drive Link instead.");
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      const base64Data = reader.result as string;
      const newAttachment: Attachment = {
        id: 'att-' + Math.random().toString(36).substr(2, 9),
        name: file.name,
        url: base64Data,
        type: 'file',
        size: formatBytes(file.size),
        uploadedAt: new Date().toISOString(),
        uploadedBy: userProfile.name
      };

      if (isForComment) {
        setCommentAttachments(prev => [...prev, newAttachment]);
      } else {
        const updated = [...taskAttachments, newAttachment];
        setTaskAttachments(updated);
        if (task && !isEditing) {
          onSaveTask({ attachments: updated });
        }
      }
    };
    reader.readAsDataURL(file);
  };

  const handleAddDriveLink = (e: React.FormEvent) => {
    e.preventDefault();
    if (!driveUrl.trim() || !driveName.trim()) return;

    let finalUrl = driveUrl.trim();
    if (!finalUrl.startsWith('http://') && !finalUrl.startsWith('https://')) {
      finalUrl = 'https://' + finalUrl;
    }

    const newAttachment: Attachment = {
      id: 'att-' + Math.random().toString(36).substr(2, 9),
      name: driveName.trim(),
      url: finalUrl,
      type: 'drive',
      uploadedAt: new Date().toISOString(),
      uploadedBy: userProfile.name
    };

    if (driveForComment) {
      setCommentAttachments(prev => [...prev, newAttachment]);
    } else {
      const updated = [...taskAttachments, newAttachment];
      setTaskAttachments(updated);
      if (task && !isEditing) {
        onSaveTask({ attachments: updated });
      }
    }

    setDriveUrl('');
    setDriveName('');
    setShowDriveForm(false);
  };

  const handleDeleteAttachment = (attId: string) => {
    const updated = taskAttachments.filter(a => a.id !== attId);
    setTaskAttachments(updated);
    if (task && !isEditing) {
      onSaveTask({ attachments: updated });
    }
  };

  const handleWorkflowTransition = async (newStatus: TaskStatus) => {
    if (!task || isTransitioning) return;
    setIsTransitioning(true);

    try {
      const prevStatus = status;
      const remarksText = workflowRemarks.trim();

      // Create a status history log entry
      const logEntry: StatusHistoryEntry = {
        id: 'log-' + Math.random().toString(36).substr(2, 9),
        userId: userProfile.uid,
        userName: userProfile.name,
        userRole: userProfile.role,
        prevStatus,
        newStatus,
        createdAt: new Date().toISOString(),
        remarks: remarksText || undefined
      };

      const updatedHistory = [...(task.statusHistory || []), logEntry];

      // Update local state immediately
      setStatus(newStatus);
      setWorkflowRemarks('');

      // Save to Firestore task without closing the modal
      onSaveTask({
        status: newStatus,
        statusHistory: updatedHistory
      }, false);

      // Post a comment in the task's discussion thread so team is notified
      const commentsRef = collection(db, 'workspaces', task.workspaceId, 'comments');
      
      const statusLabelPrev = getStatusLabel(prevStatus);
      const statusLabelNew = getStatusLabel(newStatus);
      
      let systemContent = `changed status from **${statusLabelPrev}** to **${statusLabelNew}**`;
      if (remarksText) {
        systemContent += `\n\n**Remarks / Comments:** ${remarksText}`;
      }

      await addDoc(commentsRef, {
        workspaceId: task.workspaceId,
        channelId: task.channelId,
        taskId: task.id,
        userId: userProfile.uid,
        userName: userProfile.name,
        userRole: userProfile.role,
        content: systemContent,
        createdAt: new Date().toISOString(),
        isStatusLog: true,
        prevStatus,
        newStatus,
        remarks: remarksText
      });

      // Write to general workspace logs
      const prevLabel = getStatusLabel(prevStatus);
      const newLabel = getStatusLabel(newStatus);
      const details = `updated task "${title}" from "${prevLabel}" to "${newLabel}"${remarksText ? ` (Remarks: ${remarksText})` : ''}`;
      await logActivity(task.workspaceId, userProfile.uid, userProfile.name, 'TASK_STATUS_UPDATE', details);
    } catch (err) {
      console.error('Error during workflow transition:', err);
    } finally {
      setIsTransitioning(false);
    }
  };

  const getAttachmentIcon = (type: 'file' | 'drive' | 'link', name: string) => {
    if (type === 'drive') {
      return <Globe className="w-3.5 h-3.5 text-emerald-600 shrink-0" />;
    }
    const ext = name.split('.').pop()?.toLowerCase();
    if (ext === 'pdf') {
      return <FileText className="w-3.5 h-3.5 text-rose-500 shrink-0" />;
    }
    if (['doc', 'docx', 'txt', 'rtf'].includes(ext || '')) {
      return <FileText className="w-3.5 h-3.5 text-blue-500 shrink-0" />;
    }
    if (['xls', 'xlsx', 'csv'].includes(ext || '')) {
      return <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-500 shrink-0" />;
    }
    if (['png', 'jpg', 'jpeg', 'gif', 'svg', 'webp'].includes(ext || '')) {
      return <FileImage className="w-3.5 h-3.5 text-purple-500 shrink-0" />;
    }
    return <File className="w-3.5 h-3.5 text-slate-500 shrink-0" />;
  };

  // Initialize values
  useEffect(() => {
    if (task) {
      setTitle(task.title);
      setDescription(task.description);
      setAssignedUserId(task.assignedUserId);
      setPriority(task.priority);
      setStatus(task.status);
      setDueDate(task.dueDate || '');
      setTaskAttachments(task.attachments || []);
      setIsEditing(false);
    } else {
      setTitle('');
      setDescription('');
      setAssignedUserId(members[0]?.uid || '');
      setPriority(TaskPriority.MEDIUM);
      setStatus(initialStatus);
      setDueDate(new Date(Date.now() + 86400000 * 3).toISOString().split('T')[0]); // Default 3 days from now
      setTaskAttachments([]);
      setIsEditing(true);
    }
  }, [task, initialStatus, members]);

  // Fetch comments for active task
  useEffect(() => {
    if (!task) return;

    const commentsRef = collection(db, 'workspaces', task.workspaceId, 'comments');
    const q = query(
      commentsRef,
      where('taskId', '==', task.id),
      orderBy('createdAt', 'asc')
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const taskComments: Comment[] = [];
      snapshot.forEach((doc) => {
        taskComments.push({ id: doc.id, ...doc.data() } as Comment);
      });
      setComments(taskComments);
    }, (error) => {
      console.error("Error fetching task comments:", error);
    });

    return () => unsubscribe();
  }, [task]);

  // Scroll task comments to bottom
  useEffect(() => {
    if (!isEditing && comments.length > 0) {
      commentsEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [comments, isEditing]);

  const handlePostComment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!task || sendingComment) return;
    if (!newComment.trim() && commentAttachments.length === 0) return;

    const trimmedComment = newComment.trim();
    setSendingComment(true);
    try {
      const commentsRef = collection(db, 'workspaces', task.workspaceId, 'comments');
      await addDoc(commentsRef, {
        workspaceId: task.workspaceId,
        channelId: task.channelId,
        taskId: task.id,
        userId: userProfile.uid,
        userName: userProfile.name,
        userRole: userProfile.role,
        content: trimmedComment,
        createdAt: new Date().toISOString(),
        attachments: commentAttachments
      });

      await dispatchNotification(
        task.workspaceId,
        'comment_added',
        `${userProfile.name} commented: "${trimmedComment.substring(0, 80)}${trimmedComment.length > 80 ? '...' : ''}"`,
        { uid: userProfile.uid, name: userProfile.name },
        task
      );

      setNewComment('');
      setCommentAttachments([]);
    } catch (err) {
      console.error('Error posting task comment:', err);
    } finally {
      setSendingComment(false);
    }
  };

  const handleSaveSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) return;

    onSaveTask({
      title: title.trim(),
      description: description.trim(),
      assignedUserId,
      priority,
      status,
      dueDate,
      channelId: task ? task.channelId : channelId,
      attachments: taskAttachments,
    });
  };

  // Permissions check
  const isCreator = task && task.creatorId === userProfile.uid;
  const isAssignee = task && task.assignedUserId === userProfile.uid;
  const canModify = userProfile.role === UserRole.ADMIN || userProfile.role === UserRole.LEADER;
  
  const canDelete = userProfile.role === UserRole.ADMIN || userProfile.role === UserRole.LEADER;
  const canChangeStatusOnly = isAssignee && !canModify;

  const getPriorityColor = (p: TaskPriority) => {
    switch (p) {
      case TaskPriority.HIGH:
        return 'bg-rose-50 text-rose-600 border border-rose-100';
      case TaskPriority.MEDIUM:
        return 'bg-amber-50 text-amber-600 border border-amber-100';
      default:
        return 'bg-slate-100 text-slate-500 border border-slate-200';
    }
  };

  const getStatusLabel = (s: TaskStatus) => {
    switch (s) {
      case TaskStatus.COMPLETED: return 'Completed';
      case TaskStatus.REVIEW: return 'For Review';
      case TaskStatus.IN_PROGRESS: return 'In Progress';
      default: return 'To Do';
    }
  };

  const getMemberName = (uid: string) => {
    const m = members.find((u) => u.uid === uid);
    return m ? m.name : 'Unassigned';
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop */}
      <div className="fixed inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} />

      {/* Modal Card wrapper */}
      <div className="bg-white rounded-2xl border border-slate-200 w-full max-w-4xl max-h-[90vh] flex flex-col relative z-10 overflow-hidden shadow-xl animate-in fade-in duration-200">
        {/* Header toolbar */}
        <div className="p-4 bg-white border-b border-slate-100 flex items-center justify-between">
          <div className="flex items-center space-x-2.5">
            <Bookmark className="w-5 h-5 text-teal-500" />
            <span className="text-xs font-bold uppercase text-slate-400 tracking-wider">
              {task ? `Task: #${task.id.slice(0, 6)}` : 'Create New Task'}
            </span>
          </div>

          <div className="flex items-center space-x-2">
            {/* Edit / Delete option for Admins or Leaders */}
            {task && !isEditing && (canModify || isCreator) && (
              <button
                onClick={() => setIsEditing(true)}
                className="p-1.5 hover:bg-slate-100 rounded-lg text-slate-400 hover:text-teal-500 transition"
                title="Edit Task parameters"
              >
                <Edit className="w-4 h-4" />
              </button>
            )}

            {task && onDeleteTask && canDelete && (
              <div className="relative">
                {showDeleteConfirm && (
                  <div className="absolute right-0 top-full mt-2 z-50 bg-white border border-rose-200 rounded-xl p-3.5 shadow-xl w-64 space-y-2.5 animate-in fade-in slide-in-from-top-1 duration-150 text-left">
                    <div className="text-xs font-bold text-slate-800">Delete this task?</div>
                    <div className="text-[10px] text-slate-500 leading-relaxed">
                      Are you sure you want to delete this task? This action is permanent and cannot be undone.
                    </div>
                    <div className="flex items-center justify-end gap-2 pt-1">
                      <button
                        type="button"
                        onClick={() => setShowDeleteConfirm(false)}
                        className="px-2.5 py-1 text-[10px] text-slate-500 hover:bg-slate-100 rounded font-medium transition cursor-pointer"
                      >
                        Cancel
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setShowDeleteConfirm(false);
                          onDeleteTask(task.id);
                        }}
                        className="px-2.5 py-1 text-[10px] bg-rose-500 hover:bg-rose-600 text-white rounded font-bold transition shadow-sm cursor-pointer"
                      >
                        Delete
                      </button>
                    </div>
                  </div>
                )}
                
                <button
                  onClick={() => setShowDeleteConfirm(true)}
                  className={`p-1.5 rounded-lg transition cursor-pointer ${
                    showDeleteConfirm ? 'bg-rose-50 text-rose-500' : 'text-slate-400 hover:bg-slate-100 hover:text-rose-500'
                  }`}
                  title="Delete Task"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            )}

            <button
              onClick={onClose}
              className="p-1.5 hover:bg-slate-100 rounded-lg text-slate-400 hover:text-slate-800 transition cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Dual Layout Content Frame */}
        {isEditing ? (
          /* ==================== CREATE & EDIT PARAMETERS FORM ==================== */
          <form onSubmit={handleSaveSubmit} className="flex-1 overflow-y-auto p-6 space-y-4">
            <div>
              <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1">Task Title</label>
              <input
                type="text"
                required
                placeholder="What needs to be done?"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                className="w-full bg-slate-100 border-none rounded-lg py-2.5 px-3 text-sm text-slate-800 focus:outline-none focus:ring-1 focus:ring-teal-500"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1">Description</label>
              <textarea
                placeholder="Provide task specifics, links, deliverables, or checklist steps..."
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                rows={4}
                className="w-full bg-slate-100 border-none rounded-lg py-2 px-3 text-sm text-slate-800 placeholder:text-slate-400 focus:outline-none focus:ring-1 focus:ring-teal-500 resize-none"
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1">Assign User</label>
                <div className="relative">
                  <User className="absolute left-3 top-2.5 h-4 w-4 text-slate-450" />
                  <select
                    value={assignedUserId}
                    onChange={(e) => setAssignedUserId(e.target.value)}
                    className="pl-9 w-full bg-slate-100 border-none rounded-lg py-2 text-sm text-slate-700 focus:outline-none focus:ring-1 focus:ring-teal-500 appearance-none"
                  >
                    <option value="">Unassigned</option>
                    {members.map((u) => (
                      <option key={u.uid} value={u.uid}>
                        {u.name} ({u.role})
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1">Due Date</label>
                <div className="relative">
                  <Calendar className="absolute left-3 top-2.5 h-4 w-4 text-slate-450" />
                  <input
                    type="date"
                    required
                    value={dueDate}
                    onChange={(e) => setDueDate(e.target.value)}
                    className="pl-9 w-full bg-slate-100 border-none rounded-lg py-2 text-sm text-slate-700 focus:outline-none focus:ring-1 focus:ring-teal-500"
                  />
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1">Priority</label>
                <div className="relative">
                  <Tag className="absolute left-3 top-2.5 h-4 w-4 text-slate-450" />
                  <select
                    value={priority}
                    onChange={(e) => setPriority(e.target.value as TaskPriority)}
                    className="pl-9 w-full bg-slate-100 border-none rounded-lg py-2 text-sm text-slate-700 focus:outline-none focus:ring-1 focus:ring-teal-500 appearance-none"
                  >
                    <option value={TaskPriority.LOW}>Low</option>
                    <option value={TaskPriority.MEDIUM}>Medium</option>
                    <option value={TaskPriority.HIGH}>High</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1">Status</label>
                <div className="relative">
                  <Activity className="absolute left-3 top-2.5 h-4 w-4 text-slate-450" />
                  <select
                    value={status}
                    onChange={(e) => setStatus(e.target.value as TaskStatus)}
                    className="pl-9 w-full bg-slate-100 border-none rounded-lg py-2 text-sm text-slate-700 focus:outline-none focus:ring-1 focus:ring-teal-500 appearance-none"
                  >
                    <option value={TaskStatus.TODO}>To Do</option>
                    <option value={TaskStatus.IN_PROGRESS}>In Progress</option>
                    <option value={TaskStatus.REVIEW}>For Review</option>
                    <option value={TaskStatus.COMPLETED}>Completed</option>
                  </select>
                </div>
              </div>
            </div>

            {/* Task Attachments Section in Form */}
            <div className="space-y-2 pt-4 border-t border-slate-150">
              <div className="flex items-center justify-between">
                <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider">Attachments ({taskAttachments.length})</label>
                <div className="flex items-center gap-1">
                  <label className="p-1 hover:bg-slate-200 rounded-lg text-slate-400 hover:text-teal-500 transition cursor-pointer" title="Upload Local File">
                    <UploadCloud className="w-4 h-4" />
                    <input 
                      type="file" 
                      className="hidden" 
                      onChange={(e) => handleFileUpload(e, false)} 
                    />
                  </label>
                  <button
                    type="button"
                    onClick={() => {
                      setDriveForComment(false);
                      setShowDriveForm(!showDriveForm);
                    }}
                    className="p-1 hover:bg-slate-200 rounded-lg text-slate-400 hover:text-teal-500 transition"
                    title="Attach Google Drive Link"
                  >
                    <Link2 className="w-4 h-4" />
                  </button>
                </div>
              </div>

              {/* Inline Drive Form in Edit Mode */}
              {showDriveForm && !driveForComment && (
                <div className="bg-slate-50 border border-teal-100 p-3 rounded-xl space-y-2">
                  <div className="text-[10px] font-bold text-teal-600 uppercase">Attach Google Drive Link</div>
                  <div className="space-y-1.5">
                    <input
                      type="text"
                      placeholder="Google Drive link (e.g., https://docs.google.com/...)"
                      value={driveUrl}
                      onChange={(e) => setDriveUrl(e.target.value)}
                      className="w-full bg-white border border-slate-200 rounded-lg py-1 px-2.5 text-xs text-slate-700 focus:outline-none focus:border-teal-500"
                    />
                    <input
                      type="text"
                      placeholder="File / Folder Name (e.g., Project Proposal)"
                      value={driveName}
                      onChange={(e) => setDriveName(e.target.value)}
                      className="w-full bg-white border border-slate-200 rounded-lg py-1 px-2.5 text-xs text-slate-700 focus:outline-none focus:border-teal-500"
                    />
                  </div>
                  <div className="flex justify-end gap-2">
                    <button
                      type="button"
                      onClick={() => setShowDriveForm(false)}
                      className="px-2 py-1 border border-slate-200 rounded text-[10px] text-slate-500 hover:bg-slate-100"
                    >
                      Cancel
                    </button>
                    <button
                      type="button"
                      onClick={(e) => {
                        if (driveUrl && driveName) {
                          handleAddDriveLink(e);
                        }
                      }}
                      className="px-2.5 py-1 bg-teal-500 hover:bg-teal-600 text-white rounded text-[10px] font-bold cursor-pointer"
                    >
                      Attach Link
                    </button>
                  </div>
                </div>
              )}

              {taskAttachments.length > 0 ? (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {taskAttachments.map((att) => (
                    <div key={att.id} className="flex items-center justify-between p-2 bg-slate-50 border border-slate-200 rounded-xl">
                      <div className="flex items-center gap-2 min-w-0">
                        {getAttachmentIcon(att.type, att.name)}
                        <span className="text-xs text-slate-750 truncate max-w-[150px]" title={att.name}>{att.name}</span>
                      </div>
                      <button
                        type="button"
                        onClick={() => handleDeleteAttachment(att.id)}
                        className="p-1 text-slate-400 hover:text-rose-500 hover:bg-slate-100 rounded"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-[11px] text-slate-400 italic bg-slate-50 border border-dashed border-slate-250 p-3 rounded-xl text-center">
                  No attachments selected.
                </div>
              )}
            </div>

            {/* Form footer buttons */}
            <div className="flex justify-end items-center gap-3 pt-4 border-t border-slate-100">
              {task && (
                <button
                  type="button"
                  onClick={() => setIsEditing(false)}
                  className="px-4 py-2 border border-slate-200 rounded-lg text-xs text-slate-500 hover:text-slate-800 hover:bg-slate-100 font-bold transition"
                >
                  Cancel
                </button>
              )}
              <button
                type="submit"
                className="px-5 py-2.5 bg-slate-900 hover:bg-slate-800 text-white rounded-lg text-xs font-bold transition flex items-center space-x-1 shadow-sm cursor-pointer"
              >
                <span>Save Task Details</span>
              </button>
            </div>
          </form>
        ) : (
          /* ==================== DETAILS READ MODE & INTERACTIVE COMMENTS FEED ==================== */
          <div className="flex-1 overflow-hidden flex flex-col md:flex-row h-full">
            {/* Left Parameters column */}
            <div className="w-full md:w-1/2 p-6 border-b md:border-b-0 md:border-r border-slate-100 overflow-y-auto space-y-6">
              <div className="space-y-2">
                <span className={`px-2 py-0.5 rounded-full text-[9px] font-bold uppercase border ${getPriorityColor(priority)}`}>
                  {priority} Priority
                </span>
                <h2 className="text-lg font-extrabold text-slate-900 tracking-tight leading-snug">{title}</h2>
                <div className="flex items-center space-x-2 text-xs text-slate-400">
                  <span>Created by {getMemberName(task?.creatorId || '')}</span>
                  <span>&bull;</span>
                  <span>{formatRelativeTime(task?.createdAt || '')}</span>
                </div>
              </div>

              {description ? (
                <div className="space-y-1">
                  <h4 className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Description</h4>
                  <p className="text-xs text-slate-750 leading-relaxed bg-slate-50 p-4 rounded-xl border border-slate-100 whitespace-pre-wrap">
                    {description}
                  </p>
                </div>
              ) : (
                <div className="text-xs text-slate-400 italic">No description details provided.</div>
              )}

              {/* Task Deliverables & Attachments Section */}
              <div className="space-y-2 pt-4 border-t border-slate-150">
                <div className="flex items-center justify-between">
                  <h4 className="text-[10px] font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1">
                    <Paperclip className="w-3 h-3 text-teal-500" />
                    <span>Deliverables & Attachments ({taskAttachments.length})</span>
                  </h4>
                  
                  {/* Plus button to toggle attachment form */}
                  <div className="flex items-center gap-1">
                    <label className="p-1 hover:bg-slate-100 rounded-lg text-slate-400 hover:text-teal-500 transition cursor-pointer" title="Upload Local File">
                      <UploadCloud className="w-3.5 h-3.5" />
                      <input 
                        type="file" 
                        className="hidden" 
                        onChange={(e) => handleFileUpload(e, false)} 
                      />
                    </label>
                    <button
                      type="button"
                      onClick={() => {
                        setDriveForComment(false);
                        setShowDriveForm(!showDriveForm);
                      }}
                      className="p-1 hover:bg-slate-100 rounded-lg text-slate-400 hover:text-teal-500 transition"
                      title="Attach Google Drive Link"
                    >
                      <Link2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>

                {/* Inline Google Drive Link form */}
                {showDriveForm && !driveForComment && (
                  <form onSubmit={handleAddDriveLink} className="bg-slate-50 border border-teal-100 p-3 rounded-xl space-y-2 animate-in slide-in-from-top-2 duration-150">
                    <div className="text-[10px] font-bold text-teal-600 uppercase">Attach Google Drive Link</div>
                    <div className="space-y-1.5">
                      <input
                        type="text"
                        required
                        placeholder="Google Drive link (e.g., https://docs.google.com/...)"
                        value={driveUrl}
                        onChange={(e) => setDriveUrl(e.target.value)}
                        className="w-full bg-white border border-slate-200 rounded-lg py-1 px-2.5 text-xs text-slate-700 focus:outline-none focus:border-teal-500"
                      />
                      <input
                        type="text"
                        required
                        placeholder="File / Folder Name (e.g., Project Proposal)"
                        value={driveName}
                        onChange={(e) => setDriveName(e.target.value)}
                        className="w-full bg-white border border-slate-200 rounded-lg py-1 px-2.5 text-xs text-slate-700 focus:outline-none focus:border-teal-500"
                      />
                    </div>
                    <div className="flex justify-end gap-2">
                      <button
                        type="button"
                        onClick={() => setShowDriveForm(false)}
                        className="px-2 py-1 border border-slate-200 rounded text-[10px] text-slate-500 hover:bg-slate-100"
                      >
                        Cancel
                      </button>
                      <button
                        type="submit"
                        className="px-2.5 py-1 bg-teal-500 hover:bg-teal-600 text-white rounded text-[10px] font-bold cursor-pointer"
                      >
                        Attach Link
                      </button>
                    </div>
                  </form>
                )}

                {taskAttachments.length > 0 ? (
                  <div className="grid grid-cols-1 gap-2">
                    {taskAttachments.map((att) => (
                      <div key={att.id} className="group relative flex items-center justify-between p-2 bg-slate-50 border border-slate-200 rounded-xl hover:border-teal-200 transition">
                        <a
                          href={att.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="flex items-center gap-2 flex-1 min-w-0"
                        >
                          <div className="p-1.5 bg-white rounded-lg border border-slate-150 shadow-sm shrink-0">
                            {getAttachmentIcon(att.type, att.name)}
                          </div>
                          <div className="min-w-0 text-left">
                            <div className="text-xs font-bold text-slate-750 truncate group-hover:text-teal-600 transition" title={att.name}>
                              {att.name}
                            </div>
                            <div className="text-[9px] text-slate-400 font-mono mt-0.5">
                              {att.type === 'drive' ? 'Google Drive Link' : att.size || 'Attached File'} &bull; by {att.uploadedBy}
                            </div>
                          </div>
                        </a>
                        
                        <button
                          type="button"
                          onClick={() => handleDeleteAttachment(att.id)}
                          className="p-1.5 text-slate-400 hover:text-rose-500 hover:bg-slate-100 rounded-lg shrink-0 cursor-pointer"
                          title="Remove Attachment"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-[11px] text-slate-400 italic bg-slate-50 border border-dashed border-slate-200 p-4 rounded-xl text-center">
                    No files or Google Drive links attached yet. Upload deliverables or paste Google Drive documents above.
                  </div>
                )}
              </div>

              {/* Status details card block */}
              <div className="bg-slate-50 border border-slate-100 p-4 rounded-xl grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <div className="text-[9px] font-bold text-slate-450 uppercase tracking-wider flex items-center gap-1">
                    <UserCheck className="w-3 h-3 text-teal-500" />
                    <span>Assigned To</span>
                  </div>
                  <div className="text-xs text-slate-800 font-bold truncate">
                    {getMemberName(assignedUserId)}
                  </div>
                </div>

                <div className="space-y-1">
                  <div className="text-[9px] font-bold text-slate-450 uppercase tracking-wider flex items-center gap-1">
                    <Calendar className="w-3 h-3 text-rose-500" />
                    <span>Due Date</span>
                  </div>
                  <div className="text-xs text-slate-800 font-bold truncate">
                    {dueDate ? formatDate(dueDate) : 'No due date'}
                  </div>
                </div>
              </div>

              {/* Task Progress & Status Change History Timeline */}
              {task && task.statusHistory && task.statusHistory.length > 0 && (
                <div className="space-y-3 pt-4 border-t border-slate-150 text-left">
                  <h4 className="text-[10px] font-bold text-slate-450 uppercase tracking-wider flex items-center gap-1.5">
                    <Clock className="w-3.5 h-3.5 text-teal-500" />
                    <span>Task Progress History ({task.statusHistory.length})</span>
                  </h4>
                  <div className="relative pl-3.5 border-l border-slate-200 space-y-4">
                    {task.statusHistory.map((log) => (
                      <div key={log.id} className="relative">
                        {/* Timeline Node dot */}
                        <div className="absolute -left-[19px] top-1.5 w-2 h-2 rounded-full bg-teal-500 ring-4 ring-teal-50" />
                        <div className="text-[11px] space-y-1">
                          <div className="flex flex-wrap items-center gap-1 text-slate-600">
                            <strong className="text-slate-800 font-bold">{log.userName}</strong>
                            <span className="text-slate-400">transitioned this task from</span>
                            <span className="px-1 py-0.2 bg-slate-100 text-slate-600 font-medium rounded text-[9px] uppercase">
                              {getStatusLabel(log.prevStatus)}
                            </span>
                            <span className="text-slate-400">to</span>
                            <span className="px-1 py-0.2 bg-teal-50 text-teal-600 font-bold rounded text-[9px] uppercase border border-teal-100">
                              {getStatusLabel(log.newStatus)}
                            </span>
                          </div>
                          {log.remarks && (
                            <div className="p-2 bg-slate-50 border border-slate-100 rounded-lg text-slate-600 italic leading-relaxed text-[11px] whitespace-pre-wrap">
                              &ldquo;{log.remarks}&rdquo;
                            </div>
                          )}
                          <div className="text-[9px] text-slate-400 font-mono">
                            {formatDate(log.createdAt)} at {new Date(log.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Custom Task Workflow & Status Activity Logs */}
              <div className="space-y-4 p-4 rounded-xl border border-slate-200 bg-slate-50/50">
                <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider flex items-center justify-between pb-2 border-b border-slate-100">
                  <span>Task Workflow Progress</span>
                  <span className="text-[8px] uppercase bg-teal-500/10 text-teal-600 px-1.5 py-0.5 rounded font-bold border border-teal-500/20">
                    Role-Based Flow
                  </span>
                </div>

                {/* Workflow Stepper Progress Pipeline */}
                <div className="grid grid-cols-4 gap-1 text-[10px] text-center font-bold">
                  {[
                    { state: TaskStatus.TODO, label: 'To Do' },
                    { state: TaskStatus.IN_PROGRESS, label: 'In Progress' },
                    { state: TaskStatus.REVIEW, label: 'For Review' },
                    { state: TaskStatus.COMPLETED, label: 'Completed' }
                  ].map((s, idx) => {
                    const isCurrent = status === s.state;
                    const isPassed = (
                      (status === TaskStatus.IN_PROGRESS && idx === 0) ||
                      (status === TaskStatus.REVIEW && idx <= 1) ||
                      (status === TaskStatus.COMPLETED && idx <= 2)
                    );
                    return (
                      <div key={s.state} className="space-y-1">
                        <div className={`h-1 rounded-full transition-all duration-300 ${
                          isCurrent ? 'bg-teal-500' : isPassed ? 'bg-teal-300' : 'bg-slate-200'
                        }`} />
                        <span className={isCurrent ? 'text-teal-600' : isPassed ? 'text-slate-600' : 'text-slate-400'}>
                          {s.label}
                        </span>
                      </div>
                    );
                  })}
                </div>

                {/* Action Buttons based on Status and User Roles */}
                <div className="bg-white p-3.5 rounded-xl border border-slate-150 shadow-sm space-y-3">
                  {status === TaskStatus.TODO && (
                    <>
                      {isAssignee && userProfile.role === UserRole.MEMBER ? (
                        <div className="space-y-3">
                          <div className="text-xs text-slate-750 text-left">
                            You are assigned to this task. Click <strong className="font-bold text-teal-600">Accept</strong> to start working.
                          </div>
                          <div className="text-left">
                            <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">Acceptance Remarks (Optional)</label>
                            <input
                              type="text"
                              placeholder="e.g., Starting on this now, will check design specs..."
                              value={workflowRemarks}
                              onChange={(e) => setWorkflowRemarks(e.target.value)}
                              className="w-full bg-slate-50 border border-slate-200 rounded-lg py-1.5 px-2.5 text-xs text-slate-750 focus:outline-none focus:border-teal-500"
                            />
                          </div>
                          <button
                            type="button"
                            onClick={() => handleWorkflowTransition(TaskStatus.IN_PROGRESS)}
                            disabled={isTransitioning}
                            className="w-full py-2 bg-teal-500 hover:bg-teal-600 text-white font-bold rounded-lg text-xs transition shadow-sm cursor-pointer flex items-center justify-center gap-1.5"
                          >
                            Accept Task
                          </button>
                        </div>
                      ) : (
                        <div className="text-xs text-slate-450 text-center py-2 italic">
                          {assignedUserId ? (
                            <span>Waiting for assigned member <strong>{getMemberName(assignedUserId)}</strong> to accept this task.</span>
                          ) : (
                            <span>No member assigned yet. A Team Leader can edit task parameters to assign a member.</span>
                          )}
                        </div>
                      )}
                    </>
                  )}

                  {status === TaskStatus.IN_PROGRESS && (
                    <>
                      {isAssignee && userProfile.role === UserRole.MEMBER ? (
                        <div className="space-y-3">
                          <div className="text-xs text-slate-750 text-left">
                            You are working on this task. When finished, click <strong className="font-bold text-amber-600">Submit for Review</strong>.
                          </div>
                          <div className="text-left">
                            <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">Deliverables & Remarks (Optional)</label>
                            <textarea
                              rows={2}
                              placeholder="e.g., Completed drafting the design assets. See drive links attached..."
                              value={workflowRemarks}
                              onChange={(e) => setWorkflowRemarks(e.target.value)}
                              className="w-full bg-slate-50 border border-slate-200 rounded-lg py-1.5 px-2.5 text-xs text-slate-750 focus:outline-none focus:border-teal-500 resize-none"
                            />
                          </div>
                          <button
                            type="button"
                            onClick={() => handleWorkflowTransition(TaskStatus.REVIEW)}
                            disabled={isTransitioning}
                            className="w-full py-2 bg-amber-500 hover:bg-amber-600 text-white font-bold rounded-lg text-xs transition shadow-sm cursor-pointer flex items-center justify-center gap-1.5"
                          >
                            Submit for Review / Done
                          </button>
                        </div>
                      ) : (
                        <div className="text-xs text-slate-450 text-center py-2 italic">
                          <span>This task is currently In Progress by <strong>{getMemberName(assignedUserId)}</strong>.</span>
                        </div>
                      )}
                    </>
                  )}

                  {status === TaskStatus.REVIEW && (
                    <>
                      {userProfile.role === UserRole.LEADER || userProfile.role === UserRole.ADMIN ? (
                        <div className="space-y-3">
                          <div className="text-xs text-slate-750 text-left">
                            Task is pending review. Check the output/attachments and approve to mark as completed.
                          </div>
                          <div className="text-left">
                            <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">Review Feedback (Optional)</label>
                            <input
                              type="text"
                              placeholder="e.g., Looks great! All deliverables verified."
                              value={workflowRemarks}
                              onChange={(e) => setWorkflowRemarks(e.target.value)}
                              className="w-full bg-slate-50 border border-slate-200 rounded-lg py-1.5 px-2.5 text-xs text-slate-750 focus:outline-none focus:border-teal-500"
                            />
                          </div>
                          <button
                            type="button"
                            onClick={() => handleWorkflowTransition(TaskStatus.COMPLETED)}
                            disabled={isTransitioning}
                            className="w-full py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-lg text-xs transition shadow-sm cursor-pointer flex items-center justify-center gap-1.5"
                          >
                            Mark as Completed
                          </button>
                        </div>
                      ) : (
                        <div className="text-xs text-slate-450 text-center py-2 italic">
                          <span>Submitted! Waiting for Team Leader review and approval.</span>
                        </div>
                      )}
                    </>
                  )}

                  {status === TaskStatus.COMPLETED && (
                    <div className="flex flex-col items-center justify-center py-3 text-center space-y-1.5 bg-emerald-50/50 border border-emerald-100 rounded-lg">
                      <div className="p-1.5 bg-emerald-100 rounded-full text-emerald-600 shrink-0">
                        <UserCheck className="w-5 h-5" />
                      </div>
                      <div className="text-xs font-bold text-emerald-800">Approved & Completed</div>
                      <div className="text-[10px] text-emerald-600 font-medium">Task workflow fully approved! No further actions needed.</div>
                    </div>
                  )}
                </div>

                {/* Manual Status Override for Team Leaders & Admins */}
                {(userProfile.role === UserRole.LEADER || userProfile.role === UserRole.ADMIN) && (
                  <div className="space-y-1 pt-2 border-t border-slate-100 text-left">
                    <label className="block text-[9px] font-bold text-slate-400 uppercase tracking-wider mb-1">Leader Status Override (Manual)</label>
                    <select
                      value={status}
                      onChange={(e) => {
                        const newStatus = e.target.value as TaskStatus;
                        setStatus(newStatus);
                        onSaveTask({ status: newStatus });
                      }}
                      className="w-full bg-slate-150 border-none rounded-lg py-1.5 px-3 text-[11px] text-slate-600 font-semibold focus:outline-none appearance-none cursor-pointer"
                    >
                      <option value={TaskStatus.TODO}>To Do</option>
                      <option value={TaskStatus.IN_PROGRESS}>In Progress</option>
                      <option value={TaskStatus.REVIEW}>For Review</option>
                      <option value={TaskStatus.COMPLETED}>Completed</option>
                    </select>
                  </div>
                )}
              </div>
            </div>

            {/* Right Interactive Task-specific Comments Frame */}
            <div className="w-full md:w-1/2 flex flex-col bg-slate-50/50 overflow-hidden h-full">
              {/* Header */}
              <div className="p-4 border-b border-slate-100 bg-white flex items-center justify-between shrink-0">
                <h4 className="text-xs font-bold uppercase text-slate-400 tracking-wider flex items-center gap-1.5">
                  <MessageSquare className="w-4 h-4 text-teal-500" />
                  <span>Task Discussion ({comments.length})</span>
                </h4>
              </div>

              {/* Comments list feed */}
              <div className="flex-1 overflow-y-auto p-4 space-y-3.5 scrollbar-thin">
                {comments.map((c) => {
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

                   if (c.isStatusLog) {
                    return (
                      <div key={c.id} className="text-xs space-y-1 bg-teal-50/40 p-3 rounded-xl border border-teal-100/70 border-l-4 border-l-teal-500 shadow-sm transition text-left">
                        <div className="flex items-center justify-between gap-2">
                          <div className="flex items-center gap-1.5 overflow-hidden">
                            <span className="w-1.5 h-1.5 bg-teal-500 rounded-full animate-pulse" />
                            <strong className="text-slate-800 font-bold truncate">{c.userName}</strong>
                            <span className="text-[8px] font-bold uppercase bg-teal-500/10 text-teal-600 px-1.5 rounded border border-teal-500/20">System Log</span>
                          </div>
                          <span className="text-[10px] text-slate-450 font-mono shrink-0">
                            {formatRelativeTime(c.createdAt)}
                          </span>
                        </div>
                        <p className="text-slate-700 leading-relaxed whitespace-pre-wrap mt-1">{c.content}</p>
                      </div>
                    );
                  }

                  return (
                    <div key={c.id} className="text-xs space-y-1 bg-white p-3 rounded-xl border border-slate-200 shadow-sm hover:border-teal-200 transition text-left">
                      <div className="flex items-center justify-between gap-2">
                        <div className="flex items-center gap-1.5 overflow-hidden">
                          <strong className="text-slate-800 font-bold truncate">{c.userName}</strong>
                          <span className={`text-[8px] font-bold uppercase px-1 rounded border shrink-0 ${getRoleBadge(c.userRole)}`}>
                            {c.userRole}
                          </span>
                        </div>
                        <span className="text-[10px] text-slate-450 font-mono shrink-0">
                          {formatRelativeTime(c.createdAt)}
                        </span>
                      </div>
                      <p className="text-slate-600 leading-relaxed whitespace-pre-wrap">{c.content}</p>

                      {c.attachments && c.attachments.length > 0 && (
                        <div className="mt-2 pt-1.5 border-t border-slate-100 flex flex-wrap gap-1.5">
                          {c.attachments.map((att) => (
                            <a
                              key={att.id}
                              href={att.url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="inline-flex items-center gap-1 px-1.5 py-0.5 bg-slate-50 border border-slate-200 rounded hover:bg-slate-100 hover:border-teal-400 transition text-[10px] text-slate-700 max-w-full"
                            >
                              {getAttachmentIcon(att.type, att.name)}
                              <span className="truncate max-w-[120px]" title={att.name}>{att.name}</span>
                              {att.size && <span className="text-[8px] text-slate-455 font-mono">({att.size})</span>}
                            </a>
                          ))}
                        </div>
                      )}
                    </div>
                  );
                })}

                {comments.length === 0 && (
                  <div className="text-center py-12 px-4 space-y-2">
                    <MessageSquare className="w-6 h-6 text-slate-300 mx-auto" />
                    <div className="text-[11px] text-slate-400 italic">No updates or comments posted yet.</div>
                    <div className="text-[10px] text-slate-550 max-w-xs mx-auto">
                      Use the field below to document blockers, deliverables, or updates.
                    </div>
                  </div>
                )}
                <div ref={commentsEndRef} />
              </div>

              {/* Comment attachments queue */}
              {commentAttachments.length > 0 && (
                <div className="px-3 py-1.5 bg-slate-50 border-t border-slate-100 flex flex-wrap gap-2 shrink-0">
                  {commentAttachments.map((att) => (
                    <div key={att.id} className="inline-flex items-center gap-1.5 px-2 py-1 bg-white border border-slate-200 rounded-lg text-[10px] font-medium text-slate-700 shadow-sm animate-in zoom-in-95 duration-100">
                      {getAttachmentIcon(att.type, att.name)}
                      <span className="truncate max-w-[120px]" title={att.name}>{att.name}</span>
                      <button
                        type="button"
                        onClick={() => setCommentAttachments(prev => prev.filter(a => a.id !== att.id))}
                        className="p-0.5 text-slate-450 hover:text-rose-500 hover:bg-slate-100 rounded cursor-pointer"
                      >
                        <X className="w-3 h-3" />
                      </button>
                    </div>
                  ))}
                </div>
              )}

              {/* Inline Drive Form for Comment Attachments */}
              {showDriveForm && driveForComment && (
                <div className="p-3 bg-slate-50 border-t border-slate-100 space-y-2 shrink-0">
                  <div className="text-[10px] font-bold text-teal-600 uppercase">Attach Google Drive Link to Comment</div>
                  <div className="space-y-1.5">
                    <input
                      type="text"
                      placeholder="Google Drive link (e.g., https://docs.google.com/...)"
                      value={driveUrl}
                      onChange={(e) => setDriveUrl(e.target.value)}
                      className="w-full bg-white border border-slate-200 rounded-lg py-1 px-2.5 text-xs text-slate-755 focus:outline-none focus:border-teal-500"
                    />
                    <input
                      type="text"
                      placeholder="File / Folder Name (e.g., Project Proposal)"
                      value={driveName}
                      onChange={(e) => setDriveName(e.target.value)}
                      className="w-full bg-white border border-slate-200 rounded-lg py-1 px-2.5 text-xs text-slate-755 focus:outline-none focus:border-teal-500"
                    />
                  </div>
                  <div className="flex justify-end gap-2">
                    <button
                      type="button"
                      onClick={() => setShowDriveForm(false)}
                      className="px-2 py-1 border border-slate-200 rounded text-[10px] text-slate-500 hover:bg-slate-100"
                    >
                      Cancel
                    </button>
                    <button
                      type="button"
                      onClick={(e) => {
                        if (driveUrl && driveName) {
                          handleAddDriveLink(e);
                        }
                      }}
                      className="px-2.5 py-1 bg-teal-500 hover:bg-teal-600 text-white rounded text-[10px] font-bold cursor-pointer"
                    >
                      Attach Link
                    </button>
                  </div>
                </div>
              )}

              {/* Post comment input form */}
              <form onSubmit={handlePostComment} className="p-3 bg-white border-t border-slate-100 flex items-center gap-2 shrink-0">
                {/* Paperclip button to open upload menu */}
                <div className="flex items-center gap-1">
                  <label className="p-1.5 hover:bg-slate-100 rounded-lg text-slate-450 hover:text-teal-500 transition cursor-pointer" title="Attach Local File">
                    <Paperclip className="w-4 h-4" />
                    <input 
                      type="file" 
                      className="hidden" 
                      onChange={(e) => handleFileUpload(e, true)} 
                    />
                  </label>
                  <button
                    type="button"
                    onClick={() => {
                      setDriveForComment(true);
                      setShowDriveForm(!showDriveForm || !driveForComment);
                    }}
                    className={`p-1.5 hover:bg-slate-100 rounded-lg transition ${showDriveForm && driveForComment ? 'text-teal-500 bg-slate-100' : 'text-slate-455 hover:text-teal-500'}`}
                    title="Attach Google Drive Link"
                  >
                    <Link2 className="w-4 h-4" />
                  </button>
                </div>

                <input
                  type="text"
                  placeholder="Post status update or comment..."
                  value={newComment}
                  onChange={(e) => setNewComment(e.target.value)}
                  disabled={sendingComment}
                  className="flex-1 bg-slate-100 border-none rounded-lg py-1.5 px-3 text-xs text-slate-850 placeholder:text-slate-400 focus:outline-none focus:ring-1 focus:ring-teal-500"
                />
                <button
                  type="submit"
                  disabled={sendingComment || (!newComment.trim() && commentAttachments.length === 0)}
                  className="p-1.5 bg-teal-500 hover:bg-teal-600 text-white rounded-lg transition disabled:opacity-50 cursor-pointer shrink-0"
                >
                  <Send className="w-3.5 h-3.5" />
                </button>
              </form>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
