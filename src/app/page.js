// src/app/page.js

"use client";
import "./globals.css";
import { useState, useCallback } from "react";
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
  const [fromCache, setFromCache] = useState(false); // Estado para rastrear se os dados vieram do cache

  const handleFileSelected = useCallback(async (file) => {
    if (!file) return;

    setLoading(true);
    setError("");
    setFromCache(false); // Reseta o status do cache para cada novo envio
    
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

      console.log("Análise concluída. Dados encontrados:", result.rows);
      setRows(result.rows);
      setFromCache(result.fromCache || false); // Atualiza o status do cache com base na resposta da API

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

  // Tela principal com os dados e gráficos
  return (
    <div className="container">
      <div style={{display: 'flex', justifyContent: 'space-between', alignItems: 'center'}}>
        <h1>Relatório de Dimensões</h1>
        <div>
          {/* Mostra a etiqueta de cache se os dados vieram de lá */}
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