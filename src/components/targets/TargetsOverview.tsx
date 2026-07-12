import React from 'react';
import { Target, UserProfile } from '../../types';
import { CheckCircle2, TrendingUp, Calendar, Target as TargetIcon } from 'lucide-react';

interface TargetsOverviewProps {
  targets: Target[];
  selectedTargetId: string;
}

export default function TargetsOverview({ targets, selectedTargetId }: TargetsOverviewProps) {
  // Helper to calculate target progress %
  const getProgress = (target: Target) => {
    if (target.targetType === 'numeric') {
      const accomplished = target.accomplishedQuantity || 0;
      const quantity = target.targetQuantity;
      return quantity > 0 ? Math.round((accomplished / quantity) * 100) : 0;
    } else {
      if (!target.milestones || target.milestones.length === 0) return 0;
      const totalWeight = target.milestones.reduce((sum, m) => sum + m.weight, 0);
      const completedWeight = target.milestones.filter(m => m.status === 'completed').reduce((sum, m) => sum + m.weight, 0);
      return totalWeight > 0 ? Math.round((completedWeight / totalWeight) * 100) : 0;
    }
  };

  // 1. Active Targets
  const activeCount = targets.filter(t => t.status === 'active').length;
  const totalCount = targets.length;

  // 2. Selected Target Progress
  const selectedTarget = selectedTargetId !== 'all' ? targets.find(t => t.id === selectedTargetId) : null;
  let selectedProgressText = '';
  let selectedProgressPct = 0;

  if (selectedTarget) {
    selectedProgressPct = getProgress(selectedTarget);
    selectedProgressText = `${selectedTarget.name.length > 18 ? selectedTarget.name.substring(0, 16) + '...' : selectedTarget.name}`;
  } else {
    // Average of all active targets
    const activeList = targets.filter(t => t.status === 'active');
    if (activeList.length > 0) {
      const totalProgress = activeList.reduce((sum, t) => sum + getProgress(t), 0);
      selectedProgressPct = Math.round(totalProgress / activeList.length);
      selectedProgressText = 'Average (All Active)';
    } else {
      selectedProgressPct = 0;
      selectedProgressText = 'No active targets';
    }
  }

  // 3. Due This Period (Active targets ending in the next 30 days, or current active filters)
  const dueThisPeriod = targets.filter(t => {
    if (t.status !== 'active') return false;
    if (!t.endDate) return false;
    try {
      const end = new Date(t.endDate);
      const now = new Date();
      // Target is ending in future, within 30 days, or is currently past its deadline but active
      const diffTime = end.getTime() - now.getTime();
      const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
      return diffDays <= 30; // Due within 30 days or overdue
    } catch {
      return false;
    }
  }).length;

  // 4. Performance Status
  let performanceLabel = 'No Targets';
  let performanceColor = 'text-slate-500 bg-slate-50 border-slate-200';
  
  const activeList = targets.filter(t => t.status === 'active');
  if (activeList.length > 0) {
    const totalProgress = activeList.reduce((sum, t) => sum + getProgress(t), 0);
    const avgProgress = Math.round(totalProgress / activeList.length);

    if (avgProgress >= 80) {
      performanceLabel = 'Excellent 🌟';
      performanceColor = 'text-emerald-700 bg-emerald-50 border-emerald-200';
    } else if (avgProgress >= 60) {
      performanceLabel = 'On Track ✅';
      performanceColor = 'text-teal-700 bg-teal-50 border-teal-200';
    } else if (avgProgress >= 40) {
      performanceLabel = 'Good Progress 📈';
      performanceColor = 'text-amber-700 bg-amber-50 border-amber-200';
    } else {
      performanceLabel = 'Needs Attention ⚠️';
      performanceColor = 'text-rose-700 bg-rose-50 border-rose-200';
    }
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
      {/* Card 1: Active Targets */}
      <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm flex flex-col justify-between">
        <div className="flex items-center justify-between mb-2">
          <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">Active Targets</span>
          <CheckCircle2 className="w-5 h-5 text-emerald-500" />
        </div>
        <div>
          <div className="text-2xl font-bold text-slate-900">{activeCount}</div>
          <div className="text-xs font-medium text-slate-500 mt-1">Out of {totalCount} total targets</div>
        </div>
      </div>

      {/* Card 2: Selected Target Progress */}
      <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm flex flex-col justify-between">
        <div className="flex items-center justify-between mb-2">
          <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">Selected Progress</span>
          <TargetIcon className="w-5 h-5 text-teal-500" />
        </div>
        <div>
          <div className="flex items-baseline gap-2">
            <span className="text-2xl font-bold text-slate-900">{selectedProgressPct}%</span>
            <span className="text-xs text-slate-400 truncate max-w-[120px] font-medium" title={selectedProgressText}>
              ({selectedProgressText})
            </span>
          </div>
          <div className="w-full bg-slate-100 h-1 rounded-full mt-2 overflow-hidden">
            <div 
              className="bg-teal-500 h-full rounded-full transition-all duration-500" 
              style={{ width: `${selectedProgressPct}%` }}
            />
          </div>
        </div>
      </div>

      {/* Card 3: Due This Period */}
      <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm flex flex-col justify-between">
        <div className="flex items-center justify-between mb-2">
          <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">Due This Period</span>
          <Calendar className="w-5 h-5 text-indigo-500" />
        </div>
        <div>
          <div className="text-2xl font-bold text-slate-900">{dueThisPeriod}</div>
          <div className="text-xs font-medium text-slate-500 mt-1">Ending soon or overdue</div>
        </div>
      </div>

      {/* Card 4: Performance Status */}
      <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm flex flex-col justify-between">
        <div className="flex items-center justify-between mb-2">
          <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">Performance Status</span>
          <TrendingUp className="w-5 h-5 text-purple-500" />
        </div>
        <div>
          <div className={`inline-flex items-center px-2.5 py-1 rounded-lg border text-sm font-bold ${performanceColor}`}>
            {performanceLabel}
          </div>
          <div className="text-xs font-medium text-slate-500 mt-1.5">Based on active targets progress</div>
        </div>
      </div>
    </div>
  );
}
