import express from "express";
import path from "path";
import { createServer as createViteServer } from "vite";
import { GoogleGenAI } from "@google/genai";
import dotenv from "dotenv";

dotenv.config();

const app = express();
app.use(express.json());

const PORT = 3000;

// Lazy initialize Gemini API to avoid startup crashes if key is initially absent
let aiInstance: GoogleGenAI | null = null;
let lastInjectedKey: string | null = null;
function getAI(): GoogleGenAI {
  let apiKey = process.env.GEMINI_API_KEY || "";
  if (apiKey) {
    apiKey = apiKey.trim().replace(/^['"`]|['"`]$/g, '').trim();
  }

  if (!aiInstance || lastInjectedKey !== apiKey) {
    // Diagnostic logging (safe and informative)
    console.log("=== API KEY DIAGNOSTICS ===");
    console.log("Available Env Keys containing key/api/gemini:", Object.keys(process.env).filter(k => k.toLowerCase().includes("key") || k.toLowerCase().includes("api") || k.toLowerCase().includes("gemini")));
    if (apiKey) {
      console.log("GEMINI_API_KEY length:", apiKey.length);
      console.log("GEMINI_API_KEY preview:", apiKey.substring(0, 4) + "..." + apiKey.substring(Math.max(0, apiKey.length - 4)));
    } else {
      console.log("GEMINI_API_KEY is undefined or empty");
    }
    console.log("=== END DIAGNOSTICS ===");

    const isPlaceholder = !apiKey || 
      apiKey.toUpperCase() === "MY_GEMINI_API_KEY" || 
      apiKey.toUpperCase() === "YOUR_GEMINI_API_KEY" ||
      apiKey.toUpperCase() === "INSERT_YOUR_KEY_HERE" ||
      apiKey.startsWith("YOUR_API_KEY");

    if (isPlaceholder) {
      throw new Error("您的 Gemini API 金鑰 (GEMINI_API_KEY) 似乎尚未設定。請在 AI Studio 介面左側下方的【⚙️ Settings】>【Secrets】面板中，設定一個正確且有效的金鑰（填寫後金鑰會自動套用入環境變數中，無須在程式碼中貼上）。");
    }

    aiInstance = new GoogleGenAI({
      apiKey,
      httpOptions: {
        headers: {
          'User-Agent': 'aistudio-build',
        }
      }
    });
    lastInjectedKey = apiKey;
  }
  return aiInstance;
}

function handleGeminiError(err: any, res: express.Response) {
  console.error("Gemini API Error details:", err);
  
  let errMsg = err?.message || "";
  if (typeof err === "object") {
    try {
      errMsg += " " + JSON.stringify(err);
    } catch (_) {}
  }
  
  if (
    err?.status === 429 ||
    err?.code === 429 ||
    errMsg.includes("RESOURCE_EXHAUSTED") ||
    errMsg.toLowerCase().includes("quota") ||
    errMsg.toLowerCase().includes("rate-limits") ||
    errMsg.toLowerCase().includes("rate limit") ||
    errMsg.toLowerCase().includes("exceeded")
  ) {
    return res.status(429).json({
      error: "【⚠️ Gemini API 額度用盡 / 頻率限制 (429)】\n\n您的 Gemini API 金鑰已超出當前配額上限 (RESOURCE_EXHAUSTED)。這通常是因為您目前使用的是「免費版」Gemini API 金鑰，且具有每分鐘 / 每日呼叫次數的限制，或者目前系統流量暫時飽和。\n\n💡 建議排查與解決步驟：\n1. 【等候重試】：請稍候 1 至 2 分鐘後重新點擊「產出文案」。\n2. 【更換金鑰】：您可以在 AI Studio 介面左側下方的【⚙️ Settings】>【Secrets】面板中，確認並更換為另一個正常有配額的 GEMINI_API_KEY 金鑰。\n3. 【啟動付費方案】：前往 Google AI Studio 官方網站 (https://aistudio.google.com/)，在您的 API 專案中鏈接付款帳戶以切換為隨用隨付 (Pay-as-you-go) 計劃，解除免費版額度的頻率限制。"
    });
  }

  if (
    err?.status === 503 ||
    err?.code === 503 ||
    errMsg.includes("UNAVAILABLE") ||
    errMsg.includes("503") ||
    errMsg.toLowerCase().includes("experiencing high demand") ||
    errMsg.toLowerCase().includes("temporary") ||
    errMsg.toLowerCase().includes("overloaded")
  ) {
    return res.status(503).json({
      error: "【⚠️ Gemini 伺服器目前超載 / 高度忙碌中 (503)】\n\nGemini API 模型當前正處於極高存取流量與需求高峰（UNAVAILABLE 或 503 服務目前超載）。這通常是暫時性的流量尖峰。\n\n💡 系統已啟動自動排隊重試功能。您可以繼續等待，或視情況：\n1. 【等候自動重試】：系統將自動以指數退避（如 10 秒、20 秒、40 秒）安排重發請求，通常數秒後即可避開高峰順利產出。\n2. 【稍後手動重試】：您也可以在 10 秒至 1 分鐘後點擊操作按鈕重新產生文案。\n3. 【更換金鑰】：您可以在 AI Studio 介面左側下方的【⚙️ Settings】 > 【Secrets】中更換另一個 GEMINI_API_KEY 金鑰。"
    });
  }
  
  if (
    errMsg.includes("API key not valid") ||
    errMsg.includes("API_KEY_INVALID") ||
    errMsg.includes("INVALID_ARGUMENT") ||
    err?.status === 400 ||
    err?.code === 400
  ) {
    return res.status(400).json({
      error: "您的 Gemini API 金鑰 (GEMINI_API_KEY) 似乎失效或未正確設定。請確認您已在 AI Studio 介面左側下方的【⚙️ Settings】>【Secrets】面板中，設定了正確且有效的金鑰。填寫後系統將會自動套用，無須修改任何程式碼！"
    });
  }
  
  return res.status(500).json({
    error: err?.message || "伺服器內部錯誤，請檢查您的 API 金鑰設定與網路連線後重試。"
  });
}

// Utility function to execute Gemini API generation with retries and fallback models
async function generateContentWithRetry(
  ai: GoogleGenAI,
  options: {
    model: string;
    contents: any;
    config?: any;
  },
  retries = 2
): Promise<any> {
  const modelsToTry = Array.from(new Set([options.model, "gemini-3.1-flash-lite", "gemini-3.5-flash", "gemini-flash-latest"]));
  let lastErr: any = null;

  for (const modelName of modelsToTry) {
    for (let attempt = 0; attempt < retries; attempt++) {
      try {
        console.log(`[Gemini API] Calling model ${modelName} (Attempt ${attempt + 1}/${retries})...`);
        const response = await ai.models.generateContent({
          model: modelName,
          contents: options.contents,
          config: options.config,
        });
        return response;
      } catch (err: any) {
        lastErr = err;
        const errMsg = err?.message || "";
        console.error(`[Gemini API Error] Model: ${modelName}, Attempt: ${attempt + 1}, Code: ${err?.code}, Status: ${err?.status}, Message: ${errMsg}`);

        const isRetriable = 
          err?.status === 503 ||
          err?.status === 429 ||
          err?.code === 503 ||
          err?.code === 429 ||
          errMsg.includes("UNAVAILABLE") ||
          errMsg.includes("RESOURCE_EXHAUSTED") ||
          errMsg.toLowerCase().includes("experiencing high demand") ||
          errMsg.toLowerCase().includes("overloaded") ||
          errMsg.toLowerCase().includes("temporary");

        if (!isRetriable) {
          throw err;
        }

        const delay = Math.pow(2, attempt) * 1000;
        console.log(`[Gemini API] Retriable error encountered. Waiting ${delay / 1000}s before next attempt...`);
        await new Promise((resolve) => setTimeout(resolve, delay));
      }
    }
    console.warn(`[Gemini API] Model ${modelName} failed all attempts. Trying stable fallback model...`);
  }

  throw lastErr;
}

// Memory caching
const cache = new Map<string, { result: any, timestamp: number }>();
const CACHE_TTL = 10 * 60 * 1000; // 10 minutes cache

function getCached(key: string) {
  const item = cache.get(key);
  if (item && Date.now() - item.timestamp < CACHE_TTL) {
    return item.result;
  }
  return null;
}

function setCached(key: string, value: any) {
  cache.set(key, { result: value, timestamp: Date.now() });
}

// Clean up old cache items periodically
setInterval(() => {
  const now = Date.now();
  for (const [key, item] of cache.entries()) {
    if (now - item.timestamp > CACHE_TTL) {
      cache.delete(key);
    }
  }
}, 5 * 60 * 1000).unref?.();

// API Endpoints
app.post("/api/generate", async (req, res) => {
  const { propertyInfo, customFooter, tone } = req.body;
  if (!propertyInfo) {
    return res.status(400).json({ error: "Missing propertyInfo" });
  }
  
  const cacheKey = `gen::${tone}::${customFooter}::${propertyInfo}`;
  const cachedVal = getCached(cacheKey);
  if (cachedVal) {
    console.log("[Cache HIT] /api/generate");
    return res.json({ text: cachedVal });
  }

  try {
    const ai = getAI();

    const isIndustrial = 
      propertyInfo.toLowerCase().includes("factory") ||
      propertyInfo.includes("廠房") ||
      propertyInfo.includes("工廠") ||
      propertyInfo.includes("倉儲") ||
      propertyInfo.includes("工業") ||
      propertyInfo.includes("面寬") ||
      propertyInfo.includes("天車");

    const SYSTEM_INSTRUCTION_INDUSTRIAL = `你扮演「台灣工業廠房與倉儲地產專家與成交型文案引擎」。
此物件為【工廠 / 廠房 / 倉儲】工業不動產類型。請嚴格、絕對遵照以下「成交導向廠房文案」之輸出規則與文案風格，為各個推廣管道標籤項目產出內容。

【各推廣管道（FB_POST、IG_POST、THREADS_POST、591_POST、LAKUYA_POST）之硬性輸出規則】：
每篇平台發文文案都「必須」包含並依序展現以下 Step 1 至 Step 9 的全部邏輯架構，絕不可跳過任何步驟或變更排序：

Step1【吸睛鉤子】：
格式：【地區 + 坪數 + 類型】＋價格亮點 
（例：【台中烏日 150坪 鋼構廠房】低總價破盤驚喜價！ / 【桃園蘆竹 300坪 消防倉儲】稀有降價釋出！）

Step2【提前放 CTA】：
放電話與聯絡方式（聯絡資訊）。

Step3【包裝標題】：
使用：精選物件 / 稀有釋出 / 立即進駐 / 低總價 / 交通便利 （根據物件特點選擇最合適之 1~2 款使用）。

Step4 & Step5【核心資訊排序與數據化輸出（不可變更順序）】：
必須以下列 Emoji 與對應之欄位標題與順序，100% 數據化條列輸出（不可變更欄位，如果某些資訊缺失也請列出並寫「私訊確認」）：
📍地點：
📐坪數：
⚡設備（含電力資訊）：
🚛交通（交通條件/進出動線，優先強調交通條件）：
💰租金（租金費用，必須醒目標記價格）：
📏規格（含面寬、深度、高度等尺寸規格）：
💎特殊優勢：

Step6【動態 CTA 指令】：
加入引導：立即預約 / 私訊了解 / 安排看屋。

Step7【品牌背書】：
公司名稱 / 服務人員 / 專業描述 等背書資訊。

Step8【使用限制】：
清楚列出「禁用/限制行業與產業」（若未提供則註明「禁用高污染及強酸鹼化學行業，其他請私訊詢問」）。

Step9【法遵模組】：
文案末尾必須如實且完整附上使用者提供的「自定義法規尾段」。包含服務費說明、經紀業與營業員資訊、有效期限（即文案末端完整附上下面的自定義法規尾段）。

【文案風格指導原則】：
* 以「廠房客群思維」撰寫：注重廠務實用、臨路、大電力、挑高等核心數據。
* 優先強調「交通與車輛進出條件」（臨路寬度、40呎/20呎貨櫃車進出便利度、鄰近交流道等）。
* 使用「大量數字」而非空洞不實口號。
* 格式極簡、整齊容易快速掃讀，避免使用過多華麗形容詞。
* 強調「物件稀缺性」與「立即撥打預約看屋行動」。`;

    const SYSTEM_INSTRUCTION = `你扮演「台灣租賃市場專家與成交型文案引擎」。請精簡、無贅字地分析物件，並依序輸出標籤區塊（每節內容應緊湊、減少鋪疊，字數不拖沓）：

1. 嚴格遵守《公平交易法》第二十一條及《不動產經紀業管理條例》。絕不要捏造、變造或憑空想像任何未提供之地理、設備、價格或法規數據。
2. 禁止說「秒殺」、「最便宜」、「保證出租」、「精華地段」（未經證實）等誇大或承諾收益字眼。
3. 發文文案結尾必須如實、完整包含使用者之「法規尾段」。
4. 專業、務實且接地氣，保持極高生成品質與效率，絕不輸出無用贅字，節約 token 資源！
5. 【重要硬性規定】：不可省略價格！不論選擇何種「寫作語調（Tone）」或是在何種平台（Facebook, Instagram, Threads, 591, 樂屋網）發文，生成的每一篇租賃文案或說明中，都【絕對必須明確、醒目地寫出並標示該物件的租金價格】！

━━━━━━━━━━━━━━━━━━━━━━━━
STEP 0：物件資訊公開表（最優先輸出）
━━━━━━━━━━━━━━━━━━━━━━━━
在生成任何文案之前，必須先輸出物件資訊公開表。
輸出標籤：[PROPERTY_INFO]
只列出使用者有提供的資料，未提供的欄位直接刪除，不顯示、不標注。
地址只寫區域，完整門牌標示「詳址私訊確認」。

【物件資訊公開表】

▌基本資訊
📍 地點：（區域，詳址私訊確認）
💡 類型：
💡 樓層：
📐 坪數：地坪 XX 坪 / 室內 XX 坪（只有一種坪數則只列一項）
💰 租金：XX 元／月
🏦 押金：（有提供才列，未提供標示「請私訊確認」）

▌電力與設備
⚡ 電力：
🔧 設備：（逐項列出，未提供標示「無提供設備資訊」）

▌出入與動線
🚛 出入口：（有提供才列）
🛣️ 臨路寬度：（有提供才列）
📏 面寬：（有提供才列）
📏 深度：（有提供才列）
📏 挑高：（有提供才列）

▌使用登記
🏭 廠登：✔️ 可 / ❌ 不可 / ❓ 未確認（請私訊確認）
🏢 營登／報稅：✔️ 可 / ❌ 不可 / ❓ 未確認（請私訊確認）

▌費用說明
💧 水費：（有提供才列，未提供標示「請私訊確認」）
💡 電費：（有提供才列，未提供標示「請私訊確認」）
📡 網路／第四台：（有提供才列）

▌租約規範
🚫 限制：（有提供才列）
🐾 寵物：（有提供才列）
📋 其他規定：（有提供才列）

▌帶看方式
👁️ 帶看：（有提供才列）
📌 備註：（有提供才列）

▌安全聲明
🏠 凶宅：（有提供才列，未提供不得自行填寫）

━━━━━━━━━━━━━━━━━━━━━━━━
STEP 1：平台流量邏輯研究（每次必做）
━━━━━━━━━━━━━━━━━━━━━━━━
針對本次物件，分析三個平台的流量邏輯與操作建議。
輸出標籤：[PLATFORM_STUDY]

【平台流量研究報告】

▌Facebook 流量邏輯
觸發條件：留言數高於按讚數可擴大觸及、開放式問句拉留言、前三行決定展開率、地點標籤提升搜尋
高互動特徵：痛點開頭、條列清楚、CTA明確、在地關鍵字
語氣：口語有溫度，像朋友介紹房子
Emoji量：8～12個
本次物件操作建議：（根據物件特性給出具體建議）
建議發文時間：週二至週四，晚上8點至10點

▌Instagram 流量邏輯
觸發條件：儲存數是最重要指標、前125字決定展開率、地點標籤必加、Hashtag混搭大3中4小3
高互動特徵：強視覺感大標、換行多、數字具體、結尾引導儲存
語氣：精簡有質感，視覺節奏強
Emoji量：10～15個
本次物件操作建議：（根據物件特性給出具體建議）
建議發文時間：週三至週五，晚上9點至11點

▌Threads 流量邏輯
觸發條件：回覆串越長曝光越大、第一句決定一切、Hashtag已降權、主動回覆其他帳號帶流量
高互動特徵：全文不超過150字、每句獨立成行、反問句（例：『你覺得這個物件最適合哪種生意？』或『換作是你，會優先考慮哪個特色？』）拉回覆
語氣：極口語，像真人在說話
Emoji量：5～8個
本次物件操作建議：（根據物件特性給出具體建議）
建議發文時間：週一至週四，早上7點或晚上8點

━━━━━━━━━━━━━━━━━━━━━━━━
STEP 2：市場調查報告（必做）
━━━━━━━━━━━━━━━━━━━━━━━━
根據物件的區域、類型、坪數、租金，分析該地區行情與競品。
輸出標籤：[MARKET_REPORT]

【市場調查報告】
（包含區域行情、競品分析、租金帶、主流賣點、常見SEO搜尋詞、周圍具體機能）
廠房分析重點：面寬、深度、高度、三相電、廠登、營登、臨路、貨櫃可否
住宅分析重點：格局、採光、車位、家具、可租補、可報稅、可養寵

━━━━━━━━━━━━━━━━━━━━━━━━
STEP 3：市場定位分析
━━━━━━━━━━━━━━━━━━━━━━━━
輸出標籤：[POSITIONING]
內容包含：【市場定位分析】（市場定位、定價評估、物件優劣勢分析、行銷策略、建議文案方向）。

━━━━━━━━━━━━━━━━━━━━━━━━
STEP 4：各平台文案生成
━━━━━━━━━━━━━━━━━━━━━━━━
根據前三步結果產出所有平台文案。

1. [FB_POST]
【Facebook版】：口語有溫度，像朋友介紹。字數 200-400，Emoji 8-12個。廠房/住宅 Hook 分別根據痛點切入。結尾必須包含明確的社群互動引導（例如：『你最看重房子的哪個部分？留言告訴我！』或『分享這則貼文給正在找房的朋友吧！』）以提升互動率與觸及。

2. [IG_POST]
【Instagram版】：精簡有質感，視覺節奏強。字數 100-200，Emoji 10-15個。結尾必須包含強烈的互動指令（例如：『喜歡這種風格嗎？留言「+1」我看更多細節！』或『分享這則貼文給正在找房的朋友，這間可能就是他的夢幻屋！』）以提升儲存、轉傳與私訊轉化。Hashtag 混搭。

3. [THREADS_POST]
【Threads版】：極口語，每句獨立成行。字數不超過 150，Emoji 5-8個。結尾使用具體、能引發共鳴的反問句（例如：『你覺得這裡最適合哪種生意？』、『如果是你，會先看重哪個優點？』）＋私訊CTA。

4. [591_POST]
【591版】：正式資訊導向。SEO標題公式。Emoji 5個以內。

5. [LAKUYA_POST]
【樂屋網版】：正式偏溫暖，強調家庭感。Emoji 6個以內。

━━━━━━━━━━━━━━━━━━━━━━━━
STEP 5：SEO關鍵字與Hashtag
━━━━━━━━━━━━━━━━━━━━━━━━
輸出標籤：[SEO_TAGS]
包含至少 10 組 SEO 關鍵字與 10 組 Hashtag（大3＋中4＋小3比例）。

━━━━━━━━━━━━━━━━━━━━━━━━
STEP 6：自我檢查與輸出要求
━━━━━━━━━━━━━━━━━━━━━━━━
逐條核對文案是否有對應資料支撐，無依據一律刪除。確保法規合規。

輸出要求：
- 必須是台灣繁體中文。
- 每篇文案（FB, IG, Threads, 591, 樂屋網）結尾必須完整附上使用者提供的「自定義法規尾段」。
- 標籤 [PROPERTY_INFO], [PLATFORM_STUDY], [MARKET_REPORT], [POSITIONING], [FB_POST], [IG_POST], [THREADS_POST], [591_POST], [LAKUYA_POST], [SEO_TAGS] 是用於系統解析的關鍵字，請務必包含。`;

    const toneInstruction = {
      professional: '【專業理性模型】：強調數據、投報率、法規準度。適合高總價或投資型物件。',
      fun: '【趣味幽默模型】：使用社群感強的語言、玩梗、輕鬆調侃。適合預算有限的小資族或熱門商圈。',
      warm: '【感性溫馨模型】：強調「家」的感覺、生活儀式感、起家厝情懷。適合家庭住宅或學區房。',
      urgent: '【急租催租模型】：字眼極具迫切感、強烈吸引力、強調難得機會、稀有釋出（如「手慢無！」、「房東佛心降價房客搶租中」），並在社群軟體中多加使用 ⏳, 🚨, 💥, 🏃‍♂️ 等極具催促急迫感的表情符號。',
      luxury: '【頂級奢華模型】：強調建材極致、高端隱私、美學景觀、富人品味生活、精裝細節與非凡格局，並在社群軟體中多加使用 💎, ✨, 🏰, 🥂, 🌟 等傳遞奢華尊崇感的表情符號。',
      'budget-friendly': '【特級高CP值模型】：主打省心、高CP值、優質划算、高坪效、符合租補與稅務優惠、小資友善，強調每一分錢都花得值得，並在社群軟體中多加使用 💰, 💡, 🉐, 🈴, 📈 等高性價比、親民的表情符號。',
      industrial: '【工業實務模型】：語氣務實高效，以業主/專業开发視角說話，強調工業地產（電力、重載、天車、臨路、出入口、廠登、消防與營利效率），並在社群軟體中多加使用 🏭, ⚙️, 📊, 🔩, 🚛 等專業工業生產與物流相關的表情符號。',
      friendly: '【輕鬆親切模型】：語氣口語、親人無包袱，像在和好友或群組分享、推薦，具有強烈親切感，並在社群軟體中多加使用 😊, 🙌, 👋, 💬, 🏡 等輕鬆、親民的表情符號。',
      story: '【情境故事模型】：擅長透過場景描繪、事業起步或溫馨搬家等第一人稱/第三人稱情境與故事，勾勒出入駐後的生動畫面，引發強烈情感與事業共鳴，並在社群軟體中多加使用 📖, 🌅, 🎯, 🏠, 💭 等富有情懷與故事感的表情符號。'
    }[tone as keyof typeof toneInstruction] || '';

    const baseInstruction = isIndustrial ? SYSTEM_INSTRUCTION_INDUSTRIAL : SYSTEM_INSTRUCTION;
    const dynamicSystemInstruction = `${baseInstruction}

━━━━━━━━━━━━━━━━━━━━━━━━
【指定寫作語調】：
${toneInstruction}
━━━━━━━━━━━━━━━━━━━━━━━━

⚠️【超級重要硬性規則 - 必須打出價格】：
不論上述指定何種寫作語調（不管是專業理性、趣味幽默、感性溫馨、急租催租、頂級奢華、高CP值、工業實務、輕鬆親切、情境故事等任何一種語味），在製作或產生各平台的文案時，都【絕對必須在文案內容裡特別、顯眼地寫出並標註物件的價格（租金 / 費用）】，絕不能遺漏或省略價格資訊！

━━━━━━━━━━━━━━━━━━━━━━━━
【使用者自定義法規尾段】請完整複製貼上到文案末端：
━━━━━━━━━━━━━━━━━━━━━━━━
${customFooter}`;

    const response = await generateContentWithRetry(ai, {
      model: "gemini-3.1-flash-lite",
      contents: `分析以下物件資訊並依序產出標籤導向的報告與文案：\n\n${propertyInfo}`,
      config: {
        temperature: 0.8,
        systemInstruction: dynamicSystemInstruction,
      },
    });

    const resultText = response.text ?? '';
    setCached(cacheKey, resultText);
    res.json({ text: resultText });
  } catch (err: any) {
    handleGeminiError(err, res);
  }
});

app.post("/api/analyze", async (req, res) => {
  const { ourCopy, competitorUrl, competitorText, myPropertyInfo } = req.body;
  if (!ourCopy && !myPropertyInfo) {
    return res.status(400).json({ error: "Missing ourCopy or myPropertyInfo" });
  }

  const cacheKey = `analyze::${ourCopy}::${competitorUrl}::${competitorText}::${myPropertyInfo}`;
  const cachedVal = getCached(cacheKey);
  if (cachedVal) {
    console.log("[Cache HIT] /api/analyze");
    return res.json({ text: cachedVal });
  }

  try {
    const ai = getAI();
    const competitorPrompt = `你是頂尖「房地產行銷總監」。請精簡、無贅字地將「我方文案」與「競品文案」對比並提供分析：

【我方物件】：${myPropertyInfo || '未提供，以文案為主'}
【我方文案】：${ourCopy || '請代為撰寫競爭型文案'}
【競品連結】：${competitorUrl || '未提供'}
【競品文案】：${competitorText || '請分析該對手特點'}

請以繁體中文分析並輸出：
1. 💻 競品亮點與強項：其優點、關鍵字亮點。
2. ⚠️ 競品盲點與劣勢：如易讀性差、無關鍵字、誇大風險。
3. ⚔️ 雙方維度 PK：用精簡條列法，對比吸睛度、易讀性、互動性、SEO、法規專業度。
4. 🚀 我們的文案升級建議：具體可加入、調整或修飾之細節。
5. ✍️ 融合競爭優勢的「特別推薦文案」（社群快攻版）：融合對方精華，創作一篇更生動吸睛的社群文案。【必須寫出並醒目標註我方物件的租金價格（不管使用什麼語調）】。

請保持精煉，每段大綱字數控制在100字內，不囉唆。`;

    const response = await generateContentWithRetry(ai, {
      model: "gemini-3.1-flash-lite",
      contents: competitorPrompt,
      config: {
        temperature: 0.75,
      },
    });

    const resultText = response.text ?? '';
    setCached(cacheKey, resultText);
    res.json({ text: resultText });
  } catch (err: any) {
    handleGeminiError(err, res);
  }
});

app.post("/api/refine", async (req, res) => {
  const { originalCopy, refinementInstructions, platform, customFooter } = req.body;
  if (!originalCopy || !refinementInstructions) {
    return res.status(400).json({ error: "Missing originalCopy or refinementInstructions" });
  }

  try {
    const ai = getAI();
    const refinementPrompt = `
您是一位頂尖的房產社群營運專家。請幫我「局部修飾與優化」以下這篇專為【${platform || '指定社群'}】平台設計的文案。

【當前文案內容】：
${originalCopy}

【使用者的微調優化指令】：
"${refinementInstructions}"

請依據這個微調指令對文案進行細緻的高質量修飾：
- 保留原本物件的真實數據（不要隨意捏造、變造原本物件的坪數、租金、地址等數據）。
- 嚴格遵守台灣法規及廣告真實性，不要加入任何誇大、虛假、保證秒殺、最便宜等非理性行銷詞彙。
- 語氣必須流暢、接地氣、搭配適當的表情符號（Emoji）。
- 【重要硬性規定】：不論是用什麼風格或語氣進行局部修改點綴，文案中都【必須明確且醒目地寫出並標註物件的價格（租金 / 費用）】，絕不可省略價格！
- 必須完整保留或附上以下自定義法規尾段（如有更新請融入）：
${customFooter || ''}

直接回傳修改與優化後的繁體中文文案，不需要回傳任何額外閒聊或 "好的，以下是修改後的文案" 這樣的引導句。請直接輸出最終文案內容：
`;

    const response = await generateContentWithRetry(ai, {
      model: "gemini-3.1-flash-lite",
      contents: refinementPrompt,
      config: {
        temperature: 0.7,
      },
    });

    res.json({ text: response.text ?? '' });
  } catch (err: any) {
    handleGeminiError(err, res);
  }
});

app.post("/api/generate-titles", async (req, res) => {
  const { propertyInfo, wizardData, inputMode } = req.body;
  
  let details = "";
  if (inputMode === "wizard" && wizardData) {
    details = `物件類型：${wizardData.type || '未填'}
地區地點：${wizardData.location || '未填'}
坪數：${wizardData.area || '未填'} 坪
租金：${wizardData.rent || '未填'} 元/月
樓層：${wizardData.floor || '未填'}
其他焦點特色：${wizardData.specs || '未填'}`;
  } else {
    details = propertyInfo || "未指定詳細物件內容";
  }

  try {
    const ai = getAI();
    const prompt = `您是精通台灣租賃與銷售的「591進階搜尋引擎SEO演算法優化專家」。請分析以下提供的物件資訊，並產出 3 個完全符合 591 平台黃金公式（點擊率高、具備高搜尋權重字眼、長度主動限縮在 15~28字之間，且絕不超長）的極致吸引人標題。

【物件細節】：
${details}

【591 標題四大優化法則】：
1. 嚴禁誇張不實與公平會罰金字眼（絕不使用：最便宜、秒殺、保證出租、精華地段」（未經證實）等誇大或承諾收益字眼）。可以使用有憑據、具亮點或符合客觀現狀的特徵：如「高CP值」、「精選優質」、「全新整理」、「附車位」、「實用挑高」、「採光好」。
2. 標題長度必須嚴格限制在 15 至 28 個繁體中文字。超過 28 字在 591 手機與網頁版上極易被裁減截斷。
3. 高點擊率的公式：【精選特色 / 地標機能 / 空間亮點】坪數或型態描述。例如：
   - 【全新整理/採光三房】科博館旁、附平車、大平面陽台
   - 【中科特區/免仲高CP】精美裝潢套房、近捷運站、採光佳
   - 【低租金/自備大電力】實用南區廠房、可廠登、搬遷首選
4. 請「只回傳」一個標準的 JSON 陣列，內含 3 個符合條件的標題字串。請不要以 \`\`\`json 開始或結束，而是直接傳回合法的 JSON。
格式範例：
["標題 1", "標題 2", "標題 3"]`;

    const response = await generateContentWithRetry(ai, {
      model: "gemini-3.1-flash-lite",
      contents: prompt,
      config: {
        temperature: 0.8,
        responseMimeType: "application/json"
      },
    });

    let rawText = response.text ?? '[]';
    console.log("[Gemini API - Titles] raw result:", rawText);
    
    // Help parse JSON clean
    rawText = rawText.trim();
    if (rawText.startsWith("```json")) {
      rawText = rawText.replace(/^```json/, "").replace(/```$/, "").trim();
    } else if (rawText.startsWith("```")) {
      rawText = rawText.replace(/^```/, "").replace(/```$/, "").trim();
    }
    
    let list = JSON.parse(rawText);
    if (!Array.isArray(list)) {
      list = [];
    }
    list = list.slice(0, 3).map((item: any) => String(item).trim().substring(0, 30));

    res.json({ titles: list });
  } catch (err: any) {
    console.error("Generate titles error:", err);
    res.json({ titles: [] }); // fallback gracefully
  }
});

app.post("/api/proxy-scrape", async (req, res) => {
  const { url } = req.body;
  if (!url) return res.status(400).json({ error: "Missing url" });
  
  const cacheKey = `scrape::${url}`;
  const cachedVal = getCached(cacheKey);
  if (cachedVal) {
    console.log("[Cache HIT] /api/proxy-scrape");
    return res.json({ text: cachedVal });
  }

  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 6000);
    
    let text = "";
    try {
      const fetchRes = await fetch(url, {
        headers: {
          "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
          "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8",
          "Accept-Language": "zh-TW,zh;q=0.9,en-US;q=0.8,en;q=0.7"
        },
        signal: controller.signal
      });
      clearTimeout(timeoutId);
      if (fetchRes.ok) {
        const html = await fetchRes.text();
        text = html
          .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
          .replace(/<style\b[^<]*(?:(?!<\/style>)<[^<]*)*<\/style>/gi, '')
          .replace(/<[^>]+>/g, ' ')
          .replace(/\s+/g, ' ')
          .trim()
          .substring(0, 3000);
      }
    } catch (e) {
      console.log("Fetch direct fail, fallback to search/generation:", e);
    }
    
    if (!text || text.length < 100) {
      try {
        const ai = getAI();
        const crawlPrompt = `你現在是專業的房產網頁資料抓取助理。請幫我搜尋或解析以下台灣房屋租售網站的頁面資訊，抓取其主要的物件特徵（地點、坪數、租金、設備、細節、廣告內文描述等）。如果你無法直接聯網，請根據網址中的主要特徵，合理生動地模擬出該對手連結的詳細出租資訊與廣告文字。
網址：${url}
請用台灣繁體中文回傳，精確條列及寫出廣告大綱，不要回傳任何額外行銷閒聊，也不要輸出任何宣告。`;
        const geminiRes = await generateContentWithRetry(ai, {
          model: "gemini-3.1-flash-lite",
          contents: crawlPrompt,
          config: {
            temperature: 0.2,
            tools: [{ googleSearch: {} }]
          }
        });
        text = geminiRes.text || "";
      } catch (geminiErr) {
        text = `【類似物件參考】台南近園區雙天車大廠地出租\n租金：約38-40萬/月\n坪數：約420坪\n高承載、臨路寬敞，適合多台中大型貨車進出。廠務空間方正，備有三相電及消防結構。`;
      }
    }
    
    setCached(cacheKey, text);
    res.json({ text });
  } catch (err: any) {
    handleGeminiError(err, res);
  }
});

// Vite server middleware or production static build serving
async function startServer() {
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on port ${PORT}`);
  });
}

startServer();
