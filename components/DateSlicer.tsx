import React, { useMemo, useRef } from 'react';
import { type Activity } from '../types';
import { CalendarIcon } from './icons/CalendarIcon';
import { FunnelIcon } from './icons/FunnelIcon';
import { XMarkIcon } from './icons/XMarkIcon';
import { getDaySpecialInfo } from '../utils/holidayUtils';

export interface DateSlicerProps {
    activities: Activity[];
    selectedDates: string[]; // List of 'YYYY-MM-DD'
    onSelectDates: (dates: string[]) => void;
    matchMode?: 'start' | 'active'; // 'start' = only start date, 'active' = occurs on date (start to end)
    onToggleMatchMode?: (mode: 'start' | 'active') => void;
    className?: string;
}

export interface DayOption {
    dateKey: string; // YYYY-MM-DD
    dateObj: Date;
    dayOfMonth: number;
    month: number;
    year: number;
    dayOfWeekShort: string; // Seg, Ter, Qua...
    dayOfWeekFull: string;
    formattedDate: string; // 17/09
    fullFormattedDate: string; // 17/09/2026
    count: number;
    isToday: boolean;
    isSaturday: boolean;
    isSunday: boolean;
    isWeekend: boolean;
    isHoliday: boolean;
    holidayName?: string;
    badgeLabel?: string;
}

const DAY_NAMES_SHORT = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];
const DAY_NAMES_FULL = [
    'Domingo',
    'Segunda-feira',
    'Terça-feira',
    'Quarta-feira',
    'Quinta-feira',
    'Sexta-feira',
    'Sábado'
];

export const parseDateToKey = (date: Date): string => {
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, '0');
    const d = String(date.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
};

export const extractDateKeyFromIso = (isoStr?: string): string => {
    if (!isoStr) return '';
    try {
        const d = new Date(isoStr);
        if (isNaN(d.getTime())) return '';
        return parseDateToKey(d);
    } catch {
        return '';
    }
};

export const doesActivityMatchDate = (
    act: Activity,
    targetDateKey: string,
    mode: 'start' | 'active' = 'active'
): boolean => {
    if (!targetDateKey) return true;
    const startKey = extractDateKeyFromIso(act.horaInicio);
    if (!startKey) return targetDateKey === 'sem-data';

    if (mode === 'start') {
        return startKey === targetDateKey;
    }

    // 'active' mode: matches if startKey is targetDateKey, or targetDateKey is between startKey and endKey
    if (startKey === targetDateKey) return true;
    
    if (act.horaFim) {
        const endKey = extractDateKeyFromIso(act.horaFim);
        if (endKey && endKey >= startKey) {
            return targetDateKey >= startKey && targetDateKey <= endKey;
        }
    }

    return false;
};

