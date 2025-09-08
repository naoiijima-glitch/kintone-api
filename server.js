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
  // アクセスキーの検証
  const expectedKey = process.env.POE_ACCESS_KEY;
  if (expectedKey && req.headers.authorization !== `Bearer ${expectedKey}`) {
    return res.status(401).send("Unauthorized");
  }

  const request = req.body;

  // Poeからのリクエストタイプに応じて処理を分岐
  if (request.type === "settings") {
    return res.json({ allow_attachments: false });
  }

  if (request.type === "query") {
    try {
      // Poeの応答形式(SSE)のためのヘッダー設定
      res.setHeader('Content-Type', 'text/event-stream; charset=utf-8');
      res.setHeader('Cache-Control', 'no-cache');
      res.setHeader('Connection', 'keep-alive');
      res.flushHeaders();

      // 会話履歴から最新のユーザーメッセージを取得
      const latestMessage = request.query[request.query.length - 1].content;
      
      // --- ▼▼▼ ここからが変更点 ▼▼▼ ---
      // neoAI (OpenAI互換API) を呼び出し
      // neoAI側でプロンプトが設定されているため、ここではユーザーのメッセージのみを送信します。
      const completion = await openai.chat.completions.create({
        model: "GPT-4o mini", // 利用するモデル名
        messages: [
          { role: "user", content: latestMessage },
        ],
        // response_format: { type: "json_object" }, // 互換APIが対応していない場合があるのでコメントアウト
      });
      // --- ▲▲▲ ここまでが変更点 ▲▲▲ ---
      
      const aiResponse = JSON.parse(completion.choices[0].message.content);

      if (aiResponse.action === "getRecords" || aiResponse.action === "addRecord") {
        sendPoeEvent(res, { type: "text", text: "kintoneと通信しています..." });
        
        const client = new KintoneRestAPIClient({
          baseUrl: process.env.KINTONE_BASE_URL,
          auth: { apiToken: process.env.KINTONE_API_TOKEN },
        });

        let kintoneResultText = "";
        if (aiResponse.action === "getRecords") {
          const resp = await client.record.getRecords(aiResponse.params);
          kintoneResultText = `レコードが${resp.records.length}件見つかりました。`;
          // (結果の表示部分は省略)
        } else if (aiResponse.action === "addRecord") {
          const resp = await client.record.addRecord(aiResponse.params);
          kintoneResultText = `レコードを登録しました。新しいレコード番号は ${resp.id} です。`;
        }
        sendPoeEvent(res, { type: "text", text: kintoneResultText });
      } else if (aiResponse.action === "clarify") {
        sendPoeEvent(res, { type: "text", text: aiResponse.clarification });
      }

    } catch (error) {
      console.error(error);
      sendPoeEvent(res, { type: "text", text: `エラーが発生しました: ${error.message}` });
    } finally {
      sendPoeEvent(res, { type: "done" });
      res.end();
    }
  }
});

// --- サーバーの起動 ---
const PORT = process.env.PORT || 3001;
app.listen(PORT, () => {
  console.log(`Final kintone AI server is running on port ${PORT}`);
});
