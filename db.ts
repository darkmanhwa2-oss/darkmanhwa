/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import fs from 'fs';
import path from 'path';
import bcrypt from 'bcryptjs';
import { 
  User, Series, Chapter, Comment, Rating, Favorite, 
  ReadingHistoryItem, Notification, AdZone, SiteSettings, Report, AdminLog, UserReadingStatus,
  NewsArticle, Team
} from '../types';

interface DatabaseSchema {
  users: User[];
  series: Series[];
  chapters: Chapter[];
  comments: Comment[];
  ratings: Rating[];
  favorites: Favorite[];
  readingHistory: ReadingHistoryItem[];
  notifications: Notification[];
  ads: AdZone[];
  settings: SiteSettings;
  reports: Report[];
  logs: AdminLog[];
  readingStatuses?: UserReadingStatus[];
  news?: NewsArticle[];
  teams?: Team[];
}

const DB_DIR = path.join(process.cwd(), 'data');
const DB_FILE = path.join(DB_DIR, 'db.json');

export const DEFAULT_ADS: AdZone[] = [
  {
    id: 'ad_top',
    name: 'Top Header Banner (728x90 Banner)',
    position: 'top',
    active: true,
    code: '<div class="w-full bg-neutral-900 border border-red-900/40 text-neutral-400 p-4 text-center rounded-xl overflow-hidden shadow-lg"><p class="text-xs text-red-500 font-mono tracking-wider mb-1">DARK WATCH BANNER ADVERTISEMENT</p><p class="text-sm font-semibold text-white">Responsive Ad - Save up to 50% on Premium Gaming Subscriptions!</p></div>'
  },
  {
    id: 'ad_reader_bottom',
    name: 'Reader Bottom Ad (300x250 AdSense)',
    position: 'bottom',
    active: true,
    code: '<div class="w-full bg-neutral-900 border border-neutral-800 text-neutral-400 p-6 text-center rounded-xl overflow-hidden shadow-md max-w-4xl mx-auto"><p class="text-xs text-neutral-500 font-mono tracking-wider mb-2">Google AdSense Placement</p><div class="h-20 flex items-center justify-center border border-dashed border-neutral-700 rounded-lg text-neutral-400 font-sans text-sm">Google AdSense Responsive Unit Placement</div></div>'
  },
  {
    id: 'ad_sidebar',
    name: 'Manga Details Sidebar Ad',
    position: 'sidebar',
    active: true,
    code: '<div class="bg-neutral-950 border border-red-950 text-neutral-400 p-4 text-center rounded-lg shadow-md"><p class="text-[10px] text-red-600 font-mono mb-1">SPONSORED</p><p class="text-xs font-medium text-neutral-300">Love reading comics? Visit our partner store for free international shipping!</p></div>'
  },
  {
    id: 'ad_popunder',
    name: 'Automatic Popunder Script Placement',
    position: 'popunder',
    active: true,
    code: '<script>\n// Integrated Popunder Ad Script\n(function() {\n  var triggered = false;\n  document.addEventListener("click", function() {\n    if (triggered) return;\n    triggered = true;\n    console.log("[Popunder] Background ad activated!");\n    var win = window.open("https://darkwatch.com/sponsored-offer", "_blank");\n    if (win) {\n      win.blur();\n      window.focus();\n    }\n  });\n})();\n</script>\n<div class="hidden">Popunder script active in background (Adsterra / Monetag Popunder)</div>'
  },
  {
    id: 'ad_interstitial',
    name: 'Full Screen Interstitial Promo Ad',
    position: 'interstitial',
    active: true,
    code: '<div class="interstitial-ad-wrapper text-left p-6 max-w-md bg-obsidian-950 border border-crimson-900/50 rounded-3xl shadow-2xl">\n  <div class="flex items-center gap-3 mb-4">\n    <div class="w-10 h-10 rounded-full bg-crimson-600/20 flex items-center justify-center text-crimson-500">\n      <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-sparkles"><path d="m12 3-1.912 5.813a2 2 0 0 1-1.275 1.275L3 12l5.813 1.912a2 2 0 0 1 1.275 1.275L12 21l1.912-5.813a2 2 0 0 1 1.275-1.275L21 12l-5.813-1.912a2 2 0 0 1-1.275-1.275Z"/></svg>\n    </div>\n    <div>\n      <span class="text-[10px] text-crimson-500 font-mono font-bold block">SPECIAL OFFER</span>\n      <h4 class="text-sm font-black text-white">DARK WATCH Gold VIP Pass</h4>\n    </div>\n  </div>\n  <p class="text-xs text-neutral-400 leading-relaxed mb-4">\n    Get early access to new manga releases 48 hours before everyone else, 100% ad-free experience, ultra HD image preloading, and custom reading themes.\n  </p>\n  <a href="#premium" class="block text-center bg-crimson-600 hover:bg-crimson-500 text-white text-xs font-extrabold py-2.5 rounded-xl transition-all">Get VIP Pass for $2.99/mo</a>\n</div>'
  },
  {
    id: 'ad_social_bar',
    name: 'Floating Social Bar & Chat Notification',
    position: 'social_bar',
    active: true,
    code: '<div class="social-bar-widget flex items-center gap-3 p-4 bg-obsidian-900 border border-obsidian-800 rounded-2xl shadow-xl max-w-xs text-left animate-bounce">\n  <div class="w-3 h-3 bg-emerald-500 rounded-full animate-ping absolute top-3 left-3"></div>\n  <img src="https://images.unsplash.com/photo-1542751371-adc38448a05e?auto=format&fit=crop&w=80&h=80&q=80" class="w-12 h-12 rounded-xl object-cover shrink-0" />\n  <div>\n    <p class="text-[10px] text-neutral-500 font-bold mb-0.5">Daily Reward Available!</p>\n    <p class="text-xs text-white font-extrabold">You earned 50 bonus reading points today.</p>\n    <a href="#" class="text-[10px] text-crimson-500 font-black hover:underline mt-1 block">Click here to claim</a>\n  </div>\n</div>'
  },
  {
    id: 'ad_in_page_push',
    name: 'In-Page Push Notification Ad',
    position: 'in_page_push',
    active: true,
    code: '<div class="in-page-push-banner flex items-center justify-between gap-4 p-4 bg-gradient-to-r from-crimson-950/40 via-obsidian-900 to-obsidian-950 border border-crimson-950 rounded-2xl shadow-md text-left w-full">\n  <div class="flex items-center gap-3">\n    <div class="w-9 h-9 rounded-xl bg-crimson-600/10 flex items-center justify-center text-crimson-500 shrink-0">\n      <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-bell"><path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9"/><path d="M10.3 21a1.94 1.94 0 0 0 3.4 0"/></svg>\n    </div>\n    <div>\n      <p class="text-xs font-black text-white">Chainsaw Man Chapter 180 is now live!</p>\n      <p class="text-[10px] text-neutral-400">Instant Release Alert - Read high-resolution official translation now.</p>\n    </div>\n  </div>\n  <button class="bg-crimson-600 hover:bg-crimson-500 text-white px-3 py-1.5 rounded-lg text-[10px] font-bold transition-all shrink-0">Read Now</button>\n</div>'
  },
  {
    id: 'ad_sticky_banner',
    name: 'Sticky Footer Banner (Mobile & Desktop)',
    position: 'sticky_banner',
    active: true,
    code: '<div class="sticky-banner-container bg-black/95 border-t border-crimson-950 p-3 flex items-center justify-between gap-4 w-full h-16 shadow-2xl">\n  <div class="flex items-center gap-2">\n    <span class="bg-amber-600 text-white font-black px-1.5 py-0.5 rounded text-[8px]">AD</span>\n    <p class="text-xs text-neutral-300 font-semibold truncate">Download DARK WATCH Mobile Reader App for offline reading & 3x faster speeds!</p>\n  </div>\n  <a href="https://play.google.com" target="_blank" class="bg-crimson-600 hover:bg-crimson-500 text-white text-[10px] font-bold px-4 py-2 rounded-lg transition-all shrink-0">Free Download</a>\n</div>'
  },
  {
    id: 'ad_native_ads',
    name: 'Native Sponsored Content Widget',
    position: 'native_ads',
    active: true,
    code: '<div class="w-full text-left space-y-4">\n  <div class="flex items-center gap-1.5 border-b border-obsidian-800 pb-2">\n    <span class="w-2.5 h-2.5 rounded-full bg-crimson-600"></span>\n    <h4 class="text-xs font-extrabold text-neutral-400">Sponsored Content You Might Like</h4>\n  </div>\n  <div class="grid grid-cols-2 md:grid-cols-4 gap-4">\n    <a href="#" class="group block space-y-2">\n      <div class="aspect-video rounded-xl overflow-hidden bg-obsidian-950 border border-obsidian-850 relative">\n        <img src="https://images.unsplash.com/photo-1511512578047-dfb367046420?auto=format&fit=crop&w=300&h=180&q=80" class="w-full h-full object-cover group-hover:scale-105 transition-transform" />\n        <span class="absolute bottom-1.5 right-1.5 bg-black/75 px-1.5 py-0.5 rounded text-[8px] text-neutral-400 font-mono">Ad</span>\n      </div>\n      <p class="text-xs font-bold text-neutral-200 line-clamp-2 leading-snug group-hover:text-crimson-500 transition-colors">Top 10 Open World RPG Games Coming in 2026</p>\n    </a>\n    <a href="#" class="group block space-y-2">\n      <div class="aspect-video rounded-xl overflow-hidden bg-obsidian-950 border border-obsidian-850 relative">\n        <img src="https://images.unsplash.com/photo-1563089145-599997674d42?auto=format&fit=crop&w=300&h=180&q=80" class="w-full h-full object-cover group-hover:scale-105 transition-transform" />\n        <span class="absolute bottom-1.5 right-1.5 bg-black/75 px-1.5 py-0.5 rounded text-[8px] text-neutral-400 font-mono">Ad</span>\n      </div>\n      <p class="text-xs font-bold text-neutral-200 line-clamp-2 leading-snug group-hover:text-crimson-500 transition-colors">How Digital Manga Illustrators Create High-Resolution Chapters</p>\n    </a>\n    <a href="#" class="group block space-y-2">\n      <div class="aspect-video rounded-xl overflow-hidden bg-obsidian-950 border border-obsidian-850 relative">\n        <img src="https://images.unsplash.com/photo-1607604276583-eef5d076aa5f?auto=format&fit=crop&w=300&h=180&q=80" class="w-full h-full object-cover group-hover:scale-105 transition-transform" />\n        <span class="absolute bottom-1.5 right-1.5 bg-black/75 px-1.5 py-0.5 rounded text-[8px] text-neutral-400 font-mono">Ad</span>\n      </div>\n      <p class="text-xs font-bold text-neutral-200 line-clamp-2 leading-snug group-hover:text-crimson-500 transition-colors">Best Gaming Setup Accessories & Ergonomic Chairs</p>\n    </a>\n    <a href="#" class="group block space-y-2">\n      <div class="aspect-video rounded-xl overflow-hidden bg-obsidian-950 border border-obsidian-850 relative">\n        <img src="https://images.unsplash.com/photo-1550745165-9bc0b252726f?auto=format&fit=crop&w=300&h=180&q=80" class="w-full h-full object-cover group-hover:scale-105 transition-transform" />\n        <span class="absolute bottom-1.5 right-1.5 bg-black/75 px-1.5 py-0.5 rounded text-[8px] text-neutral-400 font-mono">Ad</span>\n      </div>\n      <p class="text-xs font-bold text-neutral-200 line-clamp-2 leading-snug group-hover:text-crimson-500 transition-colors">GPU Deals: Where to Buy High Performance Graphics Cards</p>\n    </a>\n  </div>\n</div>'
  }
];