export const DateSlicer: React.FC<DateSlicerProps> = ({
    activities,
    selectedDates,
    onSelectDates,
    matchMode = 'active',
    onToggleMatchMode,
    className = ''
}) => {
    const scrollContainerRef = useRef<HTMLDivElement>(null);

    // Get today's key
    const todayKey = useMemo(() => parseDateToKey(new Date()), []);

    // Extract all unique dates and compute stats
    const { dayOptions, noDateCount, totalActivitiesCount } = useMemo(() => {
        const dateKeyMap = new Map<string, number>();
        let noDate = 0;

        activities.forEach(act => {
            const startKey = extractDateKeyFromIso(act.horaInicio);
            if (!startKey) {
                noDate++;
                return;
            }

            if (matchMode === 'start') {
                dateKeyMap.set(startKey, (dateKeyMap.get(startKey) || 0) + 1);
            } else {
                // Active mode: register all days touched by this activity
                const endKey = extractDateKeyFromIso(act.horaFim) || startKey;
                
                if (endKey === startKey || endKey < startKey) {
                    dateKeyMap.set(startKey, (dateKeyMap.get(startKey) || 0) + 1);
                } else {
                    // Span from startKey to endKey (capped at 30 days max to prevent runaway loops)
                    const startDate = new Date(startKey + 'T12:00:00');
                    const endDate = new Date(endKey + 'T12:00:00');
                    const cur = new Date(startDate);
                    let iterations = 0;
                    
                    while (cur <= endDate && iterations < 31) {
                        const curKey = parseDateToKey(cur);
                        dateKeyMap.set(curKey, (dateKeyMap.get(curKey) || 0) + 1);
                        cur.setDate(cur.getDate() + 1);
                        iterations++;
                    }
                }
            }
        });

        // Convert to sorted day options
        const sortedKeys = Array.from(dateKeyMap.keys()).sort();

        const options: DayOption[] = sortedKeys.map(dateKey => {
            const [yStr, mStr, dStr] = dateKey.split('-');
            const year = parseInt(yStr, 10);
            const month = parseInt(mStr, 10);
            const dayOfMonth = parseInt(dStr, 10);
            const dateObj = new Date(year, month - 1, dayOfMonth, 12, 0, 0);
            const dayOfWeek = dateObj.getDay();

            const special = getDaySpecialInfo(dateObj);

            return {
                dateKey,
                dateObj,
                dayOfMonth,
                month,
                year,
                dayOfWeekShort: DAY_NAMES_SHORT[dayOfWeek],
                dayOfWeekFull: DAY_NAMES_FULL[dayOfWeek],
                formattedDate: `${String(dayOfMonth).padStart(2, '0')}/${String(month).padStart(2, '0')}`,
                fullFormattedDate: `${String(dayOfMonth).padStart(2, '0')}/${String(month).padStart(2, '0')}/${year}`,
                count: dateKeyMap.get(dateKey) || 0,
                isToday: dateKey === todayKey,
                isSaturday: special.isSaturday,
                isSunday: special.isSunday,
                isWeekend: special.isWeekend,
                isHoliday: special.isHoliday,
                holidayName: special.holiday?.name,
                badgeLabel: special.badgeLabel
            };
        });

        return {
            dayOptions: options,
            noDateCount: noDate,
            totalActivitiesCount: activities.length
        };
    }, [activities, matchMode, todayKey]);

    // Handle selecting a date
    const handleToggleDate = (dateKey: string, e: React.MouseEvent) => {
        // Multi-select enabled if Ctrl / Meta or Shift is pressed
        const isMulti = e.ctrlKey || e.metaKey || e.shiftKey;

        if (isMulti) {
            if (selectedDates.includes(dateKey)) {
                onSelectDates(selectedDates.filter(d => d !== dateKey));
            } else {
                onSelectDates([...selectedDates, dateKey]);
            }
        } else {
            // Single select toggle
            if (selectedDates.length === 1 && selectedDates[0] === dateKey) {
                // Clicking the only selected date unselects it (returns to All)
                onSelectDates([]);
            } else {
                onSelectDates([dateKey]);
            }
        }
    };

    const handleSelectAll = () => {
        onSelectDates([]);
    };

    const handleScroll = (direction: 'left' | 'right') => {
        if (scrollContainerRef.current) {
            const amount = direction === 'left' ? -280 : 280;
            scrollContainerRef.current.scrollBy({ left: amount, behavior: 'smooth' });
        }
    };

    // Calculate count of activities in current selection
    const selectedCount = useMemo(() => {
        if (selectedDates.length === 0) return totalActivitiesCount;
        return activities.filter(act => 
            selectedDates.some(dKey => doesActivityMatchDate(act, dKey, matchMode))
        ).length;
    }, [activities, selectedDates, matchMode, totalActivitiesCount]);

    // Format selected dates text for summary
    const selectedSummaryText = useMemo(() => {
        if (selectedDates.length === 0) return 'Todas as datas';
        if (selectedDates.length === 1) {
            const opt = dayOptions.find(o => o.dateKey === selectedDates[0]);
            if (opt) {
                return `${opt.dayOfWeekFull}, ${opt.fullFormattedDate}`;
            }
            if (selectedDates[0] === 'sem-data') return 'Sem data definida';
            return selectedDates[0];
        }
        return `${selectedDates.length} dias selecionados`;
    }, [selectedDates, dayOptions]);

    if (dayOptions.length === 0 && noDateCount === 0) {
        return null;
    }

    const isAllSelected = selectedDates.length === 0;

    return (
        <div className={`bg-white/80 dark:bg-gray-800/80 backdrop-blur-md rounded-xl border border-gray-200/80 dark:border-gray-700/80 shadow-xs p-3 transition-all print:hidden ${className}`}>
            {/* Header / Info Row */}
            <div className="flex flex-wrap items-center justify-between gap-2 mb-2.5 pb-2 border-b border-gray-100 dark:border-gray-700/60">
                <div className="flex items-center gap-2">
                    <div className="p-1.5 rounded-lg bg-primary-100/70 dark:bg-primary-950/60 text-primary-700 dark:text-primary-300">
                        <CalendarIcon className="w-4 h-4" />
                    </div>
                    <div>
                        <div className="flex items-center gap-1.5">
                            <span className="text-xs font-bold text-gray-800 dark:text-gray-100 tracking-tight">
                                Segmentação por Data
                            </span>
                            <span className="text-[11px] font-semibold text-gray-400 dark:text-gray-500">•</span>
                            <span className="text-xs font-medium text-primary-700 dark:text-primary-300">
                                {selectedSummaryText}
                            </span>
                        </div>
                        <p className="text-[10px] text-gray-500 dark:text-gray-400">
                            {isAllSelected 
                                ? `Exibindo todas as ${totalActivitiesCount} atividades do cronograma`
                                : `Filtrando ${selectedCount} de ${totalActivitiesCount} atividade(s) • Ctrl+clique para selecionar múltiplos dias`
                            }
                        </p>
                    </div>
                </div>

                {/* Right Actions: Mode toggle, Clear Filter, Scroll Arrows */}
                <div className="flex items-center gap-1.5">
                    {onToggleMatchMode && (
                        <div className="hidden sm:flex items-center rounded-lg bg-gray-100 dark:bg-gray-700/60 p-0.5 text-[10px] font-medium text-gray-600 dark:text-gray-300">
                            <button
                                type="button"
                                onClick={() => onToggleMatchMode('active')}
                                className={`px-2 py-0.5 rounded-md transition-all ${
                                    matchMode === 'active'
                                        ? 'bg-white dark:bg-gray-800 text-primary-700 dark:text-primary-300 font-bold shadow-2xs'
                                        : 'hover:text-gray-900 dark:hover:text-white'
                                }`}
                                title="Filtra atividades que iniciam ou estão em execução no dia"
                            >
                                Em andamento no dia
                            </button>
                            <button
                                type="button"
                                onClick={() => onToggleMatchMode('start')}
                                className={`px-2 py-0.5 rounded-md transition-all ${
                                    matchMode === 'start'
                                        ? 'bg-white dark:bg-gray-800 text-primary-700 dark:text-primary-300 font-bold shadow-2xs'
                                        : 'hover:text-gray-900 dark:hover:text-white'
                                }`}
                                title="Filtra somente atividades com início planejado neste dia"
                            >
                                Apenas início
                            </button>
                        </div>
                    )}

                    {!isAllSelected && (
                        <button
                            type="button"
                            onClick={handleSelectAll}
                            className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-semibold bg-rose-50 hover:bg-rose-100 text-rose-700 dark:bg-rose-950/60 dark:hover:bg-rose-900/60 dark:text-rose-300 border border-rose-200 dark:border-rose-800 transition-colors shadow-2xs"
                            title="Limpar seleção de datas e exibir todas as atividades"
                        >
                            <XMarkIcon className="w-3.5 h-3.5" />
                            <span>Limpar Filtro</span>
                        </button>
                    )}

                    {/* Navigation Buttons for wide list of dates */}
                    {dayOptions.length > 5 && (
                        <div className="flex items-center gap-1 pl-1 border-l border-gray-200 dark:border-gray-700">
                            <button
                                type="button"
                                onClick={() => handleScroll('left')}
                                className="w-6 h-6 rounded-md flex items-center justify-center text-gray-500 hover:text-gray-900 dark:text-gray-400 dark:hover:text-white hover:bg-gray-100 dark:hover:bg-gray-700 text-sm font-bold select-none"
                                title="Rolar dias para a esquerda"
                            >
                                ‹
                            </button>
                            <button
                                type="button"
                                onClick={() => handleScroll('right')}
                                className="w-6 h-6 rounded-md flex items-center justify-center text-gray-500 hover:text-gray-900 dark:text-gray-400 dark:hover:text-white hover:bg-gray-100 dark:hover:bg-gray-700 text-sm font-bold select-none"
                                title="Rolar dias para a direita"
                            >
                                ›
                            </button>
                        </div>
                    )}
                </div>
            </div>

            {/* Slicer Cards Bar */}
            <div 
                ref={scrollContainerRef}
                className="flex items-stretch gap-2 overflow-x-auto pb-1 pt-0.5 scrollbar-thin scrollbar-thumb-gray-300 dark:scrollbar-thumb-gray-600 select-none"
            >
                {/* "TODOS" Slicer Card */}
                <button
                    type="button"
                    onClick={handleSelectAll}
                    className={`flex flex-col items-center justify-between min-w-[78px] px-2.5 py-1.5 rounded-xl border text-center transition-all cursor-pointer ${
                        isAllSelected
                            ? 'bg-primary-600 border-primary-700 text-white shadow-md ring-2 ring-primary-500/30'
                            : 'bg-gray-50/90 dark:bg-gray-700/50 hover:bg-gray-100 dark:hover:bg-gray-700 border-gray-200 dark:border-gray-600 text-gray-700 dark:text-gray-200'
                    }`}
                    title="Exibir atividades de todas as datas disponíveis"
                >
                    <span className={`text-[10px] font-bold uppercase tracking-wider ${isAllSelected ? 'text-primary-100' : 'text-gray-400 dark:text-gray-400'}`}>
                        Todas
                    </span>
                    <span className="text-xs font-extrabold my-0.5">
                        Datas
                    </span>
                    <span className={`text-[10px] font-bold px-1.5 py-0.2 rounded-full ${
                        isAllSelected
                            ? 'bg-white/25 text-white'
                            : 'bg-gray-200 dark:bg-gray-600 text-gray-700 dark:text-gray-300'
                    }`}>
                        {totalActivitiesCount}
                    </span>
                </button>

                {/* Individual Day Cards */}
                {dayOptions.map(day => {
                    const isSelected = selectedDates.includes(day.dateKey);
                    
                    // Card background and border styling based on state and weekend/holiday
                    let cardStyle = '';
                    let subHeaderStyle = '';
                    let badgeBg = '';

                    if (isSelected) {
                        cardStyle = 'bg-primary-600 border-primary-700 text-white shadow-md ring-2 ring-primary-500/40';
                        subHeaderStyle = 'text-primary-100';
                        badgeBg = 'bg-white/25 text-white';
                    } else {
                        if (day.isWeekend || day.isHoliday) {
                            // Demarcated weekend / holiday styling in rose tone matching Gantt
                            cardStyle = 'bg-rose-50/70 dark:bg-rose-950/30 border-rose-200/90 dark:border-rose-800/60 hover:bg-rose-100/80 dark:hover:bg-rose-900/40 text-rose-950 dark:text-rose-100';
                            subHeaderStyle = 'text-rose-600 dark:text-rose-400';
                            badgeBg = 'bg-rose-200/80 dark:bg-rose-800/80 text-rose-900 dark:text-rose-100 font-bold';
                        } else {
                            cardStyle = 'bg-gray-50/90 dark:bg-gray-700/50 hover:bg-gray-100/90 dark:hover:bg-gray-700 border-gray-200 dark:border-gray-600 text-gray-800 dark:text-gray-200';
                            subHeaderStyle = 'text-gray-500 dark:text-gray-400';
                            badgeBg = 'bg-gray-200 dark:bg-gray-600 text-gray-700 dark:text-gray-300';
                        }
                    }

                    return (
                        <button
                            key={day.dateKey}
                            type="button"
                            onClick={(e) => handleToggleDate(day.dateKey, e)}
                            className={`group relative flex flex-col items-center justify-between min-w-[84px] px-2.5 py-1.5 rounded-xl border text-center transition-all cursor-pointer ${cardStyle}`}
                            title={`${day.dayOfWeekFull}, ${day.fullFormattedDate} • ${day.count} atividade(s)${day.holidayName ? ` • Feriado: ${day.holidayName}` : ''}${day.isSaturday ? ' • Sábado' : ''}${day.isSunday ? ' • Domingo' : ''} (Clique para filtrar / Ctrl+clique para múltiplos)`}
                        >
                            {/* Today Pill or Holiday Pill */}
                            {day.isToday && (
                                <span className={`absolute -top-1.5 px-1.5 py-0.2 text-[8px] font-black uppercase rounded-full tracking-wider shadow-2xs ${
                                    isSelected
                                        ? 'bg-amber-400 text-amber-950 ring-1 ring-white/50'
                                        : 'bg-amber-500 text-white dark:bg-amber-400 dark:text-amber-950 ring-1 ring-amber-600/30'
                                }`}>
                                    Hoje
                                </span>
                            )}

                            {/* Day of Week */}
                            <div className="flex items-center gap-1">
                                <span className={`text-[10px] font-bold uppercase tracking-wider ${subHeaderStyle}`}>
                                    {day.dayOfWeekShort}
                                </span>
                                {day.isHoliday && (
                                    <span className="text-[10px]" title={`Feriado: ${day.holidayName}`}>
                                        🎉
                                    </span>
                                )}
                            </div>

                            {/* Formatted Date (e.g. 17/09) */}
                            <span className="text-xs font-black tracking-tight my-0.5">
                                {day.formattedDate}
                            </span>

                            {/* Activity Count Badge */}
                            <div className="flex items-center gap-1">
                                <span className={`text-[10px] font-bold px-1.5 py-0.2 rounded-full transition-colors ${badgeBg}`}>
                                    {day.count} {day.count === 1 ? 'ativ.' : 'ativ.'}
                                </span>
                            </div>
                        </button>
                    );
                })}

                {/* "Sem Data" Card if any activities lack valid dates */}
                {noDateCount > 0 && (
                    <button
                        type="button"
                        onClick={(e) => handleToggleDate('sem-data', e)}
                        className={`flex flex-col items-center justify-between min-w-[80px] px-2.5 py-1.5 rounded-xl border text-center transition-all cursor-pointer ${
                            selectedDates.includes('sem-data')
                                ? 'bg-primary-600 border-primary-700 text-white shadow-md ring-2 ring-primary-500/40'
                                : 'bg-gray-50/70 dark:bg-gray-700/40 hover:bg-gray-100 dark:hover:bg-gray-700 border-dashed border-gray-300 dark:border-gray-600 text-gray-500 dark:text-gray-400'
                        }`}
                        title="Atividades que ainda não possuem data de início preenchida"
                    >
                        <span className="text-[10px] font-bold uppercase tracking-wider">
                            S/ Data
                        </span>
                        <span className="text-xs font-semibold my-0.5">
                            Pendente
                        </span>
                        <span className="text-[10px] font-bold px-1.5 py-0.2 rounded-full bg-gray-200 dark:bg-gray-600 text-gray-700 dark:text-gray-300">
                            {noDateCount}
                        </span>
                    </button>
                )}
            </div>
        </div>
    );
};
