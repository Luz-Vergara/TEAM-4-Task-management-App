/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { Target, TargetScope, Channel, UserProfile } from '../../types';
import { X } from 'lucide-react';
import { collection, addDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '../../firebase';

interface CreateTargetModalProps {
  isOpen: boolean;
  onClose: () => void;
  workspaceId: string;
  channels: Channel[];
  members: UserProfile[];
  createdBy: string;
  onSuccess?: (message: string) => void;
}

export default function CreateTargetModal({ isOpen, onClose, workspaceId, channels, members, createdBy, onSuccess }: CreateTargetModalProps) {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [targetType, setTargetType] = useState<Target['targetType']>('numeric');
  const [periodType, setPeriodType] = useState<Target['periodType']>('monthly');
  const [targetQuantity, setTargetQuantity] = useState(0);
  
  // Date states
  const now = new Date();
  const [selectedYear, setSelectedYear] = useState(now.getFullYear());
  const [selectedMonth, setSelectedMonth] = useState(now.getMonth() + 1);
  const [selectedQuarter, setSelectedQuarter] = useState(Math.floor(now.getMonth() / 3) + 1);
  const [selectedSemester, setSelectedSemester] = useState(now.getMonth() < 6 ? 1 : 2);
  
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [responsibleMemberId, setResponsibleMemberId] = useState('');
  const [responsibilityType, setResponsibilityType] = useState<'all_members' | 'specific_member'>('all_members');
  const [priority, setPriority] = useState<'low' | 'medium' | 'high'>('medium');

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [formErrors, setFormErrors] = useState<{ [key: string]: string }>({});

  const years = Array.from({ length: 16 }, (_, i) => now.getFullYear() - 5 + i);

  const months = [
    { value: 1, label: 'January' },
    { value: 2, label: 'February' },
    { value: 3, label: 'March' },
    { value: 4, label: 'April' },
    { value: 5, label: 'May' },
    { value: 6, label: 'June' },
    { value: 7, label: 'July' },
    { value: 8, label: 'August' },
    { value: 9, label: 'September' },
    { value: 10, label: 'October' },
    { value: 11, label: 'November' },
    { value: 12, label: 'December' },
  ];

  const quarters = [
    { value: 1, label: 'Q1 — January to March' },
    { value: 2, label: 'Q2 — April to June' },
    { value: 3, label: 'Q3 — July to September' },
    { value: 4, label: 'Q4 — October to December' },
  ];

  const semesters = [
    { value: 1, label: 'First Half — January to June' },
    { value: 2, label: 'Second Half — July to December' },
  ];

  // Helper to update dates in local timezone
  const updateDates = (type: Target['periodType'], year: number, month?: number, quarter?: number, semester?: number) => {
    let start: Date, end: Date;
    switch (type) {
      case 'monthly':
        start = new Date(year, (month || 1) - 1, 1);
        end = new Date(year, (month || 1), 0);
        break;
      case 'quarterly':
        const qStartMonth = ((quarter || 1) - 1) * 3;
        start = new Date(year, qStartMonth, 1);
        end = new Date(year, qStartMonth + 3, 0);
        break;
      case 'semiannual':
        const sStartMonth = ((semester || 1) - 1) * 6;
        start = new Date(year, sStartMonth, 1);
        end = new Date(year, sStartMonth + 6, 0);
        break;
      case 'annual':
        start = new Date(year, 0, 1);
        end = new Date(year, 11, 31);
        break;
      default:
        return; // Custom
    }

    const formatDateLocal = (d: Date) => {
      const yr = d.getFullYear();
      const mo = String(d.getMonth() + 1).padStart(2, '0');
      const dy = String(d.getDate()).padStart(2, '0');
      return `${yr}-${mo}-${dy}`;
    };

    setStartDate(formatDateLocal(start));
    setEndDate(formatDateLocal(end));
  };

  // Update on change
  React.useEffect(() => {
    if (periodType !== 'custom') {
      updateDates(periodType, selectedYear, selectedMonth, selectedQuarter, selectedSemester);
    } else {
      setStartDate('');
      setEndDate('');
    }
  }, [periodType, selectedYear, selectedMonth, selectedQuarter, selectedSemester]);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setFormErrors({});

    // Comprehensive validation
    const errors: { [key: string]: string } = {};
    if (!name.trim()) errors.name = 'Target name is required';
    if (!description.trim()) errors.description = 'Description is required';
    if (!targetType) errors.targetType = 'Target type is required';
    if (!periodType) errors.periodType = 'Reporting period is required';
    if (!startDate) errors.startDate = 'Start date is required';
    if (!endDate) errors.endDate = 'End date is required';
    if (startDate && endDate && new Date(endDate) < new Date(startDate)) {
      errors.endDate = 'End date cannot be earlier than start date';
    }
    if (targetQuantity <= 0) errors.targetQuantity = 'Target value must be greater than 0';
    if (responsibilityType === 'specific_member' && !responsibleMemberId) {
      errors.responsibleMemberId = 'Responsible member is required';
    }
    if (!priority) errors.priority = 'Priority is required';

    if (Object.keys(errors).length > 0) {
      setFormErrors(errors);
      setError('Please resolve all validation errors.');
      return;
    }

    setLoading(true);

    try {
      const targetData: Omit<Target, 'id'> = {
        workspaceId,
        name: name.trim(),
        description: description.trim(),
        targetType,
        periodType,
        startDate,
        endDate,
        targetQuantity,
        responsibilityType,
        responsibleMemberId: responsibilityType === 'specific_member' ? responsibleMemberId : null,
        priority,
        status: 'active',
        milestones: [],
        createdBy,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
        reportingPeriod: periodType,
        selectedMonth: periodType === 'monthly' ? selectedMonth : null,
        selectedQuarter: periodType === 'quarterly' ? selectedQuarter : null,
        selectedSemester: periodType === 'semiannual' ? selectedSemester : null,
        selectedYear,
      };

      await addDoc(collection(db, 'workspaces', workspaceId, 'targets'), targetData);
      
      // Reset form
      setName('');
      setDescription('');
      setTargetQuantity(0);
      setStartDate('');
      setEndDate('');
      setResponsibleMemberId('');
      setResponsibilityType('all_members');
      setPriority('medium');
      setSelectedYear(now.getFullYear());
      setSelectedMonth(now.getMonth() + 1);
      setSelectedQuarter(Math.floor(now.getMonth() / 3) + 1);
      setSelectedSemester(now.getMonth() < 6 ? 1 : 2);
      setFormErrors({});
      setError(null);
      
      if (onSuccess) {
        onSuccess('Target created successfully.');
      }
      onClose();
    } catch (err: any) {
      console.error('Error saving target:', err);
      setError(err?.message || 'Failed to save target. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50 overflow-y-auto">
      <div className="bg-white rounded-xl shadow-lg w-full max-w-lg p-6 my-8">
        <div className="flex justify-between items-center mb-4 pb-2 border-b">
          <h2 className="text-xl font-bold text-slate-800">Create Target</h2>
          <button onClick={onClose} className="p-1 hover:bg-slate-100 rounded-full transition">
            <X className="w-5 h-5 text-slate-500" />
          </button>
        </div>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-slate-500 mb-1">Target Name</label>
            <input
              type="text"
              placeholder="Target Name"
              value={name}
              onChange={e => setName(e.target.value)}
              className="w-full p-2 border rounded text-sm focus:ring-1 focus:ring-slate-950"
              required
            />
            {formErrors.name && <p className="text-red-500 text-xs mt-1">{formErrors.name}</p>}
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-500 mb-1">Description</label>
            <textarea
              placeholder="Description"
              value={description}
              onChange={e => setDescription(e.target.value)}
              className="w-full p-2 border rounded text-sm focus:ring-1 focus:ring-slate-950"
              required
            />
            {formErrors.description && <p className="text-red-500 text-xs mt-1">{formErrors.description}</p>}
          </div>
          
          <div>
            <label className="block text-xs font-semibold text-slate-500 mb-1">Target Type</label>
            <select
              value={targetType}
              onChange={e => setTargetType(e.target.value as any)}
              className="w-full p-2 border rounded text-sm focus:ring-1 focus:ring-slate-950"
            >
              <option value="numeric">Numeric Target</option>
              <option value="deliverable">Deliverable/Milestone Target</option>
            </select>
            {formErrors.targetType && <p className="text-red-500 text-xs mt-1">{formErrors.targetType}</p>}
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-500 mb-1">Reporting Period</label>
            <select
              value={periodType}
              onChange={e => setPeriodType(e.target.value as any)}
              className="w-full p-2 border rounded text-sm focus:ring-1 focus:ring-slate-950 mb-3"
            >
              <option value="monthly">Monthly</option>
              <option value="quarterly">Quarterly</option>
              <option value="semiannual">Semiannual</option>
              <option value="annual">Annual</option>
              <option value="custom">Custom Date Range</option>
            </select>
            {formErrors.periodType && <p className="text-red-500 text-xs mt-1">{formErrors.periodType}</p>}

            {/* Sub-selectors depending on periodType */}
            {periodType === 'monthly' && (
              <div className="grid grid-cols-2 gap-4 mb-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-500 mb-1">Month</label>
                  <select
                    value={selectedMonth}
                    onChange={e => setSelectedMonth(Number(e.target.value))}
                    className="w-full p-2 border rounded text-sm"
                  >
                    {months.map(m => (
                      <option key={m.value} value={m.value}>{m.label}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-500 mb-1">Year</label>
                  <select
                    value={selectedYear}
                    onChange={e => setSelectedYear(Number(e.target.value))}
                    className="w-full p-2 border rounded text-sm"
                  >
                    {years.map(y => (
                      <option key={y} value={y}>{y}</option>
                    ))}
                  </select>
                </div>
              </div>
            )}

            {periodType === 'quarterly' && (
              <div className="grid grid-cols-2 gap-4 mb-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-500 mb-1">Quarter</label>
                  <select
                    value={selectedQuarter}
                    onChange={e => setSelectedQuarter(Number(e.target.value))}
                    className="w-full p-2 border rounded text-sm"
                  >
                    {quarters.map(q => (
                      <option key={q.value} value={q.value}>{q.label}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-500 mb-1">Year</label>
                  <select
                    value={selectedYear}
                    onChange={e => setSelectedYear(Number(e.target.value))}
                    className="w-full p-2 border rounded text-sm"
                  >
                    {years.map(y => (
                      <option key={y} value={y}>{y}</option>
                    ))}
                  </select>
                </div>
              </div>
            )}

            {periodType === 'semiannual' && (
              <div className="grid grid-cols-2 gap-4 mb-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-500 mb-1">Semester</label>
                  <select
                    value={selectedSemester}
                    onChange={e => setSelectedSemester(Number(e.target.value))}
                    className="w-full p-2 border rounded text-sm"
                  >
                    {semesters.map(s => (
                      <option key={s.value} value={s.value}>{s.label}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-500 mb-1">Year</label>
                  <select
                    value={selectedYear}
                    onChange={e => setSelectedYear(Number(e.target.value))}
                    className="w-full p-2 border rounded text-sm"
                  >
                    {years.map(y => (
                      <option key={y} value={y}>{y}</option>
                    ))}
                  </select>
                </div>
              </div>
            )}

            {periodType === 'annual' && (
              <div className="mb-3">
                <label className="block text-xs font-semibold text-slate-500 mb-1">Year</label>
                <select
                  value={selectedYear}
                  onChange={e => setSelectedYear(Number(e.target.value))}
                  className="w-full p-2 border rounded text-sm"
                >
                  {years.map(y => (
                    <option key={y} value={y}>{y}</option>
                  ))}
                </select>
              </div>
            )}
          </div>
          
          <div>
            <div className="flex justify-between items-center mb-1">
              <label className="block text-xs font-semibold text-slate-500">Date Range</label>
              {periodType !== 'custom' && (
                <span className="text-[10px] text-teal-600 font-medium bg-teal-50 px-1.5 py-0.5 rounded border border-teal-200">
                  Auto-Generated
                </span>
              )}
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <span className="text-[10px] text-slate-400 block mb-1">Start Date</span>
                <input
                  type="date"
                  value={startDate}
                  onChange={e => setStartDate(e.target.value)}
                  className={`w-full p-2 border rounded text-sm ${
                    periodType !== 'custom'
                      ? 'bg-slate-50 text-slate-500 cursor-not-allowed'
                      : 'bg-white text-slate-900'
                  }`}
                  required
                  readOnly={periodType !== 'custom'}
                  disabled={periodType !== 'custom'}
                />
                {formErrors.startDate && <p className="text-red-500 text-xs mt-1">{formErrors.startDate}</p>}
              </div>
              <div>
                <span className="text-[10px] text-slate-400 block mb-1">End Date</span>
                <input
                  type="date"
                  value={endDate}
                  onChange={e => setEndDate(e.target.value)}
                  className={`w-full p-2 border rounded text-sm ${
                    periodType !== 'custom'
                      ? 'bg-slate-50 text-slate-500 cursor-not-allowed'
                      : 'bg-white text-slate-900'
                  }`}
                  required
                  readOnly={periodType !== 'custom'}
                  disabled={periodType !== 'custom'}
                />
                {formErrors.endDate && <p className="text-red-500 text-xs mt-1">{formErrors.endDate}</p>}
              </div>
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-500 mb-1">Target Value</label>
            <input
              type="number"
              placeholder="Target Quantity"
              value={targetQuantity || ''}
              onChange={e => setTargetQuantity(Number(e.target.value))}
              className="w-full p-2 border rounded text-sm focus:ring-1 focus:ring-slate-950"
              required
            />
            {formErrors.targetQuantity && <p className="text-red-500 text-xs mt-1">{formErrors.targetQuantity}</p>}
          </div>
          
          <div>
            <label className="block text-xs font-semibold text-slate-500 mb-1">Responsibility</label>
            <select
              value={responsibilityType}
              onChange={e => setResponsibilityType(e.target.value as any)}
              className="w-full p-2 border rounded text-sm focus:ring-1 focus:ring-slate-950"
            >
              <option value="all_members">All Members</option>
              <option value="specific_member">Specific Member</option>
            </select>
          </div>

          {responsibilityType === 'specific_member' && (
            <div>
              <label className="block text-xs font-semibold text-slate-500 mb-1">Responsible Member</label>
              <select
                value={responsibleMemberId}
                onChange={e => setResponsibleMemberId(e.target.value)}
                className="w-full p-2 border rounded text-sm focus:ring-1 focus:ring-slate-950"
              >
                <option value="">Select Responsible Member</option>
                {members.map(m => (
                  <option key={m.uid} value={m.uid}>{m.name}</option>
                ))}
              </select>
              {formErrors.responsibleMemberId && <p className="text-red-500 text-xs mt-1">{formErrors.responsibleMemberId}</p>}
            </div>
          )}

          <div>
            <label className="block text-xs font-semibold text-slate-500 mb-1">Priority</label>
            <select
              value={priority}
              onChange={e => setPriority(e.target.value as any)}
              className="w-full p-2 border rounded text-sm focus:ring-1 focus:ring-slate-950"
            >
              <option value="low">Low Priority</option>
              <option value="medium">Medium Priority</option>
              <option value="high">High Priority</option>
            </select>
            {formErrors.priority && <p className="text-red-500 text-xs mt-1">{formErrors.priority}</p>}
          </div>
          
          {error && <p className="text-red-500 text-sm font-semibold">{error}</p>}
          
          <div className="flex justify-end gap-2 pt-2 border-t">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 border rounded text-sm text-slate-600 hover:bg-slate-50 transition"
              disabled={loading}
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-4 py-2 bg-slate-900 text-white rounded text-sm font-semibold hover:bg-slate-800 disabled:bg-slate-400 transition"
              disabled={loading}
            >
              {loading ? 'Saving...' : 'Save Target'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
