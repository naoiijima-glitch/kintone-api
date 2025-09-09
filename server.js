import "dotenv/config";
import express from "express";
import { KintoneRestAPIClient } from "@kintone/rest-api-client";
import OpenAI from "openai";

// --- クライアントの初期化 ---
const app = express();
app.use(express.json());

const openai = new OpenAI({
  apiKey: process.env.NEOAI_APIKEY,
  baseURL: process.env.NEOAI_BASE_URL,
});

// --- Poeの応答形式に対応するためのヘルパー関数 ---
const sendPoeEvent = (res, event) => {
  res.write(`data: ${JSON.stringify(event)}\n\n`);
};

// --- メインの処理 ---
app.post('/', async (req, res) => {
  // (アクセスキーの検証は省略)

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
    
    // --- ▼▼▼ ここからデバッグログを追加 ▼▼▼ ---
    console.log("Step 1: Calling neoAI API...");
    const completion = await openai.chat.completions.create({
      model: "GPT-4o",
      messages: [{ role: "user", content: latestMessage }],
    });
    console.log("Step 2: neoAI response received. Parsing...");
    
    const aiResponse = JSON.parse(completion.choices[0].message.content);
    console.log("Step 3: AI response parsed. Action is:", aiResponse.action);

    if (aiResponse.action === "getRecords" || aiResponse.action === "addRecord") {
      sendPoeEvent(res, { type: "text", text: "kintoneと通信しています..." });
      
      const client = new KintoneRestAPIClient({
        baseUrl: process.env.KINTONE_BASE_URL,
        auth: { apiToken: process.env.KINTONE_API_TOKEN },
      });

      let kintoneResultText = "";
      if (aiResponse.action === "getRecords") {
        console.log("Step 4: Calling kintone getRecords API with params:", JSON.stringify(aiResponse.params));
        const resp = await client.record.getRecords(aiResponse.params);
        console.log("Step 5: kintone response received.");
        kintoneResultText = `レコードが${resp.records.length}件見つかりました。`;
      } else if (aiResponse.action === "addRecord") {
        console.log("Step 4: Calling kintone addRecord API with params:", JSON.stringify(aiResponse.params));
        const resp = await client.record.addRecord(aiResponse.params);
        console.log("Step 5: kintone response received.");
        kintoneResultText = `レコードを登録しました。新しいレコード番号は ${resp.id} です。`;
      }
      sendPoeEvent(res, { type: "text", text: kintoneResultText });

    } else if (aiResponse.action === "clarify") {
      console.log("Step 4: AI requested clarification.");
      sendPoeEvent(res, { type: "text", text: aiResponse.clarification });
    }
    // --- ▲▲▲ ここまでデバッグログを追加 ▲▲▲ ---

  } catch (error) {
    console.error("!!! An error occurred during processing !!!", error);
    sendPoeEvent(res, { type: "text", text: `エラーが発生しました: ${error.message}` });
  } finally {
    console.log("Step 6: Sending 'done' event to Poe.");
    sendPoeEvent(res, { type: "done" });
    res.end();
  }
});

// --- サーバーの起動 ---
const PORT = process.env.PORT || 3001;
app.listen(PORT, () => {
  console.log(`Final kintone AI server is running on port ${PORT}`);
});
