/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  LayoutDashboard, FolderPlus, FileUp, ShieldAlert, FileText, Database, 
  Settings, Plus, Trash2, Edit2, CheckCircle, Save, ToggleLeft, ToggleRight,
  UploadCloud, AlertTriangle, Eye, ArrowUp, ArrowDown, UserPlus, Sliders, Play,
  Zap, Copy, ExternalLink, HelpCircle, Check, Loader2, CheckSquare, Square, XCircle,
  Sparkles, Download, Globe, ListPlus, RefreshCw
} from 'lucide-react';
import { apiFetch, formatNumber } from '../lib/api';
import { Series, Chapter, AdZone, Report, AdminLog, User, SiteSettings } from '../types';

export function generateSeoAlternativeTitles(titleAr: string, titleEn: string, type: string = 'manga'): string {
  if (!titleAr && !titleEn) return '';
  const titles = new Set<string>();

  const cleanAr = (titleAr || '').trim();
  const cleanEn = (titleEn || '').trim();

  const typeAr = type === 'manhwa' ? 'مانهوا' : type === 'manhua' ? 'مانهوا' : type === 'novel' ? 'رواية' : 'مانجا';
  const typeWord = type === 'manhwa' ? 'Manhwa' : type === 'manhua' ? 'Manhua' : type === 'novel' ? 'Novel' : 'Manga';

  if (cleanAr) {
    titles.add(cleanAr);
    titles.add(`${typeAr} ${cleanAr}`);
    titles.add(`${cleanAr} ${typeAr}`);
    titles.add(`${cleanAr} مترجمة`);
    titles.add(`قراءة ${cleanAr}`);
    titles.add(`مانجا ${cleanAr} مترجمة`);
    titles.add(`فصول ${cleanAr}`);
  }

  if (cleanEn) {
    titles.add(cleanEn);
    titles.add(`${typeWord} ${cleanEn}`);
    titles.add(`${cleanEn} ${typeWord}`);
    titles.add(`${cleanEn} Read Online`);
    titles.add(`${cleanEn} Chapters`);
    titles.add(`Read ${cleanEn} Free`);
  }

  return Array.from(titles).filter(t => t.length > 2).join(', ');
}

interface AdminProps {
  currentUser: User;
  allSeries: Series[];
  onNavigate: (page: string, params?: any) => void;
  onRefreshDatabase: () => void;
}

