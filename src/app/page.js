// src/app/page.js

"use client";
import "./globals.css";
import { useState, useCallback, useEffect } from "react";
import PdfSelector from "@/components/PdfSelector";
import RecentFiles from "@/components/RecentFiles"; // Importa o novo componente
import Filters from "@/components/Filters";
import { DimensionsBar, ItemsBar } from "@/components/Charts";
import DataTable from "@/components/DataTable";

export default function HomePage() {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [selectedDim, setSelectedDim] = useState(null);
  const [q, setQ] = useState("");
  const [fromCache, setFromCache] = useState(false);
  const [recentFiles, setRecentFiles] = useState([]); // Novo estado para arquivos recentes

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

  // Função para salvar um arquivo na lista de recentes (no estado e no localStorage)
  const saveRecentFile = (fileName, hash) => {
    const newFile = { fileName, hash, timestamp: new Date().toISOString() };
    
    // Atualiza a lista, evitando duplicados e mantendo os 5 mais recentes
    setRecentFiles(currentFiles => {
      const updatedFiles = [newFile, ...currentFiles.filter(f => f.hash !== hash)].slice(0, 5);
      localStorage.setItem('recentPdfs', JSON.stringify(updatedFiles));
      return updatedFiles;
    });
  };

  // Função central para processar a resposta da API
  const processApiResponse = (result) => {
    if (!result.rows) {
      throw new Error("Resposta da API em formato inesperado.");
    }
    console.log("Análise concluída. Dados encontrados:", result.rows);
    setRows(result.rows);
    setFromCache(result.fromCache || false);

    if (result.hash && result.fileName) {
      saveRecentFile(result.fileName, result.hash);
    }

    if (result.rows.length === 0) {
      setError("A IA não conseguiu extrair dados estruturados do PDF.");
    }
  };

  // Lida com o envio de um NOVO arquivo
  const handleFileSelected = useCallback(async (file) => {
    if (!file) return;

    setLoading(true);
    setError("");
    setFromCache(false);
    
    try {
      const formData = new FormData();
      formData.append("file", file);

      const response = await fetch('/api/process-pdf', {
        method: 'POST',
        body: formData,
      });

      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "Erro desconhecido do servidor.");
      
      processApiResponse(result);

    } catch (err) {
      console.error("Falha ao enviar PDF para a API:", err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, []); // Dependências vazias para evitar recriação desnecessária

  // Lida com o clique em um arquivo RECENTE
  const handleRecentFileClick = useCallback(async (hash, fileName) => {
    setLoading(true);
    setError("");
    setFromCache(false);

    try {
      const formData = new FormData();
      formData.append("hash", hash);
      formData.append("fileName", fileName);

      const response = await fetch('/api/process-pdf', {
        method: 'POST',
        body: formData,
      });

      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "Erro desconhecido do servidor.");

      processApiResponse(result);

    } catch (err) {
      console.error("Falha ao buscar PDF recente:", err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, []);

  // Função para limpar a tela e permitir uma nova análise
  const handleStartNew = () => {
    setRows([]);
    setError("");
    setSelectedDim(null);
    setQ("");
    setFromCache(false);
    console.log("Dados da tela limpos para nova análise.");
  };

  // Tela inicial quando não há dados carregados
  if (rows.length === 0) {
    return (
      <div className="container">
        <h1>Relatório de Dimensões (PDF → Gráficos com IA)</h1>
        <div className="row">
           <PdfSelector onFileSelected={handleFileSelected} disabled={loading} />
           <RecentFiles files={recentFiles} onSelect={handleRecentFileClick} disabled={loading} />
        </div>
        {loading && <div className="card">Analisando... Isso pode levar alguns segundos.</div>}
        {error && <div className="card error">{error}</div>}
      </div>
    );
  }

  // Tela principal com os dados e gráficos
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