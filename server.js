import "dotenv/config";
import express from "express";
import { KintoneRestAPIClient } from "@kintone/rest-api-client";
import axios from "axios"; // openaiの代わりにaxiosをインポート

// Expressアプリを初期化
const app = express();
app.use(express.json());

// Poeの応答形式に対応するためのヘルパー関数
const sendPoeEvent = (res, event) => {
  res.write(`data: ${JSON.stringify(event)}\n\n`);
};

// メインの処理
app.post('/', async (req, res) => {
  const request = req.body;
  if (request.type !== "query") {
    return res.json({});
  }

  try {
    res.setHeader('Content-Type', 'text/event-stream; charset=utf-8');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.flushHeaders();

    const latestMessage = request.query[request.query.length - 1].content;
    
    // --- ▼▼▼ ここからがaxiosを使った通信処理 ▼▼▼ ---
    
    // neoAIに送信するリクエストのヘッダーとボディを、GASのコードと全く同じように定義
    const headers = {
      'Authorization': `Bearer ${process.env.NEOAI_APIKEY}`,
      'Content-type': 'application/json'
    };
    const body = {
      model: 'GPT-4o',
      messages: [
        { role: "user", content: latestMessage }
      ],
      stream: false
    };

    // axiosでneoAIのAPIを呼び出す
    const neoAIResponse = await axios.post(process.env.NEOAI_BASE_URL, body, { headers });
    const aiResponse = JSON.parse(neoAIResponse.data.choices[0].message.content);
    
    // --- ▲▲▲ ここまで ▲▲▲ ---

    if (aiResponse.action === "getRecords" || aiResponse.action === "addRecord") {
      // (kintoneとの通信部分は変更なし)
      // ...
    } else if (aiResponse.action === "clarify") {
      // (変更なし)
      // ...
    }

  } catch (error) {
    console.error("!!! An error occurred !!!", error.response ? error.response.data : error.message);
    sendPoeEvent(res, { type: "text", text: `エラーが発生しました` });
  } finally {
    sendPoeEvent(res, { type: "done" });
    res.end();
  }
});

// サーバーの起動
const PORT = process.env.PORT || 3002;
app.listen(PORT, () => {
  console.log(`Final kintone AI server is running on port ${PORT}`);
});

