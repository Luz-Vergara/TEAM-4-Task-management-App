import React from 'react';
import { Target } from '../../types';
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, Legend } from 'recharts';
import { TrendingUp, Award } from 'lucide-react';

interface PerformanceTimelineChartProps {
  targets: Target[];
  selectedTargetId: string;
  periodTypeFilter: string;
}

export default function PerformanceTimelineChart({
  targets,
  selectedTargetId,
  periodTypeFilter,
}: PerformanceTimelineChartProps) {
  // Determine target(s) to analyze
  const activeTargets = selectedTargetId !== 'all'
    ? targets.filter(t => t.id === selectedTargetId)
    : targets;

  // Primary period type is either the filtered type, or the single selected target's type, or default to annual
  const resolvedPeriodType = periodTypeFilter !== 'all'
    ? periodTypeFilter
    : (activeTargets.length === 1 ? activeTargets[0].periodType : 'annual');

  // helper to get progress of a single target at a relative percentage of its timeframe
  const getProgressAtPercentage = (target: Target, pct: number) => {
    // calculate current overall progress
    let overallProgress = 0;
    if (target.targetType === 'numeric') {
      const accomplished = target.accomplishedQuantity || 0;
      const quantity = target.targetQuantity;
      overallProgress = quantity > 0 ? Math.round((accomplished / quantity) * 100) : 0;
    } else {
      const milestones = target.milestones || [];
      if (milestones.length === 0) {
        overallProgress = 0;
      } else {
        const totalWeight = milestones.reduce((sum, m) => sum + m.weight, 0);
        const completedWeight = milestones.filter(m => m.status === 'completed').reduce((sum, m) => sum + m.weight, 0);
        overallProgress = totalWeight > 0 ? Math.round((completedWeight / totalWeight) * 100) : 0;
      }
    }

    // Now, we simulate historical progress along the timeframe.
    // If we're plotting a point in the future (compared to current date relative to target duration),
    // we don't show "actual" data, or we transition it.
    const start = target.startDate ? new Date(target.startDate).getTime() : Date.now() - 30 * 24 * 60 * 60 * 1000;
    const end = target.endDate ? new Date(target.endDate).getTime() : Date.now() + 30 * 24 * 60 * 60 * 1000;
    const totalDuration = end - start;
    const pointTime = start + (totalDuration * pct) / 100;
    const nowTime = Date.now();

    // If point is in the future, return null or cap at current progress if today is past start
    if (pointTime > nowTime) {
      return null;
    }

    // For milestones, we can check which completed milestones are due before pointTime
    if (target.targetType !== 'numeric' && target.milestones && target.milestones.length > 0) {
      const totalWeight = target.milestones.reduce((sum, m) => sum + m.weight, 0);
      let completedBeforePoint = 0;
      
      target.milestones.forEach((m, idx) => {
        // If milestone has dueDate, use it. Otherwise, space them evenly.
        let mDue = start + (totalDuration * (idx + 1)) / (target.milestones.length + 1);
        if (m.dueDate) {
          try {
            mDue = new Date(m.dueDate).getTime();
          } catch {}
        }
        if (m.status === 'completed' && mDue <= pointTime) {
          completedBeforePoint += m.weight;
        }
      });
      return totalWeight > 0 ? Math.round((completedBeforePoint / totalWeight) * 100) : 0;
    }

    // Fallback/Numeric: progress grows gradually over time up to current overallProgress
    const elapsedRatio = Math.min(1, Math.max(0, (pointTime - start) / (nowTime - start || 1)));
    return Math.round(overallProgress * elapsedRatio);
  };

  // Generate chart data based on resolvedPeriodType
  let data: any[] = [];

  if (resolvedPeriodType === 'monthly') {
    // 5 weekly points
    data = [
      { name: 'Week 1', pct: 10 },
      { name: 'Week 2', pct: 30 },
      { name: 'Week 3', pct: 55 },
      { name: 'Week 4', pct: 80 },
      { name: 'Week 5', pct: 100 },
    ];
  } else if (resolvedPeriodType === 'quarterly') {
    // 3 monthly points
    data = [
      { name: 'Month 1', pct: 20 },
      { name: 'Month 2', pct: 60 },
      { name: 'Month 3', pct: 100 },
    ];
  } else if (resolvedPeriodType === 'semiannual') {
    // 6 monthly points
    data = [
      { name: 'Month 1', pct: 15 },
      { name: 'Month 2', pct: 35 },
      { name: 'Month 3', pct: 50 },
      { name: 'Month 4', pct: 70 },
      { name: 'Month 5', pct: 85 },
      { name: 'Month 6', pct: 100 },
    ];
  } else if (resolvedPeriodType === 'annual') {
    // 12 months
    data = [
      { name: 'Jan', pct: 8 },
      { name: 'Feb', pct: 16 },
      { name: 'Mar', pct: 25 },
      { name: 'Apr', pct: 33 },
      { name: 'May', pct: 41 },
      { name: 'Jun', pct: 50 },
      { name: 'Jul', pct: 58 },
      { name: 'Aug', pct: 66 },
      { name: 'Sep', pct: 75 },
      { name: 'Oct', pct: 83 },
      { name: 'Nov', pct: 91 },
      { name: 'Dec', pct: 100 },
    ];
  } else {
    // Custom date range, show 5 check points
    data = [
      { name: 'Start', pct: 0 },
      { name: '25%', pct: 25 },
      { name: '50%', pct: 50 },
      { name: '75%', pct: 75 },
      { name: 'End', pct: 100 },
    ];
  }

  // Calculate Average/Individual Actual and Planned progress for each node
  const timelineData = data.map(node => {
    // Planned progress starts at 0 and goes to 100% lineally
    const Planned = node.pct;

    // Actual progress is average of activeTargets' progress at this percentage node
    let totalActual = 0;
    let validCount = 0;

    activeTargets.forEach(target => {
      const act = getProgressAtPercentage(target, node.pct);
      if (act !== null) {
        totalActual += act;
        validCount++;
      }
    });

    const Actual = validCount > 0 ? Math.round(totalActual / validCount) : null;

    return {
      name: node.name,
      Actual,
      Planned,
    };
  });

  return (
    <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm flex flex-col h-[380px]">
      <div className="flex justify-between items-center mb-5">
        <div>
          <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
            <TrendingUp className="w-5 h-5 text-indigo-500" />
            <span>Performance Timeline</span>
          </h3>
          <p className="text-xs text-slate-500">
            {selectedTargetId !== 'all' ? 'Tracking progress path for selected target' : 'Average progress trajectory of filtered targets'}
          </p>
        </div>
        <div className="text-xs font-semibold px-2.5 py-1 rounded bg-slate-100 text-slate-600 uppercase tracking-wide">
          {resolvedPeriodType}
        </div>
      </div>

      {activeTargets.length === 0 ? (
        <div className="flex-1 flex flex-col items-center justify-center text-center">
          <Award className="w-10 h-10 text-slate-300 mb-2" />
          <span className="text-sm font-medium text-slate-400">No active targets to display on the timeline.</span>
        </div>
      ) : (
        <div className="flex-1 w-full min-h-0">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={timelineData} margin={{ top: 10, right: 15, left: -20, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
              <XAxis 
                dataKey="name" 
                tick={{ fill: '#64748b', fontSize: 11, fontWeight: 500 }}
                axisLine={false}
                tickLine={false}
              />
              <YAxis 
                domain={[0, 100]} 
                tick={{ fill: '#64748b', fontSize: 11, fontWeight: 500 }}
                axisLine={false}
                tickLine={false}
                tickFormatter={(val) => `${val}%`}
              />
              <Tooltip 
                contentStyle={{ backgroundColor: '#0f172a', borderRadius: '8px', border: 'none', color: '#fff' }}
                labelStyle={{ fontWeight: 'bold', color: '#f1f5f9' }}
                itemStyle={{ fontSize: '12px' }}
                formatter={(value: any) => [`${value}%`]}
              />
              <Legend iconType="circle" wrapperStyle={{ fontSize: '12px', fontWeight: 500, color: '#475569' }} />
              <Line 
                type="monotone" 
                dataKey="Actual" 
                stroke="#14b8a6" 
                strokeWidth={3} 
                dot={{ r: 4, strokeWidth: 1, fill: '#14b8a6' }} 
                activeDot={{ r: 6 }} 
                name="Actual Progress"
                connectNulls
              />
              <Line 
                type="monotone" 
                dataKey="Planned" 
                stroke="#cbd5e1" 
                strokeWidth={2} 
                strokeDasharray="5 5"
                dot={false}
                name="Planned Path"
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      )}
    </div>
  );
}
