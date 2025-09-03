import { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { contentLoader } from '@/content/loader';
import { Debut } from '@/content/types';
import { StudyView } from './StudyView';
import './DebutPage.css';

export function DebutPage() {
  const { id } = useParams<{ id: string }>();
  const [debut, setDebut] = useState<Debut | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (id) {
      loadDebut(id);
    }
  }, [id]);

  const loadDebut = async (debutId: string) => {
    try {
      setLoading(true);
      setError(null);
      const data = await contentLoader.loadDebut(debutId);
      setDebut(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Ошибка загрузки дебюта');
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="debut-page">
        <div className="debut-header">
          <Link to="/" className="back-link">← Назад в каталог</Link>
          <h2>Загрузка дебюта...</h2>
        </div>
        <div className="loading-spinner"></div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="debut-page">
        <div className="debut-header">
          <Link to="/" className="back-link">← Назад в каталог</Link>
          <h2>Ошибка загрузки</h2>
        </div>
        <p className="error-message">{error}</p>
        <button onClick={() => id && loadDebut(id)} className="retry-button">
          Попробовать снова
        </button>
      </div>
    );
  }

  if (!debut) {
    return (
      <div className="debut-page">
        <div className="debut-header">
          <Link to="/" className="back-link">← Назад в каталог</Link>
          <h2>Дебют не найден</h2>
        </div>
      </div>
    );
  }

  return (
    <div className="debut-page">
      <div className="debut-header">
        <Link to="/" className="back-link">← Назад в каталог</Link>
        <div className="debut-info">
          <h2>{debut.name}</h2>
          <div className="debut-meta">
            <span className={`side-badge side-${debut.side}`}>
              {debut.side === 'white' ? 'Белые' : 'Чёрные'}
            </span>
            <span className="branches-count">
              {debut.branches.length} веток
            </span>
          </div>
        </div>
      </div>

      <StudyView debut={debut} />
    </div>
  );
}
