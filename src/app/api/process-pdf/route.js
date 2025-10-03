// src/app/api/process-pdf/route.js

import { GoogleGenerativeAI } from "@google/generative-ai";
import { NextResponse } from "next/server";
import { kv } from "@vercel/kv";
import { createHash } from "crypto";

export async function POST(request) {
  try {
    // 1. Recebe a URL do arquivo que foi salvo no Vercel Blob.
    const body = await request.json();
    const blobUrl = body.blobUrl;
    // Opcional: recebe o hash se foi um clique em "arquivo recente"
    const hash = body.hash; 
    let fileName = body.fileName || (blobUrl ? blobUrl.split('/').pop() : 'arquivo');

    let fileHash = hash;
    let buffer;

    // Se tivermos uma URL, significa que é um novo upload
    if (blobUrl) {
      console.log(`[LOG] Processando arquivo da URL: ${blobUrl}`);

      // 2. Baixa o arquivo da URL para a memória (buffer)
      const response = await fetch(blobUrl);
      if (!response.ok) {
        throw new Error(`Falha ao baixar o arquivo do Blob: ${response.statusText}`);
      }
      const blobData = await response.arrayBuffer();
      buffer = Buffer.from(blobData);
      
      // Calcula o hash do arquivo baixado
      fileHash = createHash('sha265').update(buffer).digest('hex');
    }

    if (!fileHash) {
       return NextResponse.json({ error: "Nenhum arquivo ou hash foi enviado." }, { status: 400 });
    }

    console.log(`[LOG] Hash do arquivo: ${fileHash}`);
    
    // 3. Verifica o cache no Vercel KV com o hash
    const cachedResult = await kv.get(fileHash);

    if (cachedResult) {
      console.log("CACHE HIT! Retornando dados salvos.");
      return NextResponse.json({ rows: cachedResult, fromCache: true, hash: fileHash, fileName: fileName });
    }

    // Se chegou aqui, é CACHE MISS. Se não tivermos o buffer (veio de um clique em 'recente' com cache expirado), dá erro.
    if (!buffer) {
       return NextResponse.json({ error: "Cache não encontrado para este arquivo. Por favor, faça o upload novamente." }, { status: 404 });
    }
    
    console.log("CACHE MISS! Chamando a API do Gemini.");
    
    // O resto da lógica do Gemini continua a mesma
    const filePart = {
      inlineData: { data: buffer.toString("base64"), mimeType: 'application/pdf' }
    };

    const genAI = new GoogleGenerativeAI(process.env.GOOGLE_API_KEY);
    const model = genAI.getGenerativeModel({ model: "gemini-2.5-pro" });

    const prompt = `
      Analise o documento PDF fornecido, que é um relatório de avaliação.
      O nome do arquivo original é: ${fileName}.
      Sua tarefa é extrair os dados estruturados de dimensões e itens.
      O formato é:
      - Linhas que começam com "Dimensão X:" definem uma nova seção. Extraia o número da dimensão, o título completo e a nota média.
      - As linhas seguintes contêm itens, identificados por códigos numéricos como "1.1.". Para cada item, extraia o código, o texto descritivo completo e a nota.
      Retorne o resultado EXCLUSIVAMENTE como um array de objetos JSON válido.
      A estrutura de cada objeto deve ser:
      {
        "pdf": "${fileName}",
        "dimension_number": 1,
        "dimension_title": "TÍTULO DA DIMENSÃO",
        "dimension_mean": 4.5,
        "item_code": "1.1",
        "item_text": "TEXTO DO ITEM.",
        "item_score": 5.0
      }
      Para as linhas de Dimensão, os campos de item devem ser 'null'.
    `;

    const maxRetries = 3;
    let delay = 2000;

    for (let i = 0; i < maxRetries; i++) {
      try {
        const result = await model.generateContent([prompt, filePart]);
        const geminiResponse = await result.response;
        const text = geminiResponse.text();

        let cleanedText = text.trim();
        if (cleanedText.startsWith("```json")) cleanedText = cleaned_text.substring(7);
        if (cleanedText.endsWith("```")) cleanedText = cleaned_text.substring(0, cleaned_text.length - 3);

        const data = JSON.parse(cleanedText);
        
        const twoDaysInSeconds = 2 * 24 * 60 * 60;
        await kv.set(fileHash, data, { ex: twoDaysInSeconds });
        console.log(`Resultado salvo no cache por 2 dias.`);
        
        return NextResponse.json({ rows: data, fromCache: false, hash: fileHash, fileName: fileName });
      
      } catch (error) {
        if (error.status === 503 && i < maxRetries - 1) {
          console.warn(`API sobrecarregada, tentando novamente...`);
          await new Promise(resolve => setTimeout(resolve, delay));
          delay *= 2; 
        } else {
          throw error;
        }
      }
    }

  } catch (error) {
    console.error("Erro na API Route do Gemini:", error);
    const errorMessage = error.status === 503 
      ? "A API do Google está sobrecarregada. Tente novamente mais tarde."
      : "Falha ao processar o PDF com a IA.";
      
    return NextResponse.json({ error: errorMessage }, { status: 500 });
  }
}