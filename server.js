import express from "express";
import { KintoneRestAPIClient } from "@kintone/rest-api-client";

// Expressアプリを初期化
const app = express();
app.use(express.json());

// --- ▼▼▼ ここからが最終調査コード ▼▼▼ ---
// アクセスキーを検証し、その内容をログに出力する「門番」関数
const authMiddleware = (req, res, next) => {
  const expectedKey = process.env.POE_ACCESS_KEY;
  const authHeader = req.headers.authorization;

  // --- ログ出力部分 ---
  console.log('--- Access Key Check ---');
  console.log('Poeから受信したヘッダー (Authorization):', authHeader);
  console.log('Renderに設定された期待されるキー (加工後):', `Bearer ${expectedKey}`);
  // --- ログ出力部分ここまで ---

  if (!expectedKey) {
    return next();
  }

  if (authHeader === `Bearer ${expectedKey}`) {
    console.log('>>> 結果: キーが一致しました。アクセスを許可します。');
    next();
  } else {
    console.error('>>> 結果: キーが一致しません！アクセスを拒否します。');
    res.status(401).send("Unauthorized");
  }
};
// --- ▲▲▲ ここまでが最終調査コード ▲▲▲ ---


// 1. Poeの疎通確認専用のエンドポイント
app.all('/', (req, res) => {
  console.log('Poe reachability check received.');
  res.status(200).json({ status: "ok" });
});

// 2. セキュリティチェック（門番）を有効化
app.use(authMiddleware);

// 3. kintone操作用のAPIエンドポイント
app.post("/getRecords", async (req, res) => {
  try {
    const client = new KintoneRestAPIClient({
      baseUrl: process.env.KINTONE_BASE_URL,
      auth: { apiToken: process.env.KINTONE_API_TOKEN },
    });
    // ... (以下、変更なし)
    const params = req.body;
    if (!params.app) {
      return res.status(400).json({ error: "app ID is required" });
    }
    const resp = await client.record.getRecords(params);
    res.json(resp.records);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});
app.post("/addRecord", async (req, res) => {
  try {
    const client = new KintoneRestAPIClient({
      baseUrl: process.env.KINTONE_BASE_URL,
      auth: { apiToken: process.env.KINTONE_API_TOKEN },
    });
    // ... (以下、変更なし)
    const params = req.body;
    if (!params.app || !params.record) {
      return res.status(400).json({ error: "app ID and record data are required" });
    }
    const resp = await client.record.addRecord(params);
    res.json(resp);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// 4. サーバーを起動
const PORT = process.env.PORT || 3001;
app.listen(PORT, () => {
  console.log(`Simple kintone API server is running on port ${PORT}`);
});
