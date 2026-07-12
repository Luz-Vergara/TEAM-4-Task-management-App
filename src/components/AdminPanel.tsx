/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { UserProfile, UserRole, Channel, Task, Workspace } from '../types';
import { 
  Shield, 
  Users, 
  Hash, 
  Plus, 
  Trash2, 
  Archive, 
  ArchiveRestore,
  Check, 
  Settings, 
  Briefcase, 
  AlertTriangle,
  Sparkles,
  UserPlus,
  Key,
  Edit
} from 'lucide-react';
import { collection, addDoc, doc, updateDoc, deleteDoc } from 'firebase/firestore';
import { db } from '../firebase';
import { logActivity } from '../utils';

interface AdminPanelProps {
  userProfile: UserProfile;
  workspace: Workspace | null;
  members: UserProfile[];
  channels: Channel[];
  tasks: Task[];
  onRefreshWorkspaceData: () => void;
}

export default function AdminPanel({
  userProfile,
  workspace,
  members,
  channels,
  tasks,
  onRefreshWorkspaceData
}: AdminPanelProps) {
  const [editingUserId, setEditingUserId] = useState<string | null>(null);
  const [targetRole, setTargetRole] = useState<UserRole>(UserRole.MEMBER);
  const [channelToDelete, setChannelToDelete] = useState<Channel | null>(null);
  const [deletingChannelInProgress, setDeletingChannelInProgress] = useState(false);

  // Edit Channel states
  const [editingChannelId, setEditingChannelId] = useState<string | null>(null);
  const [editingChannelName, setEditingChannelName] = useState('');
  const [editingChannelDesc, setEditingChannelDesc] = useState('');
  
  // Create Channel states
  const [newChannelName, setNewChannelName] = useState('');
  const [newChannelDesc, setNewChannelDesc] = useState('');
  const [selectedLeaderId, setSelectedLeaderId] = useState('');
  const [createError, setCreateError] = useState('');
  const [createSuccess, setCreateSuccess] = useState('');
  const [loading, setLoading] = useState(false);

  // Workspace Settings states
  const [workspaceNameInput, setWorkspaceNameInput] = useState(workspace?.name || '');
  const [joinCodeInput, setJoinCodeInput] = useState(workspace?.joinCode || '');
  const [workspaceSuccess, setWorkspaceSuccess] = useState('');
  const [workspaceError, setWorkspaceError] = useState('');
  const [savingWorkspace, setSavingWorkspace] = useState(false);

  useEffect(() => {
    if (workspace) {
      setWorkspaceNameInput(workspace.name || '');
      setJoinCodeInput(workspace.joinCode || '');
    }
  }, [workspace]);

  const handleUpdateWorkspaceSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    setWorkspaceSuccess('');
    setWorkspaceError('');
    if (!workspaceNameInput.trim()) {
      setWorkspaceError('Workspace name cannot be empty');
      return;
    }
    if (!joinCodeInput.trim()) {
      setWorkspaceError('Security Join Code cannot be empty');
      return;
    }

    setSavingWorkspace(true);
    try {
      const workspaceRef = doc(db, 'workspaces', userProfile.workspaceId);
      await updateDoc(workspaceRef, {
        name: workspaceNameInput.trim(),
        joinCode: joinCodeInput.trim()
      });

      await logActivity(
        userProfile.workspaceId,
        userProfile.uid,
        userProfile.name,
        'workspace_updated',
        `Admin updated workspace name to "${workspaceNameInput.trim()}" and updated Security Join Code`
      );

      setWorkspaceSuccess('Workspace settings updated successfully!');
      onRefreshWorkspaceData();
    } catch (err: any) {
      console.error('Error updating workspace settings:', err);
      setWorkspaceError(err.message || 'Error updating workspace settings');
    } finally {
      setSavingWorkspace(false);
    }
  };

  // Manage member role change
  const handleUpdateRole = async (userId: string, targetUserProfile: UserProfile) => {
    try {
      const userRef = doc(db, 'users', userId);
      await updateDoc(userRef, { role: targetRole });
      
      await logActivity(
        userProfile.workspaceId,
        userProfile.uid,
        userProfile.name,
        'user_role_updated',
        `Admin updated ${targetUserProfile.name}'s role to "${targetRole}"`
      );

      setEditingUserId(null);
      onRefreshWorkspaceData();
    } catch (err) {
      console.error('Error updating user role:', err);
    }
  };

  // Manage channel create
  const handleCreateChannel = async (e: React.FormEvent) => {
    e.preventDefault();
    setCreateError('');
    setCreateSuccess('');
    if (!newChannelName.trim()) return;

    setLoading(true);
    try {
      const channelId = newChannelName.trim().toLowerCase().replace(/[^a-z0-9]+/g, '-');
      const channelsRef = collection(db, 'workspaces', userProfile.workspaceId, 'channels');
      
      const newCh = {
        id: channelId,
        workspaceId: userProfile.workspaceId,
        name: newChannelName.trim().toLowerCase(),
        description: newChannelDesc.trim() || 'No description provided',
        isArchived: false,
        assignedLeaderId: selectedLeaderId,
        createdAt: new Date().toISOString()
      };

      const chDocRef = doc(channelsRef, channelId);
      // Wait, let's write to Firestore
      const { setDoc } = await import('firebase/firestore');
      await setDoc(chDocRef, newCh);

      await logActivity(
        userProfile.workspaceId,
        userProfile.uid,
        userProfile.name,
        'channel_created',
        `Admin created channel #${newCh.name} with description "${newCh.description}"`
      );

      setNewChannelName('');
      setNewChannelDesc('');
      setSelectedLeaderId('');
      setCreateSuccess(`Channel #${channelId} created successfully!`);
      onRefreshWorkspaceData();
    } catch (err: any) {
      console.error('Error creating channel:', err);
      setCreateError(err.message || 'Error creating channel');
    } finally {
      setLoading(false);
    }
  };

  // Manage channel archive
  const handleArchiveChannel = async (ch: Channel) => {
    try {
      const chRef = doc(db, 'workspaces', userProfile.workspaceId, 'channels', ch.id);
      await updateDoc(chRef, { isArchived: true });

      await logActivity(
        userProfile.workspaceId,
        userProfile.uid,
        userProfile.name,
        'channel_archived',
        `Admin archived channel #${ch.name}`
      );

      onRefreshWorkspaceData();
    } catch (err) {
      console.error('Error archiving channel:', err);
    }
  };

  // Manage channel unarchive
  const handleUnarchiveChannel = async (ch: Channel) => {
    try {
      const chRef = doc(db, 'workspaces', userProfile.workspaceId, 'channels', ch.id);
      await updateDoc(chRef, { isArchived: false });

      await logActivity(
        userProfile.workspaceId,
        userProfile.uid,
        userProfile.name,
        'channel_unarchived',
        `Admin unarchived channel #${ch.name}`
      );

      onRefreshWorkspaceData();
    } catch (err) {
      console.error('Error unarchiving channel:', err);
    }
  };

  // Manage channel delete
  const handleDeleteChannel = (ch: Channel) => {
    if (ch.name === 'general') return;
    setChannelToDelete(ch);
  };

  const handleConfirmDeleteChannel = async () => {
    if (!channelToDelete) return;
    setDeletingChannelInProgress(true);
    try {
      const chRef = doc(db, 'workspaces', userProfile.workspaceId, 'channels', channelToDelete.id);
      await deleteDoc(chRef);

      await logActivity(
        userProfile.workspaceId,
        userProfile.uid,
        userProfile.name,
        'channel_deleted',
        `Admin permanently deleted channel #${channelToDelete.name}`
      );

      setChannelToDelete(null);
      onRefreshWorkspaceData();
    } catch (err: any) {
      console.error('Error deleting channel:', err);
      alert('Error deleting channel: ' + err.message);
    } finally {
      setDeletingChannelInProgress(false);
    }
  };

  // Start editing channel
  const handleStartEditChannel = (ch: Channel) => {
    setEditingChannelId(ch.id);
    setEditingChannelName(ch.name);
    setEditingChannelDesc(ch.description || '');
  };

  // Save edited channel details
  const handleSaveChannelEdit = async (channelId: string) => {
    const trimmedName = editingChannelName.trim().toLowerCase().replace(/[^a-z0-9\-]+/g, '');
    if (!trimmedName) {
      alert('Channel name cannot be empty');
      return;
    }
    try {
      const chRef = doc(db, 'workspaces', userProfile.workspaceId, 'channels', channelId);
      await updateDoc(chRef, {
        name: trimmedName,
        description: editingChannelDesc.trim()
      });

      await logActivity(
        userProfile.workspaceId,
        userProfile.uid,
        userProfile.name,
        'channel_updated',
        `Admin renamed/updated channel to #${trimmedName}`
      );

      setEditingChannelId(null);
      onRefreshWorkspaceData();
    } catch (err: any) {
      console.error('Error updating channel:', err);
      alert('Error updating channel: ' + err.message);
    }
  };

  // Assign Team Leader to channel
  const handleAssignChannelLeader = async (channelId: string, leaderId: string) => {
    try {
      const chRef = doc(db, 'workspaces', userProfile.workspaceId, 'channels', channelId);
      await updateDoc(chRef, { assignedLeaderId: leaderId });

      const chName = channels.find((c) => c.id === channelId)?.name || channelId;
      const leadName = members.find((m) => m.uid === leaderId)?.name || 'Unassigned';

      await logActivity(
        userProfile.workspaceId,
        userProfile.uid,
        userProfile.name,
        'channel_leader_assigned',
        `Admin assigned ${leadName} as lead for channel #${chName}`
      );

      onRefreshWorkspaceData();
    } catch (err) {
      console.error('Error assigning leader:', err);
    }
  };

  const getRoleBadgeColor = (role: UserRole) => {
    switch (role) {
      case UserRole.ADMIN:
        return 'bg-teal-50 text-teal-600 border-teal-100';
      case UserRole.LEADER:
        return 'bg-amber-50 text-amber-600 border-amber-100';
      default:
        return 'bg-slate-100 text-slate-500 border-slate-200';
    }
  };

  // Filter Team Leaders only
  const teamLeaders = members.filter((m) => m.role === UserRole.LEADER);

  return (
    <div className="flex-1 overflow-y-auto p-4 md:p-8 space-y-8 bg-slate-50 text-slate-900 font-sans">
      {/* Header section */}
      <div className="border-b border-slate-200 pb-5">
        <h1 className="text-2xl font-bold text-slate-900 tracking-tight flex items-center gap-2">
          <Shield className="w-6 h-6 text-teal-500" />
          <span>Admin Workspace Control</span>
        </h1>
        <p className="text-sm text-slate-500 mt-1">
          Complete organizational control: manage user profiles, change structural roles, seed project channels, and deploy leader assignments.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Left Column: Role and Member Management */}
        <div className="lg:col-span-2 space-y-6">
          <div className="bg-white rounded-xl border border-slate-200 p-6 space-y-4 shadow-sm">
            <h2 className="text-xs font-bold uppercase tracking-wider text-slate-400 flex items-center gap-2">
              <Users className="w-4 h-4 text-teal-500" />
              <span>Team Membership & Roles</span>
            </h2>

            <div className="divide-y divide-slate-100">
              {members.map((member) => (
                <div key={member.uid} className="py-3 flex items-center justify-between gap-4">
                  <div className="overflow-hidden">
                    <div className="flex items-center space-x-2">
                      <span className="font-bold text-xs text-slate-800 truncate">{member.name}</span>
                      <span className={`text-[9px] font-bold uppercase px-1.5 py-0.2 border rounded ${getRoleBadgeColor(member.role)}`}>
                        {member.role}
                      </span>
                    </div>
                    <div className="text-xs text-slate-500 truncate">{member.email}</div>
                  </div>

                  {editingUserId === member.uid ? (
                    <div className="flex items-center space-x-2">
                      <select
                        value={targetRole}
                        onChange={(e) => setTargetRole(e.target.value as UserRole)}
                        className="bg-slate-100 border-none rounded px-2 py-1 text-xs text-slate-700 focus:outline-none"
                      >
                        <option value={UserRole.MEMBER}>Member</option>
                        <option value={UserRole.LEADER}>Team Leader</option>
                        <option value={UserRole.ADMIN}>Admin</option>
                      </select>
                      <button
                        onClick={() => handleUpdateRole(member.uid, member)}
                        className="p-1 bg-teal-600 hover:bg-teal-500 text-white rounded transition"
                      >
                        <Check className="w-3.5 h-3.5" />
                      </button>
                      <button
                        onClick={() => setEditingUserId(null)}
                        className="text-xs text-slate-400 hover:text-slate-700 transition"
                      >
                        Cancel
                      </button>
                    </div>
                  ) : (
                    /* Cannot edit oneself to prevent accidents */
                    member.uid !== userProfile.uid && (
                      <button
                        onClick={() => {
                          setEditingUserId(member.uid);
                          setTargetRole(member.role);
                        }}
                        className="px-2.5 py-1 text-[10px] font-bold uppercase border border-slate-200 hover:border-slate-300 bg-slate-50 text-slate-500 hover:text-teal-600 rounded transition"
                      >
                        Adjust Role
                      </button>
                    )
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* Active Channels Registry & Assignments */}
          <div className="bg-white rounded-xl border border-slate-200 p-6 space-y-4 shadow-sm">
            <h2 className="text-xs font-bold uppercase tracking-wider text-slate-400 flex items-center gap-2">
              <Hash className="w-4 h-4 text-teal-500" />
              <span>Channels Registry & Leader Assignments</span>
            </h2>

            <div className="divide-y divide-slate-100">
              {channels.map((ch) => {
                const isEditing = editingChannelId === ch.id;
                return (
                  <div key={ch.id} className="py-3 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                    <div className="flex-1 min-w-0">
                      {isEditing ? (
                        <div className="space-y-1.5 max-w-sm">
                          <div className="flex items-center space-x-1">
                            <span className="text-slate-400 text-xs font-mono">#</span>
                            <input
                              type="text"
                              value={editingChannelName}
                              onChange={(e) => setEditingChannelName(e.target.value)}
                              className="bg-slate-50 border border-slate-200 rounded px-2 py-0.5 text-xs text-slate-800 font-bold focus:ring-1 focus:ring-teal-500 outline-none w-full"
                              placeholder="channel-name"
                            />
                          </div>
                          <input
                            type="text"
                            value={editingChannelDesc}
                            onChange={(e) => setEditingChannelDesc(e.target.value)}
                            className="bg-slate-50 border border-slate-200 rounded px-2 py-0.5 text-[11px] text-slate-600 focus:ring-1 focus:ring-teal-500 outline-none w-full"
                            placeholder="Channel description"
                          />
                          <div className="flex items-center space-x-2 pt-1">
                            <button
                              onClick={() => handleSaveChannelEdit(ch.id)}
                              className="px-2.5 py-1 bg-teal-600 hover:bg-teal-500 text-white font-bold text-[10px] rounded transition shadow-sm cursor-pointer"
                            >
                              Save
                            </button>
                            <button
                              onClick={() => setEditingChannelId(null)}
                              className="px-2.5 py-1 bg-slate-100 hover:bg-slate-200 text-slate-600 font-semibold text-[10px] rounded transition cursor-pointer"
                            >
                              Cancel
                            </button>
                          </div>
                        </div>
                      ) : (
                        <>
                          <div className="flex items-center space-x-1.5">
                            <Hash className="w-3.5 h-3.5 text-slate-400" />
                            <span className="font-bold text-xs text-slate-800 capitalize">
                              {ch.name} {ch.isArchived && '(Archived)'}
                            </span>
                          </div>
                          <div className="text-[11px] text-slate-500 leading-relaxed max-w-sm mt-0.5">{ch.description}</div>
                        </>
                      )}
                    </div>

                    <div className="flex items-center space-x-3">
                      {/* Leader Dropdown */}
                      {!ch.isArchived && (
                        <div className="flex items-center space-x-1.5">
                          <span className="text-[10px] text-slate-400">Lead:</span>
                          <select
                            value={ch.assignedLeaderId || ''}
                            onChange={(e) => handleAssignChannelLeader(ch.id, e.target.value)}
                            className="bg-slate-100 border-none rounded px-2 py-1 text-xs text-teal-600 font-bold"
                          >
                            <option value="">Unassigned</option>
                            {teamLeaders.map((lead) => (
                              <option key={lead.uid} value={lead.uid}>
                                {lead.name}
                              </option>
                            ))}
                          </select>
                        </div>
                      )}

                      {/* Edit button */}
                      {!isEditing && (
                        <button
                          onClick={() => handleStartEditChannel(ch)}
                          title="Edit Channel"
                          className="p-1 text-slate-400 hover:text-teal-600 rounded transition hover:bg-teal-50 cursor-pointer"
                        >
                          <Edit className="w-3.5 h-3.5" />
                        </button>
                      )}

                      {/* Archive button */}
                      {!ch.isArchived && ch.name !== 'general' && (
                        <button
                          onClick={() => handleArchiveChannel(ch)}
                          title="Archive Channel"
                          className="p-1 text-slate-400 hover:text-rose-500 rounded transition hover:bg-rose-50 cursor-pointer"
                        >
                          <Archive className="w-3.5 h-3.5" />
                        </button>
                      )}

                      {/* Unarchive button */}
                      {ch.isArchived && (
                        <button
                          onClick={() => handleUnarchiveChannel(ch)}
                          title="Unarchive/Restore Channel"
                          className="p-1 text-slate-400 hover:text-emerald-500 rounded transition hover:bg-emerald-50 cursor-pointer"
                        >
                          <ArchiveRestore className="w-3.5 h-3.5" />
                        </button>
                      )}

                      {/* Delete button */}
                      {ch.name !== 'general' && (
                        <button
                          onClick={() => handleDeleteChannel(ch)}
                          title="Delete Channel Permanently"
                          className="p-1 text-slate-400 hover:text-rose-600 rounded transition hover:bg-rose-50 cursor-pointer"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* Right Column: Configuration & Channel structure */}
        <div className="space-y-6 sticky top-4">
          {/* Workspace Settings and Join Code Settings Card */}
          <div className="bg-white rounded-xl border border-slate-200 p-6 space-y-4 shadow-sm">
            <h2 className="text-xs font-bold uppercase tracking-wider text-slate-400 flex items-center gap-2">
              <Settings className="w-4 h-4 text-teal-500" />
              <span>Workspace Configuration</span>
            </h2>

            {workspaceError && (
              <div className="p-3 bg-rose-50 border border-rose-200 text-rose-700 text-xs rounded-lg flex gap-1.5 items-start animate-fade-in">
                <AlertTriangle className="w-4 h-4 text-rose-500 shrink-0 mt-0.5" />
                <span>{workspaceError}</span>
              </div>
            )}

            {workspaceSuccess && (
              <div className="p-3 bg-emerald-50 border border-emerald-200 text-emerald-700 text-xs rounded-lg flex gap-1.5 items-start animate-fade-in">
                <Sparkles className="w-4 h-4 text-emerald-500 shrink-0 mt-0.5" />
                <span>{workspaceSuccess}</span>
              </div>
            )}

            <form onSubmit={handleUpdateWorkspaceSettings} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1">Workspace Name</label>
                <input
                  type="text"
                  required
                  placeholder="Workspace Name"
                  value={workspaceNameInput}
                  onChange={(e) => setWorkspaceNameInput(e.target.value)}
                  className="w-full bg-slate-100 border-none rounded-lg py-2 px-3 text-xs text-slate-800 focus:outline-none focus:ring-1 focus:ring-teal-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1">Security Join Code</label>
                <div className="relative">
                  <input
                    type="text"
                    required
                    placeholder="e.g. urduja-pass"
                    value={joinCodeInput}
                    onChange={(e) => setJoinCodeInput(e.target.value)}
                    className="w-full bg-slate-100 border-none rounded-lg py-2 pl-8 pr-3 text-xs text-slate-800 focus:outline-none focus:ring-1 focus:ring-teal-500 font-mono"
                  />
                  <Key className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-3.5" />
                </div>
                <p className="text-[10px] text-slate-400 mt-1">Changing this code will immediately restrict entry. Only members with this new passcode can register to join.</p>
              </div>

              <button
                type="submit"
                disabled={savingWorkspace}
                className="w-full bg-teal-600 hover:bg-teal-500 text-white font-bold py-2 px-4 rounded-lg text-xs transition disabled:opacity-50 shadow-sm flex items-center justify-center gap-1.5 animate-pulse-once"
              >
                {savingWorkspace ? 'Saving Workspace...' : 'Save Workspace Settings'}
              </button>
            </form>
          </div>

          <div className="bg-white rounded-xl border border-slate-200 p-6 space-y-4 shadow-sm">
            <h2 className="text-xs font-bold uppercase tracking-wider text-slate-400 flex items-center gap-2">
              <Briefcase className="w-4 h-4 text-teal-500" />
              <span>Create Channel</span>
            </h2>

            {createError && (
              <div className="p-3 bg-rose-50 border border-rose-200 text-rose-700 text-xs rounded-lg flex gap-1.5 items-start animate-fade-in">
                <AlertTriangle className="w-4 h-4 text-rose-500 shrink-0 mt-0.5" />
                <span>{createError}</span>
              </div>
            )}

            {createSuccess && (
              <div className="p-3 bg-emerald-50 border border-emerald-200 text-emerald-700 text-xs rounded-lg flex gap-1.5 items-start animate-fade-in">
                <Sparkles className="w-4 h-4 text-emerald-500 shrink-0 mt-0.5" />
                <span>{createSuccess}</span>
              </div>
            )}

            <form onSubmit={handleCreateChannel} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1">Channel Name</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. testing, feedback"
                  value={newChannelName}
                  onChange={(e) => setNewChannelName(e.target.value)}
                  className="w-full bg-slate-100 border-none rounded-lg py-2 px-3 text-xs text-slate-800 focus:outline-none focus:ring-1 focus:ring-teal-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1">Description</label>
                <textarea
                  placeholder="What is the channel about?"
                  value={newChannelDesc}
                  onChange={(e) => setNewChannelDesc(e.target.value)}
                  rows={3}
                  className="w-full bg-slate-100 border-none rounded-lg py-2 px-3 text-xs text-slate-800 focus:outline-none focus:ring-1 focus:ring-teal-500 resize-none"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1">Assign Team Lead</label>
                <select
                  value={selectedLeaderId}
                  onChange={(e) => setSelectedLeaderId(e.target.value)}
                  className="w-full bg-slate-100 border-none rounded-lg py-2 px-3 text-xs text-slate-700 focus:outline-none focus:ring-1 focus:ring-teal-500"
                >
                  <option value="">Unassigned</option>
                  {teamLeaders.map((lead) => (
                    <option key={lead.uid} value={lead.uid}>
                      {lead.name}
                    </option>
                  ))}
                </select>
                <span className="text-[10px] text-slate-400 block mt-1">
                  Team leaders can create tasks, assign members, and update task statuses in this channel.
                </span>
              </div>

              <button
                type="submit"
                disabled={loading || !newChannelName.trim()}
                className="w-full bg-slate-900 hover:bg-slate-800 text-white font-bold py-2.5 px-4 rounded-lg text-xs transition disabled:opacity-50 shadow-sm"
              >
                Create Channel Structure
              </button>
            </form>
          </div>
        </div>
      </div>

      {/* Delete Channel Confirmation Modal */}
      {channelToDelete && (
        <div className="fixed inset-0 z-[10000] flex items-center justify-center p-4">
          <div className="fixed inset-0 bg-black/50 backdrop-blur-sm" onClick={() => setChannelToDelete(null)} />
          <div className="bg-white rounded-2xl border border-slate-200 w-full max-w-md p-6 relative z-10 space-y-4 shadow-2xl animate-in fade-in zoom-in-95 duration-200 text-slate-900">
            <div className="flex items-center space-x-2 text-rose-600 border-b border-slate-100 pb-3">
              <AlertTriangle className="w-5 h-5 shrink-0" />
              <h3 className="font-extrabold text-xs uppercase tracking-wide">
                Confirm Permanent Deletion
              </h3>
            </div>
            
            <p className="text-xs text-slate-600 leading-relaxed">
              Are you absolutely sure you want to <span className="font-bold text-rose-600">permanently delete</span> the channel <span className="font-bold text-slate-800">#{channelToDelete.name}</span>?
            </p>
            <p className="text-xs text-slate-500 bg-rose-50 border border-rose-100 p-3 rounded-lg leading-relaxed">
              ⚠️ <span className="font-semibold text-rose-700">This action is irreversible.</span> All messages, attachments, and data directly bound to this channel reference will be permanently deleted.
            </p>

            <div className="flex gap-2 pt-2 border-t border-slate-100">
              <button
                onClick={() => setChannelToDelete(null)}
                disabled={deletingChannelInProgress}
                className="flex-1 bg-slate-100 hover:bg-slate-200 text-slate-600 font-semibold text-xs py-2.5 rounded-lg transition"
              >
                Cancel
              </button>
              <button
                onClick={handleConfirmDeleteChannel}
                disabled={deletingChannelInProgress}
                className="flex-1 bg-rose-600 hover:bg-rose-500 text-white font-bold text-xs py-2.5 rounded-lg transition flex items-center justify-center gap-1.5 shadow-md disabled:opacity-50"
              >
                {deletingChannelInProgress ? 'Deleting...' : 'Delete Channel'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
