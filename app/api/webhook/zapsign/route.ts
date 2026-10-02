import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function POST(request: Request) {
  try {
    const body = await request.json();

    // A ZapSign envia o evento "doc_signed" quando o documento foi concluído e assinado
    const eventType = body?.event_type;
    const docToken = body?.doc_token || body?.token;

    if (!docToken) {
      return NextResponse.json({ received: true, ignored: "Sem token de documento" }, { status: 200 });
    }

    if (eventType === "doc_signed" || body?.status === "signed") {
      const signedFileUrl = body?.document?.signed_file || body?.signed_file;
      const dataAssinatura = new Date();

      // Atualiza registro de assinatura caso esteja no banco pelo token
      const assinaturaExistente = await prisma.assinaturaEletronicaContrato.findFirst({
        where: { tokenAssinatura: docToken },
      });

      if (assinaturaExistente) {
        await prisma.assinaturaEletronicaContrato.update({
          where: { id: assinaturaExistente.id },
          data: {
            status: "ASSINADO",
            dataAssinatura,
            hashSha256: body?.document?.original_file_hash || null,
          },
        });

        // Se a assinatura for de Contrato de Empreiteiro ou Adendo, podemos atualizar o documento
        if (assinaturaExistente.tipoContrato === "EMPREITEIRO" && signedFileUrl) {
          await prisma.contratoEmpreiteiro.updateMany({
            where: { id: assinaturaExistente.referenciaId },
            data: { documentoContratoUrl: signedFileUrl },
          }).catch(() => {});
        } else if (assinaturaExistente.tipoContrato === "ADENDO" && signedFileUrl) {
          await prisma.adendoContratoEmpreiteiro.updateMany({
            where: { id: assinaturaExistente.referenciaId },
            data: { documentoUrl: signedFileUrl },
          }).catch(() => {});
        }
      }

      console.log(`[ZapSign Webhook] Documento ${docToken} assinado com sucesso via gov.br/ZapSign.`);
    }

    // Responder com 200 rápido para a ZapSign confirmar o recebimento
    return NextResponse.json({ success: true, received: true }, { status: 200 });
  } catch (error: any) {
    console.error("[ZapSign Webhook] Erro ao processar webhook:", error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
