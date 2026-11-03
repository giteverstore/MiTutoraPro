import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { LearnerSelect } from '../../src/components/LearnerSelect';

const options = [
  { value: 'all', label: 'All languages' },
  { value: 'python', label: 'Python' },
  { value: 'java', label: 'Java' },
];

afterEach(cleanup);

describe('LearnerSelect', () => {
  it('renders an accessible custom listbox and selects the underlying value', () => {
    const onChange = vi.fn();
    const { container } = render(<LearnerSelect ariaLabel="Language" value="all" options={options} onChange={onChange} />);
    const trigger = screen.getByRole('combobox', { name: 'Language' });
    expect(container.querySelector('select')).toBeNull();
    expect(trigger).toHaveTextContent('All languages');
    fireEvent.click(trigger);
    expect(trigger).toHaveAttribute('aria-expanded', 'true');
    expect(container.querySelector('.learner-select > button > svg')).toHaveClass('is-open');
    fireEvent.click(screen.getByRole('option', { name: 'Python' }));
    expect(onChange).toHaveBeenCalledWith('python');
    expect(trigger).toHaveFocus();
    expect(trigger).toHaveAttribute('aria-expanded', 'false');
  });

  it('supports arrow, Home, End, Enter, Space, Escape, and Tab keyboard behavior', () => {
    const onChange = vi.fn();
    render(<LearnerSelect ariaLabel="Language" value="all" options={options} onChange={onChange} />);
    const trigger = screen.getByRole('combobox', { name: 'Language' });
    fireEvent.keyDown(trigger, { key: 'ArrowDown' });
    expect(trigger).toHaveAttribute('aria-activedescendant', expect.stringContaining('option-1'));
    fireEvent.keyDown(trigger, { key: 'End' });
    fireEvent.keyDown(trigger, { key: 'Enter' });
    expect(onChange).toHaveBeenCalledWith('java');
    fireEvent.keyDown(trigger, { key: ' ' });
    fireEvent.keyDown(trigger, { key: 'Home' });
    fireEvent.keyDown(trigger, { key: 'Escape' });
    expect(trigger).toHaveAttribute('aria-expanded', 'false');
    fireEvent.keyDown(trigger, { key: 'Enter' });
    fireEvent.keyDown(trigger, { key: 'Tab' });
    expect(trigger).toHaveAttribute('aria-expanded', 'false');
  });

  it('closes on outside interaction and when another learner dropdown opens', () => {
    render(<><LearnerSelect ariaLabel="Language" value="all" options={options} onChange={() => {}} /><LearnerSelect ariaLabel="Topic" value="all" options={options} onChange={() => {}} /><button type="button">Outside</button></>);
    const language = screen.getByRole('combobox', { name: 'Language' });
    const topic = screen.getByRole('combobox', { name: 'Topic' });
    fireEvent.click(language);
    fireEvent.click(topic);
    expect(language).toHaveAttribute('aria-expanded', 'false');
    expect(topic).toHaveAttribute('aria-expanded', 'true');
    fireEvent.pointerDown(screen.getByRole('button', { name: 'Outside' }));
    expect(topic).toHaveAttribute('aria-expanded', 'false');
  });
});
