// src/app/page.js

"use client";
import "./globals.css";
import { useState, useCallback, useEffect } from "react";
import PdfSelector from "@/components/PdfSelector";
import RecentFiles from "@/components/RecentFiles";
import Filters from "@/components/Filters";
import { DimensionsBar, ItemsBar } from "@/components/Charts";
import DataTable from "@/components/DataTable";

// >>> IMPORTANTE: usar upload() do cliente
import { upload } from "@vercel/blob/client";

export default function HomePage() {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(false);
  const [loadingMessage, setLoadingMessage] = useState("");
  const [error, setError] = useState("");
  const [selectedDim, setSelectedDim] = useState(null);
  const [q, setQ] = useState("");
  const [fromCache, setFromCache] = useState(false);
  const [recentFiles, setRecentFiles] = useState([]);

  useEffect(() => {
    try {
      const cachedFiles = localStorage.getItem('recentPdfs');
      if (cachedFiles) {
        setRecentFiles(JSON.parse(cachedFiles));
      }
    } catch (e) {
      console.error("Falha ao ler a lista de arquivos recentes:", e);
      localStorage.removeItem('recentPdfs');
    }
  }, []);

  const saveRecentFile = (fileName, hash) => {
    const newFile = { fileName, hash, timestamp: new Date().toISOString() };
    setRecentFiles(currentFiles => {
      const updatedFiles = [newFile, ...currentFiles.filter(f => f.hash !== hash)].slice(0, 5);
      localStorage.setItem('recentPdfs', JSON.stringify(updatedFiles));
      return updatedFiles;
    });
  };

  const processApiResponse = (result) => {
    if (!result.rows) throw new Error("Resposta da API em formato inesperado.");
    setRows(result.rows);
    setFromCache(result.fromCache || false);
    if (result.hash && result.fileName) saveRecentFile(result.fileName, result.hash);
    if (result.rows.length === 0) setError("A IA não conseguiu extrair dados estruturados do PDF.");
  };

  // >>> NOVO FLUXO: Upload direto do cliente com token gerado pela rota
  const handleFileSelected = useCallback(async (file) => {
    if (!file) return;

    setLoading(true);
    setError("");
    setFromCache(false);

    try {
      // ETAPA 1: Enviar o arquivo direto para o Blob (client-side)
      setLoadingMessage("Enviando arquivo com token seguro...");
      const { url: blobUrl /*, pathname, size, uploadedAt */ } = await upload(file.name, file, {
        access: 'public',                      // ou 'private'
        handleUploadUrl: '/api/upload-blob',   // a rota acima
        // clientPayload: 'qualquer-string-opcional',
        // contentType: 'application/pdf', // inferido automaticamente
      });

      // ETAPA 2: Processar o PDF no seu backend usando a URL do Blob
      setLoadingMessage("Analisando PDF com a IA...");
      const processResponse = await fetch('/api/process-pdf', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ blobUrl, fileName: file.name }),
      });

      const result = await processResponse.json();
      if (!processResponse.ok) throw new Error(result.error || "Erro na análise do PDF.");
      processApiResponse(result);

    } catch (err) {
      console.error("Falha no processo:", err);
      setError(err.message);
    } finally {
      setLoading(false);
      setLoadingMessage("");
    }
  }, []);

  const handleRecentFileClick = useCallback(async (hash, fileName) => {
    setLoading(true);
    setLoadingMessage("Buscando dados do cache...");
    setError("");
    setFromCache(false);

    try {
      const response = await fetch('/api/process-pdf', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ hash, fileName }),
      });

      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "Erro desconhecido do servidor.");

      processApiResponse(result);

    } catch (err) {
      console.error("Falha ao buscar PDF recente:", err);
      setError(err.message);
    } finally {
      setLoading(false);
      setLoadingMessage("");
    }
  }, []);

  const handleStartNew = () => {
    setRows([]);
    setError("");
    setSelectedDim(null);
    setQ("");
    setFromCache(false);
  };

  if (rows.length === 0) {
    return (
      <div className="container">
        <h1>Relatório de Dimensões (PDF → Gráficos com IA)</h1>
        <div className="row">
           <PdfSelector onFileSelected={handleFileSelected} disabled={loading} />
           <RecentFiles files={recentFiles} onSelect={handleRecentFileClick} disabled={loading} />
        </div>
        {loading && <div className="card">{loadingMessage}</div>}
        {error && <div className="card error">{error}</div>}
      </div>
    );
  }

  return (
    <div className="container">
      <div style={{display: 'flex', justifyContent: 'space-between', alignItems: 'center'}}>
        <h1>Relatório de Dimensões</h1>
        <div>
          {fromCache && (
            <span style={{marginRight: '15px', background: '#e0f2fe', color: '#0ea5e9', padding: '5px 10px', borderRadius: '15px', fontSize: '12px', fontWeight: 'bold'}}>
              Cache
            </span>
          )}
          <button onClick={handleStartNew} style={{height: '40px'}}>Analisar Novo PDF</button>
        </div>
      </div>
      
      <div className="row">
        <div className="card">
          <h3>Dimensões</h3>
          <DimensionsBar rows={rows} onSelect={setSelectedDim}/>
        </div>
        <Filters rows={rows} selectedDim={selectedDim} setSelectedDim={setSelectedDim} q={q} setQ={setQ} />
      </div>

      <div className="row">
        <div className="card">
          <h3>Itens ({selectedDim ? `Dimensão ${selectedDim}` : 'Geral'})</h3>
          <ItemsBar rows={rows} dimension={selectedDim} q={q}/>
        </div>
        <DataTable rows={rows} dimension={selectedDim} q={q} />
      </div>
    </div>
  );
}
