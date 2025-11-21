
import React, { useEffect, useState, useRef, useMemo } from 'react';
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

const GanttBar: React.FC<{ activity: Activity, chartStart: number, hourWidth: number, height: number, onClick: () => void }> = ({ activity, chartStart, hourWidth, height, onClick }) => {
    const start = new Date(activity.horaInicio).getTime();
    const end = new Date(activity.horaFim).getTime();

    // Calculate position relative to chart start
    const diffMs = start - chartStart;
    const durationMs = end - start;
    
    // 1 hour = hourWidth pixels
    // 1 ms = hourWidth / 3600000 pixels
    const pxPerMs = hourWidth / 3600000;
    
    const left = diffMs * pxPerMs;
    const width = Math.max(durationMs * pxPerMs, 4); // Min width 4px
    
    const barColor = STATUS_COLORS[activity.status] || 'bg-gray-500';

    return (
        <div 
            className={`absolute top-1/2 -translate-y-1/2 rounded-sm opacity-90 hover:opacity-100 transition-all flex items-center px-2 text-[10px] font-medium text-white shadow-sm ${barColor} cursor-pointer hover:ring-1 hover:ring-white hover:z-10 overflow-hidden whitespace-nowrap`}
            style={{ 
                left: `${left}px`, 
                width: `${width}px`, 
                height: `${height * 0.7}px`, // Bar uses 70% of row height
            }}
            title={`${activity.tag} - ${activity.descricao}\n${new Date(activity.horaInicio).toLocaleString()} - ${new Date(activity.horaFim).toLocaleString()}`}
            onClick={(e) => {
                e.stopPropagation();
                onClick();
            }}
        >
            {width > 40 && <span className="truncate">{activity.tag}</span>}
        </div>
    );
};