export class JSONDatabase {
  private static data: DatabaseSchema | null = null;

  public static get(): DatabaseSchema {
    if (!this.data) {
      this.init();
    }
    this.ensureStructure();
    return this.data!;
  }

  private static saveTimeout: any = null;

  public static save(newData: DatabaseSchema): void {
    this.data = newData;
    this.ensureStructure();
    
    if (this.saveTimeout) {
      clearTimeout(this.saveTimeout);
    }
    
    this.saveTimeout = setTimeout(() => {
      try {
        if (!fs.existsSync(DB_DIR)) {
          fs.mkdirSync(DB_DIR, { recursive: true });
        }
        const tempFile = path.join(DB_DIR, 'db.json.tmp');
        const backupFile = path.join(DB_DIR, 'db.backup.json');
        const stringified = JSON.stringify(this.data);

        fs.writeFile(tempFile, stringified, 'utf-8', (err) => {
          if (err) {
            console.error('Error writing database to temp file:', err);
            return;
          }

          fs.rename(tempFile, DB_FILE, (renameErr) => {
            if (renameErr) {
              console.error('Error renaming temp database to main:', renameErr);
              return;
            }

            fs.writeFile(backupFile, stringified, 'utf-8', (backupErr) => {
              if (backupErr) {
                console.error('Error writing database backup copy:', backupErr);
              }
            });
          });
        });
      } catch (err) {
        console.error('Failed to start robust async save:', err);
      }
    }, 150);
  }

