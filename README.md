# Research Tools

UX Research（Enterprise Solutions）研究流程用的小工具集合。

**入口網址：** https://research-tools.netlify.app/ （部署後以實際網址為準）

---

## 目錄結構

```
research-tools/
├── index.html                    ← 工具總覽首頁
├── netlify.toml                  ← Netlify 設定
├── netlify/functions/api.mjs     ← 共用 Claude API proxy
├── fieldnote/index.html          ← 訪談筆記工具
└── scheduler/index.html          ← 訪談排程工具（待搬遷）
```

網址對應：

| 項目 | 網址 |
|---|---|
| 總覽 | `/` |
| Fieldnote | `/fieldnote/` |
| Scheduler | `/scheduler/` |
| API 代理 | `/api/{tool-id}` |
| 健康檢查 | `/api/health` |

網頁與 API 同源，因此不需處理 CORS，同事也不需要設定任何網址。

---

## 給使用者

### 第一次使用

向 Angela 索取**團隊通行碼**，在任一工具的「AI 服務設定」填入即可。

通行碼會存在瀏覽器，**所有工具共用**——填過一次，其他工具會自動帶入。

### Fieldnote

貼上或錄製訪談逐字稿，產生結構化筆記（快速結論、附時間碼引述、主題整理、訪綱涵蓋度、下一步），可複製為 Markdown 或存進 GitHub。

筆記存放結構：

```
notes/
├── aiqua/          ├── agent/
├── airis/          ├── innovation-exploration/   # 創新探索
├── botbonnie/      ├── foundational-research/    # 使用者基礎研究
├── moses/          └── {自訂}/
```

檔名 `YYYY-MM-DD-受訪者角色.md`，開頭帶 frontmatter（日期、專案、受訪者、訪綱主題），方便日後寫 script 做跨訪談分析。

存進 GitHub 需要自己申請 **fine-grained token**，只授權研究 repo、權限只給 **Contents: Read and write**。Token 不會被儲存，每次重開頁面要重貼。

---

## 給管理者

### 部署（一次設定，之後自動）

