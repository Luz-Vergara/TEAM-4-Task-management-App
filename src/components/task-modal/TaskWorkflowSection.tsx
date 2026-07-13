/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import { Task, UserProfile, UserRole, TaskStatus } from '../../types';
import { UserCheck } from 'lucide-react';

interface TaskWorkflowSectionProps {
  status: TaskStatus;
  setStatus: React.Dispatch<React.SetStateAction<TaskStatus>>;
  assignedUserId: string;
  assignedUserIds?: string[];
  userProfile: UserProfile;
  isTransitioning: boolean;
  workflowRemarks: string;
  setWorkflowRemarks: React.Dispatch<React.SetStateAction<string>>;
  handleWorkflowTransition: (newStatus: TaskStatus) => Promise<void>;
  getMemberName: (uid: string) => string;
  onSaveTask: (taskData: Partial<Task>, shouldCloseModal?: boolean) => void;
}

export default function TaskWorkflowSection({
  status,
  setStatus,
  assignedUserId,
  assignedUserIds = [],
  userProfile,
  isTransitioning,
  workflowRemarks,
  setWorkflowRemarks,
  handleWorkflowTransition,
  getMemberName,
  onSaveTask
}: TaskWorkflowSectionProps) {
  const isAssignee = assignedUserId === userProfile.uid || assignedUserIds.includes(userProfile.uid);

  return (
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
                <div className="text-xs text-slate-755 text-left">
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
                {assignedUserIds && assignedUserIds.length > 0 ? (
                  <span>Waiting for assigned members <strong>{assignedUserIds.map(uid => getMemberName(uid)).join(', ')}</strong> to accept this task.</span>
                ) : assignedUserId ? (
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
                <div className="text-xs text-slate-755 text-left">
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
                {assignedUserIds && assignedUserIds.length > 0 ? (
                  <span>This task is currently In Progress by <strong>{assignedUserIds.map(uid => getMemberName(uid)).join(', ')}</strong>.</span>
                ) : (
                  <span>This task is currently In Progress by <strong>{getMemberName(assignedUserId)}</strong>.</span>
                )}
              </div>
            )}
          </>
        )}

        {status === TaskStatus.REVIEW && (
          <>
            {userProfile.role === UserRole.LEADER || userProfile.role === UserRole.ADMIN ? (
              <div className="space-y-3">
                <div className="text-xs text-slate-755 text-left">
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
            disabled={status === TaskStatus.COMPLETED}
            className="w-full bg-slate-150 border-none rounded-lg py-1.5 px-3 text-[11px] text-slate-600 font-semibold focus:outline-none appearance-none cursor-pointer disabled:opacity-60 disabled:cursor-not-allowed"
          >
            {status === TaskStatus.TODO && (
              <option value={TaskStatus.TODO}>To Do</option>
            )}
            <option value={TaskStatus.IN_PROGRESS}>In Progress</option>
            <option value={TaskStatus.REVIEW}>For Review</option>
            <option value={TaskStatus.COMPLETED}>Completed</option>
          </select>
        </div>
      )}
    </div>
  );
}
