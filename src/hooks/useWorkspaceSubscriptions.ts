/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState, useEffect } from 'react';
import { 
  doc, 
  collection, 
  query, 
  where, 
  onSnapshot, 
  orderBy 
} from 'firebase/firestore';
import { db } from '../firebase';
import { 
  UserProfile, 
  Workspace, 
  Channel, 
  Task, 
  Comment, 
  ActivityLog 
} from '../types';

export interface ToastNotification {
  id: string;
  senderName: string;
  details: string;
  action: string;
  createdAt: string;
}

interface UseWorkspaceSubscriptionsProps {
  userProfile: UserProfile | null;
}

export function useWorkspaceSubscriptions({ userProfile }: UseWorkspaceSubscriptionsProps) {
  const [workspace, setWorkspace] = useState<Workspace | null>(null);
  const [channels, setChannels] = useState<Channel[]>([]);
  const [members, setMembers] = useState<UserProfile[]>([]);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [comments, setComments] = useState<Comment[]>([]);
  const [logs, setLogs] = useState<ActivityLog[]>([]);
  const [unreadNotifsCount, setUnreadNotifsCount] = useState(0);
  const [toasts, setToasts] = useState<ToastNotification[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!userProfile) {
      setWorkspace(null);
      setChannels([]);
      setMembers([]);
      setTasks([]);
      setComments([]);
      setLogs([]);
      setUnreadNotifsCount(0);
      setToasts([]);
      return;
    }

    setLoading(true);
    const wId = userProfile.workspaceId;

    // 1. Fetch Workspace Details
    const workspaceRef = doc(db, 'workspaces', wId);
    const unsubWorkspace = onSnapshot(workspaceRef, (snap) => {
      if (snap.exists()) {
        setWorkspace(snap.data() as Workspace);
      } else {
        setWorkspace({
          id: wId,
          name: 'Demo Workspace',
          createdBy: 'system',
          createdAt: new Date().toISOString()
        });
      }
    });

    // 2. Real-time Channels listener
    const channelsRef = collection(db, 'workspaces', wId, 'channels');
    const unsubChannels = onSnapshot(channelsRef, (snapshot) => {
      const chList: Channel[] = [];
      snapshot.forEach((doc) => {
        chList.push({ id: doc.id, ...doc.data() } as Channel);
      });
      setChannels(chList);
    });

    // 3. Real-time Members listener
    const usersQuery = query(collection(db, 'users'), where('workspaceId', '==', wId));
    const unsubMembers = onSnapshot(usersQuery, (snapshot) => {
      const mList: UserProfile[] = [];
      const seenEmails = new Set<string>();
      const seenUids = new Set<string>();
      snapshot.forEach((doc) => {
        const profile = doc.data() as UserProfile;
        const uid = profile.uid || doc.id;
        const emailKey = (profile.email || '').toLowerCase().trim();
        
        if (seenUids.has(uid)) return;
        if (emailKey && seenEmails.has(emailKey)) return;
        
        seenUids.add(uid);
        if (emailKey) {
          seenEmails.add(emailKey);
        }
        
        mList.push({ ...profile, uid });
      });
      setMembers(mList);
    });

    // 4. Real-time Tasks listener
    const tasksRef = collection(db, 'workspaces', wId, 'tasks');
    const unsubTasks = onSnapshot(tasksRef, (snapshot) => {
      const tList: Task[] = [];
      snapshot.forEach((doc) => {
        tList.push({ id: doc.id, ...doc.data() } as Task);
      });
      setTasks(tList);
    });

    // 4.5. Real-time Comments listener (for storage tracking)
    const commentsRef = collection(db, 'workspaces', wId, 'comments');
    const unsubComments = onSnapshot(commentsRef, (snapshot) => {
      const cList: Comment[] = [];
      snapshot.forEach((doc) => {
        cList.push({ id: doc.id, ...doc.data() } as Comment);
      });
      setComments(cList);
    });

    // 5. Real-time Logs listener
    const logsRef = collection(db, 'workspaces', wId, 'logs');
    const logsQuery = query(logsRef, orderBy('createdAt', 'desc'));
    const unsubLogs = onSnapshot(logsQuery, (snapshot) => {
      const lList: ActivityLog[] = [];
      snapshot.forEach((doc) => {
        lList.push({ id: doc.id, ...doc.data() } as ActivityLog);
      });
      setLogs(lList);
    });

    // 6. Real-time Notifications listener for desktop PWA push
    const notificationsRef = collection(db, 'workspaces', wId, 'notifications');
    const notifsQuery = query(
      notificationsRef,
      where('recipientUid', '==', userProfile.uid),
      orderBy('createdAt', 'desc')
    );
    const appLoadTime = new Date().toISOString();
    const seenNotifIds = new Set<string>();
    const unsubNotifs = onSnapshot(notifsQuery, (snapshot) => {
      // Calculate unread notifications count
      let unreadCount = 0;
      snapshot.forEach((doc) => {
        const data = doc.data();
        if (!data.isRead) {
          unreadCount++;
        }
      });
      setUnreadNotifsCount(unreadCount);

      snapshot.docChanges().forEach((change) => {
        if (change.type === 'added') {
          const data = change.doc.data() as any;
          if (data.createdAt > appLoadTime && !seenNotifIds.has(change.doc.id)) {
            seenNotifIds.add(change.doc.id);
            const settings = userProfile.notificationSettings || { pwaEnabled: true };

            // 1. Trigger beautiful in-app toast popup instantly
            const toastId = change.doc.id;
            setToasts((prev) => {
              if (prev.some((t) => t.id === toastId)) return prev;
              return [{
                id: toastId,
                senderName: data.senderName,
                details: data.details,
                action: data.action,
                createdAt: data.createdAt
              }, ...prev].slice(0, 5);
            });

            // Auto-dismiss this toast after 6 seconds
            setTimeout(() => {
              setToasts((prev) => prev.filter((t) => t.id !== toastId));
            }, 6000);

            // 2. Trigger native browser push notification
            if (settings.pwaEnabled && 'Notification' in window && Notification.permission === 'granted') {
              try {
                new Notification(`TEAM 4 Hub: ${data.senderName}`, {
                  body: data.details,
                  icon: '/favicon.ico'
                });
              } catch (err) {
                console.error('Error firing desktop alert:', err);
              }
            }
          }
        }
      });
    });

    setLoading(false);

    return () => {
      unsubWorkspace();
      unsubChannels();
      unsubMembers();
      unsubTasks();
      unsubComments();
      unsubLogs();
      unsubNotifs();
    };
  }, [userProfile]);

  return {
    workspace,
    channels,
    members,
    tasks,
    comments,
    logs,
    unreadNotifsCount,
    toasts,
    setToasts,
    loading
  };
}
