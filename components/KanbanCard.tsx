
import React from 'react';
import type { Activity, ActivityStatus, Attachment } from '../types';
import { ClockIcon } from './icons/ClockIcon';
import { UserIcon } from './icons/UserIcon';
import { PencilIcon } from './icons/PencilIcon';
import { PaperClipIcon } from './icons/PaperClipIcon';
import { CameraIcon } from './icons/CameraIcon';
import { TrashIcon } from './icons/TrashIcon';
import { getCriticidadeClasses } from '../utils/styleUtils';

interface KanbanCardProps {
    activity: Activity;
    onEdit: (activity: Activity) => void;
    onUpdateStatus: (activityId: string, status: ActivityStatus) => void;
    onDelete?: (activityId: string) => void;
    onImageClick: (imageUrl: string) => void;
}

const ImagePreview: React.FC<{ images: Attachment[], label: string, onClick: (url: string) => void }> = ({ images, label, onClick }) => {
    const firstImage = images[0];
    const count = images.length;
    
    return (
        <div className="relative cursor-pointer" onClick={() => onClick(firstImage.url)}>
            <img
                src={firstImage.url}
                alt={firstImage.name}
                className="w-full h-40 object-cover"
                title={`Clique para ampliar: ${firstImage.name}`}
            />
            <p className="absolute bottom-1 left-1 bg-black bg-opacity-50 text-white text-xs font-semibold px-2 py-1 rounded">
                {label} {count > 1 && `(+${count - 1})`}
            </p>
        </div>
    );
}


export const KanbanCard: React.FC<KanbanCardProps> = ({ activity, onEdit, onDelete, onImageClick }) => {
    const hasBefore = activity.beforeImage && activity.beforeImage.length > 0;
    const hasAfter = activity.afterImage && activity.afterImage.length > 0;
    const hasImages = hasBefore || hasAfter;

    const handleDragStart = (e: React.DragEvent) => {
        e.dataTransfer.setData("text/plain", activity.id);
        e.dataTransfer.effectAllowed = "move";
    };
    
    return (
        <div 
            draggable
            onDragStart={handleDragStart}
            className="bg-white/70 dark:bg-gray-800/70 backdrop-blur-md rounded-lg shadow-md border-l-4 border-primary-500 overflow-hidden flex flex-col cursor-grab active:cursor-grabbing hover:shadow-lg transition-all"
        >
            
            {hasImages && (
                <div className={`grid ${hasBefore && hasAfter ? 'grid-cols-2' : 'grid-cols-1'}`}>
                    {hasBefore && <ImagePreview images={activity.beforeImage!} label="Antes" onClick={onImageClick} />}
                    {hasAfter && <ImagePreview images={activity.afterImage!} label="Depois" onClick={onImageClick} />}
                </div>
            )}
            
            <div className="p-4 space-y-3">
                <div className="flex justify-between items-start">
                    <p className="font-semibold text-gray-800 dark:text-white flex-1 pr-2 text-sm">{activity.descricao}</p>
                     <div className="flex space-x-1 flex-shrink-0">
                        <button onClick={() => onEdit(activity)} className="text-gray-500 hover:text-primary-600 dark:text-gray-400 dark:hover:text-primary-400">
                            <PencilIcon className="w-4 h-4" />
                        </button>
                        {onDelete && (
                            <button onClick={() => onDelete(activity.id)} className="text-gray-500 hover:text-red-500 dark:text-gray-400">
                                <TrashIcon className="w-4 h-4" />
                            </button>
                        )}
                     </div>
                </div>
                
                <div className="flex items-center justify-between">
                    <span className={`px-2 py-0.5 rounded-full text-[10px] font-semibold uppercase ${getCriticidadeClasses(activity.criticidade)}`}>
                        {activity.criticidade}
                    </span>
                     <span className="text-[10px] bg-gray-200/80 dark:bg-gray-600/80 px-2 py-0.5 rounded text-gray-600 dark:text-gray-300 font-mono">
                        {activity.tag}
                    </span>
                </div>

                <div className="text-xs text-gray-600 dark:text-gray-300 space-y-2 pt-1 border-t border-gray-200/50 dark:border-gray-600/50 mt-2">
                    <div className="flex items-center space-x-2 pt-2">
                        <UserIcon className="w-3 h-3" />
                        <span className="truncate">{activity.responsavel}</span>
                    </div>
                    {activity.supervisor && (
                         <div className="flex items-center space-x-2 text-gray-500 dark:text-gray-400">
                            <span className="w-3 h-3 flex items-center justify-center font-bold text-[8px]">S</span>
                            <span className="truncate">Sup: {activity.supervisor}</span>
                        </div>
                    )}
                    <div className="flex items-center space-x-2">
                        <ClockIcon className="w-3 h-3" />
                        <span>{new Date(activity.horaInicio).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} - {new Date(activity.horaFim).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                    </div>
                     <div className="flex items-center space-x-2">
                        {hasImages && <CameraIcon className="w-3 h-3 text-blue-500"/>}
                        <PaperClipIcon className="w-3 h-3" />
                        <span>{activity.attachments?.length || 0}</span>
                    </div>
                </div>
            </div>
        </div>
    );
};
