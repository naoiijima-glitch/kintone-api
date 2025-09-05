import express from "express";
import { KintoneRestAPIClient } from "@kintone/rest-api-client";

// Expressアプリを初期化
const app = express();
app.use(express.json());

// アクセスキーを検証する「門番」の役割を持つ関数（ミドルウェア）
const authMiddleware = (req, res, next) => {
  const expectedKey = process.env.POE_ACCESS_KEY;
  if (!expectedKey) { return next(); }
  const authHeader = req.headers.authorization;
  if (authHeader === `Bearer ${expectedKey}`) {
    next();
  } else {
    res.status(401).send("Unauthorized");
  }
};

// 1. Poeの疎通確認専用のエンドポイント
app.all('/', (req, res) => {
  console.log('Poe reachability check received.');
  res.status(200).json({ status: "ok" });
});

// 2. セキュリティチェック（門番）を有効化
app.use(authMiddleware);

// --- ▼▼▼ ここからが変更点 ▼▼▼ ---
// kintoneクライアントの初期化を、各エンドポイントの中に移動させる

// レコード取得
app.post("/getRecords", async (req, res) => {
  try {
    const client = new KintoneRestAPIClient({
      baseUrl: process.env.KINTONE_BASE_URL,
      auth: { apiToken: process.env.KINTONE_API_TOKEN },
    });
    
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

// レコード登録
app.post("/addRecord", async (req, res) => {
  try {
    const client = new KintoneRestAPIClient({
      baseUrl: process.env.KINTONE_BASE_URL,
      auth: { apiToken: process.env.KINTONE_API_TOKEN },
    });

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
// --- ▲▲▲ ここまでが変更点 ▲▲▲ ---

// サーバーを起動
const PORT = process.env.PORT || 3001;
app.listen(PORT, () => {
  console.log(`Simple kintone API server is running on port ${PORT}`);
});
