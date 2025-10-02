// src/components/DataTable.js
"use client";
import { useMemo } from 'react';
import styles from './DataTable.module.css'; // Vamos criar um CSS simples

// Função para filtrar os itens
function getFilteredItems(rows, dimension, q) {
  const query = (q || "").toLowerCase();
  return rows
    .filter(r => 
      r.item_code !== null &&
      (!dimension || r.dimension_number === dimension) &&
      (!query || r.item_code.toLowerCase().includes(query) || r.item_text.toLowerCase().includes(query))
    );
}

export default function DataTable({ rows, dimension, q }) {
  const filteredData = useMemo(() => getFilteredItems(rows, dimension, q), [rows, dimension, q]);

  if (filteredData.length === 0) {
    return (
      <div className="card">
        <h3>Tabela de Itens</h3>
        <p>Nenhum item para exibir com os filtros atuais.</p>
      </div>
    );
  }

  return (
    <div className={`card ${styles.tableContainer}`}>
      <h3>Tabela de Itens</h3>
      <table className={styles.dataTable}>
        <thead>
          <tr>
            <th>Código</th>
            <th>Item</th>
            <th>Nota</th>
          </tr>
        </thead>
        <tbody>
          {filteredData.map((row) => (
            <tr key={row.item_code}>
              <td>{row.item_code}</td>
              <td>{row.item_text}</td>
              <td>{row.item_score?.toFixed(2)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}