
import React, { useRef, useState } from 'react';
import { FilterType } from '../types';
import { Bars3Icon } from './icons/Bars3Icon';
import { SunIcon } from './icons/SunIcon';
import { MoonIcon } from './icons/MoonIcon';
import { DocumentArrowDownIcon } from './icons/DocumentArrowDownIcon';
import { FunnelIcon } from './icons/FunnelIcon';
import { ChevronUpIcon } from './icons/ChevronUpIcon';

interface TopFilterBarProps {
    theme: 'light' | 'dark';
    toggleTheme: () => void;
    filters: FilterType;
    setFilters: (filters: FilterType) => void;
    turnos: string[];
    responsaveis: string[];
    supervisores: string[];
    idMps: string[];
    onImport: (event: React.ChangeEvent<HTMLInputElement>) => void;
    onToggleSidebar: () => void;
    isUserLoggedIn: boolean;
}

export const TopFilterBar: React.FC<TopFilterBarProps> = ({
    theme,
    toggleTheme,
    filters,
    setFilters,
    turnos,
    responsaveis,
    supervisores,
    idMps,
    onImport,
    onToggleSidebar,
    isUserLoggedIn
}) => {
    const fileInputRef = useRef<HTMLInputElement>(null);
    const [showFilters, setShowFilters] = useState(false);

    const handleImportClick = () => {
        fileInputRef.current?.click();
    };

    return (
        <header className="bg-white/95 dark:bg-gray-800/95 backdrop-blur-sm border-b border-gray-200 dark:border-gray-700 sticky top-0 z-30 px-4 py-3 shadow-sm transition-all">
            <div className="flex flex-wrap items-start lg:items-center justify-between gap-y-3">
                
                {/* Left Group: Sidebar Toggle & Filter Toggle (Mobile) */}
                <div className="flex items-center gap-2">
                    <button 
                        onClick={onToggleSidebar}
                        className="lg:hidden p-2 text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-md"
                    >
                        <Bars3Icon className="w-6 h-6" />
                    </button>

                    <button 
                        onClick={() => setShowFilters(!showFilters)}
                        className={`lg:hidden p-2 rounded-md transition-colors ${showFilters ? 'bg-primary-100 text-primary-600 dark:bg-primary-900/30 dark:text-primary-400' : 'text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700'}`}
                        title="Filtrar"
                    >
                        <FunnelIcon className="w-6 h-6" />
                    </button>
                </div>

                {/* Right Group: Actions (Always Visible) */}
                <div className="flex items-center gap-2 order-2 lg:order-3 ml-auto lg:ml-0">
                     <input
                        type="file"
                        ref={fileInputRef}
                        onChange={onImport}
                        accept=".xlsx, .xls, .csv"
                        className="hidden"
                    />
                    <button
                        onClick={handleImportClick}
                        className="flex items-center space-x-1 px-3 py-1.5 rounded-md text-xs font-medium bg-green-600 hover:bg-green-700 text-white transition-colors shadow-sm"
                        title="Importar Excel"
                    >
                       <DocumentArrowDownIcon className="w-4 h-4" />
                       <span className="hidden sm:inline">Importar</span>
                    </button>

                    <button 
                        onClick={toggleTheme} 
                        className="p-1.5 rounded-md text-gray-500 hover:bg-gray-100 dark:text-gray-400 dark:hover:bg-gray-700 transition-colors"
                    >
                        {theme === 'light' ? <MoonIcon className="w-5 h-5" /> : <SunIcon className="w-5 h-5" />}
                    </button>
                </div>

                {/* Filters Group: Collapsible on Mobile, Visible on Desktop */}
                <div className={`${showFilters ? 'flex' : 'hidden'} lg:flex flex-col lg:flex-row items-start lg:items-center gap-3 w-full lg:w-auto order-3 lg:order-2 mt-2 lg:mt-0 border-t lg:border-0 border-gray-200 dark:border-gray-700 pt-3 lg:pt-0 transition-all`}>
                    
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:flex lg:items-center gap-2 w-full">
                         {/* ID MP */}
                        <div className="min-w-[100px]">
                            <label htmlFor="id-mp-filter" className="lg:hidden text-xs font-bold text-gray-500 dark:text-gray-400 mb-1 block">ID MP</label>
                            <select
                                id="id-mp-filter"
                                value={filters.idMp}
                                onChange={(e) => setFilters({ ...filters, idMp: e.target.value })}
                                className="w-full py-1.5 px-2 text-xs border rounded-md bg-gray-50 dark:bg-gray-700 border-gray-300 dark:border-gray-600 text-gray-800 dark:text-gray-200 focus:ring-primary-500"
                            >
                                <option value="">MP: Todas</option>
                                {idMps.map(id => <option key={id} value={id}>{id}</option>)}
                            </select>
                        </div>

                        {/* Turno */}
                        <div className="min-w-[100px]">
                            <label htmlFor="turno-filter" className="lg:hidden text-xs font-bold text-gray-500 dark:text-gray-400 mb-1 block">Turno</label>
                            <select
                                id="turno-filter"
                                value={filters.turno}
                                onChange={(e) => setFilters({ ...filters, turno: e.target.value })}
                                className="w-full py-1.5 px-2 text-xs border rounded-md bg-gray-50 dark:bg-gray-700 border-gray-300 dark:border-gray-600 text-gray-800 dark:text-gray-200 focus:ring-primary-500"
                            >
                                <option value="all">Turno: Todos</option>
                                {turnos.filter(t => t !== 'all').map(t => <option key={t} value={t}>{t}</option>)}
                            </select>
                        </div>
                        
                        {/* Supervisor */}
                        <div className="min-w-[120px]">
                            <label htmlFor="supervisor-filter" className="lg:hidden text-xs font-bold text-gray-500 dark:text-gray-400 mb-1 block">Supervisor</label>
                            <select
                                id="supervisor-filter"
                                value={filters.supervisor || 'all'}
                                onChange={(e) => setFilters({ ...filters, supervisor: e.target.value })}
                                className="w-full py-1.5 px-2 text-xs border rounded-md bg-gray-50 dark:bg-gray-700 border-gray-300 dark:border-gray-600 text-gray-800 dark:text-gray-200 focus:ring-primary-500"
                            >
                                <option value="all">Sup: Todos</option>
                                {supervisores.filter(s => s !== 'all').map(s => <option key={s} value={s}>{s}</option>)}
                            </select>
                        </div>

                         {/* Responsável */}
                         <div className="min-w-[120px]">
                            <label htmlFor="responsavel-filter" className="lg:hidden text-xs font-bold text-gray-500 dark:text-gray-400 mb-1 block">Responsável</label>
                            <select
                                id="responsavel-filter"
                                value={filters.responsavel}
                                onChange={(e) => setFilters({ ...filters, responsavel: e.target.value })}
                                className="w-full py-1.5 px-2 text-xs border rounded-md bg-gray-50 dark:bg-gray-700 border-gray-300 dark:border-gray-600 text-gray-800 dark:text-gray-200 focus:ring-primary-500"
                            >
                                <option value="all">Resp: Todos</option>
                                {responsaveis.filter(r => r !== 'all').map(r => <option key={r} value={r}>{r}</option>)}
                            </select>
                        </div>
                        
                         <label className="inline-flex items-center cursor-pointer ml-1 whitespace-nowrap mt-2 lg:mt-0">
                            <input 
                                type="checkbox" 
                                className="sr-only peer"
                                checked={filters.onlyMyActivities}
                                onChange={(e) => setFilters({...filters, onlyMyActivities: e.target.checked})}
                                disabled={!isUserLoggedIn}
                            />
                            <div className="relative w-9 h-5 bg-gray-300 peer-focus:outline-none rounded-full peer dark:bg-gray-600 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:start-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all dark:border-gray-600 peer-checked:bg-primary-600"></div>
                            <span className="ms-2 text-xs font-medium text-gray-700 dark:text-gray-300">Eu</span>
                        </label>
                    </div>

                    {/* Minimize Button for Mobile */}
                    <button 
                        onClick={() => setShowFilters(false)}
                        className="lg:hidden w-full flex justify-center items-center p-2 mt-2 text-gray-500 dark:text-gray-400 bg-gray-50 dark:bg-gray-700/50 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-md transition-colors"
                    >
                        <ChevronUpIcon className="w-4 h-4" />
                        <span className="text-xs font-medium ml-1">Minimizar Filtros</span>
                    </button>
                </div>
            </div>
        </header>
    );
};
