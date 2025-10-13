<script lang="ts">
  import { onMount, createEventDispatcher } from 'svelte';
  import { logger } from '../services/logging';
  
  export let fallbackComponent: any = null;
  export let fallbackProps: Record<string, unknown> = {};
  export let resetOnPropsChange = false;
  export let resetKeys: unknown[] = [];
  
  const dispatch = createEventDispatcher<{
    error: { error: Error; errorInfo: any };
    reset: void;
  }>();

  let hasError = false;
  let error: Error | null = null;
  let errorInfo: any = null;
  let previousResetKeys = resetKeys;

  // Reset error state when reset keys change
  $: if (resetOnPropsChange && resetKeys !== previousResetKeys) {
    if (hasError) {
      resetErrorBoundary();
    }
    previousResetKeys = resetKeys;
  }

  function resetErrorBoundary() {
    hasError = false;
    error = null;
    errorInfo = null;
    dispatch('reset');
  }

  onMount(() => {
    // Set up global error handler
    const handleError = (event: ErrorEvent) => {
      const error = event.error || new Error(event.message);
      catchError(error, {
        componentStack: 'Global error handler',
        errorBoundary: true
      });
    };

    const handleUnhandledRejection = (event: PromiseRejectionEvent) => {
      const error = event.reason instanceof Error 
        ? event.reason 
        : new Error(String(event.reason));
      
      catchError(error, {
        componentStack: 'Unhandled promise rejection',
        errorBoundary: true,
        promise: true
      });
    };

    window.addEventListener('error', handleError);
    window.addEventListener('unhandledrejection', handleUnhandledRejection);

    return () => {
      window.removeEventListener('error', handleError);
      window.removeEventListener('unhandledrejection', handleUnhandledRejection);
    };
  });

  function catchError(caughtError: Error, caughtErrorInfo: any) {
    hasError = true;
    error = caughtError;
    errorInfo = caughtErrorInfo;

    // Log error using structured logger
    logger.error('Component error caught by error boundary', {
      error: caughtError.message,
      errorInfo: caughtErrorInfo,
      hasError: true,
      componentStack: caughtErrorInfo?.componentStack
    }, 'ErrorBoundary');

    dispatch('error', { error: caughtError, errorInfo: caughtErrorInfo });
  }

  // Expose catch function for child components to use
  export function reportError(reportedError: Error, context?: any) {
    catchError(reportedError, context || { manual: true });
  }

  function handleRetry() {
    resetErrorBoundary();
  }

  function handleReportIssue() {
    // In a real app, this would send error report to monitoring service
    const errorReport = {
      error: {
        name: error?.name,
        message: error?.message,
        stack: error?.stack
      },
      errorInfo,
      timestamp: new Date().toISOString(),
      userAgent: navigator.userAgent,
      url: window.location.href,
      userId: null // Would be populated from user context
    };

    logger.error('User reported error via error boundary', {
      action: 'report_issue',
      errorReport
    }, 'ErrorBoundary');

    // For now, just copy to clipboard
    navigator.clipboard?.writeText(JSON.stringify(errorReport, null, 2))
      .then(() => {
        alert('Error report copied to clipboard. Please share this with support.');
      })
      .catch(() => {
        alert('Failed to copy error report. Please manually report this issue.');
      });
  }
</script>

