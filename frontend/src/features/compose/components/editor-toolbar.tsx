import { useEditorState, type Editor } from '@tiptap/react';
import {
  AlignCenter,
  AlignJustify,
  AlignLeft,
  AlignRight,
  AlignStartVertical,
  Bold,
  ChevronsUpDown,
  IndentDecrease,
  IndentIncrease,
  Italic,
  List,
  ListOrdered,
  Quote,
  Redo2,
  Strikethrough,
  Type,
  Underline,
  Undo2,
} from 'lucide-react';
import type { ReactNode } from 'react';
import { DropdownMenu, DropdownMenuCheckItem, DropdownMenuContent, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { Tooltip } from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';

type Props = { editor: Editor };

const ALIGNS = [
  { value: 'left', label: 'Align left', icon: AlignLeft },
  { value: 'center', label: 'Align centre', icon: AlignCenter },
  { value: 'right', label: 'Align right', icon: AlignRight },
  { value: 'justify', label: 'Justify', icon: AlignJustify },
] as const;

const SIZES = [
  { level: 0, label: 'Normal text' },
  { level: 1, label: 'Large heading' },
  { level: 2, label: 'Heading' },
  { level: 3, label: 'Small heading' },
] as const;

export function EditorToolbar({ editor }: Props) {
  // Re-render only when the formatting under the cursor changes, not on every keystroke.
  const state = useEditorState({
    editor,
    selector: ({ editor: e }) => ({
      bold: e.isActive('bold'),
      italic: e.isActive('italic'),
      underline: e.isActive('underline'),
      strike: e.isActive('strike'),
      ordered: e.isActive('orderedList'),
      bullet: e.isActive('bulletList'),
      quote: e.isActive('blockquote'),
      inList: e.isActive('listItem'),
      heading: ([1, 2, 3] as const).find((level) => e.isActive('heading', { level })) ?? 0,
      align: ALIGNS.find((a) => e.isActive({ textAlign: a.value }))?.value ?? 'left',
      canUndo: e.can().undo(),
      canRedo: e.can().redo(),
    }),
  });

  const chain = () => editor.chain().focus();
  const AlignIcon = ALIGNS.find((a) => a.value === state.align)?.icon ?? AlignLeft;

  return (
    <div role="toolbar" aria-label="Formatting" className="flex flex-wrap items-center gap-0.5 rounded-lg bg-white px-2 py-1.5">
      <Tool label="Undo" disabled={!state.canUndo} onClick={() => chain().undo().run()}>
        <Undo2 />
      </Tool>
      <Tool label="Redo" disabled={!state.canRedo} onClick={() => chain().redo().run()}>
        <Redo2 />
      </Tool>
      <Divider />

      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <button type="button" aria-label="Text size" className={toolClass(state.heading !== 0, 'w-auto gap-0.5 px-1.5')}>
            <Type />
            <ChevronsUpDown className="!size-3" />
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent>
          {SIZES.map((size) => (
            <DropdownMenuCheckItem
              key={size.level}
              checked={state.heading === size.level}
              onSelect={() => (size.level === 0 ? chain().setParagraph().run() : chain().setHeading({ level: size.level }).run())}
            >
              {size.label}
            </DropdownMenuCheckItem>
          ))}
        </DropdownMenuContent>
      </DropdownMenu>
      <Divider />

      <Tool label="Bold (Cmd+B)" active={state.bold} onClick={() => chain().toggleBold().run()}>
        <Bold />
      </Tool>
      <Tool label="Italic (Cmd+I)" active={state.italic} onClick={() => chain().toggleItalic().run()}>
        <Italic />
      </Tool>
      <Tool label="Underline (Cmd+U)" active={state.underline} onClick={() => chain().toggleUnderline().run()}>
        <Underline />
      </Tool>
      <Divider />

      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <button type="button" aria-label="Alignment" className={toolClass(state.align !== 'left', 'w-auto gap-0.5 px-1.5')}>
            <AlignIcon />
            <ChevronsUpDown className="!size-3" />
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent>
          {ALIGNS.map((align) => (
            <DropdownMenuCheckItem key={align.value} checked={state.align === align.value} onSelect={() => chain().setTextAlign(align.value).run()}>
              {align.label}
            </DropdownMenuCheckItem>
          ))}
        </DropdownMenuContent>
      </DropdownMenu>
      <Divider />

      <Tool label="Numbered list" active={state.ordered} onClick={() => chain().toggleOrderedList().run()}>
        <ListOrdered />
      </Tool>
      <Tool label="Bulleted list" active={state.bullet} onClick={() => chain().toggleBulletList().run()}>
        <List />
      </Tool>
      <Tool label="Indent" disabled={!state.inList} onClick={() => chain().sinkListItem('listItem').run()}>
        <IndentIncrease />
      </Tool>
      <Tool label="Outdent" disabled={!state.inList} onClick={() => chain().liftListItem('listItem').run()}>
        <IndentDecrease />
      </Tool>
      <Tool label="Quote" active={state.quote} onClick={() => chain().toggleBlockquote().run()}>
        <Quote />
      </Tool>
      <Tool label="Clear formatting" onClick={() => chain().unsetAllMarks().clearNodes().run()}>
        <AlignStartVertical />
      </Tool>
      <Divider />

      <Tool label="Strikethrough" active={state.strike} onClick={() => chain().toggleStrike().run()}>
        <Strikethrough />
      </Tool>
    </div>
  );
}

const toolClass = (active: boolean, extra?: string) =>
  cn(
    'inline-flex size-8 items-center justify-center rounded-md text-muted transition-colors hover:bg-fill hover:text-ink disabled:opacity-35 disabled:hover:bg-transparent [&_svg]:size-[18px] [&_svg]:stroke-[1.75]',
    active && 'bg-fill text-ink',
    extra,
  );

type ToolProps = { label: string; onClick: () => void; active?: boolean; disabled?: boolean; children: ReactNode };

function Tool({ label, onClick, active = false, disabled = false, children }: ToolProps) {
  return (
    <Tooltip content={label}>
      <button
        type="button"
        aria-label={label}
        aria-pressed={active}
        disabled={disabled}
        // Keep the editor's selection: a mousedown on the button would blur it.
        onMouseDown={(event) => event.preventDefault()}
        onClick={onClick}
        className={toolClass(active)}
      >
        {children}
      </button>
    </Tooltip>
  );
}

function Divider() {
  return <span aria-hidden className="mx-1.5 h-5 w-px bg-line-strong" />;
}
