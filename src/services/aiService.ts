function showRetryMsg(msg: string) {
  if (typeof document === 'undefined') return;
  let el = document.getElementById('retry-toast');
  if (!el) {
    el = document.createElement('div');
    el.id = 'retry-toast';
    el.style.cssText = `
      position: fixed;
      bottom: 24px;
      right: 24px;
      background-color: #0f172a;
      border: 1px solid #f87171;
      color: #f8fafc;
      padding: 16px 20px;
      border-radius: 12px;
      font-size: 13px;
      font-family: system-ui, -apple-system, sans-serif;
      box-shadow: 0 10px 25px -5px rgba(0, 0, 0, 0.5), 0 8px 10px -6px rgba(0, 0, 0, 0.5);
      z-index: 99999;
      max-width: 350px;
      line-height: 1.6;
      display: flex;
      align-items: center;
      gap: 12px;
      transition: all 0.3s cubic-bezier(0.16, 1, 0.3, 1);
    `;
    
    const iconSp = document.createElement('span');
    iconSp.textContent = '⏳';
    iconSp.style.fontSize = '20px';
    el.appendChild(iconSp);
    
    const textNode = document.createElement('div');
    textNode.id = 'retry-toast-text';
    el.appendChild(textNode);
    
    document.body.appendChild(el);
  }
  const textEl = document.getElementById('retry-toast-text');
  if (textEl) {
    textEl.innerHTML = `<span style="font-weight: 600; color: #fca5a5;">API 頻率/額度限制：</span><br/>${msg}`;
  }
  el.style.display = 'flex';
}

function hideRetryMsg() {
  if (typeof document === 'undefined') return;
  const el = document.getElementById('retry-toast');
  if (el) el.style.display = 'none';
}

async function handleResponse(response: Response): Promise<any> {
  const contentType = response.headers.get("content-type") || "";
  if (!contentType.includes("application/json")) {
    const textText = await response.text().catch(() => "");
    // If response is HTML, it means standard Express error page, Vite route fallback, or reverse proxy error
    if (textText.trim().startsWith("<!doctype html>") || textText.trim().startsWith("<html")) {
      throw new Error(`【⚠️ 後端伺服器回應錯誤 (HTML)】\n\n後端伺服器傳回了 HTML 網頁而非 JSON 格式資料（狀態碼：${response.status}）。\n\n這通常代表：\n1. 專案伺服器正在重新啟動中（請稍候 5-10 秒重新整理）。\n2. 您的專案正在編譯，或是正在啟動。\n\n💡 請稍候重試或重新編整網頁。`);
    }
    throw new Error(`伺服器傳回非 JSON 規格的回應（狀態碼：${response.status}）：\n${textText.substring(0, 300)}`);
  }
  
  const data = await response.json();
  if (!response.ok) {
    throw new Error(data.error || `伺服器回應錯誤（狀態碼：${response.status}）`);
  }
  return data;
}

async function fetchWithRetry(url: string, options: RequestInit, retries: number = 5): Promise<Response> {
  for (let i = 0; i < retries; i++) {
    try {
      const res = await fetch(url, options);
      
      const contentType = res.headers.get("content-type") || "";
      const isHtmlResponse = !contentType.includes("application/json");
      
      // If the server returns a transient HTML route fallback (e.g., status 200/502 but HTML content because server is restarting/building)
      if (isHtmlResponse) {
        let serverError = '【後端伺服器正在啟動或重新編譯中，系統將於數秒後自動重試】';
        const textBody = await res.clone().text().catch(() => '');
        if (!textBody.trim().startsWith("<!doctype html>") && !textBody.trim().startsWith("<html")) {
          serverError = textBody.substring(0, 150);
        }
        
        const wait = (i + 1) * 2000; // 2s, 4s, 6s, 8s, 10s for super quick recovery during server restarts
        const errorLabel = "伺服器初始化中";
        
        console.warn(`${errorLabel} (${res.status})，${wait / 1000} 秒後重試...`);
        showRetryMsg(`目前${errorLabel} (狀態碼 ${res.status})。系統將於 ${wait / 1000} 秒後自動重試（嘗試次數：${i + 1}/${retries}）...\n${serverError ? `${serverError}` : ""}`);
        
        await new Promise(resolve => setTimeout(resolve, wait));
        continue;
      }
      
      hideRetryMsg();
      return res;
    } catch (e) {
      if (i === retries - 1) {
        hideRetryMsg();
        throw e;
      }
      const wait = Math.pow(2, i) * 10000;
      showRetryMsg(`網路連線異常。系統將於 ${wait / 1000} 秒後自動重試（嘗試次數：${i + 1}/${retries}）...`);
      await new Promise(resolve => setTimeout(resolve, wait));
    }
  }
  hideRetryMsg();
  throw new Error('已達最大自動重試次數，請確認您的 API 金鑰配額，或稍後再試。');
}

export async function generateRentalAnalysis(
  propertyInfo: string,
  customFooter: string,
  tone: string = 'professional',
  contactInfo?: string
): Promise<string> {
  const response = await fetchWithRetry("/api/generate", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ propertyInfo, customFooter, tone, contactInfo }),
  });
  const data = await handleResponse(response);
  return data.text;
}

export async function analyzeCompetitorCopy(
  ourCopy: string,
  competitorUrl: string,
  competitorText: string,
  myPropertyInfo?: string
): Promise<string> {
  const response = await fetchWithRetry("/api/analyze", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ ourCopy, competitorUrl, competitorText, myPropertyInfo }),
  });
  const data = await handleResponse(response);
  return data.text;
}

export async function refinePlatformCopy(
  originalCopy: string,
  refinementInstructions: string,
  platform: string,
  customFooter: string,
  contactInfo?: string
): Promise<string> {
  const response = await fetchWithRetry("/api/refine", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ originalCopy, refinementInstructions, platform, customFooter, contactInfo }),
  });
  const data = await handleResponse(response);
  return data.text;
}

export async function proxyScrapeUrl(url: string): Promise<string> {
  const response = await fetchWithRetry("/api/proxy-scrape", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ url }),
  });
  const data = await handleResponse(response);
  return data.text;
}

export async function generateTitles(
  propertyInfo: string,
  wizardData: any,
  inputMode: 'free' | 'wizard'
): Promise<string[]> {
  const response = await fetchWithRetry("/api/generate-titles", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ propertyInfo, wizardData, inputMode }),
  });
  const data = await handleResponse(response);
  return data.titles || [];
}

