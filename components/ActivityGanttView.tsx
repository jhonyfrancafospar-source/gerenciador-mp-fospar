
import React, { useEffect, useState, useRef } from 'react';
import type { Activity } from '../types';
import { ActivityStatus } from '../types';

interface ActivityGanttViewProps {
    activities: Activity[];
    onEdit: (activity: Activity) => void;
}

const STATUS_COLORS: { [key in ActivityStatus]: string } = {
    [ActivityStatus.Open]: 'bg-gray-600',
    [ActivityStatus.NaoExecutado]: 'bg-red-600',
    [ActivityStatus.EmProgresso]: 'bg-blue-600',
    [ActivityStatus.ExecutadoParcialmente]: 'bg-yellow-500',
    [ActivityStatus.Closed]: 'bg-green-600',
};

const GanttBar: React.FC<{ activity: Activity, hourWidth: number, height: number, onClick: () => void }> = ({ activity, hourWidth, height, onClick }) => {
    const start = new Date(activity.horaInicio);
    const end = new Date(activity.horaFim);

    // Obter o total de minutos desde a meia-noite para o início
    const startMinutes = start.getHours() * 60 + start.getMinutes();
    
    // Calcular a duração em minutos
    const durationMinutes = (end.getTime() - start.getTime()) / (1000 * 60);
    
    // 1 hora = 60 minutos = hourWidth px, então 1 minuto = hourWidth / 60 px
    const pixelPerMinute = hourWidth / 60;
    
    const left = startMinutes * pixelPerMinute;
    const width = Math.max(durationMinutes * pixelPerMinute, 4); // Min width 4px
    
    const barColor = STATUS_COLORS[activity.status] || 'bg-gray-500';

    return (
        <div 
            className={`absolute top-1/2 -translate-y-1/2 rounded-sm opacity-90 hover:opacity-100 transition-all flex items-center px-2 text-[10px] font-medium text-white shadow-sm ${barColor} cursor-pointer hover:ring-1 hover:ring-white hover:z-10 overflow-hidden whitespace-nowrap`}
            style={{ 
                left: `${left}px`, 
                width: `${width}px`, 
                height: `${height * 0.7}px`, // Bar uses 70% of row height
            }}
            title={`${activity.descricao} (${start.toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})} - ${end.toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}) - Clique para editar`}
            onClick={(e) => {
                e.stopPropagation();
                onClick();
            }}
        >
            {width > 30 && <span className="truncate">{activity.tag}</span>}
        </div>
    );
};

