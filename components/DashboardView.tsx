import React, { useMemo, useState } from 'react';
import type { Activity } from '../types';
import { ActivityStatus, Criticidade } from '../types';
import { getStatusClasses, getStatusLabel, getCriticidadeClasses } from '../utils/styleUtils';
import { ChartBarIcon } from './icons/ChartBarIcon';
import { ChartPieIcon } from './icons/ChartPieIcon';
import { CalculatorIcon } from './icons/CalculatorIcon';
import { FunnelIcon } from './icons/FunnelIcon';
import { SearchIcon } from './icons/SearchIcon';
import { XMarkIcon } from './icons/XMarkIcon';
import { PrinterIcon } from './icons/PrinterIcon';
import { DocumentArrowDownIcon } from './icons/DocumentArrowDownIcon';
import { UserIcon } from './icons/UserIcon';
import { 
    BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, 
    PieChart, Pie, Cell, LineChart, Line, ComposedChart, Area
} from 'recharts';

interface DashboardViewProps {
    activities: Activity[];
    allActivities?: Activity[];
    customStatusLabels?: Record<string, string>;
}

const STATUS_COLORS: Record<ActivityStatus, string> = {
    [ActivityStatus.Open]: '#64748b', // Slate 500
    [ActivityStatus.NaoExecutado]: '#ef4444', // Red 500
    [ActivityStatus.EmProgresso]: '#3b82f6', // Blue 500
    [ActivityStatus.ExecutadoParcialmente]: '#f59e0b', // Amber 500
    [ActivityStatus.Closed]: '#10b981', // Emerald 500
};

type ChartType = 'bar' | 'pie' | 'line';
type DashboardTab = 'overview' | 'manpower' | 'areas' | 'matrix';

// Helper: parse duration string or decimal to total minutes
const parseDurationToMinutes = (durationStr: string | number | undefined): number => {
    if (!durationStr) return 0;
    if (typeof durationStr === 'number') return Math.round(durationStr * 60);
    const str = String(durationStr).trim();
    if (str.includes(':')) {
        const [h, m] = str.split(':').map(Number);
        return ((h || 0) * 60) + (m || 0);
    }
    const num = parseFloat(str);
    return isNaN(num) ? 0 : Math.round(num * 60);
};

// Helper: format minutes into "Xh Ym"
const formatMinutesToHours = (totalMinutes: number): string => {
    const hours = Math.floor(totalMinutes / 60);
    const mins = Math.round(totalMinutes % 60);
    if (hours === 0 && mins === 0) return '0h';
    if (mins === 0) return `${hours}h`;
    return `${hours}h ${mins}m`;
};

// Helper: calculate headcount from responsavel string
const getHeadcount = (responsavel?: string): number => {
    if (!responsavel || !responsavel.trim()) return 1;
    const names = responsavel.split(/\s*[\/,;&]\s*/).filter(s => s.trim().length > 0);
    return Math.max(1, names.length);
};

