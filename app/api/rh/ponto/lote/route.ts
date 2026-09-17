import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { verifyIdToken } from "@/lib/auth";

// POST /api/rh/ponto/lote (Salvar lotes importados via WhatsApp)
export async function POST(request: Request) {
  try {
    const userAuth = await verifyIdToken(request);
    if (!userAuth || (userAuth.role !== "MASTER" && userAuth.role !== "ADMIN")) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const tenantId = userAuth.tenantId;
    const { obraId, dias } = await request.json();

    if (!obraId || !dias || !Array.isArray(dias)) {
      return NextResponse.json({ error: "Payload inválido" }, { status: 400 });
    }

    for (const dia of dias) {
      const { dataStr, entries } = dia;
      const dataObj = new Date(dataStr);

      // Deleta todos os pontos daquele dia/obra
      await prisma.registroPresenca.deleteMany({
        where: {
          tenantId,
          obraId,
          data: dataObj,
        },
      });

      const validEntries = entries.filter((r: any) => r.status !== "NA" && r.tipoDia !== "NA");

      if (validEntries.length > 0) {
        const dataToInsert = validEntries.map((r: any) => ({
          tenantId,
          obraId,
          funcionarioId: r.funcionarioId,
          data: dataObj,
          status: r.status || r.tipoDia, // suporta tanto .status quanto .tipoDia
          horasTrabalhadas: r.horasTrabalhadas || 8,
          percentualPago: r.percentualPago || 100,
          observacao: r.observacoes || "",
          statusAprovacao: "APROVADO", // Se foi importado pelo admin, já está aprovado
        }));

        await prisma.registroPresenca.createMany({
          data: dataToInsert,
        });
      }
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Erro no POST Lote Ponto:", error);
    return NextResponse.json({ error: "Erro interno" }, { status: 500 });
  }
}
