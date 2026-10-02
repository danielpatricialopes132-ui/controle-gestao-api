import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import crypto from "crypto";

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const token = searchParams.get("token");

    if (!token) {
      return NextResponse.json({ success: false, error: "Token não fornecido." }, { status: 400 });
    }

    const doc = await prisma.assinaturaEletronicaContrato.findUnique({
      where: { tokenAssinatura: token },
      include: {
        tenant: { select: { nome: true, logoUrl: true } },
      },
    });

    if (!doc) {
      return NextResponse.json({ success: false, error: "Documento para assinatura não encontrado." }, { status: 404 });
    }

    return NextResponse.json({
      success: true,
      data: {
        id: doc.id,
        tituloDocumento: doc.tituloDocumento,
        tipoContrato: doc.tipoContrato,
        nomeSignatario: doc.nomeSignatario,
        cpfCnpjSignatario: doc.cpfCnpjSignatario,
        status: doc.status,
        dataAssinatura: doc.dataAssinatura,
        empresaNome: doc.tenant.nome,
        empresaLogo: doc.tenant.logoUrl,
        criadoEm: doc.criadoEm,
      },
    });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { token, codigoOtp, assinaturaBase64, geolocalizacao } = body;

    if (!token || !assinaturaBase64) {
      return NextResponse.json(
        { success: false, error: "Token e rubrica/assinatura gráfica são obrigatórios." },
        { status: 400 }
      );
    }

    const doc = await prisma.assinaturaEletronicaContrato.findUnique({
      where: { tokenAssinatura: token },
    });

    if (!doc) {
      return NextResponse.json({ success: false, error: "Documento não encontrado." }, { status: 404 });
    }

    if (doc.status === "ASSINADO") {
      return NextResponse.json({ success: false, error: "Este documento já foi assinado anteriormente." }, { status: 400 });
    }

    // Se o documento tiver OTP configurado, valida o código digitado
    if (doc.codigoOtp && codigoOtp) {
      if (doc.codigoOtp.trim() !== codigoOtp.trim()) {
        return NextResponse.json({ success: false, error: "Código de confirmação (OTP) inválido." }, { status: 400 });
      }
    }

    // Captura metadados de IP e User-Agent para validade jurídica (Lei 14.063/2020)
    const forwarded = request.headers.get("x-forwarded-for");
    const ip = forwarded ? forwarded.split(",")[0] : "127.0.0.1";
    const userAgent = request.headers.get("user-agent") || "Navegador Web/Mobile";

    const agora = new Date();
    // Gera hash criptográfico SHA-256 da assinatura e dados do signatário
    const hashString = `${doc.id}:${doc.nomeSignatario}:${doc.cpfCnpjSignatario}:${agora.toISOString()}:${ip}`;
    const hashSha256 = crypto.createHash("sha256").update(hashString).digest("hex");

    const assinado = await prisma.assinaturaEletronicaContrato.update({
      where: { id: doc.id },
      data: {
        status: "ASSINADO",
        assinaturaBase64,
        ipAssinatura: ip,
        userAgent,
        geolocalizacao: geolocalizacao || null,
        dataAssinatura: agora,
        hashSha256,
      },
    });

    // Se for contrato de empreiteiro, atualiza status do contrato
    if (doc.tipoContrato === "EMPREITEIRO") {
      await prisma.contratoEmpreiteiro.updateMany({
        where: { id: doc.referenciaId },
        data: { status: "ATIVO" },
      });
    }

    return NextResponse.json({
      success: true,
      mensagem: "Documento assinado eletronicamente com sucesso e validade jurídica!",
      data: {
        id: assinado.id,
        hashSha256: assinado.hashSha256,
        dataAssinatura: assinado.dataAssinatura,
      },
    });
  } catch (error: any) {
    console.error("Erro em POST portal/assinar-documento:", error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
