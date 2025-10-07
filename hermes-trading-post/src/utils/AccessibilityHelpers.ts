/**
 * Accessibility utility functions to improve component accessibility
 */

export interface AccessibilityOptions {
  label?: string;
  description?: string;
  role?: string;
  keyboardShortcut?: string;
  required?: boolean;
  invalid?: boolean;
  expanded?: boolean;
  pressed?: boolean;
  selected?: boolean;
  disabled?: boolean;
}

export class AccessibilityHelpers {
  /**
   * Generate aria attributes for a button component
   */
  public static getButtonAttributes(options: AccessibilityOptions = {}) {
    const attrs: Record<string, string | boolean> = {};
    
    if (options.label) {
      attrs['aria-label'] = options.label;
    }
    
    if (options.description) {
      attrs['aria-describedby'] = `desc-${this.generateId()}`;
    }
    
    if (options.pressed !== undefined) {
      attrs['aria-pressed'] = options.pressed.toString();
    }
    
    if (options.expanded !== undefined) {
      attrs['aria-expanded'] = options.expanded.toString();
    }
    
    if (options.disabled) {
      attrs['aria-disabled'] = 'true';
      attrs['tabindex'] = '-1';
    }
    
    if (options.keyboardShortcut) {
      attrs['title'] = `${options.label || 'Button'} (${options.keyboardShortcut})`;
    }
    
    return attrs;
  }

  /**
   * Generate aria attributes for an input component
   */
  public static getInputAttributes(options: AccessibilityOptions = {}) {
    const attrs: Record<string, string | boolean> = {};
    
    if (options.label) {
      attrs['aria-label'] = options.label;
    }
    
    if (options.description) {
      const descId = `desc-${this.generateId()}`;
      attrs['aria-describedby'] = descId;
    }
    
    if (options.required) {
      attrs['aria-required'] = 'true';
      attrs['required'] = true;
    }
    
    if (options.invalid) {
      attrs['aria-invalid'] = 'true';
    }
    
    return attrs;
  }

  /**
   * Generate aria attributes for a select/dropdown component
   */
  public static getSelectAttributes(options: AccessibilityOptions & { 
    hasPopup?: boolean;
    controls?: string;
  } = {}) {
    const attrs: Record<string, string | boolean> = {};
    
    if (options.label) {
      attrs['aria-label'] = options.label;
    }
    
    if (options.expanded !== undefined) {
      attrs['aria-expanded'] = options.expanded.toString();
    }
    
    if (options.hasPopup) {
      attrs['aria-haspopup'] = 'listbox';
    }
    
    if (options.controls) {
      attrs['aria-controls'] = options.controls;
    }
    
    if (options.selected !== undefined) {
      attrs['aria-selected'] = options.selected.toString();
    }
    
    return attrs;
  }

  /**
   * Generate aria attributes for modal/dialog components
   */
  public static getModalAttributes(options: AccessibilityOptions & {
    labelledBy?: string;
    modal?: boolean;
  } = {}) {
    const attrs: Record<string, string | boolean> = {
      role: 'dialog',
      'aria-modal': options.modal !== false ? 'true' : 'false',
      tabindex: '-1'
    };
    
    if (options.labelledBy) {
      attrs['aria-labelledby'] = options.labelledBy;
    } else if (options.label) {
      attrs['aria-label'] = options.label;
    }
    
    if (options.description) {
      attrs['aria-describedby'] = options.description;
    }
    
    return attrs;
  }

  /**
   * Generate aria attributes for form validation messages
   */
  public static getValidationAttributes(isValid: boolean, message?: string) {
    const attrs: Record<string, string | boolean> = {};
    
    if (!isValid) {
      attrs.role = 'alert';
      attrs['aria-live'] = 'polite';
    }
    
    if (message) {
      attrs['aria-label'] = message;
    }
    
    return attrs;
  }

  /**
   * Generate aria attributes for loading/progress indicators
   */
  public static getLoadingAttributes(options: {
    label?: string;
    progress?: number;
    indeterminate?: boolean;
  } = {}) {
    const attrs: Record<string, string | boolean | number> = {
      role: 'progressbar',
      'aria-live': 'polite'
    };
    
    if (options.label) {
      attrs['aria-label'] = options.label;
    }
    
    if (options.progress !== undefined && !options.indeterminate) {
      attrs['aria-valuenow'] = options.progress;
      attrs['aria-valuemin'] = 0;
      attrs['aria-valuemax'] = 100;
    }
    
    return attrs;
  }

