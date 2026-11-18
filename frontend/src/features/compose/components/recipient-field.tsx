import { Upload } from 'lucide-react';
import { useRef, useState, type ClipboardEvent, type DragEvent, type KeyboardEvent } from 'react';
import { isLeadFile, LEAD_FILE_ACCEPT, LEAD_FILE_MAX_BYTES, parseLeadList, type LeadParseResult } from '@/lib/csv';
import { isValidEmail, splitAddresses } from '@/lib/emails';
import { cn } from '@/lib/utils';
import { RecipientChip } from './recipient-chip';

type Props = {
  id: string;
  recipients: string[];
  onChange: (next: string[]) => void;
  invalid?: boolean;
};

type UploadNote = { file: string; result: LeadParseResult } | { file: string; error: string };

const COLLAPSED_CHIPS = 3;

export function RecipientField({ id, recipients, onChange, invalid = false }: Props) {
  const [draft, setDraft] = useState('');
  const [expanded, setExpanded] = useState(false);
  const [dragging, setDragging] = useState(false);
  const [note, setNote] = useState<UploadNote | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const add = (addresses: string[]) => {
    const seen = new Set(recipients);
    const next = [...recipients];
    for (const address of addresses) {
      if (!seen.has(address)) {
        seen.add(address);
        next.push(address);
      }
    }
    if (next.length !== recipients.length) onChange(next);
  };

  const commitDraft = () => {
    const addresses = splitAddresses(draft);
    if (addresses.length) add(addresses);
    setDraft('');
  };

  const onKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (['Enter', ',', ';', ' ', 'Tab'].includes(event.key) && draft.trim()) {
      // Tab still moves focus; the others stay in the field.
      if (event.key !== 'Tab') event.preventDefault();
      commitDraft();
    } else if (event.key === 'Backspace' && !draft && recipients.length) {
      onChange(recipients.slice(0, -1));
    }
  };

  const onPaste = (event: ClipboardEvent<HTMLInputElement>) => {
    const text = event.clipboardData.getData('text');
    if (/[\s,;]/.test(text.trim())) {
      event.preventDefault();
      add(splitAddresses(`${draft} ${text}`));
      setDraft('');
    }
  };

  const readFile = async (file: File) => {
    if (!isLeadFile(file)) return setNote({ file: file.name, error: 'Upload a .csv or .txt file' });
    if (file.size > LEAD_FILE_MAX_BYTES) return setNote({ file: file.name, error: 'Files are limited to 1 MB' });
    const result = parseLeadList(await file.text(), recipients);
    if (result.emails.length === 0 && result.duplicates === 0) {
      return setNote({ file: file.name, error: `No email addresses found in ${file.name}` });
    }
    add(result.emails);
    setNote({ file: file.name, result });
  };

  const onDrop = (event: DragEvent) => {
    event.preventDefault();
    setDragging(false);
    const file = event.dataTransfer.files[0];
    if (file) void readFile(file);
  };

  const visible = expanded ? recipients : recipients.slice(0, COLLAPSED_CHIPS);
  const hidden = recipients.length - visible.length;

  return (
    <div>
      <div
        onDragOver={(event) => {
          event.preventDefault();
          setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={onDrop}
        onClick={() => inputRef.current?.focus()}
        className={cn(
          'flex min-h-[38px] cursor-text items-center gap-3 rounded-sm py-1.5',
          dragging && 'outline-2 outline-dashed outline-offset-2 outline-brand',
        )}
      >
        <div className="flex min-w-0 flex-1 flex-wrap items-center gap-1.5">
          {visible.map((email) => (
            <RecipientChip
              key={email}
              email={email}
              invalid={!isValidEmail(email)}
              onRemove={() => onChange(recipients.filter((r) => r !== email))}
            />
          ))}
          {hidden > 0 ? (
            <button
              type="button"
              onClick={(event) => {
                event.stopPropagation();
                setExpanded(true);
              }}
              className="inline-flex h-[22px] items-center rounded-full border border-brand px-2 text-xs font-medium text-brand hover:bg-brand-tint"
            >
              +{hidden}
            </button>
          ) : null}
          {expanded && recipients.length > COLLAPSED_CHIPS ? (
            <button type="button" onClick={() => setExpanded(false)} className="text-xs text-muted hover:text-ink hover:underline">
              Show less
            </button>
          ) : null}
          <input
            ref={inputRef}
            id={id}
            value={draft}
            onChange={(event) => setDraft(event.target.value)}
            onKeyDown={onKeyDown}
            onPaste={onPaste}
            onBlur={commitDraft}
            placeholder={recipients.length ? '' : 'recipient@example.com'}
            aria-invalid={invalid || undefined}
            autoComplete="off"
            className="h-7 min-w-[160px] flex-1 bg-transparent text-sm text-ink outline-none placeholder:text-subtle"
          />
        </div>
        <button
          type="button"
          onClick={(event) => {
            event.stopPropagation();
            fileRef.current?.click();
          }}
          className="inline-flex shrink-0 items-center gap-1.5 text-sm text-brand hover:text-brand-hover"
        >
          <Upload className="size-3.5" aria-hidden />
          Upload List
        </button>
        <input
          ref={fileRef}
          type="file"
          accept={LEAD_FILE_ACCEPT}
          className="hidden"
          onChange={(event) => {
            const file = event.target.files?.[0];
            if (file) void readFile(file);
            event.target.value = '';
          }}
        />
      </div>
      <UploadSummary note={note} total={recipients.length} />
    </div>
  );
}

function UploadSummary({ note, total }: { note: UploadNote | null; total: number }) {
  if (!note) {
    return total > 0 ? <p className="pb-1 text-xs text-muted">{total} email address{total === 1 ? '' : 'es'} added</p> : null;
  }
  if ('error' in note) {
    return (
      <p className="pb-1 text-xs text-red" role="alert">
        {note.error}
      </p>
    );
  }
  const { emails, duplicates, invalid } = note.result;
  return (
    <p className="pb-1 text-xs text-muted" role="status">
      {note.file}: {emails.length} email address{emails.length === 1 ? '' : 'es'} detected
      {duplicates ? `, ${duplicates} duplicate${duplicates === 1 ? '' : 's'} skipped` : ''}
      {invalid ? <span className="text-red">, {invalid} invalid</span> : null}
      <span className="text-subtle"> · {total} total</span>
    </p>
  );
}
