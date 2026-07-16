/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { collection, doc, addDoc, getDocs, query, where } from 'firebase/firestore';
import { db, messaging } from '../firebase';
import { getToken } from 'firebase/messaging';
import { Task, UserProfile, Notification as NotificationType, UserNotificationSettings } from '../types';

export const DEFAULT_NOTIFICATION_SETTINGS: UserNotificationSettings = {
  pwaEnabled: true,
  emailEnabled: true,
  onTaskCreated: true,
  onTaskStatusChanged: true,
  onCommentAdded: true,
  onTaskDeleted: true,
};

export async function requestNotificationPermission(userId: string) {
  try {
    const permission = await window.Notification.requestPermission();
    if (permission === 'granted') {
      const token = await getToken(messaging, { vapidKey: 'BOh0ISVFsyDw2qZkuilNlC9hhLnSIdQZZd4wIOvPoT6K9QUEOfqr_OikqfKr46JjM3Zypxe-JaxmVx0-dhjS0Jw' });
      console.log('Notification permission granted. Token:', token);
      
      // Save token to Firestore
      if (userId && token) {
        await addDoc(collection(db, 'users', userId, 'fcmTokens'), {
          token,
          createdAt: new Date().toISOString()
        });
      }
      return token;
    }
  } catch (err) {
    console.error('Error requesting notification permission:', err);
  }
  return null;
}

/**
 * Generate a highly polished corporate HTML email template for workspace notifications.
 */
