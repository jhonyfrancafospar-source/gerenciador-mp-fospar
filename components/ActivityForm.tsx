import React, { useState, useEffect, useMemo } from 'react';
import type { Activity, Attachment } from '../types';
import { ActivityStatus, Criticidade, Recorrencia } from '../types';
import { XMarkIcon } from './icons/XMarkIcon';
import { TrashIcon } from './icons/TrashIcon';
import { LinkIcon } from './icons/LinkIcon';
import { getStatusLabel, getStatusClasses } from '../utils/styleUtils';
import { 
    analyzeDependencies, 
    alignScheduleAfterPredecessors, 
    cleanDependencyIds, 
    getActivitySequenceMap,
    parseDurationToMs,
    formatMsToDuration,
    calculateShiftForDate
} from '../utils/dependencyUtils';
import {
    SHIFT_RELATIONS,
    CANONICAL_SHIFTS,
    ALL_CANONICAL_SUPERVISORS,
    normalizeTurno,
    normalizeSupervisor,
    getSupervisoresForTurno,
    getDefaultSupervisorForTurno,
    getTurnoForSupervisor,
    reconcileShiftAndSupervisor
} from '../utils/shiftUtils';

interface ActivityFormProps {
    activity?: Activity | null;
    allActivities?: Activity[];
    onSubmit: (activity: Omit<Activity, 'id'> | Activity, recurrenceLimit?: Date) => void;
    onClose: () => void;
    customStatusLabels?: Record<string, string>;
    onUpload?: (file: File) => Promise<string | null>;
    userRole?: string;
}

const toLocalDateTimeLocal = (dateInput: string | Date | undefined | null): string => {
    if (!dateInput) return '';
    try {
        const date = typeof dateInput === 'string' ? new Date(dateInput) : dateInput;
        if (isNaN(date.getTime())) return '';
        
        const year = date.getFullYear();
        const month = String(date.getMonth() + 1).padStart(2, '0');
        const day = String(date.getDate()).padStart(2, '0');
        const hours = String(date.getHours()).padStart(2, '0');
        const minutes = String(date.getMinutes()).padStart(2, '0');
        
        return `${year}-${month}-${day}T${hours}:${minutes}`;
    } catch (e) {
        console.error("Error formatting local date string:", e);
        return '';
    }
};

const initialFormState = (): Omit<Activity, 'id'> => {
    const now = new Date();
    const defaultShift = calculateShiftForDate(now) || 'A';
    const defaultSup = getDefaultSupervisorForTurno(defaultShift);

    return {
        idMp: '',
        tag: '',
        tipo: 'PLANO',
        periodicidade: Recorrencia.NaoHa,
        area: '',
        descricao: '',
        jornada: '',
        turno: defaultShift,
        empresa: 'FOSPAR',
        efetivo: '',
        responsavel: '',
        supervisor: defaultSup,
        horaInicio: toLocalDateTimeLocal(now),
        horaFim: toLocalDateTimeLocal(new Date(now.getTime() + 3600000)),
        horaInicioReal: '',
        horaFimReal: '',
        duracao: '01:00',
        progresso: 0,
        predecessoras: [],
        sucessoras: [],
        "r eletrico": false,
        labapet: false,
        criticidade: Criticidade.Normal,
        status: ActivityStatus.Open,
        attachments: [],
        beforeImage: [],
        afterImage: [],
        observacoes: ''
    };
};

