import { NextResponse } from 'next/server';
import { verifyIdToken } from '@/lib/auth';
import { createClient } from '@supabase/supabase-js';

function getSupabase() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';
  
  if (!supabaseUrl || !supabaseKey) {
    return null;
  }

  return createClient(supabaseUrl, supabaseKey);
}

export async function POST(request: Request) {
  try {
    const userAuth = await verifyIdToken(request);
    if (!userAuth) {
      return NextResponse.json({ error: 'Não autorizado' }, { status: 403 });
    }

    const body = await request.json();
    const { base64, mimeType = 'image/png', fileName = 'logo.png', tenantId } = body;

    if (!base64) {
      return NextResponse.json({ error: 'Faltam dados da imagem' }, { status: 400 });
    }

    const targetTenantId = (userAuth.role === 'MASTER' && tenantId) ? tenantId : userAuth.tenantId;

    let ext = 'png';
    if (mimeType.includes('jpeg') || mimeType.includes('jpg')) ext = 'jpg';
    else if (mimeType.includes('webp')) ext = 'webp';
    else if (mimeType.includes('svg')) ext = 'svg';

    const cleanBase64 = base64.replace(/^data:\w+\/\w+;base64,/, '');
    const buffer = Buffer.from(cleanBase64, 'base64');
    const path = `logos/${targetTenantId}_logo_${Date.now()}.${ext}`;

    const supabase = getSupabase();

    if (supabase) {
      try {
        const { error } = await supabase.storage
          .from('comprovantes')
          .upload(path, buffer, {
            contentType: mimeType,
            upsert: true,
          });

        if (!error) {
          const { data: publicUrlData } = supabase.storage
            .from('comprovantes')
            .getPublicUrl(path);

          return NextResponse.json({ success: true, url: publicUrlData.publicUrl });
        }
      } catch (e) {
        console.warn('Falha no upload do Supabase, usando Data URI fallback:', e);
      }
    }

    // Fallback garantido: Data URI base64
    const dataUri = `data:${mimeType};base64,${cleanBase64}`;
    return NextResponse.json({ success: true, url: dataUri });
  } catch (error: any) {
    console.error('Erro no upload de logo:', error);
    return NextResponse.json({ error: 'Erro interno no servidor: ' + error.message }, { status: 500 });
  }
}