export default function Admin({ currentUser, allSeries, onNavigate, onRefreshDatabase }: AdminProps) {
  const [activeTab, setActiveTab] = useState<'dashboard' | 'series' | 'chapters' | 'auto-import' | 'catalog-import' | 'ads' | 'reports' | 'logs' | 'backup'>('dashboard');
  const [stats, setStats] = useState<any>(null);
  
  // Data lists
  const [seriesList, setSeriesList] = useState<Series[]>(allSeries);
  const [reports, setReports] = useState<Report[]>([]);
  const [logs, setLogs] = useState<AdminLog[]>([]);
  const [ads, setAds] = useState<AdZone[]>([]);
  const [editingAd, setEditingAd] = useState<AdZone | null>(null);
  const [siteSettings, setSiteSettings] = useState<SiteSettings | null>(null);

  // CRUD Series forms
  const [editingSeries, setEditingSeries] = useState<Series | null>(null);
  const [showAddSeries, setShowAddSeries] = useState(false);
  const [seriesForm, setSeriesForm] = useState({
    titleAr: '', titleEn: '', alternativeTitles: '', descriptionAr: '', descriptionEn: '',
    coverUrl: '', bannerUrl: '', author: '', artist: '', status: 'ongoing' as 'ongoing'|'completed'|'paused'|'dropped', genres: [] as string[],
    type: 'manhwa' as 'manga'|'manhwa'|'manhua'|'novel', ageRating: 'All', releaseYear: '', translator: ''
  });

  // Chapter Upload Panel states
  const [uploadSeriesId, setUploadSeriesId] = useState('');
  const [uploadChapterNumber, setUploadChapterNumber] = useState('');
  const [uploadChapterTitleAr, setUploadChapterTitleAr] = useState('');
  const [uploadChapterTitleEn, setUploadChapterTitleEn] = useState('');
  const [uploadTranslatorName, setUploadTranslatorName] = useState('');
  const [uploadChapterStatus, setUploadChapterStatus] = useState<'draft' | 'published'>('published');
  const [uploadReleaseNote, setUploadReleaseNote] = useState('');
  const [uploadMethod, setUploadMethod] = useState<'files' | 'urls'>('files');
  const [bulkUrls, setBulkUrls] = useState('');
  
  // Drag and drop mock state
  const [dragging, setDragging] = useState(false);
  const [uploadedPages, setUploadedPages] = useState<string[]>([]);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);

  // Auto-Scraper States
  const [seriesImportUrl, setSeriesImportUrl] = useState('');
  const [isImportingSeries, setIsImportingSeries] = useState(false);
  const [chapterImportUrl, setChapterImportUrl] = useState('');
  const [isImportingChapter, setIsImportingChapter] = useState(false);
  const [cloudflareBlockedChapter, setCloudflareBlockedChapter] = useState(false);
  const [scrapedChapters, setScrapedChapters] = useState<{ number: string; title: string; url: string }[]>([]);

  // Professional chapter auto-crawler & bulk syndication states
  const [existingChapterNumbers, setExistingChapterNumbers] = useState<number[]>([]);
  const [importingChaptersMap, setImportingChaptersMap] = useState<Record<string, 'loading' | 'success' | 'error'>>({});
  const [bulkImportProgress, setBulkImportProgress] = useState<{ current: number; total: number; log: string[] } | null>(null);
  const [selectedChaptersForBulk, setSelectedChaptersForBulk] = useState<string[]>([]);

  // ----------------------------------------------------
  // FULLY AUTOMATED MASS CRAWLER STATES (2000+ CHAPTERS)
  // ----------------------------------------------------
  const [autoImportUrl, setAutoImportUrl] = useState('');
  const [autoImportSeriesId, setAutoImportSeriesId] = useState('');
  const [autoImportChapters, setAutoImportChapters] = useState<{ number: string; title: string; url: string }[]>([]);
  const [autoImportStartChapter, setAutoImportStartChapter] = useState<number>(1);
  const [autoImportEndChapter, setAutoImportEndChapter] = useState<number>(100);
  const [autoImportStatus, setAutoImportStatus] = useState<'idle' | 'fetching_list' | 'running' | 'paused' | 'completed' | 'stopped'>('idle');
  const [autoImportProgress, setAutoImportProgress] = useState<{
    current: number;
    total: number;
    success: number;
    failed: number;
    logs: string[];
    runningTasks: string[];
  }>({
    current: 0,
    total: 0,
    success: 0,
    failed: 0,
    logs: [],
    runningTasks: []
  });
  const [autoImportSkipExisting, setAutoImportSkipExisting] = useState(true);
  const [autoImportConcurrency, setAutoImportConcurrency] = useState(1);
  const [autoImportTranslator, setAutoImportTranslator] = useState('Dark Manhwa');
  const [autoImportOrder, setAutoImportOrder] = useState<'asc' | 'desc'>('asc');
  const [autoImportStartTime, setAutoImportStartTime] = useState<number | null>(null);



  // ----------------------------------------------------
  // AUTOMATED MANGA CATALOG IMPORTER STATES
  // ----------------------------------------------------
  const [catalogUrl, setCatalogUrl] = useState('');
  const [catalogSecondPageUrl, setCatalogSecondPageUrl] = useState('');
  const [catalogRawUrls, setCatalogRawUrls] = useState('');
  const [catalogExtractMode, setCatalogExtractMode] = useState<'url' | 'raw'>('url');
  const [catalogMultiPage, setCatalogMultiPage] = useState(false);
  const [catalogPagesCount, setCatalogPagesCount] = useState<number>(3);
  const [isExtractingCatalog, setIsExtractingCatalog] = useState(false);
  const [extractedCatalogItems, setExtractedCatalogItems] = useState<{ url: string; title: string; coverUrl: string }[]>([]);
  const [selectedCatalogUrls, setSelectedCatalogUrls] = useState<string[]>([]);
  const [catalogChaptersCount, setCatalogChaptersCount] = useState<number>(-1);
  const [catalogPublishStatus, setCatalogPublishStatus] = useState<'published' | 'draft'>('published');
  const [catalogFilterText, setCatalogFilterText] = useState('');
  
  const [catalogImportStatus, setCatalogImportStatus] = useState<'idle' | 'running' | 'paused' | 'completed' | 'stopped'>('idle');
  const [catalogImportProgress, setCatalogImportProgress] = useState<{
    current: number;
    total: number;
    success: number;
    failed: number;
    logs: string[];
  }>({
    current: 0,
    total: 0,
    success: 0,
    failed: 0,
    logs: []
  });

  const catalogImportStateRef = React.useRef({
    status: 'idle',
    queue: [] as { url: string; title: string; coverUrl: string }[],
    index: 0,
    success: 0,
    failed: 0,
    chaptersCount: -1,
    publishStatus: 'published' as 'published' | 'draft'
  });

  // Keep ref synchronized
  useEffect(() => {
    catalogImportStateRef.current.status = catalogImportStatus;
    catalogImportStateRef.current.chaptersCount = catalogChaptersCount;
    catalogImportStateRef.current.publishStatus = catalogPublishStatus;
  }, [catalogImportStatus, catalogChaptersCount, catalogPublishStatus]);

  // Background Job States and Polling Logic
  interface JobItem {
    url: string;
    title: string;
    coverUrl?: string;
    status: 'pending' | 'running' | 'completed' | 'failed';
    error?: string;
  }

  interface BackgroundJob {
    id: string;
    items: JobItem[];
    status: 'pending' | 'running' | 'paused' | 'completed' | 'stopped';
    currentIndex?: number;
    completedItems?: number;
    successCount: number;
    failedCount: number;
    logs: string[];
    chaptersCount?: number;
    publishStatus?: 'published' | 'draft';
    createdAt: string;
  }
  const [backgroundJobs, setBackgroundJobs] = useState<BackgroundJob[]>([]);
  const [expandedJobLogs, setExpandedJobLogs] = useState<Record<string, boolean>>({});

  // LocalStorage Failure Logging System
  interface CrawlerFailure {
    id: string; // unique ID: jobId + itemUrl
    jobId: string;
    title: string;
    url: string;
    error: string;
    timestamp: string;
  }
  const [crawlerFailures, setCrawlerFailures] = useState<CrawlerFailure[]>(() => {
    try {
      const stored = localStorage.getItem('catalog_crawler_failures');
      return stored ? JSON.parse(stored) : [];
    } catch {
      return [];
    }
  });

  const [consecutiveFailureInfo, setConsecutiveFailureInfo] = useState<{
    count: number;
    triggered: boolean;
    list: { title: string; url: string; error?: string }[];
  }>({ count: 0, triggered: false, list: [] });

  const fetchBackgroundJobs = async () => {
    try {
      const res = await apiFetch('/api/admin/jobs');
      if (res && Array.isArray(res)) {
        setBackgroundJobs(res);
      }
    } catch (err) {
      console.error('Failed to fetch background jobs:', err);
    }
  };

  useEffect(() => {
    fetchBackgroundJobs();
    const interval = setInterval(fetchBackgroundJobs, 2500);
    return () => clearInterval(interval);
  }, []);

  // Sync failed background job items to localStorage and check consecutive failures
  useEffect(() => {
    if (backgroundJobs.length === 0) return;

    // 1. Log any failed crawl items to localStorage (prevent duplicates)
    let updatedFailures = [...crawlerFailures];
    let hasNew = false;

    backgroundJobs.forEach(job => {
      if (job.items && Array.isArray(job.items)) {
        job.items.forEach(item => {
          if (item.status === 'failed') {
            const uniqueId = `${job.id}_${item.url}`;
            const alreadyExists = updatedFailures.some(f => f.id === uniqueId);
            if (!alreadyExists) {
              updatedFailures.unshift({ // Add new ones to the top/beginning
                id: uniqueId,
                jobId: job.id,
                title: item.title,
                url: item.url,
                error: item.error || 'Failed to fetch or process series (Network block or Cloudflare)',
                timestamp: new Date().toISOString()
              });
              hasNew = true;
            }
          }
        });
      }
    });

    if (hasNew) {
      // Keep only the most recent 100 failures
      if (updatedFailures.length > 100) {
        updatedFailures = updatedFailures.slice(0, 100);
      }
      localStorage.setItem('catalog_crawler_failures', JSON.stringify(updatedFailures));
      setCrawlerFailures(updatedFailures);
    }

    // 2. Identify consecutive failures
    // Gather all processed items across all current background jobs sorted by job timestamp and sequence
    const processedItems: { title: string; url: string; status: 'completed' | 'failed'; error?: string }[] = [];
    
    // Sort jobs latest-first (by job id timestamp)
    const sortedJobs = [...backgroundJobs].sort((a, b) => b.id.localeCompare(a.id));

    for (const job of sortedJobs) {
      if (job.items && Array.isArray(job.items)) {
        // Find finished items
        const finished = job.items.filter(item => item.status === 'completed' || item.status === 'failed');
        // Latest finished inside a job is at the end of the finished array,
        // so we traverse backwards to preserve reverse-chronological order of processing.
        for (let i = finished.length - 1; i >= 0; i--) {
          processedItems.push({
            title: finished[i].title,
            url: finished[i].url,
            status: finished[i].status as 'completed' | 'failed',
            error: finished[i].error
          });
        }
      }
    }

    // Count consecutive failures starting from the absolute latest processed item
    let consecutiveCount = 0;
    const consecutiveList: typeof processedItems = [];

    for (const item of processedItems) {
      if (item.status === 'failed') {
        consecutiveCount++;
        consecutiveList.push(item);
      } else {
        break; // Met a successful item; sequence is broken
      }
    }

    // Check if consecutiveCount is >= 3
    setConsecutiveFailureInfo({
      count: consecutiveCount,
      triggered: consecutiveCount >= 3,
      list: consecutiveList
    });
  }, [backgroundJobs]);

  const handleClearFailureLogs = () => {
    if (confirm('هل أنت متأكد من رغبتك في مسح سجل الإخفاقات بالكامل وتصفير عداد الأخطاء المستمرة؟')) {
      localStorage.removeItem('catalog_crawler_failures');
      setCrawlerFailures([]);
      setConsecutiveFailureInfo({ count: 0, triggered: false, list: [] });
    }
  };

  const handleDismissAlert = () => {
    setConsecutiveFailureInfo(prev => ({ ...prev, triggered: false }));
  };

  const autoImportStateRef = React.useRef({
    status: 'idle',
    queue: [] as { number: string; title: string; url: string }[],
    index: 0,
    success: 0,
    failed: 0,
    seriesId: '',
    translator: '',
    existingChapters: [] as number[],
    skipExisting: true,
    concurrency: 1,
  });

  // Keep ref synchronized with state to prevent closure captures in async workers
  useEffect(() => {
    autoImportStateRef.current.status = autoImportStatus;
    autoImportStateRef.current.seriesId = autoImportSeriesId;
    autoImportStateRef.current.translator = autoImportTranslator;
    autoImportStateRef.current.skipExisting = autoImportSkipExisting;
    autoImportStateRef.current.concurrency = autoImportConcurrency;
  }, [autoImportStatus, autoImportSeriesId, autoImportTranslator, autoImportSkipExisting, autoImportConcurrency]);

  const getEtaString = () => {
    if (!autoImportStartTime || autoImportProgress.current === 0) {
      return 'جاري تقدير الوقت المتبقي... ⏳';
    }
    const elapsedMs = Date.now() - autoImportStartTime;
    const avgMsPerChapter = elapsedMs / autoImportProgress.current;
    const remainingCount = autoImportProgress.total - autoImportProgress.current;
    const remainingMs = avgMsPerChapter * remainingCount;

    if (remainingCount <= 0) return 'اكتملت جميع العمليات بنجاح! 🎉';

    const remainingSeconds = Math.round(remainingMs / 1000);
    if (remainingSeconds < 60) {
      return `متبقي حوالي ${remainingSeconds} ثانية للانتهاء`;
    }
    const minutes = Math.floor(remainingSeconds / 60);
    const seconds = remainingSeconds % 60;
    return `متبقي حوالي ${minutes} دقيقة و ${seconds} ثانية للانتهاء`;
  };

  const generateChapterUrl = (baseUrl: string, chapterNum: number) => {
    let trimmed = baseUrl.trim();
    if (trimmed.endsWith('/')) {
      trimmed = trimmed.slice(0, -1);
    }
    const parts = trimmed.split('/');
    const lastPart = parts[parts.length - 1];
    if (lastPart && !isNaN(Number(lastPart))) {
      parts[parts.length - 1] = String(chapterNum);
      return parts.join('/');
    } else {
      const regex = /(\d+)(?!.*\d)/;
      if (regex.test(trimmed)) {
        return trimmed.replace(regex, String(chapterNum));
      }
      return `${baseUrl}/${chapterNum}`;
    }
  };

  const handleFetchAutoImportChapters = async () => {
    if (!autoImportUrl) {
      alert('❌ يرجى إدخال رابط الفصل الأول المستهدف!');
      return;
    }
    if (autoImportStartChapter < 1 || autoImportEndChapter <= 0 || autoImportEndChapter < autoImportStartChapter) {
      alert('❌ يرجى التأكد من إدخال قيم صحيحة لرقم البداية والنهاية للفصول!');
      return;
    }

    setAutoImportStatus('fetching_list');
    setAutoImportProgress(prev => ({
      ...prev,
      logs: ['🔍 جاري توليد ومعاينة روابط الفصول بشكل تسلسلي ذكي...']
    }));

    setTimeout(() => {
      const generated: { number: string; title: string; url: string }[] = [];
      for (let i = autoImportStartChapter; i <= autoImportEndChapter; i++) {
        generated.push({
          number: String(i),
          title: `الفصل ${i}`,
          url: generateChapterUrl(autoImportUrl, i)
        });
      }

      if (autoImportOrder === 'desc') {
        generated.reverse();
      }

      setAutoImportChapters(generated);
      setAutoImportStatus('idle');
      setAutoImportProgress(prev => ({
        ...prev,
        logs: [
          `✅ تم توليد وتجهيز قائمة تحتوي على ${generated.length} فصول بنجاح!`,
          `📈 النطاق المحدد: من الفصل ${autoImportStartChapter} إلى الفصل ${autoImportEndChapter}.`,
          `🔗 رابط البداية: ${generated[autoImportOrder === 'desc' ? generated.length - 1 : 0].url}`,
          `🔗 رابط النهاية: ${generated[autoImportOrder === 'desc' ? 0 : generated.length - 1].url}`,
          `🚀 جاهز الآن لعملية الجلب والنشر الآمنة.`
        ]
      }));
    }, 400);
  };

  const handleStartAutoImport = async () => {
    if (!autoImportSeriesId) {
      alert('❌ يرجى اختيار مانهوا المانجا المستهدفة لحفظ الفصول بداخلها!');
      return;
    }
    if (!autoImportUrl) {
      alert('❌ يرجى إدخال رابط الفصل الأول المستهدف!');
      return;
    }
    if (autoImportStartChapter < 1 || autoImportEndChapter <= 0 || autoImportEndChapter < autoImportStartChapter) {
      alert('❌ يرجى التأكد من إدخال قيم صحيحة لرقم البداية والنهاية للفصول!');
      return;
    }

    // Always dynamically regenerate fresh chapters based on current input parameters to guarantee absolute accuracy and avoid stale state caches
    const generated: { number: string; title: string; url: string }[] = [];
    for (let i = autoImportStartChapter; i <= autoImportEndChapter; i++) {
      generated.push({
        number: String(i),
        title: `الفصل ${i}`,
        url: generateChapterUrl(autoImportUrl, i)
      });
    }
    if (autoImportOrder === 'desc') {
      generated.reverse();
    }
    const currentChapters = generated;
    setAutoImportChapters(generated);

    // Load existing chapters for target
    let existingNums: number[] = [];
    try {
      const res = await apiFetch(`/api/series/${autoImportSeriesId}`);
      if (res && res.chapters) {
        existingNums = res.chapters.map((c: any) => Number(c.number));
      }
    } catch (e) {
      console.error('Error fetching target series chapters:', e);
    }

    // Filter queue
    const finalQueue = autoImportSkipExisting
      ? currentChapters.filter(ch => !existingNums.includes(Number(ch.number)))
      : currentChapters;

    if (finalQueue.length === 0) {
      setAutoImportStatus('idle');
      setAutoImportProgress(prev => ({
        ...prev,
        logs: [...prev.logs, 'ℹ️ تم تخطي العملية لأن جميع الفصول الـمكتشفة مضافة مسبقاً بالفعل في هذا العمل.']
      }));
      alert('ℹ️ جميع الفصول المحددة موجودة مسبقاً في هذا العمل! تم تخطي الاستيراد.');
      return;
    }

    setAutoImportProgress({
      current: 0,
      total: finalQueue.length,
      success: 0,
      failed: 0,
      logs: [
        `🚀 بدء تشغيل نظام السحب والزحف الذكي الفائق لـ ${finalQueue.length} فصل...`,
        `🛠️ ترتيب النشر: ${autoImportOrder === 'asc' ? 'من الفصل الأقل إلى الأحدث (تصاعدي)' : 'من الفصل الأحدث إلى الأقدم (تنازلي)'}.`,
        `⚡ قوة وسرعة السحب النشطة: ${autoImportConcurrency} فصول متزامنة لضمان أقصى سرعة وقوة.`
      ],
      runningTasks: []
    });

    setAutoImportStatus('running');
    setAutoImportStartTime(Date.now());

    // IMPORTANT: Synchronously initialize and update ref state to prevent React state asynchronous render-cycle delay bugs
    autoImportStateRef.current.status = 'running';
    autoImportStateRef.current.queue = finalQueue;
    autoImportStateRef.current.index = 0;
    autoImportStateRef.current.success = 0;
    autoImportStateRef.current.failed = 0;
    autoImportStateRef.current.existingChapters = existingNums;
    autoImportStateRef.current.seriesId = autoImportSeriesId;
    autoImportStateRef.current.translator = autoImportTranslator || 'فريق الموقع';
    autoImportStateRef.current.concurrency = autoImportConcurrency;

    let queueIndex = 0;
    let successCount = 0;
    let failedCount = 0;
    let activeWorkers = 0;

    const runNext = async () => {
      if (autoImportStateRef.current.status !== 'running') {
        return;
      }

      if (queueIndex >= finalQueue.length) {
        if (activeWorkers === 0) {
          setAutoImportStatus('completed');
          setAutoImportProgress(prev => ({
            ...prev,
            logs: [...prev.logs, `✨ [تم الإنجاز بنجاح باهر! 🏆] اكتمل نظام السحب الفوري والضخ المباشر لجميع فصول المانجا/المانهوا المحددة. تم نشر الفصول وتعميمها بنجاح تام لزوار موقع مانهوا العرب فوراً دون أي مشاكل وبأفضل كفاءة.`]
          }));
          if (onRefreshDatabase) onRefreshDatabase();
        }
        return;
      }

      const ch = finalQueue[queueIndex];
      const taskIndex = queueIndex;
      queueIndex++;
      activeWorkers++;

      setAutoImportProgress(prev => {
        const remaining = prev.total - prev.current;
        return {
          ...prev,
          runningTasks: [...prev.runningTasks, ch.number],
          logs: [...prev.logs, `⏳ جاري معالجة وسحب [${ch.title}] | الرابط: ${ch.url} | الفصول المتبقية: ${remaining} فصول...`]
        };
      });

      try {
        const res = await apiFetch('/api/admin/import-external', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ url: ch.url, type: 'chapter' })
        });

        if (res.success && res.pages && res.pages.length > 0) {
          await apiFetch('/api/admin/chapters', {
            method: 'POST',
            body: JSON.stringify({
              seriesId: autoImportStateRef.current.seriesId,
              number: Number(ch.number),
              titleAr: ch.title || `الفصل ${ch.number}`,
              titleEn: `Chapter ${ch.number}`,
              pages: res.pages,
              translatorName: autoImportStateRef.current.translator || 'فريق الموقع',
              status: 'published',
              releaseNote: ''
            })
          });

          successCount++;
          setAutoImportProgress(prev => {
            const nextDone = prev.current + 1;
            const remaining = Math.max(0, prev.total - nextDone);
            return {
              ...prev,
              current: nextDone,
              success: successCount,
              runningTasks: prev.runningTasks.filter(n => n !== ch.number),
              logs: [
                ...prev.logs,
                `✅ تم استيراد ونشر [${ch.title}] بنجاح فائق! 🖼️ عدد الصفحات: ${res.pages.length} | ⏳ متبقي: ${remaining} فصول.`
              ]
            };
          });
        } else {
          throw new Error(res.message || 'لم يعثر الزاحف على أي صور في هذا الرابط.');
        }
      } catch (err: any) {
        failedCount++;
        setAutoImportProgress(prev => {
          const nextDone = prev.current + 1;
          const remaining = Math.max(0, prev.total - nextDone);
          return {
            ...prev,
            current: nextDone,
            failed: failedCount,
            runningTasks: prev.runningTasks.filter(n => n !== ch.number),
            logs: [
              ...prev.logs,
              `❌ فشل استيراد [${ch.title}]: ${err.message || 'خطأ اتصال بالشبكة'} | ⏳ متبقي: ${remaining} فصول.`
            ]
          };
        });
      } finally {
        activeWorkers--;
        runNext();
      }
    };

    const concurrencyTarget = Math.min(autoImportConcurrency, finalQueue.length);
    for (let i = 0; i < concurrencyTarget; i++) {
      runNext();
    }
  };

  const handlePauseAutoImport = () => {
    setAutoImportStatus('paused');
    autoImportStateRef.current.status = 'paused';
    setAutoImportProgress(prev => ({
      ...prev,
      logs: [...prev.logs, '⏸️ تم إيقاف عملية الاستيراد مؤقتاً. يمكنك الاستئناف في أي وقت.']
    }));
  };

  const handleResumeAutoImport = () => {
    setAutoImportStatus('running');
    autoImportStateRef.current.status = 'running';
    // Calculate approximate elapsed time so ETA calculations stay continuous and stable
    if (autoImportProgress.current > 0) {
      setAutoImportStartTime(Date.now() - (autoImportProgress.current * 3500));
    } else {
      setAutoImportStartTime(Date.now());
    }
    setAutoImportProgress(prev => ({
      ...prev,
      logs: [...prev.logs, '▶️ تم استئناف عملية الاستيراد التلقائي...']
    }));

    let queueIndex = autoImportProgress.current;
    let activeWorkers = 0;
    const finalQueue = autoImportStateRef.current.queue;
    let successCount = autoImportProgress.success;
    let failedCount = autoImportProgress.failed;

    const runNext = async () => {
      if (autoImportStateRef.current.status !== 'running') return;

      if (queueIndex >= finalQueue.length) {
        if (activeWorkers === 0) {
          setAutoImportStatus('completed');
          setAutoImportProgress(prev => ({
            ...prev,
            logs: [...prev.logs, `✨ [تم الإنجاز بنجاح باهر! 🏆] اكتمل نظام السحب الفوري والضخ المباشر لجميع فصول المانجا/المانهوا المحددة. تم نشر الفصول وتعميمها بنجاح تام لزوار موقع مانهوا العرب فوراً دون أي مشاكل وبأفضل كفاءة.`]
          }));
          if (onRefreshDatabase) onRefreshDatabase();
        }
        return;
      }

      const ch = finalQueue[queueIndex];
      const taskIndex = queueIndex;
      queueIndex++;
      activeWorkers++;

      setAutoImportProgress(prev => {
        const remaining = prev.total - prev.current;
        return {
          ...prev,
          runningTasks: [...prev.runningTasks, ch.number],
          logs: [...prev.logs, `⏳ جاري استئناف سحب [${ch.title}] | الرابط: ${ch.url} | الفصول المتبقية: ${remaining} فصول...`]
        };
      });

      try {
        const res = await apiFetch('/api/admin/import-external', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ url: ch.url, type: 'chapter' })
        });

        if (res.success && res.pages && res.pages.length > 0) {
          await apiFetch('/api/admin/chapters', {
            method: 'POST',
            body: JSON.stringify({
              seriesId: autoImportStateRef.current.seriesId,
              number: Number(ch.number),
              titleAr: ch.title || `الفصل ${ch.number}`,
              titleEn: `Chapter ${ch.number}`,
              pages: res.pages,
              translatorName: autoImportStateRef.current.translator || 'فريق الموقع',
              status: 'published',
              releaseNote: ''
            })
          });

          successCount++;
          setAutoImportProgress(prev => {
            const nextDone = prev.current + 1;
            const remaining = Math.max(0, prev.total - nextDone);
            return {
              ...prev,
              current: nextDone,
              success: successCount,
              runningTasks: prev.runningTasks.filter(n => n !== ch.number),
              logs: [
                ...prev.logs,
                `✅ تم استيراد ونشر [${ch.title}] بنجاح فائق! 🖼️ عدد الصفحات: ${res.pages.length} | ⏳ متبقي: ${remaining} فصول.`
              ]
            };
          });
        } else {
          throw new Error(res.message || 'فشل استخراج الصور');
        }
      } catch (err: any) {
        failedCount++;
        setAutoImportProgress(prev => {
          const nextDone = prev.current + 1;
          const remaining = Math.max(0, prev.total - nextDone);
          return {
            ...prev,
            current: nextDone,
            failed: failedCount,
            runningTasks: prev.runningTasks.filter(n => n !== ch.number),
            logs: [
              ...prev.logs,
              `❌ فشل استيراد [${ch.title}]: ${err.message} | ⏳ متبقي: ${remaining} فصول.`
            ]
          };
        });
      } finally {
        activeWorkers--;
        runNext();
      }
    };

    const concurrencyTarget = Math.min(autoImportConcurrency, finalQueue.length - queueIndex);
    for (let i = 0; i < Math.max(1, concurrencyTarget); i++) {
      runNext();
    }
  };

  const handleStopAutoImport = () => {
    setAutoImportStatus('stopped');
    autoImportStateRef.current.status = 'stopped';
    setAutoImportProgress(prev => ({
      ...prev,
      logs: [...prev.logs, '⏹️ تم إيقاف عملية الاستيراد كلياً وإلغاء جدولة الفصول المتبقية.']
    }));
  };


  useEffect(() => {
    if (uploadSeriesId) {
      apiFetch(`/api/series/${uploadSeriesId}`)
        .then(res => {
          if (res && res.chapters) {
            const nums = res.chapters.map((c: any) => Number(c.number));
            setExistingChapterNumbers(nums);
          }
        })
        .catch(err => console.error('Error fetching series chapters:', err));
    } else {
      setExistingChapterNumbers([]);
    }
  }, [uploadSeriesId]);

  const handleAutoImportAndPublish = async (ch: { number: string; title: string; url: string }) => {
    if (!uploadSeriesId) {
      alert('❌ يرجى اختيار العمل المانجا المستهدف أولاً من القائمة الجانبية!');
      return;
    }

    setImportingChaptersMap(prev => ({ ...prev, [ch.number]: 'loading' }));
    try {
      // 1. Fetch chapter pages
      const res = await apiFetch('/api/admin/import-external', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: ch.url, type: 'chapter' })
      });

      if (res.success && res.pages && res.pages.length > 0) {
        // 2. Publish to DB
        await apiFetch('/api/admin/chapters', {
          method: 'POST',
          body: JSON.stringify({
            seriesId: uploadSeriesId,
            number: Number(ch.number),
            titleAr: ch.title || `الفصل ${ch.number}`,
            titleEn: `Chapter ${ch.number}`,
            pages: res.pages,
            translatorName: uploadTranslatorName || 'فريق الموقع',
            status: 'published',
            releaseNote: uploadReleaseNote || ''
          })
        });

        // 3. Success state
        setImportingChaptersMap(prev => ({ ...prev, [ch.number]: 'success' }));
        setExistingChapterNumbers(prev => [...prev, Number(ch.number)]);
        
        if (onRefreshDatabase) onRefreshDatabase();
      } else {
        throw new Error(res.message || 'تعذر جلب صور الفصل.');
      }
    } catch (err: any) {
      console.error(err);
      setImportingChaptersMap(prev => ({ ...prev, [ch.number]: 'error' }));
      alert(`❌ فشل استيراد الفصل ${ch.number}: ${err.message}`);
    }
  };

  const handleBulkImportSelected = async () => {
    if (!uploadSeriesId) {
      alert('❌ يرجى اختيار العمل المانجا المستهدف أولاً!');
      return;
    }
    if (selectedChaptersForBulk.length === 0) {
      alert('❌ يرجى تحديد فصل واحد على الأقل للاستيراد الجماعي!');
      return;
    }

    const confirmImport = window.confirm(`هل أنت متأكد من رغبتك في استيراد ونشر ${selectedChaptersForBulk.length} فصل دفعة واحدة تلقائياً وبشكل احترافي؟`);
    if (!confirmImport) return;

    setBulkImportProgress({
      current: 0,
      total: selectedChaptersForBulk.length,
      log: ['🚀 بدء عملية الاستيراد الجماعي الذكي للفصول...']
    });

    const chsToImport = scrapedChapters.filter(ch => selectedChaptersForBulk.includes(ch.number));
    
    let count = 0;
    for (const ch of chsToImport) {
      count++;
      setBulkImportProgress(prev => prev ? {
        ...prev,
        current: count,
        log: [...prev.log, `⏳ جاري استيراد الفصل ${ch.number} (${count}/${chsToImport.length})...`]
      } : null);

      setImportingChaptersMap(prev => ({ ...prev, [ch.number]: 'loading' }));

      try {
        const res = await apiFetch('/api/admin/import-external', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ url: ch.url, type: 'chapter' })
        });

        if (res.success && res.pages && res.pages.length > 0) {
          // Check if it already exists to avoid duplicate constraint errors
          if (existingChapterNumbers.includes(Number(ch.number))) {
            setBulkImportProgress(prev => prev ? {
              ...prev,
              log: [...prev.log, `⚠️ الفصل ${ch.number} متوفر مسبقاً، تم تخطي النشر لتجنب التكرار.`]
            } : null);
            setImportingChaptersMap(prev => ({ ...prev, [ch.number]: 'success' }));
            continue;
          }

          await apiFetch('/api/admin/chapters', {
            method: 'POST',
            body: JSON.stringify({
              seriesId: uploadSeriesId,
              number: Number(ch.number),
              titleAr: ch.title || `الفصل ${ch.number}`,
              titleEn: `Chapter ${ch.number}`,
              pages: res.pages,
              translatorName: uploadTranslatorName || 'فريق الموقع',
              status: 'published',
              releaseNote: uploadReleaseNote || ''
            })
          });

          setImportingChaptersMap(prev => ({ ...prev, [ch.number]: 'success' }));
          setExistingChapterNumbers(prev => [...prev, Number(ch.number)]);
          setBulkImportProgress(prev => prev ? {
            ...prev,
            log: [...prev.log, `✅ تم استيراد ونشر الفصل ${ch.number} بنجاح! (${res.pages.length} صفحة)`]
          } : null);
        } else {
          throw new Error(res.message || 'تعذر سحب صفحات الفصل.');
        }
      } catch (err: any) {
        setImportingChaptersMap(prev => ({ ...prev, [ch.number]: 'error' }));
        setBulkImportProgress(prev => prev ? {
          ...prev,
          log: [...prev.log, `❌ فشل استيراد الفصل ${ch.number}: ${err.message}`]
        } : null);
      }
    }

    setBulkImportProgress(prev => prev ? {
      ...prev,
      log: [...prev.log, `🎉 اكتملت عملية الاستيراد الجماعي! تم معالجة كافة الفصول.`]
    } : null);

    if (onRefreshDatabase) onRefreshDatabase();
  };

  // Delete Series Professional Modal States
  const [seriesToDelete, setSeriesToDelete] = useState<Series | null>(null);
  const [deleteConfirmName, setDeleteConfirmName] = useState('');
  const [isDeletingSeries, setIsDeletingSeries] = useState(false);
  const [showDeleteAllConfirm, setShowDeleteAllConfirm] = useState(false);
  const [deleteAllConfirmInput, setDeleteAllConfirmInput] = useState('');
  const [isDeletingAllSeries, setIsDeletingAllSeries] = useState(false);

  // Backup state
  const [backupString, setBackupString] = useState('');
  const [restoreString, setRestoreString] = useState('');

  // Genre selection options
  const genreOptions = ['أكشن', 'مغامرة', 'خيال', 'شونين', 'قوى خارقة', 'دراما', 'إثارة', 'غموض', 'سحر', 'رياضة', 'حياة يومية', 'إيسيكاي', 'شياطين', 'رومانسية', 'تاريخي', 'فنون قتالية', 'نظام', 'ألعاب', 'وحوش', 'إعادة إحياء', 'زمني', 'كوميديا', 'رعب'];

  useEffect(() => {
    fetchAdminData();
  }, [activeTab]);

  const fetchAdminData = async () => {
    try {
      const statsRes = await apiFetch('/api/admin/stats');
      setStats(statsRes);

      if (activeTab === 'series') {
        const seriesRes = await apiFetch('/api/series');
        setSeriesList(seriesRes);
      } else if (activeTab === 'reports') {
        const reportsRes = await apiFetch('/api/admin/reports');
        setReports(reportsRes.reverse());
      } else if (activeTab === 'logs') {
        const logsRes = await apiFetch('/api/admin/logs');
        setLogs(logsRes);
      } else if (activeTab === 'ads') {
        const adsRes = await apiFetch('/api/admin/ads');
        setAds(adsRes);
        const settingsRes = await apiFetch('/api/admin/settings');
        setSiteSettings(settingsRes);
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleExtractCatalog = async () => {
    if (catalogExtractMode === 'url') {
      if (!catalogUrl) {
        alert('يرجى إدخال رابط صفحة الكتالوج أولاً!');
        return;
      }
      setIsExtractingCatalog(true);
      setExtractedCatalogItems([]);
      setSelectedCatalogUrls([]);
      try {
        const res = await apiFetch('/api/admin/catalog-extract', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            url: catalogUrl,
            secondPageUrl: catalogSecondPageUrl,
            multiPage: catalogMultiPage,
            pagesCount: catalogPagesCount
          })
        });
        if (res.success && res.items) {
          setExtractedCatalogItems(res.items);
          setSelectedCatalogUrls(res.items.map((item: any) => item.url));
          alert(`✅ تم العثور على ${res.itemsCount} عمل مانهوا/مانجا في الكتالوج بنجاح!`);
        } else {
          alert('❌ فشل جلب الكتالوج: ' + (res.message || 'خطأ مجهول'));
        }
      } catch (err: any) {
        alert('❌ خطأ أثناء جلب الكتالوج: ' + err.message);
      } finally {
        setIsExtractingCatalog(false);
      }
    } else {
      if (!catalogRawUrls.trim()) {
        alert('يرجى إدخال قائمة روابط الأعمال أولاً!');
        return;
      }
      const urls = catalogRawUrls.split('\n')
        .map(u => u.trim())
        .filter(u => u.startsWith('http://') || u.startsWith('https://'));
      
      if (urls.length === 0) {
        alert('❌ لم يتم العثور على أي روابط صحيحة تبدأ بـ http:// أو https://');
        return;
      }

      const items = urls.map(u => {
        let slug = '';
        try {
          const urlObj = new URL(u);
          slug = urlObj.pathname.split('/').filter(Boolean).pop() || '';
        } catch (e) {
          slug = '';
        }
        const title = slug ? slug.replace(/[-_]/g, ' ').replace(/\b[a-z]/g, char => char.toUpperCase()) : 'رابط مستورد';
        return {
          url: u,
          title,
          coverUrl: 'https://images.unsplash.com/photo-1578632767115-351597cf2477?auto=format&fit=crop&w=400&h=600&q=80'
        };
      });

      setExtractedCatalogItems(items);
      setSelectedCatalogUrls(items.map(item => item.url));
      alert(`✅ تم تحليل وإعداد ${items.length} رابط عمل بنجاح!`);
    }
  };

  const handleStartCatalogImport = async () => {
    if (selectedCatalogUrls.length === 0) {
      alert('يرجى اختيار عمل واحد على الأقل للاستيراد!');
      return;
    }

    const itemsToImport = extractedCatalogItems.filter(item => selectedCatalogUrls.includes(item.url));

    try {
      const res = await apiFetch('/api/admin/jobs', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          items: itemsToImport,
          chaptersCount: catalogChaptersCount,
          publishStatus: catalogPublishStatus,
          params: {
            autoChaptersCount: catalogChaptersCount,
            publishStatus: catalogPublishStatus
          }
        })
      });

      if (res && res.success) {
        alert('🚀 تم بدء وجدولة مهمة الاستيراد بالخلفية بنجاح!');
        fetchBackgroundJobs();
      } else {
        alert('❌ فشل بدء مهمة الاستيراد: ' + (res?.message || 'خطأ غير معروف'));
      }
    } catch (err: any) {
      alert('❌ خطأ في الاتصال بالخادم: ' + err.message);
    }
  };

  const handlePauseJob = async (jobId: string) => {
    try {
      const res = await apiFetch(`/api/admin/jobs/${jobId}/pause`, { method: 'POST' });
      if (res && res.success) {
        fetchBackgroundJobs();
      } else {
        alert('❌ فشل إيقاف المهمة مؤقتاً: ' + (res?.message || 'خطأ غير معروف'));
      }
    } catch (err: any) {
      alert('❌ خطأ: ' + err.message);
    }
  };

  const handleResumeJob = async (jobId: string) => {
    try {
      const res = await apiFetch(`/api/admin/jobs/${jobId}/resume`, { method: 'POST' });
      if (res && res.success) {
        fetchBackgroundJobs();
      } else {
        alert('❌ فشل استئناف المهمة: ' + (res?.message || 'خطأ غير معروف'));
      }
    } catch (err: any) {
      alert('❌ خطأ: ' + err.message);
    }
  };

  const handleStopJob = async (jobId: string) => {
    if (!confirm('هل أنت متأكد من رغبتك في إيقاف وإلغاء هذه المهمة بالكامل؟')) return;
    try {
      const res = await apiFetch(`/api/admin/jobs/${jobId}/stop`, { method: 'POST' });
      if (res && res.success) {
        fetchBackgroundJobs();
      } else {
        alert('❌ فشل إيقاف المهمة: ' + (res?.message || 'خطأ غير معروف'));
      }
    } catch (err: any) {
      alert('❌ خطأ: ' + err.message);
    }
  };

  const handleDeleteJob = async (jobId: string) => {
    if (!confirm('هل تريد مسح سجل هذه المهمة من اللوحة؟')) return;
    try {
      const res = await apiFetch(`/api/admin/jobs/${jobId}`, { method: 'DELETE' });
      if (res && res.success) {
        fetchBackgroundJobs();
      } else {
        alert('❌ فشل حذف المهمة: ' + (res?.message || 'خطأ غير معروف'));
      }
    } catch (err: any) {
      alert('❌ خطأ: ' + err.message);
    }
  };



  // Series Actions
  const handleAddSeries = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const finalAlts = seriesForm.alternativeTitles?.trim() 
        ? seriesForm.alternativeTitles 
        : generateSeoAlternativeTitles(seriesForm.titleAr, seriesForm.titleEn, seriesForm.type);

      await apiFetch('/api/admin/series', {
        method: 'POST',
        body: JSON.stringify({
          ...seriesForm,
          alternativeTitles: finalAlts
        })
      });
      alert('✅ تم إضافة العمل الجديد بنجاح وجاري نشره على المنصة!');
      setShowAddSeries(false);
      setSeriesForm({
        titleAr: '', titleEn: '', alternativeTitles: '', descriptionAr: '', descriptionEn: '',
        coverUrl: '', bannerUrl: '', author: '', artist: '', status: 'ongoing', genres: [],
        type: 'manhwa', ageRating: 'All', releaseYear: '', translator: ''
      });
      fetchAdminData();
      onRefreshDatabase();
    } catch (err: any) {
      alert(err.message);
    }
  };

  const handleUpdateSeries = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingSeries) return;
    try {
      const finalAlts = editingSeries.alternativeTitles?.trim()
        ? editingSeries.alternativeTitles
        : generateSeoAlternativeTitles(editingSeries.titleAr, editingSeries.titleEn, editingSeries.type);

      await apiFetch(`/api/admin/series/${editingSeries.id}`, {
        method: 'PUT',
        body: JSON.stringify({
          ...editingSeries,
          alternativeTitles: finalAlts
        })
      });
      alert('✅ تم تحديث بيانات العمل بنجاح!');
      setEditingSeries(null);
      fetchAdminData();
      onRefreshDatabase();
    } catch (err: any) {
      alert(err.message);
    }
  };

  const handleDeleteSeries = (series: Series) => {
    setSeriesToDelete(series);
    setDeleteConfirmName('');
  };

  const handleExecuteDeleteSeries = async () => {
    if (!seriesToDelete) return;
    if (deleteConfirmName !== seriesToDelete.titleAr && deleteConfirmName !== 'DELETE') {
      alert('⚠️ يرجى كتابة اسم العمل بشكل صحيح أو كلمة "DELETE" لتأكيد عملية الحذف المطبق!');
      return;
    }

    setIsDeletingSeries(true);
    try {
      await apiFetch(`/api/admin/series/${seriesToDelete.id}`, { method: 'DELETE' });
      alert(`🗑️ تم إبادة وحذف العمل "${seriesToDelete.titleAr}" وكافة الفصول والتعليقات والتقييمات المرتبطة به نهائياً وبكل احترافية!`);
      setSeriesToDelete(null);
      fetchAdminData();
      onRefreshDatabase();
    } catch (err: any) {
      alert('حدث خطأ أثناء حذف العمل: ' + err.message);
    } finally {
      setIsDeletingSeries(false);
    }
  };

  const handleExecuteDeleteAllSeries = async () => {
    if (deleteAllConfirmInput !== 'DELETE_ALL') {
      alert('⚠️ يرجى كتابة الكلمة التأكيدية "DELETE_ALL" بدقة لحذف كل الأعمال!');
      return;
    }

    setIsDeletingAllSeries(true);
    try {
      await apiFetch('/api/admin/series-all/delete-all', { method: 'DELETE' });
      alert('🗑️ تم إبادة وحذف جميع الأعمال وكافة الفصول والتعليقات والبيانات المرتبطة بها بالكامل بنجاح!');
      setShowDeleteAllConfirm(false);
      setDeleteAllConfirmInput('');
      fetchAdminData();
      if (onRefreshDatabase) onRefreshDatabase();
    } catch (err: any) {
      alert('حدث خطأ أثناء حذف جميع الأعمال: ' + err.message);
    } finally {
      setIsDeletingAllSeries(false);
    }
  };

  // Chapter Upload Mocking and Action
  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setDragging(true);
  };

  const handleDragLeave = () => {
    setDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragging(false);
    
    // Simulate reading files
    setIsUploading(true);
    setUploadProgress(0);

    const interval = setInterval(() => {
      setUploadProgress(prev => {
        if (prev >= 100) {
          clearInterval(interval);
          setIsUploading(false);
          // Generate 6 sample beautiful page image links
          const mockPages = [
            'https://picsum.photos/seed/page_u1/800/1200',
            'https://picsum.photos/seed/page_u2/800/1200',
            'https://picsum.photos/seed/page_u3/800/1200',
            'https://picsum.photos/seed/page_u4/800/1200',
            'https://picsum.photos/seed/page_u5/800/1200',
            'https://picsum.photos/seed/page_u6/800/1200',
          ];
          setUploadedPages(mockPages);
          return 100;
        }
        return prev + 20;
      });
    }, 300);
  };

  const handlePublishChapter = async () => {
    if (!uploadSeriesId || !uploadChapterNumber || uploadedPages.length === 0) {
      alert('❌ يرجى اختيار العمل، كتابة رقم الفصل، وسحب مجلد الصور أولاً');
      return;
    }

    try {
      await apiFetch('/api/admin/chapters', {
        method: 'POST',
        body: JSON.stringify({
          seriesId: uploadSeriesId,
          number: Number(uploadChapterNumber),
          titleAr: uploadChapterTitleAr || `الفصل ${uploadChapterNumber}`,
          titleEn: uploadChapterTitleEn || `Chapter ${uploadChapterNumber}`,
          pages: uploadedPages,
          translatorName: uploadTranslatorName,
          status: uploadChapterStatus,
          releaseNote: uploadReleaseNote
        })
      });

      alert('🎉 تم نشر الفصل الجديد بالنجاح وتم إرسال إشعارات فورية لكل المشتركين!');
      setUploadSeriesId('');
      setUploadChapterNumber('');
      setUploadChapterTitleAr('');
      setUploadChapterTitleEn('');
      setUploadTranslatorName('');
      setUploadChapterStatus('published');
      setUploadReleaseNote('');
      setBulkUrls('');
      setUploadedPages([]);
      fetchAdminData();
      onRefreshDatabase();
    } catch (err: any) {
      alert(err.message);
    }
  };

  const handleToggleAd = async (id: string, active: boolean) => {
    try {
      await apiFetch(`/api/admin/ads/${id}`, {
        method: 'PUT',
        body: JSON.stringify({ active })
      });
      fetchAdminData();
    } catch (err: any) {
      alert(err.message);
    }
  };

  const handleUpdateAd = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingAd) return;
    try {
      await apiFetch(`/api/admin/ads/${editingAd.id}`, {
        method: 'PUT',
        body: JSON.stringify({
          name: editingAd.name,
          position: editingAd.position,
          active: editingAd.active,
          code: editingAd.code
        })
      });
      alert('✅ تم تحديث مساحة الإعلانات بنجاح!');
      setEditingAd(null);
      fetchAdminData();
    } catch (err: any) {
      alert(err.message);
    }
  };

  const handleResetAds = async () => {
    if (!confirm('هل تريد استعادة ودمج جميع المساحات الإعلانية الافتراضية المتقدمة (Popunder, Interstitial, Social Bar, Sticky Banner, In-Page Push, Native, etc.)؟')) return;
    try {
      await apiFetch('/api/admin/ads/reset-defaults', { method: 'POST' });
      alert('🎉 تم استعادة جميع المساحات الإعلانية الافتراضية بنجاح!');
      fetchAdminData();
    } catch (err: any) {
      alert(err.message || 'فشل استعادة الإعلانات الافتراضية');
    }
  };

  const handleToggleGlobalAds = async () => {
    if (!siteSettings) return;
    const nextStatus = siteSettings.globalAdsEnabled === false ? true : false;
    try {
      const res = await apiFetch('/api/admin/settings', {
        method: 'PUT',
        body: JSON.stringify({
          ...siteSettings,
          globalAdsEnabled: nextStatus
        })
      });
      setSiteSettings(res.settings);
      window.dispatchEvent(new Event('ads_changed'));
      alert(nextStatus ? '🎉 تم تفعيل جميع الإعلانات في الموقع بنجاح!' : '🛑 تم إيقاف وتعطيل جميع الإعلانات مؤقتاً في كامل الموقع!');
    } catch (err: any) {
      alert(err.message || 'حدث خطأ أثناء تغيير حالة الإعلانات');
    }
  };

  const handleResolveReport = async (id: string) => {
    try {
      await apiFetch(`/api/admin/reports/${id}/resolve`, { method: 'PUT' });
      alert('✅ تم حل البلاغ وإشعار المستخدم المعني بنجاح!');
      fetchAdminData();
    } catch (err: any) {
      alert(err.message);
    }
  };

  const handleImportSeriesData = async () => {
    if (!seriesImportUrl) {
      alert('يرجى إدخال رابط العمل المستهدف أولاً!');
      return;
    }
    setIsImportingSeries(true);
    try {
      const res = await apiFetch('/api/admin/import-external', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ url: seriesImportUrl, type: 'series' })
      });

      if (res.success && res.series) {
        const generatedAlts = generateSeoAlternativeTitles(
          res.series.titleAr || '',
          res.series.titleEn || '',
          seriesForm.type
        );
        setSeriesForm(prev => ({
          ...prev,
          titleAr: res.series.titleAr || prev.titleAr,
          titleEn: res.series.titleEn || prev.titleEn,
          descriptionAr: res.series.descriptionAr || prev.descriptionAr,
          coverUrl: res.series.coverUrl || prev.coverUrl,
          author: res.series.author || prev.author,
          artist: res.series.artist || prev.artist,
          genres: res.series.genres && res.series.genres.length > 0 ? res.series.genres : prev.genres,
          alternativeTitles: generatedAlts
        }));
        alert('✅ تم جلب وتعبئة بيانات العمل وتوليد العناوين البديلة للـ SEO بنجاح! يرجى مراجعتها وتأكيد حفظ العمل.');
      } else {
        alert(res.message || 'فشل في سحب البيانات تلقائياً. يرجى ملء الخانات يدوياً.');
      }
    } catch (err: any) {
      alert('حدث خطأ أثناء جلب البيانات: ' + err.message);
    } finally {
      setIsImportingSeries(false);
    }
  };

  const handleImportChapterData = async () => {
    if (!chapterImportUrl) {
      alert('يرجى إدخال رابط الفصل أولاً!');
      return;
    }
    setIsImportingChapter(true);
    setCloudflareBlockedChapter(false);
    try {
      const res = await apiFetch('/api/admin/import-external', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ url: chapterImportUrl, type: 'chapter' })
      });

      if (res.success) {
        if (res.isSeriesPage) {
          setScrapedChapters(res.chapters || []);
          alert(res.message);
        } else if (res.pages && res.pages.length > 0) {
          setUploadedPages(res.pages);
          setUploadChapterNumber(res.chapterNumber || '');
          setUploadChapterTitleAr(res.titleAr || '');
          setUploadChapterTitleEn(res.titleEn || '');
          setBulkUrls(res.pages.join('\n'));
          setScrapedChapters([]);
          alert(`✅ تم جلب الفصل بنجاح! تم العثور على ${res.pages.length} صفحة صورة وتعبئتها في قائمة الروابط.`);
        }
      } else if (res.cloudflareBlocked) {
        setCloudflareBlockedChapter(true);
        if (res.isSeriesPage) {
          alert(res.message);
        }
      } else {
        alert(res.message || 'تعذر سحب الفصل تلقائياً.');
      }
    } catch (err: any) {
      alert('حدث خطأ أثناء الاتصال بالخادم: ' + err.message);
    } finally {
      setIsImportingChapter(false);
    }
  };

  const handleBackup = async () => {
    try {
      const res = await apiFetch('/api/admin/backup', { method: 'POST' });
      setBackupString(res.backup);
      alert('💾 تم إنتاج نسخة احتياطية مشفرة بنجاح! انسخ النص من الحقل التالي.');
    } catch (err: any) {
      alert(err.message);
    }
  };

  const handleRestore = async () => {
    if (!restoreString.trim()) {
      alert('❌ يرجى لصق نص النسخة الاحتياطية أولاً');
      return;
    }
    try {
      await apiFetch('/api/admin/restore', {
        method: 'POST',
        body: JSON.stringify({ backup: restoreString })
      });
      alert('🔄 تم استعادة قاعدة البيانات بالكامل بنجاح!');
      setRestoreString('');
      fetchAdminData();
      onRefreshDatabase();
    } catch (err: any) {
      alert(err.message);
    }
  };

  return (
    <div className="space-y-10 pb-16" dir="rtl">
      
      {/* 1. ADMIN PANEL HEAD PANEL */}
      <div className="bg-obsidian-950 p-6 md:p-8 rounded-3xl border border-obsidian-850 shadow-xl flex flex-col md:flex-row items-center justify-between gap-6">
        <div className="space-y-1.5 text-center md:text-right">
          <h1 className="text-xl md:text-3xl font-black text-white flex items-center justify-center md:justify-start gap-2 font-sans">
            <Sliders className="w-8 h-8 text-crimson-600" /> لوحة الإدارة والتحكم الفاخرة
          </h1>
          <p className="text-xs text-neutral-400">
            أهلاً بك يا <strong className="text-crimson-500">{currentUser.username}</strong>. راقب الإحصائيات، تحكم بالروايات، انشر الفصول وراجع البلاغات.
          </p>
        </div>
        <button 
          onClick={() => onNavigate('home')}
          className="bg-obsidian-900 border border-obsidian-800 text-neutral-300 hover:text-white px-5 py-2.5 rounded-xl text-xs font-bold cursor-pointer transition-colors"
        >
          معاينة واجهة الموقع الرئيسية
        </button>
      </div>

      {/* Cloud Auto-Save and Recovery Indicator */}
      <div className="bg-emerald-950/20 border border-emerald-900/30 text-emerald-400 rounded-2xl p-4 flex items-center justify-between gap-4 font-sans text-xs shadow-inner">
        <div className="flex items-center gap-2.5">
          <span className="flex h-2.5 w-2.5 relative">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
            <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-500"></span>
          </span>
          <div>
            <strong className="font-bold text-emerald-300">نظام الحفظ الذكي النشط:</strong> يتم حفظ ومزامنة قاعدة البيانات بالكامل مع ذاكرة متصفحك بشكل فوري لمنع فقدان أعمالك عند إعادة تشغيل الخادم.
          </div>
        </div>
        <div className="hidden sm:block text-emerald-500/80 font-mono text-[10px] bg-emerald-950/30 px-2.5 py-1 rounded-lg border border-emerald-900/20">
          SECURED & SYNCED
        </div>
      </div>

      {/* 2. ADMIN SIDEBAR NAVIGATION */}
      <div className="flex border-b border-obsidian-800 gap-4 overflow-x-auto pb-1 font-sans">
        {[
          { id: 'dashboard', name: 'لوحة القيادة والمؤشرات', icon: LayoutDashboard },
          { id: 'series', name: 'إدارة الأعمال (Series)', icon: FolderPlus },
          { id: 'chapters', name: 'رفع ونشر الفصول', icon: FileUp },
          { id: 'auto-import', name: 'الجالب التلقائي للفصول (2000+)', icon: Zap },
          { id: 'catalog-import', name: 'جالب الكتالوج التلقائي (1000+)', icon: Download },
          { id: 'ads', name: 'مساحات الإعلانات (AdSense)', icon: Settings },
          { id: 'reports', name: 'بلاغات ومقترحات القراء', icon: ShieldAlert },
          { id: 'logs', name: 'سجل عمليات الإدارة (Logs)', icon: FileText },
          { id: 'backup', name: 'نسخ احتياطي واستعادة', icon: Database },
        ].map(tab => {
          const Icon = tab.icon;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as any)}
              className={`flex items-center gap-2 py-3 px-4 text-xs md:text-sm font-bold border-b-2 transition-all cursor-pointer shrink-0 ${activeTab === tab.id ? 'border-crimson-600 text-crimson-500' : 'border-transparent text-neutral-500 hover:text-neutral-300'}`}
            >
              <Icon className="w-4.5 h-4.5" /> {tab.name}
            </button>
          );
        })}
      </div>

      {/* 3. CORE TAB VISUALIZER */}
      <div className="min-h-[400px]">
        <AnimatePresence mode="wait">
          <motion.div
            key={activeTab}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ duration: 0.25 }}
          >
            {/* TAB: DASHBOARD STATS */}
            {activeTab === 'dashboard' && stats && (
              <div className="space-y-8">
                {/* Stats Cards Grid */}
                <div className="grid grid-cols-2 lg:grid-cols-4 gap-6">
                  {[
                    { title: 'إجمالي الأعضاء', count: stats.usersCount, color: 'from-blue-600/10 to-blue-800/5', border: 'border-blue-950/30' },
                    { title: 'الأعمال والمانجا', count: stats.seriesCount, color: 'from-crimson-600/10 to-crimson-800/5', border: 'border-crimson-950/30' },
                    { title: 'الفصول المنشورة', count: stats.chaptersCount, color: 'from-amber-600/10 to-amber-800/5', border: 'border-amber-950/30' },
                    { title: 'إجمالي المشاهدات', count: formatNumber(stats.viewsCount), color: 'from-emerald-600/10 to-emerald-800/5', border: 'border-emerald-950/30' },
                  ].map((s, idx) => (
                    <div key={idx} className={`bg-gradient-to-br ${s.color} border ${s.border} p-6 rounded-2xl shadow-lg relative overflow-hidden`}>
                      <p className="text-xs text-neutral-400 font-bold mb-2 font-sans">{s.title}</p>
                      <p className="text-2xl md:text-3xl font-black text-white font-mono">{s.count}</p>
                    </div>
                  ))}
                </div>

                {/* Second Row stats */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                  <div className="bg-obsidian-950 border border-obsidian-850 p-6 rounded-2xl flex items-center justify-between shadow-lg">
                    <p className="text-xs font-bold text-neutral-400 font-sans">التعليقات والمناقشات</p>
                    <span className="text-xl font-black text-white font-mono">{stats.commentsCount}</span>
                  </div>
                  <div className="bg-obsidian-950 border border-obsidian-850 p-6 rounded-2xl flex items-center justify-between shadow-lg">
                    <p className="text-xs font-bold text-neutral-400 font-sans">إجمالي الإعجابات</p>
                    <span className="text-xl font-black text-crimson-500 font-mono">{formatNumber(stats.likesCount)}</span>
                  </div>
                  <div className="bg-obsidian-950 border border-obsidian-850 p-6 rounded-2xl flex items-center justify-between shadow-lg">
                    <p className="text-xs font-bold text-neutral-400 font-sans">البلاغات المعلقة</p>
                    <span className="text-xl font-black text-amber-500 font-mono">{stats.reportsCount}</span>
                  </div>
                </div>

                {/* Dashboard tips and welcome banner */}
                <div className="bg-gradient-to-r from-crimson-950/20 via-obsidian-900/50 to-obsidian-950 border border-crimson-950/50 p-6 rounded-3xl flex items-center gap-4">
                  <AlertTriangle className="w-8 h-8 text-crimson-500 shrink-0" />
                  <div className="space-y-1.5">
                    <h3 className="font-bold text-sm text-white font-sans">إرشادات الأمان وصلاحية المشرفين:</h3>
                    <p className="text-xs text-neutral-400 leading-relaxed">
                      يرجى الانتباه إلى جودة الفصول المرفوعة وتجنب روابط الصور المخالفة لحقوق الطبع والنشر لضمان حماية الموقع من بلاغات الـ DMCA المباشرة.
                    </p>
                  </div>
                </div>
              </div>
            )}

            {/* TAB: MANAGE SERIES */}
            {activeTab === 'series' && (
              <div className="space-y-6">
                {/* Actions banner */}
                <div className="flex justify-between items-center border-b border-obsidian-800 pb-4">
                  <h2 className="text-xl font-black text-white">إدارة وإدراج الأعمال المانجا</h2>
                  <div className="flex items-center gap-3">
                    <button
                      type="button"
                      onClick={() => {
                        setShowDeleteAllConfirm(true);
                        setDeleteAllConfirmInput('');
                      }}
                      className="bg-red-950/40 hover:bg-red-900/60 border border-red-900/40 text-red-400 hover:text-red-300 font-bold px-4 py-2.5 rounded-xl text-xs transition-all cursor-pointer flex items-center gap-1.5"
                    >
                      <Trash2 className="w-4.5 h-4.5" /> حذف جميع المنهوات دفعة واحدة 🗑️
                    </button>
                    <button
                      type="button"
                      onClick={() => setShowAddSeries(!showAddSeries)}
                      className="bg-crimson-600 hover:bg-crimson-500 text-white font-bold px-4 py-2.5 rounded-xl text-xs transition-all cursor-pointer flex items-center gap-1.5"
                    >
                      <Plus className="w-4.5 h-4.5" /> {showAddSeries ? 'إلغاء الإدراج' : 'إضافة عمل مانجا جديد'}
                    </button>
                  </div>
                </div>

                {/* ADD SERIES PANEL FORM */}
                {showAddSeries && (
                  <form onSubmit={handleAddSeries} className="bg-obsidian-950 border border-obsidian-850 rounded-3xl p-6 md:p-8 space-y-6">
                    <h3 className="font-extrabold text-sm text-crimson-500 font-sans">إدراج عمل جديد بالكامل</h3>
                    
                    {/* Auto-Scraper box for Series */}
                    <div className="bg-gradient-to-l from-crimson-950/20 to-neutral-900/40 border border-crimson-950/20 p-5 rounded-2xl space-y-3">
                      <div className="flex items-center gap-2">
                        <Zap className="w-5 h-5 text-crimson-500 animate-pulse shrink-0" />
                        <h4 className="font-extrabold text-xs text-white">الاستيراد التلقائي الذكي لبيانات العمل</h4>
                      </div>
                      <p className="text-[11px] text-neutral-400 leading-relaxed">
                        ألصق رابط العمل من أي موقع مانجا (مثل <b className="text-crimson-500">Manga Starz</b> أو <b className="text-crimson-500">Olympus Scans</b>) وسيقوم النظام بسحب وتعبئة الحقول بالكامل كالعنوان، الوصف، غلاف العمل، والمؤلف فوراً!
                      </p>
                      <div className="flex flex-col sm:flex-row gap-2">
                        <input
                          type="url"
                          placeholder="مثال: https://manga-starz.net/manga/solo-leveling/"
                          value={seriesImportUrl}
                          onChange={(e) => setSeriesImportUrl(e.target.value)}
                          className="flex-1 bg-obsidian-900 border border-obsidian-800 text-white px-3 py-2 rounded-xl text-xs outline-none text-left"
                          dir="ltr"
                        />
                        <button
                          type="button"
                          onClick={handleImportSeriesData}
                          disabled={isImportingSeries}
                          className="bg-crimson-600 hover:bg-crimson-500 disabled:bg-neutral-800 text-white font-bold px-4 py-2 rounded-xl text-xs transition-all cursor-pointer flex items-center justify-center gap-1 min-w-[120px]"
                        >
                          {isImportingSeries ? (
                            <>
                              <span className="border-2 border-white/20 border-t-white w-3 h-3 rounded-full animate-spin"></span>
                              <span>جاري الجلب...</span>
                            </>
                          ) : (
                            <>
                              <Zap className="w-3.5 h-3.5" />
                              <span>سحب البيانات</span>
                            </>
                          )}
                        </button>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                      <div>
                        <label className="block text-xs font-bold text-neutral-400 mb-1.5 font-sans">العنوان بالعربية (الأساسي):</label>
                        <input
                          type="text"
                          required
                          value={seriesForm.titleAr}
                          onChange={(e) => setSeriesForm({ ...seriesForm, titleAr: e.target.value })}
                          placeholder="مثال: سولو ليفيلينغ"
                          className="w-full bg-obsidian-900 border border-obsidian-800 text-white px-3 py-2.5 rounded-xl text-xs outline-none"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-bold text-neutral-400 mb-1.5 font-sans">العنوان بالإنجليزية (مهم لبناء الرابط الفريد):</label>
                        <input
                          type="text"
                          required
                          value={seriesForm.titleEn}
                          onChange={(e) => setSeriesForm({ ...seriesForm, titleEn: e.target.value })}
                          placeholder="مثال: Solo Leveling"
                          className="w-full bg-obsidian-900 border border-obsidian-800 text-white px-3 py-2.5 rounded-xl text-xs outline-none text-left"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-bold text-neutral-400 mb-1.5 font-sans">العناوين البديلة للـ SEO (تلقائية احترافية):</label>
                        <input
                          type="text"
                          value={seriesForm.alternativeTitles}
                          onChange={(e) => setSeriesForm({ ...seriesForm, alternativeTitles: e.target.value })}
                          placeholder="تترك فارغة لتوليدها تلقائياً وبشكل احترافي للـ SEO"
                          className="w-full bg-obsidian-900 border border-obsidian-800 text-white px-3 py-2.5 rounded-xl text-xs outline-none"
                        />
                        <p className="text-[10px] text-crimson-400 mt-1">✨ سيقوم النظام بتوليد قائمة كاملة من الكلمات المفتاحية تلقائياً للـ SEO.</p>
                      </div>
                      <div>
                        <label className="block text-xs font-bold text-neutral-400 mb-1.5 font-sans">نوع العمل (Type):</label>
                        <select
                          value={seriesForm.type}
                          onChange={(e) => setSeriesForm({ ...seriesForm, type: e.target.value as any })}
                          className="w-full bg-obsidian-900 border border-obsidian-800 text-white px-3 py-2.5 rounded-xl text-xs outline-none"
                        >
                          <option value="manhwa">مانهوا كورية (Manhwa)</option>
                          <option value="manga">مانجا يابانية (Manga)</option>
                          <option value="manhua">مانهوا صينية (Manhua)</option>
                          <option value="novel">رواية ويب (Web Novel)</option>
                        </select>
                      </div>
                      <div className="sm:col-span-2">
                        <label className="block text-xs font-bold text-neutral-400 mb-1.5 font-sans">رابط غلاف المانجا (Cover URL):</label>
                        <input
                          type="text"
                          required
                          value={seriesForm.coverUrl}
                          onChange={(e) => setSeriesForm({ ...seriesForm, coverUrl: e.target.value })}
                          placeholder="يمكنك استخدام صور Unsplash أو CDN"
                          className="w-full bg-obsidian-900 border border-obsidian-800 text-white px-3 py-2.5 rounded-xl text-xs outline-none text-left"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-bold text-neutral-400 mb-1.5 font-sans">رابط البانر العلوي (Banner URL):</label>
                        <input
                          type="text"
                          value={seriesForm.bannerUrl}
                          onChange={(e) => setSeriesForm({ ...seriesForm, bannerUrl: e.target.value })}
                          placeholder="رابط البانر الممدد للعمل"
                          className="w-full bg-obsidian-900 border border-obsidian-800 text-white px-3 py-2.5 rounded-xl text-xs outline-none text-left"
                        />
                      </div>
                      <div className="sm:col-span-2">
                        <label className="block text-xs font-bold text-neutral-400 mb-1.5 font-sans">قصة العمل وسيناريو الأحداث بالعربية:</label>
                        <textarea
                          value={seriesForm.descriptionAr}
                          onChange={(e) => setSeriesForm({ ...seriesForm, descriptionAr: e.target.value })}
                          className="w-full bg-obsidian-900 border border-obsidian-800 text-white p-3 rounded-xl text-xs outline-none min-h-[100px]"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-bold text-neutral-400 mb-1.5 font-sans">حالة نشر العمل:</label>
                        <select
                          value={seriesForm.status}
                          onChange={(e) => setSeriesForm({ ...seriesForm, status: e.target.value as any })}
                          className="w-full bg-obsidian-900 border border-obsidian-800 text-white px-3 py-2.5 rounded-xl text-xs outline-none"
                        >
                          <option value="ongoing">مستمر (Ongoing)</option>
                          <option value="completed">مكتمل (Completed)</option>
                          <option value="paused">متوقف (Hiatus)</option>
                          <option value="dropped">متروك (Dropped)</option>
                        </select>
                      </div>

                      {/* Genre multi-select checkbox */}
                      <div className="sm:col-span-2 space-y-2">
                        <label className="block text-xs font-bold text-neutral-400 font-sans">تصنيفات العمل المانجا (Genres):</label>
                        <div className="flex flex-wrap gap-2">
                          {genreOptions.map(g => {
                            const selected = seriesForm.genres.includes(g);
                            return (
                              <button
                                type="button"
                                key={g}
                                onClick={() => {
                                  if (selected) {
                                    setSeriesForm({ ...seriesForm, genres: seriesForm.genres.filter(item => item !== g) });
                                  } else {
                                    setSeriesForm({ ...seriesForm, genres: [...seriesForm.genres, g] });
                                  }
                                }}
                                className={`px-3 py-1.5 rounded-xl text-xs transition-all cursor-pointer ${selected ? 'bg-crimson-600 text-white font-bold' : 'bg-obsidian-900 text-neutral-400 hover:border-obsidian-800 border border-transparent'}`}
                              >
                                {g}
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    </div>

                    <button
                      type="submit"
                      className="w-full bg-crimson-600 hover:bg-crimson-500 text-white font-bold py-3 rounded-xl text-xs transition-all shadow-md cursor-pointer font-sans"
                    >
                      إتمام إضافة وحفظ العمل الجديد
                    </button>
                  </form>
                )}

                {/* EDIT WORK MODAL FORM (INLINE OVERLAY) */}
                {editingSeries && (
                  <form onSubmit={handleUpdateSeries} className="bg-obsidian-950 border border-crimson-900/30 rounded-3xl p-6 md:p-8 space-y-6">
                    <h3 className="font-extrabold text-sm text-crimson-500 font-sans">تعديل بيانات العمل: {editingSeries.titleAr}</h3>
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                      <div>
                        <label className="block text-xs font-bold text-neutral-400 mb-1.5 font-sans">العنوان بالعربية:</label>
                        <input
                          type="text"
                          required
                          value={editingSeries.titleAr}
                          onChange={(e) => setEditingSeries({ ...editingSeries, titleAr: e.target.value })}
                          className="w-full bg-obsidian-900 border border-obsidian-800 text-white px-3 py-2.5 rounded-xl text-xs outline-none"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-bold text-neutral-400 mb-1.5 font-sans">العنوان بالإنجليزية:</label>
                        <input
                          type="text"
                          required
                          value={editingSeries.titleEn}
                          onChange={(e) => setEditingSeries({ ...editingSeries, titleEn: e.target.value })}
                          className="w-full bg-obsidian-900 border border-obsidian-800 text-white px-3 py-2.5 rounded-xl text-xs outline-none text-left"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-bold text-neutral-400 mb-1.5 font-sans">العناوين البديلة للـ SEO (تلقائية احترافية):</label>
                        <input
                          type="text"
                          value={editingSeries.alternativeTitles || ''}
                          onChange={(e) => setEditingSeries({ ...editingSeries, alternativeTitles: e.target.value })}
                          placeholder="تترك فارغة لتوليدها تلقائياً وبشكل احترافي للـ SEO"
                          className="w-full bg-obsidian-900 border border-obsidian-800 text-white px-3 py-2.5 rounded-xl text-xs outline-none"
                        />
                        <p className="text-[10px] text-crimson-400 mt-1">✨ سيقوم النظام بتوليد قائمة كاملة من الكلمات المفتاحية تلقائياً للـ SEO.</p>
                      </div>
                      <div>
                        <label className="block text-xs font-bold text-neutral-400 mb-1.5 font-sans">نوع العمل (Type):</label>
                        <select
                          value={editingSeries.type || 'manhwa'}
                          onChange={(e) => setEditingSeries({ ...editingSeries, type: e.target.value as any })}
                          className="w-full bg-obsidian-900 border border-obsidian-800 text-white px-3 py-2.5 rounded-xl text-xs outline-none"
                        >
                          <option value="manhwa">مانهوا كورية (Manhwa)</option>
                          <option value="manga">مانجا يابانية (Manga)</option>
                          <option value="manhua">مانهوا صينية (Manhua)</option>
                          <option value="novel">رواية ويب (Web Novel)</option>
                        </select>
                      </div>
                      <div className="sm:col-span-2">
                        <label className="block text-xs font-bold text-neutral-400 mb-1.5 font-sans">رابط الغلاف (Cover):</label>
                        <input
                          type="text"
                          value={editingSeries.coverUrl}
                          onChange={(e) => setEditingSeries({ ...editingSeries, coverUrl: e.target.value })}
                          className="w-full bg-neutral-900 border border-neutral-800 text-white px-3 py-2.5 rounded-xl text-xs outline-none text-left"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-bold text-neutral-400 mb-1.5">حالة العمل:</label>
                        <select
                          value={editingSeries.status}
                          onChange={(e) => setEditingSeries({ ...editingSeries, status: e.target.value as any })}
                          className="w-full bg-neutral-900 border border-neutral-800 text-white px-3 py-2.5 rounded-xl text-xs outline-none"
                        >
                          <option value="ongoing">مستمر</option>
                          <option value="completed">مكتمل</option>
                          <option value="paused">متوقف</option>
                          <option value="dropped">متروك</option>
                        </select>
                      </div>
                      <div className="sm:col-span-2">
                        <label className="block text-xs font-bold text-neutral-400 mb-1.5 font-sans">قصة العمل بالعربية:</label>
                        <textarea
                          value={editingSeries.descriptionAr}
                          onChange={(e) => setEditingSeries({ ...editingSeries, descriptionAr: e.target.value })}
                          className="w-full bg-obsidian-900 border border-obsidian-800 text-white p-3 rounded-xl text-xs outline-none min-h-[100px]"
                        />
                      </div>
                      
                      {/* Genre multi-select checkbox for Editing */}
                      <div className="sm:col-span-3 space-y-2 border-t border-obsidian-800/50 pt-4">
                        <label className="block text-xs font-bold text-neutral-400 font-sans">تصنيفات العمل المانجا (Genres):</label>
                        <div className="flex flex-wrap gap-2">
                          {genreOptions.map(g => {
                            const selected = (editingSeries.genres || []).includes(g);
                            return (
                              <button
                                type="button"
                                key={g}
                                onClick={() => {
                                  const currentGenres = editingSeries.genres || [];
                                  if (selected) {
                                    setEditingSeries({ ...editingSeries, genres: currentGenres.filter(item => item !== g) });
                                  } else {
                                    setEditingSeries({ ...editingSeries, genres: [...currentGenres, g] });
                                  }
                                }}
                                className={`px-3 py-1.5 rounded-xl text-xs transition-all cursor-pointer ${selected ? 'bg-crimson-600 text-white font-bold animate-pulse-once' : 'bg-obsidian-900 text-neutral-400 hover:border-obsidian-800 border border-transparent'}`}
                              >
                                {g}
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    </div>

                    <div className="flex gap-4">
                      <button
                        type="submit"
                        className="bg-red-600 hover:bg-red-500 text-white font-bold py-2.5 px-6 rounded-xl text-xs transition-all flex-1 cursor-pointer"
                      >
                        حفظ التعديلات الحالية
                      </button>
                      <button
                        type="button"
                        onClick={() => setEditingSeries(null)}
                        className="bg-neutral-900 hover:bg-neutral-850 text-neutral-400 border border-neutral-800 py-2.5 px-6 rounded-xl text-xs transition-all cursor-pointer"
                      >
                        إلغاء
                      </button>
                    </div>
                  </form>
                )}

                {/* Series List table / Grid */}
                <div className="bg-neutral-950 border border-neutral-900 rounded-3xl p-6 shadow-md overflow-x-auto">
                  <table className="w-full text-right text-xs">
                    <thead>
                      <tr className="text-neutral-500 border-b border-neutral-850">
                        <th className="pb-3 pr-2">الغلاف والاسم بالعربية</th>
                        <th className="pb-3">الاسم بالإنجليزية</th>
                        <th className="pb-3">الحالة</th>
                        <th className="pb-3">المؤلف</th>
                        <th className="pb-3">إحصاء المشاهدات</th>
                        <th className="pb-3 pl-2 text-center">إجراءات</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-neutral-850">
                      {seriesList.map(s => (
                        <tr key={s.id} className="hover:bg-neutral-900/20">
                          <td className="py-4 pr-2 flex items-center gap-3">
                            <img src={s.coverUrl} alt={s.titleAr} referrerPolicy="no-referrer" className="w-9 h-12 object-cover rounded border border-neutral-800 shrink-0" />
                            <strong className="text-white font-bold">{s.titleAr}</strong>
                          </td>
                          <td className="py-4 text-neutral-300 font-sans">{s.titleEn}</td>
                          <td className="py-4">
                            {s.status === 'ongoing' && (
                              <span className="px-2 py-1 rounded text-[10px] font-bold bg-green-950/40 text-green-400 border border-green-500/15">مستمر</span>
                            )}
                            {s.status === 'completed' && (
                              <span className="px-2 py-1 rounded text-[10px] font-bold bg-blue-950/40 text-blue-400 border border-blue-500/15">مكتمل</span>
                            )}
                            {s.status === 'paused' && (
                              <span className="px-2 py-1 rounded text-[10px] font-bold bg-amber-950/40 text-amber-400 border border-amber-500/15">متوقف</span>
                            )}
                            {s.status === 'dropped' && (
                              <span className="px-2 py-1 rounded text-[10px] font-bold bg-rose-950/40 text-rose-400 border border-rose-500/15">متروك</span>
                            )}
                          </td>
                          <td className="py-4 text-neutral-400">{s.author}</td>
                          <td className="py-4 font-mono text-red-500">{formatNumber(s.views)}</td>
                          <td className="py-4 pl-2 text-center">
                            <div className="flex gap-2 justify-center">
                              <button
                                onClick={() => setEditingSeries(s)}
                                className="bg-neutral-900 hover:bg-neutral-800 text-neutral-300 p-2 rounded-lg cursor-pointer"
                                title="تعديل"
                              >
                                <Edit2 className="w-4 h-4" />
                              </button>
                              <button
                                onClick={() => handleDeleteSeries(s)}
                                className="bg-red-950/20 text-red-500 hover:bg-red-600 hover:text-white p-2 rounded-lg cursor-pointer"
                                title="حذف"
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* TAB: UPLOAD CHAPTERS (Drag and Drop Panels) */}
            {activeTab === 'chapters' && (
              <div className="space-y-6">
                <div className="border-b border-obsidian-800 pb-4">
                  <h2 className="text-xl font-black text-white">رفع ونشر فصول جديدة</h2>
                  <p className="text-xs text-neutral-400 mt-1">
                    اختر مانهوا مضافة، أدخل رقم الفصل، واسحب مجلد صفحات المانجا لرفعها والضغط الآلي لإنتاج الفصل.
                  </p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                  {/* Select series and chapters details form */}
                  <div className="bg-obsidian-950 border border-obsidian-850 rounded-3xl p-6 space-y-4 shadow-lg self-start">
                    <h3 className="font-bold text-sm text-white">تفاصيل الفصل المرفوع:</h3>
                    
                    <div className="space-y-4 font-sans">
                      <div>
                        <label className="block text-[11px] text-neutral-400 mb-1.5">اختر العمل المانجا المستهدف:</label>
                        <select
                          required
                          value={uploadSeriesId}
                          onChange={(e) => setUploadSeriesId(e.target.value)}
                          className="w-full bg-obsidian-900 border border-obsidian-800 text-xs text-white px-3 py-2.5 rounded-xl outline-none"
                        >
                          <option value="">-- اختر مانهوا --</option>
                          {seriesList.map(s => (
                            <option key={s.id} value={s.id}>{s.titleAr}</option>
                          ))}
                        </select>
                      </div>

                      <div>
                        <label className="block text-[11px] text-neutral-400 mb-1.5">رقم الفصل (Chapter Number):</label>
                        <input
                          type="number"
                          required
                          value={uploadChapterNumber}
                          onChange={(e) => setUploadChapterNumber(e.target.value)}
                          placeholder="مثال: 4"
                          className="w-full bg-obsidian-900 border border-obsidian-800 text-xs text-white px-3 py-2.5 rounded-xl outline-none text-left"
                        />
                      </div>

                      <div>
                        <label className="block text-[11px] text-neutral-400 mb-1.5">عنوان الفصل بالعربية (اختياري):</label>
                        <input
                          type="text"
                          value={uploadChapterTitleAr}
                          onChange={(e) => setUploadChapterTitleAr(e.target.value)}
                          placeholder="مثال: تفعيل مهارة الظل"
                          className="w-full bg-obsidian-900 border border-obsidian-800 text-xs text-white px-3 py-2.5 rounded-xl outline-none"
                        />
                      </div>

                      <div>
                        <label className="block text-[11px] text-neutral-400 mb-1.5">عنوان الفصل بالإنجليزية (اختياري):</label>
                        <input
                          type="text"
                          value={uploadChapterTitleEn}
                          onChange={(e) => setUploadChapterTitleEn(e.target.value)}
                          placeholder="مثال: Shadow Skill Unlocked"
                          className="w-full bg-obsidian-900 border border-obsidian-800 text-xs text-white px-3 py-2.5 rounded-xl outline-none text-left"
                        />
                      </div>

                      <div>
                        <label className="block text-[11px] text-neutral-400 mb-1.5">المترجم / مبيض / محرّر الفصل:</label>
                        <input
                          type="text"
                          value={uploadTranslatorName}
                          onChange={(e) => setUploadTranslatorName(e.target.value)}
                          placeholder="مثال: Darkmanhwa Team"
                          className="w-full bg-obsidian-900 border border-obsidian-800 text-xs text-white px-3 py-2.5 rounded-xl outline-none"
                        />
                      </div>

                      <div>
                        <label className="block text-[11px] text-neutral-400 mb-1.5">حالة نشر الفصل:</label>
                        <select
                          value={uploadChapterStatus}
                          onChange={(e) => setUploadChapterStatus(e.target.value as any)}
                          className="w-full bg-obsidian-900 border border-obsidian-800 text-xs text-white px-3 py-2.5 rounded-xl outline-none"
                        >
                          <option value="published">منشور فوراً (Published)</option>
                          <option value="draft">حفظ كمسودة (Draft)</option>
                        </select>
                      </div>

                      <div>
                        <label className="block text-[11px] text-neutral-400 mb-1.5">كلمة أو ملاحظة المترجم للفصل (تظهر للقراء):</label>
                        <textarea
                          value={uploadReleaseNote}
                          onChange={(e) => setUploadReleaseNote(e.target.value)}
                          placeholder="اكتب هنا ترحيباً بالزوار أو ملاحظة بخصوص الترجمة..."
                          className="w-full bg-obsidian-900 border border-obsidian-800 text-xs text-white p-3 rounded-xl outline-none min-h-[80px]"
                        />
                      </div>
                    </div>
                  </div>

                  {/* Drag and Drop & URL pasting block */}
                  <div className="md:col-span-2 space-y-6">
                    {/* Auto-Chapter Scraper box */}
                    <div className="bg-gradient-to-l from-crimson-950/20 to-neutral-900/40 border border-crimson-950/20 p-5 rounded-3xl space-y-3 font-sans text-right">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <Zap className="w-5 h-5 text-crimson-500 animate-pulse shrink-0" />
                          <h4 className="font-extrabold text-xs text-white">الساحب الفوري للمانجا والفصول (Manga & Chapter Scraper)</h4>
                        </div>
                        <span className="text-[9px] bg-crimson-950 border border-crimson-800 text-crimson-400 px-2 py-0.5 rounded font-bold">
                          ذكي وتلقائي
                        </span>
                      </div>
                      
                      <p className="text-[11px] text-neutral-400 leading-relaxed">
                        أدخل رابط أي فصل من مواقع المانجا مثل <span className="text-crimson-500 font-bold">Manga Starz</span> أو <span className="text-crimson-500 font-bold">Olympus Scans</span> وسيقوم النظام بسحب كافة صور الصفحات وأرقام الفصل تلقائياً وبسرعة فائقة!
                      </p>

                      <div className="flex flex-col sm:flex-row gap-2">
                        <input
                          type="url"
                          placeholder="مثال: https://manga-starz.net/manga/solo-leveling/chapter-179/"
                          value={chapterImportUrl}
                          onChange={(e) => setChapterImportUrl(e.target.value)}
                          className="flex-1 bg-obsidian-900 border border-obsidian-800 text-white px-3 py-2 rounded-xl text-xs outline-none text-left font-mono"
                          dir="ltr"
                        />
                        <button
                          type="button"
                          onClick={handleImportChapterData}
                          disabled={isImportingChapter}
                          className="bg-crimson-600 hover:bg-crimson-500 disabled:bg-neutral-800 text-white font-bold px-4 py-2 rounded-xl text-xs transition-all cursor-pointer flex items-center justify-center gap-1 min-w-[120px]"
                        >
                          {isImportingChapter ? (
                            <>
                              <span className="border-2 border-white/20 border-t-white w-3 h-3 rounded-full animate-spin"></span>
                              <span>جاري الجلب...</span>
                            </>
                          ) : (
                            <>
                              <Zap className="w-3.5 h-3.5" />
                              <span>جلب الفصل</span>
                            </>
                          )}
                        </button>
                      </div>

                      {/* Scraped Chapters List */}
                      {scrapedChapters.length > 0 && (
                        <div className="mt-4 p-5 bg-crimson-950/10 border border-crimson-900/20 rounded-2xl space-y-4 text-right">
                          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-obsidian-800 pb-3">
                            <div className="flex items-center gap-2">
                              <Zap className="w-4 h-4 text-crimson-500 animate-pulse" />
                              <span className="text-xs font-black text-white">الفصول المكتشفة في هذا العمل ({scrapedChapters.length} فصل):</span>
                            </div>
                            
                            {/* Quick Select Actions */}
                            <div className="flex flex-wrap gap-1.5 justify-start sm:justify-end">
                              <button
                                type="button"
                                onClick={() => setSelectedChaptersForBulk(scrapedChapters.map(c => c.number))}
                                className="bg-obsidian-900 hover:bg-obsidian-800 text-[10px] text-neutral-300 px-2 py-1 rounded-lg border border-obsidian-850 cursor-pointer"
                              >
                                تحديد الكل
                              </button>
                              <button
                                type="button"
                                onClick={() => setSelectedChaptersForBulk([])}
                                className="bg-obsidian-900 hover:bg-obsidian-800 text-[10px] text-neutral-300 px-2 py-1 rounded-lg border border-obsidian-850 cursor-pointer"
                              >
                                إلغاء التحديد
                              </button>
                              <button
                                type="button"
                                onClick={() => {
                                  const newOnly = scrapedChapters
                                    .filter(c => !existingChapterNumbers.includes(Number(c.number)))
                                    .map(c => c.number);
                                  setSelectedChaptersForBulk(newOnly);
                                }}
                                className="bg-crimson-950/40 hover:bg-crimson-900/30 text-[10px] text-crimson-400 px-2.5 py-1 rounded-lg border border-crimson-900/30 font-bold cursor-pointer"
                              >
                                تحديد الفصول غير المتوفرة فقط ✨
                              </button>
                            </div>
                          </div>

                          {/* Bulk Import Progress Panel */}
                          {bulkImportProgress && (
                            <div className="p-4 bg-black/50 border border-obsidian-800 rounded-xl space-y-3">
                              <div className="flex justify-between items-center text-xs">
                                <span className="text-crimson-400 font-bold">جاري استيراد الفصول تلقائياً...</span>
                                <span className="text-neutral-400 font-mono font-bold">
                                  {bulkImportProgress.current} / {bulkImportProgress.total} ({Math.round((bulkImportProgress.current / bulkImportProgress.total) * 100)}%)
                                </span>
                              </div>
                              <div className="w-full bg-obsidian-900 h-2 rounded-full overflow-hidden">
                                <div 
                                  className="bg-gradient-to-r from-crimson-600 to-amber-500 h-full transition-all duration-300"
                                  style={{ width: `${(bulkImportProgress.current / bulkImportProgress.total) * 100}%` }}
                                />
                              </div>
                              <div className="bg-obsidian-950/80 p-3 rounded-lg border border-obsidian-900 h-28 overflow-y-auto font-mono text-[10px] text-left text-neutral-300 space-y-1 scrollbar-thin scrollbar-thumb-obsidian-800" dir="ltr">
                                {bulkImportProgress.log.map((line, idx) => (
                                  <div key={idx} className={line.startsWith('✅') ? 'text-green-400' : line.startsWith('❌') ? 'text-red-400' : 'text-neutral-400'}>
                                    {line}
                                  </div>
                                ))}
                              </div>
                              {bulkImportProgress.current === bulkImportProgress.total && (
                                <button
                                  type="button"
                                  onClick={() => setBulkImportProgress(null)}
                                  className="w-full bg-green-950/40 hover:bg-green-900/30 text-green-400 text-[11px] font-bold py-1.5 rounded-lg border border-green-900/30 cursor-pointer"
                                >
                                  إغلاق سجل العمليات
                                </button>
                              )}
                            </div>
                          )}

                          {/* Bulk Action Trigger */}
                          {selectedChaptersForBulk.length > 0 && (
                            <div className="flex items-center justify-between p-3 bg-crimson-950/20 border border-crimson-900/30 rounded-xl">
                              <span className="text-xs text-neutral-300">
                                لقد قمت بتحديد <strong className="text-crimson-400 font-mono">{selectedChaptersForBulk.length}</strong> فصل للاستيراد الجماعي التلقائي.
                              </span>
                              <button
                                type="button"
                                onClick={handleBulkImportSelected}
                                className="bg-gradient-to-r from-crimson-600 to-amber-600 hover:from-crimson-500 hover:to-amber-500 text-white font-bold px-4 py-2 rounded-xl text-xs transition-all shadow-md cursor-pointer flex items-center gap-1.5"
                              >
                                <Play className="w-3.5 h-3.5" />
                                <span>بدء الاستيراد الجماعي التلقائي للفصول</span>
                              </button>
                            </div>
                          )}

                          {/* Chapters Grid */}
                          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2.5 max-h-[300px] overflow-y-auto pr-1">
                            {scrapedChapters.map((ch, idx) => {
                              const isExisting = existingChapterNumbers.includes(Number(ch.number));
                              const isSelected = selectedChaptersForBulk.includes(ch.number);
                              const importStatus = importingChaptersMap[ch.number];

                              return (
                                <div
                                  key={idx}
                                  className={`flex items-center justify-between p-2.5 bg-obsidian-900/60 hover:bg-obsidian-900 border rounded-xl transition-all ${isSelected ? 'border-crimson-900 bg-crimson-950/5' : 'border-obsidian-850'}`}
                                >
                                  <div className="flex items-center gap-2 truncate">
                                    {/* Selection Checkbox */}
                                    <button
                                      type="button"
                                      onClick={() => {
                                        if (isSelected) {
                                          setSelectedChaptersForBulk(prev => prev.filter(n => n !== ch.number));
                                        } else {
                                          setSelectedChaptersForBulk(prev => [...prev, ch.number]);
                                        }
                                      }}
                                      className="text-neutral-500 hover:text-crimson-500 transition-colors shrink-0 cursor-pointer"
                                    >
                                      {isSelected ? (
                                        <CheckSquare className="w-4 h-4 text-crimson-500" />
                                      ) : (
                                        <Square className="w-4 h-4 text-neutral-600" />
                                      )}
                                    </button>

                                    {/* Chapter Info */}
                                    <div className="text-right truncate space-y-0.5">
                                      <div className="flex items-center gap-1.5">
                                        <span className="font-mono font-black text-xs text-white">#{ch.number}</span>
                                        <span className="text-[11px] text-neutral-300 truncate" title={ch.title}>
                                          {ch.title.replace(/(الفصل|chapter|chap|ch|الشابتر|فصل)\s*\d+(\.\d+)?/i, '').trim() || 'فصل بدون عنوان'}
                                        </span>
                                      </div>
                                      <div className="flex items-center gap-1.5">
                                        {/* Status badges */}
                                        {importStatus === 'loading' ? (
                                          <span className="text-[9px] text-amber-400 flex items-center gap-0.5 font-bold">
                                            <Loader2 className="w-2.5 h-2.5 animate-spin" /> جاري الجلب...
                                          </span>
                                        ) : importStatus === 'success' ? (
                                          <span className="text-[9px] text-green-400 flex items-center gap-0.5 font-bold">
                                            <Check className="w-2.5 h-2.5" /> تم الاستيراد
                                          </span>
                                        ) : importStatus === 'error' ? (
                                          <span className="text-[9px] text-red-400 flex items-center gap-0.5 font-bold">
                                            <XCircle className="w-2.5 h-2.5" /> فشل الجلب
                                          </span>
                                        ) : isExisting ? (
                                          <span className="text-[9px] bg-green-950/40 text-green-400 border border-green-950 px-1.5 py-0.5 rounded font-medium">
                                            ✓ متوفر بموقعك
                                          </span>
                                        ) : (
                                          <span className="text-[9px] bg-crimson-950/40 text-crimson-400 border border-crimson-950 px-1.5 py-0.5 rounded font-medium">
                                            🆕 جديد
                                          </span>
                                        )}
                                      </div>
                                    </div>
                                  </div>

                                  {/* Quick Actions */}
                                  <div className="flex items-center gap-1 shrink-0">
                                    {/* Run Manual Scrape set */}
                                    <button
                                      type="button"
                                      onClick={() => {
                                        setChapterImportUrl(ch.url);
                                        // Auto scroll down to direct paste or let them click
                                        alert(`📥 تم تحديد "${ch.title}". انقر على زر "جلب الفصل" بالأعلى لقراءته يدوياً.`);
                                      }}
                                      className="bg-obsidian-950 hover:bg-obsidian-800 text-neutral-400 hover:text-white p-1.5 rounded-lg border border-obsidian-850 text-[10px] transition-all cursor-pointer"
                                      title="تحديد لقراءة الرابط يدوياً"
                                    >
                                      يدوي
                                    </button>

                                    {/* Smart Auto-import Trigger */}
                                    <button
                                      type="button"
                                      disabled={importStatus === 'loading'}
                                      onClick={() => handleAutoImportAndPublish(ch)}
                                      className="bg-crimson-600/10 hover:bg-crimson-600 text-crimson-400 hover:text-white p-1.5 rounded-lg border border-crimson-900/30 hover:border-crimson-500 text-[10px] font-bold transition-all cursor-pointer"
                                      title="استيراد وتنزيل تلقائي ونشر في ثانية واحدة!"
                                    >
                                      جلب تلقائي 🚀
                                    </button>
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      )}

                      {/* Cloudflare blocked assistance / Smart Manual Extractor */}
                      {cloudflareBlockedChapter && (
                        <div className="mt-4 p-4 bg-yellow-950/20 border border-yellow-800/40 rounded-2xl space-y-3">
                          <div className="flex items-center gap-1.5 text-yellow-500 text-xs font-extrabold">
                            <AlertTriangle className="w-4 h-4 shrink-0" />
                            <span>مساعد جلب الصفحات الآمن (تخطي حماية Cloudflare):</span>
                          </div>
                          
                          <p className="text-[11px] text-neutral-300 leading-relaxed">
                            الموقع المستهدف محمي بنظام جدار ناري يمنع السيرفرات من الاتصال المباشر. 
                            ولكن لا تقلق! قمنا بابتكار كود ذكي يمكنك نسخه ولصقه في متصفحك لاستخراج صفحات الفصل بضغطة زر واحدة:
                          </p>

                          <div className="space-y-2">
                            <div className="flex items-center justify-between text-[10px] text-neutral-400">
                              <span>الخطوات: (1) افتح الفصل في المتصفح ⇠ (2) اضغط F12 ⇠ (3) اختر Console ⇠ (4) الصق الكود واضغط Enter ⇠ (5) انسخ النتيجة والصقها أدناه!</span>
                            </div>

                            <div className="relative bg-black/60 p-3 rounded-xl border border-neutral-800 text-[10px] font-mono text-left text-neutral-300 overflow-x-auto max-h-[100px]">
                              <code>
                                {`const urls = Array.from(document.querySelectorAll('.wp-manga-chapter-img, .page-break img, .chapter-content img, .reader-area img, .reader-image img, #readerarea img, .read-container img, .chapter-video-frame img, .manga-reader-img img, img')).map(img => img.src || img.dataset.src || img.dataset.lazySrc || img.dataset.cdnSrc || img.getAttribute('src')).filter(s => s && s.startsWith('http') && !s.includes('logo') && !s.includes('avatar') && !s.includes('banner') && !s.includes('icon')); copy(urls.join('\\n')); console.log('🎉 Extracted ' + urls.length + ' page URLs!');`}
                              </code>
                              <button
                                type="button"
                                onClick={() => {
                                  const code = `const urls = Array.from(document.querySelectorAll('.wp-manga-chapter-img, .page-break img, .chapter-content img, .reader-area img, .reader-image img, #readerarea img, .read-container img, .chapter-video-frame img, .manga-reader-img img, img')).map(img => img.src || img.dataset.src || img.dataset.lazySrc || img.dataset.cdnSrc || img.getAttribute('src')).filter(s => s && s.startsWith('http') && !s.includes('logo') && !s.includes('avatar') && !s.includes('banner') && !s.includes('icon') && !s.includes('profile') && !s.includes('theme') && !s.includes('widget'));
if (urls.length === 0) {
  alert('❌ عذراً، لم يتم العثور على أي صور مناسبة لقراءة الفصل في هذه الصفحة. يرجى التأكد من أنك بداخل صفحة قارئ الفصول.');
} else {
  copy(urls.join('\\n'));
  const div = document.createElement('div');
  div.style.position = 'fixed';
  div.style.top = '20px';
  div.style.left = '50%';
  div.style.transform = 'translateX(-50%)';
  div.style.backgroundColor = '#10B981';
  div.style.color = '#fff';
  div.style.padding = '18px 28px';
  div.style.borderRadius = '16px';
  div.style.fontSize = '15px';
  div.style.fontWeight = 'bold';
  div.style.zIndex = '999999';
  div.style.boxShadow = '0 15px 30px rgba(0,0,0,0.5)';
  div.style.textAlign = 'center';
  div.style.direction = 'rtl';
  div.style.border = '1px solid rgba(255,255,255,0.2)';
  div.style.fontFamily = 'sans-serif';
  div.innerHTML = '🎉 تم استخراج ونسخ ' + urls.length + ' رابط صورة للفصل بنجاح من المتصفح!\\n<br><span style="font-size:12px; font-weight:normal; opacity:0.9;">يمكنك الآن الرجوع لموقعك ولصق الروابط مباشرة في قائمة الروابط!</span>';
  document.body.appendChild(div);
  setTimeout(() => div.remove(), 6000);
}`;
                                  navigator.clipboard.writeText(code);
                                  alert('📋 تم نسخ كود الاستخراج فائق الاحترافية! افتح صفحة الفصل في موقع المانجا الآخر، ثم اضغط F12، اختر كونسول (Console) والصق الكود واضغط Enter!');
                                }}
                                className="absolute top-2 right-2 bg-neutral-900 hover:bg-neutral-800 text-neutral-400 hover:text-white p-1 rounded-lg border border-neutral-800 transition-all cursor-pointer"
                                title="نسخ الكود"
                              >
                                <Copy className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          </div>
                        </div>
                      )}
                    </div>

                    {/* Select upload method tabs */}
                    <div className="bg-obsidian-950 border border-obsidian-850 p-2 rounded-2xl flex gap-2 font-sans">
                      <button
                        type="button"
                        onClick={() => setUploadMethod('files')}
                        className={`flex-1 py-2 text-xs font-bold rounded-xl transition-all ${uploadMethod === 'files' ? 'bg-crimson-600 text-white' : 'text-neutral-400 hover:text-white'}`}
                      >
                        رفع الصور السحابي (محاكاة)
                      </button>
                      <button
                        type="button"
                        onClick={() => setUploadMethod('urls')}
                        className={`flex-1 py-2 text-xs font-bold rounded-xl transition-all ${uploadMethod === 'urls' ? 'bg-crimson-600 text-white' : 'text-neutral-400 hover:text-white'}`}
                      >
                        لصق روابط الصور المباشرة (احترافي وسريع)
                      </button>
                    </div>

                    {uploadMethod === 'files' ? (
                      <div
                        onDragOver={handleDragOver}
                        onDragLeave={handleDragLeave}
                        onDrop={handleDrop}
                        className={`h-64 border-2 border-dashed rounded-3xl flex flex-col items-center justify-center p-8 text-center transition-all ${dragging ? 'border-crimson-600 bg-crimson-950/10' : 'border-obsidian-800 bg-obsidian-950/60'}`}
                      >
                        <UploadCloud className="w-16 h-16 text-neutral-600 mb-4 animate-bounce" />
                        <h4 className="font-extrabold text-sm text-white mb-2 font-sans">اسحب مجلد الصور أو الملفات بالكامل هنا</h4>
                        <p className="text-xs text-neutral-500 leading-relaxed mb-4">
                          يدعم رفع ملفات المجلد التي تملك امتدادات JPG, PNG, WEBP وترتيبها تلقائياً حسب الاسم.
                        </p>

                        <input
                          type="file"
                          multiple
                          id="folder-input"
                          className="hidden"
                          onChange={() => {
                            // Trigger standard mock loading
                            setIsUploading(true);
                            setUploadProgress(10);
                            const interval = setInterval(() => {
                              setUploadProgress(prev => {
                                  if (prev >= 100) {
                                    clearInterval(interval);
                                    setIsUploading(false);
                                    setUploadedPages([
                                      'https://images.unsplash.com/photo-1607604276583-eef5d076aa5f?auto=format&fit=crop&w=800&h=1200&q=80',
                                      'https://images.unsplash.com/photo-1578632767115-351597cf2477?auto=format&fit=crop&w=800&h=1200&q=80',
                                      'https://images.unsplash.com/photo-1541701494587-cb58502866ab?auto=format&fit=crop&w=800&h=1200&q=80',
                                      'https://images.unsplash.com/photo-1518709268805-4e9042af9f23?auto=format&fit=crop&w=800&h=1200&q=80',
                                    ]);
                                    return 100;
                                  }
                                  return prev + 25;
                                });
                              }, 250);
                          }}
                        />
                        <label
                          htmlFor="folder-input"
                          className="bg-obsidian-900 hover:bg-obsidian-800 text-white text-xs px-6 py-3 rounded-xl border border-obsidian-800 hover:border-obsidian-700 transition-colors cursor-pointer font-sans"
                        >
                          أو تصفح الملفات يدوياً
                        </label>
                      </div>
                    ) : (
                      <div className="bg-obsidian-950 border border-obsidian-850 p-6 rounded-3xl space-y-4 font-sans text-right">
                        <div className="flex justify-between items-center">
                          <h4 className="font-extrabold text-xs text-white">إدراج روابط الصور المباشرة (رابط في كل سطر)</h4>
                          <span className="text-[10px] bg-crimson-950 text-crimson-400 px-2.5 py-1 rounded-full font-mono">
                            {bulkUrls.split('\n').filter(Boolean).length} رابط مكشوف
                          </span>
                        </div>
                        <textarea
                          value={bulkUrls}
                          onChange={(e) => setBulkUrls(e.target.value)}
                          placeholder="الصق روابط الصور المباشرة للفصل هنا (مثال):&#10;https://example.com/page1.jpg&#10;https://example.com/page2.jpg&#10;https://example.com/page3.png"
                          className="w-full bg-obsidian-900 border border-obsidian-800 text-white p-4 rounded-xl text-xs outline-none min-h-[160px] font-mono text-left"
                          dir="ltr"
                        />
                        <button
                          type="button"
                          onClick={() => {
                            const parsed = bulkUrls.split('\n').map(u => u.trim()).filter(Boolean);
                            if (parsed.length === 0) {
                              alert('❌ يرجى لصق رابط واحد على الأقل أولاً!');
                              return;
                            }
                            setUploadedPages(parsed);
                            alert(`✅ تم استيراد وتحميل ${parsed.length} روابط صور مباشر بنجاح!`);
                          }}
                          className="w-full bg-crimson-600 hover:bg-crimson-500 text-white font-bold py-2.5 rounded-xl text-xs transition-colors cursor-pointer text-center"
                        >
                          تأكيد واستيراد صفحات الفصل المذكورة
                        </button>
                      </div>
                    )}

                    {/* Progress Indicator */}
                    {isUploading && (
                      <div className="bg-obsidian-950 border border-obsidian-850 p-4 rounded-2xl space-y-2 text-right">
                        <div className="flex items-center justify-between text-xs font-bold text-neutral-400">
                          <span>جاري رفع صفحات المانجا وضغط الحجم تلقائياً...</span>
                          <span className="font-mono text-crimson-500">{uploadProgress}%</span>
                        </div>
                        <div className="w-full bg-obsidian-900 h-2 rounded-full overflow-hidden">
                          <div className="bg-crimson-600 h-full transition-all duration-300" style={{ width: `${uploadProgress}%` }}></div>
                        </div>
                      </div>
                    )}

                    {/* Uploded pages previews & sorting before publishing */}
                    {uploadedPages.length > 0 && (
                      <div className="bg-obsidian-950 border border-obsidian-850 p-6 rounded-3xl space-y-4 text-right shadow-md">
                        <div className="flex items-center justify-between border-b border-obsidian-800 pb-3">
                          <h4 className="font-extrabold text-xs text-white">معاينة الصفحات المرفوعة ({uploadedPages.length} صفحات)</h4>
                          <p className="text-[10px] text-neutral-500">ميزة: يمكنك الضغط على الأسهم لإعادة ترتيب الصفحات أو الحذف قبل الحفظ</p>
                        </div>

                        {/* Page thumbnails row */}
                        <div className="grid grid-cols-4 sm:grid-cols-6 gap-4">
                          {uploadedPages.map((url, index) => (
                            <div key={index} className="relative group rounded-xl overflow-hidden border border-obsidian-800 shadow">
                              <img src={url} alt={`page-${index}`} referrerPolicy="no-referrer" className="w-full aspect-[2/3] object-cover" />
                              <div className="absolute top-1.5 right-1.5 bg-black/80 backdrop-blur-md px-1.5 py-0.5 rounded text-[8px] text-white font-mono font-bold">
                                {index + 1}
                              </div>

                              {/* Controls */}
                              <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-1.5">
                                <button
                                  type="button"
                                  onClick={() => {
                                    if (index === 0) return;
                                    const nextPages = [...uploadedPages];
                                    const temp = nextPages[index];
                                    nextPages[index] = nextPages[index - 1];
                                    nextPages[index - 1] = temp;
                                    setUploadedPages(nextPages);
                                  }}
                                  className="p-1 bg-obsidian-900 rounded hover:text-crimson-500 text-white"
                                >
                                  <ArrowUp className="w-3.5 h-3.5" />
                                </button>
                                <button
                                  type="button"
                                  onClick={() => {
                                    if (index === uploadedPages.length - 1) return;
                                    const nextPages = [...uploadedPages];
                                    const temp = nextPages[index];
                                    nextPages[index] = nextPages[index + 1];
                                    nextPages[index + 1] = temp;
                                    setUploadedPages(nextPages);
                                  }}
                                  className="p-1 bg-obsidian-900 rounded hover:text-crimson-500 text-white"
                                >
                                  <ArrowDown className="w-3.5 h-3.5" />
                                </button>
                                <button
                                  type="button"
                                  onClick={() => {
                                    setUploadedPages(uploadedPages.filter((_, idx) => idx !== index));
                                  }}
                                  className="p-1 bg-crimson-950 text-crimson-500 hover:bg-crimson-600 hover:text-white rounded"
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                </button>
                              </div>
                            </div>
                          ))}
                        </div>

                        {/* Publish Action Button */}
                        <button
                          onClick={handlePublishChapter}
                          className="w-full bg-crimson-600 hover:bg-crimson-500 text-white font-bold py-3 rounded-xl text-xs transition-all shadow-md cursor-pointer mt-4 font-sans"
                        >
                          نشر الفصل بالكامل وتعميمه للمشتركين فوراً
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )}

            {/* TAB: AUTOMATIC CHAPTER IMPORTER (2000+ CHAPTERS) */}
            {activeTab === 'auto-import' && (
              <div className="space-y-6 font-sans">
                {/* Header Banner */}
                <div className="relative overflow-hidden bg-gradient-to-r from-crimson-950/40 via-obsidian-950 to-obsidian-950 border border-crimson-900/20 rounded-3xl p-6 md:p-8 shadow-xl">
                  <div className="absolute top-0 right-0 w-64 h-64 bg-crimson-600/10 rounded-full blur-3xl -mr-20 -mt-20"></div>
                  <div className="relative flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
                    <div className="space-y-2">
                      <div className="inline-flex items-center gap-2 px-3 py-1 bg-crimson-500/10 border border-crimson-500/20 text-crimson-400 text-[10px] font-bold rounded-full uppercase tracking-wider">
                        <Zap className="h-3.5 w-3.5 text-crimson-500 animate-pulse" />
                        نظام الجلب التلقائي الفائق والآمن
                      </div>
                      <h2 className="text-xl md:text-2xl font-black text-white">الجالب والناشر التلقائي الذكي للفصول</h2>
                      <p className="text-xs md:text-sm text-neutral-400 max-w-2xl leading-relaxed">
                        نظام مخصص لسحب ونشر مئات الفصول آلياً بضغطة زر واحدة! يعمل النظام عبر طابور متزامن ذكي (Queue Concurrent workers) مصمم للتعامل مع أكثر من 2000 فصل في العمل الواحد بكل قوة واستقرار ودون التسبب ببطء الموقع.
                      </p>
                    </div>
                  </div>
                </div>

                {/* Accomplished Professional Summary Card */}
                {autoImportStatus === 'completed' && (
                  <motion.div
                    initial={{ opacity: 0, scale: 0.95 }}
                    animate={{ opacity: 1, scale: 1 }}
                    className="bg-gradient-to-br from-emerald-950/30 via-obsidian-950 to-obsidian-950 border border-emerald-500/30 p-6 md:p-8 rounded-3xl shadow-[0_4px_30px_rgba(16,185,129,0.15)] space-y-6 relative overflow-hidden"
                  >
                    <div className="absolute top-0 left-0 w-48 h-48 bg-emerald-500/5 rounded-full blur-2xl -ml-10 -mt-10"></div>
                    <div className="relative flex flex-col md:flex-row items-start md:items-center justify-between gap-6 pb-6 border-b border-emerald-500/10">
                      <div className="flex items-center gap-4">
                        <div className="p-3 bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 rounded-2xl">
                          <CheckCircle className="h-8 w-8 text-emerald-400 animate-bounce" />
                        </div>
                        <div className="space-y-1">
                          <span className="text-[10px] font-bold text-emerald-400 uppercase tracking-widest bg-emerald-950/80 px-2 py-0.5 rounded-full border border-emerald-900/30 inline-block">✓ تم الإنجاز بنجاح باهر</span>
                          <h3 className="text-lg md:text-xl font-black text-white">اكتملت عملية الاستيراد والنشر الجماعي بالكامل!</h3>
                          <p className="text-xs text-neutral-400">تم جلب جميع الفصول المختارة ومعالجتها وتعميمها بنجاح واحترافية تامة لزوار موقع مانهوا العرب فوراً.</p>
                        </div>
                      </div>
                      <div className="flex flex-wrap items-center gap-3">
                        {autoImportSeriesId && (
                          <button
                            type="button"
                            onClick={() => onNavigate('details', { id: autoImportSeriesId })}
                            className="bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs py-2.5 px-4 rounded-xl transition-all shadow-md flex items-center gap-1.5 cursor-pointer"
                          >
                            <ExternalLink className="w-3.5 h-3.5" />
                            عرض المانهوا بالموقع الآن
                          </button>
                        )}
                        <button
                          type="button"
                          onClick={() => {
                            setAutoImportStatus('idle');
                            setAutoImportChapters([]);
                            setAutoImportProgress({
                              current: 0,
                              total: 0,
                              success: 0,
                              failed: 0,
                              logs: ['ℹ️ تم إعادة تعيين معالجات ومسارات الزاحف التلقائي.'],
                              runningTasks: []
                            });
                          }}
                          className="bg-neutral-950 hover:bg-neutral-900 text-neutral-300 border border-neutral-800 text-xs py-2.5 px-4 rounded-xl transition-all cursor-pointer font-bold"
                        >
                          تهيئة لجلب عمل آخر
                        </button>
                      </div>
                    </div>

                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                      <div className="bg-emerald-950/10 border border-emerald-500/10 rounded-2xl p-4 text-center">
                        <span className="block text-[10px] text-neutral-400 mb-1">نسبة الإنجاز النهائية</span>
                        <strong className="text-xl md:text-2xl font-black text-emerald-400 font-mono">100%</strong>
                      </div>
                      <div className="bg-emerald-950/10 border border-emerald-500/10 rounded-2xl p-4 text-center">
                        <span className="block text-[10px] text-neutral-400 mb-1">الفصول الناجحة</span>
                        <strong className="text-xl md:text-2xl font-black text-emerald-400 font-mono">{autoImportProgress.success}</strong>
                      </div>
                      <div className="bg-emerald-950/10 border border-emerald-500/10 rounded-2xl p-4 text-center">
                        <span className="block text-[10px] text-neutral-400 mb-1">الفصول المتخطاة أو الفاشلة</span>
                        <strong className={`text-xl md:text-2xl font-black font-mono ${autoImportProgress.failed > 0 ? 'text-rose-400' : 'text-neutral-500'}`}>{autoImportProgress.failed}</strong>
                      </div>
                      <div className="bg-emerald-950/10 border border-emerald-500/10 rounded-2xl p-4 text-center">
                        <span className="block text-[10px] text-neutral-400 mb-1">سرعة المعالجة والضخ</span>
                        <strong className="text-xs font-black text-white block mt-1.5 font-sans">
                          {autoImportConcurrency} فصول / متزامن
                        </strong>
                      </div>
                    </div>
                  </motion.div>
                )}

                {/* Dashboard Stats Panel (Visible when active) */}
                {autoImportStatus !== 'idle' && (
                  <div className="grid grid-cols-2 md:grid-cols-6 gap-4">
                    <div className="bg-obsidian-950 border border-obsidian-850 rounded-2xl p-4 text-center">
                      <span className="block text-[10px] text-neutral-500 mb-1">الفصول المكتشفة</span>
                      <strong className="text-xl font-extrabold text-neutral-200 font-mono">{autoImportProgress.total}</strong>
                    </div>
                    <div className="bg-obsidian-950 border border-obsidian-850 rounded-2xl p-4 text-center">
                      <span className="block text-[10px] text-neutral-500 mb-1">تمت معالجته</span>
                      <strong className="text-xl font-extrabold text-white font-mono">
                        {autoImportProgress.current} <span className="text-xs text-neutral-500">/ {autoImportProgress.total}</span>
                      </strong>
                    </div>
                    <div className="bg-obsidian-950 border border-obsidian-850 rounded-2xl p-4 text-center border-l-2 border-l-yellow-500/20">
                      <span className="block text-[10px] text-yellow-500 mb-1">المتبقي للفصول ⏳</span>
                      <strong className="text-xl font-extrabold text-yellow-400 font-mono">
                        {Math.max(0, autoImportProgress.total - autoImportProgress.current)}
                      </strong>
                    </div>
                    <div className="bg-obsidian-950 border border-obsidian-850 rounded-2xl p-4 text-center border-l-2 border-l-emerald-500/20">
                      <span className="block text-[10px] text-emerald-500 mb-1">استيراد ناجح ✅</span>
                      <strong className="text-xl font-extrabold text-emerald-400 font-mono">{autoImportProgress.success}</strong>
                    </div>
                    <div className="bg-obsidian-950 border border-obsidian-850 rounded-2xl p-4 text-center border-l-2 border-l-rose-500/20">
                      <span className="block text-[10px] text-rose-500 mb-1">فشل الاستيراد ❌</span>
                      <strong className="text-xl font-extrabold text-rose-400 font-mono">{autoImportProgress.failed}</strong>
                    </div>
                    <div className="col-span-2 md:col-span-1 bg-obsidian-950 border border-obsidian-850 rounded-2xl p-4 flex flex-col items-center justify-center">
                      <span className="block text-[10px] text-neutral-500 mb-1">حالة المعالج الذكي</span>
                      {autoImportStatus === 'running' && (
                        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-[10px] font-bold rounded-lg">
                          <span className="flex h-1.5 w-1.5 relative">
                            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                            <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-emerald-500"></span>
                          </span>
                          زحف نشط
                        </span>
                      )}
                      {autoImportStatus === 'paused' && (
                        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-amber-500/10 border border-amber-500/20 text-amber-400 text-[10px] font-bold rounded-lg">
                          موقوف مؤقتاً
                        </span>
                      )}
                      {autoImportStatus === 'fetching_list' && (
                        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-sky-500/10 border border-sky-500/20 text-sky-400 text-[10px] font-bold rounded-lg">
                          جاري الفحص...
                        </span>
                      )}
                      {autoImportStatus === 'completed' && (
                        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-[10px] font-bold rounded-lg">
                          اكتمل بالكامل 🏆
                        </span>
                      )}
                      {autoImportStatus === 'stopped' && (
                        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-neutral-500/10 border border-neutral-500/20 text-neutral-400 text-[10px] font-bold rounded-lg">
                          تم الإلغاء
                        </span>
                      )}
                      {autoImportStatus === 'idle' && (
                        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-neutral-800 text-neutral-400 text-[10px] font-bold rounded-lg">
                          جاهز للعمل
                        </span>
                      )}
                    </div>
                  </div>
                )}

                {/* Progress Bar */}
                {autoImportStatus !== 'idle' && autoImportProgress.total > 0 && (
                  <div className="bg-obsidian-950 border border-obsidian-850 rounded-2xl p-4 space-y-2">
                    <div className="flex justify-between items-center text-xs">
                      <span className="text-neutral-400">معدل الإنجاز والضخ الإجمالي</span>
                      <strong className="text-white font-mono">{Math.round((autoImportProgress.current / autoImportProgress.total) * 100)}%</strong>
                    </div>
                    <div className="w-full bg-neutral-900 rounded-full h-3 overflow-hidden p-[2px] border border-neutral-800">
                      <div 
                        className="bg-gradient-to-r from-crimson-600 to-amber-500 h-full rounded-full transition-all duration-300"
                        style={{ width: `${(autoImportProgress.current / autoImportProgress.total) * 100}%` }}
                      ></div>
                    </div>
                    {autoImportProgress.runningTasks.length > 0 && (
                      <div className="text-[10px] text-neutral-500 flex items-center gap-1">
                        <span className="font-bold text-amber-500">⚡ معالجة متزامنة نشطة حالياً للفصول:</span>
                        <span className="font-mono">{autoImportProgress.runningTasks.map(t => `[${t}]`).join(', ')}</span>
                      </div>
                    )}
                  </div>
                )}

                <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
                  {/* Left Box: Controls and Setup */}
                  <div className="lg:col-span-5 bg-obsidian-950 border border-obsidian-850 rounded-3xl p-6 space-y-5 h-fit shadow-lg">
                    <div className="border-b border-obsidian-850 pb-3">
                      <h3 className="text-sm font-extrabold text-white flex items-center gap-2">
                        <Sliders className="h-4 w-4 text-crimson-500" />
                        إعدادات وضبط معالج الاستيراد
                      </h3>
                      <p className="text-[11px] text-neutral-500 mt-0.5">اضبط خيارات الفحص والزحف لتتطابق تماماً مع رغبتك.</p>
                    </div>

                    {/* Step 1: Target Link */}
                    <div className="space-y-1.5">
                      <label className="block text-[11px] text-neutral-400 font-bold">1. رابط الفصل الأول المستهدف:</label>
                      <div className="relative">
                        <input
                          type="url"
                          required
                          disabled={autoImportStatus === 'running' || autoImportStatus === 'fetching_list'}
                          value={autoImportUrl}
                          onChange={(e) => setAutoImportUrl(e.target.value)}
                          placeholder="مثال: https://www.olympustaff.com/series/IBS/1"
                          className="w-full bg-obsidian-900 border border-obsidian-800 text-xs text-white pl-3 pr-9 py-3 rounded-xl outline-none placeholder:text-neutral-600 focus:border-crimson-600/50 transition-all font-mono text-left"
                        />
                        <Zap className="absolute right-3 top-3 h-4 w-4 text-neutral-500" />
                      </div>
                      <p className="text-[10px] text-neutral-500 leading-normal">
                        قم بلصق رابط أول فصل بالكامل. سيقوم النظام تلقائياً بتغيير الرقم الأخير من رابط الفصل الأول لتوليد باقي الفصول تسلسلياً (مثال: 1 ثم 2 ثم 3 وهكذا).
                      </p>
                    </div>

                    {/* Step 2: Chapter Range */}
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-1.5">
                        <label className="block text-[11px] text-neutral-400 font-bold">2. رقم الفصل الأول (البداية):</label>
                        <input
                          type="number"
                          min="1"
                          disabled={autoImportStatus === 'running'}
                          value={autoImportStartChapter}
                          onChange={(e) => setAutoImportStartChapter(Math.max(1, Number(e.target.value)))}
                          className="w-full bg-obsidian-900 border border-obsidian-800 text-xs text-white px-3 py-2.5 rounded-xl outline-none focus:border-crimson-600/50 transition-all font-mono"
                        />
                      </div>
                      <div className="space-y-1.5">
                        <label className="block text-[11px] text-neutral-400 font-bold">3. عدد الفصول / فصل النهاية:</label>
                        <input
                          type="number"
                          min="1"
                          disabled={autoImportStatus === 'running'}
                          value={autoImportEndChapter}
                          onChange={(e) => setAutoImportEndChapter(Math.max(1, Number(e.target.value)))}
                          className="w-full bg-obsidian-900 border border-obsidian-800 text-xs text-white px-3 py-2.5 rounded-xl outline-none focus:border-crimson-600/50 transition-all font-mono"
                        />
                      </div>
                    </div>

                    {/* Step 3: Target Local Series */}
                    <div className="space-y-1.5">
                      <label className="block text-[11px] text-neutral-400 font-bold">4. اختر مانهوا / المانجا المستهدفة بالموقع:</label>
                      <select
                        required
                        disabled={autoImportStatus === 'running'}
                        value={autoImportSeriesId}
                        onChange={(e) => setAutoImportSeriesId(e.target.value)}
                        className="w-full bg-obsidian-900 border border-obsidian-800 text-xs text-white px-3 py-2.5 rounded-xl outline-none focus:border-crimson-600/50 transition-all"
                      >
                        <option value="">-- اختر العمل الذي سيتم نشر الفصول بداخله --</option>
                        {seriesList.map(s => (
                          <option key={s.id} value={s.id}>{s.titleAr} ({s.type === 'manhwa' ? 'مانهوا' : s.type === 'manga' ? 'مانجا' : 'مانها'})</option>
                        ))}
                      </select>
                      <p className="text-[10px] text-neutral-500 leading-normal">
                        سيتم إدراج ونشر كافة الفصول التي يتم جلبها تلقائياً تحت هذا العمل في موقعك.
                      </p>
                    </div>

                    {/* Step 4: Translator Name */}
                    <div className="space-y-1.5">
                      <label className="block text-[11px] text-neutral-400 font-bold">5. اسم المترجم / الفريق الناشر:</label>
                      <input
                        type="text"
                        disabled={autoImportStatus === 'running'}
                        value={autoImportTranslator}
                        onChange={(e) => setAutoImportTranslator(e.target.value)}
                        placeholder="مثال: فريق مانهوا العرب"
                        className="w-full bg-obsidian-900 border border-obsidian-800 text-xs text-white px-3 py-2.5 rounded-xl outline-none focus:border-crimson-600/50 transition-all"
                      />
                    </div>

                    {/* Toggles & Settings */}
                    <div className="p-4 bg-obsidian-900/40 rounded-2xl border border-obsidian-850 space-y-4">
                      {/* Skip Existing Toggle */}
                      <div className="flex items-center justify-between gap-4">
                        <div className="space-y-0.5">
                          <span className="block text-[11px] text-neutral-300 font-bold">تجنب تكرار الفصول المضافة مسبقاً</span>
                          <p className="text-[10px] text-neutral-500 leading-normal">يفحص الفصول الموجودة بالعمل حالياً ويتخطي مطابقتها فوراً لتسريع الجلب ومنع تكرار النشر.</p>
                        </div>
                        <button
                          type="button"
                          onClick={() => setAutoImportSkipExisting(!autoImportSkipExisting)}
                          className="text-neutral-400 hover:text-white transition-all"
                        >
                          {autoImportSkipExisting ? (
                            <ToggleRight className="h-9 w-9 text-crimson-500" />
                          ) : (
                            <ToggleLeft className="h-9 w-9 text-neutral-600" />
                          )}
                        </button>
                      </div>

                      {/* Publish Direction */}
                      <div className="flex items-center justify-between gap-4 border-t border-obsidian-850/60 pt-3">
                        <div className="space-y-0.5">
                          <span className="block text-[11px] text-neutral-300 font-bold">اتجاه وترتيب النشر</span>
                          <p className="text-[10px] text-neutral-500 leading-normal">من الأقدم إلى الأحدث (من 1 إلى الأخير) وهو الترتيب الأفضل.</p>
                        </div>
                        <select
                          value={autoImportOrder}
                          onChange={(e) => setAutoImportOrder(e.target.value as 'asc' | 'desc')}
                          className="bg-obsidian-950 border border-obsidian-800 text-[10px] text-white px-2.5 py-1.5 rounded-lg outline-none"
                        >
                          <option value="asc">من الأقدم للأحدث (تصاعدي)</option>
                          <option value="desc">من الأحدث للأقدم (تنازلي)</option>
                        </select>
                      </div>

                      {/* Concurrency Level */}
                      <div className="flex items-center justify-between gap-4 border-t border-obsidian-850/60 pt-3">
                        <div className="space-y-0.5">
                          <span className="block text-[11px] text-neutral-300 font-bold">قوة الضخ (التزامن)</span>
                          <p className="text-[10px] text-neutral-500 leading-normal">عدد الفصول المجلوبة بالثانية. 3 مثالي وسريع لتجنب الحظر.</p>
                        </div>
                        <select
                          value={autoImportConcurrency}
                          onChange={(e) => setAutoImportConcurrency(Number(e.target.value))}
                          className="bg-obsidian-950 border border-obsidian-800 text-[10px] text-white px-2.5 py-1.5 rounded-lg outline-none"
                        >
                          <option value="1">1 فصل متزامن (آمن جداً)</option>
                          <option value="2">2 فصل متزامن</option>
                          <option value="3">3 فصول متزامنة (موصى به)</option>
                          <option value="4">4 فصول متزامنة (سريع)</option>
                          <option value="5">5 فصول متزامنة (فائق السرعة)</option>
                        </select>
                      </div>
                    </div>

                    {/* Operational Action Buttons */}
                    <div className="space-y-2.5 pt-3 border-t border-obsidian-850">
                      {/* Discovery Trigger */}
                      {autoImportStatus === 'idle' && (
                        <button
                          type="button"
                          onClick={handleFetchAutoImportChapters}
                          className="w-full flex items-center justify-center gap-2 bg-obsidian-900 hover:bg-obsidian-850 border border-obsidian-800 text-neutral-200 font-bold py-3 px-4 rounded-xl text-xs transition-all cursor-pointer"
                        >
                          <HelpCircle className="h-4 w-4 text-sky-500" />
                          توليد ومعاينة روابط الفصول تسلسلياً (اختياري)
                        </button>
                      )}

                      {/* Main Executer Trigger */}
                      {autoImportStatus === 'idle' && (
                        <button
                          type="button"
                          onClick={handleStartAutoImport}
                          className="w-full flex items-center justify-center gap-2 bg-crimson-600 hover:bg-crimson-500 text-white font-black py-3.5 px-4 rounded-xl text-xs transition-all shadow-md cursor-pointer text-center relative group overflow-hidden"
                        >
                          <div className="absolute inset-0 w-full h-full bg-gradient-to-r from-transparent via-white/10 to-transparent -translate-x-full group-hover:animate-[shimmer_1.5s_infinite]"></div>
                          <Zap className="h-4 w-4 fill-current text-yellow-400" />
                          إطلاق نظام السحب الآلي والنشر الفوري
                        </button>
                      )}

                      {/* Control Panel when Running */}
                      {autoImportStatus === 'running' && (
                        <div className="grid grid-cols-2 gap-3">
                          <button
                            type="button"
                            onClick={handlePauseAutoImport}
                            className="flex items-center justify-center gap-2 bg-amber-600 hover:bg-amber-500 text-white font-bold py-3 px-4 rounded-xl text-xs transition-all cursor-pointer"
                          >
                            إيقاف مؤقت
                          </button>
                          <button
                            type="button"
                            onClick={handleStopAutoImport}
                            className="flex items-center justify-center gap-2 bg-rose-600 hover:bg-rose-500 text-white font-bold py-3 px-4 rounded-xl text-xs transition-all cursor-pointer"
                          >
                            إلغاء التشغيل كلياً
                          </button>
                        </div>
                      )}

                      {/* Control Panel when Paused */}
                      {autoImportStatus === 'paused' && (
                        <div className="grid grid-cols-2 gap-3">
                          <button
                            type="button"
                            onClick={handleResumeAutoImport}
                            className="flex items-center justify-center gap-2 bg-emerald-600 hover:bg-emerald-500 text-white font-bold py-3 px-4 rounded-xl text-xs transition-all cursor-pointer"
                          >
                            استئناف العمل
                          </button>
                          <button
                            type="button"
                            onClick={handleStopAutoImport}
                            className="flex items-center justify-center gap-2 bg-rose-600 hover:bg-rose-500 text-white font-bold py-3 px-4 rounded-xl text-xs transition-all cursor-pointer"
                          >
                            إلغاء التشغيل كلياً
                          </button>
                        </div>
                      )}

                      {/* Completed / Stopped Reset Action */}
                      {(autoImportStatus === 'completed' || autoImportStatus === 'stopped') && (
                        <button
                          type="button"
                          onClick={() => {
                            setAutoImportStatus('idle');
                            setAutoImportChapters([]);
                            setAutoImportProgress({
                              current: 0,
                              total: 0,
                              success: 0,
                              failed: 0,
                              logs: ['ℹ️ تم إعادة تعيين معالجات ومسارات الزاحف التلقائي.'],
                              runningTasks: []
                            });
                          }}
                          className="w-full flex items-center justify-center gap-2 bg-neutral-900 hover:bg-neutral-800 text-neutral-300 font-bold py-3 px-4 rounded-xl text-xs transition-all cursor-pointer"
                        >
                          تهيئة المعالج لبدء جلب مانهوا أخرى
                        </button>
                      )}
                    </div>
                  </div>

                  {/* Right Box: Live Terminal and Log */}
                  <div className="lg:col-span-7 bg-obsidian-950 border border-obsidian-850 rounded-3xl p-6 flex flex-col space-y-4 shadow-lg">
                    <div className="flex items-center justify-between border-b border-obsidian-850 pb-3">
                      <div>
                        <h3 className="text-sm font-extrabold text-white flex items-center gap-2">
                          <span className="flex h-2 w-2 relative">
                            {autoImportStatus === 'running' && (
                              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                            )}
                            <span className={`relative inline-flex rounded-full h-2 w-2 ${autoImportStatus === 'running' ? 'bg-emerald-500' : 'bg-neutral-600'}`}></span>
                          </span>
                          سجل التشغيل المباشر والزحف الذكي
                        </h3>
                        <p className="text-[11px] text-neutral-500 mt-0.5">شاشة طرفية (Terminal) تعرض تفاصيل السحب والاستخراج للفصول في الوقت الفعلي.</p>
                      </div>

                      {/* Download Log Action */}
                      {autoImportProgress.logs.length > 1 && (
                        <button
                          onClick={() => {
                            const text = autoImportProgress.logs.join('\n');
                            const blob = new Blob([text], { type: 'text/plain;charset=utf-8' });
                            const url = URL.createObjectURL(blob);
                            const link = document.createElement('a');
                            link.href = url;
                            link.download = `auto_import_log_${autoImportSeriesId || 'manga'}.txt`;
                            link.click();
                            URL.revokeObjectURL(url);
                          }}
                          className="flex items-center gap-1 px-2.5 py-1.5 bg-obsidian-900 hover:bg-obsidian-850 border border-obsidian-800 text-neutral-400 hover:text-white text-[10px] font-bold rounded-lg transition-all"
                        >
                          <Copy className="h-3 w-3" />
                          تحميل السجل بالكامل
                        </button>
                      )}
                    </div>

                    {/* Console Output Terminal */}
                    <div className="flex-1 min-h-[300px] lg:min-h-[420px] bg-black border border-obsidian-900 rounded-2xl p-4 font-mono text-[11px] leading-relaxed overflow-y-auto space-y-2 h-[450px] scrollbar-thin scrollbar-thumb-obsidian-800">
                      {autoImportProgress.logs.map((logLine, index) => {
                        let textClass = 'text-neutral-400';
                        if (logLine.startsWith('✅') || logLine.includes('نجاح')) {
                          textClass = 'text-emerald-400 font-medium';
                        } else if (logLine.startsWith('❌') || logLine.includes('فشل')) {
                          textClass = 'text-rose-400 font-bold';
                        } else if (logLine.startsWith('🚀') || logLine.startsWith('⏳') || logLine.startsWith('🔍')) {
                          textClass = 'text-sky-400';
                        } else if (logLine.startsWith('ℹ️') || logLine.startsWith('🛠️') || logLine.startsWith('⏸️')) {
                          textClass = 'text-amber-400';
                        }
                        return (
                          <div key={index} className={`${textClass} border-b border-zinc-950/40 pb-1.5 last:border-0`}>
                            <span className="text-[9px] text-neutral-600 mr-1.5 select-none">[{new Date().toLocaleTimeString()}]</span>
                            {logLine}
                          </div>
                        );
                      })}
                      {autoImportStatus === 'running' && (
                        <div className="flex items-center gap-1.5 text-sky-400 text-[10px] animate-pulse">
                          <span>⚙️ جاري جلب ومعالجة المزيد من الفصول...</span>
                        </div>
                      )}
                    </div>

                    {/* Quick Guidance Box */}
                    <div className="p-4 bg-crimson-950/10 border border-crimson-900/10 rounded-2xl text-[11px] text-neutral-400 leading-relaxed font-sans">
                      <strong className="text-crimson-400 block mb-1">💡 نصائح لضمان أفضل تشغيل واستمرارية:</strong>
                      <ul className="list-disc list-inside space-y-1 text-neutral-500">
                        <li>إذا واجهت رسالة جدار حماية (Cloudflare) في بعض الفصول، فهذا طبيعي ومجرد حماية مؤقتة للموقع المستهدف. سيقوم الزاحف بمتابعة باقي الفصول تلقائياً.</li>
                        <li>عند تشغيل الاستيراد، يمكنك إبقاء هذه التبويبة مفتوحة لمراقبة الطابور المتزامن وسحب الفصول بشكل مباشر.</li>
                        <li>يدعم المحرك جلب أكثر من <strong className="text-neutral-300">2000 فصل</strong> تباعاً وبصورة منظمة للغاية مع حفظ النسخ الاحتياطية تلقائياً.</li>
                      </ul>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* TAB: AUTOMATIC MANGA CATALOG IMPORTER (1000+ WORKS) */}
            {activeTab === 'catalog-import' && (
              <div className="space-y-6 font-sans text-right">
                {/* Header Banner */}
                <div className="relative overflow-hidden bg-gradient-to-r from-crimson-950/40 via-obsidian-950 to-obsidian-950 border border-crimson-900/20 rounded-3xl p-6 md:p-8 shadow-xl">
                  <div className="absolute top-0 right-0 w-64 h-64 bg-crimson-600/10 rounded-full blur-3xl -mr-20 -mt-20"></div>
                  <div className="relative flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
                    <div className="space-y-2">
                      <div className="inline-flex items-center gap-2 px-3 py-1 bg-crimson-500/10 border border-crimson-500/20 text-crimson-400 text-[10px] font-bold rounded-full uppercase tracking-wider">
                        <Globe className="h-3.5 w-3.5 text-crimson-500 animate-pulse" />
                        نظام الاستيراد الجماعي الفائق من الكتالوجات والروابط
                      </div>
                      <h2 className="text-xl md:text-2xl font-black text-white">جالب الكتالوج التلقائي الذكي للروابط والأعمال</h2>
                      <p className="text-xs md:text-sm text-neutral-400 max-w-2xl leading-relaxed">
                        استورد مئات أعمال المانجا والمانهوا في دقائق معدودة! أدخل رابط كتالوج من أي موقع خارجي أو قائمة روابط مباشرة، وسيقوم النظام تلقائياً باستخلاص الأسماء، الأوصاف، الأغلفة، التصنيفات، وجلب آخر الفصول آلياً ونشرها دون أي تدخل منك.
                      </p>
                    </div>
                  </div>
                </div>

                {/* Consecutive Failures Warning Alert Banner */}
                {consecutiveFailureInfo.triggered && (
                  <div className="bg-gradient-to-r from-rose-950/70 via-obsidian-950 to-obsidian-950 border border-rose-900/50 rounded-3xl p-6 md:p-8 space-y-4 shadow-xl shadow-rose-950/20 relative">
                    <button 
                      onClick={handleDismissAlert}
                      className="absolute top-4 left-4 text-neutral-400 hover:text-white transition-colors cursor-pointer text-xs"
                      title="إغلاق التنبيه مؤقتاً"
                    >
                      <XCircle className="w-5 h-5 text-neutral-500 hover:text-rose-400" />
                    </button>
                    
                    <div className="flex items-start gap-4">
                      <div className="p-3 bg-rose-500/10 border border-rose-500/20 rounded-2xl shrink-0">
                        <ShieldAlert className="w-7 h-7 text-rose-500" />
                      </div>
                      <div className="space-y-1 text-right flex-1">
                        <h3 className="text-sm md:text-base font-black text-rose-400 flex items-center gap-2">
                          تنبيه أمان عاجل: تعثر جالب الكتالوج التلقائي ({consecutiveFailureInfo.count} إخفاقات متتالية!)
                        </h3>
                        <p className="text-xs text-neutral-300 leading-relaxed max-w-4xl">
                          اكتشف نظام المراقبة الذكي تعثر عملية جلب ونشر الكتالوج التلقائي لـ <span className="font-bold text-rose-400 font-mono text-sm">{consecutiveFailureInfo.count}</span> مرات متتالية دون نجاح. يرجى مراجعة حالة حماية Cloudflare أو الرابط المستهدف، أو تعديل شفرة الاستخلاص للروابط أدناه.
                        </p>
                      </div>
                    </div>

                    {/* Show list of last consecutive failures */}
                    <div className="bg-rose-950/20 border border-rose-900/20 rounded-2xl p-4 space-y-3">
                      <span className="text-[10px] text-rose-400 font-bold block">آخر الأعمال التي تعثر جلبها على التوالي:</span>
                      <div className="space-y-2 max-h-40 overflow-y-auto font-sans text-xs custom-scrollbar">
                        {consecutiveFailureInfo.list.slice(0, 5).map((item, index) => (
                          <div key={index} className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 bg-black/40 border border-rose-950/40 p-2.5 rounded-xl text-right">
                            <div className="space-y-0.5">
                              <span className="font-extrabold text-neutral-200 block">{item.title}</span>
                              <span className="text-[10px] text-neutral-500 block truncate font-mono" dir="ltr">{item.url}</span>
                            </div>
                            <span className="text-[10px] bg-rose-500/10 text-rose-400 px-2 py-1 rounded-lg border border-rose-500/20 max-w-xs truncate">
                              {item.error || 'فشل الجلب والتحليل'}
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>

                    <div className="flex flex-wrap gap-3 pt-2">
                      <button
                        onClick={handleClearFailureLogs}
                        className="bg-rose-600 hover:bg-rose-500 text-white font-extrabold text-xs py-2 px-5 rounded-xl shadow-lg shadow-rose-900/10 transition-all flex items-center gap-1.5 cursor-pointer"
                      >
                        <Trash2 className="w-4 h-4" /> تصفير عداد الأخطاء ومسح سجل الإخفاقات
                      </button>
                      <button
                        onClick={handleDismissAlert}
                        className="bg-neutral-800 hover:bg-neutral-750 text-neutral-300 border border-neutral-700 font-bold text-xs py-2 px-5 rounded-xl transition-all cursor-pointer"
                      >
                        تجاهل التنبيه مؤقتاً
                      </button>
                    </div>
                  </div>
                )}

                {/* Input panel */}
                <div className="bg-obsidian-950 border border-obsidian-850 rounded-3xl p-6 md:p-8 space-y-6">
                  {/* Select Mode */}
                  <div className="flex gap-4 border-b border-obsidian-900 pb-4">
                    <button
                      type="button"
                      onClick={() => setCatalogExtractMode('url')}
                      className={`py-2.5 px-5 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center gap-2 ${catalogExtractMode === 'url' ? 'bg-crimson-600 text-white' : 'bg-obsidian-900 text-neutral-400 hover:text-white'}`}
                    >
                      <Globe className="w-4 h-4" /> استخراج ذكي من رابط كتالوج (Catalog URL)
                    </button>
                    <button
                      type="button"
                      onClick={() => setCatalogExtractMode('raw')}
                      className={`py-2.5 px-5 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center gap-2 ${catalogExtractMode === 'raw' ? 'bg-crimson-600 text-white' : 'bg-obsidian-900 text-neutral-400 hover:text-white'}`}
                    >
                      <ListPlus className="w-4 h-4" /> لصق قائمة روابط مباشرة (Direct List)
                    </button>
                  </div>

                  {catalogExtractMode === 'url' ? (
                    <div className="space-y-2">
                      <label className="block text-xs font-bold text-neutral-300">رابط صفحة الكتالوج المستهدفة:</label>
                      <div className="flex flex-col md:flex-row gap-3">
                        <input
                          type="url"
                          dir="ltr"
                          value={catalogUrl}
                          onChange={(e) => {
                            let val = e.target.value;
                            val = val.replace(/^\[\d+\]\s*/, '');
                            setCatalogUrl(val);
                          }}
                          placeholder="https://example-manga-site.com/manga-list/ or tag page URL"
                          className="flex-1 bg-obsidian-900 border border-obsidian-850 rounded-xl px-4 py-3.5 text-xs text-white placeholder-neutral-500 focus:outline-none focus:border-crimson-500 transition-all font-mono"
                        />
                        <button
                          type="button"
                          onClick={handleExtractCatalog}
                          disabled={isExtractingCatalog}
                          className="bg-crimson-600 hover:bg-crimson-500 disabled:bg-neutral-800 text-white font-bold text-xs py-3.5 px-6 rounded-xl shadow-lg transition-all flex items-center justify-center gap-2 cursor-pointer shrink-0"
                        >
                          {isExtractingCatalog ? (
                            <>
                              <Loader2 className="w-4 h-4 animate-spin" />
                              جاري تحليل وقراءة الكتالوج...
                            </>
                          ) : (
                            <>
                              <Globe className="w-4 h-4" />
                              استخراج أعمال الكتالوج الآن
                            </>
                          )}
                        </button>
                      </div>
                      <p className="text-[10px] text-neutral-500 mt-1">يقوم النظام تلقائياً بمسح الصفحة واستخلاص كافة روابط المانجا والأوصاف والتحقق من صلاحيتها للبدء.</p>

                      {/* جالب الصفحات الأوتوماتيكي */}
                      <div className="bg-obsidian-900 border border-obsidian-850/60 rounded-2xl p-4 mt-4 space-y-4 text-right">
                        <div className="flex items-center justify-between gap-4">
                          <div className="flex items-center gap-3">
                            <input
                              type="checkbox"
                              id="catalogMultiPage"
                              checked={catalogMultiPage}
                              onChange={(e) => setCatalogMultiPage(e.target.checked)}
                              className="w-4 h-4 rounded text-crimson-600 bg-obsidian-950 border-obsidian-800 focus:ring-crimson-500 accent-crimson-600 cursor-pointer"
                            />
                            <label htmlFor="catalogMultiPage" className="text-xs font-extrabold text-neutral-200 cursor-pointer select-none">
                              تفعيل جالب الصفحات الأوتوماتيكي المتطور (Multi-Page Auto Crawler) 🚀
                            </label>
                          </div>
                          {catalogMultiPage && (
                            <span className="text-[10px] bg-crimson-950/40 text-crimson-400 px-2.5 py-1 rounded-full border border-crimson-900/30 font-bold animate-pulse">
                              مستكشف الصفحات نشط (حتى 120 صفحة)
                            </span>
                          )}
                        </div>

                        {catalogMultiPage && (
                          <div className="space-y-4 pt-3 border-t border-obsidian-850/40">
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                              <div className="space-y-1.5">
                                <label className="block text-[11px] font-bold text-neutral-400">رابط الصفحة الثانية (اختياري لتحديد النمط بدقة):</label>
                                <input
                                  type="url"
                                  dir="ltr"
                                  value={catalogSecondPageUrl}
                                  onChange={(e) => {
                                    let val = e.target.value;
                                    val = val.replace(/^\[\d+\]\s*/, '');
                                    setCatalogSecondPageUrl(val);
                                  }}
                                  placeholder="https://www.olympustaff.com/series?page=2"
                                  className="w-full bg-obsidian-950 border border-obsidian-800 rounded-xl px-3 py-2.5 text-xs text-white placeholder-neutral-600 focus:outline-none focus:border-crimson-500 font-mono"
                                />
                                <p className="text-[9px] text-neutral-500">مثال: إذا كان الرابط الأول ينتهي بـ <code className="text-neutral-400">/series</code> والثاني بـ <code className="text-neutral-400">/series?page=2</code> أو <code className="text-neutral-400">/series/page/2/</code>.</p>
                              </div>

                              <div className="space-y-1.5">
                                <label className="block text-[11px] font-bold text-neutral-400">عدد الصفحات المطلوب جلبها تلقائياً:</label>
                                <div className="flex items-center gap-2">
                                  <input
                                    type="number"
                                    min={1}
                                    max={120}
                                    value={catalogPagesCount}
                                    onChange={(e) => setCatalogPagesCount(Math.min(120, Math.max(1, parseInt(e.target.value) || 1)))}
                                    className="w-24 bg-obsidian-950 border border-obsidian-800 rounded-xl px-3 py-2 text-xs text-white font-bold text-center focus:outline-none focus:border-crimson-500 font-mono"
                                  />
                                  <span className="text-[11px] text-neutral-500 font-bold">صفحة (بحد أقصى 120 صفحة)</span>
                                </div>
                                <p className="text-[9px] text-neutral-500">سيقوم النظام بجدولة وتوليد كافة الروابط تلقائياً والبدء في استخلاص القصص منها بدقة فائقة.</p>
                              </div>
                            </div>

                            {/* قائمة الروابط المولدة للمراجعة */}
                            {catalogUrl && (
                              <div className="bg-obsidian-950 rounded-xl p-3 border border-obsidian-850 space-y-2">
                                <div className="flex items-center justify-between text-[11px]">
                                  <span className="font-extrabold text-neutral-300">🔗 الروابط التي سيتم توليدها وجلبها ({catalogPagesCount} رابط):</span>
                                  <span className="text-[10px] text-neutral-500 font-mono">Auto-generated Pattern</span>
                                </div>
                                <div className="max-h-24 overflow-y-auto space-y-1 pr-1 scrollbar-thin text-left" dir="ltr">
                                  {Array.from({ length: catalogPagesCount }).map((_, idx) => {
                                    const pageNum = idx + 1;
                                    let generatedUrl = catalogUrl;
                                    if (pageNum > 1) {
                                      if (catalogSecondPageUrl && catalogSecondPageUrl.trim()) {
                                        const s = catalogSecondPageUrl.trim();
                                        const pageNumRegex = /(\b|_|-|\/|\?|&|=)(2)(\b|_|-|\/|\?|&|$)/;
                                        if (s.match(pageNumRegex)) {
                                          generatedUrl = s.replace(pageNumRegex, `$1${pageNum}$3`);
                                        } else {
                                          generatedUrl = `${catalogUrl}?page=${pageNum}`;
                                        }
                                      } else {
                                        try {
                                          const parsed = new URL(catalogUrl);
                                          if (parsed.searchParams.has('page')) {
                                            const u = new URL(catalogUrl);
                                            u.searchParams.set('page', pageNum.toString());
                                            generatedUrl = u.href;
                                          } else if (catalogUrl.match(/[?&]page=\d+/i)) {
                                            generatedUrl = catalogUrl.replace(/([?&]page=)\d+/i, `$1${pageNum}`);
                                          } else if (catalogUrl.match(/\/page\/\d+/i)) {
                                            generatedUrl = catalogUrl.replace(/(\/page\/)\d+/i, `$1${pageNum}`);
                                          } else {
                                            generatedUrl = `${catalogUrl.endsWith('/') ? catalogUrl.slice(0, -1) : catalogUrl}?page=${pageNum}`;
                                          }
                                        } catch {
                                          generatedUrl = `${catalogUrl}?page=${pageNum}`;
                                        }
                                      }
                                    }
                                    return (
                                      <div key={idx} className="text-[10px] text-neutral-400 font-mono truncate hover:text-white bg-obsidian-900/50 px-2 py-1 rounded">
                                        <span className="text-crimson-500 font-bold mr-1.5">[{pageNum}]</span> {generatedUrl}
                                      </div>
                                    );
                                  })}
                                </div>
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    </div>
                  ) : (
                    <div className="space-y-2">
                      <label className="block text-xs font-bold text-neutral-300">أدخل قائمة روابط الأعمال (رابط واحد في كل سطر):</label>
                      <textarea
                        dir="ltr"
                        rows={6}
                        value={catalogRawUrls}
                        onChange={(e) => setCatalogRawUrls(e.target.value)}
                        placeholder="https://example.com/manga/solo-leveling&#10;https://example.com/manga/martial-peak&#10;https://example.com/manga/overgeared"
                        className="w-full bg-obsidian-900 border border-obsidian-850 rounded-xl p-4 text-xs text-white placeholder-neutral-500 focus:outline-none focus:border-crimson-500 transition-all font-mono leading-relaxed"
                      />
                      <div className="flex justify-end pt-2">
                        <button
                          type="button"
                          onClick={handleExtractCatalog}
                          className="bg-crimson-600 hover:bg-crimson-500 text-white font-bold text-xs py-3 px-6 rounded-xl shadow-lg transition-all flex items-center gap-2 cursor-pointer"
                        >
                          <ListPlus className="w-4 h-4" /> تهيئة وإعداد قائمة الروابط المستوردة
                        </button>
                      </div>
                    </div>
                  )}
                </div>

                {/* Extracted Items Selection Grid */}
                {extractedCatalogItems.length > 0 && (
                  <div className="bg-obsidian-950 border border-obsidian-850 rounded-3xl p-6 md:p-8 space-y-6">
                    <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 border-b border-obsidian-900 pb-4">
                      <div>
                        <h3 className="text-sm md:text-base font-extrabold text-white flex items-center gap-2">
                          <CheckSquare className="w-5 h-5 text-crimson-500" /> الأعمال التي تم اكتشافها وتحليلها ({extractedCatalogItems.length} عمل متاح)
                        </h3>
                        <p className="text-[10px] text-neutral-400 mt-1">حدد الأعمال التي ترغب في استيرادها أو إلغاء تحديد البعض منها لتشغيل الطابور.</p>
                      </div>

                      <div className="flex flex-wrap items-center gap-3 shrink-0">
                        <button
                          type="button"
                          onClick={() => setSelectedCatalogUrls(extractedCatalogItems.map(item => item.url))}
                          className="text-xs font-bold bg-obsidian-900 hover:bg-obsidian-850 border border-obsidian-800 text-neutral-300 py-2 px-4 rounded-xl transition-all cursor-pointer"
                        >
                          تحديد الكل
                        </button>
                        <button
                          type="button"
                          onClick={() => setSelectedCatalogUrls([])}
                          className="text-xs font-bold bg-obsidian-900 hover:bg-obsidian-850 border border-obsidian-800 text-neutral-300 py-2 px-4 rounded-xl transition-all cursor-pointer"
                        >
                          إلغاء التحديد
                        </button>
                      </div>
                    </div>

                    {/* Filter and Search */}
                    <div className="flex items-center gap-3">
                      <input
                        type="text"
                        placeholder="ابحث بالاسم لتصفية الأعمال المكتشفة..."
                        value={catalogFilterText}
                        onChange={(e) => setCatalogFilterText(e.target.value)}
                        className="w-full max-w-md bg-obsidian-900 border border-obsidian-850 rounded-xl px-4 py-2.5 text-xs text-white placeholder-neutral-500 focus:outline-none focus:border-crimson-500 transition-all"
                      />
                      <span className="text-xs text-neutral-400">تم تحديد <strong className="text-crimson-500 font-bold">{selectedCatalogUrls.length}</strong> من أصل {extractedCatalogItems.length} عمل</span>
                    </div>

                    {/* Works Cards Selector */}
                    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-4 max-h-[360px] overflow-y-auto pr-2 custom-scrollbar">
                      {extractedCatalogItems
                        .filter(item => item.title.toLowerCase().includes(catalogFilterText.toLowerCase()) || item.url.toLowerCase().includes(catalogFilterText.toLowerCase()))
                        .map((item, idx) => {
                          const isSelected = selectedCatalogUrls.includes(item.url);
                          return (
                            <div
                              key={idx}
                              onClick={() => {
                                if (isSelected) {
                                  setSelectedCatalogUrls(selectedCatalogUrls.filter(u => u !== item.url));
                                } else {
                                  setSelectedCatalogUrls([...selectedCatalogUrls, item.url]);
                                }
                              }}
                              className={`relative overflow-hidden bg-obsidian-900 border rounded-2xl p-2.5 transition-all cursor-pointer select-none group flex flex-col justify-between h-48 ${isSelected ? 'border-crimson-600/60 ring-2 ring-crimson-600/30 bg-crimson-950/5' : 'border-obsidian-800 hover:border-obsidian-750'}`}
                            >
                              <div className="relative aspect-[3/4] rounded-lg overflow-hidden bg-obsidian-950 shrink-0">
                                <img
                                  src={item.coverUrl}
                                  alt={item.title}
                                  className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                                  referrerPolicy="no-referrer"
                                  onError={(e: any) => { e.target.src = 'https://images.unsplash.com/photo-1578632767115-351597cf2477?auto=format&fit=crop&w=400&h=600&q=80'; }}
                                />
                                <div className="absolute top-1 right-1">
                                  <div className={`p-1 rounded-md border transition-all ${isSelected ? 'bg-crimson-600 border-crimson-600 text-white' : 'bg-obsidian-950/80 border-neutral-700 text-transparent'}`}>
                                    <Check className="w-3.5 h-3.5" />
                                  </div>
                                </div>
                              </div>
                              <h4 className="text-[11px] font-black text-neutral-200 mt-2 line-clamp-1 group-hover:text-white transition-colors">
                                {item.title}
                              </h4>
                              <p className="text-[8px] text-neutral-500 truncate font-mono mt-0.5">{item.url}</p>
                            </div>
                          );
                        })}
                    </div>

                    {/* Import Settings Panel */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-6 border-t border-obsidian-900">
                      {/* Chapters to import */}
                      <div className="space-y-2.5">
                        <label className="block text-xs font-bold text-neutral-300">نطاق الفصول المراد جلبها تلقائياً لكل عمل:</label>
                        <div className="bg-emerald-950/20 border border-emerald-900/30 rounded-xl p-3.5 flex items-center justify-between">
                          <div className="space-y-0.5 text-right">
                            <span className="text-xs font-black text-emerald-400 block">كل الفصول 🌐 (دائماً وبأعلى سرعة)</span>
                            <span className="text-[10px] text-neutral-400 block">يقوم الزاحف تلقائياً بفرز كافة فصول المانجا المتاحة وجلب صفحاتها وصورها دون حدود.</span>
                          </div>
                          <span className="bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 px-3 py-1.5 rounded-lg text-xs font-black font-sans shrink-0">شامل</span>
                        </div>
                      </div>

                      {/* Publish Status */}
                      <div className="space-y-2.5">
                        <label className="block text-xs font-bold text-neutral-300">حالة نشر الفصول المستوردة:</label>
                        <div className="grid grid-cols-2 gap-3">
                          <button
                            type="button"
                            onClick={() => setCatalogPublishStatus('published')}
                            className={`p-3 rounded-xl text-xs font-bold transition-all border cursor-pointer flex flex-col items-center justify-center gap-1.5 text-center ${catalogPublishStatus === 'published' ? 'bg-crimson-950/20 text-crimson-400 border-crimson-900/40' : 'bg-obsidian-900 text-neutral-400 border-obsidian-800 hover:border-obsidian-750'}`}
                          >
                            <span className="font-bold">نشر فوري (نشط)</span>
                            <span className="text-[9px] text-neutral-500">تظهر الفصول للمستخدمين والقراء مباشرة</span>
                          </button>
                          <button
                            type="button"
                            onClick={() => setCatalogPublishStatus('draft')}
                            className={`p-3 rounded-xl text-xs font-bold transition-all border cursor-pointer flex flex-col items-center justify-center gap-1.5 text-center ${catalogPublishStatus === 'draft' ? 'bg-obsidian-900 text-neutral-300 border-obsidian-800 hover:border-obsidian-750' : 'bg-obsidian-900 text-neutral-400 border-obsidian-800 hover:border-obsidian-750'}`}
                          >
                            <span className="font-bold">حفظ كمسودة (مخفي)</span>
                            <span className="text-[9px] text-neutral-500">تظل مخفية وتظهر للإدارة فقط لمراجعتها أولاً</span>
                          </button>
                        </div>
                      </div>
                    </div>

                    {/* Action execution buttons */}
                    <div className="pt-4 border-t border-obsidian-900 flex flex-wrap gap-4 items-center justify-between">
                      <div className="flex gap-3">
                        <button
                          type="button"
                          onClick={handleStartCatalogImport}
                          className="bg-crimson-600 hover:bg-crimson-500 text-white font-bold text-xs py-3.5 px-8 rounded-xl shadow-lg shadow-crimson-900/20 transition-all flex items-center gap-2.5 cursor-pointer"
                        >
                          <Play className="w-4 h-4 fill-white animate-pulse" />
                          <span>إرسال طابور الكتالوج للعمل بالخلفية الآن</span>
                        </button>
                      </div>

                      <div className="text-neutral-400 text-xs">
                        💡 سيتم معالجة الكتالوج بأمان تام في الخلفية حتى لو أغلقت هذه الصفحة!
                      </div>
                    </div>
                  </div>
                )}

                {/* Live Console Output & Progress of Background Jobs */}
                {backgroundJobs.length > 0 && (
                  <div className="bg-obsidian-950 border border-obsidian-850 rounded-3xl p-6 md:p-8 space-y-6">
                    <h3 className="text-sm md:text-base font-extrabold text-white flex items-center gap-2 border-b border-obsidian-900 pb-3">
                      <Sliders className="w-5 h-5 text-crimson-500" /> مراقبة مهام الاستيراد في الخلفية (Background Queue Worker)
                    </h3>

                    <div className="space-y-6">
                      {backgroundJobs.map((job) => {
                        const total = job.items.length;
                        const current = job.currentIndex;
                        const percent = total > 0 ? Math.round((current / total) * 100) : 0;
                        const isExpanded = !!expandedJobLogs[job.id];

                        return (
                          <div key={job.id} className="bg-obsidian-900 border border-obsidian-850 rounded-2xl p-5 space-y-4">
                            {/* Header info */}
                            <div className="flex flex-wrap items-center justify-between gap-3">
                              <div className="space-y-1">
                                <div className="flex items-center gap-2">
                                  <span className="text-xs font-black text-white">معرف المهمة: #{job.id.substring(0, 8)}</span>
                                  <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-black ${
                                    job.status === 'running' ? 'bg-emerald-950 text-emerald-400 border border-emerald-900' :
                                    job.status === 'paused' ? 'bg-yellow-950 text-yellow-400 border border-yellow-900' :
                                    job.status === 'completed' ? 'bg-blue-950 text-blue-400 border border-blue-900' :
                                    job.status === 'stopped' ? 'bg-red-950 text-red-400 border border-red-900' :
                                    'bg-neutral-900 text-neutral-400 border border-neutral-800'
                                  }`}>
                                    {job.status === 'running' ? '● جاري الجلب' :
                                     job.status === 'paused' ? '⏸️ موقوف مؤقتاً' :
                                     job.status === 'completed' ? '✅ مكتمل' :
                                     job.status === 'stopped' ? '⏹️ ملغي' :
                                     '⏳ في الانتظار'}
                                  </span>
                                </div>
                                <p className="text-[10px] text-neutral-400">تاريخ البدء: {new Date(job.createdAt).toLocaleString('ar-EG')}</p>
                              </div>

                              {/* Action controls for each job */}
                              <div className="flex items-center gap-2">
                                {job.status === 'running' && (
                                  <button
                                    onClick={() => handlePauseJob(job.id)}
                                    className="bg-yellow-600/10 hover:bg-yellow-600/20 text-yellow-500 text-[10px] font-extrabold px-3 py-1.5 rounded-lg border border-yellow-500/30 transition-colors cursor-pointer"
                                  >
                                    ⏸️ إيقاف مؤقت
                                  </button>
                                )}
                                {job.status === 'paused' && (
                                  <button
                                    onClick={() => handleResumeJob(job.id)}
                                    className="bg-emerald-600/10 hover:bg-emerald-600/20 text-emerald-500 text-[10px] font-extrabold px-3 py-1.5 rounded-lg border border-emerald-500/30 transition-colors cursor-pointer"
                                  >
                                    ▶️ استئناف
                                  </button>
                                )}
                                {(job.status === 'running' || job.status === 'paused') && (
                                  <button
                                    onClick={() => handleStopJob(job.id)}
                                    className="bg-red-600/10 hover:bg-red-600/20 text-red-500 text-[10px] font-extrabold px-3 py-1.5 rounded-lg border border-red-500/30 transition-colors cursor-pointer"
                                  >
                                    ⏹️ إلغاء ومسح الطابور
                                  </button>
                                )}
                                {(job.status === 'completed' || job.status === 'stopped') && (
                                  <button
                                    onClick={() => handleDeleteJob(job.id)}
                                    className="bg-neutral-800 hover:bg-neutral-750 text-neutral-400 text-[10px] font-extrabold px-3 py-1.5 rounded-lg border border-neutral-700 transition-colors cursor-pointer"
                                  >
                                    🗑️ مسح السجل
                                  </button>
                                )}
                              </div>
                            </div>

                            {/* Job Stats metrics */}
                            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                              <div className="bg-obsidian-950 border border-obsidian-850 p-3 rounded-xl text-right">
                                <span className="text-[9px] text-neutral-400 block font-bold">التقدم الإجمالي:</span>
                                <span className="text-sm font-black text-white">{current} / {total} أعمال</span>
                              </div>
                              <div className="bg-obsidian-950 border border-obsidian-850 p-3 rounded-xl text-right">
                                <span className="text-[9px] text-emerald-400 block font-bold">نجح استيراد:</span>
                                <span className="text-sm font-black text-emerald-400">{job.successCount} عمل</span>
                              </div>
                              <div className="bg-obsidian-950 border border-obsidian-850 p-3 rounded-xl text-right">
                                <span className="text-[9px] text-red-400 block font-bold">فشل استيراد:</span>
                                <span className="text-sm font-black text-red-400">{job.failedCount} عمل</span>
                              </div>
                              <div className="bg-obsidian-950 border border-obsidian-850 p-3 rounded-xl text-right">
                                <span className="text-[9px] text-neutral-400 block font-bold">مستوى الفصول / النشر:</span>
                                <span className="text-[10px] font-black text-white block truncate">{job.chaptersCount === -1 ? 'جميعها' : `آخر ${job.chaptersCount}`} / {job.publishStatus === 'published' ? 'منشور' : 'مسودة'}</span>
                              </div>
                            </div>

                            {/* Progress Bar */}
                            <div className="space-y-1">
                              <div className="flex justify-between text-[10px] font-bold text-neutral-400">
                                <span>نسبة الإنجاز:</span>
                                <span>{percent}%</span>
                              </div>
                              <div className="w-full bg-obsidian-950 rounded-full h-2 overflow-hidden border border-obsidian-850">
                                <div
                                  className="bg-crimson-600 h-full rounded-full transition-all duration-500"
                                  style={{ width: `${percent}%` }}
                                ></div>
                              </div>
                            </div>

                            {/* Logs fold/unfold toggler */}
                            <div className="space-y-2">
                              <button
                                type="button"
                                onClick={() => setExpandedJobLogs(prev => ({ ...prev, [job.id]: !prev[job.id] }))}
                                className="text-xs font-bold text-crimson-500 hover:text-crimson-400 transition-colors flex items-center gap-1 cursor-pointer"
                              >
                                {isExpanded ? '▼ إخفاء سجل العمليات التفصيلي للعملية' : '▶️ عرض سجل العمليات التفصيلي ومخرجات السيرفر'}
                              </button>

                              {isExpanded && (
                                <div className="bg-black/95 border border-obsidian-850 rounded-xl p-4 h-48 overflow-y-auto font-mono text-[10px] text-green-400 space-y-1 custom-scrollbar text-left leading-relaxed">
                                  {job.logs.length === 0 ? (
                                    <div className="text-neutral-500 italic">[لا توجد سجلات حتى الآن، بانتظار بدء الجدولة...]</div>
                                  ) : (
                                    job.logs.map((logLine, idx) => {
                                      let colorClass = 'text-green-400';
                                      if (logLine.includes('❌') || logLine.toLowerCase().includes('failed') || logLine.toLowerCase().includes('error')) colorClass = 'text-red-400';
                                      else if (logLine.includes('✅') || logLine.toLowerCase().includes('success')) colorClass = 'text-emerald-400';
                                      else if (logLine.includes('⚠️') || logLine.includes('⏸️')) colorClass = 'text-yellow-400';
                                      return (
                                        <div key={idx} className={`${colorClass} whitespace-pre-wrap`}>
                                          {logLine}
                                        </div>
                                      );
                                    })
                                  )}
                                  {job.status === 'running' && (
                                    <div className="text-white animate-pulse">
                                      [System] ⏳ جاري جلب العمل التالي وتفاصيله...
                                    </div>
                                  )}
                                </div>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}

                {/* Persistent Crawler Failures History Widget (LocalStorage) */}
                <div className="bg-obsidian-950 border border-obsidian-850 rounded-3xl p-6 md:p-8 space-y-6">
                  <div className="flex items-center justify-between border-b border-obsidian-900 pb-3 flex-wrap gap-3 text-right">
                    <h3 className="text-sm md:text-base font-extrabold text-white flex items-center gap-2">
                      <ShieldAlert className="w-5 h-5 text-rose-500" /> سجل إخفاقات وأعطال جالب الكتالوج (Failure Logging Database)
                    </h3>
                    {crawlerFailures.length > 0 && (
                      <button
                        onClick={handleClearFailureLogs}
                        className="bg-rose-950/30 hover:bg-rose-950/50 text-rose-400 border border-rose-900/30 font-bold text-[10px] py-1.5 px-3.5 rounded-lg transition-colors cursor-pointer flex items-center gap-1"
                      >
                        <Trash2 className="w-3 h-3" /> تفريغ السجل بالكامل
                      </button>
                    )}
                  </div>

                  {crawlerFailures.length === 0 ? (
                    <div className="text-center py-10 space-y-2 bg-obsidian-900/40 border border-obsidian-900/30 rounded-2xl">
                      <CheckCircle className="w-10 h-10 text-emerald-500 mx-auto" />
                      <p className="text-xs text-neutral-300 font-bold">لا توجد أي إخفاقات مسجلة حالياً في النظام!</p>
                      <p className="text-[10px] text-neutral-500">جالب الكتالوج بالخلفية يعمل بأعلى معايير الاستقرار والسرعة دون تعثرات.</p>
                    </div>
                  ) : (
                    <div className="space-y-4">
                      <p className="text-xs text-neutral-400 text-right">
                        يتم حفظ السجلات التالية محلياً في متصفحك (`localStorage`) لمساعدتك في تعقب الروابط التالفة أو الأعمال التي تعثرت بسبب حماية الشبكة أو Cloudflare:
                      </p>
                      
                      <div className="border border-obsidian-900 rounded-2xl overflow-hidden max-h-[420px] overflow-y-auto custom-scrollbar">
                        <table className="w-full text-right text-xs">
                          <thead>
                            <tr className="bg-obsidian-900 border-b border-obsidian-850 text-neutral-400 font-bold">
                              <th className="p-4">العمل المتعثر</th>
                              <th className="p-4">الرابط المستهدف</th>
                              <th className="p-4">سبب الفشل والتشخيص</th>
                              <th className="p-4 text-left">تاريخ الإخفاق</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-obsidian-900 bg-black/25">
                            {crawlerFailures.map((fail) => (
                              <tr key={fail.id} className="hover:bg-obsidian-900/30 transition-colors">
                                <td className="p-4 font-extrabold text-neutral-200">
                                  {fail.title}
                                </td>
                                <td className="p-4 font-mono text-[10px] text-neutral-400 truncate max-w-xs" dir="ltr">
                                  <a href={fail.url} target="_blank" rel="noopener noreferrer" className="hover:text-crimson-400 flex items-center gap-1">
                                    {fail.url} <ExternalLink className="w-3 h-3 shrink-0" />
                                  </a>
                                </td>
                                <td className="p-4">
                                  <span className="px-2 py-1 rounded-lg bg-rose-950/30 border border-rose-900/30 text-rose-400 text-[10px] block w-fit">
                                    {fail.error}
                                  </span>
                                </td>
                                <td className="p-4 text-left text-neutral-500 text-[10px] font-mono">
                                  {new Date(fail.timestamp).toLocaleString('ar-EG')}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )}



            {/* TAB: AD ZONES */}
            {activeTab === 'ads' && (
              <div className="space-y-6">
                <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 border-b border-obsidian-800 pb-4">
                  <div>
                    <h2 className="text-xl font-black text-white">نظام الإعلانات الذكي والمتكامل (Smart Ads System)</h2>
                    <p className="text-xs text-neutral-400 mt-1">تفعيل وإدارة صيغ الإعلانات المتقدمة المتوافقة بالكامل مع Popunder, Interstitial, Social Bar, In-Page Push, Sticky Banners, Native Ads, و Banner Ads لتعظيم أرباح موقعك بسهولة وبشكل متوافق مع كافة شبكات الإعلانات مثل Adsterra, PropellerAds, Monetag, و Google AdSense.</p>
                  </div>
                  <button
                    onClick={handleResetAds}
                    className="bg-crimson-600/20 hover:bg-crimson-600 text-crimson-400 hover:text-white border border-crimson-600/40 px-4 py-2.5 rounded-xl text-xs font-bold transition-all shrink-0 cursor-pointer flex items-center gap-2 font-sans"
                  >
                    <RefreshCw className="w-3.5 h-3.5" /> استعادة ودمج كافة المساحات الإعلانية الـ 9
                  </button>
                </div>

                {/* GLOBAL ADS MASTER SWITCH FOR ADMIN */}
                <div className={`p-6 rounded-3xl border transition-all shadow-xl flex flex-col md:flex-row items-start md:items-center justify-between gap-6 ${siteSettings?.globalAdsEnabled !== false ? 'bg-emerald-950/20 border-emerald-800/40' : 'bg-crimson-950/20 border-crimson-800/40'}`}>
                  <div className="space-y-2 text-right">
                    <div className="flex items-center gap-2">
                      <div className={`w-3 h-3 rounded-full animate-pulse ${siteSettings?.globalAdsEnabled !== false ? 'bg-emerald-500' : 'bg-crimson-500'}`} />
                      <h3 className="text-base font-black text-white font-sans">
                        التحكم الإداري الرئيسي في الإعلانات (Admin Global Ads Control)
                      </h3>
                    </div>
                    <p className="text-xs text-neutral-300 font-sans leading-relaxed">
                      {siteSettings?.globalAdsEnabled !== false
                        ? '🟢 الإعلانات مفعلة حالياً وتظهر لجميع زوار ومستخدمي الموقع بناءً على إعدادات المساحات المحددة أدناه.'
                        : '🔴 جميع الإعلانات موقوفة ومخفية مؤقتاً عن جميع الزوار والمستخدمين بقرار الأدمن.'}
                    </p>
                  </div>
                  <button
                    onClick={handleToggleGlobalAds}
                    className={`px-6 py-3.5 rounded-2xl text-xs font-black transition-all cursor-pointer shadow-lg flex items-center gap-2 shrink-0 font-sans ${
                      siteSettings?.globalAdsEnabled !== false
                        ? 'bg-crimson-600 hover:bg-crimson-500 text-white shadow-crimson-600/20'
                        : 'bg-emerald-600 hover:bg-emerald-500 text-white shadow-emerald-600/20'
                    }`}
                  >
                    {siteSettings?.globalAdsEnabled !== false ? (
                      <>
                        <ToggleRight className="w-5 h-5 text-white" /> إيقاف وتعطيل جميع الإعلانات مؤقتاً في الموقع
                      </>
                    ) : (
                      <>
                        <ToggleLeft className="w-5 h-5 text-white" /> تشغيل وتفعيل جميع الإعلانات لكافة الزوار
                      </>
                    )}
                  </button>
                </div>

                {/* EDITING AD FORM */}
                {editingAd && (
                  <form onSubmit={handleUpdateAd} className="bg-obsidian-950 border border-crimson-900/30 rounded-3xl p-6 md:p-8 space-y-6">
                    <div className="flex items-center justify-between border-b border-obsidian-900 pb-4">
                      <h3 className="font-extrabold text-sm text-crimson-500 font-sans">تعديل كود مساحة الإعلانات: {editingAd.name}</h3>
                      <button 
                        type="button" 
                        onClick={() => setEditingAd(null)}
                        className="text-xs text-neutral-500 hover:text-white transition-colors cursor-pointer"
                      >
                        إلغاء التعديل
                      </button>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <label className="block text-xs font-bold text-neutral-400 mb-1.5 font-sans text-right">اسم مساحة الإعلانات:</label>
                        <input
                          type="text"
                          required
                          value={editingAd.name}
                          onChange={(e) => setEditingAd({ ...editingAd, name: e.target.value })}
                          className="w-full bg-obsidian-900 border border-obsidian-800 text-white px-4 py-3 rounded-xl text-xs outline-none focus:border-crimson-600 transition-colors text-right"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-bold text-neutral-400 mb-1.5 font-sans text-right">موضع مساحة الإعلان (Position):</label>
                        <select
                          value={editingAd.position}
                          onChange={(e) => setEditingAd({ ...editingAd, position: e.target.value as any })}
                          className="w-full bg-obsidian-900 border border-obsidian-800 text-white px-4 py-3 rounded-xl text-xs outline-none focus:border-crimson-600 transition-colors text-right"
                        >
                          <option value="top">أعلى الصفحة (Banner Ads - Top)</option>
                          <option value="bottom">أسفل الصفحة (Banner Ads - Bottom)</option>
                          <option value="between_chapters">بين الفصول (Between Chapters)</option>
                          <option value="reader_side">بجانب القارئ (Reader Side)</option>
                          <option value="sidebar">شريط جانبي أو تفاصيل العمل (Sidebar)</option>
                          <option value="footer">تذييل الصفحة (Footer)</option>
                          <option value="popunder">إعلان بوب أندر خلف الكواليس (Popunder Ads)</option>
                          <option value="interstitial">إعلان ملء الشاشة الانتقالي (Interstitial Ads)</option>
                          <option value="social_bar">شريط الإشعارات الاجتماعي (Social Bar)</option>
                          <option value="in_page_push">إشعار دفعي داخل الصفحة (In-Page Push)</option>
                          <option value="sticky_banner">بنر ملتصق أسفل الشاشة (Sticky Banner)</option>
                          <option value="native_ads">إعلانات مدمجة وموصى بها (Native Ads Grid)</option>
                        </select>
                      </div>
                    </div>

                    <div>
                      <div className="flex justify-between items-center mb-1.5">
                        <label className="block text-xs font-bold text-neutral-400 font-sans text-right">كود الإعلان (HTML / JS Script Block):</label>
                        <span className="text-[10px] text-neutral-500 font-mono">يدعم كود Google AdSense أو أكواد الميديا والبنرات المباشرة</span>
                      </div>
                      <textarea
                        required
                        rows={6}
                        value={editingAd.code}
                        onChange={(e) => setEditingAd({ ...editingAd, code: e.target.value })}
                        placeholder="الصق كود الـ <script> الخاص بـ AdSense أو كود HTML للبنر هنا..."
                        className="w-full bg-obsidian-900 border border-obsidian-800 text-white p-4 rounded-xl text-xs font-mono outline-none focus:border-crimson-600 transition-colors text-left dir-ltr"
                      />
                    </div>

                    <div className="flex justify-end gap-3 pt-2">
                      <button
                        type="button"
                        onClick={() => setEditingAd(null)}
                        className="bg-obsidian-900 border border-obsidian-850 hover:border-neutral-700 text-neutral-400 hover:text-white px-5 py-2.5 rounded-xl text-xs transition-colors cursor-pointer"
                      >
                        إلغاء
                      </button>
                      <button
                        type="submit"
                        className="bg-crimson-600 hover:bg-crimson-500 text-white font-bold px-6 py-2.5 rounded-xl text-xs transition-colors cursor-pointer flex items-center gap-1.5"
                      >
                        <Save className="w-4 h-4" /> حفظ التغييرات
                      </button>
                    </div>
                  </form>
                )}

                <div className="grid grid-cols-1 gap-6">
                  {ads.map(ad => (
                    <div key={ad.id} className="bg-obsidian-950 border border-obsidian-850 rounded-3xl p-6 flex flex-col md:flex-row items-start md:items-center justify-between gap-6 shadow-md">
                      <div className="space-y-1.5 flex-1 text-right">
                        <h4 className="font-extrabold text-sm text-white font-sans">{ad.name}</h4>
                        <p className="text-xs text-neutral-500">
                          موضع المساحة: <strong className="text-neutral-300 font-mono">{ad.position}</strong>
                        </p>
                        <div className="max-w-xl text-[10px] text-neutral-600 font-mono bg-obsidian-900 p-2.5 rounded-lg select-all border border-obsidian-800 overflow-x-auto truncate text-left dir-ltr">
                          {ad.code}
                        </div>
                      </div>

                      {/* Actions */}
                      <div className="flex items-center gap-6 shrink-0">
                        <button
                          onClick={() => setEditingAd(ad)}
                          className="bg-obsidian-900 hover:bg-obsidian-850 text-neutral-300 hover:text-white px-4 py-2 rounded-xl text-xs font-bold transition-all border border-obsidian-800 hover:border-neutral-700 cursor-pointer flex items-center gap-1.5"
                        >
                          <Edit2 className="w-3.5 h-3.5" /> تعديل الكود
                        </button>

                        <div className="flex items-center gap-2">
                          <span className="text-xs font-bold text-neutral-400 font-sans">حالة العرض:</span>
                          <button
                            onClick={() => handleToggleAd(ad.id, !ad.active)}
                            className="text-neutral-400 hover:text-white transition-colors cursor-pointer"
                          >
                            {ad.active ? (
                              <ToggleRight className="w-12 h-12 text-crimson-600" />
                            ) : (
                              <ToggleLeft className="w-12 h-12 text-obsidian-700" />
                            )}
                          </button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* TAB: REPORTS & DMCA */}
            {activeTab === 'reports' && (
              <div className="space-y-6">
                <h2 className="text-xl font-black text-white">بلاغات ومقترحات القراء القادمة</h2>
                
                {reports.length === 0 ? (
                  <p className="text-xs text-neutral-500 text-center py-8">لا توجد أي بلاغات معلقة أو طلبات قادمة من المتابعين حالياً.</p>
                ) : (
                  <div className="space-y-4">
                    {reports.map(r => (
                      <div
                        key={r.id}
                        className={`p-5 rounded-3xl border text-right space-y-3 shadow-sm ${r.status === 'resolved' ? 'bg-obsidian-950/40 border-obsidian-900/60 text-neutral-500' : 'bg-obsidian-950 border-crimson-900/20 text-white'}`}
                      >
                        <div className="flex items-center justify-between border-b border-obsidian-850 pb-2.5">
                          <span className={`px-2.5 py-1 rounded-lg text-[10px] font-bold ${r.type === 'dmca' ? 'bg-crimson-950 text-crimson-500' : 'bg-obsidian-900 text-neutral-400'}`}>
                            نوع البلاغ: {r.type === 'dmca' ? 'بلاغ حقوق ملكية (DMCA)' : r.type === 'bug' ? 'مشكلة تقنية / خلل' : 'طلب إضافة عمل'}
                          </span>
                          <span className="text-[10px] text-neutral-500 font-sans">{new Date(r.addedAt).toLocaleString('ar-EG')}</span>
                        </div>

                        <p className="text-xs text-neutral-300 leading-relaxed">{r.description}</p>
                        
                        <div className="flex justify-between items-center text-[10px] text-neutral-400 pt-2 border-t border-obsidian-850/60">
                          <span>البريد الإلكتروني للراسل: <strong className="text-white font-sans">{r.userEmail}</strong></span>
                          {r.status === 'pending' ? (
                            <button
                               onClick={() => handleResolveReport(r.id)}
                               className="bg-emerald-950 hover:bg-emerald-600 text-emerald-400 hover:text-white border border-emerald-900/30 px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer font-sans"
                            >
                              تعليم كـ "محلول ومكتمل"
                            </button>
                          ) : (
                            <span className="text-emerald-500 font-bold flex items-center gap-1 font-sans">
                              <CheckCircle className="w-3.5 h-3.5" /> تم معالجة البلاغ بنجاح
                            </span>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* TAB: SYSTEM AUDIT LOGS */}
            {activeTab === 'logs' && (
              <div className="space-y-6">
                <h2 className="text-xl font-black text-white">سجل تدقيق الإجراءات والعمليات الإدارية (Logs)</h2>
                <div className="bg-obsidian-950 border border-obsidian-850 rounded-3xl p-6 space-y-4 shadow-md max-h-[500px] overflow-y-auto">
                  {logs.map(l => (
                    <div key={l.id} className="text-right border-b border-obsidian-850/40 pb-3 last:border-0 last:pb-0 text-xs">
                      <div className="flex items-center justify-between gap-4 text-neutral-500 text-[10px] mb-1">
                        <span>المنفذ: <strong className="text-crimson-500 font-sans">{l.userEmail}</strong></span>
                        <span className="font-mono">{new Date(l.timestamp).toLocaleString('ar-EG')}</span>
                      </div>
                      <p className="text-white font-bold mb-1">إجراء: {l.action}</p>
                      <p className="text-neutral-400 text-[11px] pr-4 border-r border-crimson-900">{l.description}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* TAB: BACKUP & RESTORE */}
            {activeTab === 'backup' && (
              <div className="space-y-6">
                <div className="border-b border-obsidian-800 pb-4">
                  <h2 className="text-xl font-black text-white">أدوات النسخ الاحتياطي والاستعادة الفورية</h2>
                  <p className="text-xs text-neutral-400 mt-1">تتيح لك هذه اللوحة تصدير كامل قاعدة البيانات على هيئة نص مشفر لحمايتها، أو استعادة نسخة احتياطية سابقة من ملف خارجي.</p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                  {/* Backup */}
                  <div className="bg-obsidian-950 border border-obsidian-850 p-6 rounded-3xl space-y-4 shadow-md">
                    <h3 className="font-extrabold text-sm text-white">تصدير قاعدة بيانات الموقع (Export)</h3>
                    <p className="text-xs text-neutral-500">اضغط على الزر لإنتاج نص كامل قاعدة البيانات وحفظه محلياً لحمايته.</p>
                    <button
                      onClick={handleBackup}
                      className="bg-crimson-600 hover:bg-crimson-500 text-white font-bold px-5 py-3 rounded-xl text-xs transition-colors cursor-pointer font-sans"
                    >
                      توليد وتصدير النسخة الاحتياطية
                    </button>
                    {backupString && (
                      <textarea
                        readOnly
                        value={backupString}
                        className="w-full bg-obsidian-900 border border-obsidian-800 text-[10px] text-emerald-400 font-mono p-3 rounded-xl select-all h-40 outline-none"
                      />
                    )}
                  </div>

                  {/* Restore */}
                  <div className="bg-obsidian-950 border border-obsidian-850 p-6 rounded-3xl space-y-4 shadow-md">
                    <h3 className="font-extrabold text-sm text-white">استيراد واستعادة قاعدة البيانات (Import)</h3>
                    <p className="text-xs text-neutral-500">الصق نص النسخة الاحتياطية التي تم تصديرها سابقاً في الحقل التالي للاستعادة.</p>
                    <textarea
                      value={restoreString}
                      onChange={(e) => setRestoreString(e.target.value)}
                      placeholder="الصق النص البرمجي للنسخة الاحتياطية هنا..."
                      className="w-full bg-obsidian-900 border border-obsidian-800 text-[10px] text-white font-mono p-3 rounded-xl h-40 outline-none"
                    />
                    <button
                      onClick={handleRestore}
                      className="bg-obsidian-900 hover:bg-crimson-600 border border-obsidian-800 hover:border-transparent text-neutral-400 hover:text-white font-bold px-5 py-3 rounded-xl text-xs transition-all cursor-pointer font-sans"
                    >
                      بدء استيراد واستعادة البيانات
                    </button>
                  </div>
                </div>
              </div>
            )}
          </motion.div>
        </AnimatePresence>
      </div>

      {/* PROFESSIONAL DELETE CONFIRMATION MODAL */}
      <AnimatePresence>
        {seriesToDelete && (
          <div className="fixed inset-0 bg-black/80 backdrop-blur-md z-50 flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 20 }}
              className="bg-obsidian-950 border border-crimson-900/50 rounded-3xl max-w-lg w-full p-6 md:p-8 space-y-6 text-right shadow-2xl relative overflow-hidden"
            >
              {/* Ambient Background Glow */}
              <div className="absolute top-0 right-0 w-32 h-32 bg-crimson-600/10 rounded-full blur-3xl pointer-events-none" />
              
              <div className="flex items-start gap-4">
                <div className="bg-red-950/40 p-3.5 rounded-2xl border border-red-900/30 text-crimson-500 shrink-0">
                  <ShieldAlert className="w-8 h-8 animate-pulse" />
                </div>
                <div className="space-y-1.5 flex-1">
                  <h3 className="font-sans font-black text-lg text-white">حذف العمل وإزالته نهائياً!</h3>
                  <p className="text-xs text-neutral-400 leading-relaxed">
                    أنت على وشك حذف عمل المانجا <span className="text-white font-extrabold">"{seriesToDelete.titleAr}"</span> بالكامل من الخادم الرئيسي.
                  </p>
                </div>
              </div>

              {/* Warning Details Panel */}
              <div className="bg-black/40 border border-obsidian-850 p-4 rounded-2xl space-y-2.5 text-xs">
                <span className="font-bold text-red-400 block mb-1">التبعات والإجراءات التلقائية المترتبة على الحذف:</span>
                <ul className="space-y-1.5 text-neutral-400 pr-4 list-disc list-outside">
                  <li>سيتم إزالة <b className="text-white">جميع فصول العمل</b> وصور الصفحات بالكامل.</li>
                  <li>سيتم حذف <b className="text-white">كافة تعليقات الأعضاء والردود</b> المسجلة على فصول هذا العمل.</li>
                  <li>سيتم مسح <b className="text-white">التقييمات، الإحصاءات، التفاعلات، ومفضلة القراء</b> الخاصة بالعمل.</li>
                  <li>سيتم إخلاء سجلات القراءة والمشاهدة التاريخية المرتبطة به.</li>
                </ul>
              </div>

              {/* Security Confirmation Step */}
              <div className="space-y-3">
                <label className="block text-xs text-neutral-300 font-bold leading-relaxed">
                  لتجنب الحذف غير المقصود، يرجى كتابة اسم العمل <span className="text-crimson-500 font-mono font-extrabold select-all">"{seriesToDelete.titleAr}"</span> أو كلمة <span className="text-crimson-500 font-mono font-extrabold select-all">DELETE</span> أدناه:
                </label>
                <input
                  type="text"
                  placeholder={seriesToDelete.titleAr}
                  value={deleteConfirmName}
                  onChange={(e) => setDeleteConfirmName(e.target.value)}
                  className="w-full bg-obsidian-900 border border-obsidian-800 text-white px-4 py-3 rounded-2xl text-xs outline-none focus:border-crimson-500 transition-colors text-right"
                />
              </div>

              {/* Actions */}
              <div className="flex flex-col sm:flex-row gap-3 pt-2">
                <button
                  type="button"
                  onClick={handleExecuteDeleteSeries}
                  disabled={isDeletingSeries || (deleteConfirmName !== seriesToDelete.titleAr && deleteConfirmName !== 'DELETE')}
                  className="bg-crimson-600 hover:bg-crimson-500 disabled:bg-neutral-800 text-white font-bold py-3 px-6 rounded-2xl text-xs transition-all flex-1 cursor-pointer flex items-center justify-center gap-1.5 disabled:cursor-not-allowed"
                >
                  {isDeletingSeries ? (
                    <>
                      <span className="border-2 border-white/20 border-t-white w-4.5 h-4.5 rounded-full animate-spin"></span>
                      <span>جاري التدمير الآمن...</span>
                    </>
                  ) : (
                    <>
                      <Trash2 className="w-4 h-4" />
                      <span>تأكيد الحذف النهائي الشامل</span>
                    </>
                  )}
                </button>
                <button
                  type="button"
                  onClick={() => setSeriesToDelete(null)}
                  disabled={isDeletingSeries}
                  className="bg-neutral-900 hover:bg-neutral-850 text-neutral-400 border border-neutral-800 py-3 px-6 rounded-2xl text-xs transition-all cursor-pointer font-bold"
                >
                  إلغاء التراجع
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* PROFESSIONAL DELETE ALL CONFIRMATION MODAL */}
      <AnimatePresence>
        {showDeleteAllConfirm && (
          <div className="fixed inset-0 bg-black/85 backdrop-blur-md z-50 flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 20 }}
              className="bg-obsidian-950 border border-red-900/60 rounded-3xl max-w-lg w-full p-6 md:p-8 space-y-6 text-right shadow-2xl relative overflow-hidden"
            >
              {/* Ambient Background Glow */}
              <div className="absolute top-0 right-0 w-32 h-32 bg-red-600/10 rounded-full blur-3xl pointer-events-none" />
              
              <div className="flex items-start gap-4">
                <div className="bg-red-950/50 p-3.5 rounded-2xl border border-red-900/40 text-red-500 shrink-0">
                  <ShieldAlert className="w-8 h-8 animate-bounce" />
                </div>
                <div className="space-y-1.5 flex-1">
                  <h3 className="font-sans font-black text-lg text-white">⚠️ تحذير أمني خطير جداً! ⚠️</h3>
                  <h4 className="font-bold text-xs text-red-400">أنت على وشك مسح وإبادة كافة أعمال الموقع ومحتوياتها دفعة واحدة!</h4>
                </div>
              </div>

              {/* Warning Details Panel */}
              <div className="bg-black/50 border border-red-950 p-4 rounded-2xl space-y-2.5 text-xs">
                <span className="font-black text-red-400 block mb-1">التبعات الكارثية لهذا الإجراء النهائي:</span>
                <ul className="space-y-1.5 text-neutral-400 pr-4 list-disc list-outside leading-relaxed">
                  <li>سيتم <b className="text-white">حذف كافة المنهوات والقصص والمانجا</b> بدون أي استثناء.</li>
                  <li>سيتم <b className="text-white">مسح كل الفصول المرفوعة وصورها بالكامل</b> من النظام.</li>
                  <li>سيتم تفريغ تعليقات الأعضاء والردود والتقييمات والمفضلة وتاريخ القراءة فوراً.</li>
                  <li>هذا الإجراء <b className="text-red-500 font-bold">نهائي ولا يمكن التراجع عنه</b> إلا في حال وجود نسخة احتياطية سابقة لديك.</li>
                </ul>
              </div>

              {/* Security Confirmation Step */}
              <div className="space-y-3">
                <label className="block text-xs text-neutral-300 font-bold leading-relaxed">
                  لتأكيد عملية المسح الإبادي الشامل لكافة محتويات الموقع، يرجى كتابة الكلمة التأكيدية التالية <span className="text-red-500 font-mono font-black select-all px-2 py-0.5 bg-red-950/40 rounded border border-red-900/30">DELETE_ALL</span> أدناه:
                </label>
                <input
                  type="text"
                  placeholder="DELETE_ALL"
                  value={deleteAllConfirmInput}
                  onChange={(e) => setDeleteAllConfirmInput(e.target.value)}
                  className="w-full bg-obsidian-900 border border-obsidian-800 text-white px-4 py-3 rounded-2xl text-xs outline-none focus:border-red-500 transition-colors text-center font-mono font-bold"
                />
              </div>

              {/* Actions */}
              <div className="flex flex-col sm:flex-row gap-3 pt-2">
                <button
                  type="button"
                  onClick={handleExecuteDeleteAllSeries}
                  disabled={isDeletingAllSeries || deleteAllConfirmInput !== 'DELETE_ALL'}
                  className="bg-red-600 hover:bg-red-500 disabled:bg-neutral-800 text-white font-bold py-3 px-6 rounded-2xl text-xs transition-all flex-1 cursor-pointer flex items-center justify-center gap-1.5 disabled:cursor-not-allowed"
                >
                  {isDeletingAllSeries ? (
                    <>
                      <span className="border-2 border-white/20 border-t-white w-4.5 h-4.5 rounded-full animate-spin"></span>
                      <span>جاري إبادة قاعدة البيانات...</span>
                    </>
                  ) : (
                    <>
                      <Trash2 className="w-4 h-4" />
                      <span>نعم، ابدأ عملية الإبادة الشاملة لحسابي الخاص</span>
                    </>
                  )}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setShowDeleteAllConfirm(false);
                    setDeleteAllConfirmInput('');
                  }}
                  disabled={isDeletingAllSeries}
                  className="bg-neutral-900 hover:bg-neutral-850 text-neutral-400 border border-neutral-800 py-3 px-6 rounded-2xl text-xs transition-all cursor-pointer font-bold"
                >
                  إلغاء وتراجع فوراً
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Floating Sticky Bottom Progress Bar for Mass Auto Import */}
      <AnimatePresence>
        {(autoImportStatus === 'running' || autoImportStatus === 'paused' || autoImportStatus === 'completed') && (
          <motion.div
            initial={{ opacity: 0, y: 50, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 50, scale: 0.95 }}
            className={`fixed bottom-4 left-4 right-4 md:left-1/2 md:-translate-x-1/2 md:max-w-3xl bg-black/95 backdrop-blur-xl border ${
              autoImportStatus === 'completed' ? 'border-emerald-500/40 shadow-[0_10px_40px_rgba(16,185,129,0.3)]' : 'border-crimson-900/40 shadow-[0_10px_40px_rgba(220,38,38,0.35)]'
            } p-4 rounded-2xl z-50 flex flex-col md:flex-row items-center justify-between gap-4 font-sans text-right`}
          >
            {/* Left Side: Stats and Info */}
            <div className="w-full md:w-auto flex-1 space-y-1.5 text-right">
              <div className="flex items-center justify-start gap-3">
                <span className="flex h-2.5 w-2.5 relative">
                  {autoImportStatus === 'running' ? (
                    <>
                      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                      <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-500"></span>
                    </>
                  ) : autoImportStatus === 'completed' ? (
                    <CheckCircle className="h-3.5 w-3.5 text-emerald-400" />
                  ) : (
                    <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-amber-500"></span>
                  )}
                </span>
                <span className="text-xs font-bold text-white">
                  {autoImportStatus === 'completed' ? (
                    <span className="text-emerald-400 font-extrabold font-sans">✓ تم الإنجاز والضخ التلقائي بنجاح باهر!</span>
                  ) : autoImportStatus === 'running' ? (
                    'جاري سحب ونشر الفصول تلقائياً...'
                  ) : (
                    'عملية السحب موقوفة مؤقتاً'
                  )}
                </span>
                <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold font-mono ${
                  autoImportStatus === 'completed' ? 'bg-emerald-950/60 border border-emerald-800/20 text-emerald-400' : 'bg-crimson-950/60 border border-crimson-800/20 text-crimson-400'
                }`}>
                  {autoImportProgress.current} / {autoImportProgress.total} فصول
                </span>
              </div>

              {/* Progress percentage & ETA */}
              <div className="flex items-center justify-between text-[11px] text-neutral-400">
                <div className="flex items-center gap-1">
                  <span>{autoImportStatus === 'completed' ? 'الحالة النهائية:' : 'المتبقي:'}</span>
                  <strong className={`font-mono font-black ${autoImportStatus === 'completed' ? 'text-emerald-400' : 'text-amber-400'}`}>
                    {autoImportStatus === 'completed' ? 'تم جلب ونشر كافة الفصول بنجاح' : `${autoImportProgress.total - autoImportProgress.current} فصول`}
                  </strong>
                </div>
                {autoImportStatus !== 'completed' && (
                  <div className="text-neutral-500 font-mono text-left">
                    {getEtaString()}
                  </div>
                )}
              </div>

              {/* Fluid Progress Bar */}
              <div className="w-full bg-neutral-900 rounded-full h-2.5 overflow-hidden p-[1px] border border-neutral-800">
                <div
                  className={`h-full rounded-full transition-all duration-500 ${
                    autoImportStatus === 'completed' ? 'bg-gradient-to-r from-emerald-600 to-teal-400' : 'bg-gradient-to-r from-crimson-600 via-amber-500 to-emerald-500'
                  }`}
                  style={{ width: `${autoImportStatus === 'completed' ? 100 : (autoImportProgress.current / autoImportProgress.total) * 100}%` }}
                ></div>
              </div>
            </div>

            {/* Right Side: Quick Action Controls */}
            <div className="flex items-center gap-2 shrink-0">
              {autoImportStatus === 'completed' ? (
                <>
                  {autoImportSeriesId && (
                    <button
                      type="button"
                      onClick={() => onNavigate('details', { id: autoImportSeriesId })}
                      className="bg-emerald-600 hover:bg-emerald-500 text-white font-black text-xs py-2 px-3.5 rounded-xl transition-all cursor-pointer flex items-center gap-1 shadow-md"
                    >
                      <ExternalLink className="w-3.5 h-3.5" />
                      عرض المانهوا
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => {
                      setAutoImportStatus('idle');
                      setAutoImportChapters([]);
                      setAutoImportProgress({
                        current: 0,
                        total: 0,
                        success: 0,
                        failed: 0,
                        logs: ['ℹ️ تم إعادة تعيين معالجات ومسارات الزاحف التلقائي.'],
                        runningTasks: []
                      });
                    }}
                    className="bg-neutral-900 hover:bg-neutral-800 text-neutral-300 border border-neutral-800 text-xs py-2 px-3.5 rounded-xl transition-all cursor-pointer font-bold"
                  >
                    إنهاء وإغلاق
                  </button>
                </>
              ) : (
                <>
                  {autoImportStatus === 'running' ? (
                    <button
                      type="button"
                      onClick={handlePauseAutoImport}
                      className="bg-amber-600 hover:bg-amber-500 text-black font-black text-xs py-2 px-3.5 rounded-xl transition-all cursor-pointer flex items-center gap-1 shadow-md"
                    >
                      <span className="w-2 h-2 bg-black rounded-full"></span>
                      إيقاف مؤقت
                    </button>
                  ) : (
                    <button
                      type="button"
                      onClick={handleResumeAutoImport}
                      className="bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs py-2 px-3.5 rounded-xl transition-all cursor-pointer flex items-center gap-1 shadow-md"
                    >
                      <Play className="w-3.5 h-3.5" />
                      استئناف
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={handleStopAutoImport}
                    className="bg-neutral-900 hover:bg-rose-950 hover:text-rose-400 text-neutral-400 border border-neutral-800 hover:border-rose-900/40 text-xs py-2 px-3.5 rounded-xl transition-all cursor-pointer font-bold"
                  >
                    إلغاء كلياً
                  </button>
                </>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

    </div>
  );
}
