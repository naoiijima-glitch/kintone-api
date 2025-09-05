import express from "express";
import { KintoneRestAPIClient } from "@kintone/rest-api-client";

// Expressアプリを初期化
const app = express();
app.use(express.json());

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