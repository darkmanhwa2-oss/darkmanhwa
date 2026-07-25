import React, { useEffect, useRef, useState } from 'react';

interface AdZoneProps {
  position: 'top' | 'bottom' | 'between_chapters' | 'reader_side' | 'sidebar' | 'footer' | 'in_page_push' | 'native_ads';
  className?: string;
}

export const AdZoneComponent: React.FC<AdZoneProps> = ({ position, className = '' }) => {
  const [ad, setAd] = useState<any>(null);
  const [reloadKey, setReloadKey] = useState(0);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleAdsChanged = () => {
      setReloadKey(prev => prev + 1);
    };
    window.addEventListener('ads_changed', handleAdsChanged);
    return () => window.removeEventListener('ads_changed', handleAdsChanged);
  }, []);

  useEffect(() => {
    // Fetch active settings and ads
    fetch('/api/settings')
      .then((res) => {
        if (!res.ok) throw new Error('Failed to fetch ads settings');
        return res.json();
      })
      .then((data) => {
        const activeAds = data.ads || [];
        const found = activeAds.find((a: any) => a.position === position && a.active && a.code);
        setAd(found || null);
      })
      .catch((err) => console.warn('Error loading ads for position:', position, err));
  }, [position, reloadKey]);

  useEffect(() => {
    if (!ad || !containerRef.current) return;

    const container = containerRef.current;
    container.innerHTML = ''; // Clear previous

    // Create temporary wrapper to parse the HTML string
    const tempDiv = document.createElement('div');
    tempDiv.innerHTML = ad.code.trim();

    // Append non-script children
    Array.from(tempDiv.childNodes).forEach((node: any) => {
      if (node.tagName !== 'SCRIPT') {
        container.appendChild(node.cloneNode(true));
      }
    });

    // Execute script tags dynamically
    const scripts = tempDiv.getElementsByTagName('script');
    Array.from(scripts).forEach((script: any) => {
      const newScript = document.createElement('script');
      
      // Copy all attributes
      Array.from(script.attributes).forEach((attr: any) => {
        newScript.setAttribute(attr.name, attr.value);
      });

      // Set content or src
      if (script.src) {
        newScript.src = script.src;
      } else {
        newScript.textContent = script.textContent;
      }

      // Append script to run it
      container.appendChild(newScript);
    });
  }, [ad]);

  if (!ad) return null;

  return (
    <div className={`relative group/ad w-full my-6 flex flex-col items-center ${className}`}>
      <div 
        ref={containerRef} 
        className="ad-zone-container w-full flex flex-col justify-center items-center overflow-hidden min-h-[40px]"
        data-position={position}
      />
    </div>
  );
};

