import "dotenv/config";
import express from "express";
import { KintoneRestAPIClient } from "@kintone/rest-api-client";
import axios from "axios";

// Expressアプリを初期化
const app = express();
console.log('起動時に読み込んだURL:', process.env.NEOAI_BASE_URL);
app.use(express.json());

// Poeの応答形式に対応するためのヘルパー関数
const sendPoeEvent = (res, event) => {
  res.write(`data: ${JSON.stringify(event)}\n\n`);
};

// メインの処理
app.post('/', async (req, res) => {
  const request = req.body;
  if (request.type !== "query") {
    // queryタイプ以外（settingsなど）のリクエストはここで処理を終了
    return res.json({});
  }

  try {
    // Poeのストリーミング応答のためのヘッダー設定
    res.setHeader('Content-Type', 'text/event-stream; charset=utf-8');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.flushHeaders();

    const latestMessage = request.query[request.query.length - 1].content;
    
    // neoAIに送信するリクエストのヘッダーとボディを定義
    const headers = {
      'Authorization': `Bearer ${process.env.NEOAI_APIKEY}`,
      'Content-type': 'application/json'
    };
    const body = {
      model: 'GPT-4o', // あなたのneoAIで利用可能なモデル名
      messages: [{ role: "user", content: latestMessage }],
      stream: false
    };

    // neoAIのAPIを呼び出す
    const neoAIResponse = await axios.post(`${process.env.NEOAI_BASE_URL}/chat/completions`, body, { headers });

    // --- ▼▼▼ ここが最後の修正点 ▼▼▼ ---
    // neoAIの応答から、'content'キーの中にあるJSON文字列を取り出して解釈する
    const aiResponse = JSON.parse(neoAIResponse.data.content);
    // --- ▲▲▲ ここまで ▲▲▲ ---

    // AIの応答に応じてkintoneを操作
    if (aiResponse.action === "getRecords" || aiResponse.action === "addRecord") {
      sendPoeEvent(res, { type: "text", text: "kintoneと通信しています..." });
      
      const client = new KintoneRestAPIClient({
        baseUrl: process.env.KINTONE_BASE_URL,
        auth: { apiToken: process.env.KINTONE_API_TOKEN },
      });

      let kintoneResultText = "";
      if (aiResponse.action === "getRecords") {
        const resp = await client.record.getRecords(aiResponse.params);
        kintoneResultText = `レコードが${resp.records.length}件見つかりました。\n`;
        // 結果を簡易的にテキスト化（必要に応じてカスタマイズしてください）
        resp.records.forEach(r => {
          kintoneResultText += `\n- レコード番号: ${r.$id.value}, 更新日時: ${r.更新日時.value}`;
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
    // エラー内容をコンソールとPoeの両方に出力
    console.error("!!! An error occurred !!!", error.response ? error.response.data : error.message);
    sendPoeEvent(res, { type: "text", text: `エラーが発生しました: ${error.message}` });
  } finally {
    // 最後に必ず「完了」イベントを送信
    sendPoeEvent(res, { type: "done" });
    res.end();
  }
});

// サーバーの起動
const PORT = process.env.PORT || 3000; // ポート番号3000
app.listen(PORT, () => {
  console.log(`Final kintone AI server is running on port ${PORT}`);
});

