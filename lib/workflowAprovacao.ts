import { prisma } from './prisma';

export interface ValidacaoAlcadaResultado {
  requerAprovacao: boolean;
  aprovadorNecessarioRole?: string;
  podeAprovar: boolean;
  motivo?: string;
  alcadaCorrespondente?: any;
}

/**
 * Avalia se o usuário logado tem alçada para aprovar ou se o item exige aprovação superior.
 * Se nenhuma alçada customizada estiver cadastrada para o tenant, aplica regras de segurança padrão:
 * - Até R$ 5.000: Engenharia ou Financeiro podem aprovar.
 * - Acima de R$ 5.000: Exige Diretoria ou Master.
 */
export async function validarAlcadaUsuario({
  tenantId,
  userRole,
  tipoEntidade,
  valor,
}: {
  tenantId: string;
  userRole: string;
  tipoEntidade: 'ORDEM_COMPRA' | 'MEDICAO_EMPREITEIRO' | 'CONTRATO' | 'DESPESA_EXTRA';
  valor: number;
}): Promise<ValidacaoAlcadaResultado> {
  // Superadmin / MASTER sempre tem alçada máxima irrestrita
  if (userRole === 'MASTER') {
    return { requerAprovacao: true, podeAprovar: true, motivo: 'Usuário possui alçada MASTER (total).' };
  }

  // Busca regras configuradas no banco para o tenant
  const alcadas = await prisma.alcadaAprovacao.findMany({
    where: {
      tenantId,
      tipoEntidade,
      ativo: true,
    },
    orderBy: { valorMinimo: 'desc' },
  });

  if (alcadas.length > 0) {
    // Procura a faixa correspondente ao valor
    const alcadaCorrespondente = alcadas.find((a) => {
      const min = Number(a.valorMinimo);
      const max = a.valorMaximo ? Number(a.valorMaximo) : Infinity;
      return valor >= min && valor <= max;
    });

    if (alcadaCorrespondente) {
      const podeAprovar = userRole === alcadaCorrespondente.roleAprovador;
      return {
        requerAprovacao: true,
        aprovadorNecessarioRole: alcadaCorrespondente.roleAprovador,
        podeAprovar,
        motivo: podeAprovar
          ? `Alçada ${alcadaCorrespondente.roleAprovador} compatível.`
          : `Este valor (R$ ${valor.toFixed(2)}) exige autorização de ${alcadaCorrespondente.roleAprovador}.`,
        alcadaCorrespondente,
      };
    }
  }

  // Regra Padrão do ERP caso nenhuma faixa específica esteja cadastrada
  const LIMITE_OPERACIONAL = 5000.0;
  if (valor <= LIMITE_OPERACIONAL) {
    const rolesAutorizadas = ['ENGENHARIA', 'FINANCEIRO', 'DIRETORIA'];
    const podeAprovar = rolesAutorizadas.includes(userRole);
    return {
      requerAprovacao: true,
      aprovadorNecessarioRole: 'ENGENHARIA/FINANCEIRO',
      podeAprovar,
      motivo: podeAprovar
        ? 'Dentro da alçada operacional padrão (até R$ 5.000,00).'
        : 'Requer perfil de Engenharia, Financeiro ou Diretoria.',
    };
  } else {
    // Acima de R$ 5.000 exige Diretoria ou Master
    const rolesAutorizadas = ['DIRETORIA'];
    const podeAprovar = rolesAutorizadas.includes(userRole);
    return {
      requerAprovacao: true,
      aprovadorNecessarioRole: 'DIRETORIA',
      podeAprovar,
      motivo: podeAprovar
        ? 'Aprovado por alçada de Diretoria (acima de R$ 5.000,00).'
        : `Valor de R$ ${valor.toFixed(2)} excede o limite operacional de R$ 5.000,00. Exige aprovação da Diretoria ou Master.`,
    };
  }
}
