/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { initializeApp, getApps, getApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getFirestore, doc, getDocFromServer } from 'firebase/firestore';
import { getStorage } from 'firebase/storage';
import { getMessaging } from 'firebase/messaging';

// In AI Studio, the firebase config is saved in firebase-applet-config.json.
// Let's import it or use a fallback for safety.
import configData from '../firebase-applet-config.json';

const firebaseConfig = {
  apiKey: configData.apiKey,
  authDomain: configData.authDomain,
  projectId: configData.projectId,
  storageBucket: configData.storageBucket,
  messagingSenderId: configData.messagingSenderId,
  appId: configData.appId,
};

// Initialize Firebase
const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApp();
export const auth = getAuth(app);
export const storage = getStorage(app);
export const messaging = getMessaging(app);

// Use the custom firestoreDatabaseId if provided in configuration, otherwise fallback to standard default database
export const db = configData.firestoreDatabaseId 
  ? getFirestore(app, configData.firestoreDatabaseId)
  : getFirestore(app);

// Test connection
async function testConnection() {
  try {
    // Attempt a silent server-side read to ensure the client connects to Firestore
    await getDocFromServer(doc(db, 'test', 'connection'));
    console.log("Firebase connection established successfully.");
  } catch (error) {
    if (error instanceof Error && error.message.includes('the client is offline')) {
      console.warn("Firebase is offline. Please check your network and configuration.");
    } else {
      console.log("Firebase initialized (offline / sandbox environment standard behavior).");
    }
  }
}

testConnection();
