/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useRef } from 'react';
import { Task, UserProfile, UserRole, TaskStatus, TaskPriority, Comment, Attachment, StatusHistoryEntry, Target } from '../types';
import { 
  X, 
  Trash2, 
  Edit, 
  Calendar, 
  UserCheck, 
  Clock, 
  Bookmark,
  Paperclip,
  UploadCloud,
  Link2,
  CheckCircle2
} from 'lucide-react';
import { formatDate, formatRelativeTime, logActivity } from '../utils';
import { dispatchNotification } from '../utils/notifications';
import { collection, addDoc, query, where, orderBy, onSnapshot, getDoc, doc } from 'firebase/firestore';
import { db, storage } from '../firebase';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';

// Modular Sub-components
import AttachmentItem from './task-modal/AttachmentItem';
import TaskWorkflowSection from './task-modal/TaskWorkflowSection';
import TaskCommentsSection from './task-modal/TaskCommentsSection';
import TaskDetailsForm from './task-modal/TaskDetailsForm';

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
  const [assignedUserIds, setAssignedUserIds] = useState<string[]>([]);
  const [priority, setPriority] = useState<TaskPriority>(TaskPriority.MEDIUM);
  const [status, setStatus] = useState<TaskStatus>(initialStatus);
  const [dueDate, setDueDate] = useState('');
  const [workspaceTargets, setWorkspaceTargets] = useState<Target[]>([]);
  const [targetId, setTargetId] = useState<string | null>(null);

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
  const [isUploading, setIsUploading] = useState(false);

  const formatBytes = (bytes: number) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>, isForComment: boolean) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Support files up to 50MB when using Firebase Storage!
    if (file.size > 50 * 1024 * 1024) {
      alert("File is too large! Maximum allowed size is 50MB.");
      return;
    }

    setIsUploading(true);

    try {
      const uniqueId = 'att-' + Math.random().toString(36).substring(2, 11);
      const storageRef = ref(storage, `workspaces/${task?.workspaceId || 'default-workspace'}/tasks/${task?.id || 'new'}/${uniqueId}_${file.name}`);
      
      // Attempt uploading to Firebase Storage
      await uploadBytes(storageRef, file);
      const downloadUrl = await getDownloadURL(storageRef);

      const newAttachment: Attachment = {
        id: uniqueId,
        name: file.name,
        url: downloadUrl,
        type: 'file',
        size: formatBytes(file.size),
        rawSize: file.size,
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
    } catch (error) {
      console.warn("Storage upload failed, falling back to local base64:", error);
      
      // Fallback to local Base64 string for files <= 1.5MB if Firebase Storage is not enabled yet
      if (file.size > 1.5 * 1024 * 1024) {
        alert("Upload failed. For files larger than 1.5MB, please ensure Firebase Storage is activated in your Firebase Console Spark plan, or upload to Google Drive and attach the Link instead.");
        setIsUploading(false);
        return;
      }

      const reader = new FileReader();
      reader.onload = () => {
        const base64Data = reader.result as string;
        const newAttachment: Attachment = {
          id: 'att-' + Math.random().toString(36).substring(2, 11),
          name: file.name,
          url: base64Data,
          type: 'file',
          size: formatBytes(file.size),
          rawSize: file.size,
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
    } finally {
      setIsUploading(false);
    }
  };

  const handleAddDriveLink = (e: React.FormEvent) => {
    e.preventDefault();
    if (!driveUrl.trim() || !driveName.trim()) return;

    let finalUrl = driveUrl.trim();
    if (!finalUrl.startsWith('http://') && !finalUrl.startsWith('https://')) {
      finalUrl = 'https://' + finalUrl;
    }

    const newAttachment: Attachment = {
      id: 'att-' + Math.random().toString(36).substring(2, 11),
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

    // Strict business rules for task transitions:
    // 1. Completed tasks cannot be moved.
    if (status === TaskStatus.COMPLETED) {
      console.warn("Completed tasks cannot be moved or have their status changed.");
      return;
    }
    // 2. Tasks cannot be moved back to To Do status.
    if (newStatus === TaskStatus.TODO && status !== TaskStatus.TODO) {
      console.warn("Tasks that are in progress or under review cannot be moved back to the To Do list.");
      return;
    }

    setIsTransitioning(true);

    try {
      const prevStatus = status;
      const remarksText = workflowRemarks.trim();

      // Create a status history log entry
      const logEntry: StatusHistoryEntry = {
        id: 'log-' + Math.random().toString(36).substring(2, 11),
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

  // Initialize values
  useEffect(() => {
    if (task) {
      setTitle(task.title);
      setDescription(task.description);
      setAssignedUserId(task.assignedUserId);
      setAssignedUserIds(task.assignedUserIds || (task.assignedUserId ? [task.assignedUserId] : []));
      setPriority(task.priority);
      setStatus(task.status);
      setDueDate(task.dueDate || '');
      setTaskAttachments(task.attachments || []);
      setTargetId(task.targetId || null);
      setIsEditing(false);
    } else {
      setTitle('');
      setDescription('');
      setAssignedUserId(members[0]?.uid || '');
      setAssignedUserIds(members[0]?.uid ? [members[0].uid] : []);
      setPriority(TaskPriority.MEDIUM);
      setStatus(initialStatus);
      setDueDate(new Date(Date.now() + 86400000 * 3).toISOString().split('T')[0]); // Default 3 days from now
      setTaskAttachments([]);
      setTargetId(null);
      setIsEditing(true);
    }
  }, [task, initialStatus, members]);

  // Fetch active targets
  useEffect(() => {
    if (!userProfile?.workspaceId) return;
    const targetsRef = collection(db, 'workspaces', userProfile.workspaceId, 'targets');
    const q = query(targetsRef, where('status', '==', 'active'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const activeTargets: Target[] = [];
      snapshot.forEach((doc) => {
        activeTargets.push({ id: doc.id, ...doc.data() } as Target);
      });
      setWorkspaceTargets(activeTargets);
    }, (error) => {
      console.error("Error fetching targets for TaskModal:", error);
    });
    return () => unsubscribe();
  }, [userProfile?.workspaceId]);

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
      assignedUserIds,
      priority,
      status,
      dueDate,
      channelId: task ? task.channelId : channelId,
      attachments: taskAttachments,
      targetId: targetId,
    });
  };

  // Permissions check
  const isCreator = task && task.creatorId === userProfile.uid;
  const canModify = userProfile.role === UserRole.ADMIN || userProfile.role === UserRole.LEADER;
  const canDelete = userProfile.role === UserRole.ADMIN || userProfile.role === UserRole.LEADER;

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
      <div className="bg-white rounded-2xl border border-slate-200 w-full max-w-4xl h-[85vh] max-h-[750px] min-h-[500px] flex flex-col relative z-10 overflow-hidden shadow-xl animate-in fade-in duration-200">
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
                className="p-1.5 hover:bg-slate-100 rounded-lg text-slate-400 hover:text-teal-500 transition cursor-pointer"
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
                    <div className="text-[10px] text-slate-550 leading-relaxed">
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
          <TaskDetailsForm
            title={title}
            setTitle={setTitle}
            description={description}
            setDescription={setDescription}
            assignedUserId={assignedUserId}
            setAssignedUserId={setAssignedUserId}
            assignedUserIds={assignedUserIds}
            setAssignedUserIds={setAssignedUserIds}
            priority={priority}
            setPriority={setPriority}
            status={status}
            setStatus={setStatus}
            dueDate={dueDate}
            setDueDate={setDueDate}
            taskAttachments={taskAttachments}
            isUploading={isUploading}
            handleFileUpload={handleFileUpload}
            showDriveForm={showDriveForm}
            setShowDriveForm={setShowDriveForm}
            driveForComment={driveForComment}
            setDriveForComment={setDriveForComment}
            driveUrl={driveUrl}
            setDriveUrl={setDriveUrl}
            driveName={driveName}
            setDriveName={setDriveName}
            handleAddDriveLink={handleAddDriveLink}
            handleDeleteAttachment={handleDeleteAttachment}
            handleSaveSubmit={handleSaveSubmit}
            members={members}
            task={task}
            setIsEditing={setIsEditing}
            workspaceTargets={workspaceTargets}
            targetId={targetId}
            setTargetId={setTargetId}
          />
        ) : (
          <div className="flex-1 min-h-0 overflow-hidden flex flex-col md:flex-row">
            {/* Left Parameters column */}
            <div className="w-full md:w-1/2 p-6 border-b md:border-b-0 md:border-r border-slate-100 overflow-y-auto space-y-6">
              <div className="space-y-2">
                <span className={`px-2 py-0.5 rounded-full text-[9px] font-bold uppercase border ${getPriorityColor(priority)}`}>
                  {priority} Priority
                </span>
                <h2 className="text-lg font-extrabold text-slate-900 tracking-tight leading-snug">{title}</h2>
                <div className="flex flex-col space-y-1 text-xs text-slate-400">
                  <div className="flex items-center space-x-2">
                    <span>Created by {getMemberName(task?.creatorId || '')}</span>
                    <span>&bull;</span>
                    <span>{formatRelativeTime(task?.createdAt || '')}</span>
                  </div>
                  {task?.completedAt && (
                    <div className="flex items-center space-x-1.5 text-teal-600 font-medium">
                      <CheckCircle2 className="w-3 h-3" />
                      <span>Completed {formatRelativeTime(task.completedAt)}</span>
                    </div>
                  )}
                </div>
              </div>

              {description ? (
                <div className="space-y-1">
                  <h4 className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Description</h4>
                  <p className="text-xs text-slate-755 leading-relaxed bg-slate-50 p-4 rounded-xl border border-slate-100 whitespace-pre-wrap">
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
                    {isUploading && (
                      <span className="text-[10px] text-teal-600 font-semibold animate-pulse mr-1">Uploading...</span>
                    )}
                    <label className={`p-1 hover:bg-slate-100 rounded-lg text-slate-400 hover:text-teal-500 transition cursor-pointer ${isUploading ? 'opacity-50 pointer-events-none' : ''}`} title="Upload Local File">
                      <UploadCloud className="w-3.5 h-3.5" />
                      <input 
                        type="file" 
                        className="hidden" 
                        disabled={isUploading}
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
                      <AttachmentItem
                        key={att.id}
                        attachment={att}
                        onDelete={handleDeleteAttachment}
                        showDelete={true}
                      />
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
                  <div className="text-xs text-slate-800 font-bold space-y-1">
                    {assignedUserIds && assignedUserIds.length > 0 ? (
                      <div className="flex flex-wrap gap-1">
                        {assignedUserIds.map((uid) => (
                          <span key={uid} className="bg-slate-200/55 text-slate-700 text-[10px] px-1.5 py-0.5 rounded-full font-medium inline-block max-w-[120px] truncate">
                            {getMemberName(uid)}
                          </span>
                        ))}
                      </div>
                    ) : (
                      getMemberName(assignedUserId)
                    )}
                  </div>
                </div>

                <div className="space-y-1">
                  <div className="text-[9px] font-bold text-slate-455 uppercase tracking-wider flex items-center gap-1">
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
                  <h4 className="text-[10px] font-bold text-slate-455 uppercase tracking-wider flex items-center gap-1.5">
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
              <TaskWorkflowSection
                status={status}
                setStatus={setStatus}
                assignedUserId={assignedUserId}
                assignedUserIds={assignedUserIds}
                userProfile={userProfile}
                isTransitioning={isTransitioning}
                workflowRemarks={workflowRemarks}
                setWorkflowRemarks={setWorkflowRemarks}
                handleWorkflowTransition={handleWorkflowTransition}
                getMemberName={getMemberName}
                onSaveTask={onSaveTask}
              />
            </div>

            {/* Right Interactive Task-specific Comments Frame */}
            {task && (
              <TaskCommentsSection
                comments={comments}
                task={task}
                newComment={newComment}
                setNewComment={setNewComment}
                commentAttachments={commentAttachments}
                setCommentAttachments={setCommentAttachments}
                sendingComment={sendingComment}
                handlePostComment={handlePostComment}
                isUploading={isUploading}
                handleFileUpload={handleFileUpload}
                showDriveForm={showDriveForm}
                setShowDriveForm={setShowDriveForm}
                driveForComment={driveForComment}
                setDriveForComment={setDriveForComment}
                driveUrl={driveUrl}
                setDriveUrl={setDriveUrl}
                driveName={driveName}
                setDriveName={setDriveName}
                handleAddDriveLink={handleAddDriveLink}
                commentsEndRef={commentsEndRef}
                userProfile={userProfile}
              />
            )}
          </div>
        )}
      </div>
    </div>
  );
}
