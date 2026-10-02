/**
 * Helper de integração com a API Oficial da ZapSign (Assinatura Eletrônica + gov.br)
 */

const ZAPSIGN_BASE_URL = 'https://api.zapsign.com.br/api/v1';

export interface CriarDocumentoZapSignParams {
  nomeDocumento: string;
  urlPdf?: string;
  base64Pdf?: string;
  nomeSignatario: string;
  emailSignatario?: string;
  telefoneSignatario?: string;
  exigirGovBr?: boolean;
}

export interface RespostaZapSignCriacao {
  token: string;
  name: string;
  status: string;
  signers: Array<{
    token: string;
    name: string;
    sign_url: string;
    status: string;
  }>;
}

export async function criarDocumentoZapSign({
  nomeDocumento,
  urlPdf,
  base64Pdf,
  nomeSignatario,
  emailSignatario,
  telefoneSignatario,
  exigirGovBr = true,
}: CriarDocumentoZapSignParams): Promise<RespostaZapSignCriacao> {
  const tokenApi = process.env.ZAPSIGN_API_TOKEN;

  if (!tokenApi) {
    throw new Error('ZAPSIGN_API_TOKEN não está configurado nas variáveis de ambiente.');
  }

  // Montagem do signatário com exigência do gov.br
  const signer: any = {
    name: nomeSignatario,
    auth_mode: 'assinatura_tela',
    require_govbr: exigirGovBr,
    send_automatic_whatsapp: false, // Dispararemos via Evolution API personalizada
    send_automatic_email: !!emailSignatario,
  };

  if (emailSignatario) {
    signer.email = emailSignatario;
  }

  if (telefoneSignatario) {
    const limpo = telefoneSignatario.replace(/\D/g, '');
    signer.phone_country = '55';
    signer.phone_number = limpo.startsWith('55') ? limpo.substring(2) : limpo;
  }

  const payload: any = {
    name: nomeDocumento,
    signers: [signer],
  };

  if (urlPdf) {
    payload.url_pdf = urlPdf;
  } else if (base64Pdf) {
    payload.base64_pdf = base64Pdf.includes('base64,') ? base64Pdf.split('base64,')[1] : base64Pdf;
  } else {
    throw new Error('É necessário informar urlPdf ou base64Pdf para criar o documento na ZapSign.');
  }

  const res = await fetch(`${ZAPSIGN_BASE_URL}/docs/?api_token=${tokenApi}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload),
  });

  const data = await res.json().catch(() => null);

  if (!res.ok) {
    throw new Error(`Erro na API ZapSign (${res.status}): ${JSON.stringify(data || {})}`);
  }

  return data as RespostaZapSignCriacao;
}

export async function obterDetalhesDocumentoZapSign(documentoToken: string) {
  const tokenApi = process.env.ZAPSIGN_API_TOKEN;
  if (!tokenApi) throw new Error('ZAPSIGN_API_TOKEN não configurado.');

  const res = await fetch(`${ZAPSIGN_BASE_URL}/docs/${documentoToken}/?api_token=${tokenApi}`);
  if (!res.ok) {
    throw new Error(`Falha ao consultar documento na ZapSign: ${res.statusText}`);
  }
  return await res.json();
}
