
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
            if (password !== confirmPassword) {
                setLocalError('As senhas não coincidem.');
                return;
            }
            if (password.length < 3) {
                setLocalError('A senha deve ter pelo menos 3 caracteres.');
                return;
            }
            if (name.trim().length === 0) {
                setLocalError('O nome é obrigatório.');
                return;
            }
            if (username.trim().length === 0) {
                setLocalError('O usuário é obrigatório.');
                return;
            }

            const newUser: User = {
                username,
                password,
                name,
                role: 'user'
            };
            onRegister(newUser);
        } else if (viewMode === 'recover') {
            if (password !== confirmPassword) {
                setLocalError('As novas senhas não coincidem.');
                return;
            }
            if (password.length < 3) {
                setLocalError('A nova senha deve ter pelo menos 3 caracteres.');
                return;
            }
            
            const success = onRecoverPassword(username, name, password);
            if (success) {
                setSuccessMessage('Senha alterada com sucesso! Você será redirecionado para o login.');
                setTimeout(() => {
                    handleModeChange('login');
                }, 2000);
            } else {
                setLocalError('Usuário ou Nome incorretos. Verifique seus dados.');
            }
        } else if (viewMode === 'recoverUsername') {
            const retrievedUsername = onRecoverUsername(name);
            if (retrievedUsername) {
                 setSuccessMessage(`Usuário encontrado: ${retrievedUsername}`);
            } else {
                setLocalError('Nenhum usuário encontrado com este nome.');
            }
        } else {
            onLogin(username, password);
        }
    };

    return (
        <div className="min-h-screen bg-gray-100 dark:bg-gray-900 flex flex-col justify-center items-center p-4">
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl w-full max-w-md overflow-hidden">
                <div className="p-8 text-center border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900/50">
                    <h2 className="text-2xl font-bold text-gray-800 dark:text-white">
                        {viewMode === 'register' ? 'Criar Conta' : viewMode === 'recover' ? 'Recuperar Senha' : viewMode === 'recoverUsername' ? 'Recuperar Usuário' : 'Gerenciador MP'}
                    </h2>
                    <p className="text-gray-500 dark:text-gray-400 mt-2">
                        {viewMode === 'register' 
                            ? 'Preencha os dados abaixo para se cadastrar' 
                            : viewMode === 'recover'
                            ? 'Confirme sua identidade para redefinir a senha'
                            : viewMode === 'recoverUsername'
                            ? 'Informe seu nome completo'
                            : 'Faça login para acessar suas atividades'}
                    </p>
                </div>
                
                <form onSubmit={handleSubmit} className="p-8 space-y-6">
                    {(error || localError) && (
                        <div className="p-3 bg-red-100 border border-red-400 text-red-700 rounded text-sm">
                            {localError || error}
                        </div>
                    )}

                    {successMessage && (
                        <div className="p-3 bg-green-100 border border-green-400 text-green-700 rounded text-sm font-bold">
                            {successMessage}
                        </div>
                    )}
                    
                    {/* Register & Recover (Password/Username): Need Name */}
                    {(viewMode === 'register' || viewMode === 'recover' || viewMode === 'recoverUsername') && (
                        <div>
                            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                                {viewMode === 'recover' ? 'Confirme seu Nome Completo' : 'Nome Completo'}
                            </label>
                            <input
                                type="text"
                                value={name}
                                onChange={(e) => setName(e.target.value)}
                                className="w-full px-4 py-2 border rounded-md dark:bg-gray-700 dark:border-gray-600 dark:text-white focus:ring-2 focus:ring-primary-500 outline-none transition-all"
                                placeholder="Seu nome exato"
                                required
                            />
                        </div>
                    )}

                    {(viewMode === 'login' || viewMode === 'register' || viewMode === 'recover') && (
                        <div>
                            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                                Usuário
                            </label>
                            <input
                                type="text"
                                value={username}
                                onChange={(e) => setUsername(e.target.value)}
                                className="w-full px-4 py-2 border rounded-md dark:bg-gray-700 dark:border-gray-600 dark:text-white focus:ring-2 focus:ring-primary-500 outline-none transition-all"
                                placeholder="Ex: joaosilva"
                                required
                            />
                        </div>
                    )}

                    {(viewMode === 'login' || viewMode === 'register' || viewMode === 'recover') && (
                        <div>
                            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                                {viewMode === 'recover' ? 'Nova Senha' : 'Senha'}
                            </label>
                            <input
                                type="password"
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                                className="w-full px-4 py-2 border rounded-md dark:bg-gray-700 dark:border-gray-600 dark:text-white focus:ring-2 focus:ring-primary-500 outline-none transition-all"
                                placeholder="••••••"
                                required
                            />
                        </div>
                    )}

                    {(viewMode === 'register' || viewMode === 'recover') && (
                        <div>
                            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                                {viewMode === 'recover' ? 'Confirmar Nova Senha' : 'Confirmar Senha'}
                            </label>
                            <input
                                type="password"
                                value={confirmPassword}
                                onChange={(e) => setConfirmPassword(e.target.value)}
                                className="w-full px-4 py-2 border rounded-md dark:bg-gray-700 dark:border-gray-600 dark:text-white focus:ring-2 focus:ring-primary-500 outline-none transition-all"
                                placeholder="••••••"
                                required
                            />
                        </div>
                    )}
                    
                    <button
                        type="submit"
                        className="w-full bg-primary-600 hover:bg-primary-700 text-white font-bold py-3 px-4 rounded-md transition-colors transform active:scale-95"
                    >
                        {viewMode === 'register' ? 'Cadastrar' : viewMode === 'recover' ? 'Redefinir Senha' : viewMode === 'recoverUsername' ? 'Recuperar Usuário' : 'Entrar'}
                    </button>

                    <div className="flex flex-col space-y-2 text-center mt-4">
                        {viewMode === 'login' && (
                            <>
                                <button
                                    type="button"
                                    onClick={() => handleModeChange('register')}
                                    className="text-sm text-primary-600 hover:text-primary-800 dark:text-primary-400 dark:hover:text-primary-300"
                                >
                                    Não tem uma conta? Criar conta.
                                </button>
                                <div className="flex justify-center space-x-4">
                                    <button
                                        type="button"
                                        onClick={() => handleModeChange('recover')}
                                        className="text-xs text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
                                    >
                                        Esqueci minha senha
                                    </button>
                                    <span className="text-xs text-gray-300">|</span>
                                    <button
                                        type="button"
                                        onClick={() => handleModeChange('recoverUsername')}
                                        className="text-xs text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
                                    >
                                        Esqueci meu usuário
                                    </button>
                                </div>
                            </>
                        )}
                        {(viewMode === 'register' || viewMode === 'recover' || viewMode === 'recoverUsername') && (
                            <button
                                type="button"
                                onClick={() => handleModeChange('login')}
                                className="text-sm text-primary-600 hover:text-primary-800 dark:text-primary-400 dark:hover:text-primary-300"
                            >
                                Voltar para o Login
                            </button>
                        )}
                    </div>
                </form>
                <div className="p-4 text-center text-xs text-gray-400 border-t border-gray-200 dark:border-gray-700">
                    &copy; {new Date().getFullYear()} Gerenciador de Atividades MP
                </div>
            </div>
        </div>
    );
};
