import fetch from "node-fetch";
import { google } from "googleapis";

const TELEGRAM_TOKEN = process.env.TELEGRAM_TOKEN;
const GROQ_API_KEY = process.env.GROQ_API_KEY;
const SHEET_ID = process.env.SHEET_ID;

export default async function handler(req, res) {

  if (req.method !== "POST") {
    return res.status(200).send("OK");
  }

  const data = req.body;

  if (!data.message || !data.message.text) {
    return res.status(200).send("OK");
  }

  const chatId = data.message.chat.id;
  const texto = data.message.text;

  try {

    const interpretacao = await interpretarComGroq(texto);

    if (interpretacao) {
      await salvarNaPlanilha(interpretacao);
      await enviarMensagem(chatId, "Registrado ✅");
    } else {
      await enviarMensagem(chatId, "Não entendi 🤔");
    }

    return res.status(200).send("OK");

  } catch (err) {
    console.error(err);
    return res.status(200).send("OK");
  }
}

async function interpretarComGroq(textoUsuario) {

  const prompt = `
Extraia:
- tipo (entrada ou saida)
- valor (numero com ponto)
- forma_pagamento
- categoria
- descricao

Responda apenas JSON.
Mensagem: "${textoUsuario}"
`;

  const response = await fetch("https://api.groq.com/openai/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${GROQ_API_KEY}`
    },
    body: JSON.stringify({
      model: "llama-3.1-8b-instant",
      messages: [{ role: "user", content: prompt }],
      temperature: 0
    })
  });

  const json = await response.json();

  return JSON.parse(json.choices[0].message.content);
}

async function salvarNaPlanilha(dados) {

  const auth = new google.auth.GoogleAuth({
    credentials: JSON.parse(process.env.GOOGLE_CREDENTIALS),
    scopes: ["https://www.googleapis.com/auth/spreadsheets"]
  });

  const sheets = google.sheets({ version: "v4", auth });

  await sheets.spreadsheets.values.append({
    spreadsheetId: SHEET_ID,
    range: "A1",
    valueInputOption: "RAW",
    requestBody: {
      values: [[
        new Date().toISOString(),
        dados.tipo,
        dados.valor,
        dados.forma_pagamento,
        dados.categoria,
        dados.descricao
      ]]
    }
  });
}

async function enviarMensagem(chatId, texto) {
  await fetch(`https://api.telegram.org/bot${TELEGRAM_TOKEN}/sendMessage`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      chat_id: chatId,
      text: texto
    })
  });
}
