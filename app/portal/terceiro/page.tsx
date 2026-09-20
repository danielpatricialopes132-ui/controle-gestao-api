'use client';

import React, { useEffect, useState, Suspense, useRef } from 'react';
import { useSearchParams } from 'next/navigation';

function PortalTerceiroContent() {
  const searchParams = useSearchParams();
  const token = searchParams.get('token');

  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // Estados para upload de foto
  const [uploading, setUploading] = useState(false);
  const [descricaoFoto, setDescricaoFoto] = useState('');
  const [ambienteFoto, setAmbienteFoto] = useState('');
  const [punchListSelecionado, setPunchListSelecionado] = useState<string>('');
  const [feedbackUpload, setFeedbackUpload] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [previewImage, setPreviewImage] = useState<string | null>(null);
  const [recentPhotos, setRecentPhotos] = useState<any[]>([]);

  const carregarDados = () => {
    if (!token) {
      setError('Identificador de acesso não fornecido na URL.');
      setLoading(false);
      return;
    }

    fetch(`/api/portal/terceiro/${token}`)
      .then((res) => {
        if (!res.ok) throw new Error('Acesso não encontrado ou link expirado');
        return res.json();
      })
      .then((json) => {
        setData(json);
        setLoading(false);
      })
      .catch((err) => {
        setError(err.message);
        setLoading(false);
      });
  };

  useEffect(() => {
    carregarDados();
  }, [token]);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setPreviewImage(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleEnviarFoto = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!previewImage) {
      alert('Por favor, selecione ou tire uma foto antes de enviar.');
      return;
    }

    setUploading(true);
    setFeedbackUpload(null);

    try {
      const res = await fetch(`/api/portal/terceiro/${token}/upload`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          base64: previewImage,
          descricao: descricaoFoto,
          ambiente: ambienteFoto,
          punchListItemId: punchListSelecionado || null,
        }),
      });

      const resJson = await res.json();
      if (!res.ok) throw new Error(resJson.error || 'Erro ao enviar foto');

      setFeedbackUpload('Foto enviada com sucesso! Ela foi anexada à vistoria técnica da obra.');
      if (resJson.foto) {
        setRecentPhotos((prev) => [resJson.foto, ...prev]);
      }
      setPreviewImage(null);
      setDescricaoFoto('');
      setAmbienteFoto('');
      setPunchListSelecionado('');
      if (fileInputRef.current) fileInputRef.current.value = '';

      // Atualiza os dados para refletir eventuais itens de punch list atualizados
      carregarDados();
    } catch (err: any) {
      alert(err.message || 'Falha no envio da foto.');
    } finally {
      setUploading(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-900 text-white flex flex-col items-center justify-center p-4">
        <div className="w-12 h-12 border-4 border-emerald-500 border-t-transparent rounded-full animate-spin mb-4"></div>
        <p className="text-lg font-medium text-slate-300">Carregando credenciais do montador...</p>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="min-h-screen bg-slate-900 text-white flex flex-col items-center justify-center p-6 text-center">
        <div className="w-16 h-16 bg-red-500/20 text-red-400 rounded-full flex items-center justify-center text-3xl font-bold mb-4">
          ✕
        </div>
        <h1 className="text-2xl font-bold text-red-400 mb-2">Acesso Não Localizado</h1>
        <p className="text-slate-300 max-w-md mb-6">{error || 'O link de acesso não é válido ou já foi encerrado.'}</p>
        <span className="text-xs text-slate-500">Entre em contato com o gestor da obra para receber um novo link de liberação.</span>
      </div>
    );
  }

  const { terceiro, obra, empresa, autorizacoesPortaria = [], punchList = [], termosRetirada = [] } = data;
  const ultimaPortaria = autorizacoesPortaria[0];

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 font-sans pb-16">
      {/* Top Banner / Header */}
      <header className="bg-gradient-to-r from-slate-900 via-slate-800 to-indigo-950 border-b border-slate-800 shadow-lg">
        <div className="max-w-4xl mx-auto px-4 py-5 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
          <div>
            <div className="flex items-center gap-2">
              <span className="text-xs uppercase tracking-wider font-semibold px-2 py-0.5 rounded bg-indigo-500/20 text-indigo-300 border border-indigo-500/30">
                Portal do Montador & Terceiro
              </span>
            </div>
            <h1 className="text-xl sm:text-2xl font-black text-white mt-1">{terceiro.nomeEmpresa}</h1>
            <p className="text-xs sm:text-sm text-slate-300">
              Especialidade: <strong className="text-indigo-300">{terceiro.especialidade}</strong> • Obra: <strong className="text-white">{obra?.nome}</strong>
            </p>
          </div>
          <div className="text-left sm:text-right">
            <span className="text-xs text-slate-400 block">Gestão e Coordenação:</span>
            <span className="text-sm font-bold text-slate-200">{empresa.nome}</span>
          </div>
        </div>
      </header>

      {/* Main Content Container */}
      <main className="max-w-4xl mx-auto px-4 py-6 space-y-6">

        {/* Card de Identificação da Obra e Local */}
        <section className="bg-slate-900/80 border border-slate-800 rounded-2xl p-4 sm:p-5 shadow-sm">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2">
            <div>
              <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Local da Obra</span>
              <h2 className="text-lg font-bold text-white">{obra?.nome}</h2>
              <p className="text-xs sm:text-sm text-slate-300 mt-0.5">{obra?.endereco || 'Endereço em confirmação pela coordenação'}</p>
            </div>
            <div className="px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider bg-emerald-500/10 text-emerald-400 border border-emerald-500/30">
              {terceiro.status?.replace('_', ' ')}
            </div>
          </div>
        </section>

        {/* 1. CRACHÁ DIGITAL DE LIBERAÇÃO DE PORTARIA */}
        <section className="bg-gradient-to-b from-slate-900 to-slate-900/95 border-2 border-emerald-500/40 rounded-2xl p-5 shadow-xl relative overflow-hidden">
          <div className="absolute top-0 right-0 w-32 h-32 bg-emerald-500/10 rounded-full blur-2xl pointer-events-none"></div>

          <div className="flex items-center justify-between gap-2 border-b border-slate-800 pb-3 mb-4">
            <div className="flex items-center gap-2.5">
              <div className="w-10 h-10 rounded-xl bg-emerald-500/20 text-emerald-400 flex items-center justify-center text-xl">
                🛡️
              </div>
              <div>
                <h3 className="text-base sm:text-lg font-extrabold text-white">Liberação de Acesso à Portaria</h3>
                <p className="text-xs text-slate-400">Apresente esta credencial digital na guarita do condomínio</p>
              </div>
            </div>
            <span className="px-3 py-1 rounded-full text-xs font-black uppercase tracking-wider bg-emerald-500 text-slate-950 shadow-sm animate-pulse">
              AUTORIZADO
            </span>
          </div>

          {ultimaPortaria ? (
            <div className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs sm:text-sm">
                <div className="bg-slate-950/60 p-3 rounded-xl border border-slate-800">
                  <span className="text-slate-400 text-xs block mb-0.5">Período de Acesso Autorizado:</span>
                  <span className="font-semibold text-white">
                    {new Date(ultimaPortaria.dataInicio).toLocaleDateString('pt-BR')} até{' '}
                    {new Date(ultimaPortaria.dataFim).toLocaleDateString('pt-BR')}
                  </span>
                </div>
                <div className="bg-slate-950/60 p-3 rounded-xl border border-slate-800">
                  <span className="text-slate-400 text-xs block mb-0.5">Horário Permitido para Serviços:</span>
                  <span className="font-semibold text-emerald-400">{ultimaPortaria.horarioPermitido || '08:00 às 17:00'}</span>
                </div>
                {ultimaPortaria.veiculoPlaca && (
                  <div className="bg-slate-950/60 p-3 rounded-xl border border-slate-800 sm:col-span-2">
                    <span className="text-slate-400 text-xs block mb-0.5">Veículo de Transporte de Carga / Equipe:</span>
                    <span className="font-semibold text-white">
                      Placa: <strong className="text-amber-300">{ultimaPortaria.veiculoPlaca}</strong>
                      {ultimaPortaria.veiculoModelo && ` • Modelo: ${ultimaPortaria.veiculoModelo}`}
                    </span>
                  </div>
                )}
              </div>

              {/* Equipe / Colaboradores */}
              {Array.isArray(ultimaPortaria.colaboradores) && ultimaPortaria.colaboradores.length > 0 && (
                <div>
                  <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-2">Equipe Credenciada no Local:</h4>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    {ultimaPortaria.colaboradores.map((colab: any, idx: number) => (
                      <div key={idx} className="bg-slate-950/80 p-2.5 rounded-lg border border-slate-800/80 flex items-center gap-2">
                        <span className="w-7 h-7 rounded-full bg-slate-800 text-slate-300 text-xs flex items-center justify-center font-bold">
                          {idx + 1}
                        </span>
                        <div>
                          <p className="text-xs font-bold text-white">{colab.nome || 'Colaborador'}</p>
                          <p className="text-[11px] text-slate-400">
                            {colab.funcao || 'Montador'} {colab.rg ? `• RG: ${colab.rg}` : ''} {colab.cpf ? `• CPF: ${colab.cpf}` : ''}
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Regras do Condomínio */}
              {ultimaPortaria.regrasCondominio && (
                <div className="bg-amber-950/20 border border-amber-500/30 rounded-xl p-3 text-xs text-amber-200">
                  <strong className="block text-amber-400 font-bold mb-1">Regras Condominiais Obrigatórias:</strong>
                  <p className="whitespace-pre-line leading-relaxed">{ultimaPortaria.regrasCondominio}</p>
                </div>
              )}
            </div>
          ) : (
            <div className="bg-slate-950/50 p-4 rounded-xl text-center text-xs text-slate-400">
              Nenhuma autorização formal de portaria registrada no momento. O acesso pode ser liberado diretamente via guarita da construtora.
            </div>
          )}
        </section>

        {/* 2. PENDÊNCIAS DE MONTAGEM / PUNCH LIST */}
        <section className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <span className="text-lg">📋</span>
              <h3 className="text-base font-bold text-white">Pendências & Vistoria (Punch List)</h3>
            </div>
            <span className="text-xs font-semibold px-2 py-0.5 rounded bg-slate-800 text-slate-300">
              {punchList.length} {punchList.length === 1 ? 'item' : 'itens'}
            </span>
          </div>

          {punchList.length === 0 ? (
            <div className="bg-slate-950/50 p-5 rounded-xl text-center">
              <p className="text-xs text-emerald-400 font-semibold">Tudo em conformidade! Nenhuma pendência atribuída a esta empresa.</p>
            </div>
          ) : (
            <div className="space-y-3">
              {punchList.map((item: any) => {
                const resolvido = item.status === 'RESOLVIDO';
                return (
                  <div
                    key={item.id}
                    className={`p-3.5 rounded-xl border text-xs flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 transition-colors ${
                      resolvido
                        ? 'bg-emerald-950/10 border-emerald-500/30'
                        : 'bg-slate-950/70 border-slate-800 hover:border-slate-700'
                    }`}
                  >
                    <div>
                      <div className="flex items-center gap-2 mb-1">
                        <span className="font-bold text-white text-xs px-2 py-0.5 rounded bg-slate-800 border border-slate-700">
                          {item.ambiente}
                        </span>
                        <span
                          className={`text-[10px] font-bold px-2 py-0.5 rounded uppercase ${
                            resolvido
                              ? 'bg-emerald-500/20 text-emerald-300'
                              : 'bg-amber-500/20 text-amber-300'
                          }`}
                        >
                          {item.status}
                        </span>
                      </div>
                      <p className="text-slate-300">{item.descricao}</p>
                      {item.prazoCorrecao && (
                        <p className="text-[11px] text-slate-400 mt-1">
                          Prazo estipulado: <strong>{new Date(item.prazoCorrecao).toLocaleDateString('pt-BR')}</strong>
                        </p>
                      )}
                    </div>
                    {!resolvido && (
                      <button
                        type="button"
                        onClick={() => {
                          setPunchListSelecionado(item.id);
                          setAmbienteFoto(item.ambiente);
                          setDescricaoFoto(`Correção finalizada: ${item.descricao}`);
                          window.scrollTo({ top: document.body.scrollHeight, behavior: 'smooth' });
                        }}
                        className="px-3 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs shrink-0 transition"
                      >
                        Resolver com Foto
                      </button>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </section>

        {/* 3. UPLOAD DE FOTOS DA MONTAGEM CONCLUÍDA */}
        <section className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-sm">
          <div className="flex items-center gap-2 mb-3">
            <span className="text-lg">📸</span>
            <h3 className="text-base font-bold text-white">Enviar Foto de Conclusão / Vistoria</h3>
          </div>
          <p className="text-xs text-slate-400 mb-4">
            Fotografe o ambiente ou detalhe finalizado para validação imediata pela equipe de engenharia e inclusão na Revista de Obra.
          </p>

          {feedbackUpload && (
            <div className="bg-emerald-950/40 border border-emerald-500/50 p-3 rounded-xl text-xs text-emerald-300 mb-4 flex items-center gap-2">
              <span>✅</span>
              <span>{feedbackUpload}</span>
            </div>
          )}

          <form onSubmit={handleEnviarFoto} className="space-y-4">
            {/* Foto Picker / Camera */}
            <div className="border-2 border-dashed border-slate-700 hover:border-indigo-500/50 rounded-xl p-4 text-center bg-slate-950/50 transition">
              {previewImage ? (
                <div className="flex flex-col items-center">
                  <img
                    src={previewImage}
                    alt="Pré-visualização"
                    className="max-h-56 rounded-lg object-contain border border-slate-800 shadow mb-3"
                  />
                  <button
                    type="button"
                    onClick={() => {
                      setPreviewImage(null);
                      if (fileInputRef.current) fileInputRef.current.value = '';
                    }}
                    className="text-xs text-red-400 hover:underline"
                  >
                    Trocar imagem
                  </button>
                </div>
              ) : (
                <div>
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/*"
                    capture="environment"
                    onChange={handleFileChange}
                    className="hidden"
                    id="camera-upload-input"
                  />
                  <label
                    htmlFor="camera-upload-input"
                    className="cursor-pointer inline-flex flex-col items-center justify-center p-3"
                  >
                    <span className="text-3xl mb-1">📷</span>
                    <span className="text-xs font-bold text-indigo-400">Tirar Foto ou Escolher da Galeria</span>
                    <span className="text-[11px] text-slate-400 mt-0.5">Formatos JPG, PNG</span>
                  </label>
                </div>
              )}
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
              <div>
                <label className="block text-slate-300 font-semibold mb-1">Ambiente Inspecionado:</label>
                <input
                  type="text"
                  placeholder="Ex: Cozinha Gourmet, Suíte Master"
                  value={ambienteFoto}
                  onChange={(e) => setAmbienteFoto(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500"
                />
              </div>

              <div>
                <label className="block text-slate-300 font-semibold mb-1">Vincular a Pendência (Opcional):</label>
                <select
                  value={punchListSelecionado}
                  onChange={(e) => setPunchListSelecionado(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-white focus:outline-none focus:border-indigo-500"
                >
                  <option value="">Nenhum (Foto Geral de Montagem)</option>
                  {punchList.map((p: any) => (
                    <option key={p.id} value={p.id}>
                      [{p.ambiente}] {p.descricao.substring(0, 35)}...
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div>
              <label className="block text-xs text-slate-300 font-semibold mb-1">Comentários / Observações do Serviço:</label>
              <textarea
                rows={2}
                placeholder="Ex: Todas as portas alinhadas, ferragens instaladas e limpeza do ambiente realizada."
                value={descricaoFoto}
                onChange={(e) => setDescricaoFoto(e.target.value)}
                className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500"
              />
            </div>

            <button
              type="submit"
              disabled={uploading || !previewImage}
              className={`w-full py-3 rounded-xl font-bold text-xs uppercase tracking-wider flex items-center justify-center gap-2 shadow-lg transition ${
                uploading || !previewImage
                  ? 'bg-slate-800 text-slate-500 cursor-not-allowed'
                  : 'bg-emerald-600 hover:bg-emerald-500 text-white shadow-emerald-900/30'
              }`}
            >
              {uploading ? (
                <>
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                  <span>Enviando foto para a obra...</span>
                </>
              ) : (
                <>
                  <span>🚀</span>
                  <span>Confirmar e Enviar para a Coordenação</span>
                </>
              )}
            </button>
          </form>

          {/* Fotos recém-enviadas nesta sessão */}
          {recentPhotos.length > 0 && (
            <div className="mt-5 pt-4 border-t border-slate-800">
              <h4 className="text-xs font-bold text-slate-300 mb-2">Fotos enviadas agora:</h4>
              <div className="flex gap-2 overflow-x-auto pb-2">
                {recentPhotos.map((f, i) => (
                  <div key={i} className="shrink-0 w-24 h-24 rounded-lg overflow-hidden border border-slate-800 relative">
                    <img src={f.url} alt="Foto enviada" className="w-full h-full object-cover" />
                  </div>
                ))}
              </div>
            </div>
          )}
        </section>

        {/* 4. TERMOS DE RETIRADA / CAUTELAS DE MATERIAIS */}
        {termosRetirada.length > 0 && (
          <section className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-sm">
            <div className="flex items-center gap-2 mb-3">
              <span className="text-lg">📦</span>
              <h3 className="text-base font-bold text-white">Termos de Retirada & Cautela de Peças</h3>
            </div>
            <p className="text-xs text-slate-400 mb-3">
              Materiais retirados da obra sob guarda provisória da empresa para confecção, usinagem ou reparo externo:
            </p>
            <div className="space-y-2">
              {termosRetirada.map((termo: any) => (
                <div key={termo.id} className="p-3 bg-slate-950/60 rounded-xl border border-slate-800 text-xs">
                  <div className="flex justify-between items-center mb-1">
                    <span className="font-bold text-white">Termo #{termo.numeroTermo}</span>
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-amber-500/20 text-amber-300">
                      {termo.status}
                    </span>
                  </div>
                  <p className="text-slate-400 text-[11px]">
                    Motivo: <strong>{termo.motivoRetirada}</strong> • Data: {new Date(termo.dataRetirada).toLocaleDateString('pt-BR')}
                  </p>
                  {Array.isArray(termo.itensRetirados) && termo.itensRetirados.length > 0 && (
                    <div className="mt-2 text-[11px] text-slate-300 bg-slate-900/60 p-2 rounded">
                      {termo.itensRetirados.map((it: any, i: number) => (
                        <div key={i}>
                          • {it.quantidade}x {it.item} ({it.estadoConservacao || 'Bom estado'})
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </section>
        )}

      </main>

      {/* Footer */}
      <footer className="text-center text-xs text-slate-400 mt-8">
        Sistema de Gestão & Acompanhamento de Obras • {empresa?.nome || 'Coordenação Técnica'}
      </footer>
    </div>
  );
}

export default function PortalTerceiroPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-slate-950 text-white flex items-center justify-center">
          Carregando portal...
        </div>
      }
    >
      <PortalTerceiroContent />
    </Suspense>
  );
}
