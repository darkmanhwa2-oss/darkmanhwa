/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { motion } from 'motion/react';
import { ShieldCheck, Scale, Info, Mail, HelpCircle } from 'lucide-react';
import { apiFetch } from '../lib/api';

interface StaticPagesProps {
  pageType: 'about' | 'privacy' | 'terms' | 'contact' | 'request' | 'dmca';
  onNavigate: (page: string) => void;
}

export default function StaticPages({ pageType, onNavigate }: StaticPagesProps) {
  const [email, setEmail] = useState('');
  const [description, setDescription] = useState('');
  const [type, setType] = useState(pageType === 'contact' ? 'bug' : 'request');
  const [success, setSuccess] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSuccess('');
    setLoading(true);

    try {
      await apiFetch('/api/reports', {
        method: 'POST',
        body: JSON.stringify({
          type: pageType === 'contact' ? 'bug' : pageType === 'dmca' ? 'dmca' : type,
          email,
          description
        })
      });
      setSuccess('✅ تم إرسال رسالتك بنجاح إلى فريق إدارة دارك مانهوا (Dark Manhwa)!');
      setEmail('');
      setDescription('');
    } catch (err: any) {
      alert(err.message || 'حدث خطأ أثناء إرسال الرسالة');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto space-y-10 pb-16 text-right" dir="rtl">
      
      {/* Tab select headers */}
      <div className="flex border-b border-obsidian-800 overflow-x-auto gap-2 pb-1 text-xs md:text-sm font-bold text-neutral-400 font-sans">
        {[
          { id: 'about', name: 'من نحن', icon: Info },
          { id: 'privacy', name: 'سياسة الخصوصية', icon: ShieldCheck },
          { id: 'terms', name: 'شروط الاستخدام', icon: Scale },
          { id: 'contact', name: 'اتصل بنا', icon: Mail },
          { id: 'dmca', name: 'حقوق الملكية DMCA', icon: HelpCircle },
        ].map(tab => (
          <button
            key={tab.id}
            onClick={() => onNavigate(tab.id)}
            className={`py-2.5 px-4 rounded-xl border transition-all cursor-pointer whitespace-nowrap ${pageType === tab.id ? 'bg-crimson-600 text-white border-transparent shadow font-bold' : 'bg-obsidian-950 border-obsidian-850 hover:text-white'}`}
          >
            {tab.name}
          </button>
        ))}
      </div>

      {/* 1. ABOUT US */}
      {pageType === 'about' && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-6">
          <h1 className="text-3xl font-black text-white font-sans">عن دارك مانهوا (Dark Manhwa)</h1>
          <div className="bg-obsidian-950 border border-obsidian-850 rounded-3xl p-6 md:p-8 space-y-4 text-neutral-300 leading-relaxed text-sm shadow-xl">
            <p className="font-extrabold text-base text-white font-sans">مرحباً بكم في منصة Dark Manhwa - التجربة الأولى لمتابعي المانهوا والمانجا المترجمة!</p>
            <p>
              تم تصميم **Dark Manhwa (دارك مانهوا)** لتقديم تجربة قراءة فائقة السرعة وعالية الجودة لجميع عشاق المانجا والمانهوا والمانهوا الكورية المترجمة للغة العربية بدون إعلانات مزعجة أو نوافذ منبثقة.
            </p>
            <p>
              تم تطوير المنصة من الصفر بأحدث تقنيات الويب العالمية لدعم القراءة عبر جميع الهواتف الذكية والأجهزة اللوحية وأجهزة الكمبيوتر، مع دعم قارئ الويب الفائق، وتتبع تقدم القراءة، وحفظ المفضلات تلقائياً.
            </p>
            <p className="text-crimson-500 font-bold font-sans">هدفنا هو بناء المجتمع العربي الأضخم والأفضل لمتابعي المانهوا والمانجا في الشرق الأوسط!</p>
          </div>
        </motion.div>
      )}

      {/* 2. PRIVACY POLICY */}
      {pageType === 'privacy' && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-6">
          <h1 className="text-3xl font-black text-white font-sans">سياسة الخصوصية</h1>
          <div className="bg-obsidian-950 border border-obsidian-850 rounded-3xl p-6 md:p-8 space-y-4 text-neutral-300 leading-relaxed text-sm shadow-xl">
            <p className="font-bold text-white text-base font-sans">التزامنا بحماية بياناتك:</p>
            <p>
              في **Dark Manhwa**، تعتبر خصوصية مستخدمينا أولوية قصوى. نحن لا نبيع أو نشارك بياناتك الشخصية مع أي أطراف خارجية. جميع كلمة المرور والبيانات تشفر بأعلى المعايير الأمنية على خوادمنا.
            </p>
            <p className="font-bold text-white font-sans">ملفات تعريف الارتباط والتخزين المحلي:</p>
            <p>
              نستخدم التخزين المحلي الآمن لحفظ تقدم القراءة، إعدادات القارئ المفضل لديك، وتسجيل الدخول الخاص بك بسلاسة.
            </p>
          </div>
        </motion.div>
      )}

      {/* 3. TERMS OF SERVICE */}
      {pageType === 'terms' && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-6">
          <h1 className="text-3xl font-black text-white font-sans">شروط الاستخدام</h1>
          <div className="bg-obsidian-950 border border-obsidian-850 rounded-3xl p-6 md:p-8 space-y-4 text-neutral-300 leading-relaxed text-sm shadow-xl">
            <p className="font-bold text-white text-base font-sans">قواعد المجتمع:</p>
            <p>
              باستخدامك لمنصة Dark Manhwa، فإنك توافق على الالتزام بالقواعد التالية:
            </p>
            <ul className="list-disc pr-6 space-y-2 text-neutral-400">
              <li>يمنع استخدام خطابات الكراهية أو الألفاظ المسيئة في التعليقات والمناقشات.</li>
              <li>يمنع نشر الحرق للأحداث في التعليقات العامة بدون استخدام خيار الحرق.</li>
              <li>يحق للمشرفين حظر الحسابات التي تخالف شروط الاستخدام.</li>
            </ul>
          </div>
        </motion.div>
      )}

      {/* 4. DMCA */}
      {pageType === 'dmca' && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-6">
          <h1 className="text-3xl font-black text-white font-sans">حقوق الملكية والنشر (DMCA)</h1>
          <div className="bg-obsidian-950 border border-obsidian-850 rounded-3xl p-6 md:p-8 space-y-4 text-neutral-300 leading-relaxed text-sm shadow-xl">
            <p>
              منصة Dark Manhwa هي منصة تجميع وواجهة قارئ فصول. إذا كنت مالك حق النشر أو وكيلاً معتمداً وتعتقد أن هناك محتوى ينتهك حقوق الملكية الخاصة بك، يمكنك تقديم طلب إزالة DMCA أدناه وسيقوم فريقنا بمراجعته والتصرف فوراً.
            </p>

            {/* DMCA Report Form */}
            <div className="pt-6 border-t border-obsidian-850 space-y-4 text-right">
              <h3 className="font-extrabold text-sm text-crimson-500 font-sans">إرسال إشعار DMCA:</h3>
              
              {success ? (
                <div className="p-4 bg-emerald-950/20 border border-emerald-900/30 rounded-xl text-emerald-400 text-xs font-sans">
                  {success}
                </div>
              ) : (
                <form onSubmit={handleSubmit} className="space-y-4">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs text-neutral-400 mb-1.5 font-sans">البريد الإلكتروني لللتواصل:</label>
                      <input
                        type="email"
                        required
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        placeholder="your-email@example.com"
                        className="w-full bg-obsidian-900 border border-obsidian-800 text-white px-3 py-2.5 rounded-xl text-xs outline-none font-mono text-right"
                      />
                    </div>
                    <div>
                      <label className="block text-xs text-neutral-400 mb-1.5 font-sans">اسم العمل / المانجا:</label>
                      <input
                        type="text"
                        required
                        placeholder="مثال: Solo Leveling"
                        className="w-full bg-obsidian-900 border border-obsidian-800 text-white px-3 py-2.5 rounded-xl text-xs outline-none text-right"
                      />
                    </div>
                  </div>
                  <div>
                    <label className="block text-xs text-neutral-400 mb-1.5 font-sans">تفاصيل الانتهاك وإثبات الملكية:</label>
                    <textarea
                      required
                      value={description}
                      onChange={(e) => setDescription(e.target.value)}
                      placeholder="يرجى توضيح تفاصيل إثبات ملكية العمل وطلب الإزالة..."
                      className="w-full bg-obsidian-900 border border-obsidian-800 text-white p-3 rounded-xl text-xs outline-none min-h-[100px] text-right"
                    />
                  </div>
                  <button
                    type="submit"
                    disabled={loading}
                    className="bg-crimson-600 hover:bg-crimson-500 text-white font-bold px-6 py-2.5 rounded-xl text-xs transition-colors cursor-pointer flex items-center gap-1.5 font-sans"
                  >
                    {loading ? (
                      <span className="border-2 border-white/20 border-t-white w-4 h-4 rounded-full animate-spin"></span>
                    ) : 'إرسال طلب الإزالة'}
                  </button>
                </form>
              )}
            </div>
          </div>
        </motion.div>
      )}

      {/* 5. CONTACT US & REQUEST FORMS */}
      {(pageType === 'contact' || pageType === 'request') && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-6">
          <h1 className="text-3xl font-black text-white font-sans">
            {pageType === 'contact' ? 'اتصل بنا / الإبلاغ عن مشكلة' : 'طلب إضافة مانهوا جديدة'}
          </h1>
          <div className="bg-obsidian-950 border border-obsidian-850 rounded-3xl p-6 md:p-8 space-y-4 text-neutral-300 leading-relaxed text-sm shadow-xl">
            <p>يررحب فريق **Dark Manhwa** بجميع اقتراحاتكم، طلبات الترجمة، والبلاغات عن المشاكل التقنية.</p>
            
            {success ? (
              <div className="p-4 bg-emerald-950/20 border border-emerald-900/30 rounded-xl text-emerald-400 text-xs font-sans">
                {success}
              </div>
            ) : (
              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs text-neutral-400 mb-1.5 font-sans">بريدك الإلكتروني:</label>
                    <input
                      type="email"
                      required
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="your-email@example.com"
                      className="w-full bg-obsidian-900 border border-obsidian-800 text-white px-3 py-2.5 rounded-xl text-xs outline-none font-mono text-right"
                    />
                  </div>
                  <div>
                    <label className="block text-xs text-neutral-400 mb-1.5 font-sans">نوع الرسالة:</label>
                    <select
                      value={type}
                      onChange={(e) => setType(e.target.value as any)}
                      className="w-full bg-obsidian-900 border border-obsidian-800 text-white px-3 py-2.5 rounded-xl text-xs outline-none font-sans text-right"
                    >
                      <option value="bug">الإبلاغ عن مشكلة تقنية / خطأ بالفصل</option>
                      <option value="request">طلب إضافة مانهوا أو مانجا جديدة</option>
                      <option value="comment_abuse">الإبلاغ عن إساءة بالتعليقات</option>
                    </select>
                  </div>
                </div>
                <div>
                  <label className="block text-xs text-neutral-400 mb-1.5 font-sans">تفاصيل الرسالة:</label>
                  <textarea
                    required
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    placeholder="اكتب تفاصيل الرسالة أو الاقتراح أو المشكلة..."
                    className="w-full bg-obsidian-900 border border-obsidian-800 text-white p-3 rounded-xl text-xs outline-none min-h-[120px] text-right"
                  />
                </div>
                <button
                  type="submit"
                  disabled={loading}
                  className="bg-crimson-600 hover:bg-crimson-500 text-white font-bold px-6 py-3 rounded-xl text-xs transition-colors cursor-pointer flex items-center gap-1.5 font-sans"
                >
                  {loading ? (
                    <span className="border-2 border-white/20 border-t-white w-4 h-4 rounded-full animate-spin"></span>
                  ) : 'إرسال الرسالة'}
                </button>
              </form>
            )}
          </div>
        </motion.div>
      )}

    </div>
  );
}
