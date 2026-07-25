/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useMemo } from 'react';
import { motion } from 'motion/react';
import { Star, Search, Filter, BookOpen, ThumbsUp, Eye, Sliders, X } from 'lucide-react';
import { Series, User } from '../types';
import { formatNumber } from '../lib/api';

interface MangaListProps {
  seriesList: Series[];
  onNavigate: (page: string, params?: any) => void;
  currentUser: User | null;
}

export default function MangaList({ seriesList, onNavigate, currentUser }: MangaListProps) {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedGenre, setSelectedGenre] = useState<string>('');
  const [selectedStatus, setSelectedStatus] = useState<string>('');
  const [selectedSort, setSelectedSort] = useState<string>('newest');
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 24;

  // Extract all unique genres
  const allGenres = useMemo(() => {
    const genresSet = new Set<string>();
    seriesList.forEach(s => {
      s.genres.forEach(g => genresSet.add(g));
    });
    return Array.from(genresSet);
  }, [seriesList]);

  // Filter and sort series list
  const processedSeries = useMemo(() => {
    let result = [...seriesList];

    // Filter by search term
    if (searchTerm.trim() !== '') {
      const q = searchTerm.toLowerCase();
      result = result.filter(s => 
        (s.titleEn && s.titleEn.toLowerCase().includes(q)) || 
        (s.titleAr && s.titleAr.toLowerCase().includes(q)) ||
        (s.author && s.author.toLowerCase().includes(q))
      );
    }

    // Filter by genre
    if (selectedGenre) {
      result = result.filter(s => s.genres.includes(selectedGenre));
    }

    // Filter by status
    if (selectedStatus) {
      result = result.filter(s => s.status === selectedStatus);
    }

    // Sort
    if (selectedSort === 'newest') {
      result.sort((a, b) => new Date(b.addedAt).getTime() - new Date(a.addedAt).getTime());
    } else if (selectedSort === 'views') {
      result.sort((a, b) => b.views - a.views);
    } else if (selectedSort === 'likes') {
      result.sort((a, b) => b.likes - a.likes);
    } else if (selectedSort === 'rating') {
      result.sort((a, b) => b.rating - a.rating);
    } else if (selectedSort === 'oldest') {
      result.sort((a, b) => new Date(a.addedAt).getTime() - new Date(b.addedAt).getTime());
    }

    return result;
  }, [seriesList, searchTerm, selectedGenre, selectedStatus, selectedSort]);

  // Pagination calculations
  const totalPages = Math.ceil(processedSeries.length / itemsPerPage);
  const paginatedSeries = useMemo(() => {
    const start = (currentPage - 1) * itemsPerPage;
    return processedSeries.slice(start, start + itemsPerPage);
  }, [processedSeries, currentPage]);

  const handlePageChange = (page: number) => {
    setCurrentPage(page);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const clearFilters = () => {
    setSearchTerm('');
    setSelectedGenre('');
    setSelectedStatus('');
    setSelectedSort('newest');
    setCurrentPage(1);
  };

  return (
    <div className="space-y-8 pb-16" dir="rtl">
      {/* Page Title / Header banner */}
      <div className="relative rounded-3xl overflow-hidden border border-obsidian-850 bg-gradient-to-r from-crimson-950/20 via-obsidian-900 to-obsidian-950 p-8 md:p-12 shadow-xl">
        <div className="absolute top-0 left-0 w-64 h-64 bg-crimson-600/5 rounded-full blur-3xl pointer-events-none"></div>
        <div className="relative space-y-4 max-w-3xl text-right">
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-crimson-950/40 border border-crimson-800/20 text-xs font-black text-crimson-500 font-mono">
            <BookOpen className="w-3.5 h-3.5 animate-pulse" /> المكتبة والدليل الشامل
          </span>
          <h1 className="text-3xl md:text-5xl font-black text-white tracking-tight">دليل المانجا والمانهوا</h1>
          <p className="text-sm text-neutral-400 leading-relaxed max-w-xl">
            استكشف وتصفح مكتبتنا الشاملة من الأعمال المترجمة للعربية. استخدم الفلاتر للوصول لعملك المفضل بسهولة وسرعة.
          </p>
        </div>
      </div>

      {/* FILTERS PANEL */}
      <div className="bg-obsidian-900/60 border border-obsidian-850 rounded-2xl p-6 shadow-md text-right">
        <div className="flex flex-col lg:flex-row gap-4 items-center justify-between">
          
          {/* Search Input */}
          <div className="w-full lg:w-1/3 relative">
            <Search className="absolute right-4 top-3.5 w-4 h-4 text-neutral-500" />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => {
                setSearchTerm(e.target.value);
                setCurrentPage(1);
              }}
              placeholder="ابحث بالاسم أو المؤول..."
              className="w-full bg-obsidian-950 border border-obsidian-800 text-xs text-white pr-11 pl-4 py-3 rounded-xl focus:border-crimson-600 focus:ring-1 focus:ring-crimson-600 transition-all text-right outline-none"
            />
          </div>

          {/* Filters Selects */}
          <div className="w-full lg:w-2/3 flex flex-wrap sm:flex-nowrap gap-3">
            {/* Genre */}
            <div className="w-full">
              <select
                value={selectedGenre}
                onChange={(e) => {
                  setSelectedGenre(e.target.value);
                  setCurrentPage(1);
                }}
                className="w-full bg-obsidian-950 border border-obsidian-800 text-xs text-white px-3 py-3 rounded-xl outline-none focus:border-crimson-600 transition-all"
              >
                <option value="">جميع التصنيفات</option>
                {allGenres.map(genre => (
                  <option key={genre} value={genre}>{genre}</option>
                ))}
              </select>
            </div>

            {/* Status */}
            <div className="w-full">
              <select
                value={selectedStatus}
                onChange={(e) => {
                  setSelectedStatus(e.target.value);
                  setCurrentPage(1);
                }}
                className="w-full bg-obsidian-950 border border-obsidian-800 text-xs text-white px-3 py-3 rounded-xl outline-none focus:border-crimson-600 transition-all"
              >
                <option value="">جميع الحالات</option>
                <option value="ongoing">مستمر</option>
                <option value="completed">مكتمل</option>
                <option value="paused">متوقف</option>
                <option value="dropped">ملغى</option>
              </select>
            </div>

            {/* Sort */}
            <div className="w-full">
              <select
                value={selectedSort}
                onChange={(e) => {
                  setSelectedSort(e.target.value);
                  setCurrentPage(1);
                }}
                className="w-full bg-obsidian-950 border border-obsidian-800 text-xs text-white px-3 py-3 rounded-xl outline-none focus:border-crimson-600 transition-all"
              >
                <option value="newest">الأحدث إضافة</option>
                <option value="views">الأكثر مشاهدة</option>
                <option value="likes">الأكثر إعجاباً</option>
                <option value="rating">الأعلى تقييماً</option>
                <option value="oldest">الأقدم إضافة</option>
              </select>
            </div>

            {/* Clear filters button */}
            {(searchTerm || selectedGenre || selectedStatus || selectedSort !== 'newest') && (
              <button
                onClick={clearFilters}
                className="bg-crimson-950/40 border border-crimson-800/20 hover:bg-crimson-950/60 text-crimson-500 font-bold p-3 rounded-xl transition-all cursor-pointer flex items-center justify-center shrink-0"
                title="إعادة ضبط الفلاتر"
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </div>

        </div>
      </div>

      {/* MANGA LIST GRID */}
      <section className="space-y-6 text-right">
        <div className="flex items-center justify-between border-b border-obsidian-850 pb-2">
          <h2 className="text-lg font-black text-white flex items-center gap-1.5">
            <Sliders className="w-4 h-4 text-crimson-600" /> جميع الأعمال
          </h2>
          <p className="text-xs text-neutral-500">تم العثور على {processedSeries.length} عمل</p>
        </div>

        {paginatedSeries.length === 0 ? (
          <div className="bg-obsidian-900/50 border border-obsidian-850 rounded-2xl p-16 text-center text-neutral-500">
            لم يتم العثور على أي أعمال تطابق الفلاتر المحددة. جرب البحث بكلمات أخرى.
          </div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-6">
            {paginatedSeries.map(s => (
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

                {/* Text Metadata */}
                <div className="mt-3 space-y-1 text-right">
                  <h3 className="font-extrabold text-sm text-neutral-100 group-hover:text-crimson-500 transition-colors truncate">{s.titleAr || s.titleEn}</h3>
                  <p className="text-[11px] text-neutral-500 truncate font-sans tracking-wider">{s.author}</p>
                  <div className="flex items-center gap-2 text-[10px] text-neutral-500">
                    <span className="flex items-center gap-0.5"><Eye className="w-3 h-3 text-neutral-500" /> {formatNumber(s.views)}</span>
                    <span>•</span>
                    <span className="flex items-center gap-0.5"><ThumbsUp className="w-3 h-3 text-crimson-600" /> {formatNumber(s.likes)}</span>
                  </div>
                </div>
              </motion.div>
            ))}
          </div>
        )}

        {/* PAGINATION CONTROLS */}
        {totalPages > 1 && (
          <div className="flex items-center justify-center gap-2 pt-8">
            <button
              onClick={() => handlePageChange(Math.max(1, currentPage - 1))}
              disabled={currentPage === 1}
              className="px-4 py-2 bg-obsidian-900 border border-obsidian-800 rounded-xl text-xs hover:bg-obsidian-800 text-white disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
            >
              السابق
            </button>
            
            {Array.from({ length: totalPages }, (_, i) => i + 1).map(page => (
              <button
                key={page}
                onClick={() => handlePageChange(page)}
                className={`w-9 h-9 rounded-xl text-xs font-bold cursor-pointer transition-all ${currentPage === page ? 'bg-crimson-600 text-white shadow' : 'bg-obsidian-900 border border-obsidian-800 text-neutral-400 hover:bg-obsidian-800'}`}
              >
                {page}
              </button>
            ))}

            <button
              onClick={() => handlePageChange(Math.min(totalPages, currentPage + 1))}
              disabled={currentPage === totalPages}
              className="px-4 py-2 bg-obsidian-900 border border-obsidian-800 rounded-xl text-xs hover:bg-obsidian-800 text-white disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
            >
              التالي
            </button>
          </div>
        )}
      </section>
    </div>
  );
}
