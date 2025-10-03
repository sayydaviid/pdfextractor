// src/app/api/upload-blob/route.js
import { put } from '@vercel/blob';
import { NextResponse } from 'next/server';

export async function POST(request) {
  // Pega o nome do arquivo do corpo da requisição JSON
  const { filename } = await request.json();

  try {
    // A correção é aqui: removemos o 'request.body' da chamada.
    // Estamos apenas pedindo para a Vercel gerar uma URL para um arquivo com este nome.
    // O conteúdo do arquivo será enviado pelo navegador do usuário depois.
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