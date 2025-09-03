import { Debut, Side } from '@/content/types';
import { ChessBoard } from '@/components/ChessBoard';
import { StudyPanel } from '@/components/StudyPanel';
import { useStudyEngine } from '@/study/useStudyEngine';
import './StudyView.css';

interface StudyViewProps {
  debut: Debut;
}

export function StudyView({ debut }: StudyViewProps) {
  const {
    currentBranch,
    currentStepIndex,
    mode,
    errors,
    expectedUci,
    progress,
    onMove,
    onNextBranch,
    onRestart
  } = useStudyEngine(debut);

  if (!currentBranch) {
    return (
      <div className="study-view">
        <div className="study-complete">
          <h3>Изучение завершено!</h3>
          <p>Прогресс: {progress}%</p>
          <button onClick={onRestart} className="restart-button">
            Начать заново
          </button>
        </div>
      </div>
    );
  }

  const getModeLabel = () => {
    switch (mode) {
      case 'GUIDED':
        return 'Режим обучения';
      case 'TEST':
        return 'Проверка знаний';
      default:
        return 'Загрузка...';
    }
  };

  const getSideLabel = (side: Side) => {
    return side === 'white' ? 'Белые' : 'Чёрные';
  };

  return (
    <div className="study-view">
      <div className="study-header">
        <div className="study-info">
          <h3>{currentBranch.name}</h3>
          <div className="study-meta">
            <span className={`side-badge side-${debut.side}`}>
              {getSideLabel(debut.side)}
            </span>
            <span className="mode-badge">{getModeLabel()}</span>
            <span className="progress-badge">{progress}%</span>
          </div>
        </div>
        
        <div className="study-controls">
          <button onClick={onNextBranch} className="next-branch-button">
            Следующая ветка
          </button>
        </div>
      </div>

      <div className="study-content">
        <div className="chess-board-container">
          {/* Debug info */}
          <div style={{ 
            background: '#f0f0f0', 
            padding: '10px', 
            marginBottom: '10px', 
            fontSize: '12px',
            fontFamily: 'monospace'
          }}>
            <div>Debug: orientation = {debut.side}</div>
            <div>Debug: startFen = {currentBranch.startFen}</div>
            <div>Debug: expectedUci = {expectedUci || 'null'}</div>
            <div>Debug: mode = {mode}</div>
          </div>
          
          <ChessBoard
            orientation={debut.side}
            startFen={currentBranch.startFen}
            expectedUci={expectedUci}
            onTryMove={onMove}
            branches={debut.branches}
          />
        </div>
        
        <StudyPanel
          mode={mode}
          currentStep={currentStepIndex + 1}
          totalSteps={Math.ceil(currentBranch.ucis.length / 2)}
          errors={errors}
          expectedUci={expectedUci}
        />
      </div>
    </div>
  );
}
