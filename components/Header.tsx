
import React, { useRef, useState } from 'react';
import type { ViewType, FilterType, User } from '../types';
import { SunIcon } from './icons/SunIcon';
import { MoonIcon } from './icons/MoonIcon';
import { ChartBarIcon } from './icons/ChartBarIcon';
import { ListBulletIcon } from './icons/ListBulletIcon';
import { ViewColumnsIcon } from './icons/ViewColumnsIcon';
import { ChartPieIcon } from './icons/ChartPieIcon';
import { DocumentArrowDownIcon } from './icons/DocumentArrowDownIcon';
import { DocumentTextIcon } from './icons/DocumentTextIcon';
import { ClockHistoryIcon } from './icons/ClockHistoryIcon';
import { ArrowRightOnRectangleIcon } from './icons/ArrowRightOnRectangleIcon';
import { CogIcon } from './icons/CogIcon';
import { UserIcon } from './icons/UserIcon';
import { CalculatorIcon } from './icons/CalculatorIcon';
import { CalendarIcon } from './icons/CalendarIcon';
import { FunnelIcon } from './icons/FunnelIcon';
import { ChevronUpIcon } from './icons/ChevronUpIcon';

interface HeaderProps {
    theme: 'light' | 'dark';
    toggleTheme: () => void;
    currentView: ViewType;
    setCurrentView: (view: ViewType) => void;
    filters: FilterType;
    setFilters: (filters: FilterType) => void;
    turnos: string[];
    responsaveis: string[];
    supervisores: string[];
    idMps: string[];
    onImport: (event: React.ChangeEvent<HTMLInputElement>) => void;
    user: User | null;
    onLogout: () => void;
    onOpenSettings: () => void;
    isOnline?: boolean;
    systemLogos?: { light?: string; dark?: string };
}

const NavButton: React.FC<{
    icon: React.ReactNode;
    label: string;
    isActive: boolean;
    onClick: () => void;
}> = ({ icon, label, isActive, onClick }) => (
    <button
        onClick={onClick}
        className={`flex items-center space-x-1.5 px-2.5 py-1.5 rounded-md text-xs font-medium transition-colors ${
            isActive
                ? 'bg-primary-600 text-white shadow-sm'
                : 'text-gray-700 dark:text-gray-200 hover:bg-gray-200 dark:hover:bg-gray-700'
        }`}
    >
        {icon}
        <span className="hidden lg:inline">{label}</span>
    </button>
);

