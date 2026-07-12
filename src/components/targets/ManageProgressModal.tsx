import React, { useState } from 'react';
import { Target, Milestone } from '../../types';
import { doc, updateDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '../../firebase';
import { X, Plus, Trash2, CheckCircle, Circle, Award } from 'lucide-react';

interface ManageProgressModalProps {
  isOpen: boolean;
  onClose: () => void;
  target: Target;
  workspaceId: string;
}

export default function ManageProgressModal({ isOpen, onClose, target, workspaceId }: ManageProgressModalProps) {
  const [accomplishedQty, setAccomplishedQty] = useState<number>(target?.accomplishedQuantity || 0);
  
  // Exclude virtual/augmented milestones and any leaked task milestones to prevent Firestore contamination and duplicate key errors
  const realMilestones = ((target && target.milestones) || []).filter((m: any) => !m.isVirtual && !m.id?.startsWith('task-'));

  // New milestone states
  const [newTitle, setNewTitle] = useState('');
  const [newWeight, setNewWeight] = useState(1);
  const [newPriority, setNewPriority] = useState<'low' | 'medium' | 'high'>('medium');
  
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleUpdateNumeric = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      const targetRef = doc(db, 'workspaces', workspaceId, 'targets', target.id);
      await updateDoc(targetRef, {
        accomplishedQuantity: accomplishedQty,
        updatedAt: serverTimestamp()
      });
      onClose();
    } catch (err: any) {
      console.error('Error updating target accomplishment:', err);
      setError(err?.message || 'Failed to update progress.');
    } finally {
      setLoading(false);
    }
  };

  const handleAddMilestone = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTitle.trim()) return;
    setLoading(true);
    setError(null);

    try {
      const newMilestone: Milestone = {
        id: Math.random().toString(36).substring(2, 9),
        title: newTitle.trim(),
        priority: newPriority,
        status: 'pending',
        weight: Number(newWeight) || 1,
      };

      const updatedMilestones = [...realMilestones, newMilestone];
      const targetRef = doc(db, 'workspaces', workspaceId, 'targets', target.id);
      
      await updateDoc(targetRef, {
        milestones: updatedMilestones,
        updatedAt: serverTimestamp()
      });

      setNewTitle('');
      setNewWeight(1);
      setNewPriority('medium');
    } catch (err: any) {
      console.error('Error adding milestone:', err);
      setError(err?.message || 'Failed to add milestone.');
    } finally {
      setLoading(false);
    }
  };

  const handleToggleMilestone = async (milestoneId: string) => {
    setLoading(true);
    setError(null);
    try {
      const updatedMilestones = realMilestones.map(m => {
        if (m.id === milestoneId) {
          return {
            ...m,
            status: m.status === 'completed' ? 'pending' : 'completed' as const
          };
        }
        return m;
      });

      const targetRef = doc(db, 'workspaces', workspaceId, 'targets', target.id);
      await updateDoc(targetRef, {
        milestones: updatedMilestones,
        updatedAt: serverTimestamp()
      });
    } catch (err: any) {
      console.error('Error toggling milestone status:', err);
      setError('Failed to update milestone status.');
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteMilestone = async (milestoneId: string) => {
    setLoading(true);
    setError(null);
    try {
      const updatedMilestones = realMilestones.filter(m => m.id !== milestoneId);
      const targetRef = doc(db, 'workspaces', workspaceId, 'targets', target.id);
      await updateDoc(targetRef, {
        milestones: updatedMilestones,
        updatedAt: serverTimestamp()
      });
    } catch (err: any) {
      console.error('Error deleting milestone:', err);
      setError('Failed to delete milestone.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50 overflow-y-auto">
      <div className="bg-white rounded-xl shadow-lg w-full max-w-lg p-6 my-8">
        <div className="flex justify-between items-center mb-4 pb-2 border-b">
          <div>
            <h2 className="text-lg font-bold text-slate-800">Manage Target Progress</h2>
            <p className="text-xs text-slate-500 font-medium">{target.name}</p>
          </div>
          <button onClick={onClose} className="p-1 hover:bg-slate-100 rounded-full transition">
            <X className="w-5 h-5 text-slate-500" />
          </button>
        </div>

        {error && <p className="text-red-500 text-xs font-semibold mb-4 bg-red-50 p-2.5 rounded border border-red-200">{error}</p>}

        {/* Numeric Progress Section */}
        {target.targetType === 'numeric' ? (
          <form onSubmit={handleUpdateNumeric} className="space-y-4">
            <div className="bg-slate-50 p-4 rounded-lg border border-slate-100">
              <div className="flex justify-between text-xs text-slate-500 font-semibold mb-2">
                <span>Target Quantity: {target.targetQuantity}</span>
                <span>Current: {target.accomplishedQuantity || 0}</span>
              </div>
              <div className="relative rounded-md shadow-sm">
                <input
                  type="number"
                  min="0"
                  className="w-full p-2.5 border rounded-lg text-sm focus:ring-1 focus:ring-slate-950"
                  placeholder="Enter accomplished units"
                  value={accomplishedQty}
                  onChange={e => setAccomplishedQty(Number(e.target.value))}
                  required
                />
              </div>
              <p className="text-[11px] text-slate-400 mt-1">
                Enter the total units completed for this period. Progress will calculate automatically.
              </p>
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 border rounded text-xs font-semibold text-slate-600 hover:bg-slate-50 transition"
                disabled={loading}
              >
                Close
              </button>
              <button
                type="submit"
                className="px-4 py-2 bg-slate-900 text-white rounded text-xs font-semibold hover:bg-slate-800 disabled:bg-slate-400 transition"
                disabled={loading}
              >
                {loading ? 'Saving...' : 'Update Accomplishment'}
              </button>
            </div>
          </form>
        ) : (
          /* Milestone Section */
          <div className="space-y-5">
            {/* New Milestone Form */}
            <form onSubmit={handleAddMilestone} className="p-3 bg-slate-50 rounded-lg border border-slate-200 space-y-3">
              <span className="text-xs font-bold text-slate-700 block">Add New Milestone</span>
              <div className="space-y-2">
                <input
                  type="text"
                  placeholder="Milestone Title"
                  className="w-full p-2 border rounded text-xs bg-white"
                  value={newTitle}
                  onChange={e => setNewTitle(e.target.value)}
                  required
                />
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="block text-[10px] text-slate-500 font-semibold mb-0.5">Weight</label>
                    <input
                      type="number"
                      min="1"
                      className="w-full p-1.5 border rounded text-xs bg-white"
                      value={newWeight}
                      onChange={e => setNewWeight(Number(e.target.value))}
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] text-slate-500 font-semibold mb-0.5">Priority</label>
                    <select
                      className="w-full p-1.5 border rounded text-xs bg-white"
                      value={newPriority}
                      onChange={e => setNewPriority(e.target.value as any)}
                    >
                      <option value="low">Low</option>
                      <option value="medium">Medium</option>
                      <option value="high">High</option>
                    </select>
                  </div>
                </div>
              </div>
              <button
                type="submit"
                disabled={loading || !newTitle.trim()}
                className="w-full py-2 bg-teal-600 text-white rounded text-xs font-semibold hover:bg-teal-700 disabled:bg-slate-300 flex items-center justify-center gap-1.5 transition"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Add Milestone</span>
              </button>
            </form>

            {/* Milestone List */}
            <div className="space-y-2.5">
              <span className="text-xs font-bold text-slate-700 block">
                Milestones ({realMilestones.length})
              </span>
              
              {realMilestones.length === 0 ? (
                <div className="text-center py-6 border border-dashed border-slate-200 rounded-lg">
                  <Award className="w-8 h-8 text-slate-300 mx-auto mb-1" />
                  <p className="text-xs text-slate-400">No milestones yet. Create one above to measure progress.</p>
                </div>
              ) : (
                <div className="max-h-60 overflow-y-auto space-y-2 pr-1">
                  {realMilestones.map(m => (
                    <div
                      key={m.id}
                      className="flex items-center justify-between p-2.5 bg-white border border-slate-200 rounded-lg hover:border-slate-300 transition"
                    >
                      <div className="flex items-center gap-2.5 min-w-0">
                        <button
                          onClick={() => handleToggleMilestone(m.id)}
                          className="flex-shrink-0 text-slate-400 hover:text-teal-600 transition"
                          disabled={loading}
                        >
                          {m.status === 'completed' ? (
                            <CheckCircle className="w-5 h-5 text-teal-600" />
                          ) : (
                            <Circle className="w-5 h-5 text-slate-300" />
                          )}
                        </button>
                        <div className="min-w-0">
                          <p className={`text-xs font-medium text-slate-800 truncate ${m.status === 'completed' ? 'line-through text-slate-400' : ''}`}>
                            {m.title}
                          </p>
                          <div className="flex items-center gap-2 mt-0.5">
                            <span className="text-[9px] font-bold px-1 py-0.2 rounded bg-slate-100 text-slate-600">
                              Weight: {m.weight}
                            </span>
                            <span className={`text-[9px] font-semibold px-1 py-0.2 rounded ${
                              m.priority === 'high' ? 'bg-red-50 text-red-600 border border-red-100' :
                              m.priority === 'medium' ? 'bg-amber-50 text-amber-600 border border-amber-100' :
                              'bg-slate-100 text-slate-600'
                            }`}>
                              {m.priority}
                            </span>
                          </div>
                        </div>
                      </div>
                      
                      <button
                        onClick={() => handleDeleteMilestone(m.id)}
                        className="p-1 text-slate-400 hover:text-red-500 rounded hover:bg-red-50 transition"
                        disabled={loading}
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="flex justify-end pt-2 border-t">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 border rounded text-xs font-semibold text-slate-600 hover:bg-slate-50 transition"
              >
                Close
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
