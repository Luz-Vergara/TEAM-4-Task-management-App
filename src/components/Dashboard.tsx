/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { Task, UserProfile, Channel, TaskStatus, TaskPriority, ActivityLog } from '../types';
import { 
  CheckCircle2, 
  Clock, 
  AlertCircle, 
  User, 
  Layers, 
  Search, 
  SlidersHorizontal, 
  TrendingUp, 
  Calendar, 
  CalendarDays,
  Hash,
  ChevronRight
} from 'lucide-react';
import { formatDate, formatRelativeTime } from '../utils';

interface DashboardProps {
  userProfile: UserProfile;
  tasks: Task[];
  members: UserProfile[];
  channels: Channel[];
  logs: ActivityLog[];
  onSelectTask: (task: Task) => void;
}

export default function Dashboard({
  userProfile,
  tasks,
  members,
  channels,
  logs,
  onSelectTask
}: DashboardProps) {
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [priorityFilter, setPriorityFilter] = useState<string>('all');
  const [assigneeFilter, setAssigneeFilter] = useState<string>('all');
  const [channelFilter, setChannelFilter] = useState<string>('all');

  const todayStr = new Date().toISOString().split('T')[0];

  // Calculations
  const totalTasksCount = tasks.length;
  const completedTasksCount = tasks.filter((t) => t.status === TaskStatus.COMPLETED).length;
  const pendingTasksCount = totalTasksCount - completedTasksCount;
  
  const overdueTasks = tasks.filter((t) => {
    return t.status !== TaskStatus.COMPLETED && t.dueDate && t.dueDate < todayStr;
  });
  const overdueCount = overdueTasks.length;

  const myTasksCount = tasks.filter((t) => t.assignedUserId === userProfile.uid).length;

  // Task lists breakdown
  const todoCount = tasks.filter((t) => t.status === TaskStatus.TODO).length;
  const inProgressCount = tasks.filter((t) => t.status === TaskStatus.IN_PROGRESS).length;
  const reviewCount = tasks.filter((t) => t.status === TaskStatus.REVIEW).length;

  const lowPriorityCount = tasks.filter((t) => t.priority === TaskPriority.LOW).length;
  const mediumPriorityCount = tasks.filter((t) => t.priority === TaskPriority.MEDIUM).length;
  const highPriorityCount = tasks.filter((t) => t.priority === TaskPriority.HIGH).length;

  // Filter tasks
  const filteredTasks = tasks.filter((task) => {
    const matchesSearch = 
      task.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
      task.description.toLowerCase().includes(searchTerm.toLowerCase());
    
    const matchesStatus = statusFilter === 'all' || task.status === statusFilter;
    const matchesPriority = priorityFilter === 'all' || task.priority === priorityFilter;
    
    let matchesAssignee = true;
    if (assigneeFilter === 'me') {
      matchesAssignee = task.assignedUserId === userProfile.uid;
    } else if (assigneeFilter !== 'all') {
      matchesAssignee = task.assignedUserId === assigneeFilter;
    }

    const matchesChannel = channelFilter === 'all' || task.channelId === channelFilter;

    return matchesSearch && matchesStatus && matchesPriority && matchesAssignee && matchesChannel;
  });

  const getPriorityBadgeColor = (p: TaskPriority) => {
    switch (p) {
      case TaskPriority.HIGH:
        return 'bg-rose-50 text-rose-600 border-rose-100';
      case TaskPriority.MEDIUM:
        return 'bg-amber-50 text-amber-600 border-amber-100';
      default:
        return 'bg-slate-100 text-slate-600 border-slate-200';
    }
  };

  const getStatusBadgeColor = (s: TaskStatus) => {
    switch (s) {
      case TaskStatus.COMPLETED:
        return 'bg-emerald-50 text-emerald-600 border-emerald-100';
      case TaskStatus.REVIEW:
        return 'bg-purple-50 text-purple-600 border-purple-100';
      case TaskStatus.IN_PROGRESS:
        return 'bg-amber-50 text-amber-600 border-amber-100';
      default:
        return 'bg-blue-50 text-blue-600 border-blue-100';
    }
  };

  const getMemberName = (uid: string) => {
    const m = members.find((user) => user.uid === uid);
    return m ? m.name : 'Unassigned';
  };

  const getChannelName = (id: string) => {
    const ch = channels.find((c) => c.id === id);
    return ch ? ch.name : 'General';
  };

  // Custom visual calculation for percentage progress
  const completionPercentage = totalTasksCount > 0 ? Math.round((completedTasksCount / totalTasksCount) * 100) : 0;

  return (
    <div className="flex-1 overflow-y-auto p-4 md:p-8 space-y-8 bg-slate-50 text-slate-900 font-sans">
      {/* Header section */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-200 pb-5">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight flex items-center gap-2">
            <Layers className="w-6 h-6 text-teal-500" />
            <span>Workspace Dashboard</span>
          </h1>
          <p className="text-sm text-slate-500 mt-1">
            Welcome back, <strong className="text-slate-800 font-medium">{userProfile.name}</strong>. Here is the active project health summary.
          </p>
        </div>
        <div className="flex items-center space-x-2 bg-white px-3 py-1.5 rounded-lg border border-slate-200 text-xs text-slate-600 shadow-sm">
          <CalendarDays className="w-4 h-4 text-teal-500" />
          <span>Today is {formatDate(todayStr)}</span>
        </div>
      </div>

      {/* KPI Cards Grid */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
        {/* Total Tasks */}
        <div className="bg-white p-5 rounded-xl border border-slate-200 flex flex-col justify-between shadow-sm">
          <div className="flex items-center justify-between text-slate-400">
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Total Tasks</span>
            <Layers className="w-4 h-4 text-teal-500" />
          </div>
          <div className="mt-4">
            <span className="text-3xl font-extrabold text-slate-900">{totalTasksCount}</span>
            <span className="text-xs text-slate-400 block mt-1">across all channels</span>
          </div>
        </div>

        {/* Completed Tasks */}
        <div className="bg-white p-5 rounded-xl border border-slate-200 flex flex-col justify-between shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-bold text-emerald-500 uppercase tracking-wider">Completed</span>
            <CheckCircle2 className="w-4 h-4 text-emerald-500" />
          </div>
          <div className="mt-4">
            <span className="text-3xl font-extrabold text-slate-900">{completedTasksCount}</span>
            <span className="text-xs text-emerald-500 font-medium block mt-1">
              {completionPercentage}% complete rate
            </span>
          </div>
        </div>

        {/* Pending Tasks */}
        <div className="bg-white p-5 rounded-xl border border-slate-200 flex flex-col justify-between shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-bold text-amber-500 uppercase tracking-wider">Pending</span>
            <Clock className="w-4 h-4 text-amber-500" />
          </div>
          <div className="mt-4">
            <span className="text-3xl font-extrabold text-slate-900">{pendingTasksCount}</span>
            <span className="text-xs text-slate-400 block mt-1">awaiting resolution</span>
          </div>
        </div>

        {/* Overdue Tasks */}
        <div className={`p-5 rounded-xl border flex flex-col justify-between transition shadow-sm bg-white ${
          overdueCount > 0 
            ? 'border-rose-200 bg-rose-50/20' 
            : 'border-slate-200'
        }`}>
          <div className="flex items-center justify-between">
            <span className={`text-[10px] font-bold uppercase tracking-wider ${overdueCount > 0 ? 'text-rose-500' : 'text-slate-400'}`}>Overdue</span>
            <AlertCircle className={`w-4 h-4 ${overdueCount > 0 ? 'text-rose-500' : 'text-slate-400'}`} />
          </div>
          <div className="mt-4">
            <span className={`text-3xl font-extrabold ${overdueCount > 0 ? 'text-rose-600' : 'text-slate-900'}`}>
              {overdueCount}
            </span>
            <span className={`text-xs block mt-1 ${overdueCount > 0 ? 'text-rose-500/85' : 'text-slate-400'}`}>
              requires urgent focus
            </span>
          </div>
        </div>

        {/* My Tasks */}
        <div className="bg-white p-5 rounded-xl border border-slate-200 flex flex-col justify-between col-span-2 lg:col-span-1 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-bold text-teal-500 uppercase tracking-wider font-semibold">My Tasks</span>
            <User className="w-4 h-4 text-teal-500" />
          </div>
          <div className="mt-4">
            <span className="text-3xl font-extrabold text-slate-900">{myTasksCount}</span>
            <span className="text-xs text-slate-400 block mt-1">assigned to you</span>
          </div>
        </div>
      </div>

      {/* Charts & Distributions */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Status Breakdown Bar chart (Custom SVG styled bar) */}
        <div className="bg-white p-6 rounded-xl border border-slate-200 space-y-4 shadow-sm text-slate-900">
          <h3 className="text-xs font-bold uppercase text-slate-500 tracking-wider">Status Breakdown</h3>
          <div className="space-y-3 pt-2">
            <div>
              <div className="flex justify-between text-xs text-slate-500 mb-1">
                <span>To Do</span>
                <span className="font-semibold text-slate-700">{todoCount}</span>
              </div>
              <div className="w-full bg-slate-100 h-2 rounded-full overflow-hidden">
                <div 
                  className="bg-blue-500 h-full rounded-full transition-all duration-500" 
                  style={{ width: `${totalTasksCount > 0 ? (todoCount / totalTasksCount) * 100 : 0}%` }}
                />
              </div>
            </div>

            <div>
              <div className="flex justify-between text-xs text-slate-500 mb-1">
                <span>In Progress</span>
                <span className="font-semibold text-amber-500">{inProgressCount}</span>
              </div>
              <div className="w-full bg-slate-100 h-2 rounded-full overflow-hidden">
                <div 
                  className="bg-amber-500 h-full rounded-full transition-all duration-500" 
                  style={{ width: `${totalTasksCount > 0 ? (inProgressCount / totalTasksCount) * 100 : 0}%` }}
                />
              </div>
            </div>

            <div>
              <div className="flex justify-between text-xs text-slate-500 mb-1">
                <span>For Review</span>
                <span className="font-semibold text-purple-500">{reviewCount}</span>
              </div>
              <div className="w-full bg-slate-100 h-2 rounded-full overflow-hidden">
                <div 
                  className="bg-purple-500 h-full rounded-full transition-all duration-500" 
                  style={{ width: `${totalTasksCount > 0 ? (reviewCount / totalTasksCount) * 100 : 0}%` }}
                />
              </div>
            </div>

            <div>
              <div className="flex justify-between text-xs text-slate-500 mb-1">
                <span>Completed</span>
                <span className="font-semibold text-emerald-500">{completedTasksCount}</span>
              </div>
              <div className="w-full bg-slate-100 h-2 rounded-full overflow-hidden">
                <div 
                  className="bg-emerald-500 h-full rounded-full transition-all duration-500" 
                  style={{ width: `${totalTasksCount > 0 ? (completedTasksCount / totalTasksCount) * 100 : 0}%` }}
                />
              </div>
            </div>
          </div>
        </div>

        {/* Priority distribution circles / bars */}
        <div className="bg-white p-6 rounded-xl border border-slate-200 space-y-4 shadow-sm text-slate-900">
          <h3 className="text-xs font-bold uppercase text-slate-500 tracking-wider">Priority Breakdown</h3>
          <div className="space-y-3 pt-2">
            <div>
              <div className="flex justify-between text-xs text-slate-500 mb-1">
                <span>High Priority</span>
                <span className="font-semibold text-rose-500">{highPriorityCount}</span>
              </div>
              <div className="w-full bg-slate-100 h-2 rounded-full overflow-hidden">
                <div 
                  className="bg-rose-500 h-full rounded-full transition-all duration-500" 
                  style={{ width: `${totalTasksCount > 0 ? (highPriorityCount / totalTasksCount) * 100 : 0}%` }}
                />
              </div>
            </div>

            <div>
              <div className="flex justify-between text-xs text-slate-500 mb-1">
                <span>Medium Priority</span>
                <span className="font-semibold text-amber-500">{mediumPriorityCount}</span>
              </div>
              <div className="w-full bg-slate-100 h-2 rounded-full overflow-hidden">
                <div 
                  className="bg-amber-500 h-full rounded-full transition-all duration-500" 
                  style={{ width: `${totalTasksCount > 0 ? (mediumPriorityCount / totalTasksCount) * 100 : 0}%` }}
                />
              </div>
            </div>

            <div>
              <div className="flex justify-between text-xs text-slate-500 mb-1">
                <span>Low Priority</span>
                <span className="font-semibold text-slate-500">{lowPriorityCount}</span>
              </div>
              <div className="w-full bg-slate-100 h-2 rounded-full overflow-hidden">
                <div 
                  className="bg-slate-400 h-full rounded-full transition-all duration-500" 
                  style={{ width: `${totalTasksCount > 0 ? (lowPriorityCount / totalTasksCount) * 100 : 0}%` }}
                />
              </div>
            </div>
          </div>
        </div>

        {/* Recent Activity stream */}
        <div className="bg-white p-6 rounded-xl border border-slate-200 flex flex-col h-[200px] lg:h-auto overflow-hidden shadow-sm text-slate-900">
          <div className="flex items-center justify-between pb-3 border-b border-slate-100 mb-3">
            <h3 className="text-xs font-bold uppercase text-slate-500 tracking-wider flex items-center gap-1.5">
              <TrendingUp className="w-4 h-4 text-teal-500" />
              <span>Recent Activity</span>
            </h3>
          </div>
          <div className="flex-1 overflow-y-auto space-y-3 pr-1 scrollbar-thin">
            {logs.slice(0, 10).map((log) => (
              <div key={log.id} className="text-xs space-y-0.5 border-l-2 border-slate-100 pl-3 py-0.5">
                <div className="text-slate-600">
                  <strong className="text-slate-900 font-bold">{log.userName}</strong>:{' '}
                  {log.details || log.action}
                </div>
                <div className="text-[10px] text-slate-400 font-mono">
                  {formatRelativeTime(log.createdAt)}
                </div>
              </div>
            ))}
            {logs.length === 0 && (
              <div className="text-xs text-slate-400 italic text-center py-8">No activities recorded yet</div>
            )}
          </div>
        </div>
      </div>

      {/* Tasks Table/Filter Controls */}
      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden shadow-sm">
        {/* Filter Toolbar */}
        <div className="p-4 bg-slate-50/50 border-b border-slate-200 space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-bold text-slate-900 tracking-tight flex items-center gap-2">
              <SlidersHorizontal className="w-4 h-4 text-teal-500" />
              <span>Task Navigator & Filters</span>
            </h3>
            <span className="text-xs bg-teal-500/10 text-teal-600 border border-teal-500/20 px-2 py-0.5 rounded-md font-bold">
              {filteredTasks.length} Match{filteredTasks.length !== 1 && 'es'}
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
            {/* Search Input */}
            <div className="relative">
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-slate-400" />
              <input
                type="text"
                placeholder="Search tasks..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-9 w-full bg-slate-100 border-none rounded-lg py-1.5 text-xs text-slate-800 placeholder:text-slate-400 focus:outline-none focus:ring-1 focus:ring-teal-500"
              />
            </div>

            {/* Status Filter */}
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="bg-slate-100 border-none rounded-lg py-1.5 px-3 text-xs text-slate-700 focus:outline-none focus:ring-1 focus:ring-teal-500 cursor-pointer"
            >
              <option value="all">Statuses (All)</option>
              <option value={TaskStatus.TODO}>To Do</option>
              <option value={TaskStatus.IN_PROGRESS}>In Progress</option>
              <option value={TaskStatus.REVIEW}>For Review</option>
              <option value={TaskStatus.COMPLETED}>Completed</option>
            </select>

            {/* Priority Filter */}
            <select
              value={priorityFilter}
              onChange={(e) => setPriorityFilter(e.target.value)}
              className="bg-slate-100 border-none rounded-lg py-1.5 px-3 text-xs text-slate-700 focus:outline-none focus:ring-1 focus:ring-teal-500 cursor-pointer"
            >
              <option value="all">Priorities (All)</option>
              <option value={TaskPriority.LOW}>Low</option>
              <option value={TaskPriority.MEDIUM}>Medium</option>
              <option value={TaskPriority.HIGH}>High</option>
            </select>

            {/* Assignee Filter */}
            <select
              value={assigneeFilter}
              onChange={(e) => setAssigneeFilter(e.target.value)}
              className="bg-slate-100 border-none rounded-lg py-1.5 px-3 text-xs text-slate-700 focus:outline-none focus:ring-1 focus:ring-teal-500 cursor-pointer"
            >
              <option value="all">Assignees (All)</option>
              <option value="me">Assigned to Me</option>
              {members.map((m) => (
                <option key={m.uid} value={m.uid}>
                  {m.name}
                </option>
              ))}
            </select>

            {/* Channel Filter */}
            <select
              value={channelFilter}
              onChange={(e) => setChannelFilter(e.target.value)}
              className="bg-slate-100 border-none rounded-lg py-1.5 px-3 text-xs text-slate-700 focus:outline-none focus:ring-1 focus:ring-teal-500 cursor-pointer col-span-1"
            >
              <option value="all">Channels (All)</option>
              {channels.map((ch) => (
                <option key={ch.id} value={ch.id}>
                  #{ch.name}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Tasks Table/List Container */}
        <div className="overflow-x-auto bg-white">
          {filteredTasks.length > 0 ? (
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50 text-[10px] font-bold uppercase tracking-wider text-slate-400">
                  <th className="p-4">Task Title</th>
                  <th className="p-4">Channel</th>
                  <th className="p-4">Assignee</th>
                  <th className="p-4">Priority</th>
                  <th className="p-4">Status</th>
                  <th className="p-4">Due Date</th>
                  <th className="p-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-xs text-slate-700">
                {filteredTasks.map((task) => {
                  const isOverdue = task.status !== TaskStatus.COMPLETED && task.dueDate && task.dueDate < todayStr;
                  return (
                    <tr 
                      key={task.id} 
                      onClick={() => onSelectTask(task)}
                      className="hover:bg-slate-50/80 cursor-pointer transition"
                    >
                      <td className="p-4 font-bold text-slate-800 max-w-xs truncate">
                        {task.title}
                      </td>
                      <td className="p-4 text-slate-500 font-mono">
                        <span className="bg-slate-100 text-slate-600 px-2 py-0.5 rounded text-[11px] font-sans">
                          #{getChannelName(task.channelId)}
                        </span>
                      </td>
                      <td className="p-4 text-slate-600">
                        {getMemberName(task.assignedUserId)}
                      </td>
                      <td className="p-4">
                        <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase border ${getPriorityBadgeColor(task.priority)}`}>
                          {task.priority}
                        </span>
                      </td>
                      <td className="p-4">
                        <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase border ${getStatusBadgeColor(task.status)}`}>
                          {task.status === TaskStatus.IN_PROGRESS ? 'In Progress' : task.status === TaskStatus.REVIEW ? 'Review' : task.status}
                        </span>
                      </td>
                      <td className="p-4">
                        <div className="flex items-center gap-1.5">
                          <Calendar className={`w-3.5 h-3.5 ${isOverdue ? 'text-rose-500' : 'text-slate-400'}`} />
                          <span className={isOverdue ? 'text-rose-500 font-semibold' : 'text-slate-500'}>
                            {formatDate(task.dueDate)} {isOverdue && '(Overdue)'}
                          </span>
                        </div>
                      </td>
                      <td className="p-4 text-right text-teal-600 font-bold hover:text-teal-700">
                        <div className="inline-flex items-center gap-1">
                          <span>Details</span>
                          <ChevronRight className="w-3.5 h-3.5" />
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          ) : (
            <div className="text-center py-16 px-4 space-y-2">
              <Layers className="w-8 h-8 text-slate-350 mx-auto" />
              <div className="text-slate-500 font-medium text-sm">No tasks found</div>
              <div className="text-xs text-slate-400 max-w-xs mx-auto">
                No tasks matches your filters. Adjust the filters or add a new task in any channel.
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
