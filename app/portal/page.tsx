'use client';

import { useEffect, useState, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';

function PortalClienteContent() {
  const searchParams = useSearchParams();
  const token = searchParams.get('token');

  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!token) {
      setError('Token não fornecido');
      setLoading(false);
      return;
    }

    fetch(`/api/portal/${token}`)
      .then(res => {
        if (!res.ok) throw new Error('Token inválido ou expirado');
        return res.json();
      })
      .then(json => {
        setData(json);
        setLoading(false);
      })
      .catch(err => {
        setError(err.message);
        setLoading(false);
      });
  }, [token]);

  if (loading) {
    return <div className="min-h-screen flex items-center justify-center">Carregando portal...</div>;
  }

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center flex-col">
        <h1 className="text-2xl font-bold text-red-600 mb-4">Acesso Negado</h1>
        <p>{error}</p>
      </div>
    );
  }

  if (!data) return null;

  return (
    <div className="min-h-screen bg-gray-50 text-gray-800 font-sans">
      <header className="bg-white shadow">
        <div className="max-w-7xl mx-auto py-6 px-4 sm:px-6 lg:px-8 flex justify-between items-center">
          <h1 className="text-2xl font-bold text-indigo-600">Portal do Cliente</h1>
          <p className="text-sm text-gray-500">Logado como: {data.cliente.nome}</p>
        </div>
      </header>

      <main className="max-w-7xl mx-auto py-6 sm:px-6 lg:px-8">
        <div className="px-4 py-6 sm:px-0">
          
          <h2 className="text-xl font-semibold mb-4">Propostas ({data.propostas.length})</h2>
          <div className="bg-white shadow overflow-hidden sm:rounded-md mb-8">
            <ul className="divide-y divide-gray-200">
              {data.propostas.map((prop: any) => (
                <li key={prop.id} className="p-4">
                  <div className="flex justify-between">
                    <div>
                      <p className="text-sm font-medium text-indigo-600 truncate">{prop.titulo}</p>
                      <p className="text-sm text-gray-500">Status: {prop.status}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-sm text-gray-900 font-bold">R$ {prop.valorTotal?.toFixed(2)}</p>
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          </div>

          <h2 className="text-xl font-semibold mb-4">Obras em Andamento ({data.obras.length})</h2>
          {data.obras.map((obra: any) => (
            <div key={obra.id} className="bg-white shadow sm:rounded-lg mb-8 p-6">
              <h3 className="text-lg font-bold mb-2">{obra.nome}</h3>
              <p className="text-gray-600 mb-6">{obra.descricao}</p>

              <h4 className="font-semibold text-gray-700 mb-2">Cronograma Físico</h4>
              {obra.etapasCronograma.length === 0 ? (
                <p className="text-sm text-gray-500 mb-4">Nenhuma etapa cadastrada.</p>
              ) : (
                <ul className="mb-6 space-y-2">
                  {obra.etapasCronograma.map((etapa: any) => (
                    <li key={etapa.id} className="flex flex-col mb-2">
                      <div className="flex justify-between text-sm mb-1">
                        <span>{etapa.nome}</span>
                        <span className="font-medium text-indigo-600">{etapa.percentualConclusao}%</span>
                      </div>
                      <div className="w-full bg-gray-200 rounded-full h-2">
                        <div
                          className="bg-indigo-600 h-2 rounded-full"
                          style={{ width: `${etapa.percentualConclusao}%` }}
                        ></div>
                      </div>
                    </li>
                  ))}
                </ul>
              )}

              <h4 className="font-semibold text-gray-700 mb-2">Documentos e Plantas</h4>
              {obra.documentos.length === 0 ? (
                <p className="text-sm text-gray-500 mb-4">Nenhum documento anexado.</p>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4 mb-6">
                  {obra.documentos.map((doc: any) => (
                    <a key={doc.id} href={doc.url} target="_blank" rel="noreferrer" className="flex items-center p-3 border rounded hover:bg-gray-50">
                      <svg className="w-6 h-6 text-gray-400 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13"></path></svg>
                      <span className="text-sm text-blue-600 truncate">{doc.nome}</span>
                    </a>
                  ))}
                </div>
              )}
              
              <h4 className="font-semibold text-gray-700 mb-2">Galeria de Fotos</h4>
              {obra.fotos.length === 0 ? (
                <p className="text-sm text-gray-500">Nenhuma foto registrada.</p>
              ) : (
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
                  {obra.fotos.map((foto: any) => (
                    <div key={foto.id} className="relative group">
                      <img src={foto.url} alt={foto.descricao || 'Foto da obra'} className="w-full h-32 object-cover rounded shadow-sm" />
                      {foto.descricao && (
                        <div className="absolute bottom-0 left-0 right-0 bg-black bg-opacity-50 text-white text-xs p-1 opacity-0 group-hover:opacity-100 transition-opacity">
                          {foto.descricao}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}

            </div>
          ))}

        </div>
      </main>
    </div>
  );
}

export default function PortalCliente() {
  return (
    <Suspense fallback={<div className="min-h-screen flex items-center justify-center">Carregando portal...</div>}>
      <PortalClienteContent />
    </Suspense>
  );
}
