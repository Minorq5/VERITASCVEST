'use client';

import Placeholder from '@tiptap/extension-placeholder';
import TaskItem from '@tiptap/extension-task-item';
import TaskList from '@tiptap/extension-task-list';
import { EditorContent, useEditor, useEditorState, type Editor, type JSONContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import { Bold, Code, Italic, List, ListChecks, ListOrdered, Strikethrough } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useEffect, useRef } from 'react';
import { cn } from '@/lib/utils/cn';

export interface DescriptionEditorProps {
  value: unknown;
  placeholder: string;
  label: string;
  onSave: (doc: JSONContent | null, text: string) => void;
}

const MAX_TEXT = 20000;

function isEmptyDoc(editor: Editor) {
  return editor.isEmpty || (editor.getText().trim().length === 0 && !editor.getHTML().includes('data-type="taskList"'));
}

function Toolbar({ editor }: { editor: Editor }) {
  const t = useTranslations('tasks.editor');
  const state = useEditorState({
    editor,
    selector: ({ editor: e }) => ({
      bold: e.isActive('bold'),
      italic: e.isActive('italic'),
      strike: e.isActive('strike'),
      code: e.isActive('code'),
      bullet: e.isActive('bulletList'),
      ordered: e.isActive('orderedList'),
      task: e.isActive('taskList'),
    }),
  });
  const items = [
    { icon: Bold, on: state.bold, run: () => editor.chain().focus().toggleBold().run(), label: t('bold') },
    { icon: Italic, on: state.italic, run: () => editor.chain().focus().toggleItalic().run(), label: t('italic') },
    { icon: Strikethrough, on: state.strike, run: () => editor.chain().focus().toggleStrike().run(), label: t('strike') },
    { icon: Code, on: state.code, run: () => editor.chain().focus().toggleCode().run(), label: t('code') },
    { icon: List, on: state.bullet, run: () => editor.chain().focus().toggleBulletList().run(), label: t('bullet') },
    { icon: ListOrdered, on: state.ordered, run: () => editor.chain().focus().toggleOrderedList().run(), label: t('ordered') },
    { icon: ListChecks, on: state.task, run: () => editor.chain().focus().toggleTaskList().run(), label: t('checklist') },
  ];
  return (
    <div role="toolbar" aria-label={t('toolbar')} aria-orientation="horizontal" className="flex flex-wrap gap-0.5 border-b border-line px-1.5 py-1">
      {items.map(({ icon: Icon, on, run, label }) => (
        <button
          key={label}
          type="button"
          aria-label={label}
          aria-pressed={on}
          title={label}
          onMouseDown={(e) => e.preventDefault()}
          onClick={run}
          className={cn(
            'focus-ring inline-flex size-7 items-center justify-center rounded-xs transition-colors',
            on ? 'bg-surface-4 text-fg' : 'text-fg-3 hover-ok:bg-surface-3 hover-ok:text-fg',
          )}
        >
          <Icon aria-hidden className="size-4" />
        </button>
      ))}
    </div>
  );
}

/** Rich description (bold, lists, checklists, links, code). Saved on pause and on leaving the field. */
export default function DescriptionEditor({ value, placeholder, label, onSave }: DescriptionEditorProps) {
  const saved = useRef(JSON.stringify(value ?? null));
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const saveRef = useRef(onSave);
  useEffect(() => {
    saveRef.current = onSave;
  });

  const flush = (editor: Editor) => {
    if (timer.current) clearTimeout(timer.current);
    timer.current = null;
    const doc = isEmptyDoc(editor) ? null : editor.getJSON();
    const json = JSON.stringify(doc);
    if (json === saved.current) return;
    saved.current = json;
    saveRef.current(doc, editor.getText({ blockSeparator: '\n' }).slice(0, MAX_TEXT));
  };

  const editor = useEditor({
    immediatelyRender: false,
    extensions: [
      StarterKit.configure({ heading: { levels: [2, 3] }, link: { openOnClick: true, autolink: true, defaultProtocol: 'https' } }),
      Placeholder.configure({ placeholder }),
      TaskList,
      TaskItem.configure({ nested: true }),
    ],
    content: (value as JSONContent | null) ?? '',
    editorProps: { attributes: { class: 'rich-text min-h-24 px-3 py-2.5', 'aria-label': label, role: 'textbox', 'aria-multiline': 'true' } },
    onUpdate: ({ editor: e }) => {
      if (timer.current) clearTimeout(timer.current);
      timer.current = setTimeout(() => flush(e), 900);
    },
    onBlur: ({ editor: e }) => flush(e),
  });

  // A change from another device replaces the text unless the person is typing here.
  useEffect(() => {
    if (!editor || editor.isFocused) return;
    const incoming = JSON.stringify(value ?? null);
    if (incoming === saved.current) return;
    saved.current = incoming;
    editor.commands.setContent((value as JSONContent | null) ?? '', { emitUpdate: false });
  }, [editor, value]);

  // Leaving the task (closing the panel) must not lose the last words.
  useEffect(
    () => () => {
      if (editor && timer.current) flush(editor);
    },
    [editor],
  );

  return (
    <div className="overflow-hidden rounded-md border border-line-strong bg-surface-1 transition-[border-color] focus-within:border-blue">
      {editor && <Toolbar editor={editor} />}
      <EditorContent editor={editor} />
    </div>
  );
}
