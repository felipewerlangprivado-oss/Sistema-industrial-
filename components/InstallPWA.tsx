
import React, { useEffect, useState } from 'react';
import { Download, Share, X } from 'lucide-react';
import { Button } from './UI';

const InstallPWA: React.FC = () => {
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);
  const [showInstallBanner, setShowInstallBanner] = useState(false);
  const [isIOS, setIsIOS] = useState(false);
  const [showIOSPrompt, setShowIOSPrompt] = useState(false);

  useEffect(() => {
    // Check if it's iOS
    const userAgent = window.navigator.userAgent.toLowerCase();
    const isIosDevice = /iphone|ipad|ipod/.test(userAgent);
    // Check if running in standalone mode (already installed)
    const isStandalone = window.matchMedia('(display-mode: standalone)').matches || (window.navigator as any).standalone;

    if (isIosDevice && !isStandalone) {
      setIsIOS(true);
      // Show iOS prompt on first load or logic to show it
      const hasSeenPrompt = localStorage.getItem('iosPwaPromptSeen');
      if (!hasSeenPrompt) {
        setShowIOSPrompt(true);
      }
    }

    // Android / Desktop - capture beforeinstallprompt
    const handler = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e);
      setShowInstallBanner(true);
    };

    window.addEventListener('beforeinstallprompt', handler);

    return () => window.removeEventListener('beforeinstallprompt', handler);
  }, []);

  const handleInstallClick = async () => {
    if (!deferredPrompt) return;

    deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    
    if (outcome === 'accepted') {
      console.log('User accepted the install prompt');
    } else {
      console.log('User dismissed the install prompt');
    }
    setDeferredPrompt(null);
    setShowInstallBanner(false);
  };

  const closeIOSPrompt = () => {
    setShowIOSPrompt(false);
    localStorage.setItem('iosPwaPromptSeen', 'true');
  };

  if (showInstallBanner && !isIOS) {
    return (
      <div className="fixed bottom-0 left-0 right-0 z-50 p-4 animate-in slide-in-from-bottom duration-500">
        <div className="bg-primary-container text-on-primary-container rounded-2xl p-4 shadow-xl flex items-center justify-between border border-primary/20 max-w-md mx-auto">
          <div className="flex items-center gap-3">
             <div className="bg-primary p-2 rounded-xl text-on-primary">
               <Download className="w-6 h-6" />
             </div>
             <div>
               <p className="font-bold">Instalar Aplicativo</p>
               <p className="text-xs opacity-90">Acesso rápido e offline</p>
             </div>
          </div>
          <div className="flex items-center gap-2">
             <button onClick={() => setShowInstallBanner(false)} className="p-2 hover:bg-primary/10 rounded-full transition-colors">
               <X className="w-5 h-5" />
             </button>
             <Button size="sm" onClick={handleInstallClick}>Instalar</Button>
          </div>
        </div>
      </div>
    );
  }

  if (showIOSPrompt && isIOS) {
    return (
      <div className="fixed bottom-0 left-0 right-0 z-50 p-4 animate-in slide-in-from-bottom duration-500">
         <div className="bg-surface text-on-surface rounded-t-3xl p-6 shadow-[0_-4px_20px_rgba(0,0,0,0.15)] max-w-md mx-auto relative border-t border-outline-variant">
            <button onClick={closeIOSPrompt} className="absolute top-4 right-4 p-2 text-on-surface-variant hover:bg-surface-variant rounded-full">
               <X className="w-6 h-6" />
            </button>
            
            <div className="flex flex-col items-center text-center space-y-4">
               <div className="w-16 h-16 bg-primary-container rounded-2xl flex items-center justify-center text-on-primary-container mb-2">
                 <img src="https://cdn-icons-png.flaticon.com/512/7656/7656424.png" alt="App Icon" className="w-10 h-10" />
               </div>
               
               <h3 className="text-lg font-bold">Instalar Home Pots</h3>
               <p className="text-sm text-on-surface-variant">
                 Para instalar este aplicativo no seu iPhone/iPad e usar em tela cheia:
               </p>
               
               <div className="flex flex-col gap-3 w-full text-left bg-surface-variant p-4 rounded-xl border border-outline-variant">
                  <div className="flex items-center gap-3">
                    <Share className="w-5 h-5 text-primary" />
                    <span className="text-sm text-on-surface">1. Toque no botão <strong>Compartilhar</strong></span>
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="w-5 h-5 border-2 border-primary rounded-[4px] flex items-center justify-center">
                       <span className="text-xs font-bold text-primary">+</span>
                    </div>
                    <span className="text-sm text-on-surface">2. Selecione <strong>Adicionar à Tela de Início</strong></span>
                  </div>
               </div>
            </div>
            
            {/* Arrow pointing down specifically for Safari bottom bar */}
            <div className="absolute -bottom-8 left-1/2 -translate-x-1/2 w-0 h-0 border-l-[10px] border-l-transparent border-r-[10px] border-r-transparent border-t-[10px] border-t-surface"></div>
         </div>
      </div>
    );
  }

  return null;
};

export default InstallPWA;
