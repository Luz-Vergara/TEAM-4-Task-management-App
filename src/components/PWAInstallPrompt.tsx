import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Download, X, Sparkles, Monitor, Smartphone, Check, HelpCircle } from 'lucide-react';

export default function PWAInstallPrompt() {
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);
  const [isVisible, setIsVisible] = useState(false);
  const [isInstalled, setIsInstalled] = useState(false);
  const [showHowTo, setShowHowTo] = useState(false);

  useEffect(() => {
    // 1. Check if already installed
    if (window.matchMedia('(display-mode: standalone)').matches || (window.navigator as any).standalone) {
      setIsInstalled(true);
      return;
    }

    // 2. Listen for the browser beforeinstallprompt event
    const handleBeforeInstallPrompt = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e);
      
      // Check if user dismissed it in this session
      const dismissed = sessionStorage.getItem('pwa-prompt-dismissed');
      if (!dismissed) {
        setIsVisible(true);
      }
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);

    // 3. Track successful installation
    const handleAppInstalled = () => {
      setIsInstalled(true);
      setIsVisible(false);
      setDeferredPrompt(null);
      console.log('VibeCheck was successfully installed!');
    };

    window.addEventListener('appinstalled', handleAppInstalled);

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
      window.removeEventListener('appinstalled', handleAppInstalled);
    };
  }, []);

  const handleInstallClick = async () => {
    if (!deferredPrompt) return;
    
    // Show the browser install prompt
    deferredPrompt.prompt();
    
    // Wait for the user to respond to the prompt
    const { outcome } = await deferredPrompt.userChoice;
    console.log(`User response to the install prompt: ${outcome}`);
    
    if (outcome === 'accepted') {
      setIsInstalled(true);
      setIsVisible(false);
    }
    
    // Clear the deferred prompt variable
    setDeferredPrompt(null);
  };

  const handleDismiss = () => {
    setIsVisible(false);
    // Remember dismissal for this session only so we don't annoy the user
    sessionStorage.setItem('pwa-prompt-dismissed', 'true');
  };

  // If already installed, or not visible/no prompt event yet, render nothing
  if (!isVisible && !showHowTo) return null;

  return (
    <div className="fixed bottom-6 left-6 z-[9999] max-w-sm w-[calc(100vw-3rem)] pointer-events-none">
      <AnimatePresence>
        {(isVisible || showHowTo) && (
          <motion.div
            initial={{ opacity: 0, y: 50, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 30, scale: 0.95 }}
            className="pointer-events-auto bg-slate-900/95 backdrop-blur-md border border-slate-800 text-white rounded-xl shadow-2xl p-5 overflow-hidden relative"
            id="pwa-install-prompt-card"
          >
            {/* Top Close Button */}
            <button
              onClick={handleDismiss}
              className="absolute top-3 right-3 p-1 rounded-md text-slate-400 hover:text-white hover:bg-slate-800 transition cursor-pointer"
              aria-label="Dismiss"
            >
              <X className="w-4 h-4" />
            </button>

            {/* Content header */}
            <div className="flex items-center gap-2 mb-3">
              <span className="p-1.5 bg-teal-500/10 text-teal-400 rounded-lg shrink-0">
                <Sparkles className="w-4 h-4 animate-spin-slow" />
              </span>
              <h3 className="font-bold text-sm tracking-tight text-slate-100">
                Install VibeCheck Hub
              </h3>
            </div>

            {!showHowTo ? (
              <>
                <p className="text-xs text-slate-300 leading-relaxed mb-4">
                  Run VibeCheck as a native desktop or mobile app! Enjoy a standalone workspace, launch from your dock/home screen, and leverage offline speed.
                </p>

                <div className="flex flex-col gap-2">
                  {deferredPrompt ? (
                    <button
                      onClick={handleInstallClick}
                      className="w-full bg-teal-600 hover:bg-teal-500 text-white font-bold text-xs py-2.5 px-4 rounded-lg transition-all flex items-center justify-center gap-2 shadow-lg cursor-pointer"
                      id="pwa-install-now-btn"
                    >
                      <Download className="w-4 h-4 animate-bounce" /> Install App Now
                    </button>
                  ) : (
                    <div className="text-xs bg-slate-950/40 border border-slate-800/80 p-2.5 rounded-lg text-slate-400 leading-normal mb-2">
                      💡 Click the install icon in your browser's address bar or menu to install directly.
                    </div>
                  )}

                  <button
                    onClick={() => setShowHowTo(true)}
                    className="w-full bg-slate-800 hover:bg-slate-700 text-slate-300 font-semibold text-xs py-2 px-4 rounded-lg transition flex items-center justify-center gap-1.5 cursor-pointer"
                  >
                    <HelpCircle className="w-3.5 h-3.5" /> Manual Install Guide
                  </button>
                </div>
              </>
            ) : (
              <div className="space-y-3">
                <div className="text-xs text-slate-300 leading-relaxed max-h-[220px] overflow-y-auto space-y-2.5 pr-1">
                  <div className="border-b border-slate-800 pb-1.5 font-semibold text-slate-200">
                    How to install on your system:
                  </div>
                  
                  <div className="flex gap-2">
                    <Monitor className="w-4 h-4 text-teal-400 shrink-0 mt-0.5" />
                    <div>
                      <span className="font-semibold text-slate-200 block">Desktop (Chrome, Edge, Opera)</span>
                      Look at the right side of the address bar at the top of your screen. Click the <span className="text-teal-400 font-medium">"Install"</span> icon or select <span className="text-teal-400 font-medium">"Install VibeCheck Workflow Hub"</span> from the browser's three-dot menu.
                    </div>
                  </div>

                  <div className="flex gap-2 pt-1">
                    <Smartphone className="w-4 h-4 text-teal-400 shrink-0 mt-0.5" />
                    <div>
                      <span className="font-semibold text-slate-200 block">Mobile & Safari</span>
                      • **iOS/Safari:** Tap the share icon <span className="text-teal-400">"Share"</span> (square with arrow pointing up) at the bottom, then scroll down and tap <span className="text-teal-400 font-medium">"Add to Home Screen"</span>.
                      <br />• **Android/Chrome:** Tap the browser's 3-dot menu and select <span className="text-teal-400 font-medium">"Add to Home Screen"</span> or <span className="text-teal-400 font-medium">"Install app"</span>.
                    </div>
                  </div>
                </div>

                <div className="flex gap-2 pt-2 border-t border-slate-800">
                  {deferredPrompt && (
                    <button
                      onClick={handleInstallClick}
                      className="flex-1 bg-teal-600 hover:bg-teal-500 text-white font-bold text-xs py-2 rounded-lg transition-all flex items-center justify-center gap-1.5 cursor-pointer"
                    >
                      <Download className="w-3.5 h-3.5" /> Try Auto
                    </button>
                  )}
                  <button
                    onClick={() => setShowHowTo(false)}
                    className="flex-1 bg-slate-800 hover:bg-slate-700 text-slate-300 font-semibold text-xs py-2 rounded-lg transition cursor-pointer"
                  >
                    Back
                  </button>
                </div>
              </div>
            )}
            
            <div className="mt-3 text-[10px] text-slate-500 text-center flex items-center justify-center gap-1">
              <span>PWA Support Enabled</span>
              <span>•</span>
              <button 
                onClick={() => {
                  // Trigger manually checking standalone
                  if (window.matchMedia('(display-mode: standalone)').matches) {
                    alert('Running in standalone mode! 🎉');
                  } else {
                    alert('Running in normal browser mode.');
                  }
                }}
                className="hover:text-slate-400 underline cursor-pointer"
              >
                check status
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
