import React, { useState, useEffect } from 'react';
import type { Activity, Attachment } from '../types';
import { ActivityStatus, Criticidade, Recorrencia } from '../types';
import { XMarkIcon } from './icons/XMarkIcon';
import { getStatusLabel } from '../utils/styleUtils';

interface ActivityFormProps {
    activity?: Activity | null;
    onSubmit: (activity: Omit<Activity, 'id'> | Activity, recurrenceLimit?: Date) => void;
    onClose: () => void;
    customStatusLabels?: Record<string, string>;
}

const initialFormState: Omit<Activity, 'id' | 'horaInicioReal' | 'horaFimReal'> & { horaInicioReal?: string; horaFimReal?: string } = {
    tag: '',
    tipo: 'PLANO',
    periodicidade: Recorrencia.NaoHa, // Changed default to NaoHa to simplify logic
    area: '',
    descricao: '',
    jornada: '08h - 16h',
    turno: 'A',
    empresa: 'FOSPAR',
    efetivo: '',
    responsavel: '',
    supervisor: '',
    horaInicio: new Date().toISOString(),
    horaFim: new Date(new Date().getTime() + 60 * 60 * 1000).toISOString(),
    horaInicioReal: undefined,
    horaFimReal: undefined,
    duracao: '1:00',
    'r eletrico': false,
    labapet: false,
    criticidade: Criticidade.Normal,
    status: ActivityStatus.Open,
    attachments: [],
    beforeImage: undefined,
    afterImage: undefined,
};


