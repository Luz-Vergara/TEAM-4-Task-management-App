import React, { useState, useEffect } from 'react';
import { UserProfile, Target, Task } from '../types';
import { TrendingUp, Plus, Filter, RotateCcw } from 'lucide-react';
import { collection, onSnapshot, query, orderBy } from 'firebase/firestore';
import { db } from '../firebase';
import TargetsOverview from './targets/TargetsOverview';
import TargetProgressChart from './targets/TargetProgressChart';
import PerformanceTimelineChart from './targets/PerformanceTimelineChart';
import TargetTable from './targets/TargetTable';
import CreateTargetModal from './targets/CreateTargetModal';

interface TargetsPerformanceProps {
  userProfile: UserProfile;
  channels: any[];
  members: UserProfile[];
  tasks?: Task[];
}

export default function TargetsPerformance({ userProfile, channels, members, tasks = [] }: TargetsPerformanceProps) {
  const [targets, setTargets] = useState<Target[]>([]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  // Filter States
  const [filterPeriodType, setFilterPeriodType] = useState<string>('all');
  const [filterYear, setFilterYear] = useState<string>('all');
  const [filterTargetId, setFilterTargetId] = useState<string>('all');
  const [filterStatus, setFilterStatus] = useState<string>('all');

  useEffect(() => {
    if (!userProfile.workspaceId) return;
    const q = query(collection(db, `workspaces/${userProfile.workspaceId}/targets`), orderBy('createdAt', 'desc'));
    return onSnapshot(q, (snapshot) => {
      const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Target));
      setTargets(data);
    });
  }, [userProfile.workspaceId]);

  useEffect(() => {
    if (successMessage) {
      const timer = setTimeout(() => setSuccessMessage(null), 3500);
      return () => clearTimeout(timer);
    }
  }, [successMessage]);

  // Augment targets with real-time linked task contributions for progress calculation
  const augmentedTargets = targets.map(target => {
    const targetTasks = tasks.filter(t => t.targetId === target.id);
    const completedTasks = targetTasks.filter(t => t.status === 'completed').length;
    
    if (target.targetType === 'numeric') {
      return {
        ...target,
        accomplishedQuantity: (target.accomplishedQuantity || 0) + completedTasks
      };
    } else {
      const virtualMilestones = targetTasks.map(t => ({
        id: t.id,
        name: t.title,
        weight: 1,
        status: t.status === 'completed' ? 'completed' : 'pending',
        isVirtual: true
      }));
      return {
        ...target,
        milestones: [...(target.milestones || []), ...virtualMilestones]
      };
    }
  });

  // Reset Filters
  const handleResetFilters = () => {
    setFilterPeriodType('all');
    setFilterYear('all');
    setFilterTargetId('all');
    setFilterStatus('all');
  };

  // Get dynamic years from existing targets to populate the year filter dropdown
  const availableYears = Array.from(new Set([
    new Date().getFullYear(),
    ...augmentedTargets.map(t => t.selectedYear).filter(Boolean) as number[],
    ...augmentedTargets.map(t => t.startDate ? new Date(t.startDate).getFullYear() : null).filter(Boolean) as number[]
  ])).sort((a, b) => b - a);

  // Perform dynamic filtering based on selections
  const filteredTargets = augmentedTargets.filter(target => {
    if (filterPeriodType !== 'all' && target.periodType !== filterPeriodType) {
      return false;
    }
    
    if (filterYear !== 'all') {
      const yearNum = Number(filterYear);
      const targetYear = target.selectedYear || (target.startDate ? new Date(target.startDate).getFullYear() : null);
      if (targetYear !== yearNum) {
        return false;
      }
    }

    if (filterTargetId !== 'all' && target.id !== filterTargetId) {
      return false;
    }

    if (filterStatus !== 'all' && target.status !== filterStatus) {
      return false;
    }

    return true;
  });

  return (
    <div className="flex-1 overflow-y-auto p-4 md:p-8 space-y-6 bg-slate-50 text-slate-900 font-sans">
      {successMessage && (
        <div className="fixed top-4 right-4 bg-emerald-500 text-white px-4 py-3 rounded-lg text-sm font-semibold flex items-center gap-3 shadow-md z-50 animate-bounce">
          <span>{successMessage}</span>
          <button onClick={() => setSuccessMessage(null)} className="hover:text-slate-100 font-bold">×</button>
        </div>
      )}

      {/* Header Panel */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between pb-5 border-b border-slate-200 gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight flex items-center gap-2">
            <TrendingUp className="w-6 h-6 text-teal-500" />
            <span>Targets & Performance Dashboard</span>
          </h1>
          <p className="text-xs text-slate-500 mt-1">
            Establish, analyze, and manage dynamic multi-period performance metrics and milestones
          </p>
        </div>
        
        {userProfile.role === 'admin' && (
          <button 
            onClick={() => setIsModalOpen(true)}
            className="flex items-center justify-center gap-2 bg-slate-900 text-white px-4.5 py-2.5 rounded-lg text-sm font-bold shadow-sm hover:bg-slate-800 transition"
          >
            <Plus className="w-4 h-4" />
            <span>Create Target</span>
          </button>
        )}
      </div>

      {/* Dynamic Filters Section */}
      <div className="bg-white p-4.5 rounded-xl border border-slate-200 shadow-sm space-y-4">
        <div className="flex items-center justify-between border-b border-slate-100 pb-2.5">
          <div className="flex items-center gap-2 text-sm font-bold text-slate-700">
            <Filter className="w-4 h-4 text-slate-400" />
            <span>Filter Dashboard Metrics</span>
          </div>
          {(filterPeriodType !== 'all' || filterYear !== 'all' || filterTargetId !== 'all' || filterStatus !== 'all') && (
            <button
              onClick={handleResetFilters}
              className="flex items-center gap-1.5 text-xs text-indigo-600 hover:text-indigo-800 font-semibold transition"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span>Reset Filters</span>
            </button>
          )}
        </div>
        
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {/* Filter 1: Period Type */}
          <div>
            <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1.5">
              Period Type
            </label>
            <select
              value={filterPeriodType}
              onChange={e => setFilterPeriodType(e.target.value)}
              className="w-full p-2 border border-slate-200 rounded-lg text-xs bg-slate-50 font-medium focus:bg-white focus:ring-1 focus:ring-slate-900 transition"
            >
              <option value="all">All Periods</option>
              <option value="monthly">Monthly</option>
              <option value="quarterly">Quarterly</option>
              <option value="semiannual">Semiannual</option>
              <option value="annual">Annual</option>
              <option value="custom">Custom Date Range</option>
            </select>
          </div>

          {/* Filter 2: Year */}
          <div>
            <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1.5">
              Year
            </label>
            <select
              value={filterYear}
              onChange={e => setFilterYear(e.target.value)}
              className="w-full p-2 border border-slate-200 rounded-lg text-xs bg-slate-50 font-medium focus:bg-white focus:ring-1 focus:ring-slate-900 transition"
            >
              <option value="all">All Years</option>
              {availableYears.map(year => (
                <option key={year} value={year}>{year}</option>
              ))}
            </select>
          </div>

          {/* Filter 3: Target Select */}
          <div>
            <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1.5">
              Specific Target Focus
            </label>
            <select
              value={filterTargetId}
              onChange={e => setFilterTargetId(e.target.value)}
              className="w-full p-2 border border-slate-200 rounded-lg text-xs bg-slate-50 font-medium focus:bg-white focus:ring-1 focus:ring-slate-900 transition"
            >
              <option value="all">All Targets</option>
              {augmentedTargets.map(t => (
                <option key={t.id} value={t.id}>{t.name}</option>
              ))}
            </select>
          </div>

          {/* Filter 4: Status */}
          <div>
            <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1.5">
              Target Status
            </label>
            <select
              value={filterStatus}
              onChange={e => setFilterStatus(e.target.value)}
              className="w-full p-2 border border-slate-200 rounded-lg text-xs bg-slate-50 font-medium focus:bg-white focus:ring-1 focus:ring-slate-900 transition"
            >
              <option value="all">All Statuses</option>
              <option value="active">Active</option>
              <option value="archived">Archived</option>
            </select>
          </div>
        </div>
      </div>

      {/* Top Cards Overview */}
      <TargetsOverview targets={filteredTargets} selectedTargetId={filterTargetId} />
      
      {/* Charts Panel */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <TargetProgressChart targets={filteredTargets} />
        <PerformanceTimelineChart 
          targets={filteredTargets} 
          selectedTargetId={filterTargetId}
          periodTypeFilter={filterPeriodType}
        />
      </div>

      {/* Records Table */}
      <div className="space-y-3.5">
        <div>
          <h2 className="text-base font-bold text-slate-900">Target Records</h2>
          <p className="text-xs text-slate-500">View details and perform actions on compiled target metrics</p>
        </div>
        <TargetTable 
          targets={filteredTargets} 
          members={members}
          workspaceId={userProfile.workspaceId}
          tasks={tasks}
          userProfile={userProfile}
        />
      </div>

      {/* Create Target Modal */}
      <CreateTargetModal 
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        workspaceId={userProfile.workspaceId}
        channels={channels}
        members={members}
        createdBy={userProfile.uid}
        onSuccess={setSuccessMessage}
      />
    </div>
  );
}
