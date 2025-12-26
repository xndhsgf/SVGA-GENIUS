
import React from 'react';

interface HeaderProps {
  onLogoClick: () => void;
  isAdmin?: boolean;
  userName?: string;
  onAdminToggle?: () => void;
  onLogout?: () => void;
  isAdminOpen?: boolean;
}

export const Header: React.FC<HeaderProps> = ({ onLogoClick, isAdmin, userName, onAdminToggle, onLogout, isAdminOpen }) => {
  return (
    <header className="fixed top-0 left-0 right-0 z-[100] border-b border-white/5 backdrop-blur-2xl bg-slate-950/80">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-20 flex items-center justify-between gap-2">
        <div 
          className="flex items-center gap-3 cursor-pointer group shrink-0"
          onClick={onLogoClick}
        >
          <div className="w-9 h-9 sm:w-10 sm:h-10 bg-gradient-to-br from-sky-400 to-indigo-600 rounded-xl flex items-center justify-center shadow-lg transition-all group-hover:scale-110">
            <span className="text-white font-black text-base sm:text-lg italic">S</span>
          </div>
          <div className="flex flex-col hidden xs:flex">
            <span className="text-base sm:text-lg font-black text-white tracking-tighter leading-none">SVGA <span className="text-sky-400">enius</span></span>
            <span className="text-[7px] font-black text-slate-500 uppercase tracking-[0.4em] mt-0.5">Quantum Suite</span>
          </div>
        </div>
        
        <div className="flex items-center gap-2 sm:gap-4 overflow-x-hidden">
          {/* Social Links - Visible on all screens now */}
          <div className="flex items-center gap-2 px-2 sm:px-4 border-x border-white/5">
             <a 
               href="https://wa.me/201027633072" 
               target="_blank" 
               rel="noopener noreferrer"
               className="w-8 h-8 flex items-center justify-center bg-green-500/10 hover:bg-green-500 text-green-500 hover:text-white rounded-lg transition-all duration-300 border border-green-500/20 shadow-glow-green-sm"
               title="WhatsApp Support"
             >
               <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/></svg>
             </a>
             <a 
               href="https://www.tiktok.com/@ah1.me.1d?is_from_webapp=1&sender_device=pc" 
               target="_blank" 
               rel="noopener noreferrer"
               className="w-8 h-8 flex items-center justify-center bg-slate-800/50 hover:bg-white text-slate-400 hover:text-black rounded-lg transition-all duration-300 border border-white/5 shadow-inner"
               title="TikTok Profile"
             >
               <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24"><path d="M12.525.02c1.31-.02 2.61-.01 3.91-.02.08 1.53.63 3.09 1.75 4.17 1.12 1.11 2.7 1.62 4.24 1.79v4.03c-1.44-.17-2.86-.6-4.12-1.31a8.13 8.13 0 0 1-2.43-2.12c-.04 2.44-.01 4.88-.01 7.32-.01 1.72-.45 3.51-1.58 4.84-1.12 1.34-2.83 2.15-4.52 2.29-1.68.14-3.53-.25-4.86-1.32-1.33-1.07-2.11-2.72-2.22-4.43-.11-1.71.4-3.5 1.55-4.79 1.15-1.29 2.89-2.07 4.59-2.18v4.03c-.7.04-1.42.23-2.01.62-.59.39-.99.99-1.12 1.68-.13.69.02 1.46.42 2.03.4.57 1.04.93 1.73.99.69.06 1.43-.15 1.95-.62.52-.47.8-1.18.81-1.88.01-3.69.01-7.38.01-11.07z"/></svg>
             </a>
          </div>

          <div className="hidden lg:flex flex-col items-end mr-2">
            <span className="text-[8px] font-black text-sky-500 uppercase tracking-widest leading-none mb-1">User</span>
            <span className="text-[10px] font-bold text-white opacity-70 truncate max-w-[100px]">{userName || 'Admin'}</span>
          </div>

          <nav className="flex items-center gap-2">
            {isAdmin && (
              <button 
                onClick={(e) => { e.preventDefault(); onAdminToggle?.(); }}
                className={`px-3 sm:px-5 py-2 rounded-xl text-[9px] font-black uppercase tracking-widest transition-all border ${
                  isAdminOpen 
                    ? 'bg-amber-500 text-white border-amber-400 shadow-glow-amber' 
                    : 'bg-amber-500/10 text-amber-500 border-amber-500/20 hover:bg-amber-500/20'
                }`}
              >
                <span className="hidden xs:inline">لوحة التحكم</span>
                <span className="xs:hidden">Admin</span>
              </button>
            )}
            
            <button 
              onClick={(e) => { e.preventDefault(); onLogout?.(); }}
              className="p-2 sm:px-4 sm:py-2 bg-white/5 hover:bg-red-500/20 text-slate-400 hover:text-red-400 rounded-xl text-[9px] font-black uppercase tracking-widest border border-white/10 transition-all"
            >
              <span className="hidden sm:inline">خروج</span>
              <svg className="sm:hidden w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" /></svg>
            </button>
          </nav>
        </div>
      </div>
      <style>{`
        .shadow-glow-amber { box-shadow: 0 0 20px rgba(245, 158, 11, 0.4); }
        .shadow-glow-green-sm { box-shadow: 0 0 15px rgba(34, 197, 94, 0.2); }
      `}</style>
    </header>
  );
};