export const ActivityForm: React.FC<ActivityFormProps> = ({ activity, onSubmit, onClose, customStatusLabels = {} }) => {
    const [formData, setFormData] = useState<Omit<Activity, 'id'> | Activity>(activity || initialFormState);
    const [recurrenceLimit, setRecurrenceLimit] = useState<string>('');

    useEffect(() => {
        setFormData(activity || initialFormState);
        setRecurrenceLimit('');
    }, [activity]);
    
    const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
        const target = e.target;
        const name = target.name;
        
        if (target instanceof HTMLInputElement && target.type === 'checkbox') {
            setFormData(prev => ({ ...prev, [name]: target.checked }));
        } else {
            setFormData(prev => ({ ...prev, [name]: target.value }));
        }
    };
    
    const handleDateTimeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const { name, value } = e.target;
        if (value) {
            const date = new Date(value);
            setFormData(prev => ({...prev, [name]: date.toISOString()}));
        } else {
             setFormData(prev => ({...prev, [name]: undefined}));
        }
    }

    const handleSingleFileChange = (e: React.ChangeEvent<HTMLInputElement>, field: 'beforeImage' | 'afterImage') => {
        if (e.target.files && e.target.files[0]) {
            const file = e.target.files[0];
            const reader = new FileReader();
            reader.onload = (event) => {
                const newAttachment: Attachment = {
                    id: `file_${Date.now()}_${file.name}`,
                    name: file.name,
                    type: 'image',
                    url: event.target?.result as string,
                };
                setFormData(prev => ({ ...prev, [field]: newAttachment }));
            };
            reader.readAsDataURL(file);
        }
        e.target.value = '';
    };

    const removeSingleImage = (field: 'beforeImage' | 'afterImage') => {
        setFormData(prev => ({ ...prev, [field]: undefined }));
    };


    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files) {
            const files = Array.from(e.target.files);
            files.forEach((file: File) => {
                const reader = new FileReader();
                reader.onload = (event) => {
                    const newAttachment: Attachment = {
                        id: `file_${Date.now()}_${file.name}`,
                        name: file.name,
                        type: file.type.startsWith('image') ? 'image' : (file.type.startsWith('video') ? 'video' : 'file'),
                        url: event.target?.result as string,
                    };
                    setFormData(prev => ({
                        ...prev,
                        attachments: [...(prev.attachments || []), newAttachment],
                    }));
                };
                reader.readAsDataURL(file);
            });
        }
    };
    
    const removeAttachment = (attachmentId: string) => {
        setFormData(prev => ({
            ...prev,
            attachments: (prev.attachments || []).filter(att => att.id !== attachmentId),
        }));
    };

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        const limitDate = recurrenceLimit ? new Date(recurrenceLimit) : undefined;
        onSubmit(formData, limitDate);
        onClose();
    };

    const toDateTimeLocal = (isoString?: string) => {
        if (!isoString) return '';
        const date = new Date(isoString);
        date.setMinutes(date.getMinutes() - date.getTimezoneOffset());
        return date.toISOString().slice(0, 16);
    }

    const inputClasses = "mt-1 block w-full p-2 rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700";

    const showRealTimeFields = formData.status === ActivityStatus.EmProgresso || formData.status === ActivityStatus.Closed || formData.status === ActivityStatus.ExecutadoParcialmente;
    const showRecurrenceLimit = formData.periodicidade !== Recorrencia.NaoHa;

    return (
        <form onSubmit={handleSubmit} className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="md:col-span-2">
                    <label className="block text-sm font-medium">Descrição</label>
                    <textarea name="descricao" value={formData.descricao} onChange={handleChange} required className={inputClasses} rows={2}/>
                </div>
                 <div className="md:col-span-2">
                    <label className="block text-sm font-medium">Observações</label>
                    <textarea name="observacoes" value={formData.observacoes || ''} onChange={handleChange} className={inputClasses} rows={2}/>
                </div>
                 <div>
                    <label className="block text-sm font-medium">Responsável</label>
                    <input type="text" name="responsavel" value={formData.responsavel} onChange={handleChange} required className={inputClasses} />
                </div>
                <div>
                    <label className="block text-sm font-medium">Supervisor</label>
                    <input type="text" name="supervisor" value={formData.supervisor || ''} onChange={handleChange} className={inputClasses} />
                </div>
                <div>
                    <label className="block text-sm font-medium">TAG</label>
                    <input type="text" name="tag" value={formData.tag} onChange={handleChange} required className={inputClasses} />
                </div>
                <div>
                    <label className="block text-sm font-medium">Status</label>
                     <select name="status" value={formData.status} onChange={handleChange} className={inputClasses}>
                        {Object.values(ActivityStatus).map(s => <option key={s} value={s}>{getStatusLabel(s, customStatusLabels)}</option>)}
                    </select>
                </div>
                <div>
                    <label className="block text-sm font-medium">Criticidade</label>
                     <select name="criticidade" value={formData.criticidade} onChange={handleChange} className={inputClasses}>
                        {Object.values(Criticidade).map(c => <option key={c} value={c}>{c}</option>)}
                    </select>
                </div>
                
                <div className={`${showRecurrenceLimit ? '' : 'md:col-span-1'}`}>
                    <label className="block text-sm font-medium">Recorrência</label>
                     <select name="periodicidade" value={formData.periodicidade} onChange={handleChange} className={inputClasses}>
                        {Object.values(Recorrencia).map(r => <option key={r} value={r}>{r}</option>)}
                    </select>
                </div>

                {showRecurrenceLimit && (
                    <div>
                        <label className="block text-sm font-medium text-blue-600 dark:text-blue-400">Repetir até (Gerar automático)</label>
                        <input 
                            type="date" 
                            value={recurrenceLimit} 
                            onChange={(e) => setRecurrenceLimit(e.target.value)} 
                            className={`${inputClasses} border-blue-300 dark:border-blue-600`} 
                            min={new Date().toISOString().split('T')[0]}
                        />
                    </div>
                )}

                 <div>
                    <label className="block text-sm font-medium">Início Planejado</label>
                     <input type="datetime-local" name="horaInicio" value={toDateTimeLocal(formData.horaInicio)} onChange={handleDateTimeChange} required className={inputClasses} />
                </div>
                 <div>
                    <label className="block text-sm font-medium">Fim Planejado</label>
                     <input type="datetime-local" name="horaFim" value={toDateTimeLocal(formData.horaFim)} onChange={handleDateTimeChange} required className={inputClasses} />
                </div>

                {showRealTimeFields && (
                    <>
                        <div>
                            <label className="block text-sm font-medium">Início Real</label>
                            <input type="datetime-local" name="horaInicioReal" value={toDateTimeLocal(formData.horaInicioReal)} onChange={handleDateTimeChange} className={inputClasses} />
                        </div>
                        <div>
                            <label className="block text-sm font-medium">Fim Real</label>
                            <input type="datetime-local" name="horaFimReal" value={toDateTimeLocal(formData.horaFimReal)} onChange={handleDateTimeChange} className={inputClasses} />
                        </div>
                    </>
                )}
            </div>

             <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                    <label className="block text-sm font-medium">Foto (Antes)</label>
                    <div className="mt-1">
                        {formData.beforeImage ? (
                            <div className="relative group">
                                <img src={formData.beforeImage.url} alt="Preview Antes" className="w-full h-32 object-cover rounded-md border dark:border-gray-600"/>
                                <button type="button" onClick={() => removeSingleImage('beforeImage')} className="absolute top-1 right-1 bg-red-600 text-white rounded-full p-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                    <XMarkIcon className="w-4 h-4" />
                                </button>
                            </div>
                        ) : (
                            <input type="file" accept="image/*" onChange={(e) => handleSingleFileChange(e, 'beforeImage')} className={`${inputClasses} p-1`} />
                        )}
                    </div>
                </div>
                <div>
                    <label className="block text-sm font-medium">Foto (Depois)</label>
                    <div className="mt-1">
                        {formData.afterImage ? (
                            <div className="relative group">
                                <img src={formData.afterImage.url} alt="Preview Depois" className="w-full h-32 object-cover rounded-md border dark:border-gray-600"/>
                                <button type="button" onClick={() => removeSingleImage('afterImage')} className="absolute top-1 right-1 bg-red-600 text-white rounded-full p-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                    <XMarkIcon className="w-4 h-4" />
                                </button>
                            </div>
                        ) : (
                            <input type="file" accept="image/*" onChange={(e) => handleSingleFileChange(e, 'afterImage')} className={`${inputClasses} p-1`} />
                        )}
                    </div>
                </div>
            </div>
            
             <div>
                <label className="block text-sm font-medium mb-2">Outros Anexos</label>
                <div className="space-y-2 max-h-32 overflow-y-auto">
                    {(formData.attachments || []).map(att => (
                        <div key={att.id} className="flex items-center justify-between bg-gray-100 dark:bg-gray-700 p-2 rounded-md">
                            <div className="flex items-center space-x-2 truncate">
                                {att.type === 'image' && <img src={att.url} alt={att.name} className="w-8 h-8 rounded object-cover" />}
                                <span className="text-sm truncate" title={att.name}>{att.name}</span>
                            </div>
                            <button type="button" onClick={() => removeAttachment(att.id)} className="text-red-500 hover:text-red-700 p-1 rounded-full flex-shrink-0">
                                <XMarkIcon className="w-4 h-4" />
                            </button>
                        </div>
                    ))}
                </div>
                 <div className="mt-2">
                    <label htmlFor="file-upload" className="cursor-pointer inline-flex items-center px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md text-sm font-medium bg-white dark:bg-gray-800 hover:bg-gray-50 dark:hover:bg-gray-700">
                        Anexar Arquivo
                    </label>
                    <input id="file-upload" name="file-upload" type="file" className="sr-only" multiple onChange={handleFileChange} accept="image/*,video/*,.pdf,.doc,.docx,.xls,.xlsx"/>
                </div>
            </div>

            <div className="flex justify-end space-x-3 pt-4">
                <button type="button" onClick={onClose} className="px-4 py-2 rounded-md bg-gray-200 hover:bg-gray-300 dark:bg-gray-600 dark:hover:bg-gray-500 text-gray-800 dark:text-gray-200">Cancelar</button>
                <button type="submit" className="px-4 py-2 rounded-md bg-blue-600 hover:bg-blue-700 text-white">Salvar</button>
            </div>
        </form>
    );
};