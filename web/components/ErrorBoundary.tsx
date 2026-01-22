"use client";

import React, { Component, ErrorInfo, ReactNode } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { AlertTriangle, RefreshCw, Home, Bug, ChevronDown, ChevronUp, Copy, Check } from 'lucide-react';

// Types
interface Props {
    children: ReactNode;
    fallback?: ReactNode;
    onError?: (error: Error, errorInfo: ErrorInfo) => void;
    showDetails?: boolean;
    resetOnNavigate?: boolean;
}

interface State {
    hasError: boolean;
    error: Error | null;
    errorInfo: ErrorInfo | null;
    showStack: boolean;
    copied: boolean;
    errorId: string;
}

// Generate unique error ID for tracking
function generateErrorId(): string {
    return `ERR-${Date.now().toString(36).toUpperCase()}-${Math.random().toString(36).substring(2, 8).toUpperCase()}`;
}

// Main Error Boundary Component
export class ErrorBoundary extends Component<Props, State> {
    constructor(props: Props) {
        super(props);
        this.state = {
            hasError: false,
            error: null,
            errorInfo: null,
            showStack: false,
            copied: false,
            errorId: ''
        };
    }

    static getDerivedStateFromError(error: Error): Partial<State> {
        return {
            hasError: true,
            error,
            errorId: generateErrorId()
        };
    }

    componentDidCatch(error: Error, errorInfo: ErrorInfo): void {
        this.setState({ errorInfo });

        // Log error to console
        console.error('[ErrorBoundary] Caught error:', error);
        console.error('[ErrorBoundary] Component stack:', errorInfo.componentStack);

        // Call custom error handler
        this.props.onError?.(error, errorInfo);

        // Send to error tracking service (Sentry, etc.)
        this.reportError(error, errorInfo);
    }

    private reportError(error: Error, errorInfo: ErrorInfo): void {
        // In production, send to error tracking service
        if (typeof window !== 'undefined') {
            // Send error report
            fetch('/api/errors/report', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    errorId: this.state.errorId,
                    message: error.message,
                    stack: error.stack,
                    componentStack: errorInfo.componentStack,
                    url: window.location.href,
                    timestamp: new Date().toISOString(),
                    userAgent: navigator.userAgent
                })
            }).catch(() => {
                // Silently fail - don't cause more errors
            });
        }
    }

    private handleReset = (): void => {
        this.setState({
            hasError: false,
            error: null,
            errorInfo: null,
            showStack: false,
            errorId: ''
        });
    };

    private handleGoHome = (): void => {
        if (typeof window !== 'undefined') {
            window.location.href = '/';
        }
    };

    private handleReload = (): void => {
        if (typeof window !== 'undefined') {
            window.location.reload();
        }
    };

    private toggleStack = (): void => {
        this.setState(prev => ({ showStack: !prev.showStack }));
    };

    private copyErrorDetails = async (): Promise<void> => {
        const { error, errorInfo, errorId } = this.state;
        const details = `
Error ID: ${errorId}
Message: ${error?.message}
Stack: ${error?.stack}
Component Stack: ${errorInfo?.componentStack}
URL: ${typeof window !== 'undefined' ? window.location.href : 'N/A'}
Time: ${new Date().toISOString()}
        `.trim();

        try {
            await navigator.clipboard.writeText(details);
            this.setState({ copied: true });
            setTimeout(() => this.setState({ copied: false }), 2000);
        } catch {
            console.error('Failed to copy error details');
        }
    };

    render(): ReactNode {
        const { hasError, error, errorInfo, showStack, copied, errorId } = this.state;
        const { children, fallback, showDetails = true } = this.props;

        if (hasError) {
            // Custom fallback
            if (fallback) {
                return fallback;
            }

            // Default error UI
            return (
                <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    className="min-h-[400px] flex items-center justify-center p-8"
                >
                    <div className="max-w-lg w-full bg-white dark:bg-gray-900 rounded-2xl shadow-xl border border-red-200 dark:border-red-800 overflow-hidden">
                        {/* Header */}
                        <div className="bg-gradient-to-r from-red-500 to-orange-500 px-6 py-4">
                            <div className="flex items-center gap-3">
                                <div className="p-2 bg-white/20 rounded-lg">
                                    <AlertTriangle className="w-6 h-6 text-white" />
                                </div>
                                <div>
                                    <h2 className="text-lg font-semibold text-white">
                                        Something went wrong
                                    </h2>
                                    <p className="text-sm text-white/80">
                                        Error ID: {errorId}
                                    </p>
                                </div>
                            </div>
                        </div>

                        {/* Body */}
                        <div className="p-6">
                            <p className="text-gray-600 dark:text-gray-400 mb-4">
                                We apologize for the inconvenience. An unexpected error has occurred.
                                Our team has been notified and is working on a fix.
                            </p>

                            {/* Error Message */}
                            <div className="bg-red-50 dark:bg-red-900/20 rounded-lg p-4 mb-4">
                                <p className="text-sm text-red-800 dark:text-red-200 font-mono">
                                    {error?.message || 'Unknown error'}
                                </p>
                            </div>

                            {/* Actions */}
                            <div className="flex flex-wrap gap-3 mb-4">
                                <button
                                    onClick={this.handleReset}
                                    className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                                >
                                    <RefreshCw className="w-4 h-4" />
                                    Try Again
                                </button>
                                <button
                                    onClick={this.handleReload}
                                    className="inline-flex items-center gap-2 px-4 py-2 bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors"
                                >
                                    <RefreshCw className="w-4 h-4" />
                                    Reload Page
                                </button>
                                <button
                                    onClick={this.handleGoHome}
                                    className="inline-flex items-center gap-2 px-4 py-2 bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors"
                                >
                                    <Home className="w-4 h-4" />
                                    Go Home
                                </button>
                            </div>

                            {/* Technical Details Toggle */}
                            {showDetails && (
                                <div className="border-t border-gray-200 dark:border-gray-700 pt-4">
                                    <button
                                        onClick={this.toggleStack}
                                        className="flex items-center gap-2 text-sm text-gray-500 hover:text-gray-700 dark:hover:text-gray-300"
                                    >
                                        <Bug className="w-4 h-4" />
                                        Technical Details
                                        {showStack ? (
                                            <ChevronUp className="w-4 h-4" />
                                        ) : (
                                            <ChevronDown className="w-4 h-4" />
                                        )}
                                    </button>

                                    <AnimatePresence>
                                        {showStack && (
                                            <motion.div
                                                initial={{ height: 0, opacity: 0 }}
                                                animate={{ height: 'auto', opacity: 1 }}
                                                exit={{ height: 0, opacity: 0 }}
                                                className="overflow-hidden"
                                            >
                                                <div className="mt-4 relative">
                                                    <button
                                                        onClick={this.copyErrorDetails}
                                                        className="absolute top-2 right-2 p-2 bg-gray-200 dark:bg-gray-700 rounded hover:bg-gray-300 dark:hover:bg-gray-600 transition-colors"
                                                        title="Copy error details"
                                                    >
                                                        {copied ? (
                                                            <Check className="w-4 h-4 text-green-500" />
                                                        ) : (
                                                            <Copy className="w-4 h-4" />
                                                        )}
                                                    </button>
                                                    <pre className="bg-gray-100 dark:bg-gray-800 rounded-lg p-4 overflow-x-auto text-xs text-gray-600 dark:text-gray-400 max-h-64 overflow-y-auto">
                                                        <code>
                                                            {`Error: ${error?.message}\n\nStack Trace:\n${error?.stack}\n\nComponent Stack:\n${errorInfo?.componentStack}`}
                                                        </code>
                                                    </pre>
                                                </div>
                                            </motion.div>
                                        )}
                                    </AnimatePresence>
                                </div>
                            )}
                        </div>

                        {/* Footer */}
                        <div className="bg-gray-50 dark:bg-gray-800 px-6 py-3 text-center">
                            <p className="text-xs text-gray-500 dark:text-gray-400">
                                If this problem persists, please contact support with Error ID: <span className="font-mono font-medium">{errorId}</span>
                            </p>
                        </div>
                    </div>
                </motion.div>
            );
        }

        return children;
    }
}

