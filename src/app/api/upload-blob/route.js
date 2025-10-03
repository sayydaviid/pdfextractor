// src/app/api/upload-blob/route.js
import { put } from '@vercel/blob';
import { NextResponse } from 'next/server';

export async function POST(request) {
  // A requisição agora espera um nome de arquivo, não o arquivo inteiro
  const { filename } = await request.json();

  try {
    // Gera uma URL segura e temporária para o cliente fazer o upload
    const blob = await put(filename, {
      access: 'public',
    });

    // Retorna os dados do blob (incluindo a URL de upload) para o cliente
    return NextResponse.json(blob);
  } catch (error) {
    console.error("Erro ao gerar URL de upload:", error);
    return NextResponse.json({ error: 'Falha ao preparar o upload para o Blob.' }, { status: 500 });
  }
}