  private static getEnglishSeedData() {
    const salt = bcrypt.genSaltSync(10);
    const adminPasswordHash = bcrypt.hashSync('admin123', salt);
    const modPasswordHash = bcrypt.hashSync('mod123', salt);
    const userPasswordHash = bcrypt.hashSync('user123', salt);
    const darkmanhwaPasswordHash = bcrypt.hashSync('darkwatch2026', salt);

    const initialUsers: User[] = [
      {
        id: 'user_darkmanhwa',
        email: 'darkmanhwa2@gmail.com',
        username: 'Admin - DarkWatch',
        passwordHash: darkmanhwaPasswordHash,
        role: 'admin',
        avatarUrl: 'https://j.top4top.io/p_3844khfc91.jpg',
        createdAt: new Date().toISOString()
      },
      {
        id: 'user_admin',
        email: 'admin@darkwatch.com',
        username: 'Admin - DARK WATCH',
        passwordHash: adminPasswordHash,
        role: 'admin',
        avatarUrl: 'https://j.top4top.io/p_3844khfc91.jpg',
        createdAt: new Date().toISOString()
      },
      {
        id: 'user_mod',
        email: 'mod@darkwatch.com',
        username: 'Support Moderator',
        passwordHash: modPasswordHash,
        role: 'moderator',
        avatarUrl: 'https://c.top4top.io/p_38444apdb1.jpg',
        createdAt: new Date().toISOString()
      },
      {
        id: 'user_demo',
        email: 'user@darkwatch.com',
        username: 'Avid Manga Reader',
        passwordHash: userPasswordHash,
        role: 'user',
        avatarUrl: 'https://c.top4top.io/p_38444apdb1.jpg',
        createdAt: new Date().toISOString()
      }
    ];

    // English Manga List - ALL MANHWA REMOVED as requested by user
    const initialSeries: Series[] = [
      {
        id: 'one_piece',
        titleAr: 'One Piece',
        titleEn: 'One Piece',
        descriptionAr: 'Monkey D. Luffy sets off on an epic journey across the Grand Line to find the legendary One Piece treasure and become the King of the Pirates.',
        descriptionEn: 'Monkey D. Luffy sets off on an epic journey across the Grand Line to find the legendary One Piece treasure and become the King of the Pirates.',
        coverUrl: 'https://images.unsplash.com/photo-1607604276583-eef5d076aa5f?auto=format&fit=crop&w=400&h=600&q=85',
        bannerUrl: 'https://images.unsplash.com/photo-1578632767115-351597cf2477?auto=format&fit=crop&w=1200&h=500&q=85',
        author: 'Eiichiro Oda',
        artist: 'Eiichiro Oda',
        status: 'ongoing',
        rating: 4.95,
        views: 345000,
        likes: 48900,
        genres: ['Action', 'Adventure', 'Fantasy', 'Shounen', 'Comedy'],
        addedAt: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString()
      },
      {
        id: 'jujutsu_kaisen',
        titleAr: 'Jujutsu Kaisen',
        titleEn: 'Jujutsu Kaisen',
        descriptionAr: 'Yuji Itadori, a high school student with immense physical strength, swallows a cursed finger of Sukuna to save his friends and enters the dangerous world of Jujutsu Sorcerers.',
        descriptionEn: 'Yuji Itadori, a high school student with immense physical strength, swallows a cursed finger of Sukuna to save his friends and enters the dangerous world of Jujutsu Sorcerers.',
        coverUrl: 'https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?auto=format&fit=crop&w=400&h=600&q=85',
        bannerUrl: 'https://images.unsplash.com/photo-1614850523459-c2f4c699c52e?auto=format&fit=crop&w=1200&h=500&q=85',
        author: 'Gege Akutami',
        artist: 'Gege Akutami',
        status: 'ongoing',
        rating: 4.88,
        views: 289000,
        likes: 39400,
        genres: ['Action', 'Supernatural', 'Dark Fantasy', 'Shounen'],
        addedAt: new Date(Date.now() - 15 * 24 * 60 * 60 * 1000).toISOString()
      },
      {
        id: 'chainsaw_man',
        titleAr: 'Chainsaw Man',
        titleEn: 'Chainsaw Man',
        descriptionAr: 'Denji is a young man living as a Devil Hunter. After being betrayed and killed by the Yakuza, he is revived by his pet devil Pochita and becomes Chainsaw Man.',
        descriptionEn: 'Denji is a young man living as a Devil Hunter. After being betrayed and killed by the Yakuza, he is revived by his pet devil Pochita and becomes Chainsaw Man.',
        coverUrl: 'https://images.unsplash.com/photo-1534447677768-be436bb09401?auto=format&fit=crop&w=400&h=600&q=85',
        bannerUrl: 'https://images.unsplash.com/photo-1509198397868-475647b2a1e5?auto=format&fit=crop&w=1200&h=500&q=85',
        author: 'Tatsuki Fujimoto',
        artist: 'Tatsuki Fujimoto',
        status: 'ongoing',
        rating: 4.9,
        views: 215000,
        likes: 31200,
        genres: ['Action', 'Horror', 'Supernatural', 'Dark Fantasy'],
        addedAt: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000).toISOString()
      },
      {
        id: 'demon_slayer_manga',
        titleAr: 'Demon Slayer',
        titleEn: 'Demon Slayer: Kimetsu no Yaiba',
        descriptionAr: 'Tanjiro Kamado sets out to become a demon slayer after his family is slaughtered and his younger sister Nezuko is turned into a demon.',
        descriptionEn: 'Tanjiro Kamado sets out to become a demon slayer after his family is slaughtered and his younger sister Nezuko is turned into a demon.',
        coverUrl: 'https://images.unsplash.com/photo-1508739773434-c26b3d09e071?auto=format&fit=crop&w=400&h=600&q=85',
        bannerUrl: 'https://images.unsplash.com/photo-1542838132-92c53300491e?auto=format&fit=crop&w=1200&h=500&q=85',
        author: 'Koyoharu Gotouge',
        artist: 'Koyoharu Gotouge',
        status: 'completed',
        rating: 4.85,
        views: 260000,
        likes: 35000,
        genres: ['Action', 'Demons', 'Fantasy', 'Historical', 'Shounen'],
        addedAt: new Date(Date.now() - 50 * 24 * 60 * 60 * 1000).toISOString()
      },
      {
        id: 'berserk',
        titleAr: 'Berserk',
        titleEn: 'Berserk',
        descriptionAr: 'Guts, a wandering mercenary known as the Black Swordsman, seeks vengeance against his former mercenary band leader Griffith in a dark medieval fantasy world.',
        descriptionEn: 'Guts, a wandering mercenary known as the Black Swordsman, seeks vengeance against his former mercenary band leader Griffith in a dark medieval fantasy world.',
        coverUrl: 'https://images.unsplash.com/photo-1541701494587-cb58502866ab?auto=format&fit=crop&w=400&h=600&q=85',
        bannerUrl: 'https://images.unsplash.com/photo-1518709268805-4e9042af9f23?auto=format&fit=crop&w=1200&h=500&q=85',
        author: 'Kentarou Miura',
        artist: 'Kentarou Miura',
        status: 'ongoing',
        rating: 4.98,
        views: 310000,
        likes: 45000,
        genres: ['Action', 'Dark Fantasy', 'Tragedy', 'Seinen', 'Horror'],
        addedAt: new Date(Date.now() - 40 * 24 * 60 * 60 * 1000).toISOString()
      },
      {
        id: 'attack_on_titan',
        titleAr: 'Attack on Titan',
        titleEn: 'Attack on Titan',
        descriptionAr: 'Humanity lives inside cities surrounded by enormous walls that protect them from gigantic man-eating humanoids called Titans. Eren Yeager vows to exterminate all Titans after one breaks through.',
        descriptionEn: 'Humanity lives inside cities surrounded by enormous walls that protect them from gigantic man-eating humanoids called Titans. Eren Yeager vows to exterminate all Titans after one breaks through.',
        coverUrl: 'https://images.unsplash.com/photo-1517649763962-0c623066013b?auto=format&fit=crop&w=400&h=600&q=85',
        bannerUrl: 'https://images.unsplash.com/photo-1485965120184-e220f721d03e?auto=format&fit=crop&w=1200&h=500&q=85',
        author: 'Hajime Isayama',
        artist: 'Hajime Isayama',
        status: 'completed',
        rating: 4.92,
        views: 410000,
        likes: 58000,
        genres: ['Action', 'Mystery', 'Drama', 'Military', 'Shounen'],
        addedAt: new Date(Date.now() - 10 * 24 * 60 * 60 * 1000).toISOString()
      }
    ];

