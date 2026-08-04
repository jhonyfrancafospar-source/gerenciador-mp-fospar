
import React, { useEffect, useState, useRef, useMemo } from 'react';
import type { Activity } from '../types';
import { ActivityStatus } from '../types';

interface ActivityGanttViewProps {
    activities: Activity[];
    onEdit: (activity: Activity) => void;
    onUpdateActivity?: (activity: Activity) => void;
}

const STATUS_COLORS: { [key in ActivityStatus]: string } = {
    [ActivityStatus.Open]: 'bg-gray-600',
    [ActivityStatus.NaoExecutado]: 'bg-red-600',
    [ActivityStatus.EmProgresso]: 'bg-blue-600',
    [ActivityStatus.ExecutadoParcialmente]: 'bg-yellow-500',
    [ActivityStatus.Closed]: 'bg-green-600',
};

// 24-day shift rotation schedule based on standard operational matrix
const SHIFT_SCHEDULE_24_DAYS: Record<'00-08' | '08-16' | '16-00', string>[] = [
    { '00-08': 'B', '08-16': 'A', '16-00': 'D' }, // Day 0
    { '00-08': 'B', '08-16': 'A', '16-00': 'D' }, // Day 1 (12/09/2026)
    { '00-08': 'C', '08-16': 'A', '16-00': 'D' }, // Day 2
    { '00-08': 'C', '08-16': 'A', '16-00': 'D' }, // Day 3
    { '00-08': 'C', '08-16': 'A', '16-00': 'B' }, // Day 4
    { '00-08': 'C', '08-16': 'A', '16-00': 'B' }, // Day 5
    { '00-08': 'C', '08-16': 'D', '16-00': 'B' }, // Day 6
    { '00-08': 'C', '08-16': 'D', '16-00': 'B' }, // Day 7
    { '00-08': 'A', '08-16': 'D', '16-00': 'B' }, // Day 8
    { '00-08': 'A', '08-16': 'D', '16-00': 'B' }, // Day 9
    { '00-08': 'A', '08-16': 'D', '16-00': 'C' }, // Day 10
    { '00-08': 'A', '08-16': 'D', '16-00': 'C' }, // Day 11
    { '00-08': 'A', '08-16': 'B', '16-00': 'C' }, // Day 12
    { '00-08': 'A', '08-16': 'B', '16-00': 'C' }, // Day 13
    { '00-08': 'D', '08-16': 'B', '16-00': 'C' }, // Day 14
    { '00-08': 'D', '08-16': 'B', '16-00': 'C' }, // Day 15
    { '00-08': 'D', '08-16': 'B', '16-00': 'A' }, // Day 16
    { '00-08': 'D', '08-16': 'B', '16-00': 'A' }, // Day 17
    { '00-08': 'D', '08-16': 'C', '16-00': 'A' }, // Day 18
    { '00-08': 'D', '08-16': 'C', '16-00': 'A' }, // Day 19
    { '00-08': 'B', '08-16': 'C', '16-00': 'A' }, // Day 20
    { '00-08': 'B', '08-16': 'C', '16-00': 'A' }, // Day 21
    { '00-08': 'B', '08-16': 'C', '16-00': 'D' }, // Day 22
    { '00-08': 'B', '08-16': 'C', '16-00': 'D' }, // Day 23
];

const SHIFT_STYLE_MAP: Record<string, { bg: string; text: string }> = {
    'A': { bg: 'bg-[#00a2e8]', text: 'text-black font-black' },
    'B': { bg: 'bg-[#c0c0c0]', text: 'text-black font-black' },
    'C': { bg: 'bg-[#ffff00]', text: 'text-black font-black' },
    'D': { bg: 'bg-[#c084fc]', text: 'text-black font-black' },
};

const getShiftInfo = (date: Date, shiftKey: '00-08' | '08-16' | '16-00') => {
    const anchor = Date.UTC(2026, 8, 12); // 12/09/2026
    const target = Date.UTC(date.getFullYear(), date.getMonth(), date.getDate());
    const diffDays = Math.floor((target - anchor) / (1000 * 60 * 60 * 24));
    let dayIndex = (1 + (diffDays % 24)) % 24;
    if (dayIndex < 0) dayIndex += 24;

    const letter = SHIFT_SCHEDULE_24_DAYS[dayIndex]?.[shiftKey] || 'A';
    const style = SHIFT_STYLE_MAP[letter] || { bg: 'bg-gray-300', text: 'text-black font-bold' };
    return { letter, ...style };
};

