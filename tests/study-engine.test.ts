import { describe, it, expect, beforeEach, vi } from 'vitest';
import { StudyEngine } from '../src/study/study-engine';
import { Debut, Branch } from '../src/content/types';

// Mock progress manager
vi.mock('../src/study/progress-manager', () => ({
  progressManager: {
    getLearnedMoves: vi.fn(() => []),
    getDueBranches: vi.fn(() => []),
    getBranchStatus: vi.fn(() => 'New'),
    updateBranch: vi.fn(),
    addLearnedMoves: vi.fn(),
  },
}));

describe('StudyEngine', () => {
  let studyEngine: StudyEngine;
  let mockDebut: Debut;
  let mockBranch: Branch;

  beforeEach(() => {
    studyEngine = new StudyEngine();
    
    mockBranch = {
      id: 'test-branch-1',
      type: 'main_line',
      name: 'Test Branch',
      startFen: 'startpos',
      ucis: ['e2e4', 'e7e5', 'g1f3', 'b8c6'],
      minPly: 4
    };

    mockDebut = {
      schema: 'debutlab.debut.v1',
      id: 'test-debut',
      name: 'Test Debut',
      side: 'white',
      tags: ['test'],
      branches: [mockBranch]
    };
  });

  it('should start with IDLE mode', () => {
    const state = studyEngine.getState();
    expect(state.mode).toBe('IDLE');
  });

  it('should start studying a debut and immediately pick next branch', () => {
    studyEngine.start(mockDebut);
    const state = studyEngine.getState();
    expect(state.currentDebut).toBe(mockDebut);
    expect(state.currentBranch).toBe(mockBranch);
    expect(state.mode).toBe('GUIDED');
  });

  it('should identify student moves correctly for white side', () => {
    studyEngine.start(mockDebut);
    const expectedUci = studyEngine.currentExpectedUci();
    expect(expectedUci).toBe('e2e4');
  });

  it('should accept correct moves', () => {
    studyEngine.start(mockDebut);
    const result = studyEngine.applyUserMove('e2e4');
    expect(result).toBe(true);
  });

  it('should reject incorrect moves', () => {
    studyEngine.start(mockDebut);
    const result = studyEngine.applyUserMove('d2d4');
    expect(result).toBe(false);
  });
});
