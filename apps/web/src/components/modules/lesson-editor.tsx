'use client';

import {
  isSafeImageSrc,
  isSafeLinkHref,
  type LessonDocument,
  lessonFileImageSrc,
  PEDAGOGICAL_BLOCKS,
  type PedagogicalBlockKey,
} from '@tesla/shared';
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
  Ellipsis,
  Quote,
  SquareStack,
  Redo2,
  Strikethrough,
  Underline,
  Undo2,
  Unlink,
} from 'lucide-react';
import { useEffect, useId, useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { resolveImageSrc } from '@/lib/api/assets';
import { uploadModuleFile } from '@/lib/api/files';
import { MAX_ASSET_BYTES } from '@/lib/offline/downloads';
import { cn } from '@/lib/utils';

/**
 * Image Tiptap dont l'adresse d'affichage est résolue (image stockée par Tesla) ; le document
 * conserve l'adresse enregistrée (`attrs.src`), jamais l'adresse résolue.
 */
const LessonImage = Image.extend({
  addAttributes() {
    return {
      ...this.parent?.(),
      src: {
        default: null,
        renderHTML: (attributes: { src?: string | null }) =>
          attributes.src ? { src: resolveImageSrc(attributes.src) } : {},
      },
    };
  },
});

/** Formats d'image acceptés depuis l'appareil (liste blanche du stockage, sans SVG). */
const DEVICE_IMAGE_TYPES = ['image/png', 'image/jpeg', 'image/webp', 'image/gif'];

/**
 * Éditeur de contenu de leçon (Tiptap). Le document produit est du JSON structuré ; l'API le
 * valide par liste blanche avant stockage. Pas de bloc de code, pas de HTML brut, pas d'image
 * intégrée en base64 : une image est une adresse https externe ou un fichier envoyé depuis
 * l'appareil (stockage contrôlé, `moduleId` requis).
 */
export function LessonEditor({
  value,
  onChange,
  label,
  editable = true,
  moduleId,
  className,
}: {
  value: LessonDocument;
  onChange: (document: unknown) => void;
  label: string;
  editable?: boolean;
  moduleId?: string;
  className?: string;
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
      LessonImage.configure({ inline: false, allowBase64: false }),
    ],
    content: value,
    editorProps: {
      attributes: {
        class: cn(
          'lesson-content min-h-48 space-y-3 rounded-b-md border border-t-0 bg-white px-4 py-3 text-base leading-relaxed focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-ring/40 [&_img]:max-h-80 [&_img]:max-w-full [&_img]:rounded-md',
          className,
        ),
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
      {editable && <Toolbar editor={editor} moduleId={moduleId} />}
      <EditorContent editor={editor} />
    </div>
  );
}

function Toolbar({ editor, moduleId }: { editor: Editor; moduleId?: string }) {
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

  const insertBlock = (key: PedagogicalBlockKey) => {
    const block = PEDAGOGICAL_BLOCKS.find((b) => b.key === key)!;
    if (key === 'reference') {
      chain()
        .insertContent({ type: 'paragraph', content: [{ type: 'text', text: 'Référence : ' }] })
        .run();
      return;
    }
    chain()
      .insertContent([
        { type: 'heading', attrs: { level: 3 }, content: [{ type: 'text', text: block.title }] },
        { type: 'paragraph' },
      ])
      .run();
  };

  // `secondary` : regroupés dans « Plus » sur petit écran.
  const tools: {
    label: string;
    icon: LucideIcon;
    active?: boolean;
    disabled?: boolean;
    secondary?: boolean;
    shortcut?: string;
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
    {
      label: 'Gras',
      icon: Bold,
      active: state.bold,
      shortcut: 'Ctrl+B',
      run: () => chain().toggleBold().run(),
    },
    {
      label: 'Italique',
      icon: Italic,
      active: state.italic,
      shortcut: 'Ctrl+I',
      run: () => chain().toggleItalic().run(),
    },
    {
      label: 'Souligné',
      icon: Underline,
      active: state.underline,
      secondary: true,
      shortcut: 'Ctrl+U',
      run: () => chain().toggleUnderline().run(),
    },
    {
      label: 'Barré',
      icon: Strikethrough,
      active: state.strike,
      secondary: true,
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
      secondary: true,
      run: () => chain().toggleOrderedList().run(),
    },
    {
      label: 'Citation',
      icon: Quote,
      active: state.quote,
      secondary: true,
      run: () => chain().toggleBlockquote().run(),
    },
    {
      label: 'Séparateur',
      icon: Minus,
      secondary: true,
      run: () => chain().setHorizontalRule().run(),
    },
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
    {
      label: 'Défaire',
      icon: Undo2,
      disabled: !state.canUndo,
      shortcut: 'Ctrl+Z',
      run: () => chain().undo().run(),
    },
    {
      label: 'Refaire',
      icon: Redo2,
      disabled: !state.canRedo,
      shortcut: 'Ctrl+Maj+Z',
      run: () => chain().redo().run(),
    },
  ];
  const secondary = tools.filter((tool) => tool.secondary);

  return (
    <div className="rounded-t-md border bg-muted/50">
      <div
        role="toolbar"
        aria-label="Mise en forme"
        className="flex flex-wrap items-center gap-0.5 p-1"
      >
        {tools.map(
          ({ label, icon: Icon, active, disabled, secondary: isSecondary, shortcut, run }) => (
            <Button
              key={label}
              type="button"
              variant="ghost"
              size="icon"
              className={cn(
                'size-9 sm:size-8',
                isSecondary && 'hidden sm:inline-flex',
                active && 'bg-tesla-sable text-tesla-bordeaux',
              )}
              aria-label={label}
              title={shortcut ? `${label} (${shortcut})` : label}
              aria-pressed={active}
              disabled={disabled}
              onClick={run}
            >
              <Icon aria-hidden />
            </Button>
          ),
        )}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="size-9 sm:hidden"
              aria-label="Plus d’options de mise en forme"
            >
              <Ellipsis aria-hidden />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent
            align="start"
            // Le focus revient dans le texte (et non sur le bouton du menu) pour continuer la saisie.
            onCloseAutoFocus={(event) => {
              event.preventDefault();
              editor.commands.focus();
            }}
          >
            {secondary.map(({ label, icon: Icon, run }) => (
              <DropdownMenuItem key={label} onSelect={run}>
                <Icon aria-hidden />
                {label}
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button type="button" variant="ghost" size="sm" className="ml-auto h-9 sm:h-8">
              <SquareStack aria-hidden />
              Bloc pédagogique
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent
            align="end"
            // Le focus revient dans le texte (et non sur le bouton du menu) pour continuer la saisie.
            onCloseAutoFocus={(event) => {
              event.preventDefault();
              editor.commands.focus();
            }}
          >
            <DropdownMenuLabel>Insérer un bloc</DropdownMenuLabel>
            {PEDAGOGICAL_BLOCKS.map((block) => (
              <DropdownMenuItem
                key={block.key}
                onSelect={() => insertBlock(block.key)}
                className="flex-col items-start gap-0"
              >
                <span className="font-medium">{block.title}</span>
                <span className="text-xs text-muted-foreground">{block.hint}</span>
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>
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
      {panel === 'image' && moduleId && (
        <DeviceImageForm
          moduleId={moduleId}
          onInsert={(src, alt) => {
            chain().setImage({ src, alt }).run();
            setPanel(null);
          }}
          onCancel={() => setPanel(null)}
        />
      )}
      {panel === 'image' && (
        <UrlForm
          label={moduleId ? 'Ou adresse web de l’image' : 'Adresse de l’image'}
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

/**
 * Image envoyée depuis l'appareil : format et taille contrôlés avant l'envoi (3 Mo au plus pour
 * rester téléchargeable hors ligne), aperçu local, description obligatoire, envoi direct au
 * stockage puis vérification par le serveur. Réseau requis (aucune file d'attente de fichiers).
 */
function DeviceImageForm({
  moduleId,
  onInsert,
  onCancel,
}: {
  moduleId: string;
  onInsert: (src: string, alt: string) => void;
  onCancel: () => void;
}) {
  const id = useId();
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [alt, setAlt] = useState('');
  const [progress, setProgress] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Aperçu local (adresse blob:) libéré au remplacement du fichier et à la fermeture.
  const previewRef = useRef<string | null>(null);
  const setLocalPreview = (next: File | null) => {
    if (previewRef.current) URL.revokeObjectURL(previewRef.current);
    previewRef.current = next ? URL.createObjectURL(next) : null;
    setPreview(previewRef.current);
  };
  useEffect(
    () => () => {
      if (previewRef.current) URL.revokeObjectURL(previewRef.current);
    },
    [],
  );

  const choose = (selected: File | undefined) => {
    setError(null);
    setFile(null);
    setLocalPreview(null);
    if (!selected) return;
    if (!DEVICE_IMAGE_TYPES.includes(selected.type)) {
      setError('Format non accepté : PNG, JPEG, WebP ou GIF.');
      return;
    }
    if (selected.size > MAX_ASSET_BYTES) {
      setError('Image trop lourde : 3 Mo au maximum. Réduisez-la avant de l’envoyer.');
      return;
    }
    setFile(selected);
    setLocalPreview(selected);
  };

  const send = async () => {
    if (!file) return;
    if (!alt.trim()) {
      setError('Décrivez l’image en quelques mots (lue par les lecteurs d’écran).');
      return;
    }
    setError(null);
    try {
      const stored = await uploadModuleFile(moduleId, file, setProgress);
      onInsert(lessonFileImageSrc(stored.id), alt.trim());
    } catch (sendError) {
      setError(sendError instanceof Error ? sendError.message : 'Envoi impossible.');
    } finally {
      setProgress(null);
    }
  };

  return (
    <div className="grid gap-3 border-t p-2 sm:grid-cols-[auto_1fr]">
      <div className="flex size-24 items-center justify-center overflow-hidden rounded-md border bg-white text-xs text-muted-foreground">
        {preview ? (
          // Aperçu local (adresse blob:) avant envoi.
          // eslint-disable-next-line @next/next/no-img-element
          <img src={preview} alt="" className="max-h-full max-w-full object-contain" />
        ) : (
          'Aperçu'
        )}
      </div>
      <div className="space-y-2">
        <div className="space-y-1">
          <Label htmlFor={`${id}-file`}>Image depuis l’appareil</Label>
          <Input
            id={`${id}-file`}
            type="file"
            accept={DEVICE_IMAGE_TYPES.join(',')}
            disabled={progress !== null}
            onChange={(event) => choose(event.target.files?.[0])}
          />
          <p className="text-xs text-muted-foreground">PNG, JPEG, WebP ou GIF, 3 Mo au maximum.</p>
        </div>
        <div className="space-y-1">
          <Label htmlFor={`${id}-alt`}>Description de l’image</Label>
          <Input
            id={`${id}-alt`}
            maxLength={300}
            value={alt}
            disabled={progress !== null}
            onChange={(event) => setAlt(event.target.value)}
          />
        </div>
        {error && (
          <p role="alert" className="text-sm text-destructive">
            {error}
          </p>
        )}
        <div className="flex flex-wrap items-center gap-2">
          <Button
            type="button"
            size="sm"
            disabled={!file || progress !== null}
            onClick={() => void send()}
          >
            {progress ?? 'Envoyer et insérer'}
          </Button>
          <Button
            type="button"
            size="sm"
            variant="outline"
            disabled={progress !== null}
            onClick={onCancel}
          >
            Annuler
          </Button>
          {progress && (
            <span role="status" className="text-sm text-muted-foreground">
              {progress}
            </span>
          )}
        </div>
      </div>
    </div>
  );
}
