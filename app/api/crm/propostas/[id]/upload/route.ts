import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { writeFile, mkdir } from 'fs/promises';
import { join } from 'path';
import { existsSync } from 'fs';

export async function POST(request: Request, props: { params: Promise<{ id: string }> }) {
  try {
    const params = await props.params;
    const tenantId = request.headers.get('x-tenant-id');
    if (!tenantId) {
      return NextResponse.json({ error: 'Tenant ID is required' }, { status: 400 });
    }

    const data = await request.formData();
    const file: File | null = data.get('file') as unknown as File;

    if (!file) {
      return NextResponse.json({ error: 'No file uploaded' }, { status: 400 });
    }

    const bytes = await file.arrayBuffer();
    const buffer = Buffer.from(bytes);

    // Save to public/uploads
    const uploadDir = join(process.cwd(), 'public', 'uploads', tenantId);
    
    if (!existsSync(uploadDir)) {
      await mkdir(uploadDir, { recursive: true });
    }

    const filename = `nf_${params.id}_${Date.now()}.pdf`;
    const filepath = join(uploadDir, filename);

    await writeFile(filepath, buffer);

    const fileUrl = `/uploads/${tenantId}/${filename}`;

    const propostaAtualizada = await prisma.proposta.update({
      where: {
        id: params.id,
        tenantId,
      },
      data: {
        nfUrl: fileUrl,
      },
    });

    return NextResponse.json(propostaAtualizada);
  } catch (error) {
    console.error('Error uploading file:', error);
    return NextResponse.json({ error: 'Failed to upload file' }, { status: 500 });
  }
}
