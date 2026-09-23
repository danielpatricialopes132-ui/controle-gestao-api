import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { verifyIdToken } from '@/lib/auth';

function parseDate(dateStr: string): Date | null {
  if (!dateStr) return null;
  const parts = dateStr.split('/');
  if (parts.length === 3) {
    // DD/MM/YYYY
    const day = parseInt(parts[0], 10);
    const month = parseInt(parts[1], 10) - 1;
    const year = parseInt(parts[2], 10);
    return new Date(year, month, day);
  }
  return null;
}

function parseDecimal(valStr: string): number {
  if (!valStr) return 0;
  // Ex: "32252,5" -> 32252.5
  let clean = valStr.replace(/\./g, ''); // remove separator if any (like 1.000,00)
  clean = clean.replace(',', '.');
  return parseFloat(clean) || 0;
}

// Simple string similarity for basic fuzzy matching
function stringSimilarity(s1: string, s2: string): number {
  const clean1 = s1.toLowerCase().trim();
  const clean2 = s2.toLowerCase().trim();
  if (clean1 === clean2) return 1;
  if (clean1.includes(clean2) || clean2.includes(clean1)) return 0.8;
  return 0;
}

export async function POST(request: Request) {
  try {
    const userAuth = await verifyIdToken(request);
    if (!userAuth) {
      return NextResponse.json({ error: 'Não autorizado' }, { status: 403 });
    }

    const body = await request.json();
    const { base64 } = body;
    
    if (!base64) {
      return NextResponse.json({ error: 'Nenhum arquivo enviado' }, { status: 400 });
    }

    const buffer = Buffer.from(base64.split(',').pop() || base64, 'base64');
    // base64.split(',').pop() handles data URI if sent
    const text = buffer.toString('utf-8');
    const lines = text.split('\n').map(l => l.trim()).filter(l => l.length > 0);
    
    if (lines.length < 2) {
      return NextResponse.json({ error: 'O arquivo parece estar vazio ou não contém dados' }, { status: 400 });
    }

    // Auto-detect delimiter
    const headerLine = lines[0];
    const delimiter = headerLine.includes(';') ? ';' : ',';

    const headers = headerLine.split(delimiter).map(h => h.trim().replace(/^"|"$/g, ''));
    
    // Find column indexes
    const idxTipo = headers.findIndex(h => h.toLowerCase().includes('tipo'));
    const idxContato = headers.findIndex(h => h.toLowerCase().includes('cliente') || h.toLowerCase().includes('fornecedor'));
    const idxPlanoConta = headers.findIndex(h => h.toLowerCase().includes('plano de contas'));
    const idxCentroCusto = headers.findIndex(h => h.toLowerCase().includes('centro de custo'));
    const idxDescricao = headers.findIndex(h => h.toLowerCase().includes('descri'));
    const idxVencimento = headers.findIndex(h => h.toLowerCase().includes('vencimento'));
    const idxValor = headers.findIndex(h => h.toLowerCase().includes('valor'));
    const idxStatus = headers.findIndex(h => h.toLowerCase().includes('status'));
    const idxDataPagamento = headers.findIndex(h => h.toLowerCase().includes('data pagamento'));

    // Load data in memory for matching
    const contas = await prisma.contaBancaria.findMany({ where: { tenantId: userAuth.tenantId, isAtiva: true } });
    const obras = await prisma.obra.findMany({ where: { tenantId: userAuth.tenantId } });
    const clientes = await prisma.cliente.findMany({ where: { tenantId: userAuth.tenantId } });
    const fornecedores = await prisma.fornecedor.findMany({ where: { tenantId: userAuth.tenantId } });
    const categorias = await prisma.categoriaFinanceira.findMany({ where: { tenantId: userAuth.tenantId, isAtiva: true } });
    
    // Load last 6 months of transactions to check for duplicates
    const sixMonthsAgo = new Date();
    sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);
    const transacoesExistentes = await prisma.transacaoFinanceira.findMany({
      where: { 
        tenantId: userAuth.tenantId,
        dataPagamento: { gte: sixMonthsAgo }
      },
      select: { dataPagamento: true, valor: true, descricao: true }
    });

    const rowsParsed = [];

    for (let i = 1; i < lines.length; i++) {
      // Split preserving quotes if needed, but simple split might work for basic CSV.
      // Better regex to split by delimiter ignoring those inside quotes:
      const regex = new RegExp(`(?!\\s*$)\\s*(?:'([^'\\\\]*(?:\\\\[\\s\\S][^'\\\\]*)*)'|"([^"\\\\]*(?:\\\\[\\s\\S][^"\\\\]*)*)"|([^${delimiter}\\s\\\\]*(?:\\s+[^${delimiter}\\s\\\\]+)*))\\s*(?:${delimiter}|$)`, 'g');
      
      const cols: string[] = [];
      let match;
      while ((match = regex.exec(lines[i])) !== null) {
        cols.push(match[1] || match[2] || match[3] || '');
        if (match.index === regex.lastIndex) regex.lastIndex++; // avoid infinite loops with zero-width matches
      }
      
      // Fallback simple split if regex fails to get correct columns
      const rowCols = cols.length >= headers.length ? cols : lines[i].split(delimiter).map(c => c.replace(/^"|"$/g, ''));

      const tipoStr = idxTipo >= 0 ? rowCols[idxTipo] : '';
      const contatoStr = idxContato >= 0 ? rowCols[idxContato] : '';
      const planoContaStr = idxPlanoConta >= 0 ? rowCols[idxPlanoConta] : '';
      const centroCustoStr = idxCentroCusto >= 0 ? rowCols[idxCentroCusto] : '';
      const descricao = idxDescricao >= 0 ? rowCols[idxDescricao] : '';
      const vencimentoStr = idxVencimento >= 0 ? rowCols[idxVencimento] : '';
      const valorStr = idxValor >= 0 ? rowCols[idxValor] : '';
      const statusStr = idxStatus >= 0 ? rowCols[idxStatus] : '';
      const dataPgtoStr = idxDataPagamento >= 0 ? rowCols[idxDataPagamento] : '';

      const tipo = tipoStr.toUpperCase().includes('RECEITA') ? 'RECEITA' : 'DESPESA';
      const valor = parseDecimal(valorStr);
      const dataVencimento = parseDate(vencimentoStr);
      const dataPagamento = parseDate(dataPgtoStr);
      
      let validationStatus = 'PRONTO';
      const warnings = [];
      const errors = [];

      if (valor === 0) errors.push("Valor inválido");
      if (!dataPagamento && !dataVencimento) errors.push("Sem data");

      let contaBancariaId = null;
      let obraId = null;
      let isNovaObra = false;
      if (centroCustoStr) {
        const contaMatch = contas.find(c => stringSimilarity(c.nome, centroCustoStr) > 0.7);
        if (contaMatch) {
          contaBancariaId = contaMatch.id;
        } else {
          const obraMatch = obras.find(o => stringSimilarity(o.nome, centroCustoStr) > 0.7);
          if (obraMatch) {
            obraId = obraMatch.id;
          } else {
            isNovaObra = true;
            warnings.push(`Centro de custo '${centroCustoStr}' não encontrado. Sugestão: Criar Obra`);
            validationStatus = 'ATENCAO';
          }
        }
      } else {
        warnings.push("Falta Centro de Custo/Conta");
        validationStatus = 'ATENCAO';
      }

      // Matching Contato
      let clienteFornecedorFinal = contatoStr;
      let isNovoContato = false;
      if (contatoStr && contatoStr.toLowerCase() !== 'não informado') {
        const clienteMatch = clientes.find(c => stringSimilarity(c.nome, contatoStr) > 0.7);
        const fornMatch = fornecedores.find(f => stringSimilarity(f.nome, contatoStr) > 0.7);
        if (!clienteMatch && !fornMatch) {
          warnings.push(`Contato '${contatoStr}' não encontrado. Sugestão: Criar Novo`);
          validationStatus = 'ATENCAO';
          isNovoContato = true;
        }
      }

      // Matching Categoria
      let categoriaId = null;
      if (planoContaStr) {
        // Try to extract code like "2.2.0"
        const codeMatch = planoContaStr.match(/^[\d\.]+/);
        const code = codeMatch ? codeMatch[0] : null;
        
        const catMatch = categorias.find(c => 
          (code && c.codigo === code) || stringSimilarity(c.descricao, planoContaStr) > 0.7
        );
        if (catMatch) {
          categoriaId = catMatch.id;
        } else {
          warnings.push(`Categoria '${planoContaStr}' não mapeada.`);
          validationStatus = 'ATENCAO';
        }
      } else {
        warnings.push("Falta Plano de Contas");
        validationStatus = 'ATENCAO';
      }

      // Check Duplicates
      if (dataPagamento && valor > 0) {
        const isDuplicated = transacoesExistentes.some(t => 
          t.dataPagamento?.getTime() === dataPagamento.getTime() &&
          Number(t.valor) === valor &&
          stringSimilarity(t.descricao, descricao) > 0.9
        );
        if (isDuplicated) {
          warnings.push("Possível duplicidade com transação existente.");
          validationStatus = 'ATENCAO';
        }
      }

      if (errors.length > 0) {
        validationStatus = 'ERRO';
      }

      rowsParsed.push({
        idTemp: i.toString(),
        tipo,
        clienteFornecedor: clienteFornecedorFinal,
        isNovoContato,
        planoContaStr,
        categoriaId,
        centroCustoStr,
        contaBancariaId,
        obraId,
        isNovaObra,
        descricao,
        vencimento: dataVencimento,
        dataPagamento: dataPagamento,
        valor,
        status: statusStr.toLowerCase() === 'pago' ? 'PAGO' : 'PENDENTE',
        validationStatus,
        warnings,
        errors
      });
    }

    return NextResponse.json({ 
      rows: rowsParsed,
      context: {
        contas: contas.map(c => ({ id: c.id, nome: c.nome })),
        obras: obras.map(o => ({ id: o.id, nome: o.nome })),
        categorias: categorias.map(c => ({ id: c.id, nome: c.descricao, codigo: c.codigo }))
      }
    });

  } catch (error: any) {
    console.error('Erro na análise do CSV:', error);
    return NextResponse.json({ error: 'Erro interno no servidor' }, { status: 500 });
  }
}
