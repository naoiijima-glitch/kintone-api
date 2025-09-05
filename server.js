import express from "express";
import { KintoneRestAPIClient } from "@kintone/rest-api-client";

// この関数の中で、エラーが起きる可能性のある処理をすべて実行します
const startServer = async () => {
  // Expressアプリを初期化
  const app = express();
  app.use(express.json());

  // アクセスキーを検証する「門番」の役割を持つ関数（ミドルウェア）
  const authMiddleware = (req, res, next) => {
    const expectedKey = process.env.POE_ACCESS_KEY;
    if (!expectedKey) {
      return next();
    }
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
  
  // --- ▼▼▼ クラッシュの最有力候補 ▼▼▼ ---
  console.log("Initializing Kintone client...");
  // 3. kintone操作用のAPIエンドポイント
  const client = new KintoneRestAPIClient({
    baseUrl: process.env.KINTONE_BASE_URL,
    auth: {
      apiToken: process.env.KINTONE_API_TOKEN,
    },
  });
  console.log("Kintone client initialized successfully.");
  // --- ▲▲▲ ここでエラーが起きている可能性が高い ▲▲▲ ---

  // レコード取得
  app.post("/getRecords", async (req, res) => {
    // ... (省略) ...
  });

  // レコード登録
  app.post("/addRecord", async (req, res) => {
    // ... (省略) ...
  });

  // 4. サーバーを起動
  const PORT = process.env.PORT || 3001;
  app.listen(PORT, () => {
    console.log(`Simple kintone API server is running on port ${PORT}`);
  });
};


// --- ▼▼▼ ここからが最重要のデバッグコード ▼▼▼ ---
// 起動処理を実行し、もしクラッシュするようなエラーが起きれば、それを捕まえて強制的にログに出力する
startServer().catch(error => {
  console.error('!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!');
  console.error('!!! FATAL STARTUP ERROR !!!');
  console.error('!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!');
  console.error('サーバーの起動中に致命的なエラーが発生しました。環境変数の設定が間違っている可能性が高いです。');
  console.error('エラー詳細:', error);
  process.exit(1); // エラーがあったことを示すコードでプロセスを終了
});
