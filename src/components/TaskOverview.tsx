/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { Task, UserProfile, Channel, TaskStatus, TaskPriority, UserRole } from '../types';
import { 
  Search, 
  Filter, 
  Calendar, 
  User, 
  Hash, 
  ChevronRight, 
  LayoutGrid, 
  List, 
  SlidersHorizontal,
  CheckCircle2,
  Clock,
  Briefcase,
  AlertTriangle,
  Flame,
  UserPlus,
  RefreshCw,
  FolderKanban
} from 'lucide-react';
import { formatDate, formatRelativeTime } from '../utils';

interface TaskOverviewProps {
  userProfile: UserProfile;
  tasks: Task[];
  members: UserProfile[];
  channels: Channel[];
  onSelectTask: (task: Task) => void;
}

export default function TaskOverview({
  userProfile,
  tasks,
  members,
  channels,
  onSelectTask
}: TaskOverviewProps) {
  // View states
  const [viewType, setViewType] = useState<'board' | 'list'>('board');
  
  // Filter states
  const [searchTerm, setSearchTerm] = useState('');
  const [channelFilter, setChannelFilter] = useState<string>('all');
  const [assigneeFilter, setAssigneeFilter] = useState<string>('all');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [priorityFilter, setPriorityFilter] = useState<string>('all');
  const [dueDateFilter, setDueDateFilter] = useState<string>('all');

  const todayStr = new Date().toISOString().split('T')[0];

  // Helper: check if date is in this week
  const isThisWeek = (dateStr: string) => {
    if (!dateStr) return false;
    const taskDate = new Date(dateStr);
    const today = new Date();
    // Get start and end of current week
    const first = today.getDate() - today.getDay();
    const last = first + 6;
    const firstDay = new Date(today.setDate(first));
    const lastDay = new Date(today.setDate(last));
    
    firstDay.setHours(0, 0, 0, 0);
    lastDay.setHours(23, 59, 59, 999);
    
    return taskDate >= firstDay && taskDate <= lastDay;
  };

  // Filter logic
  const filteredTasks = tasks.filter((task) => {
    // Search filter
    const matchesSearch = 
      task.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
      task.description.toLowerCase().includes(searchTerm.toLowerCase());
    
    // Channel filter
    const matchesChannel = channelFilter === 'all' || task.channelId === channelFilter;
    
    // Assignee filter
    let matchesAssignee = true;
    if (assigneeFilter === 'me') {
      matchesAssignee = task.assignedUserId === userProfile.uid || task.assignedUserIds?.includes(userProfile.uid);
    } else if (assigneeFilter !== 'all') {
      matchesAssignee = task.assignedUserId === assigneeFilter || task.assignedUserIds?.includes(assigneeFilter);
    }

    // Status filter
    const matchesStatus = statusFilter === 'all' || task.status === statusFilter;

    // Priority filter
    const matchesPriority = priorityFilter === 'all' || task.priority === priorityFilter;

    // Due Date filter
    let matchesDueDate = true;
    if (dueDateFilter === 'overdue') {
      matchesDueDate = task.status !== TaskStatus.COMPLETED && !!task.dueDate && task.dueDate < todayStr;
    } else if (dueDateFilter === 'today') {
      matchesDueDate = task.dueDate === todayStr;
    } else if (dueDateFilter === 'this-week') {
      matchesDueDate = isThisWeek(task.dueDate);
    } else if (dueDateFilter === 'has-due-date') {
      matchesDueDate = !!task.dueDate;
    } else if (dueDateFilter === 'no-due-date') {
      matchesDueDate = !task.dueDate;
    }

    return matchesSearch && matchesChannel && matchesAssignee && matchesStatus && matchesPriority && matchesDueDate;
  });

  // Utility to find channel name
  const getChannelName = (chanId: string) => {
    const ch = channels.find((c) => c.id === chanId);
    return ch ? ch.name : chanId;
  };

  // Utility to find member name
  const getMemberName = (uid: string) => {
    const m = members.find((u) => u.uid === uid);
    return m ? m.name : 'Unassigned';
  };

  // Reset all filters helper
  const handleResetFilters = () => {
    setSearchTerm('');
    setChannelFilter('all');
    setAssigneeFilter('all');
    setStatusFilter('all');
    setPriorityFilter('all');
    setDueDateFilter('all');
  };

  // Color classes for Priority
  const getPriorityClasses = (priority: TaskPriority) => {
    switch (priority) {
      case TaskPriority.HIGH:
        return 'bg-rose-50 border border-rose-100 text-rose-600';
      case TaskPriority.MEDIUM:
        return 'bg-amber-50 border border-amber-100 text-amber-600';
      case TaskPriority.LOW:
        default:
        return 'bg-slate-50 border border-slate-100 text-slate-600';
    }
  };

  // Render a single task card
  const renderTaskCard = (task: Task) => {
    const isOverdue = task.status !== TaskStatus.COMPLETED && task.dueDate && task.dueDate < todayStr;
    const assignees = task.assignedUserIds && task.assignedUserIds.length > 0 
      ? task.assignedUserIds 
      : task.assignedUserId 
        ? [task.assignedUserId] 
        : [];

    return (
      <div 
        key={task.id}
        onClick={() => onSelectTask(task)}
        className="bg-white border border-slate-200 rounded-xl p-4 shadow-sm hover:shadow-md hover:border-teal-400 cursor-pointer transition flex flex-col space-y-3 relative group"
      >
        <div className="flex items-start justify-between gap-2">
          {/* Channel Tag */}
          <span className="inline-flex items-center space-x-1 text-[10px] font-semibold text-slate-500 bg-slate-50 border border-slate-200/80 px-2 py-0.5 rounded-full">
            <Hash className="w-2.5 h-2.5 shrink-0 text-slate-400" />
            <span className="truncate max-w-[120px]">{getChannelName(task.channelId)}</span>
          </span>

          {/* Priority Badge */}
          <span className={`text-[9px] font-extrabold uppercase tracking-wider px-1.5 py-0.5 rounded ${getPriorityClasses(task.priority)}`}>
            {task.priority}
          </span>
        </div>

        {/* Title & Description */}
        <div className="space-y-1">
          <h4 className="text-sm font-bold text-slate-800 line-clamp-2 group-hover:text-teal-600 transition">
            {task.title}
          </h4>
          {task.description && (
            <p className="text-xs text-slate-500 line-clamp-2 leading-relaxed">
              {task.description}
            </p>
          )}
        </div>

        {/* Bottom Details Row */}
        <div className="pt-2.5 border-t border-slate-100 flex items-center justify-between gap-2 mt-auto">
          {/* Due Date Indicator */}
          <div className="flex items-center space-x-1.5">
            <Calendar className={`w-3.5 h-3.5 ${isOverdue ? 'text-rose-500' : 'text-slate-400'}`} />
            <span className={`text-xs font-medium font-mono ${isOverdue ? 'text-rose-600 font-bold' : 'text-slate-500'}`}>
              {task.dueDate ? formatDate(task.dueDate) : 'No due date'}
            </span>
          </div>

          {/* Assignee Information */}
          <div className="flex items-center space-x-1 text-slate-600 text-xs font-semibold max-w-[120px] truncate">
            <User className="w-3.5 h-3.5 text-slate-400 shrink-0" />
            <span className="truncate">
              {assignees.length > 0 
                ? assignees.map(uid => getMemberName(uid).split(' ')[0]).join(', ')
                : 'Unassigned'
              }
            </span>
          </div>
        </div>
      </div>
    );
  };

  // Group tasks for Board View
  const boardColumns = [
    { id: TaskStatus.TODO, title: 'To Do', color: 'border-slate-300', bg: 'bg-slate-50/50', text: 'text-slate-700', badgeBg: 'bg-slate-200/80 text-slate-700' },
    { id: TaskStatus.IN_PROGRESS, title: 'In Progress', color: 'border-blue-400', bg: 'bg-blue-50/10', text: 'text-blue-800', badgeBg: 'bg-blue-100 text-blue-800' },
    { id: TaskStatus.REVIEW, title: 'For Review', color: 'border-purple-400', bg: 'bg-purple-50/10', text: 'text-purple-800', badgeBg: 'bg-purple-100 text-purple-800' },
    { id: TaskStatus.COMPLETED, title: 'Done', color: 'border-teal-500', bg: 'bg-teal-50/10', text: 'text-teal-800', badgeBg: 'bg-teal-100 text-teal-800' }
  ];

  return (
    <div className="flex-1 bg-slate-50 min-h-screen overflow-y-auto">
      {/* Header Panel */}
      <div className="bg-white border-b border-slate-200 py-6 px-8 shadow-sm">
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div>
            <div className="flex items-center space-x-2">
              <FolderKanban className="w-5 h-5 text-teal-500" />
              <span className="text-xs font-extrabold uppercase tracking-widest text-teal-600">Unified Management</span>
            </div>
            <h1 className="text-2xl font-black text-slate-900 tracking-tight mt-1">
              Task Overview Dashboard
            </h1>
            <p className="text-sm text-slate-500 mt-0.5">
              Consolidated real-time tasks from all channels in your workspace.
            </p>
          </div>

          {/* View Toggles */}
          <div className="flex items-center space-x-2 self-start md:self-center">
            <button
              onClick={() => setViewType('board')}
              className={`p-2 rounded-lg border transition flex items-center space-x-1.5 text-xs font-bold ${
                viewType === 'board'
                  ? 'bg-teal-500 text-white border-teal-500 shadow-sm'
                  : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'
              }`}
            >
              <LayoutGrid className="w-4 h-4" />
              <span>Kanban Board</span>
            </button>
            <button
              onClick={() => setViewType('list')}
              className={`p-2 rounded-lg border transition flex items-center space-x-1.5 text-xs font-bold ${
                viewType === 'list'
                  ? 'bg-teal-500 text-white border-teal-500 shadow-sm'
                  : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'
              }`}
            >
              <List className="w-4 h-4" />
              <span>Interactive List</span>
            </button>
          </div>
        </div>
      </div>

      {/* Filter and Control Bar */}
      <div className="bg-white border-b border-slate-200 py-4 px-8 sticky top-0 z-10 shadow-sm">
        <div className="max-w-7xl mx-auto space-y-4">
          <div className="flex flex-col lg:flex-row gap-4 items-stretch lg:items-center">
            {/* Search Input */}
            <div className="relative flex-1">
              <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                placeholder="Search tasks by title, details..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-10 pr-4 py-2 border border-slate-200 rounded-xl text-sm text-slate-800 placeholder:text-slate-400 focus:outline-none focus:border-teal-500 focus:ring-1 focus:ring-teal-500"
              />
            </div>

            {/* Filter Toggle Headers */}
            <div className="flex flex-wrap gap-2.5 items-center">
              {/* Channel Filter */}
              <div className="flex items-center space-x-1.5">
                <span className="text-xs font-bold text-slate-500 uppercase tracking-wider shrink-0">Channel:</span>
                <select
                  value={channelFilter}
                  onChange={(e) => setChannelFilter(e.target.value)}
                  className="bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-1.5 text-xs text-slate-700 font-semibold focus:outline-none focus:border-teal-500"
                >
                  <option value="all">All Channels</option>
                  {channels.map((ch) => (
                    <option key={ch.id} value={ch.id}>#{ch.name}</option>
                  ))}
                </select>
              </div>

              {/* Assignee Filter */}
              <div className="flex items-center space-x-1.5">
                <span className="text-xs font-bold text-slate-500 uppercase tracking-wider shrink-0">Assignee:</span>
                <select
                  value={assigneeFilter}
                  onChange={(e) => setAssigneeFilter(e.target.value)}
                  className="bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-1.5 text-xs text-slate-700 font-semibold focus:outline-none focus:border-teal-500"
                >
                  <option value="all">All Members</option>
                  <option value="me">Assigned to Me</option>
                  {members.map((m) => (
                    <option key={m.uid} value={m.uid}>{m.name}</option>
                  ))}
                </select>
              </div>

              {/* Status Filter (especially useful in List view) */}
              <div className="flex items-center space-x-1.5">
                <span className="text-xs font-bold text-slate-500 uppercase tracking-wider shrink-0">Status:</span>
                <select
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value)}
                  className="bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-1.5 text-xs text-slate-700 font-semibold focus:outline-none focus:border-teal-500"
                >
                  <option value="all">All Statuses</option>
                  <option value={TaskStatus.TODO}>To Do</option>
                  <option value={TaskStatus.IN_PROGRESS}>In Progress</option>
                  <option value={TaskStatus.REVIEW}>For Review</option>
                  <option value={TaskStatus.COMPLETED}>Done</option>
                </select>
              </div>

              {/* Priority Filter */}
              <div className="flex items-center space-x-1.5">
                <span className="text-xs font-bold text-slate-500 uppercase tracking-wider shrink-0">Priority:</span>
                <select
                  value={priorityFilter}
                  onChange={(e) => setPriorityFilter(e.target.value)}
                  className="bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-1.5 text-xs text-slate-700 font-semibold focus:outline-none focus:border-teal-500"
                >
                  <option value="all">All Priorities</option>
                  <option value={TaskPriority.HIGH}>High</option>
                  <option value={TaskPriority.MEDIUM}>Medium</option>
                  <option value={TaskPriority.LOW}>Low</option>
                </select>
              </div>

              {/* Due Date Filter */}
              <div className="flex items-center space-x-1.5">
                <span className="text-xs font-bold text-slate-500 uppercase tracking-wider shrink-0">Due Date:</span>
                <select
                  value={dueDateFilter}
                  onChange={(e) => setDueDateFilter(e.target.value)}
                  className="bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-1.5 text-xs text-slate-700 font-semibold focus:outline-none focus:border-teal-500"
                >
                  <option value="all">Any Date</option>
                  <option value="overdue">Overdue Tasks</option>
                  <option value="today">Due Today</option>
                  <option value="this-week">Due This Week</option>
                  <option value="has-due-date">Has Due Date</option>
                  <option value="no-due-date">No Due Date</option>
                </select>
              </div>

              {/* Clear filters button if any filter is active */}
              {(searchTerm || channelFilter !== 'all' || assigneeFilter !== 'all' || statusFilter !== 'all' || priorityFilter !== 'all' || dueDateFilter !== 'all') && (
                <button
                  onClick={handleResetFilters}
                  className="text-xs font-bold text-rose-500 hover:text-rose-600 transition flex items-center space-x-1 px-2.5 py-1.5 hover:bg-rose-50 rounded-lg"
                >
                  <RefreshCw className="w-3.5 h-3.5" />
                  <span>Reset Filters</span>
                </button>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Main Board/List Content */}
      <div className="max-w-7xl mx-auto py-8 px-8">
        {viewType === 'board' ? (
          /* Kanban Board View */
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 items-start">
            {boardColumns.map((col) => {
              // Get tasks that belong to this column
              const columnTasks = filteredTasks.filter((t) => t.status === col.id);

              return (
                <div 
                  key={col.id}
                  className={`flex flex-col rounded-2xl border ${col.color} ${col.bg} overflow-hidden shadow-sm`}
                >
                  {/* Column Header */}
                  <div className="p-4 flex items-center justify-between border-b border-slate-200 bg-white">
                    <div className="flex items-center space-x-2">
                      <span className={`w-2 h-2 rounded-full ${
                        col.id === TaskStatus.TODO ? 'bg-slate-400' :
                        col.id === TaskStatus.IN_PROGRESS ? 'bg-blue-500' :
                        col.id === TaskStatus.REVIEW ? 'bg-purple-500' : 'bg-teal-500'
                      }`} />
                      <h3 className={`font-black text-sm tracking-tight ${col.text}`}>
                        {col.title}
                      </h3>
                    </div>
                    <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${col.badgeBg}`}>
                      {columnTasks.length}
                    </span>
                  </div>

                  {/* Columns Tasks List */}
                  <div className="p-4 space-y-4 max-h-[calc(100vh-280px)] overflow-y-auto">
                    {columnTasks.length > 0 ? (
                      columnTasks.map(renderTaskCard)
                    ) : (
                      <div className="py-12 px-4 border-2 border-dashed border-slate-200 rounded-xl flex flex-col items-center justify-center text-center">
                        <Clock className="w-8 h-8 text-slate-300 stroke-[1.5] mb-2" />
                        <p className="text-xs font-bold text-slate-400">No tasks</p>
                        <p className="text-[10px] text-slate-400 mt-0.5 max-w-[120px]">
                          Match filters or move tasks to this status.
                        </p>
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          /* Interactive List / Table View */
          <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-sm">
            {filteredTasks.length > 0 ? (
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="border-b border-slate-200 bg-slate-50/70 text-[10px] font-black uppercase tracking-widest text-slate-500">
                      <th className="py-4 px-6">Task Title</th>
                      <th className="py-4 px-6">Project Channel</th>
                      <th className="py-4 px-6">Assignee</th>
                      <th className="py-4 px-6">Due Date</th>
                      <th className="py-4 px-6">Priority</th>
                      <th className="py-4 px-6">Status</th>
                      <th className="py-4 px-6 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 text-xs text-slate-600">
                    {filteredTasks.map((task) => {
                      const isOverdue = task.status !== TaskStatus.COMPLETED && task.dueDate && task.dueDate < todayStr;
                      const assignees = task.assignedUserIds && task.assignedUserIds.length > 0 
                        ? task.assignedUserIds 
                        : task.assignedUserId 
                          ? [task.assignedUserId] 
                          : [];

                      return (
                        <tr 
                          key={task.id}
                          className="hover:bg-slate-50/50 transition cursor-pointer"
                          onClick={() => onSelectTask(task)}
                        >
                          {/* Title */}
                          <td className="py-4 px-6 font-semibold text-slate-800">
                            <div className="space-y-0.5 max-w-sm">
                              <p className="font-bold text-slate-900 truncate" title={task.title}>{task.title}</p>
                              {task.description && (
                                <p className="text-[10px] text-slate-450 truncate" title={task.description}>
                                  {task.description}
                                </p>
                              )}
                            </div>
                          </td>

                          {/* Channel */}
                          <td className="py-4 px-6">
                            <span className="inline-flex items-center space-x-1 text-[11px] font-bold text-slate-600">
                              <Hash className="w-3 h-3 text-slate-400 shrink-0" />
                              <span>{getChannelName(task.channelId)}</span>
                            </span>
                          </td>

                          {/* Assignee */}
                          <td className="py-4 px-6">
                            <div className="flex items-center space-x-1.5">
                              <User className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                              <span className="font-medium">
                                {assignees.length > 0 
                                  ? assignees.map(uid => getMemberName(uid)).join(', ')
                                  : 'Unassigned'
                                }
                              </span>
                            </div>
                          </td>

                          {/* Due Date */}
                          <td className="py-4 px-6">
                            <div className="flex items-center space-x-1.5">
                              <Calendar className={`w-3.5 h-3.5 ${isOverdue ? 'text-rose-500' : 'text-slate-400'}`} />
                              <span className={`font-mono font-medium ${isOverdue ? 'text-rose-600 font-bold' : 'text-slate-500'}`}>
                                {task.dueDate ? formatDate(task.dueDate) : 'No due date'}
                              </span>
                              {isOverdue && (
                                <span className="bg-rose-50 text-rose-600 text-[8px] font-black uppercase px-1 rounded tracking-wider border border-rose-100">
                                  Overdue
                                </span>
                              )}
                            </div>
                          </td>

                          {/* Priority */}
                          <td className="py-4 px-6">
                            <span className={`text-[9px] font-extrabold uppercase tracking-wider px-2 py-0.5 rounded-full inline-block ${getPriorityClasses(task.priority)}`}>
                              {task.priority}
                            </span>
                          </td>

                          {/* Status */}
                          <td className="py-4 px-6">
                            <span className={`inline-flex items-center space-x-1 px-2.5 py-1 rounded-full text-[10px] font-extrabold uppercase tracking-wider ${
                              task.status === TaskStatus.COMPLETED ? 'bg-teal-50 text-teal-700 border border-teal-100' :
                              task.status === TaskStatus.REVIEW ? 'bg-purple-50 text-purple-700 border border-purple-100' :
                              task.status === TaskStatus.IN_PROGRESS ? 'bg-blue-50 text-blue-700 border border-blue-100' :
                              'bg-slate-100 text-slate-700 border border-slate-200'
                            }`}>
                              <span className={`w-1.5 h-1.5 rounded-full mr-1 ${
                                task.status === TaskStatus.COMPLETED ? 'bg-teal-500' :
                                task.status === TaskStatus.REVIEW ? 'bg-purple-500' :
                                task.status === TaskStatus.IN_PROGRESS ? 'bg-blue-500' : 'bg-slate-400'
                              }`} />
                              {task.status === TaskStatus.IN_PROGRESS ? 'In Progress' :
                               task.status === TaskStatus.REVIEW ? 'For Review' :
                               task.status === TaskStatus.COMPLETED ? 'Done' : 'To Do'}
                            </span>
                          </td>

                          {/* Actions */}
                          <td className="py-4 px-6 text-right" onClick={(e) => { e.stopPropagation(); onSelectTask(task); }}>
                            <button className="text-teal-600 hover:text-teal-700 font-extrabold inline-flex items-center space-x-1 hover:underline">
                              <span>Details</span>
                              <ChevronRight className="w-3.5 h-3.5" />
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="py-24 px-4 flex flex-col items-center justify-center text-center">
                <SlidersHorizontal className="w-12 h-12 text-slate-300 stroke-[1.5] mb-3" />
                <h3 className="text-sm font-bold text-slate-700">No matching tasks found</h3>
                <p className="text-xs text-slate-400 mt-1 max-w-xs">
                  We couldn't find any tasks that matched your filters or search term. Try resetting your active filters.
                </p>
                <button
                  onClick={handleResetFilters}
                  className="mt-4 px-4 py-2 bg-teal-500 hover:bg-teal-600 text-white text-xs font-bold rounded-xl shadow transition"
                >
                  Reset All Filters
                </button>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
