import { Activity, ActivityStatus } from '../types';

export const getActivityProgress = (activity: Activity): number => {
    if (activity.status === ActivityStatus.Closed) {
        return 100;
    }
    if (activity.progresso !== undefined && activity.progresso !== null && !isNaN(Number(activity.progresso))) {
        return Math.min(100, Math.max(0, Math.round(Number(activity.progresso))));
    }
    if (activity.status === ActivityStatus.Open || activity.status === ActivityStatus.NaoExecutado) {
        return 0;
    }
    if (activity.status === ActivityStatus.ExecutadoParcialmente || activity.status === ActivityStatus.EmProgresso) {
        return 50;
    }
    return 0;
};

// Parse duration string (e.g. "01:30" or "1:30") to hours, or derive from start/end
export const getActivityWeightInHours = (activity: Activity): number => {
    if (activity.duracao && activity.duracao.includes(':')) {
        const parts = activity.duracao.split(':');
        const h = parseFloat(parts[0]) || 0;
        const m = parseFloat(parts[1]) || 0;
        const total = h + m / 60;
        if (total > 0) return total;
    }
    const start = new Date(activity.horaInicio).getTime();
    const end = new Date(activity.horaFim).getTime();
    if (!isNaN(start) && !isNaN(end) && end > start) {
        return (end - start) / (1000 * 60 * 60);
    }
    return 1; // Default minimum 1 hour weight
};

export interface SCurvePoint {
    timestamp: number;
    label: string;
    sublabel: string;
    planejadoAcumulado: number; // 0 to 100%
    realAcumulado: number | null; // 0 to 100%, null for future beyond real data
    desvio: number | null; // Real - Planejado
    planejadoPeriodo: number; // % in this period
    realPeriodo: number | null; // % in this period
    atividadesPlanejadas: number;
    atividadesRealizadas: number;
}

export interface SCurveSummary {
    totalAtividades: number;
    atividadesConcluidas: number;
    atividadesEmAndamento: number;
    atividadesNaoIniciadas: number;
    progressoRealTotal: number;
    progressoPlanejadoAteAgora: number;
    progressoPlanejadoTotal: number;
    desvioAtual: number;
    horasPlanejadas: number;
    horasReais: number;
    statusGeral: 'ADIANTADO' | 'NO PRAZO' | 'ATRASADO';
    dataInicio: string;
    dataFim: string;
}

