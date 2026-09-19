import { NextResponse } from "next/server";
import { verifyIdToken } from '@/lib/auth';
import prisma from "@/lib/prisma";

export async function POST(request: Request) {
  try {
    const auth = await verifyIdToken(request);
    if (!auth) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });

    const body = await request.json();
    const { token } = body;

    if (!token) {
      return NextResponse.json({ error: "Token não fornecido" }, { status: 400 });
    }

    const userId = auth.uid;
    const user = await prisma.usuario.findUnique({ where: { firebaseUid: userId } });

    if (!user) {
      return NextResponse.json({ error: "Usuário não encontrado" }, { status: 404 });
    }

    const tokens = user.fcmTokens || [];
    if (!tokens.includes(token)) {
      await prisma.usuario.update({
        where: { id: user.id },
        data: {
          fcmTokens: {
            push: token,
          },
        },
      });
    }

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error("Erro ao salvar fcm-token:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
