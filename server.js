import express from "express";
import { KintoneRestAPIClient } from "@kintone/rest-api-client";

// アクセスキーを検証する「門番」の役割を持つ関数（ミドルウェア）
const authMiddleware = (req, res, next) => {
  // Renderに設定したアクセスキーを取得
  const expectedKey = process.env.POE_ACCESS_KEY;

  // Renderにキーが設定されていなければ、チェックをスキップ（テスト用）
  if (!expectedKey) {
    return next();
  }

  // Poeから送られてくるリクエストヘッダーを取得
  const authHeader = req.headers.authorization;
  
  // ヘッダーのキーと、設定したキーが一致するか確認
  if (authHeader === `Bearer ${expectedKey}`) {
    next(); // 一致すれば、次の処理へ進む
  } else {
    res.status(401).send("Unauthorized"); // 一致しなければ、ここで処理を止める
  }
};

// Expressアプリを初期化
const app = express();
app.use(express.json());

// すべてのAPIリクエストの前に、必ず「門番」を通るように設定
app.use(authMiddleware);

// kintone クライアントを初期化
// 環境変数はRender側で設定します
const client = new KintoneRestAPIClient({
  baseUrl: process.env.KINTONE_BASE_URL,
  auth: {
    apiToken: process.env.KINTONE_API_TOKEN,
  },
});

// ルートURLへのアクセス確認用
app.get("/", (req, res) => {
  res.send("kintone API server is running!");
});

// レコード取得のエンドポイント
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

// レコード登録のエンドポイント
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

// Renderが指定するポートでサーバーを起動
const PORT = process.env.PORT || 3001;
app.listen(PORT, () => {
  console.log(`kintone API server is running on port ${PORT}`);
});