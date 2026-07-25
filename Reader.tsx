/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  ArrowLeft, ChevronLeft, ChevronRight, Settings, Maximize2, Minimize2, 
  BookMarked, FileText, Layout, RotateCcw, ZoomIn, ZoomOut, MessageCircle, Star, Moon,
  Play, Pause, ArrowUp, ArrowDown
} from 'lucide-react';
import { apiFetch } from '../lib/api';
import { Chapter, Series, Comment, User } from '../types';
import { useSEO } from '../hooks/useSEO';
import { AdZoneComponent } from '../components/AdZone';

interface ReaderProps {
  chapterId: string;
  currentUser: User | null;
  onNavigate: (page: string, params?: any) => void;
  onRequireLogin: () => void;
}

type Direction = 'vertical' | 'rtl' | 'ltr';

export default function Reader({ chapterId, currentUser, onNavigate, onRequireLogin }: ReaderProps) {
  const [data, setData] = useState<{
    chapter: Chapter;
    series: Series;
    prevChapter: { id: string; number: number } | null;
    nextChapter: { id: string; number: number } | null;
    allChapters: { id: string; number: number; titleEn?: string; titleAr?: string }[];
  } | null>(null);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // Reader Settings
  const [direction, setDirection] = useState<Direction>('vertical');
  const [zoom, setZoom] = useState(100);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const [bookmarked, setBookmarked] = useState(false);
  const [readerBg, setReaderBg] = useState<'pure-black' | 'dark-gray'>(() => {
    const saved = localStorage.getItem('reader-bg');
    return (saved === 'pure-black' || saved === 'dark-gray') ? saved : 'pure-black';
  });
  const [readerWidth, setReaderWidth] = useState<'narrow' | 'medium' | 'wide' | 'full'>(() => {
    const saved = localStorage.getItem('reader-width');
    return (saved === 'narrow' || saved === 'medium' || saved === 'wide' || saved === 'full') ? saved : 'medium';
  });
  const [pagesGap, setPagesGap] = useState<'none' | 'small' | 'medium' | 'large'>(() => {
    const saved = localStorage.getItem('reader-pages-gap');
    return (saved === 'none' || saved === 'small' || saved === 'medium' || saved === 'large') ? saved : 'none';
  });
  const [useProxy, setUseProxy] = useState<boolean>(() => {
    const saved = localStorage.getItem('reader-use-proxy');
    return saved !== 'false';
  });

  // Auto-scroll states
  const [isAutoScrolling, setIsAutoScrolling] = useState(false);
  const [scrollSpeed, setScrollSpeed] = useState(2);
  const [isDataSaver, setIsDataSaver] = useState<boolean>(() => {
    return localStorage.getItem('reader-data-saver') === 'true';
  });

  // Comments state
  const [comments, setComments] = useState<Comment[]>([]);
  const [newCommentText, setNewCommentText] = useState('');
  const [isSubmittingComment, setIsSubmittingComment] = useState(false);

  // Auto-scroll speed controller effect
  useEffect(() => {
    if (!isAutoScrolling) return;

    let intervalId: any;
    const scrollStep = () => {
      window.scrollBy({
        top: scrollSpeed,
        left: 0,
        behavior: 'auto'
      });
      intervalId = setTimeout(scrollStep, 35);
    };

    intervalId = setTimeout(scrollStep, 35);
    return () => clearTimeout(intervalId);
  }, [isAutoScrolling, scrollSpeed]);

  const fetchComments = async () => {
    if (!data?.series) return;
    try {
      const res = await fetch(`/api/series/${data.series.id}/comments`);
      if (res.ok) {
        const d = await res.json();
        setComments(d);
      }
    } catch (err) {
      console.error('Error fetching comments:', err);
    }
  };

  useEffect(() => {
    if (data?.series) {
      fetchComments();
    }
  }, [data?.series, chapterId]);

  const handlePostComment = async () => {
    if (!newCommentText.trim() || !data) return;
    setIsSubmittingComment(true);
    try {
      const res = await fetch(`/api/series/${data.series.id}/comments`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        },
        body: JSON.stringify({
          content: newCommentText,
          chapterId: data.chapter.id
        })
      });
      if (res.ok) {
        setNewCommentText('');
        fetchComments();
      } else {
        const errorData = await res.json();
        alert(errorData.message || 'Failed to submit comment');
      }
    } catch (err) {
      console.error(err);
    } finally {
      setIsSubmittingComment(false);
    }
  };

  const handleDataSaverToggle = (val: boolean) => {
    setIsDataSaver(val);
    localStorage.setItem('reader-data-saver', String(val));
  };

  const handleBgChange = (bg: 'pure-black' | 'dark-gray') => {
    setReaderBg(bg);
    localStorage.setItem('reader-bg', bg);
  };

  const handleWidthChange = (w: 'narrow' | 'medium' | 'wide' | 'full') => {
    setReaderWidth(w);
    localStorage.setItem('reader-width', w);
  };

  const handleGapChange = (g: 'none' | 'small' | 'medium' | 'large') => {
    setPagesGap(g);
    localStorage.setItem('reader-pages-gap', g);
  };

  const handleProxyToggle = (val: boolean) => {
    setUseProxy(val);
    localStorage.setItem('reader-use-proxy', String(val));
  };

  const resolvePageUrl = (url: string) => {
    if (!url) return '';
    if (url.startsWith('data:') || url.startsWith('/') || url.startsWith('blob:')) {
      return url;
    }
    let finalUrl = url;
    if (useProxy) {
      finalUrl = `/api/image-proxy?url=${encodeURIComponent(url)}`;
    }
    if (isDataSaver) {
      if (finalUrl.includes('picsum.photos')) {
        finalUrl = finalUrl.replace('/800/1200', '/400/600');
      }
    }
    return finalUrl;
  };
  
  const readerContainerRef = useRef<HTMLDivElement>(null);

  // Dynamic SEO Configuration
  useSEO({
    title: data ? `${data.series.titleAr || data.series.titleEn} - الفصل ${data.chapter.number}` : 'قراءة الفصل',
    description: data ? `اقرأ الفصل ${data.chapter.number} من مانجا ${data.series.titleAr || data.series.titleEn} مترجم للعربية بجودة عالية.` : 'اقرأ الفصول المترجمة أونلاين.',
    keywords: data ? [
      `${data.series.titleAr || data.series.titleEn} الفصل ${data.chapter.number}`,
      `قراءة الفصل ${data.chapter.number}`,
      'مانجا اونلاين'
    ] : undefined,
    image: data?.series.coverUrl,
    type: 'article'
  });

  useEffect(() => {
    fetchChapter();
  }, [chapterId]);

  const fetchChapter = async () => {
    setLoading(true);
    setError('');
    try {
      const res = await apiFetch(`/api/chapters/${chapterId}`);
      setData(res);
      setCurrentPage(1);
      setBookmarked(false);

      if (currentUser) {
        await apiFetch(`/api/chapters/${chapterId}/history`, {
          method: 'POST',
          body: JSON.stringify({
            pageNum: 1,
            seriesId: res.series.id,
            chapterNumber: res.chapter.number
          })
        }).catch(() => {});
      }
    } catch (err: any) {
      setError(err.message || 'فشل في تحميل الفصل');
    } finally {
      setLoading(false);
    }
  };

  const handlePageChange = async (pageNum: number) => {
    if (!data) return;
    const bounded = Math.max(1, Math.min(pageNum, data.chapter.pages.length));
    setCurrentPage(bounded);

    if (currentUser) {
      await apiFetch(`/api/chapters/${chapterId}/history`, {
        method: 'POST',
        body: JSON.stringify({
          pageNum: bounded,
          seriesId: data.series.id,
          chapterNumber: data.chapter.number
        })
      }).catch(() => {});
    }
  };

  const toggleFullscreen = () => {
    if (!document.fullscreenElement) {
      readerContainerRef.current?.requestFullscreen().then(() => {
        setIsFullscreen(true);
      }).catch(() => {});
    } else {
      document.exitFullscreen().then(() => {
        setIsFullscreen(false);
      }).catch(() => {});
    }
  };

  const toggleBookmark = () => {
    setBookmarked(!bookmarked);
    if (!bookmarked) {
      alert('🔖 تم حفظ تقدم القراءة بنجاح!');
    }
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[70vh] gap-4" dir="rtl">
        <span className="border-4 border-crimson-950 border-t-crimson-600 w-12 h-12 rounded-full animate-spin"></span>
        <p className="text-neutral-400 text-sm">جاري تحميل القارئ والصور بأعلى سرعة...</p>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="min-h-[50vh] flex flex-col items-center justify-center text-center p-8 space-y-4" dir="rtl">
        <p className="text-crimson-500 font-bold">{error || 'الفصل غير موجود'}</p>
        <button 
          onClick={() => onNavigate('home')}
          className="bg-obsidian-900 border border-obsidian-800 text-white px-6 py-2.5 rounded-xl text-sm hover:border-crimson-600 transition-colors cursor-pointer"
        >
          العودة للرئيسية
        </button>
      </div>
    );
  }

  const { chapter, series, prevChapter, nextChapter, allChapters } = data;

  return (
    <div className="space-y-6 pb-16 text-right" dir="rtl" ref={readerContainerRef}>
      {/* Top Ad Zone */}
      <AdZoneComponent position="top" />
      
      {/* 1. TOP HEADER NAVIGATION BAR */}
      <div className="bg-obsidian-950/90 border border-obsidian-850 backdrop-blur-md p-4 rounded-2xl flex flex-col md:flex-row items-center justify-between gap-4 shadow-xl">
        {/* Info & Back link */}
        <div className="flex items-center gap-3">
          <button 
            onClick={() => onNavigate('details', { id: series.id })}
            className="p-2 bg-obsidian-900 hover:bg-obsidian-800 rounded-xl text-neutral-400 hover:text-white transition-all cursor-pointer"
            title="العودة لتفاصيل العمل"
          >
            <ArrowLeft className="w-5 h-5 rotate-180" />
          </button>
          <div>
            <h1 className="font-extrabold text-sm text-white">{series.titleAr || series.titleEn}</h1>
            <p className="text-xs text-crimson-500 font-bold mt-0.5">الفصل {chapter.number} {chapter.titleAr ? `- ${chapter.titleAr}` : chapter.titleEn ? `- ${chapter.titleEn}` : ''}</p>
          </div>
        </div>

        {/* Quick Chapter selection Picker & Navigators */}
        <div className="flex items-center gap-2">
          {/* Previous Chapter */}
          <button
            onClick={() => prevChapter && onNavigate('reader', { id: prevChapter.id })}
            disabled={!prevChapter}
            className="p-2 bg-obsidian-900 disabled:bg-obsidian-950 disabled:text-obsidian-800 hover:bg-obsidian-800 rounded-xl text-neutral-300 transition-all cursor-pointer"
            title="الفصل السابق"
          >
            <ChevronRight className="w-5 h-5" />
          </button>

          {/* Chapters Dropdown with Optgroup Chunking for 7000+ Chapters */}
          <select
            value={chapter.id}
            onChange={(e) => onNavigate('reader', { id: e.target.value })}
            className="bg-obsidian-900 border border-obsidian-800 text-xs text-white px-3 py-2 rounded-xl focus:border-crimson-600 outline-none font-bold cursor-pointer max-w-[200px] truncate"
          >
            {allChapters.length > 100 ? (
              (() => {
                const groups: { [key: string]: typeof allChapters } = {};
                allChapters.forEach(ch => {
                  const groupStart = Math.floor((ch.number - 1) / 100) * 100 + 1;
                  const groupEnd = groupStart + 99;
                  const key = `الفصول ${groupStart} - ${groupEnd}`;
                  if (!groups[key]) groups[key] = [];
                  groups[key].push(ch);
                });
                return Object.entries(groups).map(([label, list]) => (
                  <optgroup key={label} label={label} className="bg-obsidian-950 text-crimson-400 font-bold">
                    {list.map(ch => (
                      <option key={ch.id} value={ch.id} className="bg-obsidian-900 text-white font-sans font-normal">
                        الفصل {ch.number} {ch.titleAr ? `: ${ch.titleAr}` : ''}
                      </option>
                    ))}
                  </optgroup>
                ));
              })()
            ) : (
              allChapters.map(ch => (
                <option key={ch.id} value={ch.id}>
                  الفصل {ch.number} {ch.titleAr ? `: ${ch.titleAr}` : ch.titleEn ? `: ${ch.titleEn}` : ''}
                </option>
              ))
            )}
          </select>

          {/* Next Chapter */}
          <button
            onClick={() => nextChapter && onNavigate('reader', { id: nextChapter.id })}
            disabled={!nextChapter}
            className="p-2 bg-obsidian-900 disabled:bg-obsidian-950 disabled:text-obsidian-800 hover:bg-obsidian-800 rounded-xl text-neutral-300 transition-all cursor-pointer"
            title="الفصل التالي"
          >
            <ChevronLeft className="w-5 h-5" />
          </button>
        </div>

        {/* Reader Config Controls */}
        <div className="flex items-center gap-2">
          {/* Bookmark Progress */}
          <button
            onClick={toggleBookmark}
            className={`p-2.5 rounded-xl transition-all cursor-pointer ${bookmarked ? 'bg-crimson-950 text-crimson-500 border border-crimson-900/40' : 'bg-obsidian-900 text-neutral-400 hover:text-white'}`}
            title="حفظ موضع القراءة"
          >
            <BookMarked className="w-5 h-5" />
          </button>

          {/* Quick Settings Drawer Toggle */}
          <button
            onClick={() => setShowSettings(!showSettings)}
            className={`p-2.5 rounded-xl transition-all cursor-pointer ${showSettings ? 'bg-crimson-600 text-white shadow-md' : 'bg-obsidian-900 text-neutral-400 hover:text-white'}`}
            title="إعدادات القارئ"
          >
            <Settings className="w-5 h-5" />
          </button>

          {/* Fullscreen mode */}
          <button
            onClick={toggleFullscreen}
            className="p-2.5 bg-obsidian-900 text-neutral-400 hover:text-white rounded-xl transition-all cursor-pointer"
            title="ملء الشاشة"
          >
            {isFullscreen ? <Minimize2 className="w-5 h-5" /> : <Maximize2 className="w-5 h-5" />}
          </button>
        </div>
      </div>

      {/* 2. ADVANCED SETTINGS PANEL */}
      <AnimatePresence>
        {showSettings && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="bg-obsidian-950 border border-obsidian-850 p-5 rounded-2xl grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-5 shadow-xl"
          >
            {/* Reading Direction */}
            <div className="space-y-2 text-right">
              <label className="block text-xs font-bold text-neutral-400">وضع القراءة:</label>
              <div className="grid grid-cols-3 gap-1.5">
                <button
                  type="button"
                  onClick={() => setDirection('vertical')}
                  className={`py-2 px-1 rounded-xl text-[10px] md:text-[11px] font-bold transition-all cursor-pointer ${direction === 'vertical' ? 'bg-crimson-600 text-white' : 'bg-obsidian-900 text-neutral-400 hover:bg-obsidian-800'}`}
                >
                  ويب أون (عمودي)
                </button>
                <button
                  type="button"
                  onClick={() => setDirection('ltr')}
                  className={`py-2 px-1 rounded-xl text-[10px] md:text-[11px] font-bold transition-all cursor-pointer ${direction === 'ltr' ? 'bg-crimson-600 text-white' : 'bg-obsidian-900 text-neutral-400 hover:bg-obsidian-800'}`}
                >
                  من اليسار لليمين
                </button>
                <button
                  type="button"
                  onClick={() => setDirection('rtl')}
                  className={`py-2 px-1 rounded-xl text-[10px] md:text-[11px] font-bold transition-all cursor-pointer ${direction === 'rtl' ? 'bg-crimson-600 text-white' : 'bg-obsidian-900 text-neutral-400 hover:bg-obsidian-800'}`}
                >
                  من اليمين لليسار
                </button>
              </div>
            </div>

            {/* Reader Width Setting */}
            <div className="space-y-2 text-right">
              <label className="block text-xs font-bold text-neutral-400">عرض قارئ الفصول:</label>
              <div className="grid grid-cols-4 gap-1.5">
                <button
                  type="button"
                  onClick={() => handleWidthChange('narrow')}
                  className={`py-2 px-1 rounded-xl text-[10px] md:text-[11px] font-bold transition-all cursor-pointer ${readerWidth === 'narrow' ? 'bg-crimson-600 text-white' : 'bg-obsidian-900 text-neutral-400 hover:bg-obsidian-800'}`}
                >
                  ضيّق
                </button>
                <button
                  type="button"
                  onClick={() => handleWidthChange('medium')}
                  className={`py-2 px-1 rounded-xl text-[10px] md:text-[11px] font-bold transition-all cursor-pointer ${readerWidth === 'medium' ? 'bg-crimson-600 text-white' : 'bg-obsidian-900 text-neutral-400 hover:bg-obsidian-800'}`}
                >
                  متوسط
                </button>
                <button
                  type="button"
                  onClick={() => handleWidthChange('wide')}
                  className={`py-2 px-1 rounded-xl text-[10px] md:text-[11px] font-bold transition-all cursor-pointer ${readerWidth === 'wide' ? 'bg-crimson-600 text-white' : 'bg-obsidian-900 text-neutral-400 hover:bg-obsidian-800'}`}
                >
                  عريض
                </button>
                <button
                  type="button"
                  onClick={() => handleWidthChange('full')}
                  className={`py-2 px-1 rounded-xl text-[10px] md:text-[11px] font-bold transition-all cursor-pointer ${readerWidth === 'full' ? 'bg-crimson-600 text-white' : 'bg-obsidian-900 text-neutral-400 hover:bg-obsidian-800'}`}
                >
                  كامل
                </button>
              </div>
            </div>

            {/* Spacing/Gap between pages */}
            <div className="space-y-2 text-right">
              <label className="block text-xs font-bold text-neutral-400">المسافة بين الصفحات:</label>
              <div className="grid grid-cols-4 gap-1.5">
                <button
                  type="button"
                  onClick={() => handleGapChange('none')}
                  className={`py-2 px-1 rounded-xl text-[10px] md:text-[11px] font-bold transition-all cursor-pointer ${pagesGap === 'none' ? 'bg-crimson-600 text-white' : 'bg-obsidian-900 text-neutral-400 hover:bg-obsidian-800'}`}
                >
                  بدون
                </button>
                <button
                  type="button"
                  onClick={() => handleGapChange('small')}
                  className={`py-2 px-1 rounded-xl text-[10px] md:text-[11px] font-bold transition-all cursor-pointer ${pagesGap === 'small' ? 'bg-crimson-600 text-white' : 'bg-obsidian-900 text-neutral-400 hover:bg-obsidian-800'}`}
                >
                  صغيرة
                </button>
                <button
                  type="button"
                  onClick={() => handleGapChange('medium')}
                  className={`py-2 px-1 rounded-xl text-[10px] md:text-[11px] font-bold transition-all cursor-pointer ${pagesGap === 'medium' ? 'bg-crimson-600 text-white' : 'bg-obsidian-900 text-neutral-400 hover:bg-obsidian-800'}`}
                >
                  متوسطة
                </button>
                <button
                  type="button"
                  onClick={() => handleGapChange('large')}
                  className={`py-2 px-1 rounded-xl text-[10px] md:text-[11px] font-bold transition-all cursor-pointer ${pagesGap === 'large' ? 'bg-crimson-600 text-white' : 'bg-obsidian-900 text-neutral-400 hover:bg-obsidian-800'}`}
                >
                  كبيرة
                </button>
              </div>
            </div>

            {/* Custom Zoom */}
            <div className="space-y-2 text-right">
              <label className="block text-xs font-bold text-neutral-400">مستوى التكبير:</label>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setZoom(prev => Math.max(50, prev - 10))}
                  className="bg-obsidian-900 hover:bg-obsidian-800 p-2 rounded-xl text-neutral-400 hover:text-white cursor-pointer"
                >
                  <ZoomOut className="w-4 h-4" />
                </button>
                <span className="text-xs font-bold text-white w-10 text-center font-mono">{zoom}%</span>
                <button
                  type="button"
                  onClick={() => setZoom(prev => Math.min(150, prev + 10))}
                  className="bg-obsidian-900 hover:bg-obsidian-800 p-2 rounded-xl text-neutral-400 hover:text-white cursor-pointer"
                >
                  <ZoomIn className="w-4 h-4" />
                </button>
                <button
                  type="button"
                  onClick={() => setZoom(100)}
                  className="bg-obsidian-900 hover:bg-obsidian-800 px-2 py-2 rounded-xl text-[10px] text-neutral-400 hover:text-white font-sans cursor-pointer shrink-0"
                >
                  إعادة ضبط
                </button>
              </div>
            </div>

            {/* Night Reading Mode Background Settings */}
            <div className="space-y-2 text-right">
              <label className="block text-xs font-bold text-neutral-400 flex items-center gap-1">
                <Moon className="w-3.5 h-3.5 text-crimson-500 animate-pulse" />
                خلفية القارئ:
              </label>
              <div className="grid grid-cols-2 gap-1.5">
                <button
                  type="button"
                  onClick={() => handleBgChange('pure-black')}
                  className={`py-2 px-1.5 rounded-xl text-[10px] md:text-[11px] font-bold transition-all cursor-pointer ${
                    readerBg === 'pure-black' 
                      ? 'bg-white text-black ring-2 ring-white/10' 
                      : 'bg-obsidian-900 text-neutral-400 hover:bg-obsidian-800 hover:text-white border border-neutral-800/40'
                  }`}
                >
                  أسود داكن
                </button>
                <button
                  type="button"
                  onClick={() => handleBgChange('dark-gray')}
                  className={`py-2 px-1.5 rounded-xl text-[10px] md:text-[11px] font-bold transition-all cursor-pointer ${
                    readerBg === 'dark-gray' 
                      ? 'bg-neutral-800 text-white ring-2 ring-neutral-700/30' 
                      : 'bg-obsidian-900 text-neutral-400 hover:bg-obsidian-800 hover:text-white border border-neutral-800/40'
                  }`}
                >
                  رمادي ليلي
                </button>
              </div>
            </div>

            {/* Image Proxy Toggle */}
            <div className="space-y-2 text-right">
              <label className="block text-xs font-bold text-neutral-400">سيرفر تجديد الصور (Proxy):</label>
              <div className="grid grid-cols-2 gap-1.5">
                <button
                  type="button"
                  onClick={() => handleProxyToggle(true)}
                  className={`py-2 px-1 rounded-xl text-[10px] md:text-[11px] font-bold transition-all cursor-pointer ${
                    useProxy 
                      ? 'bg-emerald-600 text-white' 
                      : 'bg-obsidian-900 text-neutral-400 hover:bg-obsidian-800'
                  }`}
                >
                  مفعل (سريع)
                </button>
                <button
                  type="button"
                  onClick={() => handleProxyToggle(false)}
                  className={`py-2 px-1 rounded-xl text-[10px] md:text-[11px] font-bold transition-all cursor-pointer ${
                    !useProxy 
                      ? 'bg-neutral-700 text-white' 
                      : 'bg-obsidian-900 text-neutral-400 hover:bg-obsidian-800'
                  }`}
                >
                  مباشر
                </button>
              </div>
            </div>

            {/* Data Saver Mode */}
            <div className="space-y-2 text-right">
              <label className="block text-xs font-bold text-neutral-400">توفير البيانات:</label>
              <div className="grid grid-cols-2 gap-1.5">
                <button
                  type="button"
                  onClick={() => handleDataSaverToggle(true)}
                  className={`py-2 px-1 rounded-xl text-[10px] md:text-[11px] font-bold transition-all cursor-pointer ${
                    isDataSaver 
                      ? 'bg-crimson-600 text-white' 
                      : 'bg-obsidian-900 text-neutral-400 hover:bg-obsidian-800'
                  }`}
                >
                  مفعل
                </button>
                <button
                  type="button"
                  onClick={() => handleDataSaverToggle(false)}
                  className={`py-2 px-1 rounded-xl text-[10px] md:text-[11px] font-bold transition-all cursor-pointer ${
                    !isDataSaver 
                      ? 'bg-neutral-700 text-white' 
                      : 'bg-obsidian-900 text-neutral-400 hover:bg-obsidian-800'
                  }`}
                >
                  الجودة الكريستالية
                </button>
              </div>
            </div>

            {/* Status helper */}
            <div className="space-y-1 self-center text-right">
              <p className="text-xs text-neutral-400 font-bold">موقع القراءة الحالي:</p>
              <p className="text-[11px] text-neutral-500">
                الصفحة <strong className="text-crimson-500 font-mono text-sm">{currentPage}</strong> من <strong className="text-white font-mono text-sm">{chapter.pages.length}</strong>.
              </p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* 3. MAIN IMAGES CANVAS CONTAINER */}
      <div className={`rounded-3xl border transition-all duration-300 flex flex-col items-center shadow-inner overflow-hidden min-h-[500px] ${direction === 'vertical' ? 'p-0' : 'p-4'} ${
        readerBg === 'pure-black' 
          ? 'bg-black border-black' 
          : 'bg-[#18181c] border-neutral-800/50'
      }`}>
        {direction === 'vertical' ? (
          /* VERTICAL SCROLL (WEBTOON STYLE) */
          <div className={`w-full flex flex-col items-center transition-all duration-300 ${
            pagesGap === 'none' ? 'space-y-0' :
            pagesGap === 'small' ? 'space-y-1' :
            pagesGap === 'medium' ? 'space-y-3' : 'space-y-6'
          } ${
            readerWidth === 'narrow' ? 'md:max-w-[650px]' :
            readerWidth === 'medium' ? 'md:max-w-[800px]' :
            readerWidth === 'wide' ? 'md:max-w-[950px]' : 'max-w-full'
          } mx-auto`}>
            {chapter.pages.map((p, index) => (
              <React.Fragment key={index}>
                <div 
                  className="relative overflow-hidden w-full flex justify-center"
                  style={{ width: `${zoom}%`, maxWidth: '100%' }}
                >
                  <img
                    src={resolvePageUrl(p)}
                    alt={`Page ${index + 1}`}
                    loading="lazy"
                    referrerPolicy="no-referrer"
                    className="w-full h-auto block object-contain transition-all duration-300 filter saturate-[0.95]"
                  />
                </div>
                {/* Insert between_chapters ad zone every 5 pages */}
                {(index + 1) % 5 === 0 && index !== chapter.pages.length - 1 && (
                  <div className="w-full py-6 flex justify-center bg-obsidian-950 border-y border-obsidian-900/60 my-4">
                    <div className="max-w-4xl w-full px-4">
                      <AdZoneComponent position="between_chapters" />
                    </div>
                  </div>
                )}
              </React.Fragment>
            ))}
          </div>
        ) : (
          /* PAGE BY PAGE MODE */
          <div className={`flex flex-col items-center justify-center w-full space-y-6 transition-all duration-300 ${
            readerWidth === 'narrow' ? 'md:max-w-[650px]' :
            readerWidth === 'medium' ? 'md:max-w-[800px]' :
            readerWidth === 'wide' ? 'md:max-w-[950px]' : 'max-w-full'
          } mx-auto`}>
            <div 
              className={`relative rounded-2xl overflow-hidden border transition-all duration-300 flex items-center justify-center ${
                readerBg === 'pure-black' 
                  ? 'bg-black border-black/40' 
                  : 'bg-[#121214] border-neutral-800/60'
              }`}
              style={{ width: `${zoom}%`, maxWidth: '100%', aspectRatio: '2/3' }}
            >
              <img
                src={resolvePageUrl(chapter.pages[currentPage - 1])}
                alt={`Page ${currentPage}`}
                referrerPolicy="no-referrer"
                className="w-full h-full object-contain filter saturate-[0.95]"
              />

              {/* Navigation overlays */}
              <button
                onClick={() => handlePageChange(currentPage - 1)}
                className="absolute left-0 top-0 bottom-0 w-1/4 bg-gradient-to-r from-black/40 to-transparent text-transparent hover:text-white flex items-center justify-center transition-all cursor-pointer"
              >
                <ChevronLeft className="w-10 h-10 drop-shadow" />
              </button>

              <button
                onClick={() => handlePageChange(currentPage + 1)}
                className="absolute right-0 top-0 bottom-0 w-1/4 bg-gradient-to-l from-black/40 to-transparent text-transparent hover:text-white flex items-center justify-center transition-all cursor-pointer"
              >
                <ChevronRight className="w-10 h-10 drop-shadow" />
              </button>
            </div>

            {/* Quick slide controller bottom */}
            <div className="flex items-center gap-4 text-xs text-neutral-400 pt-2">
              <button
                onClick={() => handlePageChange(currentPage - 1)}
                disabled={currentPage === 1}
                className="px-4 py-2 bg-obsidian-900 hover:bg-obsidian-800 disabled:bg-obsidian-950 rounded-xl cursor-pointer"
              >
                Previous Page
              </button>
              <span className="font-bold font-mono">Page {currentPage} / {chapter.pages.length}</span>
              <button
                onClick={() => handlePageChange(currentPage + 1)}
                disabled={currentPage === chapter.pages.length}
                className="px-4 py-2 bg-obsidian-900 hover:bg-obsidian-800 disabled:bg-obsidian-950 rounded-xl cursor-pointer"
              >
                Next Page
              </button>
            </div>
          </div>
        )}
      </div>

      {/* 4. LOWER BAR NEXT CHAPTER RECOMMENDATION */}
      <div className="bg-obsidian-900/40 border border-obsidian-850 p-6 rounded-2xl flex flex-col md:flex-row items-center justify-between gap-6">
        <div className="space-y-1">
          <p className="text-xs text-neutral-400">You've reached the end of this chapter!</p>
          <h3 className="font-extrabold text-sm text-white">Ready for the next chapter?</h3>
        </div>

        <div className="flex gap-4">
          <button
            onClick={() => onNavigate('details', { id: series.id })}
            className="bg-obsidian-950 hover:bg-obsidian-900 text-xs text-neutral-300 border border-obsidian-800 px-5 py-3 rounded-xl transition-all cursor-pointer"
          >
            Series Details & Comments
          </button>
          {nextChapter ? (
            <button
              onClick={() => onNavigate('reader', { id: nextChapter.id })}
              className="bg-crimson-600 hover:bg-crimson-500 text-xs text-white font-bold px-6 py-3 rounded-xl transition-all shadow-md cursor-pointer flex items-center gap-1"
            >
              Read Chapter {nextChapter.number} <ChevronRight className="w-4 h-4" />
            </button>
          ) : (
            <span className="bg-obsidian-800 text-neutral-500 text-xs font-bold px-5 py-3 rounded-xl select-none">
              You are caught up to the latest chapter 🎉
            </span>
          )}
        </div>
      </div>

      {/* 5. IN-READER COMMENTS & DISCUSSIONS */}
      <div id="reader-comments" className="bg-obsidian-900/60 border border-obsidian-850 p-6 rounded-3xl space-y-6 mt-6">
        <div className="flex items-center justify-between border-b border-obsidian-800 pb-4">
          <div className="flex items-center gap-2">
            <MessageCircle className="w-5 h-5 text-crimson-500 animate-bounce" />
            <h3 className="font-extrabold text-base text-white">Chapter Discussion</h3>
          </div>
          <span className="text-xs bg-crimson-950 text-crimson-400 font-bold px-3 py-1 rounded-full">
            {comments.filter(c => c.chapterId === chapter.id).length} comments
          </span>
        </div>

        {/* Post Comment Input */}
        {currentUser ? (
          <div className="space-y-3">
            <div className="flex gap-3">
              <img 
                src={currentUser.avatarUrl || 'https://c.top4top.io/p_38444apdb1.jpg'} 
                alt={currentUser.username} 
                className="w-9 h-9 rounded-full border border-crimson-600/30 object-cover shrink-0" 
              />
              <textarea
                value={newCommentText}
                onChange={(e) => setNewCommentText(e.target.value)}
                placeholder="Share your thoughts on this chapter..."
                rows={3}
                className="w-full bg-obsidian-950 border border-obsidian-800 rounded-xl p-3 text-xs text-white placeholder-neutral-500 focus:outline-none focus:border-crimson-500 transition-all font-sans resize-none"
              />
            </div>
            <div className="flex justify-end">
              <button
                onClick={handlePostComment}
                disabled={isSubmittingComment || !newCommentText.trim()}
                className="bg-crimson-600 hover:bg-crimson-500 disabled:bg-neutral-800 disabled:text-neutral-500 text-xs text-white font-bold px-5 py-2 rounded-xl transition-all cursor-pointer"
              >
                {isSubmittingComment ? 'Submitting...' : 'Post Comment'}
              </button>
            </div>
          </div>
        ) : (
          <div className="bg-obsidian-950/60 p-4 rounded-2xl border border-obsidian-800/50 text-center space-y-2">
            <p className="text-xs text-neutral-400">Please sign in to post comments and join chapter discussions.</p>
            <button
              onClick={onRequireLogin}
              className="text-xs font-bold text-crimson-500 hover:text-crimson-400 underline cursor-pointer"
            >
              Sign In Now
            </button>
          </div>
        )}

        {/* Comments List */}
        <div className="space-y-4 max-h-[400px] overflow-y-auto pl-1">
          {comments.filter(c => c.chapterId === chapter.id).length === 0 ? (
            <p className="text-xs text-neutral-500 text-center py-6">No comments on this chapter yet. Be the first to comment!</p>
          ) : (
            comments
              .filter(c => c.chapterId === chapter.id)
              .map((comm) => (
                <div key={comm.id} className="bg-obsidian-950/40 p-3.5 rounded-2xl border border-obsidian-850/60 space-y-2 flex gap-3 items-start">
                  <img 
                    src={comm.userAvatar || `https://api.dicebear.com/7.x/bottts/svg?seed=${encodeURIComponent(comm.username)}`} 
                    alt={comm.username} 
                    className="w-8 h-8 rounded-full border border-neutral-800 object-cover shrink-0" 
                  />
                  <div className="space-y-1.5 flex-1" dir="ltr">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-extrabold text-neutral-200">{comm.username}</span>
                      <span className="text-[10px] text-neutral-500 font-mono">
                        {new Date(comm.addedAt).toLocaleDateString('en-US', { hour: '2-digit', minute: '2-digit' })}
                      </span>
                    </div>
                    <p className="text-xs text-neutral-300 leading-relaxed font-sans">{comm.content}</p>
                  </div>
                </div>
              ))
          )}
        </div>
      </div>

      {/* 6. FLOATING AUTO-SCROLL CONTROLLER */}
      {direction === 'vertical' && (
        <div className="fixed bottom-6 right-6 z-50 flex flex-col items-end gap-2">
          <AnimatePresence>
            {isAutoScrolling && (
              <motion.div
                initial={{ opacity: 0, y: 20, scale: 0.95 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: 20, scale: 0.95 }}
                className="bg-obsidian-900/95 backdrop-blur-md border border-crimson-600/30 p-3.5 rounded-2xl shadow-xl flex items-center gap-3 text-white"
              >
                <div className="flex flex-col">
                  <span className="text-[10px] text-neutral-400 font-bold">Auto-Scroll Active</span>
                  <div className="flex items-center gap-1.5">
                    <span className="text-[11px] font-extrabold">Speed:</span>
                    <span className="text-xs font-mono font-bold text-crimson-500 bg-crimson-950/60 px-1.5 py-0.5 rounded-md">{scrollSpeed}x</span>
                  </div>
                </div>

                <div className="flex items-center gap-1">
                  <button
                    onClick={() => setScrollSpeed(prev => Math.max(1, prev - 1))}
                    disabled={scrollSpeed <= 1}
                    className="p-1.5 bg-obsidian-950 hover:bg-obsidian-800 disabled:opacity-30 rounded-lg text-white transition-all cursor-pointer"
                    title="Slower"
                  >
                    <ArrowDown className="w-3.5 h-3.5" />
                  </button>
                  <button
                    onClick={() => setScrollSpeed(prev => Math.min(5, prev + 1))}
                    disabled={scrollSpeed >= 5}
                    className="p-1.5 bg-obsidian-950 hover:bg-obsidian-800 disabled:opacity-30 rounded-lg text-white transition-all cursor-pointer"
                    title="Faster"
                  >
                    <ArrowUp className="w-3.5 h-3.5" />
                  </button>
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          <button
            onClick={() => setIsAutoScrolling(!isAutoScrolling)}
            className={`w-12 h-12 rounded-full flex items-center justify-center shadow-lg transition-all transform hover:scale-105 active:scale-95 cursor-pointer z-50 ${
              isAutoScrolling 
                ? 'bg-crimson-600 text-white animate-pulse ring-4 ring-crimson-600/20' 
                : 'bg-obsidian-900 border border-obsidian-800 text-neutral-300 hover:text-white hover:border-neutral-700'
            }`}
            title={isAutoScrolling ? 'Pause Auto-Scroll' : 'Start Auto-Scroll'}
          >
            {isAutoScrolling ? <Pause className="w-5 h-5" /> : <Play className="w-5 h-5 ml-0.5" />}
          </button>
        </div>
      )}

      {/* Bottom Ad Zone */}
      <AdZoneComponent position="bottom" />
    </div>
  );
}
