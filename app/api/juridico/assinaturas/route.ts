import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { verifyIdToken, registrarLog } from "@/lib/auth";
import { criarDocumentoZapSign } from "@/lib/zapsign";
import { sendWhatsAppText } from "@/lib/whatsapp";
import crypto from "crypto";

export async function GET(request: Request) {
  try {
    const userAuth = await verifyIdToken(request);
    if (!userAuth) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const tenantId = userAuth.tenantId;
    const assinaturas = await prisma.assinaturaEletronicaContrato.findMany({
      where: { tenantId },
      orderBy: { criadoEm: "desc" },
    });

    return NextResponse.json({ success: true, data: assinaturas });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const userAuth = await verifyIdToken(request);
    if (!userAuth) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const tenantId = userAuth.tenantId;
    const body = await request.json();
    const {
      contratoId,
      tipoContrato = "EMPREITEIRO",
      referenciaId = contratoId,
      tituloDocumento,
      nomeSignatario,
      cpfCnpjSignatario,
      emailSignatario,
      telefoneSignatario,
      urlPdf,
      base64Pdf,
      enviarWhatsApp = true,
      usarZapSign = true,
      exigirGovBr = true,
    } = body;

    const refId = referenciaId || contratoId;
    const titulo = tituloDocumento || `Contrato de Prestação de Serviços - ${nomeSignatario}`;

    if (!refId || !nomeSignatario) {
      return NextResponse.json(
        { success: false, error: "Campos obrigatórios: contratoId/referenciaId e nomeSignatario." },
        { status: 400 }
      );
    }

    let token = crypto.randomBytes(32).toString("hex");
    let linkAssinatura = `${process.env.NEXT_PUBLIC_APP_URL || "https://controle-gestao-ea7ad.web.app"}/assinar-contrato?token=${token}`;
    let provedor = "INTERNO";
    let zapsignDocToken: string | null = null;

    // Se tiver configurado ZapSign e foi solicitado, integra com ZapSign + gov.br
    if (usarZapSign && process.env.ZAPSIGN_API_TOKEN && (urlPdf || base64Pdf)) {
      try {
        const zapDoc = await criarDocumentoZapSign({
          nomeDocumento: titulo,
          urlPdf,
          base64Pdf,
          nomeSignatario,
          emailSignatario,
          telefoneSignatario,
          exigirGovBr,
        });

        if (zapDoc?.signers?.[0]?.sign_url) {
          linkAssinatura = zapDoc.signers[0].sign_url;
          zapsignDocToken = zapDoc.token;
          token = zapDoc.token; // Armazena token do ZapSign como chave única
          provedor = "ZAPSIGN_GOVBR";
        }
      } catch (zapErr: any) {
        console.error("Aviso: Falha ao chamar ZapSign API, usando fallback nativo:", zapErr.message);
      }
    }

    // Código OTP de 6 dígitos para rastreabilidade
    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    const otpExp = new Date();
    otpExp.setHours(otpExp.getHours() + 72); // Válido por 72 horas

    const novaAssinatura = await prisma.assinaturaEletronicaContrato.create({
      data: {
        tenantId,
        tipoContrato,
        referenciaId: refId,
        tituloDocumento: titulo,
        nomeSignatario,
        cpfCnpjSignatario: cpfCnpjSignatario || null,
        emailSignatario: emailSignatario || null,
        telefoneSignatario: telefoneSignatario || null,
        tokenAssinatura: token,
        codigoOtp: otp,
        otpExpiracao: otpExp,
        status: "PENDENTE",
      },
    });

    // Se solicitado e tiver telefone, notifica via Evolution API WhatsApp
    let whatsappNotificado = false;
    if (enviarWhatsApp && telefoneSignatario) {
      try {
        const textoMsg = `📋 *SOLICITAÇÃO DE ASSINATURA DIGITAL*\n\n` +
          `Olá, *${nomeSignatario}*!\n\n` +
          `Foi gerado um documento oficial para sua assinatura: *${titulo}*.\n\n` +
          `${provedor === "ZAPSIGN_GOVBR" ? "🏛️ *Assinatura com autenticação oficial via gov.br*.\n\n" : ""}` +
          `🔗 Acesse o link seguro para assinar pelo celular ou computador:\n${linkAssinatura}\n\n` +
          `_EcoStone Controle & Gestão_`;

        await sendWhatsAppText({
          number: telefoneSignatario,
          text: textoMsg,
        });
        whatsappNotificado = true;
      } catch (wErr: any) {
        console.error("Aviso: Erro ao enviar mensagem de assinatura no WhatsApp:", wErr.message);
      }
    }

    await registrarLog(userAuth.dbId, tenantId, "GERAR_LINK_ASSINATURA", "JURIDICO", {
      assinaturaId: novaAssinatura.id,
      documento: tituloDocumento,
      signatario: nomeSignatario,
      tipoContrato,
      provedor,
      zapsignDocToken,
      whatsappNotificado,
    });

    return NextResponse.json({
      success: true,
      data: {
        ...novaAssinatura,
        linkAssinatura,
        provedor,
        zapsignDocToken,
        whatsappNotificado,
      },
    }, { status: 201 });
  } catch (error: any) {
    console.error("Erro em POST assinaturas:", error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
