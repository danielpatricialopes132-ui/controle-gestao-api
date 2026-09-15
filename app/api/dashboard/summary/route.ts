import { NextResponse } from 'next/server';
import { verifyIdToken } from '../../../../lib/auth';
import { prisma } from '../../../../lib/prisma';

export async function GET(request: Request) {
  try {
    const authHeader = request.headers.get('authorization');
    
    // 1. Extrai o token e decodifica (garantindo que tem tenant_id ou é MASTER)
    const userAuth = await verifyIdToken(request);

    // 2. Comportamento para MASTER
    if (userAuth.role === 'MASTER') {
      const totalTenants = await prisma.tenant.count();
      const totalUsers = await prisma.usuario.count();
      
      return NextResponse.json({
        success: true,
        user: userAuth,
        data: {
          message: "Bem-vindo, Super Administrador!",
          stats: {
            totalEmpresasAtivas: totalTenants,
            totalUsuariosGlobais: totalUsers,
          }
        }
      });
    }

    // 3. Comportamento para Tenant Normal (Isolamento de Dados)
    const tenantId = userAuth.tenantId;

    // A. Busca o nome do Tenant
    const tenant = await prisma.tenant.findUnique({
      where: { id: tenantId },
      select: { nome: true }
    });

    if (!tenant) {
      return NextResponse.json({ error: 'Tenant não encontrado no banco' }, { status: 404 });
    }

    // B. Busca contadores apenas para este tenant (Garantia de Isolamento!)
    const [qtdObras, qtdClientes, qtdValesAbertos] = await Promise.all([
      prisma.obra.count({ where: { tenantId } }),
      prisma.cliente.count({ where: { tenantId } }),
      prisma.vale.count({ where: { tenantId, status: 'ABERTO' } })
    ]);

    // Retorno de Sucesso!
    return NextResponse.json({
      success: true,
      user: userAuth,
      data: {
        empresa: tenant.nome,
        stats: {
          obrasCadastradas: qtdObras,
          clientesAtivos: qtdClientes,
          valesPendentes: qtdValesAbertos,
        }
      }
    });

  } catch (error: any) {
    console.error('Erro no Dashboard Summary API:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'Erro Interno do Servidor' },
      { status: 401 } // Retornando 401 por padrão para falhas de token
    );
  }
}