    const generatePages = (seriesId: string, chapNum: number, pageCount: number): string[] => {
      const pages: string[] = [];
      for (let i = 1; i <= pageCount; i++) {
        pages.push(`https://picsum.photos/seed/${seriesId}_c${chapNum}_p${i}/800/1200?blur=1`);
      }
      return pages;
    };

    const initialChapters: Chapter[] = [
      {
        id: 'op_c1',
        seriesId: 'one_piece',
        number: 1,
        titleAr: 'Chapter 1: Romance Dawn',
        titleEn: 'Chapter 1: Romance Dawn',
        pages: generatePages('op', 1, 6),
        addedAt: new Date(Date.now() - 29 * 24 * 60 * 60 * 1000).toISOString(),
        isVisible: true
      },
      {
        id: 'op_c2',
        seriesId: 'one_piece',
        number: 2,
        titleAr: 'Chapter 2: Luffy, the Pirate Captain',
        titleEn: 'Chapter 2: Luffy, the Pirate Captain',
        pages: generatePages('op', 2, 6),
        addedAt: new Date(Date.now() - 28 * 24 * 60 * 60 * 1000).toISOString(),
        isVisible: true
      },
      {
        id: 'jjk_c1',
        seriesId: 'jujutsu_kaisen',
        number: 1,
        titleAr: 'Chapter 1: Ryomen Sukuna',
        titleEn: 'Chapter 1: Ryomen Sukuna',
        pages: generatePages('jjk', 1, 5),
        addedAt: new Date(Date.now() - 14 * 24 * 60 * 60 * 1000).toISOString(),
        isVisible: true
      },
      {
        id: 'csm_c1',
        seriesId: 'chainsaw_man',
        number: 1,
        titleAr: 'Chapter 1: Dog & Chainsaw',
        titleEn: 'Chapter 1: Dog & Chainsaw',
        pages: generatePages('csm', 1, 5),
        addedAt: new Date(Date.now() - 4 * 24 * 60 * 60 * 1000).toISOString(),
        isVisible: true
      }
    ];

