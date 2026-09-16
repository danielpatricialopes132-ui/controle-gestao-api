"use client";
import { useState, useEffect } from "react";
import { getEvolutionConnectionState, connectEvolutionInstance, logoutEvolutionInstance } from "@/lib/whatsapp";
import { Loader2, QrCode, Smartphone, LogOut } from "lucide-react";
import Image from "next/image";

export default function WhatsAppConfigPage() {
  const [state, setState] = useState<'open' | 'connecting' | 'close' | 'loading'>('loading');
  const [qrCode, setQrCode] = useState<string | null>(null);

  useEffect(() => { checkStatus(); }, []);
  useEffect(() => {
    let interval: NodeJS.Timeout;
    if (state === 'connecting') interval = setInterval(() => checkStatus(), 5000);
    return () => clearInterval(interval);
  }, [state]);

  const checkStatus = async () => {
    try {
      const res = await getEvolutionConnectionState();
      if (res.state === 'open' || res.state === 'close') { setState(res.state as any); setQrCode(null); }
    } catch (e) {}
  };

  const handleConnect = async () => {
    setState('loading');
    try {
      const res = await connectEvolutionInstance();
      if (res?.base64) { setQrCode(res.base64); setState('connecting'); } else checkStatus();
    } catch (e) { setState('close'); }
  };

  const handleLogout = async () => {
    if (!confirm("Tem certeza que deseja desconectar?")) return;
    setState('loading');
    try { await logoutEvolutionInstance(); setState('close'); setQrCode(null); } 
    catch (e) { checkStatus(); }
  };

  return (
    <div className="p-6 max-w-2xl mx-auto space-y-6">
      <div>
        <h1 className="text-3xl font-bold">WhatsApp / Evolution API</h1>
        <p className="text-gray-500 mt-2">Gerencie a conexão do seu WhatsApp.</p>
      </div>
      <div className="bg-white border rounded-xl overflow-hidden p-6 text-center">
        {state === 'loading' && <Loader2 className="w-10 h-10 animate-spin mx-auto" />}
        {state === 'open' && (
          <div>
            <Smartphone className="w-10 h-10 text-green-500 mx-auto" />
            <h3 className="text-xl font-bold text-green-600 mt-4">Conectado!</h3>
            <button onClick={handleLogout} className="mt-4 px-4 py-2 bg-red-500 text-white rounded-lg">Desconectar</button>
          </div>
        )}
        {state === 'close' && (
          <div>
            <QrCode className="w-10 h-10 text-gray-500 mx-auto" />
            <h3 className="text-xl font-bold mt-4">Desconectado</h3>
            <button onClick={handleConnect} className="mt-4 px-4 py-2 bg-blue-600 text-white rounded-lg">Gerar QR Code</button>
          </div>
        )}
        {state === 'connecting' && qrCode && (
          <div>
            <h3 className="text-xl font-bold mb-4">Escaneie o QR Code</h3>
            <Image src={qrCode.includes('base64') ? qrCode : `data:image/png;base64,${qrCode}`} alt="QR" width={256} height={256} className="mx-auto" />
          </div>
        )}
      </div>
    </div>
  );
}