export const ActivityGanttView: React.FC<ActivityGanttViewProps> = ({ activities, onEdit }) => {
    const [currentTime, setCurrentTime] = useState(new Date());
    const [hourWidth, setHourWidth] = useState(60); // Zoom level
    const [isCompact, setIsCompact] = useState(false); // Row height toggle
    const containerRef = useRef<HTMLDivElement>(null);

    const rowHeight = isCompact ? 28 : 45; 
    const yAxisWidth = 220; 

    useEffect(() => {
        const timer = setInterval(() => {
            setCurrentTime(new Date());
        }, 60000);
        return () => clearInterval(timer);
    }, []);

    // --- Timeline Calculation ---
    const { chartStart, chartEnd, days } = useMemo(() => {
        if (activities.length === 0) {
            const now = new Date();
            const start = new Date(now); start.setHours(0,0,0,0);
            const end = new Date(now); end.setHours(23,59,59,999);
            return { chartStart: start.getTime(), chartEnd: end.getTime(), days: [start] };
        }

        const startTimes = activities.map(a => new Date(a.horaInicio).getTime());
        const endTimes = activities.map(a => new Date(a.horaFim).getTime());

        const minTime = Math.min(...startTimes);
        const maxTime = Math.max(...endTimes);

        // Start at 00:00 of the first day
        const startDate = new Date(minTime);
        startDate.setHours(0, 0, 0, 0);

        // End at 23:59 of the last day
        const endDate = new Date(maxTime);
        endDate.setHours(23, 59, 59, 999);

        // Generate array of days
        const daysArr = [];
        let current = new Date(startDate);
        while (current <= endDate) {
            daysArr.push(new Date(current));
            current.setDate(current.getDate() + 1);
        }

        return { chartStart: startDate.getTime(), chartEnd: endDate.getTime(), days: daysArr };
    }, [activities]);

    const totalHours = days.length * 24;
    const totalChartWidth = totalHours * hourWidth;
    const pxPerMs = hourWidth / 3600000;

    // Scroll to Now
    const scrollToNow = () => {
        if (containerRef.current) {
            const nowMs = new Date().getTime();
            if (nowMs >= chartStart && nowMs <= chartEnd) {
                const diff = nowMs - chartStart;
                const left = diff * pxPerMs;
                const scrollLeft = left - (containerRef.current.clientWidth / 2) + yAxisWidth;
                containerRef.current.scrollTo({ left: Math.max(0, scrollLeft), behavior: 'smooth' });
            } else {
                alert("A data atual está fora do intervalo de atividades exibido.");
            }
        }
    };

    // --- Render Helpers ---
    
    // Current Time Line
    const renderCurrentTimeLine = () => {
        const nowMs = currentTime.getTime();
        if (nowMs < chartStart || nowMs > chartEnd) return null;

        const left = (nowMs - chartStart) * pxPerMs;
        const label = currentTime.toLocaleTimeString([], {hour: '2-digit', minute: '2-digit'});

        return (
            <div 
                className="absolute top-0 bottom-0 w-[2px] bg-red-500 z-20 shadow-[0_0_4px_rgba(239,68,68,0.6)] pointer-events-none" 
                style={{ 
                    left: `${left}px`,
                    transform: 'translateX(-50%)' 
                }}
            >
                <div className="absolute -top-0 -translate-x-1/2 bg-red-600 text-white text-[9px] px-1 py-0.5 rounded-b font-bold whitespace-nowrap z-30">
                    {label}
                </div>
            </div>
        );
    };

    if (activities.length === 0) {
        return <div className="text-center p-8 bg-white/80 dark:bg-gray-800/80 backdrop-blur-md rounded-lg shadow text-gray-800 dark:text-gray-200">Nenhuma atividade para exibir no gráfico de Gantt.</div>;
    }

    const sortedActivities = [...activities].sort((a,b) => {
        return new Date(a.horaInicio).getTime() - new Date(b.horaInicio).getTime();
    });

    return (
        <div className="flex flex-col h-[75vh] bg-white/90 dark:bg-gray-800/90 backdrop-blur-md rounded-lg shadow border border-gray-200 dark:border-gray-700">
            
            {/* Controls Toolbar */}
            <div className="p-3 border-b border-gray-200 dark:border-gray-700 flex items-center justify-between bg-gray-50 dark:bg-gray-800 rounded-t-lg">
                <div className="flex items-center space-x-4">
                    <div className="flex items-center space-x-1 bg-white dark:bg-gray-700 rounded-md border dark:border-gray-600 p-1">
                        <button 
                            onClick={() => setHourWidth(prev => Math.max(20, prev - 10))}
                            className="px-2 py-1 text-xs font-bold text-gray-600 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-600 rounded"
                            title="Diminuir Zoom"
                        >
                            -
                        </button>
                        <span className="text-xs text-gray-500 dark:text-gray-400 min-w-[60px] text-center">Zoom: {hourWidth}px</span>
                        <button 
                            onClick={() => setHourWidth(prev => Math.min(200, prev + 10))}
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
                    Ir para Agora
                </button>
            </div>

            {/* Main Chart Area */}
            <div className="flex-1 overflow-auto relative" ref={containerRef}>
                <div className="relative inline-block" style={{ minWidth: '100%' }}>
                    
                    {/* Header Container (Sticky) */}
                    <div className="sticky top-0 z-30 bg-gray-100 dark:bg-gray-700 shadow-sm">
                        
                        {/* Row 1: Days */}
                        <div className="flex border-b border-gray-300 dark:border-gray-600">
                            {/* Empty corner for Y axis */}
                            <div 
                                style={{ width: `${yAxisWidth}px` }} 
                                className="flex-shrink-0 sticky left-0 bg-gray-200 dark:bg-gray-800 border-r border-gray-300 dark:border-gray-600 z-40"
                            ></div>
                            
                            {/* Days Loop */}
                            {days.map(day => (
                                <div 
                                    key={day.toISOString()}
                                    style={{ width: `${24 * hourWidth}px` }}
                                    className="flex-shrink-0 text-center text-xs font-bold text-gray-700 dark:text-gray-200 border-r border-gray-300 dark:border-gray-600 py-1 bg-gray-200 dark:bg-gray-600"
                                >
                                    {day.toLocaleDateString('pt-BR', { weekday: 'short', day: '2-digit', month: '2-digit', year: 'numeric' })}
                                </div>
                            ))}
                        </div>

                        {/* Row 2: Hours */}
                        <div className="flex border-b border-gray-300 dark:border-gray-600">
                             <div 
                                style={{ width: `${yAxisWidth}px` }} 
                                className="flex-shrink-0 sticky left-0 bg-gray-200 dark:bg-gray-800 border-r border-gray-300 dark:border-gray-600 flex items-center px-3 text-xs font-bold text-gray-700 dark:text-gray-200 z-40"
                            >
                                Atividade
                            </div>
                            {days.map(day => (
                                <React.Fragment key={`hours-${day.toISOString()}`}>
                                    {Array.from({ length: 24 }, (_, i) => (
                                        <div 
                                            key={`${day.toISOString()}-${i}`}
                                            style={{ width: `${hourWidth}px` }}
                                            className="flex-shrink-0 text-center text-[10px] text-gray-500 dark:text-gray-400 border-r border-gray-200 dark:border-gray-600 py-0.5 bg-gray-50 dark:bg-gray-700"
                                        >
                                            {i.toString().padStart(2, '0')}:00
                                        </div>
                                    ))}
                                </React.Fragment>
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
                                width: `${totalChartWidth}px`, 
                                pointerEvents: 'none' 
                            }}
                        >
                             {/* Draw grid lines for every hour */}
                             {days.map((day, dayIdx) => (
                                <React.Fragment key={`grid-${day.toISOString()}`}>
                                    {Array.from({ length: 24 }, (_, i) => (
                                        <div 
                                            key={`grid-line-${dayIdx}-${i}`}
                                            className={`absolute top-0 bottom-0 border-l ${i === 0 ? 'border-gray-300 dark:border-gray-500' : 'border-gray-100 dark:border-gray-700/50 border-dashed'}`}
                                            style={{ left: `${(dayIdx * 24 + i) * hourWidth}px` }}
                                        ></div>
                                    ))}
                                </React.Fragment>
                             ))}

                            {renderCurrentTimeLine()}
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
                                    title={`${activity.tag} - ${activity.descricao}`}
                                    onClick={() => onEdit(activity)}
                                >
                                    <div className="flex items-center justify-between">
                                        <p className="font-bold truncate text-xs text-gray-800 dark:text-gray-200 group-hover:text-primary-600 transition-colors">{activity.tag}</p>
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
                                        chartStart={chartStart}
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