export const Header: React.FC<HeaderProps> = ({
    theme,
    toggleTheme,
    currentView,
    setCurrentView,
    filters,
    setFilters,
    turnos,
    responsaveis,
    supervisores,
    idMps,
    onImport,
    user,
    onLogout,
    onOpenSettings,
    isOnline = true,
    systemLogos
}) => {
    const fileInputRef = useRef<HTMLInputElement>(null);
    const [showFilters, setShowFilters] = useState(false);

    const handleImportClick = () => {
        fileInputRef.current?.click();
    };

    return (
        <header className="bg-white/95 dark:bg-gray-800/95 backdrop-blur-md shadow-sm px-4 py-2 sticky top-0 z-50 print:hidden transition-colors duration-300 border-b border-gray-200 dark:border-gray-700">
            <div className="container mx-auto">
                <input
                    type="file"
                    ref={fileInputRef}
                    onChange={onImport}
                    accept=".xlsx, .xls, .csv"
                    className="hidden"
                />

                <div className="flex flex-col xl:flex-row justify-between items-center space-y-2 xl:space-y-0 mb-2">
                    <div className="flex items-center justify-between w-full xl:w-auto">
                        <div className="flex items-center space-x-3">
                            {/* Logo Section */}
                            <div className="flex-shrink-0">
                                {theme === 'light' && systemLogos?.light ? (
                                    <img src={systemLogos.light} alt="Logo" className="h-6 w-auto object-contain" />
                                ) : theme === 'dark' && systemLogos?.dark ? (
                                    <img src={systemLogos.dark} alt="Logo" className="h-6 w-auto object-contain" />
                                ) : (
                                    <div className="h-6 w-6 bg-primary-600 rounded-md flex items-center justify-center text-white font-bold text-[10px]">
                                        MP
                                    </div>
                                )}
                            </div>
                            
                            <div className="h-6 w-px bg-gray-300 dark:bg-gray-600 mx-1"></div>

                            <div className="flex items-center space-x-2">
                                <h1 className="text-lg font-bold text-gray-800 dark:text-white tracking-tight hidden sm:block">
                                    Gerenciador MP
                                </h1>
                                <div 
                                    title={isOnline ? "Banco de Dados Conectado" : "Modo Offline (Local)"}
                                    className={`w-2 h-2 rounded-full ${isOnline ? 'bg-green-500 shadow-[0_0_5px_rgba(34,197,94,0.6)]' : 'bg-red-500 shadow-[0_0_5px_rgba(239,68,68,0.6)]'}`}
                                ></div>
                            </div>
                        </div>

                        {/* Mobile Actions Group */}
                        <div className="flex items-center gap-1 xl:hidden">
                             <button
                                onClick={handleImportClick}
                                className="p-1 rounded-md bg-green-600 text-white shadow-sm"
                                title="Importar"
                            >
                               <DocumentArrowDownIcon className="w-4 h-4" />
                            </button>
                            
                            <button 
                                onClick={onOpenSettings} 
                                className="p-1 rounded-full hover:bg-gray-200 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-200"
                                title="Configurações"
                            >
                                <CogIcon className="w-5 h-5" />
                            </button>

                             <button onClick={toggleTheme} className="p-1 rounded-full hover:bg-gray-200 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-200">
                                {theme === 'light' ? <MoonIcon className="w-5 h-5" /> : <SunIcon className="w-5 h-5" />}
                            </button>
                            
                            <button 
                                onClick={() => setShowFilters(!showFilters)}
                                className={`p-1 rounded-md transition-colors ml-1 ${showFilters ? 'bg-primary-100 text-primary-600 dark:bg-primary-900/30 dark:text-primary-400' : 'text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700'}`}
                                title="Filtrar"
                            >
                                <FunnelIcon className="w-5 h-5" />
                            </button>
                        </div>
                    </div>

                    <nav className="flex items-center space-x-1 p-0.5 bg-gray-100 dark:bg-gray-900 rounded-lg overflow-x-auto max-w-full no-scrollbar w-full xl:w-auto">
                        <NavButton icon={<ChartPieIcon className="w-4 h-4" />} label="Dashboard" isActive={currentView === 'dashboard'} onClick={() => setCurrentView('dashboard')} />
                        <NavButton icon={<ListBulletIcon className="w-4 h-4" />} label="Lista" isActive={currentView === 'list'} onClick={() => setCurrentView('list')} />
                        <NavButton icon={<ViewColumnsIcon className="w-4 h-4" />} label="Quadro" isActive={currentView === 'board'} onClick={() => setCurrentView('board')} />
                        <NavButton icon={<CalendarIcon className="w-4 h-4" />} label="Calendário" isActive={currentView === 'calendar'} onClick={() => setCurrentView('calendar')} />
                        <NavButton icon={<ChartBarIcon className="w-4 h-4" />} label="Gantt" isActive={currentView === 'gantt'} onClick={() => setCurrentView('gantt')} />
                        <NavButton icon={<DocumentTextIcon className="w-4 h-4" />} label="Relatório" isActive={currentView === 'report'} onClick={() => setCurrentView('report')} />
                        <NavButton icon={<CalculatorIcon className="w-4 h-4" />} label="H x H" isActive={currentView === 'manpower'} onClick={() => setCurrentView('manpower')} />
                        <NavButton icon={<ClockHistoryIcon className="w-4 h-4" />} label="Histórico" isActive={currentView === 'audit'} onClick={() => setCurrentView('audit')} />
                    </nav>
                    
                    {/* Desktop Actions */}
                    <div className="hidden xl:flex items-center space-x-2 justify-end w-full xl:w-auto">
                        <button
                            onClick={handleImportClick}
                            className="flex items-center space-x-1 px-2.5 py-1.5 rounded-md text-xs font-medium bg-green-600 hover:bg-green-700 text-white transition-colors shadow-sm"
                            title="Importar Excel"
                        >
                           <DocumentArrowDownIcon className="w-4 h-4" />
                           <span className="hidden sm:inline">Importar</span>
                        </button>
                        
                        <button 
                            onClick={onOpenSettings} 
                            className="p-1.5 rounded-full hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors text-gray-700 dark:text-gray-200"
                            title="Configurações"
                        >
                            <CogIcon className="w-5 h-5" />
                        </button>

                         <button onClick={toggleTheme} className="p-1.5 rounded-full hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors text-gray-700 dark:text-gray-200">
                            {theme === 'light' ? <MoonIcon className="w-5 h-5" /> : <SunIcon className="w-5 h-5" />}
                        </button>
                        
                        {user && (
                            <div className="flex items-center border-l border-gray-300 dark:border-gray-600 pl-2 ml-2 space-x-2">
                                <div className="flex items-center space-x-2">
                                    <div className="w-8 h-8 rounded-full overflow-hidden border border-gray-200 dark:border-gray-600 bg-gray-100 dark:bg-gray-700 flex-shrink-0">
                                        {user.profilePicture ? (
                                            <img src={user.profilePicture} alt={user.name} className="w-full h-full object-cover" />
                                        ) : (
                                            <div className="w-full h-full flex items-center justify-center text-gray-400">
                                                <UserIcon className="w-4 h-4" />
                                            </div>
                                        )}
                                    </div>
                                    <div className="flex flex-col items-start hidden md:flex">
                                        <span className="text-xs font-bold text-gray-800 dark:text-white max-w-[80px] truncate">{user.name}</span>
                                    </div>
                                </div>
                                <button 
                                    onClick={onLogout} 
                                    className="p-1.5 rounded-full text-red-500 hover:bg-red-100 dark:hover:bg-red-900/20 transition-colors"
                                    title="Sair"
                                >
                                    <ArrowRightOnRectangleIcon className="w-5 h-5" />
                                </button>
                            </div>
                        )}
                    </div>
                </div>

                <div className={`${showFilters ? 'block' : 'hidden'} lg:block mt-2 bg-gray-50/90 dark:bg-gray-700/60 p-2 rounded-lg backdrop-blur-sm border border-gray-200 dark:border-gray-600 transition-all duration-300`}>
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-2 items-end">
                        <div className="flex flex-col">
                            <label htmlFor="id-mp-filter" className="text-[10px] font-bold text-gray-600 dark:text-gray-300 mb-0.5">ID MP</label>
                            <select
                                id="id-mp-filter"
                                value={filters.idMp}
                                onChange={(e) => setFilters({ ...filters, idMp: e.target.value })}
                                className="w-full py-1 px-2 text-xs border rounded bg-white dark:bg-gray-700 border-gray-300 dark:border-gray-600 text-gray-900 dark:text-white focus:ring-primary-500"
                            >
                                <option value="">Todos</option>
                                {idMps.map(id => <option key={id} value={id}>{id}</option>)}
                            </select>
                        </div>
                        <div className="flex flex-col">
                            <label htmlFor="turno-filter" className="text-[10px] font-bold text-gray-600 dark:text-gray-300 mb-0.5">Turno</label>
                            <select
                                id="turno-filter"
                                value={filters.turno}
                                onChange={(e) => setFilters({ ...filters, turno: e.target.value })}
                                className="w-full py-1 px-2 text-xs border rounded bg-white dark:bg-gray-700 border-gray-300 dark:border-gray-600 text-gray-900 dark:text-white focus:ring-primary-500"
                            >
                                {turnos.map(t => <option key={t} value={t}>{t === 'all' ? 'Todos' : `Turno ${t}`}</option>)}
                            </select>
                        </div>
                         <div className="flex flex-col">
                            <label htmlFor="supervisor-filter" className="text-[10px] font-bold text-gray-600 dark:text-gray-300 mb-0.5">Supervisor</label>
                            <select
                                id="supervisor-filter"
                                value={filters.supervisor || 'all'}
                                onChange={(e) => setFilters({ ...filters, supervisor: e.target.value })}
                                className="w-full py-1 px-2 text-xs border rounded bg-white dark:bg-gray-700 border-gray-300 dark:border-gray-600 text-gray-900 dark:text-white focus:ring-primary-500"
                            >
                                {supervisores.map(s => <option key={s} value={s}>{s === 'all' ? 'Todos' : s}</option>)}
                            </select>
                        </div>
                        <div className="flex flex-col">
                            <label htmlFor="responsavel-filter" className="text-[10px] font-bold text-gray-600 dark:text-gray-300 mb-0.5">Responsável</label>
                            <select
                                id="responsavel-filter"
                                value={filters.responsavel}
                                onChange={(e) => setFilters({ ...filters, responsavel: e.target.value })}
                                className="w-full py-1 px-2 text-xs border rounded bg-white dark:bg-gray-700 border-gray-300 dark:border-gray-600 text-gray-900 dark:text-white focus:ring-primary-500"
                            >
                                {responsaveis.map(r => <option key={r} value={r}>{r === 'all' ? 'Todos' : r}</option>)}
                            </select>
                        </div>
                        
                        <div className="flex items-center pb-1">
                             <label className="inline-flex items-center cursor-pointer">
                                <input 
                                    type="checkbox" 
                                    className="sr-only peer"
                                    checked={filters.onlyMyActivities}
                                    onChange={(e) => setFilters({...filters, onlyMyActivities: e.target.checked})}
                                    disabled={!user}
                                />
                                <div className="relative w-9 h-5 bg-gray-200 peer-focus:outline-none peer-focus:ring-2 peer-focus:ring-primary-300 dark:peer-focus:ring-primary-800 rounded-full peer dark:bg-gray-600 peer-checked:after:translate-x-full rtl:peer-checked:after:-translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:start-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all dark:border-gray-600 peer-checked:bg-primary-600"></div>
                                <span className="ms-2 text-xs font-bold text-gray-700 dark:text-gray-200">Minhas Atividades</span>
                            </label>
                        </div>
                    </div>

                    <button 
                        onClick={() => setShowFilters(false)}
                        className="lg:hidden w-full flex justify-center items-center p-1 mt-2 text-gray-500 dark:text-gray-400 bg-white/50 dark:bg-gray-800/50 hover:bg-white dark:hover:bg-gray-800 rounded-md transition-colors border border-gray-200 dark:border-gray-600"
                    >
                        <ChevronUpIcon className="w-3 h-3" />
                        <span className="text-[10px] font-medium ml-1">Minimizar</span>
                    </button>
                </div>
            </div>
        </header>
    );
};
