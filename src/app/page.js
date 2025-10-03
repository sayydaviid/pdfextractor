// src/app/page.js

"use client";
import "./globals.css";
import { useState, useCallback, useEffect } from "react";
import PdfSelector from "@/components/PdfSelector";
import RecentFiles from "@/components/RecentFiles";
import Filters from "@/components/Filters";
import { DimensionsBar, ItemsBar } from "@/components/Charts";
import DataTable from "@/components/DataTable";

export default function HomePage() {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(false);
  const [loadingMessage, setLoadingMessage] = useState(""); // Novo estado para mensagens de status
  const [error, setError] = useState("");
  const [selectedDim, setSelectedDim] = useState(null);
  const [q, setQ] = useState("");
  const [fromCache, setFromCache] = useState(false);
  const [recentFiles, setRecentFiles] = useState([]);

  // Efeito para carregar a lista de arquivos recentes do localStorage na inicialização
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

  // Função para salvar um arquivo na lista de recentes
  const saveRecentFile = (fileName, hash) => {
    const newFile = { fileName, hash, timestamp: new Date().toISOString() };
    setRecentFiles(currentFiles => {
      const updatedFiles = [newFile, ...currentFiles.filter(f => f.hash !== hash)].slice(0, 5);
      localStorage.setItem('recentPdfs', JSON.stringify(updatedFiles));
      return updatedFiles;
    });
  };

  // Função central para processar a resposta da API
  const processApiResponse = (result) => {
    if (!result.rows) throw new Error("Resposta da API em formato inesperado.");
    setRows(result.rows);
    setFromCache(result.fromCache || false);
    if (result.hash && result.fileName) saveRecentFile(result.fileName, result.hash);
    if (result.rows.length === 0) setError("A IA não conseguiu extrair dados estruturados do PDF.");
  };

  // Lida com o envio de um NOVO arquivo usando o Vercel Blob
  const handleFileSelected = useCallback(async (file) => {
    if (!file) return;

    setLoading(true);
    setError("");
    setFromCache(false);
    
    try {
      // ETAPA 1: Pedir a URL de upload para a nossa API
      setLoadingMessage("Preparando upload seguro...");
      const uploadUrlResponse = await fetch('/api/upload-blob', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ filename: file.name }),
      });
      const newBlob = await uploadUrlResponse.json();
      if (!uploadUrlResponse.ok) throw new Error(newBlob.error || 'Falha ao preparar o upload.');

      // ETAPA 2: Fazer o upload do arquivo diretamente para a URL do Vercel Blob
      setLoadingMessage("Enviando arquivo (pode demorar para PDFs grandes)...");
      const uploadToBlobResult = await fetch(newBlob.url, {
        method: 'PUT',
        body: file,
        headers: { 'Content-Type': 'application/pdf' },
      });
      if (!uploadToBlobResult.ok) throw new Error('Falha ao enviar o arquivo para o armazenamento.');
      
      // ETAPA 3: Enviar a URL do Blob para nossa API principal para processamento
      setLoadingMessage("Analisando PDF com a IA...");
      const processResponse = await fetch('/api/process-pdf', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ blobUrl: newBlob.url, fileName: file.name }),
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

  // Lida com o clique em um arquivo RECENTE
  const handleRecentFileClick = useCallback(async (hash, fileName) => {
    setLoading(true);
    setLoadingMessage("Buscando dados do cache...");
    setError("");
    setFromCache(false);

    try {
      const response = await fetch('/api/process-pdf', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ hash, fileName }), // Envia como JSON
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

  // Função para limpar a tela
  const handleStartNew = () => {
    setRows([]);
    setError("");
    setSelectedDim(null);
    setQ("");
    setFromCache(false);
  };

  // Tela inicial
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

  // Tela principal com os dados
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