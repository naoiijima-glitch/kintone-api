import express from "express";
import { KintoneRestAPIClient } from "@kintone/rest-api-client";

// アクセスキーを検証する「門番」の役割を持つ関数（ミドルウェア）
const authMiddleware = (req, res, next) => {
  const expectedKey = process.env.POE_ACCESS_KEY;
  if (!expectedKey) {
    // Renderにキーが設定されていなければ、チェックをスキップ
    return next();
  }
  const authHeader = req.headers.authorization;
  if (authHeader === `Bearer ${expectedKey}`) {
    next(); // キーが一致すれば、次の処理へ進む
  } else {
    res.status(401).send("Unauthorized"); // 不一致なら、ここで処理を止める
  }
};

// Expressアプリを初期化
const app = express();
app.use(express.json());


// --- ここからが最終的な構成 ---

// 1. Poeの疎通確認専用のエンドポイント
//    セキュリティチェック（門番）の前に配置することで、キーなしでアクセスできるようにする
app.all('/', (req, res) => {
  console.log('Poe reachability check received.');
  res.status(200).json({ status: "ok" });
});

// 2. セキュリティチェック（門番）を有効化
//    これ以降のエンドポイントは、正しいアクセスキーがないとアクセスできなくなる
app.use(authMiddleware);

// 3. kintone操作用のAPIエンドポイント
const client = new KintoneRestAPIClient({
  baseUrl: process.env.KINTONE_BASE_URL,
  auth: {
    apiToken: process.env.KINTONE_API_TOKEN,
  },
});

// レコード取得
app.post("/getRecords", async (req, res) => {
  try {
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
