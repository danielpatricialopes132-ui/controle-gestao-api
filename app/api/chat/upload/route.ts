import { NextResponse } from "next/server";
import { verifyIdToken, uploadToStorage } from "@/lib/auth";

export async function POST(request: Request) {
  try {
    const auth = await verifyIdToken(request);
    if (!auth) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });

    const body = await request.json();
    const { base64, mimeType, nomeArquivo, tipo = "IMAGEM" } = body;

    if (!base64 || !mimeType) {
      return NextResponse.json({ error: "Arquivo ou tipo MIME ausente" }, { status: 400 });
    }

    const timestamp = Date.now();
    const extensao = nomeArquivo?.split(".").pop() || (tipo === "IMAGEM" ? "jpg" : "bin");
    const path = `chat/${auth.tenantId}/${timestamp}_${Math.random().toString(36).substring(2, 8)}.${extensao}`;

    const url = await uploadToStorage(base64, path, mimeType);

    return NextResponse.json({
      url,
      tipo,
      nomeArquivo: nomeArquivo || `anexo_${timestamp}.${extensao}`,
    });
  } catch (error: any) {
    console.error("Erro no upload do chat:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
