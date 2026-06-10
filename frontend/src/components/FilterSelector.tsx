import React from 'react';

interface Props {
  types: string[];
  selected: string; // string vacío significa "sin filtro activo"
  onChange: (type: string) => void;
  id?: string;
}

const FilterSelector: React.FC<Props> = ({ types, selected, onChange, id }) => (
  <select id={id} value={selected} onChange={e => onChange(e.target.value)}>
    <option value="">Todos</option>
    {types.map(t => (
      <option key={t} value={t}>{t}</option>
    ))}
  </select>
);

export default FilterSelector;
