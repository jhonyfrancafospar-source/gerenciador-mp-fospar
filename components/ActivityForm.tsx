import React, { useState, useEffect } from 'react';
import type { Activity, Attachment } from '../types';
import { ActivityStatus, Criticidade, Recorrencia } from '../types';
import { XMarkIcon } from './icons/XMarkIcon';
import { TrashIcon } from './icons/TrashIcon';
import { getStatusLabel } from '../utils/styleUtils';

interface ActivityFormProps {
    activity?: Activity | null;
    onSubmit: (activity: Omit<Activity, 'id'> | Activity, recurrenceLimit?: Date) => void;
    onClose: () => void;
    customStatusLabels?: Record<string, string>;
    onUpload?: (file: File) => Promise<string | null>;
}

const initialFormState: Omit<Activity, 'id'> = {
    idMp: '',
    tag: '',
    tipo: 'PLANO',
    periodicidade: Recorrencia.NaoHa,
    area: '',
    descricao: '',
    jornada: '',
    turno: '',
    empresa: 'FOSPAR',
    efetivo: '',
    responsavel: '',
    supervisor: '',
    horaInicio: new Date().toISOString().slice(0, 16), // Local datetime-local format
    horaFim: new Date(Date.now() + 3600000).toISOString().slice(0, 16),
    horaInicioReal: '',
    horaFimReal: '',
    duracao: '01:00',
    "r eletrico": false,
    labapet: false,
    criticidade: Criticidade.Normal,
    status: ActivityStatus.Open,
    attachments: [],
    beforeImage: [],
    afterImage: [],
    observacoes: ''
};

