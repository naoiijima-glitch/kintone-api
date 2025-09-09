import "dotenv/config";
import express from "express";
import { KintoneRestAPIClient } from "@kintone/rest-api-client";
import axios from "axios";

const app = express();
app.use(express.json());

const sendPoeEvent = (res, event) => {
  res.write(`data: ${JSON.stringify(event)}\n\n`);
};

app.post('/', async (req, res) => {
  const request = req.body;
  if (request.type !== "query") { return res.json({}); }

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
      messages: [{ role: "user", content: latestMessage }],
      stream: false
    };

    const baseURL = process.env.NEOAI_BASE_URL;

    // --- ▼▼▼ 最終デバッグコード ▼▼▼ ---
    console.log('--- URL Forensic Analysis ---');
    if (baseURL) {
      console.log('取得したURL文字列:', `>${baseURL}<`); // 記号で囲んで、前後の空白や改行を可視化
      console.log('文字列の長さ:', baseURL.length);
      console.log('最初の文字のコード番号:', baseURL.charCodeAt(0));
      console.log('最後の文字のコード番号:', baseURL.charCodeAt(baseURL.length - 1));
    } else {
      console.log('NEOAI_BASE_URLがundefinedです。');
    }
    console.log('---------------------------');
    // --- ▲▲▲ ここまで ▲▲▲ ---

    const finalURL = baseURL.trim();
    const neoAIResponse = await axios.post(`${finalURL}/chat/completions`, body, { headers });

    const aiResponse = JSON.parse(neoAIResponse.data.content);
    
    // ... (以降のkintone処理は変更なし)
    if (aiResponse.action === "getRecords" || aiResponse.action === "addRecord") { /* ... */ }
    else if (aiResponse.action === "clarify") { /* ... */ }

  } catch (error) {
    console.error("!!! An error occurred !!!", error.message);
  } finally {
    sendPoeEvent(res, { type: "done" });
    res.end();
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Final kintone AI server is running on port ${PORT}`);
});
