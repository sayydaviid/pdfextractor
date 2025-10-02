// src/components/PdfSelector.js

"use client";
import { useState } from "react";

export default function PdfSelector({ onFileSelected, disabled = false }) {
  const [fileName, setFileName] = useState("");

  function handleFileChange(event) {
    const file = event.target.files?.[0];
    if (file) {
      setFileName(file.name);
      onFileSelected(file);
    }
  }

  return (
    <div className="card">
      <h3>Selecionar PDF</h3>
      <p className="small">
        Escolha um arquivo PDF do seu computador para ser processado localmente.
      </p>
      <input
        type="file"
        accept="application/pdf"
        onChange={handleFileChange}
        disabled={disabled}
      />
      {fileName && <p className="small" style={{ marginTop: '10px' }}>Arquivo selecionado: <strong>{fileName}</strong></p>}
    </div>
  );
}