// Global Error Handler for client-side
export function GlobalErrorHandler({ children }: { children: ReactNode }) {
    return (
        <ErrorBoundary
            onError={(error, errorInfo) => {
                // Global error handling
                console.error('[GlobalError]', error.message);
            }}
        >
            {children}
        </ErrorBoundary>
    );
}

// HOC for wrapping components with error boundary
export function withErrorBoundary<P extends object>(
    WrappedComponent: React.ComponentType<P>,
    fallback?: ReactNode
) {
    const displayName = WrappedComponent.displayName || WrappedComponent.name || 'Component';

    const ComponentWithErrorBoundary = (props: P) => (
        <ErrorBoundary fallback={fallback}>
            <WrappedComponent {...props} />
        </ErrorBoundary>
    );

    ComponentWithErrorBoundary.displayName = `withErrorBoundary(${displayName})`;

    return ComponentWithErrorBoundary;
}

// Hook-based error boundary (for functional components)
interface UseErrorBoundaryResult {
    showBoundary: (error: Error) => void;
    reset: () => void;
}

export function useErrorBoundary(): UseErrorBoundaryResult {
    const [error, setError] = React.useState<Error | null>(null);

    const showBoundary = React.useCallback((err: Error) => {
        setError(err);
    }, []);

    const reset = React.useCallback(() => {
        setError(null);
    }, []);

    if (error) {
        throw error;
    }

    return { showBoundary, reset };
}

// Simple Error Fallback Component
export function ErrorFallback({
    error,
    resetErrorBoundary
}: {
    error: Error;
    resetErrorBoundary: () => void;
}) {
    return (
        <div className="p-6 bg-red-50 dark:bg-red-900/20 rounded-lg border border-red-200 dark:border-red-800">
            <div className="flex items-start gap-3">
                <AlertTriangle className="w-5 h-5 text-red-500 flex-shrink-0 mt-0.5" />
                <div>
                    <h3 className="font-medium text-red-800 dark:text-red-200">
                        Error loading component
                    </h3>
                    <p className="text-sm text-red-600 dark:text-red-300 mt-1">
                        {error.message}
                    </p>
                    <button
                        onClick={resetErrorBoundary}
                        className="mt-3 text-sm text-red-700 dark:text-red-300 hover:underline"
                    >
                        Try again
                    </button>
                </div>
            </div>
        </div>
    );
}

// Async Error Boundary for suspense fallbacks
export function AsyncErrorBoundary({ children }: { children: ReactNode }) {
    return (
        <ErrorBoundary
            fallback={
                <div className="p-8 text-center">
                    <div className="inline-flex items-center gap-2 text-amber-600">
                        <AlertTriangle className="w-5 h-5" />
                        <span>Failed to load content</span>
                    </div>
                    <button
                        onClick={() => window.location.reload()}
                        className="mt-4 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
                    >
                        Reload
                    </button>
                </div>
            }
        >
            {children}
        </ErrorBoundary>
    );
}

export default ErrorBoundary;
