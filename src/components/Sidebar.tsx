/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { Channel, UserProfile, UserRole } from '../types';
import { 
  Hash, 
  Plus, 
  Settings, 
  LogOut, 
  LayoutDashboard, 
  User, 
  UserX, 
  FolderLock, 
  Activity, 
  Compass, 
  Bell, 
  Menu, 
  X,
  ChevronRight,
  Sparkles,
  Key,
  HardDrive,
  Info,
  ExternalLink,
  AlertTriangle,
  Mail
} from 'lucide-react';
import { signOut } from 'firebase/auth';
import { auth } from '../firebase';
import { motion, AnimatePresence } from 'motion/react';

interface SidebarProps {
  userProfile: UserProfile;
  workspaceName: string;
  workspaceJoinCode?: string;
  channels: Channel[];
  selectedChannelId: string | null;
  activeView: 'dashboard' | 'channel' | 'admin' | 'dispatches';
  members: UserProfile[];
  unreadNotifsCount?: number;
  storageBytes?: number;
  allAttachments?: any[];
  onSelectChannel: (channelId: string) => void;
  onSelectView: (view: 'dashboard' | 'channel' | 'admin' | 'dispatches') => void;
  onAddChannel: () => void;
  onAddSubChannel: (parentId: string) => void;
  onLogout: () => void;
  onOpenNotifications: () => void;
}