const formatDateRange = (startMs: number, endMs: number) => {
    const start = new Date(startMs);
    const end = new Date(endMs);
    const startDateStr = start.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: '2-digit' });
    const startTimeStr = start.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
    const endDateStr = end.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: '2-digit' });
    const endTimeStr = end.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });

    if (startDateStr === endDateStr) {
        return `${startDateStr} ${startTimeStr} - ${endTimeStr}`;
    }
    return `${startDateStr} ${startTimeStr} às ${endDateStr} ${endTimeStr}`;
};

interface GanttBarProps {
    activity: Activity;
    chartStart: number;
    hourWidth: number;
    height: number;
    onClick: () => void;
    onUpdateActivity?: (activity: Activity) => void;
    scrollContainerRef: React.RefObject<HTMLDivElement | null>;
}

const GanttBar: React.FC<GanttBarProps> = ({ 
    activity, 
    chartStart, 
    hourWidth, 
    height, 
    onClick, 
    onUpdateActivity,
    scrollContainerRef 
}) => {
    const actStartMs = new Date(activity.horaInicio).getTime();
    const actEndMs = new Date(activity.horaFim).getTime();

    const [isDragging, setIsDragging] = useState(false);
    const [dragType, setDragType] = useState<'move' | 'resize-left' | 'resize-right' | null>(null);
    const [tempStartMs, setTempStartMs] = useState(actStartMs);
    const [tempEndMs, setTempEndMs] = useState(actEndMs);

    const tempStartRef = useRef(actStartMs);
    const tempEndRef = useRef(actEndMs);

    useEffect(() => {
        if (!isDragging) {
            setTempStartMs(actStartMs);
            setTempEndMs(actEndMs);
            tempStartRef.current = actStartMs;
            tempEndRef.current = actEndMs;
        }
    }, [activity.horaInicio, activity.horaFim, isDragging]);

    const handleStartDrag = (e: React.MouseEvent, type: 'move' | 'resize-left' | 'resize-right') => {
        e.preventDefault();
        e.stopPropagation();

        const initialMouseX = e.clientX;
        const initialScrollLeft = scrollContainerRef.current?.scrollLeft || 0;
        const origStart = new Date(activity.horaInicio).getTime();
        const origEnd = new Date(activity.horaFim).getTime();
        const origDuration = origEnd - origStart;

        let hasMoved = false;

        const handleMouseMove = (moveEv: MouseEvent) => {
            const currentScrollLeft = scrollContainerRef.current?.scrollLeft || 0;
            const deltaX = (moveEv.clientX + currentScrollLeft) - (initialMouseX + initialScrollLeft);

            if (!hasMoved && Math.abs(moveEv.clientX - initialMouseX) > 3) {
                hasMoved = true;
                setIsDragging(true);
                setDragType(type);
            }

            if (!hasMoved) return;

            const pxPerMs = hourWidth / 3600000;
            const rawDeltaMs = deltaX / pxPerMs;

            // Snap to 15 minutes (900,000 ms)
            const SNAP_MS = 15 * 60 * 1000;
            const snappedDeltaMs = Math.round(rawDeltaMs / SNAP_MS) * SNAP_MS;

            let newStart = origStart;
            let newEnd = origEnd;

            if (type === 'move') {
                newStart = origStart + snappedDeltaMs;
                newEnd = newStart + origDuration;
            } else if (type === 'resize-left') {
                newStart = Math.min(origStart + snappedDeltaMs, origEnd - SNAP_MS);
                newEnd = origEnd;
            } else if (type === 'resize-right') {
                newStart = origStart;
                newEnd = Math.max(origEnd + snappedDeltaMs, origStart + SNAP_MS);
            }

            setTempStartMs(newStart);
            setTempEndMs(newEnd);
            tempStartRef.current = newStart;
            tempEndRef.current = newEnd;

            // Auto-scroll when near horizontal edges
            if (scrollContainerRef.current) {
                const rect = scrollContainerRef.current.getBoundingClientRect();
                if (moveEv.clientX > rect.right - 80) {
                    scrollContainerRef.current.scrollLeft += 20;
                } else if (moveEv.clientX < rect.left + 180) {
                    scrollContainerRef.current.scrollLeft -= 20;
                }
            }
        };

        const handleMouseUp = () => {
            window.removeEventListener('mousemove', handleMouseMove);
            window.removeEventListener('mouseup', handleMouseUp);

            if (hasMoved) {
                setIsDragging(false);
                setDragType(null);

                const finalStart = tempStartRef.current;
                const finalEnd = tempEndRef.current;

                if (finalStart !== origStart || finalEnd !== origEnd) {
                    const durationHours = ((finalEnd - finalStart) / 3600000).toFixed(1);
                    if (onUpdateActivity) {
                        onUpdateActivity({
                            ...activity,
                            horaInicio: new Date(finalStart).toISOString(),
                            horaFim: new Date(finalEnd).toISOString(),
                            duracao: `${durationHours}h`
                        });
                    }
                }
            } else {
                onClick();
            }
        };

        window.addEventListener('mousemove', handleMouseMove);
        window.addEventListener('mouseup', handleMouseUp);
    };

    const displayStartMs = isDragging ? tempStartMs : actStartMs;
    const displayEndMs = isDragging ? tempEndMs : actEndMs;

    const pxPerMs = hourWidth / 3600000;
    const diffMs = displayStartMs - chartStart;
    const durationMs = displayEndMs - displayStartMs;

    const left = diffMs * pxPerMs;
    const width = Math.max(durationMs * pxPerMs, 6);

    const barColor = STATUS_COLORS[activity.status] || 'bg-gray-500';

    return (
        <div 
            className={`absolute top-1/2 -translate-y-1/2 rounded-md flex items-center px-2 text-[10px] font-medium text-white shadow-sm ${barColor} select-none group transition-shadow ${
                isDragging ? 'ring-2 ring-blue-400 z-50 cursor-grabbing shadow-2xl opacity-95 scale-[1.01]' : 'cursor-grab hover:ring-1 hover:ring-white hover:z-20 opacity-90 hover:opacity-100'
            }`}
            style={{ 
                left: `${left}px`, 
                width: `${width}px`, 
                height: `${height * 0.72}px`,
            }}
            onMouseDown={(e) => handleStartDrag(e, 'move')}
            title={!isDragging ? `${activity.tag} - ${activity.descricao}\n${new Date(activity.horaInicio).toLocaleString()} - ${new Date(activity.horaFim).toLocaleString()}\n(Clique e arraste para realocar dia/horário)` : undefined}
        >
            {/* Left Resize Handle */}
            <div 
                onMouseDown={(e) => handleStartDrag(e, 'resize-left')}
                className="absolute left-0 top-0 bottom-0 w-2.5 cursor-ew-resize opacity-0 group-hover:opacity-100 hover:bg-white/40 rounded-l-md flex items-center justify-center transition-opacity z-10"
                title="Arrastar para alterar horário de início"
            >
                <div className="w-[2px] h-3 bg-white/90 rounded-full" />
            </div>

            {/* Label */}
            {width > 35 && <span className="truncate pointer-events-none px-1 font-semibold">{activity.descricao}</span>}

            {/* Right Resize Handle */}
            <div 
                onMouseDown={(e) => handleStartDrag(e, 'resize-right')}
                className="absolute right-0 top-0 bottom-0 w-2.5 cursor-ew-resize opacity-0 group-hover:opacity-100 hover:bg-white/40 rounded-r-md flex items-center justify-center transition-opacity z-10"
                title="Arrastar para alterar horário de fim"
            >
                <div className="w-[2px] h-3 bg-white/90 rounded-full" />
            </div>

            {/* Live Dragging Floating Tooltip */}
            {isDragging && (
                <div className="absolute -top-11 left-1/2 -translate-x-1/2 bg-gray-900/95 text-white dark:bg-gray-100/95 dark:text-gray-900 text-[11px] font-extrabold py-1 px-3 rounded-lg shadow-2xl whitespace-nowrap z-50 pointer-events-none flex items-center gap-2 border border-blue-500/50 backdrop-blur-md">
                    <span className="w-2 h-2 rounded-full bg-blue-400 animate-ping"></span>
                    <span>{formatDateRange(displayStartMs, displayEndMs)}</span>
                </div>
            )}
        </div>
    );
};

