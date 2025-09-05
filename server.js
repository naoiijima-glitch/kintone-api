import express from "express";
import { KintoneRestAPIClient } from "@kintone/rest-api-client";

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

const app = express();
app.use(express.json());

// 【重要】アクセスキーのチェックがコメントアウトされていることを確認
// app.use(authMiddleware);


// --- ▼▼▼ ここからが最重要のデバッグコード ▼▼▼ ---
// Poeの疎通確認テスト専用のエンドポイント
// ルートパス("/")に来るすべての種類のリクエスト(GET, POSTなど)をここで受け止める
app.all('/', (req, res) => {
  console.log('--- Poeの疎通確認リクエストを受信 ---');
  console.log('Method:', req.method); // 'POST'か'GET'かなどを確認
  console.log('Headers:', JSON.stringify(req.headers, null, 2));
  console.log('Body:', JSON.stringify(req.body, null, 2));
  console.log('------------------------------------');
  
  // Poeに対して、無条件で「成功(200 OK)」を返す
  res.status(200).json({ status: "ok", message: "Hello from Render!" });
});
// --- ▲▲▲ ここまで ▲▲▲ ---


// kintone クライアントを初期化
const client = new KintoneRestAPIClient({
  baseUrl: process.env.KINTONE_BASE_URL,
  auth: {
    apiToken: process.env.KINTONE_API_TOKEN,
  },
});

// レコード取得のエンドポイント
app.post("/getRecords", async (req, res) => { /* ... 以前のコードと同じ ... */ });
// レコード登録のエンドポイント
app.post("/addRecord", async (req, res) => { /* ... 以前のコードと同じ ... */ });

// Renderが指定するポートでサーバーを起動
const PORT = process.env.PORT || 3001;
app.listen(PORT, () => {
  console.log(`Simple kintone API server is running on port ${PORT}`);
});
