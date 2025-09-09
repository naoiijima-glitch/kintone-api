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
      messages: [{ role: "user", content: latestMessage }],
      stream: false
    };

    // --- ▼▼▼ ここが最後の修正点 ▼▼▼ ---
    // URLの前後に隠れている可能性のある空白や改行を .trim() で強制的に削除する
    const baseURL = process.env.NEOAI_BASE_URL.trim();
    const neoAIResponse = await axios.post(`${baseURL}/chat/completions`, body, { headers });
    // --- ▲▲▲ ここまで ▲▲▲ ---

    const aiResponse = JSON.parse(neoAIResponse.data.content);
    
    if (aiResponse.action === "getRecords" || aiResponse.action === "addRecord") {
      sendPoeEvent(res, { type: "text", text: "kintoneと通信しています..." });
      
      const client = new KintoneRestAPIClient({
        baseUrl: process.env.KINTONE_BASE_URL.trim(), // こちらも念のためtrim()
        auth: { apiToken: process.env.KINTONE_API_TOKEN },
      });

      let kintoneResultText = "";
      if (aiResponse.action === "getRecords") {
        const resp = await client.record.getRecords(aiResponse.params);
        kintoneResultText = `レコードが${resp.records.length}件見つかりました。\n`;
        resp.records.forEach(r => {
          // 項目名はあなたのアプリに合わせて変更してください
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

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Final kintone AI server is running on port ${PORT}`);
});
