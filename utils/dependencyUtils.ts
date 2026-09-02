import { Activity, ActivityStatus } from '../types';

export interface DependencyConflict {
    predecessorId: string;
    predecessorTag: string;
    predecessorDesc: string;
    type: 'timing_overlap' | 'uncompleted';
    message: string;
    diffMinutes?: number;
}

export interface DependencyAnalysis {
    hasPredecessors: boolean;
    hasSuccessors: boolean;
    predecessors: Activity[];
    successors: Activity[];
    conflicts: DependencyConflict[];
    isBlocked: boolean;
    suggestedStartTime?: Date;
}

export const SHIFT_SCHEDULE_24_DAYS: Array<{ '00-08': string; '08-16': string; '16-00': string }> = [
    { '00-08': 'C', '08-16': 'A', '16-00': 'D' }, // Day 0
    { '00-08': 'C', '08-16': 'A', '16-00': 'D' }, // Day 1
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

/**
 * Calculates operational shift (A, B, C, D) for a given date.
 */
export const calculateShiftForDate = (date: Date): string => {
    const anchor = Date.UTC(2026, 8, 12); // 12/09/2026
    const target = Date.UTC(date.getFullYear(), date.getMonth(), date.getDate());
    const diffDays = Math.floor((target - anchor) / (1000 * 60 * 60 * 24));
    let dayIndex = (1 + (diffDays % 24)) % 24;
    if (dayIndex < 0) dayIndex += 24;

    const hour = date.getHours();
    const shiftKey = (hour >= 0 && hour < 8) ? '00-08' : (hour >= 8 && hour < 16) ? '08-16' : '16-00';
    return SHIFT_SCHEDULE_24_DAYS[dayIndex]?.[shiftKey] || 'A';
};

/**
 * Parses duration in milliseconds from duration string (e.g. "01:30", "2", "2.5") or date boundaries.
 */
export const parseDurationToMs = (duracao?: string, horaInicio?: string, horaFim?: string): number => {
    // 1. Try date boundaries first if both present and valid
    if (horaInicio && horaFim) {
        const start = new Date(horaInicio).getTime();
        const end = new Date(horaFim).getTime();
        if (!isNaN(start) && !isNaN(end) && end > start) {
            return end - start;
        }
    }

    // 2. Try parsing duration string "HH:MM"
    if (duracao && typeof duracao === 'string' && duracao.trim()) {
        const str = duracao.trim();
        if (str.includes(':')) {
            const parts = str.split(':');
            const h = parseInt(parts[0], 10) || 0;
            const m = parseInt(parts[1], 10) || 0;
            const s = parseInt(parts[2] || '0', 10) || 0;
            const totalMs = (h * 3600 + m * 60 + s) * 1000;
            if (totalMs > 0) return totalMs;
        } else {
            const num = parseFloat(str);
            if (!isNaN(num) && num > 0) {
                // If <= 24 assume hours, else if > 24 might be minutes
                if (num <= 24) {
                    return Math.round(num * 3600 * 1000);
                } else {
                    return Math.round(num * 60 * 1000);
                }
            }
        }
    }

    // Default fallback: 1 hour (3600000 ms)
    return 3600000;
};

/**
 * Formats milliseconds to "HH:MM" string format.
 */
export const formatMsToDuration = (ms: number): string => {
    const totalMinutes = Math.max(1, Math.round(ms / 60000));
    const hours = Math.floor(totalMinutes / 60);
    const minutes = totalMinutes % 60;
    return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}`;
};

/**
 * Normalizes an array of activity IDs ensuring unique and valid items.
 */
export const cleanDependencyIds = (ids?: (string | undefined | null)[]): string[] => {
    if (!ids || !Array.isArray(ids)) return [];
    return Array.from(new Set(ids.filter((id): id is string => typeof id === 'string' && id.trim().length > 0)));
};

/**
 * Returns the list of direct predecessor activities for a given activity.
 * Strict constraint: Dependencies can ONLY be linked between activities sharing the same ID MP.
 */
export const getPredecessors = (activity: Activity, allActivities: Activity[]): Activity[] => {
    if (!activity.idMp || !activity.idMp.trim()) return [];

    const normIdMp = activity.idMp.trim().toLowerCase();
    const predSet = new Set(activity.predecessoras || []);

    return allActivities.filter(a => {
        if (a.id === activity.id) return false;
        if (!a.idMp || a.idMp.trim().toLowerCase() !== normIdMp) return false;

        // Direct in activity.predecessoras
        if (predSet.has(a.id) || (a.idMp && predSet.has(a.idMp)) || (a.tag && predSet.has(a.tag))) {
            return true;
        }
        // Or other activity lists this activity in its sucessoras
        if (a.sucessoras && a.sucessoras.some(sId => sId === activity.id || sId === activity.idMp || sId === activity.tag)) {
            return true;
        }
        return false;
    });
};

/**
 * Returns the list of direct successor activities for a given activity.
 * Strict constraint: Dependencies can ONLY be linked between activities sharing the same ID MP.
 */
export const getSuccessors = (activity: Activity, allActivities: Activity[]): Activity[] => {
    if (!activity.idMp || !activity.idMp.trim()) return [];

    const normIdMp = activity.idMp.trim().toLowerCase();
    const directSuccessorIds = new Set(activity.sucessoras || []);

    return allActivities.filter(a => {
        if (a.id === activity.id) return false;
        if (!a.idMp || a.idMp.trim().toLowerCase() !== normIdMp) return false;

        // Check if explicitly in activity.sucessoras
        if (directSuccessorIds.has(a.id) || (a.idMp && directSuccessorIds.has(a.idMp)) || (a.tag && directSuccessorIds.has(a.tag))) {
            return true;
        }
        // Check if other activity points to this activity as predecessor
        if (a.predecessoras && a.predecessoras.some(pId => pId === activity.id || pId === activity.idMp || pId === activity.tag)) {
            return true;
        }
        return false;
    });
};

/**
 * Analyzes the dependencies of an activity: finds predecessors/successors, detects timing issues and uncompleted blockers.
 */
export const analyzeDependencies = (activity: Activity, allActivities: Activity[]): DependencyAnalysis => {
    const predecessors = getPredecessors(activity, allActivities);
    const successors = getSuccessors(activity, allActivities);
    const conflicts: DependencyConflict[] = [];

    const actStartMs = new Date(activity.horaInicio).getTime();
    let maxPredecessorEndMs = 0;
    let isBlocked = false;

    for (const pred of predecessors) {
        const predEndMs = new Date(pred.horaFim).getTime();
        if (predEndMs > maxPredecessorEndMs) {
            maxPredecessorEndMs = predEndMs;
        }

        // Timing conflict: Predecessor ends after this activity starts
        if (predEndMs > actStartMs) {
            const diffMinutes = Math.round((predEndMs - actStartMs) / 60000);
            conflicts.push({
                predecessorId: pred.id,
                predecessorTag: pred.tag,
                predecessorDesc: pred.descricao,
                type: 'timing_overlap',
                diffMinutes,
                message: `Predecessora "${pred.tag}" termina ${diffMinutes > 60 ? `${Math.floor(diffMinutes / 60)}h ${diffMinutes % 60}m` : `${diffMinutes}m`} APÓS o início previsto.`
            });
        }

        // Execution status warning: If predecessor is not closed and current activity is in progress or closed
        const predProgress = pred.status === ActivityStatus.Closed ? 100 : (pred.progresso || 0);
        if (predProgress < 100 && pred.status !== ActivityStatus.Closed) {
            if (activity.status === ActivityStatus.EmProgresso || activity.status === ActivityStatus.Closed) {
                conflicts.push({
                    predecessorId: pred.id,
                    predecessorTag: pred.tag,
                    predecessorDesc: pred.descricao,
                    type: 'uncompleted',
                    message: `Predecessora "${pred.tag}" ainda não foi concluída (${predProgress}% avanço).`
                });
            }
            isBlocked = true;
        }
    }

    const suggestedStartTime = maxPredecessorEndMs > 0 ? new Date(maxPredecessorEndMs) : undefined;

    return {
        hasPredecessors: predecessors.length > 0,
        hasSuccessors: successors.length > 0,
        predecessors,
        successors,
        conflicts,
        isBlocked,
        suggestedStartTime
    };
};

/**
 * Calculates new start and end times such that the activity starts immediately after its latest predecessor.
 */
export const alignScheduleAfterPredecessors = (activity: Activity, allActivities: Activity[]): { horaInicio: string; horaFim: string; duracao: string } | null => {
    const predecessors = getPredecessors(activity, allActivities);
    if (predecessors.length === 0) return null;

    let maxEndMs = 0;
    for (const pred of predecessors) {
        const pEnd = new Date(pred.horaFim).getTime();
        if (pEnd > maxEndMs) maxEndMs = pEnd;
    }

    if (maxEndMs === 0) return null;

    const durationMs = parseDurationToMs(activity.duracao, activity.horaInicio, activity.horaFim);
    const newStart = new Date(maxEndMs);
    const newEnd = new Date(maxEndMs + durationMs);

    return {
        horaInicio: newStart.toISOString(),
        horaFim: newEnd.toISOString(),
        duracao: formatMsToDuration(durationMs)
    };
};

/**
 * Cascading schedule recalculation engine:
 * For activities configured with predecessors and successors in the same ID MP,
 * automatically adjusts start/end dates and times sequentially respecting the duration of each activity.
 */
export const cascadeScheduleForActivities = (
    activities: Activity[],
    targetMpId?: string
): { updatedActivities: Activity[]; changedCount: number; changedIds: Set<string> } => {
    if (!activities || activities.length === 0) {
        return { updatedActivities: activities, changedCount: 0, changedIds: new Set() };
    }

    const changedIds = new Set<string>();
    const normTargetMp = targetMpId ? targetMpId.trim().toLowerCase() : null;

    // Create a working clone map by id
    const actMap = new Map<string, Activity>();
    activities.forEach(a => actMap.set(a.id, { ...a }));

    // Group activities by normalized ID MP
    const mpGroups = new Map<string, string[]>();
    activities.forEach(a => {
        if (!a.idMp || !a.idMp.trim()) return;
        const mpKey = a.idMp.trim().toLowerCase();
        if (normTargetMp && mpKey !== normTargetMp) return;

        if (!mpGroups.has(mpKey)) mpGroups.set(mpKey, []);
        mpGroups.get(mpKey)!.push(a.id);
    });

    mpGroups.forEach((groupActIds, mpKey) => {
        const groupActs = groupActIds.map(id => actMap.get(id)!);

        // Build index lookup for matching candidate tags/ids within this MP
        const tagMap = new Map<string, string>();
        groupActs.forEach(a => {
            if (a.tag) tagMap.set(a.tag.trim().toLowerCase(), a.id);
        });

        // Build directed dependency graph: u -> v (u precedes v, v follows u)
        const incoming = new Map<string, Set<string>>(); // predecessors of node
        const outgoing = new Map<string, Set<string>>(); // successors of node

        groupActIds.forEach(id => {
            incoming.set(id, new Set());
            outgoing.set(id, new Set());
        });

        // Populate edges
        groupActs.forEach(act => {
            const uId = act.id;

            // 1. From act.predecessoras: each pred is a predecessor of u
            if (act.predecessoras && Array.isArray(act.predecessoras)) {
                act.predecessoras.forEach(pRef => {
                    if (!pRef) return;
                    let pId = actMap.has(pRef) ? pRef : tagMap.get(pRef.trim().toLowerCase());
                    if (pId && pId !== uId && incoming.has(uId) && outgoing.has(pId)) {
                        incoming.get(uId)!.add(pId);
                        outgoing.get(pId)!.add(uId);
                    }
                });
            }

            // 2. From act.sucessoras: each succ is a successor of u
            if (act.sucessoras && Array.isArray(act.sucessoras)) {
                act.sucessoras.forEach(sRef => {
                    if (!sRef) return;
                    let sId = actMap.has(sRef) ? sRef : tagMap.get(sRef.trim().toLowerCase());
                    if (sId && sId !== uId && incoming.has(sId) && outgoing.has(uId)) {
                        incoming.get(sId)!.add(uId);
                        outgoing.get(uId)!.add(sId);
                    }
                });
            }
        });

        // Topological Sort using Kahn's algorithm
        const inDegree = new Map<string, number>();
        groupActIds.forEach(id => {
            inDegree.set(id, incoming.get(id)!.size);
        });

        // Start with nodes that have in-degree 0, sorted by original start date
        const queue = groupActIds
            .filter(id => inDegree.get(id) === 0)
            .sort((a, b) => new Date(actMap.get(a)!.horaInicio).getTime() - new Date(actMap.get(b)!.horaInicio).getTime());

        const topoOrder: string[] = [];

        while (queue.length > 0) {
            const uId = queue.shift()!;
            topoOrder.push(uId);

            const nextNodes = Array.from(outgoing.get(uId) || []);
            nextNodes.forEach(vId => {
                const currentDeg = (inDegree.get(vId) || 1) - 1;
                inDegree.set(vId, currentDeg);
                if (currentDeg === 0) {
                    queue.push(vId);
                }
            });
        }

        // Add any remaining cyclic nodes safely
        groupActIds.forEach(id => {
            if (!topoOrder.includes(id)) {
                topoOrder.push(id);
            }
        });

        // Forward cascade calculation in topological order
        topoOrder.forEach(id => {
            const act = actMap.get(id)!;
            const predIds = Array.from(incoming.get(id) || []);

            if (predIds.length > 0) {
                // Find latest end time among predecessors
                let maxPredEndMs = 0;
                predIds.forEach(pId => {
                    const predAct = actMap.get(pId);
                    if (predAct) {
                        const pEndMs = new Date(predAct.horaFim).getTime();
                        if (pEndMs > maxPredEndMs) {
                            maxPredEndMs = pEndMs;
                        }
                    }
                });

                if (maxPredEndMs > 0) {
                    const durationMs = parseDurationToMs(act.duracao, act.horaInicio, act.horaFim);
                    const currentStartMs = new Date(act.horaInicio).getTime();
                    const currentEndMs = new Date(act.horaFim).getTime();

                    const newStartMs = maxPredEndMs;
                    const newEndMs = newStartMs + durationMs;

                    if (Math.abs(newStartMs - currentStartMs) > 1000 || Math.abs(newEndMs - currentEndMs) > 1000) {
                        const newStartDate = new Date(newStartMs);
                        const newEndDate = new Date(newEndMs);

                        act.horaInicio = newStartDate.toISOString();
                        act.horaFim = newEndDate.toISOString();
                        act.duracao = formatMsToDuration(durationMs);

                        // If not administrative shift, update operational shift letter
                        if (act.turno !== 'ADM') {
                            const newShift = calculateShiftForDate(newStartDate);
                            if (newShift) act.turno = newShift;
                        }

                        actMap.set(id, act);
                        changedIds.add(id);
                    }
                }
            }
        });
    });

    const updatedActivities = activities.map(a => actMap.get(a.id) || a);

    return {
        updatedActivities,
        changedCount: changedIds.size,
        changedIds
    };
};

/**
 * Parses a raw dependency string (e.g. from Excel: "1, 2, 5" or "601GR01; 601GR02")
 * and resolves them against a pool of activities and row index map, restricted to the same ID MP.
 */
export const parseAndResolveDependencyString = (
    rawStr: any,
    rowToActivityMap: Map<number, Activity>,
    allActivities: Activity[],
    separator: string = ',',
    currentIdMp?: string
): string[] => {
    if (rawStr === undefined || rawStr === null) return [];
    
    const str = String(rawStr).trim();
    if (!str) return [];

    const normCurrentIdMp = (currentIdMp || '').trim().toLowerCase();
    if (!normCurrentIdMp) return []; // Must have an ID MP to have dependencies

    // Filter candidate activities pool strictly to those with the same ID MP
    const mpCandidates = allActivities.filter(a => a.idMp && a.idMp.trim().toLowerCase() === normCurrentIdMp);

    // Split by separator or fallback commas/semicolons/slashes/pipes
    const tokens = str
        .split(new RegExp(`[${separator === ',' ? ',;' : separator}\\/\\|\\n]+`))
        .map(t => t.trim())
        .filter(Boolean);

    const resolvedIds = new Set<string>();

    for (const token of tokens) {
        // 1. Try matching Excel row index (1-based integer)
        const rowNum = parseInt(token.replace(/^#/, ''), 10);
        if (!isNaN(rowNum) && rowToActivityMap.has(rowNum)) {
            const mappedAct = rowToActivityMap.get(rowNum);
            if (mappedAct && mappedAct.idMp && mappedAct.idMp.trim().toLowerCase() === normCurrentIdMp) {
                resolvedIds.add(mappedAct.id);
                continue;
            }
        }

        // 2. Try match by sequence number within MP candidates
        if (!isNaN(rowNum)) {
            const sortedMpCandidates = [...mpCandidates].sort((a, b) => new Date(a.horaInicio).getTime() - new Date(b.horaInicio).getTime());
            if (rowNum >= 1 && rowNum <= sortedMpCandidates.length) {
                resolvedIds.add(sortedMpCandidates[rowNum - 1].id);
                continue;
            }
        }

        // 3. Try direct match by id or tag within the same ID MP
        const lowerToken = token.toLowerCase();
        const matched = mpCandidates.find(a => 
            a.id.toLowerCase() === lowerToken ||
            (a.tag && a.tag.toLowerCase() === lowerToken) ||
            (a.descricao && a.descricao.toLowerCase() === lowerToken)
        );

        if (matched) {
            resolvedIds.add(matched.id);
        }
    }

    return Array.from(resolvedIds);
};

/**
 * Computes a map of activity ID -> sequential item number (1-based) within its ID MP group
 * (chronologically sorted by horaInicio).
 */
export const getActivitySequenceMap = (activities: Activity[]): Map<string, number> => {
    const seqMap = new Map<string, number>();
    
    // Group activities by normalized idMp
    const groups = new Map<string, Activity[]>();
    activities.forEach(act => {
        const key = act.idMp ? act.idMp.trim().toLowerCase() : '__general__';
        if (!groups.has(key)) groups.set(key, []);
        groups.get(key)!.push(act);
    });

    groups.forEach((groupActs) => {
        // Sort chronologically by start time
        const sorted = [...groupActs].sort((a, b) => new Date(a.horaInicio).getTime() - new Date(b.horaInicio).getTime());
        sorted.forEach((act, idx) => {
            seqMap.set(act.id, idx + 1);
        });
    });

    return seqMap;
};

