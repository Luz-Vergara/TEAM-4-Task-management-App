/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import { Task, UserProfile, UserRole, Comment, Attachment } from '../../types';
import { 
  X, 
  MessageSquare, 
  Send, 
  Paperclip, 
  Link2 
} from 'lucide-react';
import { formatRelativeTime } from '../../utils';
import { getAttachmentIcon } from './AttachmentItem';

interface TaskCommentsSectionProps {
  comments: Comment[];
  task: Task;
  newComment: string;
  setNewComment: React.Dispatch<React.SetStateAction<string>>;
  commentAttachments: Attachment[];
  setCommentAttachments: React.Dispatch<React.SetStateAction<Attachment[]>>;
  sendingComment: boolean;
  handlePostComment: (e: React.FormEvent) => Promise<void>;
  isUploading: boolean;
  handleFileUpload: (e: React.ChangeEvent<HTMLInputElement>, isForComment: boolean) => Promise<void>;
  showDriveForm: boolean;
  setShowDriveForm: React.Dispatch<React.SetStateAction<boolean>>;
  driveForComment: boolean;
  setDriveForComment: React.Dispatch<React.SetStateAction<boolean>>;
  driveUrl: string;
  setDriveUrl: React.Dispatch<React.SetStateAction<string>>;
  driveName: string;
  setDriveName: React.Dispatch<React.SetStateAction<string>>;
  handleAddDriveLink: (e: React.FormEvent) => void;
  commentsEndRef: React.RefObject<HTMLDivElement | null>;
  userProfile: UserProfile;
}

export default function TaskCommentsSection({
  comments,
  task,
  newComment,
  setNewComment,
  commentAttachments,
  setCommentAttachments,
  sendingComment,
  handlePostComment,
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
  commentsEndRef,
  userProfile
}: TaskCommentsSectionProps) {

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

  return (
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
          {isUploading && (
            <span className="text-[9px] text-teal-600 font-semibold animate-pulse">Uploading...</span>
          )}
          <label className={`p-1.5 hover:bg-slate-100 rounded-lg text-slate-450 hover:text-teal-500 transition cursor-pointer ${isUploading ? 'opacity-50 pointer-events-none' : ''}`} title="Attach Local File">
            <Paperclip className="w-4 h-4" />
            <input 
              type="file" 
              className="hidden" 
              disabled={isUploading}
              onChange={(e) => handleFileUpload(e, true)} 
            />
          </label>
          <button
            type="button"
            onClick={() => {
              setDriveForComment(true);
              setShowDriveForm(!showDriveForm || !driveForComment);
            }}
            className={`p-1.5 rounded-lg transition ${
              showDriveForm && driveForComment ? 'bg-teal-50 text-teal-500' : 'text-slate-455 hover:bg-slate-100 hover:text-teal-500'
            }`}
            title="Attach Google Drive document"
          >
            <Link2 className="w-4 h-4" />
          </button>
        </div>

        <input
          type="text"
          placeholder="Type feedback, blocker, or message..."
          value={newComment}
          onChange={(e) => setNewComment(e.target.value)}
          disabled={sendingComment}
          className="flex-1 bg-slate-100 text-xs border-none rounded-lg py-2 px-3 text-slate-800 placeholder:text-slate-400 focus:outline-none focus:ring-1 focus:ring-teal-500"
        />

        <button
          type="submit"
          disabled={sendingComment || (!newComment.trim() && commentAttachments.length === 0)}
          className="p-2 bg-slate-900 text-white rounded-lg hover:bg-slate-800 disabled:opacity-40 disabled:hover:bg-slate-900 transition shrink-0 cursor-pointer"
        >
          <Send className="w-3.5 h-3.5" />
        </button>
      </form>
    </div>
  );
}
