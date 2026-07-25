/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Heart, Star, Eye, Calendar, User as UserIcon, 
  BookOpen, ArrowLeft, MessageSquare, SortAsc, SortDesc, Search, Send, ThumbsUp,
  Share2, Copy, Check
} from 'lucide-react';
import { Series, Chapter, Comment, User } from '../types';
import { apiFetch, formatNumber } from '../lib/api';
import { useSEO } from '../hooks/useSEO';
import { AdZoneComponent } from '../components/AdZone';

interface DetailsProps {
  seriesId: string;
  currentUser: User | null;
  allSeries: Series[];
  onNavigate: (page: string, params?: any) => void;
  onRequireLogin: () => void;
}

export default function Details({ seriesId, currentUser, allSeries, onNavigate, onRequireLogin }: DetailsProps) {
  const [data, setData] = useState<{ series: Series; chapters: Chapter[] } | null>(null);
  const [comments, setComments] = useState<Comment[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  
  // Chapter states
  const [chapterSearch, setChapterSearch] = useState('');
  const [isAscending, setIsAscending] = useState(false);
  const [selectedChunk, setSelectedChunk] = useState<string>('all');
  const [currentPageNum, setCurrentPageNum] = useState<number>(1);
  const [jumpInput, setJumpInput] = useState<string>('');

  // User interactions states
  const [isFavorited, setIsFavorited] = useState(false);
  const [readingStatus, setReadingStatus] = useState<string>('');
  const [userRating, setUserRating] = useState<number | null>(null);
  const [commentContent, setCommentContent] = useState('');
  const [replyContents, setReplyContents] = useState<{ [commentId: string]: string }>({});
  const [activeReplyBox, setActiveReplyBox] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const handleCopyLink = () => {
    navigator.clipboard.writeText(window.location.href);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  // Dynamic SEO Configuration
  useSEO({
    title: data?.series.titleAr || data?.series.titleEn || 'Series Details',
    description: data?.series.descriptionAr || data?.series.descriptionEn || 'اقرأ أحدث فصول المانجا والمانهوا مترجمة مجاناً على دارك مانهوا (Dark Manhwa).',
    keywords: [
      data?.series.titleEn || '',
      data?.series.titleAr || '',
      ...(data?.series.alternativeTitles ? data.series.alternativeTitles.split(',') : []),
      ...(data?.series.genres || []),
      'manga', 'read manga', 'manga online'
    ].filter(Boolean),
    image: data?.series.coverUrl,
    type: 'book',
    alternativeTitles: data?.series.alternativeTitles,
    author: data?.series.author,
    status: data?.series.status,
    releaseYear: data?.series.releaseYear
  });

  useEffect(() => {
    fetchDetails();
  }, [seriesId]);

  const fetchDetails = async () => {
    setLoading(true);
    setError('');
    try {
      const res = await apiFetch(`/api/series/${seriesId}`);
      setData(res);
      
      const comms = await apiFetch(`/api/series/${seriesId}/comments`);
      setComments(comms);

      if (currentUser) {
        const favRes = await apiFetch(`/api/series/${seriesId}/is-favorited`);
        setIsFavorited(favRes.favorited);

        try {
          const statusRes = await apiFetch(`/api/series/${seriesId}/reading-status`);
          setReadingStatus(statusRes.status || '');
        } catch (err) {
          console.error('Error loading reading status:', err);
        }
      }
    } catch (err: any) {
      setError(err.message || 'Failed to load details');
    } finally {
      setLoading(false);
    }
  };

  const handleReadingStatusChange = async (status: string) => {
    if (!currentUser) {
      onRequireLogin();
      return;
    }
    try {
      await apiFetch(`/api/series/${seriesId}/reading-status`, {
        method: 'POST',
        body: JSON.stringify({ status })
      });
      setReadingStatus(status);
    } catch (err: any) {
      alert(err.message || 'Failed to update reading status');
    }
  };

  const handleFavoriteToggle = async () => {
    if (!currentUser) {
      onRequireLogin();
      return;
    }

    try {
      const res = await apiFetch(`/api/series/${seriesId}/favorite`, { method: 'POST' });
      setIsFavorited(res.favorited);
      if (data) {
        setData({
          ...data,
          series: { ...data.series, likes: res.likes }
        });
      }
    } catch (err: any) {
      alert(err.message);
    }
  };

  const handleRating = async (score: number) => {
    if (!currentUser) {
      onRequireLogin();
      return;
    }

    try {
      const res = await apiFetch(`/api/series/${seriesId}/rate`, {
        method: 'POST',
        body: JSON.stringify({ score })
      });
      setUserRating(score);
      if (data) {
        setData({
          ...data,
          series: { ...data.series, rating: res.rating }
        });
      }
    } catch (err: any) {
      alert(err.message);
    }
  };

  const handleAddComment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentUser) {
      onRequireLogin();
      return;
    }

    if (!commentContent.trim()) return;

    try {
      const newComment = await apiFetch(`/api/series/${seriesId}/comments`, {
        method: 'POST',
        body: JSON.stringify({ content: commentContent })
      });
      setComments([newComment, ...comments]);
      setCommentContent('');
    } catch (err: any) {
      alert(err.message);
    }
  };

  const handleAddReply = async (commentId: string) => {
    if (!currentUser) {
      onRequireLogin();
      return;
    }

    const replyText = replyContents[commentId];
    if (!replyText || !replyText.trim()) return;

    try {
      const newReply = await apiFetch(`/api/comments/${commentId}/reply`, {
        method: 'POST',
        body: JSON.stringify({ content: replyText })
      });

      setComments(comments.map(c => {
        if (c.id === commentId) {
          return { ...c, replies: [...c.replies, newReply] };
        }
        return c;
      }));

      setReplyContents({ ...replyContents, [commentId]: '' });
      setActiveReplyBox(null);
    } catch (err: any) {
      alert(err.message);
    }
  };

  const handleLikeComment = async (commentId: string, isDislike: boolean = false) => {
    try {
      const res = await apiFetch(`/api/comments/${commentId}/like`, {
        method: 'POST',
        body: JSON.stringify({ isDislike })
      });

      setComments(comments.map(c => {
        if (c.id === commentId) {
          return { ...c, likes: res.likes, dislikes: res.dislikes };
        }
        return c;
      }));
    } catch (err: any) {
      if (!currentUser) {
        onRequireLogin();
      } else {
        alert(err.message);
      }
    }
  };

  const chapters = data?.chapters || [];
  const series = data?.series;

  // Constants for massive chapter list optimization (handles 7,000+ chapters easily)
  const CHAPTERS_PER_CHUNK = 100;
  const CHAPTERS_PER_PAGE = 50;

  // Compute Range Chunks (e.g. 1-100, 101-200, 201-300...)
  const rangeChunks = React.useMemo(() => {
    if (!chapters || chapters.length === 0) return [];
    const maxNum = Math.max(...chapters.map(c => c.number));
    const chunks: { label: string; start: number; end: number; key: string }[] = [];
    
    for (let start = 1; start <= maxNum; start += CHAPTERS_PER_CHUNK) {
      const end = start + CHAPTERS_PER_CHUNK - 1;
      chunks.push({
        key: `${start}-${end}`,
        label: `الفصول ${start} - ${end}`,
        start,
        end
      });
    }
    return chunks;
  }, [chapters]);

  // Filters chapters based on range chunk, search input, and jump input
  const allFilteredChapters = React.useMemo(() => {
    if (!chapters) return [];
    return chapters
      .filter(c => {
        // Search text / number filter
        const matchesSearch = !chapterSearch || 
          (c.titleEn || c.titleAr || '').toLowerCase().includes(chapterSearch.toLowerCase()) || 
          c.number.toString().includes(chapterSearch.trim());

        // Range chunk filter
        let matchesChunk = true;
        if (selectedChunk !== 'all') {
          const [startStr, endStr] = selectedChunk.split('-');
          const start = parseInt(startStr, 10);
          const end = parseInt(endStr, 10);
          if (!isNaN(start) && !isNaN(end)) {
            matchesChunk = c.number >= start && c.number <= end;
          }
        }

        return matchesSearch && matchesChunk;
      })
      .sort((a, b) => isAscending ? a.number - b.number : b.number - a.number);
  }, [chapters, chapterSearch, selectedChunk, isAscending]);

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4" dir="ltr">
        <span className="border-4 border-crimson-950 border-t-crimson-600 w-12 h-12 rounded-full animate-spin"></span>
        <p className="text-neutral-400 text-sm font-sans">Loading series details...</p>
      </div>
    );
  }

  if (error || !data || !series) {
    return (
      <div className="min-h-[50vh] flex flex-col items-center justify-center text-center p-8 space-y-4" dir="ltr">
        <p className="text-crimson-500 font-bold">{error || 'Series not found'}</p>
        <button 
          onClick={() => onNavigate('home')}
          className="bg-obsidian-900 border border-obsidian-800 text-white px-6 py-2.5 rounded-xl text-sm hover:border-crimson-600 transition-colors cursor-pointer"
        >
          Return to Home
        </button>
      </div>
    );
  }

  // Paginated chapters slice for current view
  const totalFilteredPages = Math.ceil(allFilteredChapters.length / CHAPTERS_PER_PAGE) || 1;
  const displayedChapters = allFilteredChapters.slice(
    (currentPageNum - 1) * CHAPTERS_PER_PAGE,
    currentPageNum * CHAPTERS_PER_PAGE
  );

  const handleJumpToChapter = (e: React.FormEvent) => {
    e.preventDefault();
    if (!jumpInput.trim()) return;
    const targetNum = parseInt(jumpInput.trim(), 10);
    if (isNaN(targetNum)) return;

    const foundChapter = chapters.find(c => c.number === targetNum);
    if (foundChapter) {
      onNavigate('reader', { id: foundChapter.id });
    } else {
      setChapterSearch(jumpInput.trim());
      setSelectedChunk('all');
      setCurrentPageNum(1);
    }
  };

  // Generate Suggested Similar works
  const suggestions = allSeries
    .filter(s => s.id !== series.id && s.genres.some(g => series.genres.includes(g)))
    .slice(0, 4);

  return (
    <div className="space-y-12 pb-16" dir="ltr">
      {/* Top Ad Zone */}
      <AdZoneComponent position="top" />

      {/* Back button */}
      <button 
        onClick={() => onNavigate('home')}
        className="flex items-center gap-2 text-xs text-neutral-400 hover:text-crimson-500 transition-colors cursor-pointer"
      >
        <ArrowLeft className="w-4 h-4 rotate-180" /> العودة للرئيسية
      </button>

      {/* 1. HERO HEADER WITH COVER BACKDROP */}
      <div className="relative rounded-3xl overflow-hidden border border-obsidian-850 shadow-2xl">
        <div className="absolute inset-0">
          <img
            src={series.bannerUrl}
            alt={series.titleAr || series.titleEn}
            referrerPolicy="no-referrer"
            className="w-full h-full object-cover blur-md brightness-[0.2]"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-black via-transparent to-black/30"></div>
        </div>

        {/* Content layout */}
        <div className="relative p-6 md:p-10 flex flex-col md:flex-row gap-8 items-start">
          {/* Main Cover art */}
          <motion.div 
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            className="w-48 md:w-64 shrink-0 rounded-2xl overflow-hidden shadow-2xl border border-obsidian-800 self-center md:self-start"
          >
            <img
              src={series.coverUrl}
              alt={series.titleAr || series.titleEn}
              referrerPolicy="no-referrer"
              className="w-full aspect-[2/3] object-cover"
            />
          </motion.div>

          {/* Details */}
          <div className="space-y-4 text-right flex-1">
            <h1 className="text-2xl md:text-4xl font-black text-white leading-tight">{series.titleAr || series.titleEn}</h1>
            {series.alternativeTitles && (
              <p className="text-xs text-neutral-400 font-sans tracking-wide">{series.alternativeTitles}</p>
            )}

            {/* Quick stats badges */}
            <div className="flex flex-wrap gap-4 text-xs pt-1">
              <span className="flex items-center gap-1.5 text-yellow-500 font-bold bg-yellow-950/20 px-3 py-1.5 rounded-xl border border-yellow-500/10">
                <Star className="w-4 h-4 fill-yellow-500" /> {series.rating}
              </span>
              {currentUser?.role === 'admin' && (
                <span className="flex items-center gap-1.5 text-neutral-300 bg-obsidian-900/60 px-3 py-1.5 rounded-xl backdrop-blur-md">
                  <Eye className="w-4 h-4 text-crimson-600" /> {formatNumber(series.views)} مشاهدة
                </span>
              )}
              <span className="flex items-center gap-1.5 text-neutral-300 bg-obsidian-900/60 px-3 py-1.5 rounded-xl backdrop-blur-md">
                <Heart className="w-4 h-4 text-crimson-600 fill-crimson-600" /> {formatNumber(series.likes)} إعجاب
              </span>
              {series.status === 'ongoing' && (
                <span className="px-3 py-1.5 rounded-xl font-bold text-xs bg-green-950/40 text-green-400 border border-green-500/15 capitalize">مستمر</span>
              )}
              {series.status === 'completed' && (
                <span className="px-3 py-1.5 rounded-xl font-bold text-xs bg-blue-950/40 text-blue-400 border border-blue-500/15 capitalize">مكتمل</span>
              )}
              {series.status === 'paused' && (
                <span className="px-3 py-1.5 rounded-xl font-bold text-xs bg-amber-950/40 text-amber-400 border border-amber-500/15 capitalize">متوقف</span>
              )}
              {series.status === 'dropped' && (
                <span className="px-3 py-1.5 rounded-xl font-bold text-xs bg-rose-950/40 text-rose-400 border border-rose-500/15 capitalize">ملغى</span>
              )}
            </div>

            {/* Genres */}
            <div className="flex flex-wrap gap-2 pt-2">
              {series.genres.map(g => (
                <span key={g} className="bg-crimson-950/25 border border-crimson-900/15 text-crimson-400 text-xs px-3 py-1 rounded-xl">
                  {g}
                </span>
              ))}
            </div>

            {/* Description */}
            <div className="space-y-1.5">
              <h3 className="text-sm font-extrabold text-neutral-200">القصة والنبذة:</h3>
              <p className="text-neutral-400 text-xs md:text-sm leading-relaxed max-w-3xl">
                {series.descriptionAr || series.descriptionEn}
              </p>
            </div>

            {/* Meta data list */}
            <div className="grid grid-cols-2 gap-4 pt-4 border-t border-obsidian-800 text-xs text-neutral-400">
              <div className="flex items-center gap-2">
                <UserIcon className="w-4 h-4 text-crimson-600" />
                <span>المؤلف/الرسام: <strong className="text-neutral-200 font-sans">{series.author}</strong></span>
              </div>
              <div className="flex items-center gap-2">
                <Calendar className="w-4 h-4 text-crimson-600" />
                <span>تاريخ الإضافة: <strong className="text-neutral-200 font-sans">{new Date(series.addedAt).toLocaleDateString('ar-EG')}</strong></span>
              </div>
            </div>

            {/* Actions Grid */}
            <div className="flex flex-wrap gap-4 pt-6">
              {/* Bookmark Button */}
              <button
                onClick={handleFavoriteToggle}
                className={`flex items-center gap-2 font-bold px-6 py-3 rounded-xl shadow-lg transition-all cursor-pointer ${isFavorited ? 'bg-obsidian-800 border border-crimson-600 text-crimson-500' : 'bg-crimson-600 hover:bg-crimson-500 text-white'}`}
              >
                <Heart className={`w-5 h-5 ${isFavorited ? 'fill-crimson-500' : ''}`} />
                {isFavorited ? 'في المفضلة' : 'إضافة للمفضلة'}
              </button>

              {/* Reading Status Selector Dropdown */}
              {currentUser && (
                <div className="relative flex items-center bg-obsidian-900 border border-obsidian-800 focus-within:border-crimson-600 rounded-xl px-4 py-3 transition-all text-neutral-300">
                  <span className="text-xs text-neutral-400 font-bold ml-2">حالة القراءة:</span>
                  <select
                    value={readingStatus}
                    onChange={(e) => handleReadingStatusChange(e.target.value)}
                    className="bg-transparent text-xs font-black text-white focus:outline-none cursor-pointer"
                  >
                    <option value="" className="bg-obsidian-950 text-neutral-400">اختر الحالة</option>
                    <option value="reading" className="bg-obsidian-950 text-emerald-400">أقرؤها حالياً</option>
                    <option value="plan_to_read" className="bg-obsidian-950 text-indigo-400">أخطط لقراءتها</option>
                    <option value="completed" className="bg-obsidian-950 text-crimson-400">أكملتها بالكامل</option>
                    <option value="on_hold" className="bg-obsidian-950 text-amber-400">متوقفة مؤقتاً</option>
                    <option value="dropped" className="bg-obsidian-950 text-neutral-400">تركتها</option>
                  </select>
                </div>
              )}

              {/* Start reading first chapter */}
              {chapters.length > 0 && (
                <button
                  onClick={() => onNavigate('reader', { id: chapters[chapters.length - 1].id })}
                  className="bg-obsidian-900 border border-obsidian-800 hover:border-crimson-600 text-white font-bold px-6 py-3 rounded-xl transition-all cursor-pointer flex items-center gap-2"
                >
                  <BookOpen className="w-5 h-5 text-crimson-500" />
                  ابدأ الفصل الأول ({chapters[chapters.length - 1].number})
                </button>
              )}
            </div>

            {/* 1-5 rating star row */}
            <div className="pt-4 flex flex-wrap items-center justify-between gap-4 border-t border-obsidian-850">
              <div className="flex items-center gap-3">
                <span className="text-xs text-neutral-400 font-bold">تقييمك للعمل:</span>
                <div className="flex gap-1">
                  {[1, 2, 3, 4, 5].map(star => (
                    <button 
                      key={star}
                      onClick={() => handleRating(star)}
                      className="cursor-pointer hover:scale-110 transition-transform"
                    >
                      <Star className={`w-5 h-5 ${star <= (userRating || 0) ? 'text-yellow-500 fill-yellow-500' : 'text-neutral-600 hover:text-yellow-500'}`} />
                    </button>
                  ))}
                </div>
              </div>

              {/* Quick Share Buttons */}
              <div className="flex items-center gap-2">
                <span className="text-xs text-neutral-400 font-bold flex items-center gap-1.5">
                  <Share2 className="w-3.5 h-3.5 text-crimson-500" />
                  مشاركة:
                </span>
                <div className="flex flex-wrap items-center gap-1.5">
                  <button
                    onClick={handleCopyLink}
                    className="flex items-center gap-1 bg-obsidian-900 hover:bg-obsidian-850 border border-obsidian-800 text-[11px] text-white px-2.5 py-1.5 rounded-lg transition-all cursor-pointer"
                    title="نسخ الرابط"
                  >
                    {copied ? <Check className="w-3 h-3 text-green-500" /> : <Copy className="w-3 h-3 text-neutral-400" />}
                    <span>{copied ? 'تم النسخ!' : 'نسخ الرابط'}</span>
                  </button>

                  <a
                    href={`https://twitter.com/intent/tweet?url=${encodeURIComponent(window.location.href)}&text=${encodeURIComponent(`اقرأ "${series.titleAr || series.titleEn}" على دارك مانهوا (Dark Manhwa)!`)}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-1 bg-neutral-900 hover:bg-neutral-850 border border-neutral-850 text-neutral-300 text-[11px] px-2.5 py-1.5 rounded-lg transition-all"
                  >
                    <span>Twitter / X</span>
                  </a>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* 2. MAIN LAYOUT: Chapter List VS Sidebar Suggestions */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        
        {/* Chapters Section (Left/Middle 2 Columns) */}
        <div className="lg:col-span-2 space-y-6">
          <div className="bg-obsidian-900/40 border border-obsidian-850 p-6 rounded-3xl space-y-6 shadow-xl text-right">
            {/* Header controls */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-obsidian-800 pb-4">
              <div className="space-y-1">
                <h2 className="text-xl font-black text-white">الفصول المتاحة</h2>
                <p className="text-xs text-neutral-500 font-sans">
                  إجمالي {formatNumber(chapters.length)} فصل منشور
                  {allFilteredChapters.length !== chapters.length && ` (المعروض: ${formatNumber(allFilteredChapters.length)})`}
                </p>
              </div>

              {/* Controls Toolbar */}
              <div className="flex flex-wrap items-center gap-2 shrink-0">
                {/* Fast Jump Form */}
                <form onSubmit={handleJumpToChapter} className="relative flex items-center">
                  <input
                    type="number"
                    min="1"
                    value={jumpInput}
                    onChange={(e) => setJumpInput(e.target.value)}
                    placeholder="انتقل لفصل #"
                    className="bg-obsidian-950 border border-obsidian-800 text-xs text-white px-3 py-2 rounded-xl focus:border-crimson-600 transition-all text-right w-28 font-sans"
                  />
                  <button
                    type="submit"
                    className="mr-1 bg-crimson-600 hover:bg-crimson-500 text-white text-xs font-bold px-2.5 py-2 rounded-xl transition-all cursor-pointer shrink-0"
                  >
                    انتقال
                  </button>
                </form>

                {/* Search in chapters */}
                <div className="relative">
                  <Search className="absolute right-3 top-2.5 w-4.5 h-4.5 text-neutral-500" />
                  <input
                    type="text"
                    value={chapterSearch}
                    onChange={(e) => {
                      setChapterSearch(e.target.value);
                      setCurrentPageNum(1);
                    }}
                    placeholder="بحث عن فصل..."
                    className="bg-obsidian-950 border border-obsidian-800 text-xs text-white pr-9 pl-3 py-2 rounded-xl focus:border-crimson-600 transition-all text-right w-36 font-sans"
                  />
                </div>

                {/* Sort Order Button */}
                <button
                  onClick={() => setIsAscending(!isAscending)}
                  className="bg-obsidian-950 hover:bg-obsidian-900 border border-obsidian-800 p-2 rounded-xl text-neutral-400 hover:text-white transition-colors cursor-pointer"
                  title={isAscending ? 'الترتيب: تصاعدي' : 'الترتيب: تنازلي'}
                >
                  {isAscending ? <SortAsc className="w-4.5 h-4.5 text-crimson-500" /> : <SortDesc className="w-4.5 h-4.5 text-crimson-500" />}
                </button>
              </div>
            </div>

            {/* Range Chunks Selector Bar (For Series with 100+ chapters) */}
            {rangeChunks.length > 1 && (
              <div className="space-y-2 pt-1 pb-2">
                <div className="flex items-center justify-between text-xs text-neutral-400 font-sans">
                  <span>تصفح النطاق:</span>
                  <select
                    value={selectedChunk}
                    onChange={(e) => {
                      setSelectedChunk(e.target.value);
                      setCurrentPageNum(1);
                    }}
                    className="bg-obsidian-950 border border-obsidian-800 text-xs text-white px-3 py-1.5 rounded-xl outline-none focus:border-crimson-600 font-sans"
                  >
                    <option value="all">كل الفصول ({formatNumber(chapters.length)})</option>
                    {rangeChunks.map(chunk => (
                      <option key={chunk.key} value={chunk.key}>
                        {chunk.label}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Quick chunk pills */}
                <div className="flex items-center gap-1.5 overflow-x-auto pb-2 pt-1 custom-scrollbar text-[11px] font-sans">
                  <button
                    onClick={() => { setSelectedChunk('all'); setCurrentPageNum(1); }}
                    className={`px-3 py-1 rounded-xl shrink-0 font-bold transition-all cursor-pointer ${
                      selectedChunk === 'all'
                        ? 'bg-crimson-600 text-white shadow-md shadow-crimson-600/20'
                        : 'bg-obsidian-950 hover:bg-obsidian-900 text-neutral-400 border border-obsidian-800'
                    }`}
                  >
                    الكل ({chapters.length})
                  </button>
                  {rangeChunks.map(chunk => (
                    <button
                      key={chunk.key}
                      onClick={() => { setSelectedChunk(chunk.key); setCurrentPageNum(1); }}
                      className={`px-3 py-1 rounded-xl shrink-0 font-bold transition-all cursor-pointer ${
                        selectedChunk === chunk.key
                          ? 'bg-crimson-600 text-white shadow-md shadow-crimson-600/20'
                          : 'bg-obsidian-950 hover:bg-obsidian-900 text-neutral-400 border border-obsidian-800'
                      }`}
                    >
                      {chunk.start}-{chunk.end}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Chapter Items List */}
            {displayedChapters.length === 0 ? (
              <div className="p-8 text-center text-neutral-500 text-sm">
                لا توجد فصول تطابق بحثك أو النطاق المحدد.
              </div>
            ) : (
              <div className="space-y-3">
                <div className="grid grid-cols-1 gap-2.5 max-h-[520px] overflow-y-auto pr-2 custom-scrollbar">
                  {displayedChapters.map(c => (
                    <div
                      key={c.id}
                      onClick={() => onNavigate('reader', { id: c.id })}
                      className="bg-obsidian-950 hover:bg-obsidian-900/70 border border-obsidian-800 hover:border-crimson-900/40 p-3.5 rounded-2xl flex items-center justify-between cursor-pointer transition-all hover:scale-[1.005]"
                    >
                      <div className="space-y-1 text-right">
                        <p className="font-bold text-sm text-neutral-100 hover:text-crimson-400 transition-colors">
                          {c.titleAr || c.titleEn || `الفصل ${c.number}`}
                        </p>
                        <p className="text-[11px] text-neutral-400 font-sans tracking-wide">
                          الفصل <span className="font-extrabold text-white">{c.number}</span>
                        </p>
                      </div>
                      <div className="flex items-center gap-3 text-xs text-neutral-500 font-sans">
                        <span className="hidden sm:inline">{new Date(c.addedAt).toLocaleDateString('ar-EG')}</span>
                        <button className="bg-crimson-950/40 border border-crimson-900/30 text-crimson-400 hover:bg-crimson-600 hover:text-white px-3.5 py-1.5 rounded-xl text-xs font-black transition-all cursor-pointer shadow-sm">
                          قراءة
                        </button>
                      </div>
                    </div>
                  ))}
                </div>

                {/* Pagination Controls */}
                {totalFilteredPages > 1 && (
                  <div className="flex items-center justify-between pt-4 border-t border-obsidian-800 font-sans text-xs">
                    <button
                      onClick={() => setCurrentPageNum(prev => Math.max(1, prev - 1))}
                      disabled={currentPageNum === 1}
                      className="px-3 py-1.5 bg-obsidian-950 hover:bg-obsidian-900 border border-obsidian-800 disabled:opacity-40 text-white rounded-xl transition-all cursor-pointer"
                    >
                      السابق
                    </button>
                    <span className="text-neutral-400">
                      صفحة <span className="font-black text-white">{currentPageNum}</span> من <span className="font-black text-white">{totalFilteredPages}</span>
                    </span>
                    <button
                      onClick={() => setCurrentPageNum(prev => Math.min(totalFilteredPages, prev + 1))}
                      disabled={currentPageNum === totalFilteredPages}
                      className="px-3 py-1.5 bg-obsidian-950 hover:bg-obsidian-900 border border-obsidian-800 disabled:opacity-40 text-white rounded-xl transition-all cursor-pointer"
                    >
                      التالي
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Sidebar / Mid Page Ad Zone */}
          <AdZoneComponent position="sidebar" className="my-8" />

          {/* Comments Section */}
          <div className="bg-obsidian-900/40 border border-obsidian-850 p-6 rounded-3xl space-y-6 shadow-xl text-right">
            <h2 className="text-xl font-black text-white flex items-center gap-2">
              <MessageSquare className="w-5.5 h-5.5 text-crimson-600" /> تعليقات القراء ({comments.length})
            </h2>

            {/* Add Comment Input */}
            <form onSubmit={handleAddComment} className="flex gap-3">
              <input
                type="text"
                value={commentContent}
                onChange={(e) => setCommentContent(e.target.value)}
                placeholder={currentUser ? "اكتب تعليقك هنا..." : "سجل الدخول لإضافة تعليق"}
                disabled={!currentUser}
                className="bg-obsidian-950 border border-obsidian-800 text-sm text-white px-4 py-3 rounded-xl focus:border-crimson-600 focus:ring-1 focus:ring-crimson-600 transition-all text-right flex-1"
              />
              <button
                type="submit"
                disabled={!currentUser}
                className="bg-crimson-600 hover:bg-crimson-500 disabled:bg-obsidian-800 text-white p-3 rounded-xl transition-all cursor-pointer shrink-0"
              >
                <Send className="w-5 h-5 rotate-180" />
              </button>
            </form>

            {/* Comments List */}
            {comments.length === 0 ? (
              <p className="text-center text-neutral-500 text-sm py-4">لا توجد تعليقات بعد. كن أول من يترك تعليقاً!</p>
            ) : (
              <div className="space-y-6 divide-y divide-obsidian-800">
                {comments.map(c => (
                  <div key={c.id} className="pt-5 first:pt-0 space-y-3 text-right">
                    <div className="flex items-center gap-3">
                      <img
                        src={c.userAvatar}
                        alt={c.username}
                        referrerPolicy="no-referrer"
                        className="w-10 h-10 rounded-xl object-cover border border-obsidian-800"
                      />
                      <div>
                        <p className="font-bold text-sm text-white">{c.username}</p>
                        <p className="text-[10px] text-neutral-500">{new Date(c.addedAt).toLocaleDateString('ar-EG')}</p>
                      </div>
                    </div>

                    <p className="text-neutral-300 text-sm leading-relaxed pr-13">{c.content}</p>

                    {/* Like / Dislike / Reply Actions */}
                    <div className="flex items-center gap-6 text-xs text-neutral-500 pr-13">
                      <button 
                        onClick={() => handleLikeComment(c.id)}
                        className="flex items-center gap-1 hover:text-crimson-500 transition-all cursor-pointer"
                      >
                        <ThumbsUp className="w-4 h-4" /> {c.likes}
                      </button>
                      <button 
                        onClick={() => setActiveReplyBox(activeReplyBox === c.id ? null : c.id)}
                        className="hover:text-crimson-500 transition-all cursor-pointer font-bold"
                      >
                        رد ({c.replies.length})
                      </button>
                    </div>

                    {/* Nest Replies */}
                    {c.replies.length > 0 && (
                      <div className="mr-12 mt-3 space-y-4 border-r-2 border-crimson-900/30 pr-4">
                        {c.replies.map(r => (
                          <div key={r.id} className="space-y-1">
                            <div className="flex items-center gap-2">
                              <img src={r.userAvatar} alt={r.username} referrerPolicy="no-referrer" className="w-7 h-7 rounded-lg border border-obsidian-800" />
                              <span className="font-bold text-xs text-white">{r.username}</span>
                              <span className="text-[9px] text-neutral-600">{new Date(r.addedAt).toLocaleDateString('ar-EG')}</span>
                            </div>
                            <p className="text-neutral-400 text-xs pr-9 leading-relaxed">{r.content}</p>
                          </div>
                        ))}
                      </div>
                    )}

                    {/* Reply Input Box */}
                    <AnimatePresence>
                      {activeReplyBox === c.id && (
                        <motion.div 
                           initial={{ opacity: 0, height: 0 }}
                           animate={{ opacity: 1, height: 'auto' }}
                           exit={{ opacity: 0, height: 0 }}
                           className="mr-12 pt-3"
                        >
                          <div className="flex gap-2">
                            <input
                              type="text"
                              value={replyContents[c.id] || ''}
                              onChange={(e) => setReplyContents({ ...replyContents, [c.id]: e.target.value })}
                              placeholder="اكتب ردك..."
                              className="bg-obsidian-950 border border-obsidian-800 text-xs text-white px-3 py-2 rounded-xl focus:border-crimson-600 transition-all text-right flex-1"
                            />
                            <button
                              onClick={() => handleAddReply(c.id)}
                              className="bg-crimson-600 hover:bg-crimson-500 text-white px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer"
                            >
                              إرسال
                            </button>
                          </div>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Sidebar suggestions (Right 1 Column) */}
        <div className="space-y-6">
          <div className="bg-obsidian-900/40 border border-obsidian-850 p-6 rounded-3xl space-y-6 shadow-xl text-right">
            <h3 className="font-black text-lg text-white border-b border-obsidian-800 pb-3">أعمال مقترحة ومترجمة</h3>
            
            {suggestions.length === 0 ? (
              <p className="text-xs text-neutral-500 text-center py-4">لا توجد مقترحات مشابهة حالياً.</p>
            ) : (
              <div className="space-y-4">
                {suggestions.map(s => (
                  <div
                    key={s.id}
                    onClick={() => onNavigate('details', { id: s.id })}
                    className="flex gap-3 items-center cursor-pointer group"
                  >
                    <img
                      src={s.coverUrl}
                      alt={s.titleAr || s.titleEn}
                      referrerPolicy="no-referrer"
                      className="w-12 h-16 object-cover rounded-lg border border-obsidian-800 group-hover:border-crimson-600 transition-all shrink-0"
                    />
                    <div className="space-y-1 overflow-hidden text-right">
                      <h4 className="font-bold text-xs text-neutral-300 group-hover:text-crimson-500 transition-colors truncate">{s.titleAr || s.titleEn}</h4>
                      <div className="flex items-center gap-2 text-[10px] text-neutral-500 font-sans">
                        <span className="flex items-center gap-0.5"><Star className="w-3 h-3 text-yellow-500 fill-yellow-500" /> {s.rating}</span>
                        <span>•</span>
                        <span className="capitalize">{s.status === 'ongoing' ? 'مستمر' : 'مكتمل'}</span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

      </div>

      {/* Bottom Ad Zone */}
      <AdZoneComponent position="bottom" />
    </div>
  );
}
