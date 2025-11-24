
import React from 'react';
import type { Activity } from '../types';
import { getStatusClasses, getStatusLabel } from '../utils/styleUtils';
import { Attachment } from '../types';

interface ReportViewProps {
    activities: Activity[];
    onImageClick: (imageUrl: string) => void;
    customStatusLabels?: Record<string, string>;
}

const formatTime = (isoString?: string) => {
    if (!isoString) return 'N/A';
    return new Date(isoString).toLocaleString('pt-BR', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
    });
};

export const ReportView: React.FC<ReportViewProps> = ({ activities, onImageClick, customStatusLabels = {} }) => {

    if (activities.length === 0) {
        return <div className="text-center p-8 bg-white dark:bg-gray-800 rounded-lg shadow">Nenhuma atividade para exibir no relatório.</div>;
    }

    // Helper to safely get image arrays (handles legacy object data or nulls)
    const getSafeImages = (data: any): Attachment[] => {
        if (Array.isArray(data)) return data;
        if (data && typeof data === 'object' && 'url' in data) return [data as Attachment];
        return [];
    };

    return (
        <div className="space-y-6">
            <style>
                {`
                    @media print {
                        body * {
                            visibility: hidden;
                        }
                        #report-section, #report-section * {
                            visibility: visible;
                        }
                        #report-section {
                            position: absolute;
                            left: 0;
                            top: 0;
                            width: 100%;
                        }
                         .report-card {
                            page-break-inside: avoid;
                         }
                    }
                `}
            </style>
            <div id="report-section">
                <h1 className="text-2xl font-bold mb-4 text-center dark:text-white">Relatório de Atividades</h1>
                {activities.map(activity => {
                    const beforeImages = getSafeImages(activity.beforeImage);
                    const afterImages = getSafeImages(activity.afterImage);

                    return (
                    <div key={activity.id} className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-6 mb-6 report-card">
                        <h2 className="text-xl font-bold mb-4 border-b pb-2 dark:border-gray-600">
                            {activity.idMp ? <span className="mr-2 text-gray-500 text-sm">[{activity.idMp}]</span> : null}
                            {activity.tag} - {activity.descricao}
                        </h2>
                        
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-4">
                             <div>
                                <h3 className="font-semibold mb-2 text-lg">Fotos</h3>
                                <div className="grid grid-cols-2 gap-4">
                                    {/* Before Photos */}
                                    <div>
                                        <p className="font-medium mb-1 text-sm text-gray-600 dark:text-gray-400">Antes</p>
                                        {beforeImages.length > 0 ? (
                                            <div className="grid grid-cols-1 gap-2">
                                                {beforeImages.map(img => (
                                                    <div 
                                                        key={img.id}
                                                        className="relative cursor-pointer group aspect-square" 
                                                        onClick={() => onImageClick(img.url)}
                                                        title="Clique para ampliar"
                                                    >
                                                        <img src={img.url} alt="Antes" className="w-full h-full object-cover rounded-md border dark:border-gray-600 transition-opacity group-hover:opacity-90" />
                                                        <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity bg-black bg-opacity-20 rounded-md">
                                                            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-6 h-6 text-white">
                                                                <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607zM10.5 7.5v6m3-3h-6" />
                                                            </svg>
                                                        </div>
                                                    </div>
                                                ))}
                                            </div>
                                        ) : (
                                            <div className="w-full h-24 flex items-center justify-center bg-gray-100 dark:bg-gray-700 rounded-md text-gray-500 text-xs italic">Sem imagem</div>
                                        )}
                                    </div>

                                    {/* After Photos */}
                                    <div>
                                        <p className="font-medium mb-1 text-sm text-gray-600 dark:text-gray-400">Depois</p>
                                        {afterImages.length > 0 ? (
                                            <div className="grid grid-cols-1 gap-2">
                                                {afterImages.map(img => (
                                                    <div 
                                                        key={img.id}
                                                        className="relative cursor-pointer group aspect-square" 
                                                        onClick={() => onImageClick(img.url)}
                                                        title="Clique para ampliar"
                                                    >
                                                        <img src={img.url} alt="Depois" className="w-full h-full object-cover rounded-md border dark:border-gray-600 transition-opacity group-hover:opacity-90" />
                                                        <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity bg-black bg-opacity-20 rounded-md">
                                                             <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-6 h-6 text-white">
                                                                <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607zM10.5 7.5v6m3-3h-6" />
                                                            </svg>
                                                        </div>
                                                    </div>
                                                ))}
                                            </div>
                                        ) : (
                                            <div className="w-full h-24 flex items-center justify-center bg-gray-100 dark:bg-gray-700 rounded-md text-gray-500 text-xs italic">Sem imagem</div>
                                        )}
                                    </div>
                                </div>
                            </div>
                            <div>
                                <h3 className="font-semibold mb-2 text-lg">Detalhes</h3>
                                <div className="space-y-2 text-sm">
                                    <p><strong>Responsável:</strong> {activity.responsavel}</p>
                                    {activity.supervisor && <p><strong>Supervisor:</strong> {activity.supervisor}</p>}
                                    <p><strong>Turno:</strong> {activity.turno}</p>
                                    <p><strong>Status:</strong> <span className={getStatusClasses(activity.status)}>{getStatusLabel(activity.status, customStatusLabels)}</span></p>
                                    {activity.observacoes && (
                                        <div className="mt-2 p-2 bg-gray-50 dark:bg-gray-700 rounded">
                                            <strong>Observações:</strong>
                                            <p className="whitespace-pre-wrap">{activity.observacoes}</p>
                                        </div>
                                    )}
                                </div>
                            </div>
                        </div>

                        <div>
                            <h3 className="font-semibold mb-2 text-lg">Horários</h3>
                            <div className="grid grid-cols-2 gap-x-6 gap-y-2 text-sm">
                                <p><strong>Início Planejado:</strong> {formatTime(activity.horaInicio)}</p>
                                <p><strong>Fim Planejado:</strong> {formatTime(activity.horaFim)}</p>
                                <p><strong>Início Real:</strong> {formatTime(activity.horaInicioReal)}</p>
                                <p><strong>Fim Real:</strong> {formatTime(activity.horaFimReal)}</p>
                            </div>
                        </div>

                    </div>
                )})}
            </div>
        </div>
    );
};
