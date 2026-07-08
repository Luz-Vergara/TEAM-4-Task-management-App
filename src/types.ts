/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export enum UserRole {
  ADMIN = 'admin',
  LEADER = 'leader',
  MEMBER = 'member',
}

export enum TaskPriority {
  LOW = 'low',
  MEDIUM = 'medium',
  HIGH = 'high',
}

export enum TaskStatus {
  TODO = 'todo',
  IN_PROGRESS = 'inprogress',
  REVIEW = 'review',
  COMPLETED = 'completed',
}

export interface UserNotificationSettings {
  pwaEnabled: boolean;
  emailEnabled: boolean;
  onTaskCreated: boolean;
  onTaskStatusChanged: boolean;
  onCommentAdded: boolean;
  onTaskDeleted: boolean;
}

export interface UserProfile {
  uid: string;
  name: string;
  email: string;
  role: UserRole;
  workspaceId: string;
  joinedAt: string;
  notificationSettings?: UserNotificationSettings;
}

export interface Workspace {
  id: string;
  name: string;
  createdBy: string;
  createdAt: string;
  joinCode?: string;
}

export interface Channel {
  id: string;
  workspaceId: string;
  name: string;
  description: string;
  isArchived: boolean;
  assignedLeaderId: string; // ID of Team Leader assigned to this channel
  createdAt: string;
  parentId?: string; // Optional parent channel ID for sub-projects
  displayOrder?: number; // Order in the sidebar
}

export interface Attachment {
  id: string;
  name: string;
  url: string;
  type: 'file' | 'drive' | 'link';
  size?: string;
  rawSize?: number;
  uploadedAt: string;
  uploadedBy: string;
}

export interface StatusHistoryEntry {
  id: string;
  userId: string;
  userName: string;
  userRole: UserRole;
  prevStatus: TaskStatus;
  newStatus: TaskStatus;
  createdAt: string;
  remarks?: string;
}

export interface Task {
  id: string;
  workspaceId: string;
  channelId: string;
  title: string;
  description: string;
  assignedUserId: string;
  creatorId: string;
  priority: TaskPriority;
  status: TaskStatus;
  dueDate: string; // YYYY-MM-DD
  createdAt: string;
  updatedAt: string;
  attachments?: Attachment[];
  statusHistory?: StatusHistoryEntry[];
}

export interface Comment {
  id: string;
  workspaceId: string;
  channelId: string;
  taskId: string; // Empty if it's a channel-level discussion message
  userId: string;
  userName: string;
  userRole: UserRole;
  content: string;
  createdAt: string;
  attachments?: Attachment[];
  isStatusLog?: boolean;
  prevStatus?: TaskStatus;
  newStatus?: TaskStatus;
  remarks?: string;
}

export interface ActivityLog {
  id: string;
  workspaceId: string;
  userId: string;
  userName: string;
  action: string;
  details: string;
  createdAt: string;
}

export interface Notification {
  id: string;
  workspaceId: string;
  recipientUid: string;
  recipientEmail: string;
  recipientName: string;
  senderUid: string;
  senderName: string;
  action: 'task_created' | 'task_status_changed' | 'comment_added' | 'task_deleted' | 'system';
  details: string;
  pwaDelivered: boolean;
  emailDelivered: boolean;
  emailSubject: string;
  emailBody: string; // Beautiful HTML preview body
  createdAt: string;
  isRead: boolean;
}
