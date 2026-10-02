'use client';

import { useEffect, useState, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';

function PortalClienteContent() {
  const searchParams = useSearchParams();
  const token = searchParams.get('token');

  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [abaAtiva, setAbaAtiva] = useState<'timeline' | 'revistas' | 'cronograma' | 'documentos'>('timeline');

  useEffect(() => {
    if (!token) {
      setError('Token de acesso não fornecido ou link expirado.');
      setLoading(false);
      return;
    }

    fetch(`/api/portal/${token}`)
      .then((res) => {
        if (!res.ok) throw new Error('Acesso não autorizado ou link inválido.');
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
  }, [token]);

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col items-center justify-center space-y-4">
        <div className="w-12 h-12 border-4 border-teal-500 border-t-transparent rounded-full animate-spin"></div>
        <p className="text-slate-400 font-medium">Carregando Minha Obra...</p>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="min-h-screen bg-slate-950 text-slate-100 flex items-center justify-center p-6">
        <div className="max-w-md w-full bg-slate-900 border border-red-900/50 rounded-2xl p-8 text-center shadow-2xl">
          <div className="w-16 h-16 bg-red-500/10 text-red-400 rounded-full flex items-center justify-center mx-auto mb-4">
            <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
          </div>
          <h1 className="text-xl font-bold text-white mb-2">Acesso Não Encontrado</h1>
          <p className="text-sm text-slate-400">{error || 'Não foi possível carregar os dados desta obra.'}</p>
        </div>
      </div>
    );
  }

  const { cliente, empresa, obras = [] } = data;
  const obraPrincipal = obras[0] || null;

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col font-sans selection:bg-teal-500 selection:text-white">
      {/* Header Premium White-Label */}
      <header className="sticky top-0 z-30 bg-slate-900/80 backdrop-blur-md border-b border-slate-800">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 h-20 flex items-center justify-between">
          <div className="flex items-center space-x-3">
            {empresa.logoUrl ? (
              <img src={empresa.logoUrl} alt={empresa.nome} className="h-10 w-auto object-contain rounded" />
            ) : (
              <div className="h-10 w-10 bg-teal-600 rounded-xl flex items-center justify-center font-bold text-white shadow-lg shadow-teal-500/20">
                {empresa.nome?.charAt(0) || 'E'}
              </div>
            )}
            <div>
              <span className="text-xs uppercase tracking-wider text-teal-400 font-semibold">Minha Obra</span>
              <h1 className="text-base sm:text-lg font-bold text-white leading-tight">{empresa.nome}</h1>
            </div>
          </div>
          <div className="text-right">
            <span className="text-xs text-slate-400 block">Investidor / Proprietário</span>
            <span className="text-sm font-semibold text-slate-200">{cliente.nome}</span>
          </div>
        </div>
      </header>

      {/* Hero Obra */}
      {obraPrincipal && (
        <div className="bg-gradient-to-b from-slate-900 to-slate-950 border-b border-slate-800/80 py-8 px-4 sm:px-6">
          <div className="max-w-5xl mx-auto">
            <div className="flex flex-col md:flex-row md:items-end justify-between gap-6">
              <div>
                <span className="inline-block px-3 py-1 bg-teal-500/10 text-teal-400 border border-teal-500/20 rounded-full text-xs font-semibold mb-3">
                  {obraPrincipal.status === 'EM_ANDAMENTO' ? '🟢 Em Execução' : obraPrincipal.status}
                </span>
                <h2 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight">{obraPrincipal.nome}</h2>
                <p className="text-slate-400 text-sm mt-1">{obraPrincipal.endereco || 'Endereço não informado'}</p>
              </div>

              {/* Indicador de Status Geral */}
              <div className="flex items-center gap-4 bg-slate-900/90 border border-slate-800 p-4 rounded-2xl shadow-xl">
                <div>
                  <span className="text-xs text-slate-400 block">Fotos Registradas</span>
                  <span className="text-xl font-bold text-white">{obraPrincipal.fotos?.length || 0}</span>
                </div>
                <div className="h-8 w-px bg-slate-800"></div>
                <div>
                  <span className="text-xs text-slate-400 block">Revistas Emitidas</span>
                  <span className="text-xl font-bold text-teal-400">{obraPrincipal.revistas?.length || 0}</span>
                </div>
                <div className="h-8 w-px bg-slate-800"></div>
                <div>
                  <span className="text-xs text-slate-400 block">Documentos</span>
                  <span className="text-xl font-bold text-white">{obraPrincipal.documentos?.length || 0}</span>
                </div>
              </div>
            </div>

            {/* Menu de Abas */}
            <div className="flex space-x-2 mt-8 overflow-x-auto pb-2 scrollbar-none">
              <button
                onClick={() => setAbaAtiva('timeline')}
                className={`px-4 py-2 rounded-xl text-sm font-medium transition-all ${
                  abaAtiva === 'timeline'
                    ? 'bg-teal-500 text-slate-950 font-bold shadow-lg shadow-teal-500/20'
                    : 'bg-slate-900 text-slate-400 hover:text-white hover:bg-slate-800'
                }`}
              >
                📸 Feed & Fotos
              </button>
              <button
                onClick={() => setAbaAtiva('revistas')}
                className={`px-4 py-2 rounded-xl text-sm font-medium transition-all ${
                  abaAtiva === 'revistas'
                    ? 'bg-teal-500 text-slate-950 font-bold shadow-lg shadow-teal-500/20'
                    : 'bg-slate-900 text-slate-400 hover:text-white hover:bg-slate-800'
                }`}
              >
                📰 Revistas Executivas ({obraPrincipal.revistas?.length || 0})
              </button>
              <button
                onClick={() => setAbaAtiva('cronograma')}
                className={`px-4 py-2 rounded-xl text-sm font-medium transition-all ${
                  abaAtiva === 'cronograma'
                    ? 'bg-teal-500 text-slate-950 font-bold shadow-lg shadow-teal-500/20'
                    : 'bg-slate-900 text-slate-400 hover:text-white hover:bg-slate-800'
                }`}
              >
                📊 Cronograma Físico
              </button>
              <button
                onClick={() => setAbaAtiva('documentos')}
                className={`px-4 py-2 rounded-xl text-sm font-medium transition-all ${
                  abaAtiva === 'documentos'
                    ? 'bg-teal-500 text-slate-950 font-bold shadow-lg shadow-teal-500/20'
                    : 'bg-slate-900 text-slate-400 hover:text-white hover:bg-slate-800'
                }`}
              >
                📁 Plantas & Documentos
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Conteúdo Dinâmico */}
      <main className="max-w-5xl mx-auto px-4 sm:px-6 py-8 flex-1 w-full">
        {obraPrincipal ? (
          <>
            {/* ABA 1: FEED DE FOTOS */}
            {abaAtiva === 'timeline' && (
              <div className="space-y-6">
                <h3 className="text-lg font-bold text-white flex items-center gap-2">
                  <span>Galeria de Evolução da Obra</span>
                </h3>
                {obraPrincipal.fotos?.length === 0 ? (
                  <div className="text-center py-16 bg-slate-900/50 rounded-2xl border border-slate-800">
                    <p className="text-slate-500">Nenhuma foto adicionada até o momento.</p>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-6">
                    {obraPrincipal.fotos.map((foto: any) => (
                      <div
                        key={foto.id}
                        className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden shadow-lg group hover:border-slate-700 transition-all"
                      >
                        <div className="relative aspect-video overflow-hidden bg-slate-950">
                          <img
                            src={foto.url}
                            alt={foto.descricao || 'Foto da obra'}
                            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                          />
                        </div>
                        {foto.descricao && (
                          <div className="p-4">
                            <p className="text-sm text-slate-300 line-clamp-2">{foto.descricao}</p>
                            <span className="text-xs text-slate-500 mt-2 block">
                              {new Date(foto.createdAt).toLocaleDateString('pt-BR')}
                            </span>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* ABA 2: REVISTAS EXECUTIVAS */}
            {abaAtiva === 'revistas' && (
              <div className="space-y-6">
                <h3 className="text-lg font-bold text-white">Relatórios & Revistas Executivas da Obra</h3>
                {obraPrincipal.revistas?.length === 0 ? (
                  <div className="text-center py-16 bg-slate-900/50 rounded-2xl border border-slate-800">
                    <p className="text-slate-500">Nenhuma revista publicada até agora.</p>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    {obraPrincipal.revistas.map((rev: any) => (
                      <div
                        key={rev.id}
                        className="bg-slate-900 border border-slate-800 rounded-2xl p-6 flex flex-col justify-between hover:border-teal-500/40 transition-all shadow-xl"
                      >
                        <div>
                          <div className="flex justify-between items-start mb-3">
                            <span className="px-2.5 py-1 bg-teal-500/10 text-teal-400 text-xs font-semibold rounded-md border border-teal-500/20">
                              {rev.tipoPeriodicidade === 'SEMANAL' ? 'Boletim Semanal' : 'Revista Mensal'}
                            </span>
                            <span className="text-xs text-slate-400 font-mono">{rev.periodoReferencia}</span>
                          </div>
                          <h4 className="text-base font-bold text-white mb-2">{rev.titulo}</h4>
                          {rev.editorial && (
                            <p className="text-xs text-slate-400 line-clamp-3 mb-4">{rev.editorial}</p>
                          )}
                          <div className="flex items-center gap-4 text-xs text-slate-400 mb-6">
                            <span>☀️ {rev.climaDiasSol} dias de sol</span>
                            <span>🌧️ {rev.climaDiasChuva} dias de chuva</span>
                            <span className="text-teal-400 font-semibold">{rev.percentualAvanco}% avanço</span>
                          </div>
                        </div>

                        {rev.pdfUrl && (
                          <a
                            href={rev.pdfUrl}
                            target="_blank"
                            rel="noreferrer"
                            className="inline-flex items-center justify-center gap-2 w-full py-3 bg-slate-800 hover:bg-teal-600 text-white rounded-xl text-xs font-bold transition-colors"
                          >
                            <span>Visualizar Revista em PDF (Alta Resolução)</span>
                            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M14 5l7 7m0 0l-7 7m7-7H3" />
                            </svg>
                          </a>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* ABA 3: CRONOGRAMA */}
            {abaAtiva === 'cronograma' && (
              <div className="space-y-6">
                <h3 className="text-lg font-bold text-white">Evolução Físico-Financeira</h3>
                {obraPrincipal.etapasCronograma?.length === 0 ? (
                  <div className="text-center py-16 bg-slate-900/50 rounded-2xl border border-slate-800">
                    <p className="text-slate-500">Cronograma em elaboração pela engenharia.</p>
                  </div>
                ) : (
                  <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 space-y-4 shadow-xl">
                    {obraPrincipal.etapasCronograma.map((etapa: any) => (
                      <div key={etapa.id} className="border-b border-slate-800/60 pb-4 last:border-0 last:pb-0">
                        <div className="flex justify-between items-center text-sm mb-2">
                          <span className="font-semibold text-slate-200">{etapa.nome}</span>
                          <span className="font-mono text-teal-400 font-bold">{etapa.percentualConclusao}%</span>
                        </div>
                        <div className="w-full bg-slate-950 rounded-full h-2.5 overflow-hidden">
                          <div
                            className="bg-teal-500 h-2.5 rounded-full transition-all duration-500 shadow-sm"
                            style={{ width: `${etapa.percentualConclusao}%` }}
                          ></div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* ABA 4: DOCUMENTOS */}
            {abaAtiva === 'documentos' && (
              <div className="space-y-6">
                <h3 className="text-lg font-bold text-white">Plantas e Documentações Técnicas</h3>
                {obraPrincipal.documentos?.length === 0 ? (
                  <div className="text-center py-16 bg-slate-900/50 rounded-2xl border border-slate-800">
                    <p className="text-slate-500">Nenhum documento compartilhado no momento.</p>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    {obraPrincipal.documentos.map((doc: any) => (
                      <a
                        key={doc.id}
                        href={doc.url}
                        target="_blank"
                        rel="noreferrer"
                        className="flex items-center p-4 bg-slate-900 border border-slate-800 hover:border-slate-700 rounded-2xl transition-all group"
                      >
                        <div className="w-10 h-10 rounded-xl bg-slate-800 text-teal-400 flex items-center justify-center mr-4 group-hover:bg-teal-500 group-hover:text-slate-950 transition-colors">
                          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
                          </svg>
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-semibold text-white truncate">{doc.nome}</p>
                          <span className="text-xs text-slate-400">{doc.tipo || 'Documento'}</span>
                        </div>
                      </a>
                    ))}
                  </div>
                )}
              </div>
            )}
          </>
        ) : (
          <div className="text-center py-20">
            <p className="text-slate-400">Nenhuma obra vinculada a este perfil.</p>
          </div>
        )}
      </main>

      {/* Footer Minimalista */}
      <footer className="border-t border-slate-900 py-6 text-center text-xs text-slate-600">
        Plataforma Minha Obra • Desenvolvido por {empresa.nome}
      </footer>
    </div>
  );
}

export default function PortalCliente() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-slate-950 text-slate-100 flex items-center justify-center">
          <div className="w-10 h-10 border-4 border-teal-500 border-t-transparent rounded-full animate-spin"></div>
        </div>
      }
    >
      <PortalClienteContent />
    </Suspense>
  );
}
