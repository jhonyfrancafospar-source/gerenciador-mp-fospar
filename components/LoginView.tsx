
import React, { useState } from 'react';
import type { User } from '../types';

interface LoginViewProps {
    onLogin: (username: string, password: string) => void;
    onRegister: (user: User) => void;
    onRecoverPassword: (username: string, name: string, newPassword: string) => boolean;
    onRecoverUsername: (name: string) => string | null;
    error?: string;
}

type ViewMode = 'login' | 'register' | 'recover' | 'recoverUsername';

export const LoginView: React.FC<LoginViewProps> = ({ onLogin, onRegister, onRecoverPassword, onRecoverUsername, error }) => {
    const [viewMode, setViewMode] = useState<ViewMode>('login');
    const [username, setUsername] = useState('');
    const [password, setPassword] = useState('');
    
    // Registration & Recovery fields
    const [name, setName] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    
    // Feedback
    const [localError, setLocalError] = useState<string | null>(null);
    const [successMessage, setSuccessMessage] = useState<string | null>(null);

    const resetForm = () => {
        setUsername('');
        setPassword('');
        setName('');
        setConfirmPassword('');
        setLocalError(null);
        setSuccessMessage(null);
    };

    const handleModeChange = (mode: ViewMode) => {
        resetForm();
        setViewMode(mode);
    };

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        setLocalError(null);
        setSuccessMessage(null);

        if (viewMode === 'register') {
            if (!username) {
                setLocalError("Nome de usuário é obrigatório.");
                return;
            }
            if (password !== confirmPassword) {
                setLocalError('As senhas não coincidem.');
                return;
            }
            // ... (rest of validation) ...
            const newUser: User = {
                username,
                password,
                name,
                role: 'user'
            };
            onRegister(newUser);
        } else if (viewMode === 'recover') {
             // ... recovery logic ...
             const success = onRecoverPassword(username, name, password);
             if (success) {
                 setSuccessMessage('Senha atualizada.');
                 setTimeout(() => handleModeChange('login'), 2000);
             } else {
                 setLocalError('Dados incorretos.');
             }
        } else if (viewMode === 'recoverUsername') {
             const ret = onRecoverUsername(name);
             if (ret) setSuccessMessage(`Usuário: ${ret}`);
             else setLocalError('Não encontrado.');
        } else {
            onLogin(username, password);
        }
    };

    return (
        <div className="min-h-screen bg-gray-100 dark:bg-gray-900 flex flex-col justify-center items-center p-4">
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl w-full max-w-md overflow-hidden">
                <div className="p-8 text-center border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900/50">
                    <h2 className="text-2xl font-bold text-gray-800 dark:text-white">Gerenciador MP</h2>
                    <p className="text-sm text-gray-500 dark:text-gray-400 mt-2">Plataforma de Gestão de Atividades</p>
                </div>
                
                <div className="p-8 space-y-6">
                    {(error || localError) && (
                        <div className="p-3 bg-red-100 border border-red-400 text-red-700 rounded text-sm">
                            {localError || error}
                        </div>
                    )}
                    {successMessage && (
                        <div className="p-3 bg-green-100 border border-green-400 text-green-700 rounded text-sm">
                            {successMessage}
                        </div>
                    )}

                    <form onSubmit={handleSubmit} className="space-y-4">
                        {viewMode === 'register' && (
                            <div>
                                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Nome Completo</label>
                                <input type="text" value={name} onChange={e => setName(e.target.value)} className="w-full px-3 py-2 border rounded dark:bg-gray-700 dark:border-gray-600 dark:text-white" required placeholder="Seu nome exato" />
                            </div>
                        )}

                        {viewMode === 'recover' && (
                             <div>
                                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Nome Completo (Confirmação)</label>
                                <input type="text" value={name} onChange={e => setName(e.target.value)} className="w-full px-3 py-2 border rounded dark:bg-gray-700 dark:border-gray-600 dark:text-white" required />
                            </div>
                        )}

                        {viewMode === 'recoverUsername' && (
                             <div>
                                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Nome Completo</label>
                                <input type="text" value={name} onChange={e => setName(e.target.value)} className="w-full px-3 py-2 border rounded dark:bg-gray-700 dark:border-gray-600 dark:text-white" required />
                            </div>
                        )}

                        {(viewMode === 'login' || viewMode === 'register' || viewMode === 'recover') && (
                            <div>
                                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Usuário</label>
                                <input type="text" value={username} onChange={e => setUsername(e.target.value)} className="w-full px-3 py-2 border rounded dark:bg-gray-700 dark:border-gray-600 dark:text-white" required />
                            </div>
                        )}

                        {(viewMode === 'login' || viewMode === 'register' || viewMode === 'recover') && (
                            <div>
                                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">{viewMode === 'recover' ? 'Nova Senha' : 'Senha'}</label>
                                <input type="password" value={password} onChange={e => setPassword(e.target.value)} className="w-full px-3 py-2 border rounded dark:bg-gray-700 dark:border-gray-600 dark:text-white" required />
                            </div>
                        )}

                        {viewMode === 'register' && (
                            <div>
                                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Confirmar Senha</label>
                                <input type="password" value={confirmPassword} onChange={e => setConfirmPassword(e.target.value)} className="w-full px-3 py-2 border rounded dark:bg-gray-700 dark:border-gray-600 dark:text-white" required />
                            </div>
                        )}

                        <button type="submit" className="w-full bg-primary-600 hover:bg-primary-700 text-white font-bold py-2 px-4 rounded transition-colors">
                            {viewMode === 'login' ? 'Entrar' : viewMode === 'register' ? 'Cadastrar' : viewMode === 'recover' ? 'Redefinir Senha' : 'Recuperar'}
                        </button>
                    </form>

                    <div className="flex flex-col items-center space-y-2 text-sm">
                        {viewMode === 'login' ? (
                            <>
                                <button type="button" onClick={() => handleModeChange('register')} className="text-primary-600 hover:underline">
                                    Criar nova conta
                                </button>
                                <div className="flex space-x-2">
                                    <button type="button" onClick={() => handleModeChange('recover')} className="text-gray-500 hover:text-gray-700 dark:text-gray-400">
                                        Esqueci minha senha
                                    </button>
                                    <span className="text-gray-300">|</span>
                                    <button type="button" onClick={() => handleModeChange('recoverUsername')} className="text-gray-500 hover:text-gray-700 dark:text-gray-400">
                                        Esqueci meu usuário
                                    </button>
                                </div>
                            </>
                        ) : (
                            <button type="button" onClick={() => handleModeChange('login')} className="text-primary-600 hover:underline">
                                Voltar para o Login
                            </button>
                        )}
                    </div>
                </div>
                <div className="p-4 text-center text-xs text-gray-400 border-t border-gray-200 dark:border-gray-700">
                    &copy; 2025 Gerenciador de Atividades MP
                </div>
            </div>
        </div>
    );
};
