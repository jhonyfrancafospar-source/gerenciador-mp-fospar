import React, { useState, useMemo } from 'react';
import {
    ResponsiveContainer,
    ComposedChart,
    Line,
    Bar,
    XAxis,
    YAxis,
    CartesianGrid,
    Tooltip,
    Legend,
    ReferenceLine
} from 'recharts';
import type { Activity } from '../types';
import { ActivityStatus } from '../types';
import { calculateSCurveData, getActivityProgress } from '../utils/scurveUtils';
import { getStatusClasses, getStatusLabel, getCriticidadeClasses } from '../utils/styleUtils';
import { PencilIcon } from './icons/PencilIcon';
import { SearchIcon } from './icons/SearchIcon';
import { CurveIcon } from './icons/CurveIcon';

interface SCurveViewProps {
    activities: Activity[];
    onEdit: (activity: Activity) => void;
    onUpdateStatus: (activityId: string, status: ActivityStatus) => void;
    onUpdateActivity: (activity: Activity) => void;
    customStatusLabels?: Record<string, string>;
}

export const SCurveView: React.FC<SCurveViewProps> = ({
    activities,
    onEdit,
    onUpdateStatus,
    onUpdateActivity,
    customStatusLabels = {}
}) => {
    const [granularity, setGranularity] = useState<'auto' | 'hour' | 'shift' | 'day'>('auto');
    const [weightMode, setWeightMode] = useState<'duration' | 'count'>('duration');
    const [showBars, setShowBars] = useState<boolean>(true);
    const [searchTerm, setSearchTerm] = useState<string>('');
    const [statusFilter, setStatusFilter] = useState<string>('all');
    const [viewMode, setViewMode] = useState<'both' | 'chart' | 'table'>('both');

    // Calculate S-Curve points & summary based on all current activities
    const { points, summary } = useMemo(() => {
        return calculateSCurveData(activities, granularity, weightMode);
    }, [activities, granularity, weightMode]);

    // Local filter for the activities table in this view
    const filteredActivities = useMemo(() => {
        return activities.filter(a => {
            if (statusFilter !== 'all' && a.status !== statusFilter) return false;
            if (!searchTerm) return true;
            const term = searchTerm.toLowerCase();
            return (
                a.tag.toLowerCase().includes(term) ||
                a.descricao.toLowerCase().includes(term) ||
                (a.empresa && a.empresa.toLowerCase().includes(term)) ||
                a.responsavel.toLowerCase().includes(term) ||
                (a.idMp && a.idMp.toLowerCase().includes(term)) ||
                a.area.toLowerCase().includes(term)
            );
        });
    }, [activities, searchTerm, statusFilter]);

    const handleProgressChange = (activity: Activity, newProgress: number) => {
        const clamped = Math.min(100, Math.max(0, Math.round(newProgress)));
        let newStatus = activity.status;
        let newHoraFimReal = activity.horaFimReal;
        let newHoraInicioReal = activity.horaInicioReal;

        if (clamped === 100) {
            newStatus = ActivityStatus.Closed;
            if (!newHoraFimReal) {
                newHoraFimReal = new Date().toISOString();
            }
        } else if (clamped > 0 && activity.status === ActivityStatus.Open) {
            newStatus = ActivityStatus.EmProgresso;
            if (!newHoraInicioReal) {
                newHoraInicioReal = new Date().toISOString();
            }
        } else if (clamped === 0 && activity.status === ActivityStatus.Closed) {
            newStatus = ActivityStatus.Open;
        }

        const updated: Activity = {
            ...activity,
            progresso: clamped,
            status: newStatus,
            horaInicioReal: newHoraInicioReal,
            horaFimReal: newHoraFimReal
        };

        onUpdateActivity(updated);
    };

    const handleDirectStatusChange = (activity: Activity, newStatus: ActivityStatus) => {
        let newProgress = activity.progresso;
        let newHoraFimReal = activity.horaFimReal;

        if (newStatus === ActivityStatus.Closed) {
            newProgress = 100;
            if (!newHoraFimReal) {
                newHoraFimReal = new Date().toISOString();
            }
        } else if (newStatus === ActivityStatus.Open && (activity.progresso === 100)) {
            newProgress = 0;
        }

        const updated: Activity = {
            ...activity,
            status: newStatus,
            progresso: newProgress,
            horaFimReal: newHoraFimReal
        };

        onUpdateActivity(updated);
    };

    // Custom Tooltip for S-Curve
    const CustomTooltip = ({ active, payload, label }: any) => {
        if (active && payload && payload.length) {
            const dataPoint = payload[0].payload;
            return (
                <div className="bg-white/95 dark:bg-gray-800/95 backdrop-blur-md p-3 rounded-lg shadow-xl border border-gray-200 dark:border-gray-700 text-xs space-y-1.5 min-w-[220px]">
                    <p className="font-bold text-gray-900 dark:text-white border-b border-gray-200 dark:border-gray-700 pb-1">
                        {dataPoint.label}
                    </p>
                    <div className="flex justify-between items-center text-blue-600 dark:text-blue-400 font-semibold">
                        <span>Planejado Acumulado:</span>
                        <span>{dataPoint.planejadoAcumulado}%</span>
                    </div>
                    {dataPoint.realAcumulado !== null && (
                        <div className="flex justify-between items-center text-emerald-600 dark:text-emerald-400 font-semibold">
                            <span>Real Acumulado:</span>
                            <span>{dataPoint.realAcumulado}%</span>
                        </div>
                    )}
                    {dataPoint.desvio !== null && (
                        <div className={`flex justify-between items-center font-bold ${
                            dataPoint.desvio >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400'
                        }`}>
                            <span>Desvio (GAP):</span>
                            <span>{dataPoint.desvio > 0 ? `+${dataPoint.desvio}%` : `${dataPoint.desvio}%`}</span>
                        </div>
                    )}
                    {showBars && (
                        <div className="pt-1.5 mt-1 border-t border-gray-100 dark:border-gray-700 text-gray-500 dark:text-gray-400">
                            <div className="flex justify-between">
                                <span>No Período (Plan):</span>
                                <span>+{dataPoint.planejadoPeriodo}%</span>
                            </div>
                            {dataPoint.realPeriodo !== null && (
                                <div className="flex justify-between">
                                    <span>No Período (Real):</span>
                                    <span>+{dataPoint.realPeriodo}%</span>
                                </div>
                            )}
                        </div>
                    )}
                </div>
            );
        }
        return null;
    };

    return (
        <div className="space-y-4">
            {/* Top KPI Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                {/* Card 1: Real Progress */}
                <div className="bg-white/80 dark:bg-gray-800/80 backdrop-blur-md rounded-xl p-4 shadow-sm border border-gray-200/50 dark:border-gray-700/50 flex flex-col justify-between">
                    <div className="flex items-center justify-between">
                        <span className="text-xs font-bold uppercase tracking-wider text-gray-500 dark:text-gray-400">Avanço Físico Real</span>
                        <span className="p-1.5 rounded-lg bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400">
                            <CurveIcon className="w-5 h-5" />
                        </span>
                    </div>
                    <div className="mt-2">
                        <div className="flex items-baseline space-x-2">
                            <span className="text-3xl font-extrabold text-emerald-600 dark:text-emerald-400">
                                {summary.progressoRealTotal}%
                            </span>
                            <span className="text-xs text-gray-500 dark:text-gray-400">
                                de 100% planejado
                            </span>
                        </div>
                        <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2 mt-2 overflow-hidden">
                            <div
                                className="bg-emerald-500 h-2 rounded-full transition-all duration-500"
                                style={{ width: `${Math.min(100, summary.progressoRealTotal)}%` }}
                            />
                        </div>
                    </div>
                    <div className="mt-2 text-[11px] text-gray-500 dark:text-gray-400 flex justify-between">
                        <span>Horas Executadas:</span>
                        <span className="font-semibold text-gray-700 dark:text-gray-300">{summary.horasReais}h / {summary.horasPlanejadas}h</span>
                    </div>
                </div>

                {/* Card 2: Planned Progress */}
                <div className="bg-white/80 dark:bg-gray-800/80 backdrop-blur-md rounded-xl p-4 shadow-sm border border-gray-200/50 dark:border-gray-700/50 flex flex-col justify-between">
                    <div className="flex items-center justify-between">
                        <span className="text-xs font-bold uppercase tracking-wider text-gray-500 dark:text-gray-400">Planejado (Marco Atual)</span>
                        <span className="p-1.5 rounded-lg bg-blue-50 dark:bg-blue-950/40 text-blue-600 dark:text-blue-400">
                            <CurveIcon className="w-5 h-5" />
                        </span>
                    </div>
                    <div className="mt-2">
                        <div className="flex items-baseline space-x-2">
                            <span className="text-3xl font-extrabold text-blue-600 dark:text-blue-400">
                                {summary.progressoPlanejadoAteAgora}%
                            </span>
                            <span className="text-xs text-gray-500 dark:text-gray-400">
                                esperado até agora
                            </span>
                        </div>
                        <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2 mt-2 overflow-hidden">
                            <div
                                className="bg-blue-500 h-2 rounded-full transition-all duration-500"
                                style={{ width: `${Math.min(100, summary.progressoPlanejadoAteAgora)}%` }}
                            />
                        </div>
                    </div>
                    <div className="mt-2 text-[11px] text-gray-500 dark:text-gray-400 flex justify-between">
                        <span>Período da Parada:</span>
                        <span className="font-semibold text-gray-700 dark:text-gray-300">{summary.totalAtividades} Atividades</span>
                    </div>
                </div>

                {/* Card 3: Desvio / GAP */}
                <div className="bg-white/80 dark:bg-gray-800/80 backdrop-blur-md rounded-xl p-4 shadow-sm border border-gray-200/50 dark:border-gray-700/50 flex flex-col justify-between">
                    <div className="flex items-center justify-between">
                        <span className="text-xs font-bold uppercase tracking-wider text-gray-500 dark:text-gray-400">Desvio (GAP)</span>
                        <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                            summary.statusGeral === 'ADIANTADO'
                                ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-700'
                                : summary.statusGeral === 'ATRASADO'
                                ? 'bg-rose-100 text-rose-700 dark:bg-rose-950/60 dark:text-rose-300 border border-rose-300 dark:border-rose-700'
                                : 'bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-300'
                        }`}>
                            {summary.statusGeral}
                        </span>
                    </div>
                    <div className="mt-2">
                        <div className="flex items-baseline space-x-1">
                            <span className={`text-3xl font-extrabold ${
                                summary.desvioAtual > 0 
                                    ? 'text-emerald-600 dark:text-emerald-400' 
                                    : summary.desvioAtual < 0 
                                    ? 'text-rose-600 dark:text-rose-400' 
                                    : 'text-gray-700 dark:text-gray-300'
                            }`}>
                                {summary.desvioAtual > 0 ? `+${summary.desvioAtual}%` : `${summary.desvioAtual}%`}
                            </span>
                            <span className="text-xs text-gray-500 dark:text-gray-400">
                                {summary.desvioAtual > 0 ? 'adiantado' : summary.desvioAtual < 0 ? 'atrasado' : 'no prazo'}
                            </span>
                        </div>
                    </div>
                    <div className="mt-2 text-[11px] text-gray-500 dark:text-gray-400 flex justify-between">
                        <span>Fórmula:</span>
                        <span className="font-mono text-gray-600 dark:text-gray-400">Real ({summary.progressoRealTotal}%) - Plan ({summary.progressoPlanejadoAteAgora}%)</span>
                    </div>
                </div>

                {/* Card 4: Status Breakdown */}
                <div className="bg-white/80 dark:bg-gray-800/80 backdrop-blur-md rounded-xl p-4 shadow-sm border border-gray-200/50 dark:border-gray-700/50 flex flex-col justify-between">
                    <div className="flex items-center justify-between">
                        <span className="text-xs font-bold uppercase tracking-wider text-gray-500 dark:text-gray-400">Conclusão de Tarefas</span>
                        <span className="text-xs font-bold text-gray-700 dark:text-gray-300">
                            {summary.atividadesConcluidas}/{summary.totalAtividades}
                        </span>
                    </div>
                    <div className="mt-2 space-y-1.5">
                        <div className="flex justify-between text-xs">
                            <span className="flex items-center text-emerald-600 dark:text-emerald-400">
                                <span className="w-2 h-2 rounded-full bg-emerald-500 mr-1.5" />
                                Concluídas (100%):
                            </span>
                            <span className="font-bold">{summary.atividadesConcluidas}</span>
                        </div>
                        <div className="flex justify-between text-xs">
                            <span className="flex items-center text-blue-600 dark:text-blue-400">
                                <span className="w-2 h-2 rounded-full bg-blue-500 mr-1.5" />
                                Em Andamento:
                            </span>
                            <span className="font-bold">{summary.atividadesEmAndamento}</span>
                        </div>
                        <div className="flex justify-between text-xs">
                            <span className="flex items-center text-gray-500 dark:text-gray-400">
                                <span className="w-2 h-2 rounded-full bg-gray-400 mr-1.5" />
                                Não Iniciadas:
                            </span>
                            <span className="font-bold">{summary.atividadesNaoIniciadas}</span>
                        </div>
                    </div>
                </div>
            </div>

            {/* S-Curve Chart Section */}
            {(viewMode === 'both' || viewMode === 'chart') && (
                <div className="bg-white/80 dark:bg-gray-800/80 backdrop-blur-md rounded-xl p-4 shadow-sm border border-gray-200/50 dark:border-gray-700/50">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4 pb-3 border-b border-gray-200/60 dark:border-gray-700/60">
                        <div>
                            <h3 className="text-base font-bold text-gray-900 dark:text-white flex items-center gap-2">
                                <CurveIcon className="w-5 h-5 text-primary-600" />
                                Curva S - Avanço Físico Planejado x Real
                            </h3>
                            <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                                Evolução acumulada do avanço físico considerando as datas/horas planejadas e de execução real
                            </p>
                        </div>

                        {/* Chart Controls */}
                        <div className="flex flex-wrap items-center gap-2 text-xs">
                            {/* Granularity Toggle */}
                            <div className="inline-flex rounded-lg bg-gray-100 dark:bg-gray-700 p-0.5">
                                <button
                                    onClick={() => setGranularity('auto')}
                                    className={`px-2.5 py-1 rounded-md transition-all font-medium ${
                                        granularity === 'auto'
                                            ? 'bg-white dark:bg-gray-600 text-gray-900 dark:text-white shadow-xs'
                                            : 'text-gray-500 hover:text-gray-800 dark:text-gray-300'
                                    }`}
                                >
                                    Auto
                                </button>
                                <button
                                    onClick={() => setGranularity('hour')}
                                    className={`px-2.5 py-1 rounded-md transition-all font-medium ${
                                        granularity === 'hour'
                                            ? 'bg-white dark:bg-gray-600 text-gray-900 dark:text-white shadow-xs'
                                            : 'text-gray-500 hover:text-gray-800 dark:text-gray-300'
                                    }`}
                                >
                                    Hora
                                </button>
                                <button
                                    onClick={() => setGranularity('shift')}
                                    className={`px-2.5 py-1 rounded-md transition-all font-medium ${
                                        granularity === 'shift'
                                            ? 'bg-white dark:bg-gray-600 text-gray-900 dark:text-white shadow-xs'
                                            : 'text-gray-500 hover:text-gray-800 dark:text-gray-300'
                                    }`}
                                >
                                    Turno
                                </button>
                                <button
                                    onClick={() => setGranularity('day')}
                                    className={`px-2.5 py-1 rounded-md transition-all font-medium ${
                                        granularity === 'day'
                                            ? 'bg-white dark:bg-gray-600 text-gray-900 dark:text-white shadow-xs'
                                            : 'text-gray-500 hover:text-gray-800 dark:text-gray-300'
                                    }`}
                                >
                                    Dia
                                </button>
                            </div>

                            {/* Weight Mode */}
                            <div className="inline-flex rounded-lg bg-gray-100 dark:bg-gray-700 p-0.5">
                                <button
                                    onClick={() => setWeightMode('duration')}
                                    className={`px-2.5 py-1 rounded-md transition-all font-medium ${
                                        weightMode === 'duration'
                                            ? 'bg-white dark:bg-gray-600 text-gray-900 dark:text-white shadow-xs'
                                            : 'text-gray-500 hover:text-gray-800 dark:text-gray-300'
                                    }`}
                                    title="Pondera cada atividade pelo tempo estimado (H x H)"
                                >
                                    Duração (Horas)
                                </button>
                                <button
                                    onClick={() => setWeightMode('count')}
                                    className={`px-2.5 py-1 rounded-md transition-all font-medium ${
                                        weightMode === 'count'
                                            ? 'bg-white dark:bg-gray-600 text-gray-900 dark:text-white shadow-xs'
                                            : 'text-gray-500 hover:text-gray-800 dark:text-gray-300'
                                    }`}
                                    title="Ponderação uniforme por quantidade de atividades"
                                >
                                    Qtd. Tarefas
                                </button>
                            </div>

                            {/* Bars Toggle */}
                            <button
                                onClick={() => setShowBars(!showBars)}
                                className={`px-2.5 py-1 rounded-lg border font-medium transition-all ${
                                    showBars
                                        ? 'bg-primary-50 dark:bg-primary-950/40 border-primary-300 dark:border-primary-700 text-primary-700 dark:text-primary-300'
                                        : 'bg-white dark:bg-gray-700 border-gray-300 dark:border-gray-600 text-gray-600 dark:text-gray-300'
                                }`}
                            >
                                Barras do Período
                            </button>
                        </div>
                    </div>

                    {/* Chart Container */}
                    <div className="w-full h-80 sm:h-96">
                        {points.length === 0 ? (
                            <div className="w-full h-full flex items-center justify-center text-gray-500 text-sm italic">
                                Nenhuma atividade com datas válidas para compor a Curva S.
                            </div>
                        ) : (
                            <ResponsiveContainer width="100%" height="100%">
                                <ComposedChart data={points} margin={{ top: 10, right: 25, left: 0, bottom: 25 }}>
                                    <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" className="dark:stroke-gray-700" />
                                    <XAxis
                                        dataKey="label"
                                        tick={{ fontSize: 11 }}
                                        stroke="#9ca3af"
                                        angle={-25}
                                        textAnchor="end"
                                        height={45}
                                    />
                                    <YAxis
                                        domain={[0, 100]}
                                        unit="%"
                                        tick={{ fontSize: 11 }}
                                        stroke="#9ca3af"
                                    />
                                    <Tooltip content={<CustomTooltip />} />
                                    <Legend
                                        verticalAlign="top"
                                        align="right"
                                        wrapperStyle={{ paddingBottom: '12px', fontSize: '12px' }}
                                    />

                                    {/* Period Bars if toggled */}
                                    {showBars && (
                                        <>
                                            <Bar
                                                dataKey="planejadoPeriodo"
                                                name="Plan. Período (%)"
                                                fill="#93c5fd"
                                                opacity={0.4}
                                                radius={[3, 3, 0, 0]}
                                            />
                                            <Bar
                                                dataKey="realPeriodo"
                                                name="Real Período (%)"
                                                fill="#86efac"
                                                opacity={0.5}
                                                radius={[3, 3, 0, 0]}
                                            />
                                        </>
                                    )}

                                    {/* 100% Target Reference */}
                                    <ReferenceLine y={100} stroke="#9ca3af" strokeDasharray="4 4" />

                                    {/* Planned Curve (Blue) */}
                                    <Line
                                        type="monotone"
                                        dataKey="planejadoAcumulado"
                                        name="Curva S Planejada (%)"
                                        stroke="#2563eb"
                                        strokeWidth={3}
                                        dot={{ r: 3, fill: '#2563eb' }}
                                        activeDot={{ r: 6 }}
                                    />

                                    {/* Real Curve (Emerald Green) */}
                                    <Line
                                        type="monotone"
                                        dataKey="realAcumulado"
                                        name="Curva S Realizada (%)"
                                        stroke="#10b981"
                                        strokeWidth={3.5}
                                        dot={{ r: 4, fill: '#10b981', strokeWidth: 2, stroke: '#ffffff' }}
                                        activeDot={{ r: 7 }}
                                        connectNulls={false}
                                    />
                                </ComposedChart>
                            </ResponsiveContainer>
                        )}
                    </div>
                </div>
            )}

            {/* Activities Table with % Progress Field */}
            {(viewMode === 'both' || viewMode === 'table') && (
                <div className="bg-white/80 dark:bg-gray-800/80 backdrop-blur-md rounded-xl shadow-sm border border-gray-200/50 dark:border-gray-700/50 overflow-hidden">
                    {/* Header Controls */}
                    <div className="p-4 border-b border-gray-200/60 dark:border-gray-700/60 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
                        <div>
                            <h3 className="text-base font-bold text-gray-900 dark:text-white flex items-center gap-2">
                                Acompanhamento Individual de Avanço Físico
                            </h3>
                            <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                                Ajuste a porcentagem de avanço de cada atividade ou altere o status (100% ao marcar Concluído)
                            </p>
                        </div>

                        <div className="flex flex-wrap items-center gap-2 w-full sm:w-auto">
                            {/* Search */}
                            <div className="relative flex-1 sm:w-60">
                                <SearchIcon className="w-4 h-4 text-gray-400 absolute left-2.5 top-2.5 pointer-events-none" />
                                <input
                                    type="text"
                                    placeholder="Buscar por TAG, Descrição, Empresa..."
                                    value={searchTerm}
                                    onChange={(e) => setSearchTerm(e.target.value)}
                                    className="w-full pl-8 pr-3 py-1.5 text-xs rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-primary-500 focus:border-primary-500"
                                />
                            </div>

                            {/* Status Filter */}
                            <select
                                value={statusFilter}
                                onChange={(e) => setStatusFilter(e.target.value)}
                                className="py-1.5 px-2.5 text-xs rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                            >
                                <option value="all">Status: Todos</option>
                                {Object.values(ActivityStatus).map(s => (
                                    <option key={s} value={s}>{getStatusLabel(s, customStatusLabels)}</option>
                                ))}
                            </select>
                        </div>
                    </div>

                    {/* Table */}
                    <div className="overflow-x-auto max-h-[500px]">
                        <table className="w-full text-xs text-left text-gray-600 dark:text-gray-300">
                            <thead className="text-[11px] text-gray-700 dark:text-gray-200 uppercase bg-gray-100/70 dark:bg-gray-700/60 sticky top-0 z-10 backdrop-blur-xs">
                                <tr>
                                    <th className="px-3 py-2.5 font-bold">TAG / Descrição</th>
                                    <th className="px-3 py-2.5 font-bold">Empresa</th>
                                    <th className="px-3 py-2.5 font-bold">Turno / Resp.</th>
                                    <th className="px-3 py-2.5 font-bold">Início / Fim Plan.</th>
                                    <th className="px-3 py-2.5 font-bold">Execução Real</th>
                                    <th className="px-3 py-2.5 font-bold w-48 text-center">% Avanço</th>
                                    <th className="px-3 py-2.5 font-bold text-center">Status</th>
                                    <th className="px-3 py-2.5 font-bold text-center">Ações</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-100 dark:divide-gray-700/50">
                                {filteredActivities.length === 0 ? (
                                    <tr>
                                        <td colSpan={8} className="px-4 py-8 text-center text-gray-500 italic">
                                            Nenhuma atividade encontrada com os filtros atuais.
                                        </td>
                                    </tr>
                                ) : (
                                    filteredActivities.map((activity) => {
                                        const currentProgress = getActivityProgress(activity);
                                        const isClosed = activity.status === ActivityStatus.Closed;

                                        return (
                                            <tr
                                                key={activity.id}
                                                className="hover:bg-gray-50/60 dark:hover:bg-gray-700/40 transition-colors"
                                            >
                                                {/* TAG / Description */}
                                                <td className="px-3 py-2.5 max-w-[220px]">
                                                    <div className="flex items-center space-x-1.5">
                                                        <span className="font-mono font-bold text-primary-600 dark:text-primary-400">
                                                            {activity.tag}
                                                        </span>
                                                        <span className={`text-[9px] px-1.5 py-0.2 rounded uppercase border font-semibold ${getCriticidadeClasses(activity.criticidade)}`}>
                                                            {activity.criticidade}
                                                        </span>
                                                    </div>
                                                    <p className="text-gray-800 dark:text-gray-200 font-medium truncate mt-0.5" title={activity.descricao}>
                                                        {activity.descricao}
                                                    </p>
                                                    {activity.idMp && (
                                                        <span className="text-[10px] text-gray-400 dark:text-gray-500">
                                                            {activity.idMp}
                                                        </span>
                                                    )}
                                                </td>

                                                {/* Empresa */}
                                                <td className="px-3 py-2.5 whitespace-nowrap font-medium text-gray-700 dark:text-gray-300">
                                                    {activity.empresa || 'FOSPAR'}
                                                </td>

                                                {/* Turno / Responsavel */}
                                                <td className="px-3 py-2.5 whitespace-nowrap">
                                                    <div className="font-semibold text-gray-900 dark:text-white">
                                                        Turno {activity.turno || '-'}
                                                    </div>
                                                    <div className="text-gray-500 dark:text-gray-400 text-[11px] truncate max-w-[130px]" title={activity.responsavel}>
                                                        {activity.responsavel || '-'}
                                                    </div>
                                                </td>

                                                {/* Início / Fim Planejado */}
                                                <td className="px-3 py-2.5 whitespace-nowrap text-[11px]">
                                                    <div className="text-gray-800 dark:text-gray-200">
                                                        {new Date(activity.horaInicio).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })} {' '}
                                                        <span className="font-bold">
                                                            {new Date(activity.horaInicio).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} - {new Date(activity.horaFim).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                                        </span>
                                                    </div>
                                                    <div className="text-gray-400 dark:text-gray-500 text-[10px]">
                                                        Duração: {activity.duracao || '-'}
                                                    </div>
                                                </td>

                                                {/* Início / Fim Real */}
                                                <td className="px-3 py-2.5 whitespace-nowrap text-[11px]">
                                                    {activity.horaInicioReal ? (
                                                        <div className="text-gray-700 dark:text-gray-300">
                                                            <span>Início: </span>
                                                            <span className="font-semibold">
                                                                {new Date(activity.horaInicioReal).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                                            </span>
                                                            {activity.horaFimReal && (
                                                                <div>
                                                                    <span>Fim: </span>
                                                                    <span className="font-semibold text-emerald-600 dark:text-emerald-400">
                                                                        {new Date(activity.horaFimReal).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                                                    </span>
                                                                </div>
                                                            )}
                                                        </div>
                                                    ) : (
                                                        <span className="text-gray-400 dark:text-gray-500 italic">
                                                            Não iniciado real
                                                        </span>
                                                    )}
                                                </td>

                                                {/* % Avanço Campo */}
                                                <td className="px-3 py-2.5">
                                                    <div className="flex flex-col items-center space-y-1.5">
                                                        <div className="flex items-center space-x-2 w-full">
                                                            <input
                                                                type="range"
                                                                min="0"
                                                                max="100"
                                                                step="5"
                                                                value={currentProgress}
                                                                onChange={(e) => handleProgressChange(activity, Number(e.target.value))}
                                                                className="w-full h-1.5 bg-gray-200 dark:bg-gray-600 rounded-lg appearance-none cursor-pointer accent-emerald-600"
                                                            />
                                                            <div className="flex items-center space-x-0.5">
                                                                <input
                                                                    type="number"
                                                                    min="0"
                                                                    max="100"
                                                                    value={currentProgress}
                                                                    onChange={(e) => handleProgressChange(activity, Number(e.target.value))}
                                                                    className="w-12 py-0.5 px-1 text-center font-bold text-xs rounded border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                                                                />
                                                                <span className="text-xs font-semibold text-gray-500">%</span>
                                                            </div>
                                                        </div>

                                                        {/* Quick percentage buttons */}
                                                        <div className="flex items-center space-x-1">
                                                            {[0, 25, 50, 75, 100].map((pct) => (
                                                                <button
                                                                    key={pct}
                                                                    type="button"
                                                                    onClick={() => handleProgressChange(activity, pct)}
                                                                    className={`px-1.5 py-0.5 rounded text-[10px] font-semibold transition-all ${
                                                                        currentProgress === pct
                                                                            ? 'bg-emerald-600 text-white shadow-xs'
                                                                            : 'bg-gray-100 hover:bg-gray-200 dark:bg-gray-700 dark:hover:bg-gray-600 text-gray-700 dark:text-gray-300'
                                                                    }`}
                                                                >
                                                                    {pct}%
                                                                </button>
                                                            ))}
                                                        </div>
                                                    </div>
                                                </td>

                                                {/* Status Selector */}
                                                <td className="px-3 py-2.5 text-center whitespace-nowrap">
                                                    <select
                                                        value={activity.status}
                                                        onChange={(e) => handleDirectStatusChange(activity, e.target.value as ActivityStatus)}
                                                        className={`p-1 rounded text-xs font-bold cursor-pointer transition-all border ${getStatusClasses(activity.status, true)}`}
                                                    >
                                                        {Object.values(ActivityStatus).map((s) => (
                                                            <option key={s} value={s} className="bg-white text-gray-800 font-normal">
                                                                {getStatusLabel(s, customStatusLabels)}
                                                            </option>
                                                        ))}
                                                    </select>
                                                </td>

                                                {/* Actions */}
                                                <td className="px-3 py-2.5 text-center whitespace-nowrap">
                                                    <button
                                                        onClick={() => onEdit(activity)}
                                                        className="p-1.5 rounded-lg text-gray-500 hover:text-primary-600 hover:bg-gray-100 dark:hover:bg-gray-700 dark:text-gray-400 dark:hover:text-primary-400 transition-colors"
                                                        title="Editar todos os detalhes da atividade"
                                                    >
                                                        <PencilIcon className="w-4 h-4" />
                                                    </button>
                                                </td>
                                            </tr>
                                        );
                                    })
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}
        </div>
    );
};
