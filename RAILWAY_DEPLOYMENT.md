# Railway 部署指南

本專案已配置為使用 **PostgreSQL** 資料庫，可以輕鬆部署到 Railway。

## 部署步驟

### 1. 建立 Railway 專案

1. 前往 [Railway](https://railway.app/) 並登入
2. 點擊 "New Project"
3. 選擇 "Deploy from GitHub repo"
4. 選擇您的 GitHub 儲存庫

### 2. 添加 PostgreSQL 資料庫

1. 在 Railway 專案中，點擊 "New" → "Database" → "Add PostgreSQL"
2. Railway 會自動建立 PostgreSQL 實例並提供 `DATABASE_URL` 環境變數

### 3. 配置環境變數

在 Railway 專案的 **Variables** 頁面中添加以下環境變數：

#### 必要環境變數

```bash
# Polygon.io API Key（您的選擇權數據 API 金鑰）
POLYGON_API_KEY=your_polygon_api_key_here

# Node 環境
NODE_ENV=production
```

#### 自動提供的環境變數

以下環境變數由 Railway 自動提供，無需手動設定：

- `DATABASE_URL` - PostgreSQL 連接字串（由 Railway PostgreSQL 服務自動注入）
- `PORT` - 應用程式監聽埠號（Railway 自動分配）

### 4. 資料庫遷移

Railway 會在部署時自動執行資料庫遷移。確保您的 `package.json` 中包含以下腳本：

```json
{
  "scripts": {
    "build": "vite build && esbuild server/_core/index.ts --platform=node --packages=external --bundle --format=esm --outdir=dist",
    "start": "NODE_ENV=production node dist/index.js",
    "db:push": "drizzle-kit generate && drizzle-kit migrate"
  }
}
```

### 5. 部署配置

Railway 會自動檢測您的專案類型並配置部署設定。如果需要自訂，可以在專案根目錄建立 `railway.json`：

```json
{
  "build": {
    "builder": "NIXPACKS"
  },
  "deploy": {
    "startCommand": "pnpm start",
    "restartPolicyType": "ON_FAILURE",
    "restartPolicyMaxRetries": 10
  }
}
```

### 6. 執行資料庫遷移

部署後，您需要手動執行一次資料庫遷移：

1. 在 Railway 專案中，點擊您的服務
2. 進入 "Settings" → "Deploy"
3. 在 "Custom Start Command" 中暫時設定：`pnpm db:push && pnpm start`
4. 重新部署
5. 遷移完成後，將 Start Command 改回 `pnpm start`

或者，您可以使用 Railway CLI：

```bash
# 安裝 Railway CLI
npm install -g @railway/cli

# 登入
railway login

# 連接到您的專案
railway link

# 執行遷移
railway run pnpm db:push
```

## 環境變數說明

### POLYGON_API_KEY

您的 Polygon.io (Massive) API 金鑰，用於獲取選擇權市場數據。

**如何獲取：**
1. 前往 [Massive](https://massive.com/)
2. 註冊並登入帳戶
3. 在 Dashboard 中找到您的 API Key
4. 選擇包含 Options 數據的訂閱方案

### DATABASE_URL

PostgreSQL 資料庫連接字串，由 Railway PostgreSQL 服務自動提供。

**格式：**
```
postgresql://username:password@host:port/database
```

## 驗證部署

部署完成後，您可以透過以下方式驗證：

1. **檢查應用程式狀態**：在 Railway Dashboard 中查看服務狀態
2. **訪問應用程式**：點擊 Railway 提供的公開 URL
3. **查看日誌**：在 Railway Dashboard 中查看應用程式日誌

## 資料庫管理

### 使用 Railway Dashboard

Railway 提供內建的資料庫管理工具：

1. 點擊 PostgreSQL 服務
2. 進入 "Data" 標籤
3. 可以直接執行 SQL 查詢

### 使用外部工具

您可以使用任何 PostgreSQL 客戶端連接到 Railway 資料庫：

- **pgAdmin**
- **DBeaver**
- **TablePlus**
- **DataGrip**

連接資訊可以在 Railway PostgreSQL 服務的 "Connect" 標籤中找到。

## 常見問題

### Q: 部署後出現資料庫連接錯誤

**A:** 確保 PostgreSQL 服務已正確添加，並且 `DATABASE_URL` 環境變數已自動注入。

### Q: 如何更新資料庫 Schema？

**A:** 修改 `drizzle/schema.ts` 後，執行 `railway run pnpm db:push` 或在部署時執行遷移。

### Q: 如何查看應用程式日誌？

**A:** 在 Railway Dashboard 中點擊您的服務，然後進入 "Deployments" 標籤查看日誌。

### Q: 如何設定自訂網域？

**A:** 在 Railway 專案的 "Settings" → "Domains" 中添加自訂網域。

## 效能優化建議

1. **啟用連接池**：PostgreSQL 連接已配置為使用連接池
2. **設定適當的資源限制**：在 Railway 中調整服務的 CPU 和記憶體配置
3. **使用 CDN**：考慮使用 Cloudflare 等 CDN 服務加速靜態資源

## 安全建議

1. **定期更新依賴**：執行 `pnpm update` 更新套件
2. **保護 API 金鑰**：永遠不要將 API 金鑰提交到版本控制
3. **啟用 HTTPS**：Railway 自動提供 HTTPS
4. **定期備份資料庫**：Railway 提供自動備份功能

## 支援

如有任何問題，請參考：

- [Railway 文件](https://docs.railway.app/)
- [Drizzle ORM 文件](https://orm.drizzle.team/)
- [Polygon.io API 文件](https://massive.com/docs/)
