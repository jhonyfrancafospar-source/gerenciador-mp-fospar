
import React, { useMemo } from 'react';
import type { Activity } from '../types';

interface ManPowerViewProps {
    activities: Activity[];
}

// Helper to parse "HH:MM" or number to total minutes
const parseDurationToMinutes = (durationStr: string): number => {
    if (!durationStr) return 0;
    
    if (durationStr.includes(':')) {
        const [hours, minutes] = durationStr.split(':').map(Number);
        return (hours * 60) + (minutes || 0);
    }
    // If decimal number (e.g. 1.5 hours)
    const num = parseFloat(durationStr);
    if (!isNaN(num)) {
        return Math.round(num * 60);
    }
    return 0;
};

const formatMinutesToHHMM = (totalMinutes: number): string => {
    const h = Math.floor(totalMinutes / 60);
    const m = totalMinutes % 60;
    return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}`;
};

export const ManPowerView: React.FC<ManPowerViewProps> = ({ activities }) => {
    
    const data = useMemo(() => {
        return activities.map(act => {
            // Calculate headcount based on " / " separator
            const responsavelList = act.responsavel
                ? act.responsavel.split(' / ').filter(s => s.trim().length > 0)
                : [];
            const headcount = responsavelList.length > 0 ? responsavelList.length : 0; // If 0 names, usually implies 0 effective or 1 generic. Assuming 0 if string empty.
            
            // Duration
            const durationMinutes = parseDurationToMinutes(act.duracao);
            
            // Man Hours = Duration * Headcount
            const totalManMinutes = durationMinutes * headcount;
            
            return {
                ...act,
                headcount,
                durationMinutes,
                totalManMinutes
            };
        });
    }, [activities]);

    const totalHHMinutes = data.reduce((sum, item) => sum + item.totalManMinutes, 0);

    if (activities.length === 0) {
        return <div className="text-center p-8 bg-white/70 dark:bg-gray-800/70 backdrop-blur-md rounded-lg shadow text-gray-800 dark:text-gray-200">Nenhuma atividade encontrada.</div>;
    }

    return (
        <div className="space-y-6 text-gray-900 dark:text-gray-100">
            <div className="bg-white/70 dark:bg-gray-900/80 backdrop-blur-md p-6 rounded-lg shadow-lg flex justify-between items-center border border-gray-200/50 dark:border-gray-700/50">
                <div>
                    <h2 className="text-2xl font-bold text-gray-800 dark:text-white">Cálculo Homem x Hora</h2>
                    <p className="text-sm text-gray-500 dark:text-gray-400">Baseado na duração e quantidade de responsáveis por atividade.</p>
                </div>
                <div className="text-right">
                    <span className="block text-xs font-bold text-gray-500 dark:text-gray-300 uppercase">Total Geral</span>
                    <span className="text-3xl font-bold text-primary-600 dark:text-primary-400">{formatMinutesToHHMM(totalHHMinutes)} h</span>
                </div>
            </div>

            <div className="bg-white/70 dark:bg-gray-900/80 backdrop-blur-md rounded-lg shadow overflow-x-auto border border-gray-200/50 dark:border-gray-700/50">
                <table className="w-full text-sm text-left text-gray-500 dark:text-gray-300">
                    <thead className="text-xs text-gray-700 dark:text-white uppercase bg-gray-50/50 dark:bg-gray-700/50">
                        <tr>
                            <th className="px-6 py-3">TAG / Descrição</th>
                            <th className="px-6 py-3">Responsáveis (Nomes)</th>
                            <th className="px-6 py-3 text-center">Qtd Pessoas</th>
                            <th className="px-6 py-3 text-center">Duração</th>
                            <th className="px-6 py-3 text-right">Total Hxh</th>
                        </tr>
                    </thead>
                    <tbody>
                        {data.map(row => (
                            <tr key={row.id} className="border-b dark:border-gray-700/50 hover:bg-gray-50/50 dark:hover:bg-gray-600/30 transition-colors">
                                <td className="px-6 py-4">
                                    <div className="font-bold text-gray-900 dark:text-white">{row.tag}</div>
                                    <div className="text-xs truncate max-w-xs text-gray-600 dark:text-gray-400" title={row.descricao}>{row.descricao}</div>
                                </td>
                                <td className="px-6 py-4 max-w-xs truncate text-gray-800 dark:text-gray-200" title={row.responsavel}>
                                    {row.responsavel || '-'}
                                </td>
                                <td className="px-6 py-4 text-center">
                                    <span className="bg-gray-100 text-gray-800 text-xs font-medium px-2.5 py-0.5 rounded dark:bg-gray-700 dark:text-white">
                                        {row.headcount}
                                    </span>
                                </td>
                                <td className="px-6 py-4 text-center text-gray-800 dark:text-gray-200">
                                    {row.duracao}
                                </td>
                                <td className="px-6 py-4 text-right font-mono font-bold text-gray-900 dark:text-white">
                                    {formatMinutesToHHMM(row.totalManMinutes)}
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        </div>
    );
};
