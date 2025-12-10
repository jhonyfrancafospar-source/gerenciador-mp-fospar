
import React, { useMemo } from 'react';
import {
    LineChart,
    Line,
    XAxis,
    YAxis,
    CartesianGrid,
    Tooltip,
    Legend,
    ResponsiveContainer,
    Area,
    ComposedChart
} from 'recharts';
import type { Activity } from '../types';

interface SCurveViewProps {
    activities: Activity[];
}

export const SCurveView: React.FC<SCurveViewProps> = ({ activities }) => {

    const chartData = useMemo(() => {
        if (activities.length === 0) return { data: [], totalScope: 0 };

        const allActivities = activities.filter(a => a.horaInicio && a.horaFim);
        
        // 1. Calculate Total Planned Scope (100% base)
        let totalScopeHours = 0;
        allActivities.forEach(act => {
            const duration = (new Date(act.horaFim).getTime() - new Date(act.horaInicio).getTime()) / 3600000;
            totalScopeHours += duration;
        });

        if (totalScopeHours === 0) return { data: [], totalScope: 0 };

        // 2. Identify Time Range
        let minTime = Infinity;
        let maxTime = -Infinity;

        allActivities.forEach(act => {
            const startP = new Date(act.horaInicio).getTime();
            const endP = new Date(act.horaFim).getTime();
            if (startP < minTime) minTime = startP;
            if (endP > maxTime) maxTime = endP;

            if (act.horaInicioReal && act.horaFimReal) {
                const startR = new Date(act.horaInicioReal).getTime();
                const endR = new Date(act.horaFimReal).getTime();
                if (startR < minTime) minTime = startR;
                if (endR > maxTime) maxTime = endR;
            }
        });

        if (minTime === Infinity) return { data: [], totalScope: 0 };

        // Round to start/end of days
        const startDate = new Date(minTime); startDate.setHours(0, 0, 0, 0);
        const endDate = new Date(maxTime); endDate.setHours(23, 59, 59, 999);

        // 3. Create timeline array
        const dayMs = 24 * 60 * 60 * 1000;
        const timeline: { date: string; timestamp: number; planned: number; real: number; cumulativePlannedPct: number; cumulativeRealPct: number }[] = [];

        for (let t = startDate.getTime(); t <= endDate.getTime(); t += dayMs) {
            timeline.push({
                date: new Date(t).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' }),
                timestamp: t,
                planned: 0,
                real: 0,
                cumulativePlannedPct: 0,
                cumulativeRealPct: 0
            });
        }

        // 4. Distribute Hours
        allActivities.forEach(act => {
            const getDurationInHours = (s: string, e: string) => (new Date(e).getTime() - new Date(s).getTime()) / 3600000;

            // -- Planned --
            const startP = new Date(act.horaInicio).getTime();
            const endP = new Date(act.horaFim).getTime();
            const totalPlannedHours = getDurationInHours(act.horaInicio, act.horaFim);

            const spanP = endP - startP;
            if (spanP > 0) {
                timeline.forEach(day => {
                    const dayStart = day.timestamp;
                    const dayEnd = day.timestamp + dayMs - 1;

                    const overlapStart = Math.max(startP, dayStart);
                    const overlapEnd = Math.min(endP, dayEnd);

                    if (overlapEnd > overlapStart) {
                        const overlapRatio = (overlapEnd - overlapStart) / spanP;
                        day.planned += totalPlannedHours * overlapRatio;
                    }
                });
            }

            // -- Real --
            if (act.horaInicioReal && act.horaFimReal) {
                const startR = new Date(act.horaInicioReal).getTime();
                const endR = new Date(act.horaFimReal).getTime();
                const totalRealHours = getDurationInHours(act.horaInicioReal, act.horaFimReal);
                const spanR = endR - startR;

                if (spanR > 0) {
                     timeline.forEach(day => {
                        const dayStart = day.timestamp;
                        const dayEnd = day.timestamp + dayMs - 1;
                        const overlapStart = Math.max(startR, dayStart);
                        const overlapEnd = Math.min(endR, dayEnd);

                        if (overlapEnd > overlapStart) {
                            const overlapRatio = (overlapEnd - overlapStart) / spanR;
                            day.real += totalRealHours * overlapRatio;
                        }
                    });
                }
            }
        });

        // 5. Calculate Cumulative Percentages
        let accPlanned = 0;
        let accReal = 0;
        
        timeline.forEach(day => {
            accPlanned += day.planned;
            accReal += day.real;
            
            // Calculate % against Total PLANNED Scope
            day.cumulativePlannedPct = Number(((accPlanned / totalScopeHours) * 100).toFixed(2));
            day.cumulativeRealPct = Number(((accReal / totalScopeHours) * 100).toFixed(2));
        });

        return { data: timeline, totalScope: totalScopeHours };

    }, [activities]);

    const data = chartData.data;

    if (activities.length === 0 || data.length === 0) {
        return (
            <div className="flex items-center justify-center h-96 bg-white/70 dark:bg-gray-800/70 backdrop-blur-md rounded-lg shadow-lg">
                <p className="text-lg text-gray-500 dark:text-gray-400">Nenhuma atividade disponível para gerar a Curva S.</p>
            </div>
        );
    }

    const currentPlannedPct = data.length > 0 ? data[data.length - 1].cumulativePlannedPct : 0;
    const currentRealPct = data.length > 0 ? data[data.length - 1].cumulativeRealPct : 0;
    const deviationPct = currentRealPct - currentPlannedPct;

    return (
        <div className="space-y-6">
            {/* KPI Cards */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="bg-white/70 dark:bg-gray-900/80 backdrop-blur-md p-4 rounded-lg shadow border border-blue-200 dark:border-blue-900">
                    <p className="text-xs font-bold text-gray-500 dark:text-gray-400 uppercase">Planejado Total</p>
                    <p className="text-2xl font-bold text-blue-600 dark:text-blue-400">{currentPlannedPct.toFixed(1)}%</p>
                    <p className="text-xs text-gray-400 mt-1">Base: {chartData.totalScope.toFixed(1)} horas</p>
                </div>
                <div className="bg-white/70 dark:bg-gray-900/80 backdrop-blur-md p-4 rounded-lg shadow border border-green-200 dark:border-green-900">
                    <p className="text-xs font-bold text-gray-500 dark:text-gray-400 uppercase">Realizado Total</p>
                    <p className="text-2xl font-bold text-green-600 dark:text-green-400">{currentRealPct.toFixed(1)}%</p>
                    <p className="text-xs text-gray-400 mt-1">Sobre o escopo planejado</p>
                </div>
                 <div className={`bg-white/70 dark:bg-gray-900/80 backdrop-blur-md p-4 rounded-lg shadow border ${deviationPct > 0 ? 'border-red-200 dark:border-red-900' : 'border-gray-200 dark:border-gray-700'}`}>
                    <p className="text-xs font-bold text-gray-500 dark:text-gray-400 uppercase">Desvio (%)</p>
                    <p className={`text-2xl font-bold ${deviationPct > 0 ? 'text-red-500' : 'text-gray-600 dark:text-gray-300'}`}>
                        {deviationPct > 0 ? '+' : ''}{deviationPct.toFixed(1)}%
                    </p>
                    <p className="text-xs text-gray-400 mt-1">{deviationPct > 0 ? 'Horas excedentes' : 'Dentro do planejado'}</p>
                </div>
            </div>

            {/* Chart */}
            <div className="bg-white/70 dark:bg-gray-900/80 backdrop-blur-md p-6 rounded-lg shadow-lg border border-gray-200/50 dark:border-gray-700/50 h-[500px]">
                <h3 className="text-lg font-semibold text-gray-800 dark:text-white mb-4">Curva S: % Planejado vs % Realizado</h3>
                <ResponsiveContainer width="100%" height="100%">
                    <ComposedChart
                        data={data}
                        margin={{ top: 20, right: 30, left: 0, bottom: 0 }}
                    >
                        <CartesianGrid strokeDasharray="3 3" strokeOpacity={0.1} />
                        <XAxis 
                            dataKey="date" 
                            tick={{ fill: '#6b7280', fontSize: 12 }} 
                            axisLine={false}
                            tickLine={false}
                        />
                        <YAxis 
                            tick={{ fill: '#6b7280', fontSize: 12 }} 
                            axisLine={false}
                            tickLine={false}
                            unit="%"
                            label={{ value: '% Concluído', angle: -90, position: 'insideLeft', style: { fill: '#9ca3af', fontSize: 12 } }}
                        />
                        <Tooltip 
                            formatter={(value: number) => [`${value}%`, '']}
                            contentStyle={{ backgroundColor: 'rgba(255, 255, 255, 0.95)', borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)' }}
                            labelStyle={{ color: '#374151', fontWeight: 'bold' }}
                        />
                        <Legend verticalAlign="top" height={36} />
                        
                        {/* Planned Line (S-Curve) */}
                        <Line 
                            type="monotone" 
                            dataKey="cumulativePlannedPct" 
                            name="% Planejado" 
                            stroke="#2563eb" 
                            strokeWidth={3} 
                            dot={false}
                            activeDot={{ r: 6 }}
                        />
                        
                        {/* Real Line (S-Curve) */}
                        <Line 
                            type="monotone" 
                            dataKey="cumulativeRealPct" 
                            name="% Realizado" 
                            stroke="#16a34a" 
                            strokeWidth={3} 
                            dot={false}
                            activeDot={{ r: 6 }}
                        />

                        {/* Optional: Area under curve for visual weight */}
                        <Area type="monotone" dataKey="cumulativePlannedPct" fill="#2563eb" fillOpacity={0.05} stroke="none" legendType='none' />
                    </ComposedChart>
                </ResponsiveContainer>
            </div>
        </div>
    );
};
