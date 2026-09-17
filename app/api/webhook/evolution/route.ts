import { NextResponse } from 'next/server';
import { sendWhatsAppText } from '@/lib/whatsapp';
import { GoogleGenerativeAI, FunctionDeclaration, SchemaType } from '@google/generative-ai';
import { env } from 'process';
import { PrismaClient } from '@prisma/client';

const genAI = new GoogleGenerativeAI(env.GEMINI_API_KEY || '');
const prisma = new PrismaClient();

const registrarEscalaDeclaration: FunctionDeclaration = {
  name: "registrar_escala",
  description: "Registra a presença (escala de trabalho) de um ou mais funcionários em uma obra.",
  parameters: {
    type: SchemaType.OBJECT,
    properties: {
      data: {
        type: SchemaType.STRING,
        description: "Data da escala no formato YYYY-MM-DD. Exemplo: 2023-10-25"
      },
      obraId: {
        type: SchemaType.STRING,
        description: "O ID da obra onde os funcionários trabalharam."
      },
      presencas: {
        type: SchemaType.ARRAY,
        description: "Lista de funcionários e suas horas trabalhadas.",
        items: {
          type: SchemaType.OBJECT,
          properties: {
            funcionarioId: {
              type: SchemaType.STRING,
              description: "ID do funcionário."
            },
            status: {
              type: SchemaType.STRING,
              description: "Status da presença. Um de: TRABALHO, VIAGEM, CHUVA, FALTA"
            },
            horas: {
              type: SchemaType.NUMBER,
              description: "Horas trabalhadas (padrão 8)."
            },
            observacao: {
              type: SchemaType.STRING,
              description: "Qualquer observação pertinente."
            }
          },
          required: ["funcionarioId", "status"]
        }
      }
    },
    required: ["data", "obraId", "presencas"]
  }
};

export async function POST(req: Request) {
  try {
    const body = await req.json();
    if (body.event !== 'messages.upsert') return NextResponse.json({ status: 'ignored' }, { status: 200 });

    const message = body.data?.message;
    if (!message || message.key?.fromMe || message.key?.remoteJid?.includes('@g.us')) {
      return NextResponse.json({ status: 'ignored' }, { status: 200 });
    }

    const messageText = message.message?.conversation || message.message?.extendedTextMessage?.text || "";
    if (!messageText) return NextResponse.json({ status: 'no_text' }, { status: 200 });

    const senderNumber = message.key.remoteJid.replace('@s.whatsapp.net', '');
    const senderName = message.pushName || 'Usuário';

    if (!env.GEMINI_API_KEY) {
      await sendWhatsAppText({ number: senderNumber, text: "Desculpe, meu sistema de IA está offline no momento." });
      return NextResponse.json({ status: 'api_key_missing' }, { status: 200 });
    }

    const usuario = await prisma.usuario.findFirst({
      where: { telefone: { contains: senderNumber } } 
    });

    if (!usuario) {
      await sendWhatsAppText({ number: senderNumber, text: "Olá! Seu número de WhatsApp não está cadastrado no sistema para realizar lançamentos." });
      return NextResponse.json({ status: 'unauthorized' }, { status: 200 });
    }

    const tenantId = usuario.tenantId;

    const obras = await prisma.obra.findMany({ where: { tenantId } });
    const funcionarios = await prisma.funcionario.findMany({ where: { tenantId } });

    const obrasText = obras.map(o => `ID: ${o.id} - Nome: ${o.nome}`).join('\n');
    const funcText = funcionarios.map(f => `ID: ${f.id} - Nome: ${f.nome}`).join('\n');

    const systemInstruction = `Você é um assistente inteligente do sistema de gestão JHOSTON TEC. Seu objetivo é ajudar a registrar escalas de trabalho enviadas por encarregados via WhatsApp.

Obras disponíveis:
${obrasText}

Funcionários disponíveis:
${funcText}

Regras:
1. Analise a mensagem do usuário.
2. Identifique de qual obra ele está falando e cruze com os IDs disponíveis.
3. Identifique os funcionários citados e os associe aos IDs. Trate apelidos ou primeiros nomes de forma inteligente.
4. Identifique as horas trabalhadas (se não informado, assuma 8 horas) e o status (TRABALHO, FALTA, CHUVA, VIAGEM).
5. Se a mensagem for claramente um envio de escala, CHAME A FUNÇÃO \`registrar_escala\` com os dados estruturados.
6. Se não for sobre escala, responda educadamente como assistente virtual, avisando que pode lançar escalas se ele quiser.

Hoje é: ${new Date().toISOString().split('T')[0]}.
Usuário conversando: ${senderName} (${usuario.nome})`;

    const model = genAI.getGenerativeModel({
      model: "gemini-1.5-flash",
      tools: [{ functionDeclarations: [registrarEscalaDeclaration] }]
    });

    const result = await model.generateContent({
      contents: [{ role: 'user', parts: [{ text: systemInstruction + "\n\nMensagem do usuário: " + messageText }] }]
    });

    const calls = result.response.functionCalls();
    
    if (calls && calls.length > 0) {
      const call = calls[0];
      if (call.name === 'registrar_escala') {
        const args: any = call.args;
        
        try {
          const registros = args.presencas.map((p: any) => ({
            data: new Date(args.data),
            status: p.status,
            horasTrabalhadas: p.horas || (p.status === 'FALTA' ? 0 : 8),
            percentualPago: 100,
            observacao: p.observacao || 'Via WhatsApp',
            statusAprovacao: 'PENDENTE',
            funcionarioId: p.funcionarioId,
            obraId: args.obraId,
            tenantId: tenantId
          }));

          await prisma.registroPresenca.createMany({
            data: registros
          });

          await sendWhatsAppText({ number: senderNumber, text: `✅ Escala registrada com sucesso na obra!\n\nForam lançados ${registros.length} registros. Aguardando aprovação do RH.` });
          return NextResponse.json({ status: 'function_called_success' }, { status: 200 });

        } catch (dbError) {
          console.error(dbError);
          await sendWhatsAppText({ number: senderNumber, text: `❌ Houve um erro ao salvar a escala no banco de dados. Tente novamente.` });
          return NextResponse.json({ status: 'function_called_error' }, { status: 500 });
        }
      }
    }

    const textResp = result.response.text();
    if (textResp) {
      await sendWhatsAppText({ number: senderNumber, text: textResp });
    }

    return NextResponse.json({ status: 'success' }, { status: 200 });
  } catch (error) { 
    console.error(error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 }); 
  }
}
