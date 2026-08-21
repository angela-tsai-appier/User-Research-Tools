/**
 * Research Tools — 共用 Claude API Proxy（Netlify Function）
 *
 * 一支函式服務 research-tools 底下的所有工具。
 * 新增工具時只要在 TOOLS 加一筆設定即可。
 *
 * 路由：
 *   POST /api/{tool-id}   → 對應工具
 *   GET  /api/health      → 健康檢查（不需通行碼）
 *
 * ── 環境變數 ──────────────────────────────────────────
 * 必填：
 *   API_KEY            — LiteLLM key 或 Anthropic 官方金鑰
 *   SHARED_PASSCODE    — 團隊通行碼
 *
 * 選填：
 *   API_BASE_URL       — 自訂端點。留空則使用 Anthropic 官方。
 *                        走公司 LiteLLM gateway 時填 gateway 網址，
 *                        例如 https://llm-gateway.example.com
 *   API_MODE           — 'anthropic'（預設）或 'openai'。
 *                        LiteLLM 兩種格式都支援，若 anthropic 格式
 *                        不通可改成 openai 再試。
 *
 * 註：網頁與函式同源，因此不需要 CORS 標頭。
 */

const DEFAULT_ANTHROPIC_BASE = 'https://api.anthropic.com';
const ANTHROPIC_VERSION = '2023-06-01';

/**
 * 各工具的限制設定。
 * 新增工具：複製一筆，改 key 與 maxTokens 即可。
 */
const TOOLS = {
  fieldnote: {
    name: '訪談筆記',
    allowedModels: ['claude-sonnet-4-6'],
    maxTokens: 4096,
  },
  // scheduler: {
  //   name: '訪談排程',
  //   allowedModels: ['claude-sonnet-4-6'],
  //   maxTokens: 2048,
  // },
};

function json(body, status) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

/**
 * 依模式組出上游請求。
 * anthropic 模式：/v1/messages，x-api-key 驗證
 * openai 模式：  /v1/chat/completions，Bearer 驗證（LiteLLM 常見設定）
 */
function buildUpstreamRequest(mode, baseUrl, apiKey, payload) {
  if (mode === 'openai') {
    const messages = [];
    if (payload.system) {
      messages.push({ role: 'system', content: payload.system });
    }
    payload.messages.forEach(m => messages.push(m));

    return {
      url: baseUrl + '/v1/chat/completions',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer ' + apiKey,
      },
      body: {
        model: payload.model,
        max_tokens: payload.max_tokens,
        messages,
      },
    };
  }

  // 預設：Anthropic 原生格式
  return {
    url: baseUrl + '/v1/messages',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': apiKey,
      'Authorization': 'Bearer ' + apiKey, // LiteLLM 部分設定認這個，官方端點會忽略
      'anthropic-version': ANTHROPIC_VERSION,
    },
    body: payload,
  };
}

/**
 * 把 OpenAI 格式的回應轉成 Anthropic 格式，
 * 讓前端不論走哪種模式都能用同一套解析邏輯。
 */
function normalizeResponse(mode, data) {
  if (mode !== 'openai') return data;

  const choice = data && data.choices && data.choices[0];
  const text = (choice && choice.message && choice.message.content) || '';
  return {
    content: [{ type: 'text', text }],
    stop_reason: choice && choice.finish_reason === 'length' ? 'max_tokens' : 'end_turn',
    usage: data && data.usage,
  };
}