    const initialComments: Comment[] = [
      {
        id: 'comm_1',
        seriesId: 'one_piece',
        userId: 'user_demo',
        username: 'Avid Manga Reader',
        userAvatar: 'https://images.unsplash.com/photo-1570295999919-56ceb5ecca61?auto=format&fit=crop&w=150&h=150&q=80',
        content: 'One Piece is an absolute masterpiece! The world-building and character arcs are unrivaled.',
        addedAt: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString(),
        likes: 124,
        dislikes: 2,
        replies: [
          {
            id: 'rep_1',
            userId: 'user_mod',
            username: 'Support Moderator',
            userAvatar: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?auto=format&fit=crop&w=150&h=150&q=80',
            content: 'Agreed! Eiichiro Oda is a genius storyteller.',
            addedAt: new Date(Date.now() - 1.9 * 24 * 60 * 60 * 1000).toISOString()
          }
        ]
      },
      {
        id: 'comm_2',
        seriesId: 'jujutsu_kaisen',
        userId: 'user_demo',
        username: 'Avid Manga Reader',
        userAvatar: 'https://images.unsplash.com/photo-1570295999919-56ceb5ecca61?auto=format&fit=crop&w=150&h=150&q=80',
        content: 'The battle choreography and domain expansions in JJK are top tier!',
        addedAt: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000).toISOString(),
        likes: 98,
        dislikes: 0,
        replies: []
      }
    ];

    const initialRatings: Rating[] = [
      { userId: 'user_demo', seriesId: 'one_piece', score: 5 },
      { userId: 'user_demo', seriesId: 'jujutsu_kaisen', score: 5 },
      { userId: 'user_mod', seriesId: 'chainsaw_man', score: 5 }
    ];

    const initialSettings: SiteSettings = {
      siteName: 'Dark Manhwa',
      description: 'دارك مانهوا (Dark Manhwa) - المنصة العربية الأولى لقراءة المانجا والمانهوا المترجمة للعربية بسرعة فائقة وبدون إعلانات.',
      facebookUrl: 'https://facebook.com/darkmanhwamanga',
      twitterUrl: 'https://twitter.com/darkmanhwamanga',
      discordUrl: 'https://discord.gg/darkmanhwa',
      googleAnalyticsId: 'UA-12345678-9',
      googleAdSenseId: 'pub-9876543210123456',
      cloudinaryEnabled: false,
      smtpServer: 'smtp.darkmanhwa.com',
      registrationEnabled: true,
      maintenanceMode: false,
      globalAdsEnabled: true
    };

    const initialFavorites: Favorite[] = [
      { userId: 'user_demo', seriesId: 'one_piece' },
      { userId: 'user_demo', seriesId: 'jujutsu_kaisen' }
    ];

    const initialHistory: ReadingHistoryItem[] = [
      {
        userId: 'user_demo',
        seriesId: 'one_piece',
        chapterId: 'op_c2',
        chapterNumber: 2,
        pageNum: 1,
        updatedAt: new Date().toISOString()
      }
    ];

    const initialNotifications: Notification[] = [
      {
        id: 'notif_1',
        userId: 'user_demo',
        title: 'New Chapter Released!',
        content: 'One Piece Chapter 2 is now available to read in high resolution.',
        type: 'chapter',
        read: false,
        addedAt: new Date().toISOString()
      }
    ];

    const initialReports: Report[] = [
      {
        id: 'rep_1',
        type: 'request',
        userEmail: 'user@darkwatch.com',
        description: 'Please upload Bleach: Thousand-Year Blood War manga chapters!',
        status: 'pending',
        addedAt: new Date().toISOString()
      }
    ];

    const initialLogs: AdminLog[] = [
      {
        id: 'log_1',
        userEmail: 'admin@darkwatch.com',
        action: 'System English Migration',
        description: 'DARK WATCH platform converted to English-only manga reader.',
        timestamp: new Date().toISOString()
      }
    ];

    const initialNews: NewsArticle[] = [
      {
        id: 'news_1',
        title: 'DARK WATCH Upgraded to High-Speed English Manga Platform',
        content: 'We are thrilled to announce that DARK WATCH has been fully upgraded to serve global manga readers with high-speed chapter loading, custom vertical reader controls, and high resolution scans.',
        imageUrl: 'https://images.unsplash.com/photo-1578632767115-351597cf2477?auto=format&fit=crop&w=600&h=400&q=80',
        authorId: 'user_admin',
        authorName: 'Admin - DARK WATCH',
        addedAt: new Date().toISOString(),
        views: 1250
      },
      {
        id: 'news_2',
        title: 'Top 5 Action Manga You Must Read in 2026',
        content: 'Looking for adrenaline-fueled battles? Check out our top recommended manga series including One Piece, Jujutsu Kaisen, Chainsaw Man, and Berserk.',
        imageUrl: 'https://images.unsplash.com/photo-1541701494587-cb58502866ab?auto=format&fit=crop&w=600&h=400&q=80',
        authorId: 'user_admin',
        authorName: 'Admin - DARK WATCH',
        addedAt: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString(),
        views: 840
      }
    ];

    const initialTeams: Team[] = [
      {
        id: 'team_dark_watch',
        name: 'Dark Watch Scans',
        description: 'Official scanlation team dedicated to translating and delivering pristine quality manga chapters.',
        logoUrl: 'https://j.top4top.io/p_3844khfc91.jpg',
        leaderName: 'Admin - DarkWatch',
        membersCount: 15,
        discordUrl: 'https://discord.gg/darkwatch',
        websiteUrl: 'https://darkwatch.com',
        translatedSeriesCount: 120,
        addedAt: new Date().toISOString()
      }
    ];

    return {
      users: initialUsers,
      series: initialSeries,
      chapters: initialChapters,
      comments: initialComments,
      ratings: initialRatings,
      favorites: initialFavorites,
      readingHistory: initialHistory,
      notifications: initialNotifications,
      ads: DEFAULT_ADS,
      settings: initialSettings,
      reports: initialReports,
      logs: initialLogs,
      readingStatuses: [],
      news: initialNews,
      teams: initialTeams
    };
  }

  private static init(): void {
    const backupFile = path.join(DB_DIR, 'db.backup.json');

    if (fs.existsSync(DB_FILE)) {
      try {
        const fileContent = fs.readFileSync(DB_FILE, 'utf-8');
        if (fileContent && fileContent.trim().length > 0) {
          this.data = JSON.parse(fileContent);
          this.ensureStructure();
          return;
        }
      } catch (err) {
        console.error('Error parsing primary database file:', err);
      }
    }

    if (fs.existsSync(backupFile)) {
      try {
        const fileContent = fs.readFileSync(backupFile, 'utf-8');
        if (fileContent && fileContent.trim().length > 0) {
          this.data = JSON.parse(fileContent);
          this.ensureStructure();
          fs.writeFileSync(DB_FILE, JSON.stringify(this.data), 'utf-8');
          return;
        }
      } catch (err) {
        console.error('Error parsing backup database file:', err);
      }
    }

    console.log('Initializing English seed data...');
    this.data = this.getEnglishSeedData();
    this.save(this.data);
  }

  private static ensureStructure(): void {
    if (!this.data) return;

    if (!this.data.users) this.data.users = [];
    if (!this.data.series) this.data.series = [];
    if (!this.data.chapters) this.data.chapters = [];
    if (!this.data.comments) this.data.comments = [];
    if (!this.data.ratings) this.data.ratings = [];
    if (!this.data.favorites) this.data.favorites = [];
    if (!this.data.readingHistory) this.data.readingHistory = [];
    if (!this.data.notifications) this.data.notifications = [];
    if (!this.data.ads) {
      this.data.ads = [...DEFAULT_ADS];
    } else {
      for (const defAd of DEFAULT_ADS) {
        if (!this.data.ads.some(a => a.id === defAd.id)) {
          this.data.ads.push(defAd);
        }
      }
    }
    if (!this.data.settings) {
      this.data.settings = {
        siteName: 'Dark Manhwa',
        description: 'دارك مانهوا (Dark Manhwa) - المنصة العربية الأولى لقراءة المانجا والمانهوا المترجمة',
        facebookUrl: '',
        twitterUrl: '',
        discordUrl: '',
        googleAnalyticsId: '',
        googleAdSenseId: '',
        cloudinaryEnabled: false,
        smtpServer: '',
        registrationEnabled: true,
        maintenanceMode: false,
        globalAdsEnabled: true
      };
    }
    if (this.data.settings.globalAdsEnabled === undefined) {
      this.data.settings.globalAdsEnabled = true;
    }
    if (!this.data.reports) this.data.reports = [];
    if (!this.data.logs) this.data.logs = [];
    if (!this.data.readingStatuses) this.data.readingStatuses = [];
    if (!this.data.news) this.data.news = [];
    if (!this.data.teams) this.data.teams = [];
  }
}
