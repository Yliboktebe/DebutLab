import { StudyMode } from '@/content/types';
import { uciToSan } from '@/study/utils';
import './StudyPanel.css';

interface StudyPanelProps {
  mode: StudyMode;
  currentStep: number;
  totalSteps: number;
  errors: number;
  expectedUci: string | null;
}

export function StudyPanel({ 
  mode, 
  currentStep, 
  totalSteps, 
  errors, 
  expectedUci 
}: StudyPanelProps) {
  const getModeDescription = () => {
    switch (mode) {
      case 'GUIDED':
        return 'Следуйте зелёной стрелке. Все ходы показаны для изучения.';
      case 'TEST':
        return 'Вспомните изученные ходы. Стрелки не показываются.';
      default:
        return '';
    }
  };

  const getExpectedMoveLabel = () => {
    if (!expectedUci) return '';
    
    try {
      const san = uciToSan(expectedUci);
      return `Ожидается: ${san}`;
    } catch {
      return `Ожидается: ${expectedUci}`;
    }
  };

  return (
    <div className="study-panel">
      <div className="panel-section">
        <h4>Статус изучения</h4>
        <div className="status-info">
          <div className="status-item">
            <span className="label">Режим:</span>
            <span className={`value mode-${mode.toLowerCase()}`}>
              {mode === 'GUIDED' ? 'Обучение' : 'Проверка'}
            </span>
          </div>
          
          <div className="status-item">
            <span className="label">Шаг:</span>
            <span className="value">{currentStep} / {totalSteps}</span>
          </div>
          
          <div className="status-item">
            <span className="label">Ошибки:</span>
            <span className={`value errors-${errors > 2 ? 'high' : errors > 0 ? 'medium' : 'low'}`}>
              {errors}
            </span>
          </div>
        </div>
      </div>

      <div className="panel-section">
        <h4>Инструкции</h4>
        <p className="mode-description">{getModeDescription()}</p>
        
        {expectedUci && (
          <div className="expected-move">
            <span className="label">Следующий ход:</span>
            <span className="move">{getExpectedMoveLabel()}</span>
          </div>
        )}
      </div>

      <div className="panel-section">
        <h4>Прогресс</h4>
        <div className="progress-bar">
          <div 
            className="progress-fill" 
            style={{ width: `${(currentStep / totalSteps) * 100}%` }}
          ></div>
        </div>
        <div className="progress-text">
          {Math.round((currentStep / totalSteps) * 100)}% завершено
        </div>
      </div>
    </div>
  );
}
