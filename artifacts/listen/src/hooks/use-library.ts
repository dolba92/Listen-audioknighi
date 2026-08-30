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

export type BookDraft = Pick<Book, 'title' | 'author' | 'narrator' | 'description' | 'coverTone'> & {
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
    request.onerror = () => reject(request.error ?? new Error('Не удалось открыть библиотеку'));
  });
}

async function readBooks(): Promise<Book[]> {
  const database = await openDatabase();
  return new Promise((resolve, reject) => {
    const request = database.transaction(STORE, 'readonly').objectStore(STORE).getAll();
    request.onsuccess = () => resolve((request.result as Book[]).sort((a, b) => b.updatedAt - a.updatedAt));
    request.onerror = () => reject(request.error ?? new Error('Не удалось прочитать библиотеку'));
  });
}

async function writeBook(book: Book): Promise<void> {
  const database = await openDatabase();
  return new Promise((resolve, reject) => {
    const request = database.transaction(STORE, 'readwrite').objectStore(STORE).put(book);
    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error ?? new Error('Не удалось сохранить книгу'));
  });
}

async function removeBook(id: string): Promise<void> {
  const database = await openDatabase();
  return new Promise((resolve, reject) => {
    const request = database.transaction(STORE, 'readwrite').objectStore(STORE).delete(id);
    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error ?? new Error('Не удалось удалить книгу'));
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
      const personalBooks = existing.filter((book) => !book.id.startsWith('starter-'));
      const legacyStarterBooks = existing.filter((book) => book.id.startsWith('starter-'));
      if (legacyStarterBooks.length > 0) {
        await Promise.all(legacyStarterBooks.map((book) => removeBook(book.id)));
      }
      booksRef.current = personalBooks;
      setBooks(personalBooks);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Неизвестная ошибка библиотеки');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    void reload();
  }, [reload]);

  const addBook = useCallback(async (draft: BookDraft) => {
    const now = Date.now();
    const storedSpeed = Number(localStorage.getItem('listen-speed') ?? '1');
    const book: Book = {
      ...draft,
      id: `book-${now}-${Math.random().toString(36).slice(2, 8)}`,
      audioBlob: draft.audioBlob,
      duration: draft.duration ?? 0,
      position: 0,
      percentage: 0,
      completed: false,
      speed: PLAYBACK_SPEEDS.includes(storedSpeed) ? storedSpeed : 1,
      createdAt: now,
      updatedAt: now,
    };
    await writeBook(book);
    booksRef.current = [book, ...booksRef.current];
    setBooks((current) => [book, ...current]);
    return book;
  }, []);

  const updateBook = useCallback(async (id: string, patch: Partial<Book>) => {
    const found = booksRef.current.find((book) => book.id === id);
    if (!found) return;
    const updated = { ...found, ...patch, updatedAt: Date.now() };
    await writeBook(updated);
    booksRef.current = booksRef.current.map((book) => (book.id === id ? updated : book));
    setBooks(booksRef.current);
  }, []);

  const deleteBook = useCallback(async (id: string) => {
    await removeBook(id);
    booksRef.current = booksRef.current.filter((book) => book.id !== id);
    setBooks(booksRef.current);
  }, []);

  const clearLibrary = useCallback(async () => {
    await Promise.all(booksRef.current.map((book) => removeBook(book.id)));
    booksRef.current = [];
    setBooks([]);
  }, []);

  return { books, isLoading, error, reload, addBook, updateBook, deleteBook, clearLibrary };
}