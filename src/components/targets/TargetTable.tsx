import React, { useState } from 'react';
import { Target, UserProfile, Task } from '../../types';
import { doc, updateDoc, deleteDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '../../firebase';
import { Sliders, Check, Archive, Trash2, ShieldAlert, Award, Calendar, CheckSquare, X } from 'lucide-react';
import ManageProgressModal from './ManageProgressModal';

interface TargetTableProps {
  targets: Target[];
  members: UserProfile[];
  workspaceId: string;
  tasks?: Task[];
  userProfile: UserProfile;
}

export default function TargetTable({ targets, members, workspaceId, tasks = [], userProfile }: TargetTableProps) {
  const [selectedTarget, setSelectedTarget] = useState<Target | null>(null);
  const [isProgressModalOpen, setIsProgressModalOpen] = useState(false);
  const [loading, setLoading] = useState<string | null>(null);
  const [expandedTargetId, setExpandedTargetId] = useState<string | null>(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);

  const calculateProgress = (target: Target) => {
    const targetTasks = tasks.filter(t => t.targetId === target.id);
    const totalTasks = targetTasks.length;
    const completedTasks = targetTasks.filter(t => t.status === 'completed').length;

    if (target.targetType === 'numeric') {
      const accomplished = (target.accomplishedQuantity || 0) + completedTasks;
      const quantity = target.targetQuantity;
      return quantity > 0 ? Math.min(100, Math.round((accomplished / quantity) * 100)) : 0;
    } else {
      const milestones = target.milestones || [];
      const totalMilestonesWeight = milestones.reduce((sum, m) => sum + m.weight, 0);
      const completedMilestonesWeight = milestones.filter(m => m.status === 'completed').reduce((sum, m) => sum + m.weight, 0);

      if (milestones.length === 0 && totalTasks === 0) {
        return 0;
      }
      if (milestones.length > 0 && totalTasks === 0) {
        return totalMilestonesWeight > 0 ? Math.round((completedMilestonesWeight / totalMilestonesWeight) * 100) : 0;
      }
      if (milestones.length === 0 && totalTasks > 0) {
        return Math.round((completedTasks / totalTasks) * 100);
      }
      const combinedTotalWeight = totalMilestonesWeight + totalTasks;
      const combinedCompletedWeight = completedMilestonesWeight + completedTasks;
      return combinedTotalWeight > 0 ? Math.round((combinedCompletedWeight / combinedTotalWeight) * 100) : 0;
    }
  };

  const getAccomplishedText = (target: Target) => {
    const targetTasks = tasks.filter(t => t.targetId === target.id);
    const completedTasks = targetTasks.filter(t => t.status === 'completed').length;

    if (target.targetType === 'numeric') {
      const accomplished = (target.accomplishedQuantity || 0) + completedTasks;
      let text = `${accomplished} / ${target.targetQuantity} units`;
      if (targetTasks.length > 0) {
        text += ` (incl. ${completedTasks} task${completedTasks !== 1 ? 's' : ''})`;
      }
      return text;
    } else {
      const milestones = target.milestones || [];
      const completedMilestones = milestones.filter(m => m.status === 'completed').length;
      const totalMilestones = milestones.length;

      let textParts = [];
      if (totalMilestones > 0) {
        textParts.push(`${completedMilestones}/${totalMilestones} ms`);
      }
      if (targetTasks.length > 0) {
        textParts.push(`${completedTasks}/${targetTasks.length} tasks`);
      }
      return textParts.join(' & ') || 'No metrics yet';
    }
  };

  const getResponsibleName = (target: Target) => {
    if (target.responsibilityType === 'all_members') {
      return 'All Members';
    }
    const member = members.find(m => m.uid === target.responsibleMemberId);
    return member ? member.name : 'Unknown Member';
  };

  const handleToggleStatus = async (target: Target) => {
    setLoading(target.id);
    try {
      const newStatus = target.status === 'active' ? 'archived' : 'active';
      const targetRef = doc(db, 'workspaces', workspaceId, 'targets', target.id);
      await updateDoc(targetRef, {
        status: newStatus,
        updatedAt: serverTimestamp()
      });
    } catch (err) {
      console.error('Error toggling target status:', err);
    } finally {
      setLoading(null);
    }
  };

  const handleDeleteTarget = async (targetId: string) => {
    setLoading(targetId);
    try {
      // 1. Unlink any tasks associated with this target
      const targetTasks = tasks.filter(t => t.targetId === targetId);
      for (const t of targetTasks) {
        try {
          const taskRef = doc(db, 'workspaces', workspaceId, 'tasks', t.id);
          await updateDoc(taskRef, {
            targetId: null,
            updatedAt: new Date().toISOString()
          });
        } catch (taskErr) {
          console.error(`Error unlinking task ${t.id} from deleted target:`, taskErr);
        }
      }

      // 2. Delete the target itself permanently
      const targetRef = doc(db, 'workspaces', workspaceId, 'targets', targetId);
      await deleteDoc(targetRef);
      setConfirmDeleteId(null);
    } catch (err) {
      console.error('Error deleting target:', err);
    } finally {
      setLoading(null);
    }
  };

  const handleToggleTaskStatus = async (task: Task) => {
    if (task.status === 'completed') return;
    try {
      const taskRef = doc(db, 'workspaces', workspaceId, 'tasks', task.id);
      const newStatus = 'completed';
      await updateDoc(taskRef, {
        status: newStatus,
        updatedAt: new Date().toISOString()
      });
    } catch (err) {
      console.error('Error toggling task status from targets view:', err);
    }
  };

  const handleOpenProgress = (target: Target) => {
    setSelectedTarget(target);
    setIsProgressModalOpen(true);
  };

  const formatDate = (dateStr?: string) => {
    if (!dateStr) return 'N/A';
    try {
      const date = new Date(dateStr);
      return date.toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' });
    } catch {
      return dateStr;
    }
  };

  return (
    <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full text-left text-sm text-slate-600">
          <thead className="bg-slate-50 border-b border-slate-200 text-[11px] font-bold uppercase text-slate-500 tracking-wider">
            <tr>
              <th className="px-6 py-4">Name</th>
              <th className="px-6 py-4">Period</th>
              <th className="px-6 py-4">Responsible Member</th>
              <th className="px-6 py-4">Target Quantity</th>
              <th className="px-6 py-4">Accomplished</th>
              <th className="px-6 py-4">Progress</th>
              <th className="px-6 py-4">Due Date</th>
              <th className="px-6 py-4">Status</th>
              <th className="px-6 py-4 text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {targets.length === 0 ? (
              <tr>
                <td colSpan={9} className="px-6 py-12 text-center text-slate-400">
                  <Award className="w-10 h-10 text-slate-300 mx-auto mb-2" />
                  <span className="text-sm font-medium">No targets found matching the current filters.</span>
                </td>
              </tr>
            ) : (
              targets.map(target => {
                const progress = calculateProgress(target);
                const targetTasks = tasks.filter(t => t.targetId === target.id);
                const isExpanded = expandedTargetId === target.id;
                
                return (
                  <React.Fragment key={target.id}>
                    <tr className="hover:bg-slate-50 transition-colors">
                      <td className="px-6 py-4 font-semibold text-slate-900 max-w-xs">
                        <div className="flex flex-col">
                          <span className="text-slate-800 flex items-center flex-wrap gap-1">
                            <span>{target.name}</span>
                            {targetTasks.length > 0 && (
                              <button 
                                onClick={() => setExpandedTargetId(isExpanded ? null : target.id)}
                                className="text-[10px] text-teal-600 hover:text-teal-800 font-bold bg-teal-50 hover:bg-teal-100 px-1.5 py-0.5 rounded-full transition cursor-pointer"
                              >
                                {isExpanded ? 'Hide' : `Show Tasks (${targetTasks.length})`}
                              </button>
                            )}
                          </span>
                          <span className="text-[10px] text-slate-400 font-normal capitalize">
                            {target.targetType}
                          </span>
                        </div>
                      </td>
                      <td className="px-6 py-4 font-medium text-slate-600 capitalize">
                        {target.periodType}
                      </td>
                      <td className="px-6 py-4 font-medium text-slate-700">
                        {getResponsibleName(target)}
                      </td>
                      <td className="px-6 py-4 text-slate-700 font-semibold">
                        {target.targetQuantity}
                      </td>
                      <td className="px-6 py-4 font-medium text-slate-600 text-xs">
                        {getAccomplishedText(target)}
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-2">
                          <div className="w-20 bg-slate-100 rounded-full h-1.5 overflow-hidden">
                            <div 
                              className={`h-full rounded-full transition-all duration-500 ${
                                progress >= 80 ? 'bg-emerald-500' :
                                progress >= 50 ? 'bg-teal-500' :
                                progress >= 25 ? 'bg-amber-500' :
                                'bg-rose-500'
                              }`}
                              style={{ width: `${Math.min(progress, 100)}%` }}
                            />
                          </div>
                          <span className="text-xs font-bold text-slate-700">{progress}%</span>
                        </div>
                      </td>
                      <td className="px-6 py-4 text-xs font-medium text-slate-500">
                        <span className="flex items-center gap-1">
                          <Calendar className="w-3.5 h-3.5 text-slate-400" />
                          <span>{formatDate(target.endDate)}</span>
                        </span>
                      </td>
                      <td className="px-6 py-4">
                        <span className={`px-2 py-0.5 rounded-full text-[10px] font-extrabold uppercase border ${
                          target.status === 'active' 
                            ? 'bg-emerald-50 text-emerald-700 border-emerald-200' 
                            : 'bg-slate-50 text-slate-600 border-slate-200'
                        }`}>
                          {target.status}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          <button
                            onClick={() => handleOpenProgress(target)}
                            disabled={loading === target.id}
                            title="Manage Progress & Milestones"
                            className="p-1.5 text-slate-500 hover:text-slate-900 hover:bg-slate-100 rounded-lg transition"
                          >
                            <Sliders className="w-4 h-4" />
                          </button>
                          
                          <button
                            onClick={() => handleToggleStatus(target)}
                            disabled={loading === target.id}
                            title={target.status === 'active' ? 'Archive Target' : 'Activate Target'}
                            className="p-1.5 text-slate-500 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition"
                          >
                            <Archive className="w-4 h-4" />
                          </button>

                          {confirmDeleteId === target.id ? (
                            <div className="flex items-center gap-1 bg-rose-50 border border-rose-100 rounded-lg p-0.5 shadow-sm animate-pulse">
                              <span className="text-[9px] font-bold text-rose-600 px-1 select-none">Delete?</span>
                              <button
                                onClick={() => handleDeleteTarget(target.id)}
                                disabled={loading === target.id}
                                title="Yes, delete permanently"
                                className="p-1 text-red-700 hover:bg-rose-100 rounded-md transition cursor-pointer"
                              >
                                <Check className="w-3.5 h-3.5" />
                              </button>
                              <button
                                onClick={() => setConfirmDeleteId(null)}
                                disabled={loading === target.id}
                                title="Cancel"
                                className="p-1 text-slate-500 hover:bg-slate-200 rounded-md transition cursor-pointer"
                              >
                                <X className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          ) : (
                            <button
                              onClick={() => setConfirmDeleteId(target.id)}
                              disabled={loading === target.id}
                              title="Delete Target"
                              className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-rose-50 rounded-lg transition cursor-pointer"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                    
                    {isExpanded && targetTasks.length > 0 && (
                      <tr className="bg-slate-50/55">
                        <td colSpan={9} className="px-8 py-3.5 border-t border-b border-slate-200">
                          <div className="space-y-2.5">
                            <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
                              <CheckSquare className="w-4 h-4 text-teal-600" />
                              <span>Linked Tasks contributing to progress ({targetTasks.filter(t => t.status === 'completed').length} completed of {targetTasks.length})</span>
                            </div>
                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3.5">
                              {targetTasks.map((task) => (
                                <div key={task.id} className="bg-white border border-slate-200 rounded-xl p-3 shadow-sm flex items-start gap-3 hover:border-slate-300 transition-all">
                                  <input
                                    type="checkbox"
                                    checked={task.status === 'completed'}
                                    disabled={task.status === 'completed'}
                                    onChange={() => handleToggleTaskStatus(task)}
                                    className="mt-0.5 h-4 w-4 rounded border-slate-300 text-teal-600 focus:ring-teal-500 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                                  />
                                  <div className="min-w-0 flex-1 space-y-1 text-left">
                                    <div className={`text-xs font-semibold truncate ${task.status === 'completed' ? 'line-through text-slate-400' : 'text-slate-800'}`}>
                                      {task.title}
                                    </div>
                                    <div className="flex items-center gap-1.5 text-[10px] text-slate-400">
                                      <span className="capitalize">{task.priority} Priority</span>
                                      <span>•</span>
                                      <span>Due {task.dueDate || 'N/A'}</span>
                                    </div>
                                  </div>
                                </div>
                              ))}
                            </div>
                          </div>
                        </td>
                      </tr>
                    )}
                  </React.Fragment>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {isProgressModalOpen && selectedTarget && (
        <ManageProgressModal
          isOpen={isProgressModalOpen}
          onClose={() => {
            setIsProgressModalOpen(false);
            setSelectedTarget(null);
          }}
          target={targets.find(t => t.id === selectedTarget.id) || selectedTarget}
          workspaceId={workspaceId}
          userProfile={userProfile}
        />
      )}
    </div>
  );
}
