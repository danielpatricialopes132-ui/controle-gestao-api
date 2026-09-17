import { NextResponse } from 'next/server';
import { verifyIdToken } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

export async function GET(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const decodedToken = await verifyIdToken(request);
    
    // Obtém o usuário para descobrir o tenantId principal
    const usuario = await prisma.usuario.findUnique({
      where: { firebaseUid: decodedToken.uid },
    });

    if (!usuario) {
      return NextResponse.json({ success: false, error: 'Usuário não encontrado no banco' }, { status: 404 });
    }

    // Lógica Master/Tenant
    let targetTenantId = decodedToken.tenantId;

    const { id: obraId } = params;

    // Verificar se a obra existe e pertence ao tenant
    const obra = await prisma.obra.findFirst({
      where: { id: obraId, tenantId: targetTenantId },
      include: {
        contrato: {
          include: {
            adendos: true,
          }
        },
        transacoes: true,
      }
    });

    if (!obra) {
      return NextResponse.json({ success: false, error: 'Obra não encontrada' }, { status: 404 });
    }

    // Calcula os totais
    let valorContratoPrincipal = obra.contrato?.valor.toNumber() ?? 0;
    let valorAdendos = obra.contrato?.adendos.reduce((acc: number, curr: any) => acc + curr.valor.toNumber(), 0) ?? 0;
    let totalReceitas = valorContratoPrincipal + valorAdendos; // O que a empresa tem a receber

    let despesasPagas = 0;
    let despesasPendentes = 0;

    // Transações financeiras (fornecedores, materiais, etc)
    for (const tx of obra.transacoes) {
      if (tx.tipo === 'DESPESA') {
        if (tx.status === 'PAGO') {
          despesasPagas += tx.valor.toNumber();
        } else if (tx.status === 'PENDENTE') {
          despesasPendentes += tx.valor.toNumber();
        }
      }
    }

    // Calcula gastos com salários/diárias de motoristas (aproximação via RegistroPresenca)
    // Para simplificar no dashboard inicial, somaremos isso como uma despesa separada
    const presencas = await prisma.registroPresenca.findMany({
      where: { obraId, tenantId: targetTenantId, status: { in: ['PRESENTE', 'MEIO_DIA'] } },
      include: { funcionario: true }
    });

    let custoMaoDeObra = 0;
    for (const p of presencas) {
      if (p.funcionario.valorDiariaMotorista) {
        let fator = p.status === 'PRESENTE' ? 1 : 0.5;
        custoMaoDeObra += p.funcionario.valorDiariaMotorista.toNumber() * fator;
      }
    }

    despesasPagas += custoMaoDeObra; // Assumindo que a mão de obra diária é custo real

    const lucroPresumido = totalReceitas - (despesasPagas + despesasPendentes);

    return NextResponse.json({
      success: true,
      data: {
        obra: {
          id: obra.id,
          nome: obra.nome,
          status: obra.status,
        },
        dashboard: {
          receitas: {
            contratoPrincipal: valorContratoPrincipal,
            adendos: valorAdendos,
            total: totalReceitas,
          },
          despesas: {
            pagas: despesasPagas,
            pendentes: despesasPendentes,
            maoDeObra: custoMaoDeObra,
            total: despesasPagas + despesasPendentes,
          },
          lucroPresumido,
        }
      }
    });

  } catch (error) {
    console.error('Erro em GET /api/obras/[id]/dashboard:', error);
    return NextResponse.json({ success: false, error: 'Erro interno' }, { status: 500 });
  }
}
