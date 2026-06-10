import { render, screen, fireEvent } from '@testing-library/react';
import FilterSelector from '../FilterSelector';

describe('FilterSelector', () => {
  it('renders the "Todos" default option', () => {
    render(<FilterSelector types={[]} selected="" onChange={jest.fn()} />);

    expect(screen.getByRole('option', { name: 'Todos' })).toBeInTheDocument();
  });

  it('renders an option for each type', () => {
    render(<FilterSelector types={['click', 'view', 'scroll']} selected="" onChange={jest.fn()} />);

    expect(screen.getByRole('option', { name: 'click' })).toBeInTheDocument();
    expect(screen.getByRole('option', { name: 'view' })).toBeInTheDocument();
    expect(screen.getByRole('option', { name: 'scroll' })).toBeInTheDocument();
  });

  it('reflects the selected value', () => {
    render(<FilterSelector types={['click', 'view']} selected="view" onChange={jest.fn()} />);

    expect(screen.getByRole('combobox')).toHaveValue('view');
  });

  it('calls onChange with the selected value', () => {
    const onChange = jest.fn();
    render(<FilterSelector types={['click', 'view']} selected="" onChange={onChange} />);

    fireEvent.change(screen.getByRole('combobox'), { target: { value: 'click' } });

    expect(onChange).toHaveBeenCalledWith('click');
  });

  it('calls onChange with empty string when "Todos" is selected', () => {
    const onChange = jest.fn();
    render(<FilterSelector types={['click', 'view']} selected="click" onChange={onChange} />);

    fireEvent.change(screen.getByRole('combobox'), { target: { value: '' } });

    expect(onChange).toHaveBeenCalledWith('');
  });
});