export const DashboardView: React.FC<DashboardViewProps> = ({ 
    activities, 
    customStatusLabels = {} 
}) => {
    // Tab state
    const [activeTab, setActiveTab] = useState<DashboardTab>('overview');
    const [statusChartType, setStatusChartType] = useState<ChartType>('pie');
    const [areaChartType, setAreaChartType] = useState<ChartType>('bar');

    // Local filters within Dashboard
    const [selectedIdMp, setSelectedIdMp] = useState<string>('all');
    const [selectedTurno, setSelectedTurno] = useState<string>('all');
    const [selectedEmpresa, setSelectedEmpresa] = useState<string>('all');
    const [selectedArea, setSelectedArea] = useState<string>('all');
    const [selectedCriticidade, setSelectedCriticidade] = useState<string>('all');
    const [searchTerm, setSearchTerm] = useState<string>('');
    const [isFilterBarOpen, setIsFilterBarOpen] = useState<boolean>(false);

    // Available unique filter options from activities
    const uniqueIdMps = useMemo(() => {
        const set = new Set<string>();
        activities.forEach(a => { if (a.idMp) set.add(a.idMp); });
        return Array.from(set).sort();
    }, [activities]);

    const uniqueTurnos = useMemo(() => {
        const set = new Set<string>();
        activities.forEach(a => { if (a.turno) set.add(a.turno); });
        return Array.from(set).sort();
    }, [activities]);

    const uniqueEmpresas = useMemo(() => {
        const set = new Set<string>();
        activities.forEach(a => { if (a.empresa) set.add(a.empresa); });
        return Array.from(set).sort();
    }, [activities]);

    const uniqueAreas = useMemo(() => {
        const set = new Set<string>();
        activities.forEach(a => { if (a.area) set.add(a.area); });
        return Array.from(set).sort();
    }, [activities]);

    // Apply dashboard local filters
    const filteredActivities = useMemo(() => {
        return activities.filter(a => {
            if (selectedIdMp !== 'all' && a.idMp !== selectedIdMp) return false;
            if (selectedTurno !== 'all' && a.turno !== selectedTurno) return false;
            if (selectedEmpresa !== 'all' && (a.empresa || 'FOSPAR') !== selectedEmpresa) return false;
            if (selectedArea !== 'all' && a.area !== selectedArea) return false;
            if (selectedCriticidade !== 'all' && a.criticidade !== selectedCriticidade) return false;
            if (searchTerm.trim()) {
                const term = searchTerm.toLowerCase();
                const matchTag = a.tag?.toLowerCase().includes(term);
                const matchDesc = a.descricao?.toLowerCase().includes(term);
                const matchResp = a.responsavel?.toLowerCase().includes(term);
                const matchSup = a.supervisor?.toLowerCase().includes(term);
                if (!matchTag && !matchDesc && !matchResp && !matchSup) return false;
            }
            return true;
        });
    }, [activities, selectedIdMp, selectedTurno, selectedEmpresa, selectedArea, selectedCriticidade, searchTerm]);

    const hasActiveLocalFilters = selectedIdMp !== 'all' || selectedTurno !== 'all' || 
        selectedEmpresa !== 'all' || selectedArea !== 'all' || selectedCriticidade !== 'all' || searchTerm.trim() !== '';

    const handleClearFilters = () => {
        setSelectedIdMp('all');
        setSelectedTurno('all');
        setSelectedEmpresa('all');
        setSelectedArea('all');
        setSelectedCriticidade('all');
        setSearchTerm('');
    };

    // --- Aggregations & Metrics Calculations ---
    const totalCount = filteredActivities.length;

    // Headcount & Homem x Hora (H x H)
    const hxhMetrics = useMemo(() => {
        let totalDurationMinutes = 0;
        let totalManMinutes = 0;
        let completedManMinutes = 0;
        let inProgressManMinutes = 0;
        let pendingManMinutes = 0;
        const uniquePeople = new Set<string>();

        filteredActivities.forEach(act => {
            const durationMin = parseDurationToMinutes(act.duracao);
            const headcount = getHeadcount(act.responsavel);
            const manMinutes = durationMin * headcount;

            totalDurationMinutes += durationMin;
            totalManMinutes += manMinutes;

            // Track individual names for unique count
            if (act.responsavel) {
                act.responsavel.split(/\s*[\/,;&]\s*/).forEach(n => {
                    const clean = n.trim();
                    if (clean) uniquePeople.add(clean);
                });
            }

            if (act.status === ActivityStatus.Closed) {
                completedManMinutes += manMinutes;
            } else if (act.status === ActivityStatus.EmProgresso || act.status === ActivityStatus.ExecutadoParcialmente) {
                inProgressManMinutes += manMinutes;
            } else {
                pendingManMinutes += manMinutes;
            }
        });

        return {
            totalDurationMinutes,
            totalManMinutes,
            completedManMinutes,
            inProgressManMinutes,
            pendingManMinutes,
            uniqueHeadcount: uniquePeople.size
        };
    }, [filteredActivities]);

    // Status distribution
    const statusCounts = useMemo(() => {
        const counts: Record<ActivityStatus, number> = {
            [ActivityStatus.Open]: 0,
            [ActivityStatus.EmProgresso]: 0,
            [ActivityStatus.ExecutadoParcialmente]: 0,
            [ActivityStatus.Closed]: 0,
            [ActivityStatus.NaoExecutado]: 0,
        };
        filteredActivities.forEach(a => {
            if (counts[a.status] !== undefined) {
                counts[a.status]++;
            } else {
                counts[a.status] = 1;
            }
        });
        return counts;
    }, [filteredActivities]);

    const completedCount = statusCounts[ActivityStatus.Closed] || 0;
    const inProgressCount = (statusCounts[ActivityStatus.EmProgresso] || 0) + (statusCounts[ActivityStatus.ExecutadoParcialmente] || 0);
    const pendingCount = (statusCounts[ActivityStatus.Open] || 0);
    const notExecutedCount = (statusCounts[ActivityStatus.NaoExecutado] || 0);

    // Progress percentage: By count and weighted by HH
    const simpleProgress = totalCount > 0 ? Math.round((completedCount / totalCount) * 100) : 0;
    const weightedProgress = hxhMetrics.totalManMinutes > 0 
        ? Math.round((hxhMetrics.completedManMinutes / hxhMetrics.totalManMinutes) * 100) 
        : simpleProgress;

    // Status Chart Data
    const statusChartData = useMemo(() => {
        const order: ActivityStatus[] = [
            ActivityStatus.Closed,
            ActivityStatus.EmProgresso,
            ActivityStatus.ExecutadoParcialmente,
            ActivityStatus.Open,
            ActivityStatus.NaoExecutado,
        ];
        return order.map(st => ({
            key: st,
            name: getStatusLabel(st, customStatusLabels),
            value: statusCounts[st] || 0,
            color: STATUS_COLORS[st] || '#94a3b8'
        })).filter(item => item.value > 0);
    }, [statusCounts, customStatusLabels]);

    // Area Breakdown Data
    const areaBreakdown = useMemo(() => {
        const map = new Map<string, { 
            area: string; 
            total: number; 
            completed: number; 
            inProgress: number; 
            pending: number;
            notExecuted: number;
            totalMinutes: number; 
            totalManMinutes: number;
        }>();

        filteredActivities.forEach(act => {
            const areaName = act.area || 'Geral / Não Especificado';
            const durationMin = parseDurationToMinutes(act.duracao);
            const headcount = getHeadcount(act.responsavel);
            const manMin = durationMin * headcount;

            if (!map.has(areaName)) {
                map.set(areaName, {
                    area: areaName,
                    total: 0,
                    completed: 0,
                    inProgress: 0,
                    pending: 0,
                    notExecuted: 0,
                    totalMinutes: 0,
                    totalManMinutes: 0
                });
            }

            const item = map.get(areaName)!;
            item.total++;
            item.totalMinutes += durationMin;
            item.totalManMinutes += manMin;

            if (act.status === ActivityStatus.Closed) item.completed++;
            else if (act.status === ActivityStatus.EmProgresso || act.status === ActivityStatus.ExecutadoParcialmente) item.inProgress++;
            else if (act.status === ActivityStatus.NaoExecutado) item.notExecuted++;
            else item.pending++;
        });

        return Array.from(map.values())
            .map(item => ({
                ...item,
                percent: item.total > 0 ? Math.round((item.completed / item.total) * 100) : 0,
                hhHours: Math.round(item.totalManMinutes / 60)
            }))
            .sort((a, b) => b.total - a.total);
    }, [filteredActivities]);

    // Empresa Breakdown Data
    const empresaBreakdown = useMemo(() => {
        const map = new Map<string, { empresa: string; count: number; completed: number; totalManMinutes: number }>();
        filteredActivities.forEach(act => {
            const emp = act.empresa?.trim() || 'FOSPAR';
            const durationMin = parseDurationToMinutes(act.duracao);
            const manMin = durationMin * getHeadcount(act.responsavel);

            if (!map.has(emp)) {
                map.set(emp, { empresa: emp, count: 0, completed: 0, totalManMinutes: 0 });
            }
            const item = map.get(emp)!;
            item.count++;
            item.totalManMinutes += manMin;
            if (act.status === ActivityStatus.Closed) item.completed++;
        });

        return Array.from(map.values())
            .map(item => ({
                ...item,
                hhHours: Math.round(item.totalManMinutes / 60),
                percent: item.count > 0 ? Math.round((item.completed / item.count) * 100) : 0
            }))
            .sort((a, b) => b.totalManMinutes - a.totalManMinutes);
    }, [filteredActivities]);

    // Top 10 Responsáveis by Man-Hours
    const topResponsaveis = useMemo(() => {
        const map = new Map<string, { name: string; count: number; totalManMinutes: number; completedCount: number }>();
        filteredActivities.forEach(act => {
            const resp = act.responsavel?.trim() || 'Não Definido';
            const durationMin = parseDurationToMinutes(act.duracao);
            const headcount = getHeadcount(act.responsavel);
            const manMin = durationMin * headcount;

            if (!map.has(resp)) {
                map.set(resp, { name: resp, count: 0, totalManMinutes: 0, completedCount: 0 });
            }
            const item = map.get(resp)!;
            item.count++;
            item.totalManMinutes += manMin;
            if (act.status === ActivityStatus.Closed) item.completedCount++;
        });

        return Array.from(map.values())
            .sort((a, b) => b.totalManMinutes - a.totalManMinutes)
            .slice(0, 8)
            .map(r => ({
                ...r,
                hhHours: (r.totalManMinutes / 60).toFixed(1),
                percent: r.count > 0 ? Math.round((r.completedCount / r.count) * 100) : 0
            }));
    }, [filteredActivities]);

    // Top 10 Most Demanding Equipment (TAGs)
    const topTags = useMemo(() => {
        return [...filteredActivities]
            .map(act => {
                const durationMin = parseDurationToMinutes(act.duracao);
                const headcount = getHeadcount(act.responsavel);
                const manMin = durationMin * headcount;
                return {
                    ...act,
                    durationMin,
                    headcount,
                    manMin
                };
            })
            .sort((a, b) => b.manMin - a.manMin)
            .slice(0, 10);
    }, [filteredActivities]);

    // Export CSV of consolidated metrics
    const handleExportCSV = () => {
        const headers = ["Área", "Qtd Atividades", "Concluídas", "Em Progresso", "Pendentes", "H x H (Horas)", "Progresso (%)"];
        const rows = areaBreakdown.map(a => [
            `"${a.area.replace(/"/g, '""')}"`,
            a.total,
            a.completed,
            a.inProgress,
            a.pending + a.notExecuted,
            (a.totalManMinutes / 60).toFixed(1),
            `${a.percent}%`
        ]);

        const csvContent = "data:text/csv;charset=utf-8,\uFEFF" 
            + [headers.join(','), ...rows.map(r => r.join(','))].join('\n');

        const encodedUri = encodeURI(csvContent);
        const link = document.createElement("a");
        link.setAttribute("href", encodedUri);
        link.setAttribute("download", `dashboard_resumo_mp_${new Date().toISOString().slice(0, 10)}.csv`);
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    };

    // Print dashboard
    const handlePrintDashboard = () => {
        window.print();
    };

    // --- Custom Tooltips ---
    const CustomStatusTooltip = ({ active, payload }: any) => {
        if (active && payload && payload.length) {
            const data = payload[0].payload;
            const pct = totalCount > 0 ? ((data.value / totalCount) * 100).toFixed(1) : '0';
            return (
                <div className="bg-white/95 dark:bg-gray-800/95 p-3 rounded-lg shadow-xl border border-gray-200 dark:border-gray-700 backdrop-blur-sm text-xs">
                    <p className="font-bold text-gray-800 dark:text-white mb-1 flex items-center gap-1.5">
                        <span className="w-2.5 h-2.5 rounded-full inline-block" style={{ backgroundColor: data.color }} />
                        {data.name}
                    </p>
                    <p className="text-gray-600 dark:text-gray-300">
                        Quantidade: <strong className="text-gray-900 dark:text-white">{data.value}</strong>
                    </p>
                    <p className="text-gray-600 dark:text-gray-300">
                        Participação: <strong className="text-primary-600 dark:text-primary-400">{pct}%</strong>
                    </p>
                </div>
            );
        }
        return null;
    };

    const CustomAreaTooltip = ({ active, payload }: any) => {
        if (active && payload && payload.length) {
            const data = payload[0].payload;
            return (
                <div className="bg-white/95 dark:bg-gray-800/95 p-3 rounded-lg shadow-xl border border-gray-200 dark:border-gray-700 backdrop-blur-sm text-xs">
                    <p className="font-bold text-gray-800 dark:text-white mb-1">{data.area}</p>
                    <div className="space-y-0.5 text-gray-600 dark:text-gray-300">
                        <p>Total de Atividades: <strong className="text-gray-900 dark:text-white">{data.total}</strong></p>
                        <p>Concluídas: <strong className="text-emerald-600 dark:text-emerald-400">{data.completed} ({data.percent}%)</strong></p>
                        <p>Em Andamento: <strong className="text-blue-600 dark:text-blue-400">{data.inProgress}</strong></p>
                        <p>Homem x Hora: <strong className="text-amber-600 dark:text-amber-400">{formatMinutesToHours(data.totalManMinutes)}</strong></p>
                    </div>
                </div>
            );
        }
        return null;
    };

    if (activities.length === 0) {
        return (
            <div className="flex flex-col items-center justify-center h-96 bg-white/70 dark:bg-gray-800/70 backdrop-blur-md rounded-xl shadow-lg p-8 border border-gray-200/50 dark:border-gray-700/50 text-center">
                <div className="w-16 h-16 rounded-full bg-cyan-100 dark:bg-cyan-900/40 text-cyan-700 dark:text-cyan-300 flex items-center justify-center mb-4">
                    <ChartPieIcon className="w-8 h-8" />
                </div>
                <h3 className="text-xl font-bold text-gray-800 dark:text-white mb-2">Nenhuma atividade registrada</h3>
                <p className="text-sm text-gray-500 dark:text-gray-400 max-w-md">
                    Importe uma planilha Excel com as tarefas da programação ou crie novas atividades para visualizar gráficos e indicadores completos.
                </p>
            </div>
        );
    }

    return (
        <div className="space-y-5 text-gray-900 dark:text-gray-100 pb-12">
            
            {/* --- TOP HEADER & CONTROLS --- */}
            <div className="bg-white/80 dark:bg-gray-900/85 backdrop-blur-md p-4 sm:p-5 rounded-xl shadow-sm border border-gray-200/60 dark:border-gray-700/60 transition-all">
                <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
                    <div>
                        <div className="flex items-center gap-2">
                            <span className="p-1.5 rounded-lg bg-cyan-600/10 text-cyan-700 dark:text-cyan-300 border border-cyan-500/20">
                                <ChartBarIcon className="w-5 h-5" />
                            </span>
                            <h2 className="text-xl sm:text-2xl font-black text-gray-800 dark:text-white tracking-tight">
                                Painel Executivo e Indicadores MP
                            </h2>
                        </div>
                        <p className="text-xs sm:text-sm text-gray-500 dark:text-gray-400 mt-1">
                            Acompanhamento em tempo real de avanço físico, homem x hora, áreas fabris e aderência à programação.
                        </p>
                    </div>

                    {/* Action buttons & Filter Toggle */}
                    <div className="flex flex-wrap items-center gap-2">
                        <button
                            type="button"
                            onClick={() => setIsFilterBarOpen(!isFilterBarOpen)}
                            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold border transition-all ${
                                hasActiveLocalFilters || isFilterBarOpen
                                    ? 'bg-cyan-50 dark:bg-cyan-950/60 text-cyan-700 dark:text-cyan-300 border-cyan-300 dark:border-cyan-700 shadow-xs'
                                    : 'bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-200 border-gray-300 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-700'
                            }`}
                        >
                            <FunnelIcon className="w-3.5 h-3.5" />
                            <span>Filtros do Dash</span>
                            {hasActiveLocalFilters && (
                                <span className="w-2 h-2 rounded-full bg-cyan-600"></span>
                            )}
                        </button>

                        <button
                            type="button"
                            onClick={handleExportCSV}
                            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-emerald-600 hover:bg-emerald-700 text-white shadow-xs transition-colors"
                            title="Exportar resumo consolidado em formato CSV"
                        >
                            <DocumentArrowDownIcon className="w-3.5 h-3.5" />
                            <span className="hidden sm:inline">Exportar Resumo</span>
                        </button>

                        <button
                            type="button"
                            onClick={handlePrintDashboard}
                            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-blue-600 hover:bg-blue-700 text-white shadow-xs transition-colors"
                            title="Imprimir painel de indicadores"
                        >
                            <PrinterIcon className="w-3.5 h-3.5" />
                            <span className="hidden sm:inline">Imprimir</span>
                        </button>
                    </div>
                </div>

                {/* --- Quick Sub-Navigation Tabs --- */}
                <div className="flex items-center gap-1 sm:gap-2 mt-4 pt-3 border-t border-gray-200/50 dark:border-gray-700/50 overflow-x-auto no-scrollbar">
                    {[
                        { id: 'overview', label: 'Visão Geral & KPIs', icon: <ChartPieIcon className="w-4 h-4" /> },
                        { id: 'manpower', label: 'Homem x Hora (H x H)', icon: <CalculatorIcon className="w-4 h-4" /> },
                        { id: 'areas', label: 'Áreas & Equipamentos', icon: <ChartBarIcon className="w-4 h-4" /> },
                        { id: 'matrix', label: 'Matriz Consolidada', icon: <span className="text-xs">📋</span> },
                    ].map(tab => (
                        <button
                            key={tab.id}
                            onClick={() => setActiveTab(tab.id as DashboardTab)}
                            className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition-all ${
                                activeTab === tab.id
                                    ? 'bg-cyan-700 text-white shadow-sm'
                                    : 'bg-gray-100/70 hover:bg-gray-200/70 dark:bg-gray-800/60 dark:hover:bg-gray-700/60 text-gray-700 dark:text-gray-300'
                            }`}
                        >
                            {tab.icon}
                            <span>{tab.label}</span>
                        </button>
                    ))}
                </div>

                {/* --- Expandable Local Filter Bar --- */}
                {isFilterBarOpen && (
                    <div className="mt-4 pt-3 border-t border-gray-200/50 dark:border-gray-700/50 bg-gray-50/70 dark:bg-gray-800/40 p-3 rounded-lg animate-fadeIn">
                        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-2.5 text-xs">
                            {/* Filter: ID MP */}
                            <div>
                                <label className="block text-[11px] font-semibold text-gray-600 dark:text-gray-300 mb-1">ID da MP</label>
                                <select
                                    value={selectedIdMp}
                                    onChange={(e) => setSelectedIdMp(e.target.value)}
                                    className="w-full p-1.5 rounded border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-800 dark:text-gray-200"
                                >
                                    <option value="all">Todas as MPs ({uniqueIdMps.length})</option>
                                    {uniqueIdMps.map(id => (
                                        <option key={id} value={id}>{id}</option>
                                    ))}
                                </select>
                            </div>

                            {/* Filter: Turno */}
                            <div>
                                <label className="block text-[11px] font-semibold text-gray-600 dark:text-gray-300 mb-1">Turno</label>
                                <select
                                    value={selectedTurno}
                                    onChange={(e) => setSelectedTurno(e.target.value)}
                                    className="w-full p-1.5 rounded border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-800 dark:text-gray-200"
                                >
                                    <option value="all">Todos os Turnos</option>
                                    {uniqueTurnos.map(t => (
                                        <option key={t} value={t}>Turno {t}</option>
                                    ))}
                                </select>
                            </div>

                            {/* Filter: Empresa */}
                            <div>
                                <label className="block text-[11px] font-semibold text-gray-600 dark:text-gray-300 mb-1">Empresa</label>
                                <select
                                    value={selectedEmpresa}
                                    onChange={(e) => setSelectedEmpresa(e.target.value)}
                                    className="w-full p-1.5 rounded border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-800 dark:text-gray-200"
                                >
                                    <option value="all">Todas as Empresas</option>
                                    {uniqueEmpresas.map(emp => (
                                        <option key={emp} value={emp}>{emp}</option>
                                    ))}
                                </select>
                            </div>

                            {/* Filter: Área */}
                            <div>
                                <label className="block text-[11px] font-semibold text-gray-600 dark:text-gray-300 mb-1">Área / Setor</label>
                                <select
                                    value={selectedArea}
                                    onChange={(e) => setSelectedArea(e.target.value)}
                                    className="w-full p-1.5 rounded border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-800 dark:text-gray-200"
                                >
                                    <option value="all">Todas as Áreas ({uniqueAreas.length})</option>
                                    {uniqueAreas.map(area => (
                                        <option key={area} value={area}>{area}</option>
                                    ))}
                                </select>
                            </div>

                            {/* Filter: Criticidade */}
                            <div>
                                <label className="block text-[11px] font-semibold text-gray-600 dark:text-gray-300 mb-1">Criticidade</label>
                                <select
                                    value={selectedCriticidade}
                                    onChange={(e) => setSelectedCriticidade(e.target.value)}
                                    className="w-full p-1.5 rounded border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-800 dark:text-gray-200"
                                >
                                    <option value="all">Todas</option>
                                    <option value={Criticidade.Baixa}>Baixa</option>
                                    <option value={Criticidade.Normal}>Normal</option>
                                    <option value={Criticidade.Alta}>Alta</option>
                                    <option value={Criticidade.Urgente}>Urgente</option>
                                </select>
                            </div>

                            {/* Search */}
                            <div>
                                <label className="block text-[11px] font-semibold text-gray-600 dark:text-gray-300 mb-1">Buscar TAG / Descrição</label>
                                <div className="relative">
                                    <input
                                        type="text"
                                        value={searchTerm}
                                        onChange={(e) => setSearchTerm(e.target.value)}
                                        placeholder="Ex: 601EC01..."
                                        className="w-full pl-7 pr-2 py-1.5 rounded border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-800 dark:text-gray-200"
                                    />
                                    <SearchIcon className="w-3.5 h-3.5 text-gray-400 absolute left-2 top-2" />
                                </div>
                            </div>
                        </div>

                        {hasActiveLocalFilters && (
                            <div className="flex justify-between items-center mt-2.5 pt-2 border-t border-gray-200 dark:border-gray-700 text-xs">
                                <span className="text-gray-500 dark:text-gray-400">
                                    Exibindo <strong>{filteredActivities.length}</strong> de <strong>{activities.length}</strong> atividades
                                </span>
                                <button
                                    type="button"
                                    onClick={handleClearFilters}
                                    className="text-cyan-700 dark:text-cyan-400 hover:underline font-semibold flex items-center gap-1"
                                >
                                    <XMarkIcon className="w-3.5 h-3.5" />
                                    Limpar Filtros
                                </button>
                            </div>
                        )}
                    </div>
                )}
            </div>

            {/* --- 4 EXECUTIVE TOP KPI CARDS --- */}
            <div className="grid grid-cols-2 sm:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
                {/* KPI 1: Atividades & Avanço Físico */}
                <div className="bg-white/80 dark:bg-gray-900/85 backdrop-blur-md p-4 rounded-xl shadow-xs border border-gray-200/60 dark:border-gray-700/60 flex flex-col justify-between">
                    <div>
                        <span className="text-[11px] font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider block">
                            Atividades
                        </span>
                        <div className="flex items-baseline justify-between mt-1">
                            <span className="text-2xl sm:text-3xl font-black text-gray-900 dark:text-white">
                                {totalCount}
                            </span>
                            <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300">
                                {simpleProgress}%
                            </span>
                        </div>
                    </div>
                    <div className="mt-3">
                        <div className="w-full bg-gray-200 dark:bg-gray-700 h-1.5 rounded-full overflow-hidden">
                            <div 
                                className="bg-emerald-500 h-full rounded-full transition-all duration-700" 
                                style={{ width: `${simpleProgress}%` }}
                            />
                        </div>
                        <span className="text-[10px] text-gray-500 dark:text-gray-400 mt-1 block truncate">
                            {completedCount} concluídas de {totalCount}
                        </span>
                    </div>
                </div>

                {/* KPI 2: Homem x Hora Total (H x H) */}
                <div className="bg-white/80 dark:bg-gray-900/85 backdrop-blur-md p-4 rounded-xl shadow-xs border border-gray-200/60 dark:border-gray-700/60 flex flex-col justify-between">
                    <div>
                        <span className="text-[11px] font-bold text-cyan-600 dark:text-cyan-400 uppercase tracking-wider block">
                            Total H x H
                        </span>
                        <div className="flex items-baseline justify-between mt-1">
                            <span className="text-2xl sm:text-3xl font-black text-cyan-700 dark:text-cyan-300">
                                {Math.round(hxhMetrics.totalManMinutes / 60)}h
                            </span>
                            <span className="text-[10px] text-gray-500 dark:text-gray-400 font-medium">
                                {hxhMetrics.uniqueHeadcount} pessoas
                            </span>
                        </div>
                    </div>
                    <div className="mt-3">
                        <div className="w-full bg-gray-200 dark:bg-gray-700 h-1.5 rounded-full overflow-hidden">
                            <div 
                                className="bg-cyan-600 h-full rounded-full transition-all duration-700" 
                                style={{ width: `${weightedProgress}%` }}
                            />
                        </div>
                        <span className="text-[10px] text-gray-500 dark:text-gray-400 mt-1 block truncate">
                            {Math.round(hxhMetrics.completedManMinutes / 60)}h realizadas ({weightedProgress}%)
                        </span>
                    </div>
                </div>

                {/* KPI 3: Em Progresso & Parciais */}
                <div className="bg-white/80 dark:bg-gray-900/85 backdrop-blur-md p-4 rounded-xl shadow-xs border border-gray-200/60 dark:border-gray-700/60 flex flex-col justify-between">
                    <div>
                        <span className="text-[11px] font-bold text-blue-600 dark:text-blue-400 uppercase tracking-wider block">
                            Em Execução
                        </span>
                        <div className="flex items-baseline justify-between mt-1">
                            <span className="text-2xl sm:text-3xl font-black text-blue-600 dark:text-blue-400">
                                {inProgressCount}
                            </span>
                            <span className="text-[10px] text-gray-500 dark:text-gray-400">
                                {totalCount > 0 ? Math.round((inProgressCount / totalCount) * 100) : 0}%
                            </span>
                        </div>
                    </div>
                    <div className="mt-3">
                        <span className="text-[10px] text-blue-700 dark:text-blue-300 bg-blue-50 dark:bg-blue-950/50 px-2 py-0.5 rounded font-medium block truncate">
                            {statusCounts[ActivityStatus.ExecutadoParcialmente] || 0} executadas parcialmente
                        </span>
                    </div>
                </div>

                {/* KPI 4: Pendentes & Não Executadas */}
                <div className="bg-white/80 dark:bg-gray-900/85 backdrop-blur-md p-4 rounded-xl shadow-xs border border-gray-200/60 dark:border-gray-700/60 flex flex-col justify-between">
                    <div>
                        <span className="text-[11px] font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider block">
                            Aguardando / Não Exec.
                        </span>
                        <div className="flex items-baseline justify-between mt-1">
                            <span className="text-2xl sm:text-3xl font-black text-gray-700 dark:text-gray-300">
                                {pendingCount + notExecutedCount}
                            </span>
                            {notExecutedCount > 0 && (
                                <span className="text-xs font-bold px-1.5 py-0.5 rounded bg-red-100 text-red-700 dark:bg-red-950/60 dark:text-red-300">
                                    {notExecutedCount} não exec.
                                </span>
                            )}
                        </div>
                    </div>
                    <div className="mt-3">
                        <span className="text-[10px] text-gray-500 dark:text-gray-400 block truncate">
                            {pendingCount} ainda não iniciadas
                        </span>
                    </div>
                </div>
            </div>

            {/* --- TAB 1: VISÃO GERAL & KPIS --- */}
            {activeTab === 'overview' && (
                <div className="space-y-5 animate-fadeIn">
                    
                    {/* Double Progress Bars: Simple vs Weighted HxH */}
                    <div className="bg-white/80 dark:bg-gray-900/85 backdrop-blur-md p-5 rounded-xl shadow-sm border border-gray-200/60 dark:border-gray-700/60">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            {/* Progresso por Contagem */}
                            <div>
                                <div className="flex justify-between items-center mb-1.5">
                                    <span className="text-xs font-bold text-gray-700 dark:text-gray-300">
                                        Progresso Físico Simples (Por Atividade)
                                    </span>
                                    <span className="text-sm font-black text-emerald-600 dark:text-emerald-400">
                                        {simpleProgress}%
                                    </span>
                                </div>
                                <div className="w-full bg-gray-200 dark:bg-gray-700 h-3 rounded-full overflow-hidden relative">
                                    <div 
                                        className="bg-gradient-to-r from-emerald-500 to-teal-400 h-full rounded-full transition-all duration-1000"
                                        style={{ width: `${simpleProgress}%` }}
                                    />
                                </div>
                                <div className="flex justify-between mt-1 text-[11px] text-gray-500 dark:text-gray-400">
                                    <span>{completedCount} atividades concluídas</span>
                                    <span>{totalCount - completedCount} pendentes / em andamento</span>
                                </div>
                            </div>

                            {/* Progresso Ponderado por Homem x Hora */}
                            <div>
                                <div className="flex justify-between items-center mb-1.5">
                                    <span className="text-xs font-bold text-gray-700 dark:text-gray-300">
                                        Progresso Ponderado por Homem x Hora (H x H)
                                    </span>
                                    <span className="text-sm font-black text-cyan-600 dark:text-cyan-400">
                                        {weightedProgress}%
                                    </span>
                                </div>
                                <div className="w-full bg-gray-200 dark:bg-gray-700 h-3 rounded-full overflow-hidden relative">
                                    <div 
                                        className="bg-gradient-to-r from-cyan-600 to-blue-500 h-full rounded-full transition-all duration-1000"
                                        style={{ width: `${weightedProgress}%` }}
                                    />
                                </div>
                                <div className="flex justify-between mt-1 text-[11px] text-gray-500 dark:text-gray-400">
                                    <span>{formatMinutesToHours(hxhMetrics.completedManMinutes)} executadas</span>
                                    <span>Meta Total: {formatMinutesToHours(hxhMetrics.totalManMinutes)}</span>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Charts Grid Row 1: Status & Áreas */}
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
                        
                        {/* Gráfico 1: Atividades por Status */}
                        <div className="bg-white/80 dark:bg-gray-900/85 backdrop-blur-md p-5 rounded-xl shadow-sm border border-gray-200/60 dark:border-gray-700/60 flex flex-col h-[380px]">
                            <div className="flex justify-between items-center mb-4">
                                <div>
                                    <h3 className="text-sm font-bold text-gray-800 dark:text-white flex items-center gap-1.5">
                                        <ChartPieIcon className="w-4 h-4 text-cyan-600" />
                                        Distribuição de Status
                                    </h3>
                                    <p className="text-[11px] text-gray-500 dark:text-gray-400">Status atual de cada etapa da programação</p>
                                </div>
                                <div className="flex bg-gray-100 dark:bg-gray-800 rounded-lg p-0.5">
                                    <button 
                                        onClick={() => setStatusChartType('pie')}
                                        className={`px-2 py-1 text-xs rounded-md font-medium transition ${statusChartType === 'pie' ? 'bg-white dark:bg-gray-700 text-cyan-700 dark:text-white shadow-xs' : 'text-gray-500'}`}
                                    >
                                        Pizza
                                    </button>
                                    <button 
                                        onClick={() => setStatusChartType('bar')}
                                        className={`px-2 py-1 text-xs rounded-md font-medium transition ${statusChartType === 'bar' ? 'bg-white dark:bg-gray-700 text-cyan-700 dark:text-white shadow-xs' : 'text-gray-500'}`}
                                    >
                                        Barras
                                    </button>
                                </div>
                            </div>

                            <div className="flex-1 w-full min-h-0">
                                <ResponsiveContainer width="100%" height="100%">
                                    {statusChartType === 'pie' ? (
                                        <PieChart>
                                            <Pie
                                                data={statusChartData}
                                                dataKey="value"
                                                nameKey="name"
                                                cx="50%"
                                                cy="50%"
                                                innerRadius={55}
                                                outerRadius={95}
                                                paddingAngle={3}
                                                animationDuration={800}
                                            >
                                                {statusChartData.map((entry) => (
                                                    <Cell key={`cell-${entry.key}`} fill={entry.color} stroke="#fff" strokeWidth={1.5} />
                                                ))}
                                            </Pie>
                                            <Tooltip content={<CustomStatusTooltip />} />
                                            <Legend verticalAlign="bottom" height={36} iconType="circle" wrapperStyle={{ fontSize: '11px' }} />
                                        </PieChart>
                                    ) : (
                                        <BarChart data={statusChartData} margin={{ top: 10, right: 20, left: -10, bottom: 20 }}>
                                            <CartesianGrid strokeDasharray="3 3" vertical={false} strokeOpacity={0.15} />
                                            <XAxis dataKey="name" tick={{ fill: '#64748b', fontSize: 10 }} interval={0} angle={-15} textAnchor="end" />
                                            <YAxis tick={{ fill: '#64748b', fontSize: 10 }} allowDecimals={false} />
                                            <Tooltip content={<CustomStatusTooltip />} />
                                            <Bar dataKey="value" radius={[4, 4, 0, 0]}>
                                                {statusChartData.map((entry) => (
                                                    <Cell key={`bar-${entry.key}`} fill={entry.color} />
                                                ))}
                                            </Bar>
                                        </BarChart>
                                    )}
                                </ResponsiveContainer>
                            </div>
                        </div>

                        {/* Gráfico 2: Atividades por Área Operacional */}
                        <div className="bg-white/80 dark:bg-gray-900/85 backdrop-blur-md p-5 rounded-xl shadow-sm border border-gray-200/60 dark:border-gray-700/60 flex flex-col h-[380px]">
                            <div className="flex justify-between items-center mb-4">
                                <div>
                                    <h3 className="text-sm font-bold text-gray-800 dark:text-white flex items-center gap-1.5">
                                        <ChartBarIcon className="w-4 h-4 text-cyan-600" />
                                        Atividades por Área Operacional
                                    </h3>
                                    <p className="text-[11px] text-gray-500 dark:text-gray-400">Volume de tarefas em cada setor da fábrica</p>
                                </div>
                                <span className="text-xs font-semibold text-gray-500 dark:text-gray-400">
                                    {areaBreakdown.length} áreas ativas
                                </span>
                            </div>

                            <div className="flex-1 w-full min-h-0">
                                <ResponsiveContainer width="100%" height="100%">
                                    <BarChart 
                                        data={areaBreakdown.slice(0, 8)} 
                                        layout="vertical"
                                        margin={{ top: 5, right: 30, left: 20, bottom: 5 }}
                                    >
                                        <CartesianGrid strokeDasharray="3 3" horizontal={false} strokeOpacity={0.15} />
                                        <XAxis type="number" tick={{ fill: '#64748b', fontSize: 10 }} allowDecimals={false} />
                                        <YAxis dataKey="area" type="category" tick={{ fill: '#64748b', fontSize: 10 }} width={80} />
                                        <Tooltip content={<CustomAreaTooltip />} />
                                        <Legend verticalAlign="bottom" height={30} wrapperStyle={{ fontSize: '11px' }} />
                                        <Bar dataKey="completed" name="Concluídas" stackId="a" fill="#10b981" radius={[0, 0, 0, 0]} />
                                        <Bar dataKey="inProgress" name="Em Andamento" stackId="a" fill="#3b82f6" />
                                        <Bar dataKey="pending" name="Abertas" stackId="a" fill="#64748b" radius={[0, 4, 4, 0]} />
                                    </BarChart>
                                </ResponsiveContainer>
                            </div>
                        </div>
                    </div>

                    {/* Status Summary Pill Cards */}
                    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-3">
                        {statusChartData.map((item) => (
                            <div 
                                key={item.key} 
                                className="bg-white/80 dark:bg-gray-900/85 backdrop-blur-md p-3.5 rounded-xl shadow-xs border-l-4 flex flex-col justify-between transition-transform hover:scale-[1.02]" 
                                style={{ borderColor: item.color }}
                            >
                                <span className="text-[10px] font-bold uppercase tracking-wider text-gray-500 dark:text-gray-400 truncate">
                                    {item.name}
                                </span>
                                <div className="flex items-baseline justify-between mt-1">
                                    <span className="text-2xl font-bold text-gray-900 dark:text-white">{item.value}</span>
                                    <span className="text-xs font-semibold text-gray-400">
                                        {totalCount > 0 ? ((item.value / totalCount) * 100).toFixed(0) : 0}%
                                    </span>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {/* --- TAB 2: HOMEM X HORA (H X H) & RECURSOS --- */}
            {activeTab === 'manpower' && (
                <div className="space-y-5 animate-fadeIn">
                    
                    {/* HxH Summary Hero */}
                    <div className="bg-white/80 dark:bg-gray-900/85 backdrop-blur-md p-5 rounded-xl shadow-sm border border-gray-200/60 dark:border-gray-700/60">
                        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                            <div>
                                <h3 className="text-lg font-bold text-gray-800 dark:text-white flex items-center gap-2">
                                    <CalculatorIcon className="w-5 h-5 text-cyan-600" />
                                    Análise de Homem x Hora (H x H) e Alocação de Equipes
                                </h3>
                                <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                                    O cálculo de HxH multiplica a duração estimada de cada atividade pela quantidade de executantes/responsáveis associados.
                                </p>
                            </div>
                            <div className="flex items-center gap-3">
                                <div className="p-3 bg-cyan-50 dark:bg-cyan-950/50 rounded-xl border border-cyan-200 dark:border-cyan-800/60 text-right">
                                    <span className="block text-[10px] font-bold uppercase text-cyan-700 dark:text-cyan-300">Total H x H Geral</span>
                                    <span className="text-2xl font-black text-cyan-800 dark:text-cyan-200">
                                        {formatMinutesToHours(hxhMetrics.totalManMinutes)}
                                    </span>
                                </div>
                            </div>
                        </div>

                        {/* HxH Metrics Breakdown */}
                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-4 pt-4 border-t border-gray-200/50 dark:border-gray-700/50 text-xs">
                            <div className="p-3 rounded-lg bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800/40">
                                <span className="font-semibold text-emerald-800 dark:text-emerald-300 block">HxH Concluído</span>
                                <span className="text-xl font-bold text-emerald-700 dark:text-emerald-400">
                                    {formatMinutesToHours(hxhMetrics.completedManMinutes)}
                                </span>
                                <span className="text-[10px] text-emerald-600 block mt-0.5">({weightedProgress}% da meta)</span>
                            </div>

                            <div className="p-3 rounded-lg bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-800/40">
                                <span className="font-semibold text-blue-800 dark:text-blue-300 block">HxH Em Andamento</span>
                                <span className="text-xl font-bold text-blue-700 dark:text-blue-400">
                                    {formatMinutesToHours(hxhMetrics.inProgressManMinutes)}
                                </span>
                                <span className="text-[10px] text-blue-600 block mt-0.5">
                                    {hxhMetrics.totalManMinutes > 0 ? Math.round((hxhMetrics.inProgressManMinutes / hxhMetrics.totalManMinutes) * 100) : 0}% em execução
                                </span>
                            </div>

                            <div className="p-3 rounded-lg bg-gray-50 dark:bg-gray-800/50 border border-gray-200 dark:border-gray-700/60">
                                <span className="font-semibold text-gray-700 dark:text-gray-300 block">HxH Pendente</span>
                                <span className="text-xl font-bold text-gray-800 dark:text-gray-200">
                                    {formatMinutesToHours(hxhMetrics.pendingManMinutes)}
                                </span>
                                <span className="text-[10px] text-gray-500 block mt-0.5">Horas a realizar</span>
                            </div>

                            <div className="p-3 rounded-lg bg-purple-50 dark:bg-purple-950/30 border border-purple-200 dark:border-purple-800/40">
                                <span className="font-semibold text-purple-800 dark:text-purple-300 block">Efetivo Mobilizado</span>
                                <span className="text-xl font-bold text-purple-700 dark:text-purple-400">
                                    {hxhMetrics.uniqueHeadcount}
                                </span>
                                <span className="text-[10px] text-purple-600 block mt-0.5">Pessoas / Técnicos</span>
                            </div>
                        </div>
                    </div>

                    {/* HxH Charts: Por Empresa e Responsáveis */}
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
                        
                        {/* HxH por Empresa */}
                        <div className="bg-white/80 dark:bg-gray-900/85 backdrop-blur-md p-5 rounded-xl shadow-sm border border-gray-200/60 dark:border-gray-700/60 flex flex-col h-[350px]">
                            <h3 className="text-sm font-bold text-gray-800 dark:text-white mb-1">
                                Homem x Hora (H x H) por Empresa / Contratada
                            </h3>
                            <p className="text-[11px] text-gray-500 dark:text-gray-400 mb-3">
                                Distribuição de esforço entre FOSPAR e empresas prestadoras de serviço
                            </p>
                            <div className="flex-1 w-full min-h-0">
                                <ResponsiveContainer width="100%" height="100%">
                                    <BarChart data={empresaBreakdown} margin={{ top: 10, right: 20, left: -10, bottom: 5 }}>
                                        <CartesianGrid strokeDasharray="3 3" vertical={false} strokeOpacity={0.15} />
                                        <XAxis dataKey="empresa" tick={{ fill: '#64748b', fontSize: 11 }} />
                                        <YAxis tick={{ fill: '#64748b', fontSize: 10 }} />
                                        <Tooltip 
                                            formatter={(val: any) => [`${val} horas`, 'Total HxH']}
                                        />
                                        <Bar dataKey="hhHours" name="Horas HxH" fill="#0d9488" radius={[4, 4, 0, 0]} />
                                    </BarChart>
                                </ResponsiveContainer>
                            </div>
                        </div>

                        {/* Top Responsáveis por HxH */}
                        <div className="bg-white/80 dark:bg-gray-900/85 backdrop-blur-md p-5 rounded-xl shadow-sm border border-gray-200/60 dark:border-gray-700/60 flex flex-col h-[350px]">
                            <h3 className="text-sm font-bold text-gray-800 dark:text-white mb-1">
                                Top Responsáveis por Carga Horária (HxH)
                            </h3>
                            <p className="text-[11px] text-gray-500 dark:text-gray-400 mb-3">
                                Executantes com maior volume de horas acumuladas na programação
                            </p>
                            <div className="flex-1 w-full min-h-0 overflow-y-auto pr-1 space-y-2.5">
                                {topResponsaveis.map((resp, idx) => (
                                    <div key={resp.name} className="p-2 rounded-lg bg-gray-50/70 dark:bg-gray-800/50 border border-gray-200/50 dark:border-gray-700/50 text-xs">
                                        <div className="flex justify-between items-center mb-1">
                                            <span className="font-semibold text-gray-800 dark:text-gray-200 truncate max-w-[200px]" title={resp.name}>
                                                #{idx + 1} {resp.name}
                                            </span>
                                            <span className="font-bold text-cyan-700 dark:text-cyan-300">
                                                {resp.hhHours}h ({resp.count} ativ.)
                                            </span>
                                        </div>
                                        <div className="w-full bg-gray-200 dark:bg-gray-700 h-1.5 rounded-full overflow-hidden">
                                            <div 
                                                className="bg-cyan-600 h-full rounded-full" 
                                                style={{ width: `${resp.percent}%` }}
                                            />
                                        </div>
                                        <div className="flex justify-between mt-1 text-[10px] text-gray-400">
                                            <span>{resp.completedCount} concluídas</span>
                                            <span>{resp.percent}% concluído</span>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* --- TAB 3: ÁREAS & EQUIPAMENTOS (TAGS) --- */}
            {activeTab === 'areas' && (
                <div className="space-y-5 animate-fadeIn">
                    
                    {/* Comparative Area Bar Chart */}
                    <div className="bg-white/80 dark:bg-gray-900/85 backdrop-blur-md p-5 rounded-xl shadow-sm border border-gray-200/60 dark:border-gray-700/60">
                        <div className="flex justify-between items-center mb-4">
                            <div>
                                <h3 className="text-sm font-bold text-gray-800 dark:text-white">
                                    Comparativo de Carga e H x H por Área Fabril
                                </h3>
                                <p className="text-[11px] text-gray-500 dark:text-gray-400">
                                    Quantidade de atividades e horas estimadas alocadas por setor
                                </p>
                            </div>
                        </div>

                        <div className="h-[360px] w-full">
                            <ResponsiveContainer width="100%" height="100%">
                                <ComposedChart data={areaBreakdown} margin={{ top: 10, right: 30, left: 0, bottom: 25 }}>
                                    <CartesianGrid strokeDasharray="3 3" vertical={false} strokeOpacity={0.15} />
                                    <XAxis dataKey="area" tick={{ fill: '#64748b', fontSize: 10 }} interval={0} angle={-25} textAnchor="end" />
                                    <YAxis yAxisId="left" tick={{ fill: '#64748b', fontSize: 10 }} allowDecimals={false} />
                                    <YAxis yAxisId="right" orientation="right" tick={{ fill: '#64748b', fontSize: 10 }} />
                                    <Tooltip content={<CustomAreaTooltip />} />
                                    <Legend verticalAlign="top" height={36} wrapperStyle={{ fontSize: '11px' }} />
                                    <Bar yAxisId="left" dataKey="total" name="Qtd Atividades" fill="#3b82f6" radius={[4, 4, 0, 0]} />
                                    <Line yAxisId="right" type="monotone" dataKey="hhHours" name="Horas HxH" stroke="#f59e0b" strokeWidth={2.5} dot={{ r: 4 }} />
                                </ComposedChart>
                            </ResponsiveContainer>
                        </div>
                    </div>

                    {/* Top 10 Equipments / TAGs */}
                    <div className="bg-white/80 dark:bg-gray-900/85 backdrop-blur-md p-5 rounded-xl shadow-sm border border-gray-200/60 dark:border-gray-700/60">
                        <div className="flex justify-between items-center mb-4">
                            <div>
                                <h3 className="text-sm font-bold text-gray-800 dark:text-white">
                                    Equipamentos (TAGs) com Maior Demanda de Intervenção
                                </h3>
                                <p className="text-[11px] text-gray-500 dark:text-gray-400">
                                    Ranking das máquinas e sistemas que concentram mais horas e recursos na parada
                                </p>
                            </div>
                            <span className="text-xs font-semibold px-2.5 py-1 rounded bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-300">
                                Top 10 TAGs
                            </span>
                        </div>

                        <div className="overflow-x-auto">
                            <table className="w-full text-xs text-left">
                                <thead className="bg-gray-50/80 dark:bg-gray-800/80 text-gray-600 dark:text-gray-300 uppercase font-bold text-[10px] border-b border-gray-200 dark:border-gray-700">
                                    <tr>
                                        <th className="px-3 py-2.5">TAG</th>
                                        <th className="px-3 py-2.5">Descrição</th>
                                        <th className="px-3 py-2.5">Área</th>
                                        <th className="px-3 py-2.5 text-center">Duração</th>
                                        <th className="px-3 py-2.5 text-center">Efetivo</th>
                                        <th className="px-3 py-2.5 text-center">Total HxH</th>
                                        <th className="px-3 py-2.5 text-center">Criticidade</th>
                                        <th className="px-3 py-2.5 text-right">Status</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                                    {topTags.map(act => (
                                        <tr key={act.id} className="hover:bg-gray-50/60 dark:hover:bg-gray-800/40 transition">
                                            <td className="px-3 py-2 font-mono font-bold text-cyan-700 dark:text-cyan-400">
                                                {act.tag || '-'}
                                            </td>
                                            <td className="px-3 py-2 max-w-xs truncate text-gray-800 dark:text-gray-200" title={act.descricao}>
                                                {act.descricao}
                                            </td>
                                            <td className="px-3 py-2 text-gray-600 dark:text-gray-400">
                                                {act.area || '-'}
                                            </td>
                                            <td className="px-3 py-2 text-center font-mono">
                                                {act.duracao || '-'}
                                            </td>
                                            <td className="px-3 py-2 text-center">
                                                <span className="px-1.5 py-0.5 rounded bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 font-semibold">
                                                    {act.headcount}
                                                </span>
                                            </td>
                                            <td className="px-3 py-2 text-center font-bold text-amber-600 dark:text-amber-400">
                                                {formatMinutesToHours(act.manMin)}
                                            </td>
                                            <td className="px-3 py-2 text-center">
                                                <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${getCriticidadeClasses(act.criticidade)}`}>
                                                    {act.criticidade}
                                                </span>
                                            </td>
                                            <td className="px-3 py-2 text-right">
                                                <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${getStatusClasses(act.status)}`}>
                                                    {getStatusLabel(act.status, customStatusLabels)}
                                                </span>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </div>
                </div>
            )}

            {/* --- TAB 4: MATRIZ CONSOLIDADA (TABELA SINTÉTICA) --- */}
            {activeTab === 'matrix' && (
                <div className="space-y-5 animate-fadeIn">
                    <div className="bg-white/80 dark:bg-gray-900/85 backdrop-blur-md p-5 rounded-xl shadow-sm border border-gray-200/60 dark:border-gray-700/60">
                        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2 mb-4">
                            <div>
                                <h3 className="text-sm font-bold text-gray-800 dark:text-white">
                                    Matriz Consolidada de Execução por Área
                                </h3>
                                <p className="text-[11px] text-gray-500 dark:text-gray-400">
                                    Visão sintética do status de cada setor da planta, homem x hora e progresso acumulado
                                </p>
                            </div>
                            <button
                                type="button"
                                onClick={handleExportCSV}
                                className="flex items-center gap-1 text-xs font-semibold text-cyan-700 dark:text-cyan-400 hover:underline"
                            >
                                <DocumentArrowDownIcon className="w-3.5 h-3.5" />
                                Exportar Matriz (CSV)
                            </button>
                        </div>

                        <div className="overflow-x-auto">
                            <table className="w-full text-xs text-left">
                                <thead className="bg-gray-50/80 dark:bg-gray-800/80 text-gray-600 dark:text-gray-300 uppercase font-bold text-[10px] border-b border-gray-200 dark:border-gray-700">
                                    <tr>
                                        <th className="px-3 py-2.5">Área / Setor</th>
                                        <th className="px-3 py-2.5 text-center">Total Ativ.</th>
                                        <th className="px-3 py-2.5 text-center text-emerald-600 dark:text-emerald-400">Concluídas</th>
                                        <th className="px-3 py-2.5 text-center text-blue-600 dark:text-blue-400">Em Andamento</th>
                                        <th className="px-3 py-2.5 text-center text-gray-500">Pendentes</th>
                                        <th className="px-3 py-2.5 text-center text-red-500">Não Exec.</th>
                                        <th className="px-3 py-2.5 text-center">H x H</th>
                                        <th className="px-3 py-2.5 text-center w-36">Avanço Físico</th>
                                        <th className="px-3 py-2.5 text-right">Status da Área</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                                    {areaBreakdown.map(row => (
                                        <tr key={row.area} className="hover:bg-gray-50/60 dark:hover:bg-gray-800/40 transition">
                                            <td className="px-3 py-2.5 font-bold text-gray-900 dark:text-white">
                                                {row.area}
                                            </td>
                                            <td className="px-3 py-2.5 text-center font-semibold">
                                                {row.total}
                                            </td>
                                            <td className="px-3 py-2.5 text-center font-bold text-emerald-600 dark:text-emerald-400">
                                                {row.completed}
                                            </td>
                                            <td className="px-3 py-2.5 text-center font-semibold text-blue-600 dark:text-blue-400">
                                                {row.inProgress}
                                            </td>
                                            <td className="px-3 py-2.5 text-center text-gray-600 dark:text-gray-400">
                                                {row.pending}
                                            </td>
                                            <td className="px-3 py-2.5 text-center text-red-600 font-semibold">
                                                {row.notExecuted || 0}
                                            </td>
                                            <td className="px-3 py-2.5 text-center font-mono font-bold text-cyan-700 dark:text-cyan-300">
                                                {formatMinutesToHours(row.totalManMinutes)}
                                            </td>
                                            <td className="px-3 py-2.5">
                                                <div className="flex items-center gap-2">
                                                    <div className="w-full bg-gray-200 dark:bg-gray-700 h-2 rounded-full overflow-hidden">
                                                        <div 
                                                            className="bg-emerald-500 h-full rounded-full" 
                                                            style={{ width: `${row.percent}%` }}
                                                        />
                                                    </div>
                                                    <span className="text-[10px] font-bold text-gray-700 dark:text-gray-300 min-w-[28px]">
                                                        {row.percent}%
                                                    </span>
                                                </div>
                                            </td>
                                            <td className="px-3 py-2.5 text-right">
                                                {row.percent === 100 ? (
                                                    <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300">
                                                        100% Concluído
                                                    </span>
                                                ) : row.percent > 0 ? (
                                                    <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-blue-100 text-blue-800 dark:bg-blue-950/60 dark:text-blue-300">
                                                        Em Execução
                                                    </span>
                                                ) : (
                                                    <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300">
                                                        Não Iniciado
                                                    </span>
                                                )}
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                                <tfoot className="bg-gray-100/90 dark:bg-gray-800/90 font-bold border-t-2 border-gray-300 dark:border-gray-600 text-[11px]">
                                    <tr>
                                        <td className="px-3 py-2.5">Total Consolidado</td>
                                        <td className="px-3 py-2.5 text-center">{totalCount}</td>
                                        <td className="px-3 py-2.5 text-center text-emerald-600 dark:text-emerald-400">{completedCount}</td>
                                        <td className="px-3 py-2.5 text-center text-blue-600 dark:text-blue-400">{inProgressCount}</td>
                                        <td className="px-3 py-2.5 text-center">{pendingCount}</td>
                                        <td className="px-3 py-2.5 text-center text-red-600">{notExecutedCount}</td>
                                        <td className="px-3 py-2.5 text-center font-mono text-cyan-700 dark:text-cyan-300">
                                            {formatMinutesToHours(hxhMetrics.totalManMinutes)}
                                        </td>
                                        <td className="px-3 py-2.5 text-center">{simpleProgress}%</td>
                                        <td className="px-3 py-2.5 text-right font-black text-cyan-700 dark:text-cyan-400">
                                            {simpleProgress}% Geral
                                        </td>
                                    </tr>
                                </tfoot>
                            </table>
                        </div>
                    </div>
                </div>
            )}

        </div>
    );
};
