
import React from 'react';
import { ViewType, User } from '../types';
import { ChartPieIcon } from './icons/ChartPieIcon';
import { ListBulletIcon } from './icons/ListBulletIcon';
import { ViewColumnsIcon } from './icons/ViewColumnsIcon';
import { ChartBarIcon } from './icons/ChartBarIcon';
import { DocumentTextIcon } from './icons/DocumentTextIcon';
import { ClockHistoryIcon } from './icons/ClockHistoryIcon';
import { CalculatorIcon } from './icons/CalculatorIcon';
import { ArrowRightOnRectangleIcon } from './icons/ArrowRightOnRectangleIcon';
import { UserIcon } from './icons/UserIcon';
import { CogIcon } from './icons/CogIcon';
import { CalendarIcon } from './icons/CalendarIcon';

interface SidebarProps {
    currentView: ViewType;
    setCurrentView: (view: ViewType) => void;
    user: User | null;
    onLogout: () => void;
    onOpenSettings: () => void;
    isMobileOpen: boolean;
    setIsMobileOpen: (isOpen: boolean) => void;
}

const NavItem: React.FC<{
    icon: React.ReactNode;
    label: string;
    isActive: boolean;
    onClick: () => void;
}> = ({ icon, label, isActive, onClick }) => (
    <button
        onClick={onClick}
        className={`w-full flex items-center space-x-3 px-4 py-3 text-sm font-medium transition-colors rounded-lg mb-1 ${
            isActive
                ? 'bg-primary-600 text-white shadow-md'
                : 'text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800 hover:text-gray-900 dark:hover:text-white'
        }`}
    >
        {icon}
        <span>{label}</span>
    </button>
);

export const Sidebar: React.FC<SidebarProps> = ({
    currentView,
    setCurrentView,
    user,
    onLogout,
    onOpenSettings,
    isMobileOpen,
    setIsMobileOpen
}) => {
    const handleNavClick = (view: ViewType) => {
        setCurrentView(view);
        setIsMobileOpen(false); // Close on mobile after selection
    };

    const sidebarClasses = `
        fixed inset-y-0 left-0 z-50 w-64 bg-white dark:bg-[#1e1e1e] text-gray-900 dark:text-white transform transition-transform duration-300 ease-in-out border-r border-gray-200 dark:border-gray-800
        ${isMobileOpen ? 'translate-x-0' : '-translate-x-full'} 
        lg:translate-x-0 lg:static lg:inset-0
    `;

    return (
        <>
            {/* Mobile Overlay */}
            {isMobileOpen && (
                <div 
                    className="fixed inset-0 bg-black/50 z-40 lg:hidden"
                    onClick={() => setIsMobileOpen(false)}
                ></div>
            )}

            <aside className={sidebarClasses}>
                <div className="flex flex-col h-full">
                    {/* Logo Area */}
                    <div className="h-20 flex items-center px-6 border-b border-gray-200 dark:border-gray-800 bg-white dark:bg-[#1e1e1e]">
                        <h1 className="text-xl font-bold text-gray-800 dark:text-white tracking-tight">
                            Gerenciador MP
                        </h1>
                    </div>

                    {/* Navigation */}
                    <nav className="flex-1 px-3 py-4 overflow-y-auto">
                        <p className="px-4 text-xs font-semibold text-gray-500 dark:text-gray-500 uppercase tracking-wider mb-2">Visualizações</p>
                        
                        <NavItem icon={<ChartPieIcon className="w-5 h-5" />} label="Dashboard" isActive={currentView === 'dashboard'} onClick={() => handleNavClick('dashboard')} />
                        <NavItem icon={<ViewColumnsIcon className="w-5 h-5" />} label="Quadro" isActive={currentView === 'board'} onClick={() => handleNavClick('board')} />
                        <NavItem icon={<ListBulletIcon className="w-5 h-5" />} label="Lista" isActive={currentView === 'list'} onClick={() => handleNavClick('list')} />
                        <NavItem icon={<CalendarIcon className="w-5 h-5" />} label="Calendário" isActive={currentView === 'calendar'} onClick={() => handleNavClick('calendar')} />
                        <NavItem icon={<ChartBarIcon className="w-5 h-5" />} label="Gantt" isActive={currentView === 'gantt'} onClick={() => handleNavClick('gantt')} />
                        
                        <p className="px-4 text-xs font-semibold text-gray-500 dark:text-gray-500 uppercase tracking-wider mb-2 mt-6">Relatórios</p>
                        
                        <NavItem icon={<DocumentTextIcon className="w-5 h-5" />} label="Relatório Geral" isActive={currentView === 'report'} onClick={() => handleNavClick('report')} />
                        <NavItem icon={<CalculatorIcon className="w-5 h-5" />} label="Homem x Hora" isActive={currentView === 'manpower'} onClick={() => handleNavClick('manpower')} />
                        <NavItem icon={<ClockHistoryIcon className="w-5 h-5" />} label="Histórico de Ações" isActive={currentView === 'audit'} onClick={() => handleNavClick('audit')} />
                    </nav>

                    {/* User Footer */}
                    <div className="p-4 border-t border-gray-200 dark:border-gray-800 bg-gray-50 dark:bg-[#1e1e1e]">
                        {user && (
                            <div className="flex items-center justify-between">
                                <div className="flex items-center space-x-3 min-w-0">
                                    <div className="w-10 h-10 rounded-full bg-gray-200 dark:bg-gray-700 border-2 border-gray-300 dark:border-gray-600 overflow-hidden flex-shrink-0">
                                        {user.profilePicture ? (
                                            <img src={user.profilePicture} alt={user.name} className="w-full h-full object-cover" />
                                        ) : (
                                            <div className="w-full h-full flex items-center justify-center text-gray-400">
                                                <UserIcon className="w-5 h-5" />
                                            </div>
                                        )}
                                    </div>
                                    <div className="min-w-0">
                                        <p className="text-sm font-medium truncate text-gray-900 dark:text-gray-200">{user.name}</p>
                                        <p className="text-xs text-gray-500 dark:text-gray-400 truncate capitalize">{user.role}</p>
                                    </div>
                                </div>
                                
                                <div className="flex flex-col space-y-1">
                                    <button 
                                        onClick={onOpenSettings}
                                        className="p-1.5 text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white hover:bg-gray-200 dark:hover:bg-gray-700 rounded-md transition-colors"
                                        title="Configurações"
                                    >
                                        <CogIcon className="w-5 h-5" />
                                    </button>
                                    <button 
                                        onClick={onLogout}
                                        className="p-1.5 text-gray-500 dark:text-gray-400 hover:text-red-500 dark:hover:text-red-400 hover:bg-gray-200 dark:hover:bg-gray-700 rounded-md transition-colors"
                                        title="Sair"
                                    >
                                        <ArrowRightOnRectangleIcon className="w-5 h-5" />
                                    </button>
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            </aside>
        </>
    );
};
