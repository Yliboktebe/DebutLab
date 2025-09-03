import { useState, useEffect } from 'react';
import { contentLoader } from '@/content/loader';
import { Catalog } from '@/content/types';
import { DebutCatalog } from '@/components/DebutCatalog';
import './HomePage.css';

export function HomePage() {
  const [catalog, setCatalog] = useState<Catalog | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadCatalog();
  }, []);

  const loadCatalog = async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await contentLoader.loadCatalog();
      setCatalog(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Ошибка загрузки каталога');
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="home-page">
        <h2>Загрузка каталога дебютов...</h2>
        <div className="loading-spinner"></div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="home-page">
        <h2>Ошибка загрузки</h2>
        <p className="error-message">{error}</p>
        <button onClick={loadCatalog} className="retry-button">
          Попробовать снова
        </button>
      </div>
    );
  }

  if (!catalog) {
    return (
      <div className="home-page">
        <h2>Каталог не найден</h2>
      </div>
    );
  }

  return (
    <div className="home-page">
      <div className="hero-section">
        <h2>Изучайте шахматные дебюты</h2>
        <p>
          Выберите дебют для изучения. Каждый дебют содержит несколько веток 
          для пошагового изучения с подсказками и проверкой знаний.
        </p>
      </div>

      <DebutCatalog debuts={catalog.debuts} />
    </div>
  );
}
