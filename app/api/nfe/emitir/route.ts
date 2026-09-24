import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { verifyIdToken } from "@/lib/auth";

export async function POST(req: Request) {
  try {
    const auth = await verifyIdToken(req);
    if (!auth) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { obraId, clienteId, valor } = await req.json();

    const novaNfe = await prisma.notaFiscal.create({
      data: {
        obraId,
        clienteId,
        valor,
        tenantId: auth.tenantId,
        status: 'PROCESSANDO'
      }
    });

    // Simulando a integração com a Prefeitura de São Paulo - SP
    setTimeout(async () => {
      await prisma.notaFiscal.update({
        where: { id: novaNfe.id },
        data: {
          status: 'AUTORIZADA',
          numero: Math.floor(Math.random() * 100000).toString(),
          xmlUrl: 'https://example.com/mock-nfe.xml',
          pdfUrl: 'https://example.com/mock-nfe.pdf'
        }
      });
    }, 2000);

    return NextResponse.json({ success: true, notaFiscal: novaNfe, message: 'Nota fiscal enviada para processamento. Cidade simulada: São Paulo - SP' });
  } catch (error: any) {
    console.error(error);
    return NextResponse.json({ error: error.message }, { status: 500 });
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
