/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useRef, useEffect } from 'react';
import { 
  Search, 
  MapPin, 
  TrendingUp, 
  Building2,
  Sparkles,
  Maximize2,
  FileText, 
  ShieldCheck, 
  AlertCircle,
  Copy, 
  Check, 
  Loader2, 
  ChevronRight,
  Warehouse,
  Home,
  Zap,
  Info,
  Terminal,
  RefreshCw,
  UserCircle,
  Settings,
  Save,
  Heart,
  X,
  Trash2
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { generateRentalAnalysis, refinePlatformCopy, generateTitles } from './services/aiService';
import { db, auth, OperationType, handleFirestoreError } from './lib/firebase';
import { 
  signInWithPopup, 
  GoogleAuthProvider, 
  onAuthStateChanged, 
  signOut,
  User
} from 'firebase/auth';
import { 
  doc, 
  getDoc, 
  setDoc, 
  collection, 
  addDoc, 
  query, 
  orderBy, 
  limit, 
  getDocs,
  onSnapshot,
  deleteDoc,
  serverTimestamp,
  getDocFromServer
} from 'firebase/firestore';

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
  companyAddress: string;
  taxId: string;
  broker: string; // 經紀人
  salesperson: string; // 營業員
  customFooter?: string; // 自定義法規尾段
}

const DEFAULT_PROFILE: AgentProfile = {
  name: '黃先生',
  phone: '0966-705-761',
  lineId: 'huang92071213',
  company: '生活尋家廠房物業有限公司',
  companyAddress: '台中市南區復興路二段123號',
  taxId: '60372057',
  broker: '鄭善仁（113）南市字第001001號',
  salesperson: '黃先生（115）登字第505314號',
  customFooter: `🤝🏻成交時需收取半個月服務費
※本廣告自刊登日起七日內有效，過期資訊可能已異動，請來電或加 Line 確認售租狀況。

聯絡方式📲[PHONE]
Line ID：[LINE_ID]
經紀業：[COMPANY]
公司地址：[COMPANY_ADDRESS]
統編：[TAX_ID]
經紀人：[BROKER]
營業員：[SALESPERSON]
以上廣告文案如有誤差一律依謄本、現況、登記資料為準。`,
};



const SavedLibraryView = ({ onSelect }: { onSelect: (data: any) => void }) => {
  const [items, setItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!auth.currentUser) return;

    const q = query(
      collection(db, `users/${auth.currentUser.uid}/properties`), 
      orderBy('createdAt', 'desc')
    );

    // Real-time listener
    const unsubscribe = onSnapshot(q, (snap) => {
      setItems(snap.docs.map(doc => ({ id: doc.id, ...doc.data() })));
      setLoading(false);
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, `users/${auth.currentUser.uid}/properties`);
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  const handleDelete = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!auth.currentUser || !window.confirm('確定要刪除這筆文案嗎？')) return;
    
    try {
      await deleteDoc(doc(db, `users/${auth.currentUser.uid}/properties`, id));
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, `users/${auth.currentUser.uid}/properties/${id}`);
    }
  };

  if (loading) return (
    <div className="flex flex-col items-center justify-center py-20 gap-4">
      <Loader2 className="w-8 h-8 text-brand-green animate-spin" />
      <p className="text-sm font-bold text-brand-line animate-pulse">庫存調閱中...</p>
    </div>
  );

  if (items.length === 0) return (
    <div className="flex flex-col items-center justify-center py-20 gap-6 grayscale opacity-40">
      <Warehouse className="w-16 h-16 text-brand-line" />
      <p className="text-sm font-bold text-brand-line">目前還沒有儲存任何物件文案</p>
    </div>
  );

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
      {items.map((item) => (
        <div 
          key={item.id}
          className="group relative bg-white border border-brand-beige rounded-2xl p-5 hover:border-brand-gold hover:shadow-xl transition-all flex flex-col gap-4 overflow-hidden"
        >
          <div className="flex items-start justify-between">
            <div className={`px-2 py-0.5 rounded text-[9px] font-black uppercase tracking-wider ${
              item.tone === 'fun' ? 'bg-orange-50 text-orange-600 border border-orange-200' :
              item.tone === 'warm' ? 'bg-pink-50 text-pink-600 border border-pink-200' :
              item.tone === 'urgent' ? 'bg-red-50 text-red-600 border border-red-200' :
              item.tone === 'luxury' ? 'bg-yellow-50 text-yellow-600 border border-yellow-200' :
              item.tone === 'budget-friendly' ? 'bg-emerald-50 text-emerald-600 border border-emerald-200' :
              item.tone === 'industrial' ? 'bg-slate-50 text-slate-600 border border-slate-200' :
              item.tone === 'friendly' ? 'bg-teal-50 text-teal-600 border border-teal-200' :
              item.tone === 'story' ? 'bg-indigo-50 text-indigo-600 border border-indigo-200' :
              'bg-blue-50 text-blue-600 border border-blue-200'
            }`}>
              {
                item.tone === 'fun' ? '趣味幽默' :
                item.tone === 'warm' ? '感性溫馨' :
                item.tone === 'urgent' ? '急租催租' :
                item.tone === 'luxury' ? '頂級奢華' :
                item.tone === 'budget-friendly' ? '極致超值' :
                item.tone === 'industrial' ? '工業務實' :
                item.tone === 'friendly' ? '輕鬆親切' :
                item.tone === 'story' ? '情境故事' :
                '專業理性'
              }
            </div>
            <p className="text-[10px] text-brand-line font-mono">{new Date(item.createdAt?.toDate()).toLocaleDateString()}</p>
          </div>
          
          <div className="space-y-1">
            <h3 className="text-md font-bold text-brand-title line-clamp-1">{item.title}</h3>
            <p className="text-xs text-brand-body line-clamp-2 leading-relaxed opacity-60">
              {item.rawInfo}
            </p>
          </div>

          <div className="mt-auto pt-4 border-t border-brand-beige flex gap-2">
            <button 
              onClick={() => onSelect(item)}
              className="flex-1 py-2 bg-brand-green text-white text-[10px] font-bold rounded-lg hover:bg-brand-green-dark transition-all flex items-center justify-center gap-2"
            >
              <FileText className="w-3.5 h-3.5" />
              調取內容
            </button>
            <button 
              className="p-2 border border-brand-beige rounded-lg hover:bg-rose-50 hover:text-rose-500 transition-colors"
              onClick={(e) => handleDelete(item.id, e)}
            >
              <Trash2 className="w-4 h-4" />
            </button>
          </div>
        </div>
      ))}
    </div>
  );
};

const SocialMockup = ({ platform, content, profile }: { platform: string, content: string, profile: AgentProfile }) => {
  const getHeader = () => {
    switch (platform) {
      case 'FB_POST':
        return (
          <div className="flex items-center gap-2 p-3 border-b border-slate-100">
            <div className="w-8 h-8 bg-blue-600 rounded-full flex items-center justify-center text-white font-bold text-xs">F</div>
            <div className="flex flex-col">
              <span className="text-[11px] font-bold text-slate-900">{profile.name}</span>
              <span className="text-[9px] text-slate-500">Sponsored • 剛剛</span>
            </div>
          </div>
        );
      case 'IG_POST':
        return (
          <div className="flex items-center gap-2 p-3 border-b border-slate-100">
            <div className="w-8 h-8 bg-gradient-to-tr from-yellow-400 via-red-500 to-purple-600 rounded-full p-[1px]">
              <div className="w-full h-full bg-white rounded-full flex items-center justify-center p-[2px]">
                <div className="w-full h-full bg-slate-200 rounded-full" />
              </div>
            </div>
            <span className="text-[11px] font-bold text-slate-900">{profile.name}</span>
          </div>
        );
      case 'THREADS_POST':
        return (
          <div className="flex items-center gap-2 p-3">
             <div className="w-8 h-8 bg-black rounded-full flex items-center justify-center text-white text-[10px]">T</div>
             <span className="text-[11px] font-bold text-slate-900">{profile.name}</span>
          </div>
        );
      default:
        return null;
    }
  };

  return (
    <div className="w-full max-w-[320px] mx-auto bg-white rounded-[2.5rem] p-3 shadow-2xl border-[8px] border-slate-900 ring-4 ring-slate-800">
      <div className="relative aspect-[9/19] bg-slate-50 rounded-[1.8rem] overflow-hidden flex flex-col">
        {/* Status Bar */}
        <div className="h-6 flex items-center justify-between px-6 pt-1">
          <span className="text-[9px] font-bold">9:41</span>
          <div className="flex gap-1.5">
            <div className="w-3 h-3 bg-slate-400/20 rounded-full" />
          </div>
        </div>

        {getHeader()}

        <div className="flex-1 overflow-y-auto scroller-hide p-4 space-y-4">
          {/* Post Content */}
          <div className="space-y-3">
             {platform === 'IG_POST' && (
               <div className="aspect-square bg-slate-200 rounded-lg flex items-center justify-center text-slate-400 text-[10px] font-bold uppercase tracking-widest">
                  [ 圖片預覽區 ]
               </div>
             )}
             
             <div className="text-[11px] leading-relaxed text-slate-800 whitespace-pre-wrap font-sans">
               {content || '正在生成創意文案...'}
             </div>
          </div>
        </div>

        {/* Footer Bar */}
        <div className="h-10 border-t border-slate-100 flex items-center justify-around px-2">
           <Heart className="w-4 h-4 text-slate-400" />
           <div className="w-10 h-1 bg-slate-200 rounded-full" />
           <Save className="w-4 h-4 text-slate-400" />
        </div>
      </div>
    </div>
  );
};

