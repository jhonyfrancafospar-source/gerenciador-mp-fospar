import React, { useMemo, useState } from 'react';
import type { Activity } from '../types';
import { ActivityStatus, Criticidade } from '../types';
import { getStatusLabel } from '../utils/styleUtils';
import { ChartBarIcon } from './icons/ChartBarIcon';
import { ChartPieIcon } from './icons/ChartPieIcon';
import { 
    BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, 
    PieChart, Pie, Cell, LineChart, Line 
} from 'recharts';

interface DashboardViewProps {
    activities: Activity[];
    customStatusLabels?: Record<string, string>;
}

const STATUS_COLORS: { [key in ActivityStatus]: string } = {
    [ActivityStatus.Open]: '#374151', // Gray 700
    [ActivityStatus.NaoExecutado]: '#dc2626', // Red 600
    [ActivityStatus.EmProgresso]: '#2563eb', // Blue 600
    [ActivityStatus.ExecutadoParcialmente]: '#eab308', // Yellow 500
    [ActivityStatus.Closed]: '#16a34a', // Green 600
};

const CRITICIDADE_COLORS: { [key in Criticidade]: string } = {
    [Criticidade.Baixa]: '#22c55e',   // Green
    [Criticidade.Normal]: '#3b82f6',  // Blue
    [Criticidade.Alta]: '#f97316',    // Orange
    [Criticidade.Urgente]: '#ef4444', // Red
};

type ChartType = 'bar' | 'pie' | 'line';

