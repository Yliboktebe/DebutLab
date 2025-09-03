import { Link } from 'react-router-dom';
import { DebutCatalogItem } from '@/content/types';
import './DebutCatalog.css';

interface DebutCatalogProps {
  debuts: DebutCatalogItem[];
}

export function DebutCatalog({ debuts }: DebutCatalogProps) {
  const getSideLabel = (side: string) => {
    return side === 'white' ? 'Белые' : 'Чёрные';
  };

  const getSideClass = (side: string) => {
    return `side-badge side-${side}`;
  };

  return (
    <div className="debut-catalog">
      <h3>Доступные дебюты</h3>
      <div className="debut-grid">
        {debuts.map((debut) => (
          <Link 
            key={debut.id} 
            to={`/debut/${debut.id}`}
            className="debut-card"
          >
            <div className="debut-header">
              <h4 className="debut-name">{debut.name}</h4>
              <span className={getSideClass(debut.side)}>
                {getSideLabel(debut.side)}
              </span>
            </div>
            
            <div className="debut-tags">
              {debut.tags.map((tag) => (
                <span key={tag} className="tag">
                  {tag}
                </span>
              ))}
            </div>
            
            <div className="debut-stats">
              <span className="stat">
                <strong>{debut.branches}</strong> веток
              </span>
              <span className="stat">
                ~{debut.approxSizeKB} КБ
              </span>
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}
