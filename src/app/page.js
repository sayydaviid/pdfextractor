// src/app/page.js

"use client";
import "./globals.css";
import { useState, useCallback, useEffect } from "react";
import PdfSelector from "@/components/PdfSelector";
import Filters from "@/components/Filters";
import { DimensionsBar, ItemsBar } from "@/components/Charts";
import DataTable from "@/components/DataTable";

export default function HomePage() {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [selectedDim, setSelectedDim] = useState(null);
  const [q, setQ] = useState("");

  // Efeito para carregar dados do cache na inicialização
  useEffect(() => {
    try {
      const cachedData = localStorage.getItem('cachedPdfData');
      if (cachedData) {
        console.log("Dados encontrados no cache, carregando...");
        setRows(JSON.parse(cachedData));
      }
    } catch (e) {
      console.error("Falha ao ler o cache:", e);
      localStorage.removeItem('cachedPdfData');
    }
  }, []);

  const handleFileSelected = useCallback(async (file) => {
    if (!file) return;

    setLoading(true);
    setError("");
    setRows([]);
    setSelectedDim(null);
    setQ("");
    
    try {
      const formData = new FormData();
      formData.append("file", file);

      const response = await fetch('/api/process-pdf', {
        method: 'POST',
        body: formData,
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || "Erro desconhecido do servidor.");
      }

      console.log("Análise da IA concluída. Dados encontrados:", result.rows);
      setRows(result.rows);
      
      // Salva os dados no cache após o sucesso
      localStorage.setItem('cachedPdfData', JSON.stringify(result.rows));

      if (result.rows.length === 0) {
        setError("A IA não conseguiu extrair dados estruturados do PDF.");
      }

    } catch (err) {
      console.error("Falha ao enviar PDF para a API:", err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, []);

  // Função para limpar os dados e o cache
  const handleClearData = () => {
    localStorage.removeItem('cachedPdfData');
    setRows([]);
    setError("");
    setSelectedDim(null);
    setQ("");
    console.log("Cache e dados limpos.");
  };

  if (rows.length === 0) {
    return (
      <div className="container">
        <h1>Relatório de Dimensões (PDF → Gráficos com IA)</h1>
        <div className="row">
           <PdfSelector 
            onFileSelected={handleFileSelected} 
            disabled={loading}
          />
          <div className="card">
            <h3>Bem-vindo!</h3>
            <p>Selecione um arquivo PDF para que a IA do Gemini extraia as métricas e gere os relatórios.</p>
            {loading && <p>Analisando PDF com a IA... Isso pode levar alguns segundos.</p>}
            {error && <p className="error">{error}</p>}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="container">
      <div style={{display: 'flex', justifyContent: 'space-between', alignItems: 'center'}}>
        <h1>Relatório de Dimensões</h1>
        <button onClick={handleClearData} style={{height: '40px'}}>Analisar Novo PDF</button>
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