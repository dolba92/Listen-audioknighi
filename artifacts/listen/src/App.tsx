import { useEffect, useMemo, useRef, useState, createContext, useContext, type ChangeEvent, type FormEvent, type ReactNode } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ErrorBoundary } from '@/components/error-boundary';
import { Toaster } from '@/components/ui/toaster';
import { TooltipProvider } from '@/components/ui/tooltip';
import { BookOpen, Check, ChevronLeft, CircleHelp, Clock3, FileAudio, Headphones, Leaf, Library, Menu, Moon, MoreHorizontal, Pause, Pencil, Play, Plus, RotateCcw, Search, Settings, SkipBack, SkipForward, SlidersHorizontal, Sparkles, Trash2, Volume2, X, Zap } from 'lucide-react';
import { Link, Route, Switch, Router as WouterRouter, useLocation, useParams } from 'wouter';
import { useLibrary, type Book, type BookDraft } from '@/hooks/use-library';

const queryClient = new QueryClient();
const SPEEDS = [1, 1.25, 1.5, 1.75, 2, 2.25, 2.5, 2.75, 3];
const TONES = ['sage', 'clay', 'ochre', 'ink', 'moss'];

type LibraryValue = ReturnType<typeof useLibrary>;
const LibraryContext = createContext<LibraryValue | null>(null);
function useLibraryContext() {
  const value = useContext(LibraryContext);
  if (!value) throw new Error('Загрузите книги');
  return value;
}

