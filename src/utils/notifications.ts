/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { collection, doc, addDoc, getDocs, query, where } from 'firebase/firestore';
import { db } from '../firebase';
import { Task, UserProfile, Notification, UserNotificationSettings } from '../types';

export const DEFAULT_NOTIFICATION_SETTINGS: UserNotificationSettings = {
  pwaEnabled: true,
  emailEnabled: true,
  onTaskCreated: true,
  onTaskStatusChanged: true,
  onCommentAdded: true,
  onTaskDeleted: true,
};

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
      subject = `[VibeCheck] New Task Created: "${task?.title || 'Untitled Task'}"`;
      titleText = 'New Task Assigned';
      actionDescription = `${senderName} created a new task and added it to the workspace.`;
      accentColor = '#0d9488'; // Teal
      break;
    case 'task_status_changed':
      subject = `[VibeCheck] Status Updated: "${task?.title || 'Untitled Task'}" is now ${task?.status.toUpperCase()}`;
      titleText = 'Task Status Updated';
      actionDescription = `${senderName} updated the workflow status of this task.`;
      accentColor = '#3b82f6'; // Blue
      break;
    case 'comment_added':
      subject = `[VibeCheck] New Comment on "${task?.title || 'Task'}"`;
      titleText = 'New Conversation Activity';
      actionDescription = `${senderName} added a discussion comment to this task.`;
      accentColor = '#8b5cf6'; // Purple
      break;
    case 'task_deleted':
      subject = `[VibeCheck] Task Archived/Deleted: "${details}"`;
      titleText = 'Task Removed';
      actionDescription = `${senderName} permanently deleted/archived a task from the active queue.`;
      accentColor = '#f43f5e'; // Rose
      break;
    default:
      subject = `[VibeCheck] Activity Notification`;
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
            <h1 style="color: #ffffff; margin: 0; font-size: 20px; font-weight: 800; letter-spacing: -0.5px;">VibeCheck Workflow Hub</h1>
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
            <p style="margin: 0 0 4px 0;">This is an automated notification dispatch from your VibeCheck Workspace.</p>
            <p style="margin: 0;">&copy; 2026 VibeCheck Inc. &bull; <a href="https://ai.studio/build" style="color: ${accentColor}; text-decoration: none;">Manage Preferences</a></p>
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
  action: 'task_created' | 'task_status_changed' | 'comment_added' | 'task_deleted',
  details: string,
  triggerUser: { uid: string; name: string; email?: string },
  task?: Task
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

    const notificationsRef = collection(db, 'workspaces', workspaceId, 'notifications');

    // Resolve the triggering user's email address if not provided in the payload
    const triggerEmail = triggerUser.email || members.find(m => m.uid === triggerUser.uid)?.email;

    for (const member of members) {
      // Prevent notifying users of their own actions by matching both UID and email address.
      // However, if the user has a TESDA email address, we do NOT skip them. This guarantees
      // that they receive the notification on their TESDA emails for both active logs and testing verification.
      const isTesda = member.email && (
        member.email.toLowerCase().endsWith('@tesda.gov.ph') || 
        member.email.toLowerCase().endsWith('@tesda.com')
      );
      const isSelf = (member.uid === triggerUser.uid || 
                     (member.email && triggerEmail && member.email.toLowerCase() === triggerEmail.toLowerCase())) && !isTesda;
      
      if (isSelf) {
        continue;
      }

      // Get notification preferences, fallback to defaults if not set
      const settings = member.notificationSettings || DEFAULT_NOTIFICATION_SETTINGS;

      // Check if this action type is enabled by user settings
      let isEnabledForAction = false;
      if (action === 'task_created' && settings.onTaskCreated) isEnabledForAction = true;
      if (action === 'task_status_changed' && settings.onTaskStatusChanged) isEnabledForAction = true;
      if (action === 'comment_added' && settings.onCommentAdded) isEnabledForAction = true;
      if (action === 'task_deleted' && settings.onTaskDeleted) isEnabledForAction = true;

      if (!isEnabledForAction) continue;

      // Generate the beautiful HTML email content and subject
      const emailContent = generateEmailBody(member.name, triggerUser.name, action, details, task);

      const notificationDoc = {
        workspaceId,
        recipientUid: member.uid,
        recipientEmail: member.email,
        recipientName: member.name,
        senderUid: triggerUser.uid,
        senderName: triggerUser.name,
        action,
        details,
        pwaDelivered: settings.pwaEnabled,
        emailDelivered: settings.emailEnabled,
        emailSubject: emailContent.subject,
        emailBody: emailContent.html,
        createdAt: new Date().toISOString(),
        isRead: false,
      };

      // Add notification document to Firestore
      await addDoc(notificationsRef, notificationDoc);

      // Trigger real email dispatch via our Node.js back-end proxy
      if (settings.emailEnabled && member.email) {
        try {
          fetch('/api/send-email', {
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
          }).then(res => res.json())
            .then(data => {
              console.log('Email dispatch response:', data);
            })
            .catch(e => {
              console.error('Email fetch error:', e);
            });
        } catch (emailErr) {
          console.error('Error initiating email dispatch fetch:', emailErr);
        }
      }
    }
  } catch (err) {
    console.error('Error dispatching notifications:', err);
  }
}
