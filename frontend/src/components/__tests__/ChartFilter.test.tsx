import { render, screen, fireEvent } from '@testing-library/react';
import ChartFilter from '../ChartFilter';

const colorMap = { click: '#4f46e5', view: '#10b981', scroll: '#f59e0b' };

describe('ChartFilter', () => {
  it('renders a checkbox for each type', () => {
    render(
      <ChartFilter
        types={['click', 'view', 'scroll']}
        selected={[]}
        colorMap={colorMap}
        onChange={jest.fn()}
      />
    );

    expect(screen.getByLabelText('click')).toBeInTheDocument();
    expect(screen.getByLabelText('view')).toBeInTheDocument();
    expect(screen.getByLabelText('scroll')).toBeInTheDocument();
  });

  it('checks boxes for selected types', () => {
    render(
      <ChartFilter
        types={['click', 'view', 'scroll']}
        selected={['click', 'scroll']}
        colorMap={colorMap}
        onChange={jest.fn()}
      />
    );

    expect(screen.getByLabelText('click')).toBeChecked();
    expect(screen.getByLabelText('scroll')).toBeChecked();
    expect(screen.getByLabelText('view')).not.toBeChecked();
  });

  it('adds a type to selected when an unchecked box is clicked', () => {
    const onChange = jest.fn();
    render(
      <ChartFilter
        types={['click', 'view']}
        selected={['click']}
        colorMap={colorMap}
        onChange={onChange}
      />
    );

    fireEvent.click(screen.getByLabelText('view'));

    expect(onChange).toHaveBeenCalledWith(['click', 'view']);
  });

  it('removes a type from selected when a checked box is clicked', () => {
    const onChange = jest.fn();
    render(
      <ChartFilter
        types={['click', 'view']}
        selected={['click', 'view']}
        colorMap={colorMap}
        onChange={onChange}
      />
    );

    fireEvent.click(screen.getByLabelText('click'));

    expect(onChange).toHaveBeenCalledWith(['view']);
  });

  it('renders nothing when types array is empty', () => {
    const { container } = render(
      <ChartFilter types={[]} selected={[]} colorMap={{}} onChange={jest.fn()} />
    );

    expect(container.querySelectorAll('input[type="checkbox"]')).toHaveLength(0);
  });
});
