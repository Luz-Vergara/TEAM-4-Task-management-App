import React from 'react';
import { Target } from '../../types';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, Cell } from 'recharts';
import { Award } from 'lucide-react';

interface TargetProgressChartProps {
  targets: Target[];
}

export default function TargetProgressChart({ targets }: TargetProgressChartProps) {
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

  const chartData = targets.map(t => {
    const progress = getProgress(t);
    return {
      id: t.id,
      name: t.name.length > 20 ? t.name.substring(0, 18) + '...' : t.name,
      fullName: t.name,
      Progress: progress,
      type: t.targetType,
      period: t.periodType,
    };
  });

  const getBarColor = (progress: number) => {
    if (progress >= 80) return '#10b981'; // Emerald
    if (progress >= 50) return '#14b8a6'; // Teal
    if (progress >= 25) return '#f59e0b'; // Amber
    return '#f43f5e'; // Rose
  };

  const CustomTooltip = ({ active, payload }: any) => {
    if (active && payload && payload.length) {
      const data = payload[0].payload;
      return (
        <div className="bg-slate-900 text-white p-3.5 rounded-lg border border-slate-800 shadow-xl text-xs space-y-1.5 max-w-xs font-sans">
          <p className="font-bold text-slate-100">{data.fullName}</p>
          <div className="h-px bg-slate-800 my-1.5" />
          <p className="text-slate-300"><span className="font-medium text-slate-400">Type:</span> <span className="capitalize font-semibold text-white">{data.type}</span></p>
          <p className="text-slate-300"><span className="font-medium text-slate-400">Period:</span> <span className="capitalize font-semibold text-white">{data.period}</span></p>
          <p className="text-slate-200"><span className="font-medium text-slate-400">Progress:</span> <span className="font-bold text-teal-400 text-sm">{data.Progress}%</span></p>
        </div>
      );
    }
    return null;
  };

  return (
    <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm flex flex-col h-[380px]">
      <div className="flex justify-between items-center mb-5">
        <div>
          <h3 className="text-base font-bold text-slate-900">Target Progress</h3>
          <p className="text-xs text-slate-500">Overview of completion percentages for current targets</p>
        </div>
      </div>

      {chartData.length === 0 ? (
        <div className="flex-1 flex flex-col items-center justify-center text-center">
          <Award className="w-10 h-10 text-slate-300 mb-2" />
          <span className="text-sm font-medium text-slate-400">No data to display. Please create or update targets.</span>
        </div>
      ) : (
        <div className="flex-1 w-full min-h-0">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={chartData} margin={{ top: 10, right: 10, left: -20, bottom: 5 }}>
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
              <Tooltip content={<CustomTooltip />} cursor={{ fill: '#f8fafc' }} />
              <Bar dataKey="Progress" radius={[4, 4, 0, 0]} maxBarSize={45}>
                {chartData.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={getBarColor(entry.Progress)} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}
    </div>
  );
}