const ComplianceHighlighter = ({ text }: { text: string }) => {
  if (!text) return null;
  
  const rules = [
    { word: "最便宜", desc: "涉及不實比較，易遭台灣《公平交易法》公平會裁罰", level: "critical" },
    { word: "秒殺", desc: "涉嫌非真實促銷煽動性語詞，易引起不實廣告糾紛", level: "warning" },
    { word: "唯一", desc: "絕對性誇大首創詞，缺乏公信力佐證則屬不實廣告法盲區", level: "critical" },
    { word: "保證出租", desc: "涉及投報率與租收保障承諾，極易被地方主管機關重罰", level: "critical" },
    { word: "絕無僅有", desc: "極端排他字詞，易招公平交易委員會主動稽查", level: "warning" },
    { word: "投資必賺", desc: "保證獲利，違反《不動產經紀業管理條例》不實廣告之規定", level: "critical" },
    { word: "神物件", desc: "虛浮浮誇廣告用語，涉嫌違反仲介經紀業誠實廣告準則", level: "warning" },
    { word: "錯過不再", desc: "強制招徠施壓催逼詞，小心廣告真實度受投訴與挑戰", level: "warning" },
  ];

  // Find all matches
  const foundWords = rules.filter(r => text.includes(r.word));

  if (foundWords.length === 0) {
    return (
      <div className="space-y-4">
        <div className="text-sm leading-relaxed text-brand-body font-sans whitespace-pre-wrap">
          {text}
        </div>
        <div className="bg-emerald-50 border border-emerald-100 text-emerald-800 rounded-xl p-3 text-[11px] flex items-center gap-2">
          <ShieldCheck className="w-4 h-4 text-emerald-600 shrink-0" />
          <span>恭喜！此平台文案未偵測到任何法規违規詞彙，符合台灣不動產誠實廣告真實性標準。</span>
        </div>
      </div>
    );
  }

  // Highlight words
  const wordsRegex = new RegExp(`(${rules.map(r => r.word).join('|')})`, 'g');
  const parts = text.split(wordsRegex);

  return (
    <div className="space-y-4">
      {/* Risk alert box */}
      <div className="bg-amber-50/70 border border-amber-200/60 text-amber-900 rounded-xl p-3.5 text-xs space-y-1.5 leading-tight">
        <div className="flex items-center gap-2 font-black text-amber-700">
          <AlertCircle className="w-4 h-4 shrink-0" />
          <span>⚠️ 偵測到台灣不動產法規 / 行銷敏感字眼 ({foundWords.length} 個)</span>
        </div>
        <p className="text-[10px] text-amber-800/80 leading-relaxed pl-6">
          依據台灣《公平交易法》及《不動產經紀業管理條例》，使用過於誇張或承諾保證之詞彙，易面臨行政調查與裁罰風險。
        </p>
        <div className="flex flex-wrap gap-1.5 pt-1.5 pl-6">
          {foundWords.map(fw => (
            <span 
              key={fw.word} 
              className={`px-2 py-0.5 rounded text-[9px] font-bold ${
                fw.level === 'critical' ? 'bg-rose-100 text-rose-800 border border-rose-200' : 'bg-amber-100 text-amber-800 border border-amber-200'
              }`}
              title={fw.desc}
            >
              {fw.word}: {fw.desc}
            </span>
          ))}
        </div>
      </div>

      {/* Styled text block */}
      <div className="text-sm leading-relaxed text-brand-body font-sans whitespace-pre-wrap border border-brand-beige/40 p-4 rounded-xl bg-brand-cream/5">
        {parts.map((part, index) => {
          const matchedRule = rules.find(r => r.word === part);
          if (matchedRule) {
            return (
              <span 
                key={index} 
                className={`px-1 rounded-sm border-b-2 font-semibold cursor-help group relative ${
                  matchedRule.level === 'critical' 
                    ? 'bg-rose-100 text-rose-950 border-rose-500' 
                    : 'bg-amber-100 text-amber-950 border-amber-500'
                }`}
              >
                {part}
                {/* Custom Tooltip */}
                <span className="pointer-events-none absolute bottom-full left-1/2 -translate-x-1/2 mb-2 w-48 bg-slate-950 text-white text-[9px] font-normal rounded-md p-2 hidden group-hover:block z-50 shadow-xl text-center leading-normal">
                  {matchedRule.desc}
                </span>
              </span>
            );
          }
          return <React.Fragment key={index}>{part}</React.Fragment>;
        })}
      </div>
    </div>
  );
};