function formatTime(value: number) {
  if (!Number.isFinite(value) || value < 0) return '00:00';
  const seconds = Math.floor(value);
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  return h > 0 ? `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}` : `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

function inferBookDetails(fileName: string) {
  const withoutExtension = fileName.replace(/\.[^/.]+$/, '').replace(/[_]+/g, ' ').trim();
  const normalized = withoutExtension || 'Новая аудиокнига';
  const authorTitle = normalized.split(/\s+[—–-]\s+/);
  if (authorTitle.length === 2 && authorTitle[0].trim() && authorTitle[1].trim()) {
    return { author: authorTitle[0].trim(), title: authorTitle[1].trim() };
  }
  return { title: normalized, author: 'Автор не указан' };
}

function Logo() {
  return (
    <Link href="/" className="flex items-center gap-3 no-underline" data-testid="link-logo">
      <span className="grid size-10 place-items-center rounded-2xl bg-primary text-primary-foreground shadow-sm">
        <img src="/logo.png" alt="Listen" className="size-7 rounded-lg" />
      </span>
      <span className="font-display text-[28px] font-semibold tracking-[-.03em]">Listen</span>
    </Link>
  );
}

function Branch() {
  return (
    <svg className="pointer-events-none absolute right-8 top-6 hidden h-28 w-36 text-primary/20 md:block" viewBox="0 0 140 110" fill="none">
      <path d="M126 7C100 18 91 36 85 58c-5 20-18 35-39 44" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
      <path d="M103 22c8-8 16-8 24-7-5 7-12 10-24 7ZM91 39c8-5 15-4 21-2-5 5-12 7-21 2ZM75 65c6-7 13-9 20-9-3 7-10 11-20 9ZM57 84c5-6 11-7 17-7-3 6-8 9-17 7Z" fill="currentColor" />
    </svg>
  );
}

function Cover({ book, size = 'md' }: { book: Pick<Book, 'title' | 'author' | 'coverBlob' | 'coverTone'>; size?: 'sm' | 'md' | 'lg' }) {
  const [src, setSrc] = useState('');
  useEffect(() => {
    if (!book.coverBlob) {
      setSrc('');
      return;
    }
    const url = URL.createObjectURL(book.coverBlob);
    setSrc(url);
    return () => URL.revokeObjectURL(url);
  }, [book.coverBlob]);
  const initials = book.title.split(/\s+/).slice(0, 2).map((word) => word[0]).join('').toUpperCase();
  const sizeClass = size === 'lg' ? 'aspect-[3/4] w-full max-w-[360px] rounded-[26px]' : size === 'sm' ? 'size-[60px] rounded-[14px]' : 'aspect-[3/4] w-full rounded-[20px]';
  return (
    <div className={`cover-art cover-${book.coverTone} ${sizeClass} relative shrink-0 overflow-hidden`} data-testid={`img-cover-${book.title}`}>
      {src ? <img src={src} alt={`Обложка: ${book.title}`} className="size-full object-cover" /> : (
        <>
          <span className="absolute inset-x-0 top-0 h-1/2 opacity-25" style={{ background: 'radial-gradient(circle at 75% 25%, currentColor 0 1px, transparent 1.5px), radial-gradient(circle at 35% 50%, currentColor 0 1px, transparent 1.5px)', backgroundSize: '28px 28px' }} />
          <span className="absolute bottom-5 left-5 right-5 font-display text-3xl font-semibold leading-[.9] md:text-4xl">{initials}</span>
          <span className="absolute bottom-5 right-5 top-5 w-px bg-current opacity-30" />
          <span className="absolute left-5 top-5 max-w-[80%] font-mono-ui text-[9px] uppercase tracking-[.18em] opacity-65">Listen / книга</span>
        </>
      )}
    </div>
  );
}

function ProgressBar({ value, className = '' }: { value: number; className?: string }) {
  return <div className={`h-1.5 overflow-hidden rounded-full bg-secondary ${className}`}><div className="h-full rounded-full bg-primary transition-[width] duration-500" style={{ width: `${Math.min(100, Math.max(0, value))}%` }} /></div>;
}

function SkeletonHome() {
  return (
    <div className="space-y-9 animate-fade" data-testid="status-loading">
      <div className="space-y-3"><div className="h-3 w-32 animate-pulse-soft rounded bg-secondary" /><div className="h-14 w-3/4 max-w-xl animate-pulse-soft rounded-xl bg-secondary" /></div>
      <div className="h-64 animate-pulse-soft rounded-[28px] bg-card/70" />
      <div className="grid grid-cols-2 gap-4 md:grid-cols-4">{[1, 2, 3, 4].map((item) => <div key={item} className="aspect-[3/4] animate-pulse-soft rounded-[20px] bg-card/70" />)}</div>
    </div>
  );
}

function EmptyState({ onAdd }: { onAdd: () => void }) {
  return (
    <section className="relative overflow-hidden rounded-[28px] border border-dashed border-primary/25 bg-card/50 px-6 py-16 text-center md:px-20" data-testid="state-empty-library">
      <Branch />
      <span className="mx-auto mb-5 grid size-14 place-items-center rounded-2xl bg-secondary text-primary"><BookOpen className="size-6" /></span>
      <h2 className="font-display text-4xl font-semibold">Здесь пока пусто</h2>
      <p className="mx-auto mt-3 max-w-md text-sm leading-6 text-muted-foreground">Добавьте аудиокнигу — она останется у вас, даже если вы закроете браузер.</p>
      <button onClick={onAdd} className="mt-7 inline-flex h-12 items-center gap-2 rounded-full bg-primary px-6 text-sm font-semibold text-primary-foreground transition-transform hover:-translate-y-0.5" data-testid="button-empty-add"><Plus className="size-4" /> Добавить книгу</button>
    </section>
  );
}

function BookMenu({ book, onEdit, onDelete }: { book: Book; onEdit: () => void; onDelete: () => void }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="relative">
      <button onClick={() => setOpen(!open)} className="grid size-9 place-items-center rounded-full text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground" aria-label="Действия с книгой" data-testid={`button-menu-${book.id}`}><MoreHorizontal className="size-5" /></button>
      {open && <div className="absolute right-0 top-11 z-20 w-44 rounded-2xl border border-card-border bg-card p-1.5 shadow-lg animate-fade" data-testid={`menu-book-${book.id}`}>
        <button onClick={() => { setOpen(false); onEdit(); }} className="flex w-full items-center gap-2 rounded-xl px-3 py-2.5 text-left text-xs hover:bg-secondary" data-testid={`button-edit-${book.id}`}><Pencil className="size-3.5" /> Изменить данные</button>
        <button onClick={() => { setOpen(false); onDelete(); }} className="flex w-full items-center gap-2 rounded-xl px-3 py-2.5 text-left text-xs text-destructive hover:bg-destructive/10" data-testid={`button-delete-${book.id}`}><Trash2 className="size-3.5" /> Удалить книгу</button>
      </div>}
    </div>
  );
}

function BookCard({ book, onOpen, onEdit, onDelete }: { book: Book; onOpen: () => void; onEdit: () => void; onDelete: () => void }) {
  return (
    <article className="group animate-rise" data-testid={`card-book-${book.id}`}>
      <button onClick={onOpen} className="block w-full text-left" data-testid={`button-open-${book.id}`}>
        <div className="relative">
          <Cover book={book} />
          <div className="absolute inset-x-0 bottom-0 p-2.5 opacity-0 transition-opacity group-hover:opacity-100 group-focus-within:opacity-100">
            <div className="rounded-xl bg-foreground/80 px-3 py-2 text-center text-[11px] font-semibold text-card">Открыть книгу</div>
          </div>
          {book.completed && <span className="absolute right-3 top-3 grid size-7 place-items-center rounded-full bg-card text-primary shadow-sm"><Check className="size-4" /></span>}
        </div>
      </button>
      <div className="mt-3 flex items-start justify-between gap-2">
        <button onClick={onOpen} className="min-w-0 text-left" data-testid={`button-title-${book.id}`}><h3 className="truncate text-sm font-semibold">{book.title}</h3><p className="mt-1 truncate text-xs text-muted-foreground">{book.author}</p></button>
        <BookMenu book={book} onEdit={onEdit} onDelete={onDelete} />
      </div>
      <div className="mt-3 flex items-center gap-2"><ProgressBar value={book.percentage} className="flex-1" /><span className="font-mono-ui text-[10px] text-muted-foreground">{Math.round(book.percentage)}%</span></div>
    </article>
  );
}

function ContinueCard({ book, onOpen }: { book: Book; onOpen: () => void }) {
  return (
    <section className="relative overflow-hidden rounded-[28px] bg-primary px-5 py-5 text-primary-foreground deep-shadow md:px-8 md:py-7" data-testid="card-continue">
      <div className="absolute -right-8 -top-14 size-56 rounded-full border border-primary-foreground/10" /><div className="absolute -right-1 -top-7 size-36 rounded-full border border-primary-foreground/10" />
      <div className="relative flex flex-col gap-6 sm:flex-row sm:items-center">
        <Cover book={book} size="sm" />
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 text-[10px] font-semibold uppercase tracking-[.18em] opacity-65"><Headphones className="size-3.5" /> Продолжить слушать</div>
          <h2 className="mt-3 truncate font-display text-3xl font-semibold leading-none md:text-4xl">{book.title}</h2>
          <p className="mt-2 text-sm opacity-70">{book.author} <span className="mx-1 opacity-50">•</span> осталось {formatTime(Math.max(book.duration - book.position, 0))}</p>
          <div className="mt-5 flex items-center gap-3"><ProgressBar value={book.percentage} className="max-w-[260px] flex-1 bg-primary-foreground/20 [&>div]:bg-accent" /><span className="font-mono-ui text-[10px] opacity-75">{Math.round(book.percentage)}%</span></div>
        </div>
        <button onClick={onOpen} className="inline-flex h-12 shrink-0 items-center justify-center gap-2 rounded-full bg-card px-5 text-sm font-semibold text-foreground transition-transform hover:-translate-y-0.5" data-testid={`button-continue-${book.id}`}><Play className="size-4 fill-current" /> Открыть</button>
      </div>
    </section>
  );
}

function HomePage({ onAdd }: { onAdd: () => void }) {
  const { books, isLoading, error, reload, deleteBook } = useLibraryContext();
  const [, setLocation] = useLocation();
  const [query, setQuery] = useState('');
  const [editing, setEditing] = useState<Book | null>(null);
  const inProgress = useMemo(() => books.filter((book) => !book.completed && book.percentage > 0).sort((a, b) => b.updatedAt - a.updatedAt), [books]);
  const completed = useMemo(() => books.filter((book) => book.completed), [books]);
  const filtered = useMemo(() => books.filter((book) => `${book.title} ${book.author}`.toLowerCase().includes(query.toLowerCase())), [books, query]);
  const confirmDelete = async (book: Book) => {
    if (window.confirm(`Удалить «${book.title}» из библиотеки?`)) await deleteBook(book.id);
  };
  if (isLoading) return <SkeletonHome />;
  if (error) return <section className="rounded-[28px] bg-card p-10 text-center" data-testid="state-error"><CircleHelp className="mx-auto size-8 text-destructive" /><h2 className="mt-4 font-display text-3xl font-semibold">Не удалось открыть библиотеку</h2><p className="mt-2 text-sm text-muted-foreground">{error}</p><button onClick={() => void reload()} className="mt-5 inline-flex items-center gap-2 rounded-full bg-primary px-5 py-3 text-sm font-semibold text-primary-foreground" data-testid="button-retry"><RotateCcw className="size-4" /> Повторить</button></section>;
  if (books.length === 0) return <EmptyState onAdd={onAdd} />;
  return (
    <div className="space-y-12">
      <header className="relative animate-rise">
        <Branch />
        <p className="font-mono-ui text-[10px] font-bold uppercase tracking-[.22em] text-primary/70">Личная аудиотека</p>
        <div className="mt-3 flex flex-col justify-between gap-5 md:flex-row md:items-end">
          <div><h1 className="max-w-2xl font-display text-5xl font-semibold leading-[.92] tracking-[-.04em] sm:text-6xl">Ваше тихое место<br /><em className="font-normal text-primary">для историй.</em></h1><p className="mt-5 max-w-md text-sm leading-6 text-muted-foreground">Книги ждут вас здесь. Никаких рекомендаций — только то, что вы выбрали сами.</p></div>
          <button onClick={onAdd} className="inline-flex h-12 items-center justify-center gap-2 self-start rounded-full bg-primary px-5 text-sm font-semibold text-primary-foreground transition-transform hover:-translate-y-0.5 md:self-end" data-testid="button-add-book"><Plus className="size-4" /> Добавить книгу</button>
        </div>
      </header>
      {inProgress[0] && <ContinueCard book={inProgress[0]} onOpen={() => setLocation(`/player/${inProgress[0].id}`)} />}
      <section data-testid="section-collection">
        <div className="mb-5 flex flex-col justify-between gap-3 sm:flex-row sm:items-center"><div><p className="font-mono-ui text-[10px] uppercase tracking-[.18em] text-muted-foreground">Ваша полка</p><h2 className="mt-1 font-display text-4xl font-semibold">Все книги <span className="font-sans text-base font-medium text-muted-foreground">/ {books.length}</span></h2></div><label className="flex h-11 w-full items-center gap-2 rounded-full border border-border bg-card px-4 text-sm text-muted-foreground sm:w-60"><Search className="size-4" /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Найти книгу" className="min-w-0 flex-1 bg-transparent outline-none placeholder:text-muted-foreground/70" data-testid="input-search" /></label></div>
        {filtered.length > 0 ? <div className="grid grid-cols-2 gap-x-4 gap-y-8 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">{filtered.map((book) => <BookCard key={book.id} book={book} onOpen={() => setLocation(`/player/${book.id}`)} onEdit={() => setEditing(book)} onDelete={() => void confirmDelete(book)} />)}</div> : <div className="rounded-2xl bg-card/60 px-6 py-10 text-center text-sm text-muted-foreground" data-testid="state-search-empty">По вашему запросу ничего не найдено.</div>}
      </section>
      {completed.length > 0 && <section data-testid="section-completed"><div className="mb-5 flex items-end justify-between"><div><p className="font-mono-ui text-[10px] uppercase tracking-[.18em] text-muted-foreground">Сохранено в памяти</p><h2 className="mt-1 font-display text-4xl font-semibold">Завершённые</h2></div><span className="hidden items-center gap-1.5 text-xs text-primary sm:flex"><Check className="size-4" /> Всё прослушано</span></div><div className="grid grid-cols-2 gap-4 sm:grid-cols-4">{completed.map((book) => <BookCard key={book.id} book={book} onOpen={() => setLocation(`/player/${book.id}`)} onEdit={() => setEditing(book)} onDelete={() => void confirmDelete(book)} />)}</div></section>}
      {editing && <BookFormModal book={editing} onClose={() => setEditing(null)} />}
    </div>
  );
}

function BookFormModal({ book, onClose }: { book?: Book; onClose: () => void }) {
  const { addBook, updateBook } = useLibraryContext();
  const [title, setTitle] = useState(book?.title ?? '');
  const [author, setAuthor] = useState(book?.author ?? '');
  const [narrator, setNarrator] = useState(book?.narrator ?? '');
  const [description, setDescription] = useState(book?.description ?? '');
  const [tone, setTone] = useState(book?.coverTone ?? TONES[Math.floor(Math.random() * TONES.length)]);
  const [audio, setAudio] = useState<File | null>(null);
  const [duration, setDuration] = useState(book?.duration ?? 0);
  const [isSaving, setIsSaving] = useState(false);
  const [formError, setFormError] = useState('');
  const audioInput = useRef<HTMLInputElement>(null);
  
  const [coverFile, setCoverFile] = useState<File | null>(null);
  const [coverPreview, setCoverPreview] = useState<string | null>(null);
  const coverInput = useRef<HTMLInputElement>(null);

  const onAudioChange = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    setAudio(file);

    // Автоматически заполняем название и автора из имени файла
    if (!book) {
      const details = inferBookDetails(file.name);
      setTitle(details.title);
      setAuthor(details.author);
    }

    // Определяем длительность
    const url = URL.createObjectURL(file);
    const probe = document.createElement('audio');
    probe.onloadedmetadata = () => { setDuration(probe.duration); URL.revokeObjectURL(url); };
    probe.onerror = () => URL.revokeObjectURL(url);
    probe.src = url;

    // 🔥 НОВЫЙ БЛОК: Читаем ID3-теги для обложки
    try {
      // Динамически импортируем библиотеку id3js
      const ID3 = await import('id3js');
      const tags = await ID3.fromFile(file);
      
      // Если в тегах есть обложка
      if (tags.picture) {
        const picture = tags.picture;
        // Преобразуем данные обложки в Blob
        const blob = new Blob([picture.data], { type: picture.format });
        const imageUrl = URL.createObjectURL(blob);
        setCoverPreview(imageUrl);
        // Создаём File из Blob для сохранения в IndexedDB
        setCoverFile(new File([blob], 'cover.jpg', { type: picture.format }));
        console.log('✅ Обложка автоматически загружена из MP3');
      } else {
        console.log('ℹ️ В MP3-файле нет встроенной обложки');
      }
    } catch (error) {
      console.error('⚠️ Не удалось прочитать ID3-теги:', error);
    }
  };

  const onCoverChange = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    setCoverFile(file);
    const url = URL.createObjectURL(file);
    setCoverPreview(url);
  };

  const save = async (event: FormEvent) => {
    event.preventDefault();
    if (!book && !audio) { setFormError('Выберите аудиофайл.'); return; }
    setIsSaving(true); setFormError('');
    try {
      if (book) {
        const patch: Partial<Book> = {
          title: title.trim(),
          author: author.trim(),
          narrator: narrator.trim(),
          description: description.trim(),
          coverTone: tone,
          coverBlob: coverFile || book.coverBlob,
        };
        if (audio) { patch.audioBlob = audio; patch.audioName = audio.name; patch.audioType = audio.type; patch.duration = duration; patch.position = 0; patch.percentage = 0; patch.completed = false; }
        await updateBook(book.id, patch);
      } else if (audio) {
        const details = inferBookDetails(audio.name);
        await addBook({
          title: title.trim() || details.title,
          author: author.trim() || details.author,
          narrator: narrator.trim(),
          description: description.trim(),
          coverTone: tone,
          audioBlob: audio,
          audioName: audio.name,
          audioType: audio.type,
          duration,
          coverBlob: coverFile || undefined,
        });
      }
      onClose();
    } catch { setFormError('Не удалось сохранить данные. Попробуйте ещё раз.'); } finally { setIsSaving(false); }
  };

  return (
    <div className="fixed inset-0 z-40 flex items-end justify-center bg-foreground/25 p-0 backdrop-blur-sm sm:items-center sm:p-6 animate-fade" role="dialog" aria-modal="true" data-testid="modal-book-form">
      <form onSubmit={(event) => void save(event)} className="max-h-[94dvh] w-full max-w-xl overflow-y-auto rounded-t-[28px] bg-card p-6 shadow-2xl sm:rounded-[28px] sm:p-8">
        <div className="flex items-start justify-between"><div><p className="font-mono-ui text-[10px] uppercase tracking-[.18em] text-primary/70">{book ? 'Редактирование' : 'Новая запись'}</p><h2 className="mt-2 font-display text-4xl font-semibold">{book ? 'Изменить книгу' : 'Добавить книгу'}</h2></div><button type="button" onClick={onClose} className="grid size-10 place-items-center rounded-full hover:bg-secondary" aria-label="Закрыть" data-testid="button-close-modal"><X className="size-5" /></button></div>
         <div className="mt-7 grid gap-4 sm:grid-cols-2">
           {book && <><label className="sm:col-span-2"><span className="mb-1.5 block text-xs font-semibold">Название книги</span><input value={title} onChange={(event) => setTitle(event.target.value)} className="h-12 w-full rounded-xl border border-input bg-background px-4 text-sm outline-none transition-shadow focus:ring-2 focus:ring-ring/30" placeholder="Название книги" data-testid="input-book-title" /></label>
           <label><span className="mb-1.5 block text-xs font-semibold">Автор</span><input value={author} onChange={(event) => setAuthor(event.target.value)} className="h-12 w-full rounded-xl border border-input bg-background px-4 text-sm outline-none focus:ring-2 focus:ring-ring/30" placeholder="Имя автора" data-testid="input-book-author" /></label>
           <label><span className="mb-1.5 block text-xs font-semibold">Читает</span><input value={narrator} onChange={(event) => setNarrator(event.target.value)} className="h-12 w-full rounded-xl border border-input bg-background px-4 text-sm outline-none focus:ring-2 focus:ring-ring/30" placeholder="Имя чтеца" data-testid="input-book-narrator" /></label>
           <label className="sm:col-span-2"><span className="mb-1.5 block text-xs font-semibold">Короткая заметка</span><textarea value={description} onChange={(event) => setDescription(event.target.value)} className="min-h-20 w-full resize-y rounded-xl border border-input bg-background px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-ring/30" placeholder="Что хочется помнить об этой книге?" data-testid="input-book-description" /></label></>}
           <div className="sm:col-span-2"><span className="mb-1.5 block text-xs font-semibold">Аудиофайл</span><button type="button" onClick={() => audioInput.current?.click()} className="flex min-h-16 w-full items-center gap-3 rounded-xl border border-dashed border-primary/35 bg-secondary/40 px-4 text-left transition-colors hover:bg-secondary" data-testid="button-upload-audio"><span className="grid size-9 place-items-center rounded-lg bg-primary text-primary-foreground"><FileAudio className="size-4" /></span><span className="min-w-0"><strong className="block truncate text-xs">{audio?.name ?? book?.audioName ?? 'Выбрать аудиофайл'}</strong><small className="text-[10px] text-muted-foreground">Название и обложка определятся автоматически · MP3, M4A, M4B, WAV, OGG</small></span></button><input ref={audioInput} type="file" accept=".mp3,.m4a,.m4b,.wav,.ogg,audio/*" onChange={onAudioChange} className="hidden" data-testid="input-upload-audio" /></div>
           <div className="sm:col-span-2">
             <span className="mb-1.5 block text-xs font-semibold">Обложка</span>
             <button type="button" onClick={() => coverInput.current?.click()} className="flex min-h-16 w-full items-center gap-3 rounded-xl border border-dashed border-primary/35 bg-secondary/40 px-4 text-left transition-colors hover:bg-secondary">
               <span className="grid size-9 place-items-center rounded-lg bg-primary text-primary-foreground text-lg">🖼️</span>
               <span className="min-w-0">
                 <strong className="block truncate text-xs">{coverFile?.name || (book?.coverBlob ? 'Обложка уже есть' : 'Выбрать изображение')}</strong>
                 <small className="text-[10px] text-muted-foreground">PNG, JPG, WebP</small>
               </span>
             </button>
             <input ref={coverInput} type="file" accept="image/*" onChange={onCoverChange} className="hidden" />
             {coverPreview && <img src={coverPreview} alt="Обложка" className="mt-3 h-24 w-24 rounded-lg object-cover border" />}
           </div>
           {book && <div className="sm:col-span-2"><span className="mb-2 block text-xs font-semibold">Оттенок автоматически созданной обложки</span><div className="flex gap-2">{TONES.map((item) => <button key={item} type="button" onClick={() => setTone(item)} className={`tone-dot tone-${item} ${tone === item ? 'ring-2 ring-primary ring-offset-2 ring-offset-card' : ''}`} aria-label={`Оттенок ${item}`} data-testid={`button-tone-${item}`} />)}</div></div>}
        </div>
        {formError && <p className="mt-4 rounded-xl bg-destructive/10 px-3 py-2 text-xs text-destructive" data-testid="status-form-error">{formError}</p>}
        <div className="mt-7 flex gap-3"><button type="button" onClick={onClose} className="h-12 flex-1 rounded-full border border-border text-sm font-semibold hover:bg-secondary" data-testid="button-cancel-form">Отмена</button><button type="submit" disabled={isSaving} className="h-12 flex-1 rounded-full bg-primary text-sm font-semibold text-primary-foreground transition-opacity disabled:opacity-60" data-testid="button-save-book">{isSaving ? 'Сохраняем…' : book ? 'Сохранить изменения' : 'Добавить в библиотеку'}</button></div>
      </form>
    </div>
  );
}

function PlayerPage() {
  const { id } = useParams<{ id: string }>();
  const { books, updateBook } = useLibraryContext();
  const [, setLocation] = useLocation();
  const book = books.find((item) => item.id === id);
  const audioRef = useRef<HTMLAudioElement>(null);
  const persistAt = useRef(0);
  const positionRef = useRef(book?.position ?? 0);
  const durationRef = useRef(book?.duration ?? 0);
  const restoredPositionRef = useRef(false);
  const [src, setSrc] = useState('');
  const [current, setCurrent] = useState(book?.position ?? 0);
  const [duration, setDuration] = useState(book?.duration ?? 0);
  const [playing, setPlaying] = useState(false);
  const [speed, setSpeed] = useState(book?.speed ?? 1);
  const [notice, setNotice] = useState('');
  useEffect(() => {
    if (!book?.audioBlob) { setSrc(''); restoredPositionRef.current = false; return; }
    const url = URL.createObjectURL(book.audioBlob);
    setSrc(url);
    restoredPositionRef.current = false;
    return () => URL.revokeObjectURL(url);
  }, [book?.id, book?.audioBlob]);
  useEffect(() => {
    if (!book) return;
    positionRef.current = book.position;
    durationRef.current = book.duration;
    setCurrent(book.position);
    setDuration(book.duration);
    const normalizedSpeed = SPEEDS.includes(book.speed) ? book.speed : 1;
    setSpeed(normalizedSpeed);
    if (normalizedSpeed !== book.speed) void updateBook(book.id, { speed: normalizedSpeed });
  }, [book?.id]);
  useEffect(() => {
    if (audioRef.current) { audioRef.current.playbackRate = speed; }
  }, [speed, src]);
  const persistPosition = (value: number, completedOverride?: boolean) => {
    if (!book) return;
    const total = durationRef.current || audioRef.current?.duration || 0;
    const safeValue = Math.max(0, Number.isFinite(value) ? value : 0);
    const percent = total > 0 ? Math.min(100, (safeValue / total) * 100) : 0;
    positionRef.current = safeValue;
    void updateBook(book.id, {
      position: safeValue,
      percentage: percent,
      completed: completedOverride ?? percent >= 99.5,
    });
  };
  const toggle = async () => {
    if (!audioRef.current) { setNotice('Для этой книги ещё не добавлен аудиофайл.'); return; }
    if (!audioRef.current.paused) {
      audioRef.current.pause();
      return;
    }
    try {
      await audioRef.current.play();
    } catch {
      setPlaying(false);
      setNotice('Не удалось начать воспроизведение. Нажмите кнопку ещё раз.');
    }
  };
  const seek = (value: number) => {
    const next = Math.min(duration || Number.POSITIVE_INFINITY, Math.max(0, value));
    if (audioRef.current) audioRef.current.currentTime = next;
    positionRef.current = next;
    setCurrent(next);
    persistPosition(next);
  };
  const skip = (amount: number) => seek((audioRef.current?.currentTime ?? positionRef.current) + amount);
  const changeSpeed = () => {
    const index = SPEEDS.indexOf(speed);
    const next = SPEEDS[(index < 0 ? 0 : index + 1) % SPEEDS.length];
    setSpeed(next);
    if (book) void updateBook(book.id, { speed: next });
  };
  if (!book) return <section className="rounded-[28px] bg-card p-12 text-center" data-testid="state-player-error"><CircleHelp className="mx-auto size-8 text-primary" /><h1 className="mt-4 font-display text-4xl font-semibold">Книга не найдена</h1><button onClick={() => setLocation('/')} className="mt-6 rounded-full bg-primary px-5 py-3 text-sm font-semibold text-primary-foreground" data-testid="button-back-library">Вернуться в библиотеку</button></section>;
  const percentage = duration > 0 ? (current / duration) * 100 : book.percentage;
  return (
    <div className="mx-auto max-w-5xl animate-rise">
      <button onClick={() => setLocation('/')} className="mb-8 inline-flex items-center gap-2 text-xs font-semibold text-muted-foreground transition-colors hover:text-foreground" data-testid="button-player-back"><ChevronLeft className="size-4" /> Вернуться к библиотеке</button>
      <div className="grid items-center gap-10 md:grid-cols-[minmax(260px,360px)_1fr] md:gap-16">
        <div className="relative mx-auto w-full max-w-[360px]"><Cover book={book} size="lg" /><div className="absolute -bottom-4 -right-4 grid size-14 place-items-center rounded-2xl bg-accent text-foreground shadow-lg"><Volume2 className="size-5" /></div></div>
        <div className="min-w-0"><p className="font-mono-ui text-[10px] uppercase tracking-[.22em] text-primary/70">Сейчас слушаете</p><h1 className="mt-3 font-display text-5xl font-semibold leading-[.9] tracking-[-.04em] sm:text-6xl">{book.title}</h1><p className="mt-4 text-lg text-muted-foreground">{book.author}</p>{book.narrator && <p className="mt-1 text-xs text-muted-foreground/75">Читает {book.narrator}</p>}{book.description && <p className="mt-7 max-w-md text-sm leading-6 text-muted-foreground">{book.description}</p>}
          <div className="mt-10"><input type="range" min="0" max={duration || 1} step="0.1" value={Math.min(current, duration || 1)} onChange={(event) => seek(Number(event.target.value))} className="range-reset w-full cursor-pointer" aria-label="Позиция воспроизведения" disabled={!src} data-testid="input-player-timeline" /><div className="mt-2 flex justify-between font-mono-ui text-[10px] text-muted-foreground"><span>{formatTime(current)}</span><span>{formatTime(duration)}</span></div></div>
          <div className="mt-7 flex items-center justify-between gap-2"><button onClick={changeSpeed} className="flex h-10 items-center gap-2 rounded-full border border-border px-3 text-xs font-semibold transition-colors hover:bg-secondary" data-testid="button-player-speed"><Zap className="size-3.5 text-accent-foreground" /> {speed.toFixed(2)}×</button><div className="flex items-center gap-3"><button onClick={() => skip(-15)} disabled={!src} className="grid size-11 place-items-center rounded-full text-muted-foreground transition-colors hover:bg-secondary disabled:opacity-35" aria-label="Назад 15 секунд" data-testid="button-skip-back"><SkipBack className="size-5" /></button><button onClick={() => void toggle()} className="grid size-16 place-items-center rounded-full bg-primary text-primary-foreground shadow-md transition-transform hover:scale-105" aria-label={playing ? 'Пауза' : 'Воспроизвести'} data-testid="button-player-toggle">{playing ? <Pause className="size-6 fill-current" /> : <Play className="ml-1 size-6 fill-current" />}</button><button onClick={() => skip(30)} disabled={!src} className="grid size-11 place-items-center rounded-full text-muted-foreground transition-colors hover:bg-secondary disabled:opacity-35" aria-label="Вперёд 30 секунд" data-testid="button-skip-forward"><SkipForward className="size-5" /></button></div><span className="w-16 text-right text-[10px] text-muted-foreground">{src ? 'готово' : 'нет файла'}</span></div>
          {notice && <button onClick={() => setNotice('')} className="mt-5 flex w-full items-center justify-between rounded-xl bg-accent/20 px-4 py-3 text-left text-xs text-foreground" data-testid="status-player-notice"><span>{notice}</span><X className="size-4" /></button>}
        </div>
      </div>
       {src && <audio ref={audioRef} src={src} preload="auto" onLoadedMetadata={(event) => { const value = event.currentTarget.duration; if (Number.isFinite(value) && value > 0) { durationRef.current = value; setDuration(value); if (!book.duration) void updateBook(book.id, { duration: value }); } const start = Math.min(Math.max(book.position, 0), Number.isFinite(value) && value > 0 ? value : Math.max(book.position, 0)); event.currentTarget.currentTime = start; positionRef.current = start; setCurrent(start); restoredPositionRef.current = true; }} onCanPlay={(event) => { if (!restoredPositionRef.current) { const start = Math.min(Math.max(book.position, 0), Number.isFinite(event.currentTarget.duration) ? event.currentTarget.duration : Math.max(book.position, 0)); event.currentTarget.currentTime = start; positionRef.current = start; setCurrent(start); restoredPositionRef.current = true; } }} onTimeUpdate={(event) => { const value = event.currentTarget.currentTime; positionRef.current = value; setCurrent(value); if (Date.now() - persistAt.current > 1200) { persistAt.current = Date.now(); persistPosition(value); } }} onPlay={() => { setNotice(''); setPlaying(true); }} onPause={(event) => { setPlaying(false); persistPosition(event.currentTarget.currentTime); }} onEnded={() => { setPlaying(false); persistPosition(durationRef.current || duration, true); }} onError={() => { setPlaying(false); setNotice('Не удалось прочитать аудиофайл. Выберите этот файл заново в редактировании книги.'); }} data-testid="audio-player" />}
      <div className="mt-14 grid gap-4 border-t border-border pt-7 sm:grid-cols-3"><div className="rounded-2xl bg-card/60 p-4"><Clock3 className="size-4 text-primary" /><p className="mt-3 font-mono-ui text-sm">{formatTime(duration)}</p><p className="mt-1 text-[11px] text-muted-foreground">Полная длительность</p></div><div className="rounded-2xl bg-card/60 p-4"><SlidersHorizontal className="size-4 text-primary" /><p className="mt-3 font-mono-ui text-sm">{Math.round(percentage)}%</p><p className="mt-1 text-[11px] text-muted-foreground">Уже прослушано</p></div><div className="rounded-2xl bg-card/60 p-4"><Headphones className="size-4 text-primary" /><p className="mt-3 font-mono-ui text-sm">{book.completed ? 'завершено' : 'в процессе'}</p><p className="mt-1 text-[11px] text-muted-foreground">Состояние книги</p></div></div>
    </div>
  );
}

function SettingsPage() {
  const { books, clearLibrary } = useLibraryContext();
  const [theme, setTheme] = useState(() => localStorage.getItem('listen-theme') ?? 'light');
  const [defaultSpeed, setDefaultSpeed] = useState(() => {
    const storedSpeed = Number(localStorage.getItem('listen-speed') ?? '1');
    return SPEEDS.includes(storedSpeed) ? storedSpeed : 1;
  });
  const [, setLocation] = useLocation();
  useEffect(() => { document.documentElement.classList.toggle('dark', theme === 'dark'); localStorage.setItem('listen-theme', theme); }, [theme]);
  const selectSpeed = (value: number) => { setDefaultSpeed(value); localStorage.setItem('listen-speed', String(value)); };
  const clear = async () => { if (window.confirm('Удалить все книги и файлы из Listen? Это действие нельзя отменить.')) { await clearLibrary(); setLocation('/'); } };
  return (
    <div className="mx-auto max-w-3xl animate-rise"><p className="font-mono-ui text-[10px] uppercase tracking-[.22em] text-primary/70">Настройки</p><h1 className="mt-3 font-display text-6xl font-semibold tracking-[-.04em]">Тихие предпочтения.</h1><p className="mt-4 max-w-md text-sm leading-6 text-muted-foreground">Настройте Listen так, чтобы возвращаться к книгам было естественно.</p>
      <div className="mt-10 space-y-4">
        <SettingGroup title="Внешний вид" icon={<Leaf className="size-4" />}><div className="flex items-center justify-between gap-4"><div><h2 className="text-sm font-semibold">Тема интерфейса</h2><p className="mt-1 text-xs text-muted-foreground">Светлая палитра сохраняет ощущение дня.</p></div><div className="flex rounded-full bg-secondary p-1"><button onClick={() => setTheme('light')} className={`rounded-full px-3 py-2 text-xs font-semibold ${theme === 'light' ? 'bg-card shadow-sm' : 'text-muted-foreground'}`} data-testid="button-theme-light">Светлая</button><button onClick={() => setTheme('dark')} className={`rounded-full px-3 py-2 text-xs font-semibold ${theme === 'dark' ? 'bg-card shadow-sm' : 'text-muted-foreground'}`} data-testid="button-theme-dark"><Moon className="mr-1 inline size-3.5" /> Тёмный лес</button></div></div></SettingGroup>
        <SettingGroup title="Воспроизведение" icon={<Headphones className="size-4" />}><div className="flex items-center justify-between gap-4"><div><h2 className="text-sm font-semibold">Скорость по умолчанию</h2><p className="mt-1 text-xs text-muted-foreground">Можно изменить в плеере в любой момент.</p></div><select value={defaultSpeed} onChange={(event) => selectSpeed(Number(event.target.value))} className="h-10 rounded-full border border-input bg-background px-3 text-xs font-semibold outline-none" data-testid="select-default-speed">{SPEEDS.map((value) => <option key={value} value={value}>{value.toFixed(2)}×</option>)}</select></div></SettingGroup>
        <SettingGroup title="Управление библиотекой" icon={<Library className="size-4" />}><div className="flex items-center justify-between gap-4"><div><h2 className="text-sm font-semibold">Книг в библиотеке</h2><p className="mt-1 text-xs text-muted-foreground">Аудио и обложки хранятся только в этом браузере.</p></div><span className="font-mono-ui text-sm text-primary">{books.length}</span></div><div className="mt-5 border-t border-border pt-5"><button onClick={() => void clear()} className="inline-flex items-center gap-2 text-xs font-semibold text-destructive transition-colors hover:text-destructive/70" data-testid="button-clear-library"><Trash2 className="size-4" /> Очистить всю библиотеку</button></div></SettingGroup>
        <SettingGroup title="О Listen" icon={<Sparkles className="size-10" />}><p className="text-sm leading-6 text-muted-foreground">Listen — личная полка для аудиокниг без шума и случайных рекомендаций. Ваши файлы не покидают устройство.</p><div className="mt-5 flex items-center gap-2 text-[10px] text-muted-foreground"><span className="size-1.5 rounded-full bg-primary" /> Версия 1.0 <span className="mx-1 opacity-40">•</span> Сделано для долгих историй</div></SettingGroup>
      </div>
    </div>
  );
}

function SettingGroup({ title, icon, children }: { title: string; icon: ReactNode; children: ReactNode }) {
  return <section className="rounded-[24px] border border-card-border bg-card p-5 sm:p-6" data-testid={`setting-${title}`}><div className="mb-5 flex items-center gap-2 text-primary"><span className="grid size-8 place-items-center rounded-lg bg-secondary">{icon}</span><span className="font-mono-ui text-[10px] font-bold uppercase tracking-[.15em]">{title}</span></div>{children}</section>;
}

function AppShell({ children, onAdd }: { children: ReactNode; onAdd: () => void }) {
  const [location] = useLocation();
  const [mobileOpen, setMobileOpen] = useState(false);
  const navigation = [{ href: '/', label: 'Библиотека', icon: Library }, { href: '/settings', label: 'Настройки', icon: Settings }];
  return (
    <div className="listen-grain min-h-[100dvh] bg-background">
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-[248px] flex-col border-r border-sidebar-border bg-sidebar px-5 py-7 md:flex"><Logo /><p className="mt-14 px-4 font-mono-ui text-[12px] uppercase tracking-[.2em] text-muted-foreground">Навигация</p><nav className="mt-3 space-y-1">{navigation.map(({ href, label, icon: Icon }) => <Link key={href} href={href} className={`flex items-center gap-3 rounded-xl px-3 py-3 text-sm font-semibold transition-colors ${location === href ? 'bg-sidebar-accent text-sidebar-accent-foreground' : 'text-muted-foreground hover:bg-sidebar-accent/60 hover:text-foreground'}`} data-testid={`link-nav-${label}`}><Icon className="size-[20px]" /> {label}</Link>)}</nav><div className="mt-auto rounded-2xl bg-secondary/55 p-4"><p className="font-display text-2xl leading-none">Слушайте<br /><em className="font-normal text-primary">в своём темпе.</em></p><div className="mt-4 flex items-center gap-2 text-[12px] text-muted-foreground"><span className="grid size-10 place-items-center rounded-full bg-primary text-primary-foreground"><Leaf className="size-8" /></span> Без лишнего шума</div></div></aside>
      <header className="sticky top-0 z-20 flex h-[74px] items-center justify-between border-b border-border/70 bg-background/90 px-5 backdrop-blur-md md:hidden"><button onClick={() => setMobileOpen(!mobileOpen)} className="grid size-14 place-items-center rounded-full hover:bg-secondary" aria-label="Открыть меню" data-testid="button-mobile-menu"><Menu className="size-10" /></button><Logo /><button onClick={onAdd} className="grid size-10 place-items-center rounded-full bg-primary text-primary-foreground" aria-label="Добавить книгу" data-testid="button-mobile-add"><Plus className="size-5" /></button></header>
      {mobileOpen && <div className="fixed inset-x-0 top-[74px] z-20 border-b border-border bg-sidebar p-4 shadow-md md:hidden animate-fade"><nav className="space-y-1">{navigation.map(({ href, label, icon: Icon }) => <Link key={href} href={href} onClick={() => setMobileOpen(false)} className={`flex items-center gap-3 rounded-xl px-3 py-3 text-sm font-semibold ${location === href ? 'bg-sidebar-accent' : ''}`} data-testid={`link-mobile-nav-${label}`}><Icon className="size-4" /> {label}</Link>)}</nav></div>}
      <main className="px-5 pb-16 pt-10 md:ml-[248px] md:px-10 md:py-14 lg:px-16"><div className="mx-auto max-w-[1240px]">{children}</div></main>
    </div>
  );
}

function ListenApp() {
  const library = useLibrary();
  const [addOpen, setAddOpen] = useState(false);
  return <LibraryContext.Provider value={library}><AppShell onAdd={() => setAddOpen(true)}><Switch><Route path="/settings" component={SettingsPage} /><Route path="/player/:id" component={PlayerPage} /><Route path="/" component={() => <HomePage onAdd={() => setAddOpen(true)} />} /><Route component={() => <NotFoundPage />} /></Switch></AppShell>{addOpen && <BookFormModal onClose={() => setAddOpen(false)} />}</LibraryContext.Provider>;
}

function NotFoundPage() {
  const [, setLocation] = useLocation();
  return <section className="mx-auto max-w-lg rounded-[28px] bg-card p-12 text-center"><h1 className="font-display text-6xl">Тишина</h1><p className="mt-3 text-sm text-muted-foreground">Такой страницы нет, но книги на месте.</p><button onClick={() => setLocation('/')} className="mt-6 rounded-full bg-primary px-5 py-3 text-sm font-semibold text-primary-foreground" data-testid="button-not-found-home">В библиотеку</button></section>;
}

function Router() {
  return <ErrorBoundary resetKey={window.location.pathname}><ListenApp /></ErrorBoundary>;
}

function App() {
  return <QueryClientProvider client={queryClient}><TooltipProvider><WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, '')}><Router /></WouterRouter><Toaster /></TooltipProvider></QueryClientProvider>;
}

export default App;
