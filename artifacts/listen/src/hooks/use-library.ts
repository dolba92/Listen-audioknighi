import { useCallback, useEffect, useRef, useState } from 'react';

export type Book = {
  id: string;
  title: string;
  author: string;
  narrator: string;
  description: string;
  duration: number;
  position: number;
  percentage: number;
  completed: boolean;
  speed: number;
  audioBlob?: Blob;
  audioName?: string;
  audioType?: string;
  coverBlob?: Blob;
  coverTone: string;
  createdAt: number;
  updatedAt: number;
};

export type BookDraft = Pick<
  Book,
  'title' | 'author' | 'narrator' | 'description' | 'coverTone'
> & {
  audioBlob: Blob;
  audioName: string;
  audioType: string;
  coverBlob?: Blob;
  duration?: number;
};

const DB_NAME = 'listen-library';
const STORE = 'books';
const DB_VERSION = 1;
const PLAYBACK_SPEEDS = [1, 1.25, 1.5, 1.75, 2, 2.25, 2.5, 2.75, 3];
const PROGRESS_PREFIX = 'listen-progress-';

type SavedProgress = {
  position: number;
  percentage: number;
  completed: boolean;
  speed: number;
};

function progressKey(id: string) {
  return `${PROGRESS_PREFIX}${id}`;
}

function saveProgress(book: Book) {
  try {
    const progress: SavedProgress = {
      position: book.position,
      percentage: book.percentage,
      completed: book.completed,
      speed: book.speed,
    };

    localStorage.setItem(progressKey(book.id), JSON.stringify(progress));
  } catch (error) {
    console.warn('Не удалось сохранить прогресс локально:', error);
  }
}

function readProgress(book: Book): Book {
  try {
    const raw = localStorage.getItem(progressKey(book.id));
    if (!raw) return book;

    const saved = JSON.parse(raw) as Partial<SavedProgress>;

    return {
      ...book,
      position:
        typeof saved.position === 'number'
          ? saved.position
          : book.position,
      percentage:
        typeof saved.percentage === 'number'
          ? saved.percentage
          : book.percentage,
      completed:
        typeof saved.completed === 'boolean'
          ? saved.completed
          : book.completed,
      speed:
        typeof saved.speed === 'number' &&
        PLAYBACK_SPEEDS.includes(saved.speed)
          ? saved.speed
          : book.speed,
    };
  } catch {
    return book;
  }
}

function removeProgress(id: string) {
  try {
    localStorage.removeItem(progressKey(id));
  } catch {
    // Ничего страшного — основная библиотека всё равно хранится в IndexedDB.
  }
}

function openDatabase(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = () => {
      const database = request.result;

      if (!database.objectStoreNames.contains(STORE)) {
        database.createObjectStore(STORE, { keyPath: 'id' });
      }
    };

    request.onsuccess = () => resolve(request.result);

    request.onerror = () =>
      reject(
        request.error ??
          new Error('Не удалось открыть библиотеку'),
      );
  });
}

async function readBooks(): Promise<Book[]> {
  const database = await openDatabase();

  return new Promise((resolve, reject) => {
    const request = database
      .transaction(STORE, 'readonly')
      .objectStore(STORE)
      .getAll();

    request.onsuccess = () => {
      const books = (request.result as Book[])
        .map(readProgress)
        .sort((a, b) => b.updatedAt - a.updatedAt);

      resolve(books);
    };

    request.onerror = () =>
      reject(
        request.error ??
          new Error('Не удалось прочитать библиотеку'),
      );
  });
}

async function writeBook(book: Book): Promise<void> {
  const database = await openDatabase();

  return new Promise((resolve, reject) => {
    const request = database
      .transaction(STORE, 'readwrite')
      .objectStore(STORE)
      .put(book);

    request.onsuccess = () => resolve();

    request.onerror = () =>
      reject(
        request.error ??
          new Error('Не удалось сохранить книгу'),
      );
  });
}

async function removeBook(id: string): Promise<void> {
  const database = await openDatabase();

  return new Promise((resolve, reject) => {
    const request = database
      .transaction(STORE, 'readwrite')
      .objectStore(STORE)
      .delete(id);

    request.onsuccess = () => resolve();

    request.onerror = () =>
      reject(
        request.error ??
          new Error('Не удалось удалить книгу'),
      );
  });
}

export function useLibrary() {
  const [books, setBooks] = useState<Book[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');
  const booksRef = useRef<Book[]>([]);

  const reload = useCallback(async () => {
    setIsLoading(true);
    setError('');

    try {
      const existing = await readBooks();

      const personalBooks = existing.filter(
        (book) => !book.id.startsWith('starter-'),
      );

      const legacyStarterBooks = existing.filter(
        (book) => book.id.startsWith('starter-'),
      );

      if (legacyStarterBooks.length > 0) {
        await Promise.all(
          legacyStarterBooks.map((book) =>
            removeBook(book.id),
          ),
        );
      }

      booksRef.current = personalBooks;
      setBooks(personalBooks);
    } catch (cause) {
      setError(
        cause instanceof Error
          ? cause.message
          : 'Неизвестная ошибка библиотеки',
      );
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    void reload();
  }, [reload]);

  const addBook = useCallback(
    async (draft: BookDraft) => {
      const now = Date.now();

      const storedSpeed = Number(
        localStorage.getItem('listen-speed') ?? '1',
      );

      const book: Book = {
        ...draft,
        id: `book-${now}-${Math.random()
          .toString(36)
          .slice(2, 8)}`,
        audioBlob: draft.audioBlob,
        duration: draft.duration ?? 0,
        position: 0,
        percentage: 0,
        completed: false,
        speed: PLAYBACK_SPEEDS.includes(storedSpeed)
          ? storedSpeed
          : 1,
        createdAt: now,
        updatedAt: now,
      };

      saveProgress(book);
      await writeBook(book);

      booksRef.current = [book, ...booksRef.current];
      setBooks(booksRef.current);

      return book;
    },
    [],
  );

  const updateBook = useCallback(
    async (id: string, patch: Partial<Book>) => {
      const found = booksRef.current.find(
        (book) => book.id === id,
      );

      if (!found) return;

      const updated: Book = {
        ...found,
        ...patch,
        updatedAt: Date.now(),
      };

      /*
       * Сначала обновляем память и localStorage.
       * Поэтому новый вызов updateBook уже увидит самые свежие данные,
       * даже если IndexedDB ещё заканчивает предыдущую запись.
       */
      booksRef.current = booksRef.current.map(
        (book) => (book.id === id ? updated : book),
      );

      setBooks(booksRef.current);
      saveProgress(updated);

      try {
        await writeBook(updated);
      } catch (error) {
        console.error(
          'Не удалось записать изменения книги в IndexedDB:',
          error,
        );
      }
    },
    [],
  );

  const deleteBook = useCallback(async (id: string) => {
    await removeBook(id);
    removeProgress(id);

    booksRef.current = booksRef.current.filter(
      (book) => book.id !== id,
    );

    setBooks(booksRef.current);
  }, []);

  const clearLibrary = useCallback(async () => {
    const currentBooks = [...booksRef.current];

    await Promise.all(
      currentBooks.map((book) => removeBook(book.id)),
    );

    currentBooks.forEach((book) =>
      removeProgress(book.id),
    );

    booksRef.current = [];
    setBooks([]);
  }, []);

  return {
    books,
    isLoading,
    error,
    reload,
    addBook,
    updateBook,
    deleteBook,
    clearLibrary,
  };
}
