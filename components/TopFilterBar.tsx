
import React, { useRef } from 'react';
import { FilterType } from '../types';
import { Bars3Icon } from './icons/Bars3Icon';
import { SunIcon } from './icons/SunIcon';
import { MoonIcon } from './icons/MoonIcon';
import { DocumentArrowDownIcon } from './icons/DocumentArrowDownIcon';

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

    const handleImportClick = () => {
        fileInputRef.current?.click();
    };

    return (
        <header className="bg-white/95 dark:bg-gray-800/95 backdrop-blur-sm border-b border-gray-200 dark:border-gray-700 sticky top-0 z-30 px-4 py-3 shadow-sm">
            <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
                
                <div className="flex items-center gap-3 w-full lg:w-auto overflow-x-auto pb-2 lg:pb-0">
                    <button 
                        onClick={onToggleSidebar}
                        className="lg:hidden p-2 text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-md"
                    >
                        <Bars3Icon className="w-6 h-6" />
                    </button>

                    {/* Filters Group */}
                    <div className="flex items-center gap-2">
                         {/* ID MP */}
                        <div className="min-w-[100px]">
                            <select
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
                            <select
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
                            <select
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
                            <select
                                value={filters.responsavel}
                                onChange={(e) => setFilters({ ...filters, responsavel: e.target.value })}
                                className="w-full py-1.5 px-2 text-xs border rounded-md bg-gray-50 dark:bg-gray-700 border-gray-300 dark:border-gray-600 text-gray-800 dark:text-gray-200 focus:ring-primary-500"
                            >
                                <option value="all">Resp: Todos</option>
                                {responsaveis.filter(r => r !== 'all').map(r => <option key={r} value={r}>{r}</option>)}
                            </select>
                        </div>
                        
                         <label className="inline-flex items-center cursor-pointer ml-2 whitespace-nowrap">
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
                </div>

                <div className="flex items-center gap-2 justify-end">
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
            </div>
        </header>
    );
};
