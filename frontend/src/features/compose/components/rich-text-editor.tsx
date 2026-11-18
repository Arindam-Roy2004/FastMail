import TextAlign from '@tiptap/extension-text-align';
import { Placeholder } from '@tiptap/extensions';
import { EditorContent, useEditor } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import { cn } from '@/lib/utils';
import { EditorToolbar } from './editor-toolbar';

type Props = {
  onChange: (html: string, text: string) => void;
  invalid?: boolean;
};

export function RichTextEditor({ onChange, invalid = false }: Props) {
  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        heading: { levels: [1, 2, 3] },
        code: false,
        codeBlock: false,
        horizontalRule: false,
        link: { openOnClick: false, autolink: true, defaultProtocol: 'https' },
      }),
      TextAlign.configure({ types: ['heading', 'paragraph'] }),
      Placeholder.configure({ placeholder: 'Type Your Reply...' }),
    ],
    editorProps: {
      attributes: {
        class: 'email-content min-h-[360px] px-4 pb-4 pt-3 outline-none',
        'aria-label': 'Email body',
      },
    },
    onUpdate: ({ editor: e }) => onChange(e.isEmpty ? '' : e.getHTML(), e.getText().trim()),
  });

  return (
    <div
      className={cn(
        'rounded-lg bg-editor p-2 transition-shadow focus-within:shadow-[0_0_0_2px_rgb(0_166_62/0.18)]',
        invalid && 'shadow-[0_0_0_1px_var(--color-red)]',
      )}
    >
      {editor ? <EditorToolbar editor={editor} /> : <div className="h-11" />}
      <EditorContent editor={editor} />
    </div>
  );
}
