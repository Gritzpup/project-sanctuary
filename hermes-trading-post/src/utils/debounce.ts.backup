/**
 * @file debounce.ts
 * @description Debounce utility function for reducing event frequency
 * 🚀 PHASE 15c: Input handler debouncing for performance
 */

/**
 * Debounce function - delays execution until after final call
 * @param func Function to debounce
 * @param wait Wait time in milliseconds
 * @param immediate Execute immediately on first call
 * @returns Debounced function
 */
export function debounce<T extends (...args: any[]) => any>(
  func: T,
  wait: number,
  immediate: boolean = false
): (...args: Parameters<T>) => void {
  let timeout: ReturnType<typeof setTimeout> | null = null;

  return function executedFunction(...args: Parameters<T>) {
    const later = () => {
      timeout = null;
      if (!immediate) func(...args);
    };

    const callNow = immediate && !timeout;
    if (timeout) clearTimeout(timeout);
    timeout = setTimeout(later, wait);

    if (callNow) func(...args);
  };
}

/**
 * Throttle function - executes at most once per wait period
 * @param func Function to throttle
 * @param wait Wait time in milliseconds
 * @returns Throttled function
 */
export function throttle<T extends (...args: any[]) => any>(
  func: T,
  wait: number
): (...args: Parameters<T>) => void {
  let lastCall: number = 0;
  let timeout: ReturnType<typeof setTimeout> | null = null;

  return function executedFunction(...args: Parameters<T>) {
    const now = Date.now();
    const timeSinceLastCall = now - lastCall;

    if (timeSinceLastCall >= wait) {
      func(...args);
      lastCall = now;
      if (timeout) {
        clearTimeout(timeout);
        timeout = null;
      }
    } else if (!timeout) {
      timeout = setTimeout(() => {
        func(...args);
        lastCall = Date.now();
        timeout = null;
      }, wait - timeSinceLastCall);
    }
  };
}

/**
 * Debounce with leading and trailing options
 * @param func Function to debounce
 * @param wait Wait time in milliseconds
 * @param options { leading?: boolean; trailing?: boolean; maxWait?: number }
 * @returns Debounced function with cancel method
 */
export function debounceWithOptions<T extends (...args: any[]) => any>(
  func: T,
  wait: number,
  options: { leading?: boolean; trailing?: boolean; maxWait?: number } = {}
): ((...args: Parameters<T>) => void) & { cancel: () => void } {
  const { leading = false, trailing = true, maxWait } = options;
  let lastCall: number = 0;
  let lastFunc: ReturnType<typeof setTimeout> | null = null;
  let maxWaitTimeout: ReturnType<typeof setTimeout> | null = null;

  const debounced = function (...args: Parameters<T>) {
    const now = Date.now();

    if (leading && now - lastCall >= wait) {
      func(...args);
      lastCall = now;
    }

    if (lastFunc) {
      clearTimeout(lastFunc);
    }

    if (trailing) {
      lastFunc = setTimeout(() => {
        func(...args);
        lastCall = Date.now();
        lastFunc = null;
      }, wait);
    }

    if (maxWait && maxWaitTimeout === null) {
      maxWaitTimeout = setTimeout(() => {
        func(...args);
        lastCall = Date.now();
        if (lastFunc) {
          clearTimeout(lastFunc);
          lastFunc = null;
        }
        maxWaitTimeout = null;
      }, maxWait);
    }
  } as ((...args: Parameters<T>) => void) & { cancel: () => void };

  debounced.cancel = () => {
    if (lastFunc) {
      clearTimeout(lastFunc);
      lastFunc = null;
    }
    if (maxWaitTimeout) {
      clearTimeout(maxWaitTimeout);
      maxWaitTimeout = null;
    }
  };

  return debounced;
}
