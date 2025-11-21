
import React, { useState } from 'react';
import type { Activity, ActivityStatus } from '../types';
import { ActivityStatus as StatusEnum } from '../types';
import { KanbanCard } from './KanbanCard';
import { getStatusClasses, getStatusLabel } from '../utils/styleUtils';
import { PlusIcon } from './icons/PlusIcon';

interface ActivityBoardViewProps {
    activities: Activity[];
    onEdit: (activity: Activity) => void;
    onUpdateStatus: (activityId: string, status: ActivityStatus) => void;
    onImageClick: (imageUrl: string) => void;
    customStatusLabels?: Record<string, string>;
}

const statusOrder = [
    StatusEnum.Open,
    StatusEnum.NaoExecutado,
    StatusEnum.EmProgresso,
    StatusEnum.ExecutadoParcialmente,
    StatusEnum.Closed
];

export const ActivityBoardView: React.FC<ActivityBoardViewProps> = ({ activities, onEdit, onUpdateStatus, onImageClick, customStatusLabels = {} }) => {
    const [dragOverColumn, setDragOverColumn] = useState<StatusEnum | null>(null);
    
    const activitiesByStatus = (status: StatusEnum) => activities.filter(a => a.status === status);

    const handleDragOver = (e: React.DragEvent, status: StatusEnum) => {
        e.preventDefault();
        setDragOverColumn(status);
    };

    const handleDragLeave = () => {
        setDragOverColumn(null);
    };

    const handleDrop = (e: React.DragEvent, status: StatusEnum) => {
        e.preventDefault();
        setDragOverColumn(null);
        const activityId = e.dataTransfer.getData("text/plain");
        
        if (activityId) {
            onUpdateStatus(activityId, status);
        }
    };

    if (activities.length === 0) {
        return <div className="text-center p-8 bg-white/80 dark:bg-gray-800/80 backdrop-blur-md rounded-lg shadow">Nenhuma atividade encontrada.</div>;
    }

    return (
        <div className="flex space-x-4 overflow-x-auto pb-4 min-h-[calc(100vh-10rem)]">
            {statusOrder.map((status) => {
                const columnActivities = activitiesByStatus(status);
                return (
                    <div 
                        key={status} 
                        className={`flex-shrink-0 w-80 rounded-lg transition-all duration-200 flex flex-col ${dragOverColumn === status ? 'ring-2 ring-blue-400 bg-gray-50/50 dark:bg-gray-800/50' : 'bg-transparent'}`}
                        onDragOver={(e) => handleDragOver(e, status)}
                        onDragLeave={handleDragLeave}
                        onDrop={(e) => handleDrop(e, status)}
                    >
                        {/* Header Style matching the screenshot */}
                        <div className="mb-3 flex items-center">
                             <span className={getStatusClasses(status, false)}>
                                 {getStatusLabel(status, customStatusLabels)}
                             </span>
                             <span className="ml-2 text-gray-600 dark:text-gray-300 font-bold bg-white/50 dark:bg-gray-700/50 px-2 rounded-full text-xs">
                                 {columnActivities.length}
                             </span>
                        </div>

                        <div className="flex-1 p-2 space-y-3 overflow-y-auto rounded-lg scrollbar-thin scrollbar-thumb-gray-300 dark:scrollbar-thumb-gray-600">
                            {/* "Add Task" placeholder button - visual only as per screenshot vibe */}
                            <button className="w-full text-left text-gray-600 dark:text-gray-300 hover:bg-white/20 flex items-center text-sm px-2 py-1 mb-2 transition-colors rounded">
                                <PlusIcon className="w-4 h-4 mr-1" /> Adicionar Tarefa
                            </button>

                            {columnActivities.map(activity => (
                               <KanbanCard 
                                    key={activity.id} 
                                    activity={activity} 
                                    onEdit={onEdit} 
                                    onUpdateStatus={onUpdateStatus} 
                                    onImageClick={onImageClick} 
                                />
                            ))}
                        </div>
                    </div>
                );
            })}
        </div>
    );
};
