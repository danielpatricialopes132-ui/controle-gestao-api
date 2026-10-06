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

    // TODO: Implementar integração real com serviço de mensageria (ex: eNotas, Focus NFe, ou prefeitura local)
    // O webhook ou job processará a aprovação e atualizará o status e URLs da NF.

    return NextResponse.json({ success: true, notaFiscal: novaNfe, message: 'Nota fiscal registrada e aguardando processamento da prefeitura.' });
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