export default function Sidebar({
  userProfile,
  workspaceName,
  workspaceJoinCode,
  channels,
  selectedChannelId,
  activeView,
  members,
  unreadNotifsCount = 0,
  storageBytes = 0,
  allAttachments = [],
  onSelectChannel,
  onSelectView,
  onAddChannel,
  onAddSubChannel,
  onLogout,
  onOpenNotifications
}: SidebarProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [showStorageBreakdown, setShowStorageBreakdown] = useState(false);

  const formatStorageSize = (bytes: number) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  const getRoleBadgeColor = (role: UserRole) => {
    switch (role) {
      case UserRole.ADMIN:
        return 'bg-teal-500/10 text-teal-400 border-teal-500/20';
      case UserRole.LEADER:
        return 'bg-amber-500/10 text-amber-400 border-amber-500/20';
      default:
        return 'bg-slate-800 text-slate-400 border-slate-700';
    }
  };

  const getAvatarInitials = (name: string) => {
    if (!name) return 'U';
    const parts = name.split(' ');
    if (parts.length > 1) {
      return (parts[0][0] + parts[1][0]).toUpperCase();
    }
    return parts[0][0].toUpperCase();
  };

  const getMemberAvatarBg = (role: UserRole) => {
    switch (role) {
      case UserRole.ADMIN:
        return 'bg-teal-600 text-white';
      case UserRole.LEADER:
        return 'bg-purple-600 text-white';
      default:
        return 'bg-blue-600 text-white';
    }
  };

  const handleSignOut = async () => {
    try {
      await signOut(auth);
      onLogout();
    } catch (e) {
      console.error('Sign out error:', e);
    }
  };

  const sidebarContent = (
    <div className="h-full flex flex-col bg-slate-900 text-slate-400 font-sans border-r border-slate-800 select-none">
      {/* Workspace Header */}
      <div className="p-6 border-b border-slate-800 flex items-center justify-between">
        <div className="flex items-center space-x-3 overflow-hidden">
          <div className="w-8 h-8 bg-teal-500 rounded-lg flex items-center justify-center shrink-0">
            <Compass className="w-4 h-4 text-white" />
          </div>
          <div className="overflow-hidden">
            <h2 className="font-bold text-white text-base truncate leading-tight">
              {workspaceName}
            </h2>
            <p className="text-[10px] text-teal-400 font-medium truncate flex items-center mt-0.5">
              <Sparkles className="w-2.5 h-2.5 mr-1 animate-pulse" /> Code: {userProfile.workspaceId}
            </p>
            {workspaceJoinCode && (
              <p className="text-[9px] text-slate-500 font-bold truncate flex items-center mt-0.5">
                <Key className="w-2.5 h-2.5 mr-1 text-teal-500/80" /> Join Key: <span className="text-teal-400 ml-1 select-all font-mono">{workspaceJoinCode}</span>
              </p>
            )}
          </div>
        </div>
      </div>

      {/* Main Navigation Items */}
      <div className="px-6 py-4 space-y-1">
        {/* Dashboard Link */}
        <button
          onClick={() => {
            onSelectView('dashboard');
            setIsOpen(false);
          }}
          className={`w-full flex items-center justify-between px-3 py-1.5 rounded-lg text-base font-medium transition duration-150 ${
            activeView === 'dashboard'
              ? 'bg-slate-800 text-white border-l-2 border-teal-500'
              : 'hover:bg-slate-800 text-slate-400 hover:text-slate-200'
          }`}
        >
          <div className="flex items-center space-x-2.5">
            <LayoutDashboard className="w-4 h-4" />
            <span>Workspace Dashboard</span>
          </div>
          <ChevronRight className="w-3.5 h-3.5 opacity-60" />
        </button>

        {/* Email Sandbox Link */}
        <button
          onClick={() => {
            onSelectView('dispatches');
            setIsOpen(false);
          }}
          className={`w-full flex items-center justify-between px-3 py-1.5 rounded-lg text-base font-medium transition duration-150 ${
            activeView === 'dispatches'
              ? 'bg-slate-800 text-white border-l-2 border-teal-500'
              : 'hover:bg-slate-800 text-slate-400 hover:text-slate-200'
          }`}
        >
          <div className="flex items-center space-x-2.5">
            <Mail className="w-4 h-4 text-teal-500" />
            <span>Email Sandbox</span>
          </div>
          <ChevronRight className="w-3.5 h-3.5 opacity-60" />
        </button>

        {/* Admin Link (Only for ADMIN) */}
        {userProfile.role === UserRole.ADMIN && (
          <button
            onClick={() => {
              onSelectView('admin');
              setIsOpen(false);
            }}
            className={`w-full flex items-center justify-between px-3 py-1.5 rounded-lg text-base font-medium transition duration-150 ${
              activeView === 'admin'
                ? 'bg-slate-800 text-white border-l-2 border-teal-500'
                : 'hover:bg-slate-800 text-slate-400 hover:text-slate-200'
            }`}
          >
            <div className="flex items-center space-x-2.5">
              <FolderLock className="w-4 h-4" />
              <span>Admin Console</span>
            </div>
            <span className="text-[10px] uppercase px-1.5 py-0.5 rounded bg-teal-500/10 text-teal-400 border border-teal-500/20 font-bold scale-90">
              Admin
            </span>
          </button>
        )}
      </div>

      {/* Channels Section */}
      <div className="flex-1 overflow-y-auto px-6 py-2 space-y-6">
        <div>
          <div className="flex items-center justify-between text-xs font-semibold uppercase tracking-widest text-slate-500 mb-4">
            <span>Project Channels</span>
            {(userProfile.role === UserRole.ADMIN || userProfile.role === UserRole.LEADER) && (
              <button
                onClick={onAddChannel}
                title="Create a Channel"
                className="hover:text-white transition p-0.5 rounded-md hover:bg-slate-800"
              >
                <Plus className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          <div className="space-y-1">
            {channels.filter(ch => !ch.isArchived && !ch.parentId).map((ch) => {
              const subChannels = channels.filter(sub => !sub.isArchived && sub.parentId === ch.id);
              const isSelected = activeView === 'channel' && selectedChannelId === ch.id;
              return (
                <div key={ch.id}>
                  <button
                    onClick={() => {
                      onSelectChannel(ch.id);
                      setIsOpen(false);
                    }}
                    className={`group w-full flex items-center justify-between space-x-2 px-3 py-1.5 rounded text-lg transition text-left ${
                      isSelected
                        ? 'bg-teal-500/10 text-teal-400 font-medium'
                        : 'hover:bg-slate-800 text-slate-400 hover:text-slate-200'
                    }`}
                  >
                    <div className="flex items-center space-x-2 truncate">
                      <span className={`font-mono text-lg leading-none ${isSelected ? 'text-teal-400 opacity-80' : 'text-slate-500 opacity-55'}`}>#</span>
                      <span className="truncate">{ch.name}</span>
                    </div>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        onAddSubChannel(ch.id);
                      }}
                      title="Add a Sub-channel"
                      className="opacity-60 hover:opacity-100 p-1 hover:bg-slate-700 rounded text-slate-300 hover:text-teal-400 transition cursor-pointer"
                    >
                      <Plus className="w-3.5 h-3.5" />
                    </button>
                  </button>
                  {subChannels.length > 0 && (
                    <div className="pl-6 space-y-1 mt-1">
                      {subChannels.map(sub => (
                        <button
                          key={sub.id}
                          onClick={() => {
                            onSelectChannel(sub.id);
                            setIsOpen(false);
                          }}
                          className={`w-full flex items-center space-x-2 px-3 py-1.5 rounded text-sm transition text-left ${
                            activeView === 'channel' && selectedChannelId === sub.id
                              ? 'bg-teal-500/10 text-teal-400 font-medium'
                              : 'hover:bg-slate-800 text-slate-400 hover:text-slate-200'
                          }`}
                        >
                          <span className="font-mono text-xs opacity-55">└</span>
                          <span className="truncate">{sub.name}</span>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
            {channels.filter(ch => !ch.isArchived).length === 0 && (
              <div className="px-3 py-2 text-xs text-slate-600 italic">No channels created</div>
            )}
          </div>
        </div>

        {/* Team Members Section */}
        <div>
          <div className="flex items-center justify-between text-xs font-semibold uppercase tracking-widest text-slate-500 mb-4">
            <span>Team Members ({members.length})</span>
          </div>

          <div className="space-y-3">
            {members.map((member) => (
              <div
                key={member.uid}
                className="flex items-center gap-3 py-0.5"
              >
                <div className={`w-6 h-6 rounded-full text-[10px] font-bold flex items-center justify-center uppercase shrink-0 ${getMemberAvatarBg(member.role)}`}>
                  {getAvatarInitials(member.name)}
                </div>
                <span className="text-sm truncate text-slate-300">{member.name}</span>
                <span className={`text-[9px] font-bold uppercase px-1.5 py-0.5 rounded border ml-auto shrink-0 ${getRoleBadgeColor(member.role)}`}>
                  {member.role === UserRole.ADMIN ? 'Admin' : member.role === UserRole.LEADER ? 'Lead' : 'Mem'}
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* Firebase Storage Monitor Section */}
        <div className="pt-4 border-t border-slate-800">
          <div className="flex items-center justify-between text-xs font-semibold uppercase tracking-widest text-slate-500 mb-3">
            <span className="flex items-center gap-1.5">
              <HardDrive className="w-3.5 h-3.5 text-teal-400" /> Storage Monitor
            </span>
            <button 
              onClick={() => setShowStorageBreakdown(true)}
              className="text-[10px] text-teal-400 hover:text-teal-300 transition hover:underline cursor-pointer"
            >
              Breakdown
            </button>
          </div>
          <div className="bg-slate-950/30 border border-slate-800/60 p-3 rounded-lg font-sans">
            <div className="flex justify-between items-center text-xs text-slate-300 mb-1.5">
              <span className="font-semibold text-slate-200">
                {formatStorageSize(storageBytes)}
              </span>
              <span className="text-[10px] text-slate-500 font-bold">
                of 5.0 GB limit
              </span>
            </div>
            
            {/* Progress bar */}
            <div className="w-full bg-slate-800 rounded-full h-1.5 overflow-hidden">
              <div 
                className={`h-full rounded-full transition-all duration-500 ${
                  (storageBytes / (5 * 1024 * 1024 * 1024)) > 0.85 
                    ? 'bg-rose-500' 
                    : (storageBytes / (5 * 1024 * 1024 * 1024)) > 0.60 
                    ? 'bg-amber-500' 
                    : 'bg-teal-500'
                }`}
                style={{ width: `${Math.min((storageBytes / (5 * 1024 * 1024 * 1024)) * 100, 100)}%` }}
              />
            </div>
            
            <div className="flex items-start gap-1.5 mt-2 text-[9px] text-slate-500 leading-normal">
              <Info className="w-3.5 h-3.5 text-slate-500 shrink-0 mt-0.5" />
              <span>
                To avoid payments, stay under 5.0 GB limit. Only real uploaded files consume storage.
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Footer Profile Details */}
      <div className="p-4 bg-slate-950/40 mt-auto flex items-center gap-3 border-t border-slate-800">
        <div className={`w-8 h-8 rounded-full font-bold flex items-center justify-center text-xs uppercase shrink-0 ${getMemberAvatarBg(userProfile.role)}`}>
          {getAvatarInitials(userProfile.name)}
        </div>
        <div className="flex-1 overflow-hidden">
          <p className="text-xs font-bold text-white leading-tight truncate">
            {userProfile.name}
          </p>
          <p className="text-[10px] uppercase text-slate-500 truncate capitalize">
            {userProfile.role} profile
          </p>
        </div>
        
        {/* Bell notifications button */}
        <button
          onClick={onOpenNotifications}
          title="Notifications & Alerts"
          className="p-1.5 text-slate-400 hover:text-teal-400 hover:bg-teal-500/10 rounded-lg transition shrink-0 cursor-pointer relative"
        >
          <Bell className="w-4 h-4" />
          {unreadNotifsCount > 0 && (
            <span className="absolute -top-1 -right-1 bg-rose-500 text-white text-[9px] font-extrabold h-4 min-w-[16px] px-1 rounded-full flex items-center justify-center border border-slate-900 animate-pulse">
              {unreadNotifsCount}
            </span>
          )}
        </button>

        <button
          onClick={handleSignOut}
          title="Sign Out"
          className="p-1.5 text-slate-500 hover:text-rose-400 hover:bg-rose-500/10 rounded-lg transition shrink-0"
        >
          <LogOut className="w-4 h-4" />
        </button>
      </div>
    </div>
  );

  return (
    <>
      {/* Mobile Header Navigation Trigger */}
      <div className="md:hidden flex items-center justify-between bg-slate-900 text-white p-3 border-b border-slate-800 shrink-0">
        <div className="flex items-center space-x-2">
          <div className="w-7 h-7 bg-teal-500 rounded flex items-center justify-center">
            <Compass className="w-4 h-4 text-white" />
          </div>
          <span className="font-bold text-sm tracking-tight">{workspaceName}</span>
        </div>
        <button
          onClick={() => setIsOpen(!isOpen)}
          className="p-1 text-slate-400 hover:text-white"
        >
          {isOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
        </button>
      </div>

      {/* Desktop Persistent Sidebar */}
      <div className="hidden md:block w-64 h-screen shrink-0">
        {sidebarContent}
      </div>

      {/* Mobile Drawer */}
      {isOpen && (
        <div className="md:hidden fixed inset-0 z-50 flex">
          <div className="fixed inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setIsOpen(false)} />
          <div className="relative w-64 h-full flex flex-col z-10 animate-in slide-in-from-left duration-200">
            {sidebarContent}
          </div>
        </div>
      )}

      {/* Storage Breakdown Modal */}
      <AnimatePresence>
        {showStorageBreakdown && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            {/* Backdrop */}
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0 bg-slate-950/80 backdrop-blur-sm"
              onClick={() => setShowStorageBreakdown(false)}
            />
            
            {/* Modal Card */}
            <motion.div 
              initial={{ opacity: 0, scale: 0.95, y: 15 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 15 }}
              className="relative bg-slate-900 border border-slate-800 text-slate-300 w-full max-w-xl rounded-xl shadow-2xl flex flex-col max-h-[85vh] overflow-hidden z-10 font-sans"
            >
              {/* Header */}
              <div className="p-5 border-b border-slate-800 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <HardDrive className="w-5 h-5 text-teal-400" />
                  <div>
                    <h3 className="font-bold text-white text-base">Firebase Storage Breakdown</h3>
                    <p className="text-xs text-slate-400">Manage uploaded deliverables and monitor the 5 GB free tier limit</p>
                  </div>
                </div>
                <button 
                  onClick={() => setShowStorageBreakdown(false)}
                  className="p-1 hover:bg-slate-850 rounded text-slate-400 hover:text-white transition cursor-pointer"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
              
              {/* Stats Banner */}
              <div className="p-5 bg-slate-950/40 border-b border-slate-800/50 grid grid-cols-3 gap-4 text-center">
                <div className="p-3 bg-slate-900/60 rounded-lg border border-slate-800/40">
                  <div className="text-[10px] text-slate-500 uppercase tracking-wider font-bold">Total Space Used</div>
                  <div className="text-lg font-extrabold text-teal-400 mt-1">{formatStorageSize(storageBytes)}</div>
                </div>
                <div className="p-3 bg-slate-900/60 rounded-lg border border-slate-800/40">
                  <div className="text-[10px] text-slate-500 uppercase tracking-wider font-bold">Free Limit</div>
                  <div className="text-lg font-extrabold text-slate-400 mt-1">5.0 GB</div>
                </div>
                <div className="p-3 bg-slate-900/60 rounded-lg border border-slate-800/40">
                  <div className="text-[10px] text-slate-500 uppercase tracking-wider font-bold">Files Count</div>
                  <div className="text-lg font-extrabold text-white mt-1">{allAttachments.length}</div>
                </div>
              </div>
              
              {/* Body */}
              <div className="p-5 flex-1 overflow-y-auto space-y-4">
                <h4 className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Workspace Uploaded Files</h4>
                
                {allAttachments.length === 0 ? (
                  <div className="text-center py-8 text-sm text-slate-500 italic">
                    No files uploaded to Firebase Storage yet.
                  </div>
                ) : (
                  <div className="divide-y divide-slate-800/50 border border-slate-800 rounded-lg overflow-hidden bg-slate-950/20">
                    {allAttachments.map((file) => (
                      <div key={file.id} className="p-3.5 flex items-center justify-between gap-4 hover:bg-slate-850/40 transition">
                        <div className="min-w-0 flex-1">
                          <p className="text-sm font-medium text-white truncate" title={file.name}>
                            {file.name}
                          </p>
                          <div className="flex items-center gap-2 mt-1 text-xs text-slate-400 flex-wrap">
                            <span className="bg-slate-850 px-1.5 py-0.5 rounded text-[10px] text-slate-300">
                              {file.size || 'Unknown Size'}
                            </span>
                            <span>•</span>
                            <span className="truncate">By {file.uploadedBy}</span>
                            <span>•</span>
                            <span className="text-[10px] text-teal-400 font-semibold uppercase bg-teal-500/10 px-1 py-0.2 rounded">
                              {file.sourceTitle}
                            </span>
                          </div>
                        </div>
                        <a 
                          href={file.url} 
                          target="_blank" 
                          rel="noreferrer"
                          className="flex items-center gap-1 text-xs text-teal-400 hover:text-teal-300 hover:underline shrink-0 font-medium px-2.5 py-1.5 bg-teal-500/5 rounded border border-teal-500/10 hover:bg-teal-500/10 transition"
                        >
                          View <ExternalLink className="w-3.5 h-3.5" />
                        </a>
                      </div>
                    ))}
                  </div>
                )}
              </div>
              
              {/* Footer info warning */}
              <div className="p-4 bg-amber-500/5 border-t border-slate-800 text-xs text-amber-400/90 leading-relaxed flex gap-2">
                <AlertTriangle className="w-4.5 h-4.5 shrink-0 mt-0.5 text-amber-500" />
                <div>
                  <span className="font-semibold text-white">How to clean storage:</span> If you are approaching the 5 GB Spark plan limit, you can delete files directly by deleting the task they are attached to, or delete old attachment files to keep your space free and avoid potential billing!
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </>
  );
}
