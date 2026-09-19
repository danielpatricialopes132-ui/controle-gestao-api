import cron from 'node-cron';
import prisma from './prisma';
import { sendWhatsAppMessage } from './whatsapp';

// Apenas executa uma vez para não termos múltiplos crons rodando caso o arquivo seja reimportado no ambiente dev do Next.js
let cronStarted = false;

export function startCronJobs() {
  if (cronStarted) return;
  cronStarted = true;

  console.log('⏳ Inicializando rotinas diárias (node-cron)...');

  // Roda todos os dias às 08:00 da manhã
  cron.schedule('0 8 * * *', async () => {
    console.log('⏰ Executando rotina diária de alertas proativos...');

    try {
      // Data de hoje
      const hoje = new Date();
      hoje.setHours(0, 0, 0, 0);
      
      const amanha = new Date(hoje);
      amanha.setDate(amanha.getDate() + 1);

      // 1. Buscar transações a pagar hoje
      const transacoesVencendoHoje = await prisma.transacaoFinanceira.findMany({
        where: {
          tipo: 'DESPESA',
          status: 'PENDENTE',
          dataVencimento: {
            gte: hoje,
            lt: amanha,
          }
        },
        include: {
          tenant: true
        }
      });

      // Se houver transações vencendo hoje, mandar alerta para o MASTER (ou no nosso caso, o admin)
      if (transacoesVencendoHoje.length > 0) {
        let mensagem = `*Resumo Financeiro - Contas a Pagar Hoje (${hoje.toLocaleDateString('pt-BR')})*\n\n`;
        
        let total = 0;
        transacoesVencendoHoje.forEach(t => {
          mensagem += `- ${t.descricao}: R$ ${t.valor.toString()}\n`;
          total += Number(t.valor);
        });

        mensagem += `\n*Total a pagar hoje: R$ ${total.toFixed(2)}*`;

        // Mandar para o número configurado ou os administradores de cada tenant.
        // O usuário pediu pra chumbarmos pro número atual dele para validar. 
        // Idealmente, pegaríamos o telefone do usuário MASTER do respectivo tenant.
        const masterUsers = await prisma.usuario.findMany({
          where: { role: 'MASTER', telefone: { not: null } }
        });

        for (const admin of masterUsers) {
          if (admin.telefone) {
             const tel = admin.telefone.replace(/\D/g, ''); // Limpar pontuação
             await sendWhatsAppMessage(tel, mensagem);
          }
        }
      }

      // 2. Buscar Obras ativas sem apontamento no dia anterior
      const ontem = new Date();
      ontem.setDate(ontem.getDate() - 1);
      ontem.setHours(0, 0, 0, 0);

      const obrasEmAndamento = await prisma.obra.findMany({
        where: { status: 'EM_ANDAMENTO' },
        include: { tenant: true }
      });

      for (const obra of obrasEmAndamento) {
        const registrosOntem = await prisma.registroPresenca.count({
          where: {
            obraId: obra.id,
            data: {
              gte: ontem,
              lt: hoje,
            }
          }
        });

        // Ignorar se ontem foi domingo, idealmente. Vamos fazer um alerta simples:
        const diaSemana = ontem.getDay();
        if (registrosOntem === 0 && diaSemana !== 0) { // não é domingo
          const msg = `⚠️ *Alerta de Obra*\nA obra *${obra.nome}* não teve nenhum apontamento de horas na data de ontem (${ontem.toLocaleDateString('pt-BR')}). Verifique com o encarregado.`;
          
          const masterUsers = await prisma.usuario.findMany({
            where: { tenantId: obra.tenantId, role: 'MASTER', telefone: { not: null } }
          });

          for (const admin of masterUsers) {
            if (admin.telefone) {
               const tel = admin.telefone.replace(/\D/g, '');
               await sendWhatsAppMessage(tel, msg);
            }
          }
        }
      }

    } catch (error) {
      console.error('Erro na execução do Cron Diário:', error);
    }
  });
}
