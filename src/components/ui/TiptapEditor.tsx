import React, { useCallback, useEffect, useRef } from "react";
import { useEditor, EditorContent } from "@tiptap/react";
import { StarterKit } from "@tiptap/starter-kit";
import { Underline } from "@tiptap/extension-underline";
import { Link } from "@tiptap/extension-link";
import { Image } from "@tiptap/extension-image";
import { Table } from "@tiptap/extension-table";
import { TableRow } from "@tiptap/extension-table-row";
import { TableCell } from "@tiptap/extension-table-cell";
import { TableHeader } from "@tiptap/extension-table-header";
import { Placeholder } from "@tiptap/extension-placeholder";
import YouTubeEmbed from "./extensions/YouTubeEmbed";
import { 
  Bold, 
  Italic, 
  Underline as UnderlineIcon, 
  Link as LinkIcon, 
  List, 
  ListOrdered, 
  Quote, 
  Image as ImageIcon, 
  Table as TableIcon, 
  Undo, 
  Redo, 
  Heading1, 
  Heading2, 
  Heading3,
  Type
} from "lucide-react";
import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

interface TiptapEditorProps {
  content: string;
  onChange: (content: string) => void;
  placeholder?: string;
  onImageUpload?: (file: File) => Promise<string>;
  variant?: "default" | "compact";
}

const MenuButton = ({ 
  onClick, 
  isActive = false, 
  disabled = false, 
  children,
  title
}: { 
  onClick: () => void; 
  isActive?: boolean; 
  disabled?: boolean; 
  children: React.ReactNode;
  title: string;
}) => (
  <button
    type="button"
    onClick={onClick}
    disabled={disabled}
    title={title}
    className={cn(
      "p-2 rounded-lg transition-all duration-200 flex items-center justify-center",
      isActive 
        ? "bg-slate-900 text-amber-400 shadow-sm" 
        : "text-slate-600 hover:bg-slate-100 hover:text-slate-900",
      disabled && "opacity-50 cursor-not-allowed"
    )}
  >
    {children}
  </button>
);

