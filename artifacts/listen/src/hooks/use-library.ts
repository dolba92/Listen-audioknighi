import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useLibrary } from '@/hooks/use-library';
import * as ID3 from 'id3js';

export default function AddBook() {
  const { addBook } = useLibrary();
  const [title, setTitle] = useState('');
  const [author, setAuthor] = useState('');
  const [audioFile, setAudioFile] = useState<File | null>(null);
  const [coverUrl, setCoverUrl] = useState<string | null>(null);
  const [coverFile, setCoverFile] = useState<File | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [status, setStatus] = useState('');

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setAudioFile(file);
    setStatus('⏳ Читаю метаданные...');

    try {
      const tags = await ID3.fromFile(file);

      if (tags.title) {
        setTitle(tags.title);
      }

      if (tags.artist) {
        setAuthor(tags.artist);
      }

      if (tags.picture) {
        const picture = tags.picture;
        const blob = new Blob([picture.data], { type: picture.format });
        const url = URL.createObjectURL(blob);
        setCoverUrl(url);
        setCoverFile(new File([blob], 'cover.jpg', { type: picture.format }));
        setStatus('✅ Метаданные загружены!');
      } else {
        setStatus('⚠️ Обложка не найдена в файле');
      }
    } catch (error) {
      console.error('Ошибка чтения тегов:', error);
      setStatus('❌ Не удалось прочитать метаданные. Заполните поля вручную.');
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!audioFile) {
      alert('Выберите аудиофайл');
      return;
    }

    setIsLoading(true);
    try {
      const bookDraft = {
        title: title || 'Без названия',
        author: author || 'Неизвестный автор',
        narrator: '',
        description: '',
        coverTone: 'slate',
        audioBlob: audioFile,
        audioName: audioFile.name,
        audioType: audioFile.type,
        coverBlob: coverFile || undefined,
      };

      await addBook(bookDraft);
      alert(`Книга "${title || 'Без названия'}" успешно добавлена!`);
      setTitle('');
      setAuthor('');
      setAudioFile(null);
      setCoverFile(null);
      setCoverUrl(null);
      setStatus('');
      const fileInput = document.querySelector('input[type="file"]') as HTMLInputElement;
      if (fileInput) fileInput.value = '';
    } catch (error) {
      console.error('Ошибка:', error);
      alert('Произошла ошибка при добавлении книги');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 p-4">
      <Card className="w-full max-w-lg">
        <CardHeader>
          <CardTitle className="text-2xl">Добавить аудиокнигу</CardTitle>
          <p className="text-sm text-gray-500">
            Выберите MP3-файл — название, автор и обложка загрузятся автоматически из тегов файла.
          </p>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="audio">MP3-файл</Label>
              <Input
                id="audio"
                type="file"
                accept="audio/mpeg,audio/mp3"
                onChange={handleFileSelect}
                required
                className="cursor-pointer"
              />
              {status && (
                <p className={`text-sm ${status.includes('✅') ? 'text-green-600' : status.includes('⚠️') ? 'text-yellow-600' : 'text-red-600'}`}>
                  {status}
                </p>
              )}
              {audioFile && (
                <p className="text-sm text-gray-500">
                  📁 {audioFile.name} ({(audioFile.size / 1024 / 1024).toFixed(2)} MB)
                </p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="title">Название книги</Label>
              <Input
                id="title"
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Автоматически из тегов"
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="author">Автор</Label>
              <Input
                id="author"
                type="text"
                value={author}
                onChange={(e) => setAuthor(e.target.value)}
                placeholder="Автоматически из тегов"
              />
            </div>

            {coverUrl && (
              <div className="space-y-2">
                <Label>Обложка</Label>
                <img
                  src={coverUrl}
                  alt="Обложка книги"
                  className="w-32 h-32 object-cover rounded-lg border"
                />
              </div>
            )}

            <Button type="submit" className="w-full" disabled={isLoading || !audioFile}>
              {isLoading ? 'Загрузка...' : 'Добавить книгу'}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
