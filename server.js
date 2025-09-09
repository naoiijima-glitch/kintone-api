import "dotenv/config";
import express from "express";
import { KintoneRestAPIClient } from "@kintone/rest-api-client";
import axios from "axios";

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

    const neoAIResponse = await axios.post(`${process.env.NEOAI_BASE_URL}/chat/completions`, body, { headers });

    // --- ▼▼▼ ここに追加 ▼▼▼ ---
    console.log('--- neoAIからの応答データ ---');
    console.log(JSON.stringify(neoAIResponse.data, null, 2));
    console.log('---------------------------');
    // --- ▲▲▲ ここまで追加 ▲▲▲ ---

    const aiResponse = JSON.parse(neoAIResponse.data.choices[0].message.content);
    
    if (aiResponse.action === "getRecords" || aiResponse.action === "addRecord") {
      // (kintoneとの通信部分は変更なし)
    } else if (aiResponse.action === "clarify") {
      // (変更なし)
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
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Final kintone AI server is running on port ${PORT}`);
});

