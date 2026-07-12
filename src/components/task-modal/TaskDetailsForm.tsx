/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import { Task, UserProfile, TaskPriority, TaskStatus, Attachment } from '../../types';
import { 
  User, 
  Calendar, 
  Tag, 
  Activity, 
  UploadCloud, 
  Link2, 
  Trash2 
} from 'lucide-react';
import { getAttachmentIcon } from './AttachmentItem';

interface TaskDetailsFormProps {
  title: string;
  setTitle: (val: string) => void;
  description: string;
  setDescription: (val: string) => void;
  assignedUserId: string;
  setAssignedUserId: (val: string) => void;
  priority: TaskPriority;
  setPriority: (val: TaskPriority) => void;
  status: TaskStatus;
  setStatus: (val: TaskStatus) => void;
  dueDate: string;
  setDueDate: (val: string) => void;
  taskAttachments: Attachment[];
  isUploading: boolean;
  handleFileUpload: (e: React.ChangeEvent<HTMLInputElement>, isForComment: boolean) => Promise<void>;
  showDriveForm: boolean;
  setShowDriveForm: React.Dispatch<React.SetStateAction<boolean>>;
  driveForComment: boolean;
  setDriveForComment: React.Dispatch<React.SetStateAction<boolean>>;
  driveUrl: string;
  setDriveUrl: (val: string) => void;
  driveName: string;
  setDriveName: (val: string) => void;
  handleAddDriveLink: (e: React.FormEvent) => void;
  handleDeleteAttachment: (id: string) => void;
  handleSaveSubmit: (e: React.FormEvent) => void;
  members: UserProfile[];
  task: Task | null;
  setIsEditing: (val: boolean) => void;
  workspaceTargets: any[];
  targetId: string | null;
  setTargetId: (val: string | null) => void;
}

export default function TaskDetailsForm({
  title,
  setTitle,
  description,
  setDescription,
  assignedUserId,
  setAssignedUserId,
  priority,
  setPriority,
  status,
  setStatus,
  dueDate,
  setDueDate,
  taskAttachments,
  isUploading,
  handleFileUpload,
  showDriveForm,
  setShowDriveForm,
  driveForComment,
  setDriveForComment,
  driveUrl,
  setDriveUrl,
  driveName,
  setDriveName,
  handleAddDriveLink,
  handleDeleteAttachment,
  handleSaveSubmit,
  members,
  task,
  setIsEditing,
  workspaceTargets,
  targetId,
  setTargetId
}: TaskDetailsFormProps) {
  return (
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

      <div>
        <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1">Target</label>
        <select
          value={targetId || ''}
          onChange={(e) => setTargetId(e.target.value === '' ? null : e.target.value)}
          className="w-full bg-slate-100 border-none rounded-lg py-2.5 px-3 text-sm text-slate-700 focus:outline-none focus:ring-1 focus:ring-teal-500 appearance-none"
        >
          <option value="">Other / General Task</option>
          {workspaceTargets.map((tgt) => (
            <option key={tgt.id} value={tgt.id}>
              {tgt.name} ({tgt.periodType})
            </option>
          ))}
        </select>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1">Assign User</label>
          <div className="relative">
            <User className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
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
            <Calendar className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
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
            <Tag className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
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
            <Activity className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
            <select
              value={status}
              onChange={(e) => setStatus(e.target.value as TaskStatus)}
              disabled={task?.status === TaskStatus.COMPLETED}
              className="pl-9 w-full bg-slate-100 border-none rounded-lg py-2 text-sm text-slate-700 focus:outline-none focus:ring-1 focus:ring-teal-500 appearance-none disabled:opacity-60 disabled:cursor-not-allowed"
            >
              {(!task || task.status === TaskStatus.TODO) && (
                <option value={TaskStatus.TODO}>To Do</option>
              )}
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
            {isUploading && (
              <span className="text-[10px] text-teal-600 font-semibold animate-pulse mr-1">Uploading...</span>
            )}
            <label className={`p-1 hover:bg-slate-200 rounded-lg text-slate-400 hover:text-teal-500 transition cursor-pointer ${isUploading ? 'opacity-50 pointer-events-none' : ''}`} title="Upload Local File">
              <UploadCloud className="w-4 h-4" />
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
  );
}
