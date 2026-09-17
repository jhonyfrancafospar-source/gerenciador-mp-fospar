
import React, { useState, useMemo, useRef, useEffect } from 'react';
import { type Activity, ActivityStatus } from '../types';
import { PencilIcon } from './icons/PencilIcon';
import { PaperClipIcon } from './icons/PaperClipIcon';
import { CameraIcon } from './icons/CameraIcon';
import { ArrowsUpDownIcon } from './icons/ArrowsUpDownIcon';
import { TrashIcon } from './icons/TrashIcon';
import { ViewColumnsIcon } from './icons/ViewColumnsIcon';
import { DocumentArrowUpIcon } from './icons/DocumentArrowUpIcon';
import { XMarkIcon } from './icons/XMarkIcon';
import { SearchIcon } from './icons/SearchIcon';
import { LinkIcon } from './icons/LinkIcon';
import { getStatusClasses, getCriticidadeClasses, getStatusLabel } from '../utils/styleUtils';
import { getPredecessors, getSuccessors, analyzeDependencies, getActivitySequenceMap } from '../utils/dependencyUtils';
import { DateSlicer, doesActivityMatchDate } from './DateSlicer';

interface ActivityListViewProps {
    activities: Activity[];
    allUnfilteredActivities?: Activity[];
    onEdit: (activity: Activity) => void;
    onUpdateStatus: (activityId: string, status: ActivityStatus) => void;
    onDelete?: (activityId: string) => void;
    customStatusLabels?: Record<string, string>;
    onRecalculateSchedule?: (targetMpId?: string) => void;
    statusFilter?: string;
    onStatusFilterChange?: (status: string) => void;
    isAdmin?: boolean;
    onOpenExport?: () => void;
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
    { id: 'seq', label: '#', description: 'Número sequencial numérico na MP/Cronograma', category: 'identificacao', defaultWidth: 50, defaultVisible: true, align: 'center' },
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
    { id: 'predecessoras', label: 'Predecessoras', description: 'Atividades vinculadas anteriores', category: 'planejamento', defaultWidth: 150, defaultVisible: true },
    { id: 'sucessoras', label: 'Sucessoras', description: 'Atividades vinculadas subsequentes', category: 'planejamento', defaultWidth: 150, defaultVisible: false },
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

export const ActivityListView: React.FC<ActivityListViewProps> = ({ 
    activities, 
    allUnfilteredActivities,
    onEdit, 
    onUpdateStatus, 
    onDelete, 
    customStatusLabels = {},
    onRecalculateSchedule,
    statusFilter = 'all',
    onStatusFilterChange,
    isAdmin,
    onOpenExport
}) => {
    // Status Counts & Configuration for Quick Filter Pills
    const statusCounts = useMemo(() => {
        const pool = allUnfilteredActivities || activities;
        const counts: Record<string, number> = { all: pool.length };
        pool.forEach(a => {
            counts[a.status] = (counts[a.status] || 0) + 1;
        });
        return counts;
    }, [allUnfilteredActivities, activities]);

    const statusPillConfigs = useMemo(() => [
        {
            value: 'all',
            label: 'Todos',
            dotClass: 'bg-gray-400',
            activeClass: 'bg-gray-900 text-white dark:bg-gray-100 dark:text-gray-900 ring-2 ring-gray-400/40 font-bold',
            badgeActiveClass: 'bg-white/30 text-white dark:bg-gray-800 dark:text-gray-100',
        },
        {
            value: ActivityStatus.Open,
            label: customStatusLabels[ActivityStatus.Open] || 'Aberto',
            dotClass: 'bg-gray-500',
            activeClass: 'bg-gray-800 text-white ring-2 ring-gray-500/50 font-bold',
            badgeActiveClass: 'bg-white/20 text-white',
        },
        {
            value: ActivityStatus.EmProgresso,
            label: customStatusLabels[ActivityStatus.EmProgresso] || 'Em Andamento',
            dotClass: 'bg-blue-500',
            activeClass: 'bg-blue-600 text-white ring-2 ring-blue-500/50 font-bold',
            badgeActiveClass: 'bg-blue-800 text-white',
        },
        {
            value: ActivityStatus.ExecutadoParcialmente,
            label: customStatusLabels[ActivityStatus.ExecutadoParcialmente] || 'Parcial',
            dotClass: 'bg-yellow-400',
            activeClass: 'bg-yellow-500 text-gray-900 ring-2 ring-yellow-400/50 font-bold',
            badgeActiveClass: 'bg-yellow-700 text-white',
        },
        {
            value: ActivityStatus.Closed,
            label: customStatusLabels[ActivityStatus.Closed] || 'Concluído',
            dotClass: 'bg-green-500',
            activeClass: 'bg-green-600 text-white ring-2 ring-green-500/50 font-bold',
            badgeActiveClass: 'bg-green-800 text-white',
        },
        {
            value: ActivityStatus.NaoExecutado,
            label: customStatusLabels[ActivityStatus.NaoExecutado] || 'Não Executado',
            dotClass: 'bg-red-500',
            activeClass: 'bg-red-600 text-white ring-2 ring-red-500/50 font-bold',
            badgeActiveClass: 'bg-red-800 text-white',
        },
    ], [customStatusLabels]);

    // Sorting State
    const [sortConfig, setSortConfig] = useState<SortConfig>({ key: null, direction: 'asc' });
    
    // Date Slicer (Segmentação de Dados) State
    const [selectedDates, setSelectedDates] = useState<string[]>([]);
    const [dateMatchMode, setDateMatchMode] = useState<'start' | 'active'>('active');

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

    // Compute sequence numbers for all activities
    const sequenceMap = useMemo(() => getActivitySequenceMap(activities), [activities]);

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

    // Filter activities by Date Slicer
    const dateFilteredActivities = useMemo(() => {
        if (selectedDates.length === 0) return activities;
        return activities.filter(act =>
            selectedDates.some(dKey => doesActivityMatchDate(act, dKey, dateMatchMode))
        );
    }, [activities, selectedDates, dateMatchMode]);

    const sortedActivities = useMemo(() => {
        if (!sortConfig.key) return dateFilteredActivities;

        return [...dateFilteredActivities].sort((a, b) => {
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

            // Handle Seq sorting
            if (sortConfig.key === 'seq' as any) {
                const aSeq = sequenceMap.get(a.id) || 0;
                const bSeq = sequenceMap.get(b.id) || 0;
                return sortConfig.direction === 'asc' ? aSeq - bSeq : bSeq - aSeq;
            }

            // Handle Strings
            if (typeof aValue === 'string' && typeof bValue === 'string') {
                return sortConfig.direction === 'asc'
                    ? aValue.localeCompare(bValue)
                    : bValue.localeCompare(aValue);
            }

            return 0;
        });
    }, [dateFilteredActivities, sortConfig, customStatusLabels, sequenceMap]);

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

    const renderStatusFilterBar = () => {
        if (!onStatusFilterChange) return null;
        return (
            <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar py-1.5 px-2.5 bg-white/70 dark:bg-gray-800/70 backdrop-blur-sm rounded-lg border border-gray-200/80 dark:border-gray-700/80 shadow-xs print:hidden">
                <span className="text-[11px] font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider whitespace-nowrap mr-1">
                    Status:
                </span>
                <div className="flex items-center gap-1.5 flex-nowrap">
                    {statusPillConfigs.map(btn => {
                        const isActive = (statusFilter || 'all') === btn.value;
                        const count = statusCounts[btn.value] || 0;
                        return (
                            <button
                                key={btn.value}
                                type="button"
                                onClick={() => onStatusFilterChange(btn.value)}
                                className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold whitespace-nowrap transition-all shadow-xs cursor-pointer ${
                                    isActive
                                        ? btn.activeClass
                                        : 'bg-white dark:bg-gray-700 text-gray-700 dark:text-gray-200 border border-gray-200 dark:border-gray-600 hover:bg-gray-100 dark:hover:bg-gray-600'
                                }`}
                            >
                                <span className={`w-2 h-2 rounded-full ${btn.dotClass}`}></span>
                                <span>{btn.label}</span>
                                <span className={`text-[10px] px-1.5 py-0.2 rounded-full font-bold ${
                                    isActive ? btn.badgeActiveClass : 'bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-300'
                                }`}>
                                    {count}
                                </span>
                            </button>
                        );
                    })}
                </div>
                {statusFilter && statusFilter !== 'all' && (
                    <button
                        type="button"
                        onClick={() => onStatusFilterChange('all')}
                        className="text-[11px] font-bold text-red-500 hover:text-red-700 dark:text-red-400 dark:hover:text-red-300 ml-auto whitespace-nowrap uppercase tracking-wider pl-2"
                        title="Limpar filtro de status"
                    >
                        Limpar Filtro
                    </button>
                )}
            </div>
        );
    };

    if (activities.length === 0) {
        return (
            <div className="space-y-2.5">
                {renderStatusFilterBar()}
                <div className="text-center p-8 bg-white/70 dark:bg-gray-800/70 backdrop-blur-md rounded-lg shadow space-y-3">
                    <p className="text-gray-600 dark:text-gray-300 font-medium">Nenhuma atividade encontrada com os filtros selecionados.</p>
                    {statusFilter && statusFilter !== 'all' && onStatusFilterChange && (
                        <button
                            type="button"
                            onClick={() => onStatusFilterChange('all')}
                            className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-primary-600 hover:bg-primary-700 text-white text-xs font-semibold rounded-md shadow transition-colors"
                        >
                            <span>Ver todas as atividades</span>
                        </button>
                    )}
                </div>
            </div>
        );
    }

    return (
        <div className="space-y-2.5">
            {/* Filtro Rápido por Status */}
            {renderStatusFilterBar()}

            {/* Segmentação de Dados por Data do Dia da Atividade */}
            <DateSlicer
                activities={activities}
                selectedDates={selectedDates}
                onSelectDates={setSelectedDates}
                matchMode={dateMatchMode}
                onToggleMatchMode={setDateMatchMode}
            />

            {/* Action & Column Visibility Control Bar */}
            <div className="flex flex-wrap items-center justify-between gap-2 px-1 print:hidden">
                <div className="text-xs text-gray-500 dark:text-gray-400 font-medium flex items-center gap-1.5 flex-wrap">
                    <span>
                        Exibindo <span className="font-bold text-gray-700 dark:text-gray-200">{sortedActivities.length}</span>
                        {selectedDates.length > 0 && (
                            <span> de <span className="font-bold text-gray-500 dark:text-gray-400">{activities.length}</span></span>
                        )} atividade(s)
                    </span>
                    {selectedDates.length > 0 && (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold bg-primary-50 dark:bg-primary-950/60 text-primary-700 dark:text-primary-300 border border-primary-200 dark:border-primary-800">
                            Filtro de data ativo
                            <button
                                type="button"
                                onClick={() => setSelectedDates([])}
                                className="hover:text-primary-900 dark:hover:text-white ml-0.5"
                                title="Limpar filtro de data"
                            >
                                <XMarkIcon className="w-3 h-3" />
                            </button>
                        </span>
                    )}
                    <span>•</span>
                    <span>
                        <span className="font-bold text-primary-600 dark:text-primary-400">{totalVisibleCount}</span> coluna(s) ativa(s)
                    </span>
                </div>

                <div className="flex items-center gap-2">
                    {isAdmin && onOpenExport && (
                        <button
                            type="button"
                            onClick={onOpenExport}
                            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold border border-emerald-300 dark:border-emerald-800 bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 hover:bg-emerald-100 dark:hover:bg-emerald-900/60 transition-all shadow-sm"
                            title="Exportar programações para planilha Excel (.xlsx) [Acesso ADMIN]"
                        >
                            <DocumentArrowUpIcon className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                            <span>Exportar Excel</span>
                        </button>
                    )}

                    {onRecalculateSchedule && (
                        <button
                            type="button"
                            onClick={() => onRecalculateSchedule()}
                            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold border border-indigo-200 dark:border-indigo-800 bg-indigo-50 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-300 hover:bg-indigo-100 dark:hover:bg-indigo-900/60 transition-all shadow-sm"
                            title="Recalcular e ajustar automaticamente datas e horários de atividades com predecessoras e sucessoras respeitando suas durações"
                        >
                            <span>⚡ Auto-Ajustar Vínculos</span>
                        </button>
                    )}

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
                            {visibleColumns.seq && <Th id="seq" label="#" className="text-center" sortKey={'seq' as any} />}
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
                            {visibleColumns.predecessoras && <Th id="predecessoras" label="Predecessoras" />}
                            {visibleColumns.sucessoras && <Th id="sucessoras" label="Sucessoras" />}
                            {visibleColumns.criticidade && <Th id="criticidade" label="Criticidade" sortKey="criticidade" />}
                            {visibleColumns.progresso && <Th id="progresso" label="% Avanço" sortKey="progresso" />}
                            {visibleColumns.status && <Th id="status" label="Status" sortKey="statusLabel" />}
                            {visibleColumns.observacoes && <Th id="observacoes" label="Observações" sortKey="observacoes" />}
                            {visibleColumns.anexos && <Th id="anexos" label="Anexos" className="print:hidden" />}
                            {visibleColumns.acoes && <Th id="acoes" label="Ações" className="print:hidden" />}
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100/50 dark:divide-gray-700/50">
                        {sortedActivities.length === 0 ? (
                            <tr>
                                <td colSpan={Math.max(1, totalVisibleCount)} className="text-center py-10 px-4 text-gray-500 dark:text-gray-400">
                                    <div className="flex flex-col items-center justify-center gap-2">
                                        <p className="text-xs font-medium">Nenhuma atividade encontrada para a(s) data(s) selecionada(s).</p>
                                        {selectedDates.length > 0 && (
                                            <button
                                                type="button"
                                                onClick={() => setSelectedDates([])}
                                                className="inline-flex items-center gap-1 px-3 py-1 rounded-lg text-xs font-semibold bg-primary-50 text-primary-700 hover:bg-primary-100 dark:bg-primary-950/60 dark:text-primary-300 border border-primary-200 dark:border-primary-800 transition-colors shadow-2xs cursor-pointer"
                                            >
                                                <XMarkIcon className="w-3.5 h-3.5" />
                                                <span>Limpar seleção de datas</span>
                                            </button>
                                        )}
                                    </div>
                                </td>
                            </tr>
                        ) : (
                            sortedActivities.map((activity, index) => {
                            // Conditional Formatting Logic: Open AND Start Time < Now
                            const isOverdue = activity.status === ActivityStatus.Open && new Date(activity.horaInicio) < now;
                            const seqNum = sequenceMap.get(activity.id) || (index + 1);
                            
                            return (
                                <tr key={activity.id} className="bg-transparent hover:bg-gray-50/50 dark:hover:bg-gray-700/30 transition-colors">
                                    {/* Nº Sequencial */}
                                    {visibleColumns.seq && (
                                        <td 
                                            className="px-2 py-1.5 text-center font-mono font-bold text-[11px] text-indigo-700 dark:text-indigo-300 bg-indigo-50/40 dark:bg-indigo-950/20 cursor-pointer hover:bg-indigo-100/60 dark:hover:bg-indigo-900/40"
                                            onClick={() => onEdit(activity)}
                                            title={`Item #${seqNum} na MP (${activity.idMp || 'Geral'})`}
                                        >
                                            <span className="inline-flex items-center justify-center min-w-[22px] px-1 py-0.5 rounded font-bold bg-indigo-100 dark:bg-indigo-900/60 text-indigo-800 dark:text-indigo-200">
                                                #{seqNum}
                                            </span>
                                        </td>
                                    )}

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

                                    {/* Predecessoras */}
                                    {visibleColumns.predecessoras && (
                                        <td className="px-3 py-1.5 overflow-hidden">
                                            {(() => {
                                                const preds = getPredecessors(activity, activities);
                                                if (preds.length === 0) return <span className="text-gray-400 text-[11px]">-</span>;

                                                const analysis = analyzeDependencies(activity, activities);
                                                const hasConflict = analysis.conflicts.length > 0;

                                                return (
                                                    <div className="flex flex-wrap items-center gap-1">
                                                        {preds.slice(0, 3).map(p => {
                                                            const pSeq = sequenceMap.get(p.id);
                                                            return (
                                                                <span
                                                                    key={p.id}
                                                                    onClick={(e) => {
                                                                        e.stopPropagation();
                                                                        onEdit(p);
                                                                    }}
                                                                    className={`inline-flex items-center text-[10px] font-mono px-1.5 py-0.5 rounded cursor-pointer transition-colors ${
                                                                        p.status === ActivityStatus.Closed
                                                                            ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300 hover:bg-emerald-200'
                                                                            : hasConflict
                                                                            ? 'bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300 hover:bg-amber-200'
                                                                            : 'bg-indigo-100 text-indigo-800 dark:bg-indigo-950 dark:text-indigo-300 hover:bg-indigo-200'
                                                                    }`}
                                                                    title={`Predecessora #${pSeq || ''}: ${p.tag} (${p.descricao}) - Status: ${getStatusLabel(p.status, customStatusLabels)}`}
                                                                >
                                                                    ⬅️ {pSeq ? `#${pSeq} ` : ''}{p.tag}
                                                                </span>
                                                            );
                                                        })}
                                                        {preds.length > 3 && (
                                                            <span className="text-[10px] text-gray-500 font-medium">
                                                                +{preds.length - 3}
                                                            </span>
                                                        )}
                                                        {hasConflict && (
                                                            <span title={analysis.conflicts[0].message} className="text-amber-500 text-xs">
                                                                ⚠️
                                                            </span>
                                                        )}
                                                    </div>
                                                );
                                            })()}
                                        </td>
                                    )}

                                    {/* Sucessoras */}
                                    {visibleColumns.sucessoras && (
                                        <td className="px-3 py-1.5 overflow-hidden">
                                            {(() => {
                                                const succs = getSuccessors(activity, activities);
                                                if (succs.length === 0) return <span className="text-gray-400 text-[11px]">-</span>;

                                                return (
                                                    <div className="flex flex-wrap items-center gap-1">
                                                        {succs.slice(0, 3).map(s => {
                                                            const sSeq = sequenceMap.get(s.id);
                                                            return (
                                                                <span
                                                                    key={s.id}
                                                                    onClick={(e) => {
                                                                        e.stopPropagation();
                                                                        onEdit(s);
                                                                    }}
                                                                    className="inline-flex items-center text-[10px] font-mono px-1.5 py-0.5 rounded cursor-pointer transition-colors bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-blue-300 hover:bg-blue-200"
                                                                    title={`Sucessora #${sSeq || ''}: ${s.tag} (${s.descricao}) - Início: ${new Date(s.horaInicio).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`}
                                                                >
                                                                    ➡️ {sSeq ? `#${sSeq} ` : ''}{s.tag}
                                                                </span>
                                                            );
                                                        })}
                                                        {succs.length > 3 && (
                                                            <span className="text-[10px] text-gray-500 font-medium">
                                                                +{succs.length - 3}
                                                            </span>
                                                        )}
                                                    </div>
                                                );
                                            })()}
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
                        })
                    )}
                    </tbody>
                </table>
            </div>
        </div>
    );
};

