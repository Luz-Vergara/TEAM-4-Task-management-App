import { initializeApp } from 'firebase/app';
import { getFirestore, collection, getDocs, query, where } from 'firebase/firestore';
import { getAuth, signInWithEmailAndPassword } from 'firebase/auth';
import * as fs from 'fs';
import * as path from 'path';

const configPath = path.join(process.cwd(), 'firebase-applet-config.json');
const configData = JSON.parse(fs.readFileSync(configPath, 'utf-8'));

const firebaseConfig = {
  apiKey: configData.apiKey,
  authDomain: configData.authDomain,
  projectId: configData.projectId,
  storageBucket: configData.storageBucket,
  messagingSenderId: configData.messagingSenderId,
  appId: configData.appId,
};

const app = initializeApp(firebaseConfig);
const db = configData.firestoreDatabaseId 
  ? getFirestore(app, configData.firestoreDatabaseId)
  : getFirestore(app);
const auth = getAuth(app);

async function run() {
  console.log("=== CHECK SACHI ===");
  try {
    await signInWithEmailAndPassword(auth, 'admin@vibecheck.com', 'password123');
    const q = query(collection(db, 'users'), where('workspaceId', '==', 'default-workspace'));
    const snap = await getDocs(q);
    snap.forEach(doc => {
      const data = doc.data();
      if (data.name.toLowerCase().includes('sachi') || (data.email && data.email.toLowerCase().includes('sachi'))) {
        console.log(`Doc ID: ${doc.id}`);
        console.log(`Data:`, JSON.stringify(data, null, 2));
        console.log(`-----------------------------------`);
      }
    });
    process.exit(0);
  } catch (err) {
    console.error(err);
    process.exit(1);
  }
}

run();
