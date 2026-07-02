/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { 
  signInWithEmailAndPassword, 
  createUserWithEmailAndPassword,
  signOut,
  GoogleAuthProvider,
  signInWithPopup
} from 'firebase/auth';
import { doc, getDoc, setDoc, collection, query, where, getDocs } from 'firebase/firestore';
import { auth, db } from '../firebase';
import { UserRole, UserProfile } from '../types';
import { DEMO_USERS, seedWorkspaceChannels, logActivity } from '../utils';
import { motion } from 'motion/react';
import { Compass, Key, Mail, User, Shield, Users, Layers, AlertTriangle, Loader2 } from 'lucide-react';
import configData from '../../firebase-applet-config.json';

interface AuthScreenProps {
  onAuthSuccess: (userProfile: UserProfile) => void;
}

export default function AuthScreen({ onAuthSuccess }: AuthScreenProps) {
  const [isLogin, setIsLogin] = useState(true);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [role, setRole] = useState<UserRole>(UserRole.MEMBER);
  const [workspaceAction, setWorkspaceAction] = useState<'create' | 'join'>('create');
  const [workspaceName, setWorkspaceName] = useState('');
  const [workspaceId, setWorkspaceId] = useState('');
  
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [demoLoading, setDemoLoading] = useState<string | null>(null);
  const [showEnableEmailAuthGuide, setShowEnableEmailAuthGuide] = useState(false);

  // Helper: Create profile in Firestore and trigger callback
  const createProfileAndAuthenticate = async (
    uid: string, 
    userEmail: string, 
    userName: string, 
    userRole: UserRole, 
    wId: string, 
    wName?: string,
    isNewWorkspace: boolean = false
  ) => {
    let finalWorkspaceId = wId.trim().toLowerCase().replace(/[^a-z0-9]+/g, '-');
    if (!finalWorkspaceId) {
      finalWorkspaceId = 'general-workspace';
    }

    // 1. Ensure Workspace exists
    const workspaceRef = doc(db, 'workspaces', finalWorkspaceId);
    const workspaceSnap = await getDoc(workspaceRef);

    if (isNewWorkspace || !workspaceSnap.exists()) {
      await setDoc(workspaceRef, {
        id: finalWorkspaceId,
        name: wName || workspaceName || 'Team Workspace',
        createdBy: uid,
        createdAt: new Date().toISOString()
      });
      // Seed default channels
      await seedWorkspaceChannels(finalWorkspaceId, userRole === UserRole.LEADER ? uid : '');
    }

    // 2. Write/Update User Profile
    const profile: UserProfile = {
      uid,
      name: userName,
      email: userEmail,
      role: userRole,
      workspaceId: finalWorkspaceId,
      joinedAt: new Date().toISOString()
    };

    await setDoc(doc(db, 'users', uid), profile);

    // 3. Log user registration/join activity
    await logActivity(
      finalWorkspaceId,
      uid,
      userName,
      isNewWorkspace ? 'workspace_created' : 'workspace_joined',
      `${userName} joined workspace "${wName || workspaceName || finalWorkspaceId}" as ${userRole}`
    );

    onAuthSuccess(profile);
  };

  // Regular Auth submit
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setShowEnableEmailAuthGuide(false);
    setLoading(true);

    try {
      if (isLogin) {
        // Sign In
        const userCred = await signInWithEmailAndPassword(auth, email, password);
        const userDoc = await getDoc(doc(db, 'users', userCred.user.uid));
        
        if (userDoc.exists()) {
          onAuthSuccess(userDoc.data() as UserProfile);
        } else {
          // If Firestore profile doesn't exist but auth exists, build a member profile
          await createProfileAndAuthenticate(
            userCred.user.uid,
            userCred.user.email || email,
            userCred.user.displayName || email.split('@')[0],
            UserRole.MEMBER,
            'default-workspace',
            'Default Workspace',
            true
          );
        }
      } else {
        // Sign Up (Create User)
        if (!name.trim()) {
          throw new Error('Full name is required');
        }
        if (workspaceAction === 'create' && !workspaceName.trim()) {
          throw new Error('Workspace name is required to create a new workspace');
        }
        if (workspaceAction === 'join' && !workspaceId.trim()) {
          throw new Error('Workspace ID is required to join a workspace');
        }

        const userCred = await createUserWithEmailAndPassword(auth, email, password);
        const targetWorkspaceId = workspaceAction === 'create' 
          ? workspaceName.trim().toLowerCase().replace(/[^a-z0-9]+/g, '-') 
          : workspaceId.trim();

        await createProfileAndAuthenticate(
          userCred.user.uid,
          email,
          name,
          role,
          targetWorkspaceId,
          workspaceAction === 'create' ? workspaceName : undefined,
          workspaceAction === 'create'
        );
      }
    } catch (err: any) {
      console.error(err);
      if (err.code === 'auth/operation-not-allowed' || (err.message && err.message.includes('operation-not-allowed'))) {
        setShowEnableEmailAuthGuide(true);
      }
      setError(err.message || 'An authentication error occurred');
    } finally {
      setLoading(false);
    }
  };

  // Demo user login handler with automatic Firebase creation if not exists!
  const handleDemoLogin = async (demo: typeof DEMO_USERS[0]) => {
    setError('');
    setShowEnableEmailAuthGuide(false);
    setDemoLoading(demo.name);

    try {
      // 1. Try logging in
      let userCred;
      try {
        userCred = await signInWithEmailAndPassword(auth, demo.email, demo.password);
      } catch (signInErr: any) {
        // 2. If user doesn't exist, create it!
        if (signInErr.code === 'auth/user-not-found' || signInErr.code === 'auth/invalid-credential') {
          userCred = await createUserWithEmailAndPassword(auth, demo.email, demo.password);
        } else {
          throw signInErr;
        }
      }

      // 3. Confirm Firestore profile exists, or build/initialize it!
      const demoWorkspaceId = 'demo-workspace';
      const demoWorkspaceName = 'Apollo Headquarters';
      
      const userDoc = await getDoc(doc(db, 'users', userCred.user.uid));
      if (userDoc.exists()) {
        onAuthSuccess(userDoc.data() as UserProfile);
      } else {
        await createProfileAndAuthenticate(
          userCred.user.uid,
          demo.email,
          demo.name,
          demo.role,
          demoWorkspaceId,
          demoWorkspaceName,
          true // Always seed/ensure demo-workspace channels exist
        );
      }
    } catch (err: any) {
      console.error('Demo auth error:', err);
      if (err.code === 'auth/operation-not-allowed' || (err.message && err.message.includes('operation-not-allowed'))) {
        setShowEnableEmailAuthGuide(true);
      }
      setError(`Demo login failed: ${err.message}`);
    } finally {
      setDemoLoading(null);
    }
  };

  const handleGoogleLogin = async () => {
    setError('');
    setShowEnableEmailAuthGuide(false);
    setLoading(true);

    try {
      const provider = new GoogleAuthProvider();
      const userCred = await signInWithPopup(auth, provider);
      const userDoc = await getDoc(doc(db, 'users', userCred.user.uid));

      if (userDoc.exists()) {
        onAuthSuccess(userDoc.data() as UserProfile);
      } else {
        await createProfileAndAuthenticate(
          userCred.user.uid,
          userCred.user.email || '',
          userCred.user.displayName || 'Google User',
          UserRole.MEMBER,
          'default-workspace',
          'Default Workspace',
          true
        );
      }
    } catch (err: any) {
      console.error('Google Sign-In Error:', err);
      setError(err.message || 'An error occurred during Google Sign-In');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 flex flex-col md:flex-row font-sans selection:bg-teal-500 selection:text-white">
      {/* Left Banner Section */}
      <div className="w-full md:w-1/2 bg-[#0a0f1d] text-slate-100 p-8 md:p-12 lg:p-16 flex flex-col justify-between border-b md:border-b-0 md:border-r border-slate-800">
        <div className="flex items-center space-x-3">
          <div className="w-10 h-10 bg-teal-500/10 rounded-xl flex items-center justify-center shadow-lg border border-teal-500/20">
            <Compass className="w-5 h-5 text-teal-400" />
          </div>
          <span className="text-xl font-bold tracking-tight bg-clip-text text-transparent bg-gradient-to-r from-white to-slate-400">
            Synapse <span className="text-teal-400 font-medium">Workspace</span>
          </span>
        </div>

        <div className="my-12 md:my-0 space-y-6 max-w-lg">
          <h1 className="text-4xl lg:text-5xl font-extrabold tracking-tight leading-none text-white">
            Where your team connects and tasks align.
          </h1>
          <p className="text-slate-400 text-lg">
            A secure, collaborative workplace for project managers, team leaders, and members to seamlessly coordinate, comment, and deliver results.
          </p>
          <div className="space-y-3 pt-4">
            <div className="flex items-start space-x-3 text-sm text-slate-300">
              <div className="w-5 h-5 rounded-full bg-slate-900 flex items-center justify-center mt-0.5 border border-slate-800">
                <Users className="w-3 h-3 text-teal-400" />
              </div>
              <div>
                <strong className="text-white font-medium">Workspaces & Channels:</strong> Structured environments mimicking professional slack teams.
              </div>
            </div>
            <div className="flex items-start space-x-3 text-sm text-slate-300">
              <div className="w-5 h-5 rounded-full bg-slate-900 flex items-center justify-center mt-0.5 border border-slate-800">
                <Layers className="w-3 h-3 text-teal-400" />
              </div>
              <div>
                <strong className="text-white font-medium">Role-based Access:</strong> Built-in controls for Admins, Team Leaders, and Members.
              </div>
            </div>
          </div>
        </div>

        <div className="text-xs text-slate-500">
          Powered by Google AI Studio & Firebase. Secure & Sandboxed.
        </div>
      </div>

      {/* Right Form / Demo Section */}
      <div className="w-full md:w-1/2 p-8 md:p-12 lg:p-16 flex flex-col justify-center overflow-y-auto bg-slate-50">
        <div className="max-w-md w-full mx-auto space-y-8">
          {/* Header */}
          <div className="space-y-2">
            <h2 className="text-2xl font-extrabold text-slate-900 tracking-tight">
              {isLogin ? 'Welcome back' : 'Create an account'}
            </h2>
            <p className="text-slate-500 text-sm">
              {isLogin 
                ? "Sign in to access your team's workspace, or select a demo role below." 
                : 'Start a new workspace or join an existing project group.'}
            </p>
          </div>

          {/* Demo Logins */}
          {isLogin && (
            <div className="space-y-3 bg-white p-5 rounded-xl border border-slate-200 shadow-sm">
              <div className="flex items-center justify-between text-xs font-semibold uppercase tracking-wider text-slate-450 mb-1">
                <span>Quick Demo Accounts</span>
                <span className="text-teal-600 font-bold normal-case">One-click simulation</span>
              </div>
              <div className="grid grid-cols-1 gap-2">
                {DEMO_USERS.map((user) => (
                  <button
                    key={user.email}
                    type="button"
                    onClick={() => handleDemoLogin(user)}
                    disabled={!!demoLoading || loading}
                    className="flex items-center justify-between p-3 rounded-lg bg-slate-50 hover:bg-slate-100/70 border border-slate-200 transition text-left text-sm font-medium text-slate-700 group disabled:opacity-50"
                  >
                    <div className="flex items-center space-x-3">
                      <div className={`w-2.5 h-2.5 rounded-full ${user.avatarColor}`} />
                      <div>
                        <div className="text-slate-800 group-hover:text-teal-600 transition font-bold text-xs">{user.name}</div>
                        <div className="text-xs text-slate-500 font-normal">Role: {user.role.toUpperCase()}</div>
                      </div>
                    </div>
                    {demoLoading === user.name ? (
                      <Loader2 className="w-4 h-4 text-slate-400 animate-spin" />
                    ) : (
                      <span className="text-xs text-teal-600 group-hover:underline font-bold">Login &rarr;</span>
                    )}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Main Auth Form */}
          <form onSubmit={handleSubmit} className="space-y-4">
            {error && (
              <div className="space-y-3">
                {showEnableEmailAuthGuide ? (
                  <div className="bg-rose-50 border border-rose-200 p-4 rounded-xl text-rose-800 space-y-2 text-xs leading-relaxed shadow-sm">
                    <div className="flex items-start gap-2">
                      <AlertTriangle className="w-4.5 h-4.5 text-rose-600 shrink-0 mt-0.5" />
                      <div>
                        <p className="font-bold text-sm text-rose-900">Email/Password Sign-In is Disabled</p>
                        <p className="text-rose-700 mt-1 font-medium">Your Firebase project has not enabled the Email/Password sign-in provider. To enable it:</p>
                      </div>
                    </div>
                    <ol className="list-decimal pl-5 space-y-1 text-rose-700 mt-2">
                      <li>Open the <a href={`https://console.firebase.google.com/project/${configData.projectId}/authentication/providers`} target="_blank" rel="noopener noreferrer" className="underline font-bold hover:text-rose-900">Firebase Authentication Console</a>.</li>
                      <li>Click <strong>Add new provider</strong> and select <strong>Email/Password</strong>.</li>
                      <li>Toggle on <strong>Enable</strong> and click <strong>Save</strong>.</li>
                      <li>Refresh this app and try logging in again!</li>
                    </ol>
                  </div>
                ) : (
                  <div className="flex items-start space-x-2 bg-rose-50 border border-rose-200 p-3 rounded-lg text-rose-700 text-xs">
                    <AlertTriangle className="w-4 h-4 text-rose-500 shrink-0 mt-0.5" />
                    <span>{error}</span>
                  </div>
                )}
              </div>
            )}

            {!isLogin && (
              <>
                <div>
                  <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1">Full Name</label>
                  <div className="relative">
                    <User className="absolute left-3 top-2.5 h-5 w-5 text-slate-400" />
                    <input
                      type="text"
                      required
                      placeholder="e.g. John Doe"
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      className="pl-10 w-full bg-white border border-slate-200 rounded-lg py-2.5 text-sm text-slate-800 focus:outline-none focus:ring-1 focus:ring-teal-500 transition"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1">Your Role</label>
                  <div className="relative">
                    <Shield className="absolute left-3 top-2.5 h-5 w-5 text-slate-400" />
                    <select
                      value={role}
                      onChange={(e) => setRole(e.target.value as UserRole)}
                      className="pl-10 w-full bg-white border border-slate-200 rounded-lg py-2.5 text-sm text-slate-700 focus:outline-none focus:ring-1 focus:ring-teal-500 transition appearance-none"
                    >
                      <option value={UserRole.MEMBER}>Member (Standard permissions)</option>
                      <option value={UserRole.LEADER}>Team Leader (Manage tasks/channels)</option>
                      <option value={UserRole.ADMIN}>Workspace Administrator (Full control)</option>
                    </select>
                  </div>
                </div>

                <div className="bg-white p-4 rounded-xl border border-slate-200 space-y-3">
                  <div className="flex space-x-2">
                    <button
                      type="button"
                      onClick={() => setWorkspaceAction('create')}
                      className={`flex-1 py-1 px-3 text-xs font-semibold rounded-md border transition ${
                        workspaceAction === 'create'
                          ? 'bg-teal-50 border-teal-200 text-teal-700'
                          : 'bg-white border-slate-200 text-slate-500 hover:text-slate-700'
                      }`}
                    >
                      Create Workspace
                    </button>
                    <button
                      type="button"
                      onClick={() => setWorkspaceAction('join')}
                      className={`flex-1 py-1 px-3 text-xs font-semibold rounded-md border transition ${
                        workspaceAction === 'join'
                          ? 'bg-teal-50 border-teal-200 text-teal-700'
                          : 'bg-white border-slate-200 text-slate-500 hover:text-slate-700'
                      }`}
                    >
                      Join Workspace
                    </button>
                  </div>

                  {workspaceAction === 'create' ? (
                    <div>
                      <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1">Workspace Name</label>
                      <input
                        type="text"
                        required
                        placeholder="e.g. Acme Corp, Vibe Devs"
                        value={workspaceName}
                        onChange={(e) => setWorkspaceName(e.target.value)}
                        className="w-full bg-white border border-slate-200 rounded-lg py-2.5 px-3 text-sm text-slate-800 focus:outline-none focus:ring-1 focus:ring-teal-500 transition"
                      />
                    </div>
                  ) : (
                    <div>
                      <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1">Workspace ID / Code</label>
                      <input
                        type="text"
                        required
                        placeholder="e.g. demo-workspace, acme-corp"
                        value={workspaceId}
                        onChange={(e) => setWorkspaceId(e.target.value)}
                        className="w-full bg-white border border-slate-200 rounded-lg py-2.5 px-3 text-sm text-slate-800 focus:outline-none focus:ring-1 focus:ring-teal-500 transition"
                      />
                    </div>
                  )}
                </div>
              </>
            )}

            <div>
              <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1">Email Address</label>
              <div className="relative">
                <Mail className="absolute left-3 top-2.5 h-5 w-5 text-slate-400" />
                <input
                  type="email"
                  required
                  placeholder="name@company.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="pl-10 w-full bg-white border border-slate-200 rounded-lg py-2.5 text-sm text-slate-800 focus:outline-none focus:ring-1 focus:ring-teal-500 transition"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1">Password</label>
              <div className="relative">
                <Key className="absolute left-3 top-2.5 h-5 w-5 text-slate-400" />
                <input
                  type="password"
                  required
                  placeholder="Min 6 characters"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="pl-10 w-full bg-white border border-slate-200 rounded-lg py-2.5 text-sm text-slate-800 focus:outline-none focus:ring-1 focus:ring-teal-500 transition"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={loading || !!demoLoading}
              className="w-full bg-teal-500 hover:bg-teal-600 text-white py-3 px-4 rounded-lg font-bold text-sm transition shadow-sm active:scale-95 flex items-center justify-center space-x-2 disabled:opacity-50"
            >
              {loading ? (
                <Loader2 className="w-5 h-5 animate-spin" />
              ) : (
                <span>{isLogin ? 'Sign In' : 'Register Account'}</span>
              )}
            </button>
          </form>

          <div className="relative my-4">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-slate-200"></div>
            </div>
            <div className="relative flex justify-center text-xs uppercase">
              <span className="bg-slate-50 px-2 text-slate-500 font-semibold">Or continue with</span>
            </div>
          </div>

          <button
            type="button"
            onClick={handleGoogleLogin}
            disabled={loading || !!demoLoading}
            className="w-full flex items-center justify-center gap-2 bg-white hover:bg-slate-100/70 text-slate-700 font-bold py-2.5 px-4 rounded-lg border border-slate-200 transition shadow-sm active:scale-95 disabled:opacity-50 cursor-pointer text-sm"
          >
            <svg className="w-4 h-4 shrink-0" viewBox="0 0 24 24">
              <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
              <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
              <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z" />
              <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z" />
            </svg>
            <span>Sign In with Google</span>
          </button>

          {/* Toggle Login/Signup */}
          <div className="text-center text-sm text-slate-400 pt-2">
            <span>{isLogin ? "Don't have an account?" : 'Already have an account?'}</span>{' '}
            <button
              type="button"
              onClick={() => setIsLogin(!isLogin)}
              className="text-teal-600 hover:text-teal-500 font-bold hover:underline focus:outline-none ml-1"
            >
              {isLogin ? 'Register now' : 'Sign in'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