  /**
   * Generate aria attributes for navigation components
   */
  public static getNavigationAttributes(options: {
    label?: string;
    current?: boolean;
    level?: number;
  } = {}) {
    const attrs: Record<string, string | boolean | number> = {};
    
    if (options.label) {
      attrs['aria-label'] = options.label;
    }
    
    if (options.current) {
      attrs['aria-current'] = 'page';
    }
    
    if (options.level) {
      attrs['aria-level'] = options.level;
    }
    
    return attrs;
  }

  /**
   * Generate unique ID for aria relationships
   */
  private static generateId(): string {
    return `a11y-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Keyboard event helper for custom interactive elements
   */
  public static handleKeyboardNavigation(
    event: KeyboardEvent,
    onEnter?: () => void,
    onSpace?: () => void,
    onEscape?: () => void,
    onArrowUp?: () => void,
    onArrowDown?: () => void,
    onArrowLeft?: () => void,
    onArrowRight?: () => void
  ): boolean {
    let handled = false;
    
    switch (event.key) {
      case 'Enter':
        if (onEnter) {
          event.preventDefault();
          onEnter();
          handled = true;
        }
        break;
        
      case ' ':
      case 'Space':
        if (onSpace) {
          event.preventDefault();
          onSpace();
          handled = true;
        }
        break;
        
      case 'Escape':
        if (onEscape) {
          event.preventDefault();
          onEscape();
          handled = true;
        }
        break;
        
      case 'ArrowUp':
        if (onArrowUp) {
          event.preventDefault();
          onArrowUp();
          handled = true;
        }
        break;
        
      case 'ArrowDown':
        if (onArrowDown) {
          event.preventDefault();
          onArrowDown();
          handled = true;
        }
        break;
        
      case 'ArrowLeft':
        if (onArrowLeft) {
          event.preventDefault();
          onArrowLeft();
          handled = true;
        }
        break;
        
      case 'ArrowRight':
        if (onArrowRight) {
          event.preventDefault();
          onArrowRight();
          handled = true;
        }
        break;
    }
    
    return handled;
  }

  /**
   * Focus management utilities
   */
  public static focusManagement = {
    trapFocus: (container: HTMLElement) => {
      const focusableElements = container.querySelectorAll(
        'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
      );
      
      const firstElement = focusableElements[0] as HTMLElement;
      const lastElement = focusableElements[focusableElements.length - 1] as HTMLElement;
      
      return (event: KeyboardEvent) => {
        if (event.key === 'Tab') {
          if (event.shiftKey) {
            if (document.activeElement === firstElement) {
              event.preventDefault();
              lastElement.focus();
            }
          } else {
            if (document.activeElement === lastElement) {
              event.preventDefault();
              firstElement.focus();
            }
          }
        }
      };
    },
    
    returnFocus: (previousElement?: HTMLElement) => {
      return () => {
        if (previousElement && typeof previousElement.focus === 'function') {
          previousElement.focus();
        }
      };
    },
    
    findFocusable: (container: HTMLElement): HTMLElement[] => {
      const selector = 'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])';
      return Array.from(container.querySelectorAll(selector)) as HTMLElement[];
    }
  };

  /**
   * Announce changes to screen readers
   */
  public static announceToScreenReader(message: string, priority: 'polite' | 'assertive' = 'polite'): void {
    const announcement = document.createElement('div');
    announcement.setAttribute('aria-live', priority);
    announcement.setAttribute('aria-atomic', 'true');
    announcement.className = 'sr-only';
    announcement.textContent = message;
    
    document.body.appendChild(announcement);
    
    // Remove after announcement
    setTimeout(() => {
      document.body.removeChild(announcement);
    }, 1000);
  }

  /**
   * Screen reader only CSS class utility
   */
  public static getScreenReaderOnlyClass(): string {
    return 'sr-only';
  }
}

// CSS for screen reader only content - should be added to global styles
export const SCREEN_READER_CSS = `
  .sr-only {
    position: absolute !important;
    width: 1px !important;
    height: 1px !important;
    padding: 0 !important;
    margin: -1px !important;
    overflow: hidden !important;
    clip: rect(0, 0, 0, 0) !important;
    white-space: nowrap !important;
    border: 0 !important;
  }

  .sr-only-focusable:active,
  .sr-only-focusable:focus {
    position: static !important;
    width: auto !important;
    height: auto !important;
    margin: 0 !important;
    overflow: visible !important;
    clip: auto !important;
    white-space: normal !important;
  }
`;