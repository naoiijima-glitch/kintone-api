import "dotenv/config";
import express from "express";
import { KintoneRestAPIClient } from "@kintone/rest-api-client";
import axios from "axios";

const app = express();
app.use(express.json());

const sendPoeEvent = (res, event) => {
  res.write(`data: ${JSON.stringify(event)}\n\n`);
};

// --- すべてのリクエストを受け付ける唯一の窓口 ---
app.post('/', async (req, res) => {
  // アクセスキーの検証
  const expectedKey = process.env.POE_ACCESS_KEY;
  if (expectedKey && req.headers.authorization !== `Bearer ${expectedKey}`) {
    return res.status(401).send("Unauthorized");
  }

  const request = req.body;

  // --- リクエストの中身を見て処理を仕分ける ---
  
  // 1. settingsリクエストか、中身が不明な場合は単純な成功を返す (疎通確認用)
  if (request.type !== "query") {
    console.log("Settings or unknown request received. Replying OK.");
    return res.json({ status: "ok" });
  }

  // 2. queryリクエスト (実際の会話) の場合
  console.log("Query request received. Starting AI and kintone process...");
  try {
    // Poeのストリーミング応答のためのヘッダー設定
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

    const baseURL = process.env.NEOAI_BASE_URL.trim();
    const neoAIResponse = await axios.post(`${baseURL}/chat/completions`, body, { headers });

    const aiResponse = JSON.parse(neoAIResponse.data.content);
    
    if (aiResponse.action === "getRecords" || aiResponse.action === "addRecord") {
      sendPoeEvent(res, { type: "text", text: "kintoneと通信しています..." });
      
      const client = new KintoneRestAPIClient({
        baseUrl: process.env.KINTONE_BASE_URL.trim(),
        auth: { apiToken: process.env.KINTONE_API_TOKEN },
      });

      let kintoneResultText = "";
      if (aiResponse.action === "getRecords") {
        const resp = await client.record.getRecords(aiResponse.params);
        kintoneResultText = `レコードが${resp.records.length}件見つかりました。\n`;
        resp.records.forEach(r => {
          const companyName = r.CompanyName ? r.CompanyName.value : "取得不可";
          kintoneResultText += `\n- レコード番号: ${r.$id.value}, 会社名: ${companyName}`;
        });
      } else if (aiResponse.action === "addRecord") {
        const resp = await client.record.addRecord(aiResponse.params);
        kintoneResultText = `レコードを登録しました。新しいレコード番号は ${resp.id} です。`;
      }
      sendPoeEvent(res, { type: "text", text: kintoneResultText });

    } else if (aiResponse.action === "clarify") {
      sendPoeEvent(res, { type: "text", text: aiResponse.clarification });
    }

  } catch (error) {
    console.error("!!! An error occurred !!!", error.response ? error.response.data : error.message);
    sendPoeEvent(res, { type: "text", text: `エラーが発生しました: ${error.message}` });
  } finally {
    sendPoeEvent(res, { type: "done" });
    res.end();
  }
});

// --- サーバーの起動 ---
const PORT = process.env.PORT || 3000; // ポート番号3000
app.listen(PORT, () => {
  console.log(`Final kintone AI server is running on port ${PORT}`);
});
