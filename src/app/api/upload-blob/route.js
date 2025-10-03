// src/app/api/upload-blob/route.js
import { handleUpload } from '@vercel/blob/client';
import { NextResponse } from 'next/server';

// Garante acesso a process.env
export const runtime = 'nodejs';

export async function POST(request) {
  const body = await request.json();

  try {
    const json = await handleUpload({
      request,
      body,
      // Usa o token no server (necessário em dev)
      token: process.env.BLOB_READ_WRITE_TOKEN,

      onBeforeGenerateToken: async () => {
        return {
          access: 'public',                // ou 'private'
          addRandomSuffix: true,
          allowedContentTypes: [
            'application/pdf',
            'image/*',
            'text/*',
          ],
          // maximumSizeInBytes: 50 * 1024 * 1024,
          // validUntil: new Date(Date.now() + 5 * 60 * 1000).toISOString(),
        };
      },

      onUploadCompleted: async ({ blob }) => {
        console.log('Upload concluído no Blob:', blob.url);
        // Persistir no banco se quiser
      },
    });

    return NextResponse.json(json);
  } catch (err) {
    console.error('Erro no handleUpload:', err);
    return NextResponse.json(
      { error: err?.message ?? 'Erro no upload' },
      { status: 400 }
    );
  }
}
