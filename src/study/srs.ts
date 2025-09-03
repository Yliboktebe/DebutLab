// Simple Spaced Repetition System for DebutLab

export interface SRSInterval {
  nextReviewAt: number;
  interval: number;
}

export class SRS {
  // Intervals in milliseconds
  private static readonly INTERVALS = {
    MASTERED: [3 * 24 * 60 * 60 * 1000, 7 * 24 * 60 * 60 * 1000, 14 * 24 * 60 * 60 * 1000, 30 * 24 * 60 * 60 * 1000],
    REVIEW: 10 * 60 * 1000, // 10 minutes
    RELEARN: 60 * 60 * 1000, // 1 hour
  };

  /**
   * Calculate next review time based on performance
   */
  static calculateNextReview(errors: number, currentInterval?: number): SRSInterval {
    const now = Date.now();

    if (errors === 0) {
      // Mastered - use progressive intervals
      if (!currentInterval) {
        // First time mastered
        return {
          nextReviewAt: now + this.INTERVALS.MASTERED[0],
          interval: this.INTERVALS.MASTERED[0]
        };
      }

      // Find next interval in progression
      const currentIndex = this.INTERVALS.MASTERED.findIndex(interval => interval === currentInterval);
      const nextIndex = Math.min(currentIndex + 1, this.INTERVALS.MASTERED.length - 1);
      const nextInterval = this.INTERVALS.MASTERED[nextIndex];

      return {
        nextReviewAt: now + nextInterval,
        interval: nextInterval
      };
    } else if (errors <= 2) {
      // Review - 10 minutes
      return {
        nextReviewAt: now + this.INTERVALS.REVIEW,
        interval: this.INTERVALS.REVIEW
      };
    } else {
      // Relearn - 1 hour
      return {
        nextReviewAt: now + this.INTERVALS.RELEARN,
        interval: this.INTERVALS.RELEARN
      };
    }
  }

  /**
   * Get human-readable interval description
   */
  static getIntervalDescription(interval: number): string {
    const minutes = Math.floor(interval / (60 * 1000));
    const hours = Math.floor(interval / (60 * 60 * 1000));
    const days = Math.floor(interval / (24 * 60 * 60 * 1000));

    if (days > 0) {
      return `${days} ${this.pluralize(days, 'день', 'дня', 'дней')}`;
    } else if (hours > 0) {
      return `${hours} ${this.pluralize(hours, 'час', 'часа', 'часов')}`;
    } else {
      return `${minutes} ${this.pluralize(minutes, 'минута', 'минуты', 'минут')}`;
    }
  }

  /**
   * Check if review is due
   */
  static isReviewDue(nextReviewAt: number): boolean {
    return Date.now() >= nextReviewAt;
  }

  /**
   * Get time until next review
   */
  static getTimeUntilReview(nextReviewAt: number): number {
    return Math.max(0, nextReviewAt - Date.now());
  }

  /**
   * Get formatted time until next review
   */
  static getFormattedTimeUntilReview(nextReviewAt: number): string {
    const timeLeft = this.getTimeUntilReview(nextReviewAt);
    
    if (timeLeft === 0) {
      return 'Пора повторить';
    }

    const minutes = Math.floor(timeLeft / (60 * 1000));
    const hours = Math.floor(timeLeft / (60 * 60 * 1000));
    const days = Math.floor(timeLeft / (24 * 60 * 60 * 1000));

    if (days > 0) {
      return `Через ${days} ${this.pluralize(days, 'день', 'дня', 'дней')}`;
    } else if (hours > 0) {
      return `Через ${hours} ${this.pluralize(hours, 'час', 'часа', 'часов')}`;
    } else {
      return `Через ${minutes} ${this.pluralize(minutes, 'минута', 'минуты', 'минут')}`;
    }
  }

  private static pluralize(count: number, one: string, few: string, many: string): string {
    if (count % 10 === 1 && count % 100 !== 11) {
      return one;
    } else if ([2, 3, 4].includes(count % 10) && ![12, 13, 14].includes(count % 100)) {
      return few;
    } else {
      return many;
    }
  }
}