1. 把這個 repo 推上 GitHub
2. 登入 [Netlify](https://app.netlify.com/) → **Add new site** → **Import an existing project**
3. 選 GitHub，授權後選擇這個 repo
4. 建置設定會自動讀取 `netlify.toml`，直接按 **Deploy**
5. 部署完成後，進 **Site configuration** → **Environment variables**，新增設定：

   **必填：**

   | 名稱 | 值 |
   |---|---|
   | `API_KEY` | LiteLLM key 或 Anthropic 官方金鑰 |

   **選填（分享給同事前再加）：**

   | 名稱 | 值 |
   |---|---|
   | `SHARED_PASSCODE` | 自訂團隊通行碼 |

   通行碼機制預設關閉。個人測試階段不用設，使用者也不必填任何東西。
   之後要分享給同事時，在 Netlify 加上這個變數並重新部署，就會自動開始要求通行碼，**不需要改程式碼**。

   **走公司 LiteLLM gateway 時另外加：**

   | 名稱 | 值 |
   |---|---|
   | `API_BASE_URL` | gateway 網址，例如 `https://llm-gateway.example.com` |
   | `API_MODE` | 先不填（預設 anthropic）；若回 404 或格式錯誤再改成 `openai` |

   不填 `API_BASE_URL` 就會走 Anthropic 官方端點。

6. 環境變數新增後要**重新部署一次**才會生效：**Deploys** → **Trigger deploy** → **Deploy site**
7. **驗證**：瀏覽器打開 `你的網址/api/health`，應看到類似：

   ```json
   {"ok":true,"tools":["fieldnote"],"hasApiKey":true,"passcodeRequired":false,
    "endpoint":"https://api.anthropic.com","mode":"anthropic"}
   ```

   確認 `endpoint` 是你預期的端點、`mode` 是預期的格式。
8. 把網址 + 通行碼發給同事

設定完成後，之後 push 到 GitHub 就會自動部署，不需要再進後台。

### 取得 Anthropic API 金鑰

1. https://console.anthropic.com/ → **API Keys** → **Create Key**
2. 金鑰只顯示一次，立刻複製
3. **Billing** 需要先儲值才能使用
4. 建議同時設定每月用量上限，作為通行碼外流時的保險

### 新增工具時

不需要開新 repo，也不需要新的函式：

1. 在 repo 建一個新資料夾，放 `index.html`
2. 在 `index.html`（總覽首頁）加一張卡片
3. 如果新工具要用 AI，在 `netlify/functions/api.mjs` 的 `TOOLS` 加一筆設定
4. 工具內把 `TOOL_ID` 設成對應的路徑名稱
5. push 即可，Netlify 會自動部署

### 內建防護

1. **通行碼驗證** — 擋掉網址外流後的外部濫用
2. **工具路由** — 未註冊的路徑一律拒絕
3. **模型白名單** — 每個工具各自限定可用模型
4. **max_tokens 上限** — 每個工具各自設定上限

通行碼外流時，改掉 `SHARED_PASSCODE` 並重新部署即可，不需更換 Anthropic 金鑰。

---

## 搬遷 Interview Scheduler

原本的 `interview-scheduler` repo 搬進來的步驟：

1. 把原 repo 的檔案複製到 `scheduler/` 資料夾（覆蓋佔位頁）
2. 確認頁面內的相對路徑仍然正確
3. 舊網址會失效，建議在原 repo 留一個轉址頁：

   ```html
   <meta http-equiv="refresh" content="0; url=https://research-tools.netlify.app/scheduler/">
   ```

4. 通知已經在用舊網址的同事

---

## 已知限制

| 項目 | 狀況 |
|---|---|
| 語者分辨 | **不支援**。正式訪談建議用 Fireflies 或會議工具轉錄後貼上 |
| 瀏覽器支援 | 錄音僅支援 Chrome / Edge；Safari 需手動貼逐字稿 |
| 中文辨識品質 | 受噪音、口音、多人交談影響大，務必人工檢查 |
| 逐字稿長度 | 單次建議 30–40 分鐘內容，過長會被截斷（工具會提示） |
| 函式執行時間 | Netlify 免費方案上限 10 秒，極長的逐字稿可能超時 |
| 用量歸屬 | 通行碼為共用，無法區分個別同事用量 |

## 使用須知

AI 產出的筆記是**初稿**，不是定稿。引述可能因語音辨識或模型理解出錯，正式引用前請對照原始逐字稿確認。

錄音前請告知受訪者並取得同意。

---

## 使用公司 LiteLLM gateway

工具預設打 Anthropic 官方端點，也可以改走 Appier 內部 LiteLLM gateway。

### 設定

| 環境變數 | 走官方 | 走 gateway |
|---|---|---|
| `API_KEY` | Anthropic 金鑰 | LiteLLM key |
| `API_BASE_URL` | 不填 | gateway 網址 |
| `API_MODE` | 不填 | 先不填，不通再試 `openai` |

改完環境變數記得 **Trigger deploy**，再開 `/api/health` 確認 `endpoint` 與 `mode` 正確。

### 排錯

錯誤訊息會帶出實際打的端點與上游回應，對照下表判斷：

| 症狀 | 可能原因 |
|---|---|
| 連線逾時 / 無法連線 | gateway 只開放內網，Netlify 連不到。**這條路就走不通**，需改用官方金鑰或改為內網部署 |
| 401 / 403 | key 無效、過期，或沒有該模型的權限 |
| 404 | 端點路徑不符，把 `API_MODE` 改成 `openai` 再試 |
| 400 且提到 model | gateway 上的模型名稱不同，需向管理者確認實際可用的名稱，並修改 `api.mjs` 的 `allowedModels` |

### 使用前建議先確認

- 這把 key 是否允許用於部署在外部平台的工具
- 團隊共用工具是否應該申請專用 key，而非個人 key

共用一把 key 代表 gateway 端看不出是哪位同事的用量。人數少時影響不大，但若之後要做用量歸屬，需要改成每人一組通行碼並在函式端記錄。

---

## 分享給同事前該做的事

個人測試階段可以不設通行碼。但在把網址發給同事之前，請先想清楚：

**Netlify 網址是公開的。** 沒有通行碼的話，任何知道網址的人（包含爬蟲掃到的）都能呼叫 `/api/fieldnote`，用你的 API key 跑他自己的請求。對方看不到金鑰，卻能無限使用它，而且你不會收到任何異常通知。

建議至少做到其中一項：

1. **加上 `SHARED_PASSCODE`** — 最簡單，在 Netlify 加環境變數並重新部署即可自動生效
2. **Netlify 密碼保護** — 整站保護，同事進站輸入一次密碼（付費功能）
3. **Netlify Identity** — 用公司 email 登入，最嚴謹，而且**能看出是誰在用**

另外，無論選哪種，都建議在 API 供應端設用量上限，作為最後一道保險。
