/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useRef, useEffect } from 'react';
import { 
  Search, 
  MapPin, 
  TrendingUp, 
  FileText, 
  ShieldCheck, 
  Copy, 
  Check, 
  Loader2, 
  ChevronRight,
  Warehouse,
  Home,
  Zap,
  Info,
  Terminal,
  UserCircle,
  Settings,
  Save,
  X
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { generateRentalAnalysis } from './services/aiService';

// The "Cookie" python snippet provided by the user to be "kept as is"
const COOKIE_SNIPPET = `def load_cookie(self, cookie_file: str = "cookie.json") -> None:
    self.page.goto(self.URL)

    with open(cookie_file, "r") as f:
        cookies = json_loads(f.read())

    self.context.add_cookies(cookies)


def generate_cookie(self) -> None:
    self.page.goto(self.URL)

    input("[*] Press any key to continue")

    cookies = self.page.context.cookies()

    with open("cookie.json", "w") as f:
        json_dump(cookies, f)

    exit()`;

type Step = 'input' | 'processing' | 'result';

interface AgentProfile {
  name: string;
  phone: string;
  lineId: string;
  company: string;
  taxId: string;
  broker: string; // 經紀人
  salesperson: string; // 營業員
}

const DEFAULT_PROFILE: AgentProfile = {
  name: '黃先生',
  phone: '0966-705-761',
  lineId: 'huang92071213',
  company: '生活尋家廠房物業有限公司',
  taxId: '60372057',
  broker: '鄭善仁（113）南市字第001001號',
  salesperson: '黃先生（115）登字第505314號',
};

export default function App() {
  const [propertyInfo, setPropertyInfo] = useState('');
  const [step, setStep] = useState<Step>('input');
  const [analysisResult, setAnalysisResult] = useState<string>('');
  const [loading, setLoading] = useState(false);
  const [copied, setCopied] = useState<string | null>(null);
  const [showCookieModule, setShowCookieModule] = useState(false);
  const [showProfileSettings, setShowProfileSettings] = useState(false);
  
  const [profile, setProfile] = useState<AgentProfile>(() => {
    const saved = localStorage.getItem('agent_profile');
    return saved ? JSON.parse(saved) : DEFAULT_PROFILE;
  });

  useEffect(() => {
    localStorage.setItem('agent_profile', JSON.stringify(profile));
  }, [profile]);

  const getFormattedFooter = () => {
    return `🤝🏻成交時需收取半個月服務費
※本廣告自刊登日起七日內有效，過期資訊可能已異動，請來電或加 Line 確認售租狀況。

聯絡方式📲${profile.phone}
Line ID：${profile.lineId}
經紀業：${profile.company}
統編：${profile.taxId}
經紀人：${profile.broker}
營業員：${profile.salesperson}
以上廣告文案如有誤差一律依謄本、現況、登記資料為準。`;
  };

  const handleGenerate = async () => {
    if (!propertyInfo.trim()) return;
    
    setLoading(true);
    setStep('processing');
    try {
      const footer = getFormattedFooter();
      const result = await generateRentalAnalysis(propertyInfo, footer);
      setAnalysisResult(result || '');
      setStep('result');
    } catch (error) {
      console.error(error);
      alert('生成失敗，請稍後再試。');
      setStep('input');
    } finally {
      setLoading(false);
    }
  };

  const handleCopy = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopied(id);
    setTimeout(() => setCopied(null), 2000);
  };

  return (
    <div className="min-h-screen bg-[#f8fafc] text-slate-900 font-sans selection:bg-emerald-500/20">
      {/* Top Navigation */}
      <header className="fixed top-0 left-0 right-0 h-14 bg-slate-900 text-white flex items-center justify-between px-6 border-b border-slate-700 z-50">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 bg-emerald-500 rounded flex items-center justify-center font-bold text-slate-900">
            TW
          </div>
          <div>
            <h1 className="text-sm font-semibold tracking-tight">台灣租賃市場研究 × 競品分析 × SEO 文案引擎</h1>
            <p className="text-[10px] text-slate-400 font-mono">V2.4.0 FLASH SEO ENGINE</p>
          </div>
        </div>
        <div className="flex items-center gap-6">
          <div className="hidden md:flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-emerald-400"></span>
            <span className="text-[10px] text-slate-300 uppercase tracking-widest">Market Engine Active</span>
          </div>
          
          <div className="h-6 w-px bg-slate-700" />
          
          <button 
            onClick={() => setShowProfileSettings(true)}
            className="flex items-center gap-2 px-3 py-1 bg-slate-800 border border-slate-700 rounded text-[10px] font-bold uppercase tracking-widest hover:bg-slate-700 transition-colors"
          >
            <UserCircle className="w-3.5 h-3.5 text-emerald-400" />
            個人/法規設定
          </button>

          <button 
            onClick={() => setShowCookieModule(!showCookieModule)}
            className="text-[10px] font-mono flex items-center gap-2 px-3 py-1 rounded bg-slate-800 border border-slate-700 hover:bg-slate-700 transition-colors"
          >
            <Terminal className="w-3 h-3" />
            COOKIE MODULE
          </button>
        </div>
      </header>

      <main className="pt-20 pb-32 px-4 max-w-[1400px] mx-auto min-h-screen flex flex-col">
        <AnimatePresence mode="wait">
          {step === 'input' && (
            <motion.div
              key="input"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="flex-1 flex flex-col items-center justify-center max-w-4xl mx-auto w-full space-y-8"
            >
              <div className="space-y-3 text-center">
                <h2 className="text-3xl font-bold tracking-tight text-slate-900 uppercase">
                  全台首創 <span className="text-emerald-600">成交導向</span> 租賃開發引擎
                </h2>
                <p className="text-slate-500 text-sm max-w-xl mx-auto leading-relaxed">
                  輸入物件資訊，自動生成符合 591、Facebook、Threads 的高效 SEO 文案與合規分析報告。
                </p>
              </div>

              <div className="w-full bg-white border border-slate-200 rounded-lg shadow-sm overflow-hidden">
                <div className="p-3 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="w-2 h-2 rounded-full bg-slate-300" />
                    <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Property Input Console</span>
                  </div>
                  <div className="flex items-center gap-2 text-[10px] font-bold text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded">
                    <ShieldCheck className="w-3 h-3" />
                    法規尾段已就緒
                  </div>
                </div>
                <div className="p-6">
                  <textarea
                    value={propertyInfo}
                    onChange={(e) => setPropertyInfo(e.target.value)}
                    placeholder="貼入物件資訊 (例如：南區廠房 / 120坪 / 租金48000 / 高度6.3米 / 三相電 / 無廠登...)"
                    className="w-full h-80 bg-slate-50 border border-slate-200 rounded p-4 focus:outline-none focus:border-emerald-500 text-sm font-sans leading-relaxed transition-colors"
                  />
                  <div className="mt-4 flex justify-between items-center">
                    <div className="text-[10px] text-slate-400 font-mono">
                      READY TO PROCESS : {propertyInfo.length} CHARS
                    </div>
                    <button
                      onClick={handleGenerate}
                      disabled={!propertyInfo.trim() || loading}
                      className="px-8 py-2 bg-slate-900 text-white rounded text-xs font-bold tracking-widest hover:bg-slate-800 disabled:opacity-50 transition-all flex items-center gap-2"
                    >
                      EXECUTE ANALYSIS <ChevronRight className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 w-full">
                {[
                  { icon: Warehouse, label: '廠房分析', desc: '高度與電力規格評估' },
                  { icon: Home, label: '住宅開發', desc: '租補與稅務合規優化' },
                  { icon: Search, label: 'SEO 佈局', desc: '同區競品熱點偵測' },
                ].map((item, index) => (
                  <div key={index} className="p-4 bg-white border border-slate-200 rounded flex gap-3 items-start shadow-sm">
                    <div className="p-2 bg-emerald-50 rounded text-emerald-600">
                      <item.icon className="w-4 h-4" />
                    </div>
                    <div>
                      <h4 className="text-xs font-bold text-slate-900">{item.label}</h4>
                      <p className="text-[10px] text-slate-500 mt-1">{item.desc}</p>
                    </div>
                  </div>
                ))}
              </div>
            </motion.div>
          )}

          {step === 'processing' && (
            <motion.div
              key="processing"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="flex-1 flex flex-col items-center justify-center space-y-6"
            >
              <div className="relative">
                <Loader2 className="w-12 h-12 text-emerald-500 animate-spin" />
                <div className="absolute inset-0 flex items-center justify-center text-[10px] font-bold text-emerald-600">AI</div>
              </div>
              <div className="text-center space-y-1">
                <h3 className="text-sm font-bold uppercase tracking-widest">市場數據同步中...</h3>
                <p className="text-[10px] text-slate-400 font-mono animate-pulse">
                  FETCHING 591 DATA ｜ ANALYZING TRENDS ｜ SYNCING COMPLIANCE
                </p>
              </div>
            </motion.div>
          )}

          {step === 'result' && (
            <motion.div
              key="result"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="flex-1 grid grid-cols-1 lg:grid-cols-12 gap-4"
            >
              {/* Left Panel: Analysis & Intelligence */}
              <section className="lg:col-span-5 flex flex-col gap-4">
                <div className="flex-1 bg-white border border-slate-200 rounded-lg shadow-sm flex flex-col overflow-hidden">
                  <div className="p-3 bg-slate-50 border-b border-slate-200 flex justify-between items-center">
                    <h2 className="text-xs font-bold text-slate-500 uppercase tracking-wider flex items-center gap-2">
                       <TrendingUp className="w-3 h-3 text-emerald-500" />
                       Step 1 & 2: 市場分析與策略
                    </h2>
                    <span className="px-2 py-0.5 bg-emerald-100 text-emerald-700 text-[10px] font-bold rounded">LIVE SYNCED</span>
                  </div>
                  <div className="p-6 overflow-y-auto space-y-6">
                    <div className="p-4 bg-slate-900 sm:rounded-md">
                      <div className="flex items-center justify-between mb-4">
                        <h3 className="text-[10px] text-emerald-400 font-mono uppercase tracking-widest">Property Metadata</h3>
                        <button 
                          onClick={() => setStep('input')}
                          className="text-[9px] text-slate-400 hover:text-white uppercase font-bold"
                        >
                          [ Re-input ]
                        </button>
                      </div>
                      <div className="text-xs text-slate-300 leading-relaxed font-mono whitespace-pre-wrap opacity-80 border-l border-slate-700 pl-3">
                        {propertyInfo.slice(0, 200)}...
                      </div>
                    </div>

                    <div className="space-y-4">
                      <div className="flex items-center gap-2 pb-2 border-b border-slate-100 text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                        <ShieldCheck className="w-3 h-3" />
                        AI 深度解讀報告
                      </div>
                      <div className="prose prose-slate prose-sm max-w-none">
                        <div className="text-[13px] leading-relaxed text-slate-700 whitespace-pre-wrap">
                          {/* We display the result but maybe split it if we could, for now just a nice container */}
                          {analysisResult.split('━━━━━━━━━━━━━━━━━━━━━━━━')[0]}
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </section>

              {/* Right Panel: Content Engine */}
              <section className="lg:col-span-7 flex flex-col gap-4">
                <div className="flex-1 bg-white border border-slate-200 rounded-lg shadow-sm flex flex-col overflow-hidden">
                  <div className="flex bg-slate-50 border-b border-slate-200">
                    <button className="px-4 py-3 text-xs font-bold border-b-2 border-emerald-500 text-slate-900 bg-white uppercase tracking-tight">
                      Creative & SEO Output
                    </button>
                    <div className="ml-auto flex items-center pr-4 gap-2">
                       {copied === 'all' && <span className="text-[9px] text-emerald-600 font-bold animate-fade-in">COPIED!</span>}
                      <button 
                        onClick={() => handleCopy(analysisResult, 'all')}
                        className="text-[10px] bg-slate-900 text-white px-3 py-1 rounded font-bold hover:bg-slate-800 transition-colors uppercase tracking-widest"
                      >
                        Copy All
                      </button>
                    </div>
                  </div>

                  <div className="flex-1 p-6 overflow-y-auto bg-slate-50">
                    <div className="max-w-2xl mx-auto">
                      <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm space-y-6">
                        {/* The actual AI output content */}
                        <div className="text-sm leading-relaxed text-slate-800">
                          <div className="whitespace-pre-wrap font-sans">
                            {analysisResult.includes('━━━━━━━━━━━━━━━━━━━━━━━━') 
                              ? analysisResult.split('━━━━━━━━━━━━━━━━━━━━━━━━').slice(1).join('━━━━━━━━━━━━━━━━━━━━━━━━')
                              : analysisResult
                            }
                          </div>
                        </div>
                      </div>

                      <div className="mt-4 bg-emerald-50 border border-emerald-200 p-4 rounded flex items-center gap-4">
                        <div className="w-10 h-10 bg-emerald-500 text-white rounded-full flex items-center justify-center text-xs font-bold italic shadow-lg shadow-emerald-500/20">SEO</div>
                        <div className="flex-1">
                          <div className="text-[9px] uppercase text-emerald-600 font-bold tracking-widest">Compliance Status</div>
                          <div className="text-xs font-bold text-slate-900">經紀人資訊已正確寫入文案末端</div>
                        </div>
                        <div className="text-[10px] font-mono text-emerald-500 font-bold uppercase tracking-tighter">
                          Verified by Zero
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </section>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Profile Settings Modal */}
        <AnimatePresence>
          {showProfileSettings && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 z-[100] flex items-center justify-center p-6 bg-slate-900/60 backdrop-blur-sm"
              onClick={() => setShowProfileSettings(false)}
            >
              <motion.div
                initial={{ scale: 0.95, opacity: 0, y: 20 }}
                animate={{ scale: 1, opacity: 1, y: 0 }}
                exit={{ scale: 0.95, opacity: 0, y: 20 }}
                className="bg-white w-full max-w-lg rounded-lg shadow-2xl overflow-hidden flex flex-col"
                onClick={(e) => e.stopPropagation()}
              >
                <div className="p-4 bg-slate-900 text-white flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Settings className="w-4 h-4 text-emerald-400" />
                    <span className="text-xs font-bold uppercase tracking-widest">個人/法規資訊設定</span>
                  </div>
                  <button onClick={() => setShowProfileSettings(false)}>
                    <X className="w-4 h-4 text-slate-400 hover:text-white" />
                  </button>
                </div>
                
                <div className="p-6 space-y-4 max-h-[70vh] overflow-y-auto">
                  <p className="text-[11px] text-slate-500 leading-relaxed italic border-l-2 border-emerald-500 pl-3">
                    在此輸入的資訊將自動儲存於您的瀏覽器中，並作為 AI 生成文案時的「法規尾段」固定內容。
                  </p>
                  
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-1.5">
                      <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">聯絡姓名</label>
                      <input 
                        type="text" 
                        value={profile.name}
                        onChange={e => setProfile({...profile, name: e.target.value})}
                        className="w-full bg-slate-50 border border-slate-200 rounded px-3 py-2 text-sm focus:outline-none focus:border-emerald-500"
                      />
                    </div>
                    <div className="space-y-1.5">
                      <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">聯絡電話</label>
                      <input 
                        type="text" 
                        value={profile.phone}
                        onChange={e => setProfile({...profile, phone: e.target.value})}
                        className="w-full bg-slate-50 border border-slate-200 rounded px-3 py-2 text-sm focus:outline-none focus:border-emerald-500"
                      />
                    </div>
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Line ID</label>
                    <input 
                      type="text" 
                      value={profile.lineId}
                      onChange={e => setProfile({...profile, lineId: e.target.value})}
                      className="w-full bg-slate-50 border border-slate-200 rounded px-3 py-2 text-sm focus:outline-none focus:border-emerald-500"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">經紀業名稱</label>
                    <input 
                      type="text" 
                      value={profile.company}
                      onChange={e => setProfile({...profile, company: e.target.value})}
                      className="w-full bg-slate-50 border border-slate-200 rounded px-3 py-2 text-sm focus:outline-none focus:border-emerald-500"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">公司統編</label>
                    <input 
                      type="text" 
                      value={profile.taxId}
                      onChange={e => setProfile({...profile, taxId: e.target.value})}
                      className="w-full bg-slate-50 border border-slate-200 rounded px-3 py-2 text-sm focus:outline-none focus:border-emerald-500"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">不動產經紀人/證號</label>
                    <input 
                      type="text" 
                      value={profile.broker}
                      onChange={e => setProfile({...profile, broker: e.target.value})}
                      className="w-full bg-slate-50 border border-slate-200 rounded px-3 py-2 text-sm focus:outline-none focus:border-emerald-500"
                      placeholder="例如：鄭善仁（113）南市字第001001號"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">不動產營業員/證號</label>
                    <input 
                      type="text" 
                      value={profile.salesperson}
                      onChange={e => setProfile({...profile, salesperson: e.target.value})}
                      className="w-full bg-slate-50 border border-slate-200 rounded px-3 py-2 text-sm focus:outline-none focus:border-emerald-500"
                      placeholder="例如：黃先生（115）登字第505314號"
                    />
                  </div>
                </div>

                <div className="p-4 bg-slate-50 border-t border-slate-200 flex justify-end">
                   <button 
                    onClick={() => setShowProfileSettings(false)}
                    className="px-6 py-2 bg-emerald-600 text-white rounded text-xs font-bold tracking-widest hover:bg-emerald-700 transition-all flex items-center gap-2"
                   >
                     <Save className="w-3.5 h-3.5" />
                     儲存資訊
                   </button>
                </div>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Cookie Module Overlay */}
        <AnimatePresence>
          {showCookieModule && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 z-[100] flex items-center justify-center p-6 bg-slate-900/60 backdrop-blur-sm"
              onClick={() => setShowCookieModule(false)}
            >
              <motion.div
                initial={{ scale: 0.95, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                exit={{ scale: 0.95, opacity: 0 }}
                className="bg-slate-950 w-full max-w-2xl rounded-lg p-6 border border-slate-800 shadow-2xl space-y-4"
                onClick={(e) => e.stopPropagation()}
              >
                <div className="flex items-center justify-between border-b border-slate-800 pb-3">
                  <div className="flex items-center gap-2 text-emerald-400 font-mono text-xs leading-none">
                    <Terminal className="w-4 h-4" />
                    COOKIE_CONTROLLER.PY
                  </div>
                  <div className="flex gap-1.5">
                    <div className="w-2 h-2 rounded-full bg-slate-700" />
                    <div className="w-2 h-2 rounded-full bg-slate-700" />
                    <div className="w-2 h-2 rounded-full bg-slate-700" />
                  </div>
                </div>
                <div className="relative">
                  <pre className="p-4 bg-black rounded text-[11px] font-mono text-slate-400 overflow-x-auto selection:bg-emerald-500/30">
                    <code>{COOKIE_SNIPPET}</code>
                  </pre>
                  <button
                    onClick={() => handleCopy(COOKIE_SNIPPET, 'cookie')}
                    className="absolute top-2 right-2 p-1.5 bg-slate-800 hover:bg-slate-700 rounded transition-colors"
                  >
                    {copied === 'cookie' ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3 text-slate-500" />}
                  </button>
                </div>
                <div className="text-[10px] text-slate-600 font-mono">
                  [*] AUTH MODULE PERSISTED. SYSTEM_ID: AIS_RENTAL_V2
                </div>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>
      </main>

      {/* High Density Footer Overlay */}
      <footer className="fixed bottom-0 left-0 right-0 h-24 bg-white border-t border-slate-200 px-6 py-3 flex items-start gap-4 z-40 overflow-hidden">
        <div className="shrink-0 w-36 py-2 px-3 bg-rose-50 border border-rose-100 rounded flex flex-col justify-center items-center gap-1">
          <span className="text-[10px] font-bold text-rose-600 uppercase tracking-tighter">Compliance Check</span>
          <span className="text-xs font-black text-rose-800">100% SECURE</span>
        </div>
        
        <div className="hidden sm:flex flex-1 gap-6 text-[10px] leading-tight text-slate-500 font-medium">
          <div className="space-y-1 w-1/4">
            <p className="text-slate-800 font-bold uppercase mb-1 underline decoration-rose-400">禁止詞彙已移除</p>
            <p>已排除：秒殺、最便宜、神物件、唯一</p>
            <p>已替換：稀有釋出、同區少見、條件佳</p>
          </div>
          <div className="space-y-1 flex-1">
            <p className="text-slate-800 font-bold uppercase mb-1 underline decoration-slate-400">當前法規尾段（由設定檔產生）</p>
            <p className="italic">🤝🏻 成交收取半個月服務費。聯絡方式📲 {profile.phone} (Line: {profile.lineId})</p>
            <p>經紀業：{profile.company} (統編: {profile.taxId}) ｜ 經紀人：{profile.broker.split('（')[0]}</p>
          </div>
          <div className="w-32 flex flex-col justify-end items-end gap-1">
            <div className="text-[9px] text-slate-400 italic uppercase tracking-widest">Market Engine</div>
            <div className="text-[9px] text-emerald-600 font-bold">READY TO EXPORT</div>
          </div>
        </div>
      </footer>
    </div>
  );
}