export const ActivityGanttView: React.FC<ActivityGanttViewProps> = ({ activities, onEdit, onUpdateActivity }) => {
    const [currentTime, setCurrentTime] = useState(new Date());
    const [hourWidth, setHourWidth] = useState(60); // Zoom level
    const [isCompact, setIsCompact] = useState(false); // Row height toggle
    const [yAxisWidth, setYAxisWidth] = useState<number>(() => {
        const saved = localStorage.getItem('gantt_y_axis_width');
        if (saved) {
            const parsed = parseInt(saved, 10);
            if (!isNaN(parsed) && parsed >= 120 && parsed <= 600) return parsed;
        }
        return 240;
    });
    const [isResizing, setIsResizing] = useState(false);
    const startXRef = useRef(0);
    const startWidthRef = useRef(240);

    const containerRef = useRef<HTMLDivElement>(null);

    const rowHeight = isCompact ? 28 : 45; 

    const handleMouseDown = (e: React.MouseEvent) => {
        e.preventDefault();
        e.stopPropagation();
        setIsResizing(true);
        startXRef.current = e.clientX;
        startWidthRef.current = yAxisWidth;
    };

    useEffect(() => {
        if (!isResizing) return;

        const handleMouseMove = (e: MouseEvent) => {
            const delta = e.clientX - startXRef.current;
            const newWidth = Math.max(120, Math.min(600, startWidthRef.current + delta));
            setYAxisWidth(newWidth);
        };

        const handleMouseUp = () => {
            setIsResizing(false);
            localStorage.setItem('gantt_y_axis_width', yAxisWidth.toString());
        };

        window.addEventListener('mousemove', handleMouseMove);
        window.addEventListener('mouseup', handleMouseUp);
        return () => {
            window.removeEventListener('mousemove', handleMouseMove);
            window.removeEventListener('mouseup', handleMouseUp);
        };
    }, [isResizing, yAxisWidth]);

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

    // Map of H x H (man-hours in minutes) calculated for each 8-hour shift block
    const shiftManPowerMap = useMemo(() => {
        const map = new Map<string, number>();
        for (const day of days) {
            for (const shiftKey of ['00-08', '08-16', '16-00'] as const) {
                const shiftStart = new Date(day);
                const shiftEnd = new Date(day);

                if (shiftKey === '00-08') {
                    shiftStart.setHours(0, 0, 0, 0);
                    shiftEnd.setHours(8, 0, 0, 0);
                } else if (shiftKey === '08-16') {
                    shiftStart.setHours(8, 0, 0, 0);
                    shiftEnd.setHours(16, 0, 0, 0);
                } else { // '16-00'
                    shiftStart.setHours(16, 0, 0, 0);
                    shiftEnd.setHours(24, 0, 0, 0);
                }

                const startMs = shiftStart.getTime();
                const endMs = shiftEnd.getTime();
                let totalManMinutes = 0;

                for (const act of activities) {
                    const actStartMs = new Date(act.horaInicio).getTime();
                    const actEndMs = new Date(act.horaFim).getTime();

                    if (isNaN(actStartMs) || isNaN(actEndMs) || actEndMs <= actStartMs) continue;

                    const overlapStart = Math.max(actStartMs, startMs);
                    const overlapEnd = Math.min(actEndMs, endMs);

                    if (overlapEnd > overlapStart) {
                        const overlapMinutes = (overlapEnd - overlapStart) / (1000 * 60);

                        const responsavelList = act.responsavel
                            ? act.responsavel.split(/[\/;]/).map(s => s.trim()).filter(Boolean)
                            : [];
                        let headcount = responsavelList.length;
                        if (headcount === 0 && act.efetivo) {
                            const parsedEfetivo = parseInt(act.efetivo, 10);
                            if (!isNaN(parsedEfetivo) && parsedEfetivo > 0) {
                                headcount = parsedEfetivo;
                            }
                        }
                        if (headcount === 0 && act.responsavel && act.responsavel.trim().length > 0) {
                            headcount = 1;
                        }
                        if (headcount === 0) {
                            headcount = 1;
                        }

                        totalManMinutes += overlapMinutes * headcount;
                    }
                }

                const key = `${day.getTime()}_${shiftKey}`;
                map.set(key, totalManMinutes);
            }
        }
        return map;
    }, [days, activities]);

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
        return <div className="text-center p-8 bg-white/70 dark:bg-gray-800/70 backdrop-blur-md rounded-lg shadow text-gray-800 dark:text-gray-200">Nenhuma atividade para exibir no gráfico de Gantt.</div>;
    }

    // Sort strictly by Date first.
    // Changing status should NOT move the activity if date is same.
    const sortedActivities = [...activities].sort((a,b) => {
        return new Date(a.horaInicio).getTime() - new Date(b.horaInicio).getTime();
    });

    return (
        <div className={`flex flex-col h-[80vh] bg-white/70 dark:bg-gray-900/80 backdrop-blur-md rounded-lg shadow border border-gray-200/50 dark:border-gray-700/50 ${isResizing ? 'select-none cursor-col-resize' : ''}`}>
            <style>{`
                .custom-gantt-scroll::-webkit-scrollbar {
                    height: 12px;
                    width: 12px;
                }
                .custom-gantt-scroll::-webkit-scrollbar-track {
                    background: #f1f1f1;
                    border-radius: 6px;
                }
                .custom-gantt-scroll::-webkit-scrollbar-thumb {
                    background: #cbd5e1;
                    border-radius: 6px;
                    border: 3px solid #f1f1f1;
                }
                .custom-gantt-scroll::-webkit-scrollbar-thumb:hover {
                    background: #94a3b8;
                }
                .dark .custom-gantt-scroll::-webkit-scrollbar-track {
                    background: #1f2937;
                }
                .dark .custom-gantt-scroll::-webkit-scrollbar-thumb {
                    background: #4b5563;
                    border-radius: 6px;
                    border: 3px solid #1f2937;
                }
                .dark .custom-gantt-scroll::-webkit-scrollbar-thumb:hover {
                    background: #6b7280;
                }
            `}</style>
            
            {/* Controls Toolbar */}
            <div className="p-2 border-b border-gray-200/50 dark:border-gray-700/50 flex items-center justify-between bg-gray-50/50 dark:bg-gray-800/50 rounded-t-lg">
                <div className="flex items-center space-x-4">
                    <div className="flex items-center space-x-1 bg-white/50 dark:bg-gray-700/50 rounded-md border dark:border-gray-600 p-0.5">
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
                    
                    <label className="flex items-center cursor-pointer space-x-2 text-xs text-gray-700 dark:text-gray-300">
                        <input 
                            type="checkbox" 
                            checked={isCompact} 
                            onChange={(e) => setIsCompact(e.target.checked)} 
                            className="rounded text-primary-600 focus:ring-primary-500 dark:bg-gray-700 dark:border-gray-600"
                        />
                        <span>Compacto</span>
                    </label>

                    <div className="hidden md:flex items-center space-x-1.5 text-xs text-blue-700 dark:text-blue-300 bg-blue-50 dark:bg-blue-950/40 px-2.5 py-1 rounded-md border border-blue-200/60 dark:border-blue-800/60">
                        <span className="font-bold">💡 Dica:</span>
                        <span>Clique e arraste as barras no gráfico para reordenar data ou horário.</span>
                    </div>
                </div>
                
                <button 
                    onClick={scrollToNow}
                    className="px-3 py-1 text-xs bg-red-100/80 text-red-700 dark:bg-red-900/50 dark:text-red-300 rounded border border-red-200 dark:border-red-800 hover:bg-red-200 transition-colors"
                >
                    Ir para Agora
                </button>
            </div>

            {/* Main Chart Area */}
            <div className="flex-1 overflow-x-scroll overflow-y-auto relative custom-gantt-scroll" ref={containerRef}>
                {/* 
                   KEY LAYOUT FIX:
                   Ensure the container for rows and grid is exactly the same width.
                   Grid acts as absolute background to the relative content container.
                */}
                <div className="relative inline-block" style={{ minWidth: '100%' }}>
                    
                    {/* Header Container (Sticky) */}
                    <div className="sticky top-0 z-30 bg-gray-100/90 dark:bg-gray-700/90 shadow-sm backdrop-blur-sm">
                        
                        {/* Row 1: Days */}
                        <div className="flex border-b border-gray-300 dark:border-gray-600">
                            {/* Empty corner for Y axis */}
                            <div 
                                style={{ width: `${yAxisWidth}px` }} 
                                className="flex-shrink-0 sticky left-0 bg-gray-200/90 dark:bg-gray-800/90 border-r border-gray-300 dark:border-gray-600 z-40 backdrop-blur-sm relative"
                            >
                                <div 
                                    onMouseDown={handleMouseDown}
                                    className="absolute right-0 top-0 bottom-0 w-3 -mr-1.5 cursor-col-resize hover:bg-blue-500/40 active:bg-blue-600/60 z-50 transition-colors"
                                    title="Arrastar para redimensionar a coluna de atividades"
                                />
                            </div>
                            
                            {/* Days Loop */}
                            {days.map(day => (
                                <div 
                                    key={day.toISOString()}
                                    style={{ width: `${24 * hourWidth}px` }}
                                    className="flex-shrink-0 text-center text-xs font-bold text-gray-700 dark:text-gray-200 border-r border-gray-300 dark:border-gray-600 py-1 bg-gray-200/80 dark:bg-gray-600/80 box-border"
                                >
                                    {day.toLocaleDateString('pt-BR', { weekday: 'short', day: '2-digit', month: '2-digit', year: 'numeric' })}
                                </div>
                            ))}
                        </div>

                        {/* Row 2: Hours */}
                        <div className="flex border-b border-gray-300 dark:border-gray-600">
                             <div 
                                style={{ width: `${yAxisWidth}px` }} 
                                className="flex-shrink-0 sticky left-0 bg-gray-200/90 dark:bg-gray-800/90 border-r border-gray-300 dark:border-gray-600 flex items-center justify-between px-3 text-xs font-bold text-gray-700 dark:text-gray-200 z-40 backdrop-blur-sm relative select-none"
                            >
                                <span className="truncate pr-2">Atividade</span>
                                <div 
                                    onMouseDown={handleMouseDown}
                                    className="absolute right-0 top-0 bottom-0 w-3 -mr-1.5 cursor-col-resize hover:bg-blue-500/40 active:bg-blue-600/60 z-50 flex items-center justify-center transition-colors group"
                                    title="Arrastar para redimensionar a coluna de atividades"
                                >
                                    <div className="w-[2px] h-4 bg-gray-400 dark:bg-gray-500 group-hover:bg-blue-500 rounded" />
                                </div>
                            </div>
                            {days.map(day => (
                                <React.Fragment key={`hours-${day.toISOString()}`}>
                                    {Array.from({ length: 24 }, (_, i) => (
                                        <div 
                                            key={`${day.toISOString()}-${i}`}
                                            style={{ width: `${hourWidth}px` }}
                                            className="flex-shrink-0 text-center text-[10px] text-gray-500 dark:text-gray-400 border-r border-gray-200 dark:border-gray-600 py-0.5 bg-gray-50/50 dark:bg-gray-700/50 box-border"
                                        >
                                            {i.toString().padStart(2, '0')}:00
                                        </div>
                                    ))}
                                </React.Fragment>
                            ))}
                        </div>

                        {/* Row 3: H x H */}
                        <div className="flex border-b border-gray-300 dark:border-gray-600 bg-gray-100/90 dark:bg-gray-800/90">
                            <div 
                                style={{ width: `${yAxisWidth}px` }} 
                                className="flex-shrink-0 sticky left-0 bg-gray-200/90 dark:bg-gray-800/90 border-r border-gray-300 dark:border-gray-600 flex items-center justify-between px-3 text-xs font-bold text-gray-700 dark:text-gray-200 z-40 backdrop-blur-sm relative select-none py-0.5"
                            >
                                <span className="truncate pr-2">H x H</span>
                                <div 
                                    onMouseDown={handleMouseDown}
                                    className="absolute right-0 top-0 bottom-0 w-3 -mr-1.5 cursor-col-resize hover:bg-blue-500/40 active:bg-blue-600/60 z-50 flex items-center justify-center transition-colors group"
                                    title="Arrastar para redimensionar a coluna de atividades"
                                >
                                    <div className="w-[2px] h-4 bg-gray-400 dark:bg-gray-500 group-hover:bg-blue-500 rounded" />
                                </div>
                            </div>
                            {days.map(day => (
                                <React.Fragment key={`hxh-row-${day.toISOString()}`}>
                                    {(['00-08', '08-16', '16-00'] as const).map(shiftKey => {
                                        const totalMins = shiftManPowerMap.get(`${day.getTime()}_${shiftKey}`) || 0;
                                        const blockWidth = 8 * hourWidth;
                                        const hours = Math.floor(totalMins / 60);
                                        const mins = Math.round(totalMins % 60);
                                        const displayText = totalMins === 0 
                                            ? '0h' 
                                            : mins > 0 
                                                ? `${hours}h ${mins}m` 
                                                : `${hours}h`;

                                        return (
                                            <div 
                                                key={`${day.toISOString()}-${shiftKey}-hxh`}
                                                style={{ width: `${blockWidth}px` }}
                                                className="flex-shrink-0 text-center text-xs py-0.5 border-r border-gray-300 dark:border-gray-600 box-border bg-amber-500/10 dark:bg-amber-400/10 text-amber-900 dark:text-amber-200 flex items-center justify-center select-none font-bold tracking-tight"
                                                title={`H x H calculado para o turno (${shiftKey === '00-08' ? '00:00 - 08:00' : shiftKey === '08-16' ? '08:00 - 16:00' : '16:00 - 00:00'}): ${displayText}`}
                                            >
                                                <span className="bg-amber-100 dark:bg-amber-900/50 text-amber-900 dark:text-amber-200 px-2 py-0.5 rounded border border-amber-300/60 dark:border-amber-700/60 text-[11px] font-extrabold shadow-2xs">
                                                    {displayText}
                                                </span>
                                            </div>
                                        );
                                    })}
                                </React.Fragment>
                            ))}
                        </div>

                        {/* Row 4: Turnos */}
                        <div className="flex border-b border-gray-300 dark:border-gray-600">
                            <div 
                                style={{ width: `${yAxisWidth}px` }} 
                                className="flex-shrink-0 sticky left-0 bg-gray-200/90 dark:bg-gray-800/90 border-r border-gray-300 dark:border-gray-600 flex items-center justify-between px-3 text-xs font-bold text-gray-700 dark:text-gray-200 z-40 backdrop-blur-sm relative select-none"
                            >
                                <span className="truncate pr-2">Turno</span>
                                <div 
                                    onMouseDown={handleMouseDown}
                                    className="absolute right-0 top-0 bottom-0 w-3 -mr-1.5 cursor-col-resize hover:bg-blue-500/40 active:bg-blue-600/60 z-50 flex items-center justify-center transition-colors group"
                                    title="Arrastar para redimensionar a coluna de atividades"
                                >
                                    <div className="w-[2px] h-4 bg-gray-400 dark:bg-gray-500 group-hover:bg-blue-500 rounded" />
                                </div>
                            </div>
                            {days.map(day => (
                                <React.Fragment key={`shift-row-${day.toISOString()}`}>
                                    {(['00-08', '08-16', '16-00'] as const).map(shiftKey => {
                                        const shiftInfo = getShiftInfo(day, shiftKey);
                                        const blockWidth = 8 * hourWidth;
                                        return (
                                            <div 
                                                key={`${day.toISOString()}-${shiftKey}`}
                                                style={{ width: `${blockWidth}px` }}
                                                className={`flex-shrink-0 text-center text-xs py-0.5 border-r border-gray-300 dark:border-gray-600 box-border ${shiftInfo.bg} ${shiftInfo.text} flex items-center justify-center select-none font-extrabold uppercase tracking-wide`}
                                                title={`Turno ${shiftInfo.letter} (${shiftKey === '00-08' ? '00:00 - 08:00' : shiftKey === '08-16' ? '08:00 - 16:00' : '16:00 - 00:00'})`}
                                            >
                                                {blockWidth >= 70 ? `Turno ${shiftInfo.letter}` : shiftInfo.letter}
                                            </div>
                                        );
                                    })}
                                </React.Fragment>
                            ))}
                        </div>
                    </div>
                    
                    {/* Chart Body */}
                    <div className="relative">
                         {/* Background Grid & Current Time */}
                         {/* Positioned ABSOLUTE covering the entire width of rows, shifted by yAxisWidth */}
                        <div 
                            className="absolute top-0 bottom-0" 
                            style={{ 
                                left: `${yAxisWidth}px`, 
                                width: `${totalChartWidth}px`, 
                                pointerEvents: 'none',
                                zIndex: 0
                            }}
                        >
                             {/* Draw grid lines for every hour - Exact match with header logic */}
                             {days.map((day, dayIdx) => (
                                <React.Fragment key={`grid-${day.toISOString()}`}>
                                    {Array.from({ length: 24 }, (_, i) => {
                                        const isDayStart = i === 0;
                                        const isShiftBoundary = i === 8 || i === 16;
                                        
                                        let lineClass = 'border-l border-dashed border-gray-200/80 dark:border-gray-700/40';
                                        if (isDayStart) {
                                            lineClass = 'border-l-2 border-gray-500 dark:border-gray-400 z-10';
                                        } else if (isShiftBoundary) {
                                            lineClass = 'border-l-2 border-dashed border-gray-400 dark:border-gray-400 z-10';
                                        }

                                        return (
                                            <div 
                                                key={`grid-line-${dayIdx}-${i}`}
                                                className={`absolute top-0 bottom-0 box-border ${lineClass}`}
                                                style={{ left: `${(dayIdx * 24 + i) * hourWidth}px` }}
                                            ></div>
                                        );
                                    })}
                                </React.Fragment>
                             ))}

                            {renderCurrentTimeLine()}
                        </div>

                        {/* Activity Rows */}
                        {sortedActivities.map((activity, index) => (
                            <div 
                                key={activity.id} 
                                style={{ height: `${rowHeight}px` }} 
                                className={`flex items-center border-b border-gray-100 dark:border-gray-700/50 relative hover:bg-blue-50/50 dark:hover:bg-gray-700/30 transition-colors z-10 ${index % 2 === 0 ? 'bg-transparent' : 'bg-gray-50/30 dark:bg-gray-800/30'}`}
                            >
                                {/* Y Axis Label (Sticky Left) */}
                                <div 
                                    style={{ width: `${yAxisWidth}px` }}
                                    className="flex-shrink-0 h-full px-3 sticky left-0 bg-white/90 dark:bg-gray-800/90 backdrop-blur-sm border-r border-gray-200 dark:border-gray-600 flex flex-col justify-center cursor-pointer z-20 group"
                                    title={`${activity.tag} - ${activity.descricao}`}
                                    onClick={() => onEdit(activity)}
                                >
                                    <div className="flex items-center justify-between gap-1">
                                        <p className="font-bold truncate text-xs text-gray-800 dark:text-gray-200 group-hover:text-primary-600 transition-colors">{activity.descricao}</p>
                                        <div className={`w-2 h-2 rounded-full flex-shrink-0 ${STATUS_COLORS[activity.status]}`}></div>
                                    </div>
                                    {!isCompact && (
                                        <p className="text-[10px] text-gray-500 dark:text-gray-400 truncate mt-0.5">{activity.tag}</p>
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
                                        onUpdateActivity={onUpdateActivity}
                                        scrollContainerRef={containerRef}
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
