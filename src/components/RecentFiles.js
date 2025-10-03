// src/components/RecentFiles.js
"use client";

export default function RecentFiles({ files, onSelect, disabled }) {
  if (!files || files.length === 0) {
    return (
      <div className="card">
        <h3>PDFs Recentes</h3>
        <p className="small">Nenhum arquivo processado recentemente.</p>
      </div>
    );
  }

  return (
    <div className="card">
      <h3>PDFs Recentes</h3>
      <p className="small">Ou selecione um arquivo processado anteriormente para carregar do cache.</p>
      <ul style={{ listStyle: 'none', padding: 0, margin: '10px 0 0 0' }}>
        {files.map(file => (
          <li key={file.hash} style={{ marginBottom: '10px' }}>
            <button 
              onClick={() => onSelect(file.hash, file.fileName)} 
              disabled={disabled}
              style={{ width: '100%', textAlign: 'left', padding: '8px', cursor: 'pointer' }}
            >
              {file.fileName}
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}