export default async (request, context) => {
  const url = new URL(request.url);
  const segments = url.pathname.split('/').filter(Boolean);
  const toolId = segments[segments.length - 1] || '';

  // 相容舊變數名稱 ANTHROPIC_API_KEY
  const apiKey = Netlify.env.get('API_KEY') || Netlify.env.get('ANTHROPIC_API_KEY');
  const sharedPasscode = Netlify.env.get('SHARED_PASSCODE');
  // 正規化 base URL：去掉結尾斜線，並移除結尾的 /v1
  // （有些 gateway 給的網址已含 /v1，避免組出 /v1/v1/messages）
  const baseUrl = (Netlify.env.get('API_BASE_URL') || DEFAULT_ANTHROPIC_BASE)
    .replace(/\/+$/, '')
    .replace(/\/v1$/, '');
  const mode = (Netlify.env.get('API_MODE') || 'anthropic').toLowerCase();

  // 健康檢查
  if (request.method === 'GET' && toolId === 'health') {
    return json(
      {
        ok: true,
        tools: Object.keys(TOOLS),
        hasApiKey: Boolean(apiKey),
        passcodeRequired: Boolean(sharedPasscode),
        endpoint: baseUrl,
        mode: mode,
        resolvedUrl: mode === 'openai'
          ? baseUrl + '/v1/chat/completions'
          : baseUrl + '/v1/messages',
      },
      200
    );
  }

  if (request.method !== 'POST') {
    return json({ error: '只接受 POST 請求。' }, 405);
  }

  const tool = TOOLS[toolId];
  if (!tool) {
    return json(
      {
        error: '未知的工具路徑：/api/' + toolId,
        hint: '可用路徑：' + Object.keys(TOOLS).map(function (t) { return '/api/' + t; }).join(', '),
      },
      404
    );
  }

  if (!apiKey) {
    return json(
      { error: '伺服器尚未完成設定（缺少 API_KEY），請聯絡管理者。' },
      500
    );
  }

  // 通行碼為選用機制：
  // 沒有設定 SHARED_PASSCODE 時完全跳過驗證（適合個人測試階段）；
  // 一旦在 Netlify 設定了這個環境變數，就會自動開始要求通行碼。
  if (sharedPasscode) {
    if (request.headers.get('X-Fieldnote-Passcode') !== sharedPasscode) {
      return json({ error: '通行碼錯誤或未填寫。' }, 401);
    }
  }

  let payload;
  try {
    payload = await request.json();
  } catch (e) {
    return json({ error: '請求內容不是合法的 JSON。' }, 400);
  }

  if (!tool.allowedModels.includes(payload.model)) {
    return json({ error: '此工具不允許的模型：' + payload.model }, 400);
  }

  if (!Array.isArray(payload.messages) || payload.messages.length === 0) {
    return json({ error: 'messages 欄位不可為空。' }, 400);
  }

  const safePayload = {
    model: payload.model,
    max_tokens: Math.min(payload.max_tokens || 1024, tool.maxTokens),
    messages: payload.messages,
  };
  if (payload.system) {
    safePayload.system = payload.system;
  }

  const upstreamReq = buildUpstreamRequest(mode, baseUrl, apiKey, safePayload);

  try {
    const upstream = await fetch(upstreamReq.url, {
      method: 'POST',
      headers: upstreamReq.headers,
      body: JSON.stringify(upstreamReq.body),
    });

    const text = await upstream.text();

    if (!upstream.ok) {
      // 把上游錯誤原樣帶出來，方便判斷是端點、金鑰還是模型名稱的問題
      return json(
        {
          error: '上游 API 回應錯誤（HTTP ' + upstream.status + '）',
          endpoint: upstreamReq.url,
          mode: mode,
          upstream: text.slice(0, 800),
        },
        upstream.status
      );
    }

    let data;
    try {
      data = JSON.parse(text);
    } catch (e) {
      return json({ error: '上游回應不是合法 JSON。', upstream: text.slice(0, 500) }, 502);
    }

    return json(normalizeResponse(mode, data), 200);
  } catch (err) {
    return json(
      {
        error: '無法連線到 API 端點：' + err.message,
        endpoint: upstreamReq.url,
        hint: '若使用公司 LiteLLM gateway，請確認該網址可從外部網路存取（Netlify 伺服器不在公司內網）。',
      },
      502
    );
  }
};

export const config = {
  path: '/api/*',
};