function generateEmailBody(
  recipientName: string,
  senderName: string,
  action: string,
  details: string,
  task?: Task
): { subject: string; html: string } {
  let subject = '';
  let titleText = '';
  let actionDescription = '';
  let accentColor = '#0d9488'; // Teal-600

  switch (action) {
    case 'task_created':
      subject = `[TEAM 4 Hub] New Task Created: "${task?.title || 'Untitled Task'}"`;
      titleText = 'New Task Assigned';
      actionDescription = `${senderName} created a new task and added it to the workspace.`;
      accentColor = '#0d9488'; // Teal
      break;
    case 'task_status_changed':
      subject = `[TEAM 4 Hub] Status Updated: "${task?.title || 'Untitled Task'}" is now ${task?.status.toUpperCase()}`;
      titleText = 'Task Status Updated';
      actionDescription = `${senderName} updated the workflow status of this task.`;
      accentColor = '#3b82f6'; // Blue
      break;
    case 'comment_added':
      subject = `[TEAM 4 Hub] New Comment on "${task?.title || 'Task'}"`;
      titleText = 'New Conversation Activity';
      actionDescription = `${senderName} added a discussion comment to this task.`;
      accentColor = '#8b5cf6'; // Purple
      break;
    case 'task_deleted':
      subject = `[TEAM 4 Hub] Task Archived/Deleted: "${details}"`;
      titleText = 'Task Removed';
      actionDescription = `${senderName} permanently deleted/archived a task from the active queue.`;
      accentColor = '#f43f5e'; // Rose
      break;
    case 'user_joined':
      subject = `[TEAM 4 Hub] New Team Member Joined: ${senderName}`;
      titleText = 'Welcome New Member';
      actionDescription = `${senderName} has entered the workspace space.`;
      accentColor = '#0f766e'; // Deep Teal
      break;
    default:
      subject = `[TEAM 4 Hub] Activity Notification`;
      titleText = 'Workspace Activity Alert';
      actionDescription = `${senderName} performed an action in your workspace.`;
      accentColor = '#64748b'; // Slate
  }

  const taskHtml = task
    ? `
    <div style="background-color: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 16px; margin-top: 16px;">
      <h4 style="margin: 0 0 8px 0; color: #1e293b; font-size: 16px; font-weight: 700;">${task.title}</h4>
      <p style="margin: 0 0 12px 0; color: #475569; font-size: 13px; line-height: 1.5;">${task.description || 'No description provided.'}</p>
      <table style="width: 100%; font-size: 12px; border-collapse: collapse;">
        <tr>
          <td style="padding: 4px 0; color: #64748b; font-weight: 600; width: 80px;">Status:</td>
          <td style="padding: 4px 0;"><span style="background-color: #f1f5f9; color: #334155; padding: 2px 8px; border-radius: 4px; font-weight: 700; text-transform: uppercase;">${task.status}</span></td>
        </tr>
        <tr>
          <td style="padding: 4px 0; color: #64748b; font-weight: 600;">Priority:</td>
          <td style="padding: 4px 0;"><span style="color: ${task.priority === 'high' ? '#ef4444' : task.priority === 'medium' ? '#f59e0b' : '#10b981'}; font-weight: 700; text-transform: uppercase;">${task.priority}</span></td>
        </tr>
        ${task.dueDate ? `
        <tr>
          <td style="padding: 4px 0; color: #64748b; font-weight: 600;">Due Date:</td>
          <td style="padding: 4px 0; color: #1e293b;">${task.dueDate}</td>
        </tr>
        ` : ''}
      </table>
    </div>
    `
    : '';

  const html = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>${subject}</title>
    </head>
    <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background-color: #f1f5f9; margin: 0; padding: 24px;-webkit-font-smoothing: antialiased;">
      <table align="center" border="0" cellpadding="0" cellspacing="0" style="max-width: 600px; width: 100%; background-color: #ffffff; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 6px -1px rgba(0,0,0,0.05), 0 2px 4px -1px rgba(0,0,0,0.03); border: 1px solid #e2e8f0;">
        <!-- Header -->
        <tr>
          <td style="background-color: ${accentColor}; padding: 24px; text-align: center;">
            <h1 style="color: #ffffff; margin: 0; font-size: 20px; font-weight: 800; letter-spacing: -0.5px;">TEAM 4 Hub</h1>
          </td>
        </tr>
        
        <!-- Body Content -->
        <tr>
          <td style="padding: 32px 24px; color: #334155;">
            <p style="margin: 0 0 16px 0; font-size: 15px; font-weight: 600; color: #1e293b;">Hello ${recipientName},</p>
            <p style="margin: 0 0 20px 0; font-size: 14px; line-height: 1.6; color: #475569;">
              ${actionDescription} Here is what changed:
            </p>
            
            <div style="background-color: #f8fafc; border-left: 4px solid ${accentColor}; padding: 12px 16px; margin: 0 0 20px 0; border-radius: 0 8px 8px 0;">
              <p style="margin: 0; font-size: 13.5px; font-style: italic; color: #1e293b; line-height: 1.5;">
                "${details}"
              </p>
            </div>

            ${taskHtml}

            <div style="text-align: center; margin-top: 28px;">
              <a href="https://ai.studio/build" style="display: inline-block; background-color: ${accentColor}; color: #ffffff; padding: 10px 20px; font-size: 13px; font-weight: 700; text-decoration: none; border-radius: 6px; box-shadow: 0 2px 4px rgba(0,0,0,0.1);">
                Open Task Dashboard
              </a>
            </div>
          </td>
        </tr>
        
        <!-- Footer -->
        <tr>
          <td style="background-color: #f8fafc; padding: 16px 24px; text-align: center; border-top: 1px solid #e2e8f0; color: #64748b; font-size: 11px;">
            <p style="margin: 0 0 4px 0;">This is an automated notification dispatch from your TEAM 4 Hub Workspace.</p>
            <p style="margin: 0;">&copy; 2026 TEAM 4 Hub &bull; <a href="https://ai.studio/build" style="color: ${accentColor}; text-decoration: none;">Manage Preferences</a></p>
          </td>
        </tr>
      </table>
    </body>
    </html>
  `;

  return { subject, html };
}

/**
 * Dispatches PWA Push Notifications and email logs to all workspace members in Firestore.
 */
export async function dispatchNotification(
  workspaceId: string,
  action: string,
  details: string,
  triggerUser: { uid: string; name: string; email?: string },
  task?: Task | null,
  extra?: { channelId?: string | null; channelName?: string | null; targetId?: string | null; notificationType?: string; milestoneTitle?: string }
) {
  try {
    // 1. Fetch all members in the workspace to see who gets notified
    const usersQuery = query(collection(db, 'users'), where('workspaceId', '==', workspaceId));
    const querySnapshot = await getDocs(usersQuery);
    
    const members: UserProfile[] = [];
    querySnapshot.forEach((doc) => {
      const data = doc.data();
      members.push({
        ...data,
        uid: doc.id || data.uid // Ensure we fall back to document ID which is the authenticated uid
      } as UserProfile);
    });

    // 2. Fetch all channels to resolve names
    const channelsQuery = collection(db, 'workspaces', workspaceId, 'channels');
    const channelsSnapshot = await getDocs(channelsQuery);
    const channelsMap = new Map<string, string>();
    channelsSnapshot.forEach((doc) => {
      channelsMap.set(doc.id, doc.data().name || '');
    });

    const notificationsRef = collection(db, 'workspaces', workspaceId, 'notifications');

    // Fetch participants of the task discussion once if action is 'comment_added' and task is present
    const participantUidsSet = new Set<string>();
    if (action === 'comment_added' && task?.id) {
      try {
        const commentsQuery = query(
          collection(db, 'workspaces', workspaceId, 'comments'),
          where('taskId', '==', task.id)
        );
        const commentsSnapshot = await getDocs(commentsQuery);
        commentsSnapshot.forEach((d) => {
          const cData = d.data();
          if (cData.userId) {
            participantUidsSet.add(cData.userId);
          }
        });
      } catch (err) {
        console.error('Error fetching participants for comment notification:', err);
      }
    }

    // Resolve the triggering user's email address if not provided in the payload
    const triggerEmail = triggerUser.email || members.find(m => m.uid === triggerUser.uid)?.email;

    const dispatchPromises = members.map(async (member) => {
      // "Do not notify users about actions they performed themselves."
      // Prevent notifying users of their own actions by matching both UID and email address.
      const isSelf = (member.uid === triggerUser.uid || 
                     (member.email && triggerEmail && member.email.toLowerCase() === triggerEmail.toLowerCase()));
      
      if (isSelf) {
        return;
      }

      // Get notification preferences, fallback to defaults if not set
      const settings = member.notificationSettings || DEFAULT_NOTIFICATION_SETTINGS;

      // Determine personalized notification fields
      let notificationType = extra?.notificationType || action;
      let message = details;
      let isEnabledForAction = false;

      // Evaluate personalized notification triggers
      if (action === 'task_created') {
        if (task && task.assignedUserId === member.uid) {
          notificationType = 'task_assigned';
          message = `${triggerUser.name} assigned you the task "${task.title}"`;
          isEnabledForAction = settings.onTaskCreated;
        } else {
          // Standard creation, send if enabled and relevant
          notificationType = 'task_created';
          message = `${triggerUser.name} created task "${task?.title || 'Untitled Task'}"`;
          isEnabledForAction = settings.onTaskCreated;
        }
      } else if (action === 'task_status_changed') {
        const isRelated = task && (task.assignedUserId === member.uid || task.creatorId === member.uid);
        if (isRelated) {
          notificationType = 'task_status_changed';
          message = `${triggerUser.name} updated status of "${task?.title}" to "${task?.status?.toUpperCase()}"`;
          isEnabledForAction = settings.onTaskStatusChanged;
        } else {
          return; // only notify users related to the task
        }
      } else if (action === 'comment_added') {
        const commentText = details.split('commented: ')[1] || details;
        const isMentioned = commentText.toLowerCase().includes('@' + member.name.toLowerCase().replace(/\s+/g, '')) || 
                            commentText.toLowerCase().includes(member.name.toLowerCase());
        
        const isAssigned = task && (
          task.assignedUserId === member.uid || 
          (task.assignedUserIds && task.assignedUserIds.includes(member.uid))
        );
        const isCreator = task && task.creatorId === member.uid;
        const isParticipant = participantUidsSet.has(member.uid);
        const isRelated = isAssigned || isCreator || isParticipant;

        if (isMentioned) {
          notificationType = 'mention_comment';
          message = `${triggerUser.name} mentioned you in a comment on "${task?.title}": "${commentText}"`;
          isEnabledForAction = settings.onCommentAdded;
        } else if (isRelated) {
          notificationType = 'comment_added';
          message = `${triggerUser.name} commented on task "${task?.title}": "${commentText}"`;
          isEnabledForAction = settings.onCommentAdded;
        } else {
          return; // only notify if mentioned or related (assigned/creator/participant)
        }
      } else if (action === 'target_assigned') {
        if (extra?.targetId) {
          notificationType = 'target_assigned';
          message = details; // Already structured e.g. "Lucy assigned you target 'Prepare draft CS'"
          isEnabledForAction = true; // Always notify for target assignments!
        } else {
          return;
        }
      } else if (action === 'target_progress_updated' || action === 'target_progress') {
        notificationType = 'target_progress';
        message = details;
        isEnabledForAction = true; // Always notify progress!
      } else if (action === 'task_deleted') {
        isEnabledForAction = settings.onTaskDeleted;
      } else if (action === 'user_joined') {
        isEnabledForAction = true; // Always notify user joined alerts!
      } else {
        isEnabledForAction = true;
      }

      if (!isEnabledForAction) return;

      // Generate the beautiful HTML email content and subject
      const emailContent = generateEmailBody(member.name, triggerUser.name, action, message, task || undefined);

      const resolvedChannelId = extra?.channelId || task?.channelId || null;
      const resolvedChannelName = extra?.channelName || (resolvedChannelId ? (channelsMap.get(resolvedChannelId) || resolvedChannelId) : null) || null;

      const notificationDoc = {
        workspaceId,
        recipientUid: member.uid,
        recipientEmail: member.email,
        recipientName: member.name,
        senderUid: triggerUser.uid,
        senderName: triggerUser.name,
        action: action,
        details: message,
        pwaDelivered: settings.pwaEnabled,
        emailDelivered: settings.emailEnabled,
        emailSubject: emailContent.subject,
        emailBody: emailContent.html,
        createdAt: new Date().toISOString(),
        isRead: false,
        taskId: task?.id || null,
        taskTitle: task?.title || null,
        taskDescription: task?.description || null,
        taskStatus: task?.status || null,
        taskPriority: task?.priority || null,
        taskDueDate: task?.dueDate || null,

        // Required specific fields for personal Notification Center
        recipientUserId: member.uid,
        actorUserId: triggerUser.uid,
        channelId: resolvedChannelId,
        channelName: resolvedChannelName,
        targetId: extra?.targetId || task?.targetId || null,
        notificationType: notificationType,
        message: message,
      };

      // Add notification document to Firestore
      await addDoc(notificationsRef, notificationDoc);

      // Trigger real email dispatch via our Node.js back-end proxy
      if (settings.emailEnabled && member.email) {
        try {
          const res = await fetch('/api/send-email', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              to: member.email,
              recipientName: member.name,
              subject: emailContent.subject,
              html: emailContent.html,
            }),
          });
          const data = await res.json();
          console.log(`Email dispatch response for ${member.email}:`, data);
        } catch (emailErr) {
          console.error(`Error dispatching email for ${member.email}:`, emailErr);
        }
      }
    });

    await Promise.all(dispatchPromises);
  } catch (err) {
    console.error('Error dispatching notifications:', err);
  }
}

/**
 * Scans active tasks assigned to the user, checks if they are due soon or overdue,
 * and generates appropriate personal Notification documents in real-time.
 */
export async function checkAndGenerateDueSoonOverdueNotifications(
  workspaceId: string,
  userProfile: UserProfile,
  tasks: Task[]
) {
  try {
    const todayStr = new Date().toISOString().split('T')[0];
    // Due soon is today or within the next 2 days
    const twoDaysLater = new Date(Date.now() + 2 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];

    // Filter active tasks assigned to this user that have a due date and are not completed
    const myActiveTasks = tasks.filter(
      (t) => t.assignedUserId === userProfile.uid && t.status !== 'completed' && t.dueDate
    );

    const notificationsRef = collection(db, 'workspaces', workspaceId, 'notifications');

    for (const task of myActiveTasks) {
      if (!task.dueDate) continue;

      let type: 'task_due_soon' | 'task_overdue' | null = null;
      let msg = '';

      if (task.dueDate < todayStr) {
        type = 'task_overdue';
        msg = `Your task "${task.title}" is overdue (due ${task.dueDate}).`;
      } else if (task.dueDate <= twoDaysLater) {
        type = 'task_due_soon';
        msg = `Your task "${task.title}" is due soon (due ${task.dueDate}).`;
      }

      if (type) {
        // Query to check if a notification of this type has already been generated for this task in the last 24 hours
        const q = query(
          notificationsRef,
          where('recipientUserId', '==', userProfile.uid),
          where('taskId', '==', task.id),
          where('notificationType', '==', type)
        );
        const snap = await getDocs(q);
        
        let alreadyExists = false;
        snap.forEach((doc) => {
          const d = doc.data();
          const ageMs = Date.now() - new Date(d.createdAt).getTime();
          // Check if created in last 24 hours
          if (ageMs < 24 * 60 * 60 * 1000) {
            alreadyExists = true;
          }
        });

        if (!alreadyExists) {
          // Add the notification document
          await addDoc(notificationsRef, {
            workspaceId,
            recipientUid: userProfile.uid,
            recipientEmail: userProfile.email,
            recipientName: userProfile.name,
            senderUid: 'system',
            senderName: 'System',
            action: type,
            details: msg,
            pwaDelivered: true,
            emailDelivered: false,
            emailSubject: `[TEAM 4 Hub] Task Attention Required: "${task.title}"`,
            emailBody: `Your task "${task.title}" is ${type === 'task_overdue' ? 'overdue' : 'due soon'}.`,
            createdAt: new Date().toISOString(),
            isRead: false,
            taskId: task.id,
            taskTitle: task.title,
            taskDescription: task.description || null,
            taskStatus: task.status,
            taskPriority: task.priority,
            taskDueDate: task.dueDate,

            recipientUserId: userProfile.uid,
            actorUserId: 'system',
            channelId: task.channelId || null,
            channelName: null,
            targetId: task.targetId || null,
            notificationType: type,
            message: msg
          });
        }
      }
    }
  } catch (err) {
    console.error('Error generating due soon/overdue notifications:', err);
  }
}
