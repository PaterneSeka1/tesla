'use client';

import { isSafeImageSrc, isSafeLinkHref, type LessonDocument } from '@tesla/shared';
import Image from '@tiptap/extension-image';
import { type Editor, EditorContent, useEditor, useEditorState } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import {
  Bold,
  Heading2,
  Heading3,
  ImagePlus,
  Italic,
  Link2,
  List,
  ListOrdered,
  type LucideIcon,
  Minus,
  Quote,
  Redo2,
  Strikethrough,
  Underline,
  Undo2,
  Unlink,
} from 'lucide-react';
import { useId, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { cn } from '@/lib/utils';

/**
 * Éditeur de contenu de leçon (Tiptap). Le document produit est du JSON structuré ; l'API le
 * valide par liste blanche avant stockage. Pas de bloc de code, pas de HTML brut, pas d'image
 * intégrée en base64 : les images sont des adresses https externes.
 */
export function LessonEditor({
  value,
  onChange,
  label,
  editable = true,
}: {
  value: LessonDocument;
  onChange: (document: unknown) => void;
  label: string;
  editable?: boolean;
}) {
  const editor = useEditor({
    immediatelyRender: false,
    editable,
    extensions: [
      StarterKit.configure({
        heading: { levels: [2, 3] },
        code: false,
        codeBlock: false,
        link: {
          openOnClick: false,
          autolink: true,
          defaultProtocol: 'https',
          isAllowedUri: (url) => isSafeLinkHref(url),
          HTMLAttributes: { rel: 'noopener noreferrer nofollow', target: '_blank' },
        },
      }),
      Image.configure({ inline: false, allowBase64: false }),
    ],
    content: value,
    editorProps: {
      attributes: {
        class:
          'lesson-content min-h-48 space-y-3 rounded-b-md border border-t-0 bg-white px-4 py-3 leading-relaxed focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-ring/40',
        'aria-label': label,
        'aria-multiline': 'true',
        role: 'textbox',
      },
    },
    onUpdate: ({ editor: current }) => onChange(current.getJSON()),
  });

  if (!editor) {
    return <div className="min-h-48 rounded-md border bg-muted/40" aria-busy="true" />;
  }
  return (
    <div>
      {editable && <Toolbar editor={editor} />}
      <EditorContent editor={editor} />
    </div>
  );
}

function Toolbar({ editor }: { editor: Editor }) {
  const state = useEditorState({
    editor,
    selector: ({ editor: e }) => ({
      h2: e.isActive('heading', { level: 2 }),
      h3: e.isActive('heading', { level: 3 }),
      bold: e.isActive('bold'),
      italic: e.isActive('italic'),
      underline: e.isActive('underline'),
      strike: e.isActive('strike'),
      bullet: e.isActive('bulletList'),
      ordered: e.isActive('orderedList'),
      quote: e.isActive('blockquote'),
      link: e.isActive('link'),
      canUndo: e.can().undo(),
      canRedo: e.can().redo(),
    }),
  });
  const [panel, setPanel] = useState<'link' | 'image' | null>(null);
  const chain = () => editor.chain().focus();

  const tools: {
    label: string;
    icon: LucideIcon;
    active?: boolean;
    disabled?: boolean;
    run: () => void;
  }[] = [
    {
      label: 'Titre',
      icon: Heading2,
      active: state.h2,
      run: () => chain().toggleHeading({ level: 2 }).run(),
    },
    {
      label: 'Sous-titre',
      icon: Heading3,
      active: state.h3,
      run: () => chain().toggleHeading({ level: 3 }).run(),
    },
    { label: 'Gras', icon: Bold, active: state.bold, run: () => chain().toggleBold().run() },
    {
      label: 'Italique',
      icon: Italic,
      active: state.italic,
      run: () => chain().toggleItalic().run(),
    },
    {
      label: 'Souligné',
      icon: Underline,
      active: state.underline,
      run: () => chain().toggleUnderline().run(),
    },
    {
      label: 'Barré',
      icon: Strikethrough,
      active: state.strike,
      run: () => chain().toggleStrike().run(),
    },
    {
      label: 'Liste à puces',
      icon: List,
      active: state.bullet,
      run: () => chain().toggleBulletList().run(),
    },
    {
      label: 'Liste numérotée',
      icon: ListOrdered,
      active: state.ordered,
      run: () => chain().toggleOrderedList().run(),
    },
    {
      label: 'Citation',
      icon: Quote,
      active: state.quote,
      run: () => chain().toggleBlockquote().run(),
    },
    { label: 'Séparateur', icon: Minus, run: () => chain().setHorizontalRule().run() },
    {
      label: state.link ? 'Retirer le lien' : 'Lien',
      icon: state.link ? Unlink : Link2,
      active: panel === 'link',
      run: () =>
        state.link ? chain().unsetLink().run() : setPanel(panel === 'link' ? null : 'link'),
    },
    {
      label: 'Image',
      icon: ImagePlus,
      active: panel === 'image',
      run: () => setPanel(panel === 'image' ? null : 'image'),
    },
    { label: 'Annuler', icon: Undo2, disabled: !state.canUndo, run: () => chain().undo().run() },
    { label: 'Rétablir', icon: Redo2, disabled: !state.canRedo, run: () => chain().redo().run() },
  ];

  return (
    <div className="rounded-t-md border bg-muted/50">
      <div role="toolbar" aria-label="Mise en forme" className="flex flex-wrap gap-0.5 p-1">
        {tools.map(({ label, icon: Icon, active, disabled, run }) => (
          <Button
            key={label}
            type="button"
            variant="ghost"
            size="icon"
            className={cn('size-8', active && 'bg-tesla-sable text-tesla-bordeaux')}
            aria-label={label}
            title={label}
            aria-pressed={active}
            disabled={disabled}
            onClick={run}
          >
            <Icon aria-hidden />
          </Button>
        ))}
      </div>
      {panel === 'link' && (
        <UrlForm
          label="Adresse du lien"
          placeholder="https://…"
          validate={isSafeLinkHref}
          error="Adresse invalide : http://, https:// ou mailto: uniquement."
          onSubmit={(url) => {
            chain().extendMarkRange('link').setLink({ href: url }).run();
            setPanel(null);
          }}
          onCancel={() => setPanel(null)}
        />
      )}
      {panel === 'image' && (
        <UrlForm
          label="Adresse de l’image"
          placeholder="https://…/image.jpg"
          withAlt
          validate={isSafeImageSrc}
          error="Adresse invalide : une image https:// est requise."
          onSubmit={(url, alt) => {
            chain()
              .setImage({ src: url, alt: alt || undefined })
              .run();
            setPanel(null);
          }}
          onCancel={() => setPanel(null)}
        />
      )}
    </div>
  );
}

function UrlForm({
  label,
  placeholder,
  withAlt = false,
  validate,
  error,
  onSubmit,
  onCancel,
}: {
  label: string;
  placeholder: string;
  withAlt?: boolean;
  validate: (url: string) => boolean;
  error: string;
  onSubmit: (url: string, alt: string) => void;
  onCancel: () => void;
}) {
  const id = useId();
  const [url, setUrl] = useState('');
  const [alt, setAlt] = useState('');
  const [invalid, setInvalid] = useState(false);
  const submit = () => {
    const value = url.trim();
    if (!validate(value)) {
      setInvalid(true);
      return;
    }
    onSubmit(value, alt.trim());
  };
  // Pas de <form> imbriqué : l'éditeur peut se trouver dans un formulaire.
  return (
    <div className="grid gap-2 border-t p-2 sm:grid-cols-[1fr_1fr_auto] sm:items-end">
      <div className="space-y-1">
        <Label htmlFor={`${id}-url`}>{label}</Label>
        <Input
          id={`${id}-url`}
          type="url"
          autoFocus
          placeholder={placeholder}
          value={url}
          aria-invalid={invalid || undefined}
          aria-describedby={invalid ? `${id}-error` : undefined}
          onChange={(event) => {
            setUrl(event.target.value);
            setInvalid(false);
          }}
          onKeyDown={(event) => {
            if (event.key === 'Enter') {
              event.preventDefault();
              submit();
            }
            if (event.key === 'Escape') onCancel();
          }}
        />
        {invalid && (
          <p id={`${id}-error`} className="text-sm text-destructive">
            {error}
          </p>
        )}
      </div>
      {withAlt ? (
        <div className="space-y-1">
          <Label htmlFor={`${id}-alt`}>Description de l’image</Label>
          <Input
            id={`${id}-alt`}
            maxLength={300}
            value={alt}
            onChange={(event) => setAlt(event.target.value)}
          />
        </div>
      ) : (
        <span className="hidden sm:block" />
      )}
      <div className="flex gap-2">
        <Button type="button" size="sm" onClick={submit}>
          Insérer
        </Button>
        <Button type="button" size="sm" variant="outline" onClick={onCancel}>
          Annuler
        </Button>
      </div>
    </div>
  );
}