const Toolbar = ({ editor, onImageUpload }: { editor: any, onImageUpload?: (file: File) => Promise<string> }) => {
  const fileInputRef = useRef<HTMLInputElement>(null);

  if (!editor) return null;

  const addImage = useCallback(() => {
    fileInputRef.current?.click();
  }, []);

  const handleFileChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file && onImageUpload) {
      try {
        const url = await onImageUpload(file);
        editor.chain().focus().setImage({ src: url }).run();
      } catch (error) {
        console.error("Image upload failed:", error);
      }
    } else if (file) {
      // Fallback to base64
      const reader = new FileReader();
      reader.onload = () => {
        editor.chain().focus().setImage({ src: reader.result as string }).run();
      };
      reader.readAsDataURL(file);
    }
  };

  const setLink = useCallback(() => {
    const previousUrl = editor.getAttributes('link').href;
    const url = window.prompt('URL', previousUrl);

    if (url === null) return;
    if (url === '') {
      editor.chain().focus().extendMarkRange('link').unsetLink().run();
      return;
    }

    editor.chain().focus().extendMarkRange('link').setLink({ href: url }).run();
  }, [editor]);

  return (
    <div className="flex flex-wrap items-center gap-1 p-2 bg-slate-50/50 border-b border-slate-200 sticky top-0 z-10">
      <MenuButton
        onClick={() => editor.chain().focus().toggleHeading({ level: 1 }).run()}
        isActive={editor.isActive('heading', { level: 1 })}
        title="Heading 1"
      >
        <Heading1 size={18} />
      </MenuButton>
      <MenuButton
        onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}
        isActive={editor.isActive('heading', { level: 2 })}
        title="Heading 2"
      >
        <Heading2 size={18} />
      </MenuButton>
      <MenuButton
        onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()}
        isActive={editor.isActive('heading', { level: 3 })}
        title="Heading 3"
      >
        <Heading3 size={18} />
      </MenuButton>
      <MenuButton
        onClick={() => editor.chain().focus().setParagraph().run()}
        isActive={editor.isActive('paragraph')}
        title="Paragraph"
      >
        <Type size={18} />
      </MenuButton>

      <div className="w-px h-6 bg-slate-200 mx-1" />

      <MenuButton
        onClick={() => editor.chain().focus().toggleBold().run()}
        isActive={editor.isActive('bold')}
        title="Bold"
      >
        <Bold size={18} />
      </MenuButton>
      <MenuButton
        onClick={() => editor.chain().focus().toggleItalic().run()}
        isActive={editor.isActive('italic')}
        title="Italic"
      >
        <Italic size={18} />
      </MenuButton>
      <MenuButton
        onClick={() => editor.chain().focus().toggleUnderline().run()}
        isActive={editor.isActive('underline')}
        title="Underline"
      >
        <UnderlineIcon size={18} />
      </MenuButton>

      <div className="w-px h-6 bg-slate-200 mx-1" />

      <MenuButton
        onClick={setLink}
        isActive={editor.isActive('link')}
        title="Insert Link"
      >
        <LinkIcon size={18} />
      </MenuButton>
      <MenuButton
        onClick={() => editor.chain().focus().toggleBulletList().run()}
        isActive={editor.isActive('bulletList')}
        title="Bulleted List"
      >
        <List size={18} />
      </MenuButton>
      <MenuButton
        onClick={() => editor.chain().focus().toggleOrderedList().run()}
        isActive={editor.isActive('orderedList')}
        title="Numbered List"
      >
        <ListOrdered size={18} />
      </MenuButton>
      <MenuButton
        onClick={() => editor.chain().focus().toggleBlockquote().run()}
        isActive={editor.isActive('blockquote')}
        title="Blockquote"
      >
        <Quote size={18} />
      </MenuButton>

      <div className="w-px h-6 bg-slate-200 mx-1" />

      <input
        type="file"
        ref={fileInputRef}
        className="hidden"
        accept="image/*"
        onChange={handleFileChange}
      />
      <MenuButton onClick={addImage} title="Upload Image">
        <ImageIcon size={18} />
      </MenuButton>
      <MenuButton
        onClick={() => editor.chain().focus().insertTable({ rows: 3, cols: 3, withHeaderRow: true }).run()}
        title="Insert Table"
      >
        <TableIcon size={18} />
      </MenuButton>

      <div className="w-px h-6  mx-1 grow" />

      <MenuButton
        onClick={() => editor.chain().focus().undo().run()}
        disabled={!editor.can().undo()}
        title="Undo"
      >
        <Undo size={18} />
      </MenuButton>
      <MenuButton
        onClick={() => editor.chain().focus().redo().run()}
        disabled={!editor.can().redo()}
        title="Redo"
      >
        <Redo size={18} />
      </MenuButton>
    </div>
  );
};

