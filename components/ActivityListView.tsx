import React, { useState, useMemo, useRef, useEffect } from 'react';
import { type Activity, ActivityStatus } from '../types';
import { PencilIcon } from './icons/PencilIcon';
import { PaperClipIcon } from './icons/PaperClipIcon';
import { CameraIcon } from './icons/CameraIcon';
import { ArrowsUpDownIcon } from './icons/ArrowsUpDownIcon';
import { getStatusClasses, getCriticidadeClasses, getStatusLabel } from '../utils/styleUtils';

interface ActivityListViewProps {
    activities: Activity[];
    onEdit: (activity: Activity) => void;
    onUpdateStatus: (activityId: string, status: ActivityStatus) => void;
    customStatusLabels?: Record<string, string>;
}

type SortDirection = 'asc' | 'desc';

interface SortConfig {
    key: keyof Activity | 'statusLabel' | null;
    direction: SortDirection;
}

export const ActivityListView: React.FC<ActivityListViewProps> = ({ activities, onEdit, onUpdateStatus, customStatusLabels = {} }) => {
    // Sorting State
    const [sortConfig, setSortConfig] = useState<SortConfig>({ key: null, direction: 'asc' });
    
    // Resizing State
    const [columnWidths, setColumnWidths] = useState<Record<string, number>>({
        tag: 90,
        descricao: 280,
        responsavel: 130,
        supervisor: 130,
        turno: 70,
        // periodicidade removed
        horario: 110,
        duracao: 70,
        criticidade: 90,
        status: 130,
        anexos: 70,
        acoes: 50
    });
    
    const resizingRef = useRef<{ key: string; startX: number; startWidth: number } | null>(null);

    // Current time for conditional formatting
    const [now, setNow] = useState(new Date());

    useEffect(() => {
        // Update "now" every minute to refresh conditional formatting
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

            // Handle undefined/null
            if (aValue === undefined || aValue === null) aValue = '';
            if (bValue === undefined || bValue === null) bValue = '';

            // Handle Date strings
            if (sortConfig.key === 'horaInicio' || sortConfig.key === 'horaFim') {
                return sortConfig.direction === 'asc' 
                    ? new Date(aValue).getTime() - new Date(bValue).getTime()
                    : new Date(bValue).getTime() - new Date(aValue).getTime();
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
            setColumnWidths(prev => ({ ...prev, [key]: newWidth }));
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

    const Th: React.FC<{ id: string; label: string; sortKey?: keyof Activity | 'statusLabel' }> = ({ id, label, sortKey }) => (
        <th 
            scope="col" 
            className="relative px-3 py-2 select-none border-r border-gray-200 dark:border-gray-700 last:border-r-0 group whitespace-nowrap"
            style={{ width: columnWidths[id] }}
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
        return <div className="text-center p-8 bg-white/80 dark:bg-gray-800/80 backdrop-blur-md rounded-lg shadow">Nenhuma atividade encontrada.</div>;
    }

    return (
        <div className="bg-white/90 dark:bg-gray-800/90 backdrop-blur-md rounded-lg shadow overflow-x-auto">
            <table className="w-full text-xs text-left text-gray-500 dark:text-gray-400 table-fixed">
                <thead className="text-xs text-gray-700 uppercase bg-gray-50/50 dark:bg-gray-700/50 dark:text-gray-300">
                    <tr>
                        <Th id="tag" label="TAG" sortKey="tag" />
                        <Th id="descricao" label="Descrição" sortKey="descricao" />
                        <Th id="responsavel" label="Responsável" sortKey="responsavel" />
                        <Th id="supervisor" label="Supervisor" sortKey="supervisor" />
                        <Th id="turno" label="Turno" sortKey="turno" />
                        {/* Periodicidade column removed */}
                        <Th id="horario" label="Horário" sortKey="horaInicio" />
                        <Th id="duracao" label="Duração" sortKey="duracao" />
                        <Th id="criticidade" label="Criticidade" sortKey="criticidade" />
                        <Th id="status" label="Status" sortKey="statusLabel" />
                        <Th id="anexos" label="Anexos" />
                        <Th id="acoes" label="Ações" />
                    </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
                    {sortedActivities.map(activity => {
                        // Conditional Formatting Logic: Open AND Start Time < Now
                        const isOverdue = activity.status === ActivityStatus.Open && new Date(activity.horaInicio) < now;
                        
                        return (
                            <tr key={activity.id} className="bg-transparent hover:bg-gray-50/80 dark:hover:bg-gray-700/50 transition-colors">
                                <td 
                                    className="px-3 py-2 font-medium text-gray-900 dark:text-white truncate overflow-hidden cursor-pointer hover:text-primary-600 hover:underline"
                                    onClick={() => onEdit(activity)}
                                    title="Clique para editar"
                                >
                                    {activity.tag}
                                </td>
                                <td 
                                    className="px-3 py-2 truncate overflow-hidden cursor-pointer hover:text-primary-600" 
                                    title={activity.descricao}
                                    onClick={() => onEdit(activity)}
                                >
                                    {activity.descricao}
                                </td>
                                <td className="px-3 py-2 truncate overflow-hidden">{activity.responsavel}</td>
                                <td className="px-3 py-2 truncate overflow-hidden">{activity.supervisor}</td>
                                <td className="px-3 py-2 truncate overflow-hidden text-center">{activity.turno}</td>
                                {/* Periodicidade cell removed */}
                                <td className={`px-3 py-2 truncate overflow-hidden ${isOverdue ? 'text-red-600 font-bold dark:text-red-400' : ''}`}>
                                    {new Date(activity.horaInicio).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} - {new Date(activity.horaFim).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                </td>
                                <td className="px-3 py-2 truncate overflow-hidden text-center">{activity.duracao}</td>
                                <td className="px-3 py-2">
                                    <span className={`px-1.5 py-0.5 rounded-full text-[10px] font-semibold border ${getCriticidadeClasses(activity.criticidade)}`}>
                                        {activity.criticidade}
                                    </span>
                                </td>
                                <td className="px-3 py-2">
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
                                </td>
                                <td className="px-3 py-2">
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
                                <td className="px-3 py-2 text-center">
                                    <button onClick={() => onEdit(activity)} className="text-primary-600 hover:text-primary-800 dark:text-primary-500 dark:hover:text-primary-300 transition-colors" title="Editar">
                                        <PencilIcon className="w-4 h-4"/>
                                    </button>
                                </td>
                            </tr>
                        );
                    })}
                </tbody>
            </table>
        </div>
    );
};