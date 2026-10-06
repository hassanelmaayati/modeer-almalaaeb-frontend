import { fireEvent, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState } from 'react';
import { describe, expect, it, vi } from 'vitest';
import DateTimeInput from '../../src/components/common/DateTimeInput';
import Select from '../../src/components/common/Select';

const trigger = container => container.querySelector('.ui-trigger');
// The real select's own options are exposed too, so look inside the open menu.
const inMenu = () => within(screen.getByRole('listbox'));

function SportSelect({ onChange = () => {}, ...props }) {
  const [value, setValue] = useState('');
  return <label>Sport
    <Select name="sport" value={value} onChange={event => { setValue(event.target.value); onChange(event); }} {...props}>
      <option value="" disabled>Select a sport</option>
      <option value="1">Football</option>
      <option value="2">Basketball</option>
      <option value="3" disabled>Closed sport</option>
    </Select>
  </label>;
}

describe('Select', () => {
  it('keeps the real select for forms and labels, and shows a styled button instead of the browser dropdown', () => {
    const { container } = render(<SportSelect />);
    const native = screen.getByLabelText('Sport');
    expect(native.tagName).toBe('SELECT');
    expect(native).toHaveValue('');
    expect(trigger(container)).toHaveTextContent('Select a sport');
    expect(screen.queryByRole('listbox')).not.toBeInTheDocument();
  });

  it('opens a menu on click, hides the placeholder hint, and picks an option through the real select', async () => {
    const onChange = vi.fn();
    const { container } = render(<SportSelect onChange={onChange} />);
    await userEvent.click(trigger(container));
    const menu = screen.getByRole('listbox');
    expect(inMenu().getAllByRole('option').map(option => option.textContent)).toEqual(['Football', 'Basketball', 'Closed sport']);
    expect(inMenu().getByRole('option', { name: 'Closed sport' })).toHaveAttribute('aria-disabled', 'true');
    await userEvent.click(inMenu().getByRole('option', { name: 'Basketball' }));
    expect(onChange).toHaveBeenCalledOnce();
    expect(screen.getByLabelText('Sport')).toHaveValue('2');
    expect(trigger(container)).toHaveTextContent('Basketball');
    expect(menu).not.toBeInTheDocument();
  });

  it('does not pick a disabled option', async () => {
    const { container } = render(<SportSelect />);
    await userEvent.click(trigger(container));
    await userEvent.click(inMenu().getByRole('option', { name: 'Closed sport' }));
    expect(screen.getByLabelText('Sport')).toHaveValue('');
    expect(screen.getByRole('listbox')).toBeInTheDocument();
  });

  it('can be driven from the keyboard: Space opens, arrows move, Enter picks, Escape closes', async () => {
    render(<SportSelect />);
    const native = screen.getByLabelText('Sport');
    native.focus();
    await userEvent.keyboard(' ');
    expect(screen.getByRole('listbox')).toBeInTheDocument();
    await userEvent.keyboard('{ArrowDown}{Enter}');
    expect(native).toHaveValue('2');
    await userEvent.keyboard(' ');
    expect(screen.getByRole('listbox')).toBeInTheDocument();
    await userEvent.keyboard('{Escape}');
    expect(screen.queryByRole('listbox')).not.toBeInTheDocument();
    expect(native).toHaveFocus();
  });

  it('jumps to an option while typing its name', async () => {
    render(<SportSelect />);
    screen.getByLabelText('Sport').focus();
    await userEvent.keyboard(' ');
    await userEvent.keyboard('bas{Enter}');
    expect(screen.getByLabelText('Sport')).toHaveValue('2');
  });

  it('follows changes made to the real select and cannot be opened when disabled', () => {
    const { container, rerender } = render(<SportSelect />);
    fireEvent.change(screen.getByLabelText('Sport'), { target: { value: '1' } });
    expect(trigger(container)).toHaveTextContent('Football');
    rerender(<SportSelect disabled />);
    expect(trigger(container)).toBeDisabled();
  });

  it('works for uncontrolled selects with a default value', async () => {
    const { container } = render(<label>Level<Select name="level" defaultValue="b"><option value="a">Easy</option><option value="b">Hard</option></Select></label>);
    expect(trigger(container)).toHaveTextContent('Hard');
    await userEvent.click(trigger(container));
    await userEvent.click(inMenu().getByRole('option', { name: 'Easy' }));
    expect(screen.getByLabelText('Level')).toHaveValue('a');
  });

  it('lets several options be ticked in one menu and keeps them on the real select', async () => {
    const { container } = render(<label>People<Select name="people" multiple data-placeholder="Choose people" defaultValue={[]}>
      <option value="1">Ali</option><option value="2">Sara</option><option value="3">Omar</option>
    </Select></label>);
    expect(trigger(container)).toHaveTextContent('Choose people');
    await userEvent.click(trigger(container));
    const menu = () => within(document.querySelector('.ui-menu'));
    expect(document.querySelector('.ui-menu')).toHaveAttribute('aria-multiselectable', 'true');
    await userEvent.click(menu().getByRole('option', { name: 'Ali' }));
    await userEvent.click(menu().getByRole('option', { name: 'Omar' }));
    expect(document.querySelector('.ui-menu')).toBeInTheDocument();
    expect(Array.from(screen.getByLabelText('People').selectedOptions).map(option => option.value)).toEqual(['1', '3']);
    expect(trigger(container)).toHaveTextContent('Ali, Omar');
    await userEvent.click(menu().getByRole('option', { name: 'Sara' }));
    expect(trigger(container)).toHaveTextContent('3 selected');
    await userEvent.click(menu().getByRole('option', { name: 'Ali' }));
    expect(Array.from(screen.getByLabelText('People').selectedOptions).map(option => option.value)).toEqual(['2', '3']);
  });

  it('leaves a list box that shows several rows as the browser control', () => {
    const { container } = render(<label>Rows<Select name="rows" size={4}><option value="1">A</option></Select></label>);
    expect(container.querySelector('.ui-trigger')).toBeNull();
  });
});

