import React, { useEffect, useState, useRef } from 'react';
import { X, Volume2, ShieldAlert, Sparkles, AlertCircle } from 'lucide-react';

interface Ad {
  id: string;
  name: string;
  position: string;
  active: boolean;
  code: string;
}

export const GlobalAdsManager: React.FC = () => {
  const [ads, setAds] = useState<Ad[]>([]);
  const [reloadKey, setReloadKey] = useState(0);
  
  // States for specific format displays
  const [showInterstitial, setShowInterstitial] = useState(false);
  const [interstitialCountdown, setInterstitialCountdown] = useState(5);
  const [canSkipInterstitial, setCanSkipInterstitial] = useState(false);
  
  const [showSocialBar, setShowSocialBar] = useState(false);
  const [showStickyBanner, setShowStickyBanner] = useState(false);
  
  // Refs for script injection containers
  const popunderRef = useRef<HTMLDivElement>(null);
  const interstitialRef = useRef<HTMLDivElement>(null);
  const socialBarRef = useRef<HTMLDivElement>(null);
  const stickyBannerRef = useRef<HTMLDivElement>(null);

  // Monitor ads_changed event
  useEffect(() => {
    const handleAdsChanged = () => {
      setReloadKey(prev => prev + 1);
    };
    window.addEventListener('ads_changed', handleAdsChanged);
    return () => window.removeEventListener('ads_changed', handleAdsChanged);
  }, []);

  // Fetch all ads
  useEffect(() => {
    fetch('/api/settings')
      .then((res) => {
        if (!res.ok) throw new Error('Failed to fetch ads settings');
        return res.json();
      })
      .then((data) => {
        const fetchedAds = data.ads || [];
        setAds(fetchedAds);
        
        if (fetchedAds.length === 0) {
          setShowSocialBar(false);
          setShowStickyBanner(false);
          setShowInterstitial(false);
          return;
        }
        
        // Setup Popunder
        const popunderAd = fetchedAds.find((a: Ad) => a.position === 'popunder' && a.active);
        if (popunderAd && popunderRef.current) {
          injectAdCode(popunderRef.current, popunderAd.code);
        }

        // Setup Social Bar (Delay presentation by 3 seconds)
        const socialBarAd = fetchedAds.find((a: Ad) => a.position === 'social_bar' && a.active);
        if (socialBarAd) {
          setTimeout(() => {
            setShowSocialBar(true);
          }, 3000);
        }

        // Setup Sticky Banner (Delay presentation by 2 seconds)
        const stickyBannerAd = fetchedAds.find((a: Ad) => a.position === 'sticky_banner' && a.active);
        if (stickyBannerAd) {
          setTimeout(() => {
            setShowStickyBanner(true);
          }, 2000);
        }

        // Setup Interstitial Ad (Show once per session or after some delay)
        const interstitialAd = fetchedAds.find((a: Ad) => a.position === 'interstitial' && a.active);
        const hasSeenInterstitial = sessionStorage.getItem('seen_interstitial') === 'true';
        if (interstitialAd && !hasSeenInterstitial) {
          const timer = setTimeout(() => {
            setShowInterstitial(true);
            sessionStorage.setItem('seen_interstitial', 'true');
          }, 6000);
          return () => clearTimeout(timer);
        }
      })
      .catch((err) => console.warn('Error fetching global ads:', err));
  }, [reloadKey]);

  // Inject script tags dynamically
  const injectAdCode = (container: HTMLDivElement, code: string) => {
    if (!container) return;
    container.innerHTML = '';

    const tempDiv = document.createElement('div');
    tempDiv.innerHTML = code.trim();

    Array.from(tempDiv.childNodes).forEach((node: any) => {
      if (node.tagName !== 'SCRIPT') {
        container.appendChild(node.cloneNode(true));
      }
    });

    const scripts = tempDiv.getElementsByTagName('script');
    Array.from(scripts).forEach((script: any) => {
      const newScript = document.createElement('script');
      Array.from(script.attributes).forEach((attr: any) => {
        newScript.setAttribute(attr.name, attr.value);
      });
      if (script.src) {
        newScript.src = script.src;
      } else {
        newScript.textContent = script.textContent;
      }
      container.appendChild(newScript);
    });
  };

  useEffect(() => {
    if (showSocialBar && socialBarRef.current) {
      const ad = ads.find((a) => a.position === 'social_bar' && a.active);
      if (ad) injectAdCode(socialBarRef.current, ad.code);
    }
  }, [showSocialBar, ads]);

  useEffect(() => {
    if (showStickyBanner && stickyBannerRef.current) {
      const ad = ads.find((a) => a.position === 'sticky_banner' && a.active);
      if (ad) injectAdCode(stickyBannerRef.current, ad.code);
    }
  }, [showStickyBanner, ads]);

  useEffect(() => {
    if (showInterstitial && interstitialRef.current) {
      const ad = ads.find((a) => a.position === 'interstitial' && a.active);
      if (ad) injectAdCode(interstitialRef.current, ad.code);
    }
  }, [showInterstitial, ads]);

  // Handle interstitial countdown
  useEffect(() => {
    if (!showInterstitial) return;
    
    setInterstitialCountdown(5);
    setCanSkipInterstitial(false);

    const interval = setInterval(() => {
      setInterstitialCountdown((prev) => {
        if (prev <= 1) {
          clearInterval(interval);
          setCanSkipInterstitial(true);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(interval);
  }, [showInterstitial]);

  // Handle Interstitial global click triggers for navigation
  useEffect(() => {
    const handleGlobalClick = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      
      const isMangaLink = target.closest('[data-manga-link]') || target.closest('a[href*="/reader"]') || target.closest('a[href*="/series"]');
      if (isMangaLink) {
        const interstitialAd = ads.find((a) => a.position === 'interstitial' && a.active);
        const rand = Math.random();
        if (interstitialAd && rand < 0.25) {
          e.preventDefault();
          e.stopPropagation();
          setShowInterstitial(true);
          
          const href = (isMangaLink as HTMLAnchorElement).href || (isMangaLink as HTMLElement).getAttribute('href');
          if (href) {
            (window as any)._pendingAdRedirect = href;
          }
        }
      }
    };

    document.addEventListener('click', handleGlobalClick, true);
    return () => document.removeEventListener('click', handleGlobalClick, true);
  }, [ads]);

  const handleCloseInterstitial = () => {
    setShowInterstitial(false);
    const pendingRedirect = (window as any)._pendingAdRedirect;
    if (pendingRedirect) {
      (window as any)._pendingAdRedirect = null;
      window.location.href = pendingRedirect;
    }
  };

  const handleCloseSocialBar = () => {
    setShowSocialBar(false);
  };

  const handleCloseStickyBanner = () => {
    setShowStickyBanner(false);
  };

  if (ads.length === 0) return null;

  return (
    <>
      {/* Popunder Ad (Hidden Container) */}
      <div ref={popunderRef} className="hidden" data-ad-format="popunder" />

      {/* Interstitial Ad Fullscreen Overlay */}
      {showInterstitial && (
        <div className="fixed inset-0 z-[99999] bg-black/95 backdrop-blur-md flex flex-col items-center justify-center p-4" dir="ltr">
          <div className="w-full max-w-xl flex flex-col items-center space-y-6 animate-fade-in text-center">
            
            {/* Header Badge */}
            <div className="flex items-center gap-2 bg-crimson-950/60 border border-crimson-850 px-4 py-1.5 rounded-full text-crimson-500 text-xs font-bold tracking-wider font-sans">
              <Sparkles className="w-4 h-4 text-crimson-500 animate-pulse" />
              <span>SPONSORED ADVERTISEMENT</span>
            </div>

            {/* Countdown / Skip Button */}
            <div className="w-full max-w-md flex flex-col items-center">
              {canSkipInterstitial ? (
                <button
                  onClick={handleCloseInterstitial}
                  className="w-full bg-crimson-600 hover:bg-crimson-500 text-white font-extrabold py-3.5 px-6 rounded-2xl shadow-xl transition-all hover:scale-105 active:scale-95 cursor-pointer flex items-center justify-center gap-2 text-sm"
                >
                  Skip Ad & Continue <X className="w-5 h-5" />
                </button>
              ) : (
                <div className="w-full bg-neutral-900/80 border border-neutral-800 rounded-2xl p-4 flex items-center justify-between text-neutral-400 text-xs font-bold">
                  <span className="font-sans">You can skip this ad in a few seconds...</span>
                  <span className="w-8 h-8 rounded-full bg-crimson-950/40 border border-crimson-600/30 text-crimson-500 flex items-center justify-center font-mono text-sm">
                    {interstitialCountdown}
                  </span>
                </div>
              )}
            </div>

            {/* Injected Interstitial Banner Content */}
            <div 
              ref={interstitialRef} 
              className="w-full flex justify-center items-center rounded-3xl overflow-hidden shadow-2xl bg-neutral-900 border border-neutral-800/60 min-h-[250px]"
              data-ad-format="interstitial"
            />

            <p className="text-[10px] text-neutral-500 max-w-xs leading-relaxed font-sans">
              Sponsored ads help cover server hosting and keep reading free for everyone. Thank you!
            </p>
          </div>
        </div>
      )}

      {/* Social Bar */}
      {showSocialBar && (
        <div className="fixed bottom-20 right-4 z-[9999] max-w-xs w-full animate-slide-in-up" dir="ltr">
          <div className="relative group">
            <button
              onClick={handleCloseSocialBar}
              className="absolute -top-2.5 -right-2.5 z-50 w-6 h-6 bg-black hover:bg-crimson-600 border border-neutral-800 hover:border-transparent rounded-full flex items-center justify-center text-neutral-400 hover:text-white transition-all cursor-pointer shadow-lg"
              title="Close Ad"
            >
              <X className="w-3.5 h-3.5" />
            </button>

            <div 
              ref={socialBarRef} 
              className="w-full rounded-2xl overflow-hidden shadow-2xl border border-obsidian-850"
              data-ad-format="social-bar"
            />
          </div>
        </div>
      )}

      {/* Sticky Banner */}
      {showStickyBanner && (
        <div className="fixed bottom-0 left-0 right-0 z-[9998] w-full animate-slide-in-up" dir="ltr">
          <div className="relative w-full max-w-5xl mx-auto">
            <button
              onClick={handleCloseStickyBanner}
              className="absolute -top-3 right-4 z-[9999] bg-neutral-950 hover:bg-crimson-600 border border-neutral-800 hover:border-transparent text-neutral-400 hover:text-white py-1 px-2.5 rounded-full text-[10px] font-bold flex items-center gap-1 cursor-pointer shadow-xl transition-all"
            >
              <X className="w-3.5 h-3.5" /> Close Ad
            </button>

            <div 
              ref={stickyBannerRef} 
              className="w-full rounded-t-2xl overflow-hidden shadow-2xl"
              data-ad-format="sticky-banner"
            />
          </div>
        </div>
      )}
    </>
  );
};
