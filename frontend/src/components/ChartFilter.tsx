import { FC } from 'react';

interface Props {
  types: string[];
  selected: string[];       // tipos actualmente marcados
  colorMap: Record<string, string>;
  onChange: (selected: string[]) => void;
}

const ChartFilter: FC<Props> = ({ types, selected, colorMap, onChange }) => {
  const toggle = (type: string) => {
    onChange(
      selected.includes(type)
        ? selected.filter(t => t !== type)
        : [...selected, type]
    );
  };

  return (
    <div className="chart-filter">
      {types.map(type => (
        <label key={type} className="checkbox-label">
          <input
            type="checkbox"
            checked={selected.includes(type)}
            onChange={() => toggle(type)}
          />
          <span className="checkbox-dot" style={{ background: colorMap[type] }} />
          {type}
        </label>
      ))}
    </div>
  );
};

export default ChartFilter;
