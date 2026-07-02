/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { collection, addDoc, doc, setDoc, getDocs, query, where } from 'firebase/firestore';
import { db } from './firebase';
import { UserRole, TaskPriority, TaskStatus } from './types';

// Human-friendly date formatter
export function formatDate(dateString: string): string {
  if (!dateString) return 'No due date';
  try {
    const options: Intl.DateTimeFormatOptions = { year: 'numeric', month: 'short', day: 'numeric' };
    return new Date(dateString).toLocaleDateString('en-US', options);
  } catch (e) {
    return dateString;
  }
}

// Format relative time (e.g. "2 minutes ago")
export function formatRelativeTime(dateString: string): string {
  if (!dateString) return '';
  const now = new Date();
  const past = new Date(dateString);
  const diffMs = now.getTime() - past.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHrs = Math.floor(diffMins / 60);
  const diffDays = Math.floor(diffHrs / 24);

  if (diffMins < 1) return 'Just now';
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHrs < 24) return `${diffHrs}h ago`;
  return `${diffDays}d ago`;
}

// Create default channels for a workspace
export async function seedWorkspaceChannels(workspaceId: string, assignedLeaderId: string = '') {
  const channelsRef = collection(db, 'workspaces', workspaceId, 'channels');
  const defaultChannels = [
    { name: 'general', description: 'Company-wide announcements and work discussions.' },
    { name: 'web-development', description: 'Web application coding, bugs, and deployment tasks.' },
    { name: 'design', description: 'User interfaces, layouts, typography, and wireframes.' },
    { name: 'testing', description: 'Quality assurance, regression tests, and user acceptance reports.' },
    { name: 'documentation', description: 'User manuals, code docs, design guides, and API schemas.' },
    { name: 'announcements', description: 'Crucial team notices, achievements, and milestone logs.' }
  ];

  const createdChannels = [];
  for (const ch of defaultChannels) {
    const channelId = ch.name.toLowerCase().replace(/[^a-z0-9]+/g, '-');
    const chDocRef = doc(channelsRef, channelId);
    const data = {
      id: channelId,
      workspaceId,
      name: ch.name,
      description: ch.description,
      isArchived: false,
      assignedLeaderId: ch.name === 'web-development' ? assignedLeaderId : '', // Assign Leader to a channel for demo
      createdAt: new Date().toISOString()
    };
    await setDoc(chDocRef, data);
    createdChannels.push(data);
  }

  return createdChannels;
}

// Log activity to Firestore
export async function logActivity(
  workspaceId: string,
  userId: string,
  userName: string,
  action: string,
  details: string
) {
  try {
    const logsRef = collection(db, 'workspaces', workspaceId, 'logs');
    await addDoc(logsRef, {
      workspaceId,
      userId,
      userName,
      action,
      details,
      createdAt: new Date().toISOString()
    });
  } catch (e) {
    console.error('Error writing activity log:', e);
  }
}

// Generate demo users to allow easy sign-in
export const DEMO_USERS = [
  {
    email: 'admin@vibecheck.com',
    password: 'password123',
    name: 'Alexis Vance (Admin)',
    role: UserRole.ADMIN,
    avatarColor: 'bg-emerald-500',
  },
  {
    email: 'leader@vibecheck.com',
    password: 'password123',
    name: 'Elena Rostova (Team Leader)',
    role: UserRole.LEADER,
    avatarColor: 'bg-indigo-500',
  },
  {
    email: 'member@vibecheck.com',
    password: 'password123',
    name: 'Dorian Gray (Member)',
    role: UserRole.MEMBER,
    avatarColor: 'bg-amber-500',
  }
];