describe('DateTimeInput', () => {
  it('keeps the real datetime-local input and shows a placeholder until a value is chosen', () => {
    const { container } = render(<label>Starts<DateTimeInput name="starts" /></label>);
    const native = screen.getByLabelText('Starts');
    expect(native).toHaveAttribute('type', 'datetime-local');
    expect(trigger(container)).toHaveTextContent('Pick a date and time');
  });

  it('formats an existing value', () => {
    const { container } = render(<label>Starts<DateTimeInput name="starts" defaultValue="2030-01-15T18:30" /></label>);
    expect(trigger(container)).toHaveTextContent('Tue, 15 Jan 2030, 18:30');
  });

  it('writes a complete value into the real input when a day, hour and minute are chosen', async () => {
    const onChange = vi.fn();
    const { container } = render(<label>Starts<DateTimeInput name="starts" defaultValue="2030-01-15T18:30" onChange={onChange} /></label>);
    await userEvent.click(trigger(container));
    expect(screen.getByRole('dialog', { name: 'Choose date and time' })).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: new Date(2030, 0, 20).toDateString() }));
    expect(screen.getByLabelText('Starts')).toHaveValue('2030-01-20T18:30');
    await userEvent.click(within(screen.getByRole('listbox', { name: 'Hour' })).getByText('07'));
    await userEvent.click(within(screen.getByRole('listbox', { name: 'Minute' })).getByText('45'));
    expect(screen.getByLabelText('Starts')).toHaveValue('2030-01-20T07:45');
    expect(onChange).toHaveBeenCalled();
    expect(trigger(container)).toHaveTextContent('Sun, 20 Jan 2030, 07:45');
    await userEvent.click(screen.getByRole('button', { name: 'Done' }));
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('gives a day-only choice a sensible evening time', async () => {
    const { container } = render(<label>Starts<DateTimeInput name="starts" /></label>);
    await userEvent.click(trigger(container));
    await userEvent.click(screen.getByRole('button', { name: new Date(new Date().getFullYear(), new Date().getMonth(), 10).toDateString() }));
    expect(screen.getByLabelText('Starts').value).toMatch(/T18:00$/);
  });

  it('blocks days before the minimum and never writes a value earlier than it', async () => {
    const { container } = render(<label>Starts<DateTimeInput name="starts" min="2030-01-10T12:00" defaultValue="2030-01-15T18:30" /></label>);
    await userEvent.click(trigger(container));
    expect(screen.getByRole('button', { name: new Date(2030, 0, 9).toDateString() })).toBeDisabled();
    expect(screen.getByRole('button', { name: new Date(2030, 0, 10).toDateString() })).toBeEnabled();
    await userEvent.click(screen.getByRole('button', { name: new Date(2030, 0, 10).toDateString() }));
    await userEvent.click(within(screen.getByRole('listbox', { name: 'Hour' })).getByText('08'));
    expect(screen.getByLabelText('Starts').value >= '2030-01-10T12:00').toBe(true);
  });

  it('offers Clear only for optional fields and empties the real input', async () => {
    const { container, rerender } = render(<label>Starts<DateTimeInput name="starts" defaultValue="2030-01-15T18:30" required /></label>);
    await userEvent.click(trigger(container));
    expect(screen.queryByRole('button', { name: 'Clear' })).not.toBeInTheDocument();
    rerender(<label>Starts<DateTimeInput name="starts" defaultValue="2030-01-15T18:30" /></label>);
    await userEvent.click(screen.getByRole('button', { name: 'Clear' }));
    expect(screen.getByLabelText('Starts')).toHaveValue('');
    expect(trigger(container)).toHaveTextContent('Pick a date and time');
  });

  it('follows typing into the real input and closes with Escape', async () => {
    const { container } = render(<label>Starts<DateTimeInput name="starts" /></label>);
    fireEvent.change(screen.getByLabelText('Starts'), { target: { value: '2030-03-05T09:05' } });
    expect(trigger(container)).toHaveTextContent('Tue, 5 Mar 2030, 09:05');
    screen.getByLabelText('Starts').focus();
    await userEvent.keyboard(' ');
    expect(screen.getByRole('dialog')).toBeInTheDocument();
    await userEvent.keyboard('{Escape}');
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });
});