export default function App() {
  const [propertyInfo, setPropertyInfo] = useState('');
  const [step, setStep] = useState<Step>('input');
  const [analysisResult, setAnalysisResult] = useState<string>('');
  const [overrideSections, setOverrideSections] = useState<Record<string, string>>({});
  const [refineQuery, setRefineQuery] = useState('');
  const [refinementLoading, setRefinementLoading] = useState(false);
  const [loading, setLoading] = useState(false);
  const [copied, setCopied] = useState<string | null>(null);
  const [showCookieModule, setShowCookieModule] = useState(false);
  const [showProfileSettings, setShowProfileSettings] = useState(false);
  const [showLibrary, setShowLibrary] = useState(false);
  const [showMobilePreview, setShowMobilePreview] = useState(false);
  const [isFullWidth, setIsFullWidth] = useState(true);
  const [inputMode, setInputMode] = useState<'free' | 'wizard'>('free');
  const [tone, setTone] = useState<'professional' | 'fun' | 'warm' | 'urgent' | 'luxury' | 'budget-friendly' | 'industrial' | 'friendly' | 'story'>('professional');
  
  // Wizard States
  const [wizardData, setWizardData] = useState({
    title: '',
    location: '',
    type: 'residential',
    area: '',
    rent: '',
    floor: '',
    specs: '', // Additional details
  });
  
  const [profile, setProfile] = useState<AgentProfile>(DEFAULT_PROFILE);
  const [history, setHistory] = useState<{info: string, result: string, date: string}[]>([]);
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [isAuthReady, setIsAuthReady] = useState(false);

  const [customTitles, setCustomTitles] = useState<string[]>([]);
  const [loadingTitles, setLoadingTitles] = useState(false);

  const getHeuristicSuggestions = (data: typeof wizardData, info: string, mode: 'free' | 'wizard') => {
    let location = "精選";
    let rentText = "";
    let areaText = "";
    let typeLabel = "優良物件";
    let specHighlight = "機能便利/採光好";

    if (mode === 'wizard') {
      if (data.location) location = data.location.trim().substring(0, 6);
      if (data.rent) rentText = `${data.rent}元/月`;
      if (data.area) areaText = `${data.area}坪`;
      if (data.specs) {
        const parts = data.specs.split(/[、,，\s]/).filter(Boolean);
        if (parts.length > 0) specHighlight = parts.slice(0, 2).join('/');
      }
      if (data.type === 'factory') typeLabel = '挑高廠房';
      else if (data.type === 'commercial') typeLabel = '黃金店面';
      else typeLabel = '溫馨美居';
    } else {
      // Attempt simple extraction from free text propertyInfo
      const rentMatch = info.match(/租(?:金)?[：:\s]?(\d+(?:[,，]\d+)*(?:\s*元)?)(?:\/月)?/i) || info.match(/(\d+)\s*元/);
      if (rentMatch) {
        rentText = `${rentMatch[1].replace(/元/g, '')}元/月`;
      }
      const areaMatch = info.match(/(\d+(?:\.\d+)?)\s*坪/);
      if (areaMatch) {
        areaText = `${areaMatch[1]}坪`;
      }
      const locMatch = info.match(/([^\s,，/\d]{2,6}(?:區|市|路|鎮|鄉|里|村))/);
      if (locMatch) {
        location = locMatch[1];
      }
      const specKeywords = ["挑高", "三相電", "車位", "捷運", "全配", "電梯", "雙車", "獨棟", "大面寬"];
      const foundSpecs = specKeywords.filter(k => info.includes(k));
      if (foundSpecs.length > 0) {
        specHighlight = foundSpecs.slice(0, 2).join(' / ');
      }
      
      if (info.includes("廠房") || info.includes("工業")) typeLabel = '熱銷廠房';
      else if (info.includes("店面") || info.includes("商用") || info.includes("一樓")) typeLabel = '金店面';
      else if (info.includes("套房")) typeLabel = '採光套房';
      else typeLabel = '精選住宅';
    }

    const title1 = `【✨租屋首選】${location} ${areaText} ${typeLabel} ✦ ${specHighlight}`.substring(0, 28);
    const title2 = `【💎稀有釋出】${location}優質空間 | ${rentText || '優質環境'} | ${specHighlight}`.substring(0, 28);
    const title3 = `【🔥超高CP】${location} | ${areaText || '大空間'} | ${specHighlight}商務首選`.substring(0, 28);

    return [title1, title2, title3];
  };

  const fetchAISuggestions = async () => {
    setLoadingTitles(true);
    try {
      const titles = await generateTitles(propertyInfo, wizardData, inputMode);
      if (titles && titles.length > 0) {
        setCustomTitles(titles);
      }
    } catch (e) {
      console.error("AI Title Gen Error:", e);
    } finally {
      setLoadingTitles(false);
    }
  };

  const handleSelectTitle = (selectedTitle: string) => {
    setWizardData(prev => ({ ...prev, title: selectedTitle }));
    if (inputMode === 'free') {
      const lines = propertyInfo.split('\n');
      if (lines.length > 0 && (lines[0].startsWith('【') || lines[0].startsWith('標題：') || lines[0].startsWith('【標題】'))) {
        lines[0] = `【標題】：${selectedTitle}`;
        setPropertyInfo(lines.join('\n'));
      } else {
        setPropertyInfo(`【標題】：${selectedTitle}\n${propertyInfo}`);
      }
    }
  };

  // Load autosaved fields from localStorage on mount
  useEffect(() => {
    const savedPropertyInfo = localStorage.getItem('autosave_propertyInfo');
    if (savedPropertyInfo !== null) setPropertyInfo(savedPropertyInfo);

    const savedTone = localStorage.getItem('autosave_tone');
    if (savedTone !== null) setTone(savedTone as any);

    const savedInputMode = localStorage.getItem('autosave_inputMode');
    if (savedInputMode !== null) setInputMode(savedInputMode as any);

    const savedWizardData = localStorage.getItem('autosave_wizardData');
    if (savedWizardData !== null) {
      try {
        setWizardData(prev => ({ ...prev, ...JSON.parse(savedWizardData) }));
      } catch (e) {
        console.error("Autosave load error:", e);
      }
    }
  }, []);

  // Autosave when states change
  useEffect(() => {
    localStorage.setItem('autosave_propertyInfo', propertyInfo);
  }, [propertyInfo]);

  useEffect(() => {
    localStorage.setItem('autosave_tone', tone);
  }, [tone]);

  useEffect(() => {
    localStorage.setItem('autosave_inputMode', inputMode);
  }, [inputMode]);

  useEffect(() => {
    localStorage.setItem('autosave_wizardData', JSON.stringify(wizardData));
  }, [wizardData]);

  // Connection Test
  useEffect(() => {
    const testConnection = async () => {
      try {
        // Test connection to Firestore
        await getDocFromServer(doc(db, 'test', 'connection'));
        console.log("Firebase Connection: Success");
      } catch (error) {
        if (error instanceof Error) {
          // If we get a permission-denied, it actually means we ARE connected to Firebase
          // and the server responded with a denial.
          if (error.message.includes('permission-denied') || error.message.includes('insufficient permissions')) {
            console.log("Firebase Connection: Success (Authenticated endpoint reachable)");
            return;
          }

          if (error.message.includes('the client is offline')) {
            console.error("Firebase Connection Error: The client is offline.");
          } else {
            console.error("Firebase Initialization Error:", error.message);
          }
        }
      }
    };
    testConnection();
  }, []);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      setCurrentUser(user);
      if (user) {
        // Load Profile
        try {
          const profileDoc = await getDoc(doc(db, `users/${user.uid}/profile/default`));
          if (profileDoc.exists()) {
            setProfile({ ...DEFAULT_PROFILE, ...profileDoc.data() } as AgentProfile);
          } else {
            // First time login, save default profile
            await setDoc(doc(db, `users/${user.uid}/profile/default`), {
              ...DEFAULT_PROFILE,
              userId: user.uid,
              updatedAt: serverTimestamp()
            });
          }
        } catch (error) {
          handleFirestoreError(error, OperationType.GET, `users/${user.uid}/profile/default`);
        }

        // Load History
        try {
          const historyQuery = query(
            collection(db, `users/${user.uid}/history`), 
            orderBy('createdAt', 'desc'), 
            limit(5)
          );
          const historySnap = await getDocs(historyQuery);
          const historyItems = historySnap.docs.map(doc => {
            const data = doc.data();
            return {
              info: data.inputInfo,
              result: data.result,
              date: data.createdAt?.toDate().toLocaleString() || new Date().toLocaleString()
            };
          });
          setHistory(historyItems);
        } catch (error) {
          handleFirestoreError(error, OperationType.LIST, `users/${user.uid}/history`);
        }
      } else {
        // Clear data if not logged in (or keep local until login)
        setProfile(DEFAULT_PROFILE);
        setHistory([]);
      }
      setIsAuthReady(true);
    });
    return () => unsubscribe();
  }, []);

  const handleLogin = async () => {
    const provider = new GoogleAuthProvider();
    try {
      await signInWithPopup(auth, provider);
    } catch (error) {
      console.error("Login Error", error);
    }
  };

  const handleLogout = async () => {
    try {
      await signOut(auth);
    } catch (error) {
      console.error("Logout Error", error);
    }
  };

  const getFormattedFooter = () => {
    const rawTemplate = profile.customFooter || `🤝🏻成交時需收取半個月服務費
※本廣告自刊登日起七日內有效，過期資訊可能已異動，請來電或加 Line 確認售租狀況。

聯絡方式📲[PHONE]
Line ID：[LINE_ID]
經紀業：[COMPANY]
公司地址：[COMPANY_ADDRESS]
統編：[TAX_ID]
經紀人：[BROKER]
營業員：[SALESPERSON]
以上廣告文案如有誤差一律依謄本、現況、登記資料為準。`;

    return rawTemplate
      .replace(/\[NAME\]/g, profile.name || '')
      .replace(/\[PHONE\]/g, profile.phone || '')
      .replace(/\[LINE_ID\]/g, profile.lineId || '')
      .replace(/\[COMPANY\]/g, profile.company || '')
      .replace(/\[COMPANY_ADDRESS\]/g, profile.companyAddress || '')
      .replace(/\[TAX_ID\]/g, profile.taxId || '')
      .replace(/\[BROKER\]/g, profile.broker || '')
      .replace(/\[SALESPERSON\]/g, profile.salesperson || '');
  };

  const getContactInfoOnly = () => {
    return `聯絡人 / 服務人員：${profile.name || ''}
聯絡電話：${profile.phone || ''}
Line ID：${profile.lineId || ''}
經紀業（公司）：${profile.company || ''}
公司地址：${profile.companyAddress || ''}
統一編號 (統編)：${profile.taxId || ''}
經紀人證號：${profile.broker || ''}
營業員證號：${profile.salesperson || ''}`;
  };

  const [activeTab, setActiveTab] = useState('PLATFORM_STUDY');

  const parseResult = (text: string) => {
    const sections: Record<string, string> = {
      PROPERTY_INFO: '',
      PLATFORM_STUDY: '',
      MARKET_REPORT: '',
      POSITIONING: '',
      FB_POST: '',
      IG_POST: '',
      THREADS_POST: '',
      '591_POST': '',
      LAKUYA_POST: '',
      SEO_TAGS: '',
    };

    const tags = [
      'PROPERTY_INFO',
      'PLATFORM_STUDY', 
      'MARKET_REPORT', 
      'POSITIONING', 
      'FB_POST', 
      'IG_POST',
      'THREADS_POST', 
      '591_POST', 
      'LAKUYA_POST',
      'SEO_TAGS'
    ];
    
    let lastIndex = 0;
    let lastTag = '';

    // Advanced cleaning
    const cleanedText = text.replace(/```/g, '');

    tags.forEach((tag) => {
      const tagStr = `[${tag}]`;
      const index = cleanedText.indexOf(tagStr);
      if (index !== -1) {
        if (lastTag) {
          sections[lastTag] = cleanedText.substring(lastIndex, index).trim();
        }
        lastTag = tag;
        lastIndex = index + tagStr.length;
      }
    });

    if (lastTag) {
      sections[lastTag] = cleanedText.substring(lastIndex).trim();
    }

    if (!lastTag) {
      return { MARKET_REPORT: cleanedText };
    }

    return sections;
  };

  const parsedSections = parseResult(analysisResult);
  const displayCopy = overrideSections[activeTab] !== undefined ? overrideSections[activeTab] : parsedSections[activeTab];

  const [activeIntel, setActiveIntel] = useState<string | null>(null);

  const intelData: Record<string, { title: string; content: React.ReactNode }> = {
    MARKET: {
      title: '同區租金行情參考 (2024)',
      content: (
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-2 text-xs">
            <div className="p-2 bg-brand-cream rounded border border-brand-beige">
              <p className="text-brand-line">台中南區 (廠房)</p>
              <p className="font-bold text-brand-title">NT$800 - 1100 / 坪</p>
            </div>
            <div className="p-2 bg-brand-cream rounded border border-brand-beige">
              <p className="text-brand-line">台北中正 (住宅)</p>
              <p className="font-bold text-brand-title">NT$1500 - 2200 / 坪</p>
            </div>
            <div className="p-2 bg-brand-cream rounded border border-brand-beige">
              <p className="text-brand-line">高雄楠梓 (廠房)</p>
              <p className="font-bold text-brand-title">NT$500 - 750 / 坪</p>
            </div>
            <div className="p-2 bg-brand-cream rounded border border-brand-beige">
              <p className="text-brand-line">台中大里 (廠房)</p>
              <p className="font-bold text-brand-title">NT$700 - 950 / 坪</p>
            </div>
          </div>
          <p className="text-[10px] text-brand-line italic">* 數據來源：實價登錄與 591 市場監測數據綜合分析。</p>
        </div>
      )
    },
    HOT_ZONE: {
      title: '今日開發熱區推薦',
      content: (
        <div className="space-y-3">
          <p className="text-xs text-brand-body">點擊關鍵字複製到輸入框：</p>
          <div className="flex flex-wrap gap-2">
            {['台中西屯區', '竹科大雅區', '桃園蘆竹倉儲', '台南永康工業區', '北投士林科園'].map(zone => (
              <button 
                key={zone}
                onClick={() => setPropertyInfo(prev => prev + `\n區域：${zone}`)}
                className="px-2 py-1 bg-brand-cream text-brand-green text-[10px] font-bold rounded border border-brand-beige hover:bg-brand-green hover:text-white transition-all shadow-sm"
              >
                + {zone}
              </button>
            ))}
          </div>
        </div>
      )
    },
    DEMAND: {
      title: '高需求受眾分析 (Personas)',
      content: (
        <div className="space-y-3">
          <div className="p-3 border border-brand-beige rounded-lg bg-brand-cream/10">
            <h5 className="text-xs font-bold text-brand-title mb-1">📦 物流倉儲業</h5>
            <p className="text-[10px] text-brand-body">關注重點：40呎大貨車進出、三相電、合法廠登。</p>
          </div>
          <div className="p-3 border border-brand-beige rounded-lg bg-brand-cream/10">
            <h5 className="text-xs font-bold text-brand-title mb-1">🏠 科技新貴</h5>
            <p className="text-[10px] text-brand-body">關注重點：平面車位、租補報稅、採光通風、高速網路。</p>
          </div>
        </div>
      )
    },
    COMPLIANCE: {
      title: '廣告禁語檢查表 (法律合規)',
      content: (
        <div className="space-y-2">
          <p className="text-[11px] font-bold text-rose-500">❌ 嚴禁出現：</p>
          <div className="grid grid-cols-3 gap-1">
            {['第一', '唯一', '最佳', '秒殺', '保證', '賺錢'].map(word => (
              <div key={word} className="px-2 py-1 bg-rose-50 text-rose-700 text-[10px] rounded text-center border border-rose-100">{word}</div>
            ))}
          </div>
          <p className="text-[11px] font-bold text-brand-green mt-2">✅ 建議替代：</p>
          <div className="grid grid-cols-2 gap-1">
             <div className="p-1.5 bg-brand-cream text-brand-green text-[10px] rounded italic border border-brand-beige">「同區少見」</div>
             <div className="p-1.5 bg-brand-cream text-brand-green text-[10px] rounded italic border border-brand-beige">「條件極佳」</div>
          </div>
        </div>
      )
    },
    FEATURE_1: {
      title: '秒速生成技術說明',
      content: <p className="text-xs text-brand-body leading-relaxed">利用 Google Gemini 3.5 毫秒級預覽引擎，結合全台 591 市場數據標籤，能夠在 5 秒內產出符合 2024 最新流量邏輯的文案。</p>
    },
    FEATURE_2: {
      title: '智慧過濾機制',
      content: <p className="text-xs text-brand-body leading-relaxed">內建台灣《不動產經紀業管理條例》關鍵字過濾器，自動偵測並建議修改「唯一、保證、秒殺」等違法描述，降低被同業檢舉風險。</p>
    },
    FEATURE_3: {
      title: '精準 SEO 佈局',
      content: <p className="text-xs text-brand-body leading-relaxed">自動根據物件所在地，抓取 Google 熱門搜尋關鍵字拼裝「長尾標題」，提升廣告在搜尋引擎與 591 App 內部的排序點閱率。</p>
    }
  };

  const handleGenerate = async () => {
    let finalInfo = propertyInfo;
    if (inputMode === 'wizard') {
      finalInfo = `物件名稱：${wizardData.title}
地點：${wizardData.location}
類型：${wizardData.type}
坪數：${wizardData.area} 坪
租金：${wizardData.rent} 元
樓層：${wizardData.floor}
其他重點：${wizardData.specs}`;
    }

    if (!finalInfo.trim()) return;
    
    setLoading(true);
    setStep('processing');
    setOverrideSections({});
    setRefineQuery('');
    try {
      const footer = getFormattedFooter();
      const contactInfo = getContactInfoOnly();
      const result = await generateRentalAnalysis(finalInfo, footer, tone, contactInfo);
      
      setAnalysisResult(result || '');
      
      // Save to history
      const newEntry = { info: finalInfo, result: result || '', date: new Date().toLocaleString() };
      setHistory(prev => [newEntry, ...prev.slice(0, 4)]);

      if (currentUser) {
        try {
          await addDoc(collection(db, `users/${currentUser.uid}/history`), {
            userId: currentUser.uid,
            inputInfo: propertyInfo,
            result: result || '',
            createdAt: serverTimestamp()
          });
        } catch (error) {
          handleFirestoreError(error, OperationType.WRITE, `users/${currentUser.uid}/history`);
        }
      }
      
      setStep('result');
      setActiveTab('PROPERTY_INFO');
    } catch (error) {
      console.error(error);
      alert(error instanceof Error ? error.message : '生成失敗，請稍後再試。');
      setStep('input');
    } finally {
      setLoading(false);
    }
  };

  const handleRefine = async (platformKey: string) => {
    const currentText = overrideSections[platformKey] !== undefined ? overrideSections[platformKey] : parsedSections[platformKey];
    if (!currentText) {
      alert("請確認目前有可進行微調的文案！");
      return;
    }
    if (!refineQuery.trim()) {
      alert("請先輸入微調指令（例如：幫我把這篇的語氣改得更急迫一點、加入某商圈地標）！");
      return;
    }
    setRefinementLoading(true);
    try {
      const footer = getFormattedFooter();
      const contactInfo = getContactInfoOnly();
      const refinedResult = await refinePlatformCopy(currentText, refineQuery, platformKey, footer, contactInfo);
      if (refinedResult) {
        setOverrideSections(prev => ({
          ...prev,
          [platformKey]: refinedResult
        }));
        setRefineQuery('');
      } else {
        alert("微調後的回傳格式或內容為空，請重試。");
      }
    } catch (error) {
      console.error(error);
      alert(error instanceof Error ? error.message : "微調處理失敗，請確認伺服器連線或 API Key。");
    } finally {
      setRefinementLoading(false);
    }
  };

  const loadExample = (type: 'factory' | 'house') => {
    const examples = {
      factory: `南區廠房\n樓層：1F\n坪數：120坪\n租金：48000\n高度：6.3米\n寬/深：8/45\n電力：三相電220V\n廠登：❌\n營登：❌\n臨路：20米（貨櫃可）`,
      house: `北區捷運宅\n格局：2房1廳1衛1陽\n坪數：25坪\n租金：22000\n樓層：8F/12F\n管理費：1500\n設備：全室家具電（變頻空調、冰箱、洗衣機）\n特色：捷運步行3分鐘，採光極佳`
    };
    setPropertyInfo(examples[type]);
  };

  const handleCopy = (text: string, id: string) => {
    if (!text) return;
    navigator.clipboard.writeText(text);
    setCopied(id);
    setTimeout(() => setCopied(null), 2000);
  };

  const handleSaveToLibrary = async () => {
    if (!currentUser || !analysisResult) return;
    
    setLoading(true);
    try {
      const title = wizardData.title || propertyInfo.split('\n')[0].substring(0, 20) || '未命名物件';
      await addDoc(collection(db, `users/${currentUser.uid}/properties`), {
        userId: currentUser.uid,
        title,
        rawInfo: propertyInfo || JSON.stringify(wizardData),
        tone,
        analysisResult,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp()
      });
      setCopied('saved');
      setTimeout(() => setCopied(null), 2000);
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, `users/${currentUser.uid}/properties`);
    } finally {
      setLoading(false);
    }
  };

  const renderTitleSuggestions = () => {
    const rawHeuristics = getHeuristicSuggestions(wizardData, propertyInfo, inputMode);
    const displayTitles = customTitles.length > 0 ? customTitles : rawHeuristics;

    return (
      <div className="p-3 bg-brand-cream/40 border border-brand-beige/60 rounded-xl space-y-2 mt-2">
        <div className="flex items-center justify-between gap-2 flex-wrap">
          <div className="flex items-center gap-1">
            <Sparkles className="w-3.5 h-3.5 text-brand-gold animate-bounce" />
            <span className="text-[10px] font-black text-brand-line uppercase tracking-wider">
              591 演算法優化標題建議
            </span>
            <span className="px-1 py-0.2 bg-brand-green/10 text-[8px] text-brand-green font-bold rounded">
              高 CTR
            </span>
          </div>
          
          <div className="flex items-center gap-2">
            {customTitles.length > 0 && (
              <button
                type="button"
                onClick={() => setCustomTitles([])}
                className="text-[9px] font-semibold text-rose-500 hover:text-rose-600 transition-colors flex items-center gap-0.5"
              >
                <Trash2 className="w-2.5 h-2.5" />
                恢復預設
              </button>
            )}
            <button
              type="button"
              onClick={fetchAISuggestions}
              disabled={loadingTitles}
              className="px-2 py-0.5 bg-brand-green hover:bg-brand-green-dark text-white text-[9px] font-black rounded shadow transition-all flex items-center gap-1 select-none disabled:opacity-50"
            >
              {loadingTitles ? (
                <Loader2 className="w-2.5 h-2.5 animate-spin" />
              ) : (
                <Sparkles className="w-2.5 h-2.5 text-brand-gold" />
              )}
              {loadingTitles ? "產生中..." : "🤖 591 AI 推薦"}
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-1.5">
          {displayTitles.map((item, idx) => {
            const isSelected = wizardData.title === item || (inputMode === 'free' && propertyInfo.includes(item));
            return (
              <button
                key={idx}
                type="button"
                onClick={() => handleSelectTitle(item)}
                className={`w-full text-left p-2 rounded-lg text-[11px] font-bold transition-all flex items-center justify-between gap-1 border ${
                  isSelected 
                    ? "bg-brand-gold/10 border-brand-gold text-brand-green shadow-sm" 
                    : "bg-white border-brand-beige hover:border-brand-gold/50 text-brand-body/80 hover:bg-brand-cream/30"
                }`}
              >
                <span className="truncate">{item}</span>
                <span className={`text-[8px] font-bold px-1 py-0.5 rounded flex items-center gap-0.5 shrink-0 ${
                  isSelected ? "bg-brand-green text-white" : "bg-brand-cream text-brand-line/50"
                }`}>
                  {isSelected ? <Check className="w-2 h-2" /> : null}
                  {isSelected ? "已代入" : "點擊取代"}
                </span>
              </button>
            );
          })}
        </div>
        
        <p className="text-[8px] text-brand-line/50 font-medium">
          💡 長度在 28 字內，已自動過濾「秒殺/最便宜」等不實廣告爭議詞彙。
        </p>
      </div>
    );
  };

  return (
    <div className="min-h-screen bg-brand-cream text-brand-body font-sans selection:bg-brand-gold/30">
      {/* Top Navigation */}
      <header className="fixed top-0 left-0 right-0 h-14 bg-brand-green text-white flex items-center justify-between px-4 sm:px-6 border-b border-brand-green-light z-50 shadow-md">
        <div className="flex items-center gap-3">
          <button 
            onClick={() => setStep('input')}
            className="group flex items-center gap-3 hover:opacity-80 transition-opacity"
          >
            <div className="w-8 h-8 bg-brand-gold rounded flex items-center justify-center font-bold text-brand-green group-hover:scale-105 transition-transform shadow-inner">
              TW
            </div>
            <div className="text-left">
              <h1 className="text-[12px] sm:text-sm font-bold tracking-tight">行銷文案快手 <span className="hidden sm:inline text-brand-gold/60">× 房地產 AI 助手</span></h1>
              <p className="text-[8px] sm:text-[10px] text-brand-gold/80 font-mono">V2.4.0 FLASH SEO ENGINE</p>
            </div>
          </button>

          {step !== 'input' && (
            <motion.button 
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              onClick={() => setStep('input')}
              className="ml-4 flex items-center gap-2 px-3 py-1 bg-brand-green-light border border-brand-green rounded text-[10px] font-bold uppercase tracking-widest hover:bg-brand-green transition-all shadow-lg shadow-brand-green/20"
            >
              <Home className="w-3.5 h-3.5" />
              返回首頁
            </motion.button>
          )}
        </div>
          <div className="flex items-center gap-2 sm:gap-6">
            <div className="hidden lg:flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-brand-gold animate-pulse"></span>
              <span className="text-[10px] text-brand-cream/70 uppercase tracking-widest">Market Engine Active</span>
            </div>
            
            <div className="hidden sm:block h-6 w-px bg-brand-green-light" />
            
            {currentUser ? (
              <div className="flex items-center gap-2 sm:gap-3">
                <button 
                  onClick={() => setShowLibrary(true)}
                  className="flex items-center gap-2 px-2 sm:px-3 py-1 bg-brand-green-dark border border-brand-green-light rounded text-[9px] sm:text-[10px] font-bold uppercase tracking-widest hover:bg-brand-green-light transition-colors"
                >
                  <Warehouse className="w-3 sm:w-3.5 h-3 sm:h-3.5 text-brand-gold" />
                  <span className="hidden xs:inline">我的物品庫</span>
                </button>
                <div className="hidden xs:flex flex-col items-end">
                  <span className="text-[10px] font-bold text-brand-gold">{currentUser.displayName?.split(' ')[0]}</span>
                  <button onClick={handleLogout} className="text-[9px] text-brand-cream/60 hover:text-white uppercase tracking-widest">Logout</button>
                </div>
                <button 
                  onClick={() => setShowProfileSettings(true)}
                  className="p-1 sm:px-3 sm:py-1 bg-brand-green-dark border border-brand-green-light rounded text-[10px] font-bold uppercase tracking-widest hover:bg-brand-green-light transition-colors"
                >
                  <UserCircle className="w-4 sm:w-3.5 h-4 sm:h-3.5 text-brand-gold" />
                  <span className="hidden md:inline ml-2">個人設定</span>
                </button>
              </div>
            ) : (
            <button 
              onClick={handleLogin}
              className="flex items-center gap-2 px-3 py-1 bg-brand-gold text-brand-green border border-brand-gold/50 rounded text-[10px] font-bold uppercase tracking-widest hover:bg-white transition-colors"
            >
              <UserCircle className="w-3.5 h-3.5" />
              <span className="hidden xs:inline">Google 登入</span>
            </button>
          )}

          <button 
            onClick={() => setIsFullWidth(!isFullWidth)}
            className="hidden sm:flex text-[10px] font-mono items-center gap-2 px-3 py-1 rounded bg-brand-green-dark border border-brand-green-light hover:bg-brand-green-light transition-colors"
            title={isFullWidth ? "切換至標準寬度" : "切換至全螢幕模式"}
          >
            <Maximize2 className={`w-3 h-3 text-brand-gold ${isFullWidth ? 'rotate-180' : ''}`} />
            <span className="hidden md:inline">{isFullWidth ? 'FULL_WIDTH_ON' : 'STANDARD_VIEW'}</span>
          </button>

          <button 
            onClick={() => setShowCookieModule(!showCookieModule)}
            className="hidden lg:flex text-[10px] font-mono items-center gap-2 px-3 py-1 rounded bg-brand-green-dark border border-brand-green-light hover:bg-brand-green-light transition-colors"
          >
            <Terminal className="w-3 h-3 text-brand-gold" />
            <span className="hidden xl:inline">COOKIE MODULE</span>
          </button>
        </div>
      </header>

      <main className={`pt-20 pb-32 px-4 ${isFullWidth ? 'w-full sm:px-8' : 'max-w-[1400px] mx-auto'} min-h-screen flex flex-col transition-all duration-500`}>
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
                <h2 className="text-2xl sm:text-4xl font-black tracking-tight text-brand-title uppercase">
                  行銷文案<span className="text-brand-green">快手</span>
                </h2>
                <p className="text-brand-body text-xs sm:text-sm max-w-xl mx-auto leading-relaxed px-4">
                  輸入物件資訊，自動生成符合 591、Facebook、Threads 的高效 SEO 文案與合規分析報告。
                </p>
                
                {/* Tone & Mode Selectors */}
                <div className="flex flex-wrap items-center justify-center gap-4 mt-6">
                  <div className="flex bg-white p-1 rounded-full border border-brand-beige shadow-sm">
                    {[
                      { id: 'free', label: '自由填寫', icon: Sparkles },
                      { id: 'wizard', label: '引導模式', icon: Terminal }
                    ].map(mode => (
                      <button
                        key={mode.id}
                        onClick={() => setInputMode(mode.id as any)}
                        className={`px-4 py-1.5 rounded-full text-[10px] font-bold uppercase tracking-wider flex items-center gap-2 transition-all ${
                          inputMode === mode.id ? 'bg-brand-green text-white shadow-md' : 'text-brand-line hover:bg-brand-cream/50'
                        }`}
                      >
                        <mode.icon className="w-3 h-3" />
                        {mode.label}
                      </button>
                    ))}
                  </div>

                   <div className="grid grid-cols-2 xs:grid-cols-3 sm:flex flex-wrap bg-white p-1 rounded-2xl sm:rounded-full border border-brand-beige shadow-sm gap-1">
                    {[
                      { id: 'professional', label: '專業理性', color: 'bg-blue-500' },
                      { id: 'fun', label: '趣味幽默', color: 'bg-orange-500' },
                      { id: 'warm', label: '感性溫馨', color: 'bg-pink-500' },
                      { id: 'urgent', label: '急租催租', color: 'bg-red-500' },
                      { id: 'luxury', label: '頂級奢華', color: 'bg-yellow-500' },
                      { id: 'budget-friendly', label: '極致超值', color: 'bg-emerald-500' },
                      { id: 'industrial', label: '工業務實', color: 'bg-slate-500' },
                      { id: 'friendly', label: '輕鬆親切', color: 'bg-teal-500' },
                      { id: 'story', label: '情境故事', color: 'bg-indigo-500' }
                    ].map(t => (
                      <button
                        key={t.id}
                        onClick={() => setTone(t.id as any)}
                        className={`px-3 py-1.5 rounded-xl sm:rounded-full text-[10px] font-bold uppercase tracking-wider flex items-center sm:justify-start justify-center gap-2 transition-all ${
                          tone === t.id ? 'bg-brand-title text-white shadow-md' : 'text-brand-line hover:bg-brand-cream/50'
                        }`}
                      >
                        <div className={`w-2 h-2 rounded-full ${t.color}`} />
                        {t.label}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              <div className="w-full bg-white border border-brand-beige rounded-lg shadow-sm overflow-hidden">
                <div className="p-4 bg-white/60 backdrop-blur-md border-b border-brand-beige/50 flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="flex gap-1.5">
                      <div className="w-2.5 h-2.5 rounded-full bg-red-400/80 shadow-sm" />
                      <div className="w-2.5 h-2.5 rounded-full bg-yellow-400/80 shadow-sm" />
                      <div className="w-2.5 h-2.5 rounded-full bg-green-500/80 shadow-sm" />
                    </div>
                    <div className="w-px h-4 bg-brand-beige mx-1" />
                    <span className="text-[10px] font-black text-brand-line/40 uppercase tracking-[0.3em]">
                      {inputMode === 'free' ? 'System.Console_Free' : 'System.Wizard_Active'}
                    </span>
                  </div>
                  {inputMode === 'free' && (
                    <div className="flex gap-2">
                      <button 
                        onClick={() => loadExample('factory')}
                        className="px-2 py-0.5 bg-white border border-brand-beige rounded text-[9px] font-bold text-brand-body hover:border-brand-green hover:text-brand-green transition-all uppercase"
                      >
                        代入廠房範本
                      </button>
                      <button 
                        onClick={() => loadExample('house')}
                        className="px-2 py-0.5 bg-white border border-brand-beige rounded text-[9px] font-bold text-brand-body hover:border-brand-green hover:text-brand-green transition-all uppercase"
                      >
                        代入住宅範本
                      </button>
                    </div>
                  )}
                </div>
                <div className="p-4 sm:p-6 relative">
                  {inputMode === 'free' ? (
                    <div className="space-y-4">
                      <textarea
                        value={propertyInfo}
                        onChange={(e) => setPropertyInfo(e.target.value)}
                        placeholder="貼入物件資訊 (例如：南區廠房 / 120坪 / 租金48000 / 高度6.3米 / 三相電 / 無廠登...)"
                        className={`w-full h-64 sm:h-80 bg-white/50 backdrop-blur-sm border ${copied === 'injected' ? 'border-brand-green ring-4 ring-brand-green/10' : 'border-brand-beige/60'} rounded-2xl p-4 sm:p-6 focus:outline-none focus:border-brand-gold focus:ring-4 focus:ring-brand-gold/5 text-sm sm:text-[15px] font-sans leading-relaxed transition-all duration-500 shadow-[inset_0_2px_4px_rgba(0,0,0,0.02)]`}
                      />
                      {renderTitleSuggestions()}
                    </div>
                  ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6 min-h-[320px]">
                      <div className="space-y-4">
                        <div className="space-y-1">
                          <label className="text-[10px] font-bold text-brand-line uppercase tracking-wider">物件名稱</label>
                          <input 
                            value={wizardData.title || ''}
                            onChange={e => setWizardData({...wizardData, title: e.target.value})}
                            placeholder="例如：南區挑高廠房"
                            className="w-full bg-brand-cream/20 border border-brand-beige rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-brand-gold transition-all"
                          />
                        </div>
                        {renderTitleSuggestions()}
                        <div className="space-y-1">
                          <label className="text-[10px] font-bold text-brand-line uppercase tracking-wider">區域地點</label>
                          <input 
                            value={wizardData.location || ''}
                            onChange={e => setWizardData({...wizardData, location: e.target.value})}
                            placeholder="例如：台中市南區"
                            className="w-full bg-brand-cream/20 border border-brand-beige rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-brand-gold transition-all"
                          />
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                          <div className="space-y-1">
                            <label className="text-[10px] font-bold text-brand-line uppercase tracking-wider">類型</label>
                            <select 
                              value={wizardData.type || ''}
                              onChange={e => setWizardData({...wizardData, type: e.target.value})}
                              className="w-full bg-brand-cream/20 border border-brand-beige rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:border-brand-gold transition-all"
                            >
                              <option value="residential">住宅租賃</option>
                              <option value="factory">工業廠房</option>
                              <option value="commercial">商用店面</option>
                            </select>
                          </div>
                          <div className="space-y-1">
                            <label className="text-[10px] font-bold text-brand-line uppercase tracking-wider">坪數 (坪)</label>
                            <input 
                              type="number"
                              value={wizardData.area || ''}
                              onChange={e => setWizardData({...wizardData, area: e.target.value})}
                              placeholder="0"
                              className="w-full bg-brand-cream/20 border border-brand-beige rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-brand-gold transition-all"
                            />
                          </div>
                        </div>
                      </div>
                      <div className="space-y-4">
                        <div className="grid grid-cols-2 gap-4">
                          <div className="space-y-1">
                            <label className="text-[10px] font-bold text-brand-line uppercase tracking-wider">租金 (元/月)</label>
                            <input 
                              type="number"
                              value={wizardData.rent || ''}
                              onChange={e => setWizardData({...wizardData, rent: e.target.value})}
                              placeholder="0"
                              className="w-full bg-brand-cream/20 border border-brand-beige rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-brand-gold transition-all"
                            />
                          </div>
                          <div className="space-y-1">
                            <label className="text-[10px] font-bold text-brand-line uppercase tracking-wider">樓層</label>
                            <input 
                              value={wizardData.floor || ''}
                              onChange={e => setWizardData({...wizardData, floor: e.target.value})}
                              placeholder="例如：3F/12F"
                              className="w-full bg-brand-cream/20 border border-brand-beige rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-brand-gold transition-all"
                            />
                          </div>
                        </div>
                        <div className="space-y-1 h-full">
                          <label className="text-[10px] font-bold text-brand-line uppercase tracking-wider">其他關鍵規格</label>
                          <textarea 
                            value={wizardData.specs || ''}
                            onChange={e => setWizardData({...wizardData, specs: e.target.value})}
                            placeholder="例如：三相電、天車、全新整理、平面車位..."
                            className="w-full h-32 bg-brand-cream/20 border border-brand-beige rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-brand-gold transition-all"
                          />
                        </div>
                      </div>
                    </div>
                  )}

                    {/* Smart Action Bar - New High-End Utility */}
                    <div className="absolute -top-6 left-1/2 -translate-x-1/2 flex items-center gap-1 sm:gap-2 px-1.5 sm:px-2 py-1 sm:py-1.5 bg-white/80 backdrop-blur-md border border-brand-beige/50 rounded-full shadow-lg z-20 w-[90%] sm:w-auto justify-center">
                      {[
                        { icon: Zap, label: 'SEO 強化', color: 'text-orange-500' },
                        { icon: ShieldCheck, label: '合規', color: 'text-brand-green' },
                        { icon: FileText, label: '精簡', color: 'text-blue-500' },
                        { icon: Heart, label: '鉤子', color: 'text-pink-500' }
                      ].map((btn) => (
                        <button
                          key={btn.label}
                          onClick={() => {
                            setPropertyInfo(prev => prev + `\n【系統請求：${btn.label}】`);
                            setCopied('injected');
                            setTimeout(() => setCopied(null), 1500);
                          }}
                          className="flex items-center gap-1 sm:gap-1.5 px-2 sm:px-3 py-1 hover:bg-brand-cream/50 rounded-full transition-all group/action shrink-0"
                        >
                          <btn.icon className={`w-3 h-3 ${btn.color}`} />
                          <span className="text-[9px] sm:text-[10px] font-black text-brand-line group-hover/action:text-brand-green transition-colors">{btn.label}</span>
                        </button>
                      ))}
                    </div>
                  <AnimatePresence>
                    {copied === 'injected' && (
                      <motion.div 
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -10 }}
                        className="absolute bottom-20 left-1/2 -translate-x-1/2 bg-brand-green text-white px-4 py-2 rounded-full text-[10px] font-bold shadow-xl flex items-center gap-2 z-50 pointer-events-none"
                      >
                        <Zap className="w-3 h-3 text-brand-gold" />
                        已追加主題開發方向！
                      </motion.div>
                    )}
                  </AnimatePresence>
                  <div className="mt-4 flex flex-col sm:flex-row justify-between items-center gap-4">
                    <div className="text-[9px] sm:text-[10px] text-brand-line font-mono uppercase">
                      READY TO PROCESS : {propertyInfo.length} CHARS
                    </div>
                    <button
                      onClick={handleGenerate}
                      disabled={!propertyInfo.trim() || loading}
                      className="w-full sm:w-auto px-10 py-3 sm:py-3 bg-brand-green text-white rounded-full text-xs font-black tracking-[0.2em] hover:bg-brand-green-dark disabled:opacity-30 transition-all flex items-center justify-center gap-3 shadow-[0_10px_20px_rgba(40,51,33,0.2)] hover:shadow-[0_15px_30px_rgba(40,51,33,0.3)] active:scale-95 group"
                    >
                      <span>EXECUTE ANALYSIS</span>
                      <div className="w-5 h-5 rounded-full bg-white/10 flex items-center justify-center group-hover:bg-brand-gold transition-colors">
                        <ChevronRight className="w-4 h-4" />
                      </div>
                    </button>
                  </div>
                </div>
              </div>

              {history.length > 0 && (
                <div className="w-full bg-white border border-slate-200 rounded-lg shadow-sm p-4">
                  <h3 className="text-[10px] font-bold text-brand-line uppercase tracking-widest mb-3 flex items-center gap-2">
                    <FileText className="w-3 h-3" />
                    最近產出的文案
                  </h3>
                  <div className="grid grid-cols-1 md:grid-cols-5 gap-3">
                    {history.map((entry, idx) => (
                      <button
                        key={idx}
                        onClick={() => {
                          setPropertyInfo(entry.info);
                          setAnalysisResult(entry.result);
                          setStep('result');
                        }}
                        className="text-left p-3 bg-brand-cream/10 rounded border border-brand-beige hover:border-brand-gold transition-colors group shadow-sm"
                      >
                        <p className="text-[10px] font-bold text-brand-title mb-1 line-clamp-1">{entry.info.split('\n')[0]}</p>
                        <p className="text-[9px] text-brand-line font-mono">{entry.date.split(' ')[0]}</p>
                      </button>
                    ))}
                  </div>
                </div>
              )}



              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 w-full">
                {[
                  { id: 'FEATURE_1', icon: Zap, label: '秒速生成', desc: '平均 3.2 秒產出全通路文案' },
                  { id: 'FEATURE_2', icon: Info, label: '智慧過濾', desc: '自動排除「秒殺」等違規用詞' },
                  { id: 'FEATURE_3', icon: MapPin, label: '精準 SEO', desc: '自動嵌入 10+ 組地區關鍵字' },
                ].map((item, index) => (
                  <button 
                    key={index} 
                    onClick={() => setActiveIntel(item.id)}
                    className="p-4 bg-white border border-brand-beige rounded flex gap-3 items-center shadow-sm hover:border-brand-gold group transition-colors lg:active:scale-95"
                  >
                    <div className="w-8 h-8 bg-brand-green text-brand-gold rounded flex items-center justify-center shrink-0 group-hover:bg-brand-gold group-hover:text-brand-green transition-colors">
                      <item.icon className="w-4 h-4" />
                    </div>
                    <div className="text-left">
                      <h4 className="text-xs font-bold text-brand-title">{item.label}</h4>
                      <p className="text-[10px] text-brand-body mt-0.5">{item.desc}</p>
                    </div>
                  </button>
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
              className="flex-1 flex flex-col items-center justify-center space-y-8"
            >
              <div className="relative">
                <div className="absolute -inset-4 bg-brand-gold/20 rounded-full blur-2xl animate-pulse" />
                <Loader2 className="w-16 h-16 text-brand-green animate-spin relative z-10" />
                <div className="absolute inset-0 flex items-center justify-center text-[11px] font-black text-brand-green tracking-tighter relative z-20">AI</div>
              </div>
              <div className="text-center space-y-3">
                <div className="flex items-center justify-center gap-4">
                  <div className="h-[1px] w-12 bg-gradient-to-r from-transparent to-brand-gold" />
                  <h3 className="text-xs font-black uppercase tracking-[0.3em] text-brand-title">Intelligence Engine Scaling</h3>
                  <div className="h-[1px] w-12 bg-gradient-to-l from-transparent to-brand-gold" />
                </div>
                <div className="flex flex-col items-center gap-1">
                  <p className="text-[10px] text-brand-line font-mono flex items-center gap-2 whitespace-nowrap">
                    <span className="w-1 h-1 rounded-full bg-brand-green animate-ping" />
                    FETCHING MARKET DATA
                  </p>
                  <p className="text-[10px] text-brand-line font-mono flex items-center gap-2 whitespace-nowrap">
                    <span className="w-1 h-1 rounded-full bg-brand-gold" />
                    CROSS-REFERENCING LEGAL COMPLIANCE
                  </p>
                  <p className="text-[10px] text-brand-line font-mono flex items-center gap-2 whitespace-nowrap">
                    <span className="w-1 h-1 rounded-full bg-brand-gold" />
                    OPTIMIZING SEO KEYWORD DENSITY
                  </p>
                </div>
              </div>
            </motion.div>
          )}

          {step === 'result' && (
            <motion.div
              key="result"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="flex-1 flex flex-col gap-6"
            >
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
              {/* Left Panel: Analysis & Intelligence */}
              <section className="lg:col-span-4 flex flex-col gap-4">
                <div className="flex-1 bg-white border border-brand-beige rounded-lg shadow-sm flex flex-col overflow-hidden">
                  <div className="p-3 bg-brand-cream border-b border-brand-beige flex justify-between items-center">
                    <h2 className="text-xs font-bold text-brand-title uppercase tracking-wider flex items-center gap-2">
                       <TrendingUp className="w-3 h-3 text-brand-gold" />
                       市場洞察與定位
                    </h2>
                    <span className="px-2 py-0.5 bg-brand-gold text-brand-green text-[10px] font-bold rounded uppercase">Analysis View</span>
                  </div>
                  
                  <div className="p-1 bg-brand-cream/30 backdrop-blur-sm flex overflow-x-auto scroller-hide gap-1 mx-2 sm:mx-4 mt-4 rounded-xl border border-brand-beige/50 snap-x">
                    {[
                      { id: 'PROPERTY_INFO', label: '物件明細' },
                      { id: 'PLATFORM_STUDY', label: '策略研究' },
                      { id: 'MARKET_REPORT', label: '區域市調' },
                      { id: 'POSITIONING', label: '定位開發' }
                    ].map(tab => (
                      <button
                        key={tab.id}
                        onClick={() => setActiveTab(tab.id)}
                        className={`flex-1 min-w-[70px] snap-start py-2 text-[10px] font-black rounded-lg transition-all tracking-wider whitespace-nowrap ${
                          activeTab === tab.id ? 'bg-white text-brand-green shadow-sm ring-1 ring-brand-beige/50 translate-y-[-1px]' : 'text-brand-line/60 hover:text-brand-title hover:bg-white/40'
                        }`}
                      >
                        {tab.label}
                      </button>
                    ))}
                  </div>

                  <div className="p-4 sm:p-5 overflow-y-auto flex-1">
                    <div className="prose prose-slate prose-sm max-w-none">
                      <div className="text-xs sm:text-[13px] leading-relaxed text-brand-body whitespace-pre-wrap font-sans bg-white/40 backdrop-blur-sm p-4 sm:p-6 rounded-2xl border border-brand-beige/30 shadow-[inset_0_2px_10px_rgba(0,0,0,0.01)]">
                        {parsedSections[activeTab] || '此部分尚無數據'}
                      </div>
                    </div>
                  </div>

                  <div className="p-4 mt-auto border-t border-brand-beige">
                    <div className="p-3 bg-brand-green rounded-lg text-white space-y-2 shadow-inner">
                      <div className="flex items-center justify-between">
                        <span className="text-[9px] font-mono text-brand-gold uppercase tracking-widest">Metadata Sync</span>
                        <div className="flex gap-1">
                          <div className="w-1.5 h-1.5 rounded-full bg-brand-gold" />
                          <div className="w-1.5 h-1.5 rounded-full bg-brand-gold/30" />
                        </div>
                      </div>
                      <p className="text-[10px] text-brand-cream/60 leading-tight font-medium">
                        已同步區域行情數據與成交歷史紀錄。法規檢查：完成。
                      </p>
                    </div>
                  </div>
                </div>
              </section>

              {/* Right Panel: Content Engine */}
              <section className="lg:col-span-8 flex flex-col gap-4">
                <div className="flex-1 bg-white border border-brand-beige rounded-lg shadow-sm flex flex-col overflow-hidden">
                  <nav className="flex items-center bg-brand-cream/10 border-b border-brand-beige/50 overflow-x-auto scroller-hide p-2 gap-1 sm:gap-1.5 snap-x">
                    {[
                      { id: 'FB_POST', label: 'FB 市場版' },
                      { id: 'IG_POST', label: 'IG 視覺版' },
                      { id: 'THREADS_POST', label: 'Threads 版' },
                      { id: '591_POST', label: '591 專業版' },
                      { id: 'LAKUYA_POST', label: '樂屋導讀' },
                      { id: 'SEO_TAGS', label: 'SEO 佈局' }
                    ].map(tab => (
                      <button 
                        key={tab.id}
                        onClick={() => setActiveTab(tab.id)}
                        className={`px-3 sm:px-5 py-2 sm:py-2.5 snap-start text-[9px] sm:text-[10px] font-black rounded-xl transition-all whitespace-nowrap uppercase tracking-wider sm:tracking-[0.15em] ${
                          activeTab === tab.id 
                            ? 'bg-white text-brand-green shadow-md shadow-brand-green/5 ring-1 ring-brand-beige/50' 
                            : 'text-brand-line/50 hover:text-brand-title hover:bg-white/50'
                        }`}
                      >
                        {tab.label}
                      </button>
                    ))}
                    
                      <div className="ml-auto flex items-center pr-2 gap-3">
                        <div className="h-4 w-px bg-brand-beige/50 mx-1" />
                        
                        {/* Mobile Preview Toggle */}
                        {['FB_POST', 'IG_POST', 'THREADS_POST'].includes(activeTab) && (
                          <button 
                            onClick={() => setShowMobilePreview(true)}
                            className="lg:hidden p-2 bg-brand-gold text-brand-green rounded-full hover:bg-white transition-all shadow-sm active:scale-90"
                            title="預覽"
                          >
                            <Sparkles className="w-4 h-4" />
                          </button>
                        )}

                        <button 
                          onClick={handleGenerate}
                        disabled={loading}
                        className="p-2 bg-brand-green text-brand-gold rounded-full hover:bg-brand-green-dark transition-all shadow-sm active:scale-90"
                        title="重新生成"
                      >
                        {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
                      </button>
                      <button 
                        onClick={() => handleCopy(displayCopy, activeTab)}
                        className="px-4 py-2 bg-brand-green text-white text-[10px] font-black rounded-xl hover:bg-brand-green-dark transition-all uppercase tracking-widest flex items-center gap-2 shadow-md shadow-brand-green/10"
                      >
                        {copied === activeTab ? <Check className="w-4 h-4 text-brand-gold" /> : <Copy className="w-4 h-4" />}
                        Copy Content
                      </button>
                    </div>
                  </nav>
                  
                  <div className="flex-1 p-6 overflow-y-auto bg-brand-cream/5">
                    <div className="max-w-4xl mx-auto flex flex-col lg:flex-row gap-8">
                       <div className="flex-1 space-y-4">
                        {activeTab === 'SEO_TAGS' ? (
                          <div className="grid grid-cols-1 gap-4">
                            <div className="bg-white p-4 rounded-xl border border-brand-beige shadow-sm space-y-3">
                              <h4 className="text-[10px] font-bold text-brand-line uppercase tracking-widest border-b border-brand-beige pb-2 flex items-center gap-2">
                                <Search className="w-3 h-3" />
                                SEO Keywords
                              </h4>
                              <div className="text-[12px] text-brand-body leading-relaxed font-mono whitespace-pre-wrap select-all bg-brand-cream/5 p-2 rounded">
                                {parsedSections.SEO_TAGS ? parsedSections.SEO_TAGS.split(/[#＃]/)[0].trim() : '目前尚無關鍵字'}
                              </div>
                            </div>
                            <div className="bg-white p-4 rounded-xl border border-brand-beige shadow-sm space-y-3">
                              <h4 className="text-[10px] font-bold text-brand-line uppercase tracking-widest border-b border-brand-beige pb-2 flex items-center gap-2 text-brand-green">
                                <TrendingUp className="w-3 h-3" />
                                Social Hashtags
                              </h4>
                              <div className="text-[12px] text-brand-green font-bold leading-relaxed font-mono whitespace-pre-wrap select-all bg-brand-cream/5 p-2 rounded">
                                {parsedSections.SEO_TAGS && parsedSections.SEO_TAGS.match(/[#＃]/) 
                                  ? parsedSections.SEO_TAGS.substring(parsedSections.SEO_TAGS.search(/[#＃]/)).trim() 
                                  : '目前尚無標籤'}
                              </div>
                            </div>
                          </div>
                        ) : (
                          <div className="bg-white p-6 rounded-xl border border-brand-beige shadow-sm relative group overflow-hidden space-y-4">
                            <div className="absolute top-0 right-0 p-2 opacity-0 group-hover:opacity-100 transition-opacity">
                              <span className="text-[8px] bg-brand-gold text-brand-green px-1.5 py-0.5 rounded font-bold uppercase">Ready</span>
                            </div>
                            
                            {/* Rich Highlights for compliance */}
                            {displayCopy ? (
                              <ComplianceHighlighter text={displayCopy} />
                            ) : (
                              <div className="text-sm leading-relaxed text-brand-body font-sans whitespace-pre-wrap">
                                此內容正在生成或格式錯誤
                              </div>
                            )}
                          </div>
                        )}

                        {/* Micro-Refinement interactive dialog */}
                        {activeTab !== 'SEO_TAGS' && displayCopy && (
                          <div className="bg-white p-5 rounded-xl border border-brand-beige/50 shadow-sm space-y-3 animate-fade-in">
                            <div className="flex items-center justify-between">
                              <div className="flex items-center gap-2">
                                <Sparkles className="w-4 h-4 text-brand-gold animate-pulse" />
                                <h4 className="text-[11px] font-black text-brand-title uppercase tracking-wider leading-none">
                                  🤖 AI 智慧局部對話微調（這套微調僅會針對 {
                                    activeTab === 'PROPERTY_INFO' ? '「物件資訊」' :
                                    activeTab === 'PLATFORM_STUDY' ? '「平台分析」' :
                                    activeTab === 'MARKET_REPORT' ? '「市場報告」' :
                                    activeTab === 'POSITIONING' ? '「物件定位」' :
                                    activeTab === 'FB_POST' ? '「FB 市場版」' :
                                    activeTab === 'IG_POST' ? '「IG 視覺版」' :
                                    activeTab === 'THREADS_POST' ? '「Threads版」' :
                                    activeTab === '591_POST' ? '「591專業版」' : '「樂屋網導讀」'
                                  } 頁籤生效）
                                </h4>
                              </div>
                              {overrideSections[activeTab] && (
                                <button 
                                  onClick={() => {
                                    setOverrideSections(prev => {
                                      const updated = { ...prev };
                                      delete updated[activeTab];
                                      return updated;
                                    });
                                  }}
                                  className="text-[10px] text-rose-600 font-bold hover:underline"
                                >
                                  重設回預設 AI 文案
                                </button>
                              )}
                            </div>
                            <p className="text-[10px] text-brand-line leading-relaxed">
                              可以直接用中文指令，命 AI 在此篇文案中調增語調、突顯特定地標交通（例：「我想加入鄰近公車站 2 分鐘」、「讓這篇氣氛更極度急迫、手慢無的感覺」等），文案一秒在在線生成修正。
                            </p>
                            <div className="relative flex items-center">
                              <input 
                                type="text"
                                placeholder={`例如：『我想修改尾段』『幫我把這篇文案改得更簡短更具情境故事感』...`}
                                value={refineQuery}
                                onChange={e => setRefineQuery(e.target.value)}
                                onKeyDown={e => {
                                  if (e.key === 'Enter' && !refinementLoading && refineQuery.trim()) {
                                    handleRefine(activeTab);
                                  }
                                }}
                                className="w-full bg-slate-50 border border-brand-beige/80 rounded-xl pl-3.5 pr-28 py-2.5 text-xs focus:outline-none focus:border-brand-gold transition-all"
                                disabled={refinementLoading}
                              />
                              <button
                                onClick={() => handleRefine(activeTab)}
                                disabled={refinementLoading || !refineQuery.trim()}
                                className="absolute right-1.5 px-3 py-1.5 bg-brand-green hover:bg-brand-green-dark text-white rounded-lg text-[10px] font-bold active:scale-95 disabled:opacity-40 transition-all flex items-center gap-1"
                              >
                                {refinementLoading ? (
                                  <>
                                    <Loader2 className="w-3 h-3 animate-spin" />
                                    <span>優化中...</span>
                                  </>
                                ) : (
                                  <>
                                    <Sparkles className="w-3.5 h-3.5 text-brand-gold" />
                                    <span>AI 微調</span>
                                  </>
                                )}
                              </button>
                            </div>
                          </div>
                        )}

                        <div className="bg-brand-cream border border-brand-gold/30 p-4 rounded flex items-center justify-between group shadow-sm">
                          <div className="flex items-center gap-4">
                            <div className="w-10 h-10 bg-brand-green text-brand-gold rounded-full flex items-center justify-center text-xs font-bold italic shadow-lg shadow-brand-green/20 group-hover:scale-110 transition-transform">SEO</div>
                            <div>
                              <div className="text-[9px] uppercase text-brand-green font-bold tracking-widest">Efficiency Boost</div>
                              <div className="text-xs font-bold text-brand-title">文案結構已針對搜尋引擎優化</div>
                            </div>
                          </div>
                          <button 
                            onClick={() => handleCopy(analysisResult, 'full')}
                            className="px-4 py-1.5 bg-white border border-brand-gold rounded text-[10px] font-bold text-brand-green hover:bg-brand-green hover:text-white hover:border-brand-green transition-all uppercase tracking-widest shadow-sm"
                          >
                            {copied === 'full' ? 'Copied' : 'Export Full Report'}
                          </button>
                        </div>
                      </div>

                      {/* Mockup Preview Area */}
                      {['FB_POST', 'IG_POST', 'THREADS_POST'].includes(activeTab) && (
                        <div className="hidden lg:block lg:w-80 shrink-0">
                           <div className="sticky top-0">
                              <div className="flex items-center gap-2 mb-4 px-2">
                                <span className="w-2 h-2 rounded-full bg-brand-gold animate-pulse" />
                                <span className="text-[10px] font-black uppercase tracking-widest text-brand-line">Visual_Preview.Live</span>
                              </div>
                              <SocialMockup 
                                platform={activeTab} 
                                content={displayCopy} 
                                profile={profile} 
                              />
                           </div>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </section>
              </div>

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
                <div className="p-4 bg-brand-green text-white flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Settings className="w-4 h-4 text-brand-gold" />
                    <span className="text-xs font-bold uppercase tracking-widest">個人/法規資訊設定</span>
                  </div>
                  <button onClick={() => setShowProfileSettings(false)}>
                    <X className="w-4 h-4 text-brand-gold/60 hover:text-white" />
                  </button>
                </div>
                
                <div className="p-6 space-y-4 max-h-[70vh] overflow-y-auto">
                  <p className="text-[11px] text-brand-body leading-relaxed italic border-l-2 border-brand-gold pl-3">
                    在此輸入的資訊將自動儲存於您的瀏覽器中，並作為 AI 生成文案時的「法規尾段」固定內容。
                  </p>
                  
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-1.5">
                      <label className="text-[10px] font-bold text-brand-line uppercase tracking-wider">聯絡姓名</label>
                      <input 
                        type="text" 
                        value={profile.name || ''}
                        onChange={e => setProfile({...profile, name: e.target.value})}
                        className="w-full bg-brand-cream/20 border border-brand-beige rounded px-3 py-2 text-sm focus:outline-none focus:border-brand-gold transition-colors"
                      />
                    </div>
                    <div className="space-y-1.5">
                      <label className="text-[10px] font-bold text-brand-line uppercase tracking-wider">聯絡電話</label>
                      <input 
                        type="text" 
                        value={profile.phone || ''}
                        onChange={e => setProfile({...profile, phone: e.target.value})}
                        className="w-full bg-brand-cream/20 border border-brand-beige rounded px-3 py-2 text-sm focus:outline-none focus:border-brand-gold transition-colors"
                      />
                    </div>
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-[10px] font-bold text-brand-line uppercase tracking-wider">Line ID</label>
                    <input 
                      type="text" 
                      value={profile.lineId || ''}
                      onChange={e => setProfile({...profile, lineId: e.target.value})}
                      className="w-full bg-brand-cream/20 border border-brand-beige rounded px-3 py-2 text-sm focus:outline-none focus:border-brand-gold transition-colors"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-[10px] font-bold text-brand-line uppercase tracking-wider">經紀業名稱</label>
                    <input 
                      type="text" 
                      value={profile.company || ''}
                      onChange={e => setProfile({...profile, company: e.target.value})}
                      className="w-full bg-brand-cream/20 border border-brand-beige rounded px-3 py-2 text-sm focus:outline-none focus:border-brand-gold transition-colors"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-[10px] font-bold text-brand-line uppercase tracking-wider">公司地址</label>
                    <input 
                      type="text" 
                      value={profile.companyAddress || ''}
                      onChange={e => setProfile({...profile, companyAddress: e.target.value})}
                      className="w-full bg-brand-cream/20 border border-brand-beige rounded px-3 py-2 text-sm focus:outline-none focus:border-brand-gold transition-colors"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-[10px] font-bold text-brand-line uppercase tracking-wider">公司統編</label>
                    <input 
                      type="text" 
                      value={profile.taxId || ''}
                      onChange={e => setProfile({...profile, taxId: e.target.value})}
                      className="w-full bg-brand-cream/20 border border-brand-beige rounded px-3 py-2 text-sm focus:outline-none focus:border-brand-gold transition-colors"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-[10px] font-bold text-brand-line uppercase tracking-wider">不動產經紀人/證號</label>
                    <input 
                      type="text" 
                      value={profile.broker || ''}
                      onChange={e => setProfile({...profile, broker: e.target.value})}
                      className="w-full bg-brand-cream/20 border border-brand-beige rounded px-3 py-2 text-sm focus:outline-none focus:border-brand-gold transition-colors"
                      placeholder="例如：鄭善仁（113）南市字第001001號"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-[10px] font-bold text-brand-line uppercase tracking-wider">不動產營業員/證號</label>
                    <input 
                      type="text" 
                      value={profile.salesperson || ''}
                      onChange={e => setProfile({...profile, salesperson: e.target.value})}
                      className="w-full bg-brand-cream/20 border border-brand-beige rounded px-3 py-2 text-sm focus:outline-none focus:border-brand-gold transition-colors"
                      placeholder="例如：黃先生（115）登字第505314號"
                    />
                  </div>

                  <div className="space-y-1.5 col-span-2">
                    <label className="text-[10px] font-bold text-brand-line uppercase tracking-wider block">自定義法規尾段 / 規範模板 (每一平台發文文案尾端皆會附帶)</label>
                    <textarea 
                      rows={6}
                      value={profile.customFooter || ''}
                      onChange={e => setProfile({...profile, customFooter: e.target.value})}
                      placeholder="請輸入自訂法規與規則聲明..."
                      className="w-full bg-brand-cream/24 border border-brand-beige rounded px-3 py-2 text-xs focus:outline-none focus:border-brand-gold transition-colors font-mono whitespace-pre-wrap"
                    />
                    <p className="text-[9px] text-brand-line/60 leading-normal">
                      💡 提示：此尾段將自動附加至每一篇生成的平台發文尾端。您可自由撰寫固定條款，或使用動態對應標籤：<span className="font-mono text-brand-green">[NAME], [PHONE], [LINE_ID], [COMPANY], [COMPANY_ADDRESS], [TAX_ID], [BROKER], [SALESPERSON]</span> 自動替換為上方個人資訊。
                    </p>
                  </div>
                </div>

                <div className="p-4 bg-brand-cream/30 border-t border-brand-beige flex justify-end gap-3">
                   <button 
                    onClick={async () => {
                      if (currentUser) {
                        try {
                          await setDoc(doc(db, `users/${currentUser.uid}/profile/default`), {
                            ...profile,
                            userId: currentUser.uid,
                            updatedAt: serverTimestamp()
                          });
                        } catch (error) {
                          handleFirestoreError(error, OperationType.WRITE, `users/${currentUser.uid}/profile/default`);
                        }
                      }
                      setShowProfileSettings(false);
                    }}
                    className="px-6 py-2 bg-brand-green text-white rounded text-xs font-bold tracking-widest hover:bg-brand-green-dark transition-all flex items-center gap-2 shadow-sm"
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
          {showMobilePreview && ['FB_POST', 'IG_POST', 'THREADS_POST'].includes(activeTab) && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 z-[110] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-md"
              onClick={() => setShowMobilePreview(false)}
            >
              <motion.div
                initial={{ scale: 0.9, opacity: 0, y: 20 }}
                animate={{ scale: 1, opacity: 1, y: 0 }}
                exit={{ scale: 0.9, opacity: 0, y: 20 }}
                className="relative"
                onClick={(e) => e.stopPropagation()}
              >
                <SocialMockup 
                  platform={activeTab} 
                  content={parsedSections[activeTab]} 
                  profile={profile} 
                />
                <button 
                  onClick={() => setShowMobilePreview(false)}
                  className="absolute -top-12 left-1/2 -translate-x-1/2 w-10 h-10 bg-white rounded-full flex items-center justify-center shadow-xl border border-slate-200"
                >
                  <X className="w-6 h-6 text-slate-900" />
                </button>
              </motion.div>
            </motion.div>
          )}

          {showLibrary && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 z-[100] flex items-center justify-center p-4 md:p-12 bg-slate-900/60 backdrop-blur-md"
              onClick={() => setShowLibrary(false)}
            >
              <motion.div
                initial={{ scale: 0.98, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                exit={{ scale: 0.98, opacity: 0 }}
                className="bg-white w-full max-w-5xl h-full rounded-2xl shadow-2xl overflow-hidden flex flex-col border border-brand-beige"
                onClick={(e) => e.stopPropagation()}
              >
                <div className="p-6 bg-brand-green text-white flex items-center justify-between shadow-lg">
                  <div className="flex items-center gap-3">
                    <div className="p-2 bg-brand-green-light rounded-xl">
                      <Warehouse className="w-5 h-5 text-brand-gold" />
                    </div>
                    <div>
                      <h2 className="text-lg font-bold tracking-tight">我的物業文案庫</h2>
                      <p className="text-[10px] text-brand-gold/60 uppercase tracking-widest font-mono">Property copy inventory</p>
                    </div>
                  </div>
                  <button 
                    onClick={() => setShowLibrary(false)}
                    className="p-2 hover:bg-white/10 rounded-full transition-colors"
                  >
                    <X className="w-6 h-6 text-brand-gold" />
                  </button>
                </div>

                <div className="flex-1 overflow-y-auto p-6 bg-brand-cream/10">
                  <SavedLibraryView 
                    onSelect={(data) => {
                      setAnalysisResult(data.analysisResult);
                      setStep('result');
                      setShowLibrary(false);
                      setActiveTab('PROPERTY_INFO');
                    }} 
                  />
                </div>
              </motion.div>
            </motion.div>
          )}
          
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
                className="bg-brand-green-dark w-full max-w-2xl rounded-lg p-6 border border-brand-green-light shadow-2xl space-y-4"
                onClick={(e) => e.stopPropagation()}
              >
                <div className="flex items-center justify-between border-b border-brand-green-light/30 pb-3">
                  <div className="flex items-center gap-2 text-brand-gold font-mono text-xs leading-none">
                    <Terminal className="w-4 h-4" />
                    COOKIE_CONTROLLER.PY
                  </div>
                  <div className="flex gap-1.5">
                    <div className="w-2 h-2 rounded-full bg-brand-green" />
                    <div className="w-2 h-2 rounded-full bg-brand-green" />
                    <div className="w-2 h-2 rounded-full bg-brand-green" />
                  </div>
                </div>
                <div className="relative">
                  <pre className="p-4 bg-black/40 rounded text-[11px] font-mono text-brand-cream/80 overflow-x-auto selection:bg-brand-gold/30">
                    <code>{COOKIE_SNIPPET}</code>
                  </pre>
                  <button
                    onClick={() => handleCopy(COOKIE_SNIPPET, 'cookie')}
                    className="absolute top-2 right-2 p-1.5 bg-brand-green-dark hover:bg-brand-green rounded transition-colors"
                  >
                    {copied === 'cookie' ? <Check className="w-3 h-3 text-brand-gold" /> : <Copy className="w-3 h-3 text-brand-gold/40" />}
                  </button>
                </div>
                <div className="text-[10px] text-brand-line font-mono">
                  [*] AUTH MODULE PERSISTED. SYSTEM_ID: AIS_RENTAL_V2
                </div>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Intelligence Modal */}
        <AnimatePresence>
          {activeIntel && (
            <div className="fixed inset-0 z-[100] flex items-center justify-center px-4">
              <motion.div 
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                onClick={() => setActiveIntel(null)}
                className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm"
              />
              <motion.div 
                initial={{ opacity: 0, scale: 0.95, y: 20 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.95, y: 20 }}
                className="relative bg-white w-full max-w-sm rounded-xl shadow-2xl border border-brand-beige overflow-hidden"
              >
                <div className="p-4 bg-brand-green flex justify-between items-center">
                  <h3 className="text-[10px] font-bold text-brand-gold uppercase tracking-widest">
                    {intelData[activeIntel]?.title}
                  </h3>
                  <button onClick={() => setActiveIntel(null)} className="text-brand-gold/60 hover:text-white">
                    <X className="w-4 h-4" />
                  </button>
                </div>
                <div className="p-6">
                  {intelData[activeIntel]?.content}
                  <button 
                    onClick={() => setActiveIntel(null)}
                    className="w-full mt-6 py-2 bg-brand-green text-white text-[10px] font-bold rounded uppercase tracking-widest hover:bg-brand-green-dark transition-colors shadow-lg shadow-brand-green/20"
                  >
                    了解並關閉
                  </button>
                </div>
              </motion.div>
            </div>
          )}
        </AnimatePresence>
      </main>

      {/* High Density Footer Overlay */}
      <footer className="fixed bottom-0 left-0 right-0 h-24 bg-brand-green px-6 py-3 flex items-start gap-4 z-40 overflow-hidden shadow-[0_-4px_10px_rgba(0,0,0,0.3)]">
        <div className="shrink-0 w-36 py-2 px-3 bg-brand-green-dark border border-brand-green-light rounded flex flex-col justify-center items-center gap-1 shadow-inner">
          <span className="text-[10px] font-bold text-brand-gold uppercase tracking-tighter">Compliance Check</span>
          <span className="text-xs font-black text-white">100% SECURE</span>
        </div>
        
        <div className="hidden sm:flex flex-1 gap-6 text-[10px] leading-tight text-brand-cream/80 font-medium">
          <div className="space-y-1 w-1/4">
            <p className="text-brand-gold font-bold uppercase mb-1 underline decoration-brand-gold/40 underline-offset-4">禁止詞彙已移除</p>
            <p>已排除：秒殺、最便宜、神物件、唯一</p>
            <p>已替換：稀有釋出、同區少見、條件佳</p>
          </div>
          <div className="space-y-1 flex-1">
            <p className="text-brand-gold font-bold uppercase mb-1 underline decoration-brand-gold/40 underline-offset-4">當前法規尾段（由設定檔產生）</p>
            <p className="italic font-semibold text-white">🤝🏻 成交收取半個月服務費。聯絡方式📲 {profile.phone} (Line: {profile.lineId})</p>
            <p>經紀業：{profile.company} (統編: {profile.taxId}) ｜ 經紀人：{profile.broker.split('（')[0]}</p>
          </div>
          <div className="w-32 flex flex-col justify-end items-end gap-1">
            <div className="text-[9px] text-brand-gold italic uppercase tracking-widest">Market Engine</div>
            <div className="text-[9px] text-brand-gold/60 font-bold">READY TO EXPORT</div>
          </div>
        </div>
      </footer>
    </div>
  );
}
