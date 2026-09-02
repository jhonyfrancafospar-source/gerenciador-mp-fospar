
import React, { useEffect, useState, useRef, useMemo, useCallback } from 'react';
import type { Activity } from '../types';
import { ActivityStatus } from '../types';
import { 
    getActivitySequenceMap,
    parseDurationToMs,
    formatMsToDuration,
    calculateShiftForDate,
    cleanDependencyIds
} from '../utils/dependencyUtils';

interface ActivityGanttViewProps {
    activities: Activity[];
    onEdit: (activity: Activity) => void;
    onUpdateActivity?: (activity: Activity) => void;
    onRecalculateSchedule?: () => void;
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
    onClick: (e?: React.MouseEvent) => void;
    onUpdateActivity?: (activity: Activity) => void;
    scrollContainerRef: React.RefObject<HTMLDivElement | null>;
    isSelectedPredecessor?: boolean;
    isLinkingMode?: boolean;
    isSameMpAsSelected?: boolean;
    isCtrlHeld?: boolean;
    isHoveredPredecessor?: boolean;
    isHoveredSuccessor?: boolean;
    isDimmed?: boolean;
}

const GanttBar: React.FC<GanttBarProps> = ({ 
    activity, 
    chartStart, 
    hourWidth, 
    height, 
    onClick, 
    onUpdateActivity,
    scrollContainerRef,
    isSelectedPredecessor = false,
    isLinkingMode = false,
    isSameMpAsSelected = false,
    isCtrlHeld = false,
    isHoveredPredecessor = false,
    isHoveredSuccessor = false,
    isDimmed = false
}) => {
    const actStartMs = new Date(activity.horaInicio).getTime();
    const actEndMs = new Date(activity.horaFim).getTime();

    const [isDragging, setIsDragging] = useState(false);
    const [dragType, setDragType] = useState<'move' | 'resize-left' | 'resize-right' | null>(null);
    const [tempStartMs, setTempStartMs] = useState(actStartMs);
    const [tempEndMs, setTempEndMs] = useState(actEndMs);

    const tempStartRef = useRef(actStartMs);
    const tempEndRef = useRef(actEndMs);
    const isCtrlClickedRef = useRef(false);

    useEffect(() => {
        if (!isDragging) {
            setTempStartMs(actStartMs);
            setTempEndMs(actEndMs);
            tempStartRef.current = actStartMs;
            tempEndRef.current = actEndMs;
        }
    }, [activity.horaInicio, activity.horaFim, isDragging]);

    const handleStartDrag = (e: React.MouseEvent | React.TouchEvent, type: 'move' | 'resize-left' | 'resize-right') => {
        e.stopPropagation();

        isCtrlClickedRef.current = ('ctrlKey' in e && (e.ctrlKey || e.metaKey)) || isCtrlHeld;

        const clientX = 'touches' in e ? e.touches[0].clientX : e.clientX;
        const initialMouseX = clientX;
        const initialScrollLeft = scrollContainerRef.current?.scrollLeft || 0;
        const origStart = new Date(activity.horaInicio).getTime();
        const origEnd = new Date(activity.horaFim).getTime();
        const origDuration = origEnd - origStart;

        let hasMoved = false;

        document.body.style.cursor = type === 'move' ? 'grabbing' : 'ew-resize';
        document.body.style.userSelect = 'none';

        const updatePosition = (currentClientX: number) => {
            const currentScrollLeft = scrollContainerRef.current?.scrollLeft || 0;
            const deltaX = (currentClientX + currentScrollLeft) - (initialMouseX + initialScrollLeft);

            if (!hasMoved && Math.abs(deltaX) > 3) {
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
                if (currentClientX > rect.right - 80) {
                    scrollContainerRef.current.scrollLeft += 20;
                } else if (currentClientX < rect.left + 180) {
                    scrollContainerRef.current.scrollLeft -= 20;
                }
            }
        };

        const handleMouseMove = (moveEv: MouseEvent) => {
            moveEv.preventDefault();
            updatePosition(moveEv.clientX);
        };

        const handleTouchMove = (touchEv: TouchEvent) => {
            if (touchEv.touches.length > 0) {
                updatePosition(touchEv.touches[0].clientX);
            }
        };

        const finishDrag = () => {
            document.body.style.cursor = '';
            document.body.style.userSelect = '';
            window.removeEventListener('mousemove', handleMouseMove);
            window.removeEventListener('mouseup', handleMouseUp);
            window.removeEventListener('touchmove', handleTouchMove);
            window.removeEventListener('touchend', handleTouchEnd);

            if (hasMoved) {
                setIsDragging(false);
                setDragType(null);

                const finalStart = tempStartRef.current;
                const finalEnd = tempEndRef.current;

                if (finalStart !== origStart || finalEnd !== origEnd) {
                    const totalMins = Math.round((finalEnd - finalStart) / 60000);
                    const h = Math.floor(totalMins / 60);
                    const m = totalMins % 60;
                    const duracaoStr = `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}`;

                    // Derive shift for new start date/time
                    const startDate = new Date(finalStart);
                    const startHour = startDate.getHours();
                    const shiftKey = (startHour >= 0 && startHour < 8) ? '00-08' : (startHour >= 8 && startHour < 16) ? '08-16' : '16-00';
                    const newShift = getShiftInfo(startDate, shiftKey).letter;

                    if (onUpdateActivity) {
                        onUpdateActivity({
                            ...activity,
                            horaInicio: new Date(finalStart).toISOString(),
                            horaFim: new Date(finalEnd).toISOString(),
                            duracao: duracaoStr,
                            turno: activity.turno === 'ADM' ? 'ADM' : (newShift as any)
                        });
                    }
                }
            } else {
                const syntheticEvent = {
                    ctrlKey: isCtrlClickedRef.current,
                    metaKey: isCtrlClickedRef.current,
                    stopPropagation: () => {},
                    preventDefault: () => {}
                } as unknown as React.MouseEvent;
                onClick(syntheticEvent);
            }
        };

        const handleMouseUp = () => finishDrag();
        const handleTouchEnd = () => finishDrag();

        window.addEventListener('mousemove', handleMouseMove, { passive: false });
        window.addEventListener('mouseup', handleMouseUp);
        window.addEventListener('touchmove', handleTouchMove, { passive: true });
        window.addEventListener('touchend', handleTouchEnd);
    };

    const displayStartMs = isDragging ? tempStartMs : actStartMs;
    const displayEndMs = isDragging ? tempEndMs : actEndMs;

    const pxPerMs = hourWidth / 3600000;
    const diffMs = displayStartMs - chartStart;
    const durationMs = displayEndMs - displayStartMs;

    const left = diffMs * pxPerMs;
    const width = Math.max(durationMs * pxPerMs, 8);

    const barColor = STATUS_COLORS[activity.status] || 'bg-gray-500';
    const progressPercent = activity.status === ActivityStatus.Closed ? 100 : (activity.progresso !== undefined ? Number(activity.progresso) : 0);

    let linkingEffectClass = '';
    if (isSelectedPredecessor) {
        linkingEffectClass = 'ring-4 ring-indigo-500 ring-offset-2 ring-offset-white dark:ring-offset-gray-900 z-40 shadow-2xl scale-[1.02] animate-pulse';
    } else if (isHoveredPredecessor) {
        linkingEffectClass = 'ring-4 ring-indigo-500 ring-offset-2 ring-offset-white dark:ring-offset-gray-900 z-40 shadow-2xl scale-[1.02] brightness-110 animate-pulse';
    } else if (isHoveredSuccessor) {
        linkingEffectClass = 'ring-4 ring-emerald-500 ring-offset-2 ring-offset-white dark:ring-offset-gray-900 z-40 shadow-2xl scale-[1.02] brightness-110 animate-pulse';
    } else if (isLinkingMode && isSameMpAsSelected) {
        linkingEffectClass = 'hover:ring-2 hover:ring-amber-400 hover:scale-[1.01] cursor-pointer';
    } else if (isDimmed) {
        linkingEffectClass = 'opacity-30 grayscale-[30%]';
    }

    return (
        <div 
            className={`absolute top-1/2 -translate-y-1/2 rounded-md flex items-center text-[10px] font-medium text-white shadow-sm ${barColor} select-none group transition-all duration-150 ${
                isDragging 
                    ? 'ring-2 ring-blue-400 z-50 cursor-grabbing shadow-2xl opacity-95 scale-[1.01]' 
                    : isSelectedPredecessor || isHoveredPredecessor || isHoveredSuccessor
                        ? linkingEffectClass
                        : 'cursor-grab hover:ring-1 hover:ring-white hover:z-20 opacity-90 hover:opacity-100 ' + linkingEffectClass
            }`}
            style={{ 
                left: `${left}px`, 
                width: `${width}px`, 
                height: `${height * 0.72}px`,
            }}
            onMouseDown={(e) => handleStartDrag(e, 'move')}
            onTouchStart={(e) => handleStartDrag(e, 'move')}
            title={
                !isDragging 
                    ? isSelectedPredecessor
                        ? `🔗 PREDECESSORA SELECIONADA\nClique em outra atividade para vinculá-la como SUCESSORA (ou pressione ESC)`
                        : isHoveredPredecessor
                            ? `🔗 ATIVIDADE PREDECESSORA\n${activity.tag} - ${activity.descricao}`
                            : isHoveredSuccessor
                                ? `🔗 ATIVIDADE SUCESSORA\n${activity.tag} - ${activity.descricao}`
                                : isLinkingMode && isSameMpAsSelected
                                    ? `👉 Clique para definir como SUCESSORA desta MP`
                                    : `${activity.tag} - ${activity.descricao}\n${new Date(activity.horaInicio).toLocaleString()} - ${new Date(activity.horaFim).toLocaleString()}\nAvanço: ${progressPercent}%\n(Ctrl+Clique para selecionar como predecessora / Arraste para mover)`
                    : undefined
            }
        >
            {/* Progress Fill Underlay */}
            {progressPercent > 0 && (
                <div 
                    className="absolute left-0 top-0 bottom-0 bg-white/25 dark:bg-white/30 rounded-l-md pointer-events-none transition-all"
                    style={{ width: `${progressPercent}%` }}
                />
            )}

            {/* Left Resize Handle */}
            <div 
                onMouseDown={(e) => handleStartDrag(e, 'resize-left')}
                onTouchStart={(e) => handleStartDrag(e, 'resize-left')}
                className="absolute left-0 top-0 bottom-0 w-3 cursor-ew-resize opacity-0 group-hover:opacity-100 hover:bg-white/40 rounded-l-md flex items-center justify-center transition-opacity z-10"
                title="Arrastar para alterar horário de início"
            >
                <div className="w-[2px] h-3.5 bg-white/90 rounded-full" />
            </div>

            {/* Label */}
            {width > 35 && (
                <span className="truncate pointer-events-none px-2 font-semibold z-10 flex items-center gap-1">
                    {isSelectedPredecessor && (
                        <span className="bg-indigo-950/90 text-indigo-200 text-[8px] font-black px-1 rounded flex-shrink-0 uppercase tracking-tighter border border-indigo-400/50">
                            🔗 Pred
                        </span>
                    )}
                    {isHoveredPredecessor && !isSelectedPredecessor && (
                        <span className="bg-indigo-950/95 text-indigo-200 text-[8px] font-black px-1 rounded flex-shrink-0 uppercase tracking-tighter border border-indigo-400/60 shadow-xs">
                            🔗 Predecessora
                        </span>
                    )}
                    {isHoveredSuccessor && (
                        <span className="bg-emerald-950/95 text-emerald-200 text-[8px] font-black px-1 rounded flex-shrink-0 uppercase tracking-tighter border border-emerald-400/60 shadow-xs">
                            🔗 Sucessora
                        </span>
                    )}
                    <span>{activity.descricao}</span>
                    {progressPercent > 0 && (
                        <span className="text-[9px] opacity-90 font-mono">({progressPercent}%)</span>
                    )}
                </span>
            )}

            {/* Right Resize Handle */}
            <div 
                onMouseDown={(e) => handleStartDrag(e, 'resize-right')}
                onTouchStart={(e) => handleStartDrag(e, 'resize-right')}
                className="absolute right-0 top-0 bottom-0 w-3 cursor-ew-resize opacity-0 group-hover:opacity-100 hover:bg-white/40 rounded-r-md flex items-center justify-center transition-opacity z-10"
                title="Arrastar para alterar horário de fim"
            >
                <div className="w-[2px] h-3.5 bg-white/90 rounded-full" />
            </div>

            {/* Live Dragging Floating Tooltip */}
            {isDragging && (
                <div className="absolute -top-12 left-1/2 -translate-x-1/2 bg-gray-900/95 text-white dark:bg-gray-100/95 dark:text-gray-900 text-[11px] font-extrabold py-1.5 px-3 rounded-lg shadow-2xl whitespace-nowrap z-50 pointer-events-none flex items-center gap-2 border border-blue-500/50 backdrop-blur-md">
                    <span className="w-2 h-2 rounded-full bg-blue-400 animate-ping"></span>
                    <span>{formatDateRange(displayStartMs, displayEndMs)}</span>
                    <span className="text-[10px] opacity-80 font-normal">
                        ({Math.floor(durationMs / 3600000)}h {Math.round((durationMs % 3600000) / 60000)}m)
                    </span>
                    {(() => {
                        const sDate = new Date(displayStartMs);
                        const sHour = sDate.getHours();
                        const sKey = (sHour >= 0 && sHour < 8) ? '00-08' : (sHour >= 8 && sHour < 16) ? '08-16' : '16-00';
                        const sInfo = getShiftInfo(sDate, sKey);
                        return (
                            <span className={`px-1.5 py-0.5 rounded text-[9px] font-black ${sInfo.bg} ${sInfo.text}`}>
                                Turno {sInfo.letter}
                            </span>
                        );
                    })()}
                </div>
            )}
        </div>
    );
};

