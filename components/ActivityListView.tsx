
import React, { useState, useMemo, useRef, useEffect } from 'react';
import { type Activity, ActivityStatus } from '../types';
import { PencilIcon } from './icons/PencilIcon';
import { PaperClipIcon } from './icons/PaperClipIcon';
import { CameraIcon } from './icons/CameraIcon';
import { ArrowsUpDownIcon } from './icons/ArrowsUpDownIcon';
import { TrashIcon } from './icons/TrashIcon';
import { ViewColumnsIcon } from './icons/ViewColumnsIcon';
import { XMarkIcon } from './icons/XMarkIcon';
import { SearchIcon } from './icons/SearchIcon';
import { getStatusClasses, getCriticidadeClasses, getStatusLabel } from '../utils/styleUtils';

interface ActivityListViewProps {
    activities: Activity[];
    onEdit: (activity: Activity) => void;
    onUpdateStatus: (activityId: string, status: ActivityStatus) => void;
    onDelete?: (activityId: string) => void;
    customStatusLabels?: Record<string, string>;
}

type SortDirection = 'asc' | 'desc';

interface SortConfig {
    key: keyof Activity | 'statusLabel' | null;
    direction: SortDirection;
}

export interface ColumnDefinition {
    id: string;
    label: string;
    description: string;
    category: 'identificacao' | 'equipe' | 'planejamento' | 'execucao' | 'sistema';
    defaultWidth: number;
    sortKey?: keyof Activity | 'statusLabel';
    defaultVisible: boolean;
    align?: 'left' | 'center' | 'right';
    isSystem?: boolean;
}

export const ALL_COLUMNS: ColumnDefinition[] = [
    // Identificação
    { id: 'idMp', label: 'ID MP', description: 'Código ou Ordem de Manutenção', category: 'identificacao', defaultWidth: 90, sortKey: 'idMp', defaultVisible: true },
    { id: 'tag', label: 'TAG', description: 'Identificação do equipamento', category: 'identificacao', defaultWidth: 90, sortKey: 'tag', defaultVisible: true },
    { id: 'descricao', label: 'Descrição', description: 'Descrição da tarefa', category: 'identificacao', defaultWidth: 260, sortKey: 'descricao', defaultVisible: true },
    { id: 'area', label: 'Área', description: 'Área ou setor da planta', category: 'identificacao', defaultWidth: 100, sortKey: 'area', defaultVisible: true },
    { id: 'empresa', label: 'Empresa', description: 'Empresa executante', category: 'identificacao', defaultWidth: 100, sortKey: 'empresa', defaultVisible: true },
    
    // Equipe
    { id: 'responsavel', label: 'Responsável', description: 'Executor da atividade', category: 'equipe', defaultWidth: 130, sortKey: 'responsavel', defaultVisible: true },
    { id: 'supervisor', label: 'Supervisor', description: 'Supervisor responsável', category: 'equipe', defaultWidth: 130, sortKey: 'supervisor', defaultVisible: true },
    { id: 'turno', label: 'Turno', description: 'Turno de trabalho', category: 'equipe', defaultWidth: 70, sortKey: 'turno', defaultVisible: true, align: 'center' },
    
    // Planejamento
    { id: 'data', label: 'Data', description: 'Data planejada de início', category: 'planejamento', defaultWidth: 90, sortKey: 'horaInicio', defaultVisible: true, align: 'center' },
    { id: 'horario', label: 'Horário Plan.', description: 'Horário planejado (Início - Fim)', category: 'planejamento', defaultWidth: 110, sortKey: 'horaInicio', defaultVisible: true },
    { id: 'duracao', label: 'Duração', description: 'Duração estimada da atividade', category: 'planejamento', defaultWidth: 70, sortKey: 'duracao', defaultVisible: true, align: 'center' },
    { id: 'criticidade', label: 'Criticidade', description: 'Nível de criticidade ou prioridade', category: 'planejamento', defaultWidth: 90, sortKey: 'criticidade', defaultVisible: true },
    
    // Execução & Progresso
    { id: 'progresso', label: '% Avanço', description: 'Progresso físico executado (0-100%)', category: 'execucao', defaultWidth: 100, sortKey: 'progresso', defaultVisible: true },
    { id: 'status', label: 'Status', description: 'Status atual da atividade', category: 'execucao', defaultWidth: 130, sortKey: 'statusLabel', defaultVisible: true },
    { id: 'horaInicioReal', label: 'Início Real', description: 'Data/Hora real de início', category: 'execucao', defaultWidth: 100, sortKey: 'horaInicioReal', defaultVisible: false },
    { id: 'horaFimReal', label: 'Fim Real', description: 'Data/Hora real de término', category: 'execucao', defaultWidth: 100, sortKey: 'horaFimReal', defaultVisible: false },
    { id: 'observacoes', label: 'Observações', description: 'Anotações adicionais', category: 'execucao', defaultWidth: 150, sortKey: 'observacoes', defaultVisible: false },

    // Sistema
    { id: 'anexos', label: 'Anexos', description: 'Imagens e arquivos vinculados', category: 'sistema', defaultWidth: 60, defaultVisible: true, align: 'center', isSystem: true },
    { id: 'acoes', label: 'Ações', description: 'Editar e excluir atividade', category: 'sistema', defaultWidth: 70, defaultVisible: true, align: 'center', isSystem: true }
];