export const DashboardView: React.FC<DashboardViewProps> = ({ activities, customStatusLabels = {} }) => {
    const [statusChartType, setStatusChartType] = useState<ChartType>('bar');
    const [critChartType, setCritChartType] = useState<ChartType>('pie');
    
    // --- Data Preparation ---

    const totalActivities = activities.length;

    // 1. Status Data
    const statusData = useMemo(() => {
        const counts = activities.reduce((acc, activity) => {
            acc[activity.status] = (acc[activity.status] || 0) + 1;
            return acc;
        }, {} as Record<ActivityStatus, number>);

        return Object.entries(counts).map(([key, value]) => ({ 
            name: getStatusLabel(key as ActivityStatus, customStatusLabels),
            originalKey: key,
            value: value as number,
            color: STATUS_COLORS[key as ActivityStatus] || '#9ca3af'
        })).sort((a, b) => b.value - a.value); // Sort by count descending
    }, [activities, customStatusLabels]);

    // 2. Criticality Data
    const critData = useMemo(() => {
        const counts = activities.reduce((acc, activity) => {
            acc[activity.criticidade] = (acc[activity.criticidade] || 0) + 1;
            return acc;
        }, {} as Record<Criticidade, number>);

        return Object.entries(counts).map(([key, value]) => ({
            name: key.charAt(0).toUpperCase() + key.slice(1),
            originalKey: key,
            value: value as number,
            color: CRITICIDADE_COLORS[key as Criticidade] || '#9ca3af'
        }));
    }, [activities]);

    const completedActivities = activities.filter(a => a.status === ActivityStatus.Closed).length;
    const progressPercentage = totalActivities > 0 ? Math.round((completedActivities / totalActivities) * 100) : 0;

    // --- Render Helpers ---

    if (activities.length === 0) {
        return (
            <div className="flex items-center justify-center h-96 bg-white/80 dark:bg-gray-800/80 backdrop-blur-md rounded-lg shadow-lg">
                <p className="text-lg text-gray-500 dark:text-gray-400">Nenhuma atividade encontrada para os filtros selecionados.</p>
            </div>
        );
    }

    // Custom Tooltip
    const CustomTooltip = ({ active, payload, label }: any) => {
        if (active && payload && payload.length) {
            const data = payload[0].payload;
            const percent = ((data.value / totalActivities) * 100).toFixed(1);
            return (
                <div className="bg-white/95 dark:bg-gray-800/95 p-3 rounded-lg shadow-xl border border-gray-200 dark:border-gray-700 backdrop-blur-sm">
                    <p className="font-bold text-gray-800 dark:text-white mb-1">{data.name}</p>
                    <div className="flex items-center space-x-4 text-sm">
                        <span className="text-gray-600 dark:text-gray-300">Quantidade: <span className="font-semibold">{data.value}</span></span>
                        <span className="text-gray-600 dark:text-gray-300">Porcentagem: <span className="font-semibold text-blue-600 dark:text-blue-400">{percent}%</span></span>
                    </div>
                </div>
            );
        }
        return null;
    };

    // Chart Toggle Component
    const ChartToggle = ({ current, onChange }: { current: ChartType, onChange: (t: ChartType) => void }) => (
        <div className="flex bg-gray-100 dark:bg-gray-700 rounded-lg p-1 space-x-1">
            {[
                { type: 'bar', label: 'Barras', icon: <ChartBarIcon className="w-4 h-4"/> },
                { type: 'pie', label: 'Pizza', icon: <ChartPieIcon className="w-4 h-4"/> },
                { type: 'line', label: 'Linhas', icon: <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" /></svg> }
            ].map((opt) => (
                <button
                    key={opt.type}
                    onClick={() => onChange(opt.type as ChartType)}
                    className={`flex items-center space-x-1 px-3 py-1.5 rounded-md text-xs font-medium transition-all ${
                        current === opt.type 
                            ? 'bg-white dark:bg-gray-600 text-primary-600 dark:text-white shadow-sm' 
                            : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200'
                    }`}
                    title={`Visualizar como ${opt.label}`}
                >
                    {opt.icon}
                    <span className="hidden sm:inline">{opt.label}</span>
                </button>
            ))}
        </div>
    );

    const renderChart = (type: ChartType, data: any[]) => {
        if (type === 'bar') {
            return (
                <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={data} margin={{ top: 20, right: 30, left: 0, bottom: 5 }}>
                        <CartesianGrid strokeDasharray="3 3" vertical={false} strokeOpacity={0.1} />
                        <XAxis dataKey="name" tick={{fill: '#6b7280', fontSize: 11}} axisLine={false} tickLine={false} />
                        <YAxis tick={{fill: '#6b7280', fontSize: 11}} axisLine={false} tickLine={false} allowDecimals={false} />
                        <Tooltip content={<CustomTooltip />} cursor={{fill: 'rgba(0,0,0,0.05)'}} />
                        <Bar dataKey="value" radius={[4, 4, 0, 0]} animationDuration={1000}>
                            {data.map((entry, index) => (
                                <Cell key={`cell-${index}`} fill={entry.color} />
                            ))}
                        </Bar>
                    </BarChart>
                </ResponsiveContainer>
            );
        }
        if (type === 'pie') {
            return (
                <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                        <Pie
                            data={data}
                            dataKey="value"
                            nameKey="name"
                            cx="50%"
                            cy="50%"
                            innerRadius={60}
                            outerRadius={100}
                            paddingAngle={2}
                            animationDuration={1000}
                        >
                            {data.map((entry, index) => (
                                <Cell key={`cell-${index}`} fill={entry.color} strokeWidth={2} stroke="#fff" />
                            ))}
                        </Pie>
                        <Tooltip content={<CustomTooltip />} />
                        <Legend verticalAlign="bottom" height={36} iconType="circle" wrapperStyle={{fontSize: '11px'}} />
                    </PieChart>
                </ResponsiveContainer>
            );
        }
        if (type === 'line') {
            return (
                <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={data} margin={{ top: 20, right: 30, left: 10, bottom: 5 }}>
                        <CartesianGrid strokeDasharray="3 3" strokeOpacity={0.1} />
                        <XAxis dataKey="name" tick={{fill: '#6b7280', fontSize: 11}} />
                        <YAxis tick={{fill: '#6b7280', fontSize: 11}} allowDecimals={false} />
                        <Tooltip content={<CustomTooltip />} />
                        <Line type="monotone" dataKey="value" stroke="#3b82f6" strokeWidth={3} dot={{r: 6, strokeWidth: 2}} activeDot={{r: 8}} animationDuration={1000} />
                    </LineChart>
                </ResponsiveContainer>
            );
        }
    };

    return (
        <div className="space-y-6 text-gray-900 dark:text-gray-100">
            {/* Progress Bar Section */}
            <div className="bg-white/90 dark:bg-gray-800/90 backdrop-blur-md p-6 rounded-lg shadow-lg border border-gray-100 dark:border-gray-700">
                <div className="flex justify-between items-end mb-4">
                    <div>
                        <h2 className="text-2xl font-bold text-gray-800 dark:text-white">Dashboard Geral</h2>
                        <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">Visão geral do progresso e distribuição das atividades.</p>
                    </div>
                    <div className="text-right">
                        <span className="text-4xl font-bold text-primary-600 dark:text-primary-400">{progressPercentage}%</span>
                        <span className="text-sm text-gray-500 dark:text-gray-400 block">Concluído</span>
                    </div>
                </div>
                <div className="relative h-3 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
                    <div 
                        style={{ width: `${progressPercentage}%` }} 
                        className="absolute top-0 left-0 h-full bg-gradient-to-r from-primary-500 to-green-500 transition-all duration-1000 ease-out rounded-full"
                    ></div>
                </div>
                <div className="flex justify-between mt-2 text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide">
                    <span>0% Iniciado</span>
                    <span>{completedActivities} / {totalActivities} Atividades</span>
                </div>
            </div>

            {/* Charts Grid */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                
                {/* Chart 1: Status Analysis */}
                <div className="bg-white/90 dark:bg-gray-800/90 backdrop-blur-md p-6 rounded-lg shadow-lg border border-gray-100 dark:border-gray-700 flex flex-col h-[400px]">
                    <div className="flex justify-between items-center mb-6">
                        <h3 className="text-lg font-semibold text-gray-700 dark:text-gray-200">Atividades por Status</h3>
                        <ChartToggle current={statusChartType} onChange={setStatusChartType} />
                    </div>
                    <div className="flex-1 w-full min-h-0">
                        {renderChart(statusChartType, statusData)}
                    </div>
                </div>

                {/* Chart 2: Criticality Analysis */}
                <div className="bg-white/90 dark:bg-gray-800/90 backdrop-blur-md p-6 rounded-lg shadow-lg border border-gray-100 dark:border-gray-700 flex flex-col h-[400px]">
                     <div className="flex justify-between items-center mb-6">
                        <h3 className="text-lg font-semibold text-gray-700 dark:text-gray-200">Atividades por Criticidade</h3>
                        <ChartToggle current={critChartType} onChange={setCritChartType} />
                    </div>
                    <div className="flex-1 w-full min-h-0">
                        {renderChart(critChartType, critData)}
                    </div>
                </div>
            </div>

            {/* KPI Summary Cards */}
            <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-4">
                {statusData.map((item) => (
                    <div key={item.name} className="bg-white/90 dark:bg-gray-800/90 backdrop-blur-md p-4 rounded-lg shadow border-l-4 flex flex-col justify-between transition-transform hover:scale-105" style={{ borderColor: item.color }}>
                        <p className="text-xs text-gray-500 dark:text-gray-400 uppercase tracking-wider truncate font-bold" title={item.name}>
                            {item.name}
                        </p>
                        <div className="flex items-end justify-between mt-2">
                            <p className="text-2xl font-bold text-gray-800 dark:text-white">{item.value}</p>
                            <p className="text-xs text-gray-400">{((item.value / totalActivities) * 100).toFixed(0)}%</p>
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
};