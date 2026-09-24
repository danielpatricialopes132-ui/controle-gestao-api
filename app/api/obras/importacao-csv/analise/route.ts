import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { verifyIdToken } from '@/lib/auth';

function parseDecimal(valStr: string): number {
  if (!valStr) return 0;
  let clean = valStr.replace(/\./g, ''); 
  clean = clean.replace(',', '.');
  return parseFloat(clean) || 0;
}

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

    const tenant = await prisma.tenant.findUnique({
      where: { id: userAuth.tenantId }
    });
    const tenantNome = tenant?.nome.toLowerCase() || '';

    const body = await request.json();
    const { base64 } = body;
    
    if (!base64) {
      return NextResponse.json({ error: 'Nenhum arquivo enviado' }, { status: 400 });
    }

    const buffer = Buffer.from(base64.split(',').pop() || base64, 'base64');
    const text = buffer.toString('utf-8');
    const lines = text.split('\n').map(l => l.trim()).filter(l => l.length > 0);
    
    if (lines.length < 2) {
      return NextResponse.json({ error: 'O arquivo parece estar vazio ou não contém dados' }, { status: 400 });
    }

    const headerLine = lines[0];
    const delimiter = headerLine.includes(';') ? ';' : ',';
    const headers = headerLine.split(delimiter).map(h => h.trim().replace(/^"|"$/g, ''));
    
    const idxNomeObra = headers.findIndex(h => h.toLowerCase().includes('nome da obra') || h.toLowerCase() === 'obra');
    const idxCliente = headers.findIndex(h => h.toLowerCase().includes('cliente'));
    const idxStatus = headers.findIndex(h => h.toLowerCase().includes('status'));
    const idxEndereco = headers.findIndex(h => h.toLowerCase().includes('endere'));
    const idxEmpresa = headers.findIndex(h => h.toLowerCase().includes('empresa'));
    const idxValorFechado = headers.findIndex(h => h.toLowerCase().includes('valor fechado'));
    const idxDetalhesAdendos = headers.findIndex(h => h.toLowerCase().includes('detalhes adendos'));

    const obrasExistentes = await prisma.obra.findMany({ where: { tenantId: userAuth.tenantId } });
    const clientesExistentes = await prisma.cliente.findMany({ where: { tenantId: userAuth.tenantId } });

    const rowsParsed = [];

    for (let i = 1; i < lines.length; i++) {
      const regex = new RegExp(`(?!\\s*$)\\s*(?:'([^'\\\\]*(?:\\\\[\\s\\S][^'\\\\]*)*)'|"([^"\\\\]*(?:\\\\[\\s\\S][^"\\\\]*)*)"|([^${delimiter}\\s\\\\]*(?:\\s+[^${delimiter}\\s\\\\]+)*))\\s*(?:${delimiter}|$)`, 'g');
      
      const cols: string[] = [];
      let match;
      while ((match = regex.exec(lines[i])) !== null) {
        cols.push(match[1] || match[2] || match[3] || '');
        if (match.index === regex.lastIndex) regex.lastIndex++;
      }
      
      const rowCols = cols.length >= headers.length ? cols : lines[i].split(delimiter).map(c => c.replace(/^"|"$/g, ''));

      const nomeObra = idxNomeObra >= 0 ? rowCols[idxNomeObra] : '';
      const clienteNome = idxCliente >= 0 ? rowCols[idxCliente] : '';
      const statusRaw = idxStatus >= 0 ? rowCols[idxStatus] : '';
      const endereco = idxEndereco >= 0 ? rowCols[idxEndereco] : '';
      const empresaStr = idxEmpresa >= 0 ? rowCols[idxEmpresa] : '';
      const valorFechadoStr = idxValorFechado >= 0 ? rowCols[idxValorFechado] : '';
      const detalhesAdendosStr = idxDetalhesAdendos >= 0 ? rowCols[idxDetalhesAdendos] : '';

      const valorFechado = parseDecimal(valorFechadoStr);
      let status = 'EM_ANDAMENTO';
      if (statusRaw.toUpperCase().includes('ATIV')) status = 'EM_ANDAMENTO';
      if (statusRaw.toUpperCase().includes('CONCLU')) status = 'CONCLUIDA';
      
      let validationStatus = 'PRONTO';
      const warnings: string[] = [];
      const errors: string[] = [];

      // Validate Empresa
      if (empresaStr && tenantNome) {
        if (!empresaStr.toLowerCase().includes(tenantNome) && !tenantNome.includes(empresaStr.toLowerCase())) {
          warnings.push(`Empresa '${empresaStr}' difere do seu tenant.`);
        }
      }

      if (!nomeObra) {
        errors.push("Nome da Obra ausente");
        validationStatus = 'ERRO';
      }

      // Check Obra
      let obraId = null;
      let isNovaObra = false;
      if (nomeObra) {
        const obraMatch = obrasExistentes.find(o => stringSimilarity(o.nome, nomeObra) > 0.8);
        if (obraMatch) {
          obraId = obraMatch.id;
          warnings.push(`Obra já existe no sistema.`);
          validationStatus = 'ATENCAO'; // Usually we don't want to duplicate, just update or skip
        } else {
          isNovaObra = true;
        }
      }

      // Check Cliente
      let clienteId = null;
      let isNovoCliente = false;
      if (clienteNome) {
        const clienteMatch = clientesExistentes.find(c => stringSimilarity(c.nome, clienteNome) > 0.8);
        if (clienteMatch) {
          clienteId = clienteMatch.id;
        } else {
          isNovoCliente = true;
        }
      }

      // Parse Adendos
      // Format expected: Descricao (R$ Valor) | Descricao (R$ Valor)
      const adendosParsed = [];
      if (detalhesAdendosStr) {
        const parts = detalhesAdendosStr.split('|');
        for (const part of parts) {
          const match = part.match(/(.*?)\(R\$\s*([\d\.,]+)\)/);
          if (match) {
            adendosParsed.push({
              descricao: match[1].trim(),
              valor: parseDecimal(match[2].trim())
            });
          }
        }
      }

      rowsParsed.push({
        idTemp: i.toString(),
        nomeObra,
        obraId,
        isNovaObra,
        clienteNome,
        clienteId,
        isNovoCliente,
        status,
        endereco,
        empresa: empresaStr,
        valorFechado,
        adendos: adendosParsed,
        totalAdendos: adendosParsed.length,
        validationStatus,
        warnings,
        errors
      });
    }

    if (rowsParsed.some(r => r.errors.length > 0)) {
       // If there's at least one error we can just keep validationStatus
    }

    return NextResponse.json({ 
      rows: rowsParsed,
      context: {
        clientes: clientesExistentes.map(c => ({ id: c.id, nome: c.nome })),
        obras: obrasExistentes.map(o => ({ id: o.id, nome: o.nome }))
      }
    });

  } catch (error: any) {
    console.error('Erro na análise do CSV de Obras:', error);
    return NextResponse.json({ error: 'Erro interno no servidor' }, { status: 500 });
  }
}


export async function OPTIONS(request: Request) {
  return new Response(null, {
    status: 200,
    headers: {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, PATCH, OPTIONS",
      "Access-Control-Allow-Headers": "*",
    },
  });
}
