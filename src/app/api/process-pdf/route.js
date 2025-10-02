// src/app/api/process-pdf/route.js

import { GoogleGenerativeAI } from "@google/generative-ai";
import { NextResponse } from "next/server";

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

    // 2. Converte o arquivo para o formato que a API do Gemini entende
    const buffer = await streamToBuffer(file.stream());
    const filePart = {
      inlineData: {
        data: buffer.toString("base64"),
        mimeType: file.type,
      },
    };

    const genAI = new GoogleGenerativeAI(process.env.GOOGLE_API_KEY);
    
    // Corrigido para o nome de modelo válido e mais poderoso
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

    // --- Início da Lógica de Retentativa (Retry) ---

    const maxRetries = 3; // Tenta no máximo 3 vezes
    let delay = 2000; // Começa com um atraso de 2 segundos

    for (let i = 0; i < maxRetries; i++) {
      try {
        console.log(`Tentativa ${i + 1} de chamar a API do Gemini...`);
        // Envia o prompt e o arquivo para o modelo
        const result = await model.generateContent([prompt, filePart]);
        const response = await result.response;
        const text = response.text();

        // --- CORREÇÃO DE SINTAXE AQUI ---
        // Reescrevemos a limpeza do texto para evitar erros de parsing da expressão regular.
        let cleanedText = text.trim();
        if (cleanedText.startsWith("```json")) {
          cleanedText = cleanedText.substring(7);
        }
        if (cleanedText.endsWith("```")) {
          cleanedText = cleanedText.substring(0, cleanedText.length - 3);
        }
        // --- FIM DA CORREÇÃO ---

        const data = JSON.parse(cleanedText);

        // Se a chamada foi bem-sucedida, retorna o resultado e sai da função
        console.log("Sucesso na chamada da API!");
        return NextResponse.json({ rows: data });
      
      } catch (error) {
        // Verifica se o erro é o 503 (sobrecarregado) e se ainda não é a última tentativa
        if (error.status === 503 && i < maxRetries - 1) {
          console.warn(`API sobrecarregada (503). Tentativa ${i + 1} falhou. Tentando novamente em ${delay / 1000}s...`);
          // Espera o tempo de delay
          await new Promise(resolve => setTimeout(resolve, delay));
          // Aumenta o delay para a próxima tentativa (backoff exponencial)
          delay *= 2; 
        } else {
          // Se for outro erro ou a última tentativa, joga o erro para ser pego pelo catch principal
          throw error;
        }
      }
    }
    // --- Fim da Lógica de Retentativa ---

  } catch (error) {
    console.error("Erro na API Route do Gemini após todas as tentativas:", error);
    // Retorna uma mensagem de erro mais específica para o frontend
    const errorMessage = error.status === 503 
      ? "A API do Google está sobrecarregada no momento. Por favor, tente novamente mais tarde."
      : "Falha ao processar o PDF com a IA.";
      
    return NextResponse.json({ error: errorMessage }, { status: 500 });
  }
}