import React from 'react';

interface Props {
  children?: React.ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

class ErrorBoundary extends React.Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error('ErrorBoundary caught an error', error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-900 p-4">
          <div className="max-w-md w-full bg-white dark:bg-gray-800 shadow-xl rounded-xl p-8 border border-red-200 dark:border-red-900/30 font-sans">
            <h1 className="text-2xl font-bold text-red-600 dark:text-red-400 mb-4">Algo deu errado.</h1>
            <p className="text-gray-600 dark:text-gray-400 mb-6 font-medium">
              O aplicativo encontrou um erro inesperado. Tente recarregar a página.
            </p>
            <div className="bg-red-50 dark:bg-red-900/10 p-4 rounded-md mb-6 overflow-auto max-h-40">
              <code className="text-xs text-red-700 dark:text-red-300 break-all">
                {this.state.error?.toString()}
              </code>
            </div>
            <button
              onClick={() => window.location.reload()}
              className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded transition-colors"
            >
              Recarregar Página
            </button>
            <button
              onClick={() => {
                localStorage.clear();
                window.location.reload();
              }}
              className="w-full mt-4 bg-gray-200 dark:bg-gray-700 hover:bg-gray-300 dark:hover:bg-gray-600 text-gray-800 dark:text-white font-bold py-2 px-4 rounded transition-colors text-sm"
            >
              Limpar Dados Locais e Resetar
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

export default ErrorBoundary;
