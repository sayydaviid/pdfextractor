// src/components/Charts.js
"use client";
import { useMemo } from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';

// Funções para preparar os dados para os gráficos
function getDimensionsData(rows) {
  return rows
    .filter(r => r.item_code === null && r.dimension_number !== null)
    .map(r => ({
      name: `Dim. ${r.dimension_number}`,
      num: r.dimension_number,
      title: r.dimension_title,
      Média: r.dimension_mean,
    }))
    .sort((a, b) => a.num - b.num);
}

function getItemsData(rows, dimension, q) {
  const query = (q || "").toLowerCase();
  return rows
    .filter(r => 
      r.item_code !== null &&
      (!dimension || r.dimension_number === dimension) &&
      (!query || r.item_code.toLowerCase().includes(query) || r.item_text.toLowerCase().includes(query))
    )
    .map(r => ({
      name: r.item_code,
      text: r.item_text,
      Nota: r.item_score,
    }));
}

export function DimensionsBar({ rows, onSelect }) {
  const data = useMemo(() => getDimensionsData(rows), [rows]);

  return (
    <ResponsiveContainer width="100%" height={300}>
      <BarChart data={data} margin={{ top: 5, right: 20, left: -10, bottom: 5 }}>
        <CartesianGrid strokeDasharray="3 3" />
        <XAxis dataKey="name" />
        <YAxis domain={[0, 5]} />
        <Tooltip />
        <Legend />
        <Bar dataKey="Média" fill="#8884d8" onClick={(payload) => onSelect(payload.num)} style={{ cursor: 'pointer' }} />
      </BarChart>
    </ResponsiveContainer>
  );
}

export function ItemsBar({ rows, dimension, q }) {
  const data = useMemo(() => getItemsData(rows, dimension, q), [rows, dimension, q]);

  if (data.length === 0) {
    return <div>Nenhum item encontrado para os filtros selecionados.</div>
  }

  return (
    <ResponsiveContainer width="100%" height={300}>
      <BarChart data={data} margin={{ top: 5, right: 20, left: -10, bottom: 5 }}>
        <CartesianGrid strokeDasharray="3 3" />
        <XAxis dataKey="name" />
        <YAxis domain={[0, 5]} />
        <Tooltip contentStyle={{maxWidth: "300px", whiteSpace: "normal"}} formatter={(value, name, props) => [`${value} - ${props.payload.text}`, name]} />
        <Legend />
        <Bar dataKey="Nota" fill="#82ca9d" />
      </BarChart>
    </ResponsiveContainer>
  );
}