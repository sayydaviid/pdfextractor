// src/app/api/upload-blob/route.js
import { put } from '@vercel/blob';
import { NextResponse } from 'next/server';

export async function POST(request) {
  const { filename } = await request.json();

  try {
    const blob = await put(filename, request.body, {
      access: 'public',
    });

    return NextResponse.json(blob);
  } catch (error) {
    console.error("Erro no upload para o Blob:", error);
    return NextResponse.json({ error: 'Falha ao gerar URL de upload.' }, { status: 500 });
  }
}