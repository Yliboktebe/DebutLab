import '@testing-library/jest-dom';
import { vi } from 'vitest';

// Mock chessground
vi.mock('chessground', () => ({
  Chessground: vi.fn(() => ({
    set: vi.fn(),
    move: vi.fn(),
    undo: vi.fn(),
    destroy: vi.fn(),
  })),
}));

// Mock chess.js
vi.mock('chess.js', () => ({
  Chess: vi.fn(() => ({
    move: vi.fn(() => ({ san: 'e4' })),
    fen: vi.fn(() => 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1'),
    moves: vi.fn(() => ['e4', 'd4']),
  })),
}));
