
import { ActivityStatus, Criticidade } from '../types';

export const getStatusClasses = (status: ActivityStatus, isSelect: boolean = false): string => {
    const baseClasses = isSelect ? "border font-bold" : "px-3 py-1 rounded text-xs font-bold uppercase tracking-wide";
    
    switch (status) {
        case ActivityStatus.Open:
            return `${baseClasses} bg-gray-700 text-gray-100 border-gray-600`;
        case ActivityStatus.NaoExecutado:
            return `${baseClasses} bg-red-600 text-white border-red-700`;
        case ActivityStatus.EmProgresso:
            return `${baseClasses} bg-blue-600 text-white border-blue-700`;
        case ActivityStatus.ExecutadoParcialmente:
            return `${baseClasses} bg-yellow-500 text-gray-900 border-yellow-600`;
        case ActivityStatus.Closed:
            return `${baseClasses} bg-green-600 text-white border-green-700`;
        default:
            return `${baseClasses} bg-gray-500 text-white border-gray-600`;
    }
};

export const getCriticidadeClasses = (criticidade: Criticidade): string => {
    switch (criticidade) {
        case Criticidade.Baixa:
            return `bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300`;
        case Criticidade.Normal:
            return `bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-300`;
        case Criticidade.Alta:
            return `bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-300`;
        case Criticidade.Urgente:
            return `bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-300`;
        default:
            return `bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-300`;
    }
};

export const getStatusLabel = (status: ActivityStatus, customLabels: Record<string, string>): string => {
    return customLabels[status] || status;
};