export const ActivityForm: React.FC<ActivityFormProps> = ({ activity, allActivities = [], onSubmit, onClose, customStatusLabels = {}, onUpload, userRole }) => {
    const [formData, setFormData] = useState<Omit<Activity, 'id'>>(initialFormState());
    const [recurrenceLimit, setRecurrenceLimit] = useState<string>('');
    const [uploading, setUploading] = useState(false);
    
    // Dependency selectors state
    const [predecessorSearch, setPredecessorSearch] = useState('');
    const [isPredecessorDropdownOpen, setIsPredecessorDropdownOpen] = useState(false);
    const [successorSearch, setSuccessorSearch] = useState('');
    const [isSuccessorDropdownOpen, setIsSuccessorDropdownOpen] = useState(false);

    const isOperator = userRole === 'operator';
    const isNormalUser = userRole === 'user';
    const disableDates = isOperator || isNormalUser;

    useEffect(() => {
        if (activity) {
            const isClosed = activity.status === ActivityStatus.Closed;
            const currentProg = isClosed ? 100 : (activity.progresso !== undefined ? Number(activity.progresso) : 0);
            const { turno: reconciledTurno, supervisor: reconciledSupervisor } = reconcileShiftAndSupervisor(activity.turno, activity.supervisor);
            setFormData({
                ...activity,
                idMp: activity.idMp || '',
                empresa: activity.empresa || 'FOSPAR',
                progresso: currentProg,
                horaInicio: activity.horaInicio ? toLocalDateTimeLocal(activity.horaInicio) : '',
                horaFim: activity.horaFim ? toLocalDateTimeLocal(activity.horaFim) : '',
                horaInicioReal: activity.horaInicioReal ? toLocalDateTimeLocal(activity.horaInicioReal) : '',
                horaFimReal: activity.horaFimReal ? toLocalDateTimeLocal(activity.horaFimReal) : '',
                turno: reconciledTurno || activity.turno || '',
                supervisor: reconciledSupervisor || activity.supervisor || '',
                predecessoras: activity.predecessoras || [],
                sucessoras: activity.sucessoras || [],
                beforeImage: Array.isArray(activity.beforeImage) ? activity.beforeImage : (activity.beforeImage ? [activity.beforeImage] : []),
                afterImage: Array.isArray(activity.afterImage) ? activity.afterImage : (activity.afterImage ? [activity.afterImage] : []),
            });
        } else {
            setFormData(initialFormState());
        }
    }, [activity]);

    // Available candidate activities for dependency links (strictly filtered by same ID MP)
    const hasIdMp = Boolean(formData.idMp && formData.idMp.trim().length > 0);
    const normCurrentIdMp = (formData.idMp || '').trim().toLowerCase();

    // Sequence map across all activities
    const sequenceMap = useMemo(() => getActivitySequenceMap(allActivities), [allActivities]);

    const otherActivities = useMemo(() => {
        if (!hasIdMp) return [];
        return allActivities
            .filter(a => 
                (!activity || a.id !== activity.id) &&
                a.idMp && 
                a.idMp.trim().toLowerCase() === normCurrentIdMp
            )
            .sort((a, b) => new Date(a.horaInicio).getTime() - new Date(b.horaInicio).getTime());
    }, [allActivities, activity, hasIdMp, normCurrentIdMp]);

    // Filter candidate predecessors based on search (by sequence number #1, TAG, or description)
    const filteredCandidatePredecessors = useMemo(() => {
        if (!hasIdMp) return [];
        const currentSelected = new Set(formData.predecessoras || []);
        return otherActivities
            .filter(a => !currentSelected.has(a.id))
            .filter(a => {
                if (!predecessorSearch.trim()) return true;
                const s = predecessorSearch.toLowerCase().trim();
                const cleanNum = s.replace(/^#/, '');
                const seq = sequenceMap.get(a.id);

                if (cleanNum && seq !== undefined && seq.toString() === cleanNum) {
                    return true;
                }

                return (
                    (a.tag && a.tag.toLowerCase().includes(s)) ||
                    (a.descricao && a.descricao.toLowerCase().includes(s)) ||
                    (a.area && a.area.toLowerCase().includes(s))
                );
            })
            .slice(0, 15);
    }, [otherActivities, formData.predecessoras, predecessorSearch, hasIdMp, sequenceMap]);

    // Filter candidate successors based on search (by sequence number #1, TAG, or description)
    const filteredCandidateSuccessors = useMemo(() => {
        if (!hasIdMp) return [];
        const currentSelected = new Set(formData.sucessoras || []);
        return otherActivities
            .filter(a => !currentSelected.has(a.id))
            .filter(a => {
                if (!successorSearch.trim()) return true;
                const s = successorSearch.toLowerCase().trim();
                const cleanNum = s.replace(/^#/, '');
                const seq = sequenceMap.get(a.id);

                if (cleanNum && seq !== undefined && seq.toString() === cleanNum) {
                    return true;
                }

                return (
                    (a.tag && a.tag.toLowerCase().includes(s)) ||
                    (a.descricao && a.descricao.toLowerCase().includes(s)) ||
                    (a.area && a.area.toLowerCase().includes(s))
                );
            })
            .slice(0, 15);
    }, [otherActivities, formData.sucessoras, successorSearch, hasIdMp, sequenceMap]);

    // Predecessor full objects
    const selectedPredecessorObjects = useMemo(() => {
        const ids = new Set(formData.predecessoras || []);
        return otherActivities.filter(a => ids.has(a.id) || (a.idMp && ids.has(a.idMp)) || (a.tag && ids.has(a.tag)));
    }, [otherActivities, formData.predecessoras]);

    // Successor full objects
    const selectedSuccessorObjects = useMemo(() => {
        const ids = new Set(formData.sucessoras || []);
        return otherActivities.filter(a => ids.has(a.id) || (a.idMp && ids.has(a.idMp)) || (a.tag && ids.has(a.tag)));
    }, [otherActivities, formData.sucessoras]);

    // Check dependency timing conflicts
    const dependencyAnalysis = useMemo(() => {
        const mockAct: Activity = {
            id: activity?.id || 'temp',
            tag: formData.tag,
            tipo: formData.tipo,
            periodicidade: formData.periodicidade,
            area: formData.area,
            descricao: formData.descricao,
            jornada: formData.jornada,
            turno: formData.turno,
            empresa: formData.empresa,
            efetivo: formData.efetivo,
            responsavel: formData.responsavel,
            horaInicio: formData.horaInicio ? new Date(formData.horaInicio).toISOString() : new Date().toISOString(),
            horaFim: formData.horaFim ? new Date(formData.horaFim).toISOString() : new Date().toISOString(),
            duracao: formData.duracao,
            progresso: formData.progresso,
            "r eletrico": formData["r eletrico"],
            labapet: formData.labapet,
            criticidade: formData.criticidade,
            status: formData.status,
            predecessoras: formData.predecessoras,
            sucessoras: formData.sucessoras
        };
        return analyzeDependencies(mockAct, allActivities);
    }, [formData, activity, allActivities]);

    const handleAddPredecessor = (predId: string) => {
        const nextPreds = cleanDependencyIds([...(formData.predecessoras || []), predId]);
        
        // Find latest end time among predecessors in otherActivities
        let maxPredEndMs = 0;
        const normIdMp = (formData.idMp || '').trim().toLowerCase();
        
        otherActivities.forEach(a => {
            if (nextPreds.includes(a.id) || (a.idMp && nextPreds.includes(a.idMp)) || (a.tag && nextPreds.includes(a.tag))) {
                const pEnd = new Date(a.horaFim).getTime();
                if (pEnd > maxPredEndMs) maxPredEndMs = pEnd;
            }
        });

        // Compute duration to preserve
        const durationMs = parseDurationToMs(formData.duracao, formData.horaInicio, formData.horaFim);
        let updatedInicio = formData.horaInicio;
        let updatedFim = formData.horaFim;
        let updatedTurno = formData.turno;
        let updatedSupervisor = formData.supervisor;

        if (maxPredEndMs > 0) {
            const newStart = new Date(maxPredEndMs);
            const newEnd = new Date(maxPredEndMs + durationMs);
            updatedInicio = toLocalDateTimeLocal(newStart);
            updatedFim = toLocalDateTimeLocal(newEnd);
            
            if (formData.turno !== 'ADM') {
                const newShift = calculateShiftForDate(newStart);
                if (newShift) {
                    updatedTurno = newShift;
                    const oldSupervisors = getSupervisoresForTurno(formData.turno);
                    if (!formData.supervisor || oldSupervisors.includes(normalizeSupervisor(formData.supervisor))) {
                        updatedSupervisor = getDefaultSupervisorForTurno(newShift);
                    }
                }
            }
        }

        setFormData(prev => ({
            ...prev,
            predecessoras: nextPreds,
            horaInicio: updatedInicio,
            horaFim: updatedFim,
            duracao: formatMsToDuration(durationMs),
            turno: updatedTurno,
            supervisor: updatedSupervisor
        }));
        setPredecessorSearch('');
        setIsPredecessorDropdownOpen(false);
    };

    const handleRemovePredecessor = (predId: string) => {
        setFormData(prev => ({
            ...prev,
            predecessoras: (prev.predecessoras || []).filter(id => id !== predId)
        }));
    };

    const handleAddSuccessor = (succId: string) => {
        setFormData(prev => ({
            ...prev,
            sucessoras: cleanDependencyIds([...(prev.sucessoras || []), succId])
        }));
        setSuccessorSearch('');
        setIsSuccessorDropdownOpen(false);
    };

    const handleRemoveSuccessor = (succId: string) => {
        setFormData(prev => ({
            ...prev,
            sucessoras: (prev.sucessoras || []).filter(id => id !== succId)
        }));
    };

    const handleAutoAlignWithPredecessors = () => {
        if (!dependencyAnalysis.suggestedStartTime) return;
        
        const durationMs = parseDurationToMs(formData.duracao, formData.horaInicio, formData.horaFim);
        const newStart = dependencyAnalysis.suggestedStartTime;
        const newEnd = new Date(newStart.getTime() + durationMs);

        let updatedTurno = formData.turno;
        let updatedSupervisor = formData.supervisor;
        if (formData.turno !== 'ADM') {
            const newShift = calculateShiftForDate(newStart);
            if (newShift) {
                updatedTurno = newShift;
                const oldSupervisors = getSupervisoresForTurno(formData.turno);
                if (!formData.supervisor || oldSupervisors.includes(normalizeSupervisor(formData.supervisor))) {
                    updatedSupervisor = getDefaultSupervisorForTurno(newShift);
                }
            }
        }

        setFormData(prev => ({
            ...prev,
            horaInicio: toLocalDateTimeLocal(newStart),
            horaFim: toLocalDateTimeLocal(newEnd),
            duracao: formatMsToDuration(durationMs),
            turno: updatedTurno,
            supervisor: updatedSupervisor
        }));
    };

    const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
        const { name, value, type } = e.target;
        
        if (type === 'checkbox') {
            const checked = (e.target as HTMLInputElement).checked;
            setFormData(prev => ({ ...prev, [name]: checked }));
        } else if (name === 'turno') {
            const normTurno = normalizeTurno(value);
            const validSupervisors = getSupervisoresForTurno(normTurno);
            setFormData(prev => {
                let newSupervisor = prev.supervisor;
                if (validSupervisors.length > 0) {
                    const isCurrentValid = prev.supervisor && validSupervisors.includes(normalizeSupervisor(prev.supervisor));
                    if (!isCurrentValid) {
                        newSupervisor = getDefaultSupervisorForTurno(normTurno);
                    }
                }
                return {
                    ...prev,
                    turno: normTurno || value,
                    supervisor: newSupervisor
                };
            });
        } else if (name === 'supervisor') {
            const normSup = normalizeSupervisor(value);
            const mappedTurno = getTurnoForSupervisor(normSup);
            setFormData(prev => ({
                ...prev,
                supervisor: normSup || value,
                turno: mappedTurno || prev.turno
            }));
        } else if (name === 'status') {
            const newStatus = value as ActivityStatus;
            setFormData(prev => {
                if (newStatus === ActivityStatus.Closed) {
                    return {
                        ...prev,
                        status: newStatus,
                        progresso: 100,
                        horaFimReal: prev.horaFimReal || toLocalDateTimeLocal(new Date())
                    };
                } else if (newStatus === ActivityStatus.Open && prev.progresso === 100) {
                    return {
                        ...prev,
                        status: newStatus,
                        progresso: 0
                    };
                }
                return { ...prev, status: newStatus };
            });
        } else if (name === 'progresso') {
            const num = Math.min(100, Math.max(0, parseInt(value, 10) || 0));
            setFormData(prev => {
                let updatedStatus = prev.status;
                let updatedFimReal = prev.horaFimReal;
                let updatedInicioReal = prev.horaInicioReal;

                if (num === 100) {
                    updatedStatus = ActivityStatus.Closed;
                    if (!updatedFimReal) updatedFimReal = toLocalDateTimeLocal(new Date());
                } else if (num > 0 && prev.status === ActivityStatus.Open) {
                    updatedStatus = ActivityStatus.EmProgresso;
                    if (!updatedInicioReal) updatedInicioReal = toLocalDateTimeLocal(new Date());
                } else if (num === 0 && prev.status === ActivityStatus.Closed) {
                    updatedStatus = ActivityStatus.Open;
                }

                return {
                    ...prev,
                    progresso: num,
                    status: updatedStatus,
                    horaInicioReal: updatedInicioReal,
                    horaFimReal: updatedFimReal
                };
            });
        } else if (name === 'duracao') {
            const durationMs = parseDurationToMs(value);
            setFormData(prev => {
                if (prev.horaInicio) {
                    const startMs = new Date(prev.horaInicio).getTime();
                    if (!isNaN(startMs)) {
                        const newEnd = new Date(startMs + durationMs);
                        return {
                            ...prev,
                            duracao: value,
                            horaFim: toLocalDateTimeLocal(newEnd)
                        };
                    }
                }
                return { ...prev, duracao: value };
            });
        } else if (name === 'horaInicio') {
            setFormData(prev => {
                const durationMs = parseDurationToMs(prev.duracao, prev.horaInicio, prev.horaFim);
                const startMs = new Date(value).getTime();
                if (!isNaN(startMs)) {
                    const newEnd = new Date(startMs + durationMs);
                    let newTurno = prev.turno;
                    let newSupervisor = prev.supervisor;
                    if (prev.turno !== 'ADM') {
                        const derivedShift = calculateShiftForDate(new Date(startMs));
                        if (derivedShift) {
                            newTurno = derivedShift;
                            const oldSupervisors = getSupervisoresForTurno(prev.turno);
                            if (!prev.supervisor || oldSupervisors.includes(normalizeSupervisor(prev.supervisor))) {
                                newSupervisor = getDefaultSupervisorForTurno(derivedShift);
                            }
                        }
                    }
                    return {
                        ...prev,
                        horaInicio: value,
                        horaFim: toLocalDateTimeLocal(newEnd),
                        duracao: formatMsToDuration(durationMs),
                        turno: newTurno,
                        supervisor: newSupervisor
                    };
                }
                return { ...prev, horaInicio: value };
            });
        } else if (name === 'horaFim') {
            setFormData(prev => {
                if (prev.horaInicio && value) {
                    const startMs = new Date(prev.horaInicio).getTime();
                    const endMs = new Date(value).getTime();
                    if (!isNaN(startMs) && !isNaN(endMs) && endMs > startMs) {
                        const diffMs = endMs - startMs;
                        return {
                            ...prev,
                            horaFim: value,
                            duracao: formatMsToDuration(diffMs)
                        };
                    }
                }
                return { ...prev, horaFim: value };
            });
        } else {
            setFormData(prev => ({ ...prev, [name]: value }));
        }
    };

    // Helper to safely get image arrays
    const getSafeImages = (data: any): Attachment[] => {
        if (Array.isArray(data)) return data;
        if (data && typeof data === 'object' && 'url' in data) return [data as Attachment];
        return [];
    };

    const compressImage = (file: File): Promise<File> => {
        return new Promise((resolve) => {
            if (!file.type.startsWith('image/')) {
                resolve(file);
                return;
            }
            const img = new Image();
            img.src = URL.createObjectURL(file);
            img.onload = () => {
                URL.revokeObjectURL(img.src);
                const maxWidth = 800;
                const maxHeight = 800;
                let width = img.width;
                let height = img.height;

                if (width > maxWidth || height > maxHeight) {
                    if (width > height) {
                        height = Math.round((height * maxWidth) / width);
                        width = maxWidth;
                    } else {
                        width = Math.round((width * maxHeight) / height);
                        height = maxHeight;
                    }
                }

                const canvas = document.createElement('canvas');
                canvas.width = width;
                canvas.height = height;
                const ctx = canvas.getContext('2d');
                if (!ctx) {
                    resolve(file);
                    return;
                }
                ctx.drawImage(img, 0, 0, width, height);
                canvas.toBlob((blob) => {
                    if (blob) {
                        const compressedFile = new File([blob], file.name.replace(/\.[^/.]+$/, "") + ".jpg", {
                            type: 'image/jpeg',
                            lastModified: Date.now()
                        });
                        resolve(compressedFile);
                    } else {
                        resolve(file);
                    }
                }, 'image/jpeg', 0.7);
            };
            img.onerror = () => {
                resolve(file);
            };
        });
    };

    const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>, field: 'beforeImage' | 'afterImage' | 'attachments') => {
        if (e.target.files && e.target.files.length > 0) {
            setUploading(true);
            const files = Array.from(e.target.files) as File[];
            const newAttachments: Attachment[] = [];

            for (let file of files) {
                if (file.type.startsWith('image/')) {
                    try {
                        file = await compressImage(file);
                    } catch (err) {
                        console.error('Image compression failed:', err);
                    }
                }

                let url = '';
                
                if (onUpload) {
                    const uploadedUrl = await onUpload(file);
                    if (uploadedUrl) url = uploadedUrl;
                }

                // Fallback to Base64 if upload fails or not provided
                if (!url) {
                    url = await new Promise((resolve) => {
                        const reader = new FileReader();
                        reader.onloadend = () => resolve(reader.result as string);
                        reader.readAsDataURL(file);
                    });
                }

                newAttachments.push({
                    id: `att_${Date.now()}_${Math.random()}`,
                    name: file.name,
                    type: 'image',
                    url: url
                });
            }

            setFormData(prev => {
                const currentList = getSafeImages(prev[field]);
                return {
                    ...prev,
                    [field]: [...currentList, ...newAttachments]
                };
            });
            setUploading(false);
            e.target.value = ''; // Reset input
        }
    };

    const handleRemoveImage = (field: 'beforeImage' | 'afterImage' | 'attachments', id: string) => {
        setFormData(prev => {
            const currentList = getSafeImages(prev[field]);
            return {
                ...prev,
                [field]: currentList.filter(img => img.id !== id)
            };
        });
    };

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        const isClosed = formData.status === ActivityStatus.Closed;
        const finalProgress = isClosed ? 100 : (formData.progresso !== undefined ? Number(formData.progresso) : 0);
        const submissionData = {
            ...formData,
            progresso: finalProgress,
            horaInicio: new Date(formData.horaInicio).toISOString(),
            horaFim: new Date(formData.horaFim).toISOString(),
            horaInicioReal: formData.horaInicioReal ? new Date(formData.horaInicioReal).toISOString() : undefined,
            horaFimReal: formData.horaFimReal ? new Date(formData.horaFimReal).toISOString() : (isClosed ? new Date().toISOString() : undefined),
        };

        const limitDate = recurrenceLimit ? new Date(recurrenceLimit) : undefined;
        
        if (activity) {
            onSubmit({ ...submissionData, id: activity.id }, limitDate);
        } else {
            onSubmit(submissionData, limitDate);
        }
        onClose();
    };

    const inputClasses = "mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-primary-500 focus:ring-primary-500 dark:bg-gray-700 dark:border-gray-600 dark:text-white sm:text-sm p-2 border disabled:opacity-70 disabled:bg-gray-100 disabled:dark:bg-gray-800 disabled:cursor-not-allowed";

    return (
        <form onSubmit={handleSubmit} className="space-y-4 text-gray-900 dark:text-white">
            {/* Top Row: ID MP & TAG */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <div>
                    <label className="block text-sm font-medium">ID MP</label>
                    <input 
                        type="text" 
                        name="idMp" 
                        value={formData.idMp || ''} 
                        onChange={handleChange} 
                        className={inputClasses} 
                        placeholder="Ex: MP GR 01-08"
                        disabled={isOperator}
                    />
                </div>
                <div className="md:col-span-3">
                    <label className="block text-sm font-medium">TAG</label>
                    <input type="text" name="tag" value={formData.tag} onChange={handleChange} className={inputClasses} required disabled={isOperator} />
                </div>
            </div>

            {/* Description */}
            <div>
                <label className="block text-sm font-medium">Descrição</label>
                <textarea name="descricao" value={formData.descricao} onChange={handleChange} className={inputClasses} rows={2} required disabled={isOperator} />
            </div>

            {/* Equipe & Turno (Supervisor-Turno Relationship) */}
            <div className="bg-blue-50/40 dark:bg-blue-950/20 p-4 rounded-xl border border-blue-200/60 dark:border-blue-900/40 space-y-4">
                <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                        <span className="w-2 h-2 rounded-full bg-blue-600"></span>
                        <h4 className="text-xs font-bold text-gray-700 dark:text-gray-200 uppercase tracking-wider">
                            Turno & Supervisão
                        </h4>
                    </div>
                    <span className="text-[11px] text-gray-500 dark:text-gray-400">
                        Relação vinculada: Turno ⇄ Supervisor
                    </span>
                </div>

                {/* Shift Selector Pills */}
                <div>
                    <label className="block text-xs font-semibold text-gray-600 dark:text-gray-300 mb-1.5">
                        Selecione o Turno:
                    </label>
                    <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
                        {CANONICAL_SHIFTS.map(shiftKey => {
                            const info = SHIFT_RELATIONS[shiftKey];
                            const isSelected = normalizeTurno(formData.turno) === shiftKey;
                            return (
                                <button
                                    key={shiftKey}
                                    type="button"
                                    disabled={isOperator}
                                    onClick={() => {
                                        const validSupervisors = getSupervisoresForTurno(shiftKey);
                                        let newSupervisor = formData.supervisor;
                                        if (!newSupervisor || !validSupervisors.includes(normalizeSupervisor(newSupervisor))) {
                                            newSupervisor = getDefaultSupervisorForTurno(shiftKey);
                                        }
                                        setFormData(prev => ({
                                            ...prev,
                                            turno: shiftKey,
                                            supervisor: newSupervisor
                                        }));
                                    }}
                                    className={`flex flex-col items-start p-2.5 rounded-lg border text-left transition-all ${
                                        isSelected
                                            ? 'bg-blue-600 text-white border-blue-600 shadow-sm ring-2 ring-blue-400/30'
                                            : 'bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700 hover:border-blue-300 dark:hover:border-blue-700 text-gray-800 dark:text-gray-200'
                                    }`}
                                >
                                    <div className="flex items-center justify-between w-full">
                                        <span className="font-bold text-sm">{info.label}</span>
                                        {isSelected && (
                                            <span className="w-2 h-2 rounded-full bg-white"></span>
                                        )}
                                    </div>
                                    <span className={`text-[11px] mt-1 line-clamp-1 w-full ${
                                        isSelected ? 'text-blue-100 font-medium' : 'text-gray-500 dark:text-gray-400'
                                    }`} title={info.shortSummary}>
                                        {info.shortSummary}
                                    </span>
                                </button>
                            );
                        })}
                    </div>
                </div>

                {/* Supervisor & Executor Grid */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                            Supervisor Responsável
                        </label>
                        <select
                            name="supervisor"
                            value={formData.supervisor || ''}
                            onChange={handleChange}
                            className={inputClasses}
                            disabled={isOperator}
                        >
                            <option value="">Selecione o supervisor...</option>
                            {ALL_CANONICAL_SUPERVISORS.map(sup => {
                                const t = getTurnoForSupervisor(sup);
                                return (
                                    <option key={sup} value={sup}>
                                        {sup} {t ? `(Turno ${t})` : ''}
                                    </option>
                                );
                            })}
                            {formData.supervisor && !ALL_CANONICAL_SUPERVISORS.includes(formData.supervisor as any) && (
                                <option value={formData.supervisor}>{formData.supervisor} (Personalizado)</option>
                            )}
                        </select>

                        {/* Quick Buttons for Turno ADM Supervisors */}
                        {normalizeTurno(formData.turno) === 'ADM' && (
                            <div className="mt-2 p-2 bg-white/70 dark:bg-gray-800/70 rounded-lg border border-blue-100 dark:border-blue-900/30">
                                <span className="text-[11px] font-semibold text-gray-600 dark:text-gray-300 block mb-1.5">
                                    Supervisores Turno ADM (clique para alternar):
                                </span>
                                <div className="flex flex-wrap gap-1.5">
                                    {['Suelen Cordeiro', 'Jhony França', 'Luiz Jacon'].map(admSup => {
                                        const isSelected = formData.supervisor === admSup;
                                        return (
                                            <button
                                                key={admSup}
                                                type="button"
                                                disabled={isOperator}
                                                onClick={() => setFormData(prev => ({ ...prev, supervisor: admSup, turno: 'ADM' }))}
                                                className={`text-xs px-2.5 py-1 rounded-full border transition-all ${
                                                    isSelected
                                                        ? 'bg-blue-600 text-white border-blue-600 font-semibold shadow-xs'
                                                        : 'bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 border-gray-300 dark:border-gray-600 hover:bg-gray-100 dark:hover:bg-gray-700'
                                                }`}
                                            >
                                                {admSup}
                                            </button>
                                        );
                                    })}
                                </div>
                            </div>
                        )}
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                            Responsável (Executante)
                        </label>
                        <input 
                            type="text" 
                            name="responsavel" 
                            value={formData.responsavel} 
                            onChange={handleChange} 
                            className={inputClasses} 
                            placeholder="Nome do executante ou equipe..." 
                            disabled={isOperator} 
                        />
                    </div>
                </div>
            </div>

            {/* Empresa, Área & Criticidade */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                    <label className="block text-sm font-medium">Empresa</label>
                    <input 
                        type="text" 
                        name="empresa" 
                        value={formData.empresa || 'FOSPAR'} 
                        onChange={handleChange} 
                        className={inputClasses} 
                        placeholder="FOSPAR, Contratada..."
                        disabled={isOperator} 
                    />
                </div>
                <div>
                    <label className="block text-sm font-medium">Área</label>
                    <input type="text" name="area" value={formData.area} onChange={handleChange} className={inputClasses} disabled={isOperator} />
                </div>
                <div>
                    <label className="block text-sm font-medium">Criticidade</label>
                    <select name="criticidade" value={formData.criticidade} onChange={handleChange} className={inputClasses} disabled={isOperator}>
                        {Object.values(Criticidade).map(c => (
                            <option key={c} value={c}>{c.toUpperCase()}</option>
                        ))}
                    </select>
                </div>
            </div>

            {/* Scheduling */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 bg-gray-50 dark:bg-gray-700/30 p-3 rounded-lg border border-gray-200 dark:border-gray-700">
                <h4 className="md:col-span-3 text-xs font-bold text-gray-500 uppercase">Planejamento</h4>
                <div>
                    <label className="block text-sm font-medium">Início Planejado</label>
                    <input type="datetime-local" name="horaInicio" value={formData.horaInicio} onChange={handleChange} className={inputClasses} required disabled={disableDates} />
                </div>
                <div>
                    <label className="block text-sm font-medium">Fim Planejado</label>
                    <input type="datetime-local" name="horaFim" value={formData.horaFim} onChange={handleChange} className={inputClasses} required disabled={disableDates} />
                </div>
                <div>
                    <label className="block text-sm font-medium">Duração (Estimada)</label>
                    <input type="text" name="duracao" value={formData.duracao} onChange={handleChange} className={inputClasses} placeholder="00:00" disabled={disableDates} />
                </div>
            </div>

            {/* Real Execution Times */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 bg-blue-50 dark:bg-blue-900/20 p-3 rounded-lg border border-blue-100 dark:border-blue-800">
                <h4 className="md:col-span-2 text-xs font-bold text-blue-600 dark:text-blue-400 uppercase">Execução Real</h4>
                <div>
                    <label className="block text-sm font-medium">Início Real</label>
                    <input type="datetime-local" name="horaInicioReal" value={formData.horaInicioReal || ''} onChange={handleChange} className={inputClasses} disabled={disableDates} />
                </div>
                <div>
                    <label className="block text-sm font-medium">Fim Real</label>
                    <input type="datetime-local" name="horaFimReal" value={formData.horaFimReal || ''} onChange={handleChange} className={inputClasses} disabled={disableDates} />
                </div>
            </div>

            {/* Dependencies Section (Predecessoras & Sucessoras) */}
            <div className="bg-indigo-50/60 dark:bg-indigo-950/30 p-3.5 rounded-lg border border-indigo-200 dark:border-indigo-800/60 space-y-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="flex items-center space-x-2">
                        <LinkIcon className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
                        <h4 className="text-xs font-bold text-indigo-900 dark:text-indigo-200 uppercase tracking-wide">
                            Vínculos e Dependências (Mesmo ID da MP)
                        </h4>
                    </div>
                    <div className="flex items-center space-x-2 text-[11px]">
                        {hasIdMp ? (
                            <span className="bg-indigo-100 dark:bg-indigo-900/60 text-indigo-800 dark:text-indigo-300 font-mono font-semibold px-2 py-0.5 rounded">
                                ID MP: {formData.idMp} ({otherActivities.length} disp.)
                            </span>
                        ) : (
                            <span className="bg-amber-100 dark:bg-amber-900/60 text-amber-800 dark:text-amber-300 font-semibold px-2 py-0.5 rounded">
                                ⚠️ ID MP Obrigatório p/ Vínculos
                            </span>
                        )}
                        <span className="bg-indigo-100 dark:bg-indigo-900/60 text-indigo-800 dark:text-indigo-300 font-semibold px-2 py-0.5 rounded">
                            {selectedPredecessorObjects.length} Pred. / {selectedSuccessorObjects.length} Suc.
                        </span>
                    </div>
                </div>

                {!hasIdMp && (
                    <div className="bg-amber-50 dark:bg-amber-950/40 border border-amber-300 dark:border-amber-700/60 p-2.5 rounded-md text-xs text-amber-900 dark:text-amber-200 flex items-start space-x-2">
                        <span className="text-base">ℹ️</span>
                        <div>
                            <p className="font-semibold">Vínculos restritos ao mesmo ID da MP</p>
                            <p className="text-[11px] opacity-90 mt-0.5">
                                Para vincular predecessoras e sucessoras, preencha o campo <strong>ID da MP</strong> desta atividade. Os vínculos só podem ser criados entre atividades que compartilham o mesmo ID da MP.
                            </p>
                        </div>
                    </div>
                )}

                {/* Timing Conflicts Alert */}
                {hasIdMp && dependencyAnalysis.conflicts.length > 0 && (
                    <div className="bg-amber-50 dark:bg-amber-950/50 border border-amber-300 dark:border-amber-700/60 p-2.5 rounded-md space-y-1.5 text-xs text-amber-900 dark:text-amber-200">
                        <div className="flex items-center justify-between font-bold">
                            <span className="flex items-center gap-1.5">
                                ⚠️ Atenção aos Vínculos:
                            </span>
                            {dependencyAnalysis.suggestedStartTime && !disableDates && (
                                <button
                                    type="button"
                                    onClick={handleAutoAlignWithPredecessors}
                                    className="bg-amber-600 hover:bg-amber-700 text-white text-[11px] px-2.5 py-1 rounded shadow-xs font-medium flex items-center gap-1 transition-colors"
                                >
                                    ⚡ Ajustar Início para {dependencyAnalysis.suggestedStartTime.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                </button>
                            )}
                        </div>
                        <ul className="list-disc list-inside space-y-0.5 text-[11px] opacity-90 pl-1">
                            {dependencyAnalysis.conflicts.map((c, i) => (
                                <li key={i}>{c.message}</li>
                            ))}
                        </ul>
                    </div>
                )}

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {/* Predecessoras (Anteriores) */}
                    <div className="space-y-2">
                        <label className="block text-xs font-bold text-gray-700 dark:text-gray-300">
                            Predecessoras (Atividades que devem ocorrer antes)
                        </label>

                        {/* List of selected Predecessors */}
                        <div className="space-y-1.5 min-h-[36px]">
                            {selectedPredecessorObjects.length === 0 ? (
                                <p className="text-xs text-gray-400 italic py-1">Nenhuma predecessora vinculada.</p>
                            ) : (
                                selectedPredecessorObjects.map(pred => {
                                    const predSeq = sequenceMap.get(pred.id);
                                    const predStart = new Date(pred.horaInicio).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
                                    const predEnd = new Date(pred.horaFim).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
                                    const isConflict = new Date(pred.horaFim).getTime() > new Date(formData.horaInicio).getTime();

                                    return (
                                        <div 
                                            key={pred.id} 
                                            className={`flex items-center justify-between p-1.5 rounded text-xs border ${
                                                isConflict 
                                                    ? 'bg-amber-50 dark:bg-amber-950/40 border-amber-300 dark:border-amber-700 text-amber-900 dark:text-amber-200' 
                                                    : 'bg-white dark:bg-gray-800 border-indigo-200 dark:border-indigo-900/60 text-gray-800 dark:text-gray-200'
                                            }`}
                                        >
                                            <div className="truncate pr-2 flex flex-col">
                                                <div className="flex items-center gap-1.5 font-bold">
                                                    {predSeq !== undefined && (
                                                        <span className="font-mono bg-indigo-600 text-white dark:bg-indigo-500 font-bold px-1.5 py-0.2 rounded text-[10px]">
                                                            #{predSeq}
                                                        </span>
                                                    )}
                                                    <span className="font-mono bg-indigo-100 dark:bg-indigo-900/60 text-indigo-700 dark:text-indigo-300 px-1 rounded text-[10px]">
                                                        {pred.tag}
                                                    </span>
                                                    {pred.idMp && (
                                                        <span className="text-[10px] text-gray-500 dark:text-gray-400 font-mono">
                                                            ({pred.idMp})
                                                        </span>
                                                    )}
                                                    <span className="truncate">{pred.descricao}</span>
                                                </div>
                                                <span className="text-[10px] text-gray-500 dark:text-gray-400">
                                                    Término: {new Date(pred.horaFim).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })} às {predEnd}
                                                </span>
                                            </div>

                                            {!isOperator && (
                                                <button
                                                    type="button"
                                                    onClick={() => handleRemovePredecessor(pred.id)}
                                                    className="text-gray-400 hover:text-red-500 p-1 transition-colors"
                                                    title="Remover vínculo"
                                                >
                                                    <XMarkIcon className="w-3.5 h-3.5" />
                                                </button>
                                            )}
                                        </div>
                                    );
                                })
                            )}
                        </div>

                        {/* Add Predecessor Search / Dropdown */}
                        {!isOperator && hasIdMp && (
                            <div className="relative">
                                <div className="flex items-center gap-1">
                                    <input
                                        type="text"
                                        value={predecessorSearch}
                                        onChange={(e) => {
                                            setPredecessorSearch(e.target.value);
                                            setIsPredecessorDropdownOpen(true);
                                        }}
                                        onFocus={() => setIsPredecessorDropdownOpen(true)}
                                        placeholder={`+ Digite o nº (#1, #2), TAG ou Descrição nesta MP (${formData.idMp})...`}
                                        className="w-full text-xs p-2 rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
                                    />
                                    {isPredecessorDropdownOpen && (
                                        <button
                                            type="button"
                                            onClick={() => setIsPredecessorDropdownOpen(false)}
                                            className="text-xs px-2 py-1 text-gray-500 hover:text-gray-700"
                                        >
                                            ✕
                                        </button>
                                    )}
                                </div>

                                {isPredecessorDropdownOpen && (
                                    <div className="absolute left-0 right-0 top-full mt-1 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-md shadow-xl z-50 max-h-48 overflow-y-auto">
                                        {filteredCandidatePredecessors.length === 0 ? (
                                            <p className="p-2 text-xs text-gray-400 italic">Nenhuma outra atividade encontrada nesta MP ({formData.idMp}).</p>
                                        ) : (
                                            filteredCandidatePredecessors.map(candidate => {
                                                const cSeq = sequenceMap.get(candidate.id);
                                                return (
                                                    <div
                                                        key={candidate.id}
                                                        onClick={() => handleAddPredecessor(candidate.id)}
                                                        className="p-2 text-xs hover:bg-indigo-50 dark:hover:bg-indigo-950/50 cursor-pointer border-b border-gray-100 dark:border-gray-700/50 last:border-0 flex items-start gap-2"
                                                    >
                                                        {cSeq !== undefined && (
                                                            <span className="flex-shrink-0 min-w-[24px] text-center font-mono font-bold text-[11px] bg-indigo-100 dark:bg-indigo-900 text-indigo-700 dark:text-indigo-300 px-1 py-0.5 rounded border border-indigo-200 dark:border-indigo-800">
                                                                #{cSeq}
                                                            </span>
                                                        )}
                                                        <div className="flex-1 min-w-0">
                                                            <div className="flex items-center justify-between gap-1">
                                                                <span className="font-bold text-indigo-600 dark:text-indigo-400 truncate">
                                                                    {candidate.tag} ({candidate.idMp})
                                                                </span>
                                                                <span className="text-[10px] text-gray-500 flex-shrink-0">
                                                                    {new Date(candidate.horaInicio).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} - {new Date(candidate.horaFim).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                                                </span>
                                                            </div>
                                                            <p className="text-gray-700 dark:text-gray-300 truncate mt-0.5">
                                                                {candidate.descricao}
                                                            </p>
                                                        </div>
                                                    </div>
                                                );
                                            })
                                        )}
                                    </div>
                                )}
                            </div>
                        )}
                    </div>

                    {/* Sucessoras (Posteriores) */}
                    <div className="space-y-2">
                        <label className="block text-xs font-bold text-gray-700 dark:text-gray-300">
                            Sucessoras (Atividades que devem ocorrer após esta)
                        </label>

                        {/* List of selected Successors */}
                        <div className="space-y-1.5 min-h-[36px]">
                            {selectedSuccessorObjects.length === 0 ? (
                                <p className="text-xs text-gray-400 italic py-1">Nenhuma sucessora vinculada.</p>
                            ) : (
                                selectedSuccessorObjects.map(succ => {
                                    const succSeq = sequenceMap.get(succ.id);
                                    const succStart = new Date(succ.horaInicio).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
                                    const isConflict = new Date(formData.horaFim).getTime() > new Date(succ.horaInicio).getTime();

                                    return (
                                        <div 
                                            key={succ.id} 
                                            className={`flex items-center justify-between p-1.5 rounded text-xs border ${
                                                isConflict 
                                                    ? 'bg-amber-50 dark:bg-amber-950/40 border-amber-300 dark:border-amber-700 text-amber-900 dark:text-amber-200' 
                                                    : 'bg-white dark:bg-gray-800 border-indigo-200 dark:border-indigo-900/60 text-gray-800 dark:text-gray-200'
                                            }`}
                                        >
                                            <div className="truncate pr-2 flex flex-col">
                                                <div className="flex items-center gap-1.5 font-bold">
                                                    {succSeq !== undefined && (
                                                        <span className="font-mono bg-blue-600 text-white dark:bg-blue-500 font-bold px-1.5 py-0.2 rounded text-[10px]">
                                                            #{succSeq}
                                                        </span>
                                                    )}
                                                    <span className="font-mono bg-indigo-100 dark:bg-indigo-900/60 text-indigo-700 dark:text-indigo-300 px-1 rounded text-[10px]">
                                                        {succ.tag}
                                                    </span>
                                                    {succ.idMp && (
                                                        <span className="text-[10px] text-gray-500 dark:text-gray-400 font-mono">
                                                            ({succ.idMp})
                                                        </span>
                                                    )}
                                                    <span className="truncate">{succ.descricao}</span>
                                                </div>
                                                <span className="text-[10px] text-gray-500 dark:text-gray-400">
                                                    Início: {new Date(succ.horaInicio).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })} às {succStart}
                                                </span>
                                            </div>

                                            {!isOperator && (
                                                <button
                                                    type="button"
                                                    onClick={() => handleRemoveSuccessor(succ.id)}
                                                    className="text-gray-400 hover:text-red-500 p-1 transition-colors"
                                                    title="Remover vínculo"
                                                >
                                                    <XMarkIcon className="w-3.5 h-3.5" />
                                                </button>
                                            )}
                                        </div>
                                    );
                                })
                            )}
                        </div>

                        {/* Add Successor Search / Dropdown */}
                        {!isOperator && hasIdMp && (
                            <div className="relative">
                                <div className="flex items-center gap-1">
                                    <input
                                        type="text"
                                        value={successorSearch}
                                        onChange={(e) => {
                                            setSuccessorSearch(e.target.value);
                                            setIsSuccessorDropdownOpen(true);
                                        }}
                                        onFocus={() => setIsSuccessorDropdownOpen(true)}
                                        placeholder={`+ Digite o nº (#1, #2), TAG ou Descrição nesta MP (${formData.idMp})...`}
                                        className="w-full text-xs p-2 rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
                                    />
                                    {isSuccessorDropdownOpen && (
                                        <button
                                            type="button"
                                            onClick={() => setIsSuccessorDropdownOpen(false)}
                                            className="text-xs px-2 py-1 text-gray-500 hover:text-gray-700"
                                        >
                                            ✕
                                        </button>
                                    )}
                                </div>

                                {isSuccessorDropdownOpen && (
                                    <div className="absolute left-0 right-0 top-full mt-1 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-md shadow-xl z-50 max-h-48 overflow-y-auto">
                                        {filteredCandidateSuccessors.length === 0 ? (
                                            <p className="p-2 text-xs text-gray-400 italic">Nenhuma outra atividade encontrada nesta MP ({formData.idMp}).</p>
                                        ) : (
                                            filteredCandidateSuccessors.map(candidate => {
                                                const cSeq = sequenceMap.get(candidate.id);
                                                return (
                                                    <div
                                                        key={candidate.id}
                                                        onClick={() => handleAddSuccessor(candidate.id)}
                                                        className="p-2 text-xs hover:bg-indigo-50 dark:hover:bg-indigo-950/50 cursor-pointer border-b border-gray-100 dark:border-gray-700/50 last:border-0 flex items-start gap-2"
                                                    >
                                                        {cSeq !== undefined && (
                                                            <span className="flex-shrink-0 min-w-[24px] text-center font-mono font-bold text-[11px] bg-blue-100 dark:bg-blue-900 text-blue-700 dark:text-blue-300 px-1 py-0.5 rounded border border-blue-200 dark:border-blue-800">
                                                                #{cSeq}
                                                            </span>
                                                        )}
                                                        <div className="flex-1 min-w-0">
                                                            <div className="flex items-center justify-between gap-1">
                                                                <span className="font-bold text-indigo-600 dark:text-indigo-400 truncate">
                                                                    {candidate.tag} ({candidate.idMp})
                                                                </span>
                                                                <span className="text-[10px] text-gray-500 flex-shrink-0">
                                                                    {new Date(candidate.horaInicio).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} - {new Date(candidate.horaFim).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                                                </span>
                                                            </div>
                                                            <p className="text-gray-700 dark:text-gray-300 truncate mt-0.5">
                                                                {candidate.descricao}
                                                            </p>
                                                        </div>
                                                    </div>
                                                );
                                            })
                                        )}
                                    </div>
                                )}
                            </div>
                        )}
                    </div>
                </div>
            </div>

            {/* Progress and Status Box */}
            <div className="bg-emerald-50/60 dark:bg-emerald-950/20 p-3.5 rounded-lg border border-emerald-200 dark:border-emerald-800/60 space-y-3">
                <div className="flex items-center justify-between">
                    <h4 className="text-xs font-bold text-emerald-700 dark:text-emerald-300 uppercase">
                        Avanço Físico e Status
                    </h4>
                    <span className="text-xs font-bold text-emerald-800 dark:text-emerald-200 bg-emerald-100 dark:bg-emerald-900/60 px-2 py-0.5 rounded">
                        {formData.progresso !== undefined ? formData.progresso : 0}% Avançado
                    </span>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {/* % Progress Field */}
                    <div>
                        <label className="block text-sm font-medium text-gray-800 dark:text-gray-200 mb-1">
                            % Avanço da Atividade
                        </label>
                        <div className="flex items-center space-x-3">
                            <input
                                type="range"
                                min="0"
                                max="100"
                                step="5"
                                name="progresso"
                                value={formData.progresso !== undefined ? formData.progresso : 0}
                                onChange={handleChange}
                                className="w-full h-2 bg-gray-200 dark:bg-gray-700 rounded-lg appearance-none cursor-pointer accent-emerald-600"
                            />
                            <div className="flex items-center space-x-1 flex-shrink-0">
                                <input
                                    type="number"
                                    min="0"
                                    max="100"
                                    name="progresso"
                                    value={formData.progresso !== undefined ? formData.progresso : 0}
                                    onChange={handleChange}
                                    className="w-16 p-1.5 text-center text-sm font-bold border rounded-md border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700"
                                />
                                <span className="font-bold text-sm">%</span>
                            </div>
                        </div>
                        {/* Quick % buttons */}
                        <div className="flex items-center space-x-1.5 mt-2">
                            {[0, 25, 50, 75, 100].map((pct) => (
                                <button
                                    key={pct}
                                    type="button"
                                    onClick={() => {
                                        handleChange({
                                            target: { name: 'progresso', value: String(pct), type: 'number' }
                                        } as any);
                                    }}
                                    className={`px-2 py-0.5 text-xs font-semibold rounded transition-all ${
                                        formData.progresso === pct
                                            ? 'bg-emerald-600 text-white shadow-xs'
                                            : 'bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 border border-gray-200 dark:border-gray-700 hover:bg-gray-100'
                                    }`}
                                >
                                    {pct}%
                                </button>
                            ))}
                        </div>
                        <p className="text-[11px] text-gray-500 dark:text-gray-400 mt-1">
                            Definir 100% ou alterar o status para "Concluído" considera automaticamente 100% de avanço.
                        </p>
                    </div>

                    {/* Status Select */}
                    <div>
                        <label className="block text-sm font-medium text-gray-800 dark:text-gray-200 mb-1">
                            Status
                        </label>
                        <select name="status" value={formData.status} onChange={handleChange} className={inputClasses}>
                            {Object.values(ActivityStatus).map(s => (
                                <option key={s} value={s}>{getStatusLabel(s, customStatusLabels)}</option>
                            ))}
                        </select>
                        <div className="mt-2 text-[11px] text-gray-500 dark:text-gray-400">
                            {formData.status === ActivityStatus.Closed ? (
                                <span className="text-emerald-600 dark:text-emerald-400 font-semibold">
                                    ✓ Atividade marcada como concluída (100% de avanço registrado).
                                </span>
                            ) : (
                                <span>Status operacional atual da tarefa.</span>
                            )}
                        </div>
                    </div>
                </div>
            </div>

            {/* Recurrence */}
            <div>
                <label className="block text-sm font-medium">Recorrência</label>
                <select name="periodicidade" value={formData.periodicidade} onChange={handleChange} className={inputClasses} disabled={disableDates}>
                    {Object.values(Recorrencia).map(r => (
                        <option key={r} value={r}>{r}</option>
                    ))}
                </select>
            </div>

            {/* Recurrence End Date */}
            {formData.periodicidade !== Recorrencia.NaoHa && (
                <div className="bg-yellow-50 dark:bg-yellow-900/20 p-3 rounded border border-yellow-200 dark:border-yellow-700">
                    <label className="block text-sm font-medium text-yellow-800 dark:text-yellow-200">Repetir até:</label>
                    <input 
                        type="date" 
                        value={recurrenceLimit} 
                        onChange={(e) => setRecurrenceLimit(e.target.value)} 
                        className={inputClasses}
                        min={new Date().toISOString().split('T')[0]}
                        disabled={disableDates}
                    />
                    <p className="text-xs text-gray-500 mt-1">Serão criadas cópias desta atividade até a data selecionada.</p>
                </div>
            )}

            {/* Observations */}
            <div>
                <label className="block text-sm font-medium">Observações</label>
                <textarea name="observacoes" value={formData.observacoes || ''} onChange={handleChange} className={inputClasses} rows={3} placeholder="Detalhes adicionais..." />
            </div>

            {/* Photos - Before */}
            <div>
                <label className="block text-sm font-medium mb-2">Fotos (Antes)</label>
                <div className="grid grid-cols-4 gap-2 mb-2">
                    {getSafeImages(formData.beforeImage).map((img) => (
                        <div key={img.id} className="relative group aspect-square bg-gray-100 dark:bg-gray-800 rounded overflow-hidden">
                            <img src={img.url} alt="Antes" className="w-full h-full object-cover" />
                            {!isOperator && (
                                <button
                                    type="button"
                                    onClick={() => handleRemoveImage('beforeImage', img.id)}
                                    className="absolute top-1 right-1 bg-red-500 text-white rounded-full p-1 opacity-0 group-hover:opacity-100 transition-opacity"
                                >
                                    <TrashIcon className="w-3 h-3" />
                                </button>
                            )}
                        </div>
                    ))}
                    {!isOperator && (
                        <label className="flex flex-col items-center justify-center border-2 border-dashed border-gray-300 dark:border-gray-600 rounded cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-800 h-24">
                            <span className="text-xs text-gray-500">{uploading ? '...' : '+ Adicionar'}</span>
                            <input type="file" multiple accept="image/*" className="hidden" onChange={(e) => handleFileChange(e, 'beforeImage')} disabled={uploading} />
                        </label>
                    )}
                </div>
            </div>

            {/* Photos - After */}
            <div>
                <label className="block text-sm font-medium mb-2">Fotos (Depois)</label>
                <div className="grid grid-cols-4 gap-2 mb-2">
                    {getSafeImages(formData.afterImage).map((img) => (
                        <div key={img.id} className="relative group aspect-square bg-gray-100 dark:bg-gray-800 rounded overflow-hidden">
                            <img src={img.url} alt="Depois" className="w-full h-full object-cover" />
                            {!isOperator && (
                                <button
                                    type="button"
                                    onClick={() => handleRemoveImage('afterImage', img.id)}
                                    className="absolute top-1 right-1 bg-red-500 text-white rounded-full p-1 opacity-0 group-hover:opacity-100 transition-opacity"
                                >
                                    <TrashIcon className="w-3 h-3" />
                                </button>
                            )}
                        </div>
                    ))}
                    {!isOperator && (
                        <label className="flex flex-col items-center justify-center border-2 border-dashed border-gray-300 dark:border-gray-600 rounded cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-800 h-24">
                            <span className="text-xs text-gray-500">{uploading ? '...' : '+ Adicionar'}</span>
                            <input type="file" multiple accept="image/*" className="hidden" onChange={(e) => handleFileChange(e, 'afterImage')} disabled={uploading} />
                        </label>
                    )}
                </div>
            </div>

            <div className="flex justify-end space-x-3 pt-4 border-t border-gray-200 dark:border-gray-700">
                <button type="button" onClick={onClose} className="px-4 py-2 bg-gray-200 hover:bg-gray-300 dark:bg-gray-600 dark:hover:bg-gray-500 text-gray-800 dark:text-white rounded-md">
                    Cancelar
                </button>
                <button type="submit" className="px-4 py-2 bg-primary-600 hover:bg-primary-700 text-white rounded-md shadow-sm" disabled={uploading}>
                    {activity ? 'Salvar Alterações' : 'Criar Atividade'}
                </button>
            </div>
        </form>
    );
};