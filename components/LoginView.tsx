
import React, { useState } from 'react';
import type { User } from '../types';

interface LoginViewProps {
    onLogin: (username: string, password: string) => void;
    onRegister: (user: User) => void;
    onRecoverPassword: (username: string, name: string, newPassword: string) => boolean;
    onRecoverUsername: (name: string) => string | null;
    error?: string;
    isLoading?: boolean;
    isNeonConnected?: boolean;
}

type ViewMode = 'login' | 'register' | 'recover' | 'recoverUsername';

export const LoginView: React.FC<LoginViewProps> = ({ 
    onLogin, 
    onRegister, 
    onRecoverPassword, 
    onRecoverUsername, 
    error,
    isLoading = false,
    isNeonConnected = true
}) => {
    const [viewMode, setViewMode] = useState<ViewMode>('login');
    const [username, setUsername] = useState('');
    const [password, setPassword] = useState('');
    
    // Registration & Recovery fields
    const [name, setName] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [role, setRole] = useState<'admin' | 'user' | 'operator'>('user');
    
    // Feedback
    const [localError, setLocalError] = useState<string | null>(null);
    const [successMessage, setSuccessMessage] = useState<string | null>(null);

    const resetForm = () => {
        setUsername('');
        setPassword('');
        setName('');
        setConfirmPassword('');
        setRole('user');
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
            const newUser: User = {
                username: username.trim(),
                password,
                name: name.trim() || username.trim(),
                role
            };
            onRegister(newUser);
        } else if (viewMode === 'recover') {
             const success = onRecoverPassword(username.trim(), name.trim(), password);
             if (success) {
                 setSuccessMessage('Senha atualizada com sucesso no banco de dados!');
                 setTimeout(() => handleModeChange('login'), 2000);
             } else {
                 setLocalError('Dados incorretos. Verifique o usuário e nome.');
             }
        } else if (viewMode === 'recoverUsername') {
             const ret = onRecoverUsername(name.trim());
             if (ret) setSuccessMessage(`Usuário encontrado: @${ret}`);
             else setLocalError('Nenhum usuário encontrado com esse nome.');
        } else {
            onLogin(username.trim(), password);
        }
    };

    const handleQuickFill = (u: string, p: string) => {
        setUsername(u);
        setPassword(p);
    };

    return (
        <div className="min-h-screen bg-gray-100 dark:bg-gray-900 flex flex-col justify-center items-center p-4">
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl w-full max-w-md overflow-hidden">
                <div className="p-6 text-center border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900/50">
                    <h2 className="text-2xl font-bold text-gray-800 dark:text-white">Gerenciador MP</h2>
                    <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">Plataforma de Gestão de Atividades</p>
                    
                    {/* Database status pill */}
                    <div className="mt-3 inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium bg-emerald-50 text-emerald-700 border border-emerald-200 dark:bg-emerald-950/50 dark:text-emerald-300 dark:border-emerald-800">
                        <span className={`w-2 h-2 rounded-full ${isNeonConnected ? 'bg-emerald-500 animate-pulse' : 'bg-amber-500'}`} />
                        <span>{isNeonConnected ? 'Neon PostgreSQL Conectado' : 'Conectando ao Neon...'}</span>
                    </div>
                </div>
                
                <div className="p-6 space-y-5">
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
                                <input 
                                    type="text" 
                                    value={name} 
                                    onChange={e => setName(e.target.value)} 
                                    className="w-full px-3 py-2 border rounded dark:bg-gray-700 dark:border-gray-600 dark:text-white" 
                                    required 
                                    placeholder="Ex: Carlos Silva" 
                                />
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
                                <input 
                                    type="text" 
                                    value={username} 
                                    onChange={e => setUsername(e.target.value)} 
                                    className="w-full px-3 py-2 border rounded dark:bg-gray-700 dark:border-gray-600 dark:text-white" 
                                    required 
                                    placeholder="Ex: admin ou jhony"
                                    autoComplete="username"
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
                                    onChange={e => setPassword(e.target.value)} 
                                    className="w-full px-3 py-2 border rounded dark:bg-gray-700 dark:border-gray-600 dark:text-white" 
                                    required 
                                    autoComplete="current-password"
                                />
                            </div>
                        )}

                        {viewMode === 'register' && (
                            <>
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Confirmar Senha</label>
                                    <input type="password" value={confirmPassword} onChange={e => setConfirmPassword(e.target.value)} className="w-full px-3 py-2 border rounded dark:bg-gray-700 dark:border-gray-600 dark:text-white" required />
                                </div>
                                <div className="mt-4">
                                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Função / Tipo de Acesso</label>
                                    <select
                                        value={role}
                                        onChange={e => setRole(e.target.value as any)}
                                        className="w-full px-3 py-2 border rounded dark:bg-gray-700 dark:border-gray-600 dark:text-white bg-white dark:bg-gray-700"
                                    >
                                        <option value="admin">Administrador (Acesso Total)</option>
                                        <option value="user">Usuário Comum (Sem Importação e Alteração de Datas/Horas)</option>
                                        <option value="operator">Operador / Executante (Apenas Visualização, Status e Obs)</option>
                                    </select>
                                </div>
                            </>
                        )}

                        <button 
                            type="submit" 
                            disabled={isLoading}
                            className="w-full bg-cyan-700 hover:bg-cyan-800 disabled:opacity-50 text-white font-bold py-2.5 px-4 rounded transition-colors flex items-center justify-center gap-2 shadow-sm"
                        >
                            {isLoading ? (
                                <>
                                    <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                                    <span>Verificando credenciais no Neon...</span>
                                </>
                            ) : (
                                <span>{viewMode === 'login' ? 'Entrar no Sistema' : viewMode === 'register' ? 'Cadastrar e Salvar' : viewMode === 'recover' ? 'Redefinir Senha' : 'Recuperar'}</span>
                            )}
                        </button>
                    </form>

                    {/* Quick fill helper for login */}
                    {viewMode === 'login' && (
                        <div className="pt-2 border-t border-gray-100 dark:border-gray-700">
                            <p className="text-xs text-gray-500 dark:text-gray-400 mb-2">Acesso rápido (Neon DB):</p>
                            <div className="flex flex-wrap gap-1.5">
                                <button
                                    type="button"
                                    onClick={() => handleQuickFill('admin', '123')}
                                    className="px-2 py-1 text-xs rounded bg-gray-100 hover:bg-gray-200 dark:bg-gray-700 dark:hover:bg-gray-600 text-gray-700 dark:text-gray-300 font-mono transition-colors"
                                >
                                    admin / 123 (Admin)
                                </button>
                                <button
                                    type="button"
                                    onClick={() => handleQuickFill('jhony', '123')}
                                    className="px-2 py-1 text-xs rounded bg-gray-100 hover:bg-gray-200 dark:bg-gray-700 dark:hover:bg-gray-600 text-gray-700 dark:text-gray-300 font-mono transition-colors"
                                >
                                    jhony / 123 (Admin)
                                </button>
                                <button
                                    type="button"
                                    onClick={() => handleQuickFill('anderson', '123')}
                                    className="px-2 py-1 text-xs rounded bg-gray-100 hover:bg-gray-200 dark:bg-gray-700 dark:hover:bg-gray-600 text-gray-700 dark:text-gray-300 font-mono transition-colors"
                                >
                                    anderson / 123
                                </button>
                            </div>
                        </div>
                    )}

                    <div className="flex flex-col items-center space-y-2 text-sm pt-2">
                        {viewMode === 'login' ? (
                            <>
                                <button type="button" onClick={() => handleModeChange('register')} className="text-cyan-700 dark:text-cyan-400 hover:underline font-medium">
                                    Criar nova conta
                                </button>
                                <div className="flex space-x-2">
                                    <button type="button" onClick={() => handleModeChange('recover')} className="text-gray-500 hover:text-gray-700 dark:text-gray-400 text-xs">
                                        Esqueci minha senha
                                    </button>
                                    <span className="text-gray-300">|</span>
                                    <button type="button" onClick={() => handleModeChange('recoverUsername')} className="text-gray-500 hover:text-gray-700 dark:text-gray-400 text-xs">
                                        Esqueci meu usuário
                                    </button>
                                </div>
                            </>
                        ) : (
                            <button type="button" onClick={() => handleModeChange('login')} className="text-cyan-700 dark:text-cyan-400 hover:underline font-medium">
                                Voltar para o Login
                            </button>
                        )}
                    </div>
                </div>
                <div className="p-3 text-center text-xs text-gray-400 border-t border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900/50">
                    &copy; 2025 Gerenciador de Atividades MP &bull; Neon PostgreSQL
                </div>
            </div>
        </div>
    );
};