export const ActivityGanttView: React.FC<ActivityGanttViewProps> = ({ activities, onEdit }) => {
    const [currentTime, setCurrentTime] = useState(new Date());
    const [hourWidth, setHourWidth] = useState(60); // Default width per hour (Zoom level)
    const [isCompact, setIsCompact] = useState(false); // Row height toggle
    const containerRef = useRef<HTMLDivElement>(null);

    const rowHeight = isCompact ? 28 : 45; // Adjustable row height
    const yAxisWidth = 220; // px

    useEffect(() => {
        const timer = setInterval(() => {
            setCurrentTime(new Date());
        }, 60000); // Update every minute
        return () => clearInterval(timer);
    }, []);
    
    // Helper to scroll to current time
    const scrollToNow = () => {
        if (containerRef.current) {
            const { hour, minute } = getBrasiliaTime(new Date());
            const minutesTotal = hour * 60 + minute;
            const scrollLeft = (minutesTotal * (hourWidth / 60)) - (containerRef.current.clientWidth / 2) + yAxisWidth;
            containerRef.current.scrollTo({ left: Math.max(0, scrollLeft), behavior: 'smooth' });
        }
    };

    if (activities.length === 0) {
        return <div className="text-center p-8 bg-white/80 dark:bg-gray-800/80 backdrop-blur-md rounded-lg shadow text-gray-800 dark:text-gray-200">Nenhuma atividade para exibir no gráfico de Gantt.</div>;
    }

    const sortedActivities = [...activities].sort((a,b) => {
        const aTime = new Date(a.horaInicio).getTime();
        const bTime = new Date(b.horaInicio).getTime();
        if(aTime === bTime) return a.tag.localeCompare(b.tag);
        return aTime - bTime;
    });

    const hours = Array.from({ length: 24 }, (_, i) => i);
    const totalChartWidth = hours.length * hourWidth;

    // Calculate position for Brasilia time (UTC-3)
    const getBrasiliaTime = (date: Date) => {
        const options: Intl.DateTimeFormatOptions = {
            timeZone: 'America/Sao_Paulo',
            hour: 'numeric',
            minute: 'numeric',
            hour12: false
        };
        const formatter = new Intl.DateTimeFormat('en-US', options);
        const parts = formatter.formatToParts(date);
        const hour = parseInt(parts.find(p => p.type === 'hour')?.value || '0', 10);
        const minute = parseInt(parts.find(p => p.type === 'minute')?.value || '0', 10);
        return { hour: hour % 24, minute };
    };

    const { hour: brazilHour, minute: brazilMinute } = getBrasiliaTime(currentTime);
    const currentMinutes = brazilHour * 60 + brazilMinute;
    const currentLineLeft = currentMinutes * (hourWidth / 60);
    const timeLabel = `${brazilHour.toString().padStart(2, '0')}:${brazilMinute.toString().padStart(2, '0')}`;

    return (
        <div className="flex flex-col h-[75vh] bg-white/90 dark:bg-gray-800/90 backdrop-blur-md rounded-lg shadow border border-gray-200 dark:border-gray-700">
            
            {/* Controls Toolbar */}
            <div className="p-3 border-b border-gray-200 dark:border-gray-700 flex items-center justify-between bg-gray-50 dark:bg-gray-800 rounded-t-lg">
                <div className="flex items-center space-x-4">
                    <div className="flex items-center space-x-1 bg-white dark:bg-gray-700 rounded-md border dark:border-gray-600 p-1">
                        <button 
                            onClick={() => setHourWidth(prev => Math.max(30, prev - 10))}
                            className="px-2 py-1 text-xs font-bold text-gray-600 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-600 rounded"
                            title="Diminuir Zoom"
                        >
                            -
                        </button>
                        <span className="text-xs text-gray-500 dark:text-gray-400 min-w-[60px] text-center">Zoom: {hourWidth}px</span>
                        <button 
                            onClick={() => setHourWidth(prev => Math.min(300, prev + 10))}
                            className="px-2 py-1 text-xs font-bold text-gray-600 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-600 rounded"
                            title="Aumentar Zoom"
                        >
                            +
                        </button>
                    </div>
                    
                    <label className="flex items-center cursor-pointer space-x-2 text-sm text-gray-700 dark:text-gray-300">
                        <input 
                            type="checkbox" 
                            checked={isCompact} 
                            onChange={(e) => setIsCompact(e.target.checked)} 
                            className="rounded text-primary-600 focus:ring-primary-500 dark:bg-gray-700 dark:border-gray-600"
                        />
                        <span>Modo Compacto</span>
                    </label>
                </div>
                
                <button 
                    onClick={scrollToNow}
                    className="px-3 py-1 text-xs bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300 rounded border border-red-200 dark:border-red-800 hover:bg-red-200 transition-colors"
                >
                    Ir para Agora ({timeLabel})
                </button>
            </div>

            {/* Main Chart Area */}
            <div className="flex-1 overflow-auto relative" ref={containerRef}>
                <div className="relative inline-block min-w-full">
                    
                    {/* Header Row (Sticky Top) */}
                    <div className="flex sticky top-0 z-30 bg-gray-100 dark:bg-gray-700 shadow-sm">
                        <div 
                            style={{ width: `${yAxisWidth}px`, height: '32px' }} 
                            className="flex-shrink-0 sticky left-0 border-b border-r border-gray-300 dark:border-gray-600 bg-gray-200 dark:bg-gray-800 flex items-center px-3 text-xs font-bold text-gray-700 dark:text-gray-200 z-40"
                        >
                            Atividade
                        </div>
                        <div className="flex">
                            {hours.map(hour => (
                                <div 
                                    key={hour} 
                                    style={{ width: `${hourWidth}px` }} 
                                    className="flex-shrink-0 text-center text-[10px] font-medium border-b border-r border-gray-300 dark:border-gray-600 flex items-center justify-center text-gray-500 dark:text-gray-400 bg-gray-50 dark:bg-gray-700"
                                >
                                    {`${hour.toString().padStart(2, '0')}:00`}
                                </div>
                            ))}
                        </div>
                    </div>
                    
                    {/* Chart Body */}
                    <div className="relative">
                         {/* Background Grid & Current Time */}
                        <div 
                            className="absolute top-0 bottom-0" 
                            style={{ 
                                left: `${yAxisWidth}px`, 
                                width: `${totalChartWidth}px`, // Critical Fix: Explicit width instead of w-full to support scrolling
                                pointerEvents: 'none' 
                            }}
                        >
                            {hours.map(hour => (
                                <div 
                                    key={`grid-${hour}`} 
                                    className="absolute top-0 bottom-0 border-l border-dashed border-gray-200 dark:border-gray-700/50" 
                                    style={{ left: `${hour * hourWidth}px` }}
                                ></div>
                            ))}
                            
                            {/* Current Time Line */}
                            <div 
                                className="absolute top-0 bottom-0 w-[2px] bg-red-500 z-20 shadow-[0_0_4px_rgba(239,68,68,0.6)]" 
                                style={{ 
                                    left: `${currentLineLeft}px`,
                                    transform: 'translateX(-50%)' // Critical Fix: Center the line on the pixel
                                }}
                            >
                                <div className="absolute -top-0 -translate-x-1/2 bg-red-600 text-white text-[9px] px-1 py-0.5 rounded-b font-bold whitespace-nowrap z-30">
                                    {timeLabel}
                                </div>
                            </div>
                        </div>

                        {/* Activity Rows */}
                        {sortedActivities.map((activity, index) => (
                            <div 
                                key={activity.id} 
                                style={{ height: `${rowHeight}px` }} 
                                className={`flex items-center border-b border-gray-100 dark:border-gray-700/50 relative hover:bg-blue-50 dark:hover:bg-gray-700/30 transition-colors ${index % 2 === 0 ? 'bg-white dark:bg-gray-800' : 'bg-gray-50/30 dark:bg-gray-800/50'}`}
                            >
                                {/* Y Axis Label (Sticky Left) */}
                                <div 
                                    style={{ width: `${yAxisWidth}px` }}
                                    className="flex-shrink-0 h-full px-3 sticky left-0 bg-white dark:bg-gray-800 border-r border-gray-200 dark:border-gray-600 flex flex-col justify-center cursor-pointer z-10 group"
                                    title={`${activity.descricao}`}
                                    onClick={() => onEdit(activity)}
                                >
                                    <div className="flex items-center justify-between">
                                        <p className="font-bold truncate text-xs text-gray-800 dark:text-gray-200 group-hover:text-primary-600 transition-colors">{activity.tag}</p>
                                        {/* Status Dot */}
                                        <div className={`w-2 h-2 rounded-full ${STATUS_COLORS[activity.status]}`}></div>
                                    </div>
                                    {!isCompact && (
                                        <p className="text-[10px] text-gray-500 dark:text-gray-400 truncate mt-0.5">{activity.descricao}</p>
                                    )}
                                </div>
                                
                                {/* Bar Container */}
                                <div className="relative h-full" style={{ width: `${totalChartWidth}px` }}>
                                     <GanttBar 
                                        activity={activity} 
                                        hourWidth={hourWidth} 
                                        height={rowHeight}
                                        onClick={() => onEdit(activity)} 
                                    />
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            </div>
        </div>
    );
};
