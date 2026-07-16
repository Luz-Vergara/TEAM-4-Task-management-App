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
  Link2,
  ArrowDown
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
  highlightedCommentId?: string | null;
  members?: UserProfile[];
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
  userProfile,
  highlightedCommentId,
  members
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

  const feedContainerRef = React.useRef<HTMLDivElement>(null);
  const [showJumpToLatest, setShowJumpToLatest] = React.useState(false);
  const isFirstLoadRef = React.useRef(true);
  const lastTaskIdRef = React.useRef<string | null>(null);

  // Mentions State
  const [showSuggestions, setShowSuggestions] = React.useState(false);
  const [suggestionSearch, setSuggestionSearch] = React.useState('');
  const [mentionTriggerIndex, setMentionTriggerIndex] = React.useState(-1);
  const [selectedSuggestionIndex, setSelectedSuggestionIndex] = React.useState(0);
  const textareaRef = React.useRef<HTMLTextAreaElement>(null);

  const getMentionsRegex = (mList: UserProfile[]) => {
    const names = ['everyone'];
    mList.forEach(m => {
      const baseName = m.name;
      names.push(baseName);
      names.push(baseName.replace(/\s+/g, ''));
      names.push(baseName.replace(/\s+/g, '_'));
    });
    names.sort((a, b) => b.length - a.length);
    const registry = names.map(n => n.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&'));
    return new RegExp(`@(${registry.join('|')})\\b`, 'gi');
  };

  const renderCommentWithMentions = (content: string) => {
    if (!content) return null;
    const mList = members || [];
    const regex = getMentionsRegex(mList);
    const parts = content.split(regex);
    if (parts.length === 1) return content;
    
    const matches = content.match(regex) || [];
    let matchIndex = 0;
    
    return parts.map((part, index) => {
      if (index % 2 === 1) {
        const matchText = matches[matchIndex++];
        const isEveryone = matchText?.toLowerCase() === '@everyone';
        return (
          <span 
            key={index} 
            className={`px-1.5 py-0.5 rounded-md font-extrabold text-[11px] inline-flex items-center gap-0.5 border ${
              isEveryone
                ? 'bg-amber-50 border-amber-200 text-amber-700'
                : 'bg-teal-50 border-teal-200 text-teal-700'
            }`}
          >
            {matchText}
          </span>
        );
      }
      return part;
    });
  };

  const getFilteredSuggestions = () => {
    const list: { id: string; name: string; isEveryone?: boolean; role?: string }[] = [];
    
    // Add everyone option if authorized
    const isAuthorizedForEveryone = userProfile.role === 'admin' || userProfile.role === 'leader';
    if (isAuthorizedForEveryone) {
      list.push({ id: 'everyone', name: 'everyone', isEveryone: true });
    }
    
    // Add workspace members
    (members || []).forEach(m => {
      if (m.uid !== userProfile.uid) {
        list.push({ id: m.uid, name: m.name, role: m.role });
      }
    });
    
    if (!suggestionSearch) return list;
    
    const searchLower = suggestionSearch.toLowerCase();
    return list.filter(item => item.name.toLowerCase().includes(searchLower));
  };
  
  const filteredSuggestions = getFilteredSuggestions();

  const handleTextareaChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const text = e.target.value;
    setNewComment(text);

    const cursor = e.target.selectionStart;
    const textBeforeCursor = text.slice(0, cursor);
    
    const lastWordMatch = textBeforeCursor.match(/@(\w*)$/);
    if (lastWordMatch) {
      const search = lastWordMatch[1];
      const matchIndex = lastWordMatch.index;
      setShowSuggestions(true);
      setSuggestionSearch(search);
      setMentionTriggerIndex(matchIndex !== undefined ? matchIndex : -1);
      setSelectedSuggestionIndex(0);
    } else {
      setShowSuggestions(false);
    }
  };

  const handleSelectSuggestion = (suggestion: { name: string }) => {
    const text = newComment;
    const before = text.slice(0, mentionTriggerIndex);
    
    const cursor = textareaRef.current ? textareaRef.current.selectionStart : text.length;
    const after = text.slice(cursor);
    
    const mentionText = `@${suggestion.name} `;
    const updatedText = before + mentionText + after;
    setNewComment(updatedText);
    setShowSuggestions(false);
    
    if (textareaRef.current) {
      textareaRef.current.focus();
      const newCursorPos = before.length + mentionText.length;
      setTimeout(() => {
        if (textareaRef.current) {
          textareaRef.current.selectionStart = newCursorPos;
          textareaRef.current.selectionEnd = newCursorPos;
        }
      }, 50);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (showSuggestions && filteredSuggestions.length > 0) {
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        setSelectedSuggestionIndex(prev => (prev + 1) % filteredSuggestions.length);
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        setSelectedSuggestionIndex(prev => (prev - 1 + filteredSuggestions.length) % filteredSuggestions.length);
      } else if (e.key === 'Enter' || e.key === 'Tab') {
        e.preventDefault();
        handleSelectSuggestion(filteredSuggestions[selectedSuggestionIndex]);
      } else if (e.key === 'Escape') {
        e.preventDefault();
        setShowSuggestions(false);
      }
    } else {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        if (newComment.trim() || commentAttachments.length > 0) {
          handlePostComment(e);
        }
      }
    }
  };

  const handleScroll = () => {
    const container = feedContainerRef.current;
    if (!container) return;
    const isScrolledUp = container.scrollHeight - container.scrollTop - container.clientHeight > 150;
    setShowJumpToLatest(isScrolledUp);
  };

  const scrollToBottom = (behavior: 'smooth' | 'auto' = 'smooth') => {
    const container = feedContainerRef.current;
    if (container) {
      container.scrollTo({
        top: container.scrollHeight,
        behavior
      });
    }
  };

  // Reset first load when task changes
  React.useEffect(() => {
    if (task?.id !== lastTaskIdRef.current) {
      lastTaskIdRef.current = task?.id || null;
      isFirstLoadRef.current = true;
    }
  }, [task?.id]);

  // Handle auto scrolling on updates
  const prevCommentsLengthRef = React.useRef(comments.length);
  React.useEffect(() => {
    const container = feedContainerRef.current;
    if (!container) return;

    const prevLength = prevCommentsLengthRef.current;
    prevCommentsLengthRef.current = comments.length;

    if (comments.length === 0) return;

    if (isFirstLoadRef.current) {
      // Set scroll instantly first, then with timeout to guarantee scroll when layout finishes
      container.scrollTop = container.scrollHeight;
      const t1 = setTimeout(() => {
        if (container) container.scrollTop = container.scrollHeight;
      }, 50);
      const t2 = setTimeout(() => {
        if (container) container.scrollTop = container.scrollHeight;
      }, 150);
      isFirstLoadRef.current = false;
      return () => {
        clearTimeout(t1);
        clearTimeout(t2);
      };
    } else if (comments.length > prevLength) {
      const lastComment = comments[comments.length - 1];
      const isMyComment = lastComment.userId === userProfile.uid;
      const isNearBottom = container.scrollHeight - container.scrollTop - container.clientHeight <= 250;

      if (isMyComment || isNearBottom) {
        const t1 = setTimeout(() => {
          scrollToBottom('smooth');
        }, 50);
        const t2 = setTimeout(() => {
          scrollToBottom('smooth');
        }, 150);
        return () => {
          clearTimeout(t1);
          clearTimeout(t2);
        };
      }
    }
  }, [comments, userProfile.uid]);

  // Handle scrolling to highlighted mention comment
  React.useEffect(() => {
    if (highlightedCommentId && comments.length > 0) {
      const element = document.getElementById(`comment-${highlightedCommentId}`);
      if (element) {
        const t = setTimeout(() => {
          element.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }, 350);
        return () => clearTimeout(t);
      }
    }
  }, [highlightedCommentId, comments]);

  return (
    <div className="w-full md:w-1/2 flex flex-col bg-slate-50/50 overflow-hidden h-full relative">
      {/* Header */}
      <div className="p-4 border-b border-slate-100 bg-white flex items-center justify-between shrink-0">
        <h4 className="text-xs font-bold uppercase text-slate-400 tracking-wider flex items-center gap-1.5">
          <MessageSquare className="w-4 h-4 text-teal-500" />
          <span>Task Discussion ({comments.length})</span>
        </h4>
      </div>

      <div className="flex-1 relative min-h-0 flex flex-col">
        {/* Comments list feed */}
        <div 
          ref={feedContainerRef}
          onScroll={handleScroll}
          className="flex-1 overflow-y-auto overflow-x-hidden p-4 space-y-3.5 scrollbar-thin"
        >
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
                  <p className="text-slate-700 leading-relaxed whitespace-pre-wrap break-words mt-1">{c.content}</p>
                </div>
              );
            }

            const isMe = c.userId === userProfile.uid;
            const isHighlighted = c.id === highlightedCommentId;

            return (
              <div 
                key={c.id} 
                id={`comment-${c.id}`}
                className={`flex ${isMe ? 'justify-end' : 'justify-start'} w-full animate-in fade-in-50 duration-200`}
              >
                <div className={`text-xs space-y-1 p-3 rounded-2xl border shadow-sm transition text-left max-w-[85%] break-words min-w-0 ${
                  isHighlighted
                    ? 'ring-2 ring-teal-400 bg-teal-50 border-teal-300 scale-[1.01] shadow-md rounded-tr-none rounded-tl-none animate-pulse'
                    : isMe 
                      ? 'bg-blue-50 border-blue-200 hover:border-blue-300 rounded-tr-none' 
                      : 'bg-white border-slate-200 hover:border-teal-200 rounded-tl-none'
                }`}>
                  <div className="flex items-center justify-between gap-4">
                    <div className="flex items-center gap-1.5 overflow-hidden">
                      <strong className={`font-bold truncate ${isMe ? 'text-blue-950' : 'text-slate-800'}`}>{c.userName}</strong>
                      <span className={`text-[8px] font-bold uppercase px-1 rounded border shrink-0 ${getRoleBadge(c.userRole)}`}>
                        {c.userRole}
                      </span>
                    </div>
                    <span className={`text-[10px] font-mono shrink-0 ${isMe ? 'text-blue-600/80' : 'text-slate-450'}`}>
                      {formatRelativeTime(c.createdAt)}
                    </span>
                  </div>
                  <p className={`leading-relaxed whitespace-pre-wrap break-words ${isMe ? 'text-blue-900/95' : 'text-slate-600'}`}>
                    {renderCommentWithMentions(c.content)}
                  </p>

                  {c.attachments && c.attachments.length > 0 && (
                    <div className={`mt-2 pt-1.5 border-t flex flex-wrap gap-1.5 ${isMe ? 'border-blue-100' : 'border-slate-100'}`}>
                      {c.attachments.map((att) => (
                        <a
                          key={att.id}
                          href={att.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className={`inline-flex items-center gap-1 px-1.5 py-0.5 border rounded transition text-[10px] max-w-full ${
                            isMe
                              ? 'bg-blue-100/40 border-blue-200/80 hover:bg-blue-100/70 hover:border-blue-400 text-blue-950'
                              : 'bg-slate-50 border-slate-200 hover:bg-slate-100 hover:border-teal-400 text-slate-700'
                          }`}
                        >
                          {getAttachmentIcon(att.type, att.name)}
                          <span className="truncate max-w-[120px]" title={att.name}>{att.name}</span>
                          {att.size && <span className={`text-[8px] font-mono ${isMe ? 'text-blue-700' : 'text-slate-455'}`}>{att.size}</span>}
                        </a>
                      ))}
                    </div>
                  )}
                </div>
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

        {/* Jump to latest message button */}
        {showJumpToLatest && (
          <button
            type="button"
            onClick={scrollToBottom}
            className="absolute bottom-4 left-1/2 -translate-x-1/2 bg-teal-500 hover:bg-teal-600 text-white text-[11px] font-bold px-3.5 py-2 rounded-full shadow-lg flex items-center gap-1.5 transition-all duration-200 animate-in fade-in slide-in-from-bottom-2 z-10 hover:scale-105 cursor-pointer"
          >
            <span>Jump to latest message</span>
            <ArrowDown className="w-3.5 h-3.5 animate-bounce" />
          </button>
        )}
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

      {showSuggestions && filteredSuggestions.length > 0 && (
        <div className="absolute bottom-[60px] left-3 right-3 bg-white border border-slate-200 rounded-xl shadow-xl z-20 max-h-48 overflow-y-auto p-1 animate-in slide-in-from-bottom-2 duration-150 flex flex-col text-left">
          <div className="px-2.5 py-1.5 text-[10px] font-bold text-slate-400 uppercase tracking-wider border-b border-slate-50">
            Mention member or channel
          </div>
          {filteredSuggestions.map((item, index) => {
            const isSelected = index === selectedSuggestionIndex;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => handleSelectSuggestion(item)}
                onMouseEnter={() => setSelectedSuggestionIndex(index)}
                className={`w-full text-left px-3 py-2 text-xs rounded-lg flex items-center justify-between transition ${
                  isSelected ? 'bg-teal-500 text-white' : 'text-slate-700 hover:bg-slate-50'
                }`}
              >
                <div className="flex items-center gap-2">
                  <div className={`w-5 h-5 rounded-full flex items-center justify-center font-bold text-[10px] ${
                    isSelected ? 'bg-white/20 text-white' : 'bg-slate-100 text-slate-500'
                  }`}>
                    {item.name.charAt(0).toUpperCase()}
                  </div>
                  <span className="font-semibold">{item.name}</span>
                </div>
                {item.isEveryone ? (
                  <span className={`text-[9px] font-bold uppercase px-1.5 py-0.5 rounded ${
                    isSelected ? 'bg-white/20 text-white' : 'bg-amber-100 text-amber-700'
                  }`}>
                    All Members
                  </span>
                ) : item.role ? (
                  <span className={`text-[8px] font-bold uppercase px-1 rounded ${
                    isSelected 
                      ? 'bg-white/20 text-white border border-white/30' 
                      : item.role === 'admin'
                        ? 'bg-teal-50 text-teal-600 border border-teal-100'
                        : item.role === 'leader'
                          ? 'bg-amber-50 text-amber-600 border border-amber-100'
                          : 'bg-slate-100 text-slate-500 border border-slate-200'
                  }`}>
                    {item.role}
                  </span>
                ) : null}
              </button>
            );
          })}
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

        <textarea
          ref={textareaRef}
          placeholder="Type feedback, blocker, or message..."
          value={newComment}
          onChange={handleTextareaChange}
          onKeyDown={handleKeyDown}
          disabled={sendingComment}
          rows={1}
          className="flex-1 bg-slate-100 text-xs border-none rounded-lg py-2 px-3 text-slate-800 placeholder:text-slate-400 focus:outline-none focus:ring-1 focus:ring-teal-500 resize-none min-h-[36px] max-h-32 scrollbar-thin"
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
