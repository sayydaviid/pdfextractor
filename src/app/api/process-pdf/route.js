// src/app/api/process-pdf/route.js

import { GoogleGenerativeAI } from "@google/generative-ai";
import { NextResponse } from "next/server";
import { createHash } from "crypto";
import Redis from "ioredis";

export const runtime = "nodejs";

// ---------- Redis client (com fallback em memória) ----------
function buildRedis() {
  try {
    if (process.env.REDIS_URL) {
      return new Redis(process.env.REDIS_URL, {
        maxRetriesPerRequest: 2,
        enableReadyCheck: true,
        lazyConnect: true,
      });
    }
    if (process.env.REDIS_HOST && process.env.REDIS_PORT) {
      return new Redis({
        host: process.env.REDIS_HOST,
        port: Number(process.env.REDIS_PORT),
        password: process.env.REDIS_PASSWORD || undefined,
        maxRetriesPerRequest: 2,
        enableReadyCheck: true,
        lazyConnect: true,
      });
    }
  } catch (e) {
    console.warn("[process-pdf] Não foi possível criar o cliente Redis:", e?.message);
  }
  return null;
}

// singleton simples em dev
if (!globalThis.__REDIS__) {
  globalThis.__REDIS__ = buildRedis();
}
const redis = globalThis.__REDIS__;

if (!globalThis.__DEV_CACHE__) globalThis.__DEV_CACHE__ = new Map();
const mem = globalThis.__DEV_CACHE__;

async function cacheGet(key) {
  if (redis) {
    try {
      if (!redis.status || redis.status === "end") await redis.connect();
      const val = await redis.get(key);
      return val ? JSON.parse(val) : null;
    } catch (e) {
      console.warn("[process-pdf] Falha ao ler do Redis:", e?.message);
    }
  }
  return mem.get(key) ?? null;
}

async function cacheSet(key, value, { ex } = {}) {
  if (redis) {
    try {
      if (!redis.status || redis.status === "end") await redis.connect();
      if (ex && ex > 0) {
        await redis.set(key, JSON.stringify(value), "EX", ex);
      } else {
        await redis.set(key, JSON.stringify(value));
      }
      return;
    } catch (e) {
      console.warn("[process-pdf] Falha ao gravar no Redis:", e?.message);
    }
  }
  mem.set(key, value);
  if (ex && ex > 0) {
    setTimeout(() => mem.delete(key), ex * 1000).unref?.();
  }
}

// ---------- Util: extrair apenas o array JSON da saída LLM ----------
function extractJSONArray(s) {
  let text = String(s).trim();
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (fenced) text = fenced[1].trim();
  const first = text.indexOf("[");
  const last = text.lastIndexOf("]");
  if (first !== -1 && last !== -1 && last > first) {
    text = text.slice(first, last + 1);
  }
  return text.replace(/,\s*}/g, "}").replace(/,\s*]/g, "]");
}

