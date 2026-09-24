import { NextResponse } from 'next/server';
import { verifyIdToken } from '@/lib/auth';
import { createClient } from '@supabase/supabase-js';

function getSupabase() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';
  
  if (!supabaseUrl || !supabaseKey) {
    throw new Error('Supabase credentials are not set');
  }

  return createClient(supabaseUrl, supabaseKey);
}

export async function POST(request: Request) {
  try {
    const userAuth = await verifyIdToken(request);
    if (!userAuth) {
      return NextResponse.json({ error: 'Não autorizado' }, { status: 403 });
    }

    const tenantId = userAuth.tenantId;
    const body = await request.json();
    const { base64, mimeType, fileName } = body;

    if (!base64) {
      return NextResponse.json({ error: 'Faltam dados do arquivo' }, { status: 400 });
    }

    const buffer = Buffer.from(base64, 'base64');
    
    // Extensão baseada no mimeType
    let ext = 'bin';
    if (mimeType.includes('jpeg') || mimeType.includes('jpg')) ext = 'jpg';
    else if (mimeType.includes('png')) ext = 'png';
    else if (mimeType.includes('pdf')) ext = 'pdf';
    else if (mimeType.includes('webp')) ext = 'webp';

    const safeName = fileName ? fileName.replace(/[^a-zA-Z0-9.-]/g, '_') : 'comprovante';
    const path = `${tenantId}/${Date.now()}_${safeName}.${ext}`;

    const supabase = getSupabase();

    const { data, error } = await supabase
      .storage
      .from('comprovantes')
      .upload(path, buffer, {
        contentType: mimeType,
        upsert: false
      });

    if (error) {
      console.error('Erro no upload do supabase:', error);
      return NextResponse.json({ error: 'Erro ao fazer upload: ' + error.message }, { status: 500 });
    }

    const { data: publicUrlData } = supabase.storage.from('comprovantes').getPublicUrl(path);

    return NextResponse.json({ success: true, url: publicUrlData.publicUrl });
  } catch (error: any) {
    console.error('Erro no upload:', error);
    return NextResponse.json({ error: 'Erro interno no servidor' }, { status: 500 });
  }
}


export async function OPTIONS(request: Request) {
  return new Response(null, {
    status: 200,
    headers: {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, PATCH, OPTIONS",
      "Access-Control-Allow-Headers": "*",
    },
  });
}
