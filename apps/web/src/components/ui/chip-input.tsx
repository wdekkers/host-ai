'use client';
import { useState, type KeyboardEvent, type JSX } from 'react';
import { X } from 'lucide-react';
import { Input } from './input';
import { Button } from './button';

export function ChipInput({
  value,
  onChange,
  placeholder,
}: {
  value: string[];
  onChange: (next: string[]) => void;
  placeholder?: string;
}): JSX.Element {
  const [draft, setDraft] = useState('');

  function commit(): void {
    const trimmed = draft.trim();
    if (!trimmed || value.includes(trimmed)) {
      setDraft('');
      return;
    }
    onChange([...value, trimmed]);
    setDraft('');
  }

  function onKeyDown(e: KeyboardEvent<HTMLInputElement>): void {
    if (e.key === 'Enter' || e.key === ',') {
      e.preventDefault();
      commit();
    } else if (e.key === 'Backspace' && draft === '' && value.length > 0) {
      onChange(value.slice(0, -1));
    }
  }

  return (
    <div className="flex flex-wrap gap-2 rounded-md border border-input bg-background px-3 py-2 focus-within:ring-2 focus-within:ring-ring">
      {value.map((chip) => (
        <span
          key={chip}
          className="inline-flex items-center gap-1 rounded bg-sky-50 px-2 py-0.5 text-sm text-sky-700"
        >
          {chip}
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="h-4 w-4 hover:bg-sky-100"
            onClick={() => onChange(value.filter((c) => c !== chip))}
          >
            <X className="h-3 w-3" />
          </Button>
        </span>
      ))}
      <Input
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onKeyDown={onKeyDown}
        onBlur={commit}
        placeholder={placeholder}
        className="flex-1 min-w-[120px] border-0 p-0 focus-visible:ring-0 focus-visible:ring-offset-0"
      />
    </div>
  );
}