const TiptapEditor: React.FC<TiptapEditorProps> = ({
  content,
  onChange,
  placeholder = "Write something...",
  onImageUpload,
  variant = "default",
}) => {
  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        heading: {
          levels: [1, 2, 3],
        },
        link: false,
        underline: false,
      }),
      Underline,
      Link.configure({
        openOnClick: false,
        HTMLAttributes: {
          class: 'text-primary underline decoration-primary/30 underline-offset-4 hover:decoration-primary transition-all',
        },
      }),
      Image.configure({
        HTMLAttributes: {
          class: 'rounded-2xl border border-slate-200 shadow-lg max-w-full h-auto my-8 mx-auto block',
        },
      }),
      Table.configure({
        resizable: true,
        HTMLAttributes: {
          class: 'border-collapse table-fixed w-full my-8 border border-slate-200 rounded-xl overflow-hidden',
        },
      }),
      TableRow,
      TableHeader.configure({
        HTMLAttributes: {
          class: 'bg-slate-50 border border-slate-200 p-4 text-left font-semibold text-slate-900',
        },
      }),
      TableCell.configure({
        HTMLAttributes: {
          class: 'border border-slate-200 p-4 text-slate-600 min-w-[100px]',
        },
      }),
      Placeholder.configure({
        placeholder,
        emptyEditorClass: 'is-editor-empty',
      }),
      YouTubeEmbed,
    ],
    content,
    onUpdate: ({ editor }) => {
      onChange(editor.getHTML());
    },
    editorProps: {
      attributes: {
        class: 'tiptap focus:outline-none min-h-[450px] p-8 md:p-12 prose prose-slate prose-lg max-w-none prose-headings:font-bold prose-headings:text-slate-900 prose-p:text-slate-600 prose-a:text-primary prose-img:rounded-3xl',
      },
    },
  });

  useEffect(() => {
    if (!editor) {
      return;
    }

    const normalizedContent = content || "";
    if (editor.getHTML() === normalizedContent) {
      return;
    }

    editor.commands.setContent(normalizedContent, { emitUpdate: false });
  }, [content, editor]);

  const isCompact = variant === "compact";

  return (
    <div className="tiptap-wrapper w-full border border-slate-200 rounded-3xl overflow-hidden bg-white focus-within:ring-4 focus-within:ring-primary/20 focus-within:border-primary transition-all shadow-xl group">
      <Toolbar editor={editor} onImageUpload={onImageUpload} />
      <EditorContent
        editor={editor}
        className={cn(
          isCompact
            ? "[&_.tiptap]:min-h-[120px] [&_.tiptap]:p-4 [&_.tiptap]:text-sm [&_.tiptap]:prose-base"
            : "",
        )}
      />
      
      <style>{`
        .tiptap-wrapper {
          border-radius: 1.5rem;
          box-shadow: 0 10px 15px -3px rgba(0, 0, 0, 0.1), 0 4px 6px -2px rgba(0, 0, 0, 0.05);
        }

        .tiptap .is-editor-empty:first-child::before {
          content: attr(data-placeholder);
          float: left;
          color: #94a3b8;
          pointer-events: none;
          height: 0;
        }

        /* Premium focus effect */
        .tiptap-wrapper:focus-within {
          box-shadow: 0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04), 0 0 0 4px rgba(59, 130, 246, 0.1);
          border-color: #3b82f6;
        }

        /* Custom scrollbar */
        .tiptap {
          font-family: 'Inter', system-ui, -apple-system, sans-serif;
        }

        /* Table specific styles */
        .tiptap table {
          border-collapse: collapse;
          table-layout: fixed;
          width: 100%;
          margin: 2rem 0;
          overflow: hidden;
          border-radius: 0.75rem;
        }

        .tiptap table td,
        .tiptap table th {
          min-width: 1em;
          border: 1px solid #e2e8f0;
          padding: 12px 16px;
          vertical-align: top;
          box-sizing: border-box;
          position: relative;
        }

        .tiptap table th {
          font-weight: bold;
          text-align: left;
          background-color: #f8fafc;
        }

        .tiptap table .selectedCell:after {
          z-index: 2;
          position: absolute;
          content: "";
          left: 0; right: 0; top: 0; bottom: 0;
          background: rgba(200, 200, 255, 0.4);
          pointer-events: none;
        }

        .tiptap table .column-resize-handle {
          position: absolute;
          right: -2px;
          top: 0;
          bottom: -2px;
          width: 4px;
          background-color: #adf;
          pointer-events: none;
        }

        .tiptap .tableWrapper {
          overflow-x: auto;
        }

        .tiptap .resize-cursor {
          cursor: ew-resize;
          cursor: col-resize;
        }
      `}</style>
    </div>
  );
};

export default TiptapEditor;
