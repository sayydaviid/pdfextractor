// src/components/Filters.js
"use client";
import { useMemo } from 'react';

// Função para extrair as dimensões dos dados
function getDimensions(rows) {
  return rows
    .filter(r => r.item_code === null && r.dimension_number !== null)
    .map(r => ({
      num: Number(r.dimension_number),
      title: r.dimension_title || `Dimensão ${r.dimension_number}`,
    }))
    .sort((a, b) => a.num - b.num);
}

export default function Filters({ rows, selectedDim, setSelectedDim, q, setQ }) {
  const dimensions = useMemo(() => getDimensions(rows), [rows]);

  return (
     <div className="card">
        <h3>Filtros</h3>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
          <div>
            <label htmlFor="dimension-select" style={{ display: 'block', marginBottom: '5px' }}>Filtrar por Dimensão</label>
            <select
              id="dimension-select"
              value={selectedDim || ''}
              onChange={(e) => setSelectedDim(e.target.value ? Number(e.target.value) : null)}
              style={{ width: '100%', padding: '8px' }}
            >
              <option value="">Todas as Dimensões</option>
              {dimensions.map(dim => (
                <option key={dim.num} value={dim.num}>
                  Dimensão {dim.num}: {dim.title}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label htmlFor="search-input" style={{ display: 'block', marginBottom: '5px' }}>Buscar por Item</label>
            <input
              type="search"
              id="search-input"
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Digite o código ou texto do item..."
              style={{ width: '100%', padding: '8px' }}
            />
          </div>
        </div>
     </div>
  );
}