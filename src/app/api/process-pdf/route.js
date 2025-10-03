// src/app/api/process-pdf/route.js

import { GoogleGenerativeAI } from "@google/generative-ai";
import { NextResponse } from "next/server";
import { kv } from "@vercel/kv";
import { createHash } from "crypto";

// Função para converter o stream do arquivo em um buffer
async function streamToBuffer(stream) {
  const chunks = [];
  for await (const chunk of stream) {
    chunks.push(chunk);
  }
  return Buffer.concat(chunks);
}

export async function POST(request) {
  try {
    // 1. Recebe o arquivo enviado pelo frontend
    const formData = await request.formData();
    const file = formData.get("file");

    if (!file) {
      return NextResponse.json({ error: "Nenhum arquivo enviado." }, { status: 400 });
    }

    const buffer = await streamToBuffer(file.stream());

    // --- LÓGICA DE CACHE ADICIONADA ---
    // Calcula um hash único para o conteúdo do arquivo
    const fileHash = createHash('sha256').update(buffer).digest('hex');
    console.log(`Hash do arquivo: ${fileHash}`);

    // Verifica se o resultado já existe no Vercel KV
    const cachedResult = await kv.get(fileHash);
    if (cachedResult) {
      console.log("CACHE HIT! Retornando dados salvos.");
      return NextResponse.json({ rows: cachedResult, fromCache: true, hash: fileHash, fileName: file.name });
    }
    console.log("CACHE MISS! Chamando a API do Gemini.");
    // --- FIM DA LÓGICA DE CACHE ---


    // Converte o arquivo para o formato que a API do Gemini entende
    const filePart = {
      inlineData: {
        data: buffer.toString("base64"),
        mimeType: file.type,
      },
    };

    const genAI = new GoogleGenerativeAI(process.env.GOOGLE_API_KEY);
    
    // Corrigido para o nome de modelo válido e mais poderoso que sabemos que funciona
    const model = genAI.getGenerativeModel({ model: "gemini-2.5-pro" });

    const prompt = `
      Analise o documento PDF fornecido, que é um relatório de avaliação.
      Sua tarefa é extrair os dados estruturados de dimensões e itens.
      O formato é:
      - Linhas que começam com "Dimensão X:" definem uma nova seção. Extraia o número da dimensão, o título completo e a nota média que aparece no final da linha.
      - As linhas seguintes contêm itens, identificados por códigos numéricos como "1.1.", "2.5.", "3.12.". Para cada item, extraia o código, o texto descritivo completo e a nota no final da linha.
      - Ignore qualquer outro texto introdutório, cabeçalhos, rodapés ou informações que não se encaixem neste formato.
      - O nome do arquivo original é: ${file.name}.

      Retorne o resultado EXCLUSIVAMENTE como um array de objetos JSON válido, sem nenhum texto, comentários ou formatação extra (como \`\`\`json).
      A estrutura de cada objeto no array deve ser:
      {
        "pdf": "${file.name}",
        "dimension_number": 1,
        "dimension_title": "O TÍTULO DA DIMENSÃO",
        "dimension_mean": 4.5,
        "item_code": "1.1",
        "item_text": "O TEXTO COMPLETO DO ITEM.",
        "item_score": 5.0
      }
      Para as linhas que representam a Dimensão em si, os campos "item_code", "item_text" e "item_score" devem ser 'null'.
    `;

    // --- Início da Lógica de Retentativa (Retry) Adicionada ---
    const maxRetries = 3;
    let delay = 2000;

    for (let i = 0; i < maxRetries; i++) {
      try {
        console.log(`Tentativa ${i + 1} de chamar a API do Gemini...`);
        const result = await model.generateContent([prompt, filePart]);
        const response = await result.response;
        const text = response.text();

        let cleanedText = text.trim();
        if (cleanedText.startsWith("```json")) {
          cleanedText = cleanedText.substring(7);
        }
        if (cleanedText.endsWith("```")) {
          cleanedText = cleanedText.substring(0, cleanedText.length - 3);
        }

        const data = JSON.parse(cleanedText);
        
        // --- ADICIONADO: Salvando o novo resultado no cache ---
        const twoDaysInSeconds = 2 * 24 * 60 * 60;
        await kv.set(fileHash, data, { ex: twoDaysInSeconds });
        console.log(`Resultado salvo no cache por 2 dias. Chave: ${fileHash}`);

        console.log("Sucesso na chamada da API!");
        return NextResponse.json({ rows: data, fromCache: false, hash: fileHash, fileName: file.name });
      
      } catch (error) {
        if (error.status === 503 && i < maxRetries - 1) {
          console.warn(`API sobrecarregada (503). Tentativa ${i + 1} falhou. Tentando novamente em ${delay / 1000}s...`);
          await new Promise(resolve => setTimeout(resolve, delay));
          delay *= 2; 
        } else {
          throw error;
        }
      }
    }
    // --- Fim da Lógica de Retentativa ---

  } catch (error) {
    console.error("Erro na API Route do Gemini após todas as tentativas:", error);
    const errorMessage = error.status === 503 
      ? "A API do Google está sobrecarregada no momento. Por favor, tente novamente mais tarde."
      : "Falha ao processar o PDF com a IA.";
      
    return NextResponse.json({ error: errorMessage }, { status: 500 });
  }
}