export const ActivityGanttView: React.FC<ActivityGanttViewProps> = ({ 
    activities, 
    onEdit, 
    onUpdateActivity,
    onRecalculateSchedule
}) => {
    const [currentTime, setCurrentTime] = useState(new Date());
    const [hourWidth, setHourWidth] = useState(60); // Zoom level
    const [isCompact, setIsCompact] = useState(false); // Row height toggle
    const [showDependencies, setShowDependencies] = useState(true); // Predecessor/Successor link arrows
    const [selectedSourceActivity, setSelectedSourceActivity] = useState<Activity | null>(null);
    const [hoveredLink, setHoveredLink] = useState<{
        id: string;
        predId: string;
        succId: string;
        fromX: number;
        fromY: number;
        toX: number;
        toY: number;
        isConflict: boolean;
        predTag: string;
        succTag: string;
        predDesc: string;
        succDesc: string;
    } | null>(null);
    const [isCtrlHeld, setIsCtrlHeld] = useState(false);
    const [toast, setToast] = useState<{ message: string; type: 'success' | 'warning' | 'info'; id: number } | null>(null);
    const toastTimerRef = useRef<NodeJS.Timeout | null>(null);

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

    const showToast = useCallback((message: string, type: 'success' | 'warning' | 'info' = 'info') => {
        if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
        const id = Date.now();
        setToast({ message, type, id });
        toastTimerRef.current = setTimeout(() => {
            setToast(prev => (prev?.id === id ? null : prev));
        }, 4000);
    }, []);

    // Global keyboard listener for ESC and Ctrl/Cmd keys
    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.key === 'Escape' && selectedSourceActivity) {
                setSelectedSourceActivity(null);
                showToast('Seleção de predecessora cancelada.', 'info');
            }
            if (e.key === 'Control' || e.key === 'Meta') {
                setIsCtrlHeld(true);
            }
        };

        const handleKeyUp = (e: KeyboardEvent) => {
            if (e.key === 'Control' || e.key === 'Meta') {
                setIsCtrlHeld(false);
            }
        };

        window.addEventListener('keydown', handleKeyDown);
        window.addEventListener('keyup', handleKeyUp);
        return () => {
            window.removeEventListener('keydown', handleKeyDown);
            window.removeEventListener('keyup', handleKeyUp);
        };
    }, [selectedSourceActivity, showToast]);

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

    // Sort strictly by Date first.
    const sortedActivities = useMemo(() => {
        return [...activities].sort((a,b) => {
            return new Date(a.horaInicio).getTime() - new Date(b.horaInicio).getTime();
        });
    }, [activities]);

    const sequenceMap = useMemo(() => getActivitySequenceMap(activities), [activities]);

    // Calculate dependency links coordinates for SVG arrows
    const dependencyLinks = useMemo(() => {
        if (!showDependencies) return [];

        const actMap = new Map<string, { idx: number; activity: Activity }>();
        sortedActivities.forEach((act, idx) => {
            actMap.set(act.id, { idx, activity: act });
            if (act.idMp) actMap.set(act.idMp.toLowerCase(), { idx, activity: act });
            if (act.tag) actMap.set(act.tag.toLowerCase(), { idx, activity: act });
        });

        const links: {
            id: string;
            predId: string;
            succId: string;
            fromX: number;
            fromY: number;
            toX: number;
            toY: number;
            isConflict: boolean;
            predTag: string;
            succTag: string;
            predDesc: string;
            succDesc: string;
        }[] = [];

        sortedActivities.forEach((succAct, succIdx) => {
            if (!succAct.idMp || !succAct.idMp.trim()) return;
            const normSuccMp = succAct.idMp.trim().toLowerCase();

            const preds = succAct.predecessoras || [];
            const succStartMs = new Date(succAct.horaInicio).getTime();
            const succToX = (succStartMs - chartStart) * pxPerMs;
            const succToY = succIdx * rowHeight + rowHeight / 2;

            preds.forEach((predId) => {
                const predEntry = actMap.get(predId) || actMap.get(predId.toLowerCase());
                if (
                    predEntry && 
                    predEntry.activity.id !== succAct.id &&
                    predEntry.activity.idMp &&
                    predEntry.activity.idMp.trim().toLowerCase() === normSuccMp
                ) {
                    const predEndMs = new Date(predEntry.activity.horaFim).getTime();
                    const predFromX = (predEndMs - chartStart) * pxPerMs;
                    const predFromY = predEntry.idx * rowHeight + rowHeight / 2;
                    const isConflict = predEndMs > succStartMs;

                    links.push({
                        id: `${predEntry.activity.id}->${succAct.id}`,
                        predId: predEntry.activity.id,
                        succId: succAct.id,
                        fromX: predFromX,
                        fromY: predFromY,
                        toX: succToX,
                        toY: succToY,
                        isConflict,
                        predTag: predEntry.activity.tag,
                        succTag: succAct.tag,
                        predDesc: predEntry.activity.descricao,
                        succDesc: succAct.descricao
                    });
                }
            });
        });

        return links;
    }, [showDependencies, sortedActivities, chartStart, pxPerMs, rowHeight]);

    // Activity Click & Dependency Linking Handler
    const handleActivityClick = useCallback((clickedAct: Activity, e?: React.MouseEvent) => {
        const isCtrl = !!(e && (e.ctrlKey || e.metaKey)) || isCtrlHeld;

        // 1. If currently in linking mode (or an activity is already selected as source)
        if (selectedSourceActivity) {
            // Clicking the same activity deselects it
            if (selectedSourceActivity.id === clickedAct.id) {
                setSelectedSourceActivity(null);
                showToast('Seleção de predecessora cancelada.', 'info');
                return;
            }

            // Validate ID MP match
            const sourceMp = (selectedSourceActivity.idMp || '').trim().toLowerCase();
            const targetMp = (clickedAct.idMp || '').trim().toLowerCase();

            if (!sourceMp || !targetMp || sourceMp !== targetMp) {
                showToast(
                    `⚠️ Não é possível vincular: Atividades devem pertencer ao mesmo ID MP (Fonte: "${selectedSourceActivity.idMp || 'Sem MP'}" ≠ Destino: "${clickedAct.idMp || 'Sem MP'}").`,
                    'warning'
                );
                return;
            }

            // Check if already linked
            const currentPreds = clickedAct.predecessoras || [];
            if (
                currentPreds.includes(selectedSourceActivity.id) || 
                (selectedSourceActivity.tag && currentPreds.includes(selectedSourceActivity.tag))
            ) {
                showToast(`A atividade "${clickedAct.tag || clickedAct.descricao}" já possui "${selectedSourceActivity.tag || selectedSourceActivity.descricao}" como predecessora.`, 'info');
                setSelectedSourceActivity(null);
                return;
            }

            // Calculate auto schedule alignment for successor respecting duration
            const predEndMs = new Date(selectedSourceActivity.horaFim).getTime();
            const succDurationMs = parseDurationToMs(clickedAct.duracao, clickedAct.horaInicio, clickedAct.horaFim);
            const currentSuccStartMs = new Date(clickedAct.horaInicio).getTime();

            let updatedSucc: Activity = {
                ...clickedAct,
                predecessoras: cleanDependencyIds([...currentPreds, selectedSourceActivity.id])
            };

            // If target starts before predecessor finishes, adjust start/end respecting duration
            if (currentSuccStartMs < predEndMs) {
                const newStart = new Date(predEndMs);
                const newEnd = new Date(predEndMs + succDurationMs);
                updatedSucc.horaInicio = newStart.toISOString();
                updatedSucc.horaFim = newEnd.toISOString();
                updatedSucc.duracao = formatMsToDuration(succDurationMs);
                if (updatedSucc.turno !== 'ADM') {
                    const newShift = calculateShiftForDate(newStart);
                    if (newShift) updatedSucc.turno = newShift as any;
                }
            }

            if (onUpdateActivity) {
                onUpdateActivity(updatedSucc);
            }

            const sourceTagOrDesc = selectedSourceActivity.tag || selectedSourceActivity.descricao;
            const targetTagOrDesc = clickedAct.tag || clickedAct.descricao;
            showToast(`✅ Vínculo criado! "${targetTagOrDesc}" agora é sucessora de "${sourceTagOrDesc}".`, 'success');
            setSelectedSourceActivity(null);
            return;
        }

        // 2. If Ctrl was held (or clicked while Ctrl is pressed)
        if (isCtrl) {
            setSelectedSourceActivity(clickedAct);
            const tagOrDesc = clickedAct.tag || clickedAct.descricao;
            showToast(`🔗 Atividade "${tagOrDesc}" selecionada como PREDECESSORA! Clique na atividade sucessora para vincular.`, 'info');
            return;
        }

        // 3. Default: normal click opens edit modal
        onEdit(clickedAct);
    }, [selectedSourceActivity, isCtrlHeld, onUpdateActivity, onEdit, showToast]);

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

    return (
        <div className={`flex flex-col h-[80vh] bg-white/70 dark:bg-gray-900/80 backdrop-blur-md rounded-lg shadow border border-gray-200/50 dark:border-gray-700/50 relative ${isResizing ? 'select-none cursor-col-resize' : ''}`}>
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

            {/* Toast Notification */}
            {toast && (
                <div className={`absolute top-14 left-1/2 -translate-x-1/2 z-50 px-4 py-2 rounded-lg shadow-xl text-xs font-semibold flex items-center gap-2 border backdrop-blur-md transition-all animate-in fade-in slide-in-from-top-2 duration-200 ${
                    toast.type === 'success' 
                        ? 'bg-emerald-900/90 text-emerald-100 border-emerald-500/50' 
                        : toast.type === 'warning'
                            ? 'bg-amber-900/90 text-amber-100 border-amber-500/50'
                            : 'bg-indigo-900/90 text-indigo-100 border-indigo-500/50'
                }`}>
                    <span>{toast.type === 'success' ? '✅' : toast.type === 'warning' ? '⚠️' : 'ℹ️'}</span>
                    <span>{toast.message}</span>
                </div>
            )}

            {/* Floating Banner when predecessor is selected */}
            {selectedSourceActivity && (
                <div className="absolute bottom-4 left-1/2 -translate-x-1/2 z-50 bg-indigo-950/95 text-white px-5 py-2.5 rounded-xl shadow-2xl border border-indigo-400/60 flex items-center gap-4 backdrop-blur-md animate-in fade-in slide-in-from-bottom-3 duration-200">
                    <div className="flex items-center gap-2">
                        <span className="w-2.5 h-2.5 rounded-full bg-indigo-400 animate-ping" />
                        <span className="font-bold text-xs uppercase tracking-wide text-indigo-300">Vinculando:</span>
                    </div>
                    <div className="text-xs flex items-center gap-1.5 flex-wrap">
                        <span className="text-indigo-200">Predecessora:</span>
                        <span className="font-bold bg-indigo-800/90 px-2 py-0.5 rounded border border-indigo-500/50 text-white">
                            #{sequenceMap.get(selectedSourceActivity.id) || ''} {selectedSourceActivity.tag} - {selectedSourceActivity.descricao}
                        </span>
                        <span className="text-amber-300 font-bold mx-1">➔</span>
                        <span className="text-amber-200 font-medium">Clique na atividade Sucessora</span>
                        {selectedSourceActivity.idMp && (
                            <span className="text-indigo-300 text-[11px] font-mono">(MP: {selectedSourceActivity.idMp})</span>
                        )}
                    </div>
                    <button
                        type="button"
                        onClick={() => {
                            setSelectedSourceActivity(null);
                            showToast('Seleção cancelada.', 'info');
                        }}
                        className="px-2.5 py-1 text-xs font-bold bg-white/20 hover:bg-white/30 text-white rounded-md transition-colors"
                        title="Pressione ESC ou clique para cancelar"
                    >
                        Cancelar (Esc)
                    </button>
                </div>
            )}
            
            {/* Controls Toolbar */}
            <div className="p-2 border-b border-gray-200/50 dark:border-gray-700/50 flex flex-wrap items-center justify-between gap-2 bg-gray-50/50 dark:bg-gray-800/50 rounded-t-lg">
                <div className="flex flex-wrap items-center gap-3">
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

                    <label className="flex items-center cursor-pointer space-x-1.5 text-xs text-gray-700 dark:text-gray-300">
                        <input 
                            type="checkbox" 
                            checked={showDependencies} 
                            onChange={(e) => setShowDependencies(e.target.checked)} 
                            className="rounded text-indigo-600 focus:ring-indigo-500 dark:bg-gray-700 dark:border-gray-600"
                        />
                        <span className="font-semibold text-indigo-600 dark:text-indigo-400">🔗 Vínculos ({dependencyLinks.length})</span>
                    </label>

                    {/* Quick Link Badge / Toggle Indicator */}
                    <div 
                        className={`flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-semibold border transition-all ${
                            selectedSourceActivity 
                                ? 'bg-amber-100 text-amber-900 border-amber-300 dark:bg-amber-950/80 dark:text-amber-200 dark:border-amber-700 shadow-sm'
                                : isCtrlHeld
                                    ? 'bg-indigo-100 text-indigo-800 border-indigo-300 dark:bg-indigo-950 dark:text-indigo-200 shadow-sm'
                                    : 'bg-white/80 dark:bg-gray-700/80 text-gray-700 dark:text-gray-300 border-gray-200 dark:border-gray-600'
                        }`}
                        title="Segure a tecla CTRL e clique em uma atividade para selecioná-la como Predecessora, depois clique em outra para vinculá-la como Sucessora"
                    >
                        <span>🔗</span>
                        <span>
                            {selectedSourceActivity 
                                ? 'Clique na Sucessora...' 
                                : isCtrlHeld 
                                    ? 'Ctrl Ativo: Clique na Predecessora' 
                                    : 'Ctrl + Clique p/ Vincular'}
                        </span>
                    </div>

                    {onRecalculateSchedule && (
                        <button
                            type="button"
                            onClick={onRecalculateSchedule}
                            className="px-2.5 py-1 text-xs font-semibold bg-indigo-50 text-indigo-700 dark:bg-indigo-950/60 dark:text-indigo-300 rounded border border-indigo-200 dark:border-indigo-800 hover:bg-indigo-100 dark:hover:bg-indigo-900/60 transition-colors flex items-center space-x-1 shadow-sm"
                            title="Ajustar e alinhar automaticamente datas e horários de atividades com predecessoras/sucessoras respeitando durações"
                        >
                            <span>⚡ Auto-Ajustar Vínculos</span>
                        </button>
                    )}

                    <div className="hidden lg:flex items-center space-x-1.5 text-xs text-blue-700 dark:text-blue-300 bg-blue-50 dark:bg-blue-950/40 px-2.5 py-1 rounded-md border border-blue-200/60 dark:border-blue-800/60">
                        <span className="font-bold">💡 Dica:</span>
                        <span>Segure Ctrl e clique em uma atividade, depois clique em outra para vincular como sucessora.</span>
                    </div>
                </div>
                
                <button 
                    onClick={scrollToNow}
                    className="px-3 py-1 text-xs bg-red-100/80 text-red-700 dark:bg-red-900/50 dark:text-red-300 rounded border border-red-200 dark:border-red-800 hover:bg-red-200 transition-colors font-medium shadow-xs"
                >
                    Ir para Agora
                </button>
            </div>

            {/* Main Chart Area */}
            <div className="flex-1 overflow-x-scroll overflow-y-auto relative custom-gantt-scroll" ref={containerRef}>
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
                        <div 
                            className="absolute top-0 bottom-0" 
                            style={{ 
                                left: `${yAxisWidth}px`, 
                                width: `${totalChartWidth}px`, 
                                pointerEvents: 'none',
                                zIndex: 0
                            }}
                        >
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

                        {/* SVG Layer for Dependency Connector Arrows */}
                        {showDependencies && dependencyLinks.length > 0 && (
                            <svg 
                                className="absolute top-0 bottom-0 pointer-events-none"
                                style={{ 
                                    left: `${yAxisWidth}px`, 
                                    width: `${totalChartWidth}px`, 
                                    height: `${sortedActivities.length * rowHeight}px`, 
                                    zIndex: 25 
                                }}
                            >
                                <defs>
                                    <filter id="glow-indigo" x="-30%" y="-30%" width="160%" height="160%">
                                        <feDropShadow dx="0" dy="0" stdDeviation="4" floodColor="#6366f1" floodOpacity="0.9" />
                                    </filter>
                                    <filter id="glow-conflict" x="-30%" y="-30%" width="160%" height="160%">
                                        <feDropShadow dx="0" dy="0" stdDeviation="4" floodColor="#ef4444" floodOpacity="0.9" />
                                    </filter>
                                    <marker id="arrow-normal" markerWidth="6" markerHeight="6" refX="5" refY="3" orient="auto" markerUnits="strokeWidth">
                                        <path d="M0,0 L0,6 L6,3 z" fill="#6366f1" />
                                    </marker>
                                    <marker id="arrow-normal-hover" markerWidth="8" markerHeight="8" refX="7" refY="4" orient="auto" markerUnits="strokeWidth">
                                        <path d="M0,0 L0,8 L8,4 z" fill="#4338ca" />
                                    </marker>
                                    <marker id="arrow-conflict" markerWidth="6" markerHeight="6" refX="5" refY="3" orient="auto" markerUnits="strokeWidth">
                                        <path d="M0,0 L0,6 L6,3 z" fill="#ef4444" />
                                    </marker>
                                    <marker id="arrow-conflict-hover" markerWidth="8" markerHeight="8" refX="7" refY="4" orient="auto" markerUnits="strokeWidth">
                                        <path d="M0,0 L0,8 L8,4 z" fill="#dc2626" />
                                    </marker>
                                </defs>
                                {dependencyLinks.map(link => {
                                    const deltaX = link.toX - link.fromX;
                                    const midX = deltaX > 20 ? link.fromX + deltaX / 2 : link.fromX + 15;
                                    const pathD = deltaX >= 10
                                        ? `M ${link.fromX} ${link.fromY} C ${midX} ${link.fromY}, ${midX} ${link.toY}, ${link.toX} ${link.toY}`
                                        : `M ${link.fromX} ${link.fromY} L ${link.fromX + 10} ${link.fromY} L ${link.fromX + 10} ${link.fromY + (link.toY > link.fromY ? rowHeight / 2 : -rowHeight / 2)} L ${link.toX - 10} ${link.fromY + (link.toY > link.fromY ? rowHeight / 2 : -rowHeight / 2)} L ${link.toX - 10} ${link.toY} L ${link.toX} ${link.toY}`;

                                    const isHovered = hoveredLink?.id === link.id;
                                    const isAnyLinkHovered = !!hoveredLink;

                                    return (
                                        <g 
                                            key={link.id} 
                                            className="cursor-pointer pointer-events-auto group"
                                            onMouseEnter={() => setHoveredLink(link)}
                                            onMouseLeave={() => setHoveredLink(prev => (prev?.id === link.id ? null : prev))}
                                        >
                                            {/* Invisible Wide Hit Area for seamless hovering */}
                                            <path
                                                d={pathD}
                                                fill="none"
                                                stroke="transparent"
                                                strokeWidth={18}
                                                className="cursor-pointer"
                                            />

                                            {/* Visible Line */}
                                            <path
                                                d={pathD}
                                                fill="none"
                                                stroke={link.isConflict ? (isHovered ? '#dc2626' : '#ef4444') : (isHovered ? '#4338ca' : '#6366f1')}
                                                strokeWidth={isHovered ? 3.5 : (link.isConflict ? 2 : 1.5)}
                                                strokeDasharray={link.isConflict ? '5,3' : (isHovered ? '6,3' : undefined)}
                                                markerEnd={
                                                    link.isConflict 
                                                        ? (isHovered ? 'url(#arrow-conflict-hover)' : 'url(#arrow-conflict)') 
                                                        : (isHovered ? 'url(#arrow-normal-hover)' : 'url(#arrow-normal)')
                                                }
                                                filter={isHovered ? (link.isConflict ? 'url(#glow-conflict)' : 'url(#glow-indigo)') : undefined}
                                                opacity={isHovered ? 1 : (isAnyLinkHovered ? 0.2 : 0.85)}
                                                className="transition-all duration-150"
                                            />
                                        </g>
                                    );
                                })}
                            </svg>
                        )}

                        {/* Floating Link Hover Tooltip */}
                        {hoveredLink && (
                            <div 
                                className="absolute z-50 pointer-events-none -translate-x-1/2 -translate-y-full mb-3 bg-gray-950/95 dark:bg-gray-900/95 text-white px-3.5 py-2 rounded-xl shadow-2xl border border-indigo-400/60 backdrop-blur-md flex items-center gap-2.5 whitespace-nowrap animate-in fade-in zoom-in-95 duration-150"
                                style={{
                                    left: `${yAxisWidth + (hoveredLink.fromX + hoveredLink.toX) / 2}px`,
                                    top: `${Math.min(hoveredLink.fromY, hoveredLink.toY) + Math.abs(hoveredLink.toY - hoveredLink.fromY) / 2}px`
                                }}
                            >
                                <div className="flex items-center gap-1.5 font-bold text-xs">
                                    <span className="text-indigo-400">🔗 Predecessora:</span>
                                    <span className="bg-indigo-900/90 text-indigo-100 px-2 py-0.5 rounded border border-indigo-500/40 text-[11px] font-mono">
                                        {hoveredLink.predTag} - {hoveredLink.predDesc}
                                    </span>
                                </div>
                                <span className="text-amber-400 font-black text-sm">➔</span>
                                <div className="flex items-center gap-1.5 font-bold text-xs">
                                    <span className="text-emerald-400">Sucessora:</span>
                                    <span className="bg-emerald-900/90 text-emerald-100 px-2 py-0.5 rounded border border-emerald-500/40 text-[11px] font-mono">
                                        {hoveredLink.succTag} - {hoveredLink.succDesc}
                                    </span>
                                </div>
                                {hoveredLink.isConflict && (
                                    <span className="bg-red-900/95 text-red-100 text-[10px] font-bold px-2 py-0.5 rounded border border-red-400/60 flex items-center gap-1 animate-pulse">
                                        ⚠️ Conflito de Horário!
                                    </span>
                                )}
                            </div>
                        )}

                        {/* Activity Rows */}
                        {sortedActivities.map((activity, index) => {
                            const isSelectedPred = selectedSourceActivity?.id === activity.id;
                            const isCandidate = !!selectedSourceActivity && !isSelectedPred && !!activity.idMp && activity.idMp.trim().toLowerCase() === selectedSourceActivity.idMp.trim().toLowerCase();

                            const isHoveredPred = hoveredLink?.predId === activity.id;
                            const isHoveredSucc = hoveredLink?.succId === activity.id;
                            const isHoveredLinked = isHoveredPred || isHoveredSucc;
                            const isDimmed = !!hoveredLink && !isHoveredLinked;

                            return (
                                <div 
                                    key={activity.id} 
                                    style={{ height: `${rowHeight}px` }} 
                                    className={`flex items-center border-b border-gray-100 dark:border-gray-700/50 relative hover:bg-blue-50/50 dark:hover:bg-gray-700/30 transition-all duration-150 z-10 ${
                                        isSelectedPred 
                                            ? 'bg-indigo-50/80 dark:bg-indigo-950/50' 
                                            : isHoveredPred
                                                ? 'bg-indigo-50/90 dark:bg-indigo-950/60 ring-1 ring-inset ring-indigo-400/40'
                                                : isHoveredSucc
                                                    ? 'bg-emerald-50/90 dark:bg-emerald-950/60 ring-1 ring-inset ring-emerald-400/40'
                                                    : isCandidate
                                                        ? 'bg-amber-50/40 dark:bg-amber-950/20'
                                                        : isDimmed
                                                            ? 'opacity-30'
                                                            : index % 2 === 0 ? 'bg-transparent' : 'bg-gray-50/30 dark:bg-gray-800/30'
                                    }`}
                                >
                                    {/* Y Axis Label (Sticky Left) */}
                                    <div 
                                        style={{ width: `${yAxisWidth}px` }}
                                        className={`flex-shrink-0 h-full px-3 sticky left-0 backdrop-blur-sm border-r flex flex-col justify-center cursor-pointer z-20 group transition-all duration-150 ${
                                            isSelectedPred
                                                ? 'bg-indigo-100 dark:bg-indigo-950/90 border-r-indigo-500 border-l-4 border-l-indigo-600 dark:border-l-indigo-400 ring-2 ring-indigo-500/40'
                                                : isHoveredPred
                                                    ? 'bg-indigo-100/95 dark:bg-indigo-950/95 border-r-indigo-500 border-l-4 border-l-indigo-600 ring-2 ring-indigo-500/50 shadow-md'
                                                    : isHoveredSucc
                                                        ? 'bg-emerald-100/95 dark:bg-emerald-950/95 border-r-emerald-500 border-l-4 border-l-emerald-600 ring-2 ring-emerald-500/50 shadow-md'
                                                        : isCandidate
                                                            ? 'bg-amber-50/90 dark:bg-amber-950/80 border-r-amber-400 hover:bg-amber-100/90 dark:hover:bg-amber-900/60'
                                                            : isDimmed
                                                                ? 'bg-white/60 dark:bg-gray-800/60 border-r-gray-200 dark:border-r-gray-700 opacity-40'
                                                                : 'bg-white/90 dark:bg-gray-800/90 border-r-gray-200 dark:border-r-gray-600'
                                        }`}
                                        title={
                                            isSelectedPred
                                                ? '🔗 Predecessora selecionada (clique para cancelar ou escolha a sucessora)'
                                                : isHoveredPred
                                                    ? '🔗 Predecessora do vínculo destacado'
                                                    : isHoveredSucc
                                                        ? '🔗 Sucessora do vínculo destacado'
                                                        : isCandidate
                                                            ? '👉 Clique para vincular como Sucessora desta atividade'
                                                            : `#${sequenceMap.get(activity.id) || ''} ${activity.tag} - ${activity.descricao} (Ctrl+Clique para selecionar como predecessora)`
                                        }
                                        onClick={(e) => handleActivityClick(activity, e)}
                                    >
                                        <div className="flex items-center justify-between gap-1">
                                            <div className="flex items-center gap-1.5 min-w-0">
                                                {sequenceMap.get(activity.id) !== undefined && (
                                                    <span className={`font-mono text-[10px] font-bold px-1 rounded flex-shrink-0 ${
                                                        isSelectedPred
                                                            ? 'bg-indigo-700 text-white'
                                                            : isHoveredPred
                                                                ? 'bg-indigo-600 text-white'
                                                                : isHoveredSucc
                                                                    ? 'bg-emerald-600 text-white'
                                                                    : 'text-indigo-700 dark:text-indigo-300 bg-indigo-100 dark:bg-indigo-950'
                                                    }`}>
                                                        #{sequenceMap.get(activity.id)}
                                                    </span>
                                                )}
                                                <p className={`font-bold truncate text-xs transition-colors ${
                                                    isSelectedPred
                                                        ? 'text-indigo-950 dark:text-indigo-200'
                                                        : isHoveredPred
                                                            ? 'text-indigo-950 dark:text-indigo-100 font-extrabold'
                                                            : isHoveredSucc
                                                                ? 'text-emerald-950 dark:text-emerald-100 font-extrabold'
                                                                : 'text-gray-800 dark:text-gray-200 group-hover:text-primary-600'
                                                }`}>
                                                    {activity.descricao}
                                                </p>
                                            </div>
                                            <div className="flex items-center gap-1 flex-shrink-0">
                                                {isSelectedPred && (
                                                    <span className="text-[8px] font-black uppercase text-indigo-700 dark:text-indigo-300 bg-indigo-200 dark:bg-indigo-900 px-1 py-0.2 rounded animate-pulse">
                                                        Pred
                                                    </span>
                                                )}
                                                {isHoveredPred && !isSelectedPred && (
                                                    <span className="text-[8px] font-black uppercase text-indigo-800 dark:text-indigo-200 bg-indigo-200 dark:bg-indigo-900 px-1.5 py-0.5 rounded shadow-xs border border-indigo-400/50 animate-pulse">
                                                        🔗 Pred
                                                    </span>
                                                )}
                                                {isHoveredSucc && (
                                                    <span className="text-[8px] font-black uppercase text-emerald-800 dark:text-emerald-200 bg-emerald-200 dark:bg-emerald-900 px-1.5 py-0.5 rounded shadow-xs border border-emerald-400/50 animate-pulse">
                                                        🔗 Succ
                                                    </span>
                                                )}
                                                {isCandidate && (
                                                    <span className="text-[8px] font-bold text-amber-700 dark:text-amber-300 bg-amber-100 dark:bg-amber-900/60 px-1 py-0.2 rounded">
                                                        ➔ Vincular
                                                    </span>
                                                )}
                                                <div className={`w-2 h-2 rounded-full ${STATUS_COLORS[activity.status]}`}></div>
                                            </div>
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
                                            onClick={(e) => handleActivityClick(activity, e)} 
                                            onUpdateActivity={onUpdateActivity}
                                            scrollContainerRef={containerRef}
                                            isSelectedPredecessor={isSelectedPred}
                                            isLinkingMode={!!selectedSourceActivity}
                                            isSameMpAsSelected={isCandidate}
                                            isCtrlHeld={isCtrlHeld}
                                            isHoveredPredecessor={isHoveredPred}
                                            isHoveredSuccessor={isHoveredSucc}
                                            isDimmed={isDimmed}
                                        />
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </div>
            </div>
        </div>
    );
};
