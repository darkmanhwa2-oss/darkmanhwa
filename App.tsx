/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Search, Shield, User as UserIcon, BookMarked, Bell, Sliders, LogIn, LogOut, 
  ChevronDown, Facebook, Twitter, ShieldCheck, Heart, Sparkles, Filter, X,
  Eye, EyeOff, Home as HomeIcon, Newspaper, Users, BookOpen
} from 'lucide-react';
import { Series, User, SiteSettings, AdZone } from './types';
import { apiFetch } from './lib/api';
import { getIndexedDBItem, setIndexedDBItem } from './lib/indexedDb';

// Page Imports
import Home from './pages/Home';
import Details from './pages/Details';
import Reader from './pages/Reader';
import Auth from './pages/Auth';
import Profile from './pages/Profile';
import Admin from './pages/Admin';
import StaticPages from './pages/StaticPages';
import MangaList from './pages/MangaList';
import Teams from './pages/Teams';
import News from './pages/News';
import { useSEO } from './hooks/useSEO';
import { GlobalAdsManager } from './components/GlobalAdsManager';

import { Logo } from './components/Logo';

export default function App() {
  // Navigation State
  const [page, setPage] = useState<string>('home');
  const [params, setParams] = useState<any>({});

  // Dynamic Fallback SEO Setup
  const showFallbackSEO = page !== 'details' && page !== 'reader';
  useSEO({
    title: !showFallbackSEO ? '' : 
           page === 'home' ? 'الرئيسية - قراءة المانجا والمانهوا مترجمة' :
           page === 'manga-list' ? 'دليل الأعمال - تصفح وفلترة المانجا والمانهوا' :
           page === 'teams' ? 'فرق الترجمة - دارك مانهوا' :
           page === 'news' ? 'آخر الأخبار والتحديثات - دارك مانهوا' :
           page === 'auth' ? 'تسجيل الدخول وإنشاء حساب' :
           page === 'profile' ? 'الملف الشخصي والمفضلة' :
           page === 'admin' ? 'لوحة التحكم والإدارة' :
           'Dark Manhwa - دارك مانهوا',
    description: 'اقرأ أحدث فصول المانجا والمانهوا المترجمة للعربية بجودة عالية وبدون إعلانات مزعجة على Dark Manhwa.',
    keywords: ['مانجا', 'مانهوا', 'قراءة مانهوا', 'مانهوا مترجمة', 'دارك مانهوا', 'Dark Manhwa', 'فصول مانهوا']
  });

  // Global Contexts
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [seriesList, setSeriesList] = useState<Series[]>([]);
  const [loading, setLoading] = useState(true);
  const [settings, setSettings] = useState<SiteSettings | null>(null);
  const [unreadCount, setUnreadCount] = useState<number>(0);

  // Global Search and Advanced Filtering
  const [searchQuery, setSearchQuery] = useState('');
  const [showSearchDropdown, setShowSearchDropdown] = useState(false);
  const [showFiltersPanel, setShowFiltersPanel] = useState(false);

  // Search filter selections
  const [filterGenre, setFilterGenre] = useState<string>('');
  const [filterStatus, setFilterStatus] = useState<string>('');
  const [filterSort, setFilterSort] = useState<string>('');

  const fetchUnreadCount = async () => {
    try {
      const token = localStorage.getItem('dark_watch_token');
      if (!token) {
        setUnreadCount(0);
        return;
      }
      const res = await apiFetch('/api/notifications/unread-count');
      setUnreadCount(res.unreadCount || 0);
    } catch (err) {
      console.warn('Could not fetch unread notifications count:', err);
    }
  };

  useEffect(() => {
    initApp();

    const handleAuthExpired = () => {
      setCurrentUser(null);
    };
    window.addEventListener('dark_watch_auth_expired', handleAuthExpired);
    return () => {
      window.removeEventListener('dark_watch_auth_expired', handleAuthExpired);
    };
  }, []);

  useEffect(() => {
    if (currentUser) {
      fetchUnreadCount();
      const timer = setInterval(fetchUnreadCount, 60000);
      return () => clearInterval(timer);
    } else {
      setUnreadCount(0);
    }
  }, [currentUser]);

  const syncBackupToLocal = async (user: any) => {
    if (user && user.role === 'admin') {
      try {
        const res = await apiFetch('/api/admin/backup', { method: 'POST' });
        if (res && res.backup) {
          await setIndexedDBItem(res.backup);
          console.log('Database auto-saved to IndexedDB!');
        }
      } catch (err) {
        console.error('Failed to auto-save database to IndexedDB:', err);
      }
    }
  };

  const triggerLoginSync = async (user: any) => {
    if (user && user.role === 'admin') {
      try {
        const list = await apiFetch('/api/series');
        const localBackupStr = await getIndexedDBItem();
        if (localBackupStr) {
          const localBackup = JSON.parse(localBackupStr);
          if (list.length === 0 && localBackup.series && localBackup.series.length > 0) {
            console.log('Server DB is empty on login. Restoring from IndexedDB...');
            await apiFetch('/api/admin/restore', {
              method: 'POST',
              body: JSON.stringify({ backup: localBackupStr })
            });
            const restoredList = await apiFetch('/api/series');
            setSeriesList(restoredList);
          }
        }
        await syncBackupToLocal(user);
      } catch (err) {
        console.error('Error during admin login sync:', err);
      }
    }
  };

  const initApp = async () => {
    setLoading(true);
    try {
      const settingsRes = await apiFetch('/api/settings');
      setSettings(settingsRes.settings);

      let list = await apiFetch('/api/series');
      setSeriesList(list);

      const token = localStorage.getItem('dark_watch_token');
      if (token) {
        try {
          const meRes = await apiFetch('/api/auth/me');
          setCurrentUser(meRes.user);

          if (meRes.user && meRes.user.role === 'admin') {
            const localBackupStr = await getIndexedDBItem();
            if (localBackupStr) {
              const localBackup = JSON.parse(localBackupStr);
              if (list.length === 0 && localBackup.series && localBackup.series.length > 0) {
                try {
                  await apiFetch('/api/admin/restore', {
                    method: 'POST',
                    body: JSON.stringify({ backup: localBackupStr })
                  });
                  list = await apiFetch('/api/series');
                  setSeriesList(list);
                } catch (resErr) {
                  console.error('Auto-restore failed:', resErr);
                }
              }
            }
            await syncBackupToLocal(meRes.user);
          }
        } catch (err) {
          console.warn('Session expired or token invalid:', err);
          localStorage.removeItem('dark_watch_token');
        }
      }
    } catch (err) {
      console.error('Initialization error:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleNavigate = (targetPage: string, pageParams: any = {}) => {
    setPage(targetPage);
    setParams(pageParams);
    setShowSearchDropdown(false);
    setShowFiltersPanel(false);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleLogout = () => {
    localStorage.removeItem('dark_watch_token');
    setCurrentUser(null);
    handleNavigate('home');
  };

  const handleSelectRandom = async () => {
    try {
      const res = await apiFetch('/api/series/random');
      handleNavigate('details', { id: res.id });
    } catch (err) {
      console.error(err);
    }
  };

  const handleRefreshDatabase = async () => {
    try {
      const list = await apiFetch('/api/series');
      setSeriesList(list);
      if (currentUser && currentUser.role === 'admin') {
        await syncBackupToLocal(currentUser);
      }
    } catch (err) {
      console.error(err);
    }
  };

  // Autocomplete matching list
  const searchResults = searchQuery.trim() === '' 
    ? [] 
    : seriesList.filter(s => 
        (s.titleEn && s.titleEn.toLowerCase().includes(searchQuery.toLowerCase())) ||
        (s.titleAr && s.titleAr.toLowerCase().includes(searchQuery.toLowerCase()))
      );

  // Perform advanced filters
  const handleApplyAdvancedFilters = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      const queryParams = new URLSearchParams({
        ...(searchQuery ? { search: searchQuery } : {}),
        ...(filterGenre ? { genre: filterGenre } : {}),
        ...(filterStatus ? { status: filterStatus } : {}),
        ...(filterSort ? { sort: filterSort } : {})
      });
      const list = await apiFetch(`/api/series?${queryParams}`);
      setSeriesList(list);
      handleNavigate('home');
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  if (loading && seriesList.length === 0) {
    return (
      <div className="bg-obsidian-950 min-h-screen text-white flex flex-col items-center justify-center gap-6" dir="rtl">
        <Logo size="xl" />
        <div className="flex flex-col items-center gap-2">
          <span className="border-4 border-crimson-950 border-t-crimson-600 w-10 h-10 rounded-full animate-spin"></span>
          <h1 className="text-lg font-extrabold text-white tracking-wider animate-pulse font-sans">جاري تحميل DARK MANHWA...</h1>
          <p className="text-xs text-neutral-500 font-sans">تهيئة قارئ المانهوا وسيرفرات القراءة الفائقة...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-obsidian-950 min-h-screen text-neutral-200 font-sans antialiased overflow-x-hidden selection:bg-crimson-600 selection:text-white" dir="rtl">
      
      {/* BACKGROUND GRAPHIC ACCENTS */}
      <div className="absolute top-0 right-1/4 w-[500px] h-[500px] bg-crimson-900/5 rounded-full blur-3xl pointer-events-none"></div>
      <div className="absolute top-1/2 left-1/4 w-[600px] h-[600px] bg-crimson-900/5 rounded-full blur-3xl pointer-events-none"></div>

      {/* 1. MAIN GLOBAL NAVIGATION HEADER */}
      <header className="sticky top-0 z-50 bg-obsidian-950/80 backdrop-blur-xl border-b border-obsidian-850">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 h-20 flex items-center justify-between gap-6" dir="rtl">
          
          {/* Logo */}
          <div 
            onClick={() => handleNavigate('home')} 
            className="flex items-center gap-2 cursor-pointer shrink-0 select-none"
          >
            <Logo size="md" />
          </div>

          {/* Navigation Links */}
          <nav className="hidden lg:flex items-center gap-6 font-semibold text-xs whitespace-nowrap">
            <button
              onClick={() => handleNavigate('home')}
              className={`flex items-center gap-2 px-1 py-2 cursor-pointer transition-colors ${page === 'home' ? 'text-crimson-500 font-extrabold' : 'text-neutral-400 hover:text-white'}`}
            >
              <HomeIcon className="w-4 h-4 text-crimson-600" />
              <span>الرئيسية</span>
            </button>

            <button
              onClick={() => handleNavigate('manga-list')}
              className={`flex items-center gap-2 px-1 py-2 cursor-pointer transition-colors ${page === 'manga-list' ? 'text-crimson-500 font-extrabold' : 'text-neutral-400 hover:text-white'}`}
            >
              <BookOpen className="w-4 h-4 text-crimson-600" />
              <span>دليل الأعمال</span>
            </button>

            <button
              onClick={() => handleNavigate('teams')}
              className={`flex items-center gap-2 px-1 py-2 cursor-pointer transition-colors ${page === 'teams' ? 'text-crimson-500 font-extrabold' : 'text-neutral-400 hover:text-white'}`}
            >
              <Users className="w-4 h-4 text-crimson-600" />
              <span>فرق الترجمة</span>
            </button>

            <button
              onClick={() => handleNavigate('news')}
              className={`flex items-center gap-2 px-1 py-2 cursor-pointer transition-colors ${page === 'news' ? 'text-crimson-500 font-extrabold' : 'text-neutral-400 hover:text-white'}`}
            >
              <Newspaper className="w-4 h-4 text-crimson-600" />
              <span>الأخبار</span>
            </button>
          </nav>

          {/* Autocomplete Direct Live Search Bar */}
          <div className="flex-1 max-w-lg relative hidden md:block">
            <div className="relative">
              <Search className="absolute right-4 top-3 w-5 h-5 text-neutral-500" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => {
                  setSearchQuery(e.target.value);
                  setShowSearchDropdown(true);
                }}
                onFocus={() => setShowSearchDropdown(true)}
                placeholder="ابحث عن اسم مانجا، مانهوا، مؤلف..."
                className="w-full bg-obsidian-900/60 border border-obsidian-800 text-sm text-white pr-11 pl-12 py-2.5 rounded-2xl focus:border-crimson-600 focus:ring-1 focus:ring-crimson-600 transition-all text-right"
              />
              
              {/* Toggle Advanced filter button */}
              <button 
                onClick={() => setShowFiltersPanel(!showFiltersPanel)}
                className="absolute left-3 top-2 p-1 bg-obsidian-950 hover:bg-obsidian-800 rounded-lg text-neutral-400 hover:text-white transition-colors cursor-pointer"
                title="فلترة متقدمة"
              >
                <Filter className="w-4 h-4" />
              </button>
            </div>

            {/* Instant Autocomplete dropdown results list */}
            <AnimatePresence>
              {showSearchDropdown && searchResults.length > 0 && (
                <motion.div
                  initial={{ opacity: 0, y: 5 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: 5 }}
                  className="absolute top-14 left-0 right-0 bg-obsidian-900 border border-obsidian-800 rounded-2xl overflow-hidden shadow-2xl z-50 max-h-[360px] overflow-y-auto"
                >
                  <div className="p-2 divide-y divide-obsidian-800">
                    {searchResults.map(s => (
                      <div
                        key={s.id}
                        onClick={() => handleNavigate('details', { id: s.id })}
                        className="p-3 hover:bg-obsidian-950 flex items-center gap-4 cursor-pointer transition-colors"
                      >
                        <img src={s.coverUrl} alt={s.titleAr || s.titleEn} referrerPolicy="no-referrer" className="w-10 h-14 object-cover rounded-lg border border-obsidian-800 shrink-0" />
                        <div className="text-right overflow-hidden">
                          <h4 className="font-bold text-sm text-white truncate">{s.titleAr || s.titleEn}</h4>
                          <p className="text-xs text-neutral-500 font-sans tracking-wide truncate">{s.author}</p>
                          <p className="text-[10px] text-crimson-600 font-bold">{s.genres.slice(0, 2).join(' • ')}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          {/* User Operations / Action Menu */}
          <div className="flex items-center gap-3">
            
            {/* Direct Admin Control Key */}
            {currentUser && (currentUser.role === 'admin' || currentUser.role === 'moderator') && (
              <button
                onClick={() => handleNavigate('admin')}
                className={`p-2.5 rounded-xl border transition-all cursor-pointer flex items-center gap-1.5 ${page === 'admin' ? 'bg-crimson-600 border-transparent text-white' : 'bg-obsidian-950 hover:bg-obsidian-900 border-crimson-950 text-crimson-600'}`}
                title="لوحة الإدارة"
              >
                <ShieldCheck className="w-5 h-5" />
                <span className="text-xs font-bold hidden lg:inline">الإدارة</span>
              </button>
            )}

            {/* Library bookmarks quick link */}
            {currentUser && (
              <button
                onClick={() => handleNavigate('profile', { tab: 'favorites' })}
                className="p-2.5 bg-obsidian-950 hover:bg-obsidian-900 border border-obsidian-900 text-neutral-400 hover:text-white rounded-xl transition-all cursor-pointer relative"
                title="المفضلة والإشارات"
              >
                <BookMarked className="w-5 h-5" />
                {unreadCount > 0 && (
                  <span className="absolute -top-1.5 -left-1.5 flex h-5 w-5 items-center justify-center rounded-full bg-crimson-600 text-[9px] font-black text-white ring-2 ring-obsidian-950 animate-pulse">
                    {unreadCount}
                  </span>
                )}
              </button>
            )}

            {/* Bell Notifications Button */}
            {currentUser && (
              <button
                onClick={() => handleNavigate('profile', { tab: 'notifications' })}
                className="p-2.5 bg-obsidian-950 hover:bg-obsidian-900 border border-obsidian-900 text-neutral-400 hover:text-white rounded-xl transition-all cursor-pointer relative"
                title="الإشعارات"
              >
                <Bell className="w-5 h-5" />
                {unreadCount > 0 && (
                  <span className="absolute -top-1.5 -left-1.5 flex h-5 w-5 items-center justify-center rounded-full bg-crimson-600 text-[9px] font-black text-white ring-2 ring-obsidian-950">
                    {unreadCount}
                  </span>
                )}
              </button>
            )}

            {/* Profile Avatar Trigger or Login button */}
            {currentUser ? (
              <div 
                onClick={() => handleNavigate('profile')}
                className="flex items-center gap-2 cursor-pointer group"
              >
                <img
                  src={currentUser.avatarUrl}
                  alt={currentUser.username}
                  referrerPolicy="no-referrer"
                  className="w-9 h-9 rounded-xl object-cover border-2 border-obsidian-800 group-hover:border-crimson-600 transition-colors"
                />
                <span className="text-xs font-bold text-neutral-300 group-hover:text-white transition-colors hidden sm:inline">{currentUser.username}</span>
              </div>
            ) : (
              <button
                onClick={() => handleNavigate('auth')}
                className="bg-crimson-600 hover:bg-crimson-500 text-white font-bold px-4 py-2.5 rounded-xl text-xs shadow-md cursor-pointer transition-all flex items-center gap-1.5"
              >
                <LogIn className="w-4 h-4" /> دخول
              </button>
            )}
          </div>

        </div>
      </header>

      {/* MOBILE SECONDARY SUB-HEADER NAVBAR */}
      <div className="lg:hidden bg-obsidian-950 border-b border-obsidian-850 px-4 py-3 flex items-center justify-around gap-2" dir="rtl">
        <button
          onClick={() => handleNavigate('home')}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs transition-all ${page === 'home' ? 'bg-crimson-950/40 text-crimson-500 font-black' : 'text-neutral-400'}`}
        >
          <HomeIcon className="w-3.5 h-3.5 text-crimson-600" />
          <span>الرئيسية</span>
        </button>

        <button
          onClick={() => handleNavigate('manga-list')}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs transition-all ${page === 'manga-list' ? 'bg-crimson-950/40 text-crimson-500 font-black' : 'text-neutral-400'}`}
        >
          <BookOpen className="w-3.5 h-3.5 text-crimson-600" />
          <span>الدليل</span>
        </button>

        <button
          onClick={() => handleNavigate('teams')}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs transition-all ${page === 'teams' ? 'bg-crimson-950/40 text-crimson-500 font-black' : 'text-neutral-400'}`}
        >
          <Users className="w-3.5 h-3.5 text-crimson-600" />
          <span>الفرق</span>
        </button>

        <button
          onClick={() => handleNavigate('news')}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs transition-all ${page === 'news' ? 'bg-crimson-950/40 text-crimson-500 font-black' : 'text-neutral-400'}`}
        >
          <Newspaper className="w-3.5 h-3.5 text-crimson-600" />
          <span>الأخبار</span>
        </button>
      </div>

      {/* 2. ADVANCED SEARCH FILTERS OVERLAY */}
      <AnimatePresence>
        {showFiltersPanel && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="bg-obsidian-900 border-b border-obsidian-850 overflow-hidden"
          >
            <form onSubmit={handleApplyAdvancedFilters} className="max-w-4xl mx-auto px-6 py-6 space-y-4 text-right" dir="rtl">
              <div className="flex items-center justify-between border-b border-obsidian-800 pb-2">
                <h3 className="font-extrabold text-sm text-crimson-500 flex items-center gap-1.5">
                  <Filter className="w-4 h-4" /> البحث والفلترة المتقدمة للأعمال
                </h3>
                <button 
                  type="button" 
                  onClick={() => setShowFiltersPanel(false)}
                  className="text-neutral-500 hover:text-white transition-colors cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                {/* Genre Select */}
                <div>
                  <label className="block text-xs text-neutral-400 mb-1.5 font-medium">التصنيف:</label>
                  <select
                    value={filterGenre}
                    onChange={(e) => setFilterGenre(e.target.value)}
                    className="w-full bg-obsidian-850 border border-obsidian-800 text-xs text-white px-3 py-2.5 rounded-xl outline-none"
                  >
                    <option value="">جميع التصنيفات</option>
                    {['أكشن', 'مغامرة', 'خيال', 'شوانين', 'سينين', 'خارق للطبيعة', 'رعب', 'كوميديا', 'دراما', 'غموض', 'شياطين', 'شريحة من الحياة', 'رياضة', 'إيسيكاي'].map(g => (
                      <option key={g} value={g}>{g}</option>
                    ))}
                  </select>
                </div>

                {/* Status Select */}
                <div>
                  <label className="block text-xs text-neutral-400 mb-1.5 font-medium">حالة العمل:</label>
                  <select
                    value={filterStatus}
                    onChange={(e) => setFilterStatus(e.target.value)}
                    className="w-full bg-obsidian-850 border border-obsidian-800 text-xs text-white px-3 py-2.5 rounded-xl outline-none"
                  >
                    <option value="">جميع الحالات</option>
                    <option value="ongoing">مستمر</option>
                    <option value="completed">مكتمل</option>
                    <option value="paused">متوقف</option>
                    <option value="dropped">ملغى</option>
                  </select>
                </div>

                {/* Sort Order select */}
                <div>
                  <label className="block text-xs text-neutral-400 mb-1.5 font-medium">ترتيب حسب:</label>
                  <select
                    value={filterSort}
                    onChange={(e) => setFilterSort(e.target.value)}
                    className="w-full bg-obsidian-850 border border-obsidian-800 text-xs text-white px-3 py-2.5 rounded-xl outline-none"
                  >
                    <option value="newest">الأحدث إضافة</option>
                    <option value="views">الأكثر مشاهدة</option>
                    <option value="likes">الأكثر إعجاباً</option>
                    <option value="rating">الأعلى تقييماً</option>
                    <option value="oldest">الأقدم إضافة</option>
                  </select>
                </div>
              </div>

              <button
                type="submit"
                className="w-full bg-crimson-600 hover:bg-crimson-500 text-white font-bold py-2.5 rounded-xl text-xs transition-colors cursor-pointer shadow-md"
              >
                تطبيق الفلترة
              </button>
            </form>
          </motion.div>
        )}
      </AnimatePresence>

      {/* 3. DYNAMIC STAGE CONTAINER */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 py-10 min-h-[75vh]">
        <AnimatePresence mode="wait">
          <motion.div
            key={page + (params.id || '')}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.3 }}
          >
            {page === 'home' && (
              <Home 
                seriesList={seriesList} 
                onNavigate={handleNavigate} 
                onSelectRandom={handleSelectRandom} 
                currentUser={currentUser}
              />
            )}

            {page === 'manga-list' && (
              <MangaList 
                seriesList={seriesList} 
                onNavigate={handleNavigate} 
                currentUser={currentUser}
              />
            )}

            {page === 'teams' && (
              <Teams 
                currentUser={currentUser} 
                onNavigate={handleNavigate}
              />
            )}

            {page === 'news' && (
              <News 
                currentUser={currentUser} 
                onNavigate={handleNavigate}
              />
            )}

            {page === 'details' && (
              <Details 
                seriesId={params.id} 
                currentUser={currentUser} 
                allSeries={seriesList}
                onNavigate={handleNavigate} 
                onRequireLogin={() => handleNavigate('auth')} 
              />
            )}

            {page === 'reader' && (
              <Reader 
                chapterId={params.id} 
                currentUser={currentUser} 
                onNavigate={handleNavigate} 
                onRequireLogin={() => handleNavigate('auth')} 
              />
            )}

            {page === 'auth' && (
              <Auth 
                onSuccess={(user) => {
                  setCurrentUser(user);
                  handleNavigate('home');
                  triggerLoginSync(user);
                }} 
              />
            )}

            {page === 'profile' && currentUser && (
              <Profile 
                currentUser={currentUser} 
                onLogout={handleLogout} 
                onNavigate={handleNavigate} 
                onUpdateUser={(updated) => setCurrentUser(updated)}
                initialTab={params.tab}
                onRefreshUnreadCount={fetchUnreadCount}
              />
            )}

            {page === 'admin' && currentUser && (
              <Admin 
                currentUser={currentUser} 
                allSeries={seriesList}
                onNavigate={handleNavigate} 
                onRefreshDatabase={handleRefreshDatabase}
              />
            )}

            {/* Static Content Routes */}
            {['about', 'privacy', 'terms', 'contact', 'dmca'].includes(page) && (
              <StaticPages 
                pageType={page as any} 
                onNavigate={handleNavigate} 
              />
            )}
          </motion.div>
        </AnimatePresence>
      </main>

      {/* 4. FOOTER */}
      <footer className="bg-obsidian-900 border-t border-obsidian-850 text-neutral-400 py-12">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 grid grid-cols-1 md:grid-cols-4 gap-8 text-right" dir="rtl">
          
          {/* Brand brief */}
          <div className="space-y-4 md:col-span-2">
            <div 
              onClick={() => handleNavigate('home')} 
              className="inline-block cursor-pointer"
            >
              <Logo size="lg" />
            </div>
            <p className="text-xs text-neutral-500 leading-relaxed max-w-sm">
              المنصة العربية الأولى لمتابعة وقراءة المانجا والمانهوا المترجمة فور صدورها بجودة عالية وبدون إعلانات مزعجة.
            </p>
            <div className="flex gap-4 pt-1 justify-start">
              <a href="#" className="p-2 bg-obsidian-850 hover:bg-crimson-950/20 hover:text-crimson-500 rounded-xl transition-all">
                <Facebook className="w-4 h-4" />
              </a>
              <a href="#" className="p-2 bg-obsidian-850 hover:bg-crimson-950/20 hover:text-crimson-500 rounded-xl transition-all">
                <Twitter className="w-4 h-4" />
              </a>
              <a href="#" className="p-2 bg-obsidian-850 hover:bg-crimson-950/20 hover:text-crimson-500 rounded-xl transition-all">
                <span className="font-bold text-xs font-sans">🎮</span>
              </a>
            </div>
          </div>

          {/* Nav Links column 1 */}
          <div className="space-y-3 text-xs">
            <h4 className="font-extrabold text-white text-sm">دارك مانهوا / DARK MANHWA</h4>
            <ul className="space-y-2">
              <li><button onClick={() => handleNavigate('about')} className="hover:text-crimson-500 cursor-pointer">من نحن والمنصة</button></li>
              <li><button onClick={() => handleNavigate('privacy')} className="hover:text-crimson-500 cursor-pointer">سياسة الخصوصية</button></li>
              <li><button onClick={() => handleNavigate('terms')} className="hover:text-crimson-500 cursor-pointer">شروط الاستخدام</button></li>
            </ul>
          </div>

          {/* Nav Links column 2 */}
          <div className="space-y-3 text-xs">
            <h4 className="font-extrabold text-white text-sm">الدعم والسياسات</h4>
            <ul className="space-y-2">
              <li><button onClick={() => handleNavigate('contact')} className="hover:text-crimson-500 cursor-pointer">اتصل بنا والدعم</button></li>
              <li><button onClick={() => handleNavigate('dmca')} className="hover:text-crimson-500 cursor-pointer">حقوق النشر DMCA</button></li>
              <li><button onClick={() => handleNavigate('about')} className="hover:text-crimson-500 cursor-pointer">توثيق فرق الترجمة</button></li>
            </ul>
          </div>

        </div>

        {/* Rights Bottom Bar */}
        <div className="max-w-7xl mx-auto px-4 sm:px-6 pt-8 mt-8 border-t border-obsidian-850 text-center text-[10px] text-neutral-600 font-sans" dir="rtl">
          <p>© 2026 DARK MANHWA (دارك مانهوا). جميع الحقوق محفوظة. جميع قصص المانجا والمانهوا والشخصيات مملوكة لأصحابها الأصليين.</p>
        </div>
      </footer>

      {/* Global Ads Manager */}
      <GlobalAdsManager />

    </div>
  );
}
