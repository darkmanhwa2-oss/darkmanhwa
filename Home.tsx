/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Play, Flame, Star, BookOpen, Clock, Shuffle, ThumbsUp, ArrowRight, Layers } from 'lucide-react';
import { Series, User } from '../types';
import { formatNumber } from '../lib/api';
import { AdZoneComponent } from '../components/AdZone';

interface HomeProps {
  seriesList: Series[];
  onNavigate: (page: string, params?: any) => void;
  onSelectRandom: () => void;
  currentUser: User | null;
}

export default function Home({ seriesList, onNavigate, onSelectRandom, currentUser }: HomeProps) {
  const [heroIndex, setHeroIndex] = useState(0);
  const [activeGenre, setActiveGenre] = useState<string | null>(null);

  // Get featured list (top 3 highest-rated or viewed titles)
  const featured = [...seriesList].sort((a, b) => b.rating - a.rating).slice(0, 3);

  useEffect(() => {
    if (featured.length === 0) return;
    const interval = setInterval(() => {
      setHeroIndex(prev => (prev + 1) % featured.length);
    }, 8000);
    return () => clearInterval(interval);
  }, [featured]);

  // All genres extracted from list
  const genres = Array.from(new Set(seriesList.flatMap(s => s.genres)));

  // Filtered series
  const filteredSeries = activeGenre 
    ? seriesList.filter(s => s.genres.includes(activeGenre))
    : seriesList;

  // Grouping arrays
  const ongoing = seriesList.filter(s => s.status === 'ongoing');
  const completed = seriesList.filter(s => s.status === 'completed');
  const trending = [...seriesList].sort((a, b) => b.views - a.views).slice(0, 4);

  return (
    <div className="space-y-12 pb-16" dir="rtl">
      {/* Top Ad Zone */}
      <AdZoneComponent position="top" />

      {/* 1. HERO CAROUSEL */}
      {featured.length > 0 && (
        <section className="relative h-[480px] lg:h-[540px] rounded-3xl overflow-hidden group shadow-2xl border border-obsidian-850">
          <AnimatePresence mode="wait">
            <motion.div
              key={heroIndex}
              initial={{ opacity: 0, scale: 1.05 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              transition={{ duration: 0.8 }}
              className="absolute inset-0"
            >
              <img
                src={featured[heroIndex].bannerUrl}
                alt={featured[heroIndex].titleAr || featured[heroIndex].titleEn}
                referrerPolicy="no-referrer"
                className="w-full h-full object-cover brightness-[0.35]"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-black via-transparent to-black/35"></div>
              
              {/* Content Card */}
              <div className="absolute bottom-0 right-0 left-0 p-8 md:p-12 text-right max-w-4xl space-y-4">
                <motion.div 
                  initial={{ y: 20, opacity: 0 }}
                  animate={{ y: 0, opacity: 1 }}
                  transition={{ delay: 0.2 }}
                  className="flex flex-wrap gap-2 text-xs"
                >
                  <span className="bg-crimson-600 text-white font-extrabold px-3 py-1 rounded-full flex items-center gap-1">
                    <Flame className="w-3.5 h-3.5 animate-pulse" /> عمل مميز
                  </span>
                  {featured[heroIndex].genres.slice(0, 3).map(g => (
                    <span key={g} className="bg-obsidian-800/80 text-neutral-300 px-3 py-1 rounded-full backdrop-blur-md">
                      {g}
                    </span>
                  ))}
                </motion.div>

                <motion.h1 
                  initial={{ y: 20, opacity: 0 }}
                  animate={{ y: 0, opacity: 1 }}
                  transition={{ delay: 0.3 }}
                  className="text-3xl md:text-5xl font-black text-white tracking-tight"
                >
                  {featured[heroIndex].titleAr || featured[heroIndex].titleEn}
                </motion.h1>

                <motion.p 
                  initial={{ y: 20, opacity: 0 }}
                  animate={{ y: 0, opacity: 1 }}
                  transition={{ delay: 0.4 }}
                  className="text-neutral-300 text-sm md:text-base leading-relaxed line-clamp-3 md:line-clamp-2"
                >
                  {featured[heroIndex].descriptionAr || featured[heroIndex].descriptionEn}
                </motion.p>

                <motion.div 
                  initial={{ y: 20, opacity: 0 }}
                  animate={{ y: 0, opacity: 1 }}
                  transition={{ delay: 0.5 }}
                  className="flex items-center gap-6 pt-2"
                >
                  <button 
                    onClick={() => onNavigate('details', { id: featured[heroIndex].id })}
                    className="bg-crimson-600 hover:bg-crimson-500 text-white font-bold px-6 py-3 rounded-xl flex items-center gap-2 shadow-lg shadow-crimson-950/40 hover:scale-[1.03] transition-all cursor-pointer"
                  >
                    <BookOpen className="w-5 h-5" /> اقرأ الآن
                  </button>
                  <div className="flex items-center gap-4 text-xs text-neutral-400 font-sans">
                    <span className="flex items-center gap-1"><Star className="w-4 h-4 text-yellow-500 fill-yellow-500" /> {featured[heroIndex].rating}</span>
                    <span className="flex items-center gap-1 capitalize">
                      <Clock className="w-4 h-4 text-neutral-400" /> 
                      {featured[heroIndex].status === 'ongoing' ? 'مستمر' : featured[heroIndex].status === 'completed' ? 'مكتمل' : 'متوقف'}
                    </span>
                  </div>
                </motion.div>
              </div>
            </motion.div>
          </AnimatePresence>

          {/* Carousel Dots */}
          <div className="absolute left-6 bottom-8 flex flex-col gap-2">
            {featured.map((_, idx) => (
              <button
                key={idx}
                onClick={() => setHeroIndex(idx)}
                className={`w-2 h-2 rounded-full transition-all ${idx === heroIndex ? 'bg-crimson-600 h-6' : 'bg-obsidian-700'}`}
              />
            ))}
          </div>
        </section>
      )}

      {/* 2. DYNAMIC AD ZONE: IN-PAGE PUSH */}
      <div className="max-w-5xl mx-auto">
        <AdZoneComponent position="in_page_push" />
      </div>

      {/* 3. TRENDING */}
      {trending.length > 0 && (
        <section className="space-y-4">
          <div className="flex items-center gap-2">
            <Flame className="w-6 h-6 text-crimson-600 animate-pulse" />
            <h2 className="text-2xl font-black text-white">الأكثر شائعة ومتابعة</h2>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
            {trending.map((s, index) => (
              <motion.div
                whileHover={{ y: -5 }}
                key={s.id}
                onClick={() => onNavigate('details', { id: s.id })}
                className="bg-obsidian-900/40 border border-obsidian-850 hover:border-crimson-900/50 p-4 rounded-2xl flex items-center gap-4 cursor-pointer transition-all"
              >
                <span className="text-4xl font-extrabold text-obsidian-700 font-mono">{index + 1}</span>
                <img
                  src={s.coverUrl}
                  alt={s.titleAr || s.titleEn}
                  referrerPolicy="no-referrer"
                  className="w-16 h-20 object-cover rounded-lg shadow-md shrink-0"
                />
                <div className="space-y-1 overflow-hidden text-right">
                  <h3 className="font-bold text-white text-sm truncate">{s.titleAr || s.titleEn}</h3>
                  <p className="text-neutral-400 text-xs truncate">{s.genres.join(' • ')}</p>
                  <div className="flex items-center gap-2 text-xs text-neutral-500">
                    {currentUser?.role === 'admin' && (
                      <>
                        <span>{formatNumber(s.views)} مشاهدة</span>
                        <span>•</span>
                      </>
                    )}
                    <span className="flex items-center gap-0.5"><ThumbsUp className="w-3 h-3 text-crimson-600" /> {formatNumber(s.likes)}</span>
                  </div>
                </div>
              </motion.div>
            ))}
          </div>
        </section>
      )}

      {/* 4. GENRE BADGES */}
      <section className="space-y-4">
        <div className="flex items-center gap-2">
          <Layers className="w-6 h-6 text-crimson-600" />
          <h2 className="text-2xl font-black text-white">تصفح حسب التصنيف</h2>
        </div>
        <div className="flex flex-wrap gap-2.5">
          <button
            onClick={() => setActiveGenre(null)}
            className={`px-4 py-2 rounded-xl text-sm transition-all cursor-pointer ${!activeGenre ? 'bg-crimson-600 text-white font-bold shadow-lg shadow-crimson-950/35' : 'bg-obsidian-900 text-neutral-400 border border-obsidian-800 hover:border-obsidian-750'}`}
          >
            الكل ({seriesList.length})
          </button>
          {genres.map(g => (
            <button
              key={g}
              onClick={() => setActiveGenre(g)}
              className={`px-4 py-2 rounded-xl text-sm transition-all cursor-pointer ${activeGenre === g ? 'bg-crimson-600 text-white font-bold shadow-lg shadow-crimson-950/35' : 'bg-obsidian-900 text-neutral-400 border border-obsidian-800 hover:border-obsidian-750'}`}
            >
              {g}
            </button>
          ))}
        </div>
      </section>

      {/* 5. MAIN FILTERED GRID */}
      <section className="space-y-6">
        <div className="flex items-center justify-between">
          <h2 className="text-2xl font-black text-white">
            {activeGenre ? `تصنيف: ${activeGenre}` : 'جميع الأعمال'}
          </h2>
          {activeGenre && (
            <button 
              onClick={() => setActiveGenre(null)} 
              className="text-xs text-neutral-400 hover:text-crimson-500 transition-colors flex items-center gap-1 cursor-pointer"
            >
              عرض الكل <ArrowRight className="w-3.5 h-3.5 rotate-180" />
            </button>
          )}
        </div>

        {filteredSeries.length === 0 ? (
          <div className="bg-obsidian-900/50 border border-obsidian-850 rounded-2xl p-12 text-center text-neutral-500">
            لم يتم العثور على أعمال تطابق خيارات الفلترة المحددة.
          </div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-6">
            {filteredSeries.map(s => (
              <motion.div
                whileHover={{ y: -8 }}
                key={s.id}
                onClick={() => onNavigate('details', { id: s.id })}
                className="group relative cursor-pointer"
              >
                {/* Image Wrap */}
                <div className="relative aspect-[2/3] rounded-2xl overflow-hidden border border-obsidian-850 group-hover:border-crimson-600/50 shadow-lg group-hover:shadow-crimson-950/20 transition-all">
                  <img
                    src={s.coverUrl}
                    alt={s.titleAr || s.titleEn}
                    referrerPolicy="no-referrer"
                    className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
                  />
                  {/* Rating Badge */}
                  <div className="absolute top-3 left-3 bg-black/75 backdrop-blur-md px-2 py-1 rounded-lg flex items-center gap-1 text-[10px] text-yellow-500 font-bold border border-yellow-500/20">
                    <Star className="w-3 h-3 fill-yellow-500" /> {s.rating}
                  </div>
                  {/* Status Badge */}
                  {s.status === 'ongoing' && (
                    <div className="absolute bottom-3 right-3 px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-600/95 text-white shadow border border-emerald-500/20 capitalize">
                      مستمر
                    </div>
                  )}
                  {s.status === 'completed' && (
                    <div className="absolute bottom-3 right-3 px-2 py-0.5 rounded text-[10px] font-bold bg-blue-600/95 text-white shadow border border-blue-500/20 capitalize">
                      مكتمل
                    </div>
                  )}
                  {s.status === 'paused' && (
                    <div className="absolute bottom-3 right-3 px-2 py-0.5 rounded text-[10px] font-bold bg-amber-600/95 text-white shadow border border-amber-500/20 capitalize">
                      متوقف
                    </div>
                  )}
                  {s.status === 'dropped' && (
                    <div className="absolute bottom-3 right-3 px-2 py-0.5 rounded text-[10px] font-bold bg-rose-600/95 text-white shadow border border-rose-500/20 capitalize">
                      ملغى
                    </div>
                  )}
                </div>

                {/* Info Text */}
                <div className="mt-3 space-y-1 text-right">
                  <h3 className="font-bold text-sm text-neutral-200 group-hover:text-crimson-500 transition-colors truncate">{s.titleAr || s.titleEn}</h3>
                  <div className="flex items-center justify-between text-[11px] text-neutral-500">
                    <span className="capitalize">{s.type === 'manhwa' ? 'مانهوا' : s.type === 'manhua' ? 'مانهوا صينية' : 'مانجا'}</span>
                    {currentUser?.role === 'admin' && (
                      <span className="font-mono text-crimson-600">{formatNumber(s.views)} مشاهدة</span>
                    )}
                  </div>
                </div>
              </motion.div>
            ))}
          </div>
        )}
      </section>

      {/* 6. RANDOM MANGA ACTION SECTION */}
      <section className="bg-gradient-to-r from-crimson-950/20 via-obsidian-900/60 to-crimson-950/10 border border-crimson-900/10 rounded-3xl p-8 md:p-12 flex flex-col md:flex-row items-center justify-between gap-8 relative overflow-hidden">
        <div className="absolute -top-10 -left-10 w-48 h-48 bg-crimson-600/5 rounded-full blur-3xl pointer-events-none"></div>
        
        <div className="space-y-3 max-w-xl text-right">
          <div className="bg-crimson-950/40 border border-crimson-900/40 text-crimson-500 text-xs px-3 py-1 rounded-full inline-block font-sans font-bold">
            محتار ماذا تقرأ التالي؟ 🎲
          </div>
          <h2 className="text-2xl md:text-3xl font-black text-white">دع DARК WATCH يختار لك مانجا عشوائية!</h2>
          <p className="text-neutral-400 text-sm leading-relaxed">
            استكشف مكتبتنا المميزة من الأعمال المترجمة. اضغط الزر أدناه للانتقال فوراً لعمل مشوق عشوائي.
          </p>
        </div>

        <button 
          onClick={onSelectRandom}
          className="bg-white hover:bg-crimson-600 text-black hover:text-white font-bold px-8 py-4 rounded-2xl flex items-center gap-2 shrink-0 transition-all hover:scale-105 shadow-xl shadow-white/5 hover:shadow-crimson-950/40 cursor-pointer"
        >
          <Shuffle className="w-5 h-5 animate-spin" /> اختر عنواناً عشوائياً
        </button>
      </section>

      {/* 7. RECENT ADDITIONS VS COMPLETED */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
        {/* Ongoing */}
        <section className="bg-obsidian-900/20 border border-obsidian-850 p-6 rounded-3xl space-y-4">
          <div className="flex items-center justify-between border-b border-obsidian-800 pb-3">
            <h3 className="font-black text-lg text-white">أعمال مستمرة</h3>
            <span className="text-xs text-neutral-500 font-mono">{ongoing.length} عمل</span>
          </div>
          <div className="space-y-4">
            {ongoing.slice(0, 3).map(s => (
              <div 
                key={s.id}
                onClick={() => onNavigate('details', { id: s.id })}
                className="flex gap-4 items-center cursor-pointer group"
              >
                <img src={s.coverUrl} alt={s.titleAr || s.titleEn} referrerPolicy="no-referrer" className="w-12 h-16 object-cover rounded-lg border border-obsidian-800 shrink-0" />
                <div className="space-y-0.5 overflow-hidden text-right">
                  <h4 className="font-bold text-sm text-neutral-300 group-hover:text-crimson-500 transition-colors truncate">{s.titleAr || s.titleEn}</h4>
                  <p className="text-neutral-500 text-xs truncate">{s.genres.slice(0, 2).join(' • ')}</p>
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* Completed */}
        <section className="bg-obsidian-900/20 border border-obsidian-850 p-6 rounded-3xl space-y-4">
          <div className="flex items-center justify-between border-b border-obsidian-800 pb-3">
            <h3 className="font-black text-lg text-white">أعمال مكتملة</h3>
            <span className="text-xs text-neutral-500 font-mono">{completed.length} عمل</span>
          </div>
          <div className="space-y-4">
            {completed.slice(0, 3).map(s => (
              <div 
                key={s.id}
                onClick={() => onNavigate('details', { id: s.id })}
                className="flex gap-4 items-center cursor-pointer group"
              >
                <img src={s.coverUrl} alt={s.titleAr || s.titleEn} referrerPolicy="no-referrer" className="w-12 h-16 object-cover rounded-lg border border-obsidian-800 shrink-0" />
                <div className="space-y-0.5 overflow-hidden text-right">
                  <h4 className="font-bold text-sm text-neutral-300 group-hover:text-crimson-500 transition-colors truncate">{s.titleAr || s.titleEn}</h4>
                  <p className="text-neutral-500 text-xs truncate">{s.genres.slice(0, 2).join(' • ')}</p>
                </div>
              </div>
            ))}
          </div>
        </section>
      </div>

      {/* Native Sponsored Content Recommendation */}
      <div className="max-w-7xl mx-auto">
        <AdZoneComponent position="native_ads" />
      </div>

      {/* Bottom Ad Zone */}
      <AdZoneComponent position="bottom" />
    </div>
  );
}
