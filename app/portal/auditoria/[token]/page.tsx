'use client';

import React, { useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';

export default function AuditoriaPortal({ params }: { params: { token: string } }) {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [justificativas, setJustificativas] = useState<Record<string, string>>({});
  const [enviando, setEnviando] = useState<Record<string, boolean>>({});

  useEffect(() => {
    carregarDados();
  }, []);

  const carregarDados = async () => {
    try {
      const res = await fetch(`/api/portal/auditoria/${params.token}`);
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'Erro ao carregar');
      setData(json);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  const enviarJustificativa = async (id: string) => {
    if (!justificativas[id]) return;
    
    setEnviando({ ...enviando, [id]: true });
    try {
      const res = await fetch(`/api/portal/auditoria/${params.token}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, justificativa: justificativas[id] })
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'Erro ao enviar');
      
      // Remove a transação respondida da lista
      setData({
        ...data,
        transacoes: data.transacoes.filter((t: any) => t.id !== id)
      });
    } catch (e: any) {
      alert('Erro: ' + e.message);
    } finally {
      setEnviando({ ...enviando, [id]: false });
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-emerald-600"></div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-slate-50 p-6 flex flex-col items-center justify-center">
        <div className="bg-white p-8 rounded-2xl shadow-sm text-center max-w-md w-full border border-slate-100">
          <div className="w-16 h-16 bg-red-100 text-red-500 rounded-full flex items-center justify-center mx-auto mb-4">
            <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
          </div>
          <h2 className="text-xl font-bold text-slate-800 mb-2">Acesso Inválido</h2>
          <p className="text-slate-500">{error}</p>
        </div>
      </div>
    );
  }

  const formatCurrency = (val: number) => {
    return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(val);
  };
  
  const formatDate = (d: string) => {
    if (!d) return '';
    return new Date(d).toLocaleDateString('pt-BR');
  };

  return (
    <div className="min-h-screen bg-slate-50 font-sans">
      <div className="bg-slate-900 text-white pt-12 pb-20 px-6 rounded-b-[2.5rem]">
        <h1 className="text-3xl font-bold mb-2">Auditoria Financeira</h1>
        <p className="text-slate-300">
          {data?.empresa}<br/>
          Você possui <strong>{data?.transacoes?.length}</strong> despesas pendentes de justificativa.
        </p>
      </div>

      <div className="max-w-xl mx-auto px-4 -mt-12 pb-12 space-y-4">
        {data?.transacoes?.length === 0 ? (
          <div className="bg-white p-8 rounded-2xl shadow-sm text-center border border-slate-100">
            <div className="w-16 h-16 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center mx-auto mb-4">
              <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
            </div>
            <h2 className="text-xl font-bold text-slate-800 mb-2">Tudo Certo!</h2>
            <p className="text-slate-500">Nenhuma pendência encontrada para auditoria.</p>
          </div>
        ) : (
          data?.transacoes?.map((t: any) => (
            <div key={t.id} className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden">
              <div className="p-5">
                <div className="flex justify-between items-start mb-3">
                  <div>
                    <span className="text-xs font-semibold px-2.5 py-1 bg-amber-100 text-amber-800 rounded-lg uppercase tracking-wider">A Confirmar</span>
                    <p className="text-xs text-slate-400 mt-2">{formatDate(t.data)}</p>
                  </div>
                  <span className="font-bold text-lg text-slate-800">{formatCurrency(t.valor)}</span>
                </div>
                
                <h3 className="text-slate-800 font-semibold mb-2">{t.descricao}</h3>
                
                <div className="flex flex-wrap gap-2 mb-4">
                  <span className="text-xs bg-slate-100 text-slate-600 px-2 py-1 rounded-md">{t.obra}</span>
                  <span className="text-xs bg-slate-100 text-slate-600 px-2 py-1 rounded-md">{t.contaBancaria}</span>
                </div>
                
                <div className="mt-4">
                  <label className="block text-xs font-medium text-slate-500 mb-2">Sua Justificativa:</label>
                  <textarea 
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl p-3 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 transition-all resize-none"
                    rows={3}
                    placeholder="Ex: Refeição paga em viagem para obra..."
                    value={justificativas[t.id] || ''}
                    onChange={e => setJustificativas({...justificativas, [t.id]: e.target.value})}
                  />
                </div>
                
                <button
                  onClick={() => enviarJustificativa(t.id)}
                  disabled={!justificativas[t.id] || enviando[t.id]}
                  className="w-full mt-4 bg-slate-900 text-white font-medium py-3 rounded-xl disabled:opacity-50 disabled:cursor-not-allowed transition-all active:scale-[0.98]"
                >
                  {enviando[t.id] ? 'Enviando...' : 'Salvar Justificativa'}
                </button>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
