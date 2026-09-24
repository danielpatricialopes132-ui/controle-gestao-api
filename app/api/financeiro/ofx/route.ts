import { NextResponse } from 'next/server';
import { parse } from 'node-ofx-parser';

export async function POST(request: Request) {
  try {
    const tenantId = request.headers.get('x-tenant-id');
    if (!tenantId) {
      return NextResponse.json({ error: 'Tenant ID is required' }, { status: 400 });
    }

    const { base64 } = await request.json();

    if (!base64) {
      return NextResponse.json({ error: 'No OFX file data' }, { status: 400 });
    }

    const buffer = Buffer.from(base64, 'base64');
    const text = buffer.toString('utf-8');
    const ofxData = parse(text);

    // Estrutura do node-ofx-parser
    // Depende se é banco ou cartão. Geralmente banco:
    // ofxData.OFX.BANKMSGSRSV1.STMTTRNRS.STMTRS.BANKTRANLIST.STMTTRN
    
    let transactionsRaw: any = [];
    
    if (ofxData?.OFX?.BANKMSGSRSV1?.STMTTRNRS?.STMTRS?.BANKTRANLIST?.STMTTRN) {
      transactionsRaw = ofxData.OFX.BANKMSGSRSV1.STMTTRNRS.STMTRS.BANKTRANLIST.STMTTRN;
    } else if (ofxData?.OFX?.CREDITCARDMSGSRSV1?.CCSTMTTRNRS?.CCSTMTRS?.BANKTRANLIST?.STMTTRN) {
      transactionsRaw = ofxData.OFX.CREDITCARDMSGSRSV1.CCSTMTTRNRS.CCSTMTRS.BANKTRANLIST.STMTTRN;
    }

    if (!Array.isArray(transactionsRaw)) {
      if (transactionsRaw && typeof transactionsRaw === 'object') {
        transactionsRaw = [transactionsRaw];
      } else {
        transactionsRaw = [];
      }
    }

    const parsedTransactions = transactionsRaw.map((t: any) => {
      // Data geralmente vem como YYYYMMDDHHMMSS
      const dateStr = t.DTPOSTED || t.DTUSER;
      let date = new Date();
      if (dateStr && dateStr.length >= 8) {
        const year = parseInt(dateStr.substring(0, 4));
        const month = parseInt(dateStr.substring(4, 6)) - 1;
        const day = parseInt(dateStr.substring(6, 8));
        date = new Date(year, month, day);
      }

      return {
        id: t.FITID,
        tipo: parseFloat(t.TRNAMT) > 0 ? 'RECEITA' : 'DESPESA',
        valor: Math.abs(parseFloat(t.TRNAMT)),
        descricao: t.MEMO || t.NAME || 'Sem descrição',
        data: date.toISOString(),
      };
    });

    return NextResponse.json({ transactions: parsedTransactions });
  } catch (error) {
    console.error('Error parsing OFX:', error);
    return NextResponse.json({ error: 'Failed to parse OFX file' }, { status: 500 });
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