export async function POST(request) {
  try {
    const { blobUrl, fileName: rawFileName, hash: incomingHash } = await request.json();
    const fileName = rawFileName || (blobUrl ? blobUrl.split("/").pop() : "arquivo");

    let fileHash = incomingHash ?? null;
    let buffer;

    // Upload novo → baixa do Blob e calcula hash
    if (blobUrl) {
      console.log(`[process-pdf] Baixando do Blob: ${blobUrl}`);
      const resp = await fetch(blobUrl);
      if (!resp.ok) throw new Error(`Falha ao baixar o Blob: ${resp.status} ${resp.statusText}`);
      const ab = await resp.arrayBuffer();
      buffer = Buffer.from(ab);
      fileHash = createHash("sha256").update(buffer).digest("hex"); // ✅ sha256
    }

    if (!fileHash) {
      return NextResponse.json(
        { error: "Nenhum arquivo ou hash foi enviado." },
        { status: 400 }
      );
    }

    console.log(`[process-pdf] Hash: ${fileHash}`);

    // ---------- CACHE ----------
    const cached = await cacheGet(fileHash);
    if (cached) {
      console.log("[process-pdf] CACHE HIT");
      return NextResponse.json({
        rows: cached,
        fromCache: true,
        hash: fileHash,
        fileName,
      });
    }

    if (!buffer) {
      // clicou em "recente" mas o cache expirou e não temos o arquivo
      return NextResponse.json(
        { error: "Cache não encontrado para este arquivo. Por favor, faça o upload novamente." },
        { status: 404 }
      );
    }

    console.log("[process-pdf] CACHE MISS — chamando Gemini");

    // ---------- Gemini ----------
    if (!process.env.GOOGLE_API_KEY) {
      throw new Error("GOOGLE_API_KEY não configurada no ambiente.");
    }

    const filePart = {
      inlineData: {
        data: buffer.toString("base64"),
        mimeType: "application/pdf",
      },
    };

    const prompt = `
Analise o documento PDF fornecido, que é um relatório de avaliação.
O nome do arquivo original é: ${fileName}.
Sua tarefa é extrair os dados estruturados de dimensões e itens.

Instruções de parsing:
- Linhas que começam com "Dimensão X:" definem uma nova seção.
  * Extraia: número da dimensão (X), TÍTULO COMPLETO da dimensão, e a nota média (dimension_mean).
- As linhas seguintes contêm itens com códigos como "1.1.".
  * Para cada item: extraia o código (item_code), o texto descritivo completo (item_text) e a nota (item_score).
- Para as linhas de "Dimensão", os campos de item devem ser null.

Retorne EXCLUSIVAMENTE um ARRAY JSON válido, sem comentários, sem markdown, sem texto fora do JSON.
Cada objeto deve seguir exatamente esta estrutura:
{
  "pdf": "${fileName}",
  "dimension_number": 1,
  "dimension_title": "TÍTULO DA DIMENSÃO",
  "dimension_mean": 4.5,
  "item_code": "1.1",
  "item_text": "TEXTO DO ITEM.",
  "item_score": 5.0
}
`;

    const genAI = new GoogleGenerativeAI(process.env.GOOGLE_API_KEY);
    const model = genAI.getGenerativeModel({ model: "gemini-2.5-pro" });

    const maxRetries = 3;
    let delay = 2000;

    for (let attempt = 0; attempt < maxRetries; attempt++) {
      try {
        const result = await model.generateContent([prompt, filePart]);
        const resp = await result.response;
        const rawText = resp.text() ?? "";

        const jsonText = extractJSONArray(rawText);
        const data = JSON.parse(jsonText);
        if (!Array.isArray(data)) throw new Error("A resposta do modelo não é um array JSON.");

        // grava cache (2 dias)
        await cacheSet(fileHash, data, { ex: 2 * 24 * 60 * 60 });
        console.log("[process-pdf] Resultado cacheado por 2 dias.", redis ? "(Redis)" : "(memória)");

        return NextResponse.json({
          rows: data,
          fromCache: false,
          hash: fileHash,
          fileName,
        });
      } catch (err) {
        const status = err?.status ?? err?.response?.status;
        const isOverloaded = status === 503;
        if (isOverloaded && attempt < maxRetries - 1) {
          console.warn(`[process-pdf] 503 do Gemini, retry em ${delay}ms...`);
          await new Promise((r) => setTimeout(r, delay));
          delay *= 2;
          continue;
        }
        throw err;
      }
    }
  } catch (error) {
    console.error("Erro na API Route do Gemini:", error);
    const status = error?.status ?? error?.response?.status;
    const errorMessage =
      status === 503
        ? "A API do Google está sobrecarregada. Tente novamente mais tarde."
        : (error?.message?.includes("GOOGLE_API_KEY")
            ? "GOOGLE_API_KEY não configurada no ambiente."
            : "Falha ao processar o PDF com a IA.");

    return NextResponse.json({ error: errorMessage }, { status: 500 });
  }
}
