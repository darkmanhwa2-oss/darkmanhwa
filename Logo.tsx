import React from 'react';

interface LogoProps {
  className?: string;
  size?: 'sm' | 'md' | 'lg' | 'xl';
  showText?: boolean;
}

export const Logo: React.FC<LogoProps> = ({ size = 'md', className = '' }) => {
  const sizeClasses = {
    sm: 'h-8',
    md: 'h-10 md:h-12',
    lg: 'h-14 md:h-16',
    xl: 'h-20 md:h-24'
  };

  return (
    <div className={`flex items-center gap-2 select-none ${className}`}>
      <img
        src="/logo.png"
        alt="Dark Manhwa - دارك مانهوا"
        className={`${sizeClasses[size]} w-auto object-contain drop-shadow-[0_0_12px_rgba(220,38,38,0.4)] transition-transform duration-300 hover:scale-105`}
        onError={(e) => {
          // Fallback if image fails to load
          const target = e.currentTarget;
          target.style.display = 'none';
          const sibling = target.nextElementSibling as HTMLElement;
          if (sibling) sibling.style.display = 'flex';
        }}
      />
      <div className="hidden flex-col justify-center items-start">
        <span className="font-black text-xl tracking-wider text-crimson-600 font-mono">DARK</span>
        <span className="font-bold text-xs tracking-widest text-neutral-200 -mt-1 font-sans">MANHWA</span>
      </div>
    </div>
  );
};