export const calculateSCurveData = (
    activities: Activity[],
    granularity: 'auto' | 'hour' | 'shift' | 'day' = 'auto',
    weightMode: 'duration' | 'count' = 'duration'
): { points: SCurvePoint[]; summary: SCurveSummary } => {
    const validActivities = activities.filter(a => {
        const s = new Date(a.horaInicio).getTime();
        const e = new Date(a.horaFim).getTime();
        return !isNaN(s) && !isNaN(e);
    });

    if (validActivities.length === 0) {
        return {
            points: [],
            summary: {
                totalAtividades: 0,
                atividadesConcluidas: 0,
                atividadesEmAndamento: 0,
                atividadesNaoIniciadas: 0,
                progressoRealTotal: 0,
                progressoPlanejadoAteAgora: 0,
                progressoPlanejadoTotal: 0,
                desvioAtual: 0,
                horasPlanejadas: 0,
                horasReais: 0,
                statusGeral: 'NO PRAZO',
                dataInicio: 'N/A',
                dataFim: 'N/A'
            }
        };
    }

    // Determine project boundaries
    let minTime = Infinity;
    let maxTime = -Infinity;
    let maxRealTime = -Infinity;

    validActivities.forEach(a => {
        const pStart = new Date(a.horaInicio).getTime();
        const pEnd = new Date(a.horaFim).getTime();
        if (pStart < minTime) minTime = pStart;
        if (pEnd > maxTime) maxTime = pEnd;

        if (a.horaInicioReal) {
            const rStart = new Date(a.horaInicioReal).getTime();
            if (!isNaN(rStart) && rStart < minTime) minTime = rStart;
        }
        if (a.horaFimReal) {
            const rEnd = new Date(a.horaFimReal).getTime();
            if (!isNaN(rEnd)) {
                if (rEnd > maxTime) maxTime = rEnd;
                if (rEnd > maxRealTime) maxRealTime = rEnd;
            }
        } else if (getActivityProgress(a) > 0) {
            // In progress or closed without horaFimReal
            const fallback = a.status === ActivityStatus.Closed ? pEnd : Math.min(Date.now(), pEnd);
            if (fallback > maxRealTime) maxRealTime = fallback;
        }
    });

    // If maxRealTime was never set, fallback to minTime or now if within window
    const now = Date.now();
    const effectiveCutoffTime = maxRealTime > -Infinity 
        ? Math.max(maxRealTime, Math.min(now, maxTime))
        : (now >= minTime ? Math.min(now, maxTime) : minTime);

    // Calculate total weights
    const activityWeights = validActivities.map(a => {
        const w = weightMode === 'duration' ? getActivityWeightInHours(a) : 1;
        return { activity: a, weight: Math.max(0.1, w) };
    });
    const totalWeight = activityWeights.reduce((acc, curr) => acc + curr.weight, 0);

    // Auto-detect granularity if needed
    const totalSpanHours = (maxTime - minTime) / (1000 * 60 * 60);
    let chosenGranularity = granularity;
    if (chosenGranularity === 'auto') {
        if (totalSpanHours <= 36) {
            chosenGranularity = 'hour';
        } else if (totalSpanHours <= 24 * 7) {
            chosenGranularity = 'shift';
        } else {
            chosenGranularity = 'day';
        }
    }

    // Generate intervals
    const intervals: { start: number; end: number; label: string; sublabel: string }[] = [];
    const stepHourMs = 60 * 60 * 1000;
    const stepShiftMs = 8 * 60 * 60 * 1000;
    const stepDayMs = 24 * 60 * 60 * 1000;

    const startDate = new Date(minTime);
    
    if (chosenGranularity === 'hour') {
        startDate.setMinutes(0, 0, 0);
        let curr = startDate.getTime();
        // If range is between 18 and 48 hours, group by 2 hours for clean chart
        const stepHours = totalSpanHours > 24 ? 2 : 1;
        const stepMs = stepHours * stepHourMs;
        while (curr <= maxTime + stepMs) {
            const next = curr + stepMs;
            const d = new Date(curr);
            const dateStr = d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' });
            const timeStr = d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
            intervals.push({
                start: curr,
                end: next,
                label: `${dateStr} ${timeStr}`,
                sublabel: dateStr
            });
            curr = next;
        }
    } else if (chosenGranularity === 'shift') {
        // Shift alignment: 00h, 08h, 16h
        startDate.setMinutes(0, 0, 0);
        const hour = startDate.getHours();
        if (hour < 8) startDate.setHours(0);
        else if (hour < 16) startDate.setHours(8);
        else startDate.setHours(16);

        let curr = startDate.getTime();
        while (curr <= maxTime + stepShiftMs) {
            const next = curr + stepShiftMs;
            const d = new Date(curr);
            const dateStr = d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' });
            const h = d.getHours();
            const shiftName = h === 0 ? '00h-08h' : (h === 8 ? '08h-16h' : '16h-00h');
            intervals.push({
                start: curr,
                end: next,
                label: `${dateStr} (${shiftName})`,
                sublabel: shiftName
            });
            curr = next;
        }
    } else {
        // Day alignment
        startDate.setHours(0, 0, 0, 0);
        let curr = startDate.getTime();
        while (curr <= maxTime + stepDayMs) {
            const next = curr + stepDayMs;
            const d = new Date(curr);
            const label = d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', weekday: 'short' });
            intervals.push({
                start: curr,
                end: next,
                label: label,
                sublabel: d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: '2-digit' })
            });
            curr = next;
        }
    }

    if (intervals.length === 0) {
        intervals.push({
            start: minTime,
            end: maxTime,
            label: new Date(minTime).toLocaleDateString('pt-BR'),
            sublabel: ''
        });
    }

    // Function to calculate planned progress of an activity at a given timestamp
    const getPlannedProgressAt = (a: Activity, time: number): number => {
        const start = new Date(a.horaInicio).getTime();
        const end = new Date(a.horaFim).getTime();
        if (time <= start) return 0;
        if (time >= end) return 1;
        if (end === start) return 1;
        return (time - start) / (end - start);
    };

    // Function to calculate actual progress of an activity at a given timestamp
    const getRealProgressAt = (a: Activity, time: number): number => {
        const fullProg = getActivityProgress(a) / 100;
        if (fullProg <= 0) return 0;

        const start = a.horaInicioReal ? new Date(a.horaInicioReal).getTime() : new Date(a.horaInicio).getTime();
        let end = a.horaFimReal 
            ? new Date(a.horaFimReal).getTime() 
            : (a.status === ActivityStatus.Closed ? new Date(a.horaFim).getTime() : effectiveCutoffTime);

        if (end < start) end = start + 3600000;

        if (time <= start) return 0;
        if (time >= end) return fullProg;
        if (end === start) return fullProg;
        return fullProg * ((time - start) / (end - start));
    };

    // Build cumulative data points
    let prevPlanned = 0;
    let prevReal = 0;

    const points: SCurvePoint[] = intervals.map((interval, idx) => {
        const checkTime = interval.end;

        // Planned % at this interval end
        let weightedPlannedSum = 0;
        let countPlannedCompleted = 0;

        activityWeights.forEach(({ activity, weight }) => {
            const p = getPlannedProgressAt(activity, checkTime);
            weightedPlannedSum += p * weight;
            if (p >= 1) countPlannedCompleted++;
        });

        const rawPlannedPct = (weightedPlannedSum / totalWeight) * 100;
        const plannedPct = Math.min(100, Math.max(0, Math.round(rawPlannedPct * 10) / 10));

        // Real % at this interval end (only up to cutoff)
        const isPastOrCurrent = interval.start <= effectiveCutoffTime;
        let realPct: number | null = null;
        let countRealCompleted = 0;

        if (isPastOrCurrent) {
            let weightedRealSum = 0;
            const evalTime = Math.min(checkTime, effectiveCutoffTime);

            activityWeights.forEach(({ activity, weight }) => {
                const r = getRealProgressAt(activity, evalTime);
                weightedRealSum += r * weight;
                if (activity.status === ActivityStatus.Closed) {
                    const rEnd = activity.horaFimReal ? new Date(activity.horaFimReal).getTime() : new Date(activity.horaFim).getTime();
                    if (rEnd <= evalTime) countRealCompleted++;
                }
            });

            const rawRealPct = (weightedRealSum / totalWeight) * 100;
            realPct = Math.min(100, Math.max(0, Math.round(rawRealPct * 10) / 10));
        }

        const desvio = realPct !== null ? Math.round((realPct - plannedPct) * 10) / 10 : null;

        const planejadoPeriodo = Math.max(0, Math.round((plannedPct - prevPlanned) * 10) / 10);
        prevPlanned = plannedPct;

        let realPeriodo: number | null = null;
        if (realPct !== null) {
            realPeriodo = Math.max(0, Math.round((realPct - prevReal) * 10) / 10);
            prevReal = realPct;
        }

        // Force last point planned to 100% if all activities finish
        const finalPlanned = (idx === intervals.length - 1 && plannedPct > 95) ? 100 : plannedPct;

        return {
            timestamp: interval.end,
            label: interval.label,
            sublabel: interval.sublabel,
            planejadoAcumulado: finalPlanned,
            realAcumulado: realPct,
            desvio,
            planejadoPeriodo,
            realPeriodo,
            atividadesPlanejadas: countPlannedCompleted,
            atividadesRealizadas: countRealCompleted
        };
    });

    // Compute Summary KPIs
    let totalRealWeighted = 0;
    let totalPlannedWeightedAteAgora = 0;
    let completedCount = 0;
    let inProgressCount = 0;
    let notStartedCount = 0;
    let totalPlannedHours = 0;
    let totalRealHours = 0;

    activityWeights.forEach(({ activity, weight }) => {
        const prog = getActivityProgress(activity);
        totalRealWeighted += (prog / 100) * weight;

        const planNow = getPlannedProgressAt(activity, now);
        totalPlannedWeightedAteAgora += planNow * weight;

        const durationHrs = getActivityWeightInHours(activity);
        totalPlannedHours += durationHrs;
        totalRealHours += durationHrs * (prog / 100);

        if (activity.status === ActivityStatus.Closed) {
            completedCount++;
        } else if (prog > 0 || activity.status === ActivityStatus.EmProgresso || activity.status === ActivityStatus.ExecutadoParcialmente) {
            inProgressCount++;
        } else {
            notStartedCount++;
        }
    });

    const progressoRealTotal = Math.min(100, Math.max(0, Math.round((totalRealWeighted / totalWeight) * 1000) / 10));
    const progressoPlanejadoAteAgora = Math.min(100, Math.max(0, Math.round((totalPlannedWeightedAteAgora / totalWeight) * 1000) / 10));
    const desvioAtual = Math.round((progressoRealTotal - progressoPlanejadoAteAgora) * 10) / 10;

    let statusGeral: 'ADIANTADO' | 'NO PRAZO' | 'ATRASADO' = 'NO PRAZO';
    if (desvioAtual > 1.5) {
        statusGeral = 'ADIANTADO';
    } else if (desvioAtual < -1.5) {
        statusGeral = 'ATRASADO';
    }

    const summary: SCurveSummary = {
        totalAtividades: validActivities.length,
        atividadesConcluidas: completedCount,
        atividadesEmAndamento: inProgressCount,
        atividadesNaoIniciadas: notStartedCount,
        progressoRealTotal,
        progressoPlanejadoAteAgora,
        progressoPlanejadoTotal: 100,
        desvioAtual,
        horasPlanejadas: Math.round(totalPlannedHours * 10) / 10,
        horasReais: Math.round(totalRealHours * 10) / 10,
        statusGeral,
        dataInicio: new Date(minTime).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' }),
        dataFim: new Date(maxTime).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })
    };

    return { points, summary };
};
