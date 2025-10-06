import { describe, it, expect } from 'vitest';
import { toUci } from '@/core/chess/uci';

describe('UCI Converter', () => {
  describe('Castling', () => {
    it('should handle white short castling', () => {
      expect(toUci('e1', 'g1', 'king')).toBe('e1g1');
    });

    it('should handle white long castling', () => {
      expect(toUci('e1', 'c1', 'king')).toBe('e1c1');
    });

    it('should handle black short castling', () => {
      expect(toUci('e8', 'g8', 'king')).toBe('e8g8');
    });

    it('should handle black long castling', () => {
      expect(toUci('e8', 'c8', 'king')).toBe('e8c8');
    });

    it('should handle black short castling from central.v1.json', () => {
      expect(toUci('e8', 'g8', 'king')).toBe('e8g8');
    });
  });

  describe('Regular moves', () => {
    it('should handle pawn moves', () => {
      expect(toUci('e2', 'e4', 'pawn')).toBe('e2e4');
    });

    it('should handle knight moves', () => {
      expect(toUci('g1', 'f3', 'knight')).toBe('g1f3');
    });

    it('should handle queen moves', () => {
      expect(toUci('d1', 'd4', 'queen')).toBe('d1d4');
    });
  });

  describe('Pawn promotion', () => {
    it('should add promotion for white pawn to 8th rank', () => {
      expect(toUci('e7', 'e8', 'pawn')).toBe('e7e8q');
    });

    it('should add promotion for black pawn to 1st rank', () => {
      expect(toUci('e2', 'e1', 'pawn')).toBe('e2e1q');
    });

    it('should not add promotion for pawns not reaching promotion rank', () => {
      expect(toUci('e2', 'e4', 'pawn')).toBe('e2e4');
    });
  });
});
