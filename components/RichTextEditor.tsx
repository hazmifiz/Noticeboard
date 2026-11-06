'use client';

import { useEditor, EditorContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Link from '@tiptap/extension-link';
import { useState } from 'react';

type Props = {
  name?: string;
  initialContent?: string;
};

export default function RichTextEditor({
  name = 'body',
  initialContent = '',
}: Props) {
const [html, setHtml] = useState(initialContent);
 const editor = useEditor({
  extensions: [
    StarterKit.configure({
      link: false,
    }),
    Link.configure({
      openOnClick: false,
      autolink: true,
      defaultProtocol: 'https',
    }),
  ],

  content: initialContent,
  immediatelyRender: false,

  onCreate({ editor }) {
    setHtml(editor.getHTML());
  },

  onUpdate({ editor }) {
    setHtml(editor.getHTML());
  },

  editorProps: {
    attributes: {
      class: 'tiptap',
    },
  },
});

  if (!editor) return null;

  const addLink = () => {
    const previousUrl = editor.getAttributes('link').href;
    const url = window.prompt('Enter link URL:', previousUrl || 'https://');

    if (url === null) return;

    if (url.trim() === '') {
      editor.chain().focus().unsetLink().run();
      return;
    }

    try {
      const parsed = new URL(url);

      if (!['http:', 'https:'].includes(parsed.protocol)) {
        window.alert('Only HTTP and HTTPS links are allowed.');
        return;
      }

      editor.chain().focus().setLink({ href: parsed.href }).run();
    } catch {
      window.alert('Please enter a valid URL.');
    }
  };

  const buttonClass = (active: boolean) =>
    `rounded px-3 py-1.5 text-sm font-medium ${
      active
        ? 'bg-blue-600 text-white'
        : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
    }`;

  return (
    <div className="overflow-hidden rounded-xl border border-slate-200 bg-white">
      {/* Toolbar */}
      <div className="flex flex-wrap gap-2 border-b border-slate-200 p-3">
        <button
          type="button"
          onClick={() => editor.chain().focus().toggleBold().run()}
          className={buttonClass(editor.isActive('bold'))}
        >
          <strong>B</strong>
        </button>

        <button
          type="button"
          onClick={() => editor.chain().focus().toggleItalic().run()}
          className={buttonClass(editor.isActive('italic'))}
        >
          <em>I</em>
        </button>

        <button
          type="button"
          onClick={() => editor.chain().focus().toggleStrike().run()}
          className={buttonClass(editor.isActive('strike'))}
        >
          <s>S</s>
        </button>

        <button
          type="button"
          onClick={() =>
            editor.chain().focus().toggleHeading({ level: 2 }).run()
          }
          className={buttonClass(editor.isActive('heading', { level: 2 }))}
        >
          H2
        </button>

        <button
          type="button"
          onClick={() =>
            editor.chain().focus().toggleHeading({ level: 3 }).run()
          }
          className={buttonClass(editor.isActive('heading', { level: 3 }))}
        >
          H3
        </button>

        <button
          type="button"
          onClick={() => editor.chain().focus().toggleBulletList().run()}
          className={buttonClass(editor.isActive('bulletList'))}
        >
          • List
        </button>

        <button
          type="button"
          onClick={() => editor.chain().focus().toggleOrderedList().run()}
          className={buttonClass(editor.isActive('orderedList'))}
        >
          1. List
        </button>

        <button
          type="button"
          onClick={() => editor.chain().focus().toggleBlockquote().run()}
          className={buttonClass(editor.isActive('blockquote'))}
        >
          Quote
        </button>

        <button
          type="button"
          onClick={addLink}
          className={buttonClass(editor.isActive('link'))}
        >
          Link
        </button>

        <button
          type="button"
          onClick={() => editor.chain().focus().undo().run()}
          className={buttonClass(false)}
        >
          Undo
        </button>

        <button
          type="button"
          onClick={() => editor.chain().focus().redo().run()}
          className={buttonClass(false)}
        >
          Redo
        </button>
      </div>

      {/* Editable content */}
      <EditorContent editor={editor} />



      {/* Submit HTML with the existing form */}
      <input
        type="hidden"
        name={name}
        value={html}
        readOnly
      />
    </div>
  );
}