const CATEGORY_LABELS: Record<string, string> = {
    identificacao: 'Identificação & Local',
    equipe: 'Equipe & Turno',
    planejamento: 'Planejamento',
    execucao: 'Execução & Progresso',
    sistema: 'Mídia & Ações'
};

const STORAGE_KEY = 'fospar_visible_columns_v2';
const WIDTHS_STORAGE_KEY = 'fospar_column_widths_v2';

export const ActivityListView: React.FC<ActivityListViewProps> = ({ activities, onEdit, onUpdateStatus, onDelete, customStatusLabels = {} }) => {
    // Sorting State
    const [sortConfig, setSortConfig] = useState<SortConfig>({ key: null, direction: 'asc' });
    
    // Column Visibility State
    const [visibleColumns, setVisibleColumns] = useState<Record<string, boolean>>(() => {
        try {
            const saved = localStorage.getItem(STORAGE_KEY);
            if (saved) {
                return JSON.parse(saved);
            }
        } catch (e) {
            console.error('Failed to load saved columns', e);
        }
        // Default visibility from column definition
        const defaults: Record<string, boolean> = {};
        ALL_COLUMNS.forEach(col => {
            defaults[col.id] = col.defaultVisible;
        });
        return defaults;
    });

    // Column Widths State
    const [columnWidths, setColumnWidths] = useState<Record<string, number>>(() => {
        try {
            const saved = localStorage.getItem(WIDTHS_STORAGE_KEY);
            if (saved) {
                return JSON.parse(saved);
            }
        } catch (e) {
            console.error('Failed to load column widths', e);
        }
        const defaults: Record<string, number> = {};
        ALL_COLUMNS.forEach(col => {
            defaults[col.id] = col.defaultWidth;
        });
        return defaults;
    });

    // Column Manager Popover State
    const [isColumnPickerOpen, setIsColumnPickerOpen] = useState(false);
    const [columnSearch, setColumnSearch] = useState('');
    const columnPickerRef = useRef<HTMLDivElement>(null);
    const columnButtonRef = useRef<HTMLButtonElement>(null);

    // Save column visibility changes
    const toggleColumn = (colId: string) => {
        setVisibleColumns(prev => {
            const next = { ...prev, [colId]: !prev[colId] };
            try {
                localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
            } catch (e) {
                console.error(e);
            }
            return next;
        });
    };

    const setAllColumns = (visible: boolean) => {
        const next: Record<string, boolean> = {};
        ALL_COLUMNS.forEach(col => {
            next[col.id] = visible;
        });
        setVisibleColumns(next);
        try {
            localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
        } catch (e) {
            console.error(e);
        }
    };

    const resetToDefaults = () => {
        const defaults: Record<string, boolean> = {};
        ALL_COLUMNS.forEach(col => {
            defaults[col.id] = col.defaultVisible;
        });
        setVisibleColumns(defaults);
        try {
            localStorage.setItem(STORAGE_KEY, JSON.stringify(defaults));
        } catch (e) {
            console.error(e);
        }
    };

    // Close column picker on outside click or Escape
    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (
                isColumnPickerOpen &&
                columnPickerRef.current &&
                !columnPickerRef.current.contains(event.target as Node) &&
                columnButtonRef.current &&
                !columnButtonRef.current.contains(event.target as Node)
            ) {
                setIsColumnPickerOpen(false);
            }
        };

        const handleKeyDown = (event: KeyboardEvent) => {
            if (event.key === 'Escape') {
                setIsColumnPickerOpen(false);
            }
        };

        document.addEventListener('mousedown', handleClickOutside);
        document.addEventListener('keydown', handleKeyDown);
        return () => {
            document.removeEventListener('mousedown', handleClickOutside);
            document.removeEventListener('keydown', handleKeyDown);
        };
    }, [isColumnPickerOpen]);
    
    const resizingRef = useRef<{ key: string; startX: number; startWidth: number } | null>(null);

    // Current time for conditional formatting
    const [now, setNow] = useState(new Date());

    useEffect(() => {
        const timer = setInterval(() => setNow(new Date()), 60000);
        return () => clearInterval(timer);
    }, []);

    const handleStatusChange = (activityId: string, newStatus: string) => {
        onUpdateStatus(activityId, newStatus as ActivityStatus);
    };

    const handleSort = (key: keyof Activity | 'statusLabel') => {
        setSortConfig(prev => ({
            key,
            direction: prev.key === key && prev.direction === 'asc' ? 'desc' : 'asc'
        }));
    };

    const sortedActivities = useMemo(() => {
        if (!sortConfig.key) return activities;

        return [...activities].sort((a, b) => {
            let aValue: any = sortConfig.key === 'statusLabel' 
                ? getStatusLabel(a.status, customStatusLabels) 
                : a[sortConfig.key as keyof Activity];
            
            let bValue: any = sortConfig.key === 'statusLabel'
                ? getStatusLabel(b.status, customStatusLabels)
                : b[sortConfig.key as keyof Activity];

            if (aValue === undefined || aValue === null) aValue = '';
            if (bValue === undefined || bValue === null) bValue = '';

            // Handle Date strings
            if (
                sortConfig.key === 'horaInicio' || 
                sortConfig.key === 'horaFim' || 
                sortConfig.key === 'horaInicioReal' || 
                sortConfig.key === 'horaFimReal'
            ) {
                const aTime = aValue ? new Date(aValue).getTime() : 0;
                const bTime = bValue ? new Date(bValue).getTime() : 0;
                return sortConfig.direction === 'asc' ? aTime - bTime : bTime - aTime;
            }

            // Handle Progresso
            if (sortConfig.key === 'progresso') {
                const aProg = a.status === ActivityStatus.Closed ? 100 : (a.progresso !== undefined ? Number(a.progresso) : 0);
                const bProg = b.status === ActivityStatus.Closed ? 100 : (b.progresso !== undefined ? Number(b.progresso) : 0);
                return sortConfig.direction === 'asc' ? aProg - bProg : bProg - aProg;
            }

            // Handle Strings
            if (typeof aValue === 'string' && typeof bValue === 'string') {
                return sortConfig.direction === 'asc'
                    ? aValue.localeCompare(bValue)
                    : bValue.localeCompare(aValue);
            }

            return 0;
        });
    }, [activities, sortConfig, customStatusLabels]);

    // Resizing Logic
    const handleMouseDown = (e: React.MouseEvent, key: string) => {
        e.preventDefault();
        resizingRef.current = {
            key,
            startX: e.pageX,
            startWidth: columnWidths[key] || 100
        };
        document.addEventListener('mousemove', handleMouseMove);
        document.addEventListener('mouseup', handleMouseUp);
    };

    const handleMouseMove = (e: MouseEvent) => {
        if (resizingRef.current) {
            const { key, startX, startWidth } = resizingRef.current;
            const diff = e.pageX - startX;
            const newWidth = Math.max(40, startWidth + diff); 
            setColumnWidths(prev => {
                const next = { ...prev, [key]: newWidth };
                try {
                    localStorage.setItem(WIDTHS_STORAGE_KEY, JSON.stringify(next));
                } catch (err) {
                    console.error(err);
                }
                return next;
            });
        }
    };

    const handleMouseUp = () => {
        resizingRef.current = null;
        document.removeEventListener('mousemove', handleMouseMove);
        document.removeEventListener('mouseup', handleMouseUp);
    };
    
    useEffect(() => {
        return () => {
            document.removeEventListener('mousemove', handleMouseMove);
            document.removeEventListener('mouseup', handleMouseUp);
        };
    }, []);

    const activeVisibleColumns = useMemo(() => {
        return ALL_COLUMNS.filter(col => visibleColumns[col.id]);
    }, [visibleColumns]);

    const totalVisibleCount = activeVisibleColumns.length;

    const filteredColumnDefs = useMemo(() => {
        if (!columnSearch.trim()) return ALL_COLUMNS;
        const q = columnSearch.toLowerCase();
        return ALL_COLUMNS.filter(c => 
            c.label.toLowerCase().includes(q) || 
            c.description.toLowerCase().includes(q) ||
            (CATEGORY_LABELS[c.category] && CATEGORY_LABELS[c.category].toLowerCase().includes(q))
        );
    }, [columnSearch]);

    const Th: React.FC<{ id: string; label: string; sortKey?: keyof Activity | 'statusLabel'; className?: string }> = ({ id, label, sortKey, className = '' }) => (
        <th 
            scope="col" 
            className={`relative px-3 py-2 select-none border-r border-gray-200/50 dark:border-gray-700/50 last:border-r-0 group whitespace-nowrap ${className}`}
            style={{ width: columnWidths[id] || 100 }}
        >
            <div 
                className={`flex items-center space-x-1 ${sortKey ? 'cursor-pointer hover:text-primary-600' : ''}`}
                onClick={() => sortKey && handleSort(sortKey)}
            >
                <span className="truncate">{label}</span>
                {sortKey && (
                    <span className={`transition-opacity ${sortConfig.key === sortKey ? 'opacity-100 text-primary-600' : 'opacity-30 group-hover:opacity-70'}`}>
                         <ArrowsUpDownIcon className="w-3 h-3" />
                    </span>
                )}
            </div>
            <div 
                className="absolute right-0 top-0 bottom-0 w-1 cursor-col-resize hover:bg-blue-500 z-10"
                onMouseDown={(e) => handleMouseDown(e, id)}
            ></div>
        </th>
    );

    if (activities.length === 0) {
        return <div className="text-center p-8 bg-white/70 dark:bg-gray-800/70 backdrop-blur-md rounded-lg shadow">Nenhuma atividade encontrada.</div>;
    }

    return (
        <div className="space-y-2">
            {/* Action & Column Visibility Control Bar */}
            <div className="flex flex-wrap items-center justify-between gap-2 px-1 print:hidden">
                <div className="text-xs text-gray-500 dark:text-gray-400 font-medium">
                    Exibindo <span className="font-bold text-gray-700 dark:text-gray-200">{sortedActivities.length}</span> atividade(s) • <span className="font-bold text-primary-600 dark:text-primary-400">{totalVisibleCount}</span> coluna(s) ativa(s)
                </div>

                <div className="relative">
                    <button
                        ref={columnButtonRef}
                        type="button"
                        onClick={() => setIsColumnPickerOpen(prev => !prev)}
                        className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold border transition-all shadow-sm ${
                            isColumnPickerOpen
                                ? 'bg-primary-50 border-primary-400 text-primary-700 dark:bg-primary-950/60 dark:border-primary-600 dark:text-primary-300 ring-2 ring-primary-500/20'
                                : 'bg-white/80 dark:bg-gray-800/80 border-gray-300 dark:border-gray-700 text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-700'
                        }`}
                        title="Configurar quais colunas exibir ou ocultar na tabela"
                    >
                        <ViewColumnsIcon className="w-4 h-4 text-primary-600 dark:text-primary-400" />
                        <span>Colunas ({totalVisibleCount}/{ALL_COLUMNS.length})</span>
                    </button>

                    {/* Column Manager Dropdown Popover */}
                    {isColumnPickerOpen && (
                        <div
                            ref={columnPickerRef}
                            className="absolute right-0 top-full mt-2 w-80 max-h-[500px] flex flex-col bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl shadow-2xl z-50 overflow-hidden animate-in fade-in zoom-in-95 duration-150"
                        >
                            {/* Popover Header */}
                            <div className="p-3 border-b border-gray-200 dark:border-gray-700 bg-gray-50/70 dark:bg-gray-900/50 flex items-center justify-between">
                                <div>
                                    <h4 className="text-xs font-bold text-gray-900 dark:text-white flex items-center gap-1.5">
                                        <ViewColumnsIcon className="w-3.5 h-3.5 text-primary-600 dark:text-primary-400" />
                                        Exibir / Ocultar Colunas
                                    </h4>
                                    <p className="text-[10px] text-gray-500 dark:text-gray-400">
                                        Personalize a visualização da tabela
                                    </p>
                                </div>
                                <button
                                    onClick={() => setIsColumnPickerOpen(false)}
                                    className="p-1 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 rounded-md hover:bg-gray-200/50 dark:hover:bg-gray-700"
                                >
                                    <XMarkIcon className="w-4 h-4" />
                                </button>
                            </div>

                            {/* Search filter */}
                            <div className="p-2 border-b border-gray-100 dark:border-gray-700/60 bg-white dark:bg-gray-800">
                                <div className="relative">
                                    <SearchIcon className="w-3.5 h-3.5 text-gray-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
                                    <input
                                        type="text"
                                        placeholder="Filtrar colunas..."
                                        value={columnSearch}
                                        onChange={(e) => setColumnSearch(e.target.value)}
                                        className="w-full pl-8 pr-2.5 py-1 text-xs bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-md text-gray-800 dark:text-gray-200 placeholder-gray-400 focus:outline-none focus:ring-1 focus:ring-primary-500"
                                    />
                                </div>
                            </div>

                            {/* Quick Presets */}
                            <div className="px-3 py-1.5 bg-gray-50/50 dark:bg-gray-900/30 border-b border-gray-100 dark:border-gray-700/50 flex items-center justify-between text-[11px]">
                                <button
                                    type="button"
                                    onClick={() => setAllColumns(true)}
                                    className="text-primary-600 hover:text-primary-700 dark:text-primary-400 font-medium hover:underline"
                                >
                                    Exibir Todas
                                </button>
                                <button
                                    type="button"
                                    onClick={resetToDefaults}
                                    className="text-gray-600 hover:text-gray-800 dark:text-gray-400 font-medium hover:underline"
                                >
                                    Restaurar Padrão
                                </button>
                                <button
                                    type="button"
                                    onClick={() => setAllColumns(false)}
                                    className="text-red-500 hover:text-red-600 dark:text-red-400 font-medium hover:underline"
                                >
                                    Limpar
                                </button>
                            </div>

                            {/* Column checkboxes list grouped by category */}
                            <div className="p-2 overflow-y-auto space-y-3 max-h-72">
                                {Object.entries(CATEGORY_LABELS).map(([catKey, catLabel]) => {
                                    const catColumns = filteredColumnDefs.filter(c => c.category === catKey);
                                    if (catColumns.length === 0) return null;

                                    return (
                                        <div key={catKey} className="space-y-1">
                                            <div className="px-1 text-[10px] font-bold text-gray-400 dark:text-gray-500 uppercase tracking-wider">
                                                {catLabel}
                                            </div>
                                            <div className="space-y-0.5">
                                                {catColumns.map(col => {
                                                    const isChecked = !!visibleColumns[col.id];
                                                    return (
                                                        <label
                                                            key={col.id}
                                                            className={`flex items-center justify-between px-2 py-1.5 rounded-lg cursor-pointer transition-colors text-xs select-none ${
                                                                isChecked
                                                                    ? 'bg-primary-50/60 dark:bg-primary-950/30 text-gray-900 dark:text-gray-100'
                                                                    : 'hover:bg-gray-100/70 dark:hover:bg-gray-700/50 text-gray-500 dark:text-gray-400'
                                                            }`}
                                                        >
                                                            <div className="flex items-center space-x-2 truncate pr-2">
                                                                <input
                                                                    type="checkbox"
                                                                    checked={isChecked}
                                                                    onChange={() => toggleColumn(col.id)}
                                                                    className="w-3.5 h-3.5 rounded text-primary-600 focus:ring-primary-500 border-gray-300 dark:border-gray-600"
                                                                />
                                                                <span className={`truncate ${isChecked ? 'font-semibold' : 'font-normal'}`}>
                                                                    {col.label}
                                                                </span>
                                                            </div>
                                                            <span className="text-[10px] text-gray-400 dark:text-gray-500 font-mono truncate">
                                                                {col.defaultWidth}px
                                                            </span>
                                                        </label>
                                                    );
                                                })}
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        </div>
                    )}
                </div>
            </div>

            {/* Table Container */}
            <div className="bg-white/70 dark:bg-gray-900/80 backdrop-blur-md rounded-lg shadow overflow-x-auto border border-gray-200/50 dark:border-gray-700/50">
                <div className="hidden print:block text-center py-4 border-b mb-4">
                    <h1 className="text-xl font-bold text-black">Lista de Atividades</h1>
                    <p className="text-xs text-gray-600">Gerado em {new Date().toLocaleString('pt-BR')}</p>
                </div>
                <table className="w-full text-xs text-left text-gray-500 dark:text-gray-400 table-fixed">
                    <thead className="text-xs text-gray-700 uppercase bg-gray-50/50 dark:bg-gray-700/50 dark:text-gray-300">
                        <tr>
                            {visibleColumns.idMp && <Th id="idMp" label="ID MP" sortKey="idMp" />}
                            {visibleColumns.tag && <Th id="tag" label="TAG" sortKey="tag" />}
                            {visibleColumns.descricao && <Th id="descricao" label="Descrição" sortKey="descricao" />}
                            {visibleColumns.area && <Th id="area" label="Área" sortKey="area" />}
                            {visibleColumns.empresa && <Th id="empresa" label="Empresa" sortKey="empresa" />}
                            {visibleColumns.responsavel && <Th id="responsavel" label="Responsável" sortKey="responsavel" />}
                            {visibleColumns.supervisor && <Th id="supervisor" label="Supervisor" sortKey="supervisor" />}
                            {visibleColumns.turno && <Th id="turno" label="Turno" sortKey="turno" />}
                            {visibleColumns.data && <Th id="data" label="Data" sortKey="horaInicio" />}
                            {visibleColumns.horario && <Th id="horario" label="Horário" sortKey="horaInicio" />}
                            {visibleColumns.horaInicioReal && <Th id="horaInicioReal" label="Início Real" sortKey="horaInicioReal" />}
                            {visibleColumns.horaFimReal && <Th id="horaFimReal" label="Fim Real" sortKey="horaFimReal" />}
                            {visibleColumns.duracao && <Th id="duracao" label="Duração" sortKey="duracao" />}
                            {visibleColumns.criticidade && <Th id="criticidade" label="Criticidade" sortKey="criticidade" />}
                            {visibleColumns.progresso && <Th id="progresso" label="% Avanço" sortKey="progresso" />}
                            {visibleColumns.status && <Th id="status" label="Status" sortKey="statusLabel" />}
                            {visibleColumns.observacoes && <Th id="observacoes" label="Observações" sortKey="observacoes" />}
                            {visibleColumns.anexos && <Th id="anexos" label="Anexos" className="print:hidden" />}
                            {visibleColumns.acoes && <Th id="acoes" label="Ações" className="print:hidden" />}
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100/50 dark:divide-gray-700/50">
                        {sortedActivities.map(activity => {
                            // Conditional Formatting Logic: Open AND Start Time < Now
                            const isOverdue = activity.status === ActivityStatus.Open && new Date(activity.horaInicio) < now;
                            
                            return (
                                <tr key={activity.id} className="bg-transparent hover:bg-gray-50/50 dark:hover:bg-gray-700/30 transition-colors">
                                    {/* ID MP */}
                                    {visibleColumns.idMp && (
                                        <td 
                                            className="px-3 py-1.5 font-mono text-[11px] text-gray-700 dark:text-gray-300 truncate overflow-hidden cursor-pointer hover:text-primary-600"
                                            onClick={() => onEdit(activity)}
                                            title={activity.idMp || '-'}
                                        >
                                            {activity.idMp || '-'}
                                        </td>
                                    )}

                                    {/* TAG */}
                                    {visibleColumns.tag && (
                                        <td 
                                            className="px-3 py-1.5 font-medium text-gray-900 dark:text-white truncate overflow-hidden cursor-pointer hover:text-primary-600 hover:underline"
                                            onClick={() => onEdit(activity)}
                                            title="Clique para editar"
                                        >
                                            {activity.tag}
                                        </td>
                                    )}

                                    {/* Descrição */}
                                    {visibleColumns.descricao && (
                                        <td 
                                            className="px-3 py-1.5 truncate overflow-hidden cursor-pointer hover:text-primary-600" 
                                            title={activity.descricao}
                                            onClick={() => onEdit(activity)}
                                        >
                                            {activity.descricao}
                                        </td>
                                    )}

                                    {/* Área */}
                                    {visibleColumns.area && (
                                        <td 
                                            className="px-3 py-1.5 truncate overflow-hidden text-gray-700 dark:text-gray-300"
                                            title={activity.area || '-'}
                                        >
                                            {activity.area || '-'}
                                        </td>
                                    )}

                                    {/* Empresa */}
                                    {visibleColumns.empresa && (
                                        <td 
                                            className="px-3 py-1.5 truncate overflow-hidden text-gray-700 dark:text-gray-300"
                                            title={activity.empresa || 'FOSPAR'}
                                        >
                                            {activity.empresa || 'FOSPAR'}
                                        </td>
                                    )}

                                    {/* Responsável */}
                                    {visibleColumns.responsavel && (
                                        <td className="px-3 py-1.5 truncate overflow-hidden" title={activity.responsavel}>
                                            {activity.responsavel}
                                        </td>
                                    )}

                                    {/* Supervisor */}
                                    {visibleColumns.supervisor && (
                                        <td className="px-3 py-1.5 truncate overflow-hidden" title={activity.supervisor}>
                                            {activity.supervisor}
                                        </td>
                                    )}

                                    {/* Turno */}
                                    {visibleColumns.turno && (
                                        <td className="px-3 py-1.5 truncate overflow-hidden text-center font-medium">
                                            {activity.turno}
                                        </td>
                                    )}

                                    {/* Data */}
                                    {visibleColumns.data && (
                                        <td className="px-3 py-1.5 truncate overflow-hidden text-center">
                                            {new Date(activity.horaInicio).toLocaleDateString('pt-BR')}
                                        </td>
                                    )}

                                    {/* Horário Planejado */}
                                    {visibleColumns.horario && (
                                        <td className={`px-3 py-1.5 truncate overflow-hidden ${isOverdue ? 'text-red-600 font-bold dark:text-red-400' : ''}`}>
                                            {new Date(activity.horaInicio).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} - {new Date(activity.horaFim).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                        </td>
                                    )}

                                    {/* Início Real */}
                                    {visibleColumns.horaInicioReal && (
                                        <td className="px-3 py-1.5 truncate overflow-hidden text-gray-600 dark:text-gray-400">
                                            {activity.horaInicioReal 
                                                ? `${new Date(activity.horaInicioReal).toLocaleDateString('pt-BR')} ${new Date(activity.horaInicioReal).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`
                                                : '-'}
                                        </td>
                                    )}

                                    {/* Fim Real */}
                                    {visibleColumns.horaFimReal && (
                                        <td className="px-3 py-1.5 truncate overflow-hidden text-gray-600 dark:text-gray-400">
                                            {activity.horaFimReal 
                                                ? `${new Date(activity.horaFimReal).toLocaleDateString('pt-BR')} ${new Date(activity.horaFimReal).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`
                                                : '-'}
                                        </td>
                                    )}

                                    {/* Duração */}
                                    {visibleColumns.duracao && (
                                        <td className="px-3 py-1.5 truncate overflow-hidden text-center">
                                            {activity.duracao}
                                        </td>
                                    )}

                                    {/* Criticidade */}
                                    {visibleColumns.criticidade && (
                                        <td className="px-3 py-1.5">
                                            <span className={`px-1.5 py-0.5 rounded-full text-[10px] font-semibold border ${getCriticidadeClasses(activity.criticidade)}`}>
                                                {activity.criticidade}
                                            </span>
                                        </td>
                                    )}

                                    {/* % Avanço */}
                                    {visibleColumns.progresso && (
                                        <td className="px-3 py-1.5 whitespace-nowrap">
                                            <div className="flex items-center space-x-1.5">
                                                <div className="w-10 bg-gray-200 dark:bg-gray-700 rounded-full h-1.5 overflow-hidden flex-shrink-0">
                                                    <div 
                                                        className={`h-1.5 rounded-full ${activity.status === ActivityStatus.Closed ? 'bg-emerald-500' : 'bg-blue-500'}`}
                                                        style={{ width: `${activity.status === ActivityStatus.Closed ? 100 : (activity.progresso || 0)}%` }}
                                                    />
                                                </div>
                                                <span className="font-semibold text-[11px] text-gray-700 dark:text-gray-300">
                                                    {activity.status === ActivityStatus.Closed ? 100 : (activity.progresso || 0)}%
                                                </span>
                                            </div>
                                        </td>
                                    )}

                                    {/* Status */}
                                    {visibleColumns.status && (
                                        <td className="px-3 py-1.5">
                                            <div className="print:hidden">
                                                <select 
                                                    value={activity.status}
                                                    onChange={(e) => handleStatusChange(activity.id, e.target.value)}
                                                    className={`w-full p-0.5 rounded text-[10px] focus:ring-primary-500 focus:border-primary-500 cursor-pointer ${getStatusClasses(activity.status, true)}`}
                                                >
                                                    {Object.values(ActivityStatus).map(s => (
                                                        <option key={s} value={s} className="text-gray-800 bg-white">
                                                            {getStatusLabel(s, customStatusLabels)}
                                                        </option>
                                                    ))}
                                                </select>
                                            </div>
                                            <div className="hidden print:block text-[10px]">
                                                {getStatusLabel(activity.status, customStatusLabels)}
                                            </div>
                                        </td>
                                    )}

                                    {/* Observações */}
                                    {visibleColumns.observacoes && (
                                        <td className="px-3 py-1.5 truncate overflow-hidden text-gray-600 dark:text-gray-400" title={activity.observacoes || ''}>
                                            {activity.observacoes || '-'}
                                        </td>
                                    )}

                                    {/* Anexos */}
                                    {visibleColumns.anexos && (
                                        <td className="px-3 py-1.5 print:hidden">
                                            <div className="flex items-center justify-center space-x-1 text-gray-500 dark:text-gray-400">
                                                {(activity.beforeImage || activity.afterImage) && (
                                                    <span title="Contém imagem de antes/depois">
                                                        <CameraIcon className="w-4 h-4 text-blue-500" />
                                                    </span>
                                                )}
                                                {(activity.attachments?.length || 0) > 0 && (
                                                    <div className="flex items-center">
                                                        <PaperClipIcon className="w-3.5 h-3.5" />
                                                        <span className="ml-0.5 text-[10px]">{activity.attachments?.length}</span>
                                                    </div>
                                                )}
                                            </div>
                                        </td>
                                    )}

                                    {/* Ações */}
                                    {visibleColumns.acoes && (
                                        <td className="px-3 py-1.5 text-center print:hidden">
                                            <div className="flex items-center justify-center space-x-2">
                                                <button onClick={() => onEdit(activity)} className="text-primary-600 hover:text-primary-800 dark:text-primary-500 dark:hover:text-primary-300 transition-colors" title="Editar">
                                                    <PencilIcon className="w-4 h-4"/>
                                                </button>
                                                {onDelete && (
                                                    <button onClick={() => onDelete(activity.id)} className="text-red-500 hover:text-red-700 transition-colors" title="Excluir">
                                                        <TrashIcon className="w-4 h-4" />
                                                    </button>
                                                )}
                                            </div>
                                        </td>
                                    )}
                                </tr>
                            );
                        })}
                    </tbody>
                </table>
            </div>
        </div>
    );
};