export const ActivityForm: React.FC<ActivityFormProps> = ({ activity, onSubmit, onClose, customStatusLabels = {}, onUpload }) => {
    const [formData, setFormData] = useState<Omit<Activity, 'id'>>(initialFormState);
    const [recurrenceLimit, setRecurrenceLimit] = useState<string>('');
    const [uploading, setUploading] = useState(false);

    useEffect(() => {
        if (activity) {
            setFormData({
                ...activity,
                idMp: activity.idMp || '',
                horaInicio: activity.horaInicio ? new Date(activity.horaInicio).toISOString().slice(0, 16) : '',
                horaFim: activity.horaFim ? new Date(activity.horaFim).toISOString().slice(0, 16) : '',
                horaInicioReal: activity.horaInicioReal ? new Date(activity.horaInicioReal).toISOString().slice(0, 16) : '',
                horaFimReal: activity.horaFimReal ? new Date(activity.horaFimReal).toISOString().slice(0, 16) : '',
                turno: activity.turno || '',
                beforeImage: Array.isArray(activity.beforeImage) ? activity.beforeImage : (activity.beforeImage ? [activity.beforeImage] : []),
                afterImage: Array.isArray(activity.afterImage) ? activity.afterImage : (activity.afterImage ? [activity.afterImage] : []),
            });
        } else {
            setFormData(initialFormState);
        }
    }, [activity]);

    const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
        const { name, value, type } = e.target;
        
        if (type === 'checkbox') {
            const checked = (e.target as HTMLInputElement).checked;
            setFormData(prev => ({ ...prev, [name]: checked }));
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

    const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>, field: 'beforeImage' | 'afterImage' | 'attachments') => {
        if (e.target.files && e.target.files.length > 0) {
            setUploading(true);
            const files = Array.from(e.target.files) as File[];
            const newAttachments: Attachment[] = [];

            for (const file of files) {
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
        const submissionData = {
            ...formData,
            horaInicio: new Date(formData.horaInicio).toISOString(),
            horaFim: new Date(formData.horaFim).toISOString(),
            horaInicioReal: formData.horaInicioReal ? new Date(formData.horaInicioReal).toISOString() : undefined,
            horaFimReal: formData.horaFimReal ? new Date(formData.horaFimReal).toISOString() : undefined,
        };

        const limitDate = recurrenceLimit ? new Date(recurrenceLimit) : undefined;
        
        if (activity) {
            onSubmit({ ...submissionData, id: activity.id }, limitDate);
        } else {
            onSubmit(submissionData, limitDate);
        }
        onClose();
    };

    const inputClasses = "mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-primary-500 focus:ring-primary-500 dark:bg-gray-700 dark:border-gray-600 dark:text-white sm:text-sm p-2 border";

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
                    />
                </div>
                <div className="md:col-span-3">
                    <label className="block text-sm font-medium">TAG</label>
                    <input type="text" name="tag" value={formData.tag} onChange={handleChange} className={inputClasses} required />
                </div>
            </div>

            {/* Description */}
            <div>
                <label className="block text-sm font-medium">Descrição</label>
                <textarea name="descricao" value={formData.descricao} onChange={handleChange} className={inputClasses} rows={2} required />
            </div>

            {/* People & Location */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                    <label className="block text-sm font-medium">Responsável (Executante)</label>
                    <input type="text" name="responsavel" value={formData.responsavel} onChange={handleChange} className={inputClasses} />
                </div>
                <div>
                    <label className="block text-sm font-medium">Supervisor</label>
                    <input type="text" name="supervisor" value={formData.supervisor || ''} onChange={handleChange} className={inputClasses} />
                </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                    <label className="block text-sm font-medium">Área</label>
                    <input type="text" name="area" value={formData.area} onChange={handleChange} className={inputClasses} />
                </div>
                {/* Turno Editing Field */}
                <div>
                    <label className="block text-sm font-medium">Turno</label>
                    <input 
                        type="text" 
                        name="turno" 
                        value={formData.turno} 
                        onChange={handleChange} 
                        className={inputClasses} 
                        placeholder="A, B, C, D, ADM"
                    />
                </div>
                <div>
                    <label className="block text-sm font-medium">Criticidade</label>
                    <select name="criticidade" value={formData.criticidade} onChange={handleChange} className={inputClasses}>
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
                    <input type="datetime-local" name="horaInicio" value={formData.horaInicio} onChange={handleChange} className={inputClasses} required />
                </div>
                <div>
                    <label className="block text-sm font-medium">Fim Planejado</label>
                    <input type="datetime-local" name="horaFim" value={formData.horaFim} onChange={handleChange} className={inputClasses} required />
                </div>
                <div>
                    <label className="block text-sm font-medium">Duração (Estimada)</label>
                    <input type="text" name="duracao" value={formData.duracao} onChange={handleChange} className={inputClasses} placeholder="00:00" />
                </div>
            </div>

            {/* Real Execution Times */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 bg-blue-50 dark:bg-blue-900/20 p-3 rounded-lg border border-blue-100 dark:border-blue-800">
                <h4 className="md:col-span-2 text-xs font-bold text-blue-600 dark:text-blue-400 uppercase">Execução Real</h4>
                <div>
                    <label className="block text-sm font-medium">Início Real</label>
                    <input type="datetime-local" name="horaInicioReal" value={formData.horaInicioReal || ''} onChange={handleChange} className={inputClasses} />
                </div>
                <div>
                    <label className="block text-sm font-medium">Fim Real</label>
                    <input type="datetime-local" name="horaFimReal" value={formData.horaFimReal || ''} onChange={handleChange} className={inputClasses} />
                </div>
            </div>

            {/* Status & Recurrence */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                    <label className="block text-sm font-medium">Status</label>
                    <select name="status" value={formData.status} onChange={handleChange} className={inputClasses}>
                        {Object.values(ActivityStatus).map(s => (
                            <option key={s} value={s}>{getStatusLabel(s, customStatusLabels)}</option>
                        ))}
                    </select>
                </div>
                <div>
                    <label className="block text-sm font-medium">Recorrência</label>
                    <select name="periodicidade" value={formData.periodicidade} onChange={handleChange} className={inputClasses}>
                        {Object.values(Recorrencia).map(r => (
                            <option key={r} value={r}>{r}</option>
                        ))}
                    </select>
                </div>
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
                            <button
                                type="button"
                                onClick={() => handleRemoveImage('beforeImage', img.id)}
                                className="absolute top-1 right-1 bg-red-500 text-white rounded-full p-1 opacity-0 group-hover:opacity-100 transition-opacity"
                            >
                                <TrashIcon className="w-3 h-3" />
                            </button>
                        </div>
                    ))}
                    <label className="flex flex-col items-center justify-center border-2 border-dashed border-gray-300 dark:border-gray-600 rounded cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-800 h-24">
                        <span className="text-xs text-gray-500">{uploading ? '...' : '+ Adicionar'}</span>
                        <input type="file" multiple accept="image/*" className="hidden" onChange={(e) => handleFileChange(e, 'beforeImage')} disabled={uploading} />
                    </label>
                </div>
            </div>

            {/* Photos - After */}
            <div>
                <label className="block text-sm font-medium mb-2">Fotos (Depois)</label>
                <div className="grid grid-cols-4 gap-2 mb-2">
                    {getSafeImages(formData.afterImage).map((img) => (
                        <div key={img.id} className="relative group aspect-square bg-gray-100 dark:bg-gray-800 rounded overflow-hidden">
                            <img src={img.url} alt="Depois" className="w-full h-full object-cover" />
                            <button
                                type="button"
                                onClick={() => handleRemoveImage('afterImage', img.id)}
                                className="absolute top-1 right-1 bg-red-500 text-white rounded-full p-1 opacity-0 group-hover:opacity-100 transition-opacity"
                            >
                                <TrashIcon className="w-3 h-3" />
                            </button>
                        </div>
                    ))}
                    <label className="flex flex-col items-center justify-center border-2 border-dashed border-gray-300 dark:border-gray-600 rounded cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-800 h-24">
                        <span className="text-xs text-gray-500">{uploading ? '...' : '+ Adicionar'}</span>
                        <input type="file" multiple accept="image/*" className="hidden" onChange={(e) => handleFileChange(e, 'afterImage')} disabled={uploading} />
                    </label>
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