{#if hasError}
  {#if fallbackComponent}
    <svelte:component this={fallbackComponent} {...fallbackProps} {error} {errorInfo} on:retry={handleRetry} />
  {:else}
    <div class="error-boundary" role="alert" aria-live="assertive">
      <div class="error-container">
        <div class="error-icon" aria-hidden="true">
          ⚠️
        </div>
        
        <div class="error-content">
          <h2 class="error-title">Something went wrong</h2>
          
          <p class="error-description">
            An unexpected error occurred while displaying this component. 
            The error has been logged and will be investigated.
          </p>
          
          {#if error}
            <details class="error-details">
              <summary>Technical Details</summary>
              <div class="error-stack">
                <strong>Error:</strong> {error.name}: {error.message}
                {#if error.stack}
                  <pre class="stack-trace">{error.stack}</pre>
                {/if}
              </div>
            </details>
          {/if}
        </div>
        
        <div class="error-actions">
          <button 
            class="btn btn-primary" 
            on:click={handleRetry}
            aria-label="Try to reload the component"
          >
            Try Again
          </button>
          
          <button 
            class="btn btn-secondary" 
            on:click={handleReportIssue}
            aria-label="Report this error to support"
          >
            Report Issue
          </button>
          
          <button 
            class="btn btn-tertiary" 
            on:click={() => window.location.reload()}
            aria-label="Reload the entire page"
          >
            Reload Page
          </button>
        </div>
      </div>
    </div>
  {/if}
{:else}
  <slot {catchError} {reportError}></slot>
{/if}

<style>
  .error-boundary {
    display: flex;
    align-items: center;
    justify-content: center;
    min-height: 200px;
    padding: 2rem;
    background: var(--color-surface);
    border: 2px solid var(--color-error);
    border-radius: var(--radius-lg);
    margin: 1rem 0;
  }

  .error-container {
    max-width: 600px;
    text-align: center;
  }

  .error-icon {
    font-size: 3rem;
    margin-bottom: 1rem;
    opacity: 0.8;
  }

  .error-content {
    margin-bottom: 2rem;
  }

  .error-title {
    margin: 0 0 1rem 0;
    font-size: 1.5rem;
    font-weight: 600;
    color: var(--color-error);
  }

  .error-description {
    margin: 0 0 1.5rem 0;
    font-size: 1rem;
    line-height: 1.6;
    color: var(--color-text-secondary);
  }

  .error-details {
    text-align: left;
    margin: 1.5rem 0;
    border: 1px solid var(--color-border);
    border-radius: var(--radius-md);
    overflow: hidden;
  }

  .error-details summary {
    padding: 0.75rem 1rem;
    background: var(--color-surface-elevated);
    cursor: pointer;
    font-weight: 500;
    color: var(--color-text-primary);
    border-bottom: 1px solid var(--color-border);
  }

  .error-details summary:hover {
    background: var(--color-surface-hover);
  }

  .error-stack {
    padding: 1rem;
    font-size: 0.9rem;
    color: var(--color-text-secondary);
  }

  .stack-trace {
    background: var(--color-surface-elevated);
    border: 1px solid var(--color-border);
    border-radius: var(--radius-sm);
    padding: 1rem;
    font-family: 'Monaco', 'Menlo', 'Ubuntu Mono', monospace;
    font-size: 0.8rem;
    overflow-x: auto;
    margin-top: 0.5rem;
    white-space: pre;
  }

  .error-actions {
    display: flex;
    gap: 0.75rem;
    justify-content: center;
    flex-wrap: wrap;
  }

  .btn {
    padding: 0.75rem 1.5rem;
    border: 2px solid transparent;
    border-radius: var(--radius-md);
    font-size: 0.95rem;
    font-weight: 500;
    cursor: pointer;
    transition: all 0.2s ease;
    text-decoration: none;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    min-width: 120px;
  }

  .btn-primary {
    background: var(--color-primary);
    color: white;
    border-color: var(--color-primary);
  }

  .btn-primary:hover {
    background: var(--color-primary-hover);
    border-color: var(--color-primary-hover);
  }

  .btn-secondary {
    background: var(--color-surface-elevated);
    color: var(--color-text-primary);
    border-color: var(--color-border);
  }

  .btn-secondary:hover {
    background: var(--color-surface-hover);
    border-color: var(--color-border-hover);
  }

  .btn-tertiary {
    background: transparent;
    color: var(--color-text-secondary);
    border-color: var(--color-border);
  }

  .btn-tertiary:hover {
    background: var(--color-surface-hover);
    color: var(--color-text-primary);
    border-color: var(--color-border-hover);
  }

  @media (max-width: 768px) {
    .error-boundary {
      padding: 1rem;
      margin: 0.5rem 0;
    }

    .error-actions {
      flex-direction: column;
    }

    .btn {
      width: 100%;
    }
  }
</style>