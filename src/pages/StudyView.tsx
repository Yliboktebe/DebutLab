import { useCallback, useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { useStudyEngine } from '@/study/useStudyEngine';
import { studyEngine } from '@/study/study-engine';
import { ContentLoader } from '@/content/loader';
import type { Debut } from '@/content/types';
import ChessBoard from '@/components/ChessBoard';
import type { ChessBoardApi } from '@/board/chessground';

import './StudyView.css';

export default function StudyView() {
  const { id } = useParams<{ id: string }>();
  const [debut, setDebut] = useState<Debut | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (id) {
      ContentLoader.getInstance()
        .loadDebut(id)
        .then(setDebut)
        .catch(console.error)
        .finally(() => setLoading(false));
    }
  }, [id]);

  if (loading) {
    return <div>Загрузка...</div>;
  }

  if (!debut) {
    return <div>Дебют не найден</div>;
  }

  return <StudyContent debut={debut} />;
}

function StudyContent({ debut }: { debut: Debut }) {
  const { 
    studentIndex,           // НОВЫЙ: используем studentIndex
    currentFen, 
    learningMode, 
    currentComment, 
    // allowedMoves,      // ← больше не используем пропсы для управления
    // expectedUci,       // ← стрелка управляется через boardApi
    onMove,                 // НОВЫЙ: добавляем onMove
    setBoardApi,            // НОВЫЙ: для установки ссылки на API доски
    updateArrowAndDests     // НОВЫЙ: для принудительного обновления
  } = useStudyEngine(debut);

  const handleMove = useCallback((uci: string): boolean => {
    console.log('StudyView: handleMove called with uci:', uci);
    // Вызываем onMove из useStudyEngine
    return onMove(uci);
  }, [onMove]);

  // НОВЫЙ: устанавливаем ссылку на API доски при монтировании
  const handleBoardMounted = useCallback((api: ChessBoardApi) => {
    console.log('StudyView: Board API mounted');
    setBoardApi(api);
    
    // НОВЫЙ: после монтирования вызываем preroll и обновляем UI
    setTimeout(() => {
      const autos = studyEngine.prerollToStudentTurn();
      autos.forEach((uci: string) => api.playUci(uci));
      updateArrowAndDests();
    }, 100);
  }, [setBoardApi, updateArrowAndDests]);



  return (
    <div className="study-view">
      <div className="study-header">
        <h1>{debut.name}</h1>
        <span className={`learning-mode-badge ${learningMode}`}>
          {learningMode === 'withHints' ? 'С подсказками' : 'Без подсказок'}
        </span>
      </div>
      
      <div className="study-content">
        <div className="chessboard-container">
          <ChessBoard
            key={debut.id}          // ← форсируем новый React-инстанс на другую страницу
            startFen={currentFen}
            orientation={debut.side}  // НОВЫЙ: используем сторону дебюта
            onTryMove={handleMove}
            onBoardMounted={handleBoardMounted}  // НОВЫЙ: callback при монтировании
          />
        </div>
        
        <div className="study-info">
          <div className="step-info">
            <h3>Шаг {Math.floor(studentIndex / 2) + 1}</h3>  {/* НОВЫЙ: используем studentIndex */}
            <p>Ход: {studentIndex % 2 === 0 ? 'Белые' : 'Черные'}</p>
          </div>
          
          {currentComment && (
            <div className="step-comment">
              <div className="comment-header">
                <span className="comment-icon">💡</span>
                <span className="comment-title">Подсказка</span>
              </div>
              <div className="comment-text">{currentComment}</div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
