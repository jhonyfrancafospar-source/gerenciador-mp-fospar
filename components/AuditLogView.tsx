
import React from 'react';
import type { AuditLogEntry } from '../types';

interface AuditLogViewProps {
    logs: AuditLogEntry[];
}

export const AuditLogView: React.FC<AuditLogViewProps> = ({ logs }) => {
    if (logs.length === 0) {
        return <div className="text-center p-8 bg-white dark:bg-gray-800 rounded-lg shadow">Nenhum registro de atividade encontrado.</div>;
    }

    // Sort logs by timestamp descending
    const sortedLogs = [...logs].sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());

    return (
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow overflow-hidden">
            <div className="p-4 border-b border-gray-200 dark:border-gray-700">
                <h2 className="text-lg font-semibold text-gray-800 dark:text-white">Histórico de Alterações</h2>
            </div>
            <div className="overflow-x-auto">
                <table className="w-full text-sm text-left text-gray-500 dark:text-gray-400">
                    <thead className="text-xs text-gray-700 uppercase bg-gray-50 dark:bg-gray-700 dark:text-gray-300">
                        <tr>
                            <th scope="col" className="px-6 py-3">Data/Hora</th>
                            <th scope="col" className="px-6 py-3">Usuário</th>
                            <th scope="col" className="px-6 py-3">Ação</th>
                            <th scope="col" className="px-6 py-3">Detalhes</th>
                        </tr>
                    </thead>
                    <tbody>
                        {sortedLogs.map(log => (
                            <tr key={log.id} className="bg-white dark:bg-gray-800 border-b dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-600">
                                <td className="px-6 py-4 whitespace-nowrap">
                                    {new Date(log.timestamp).toLocaleString('pt-BR')}
                                </td>
                                <td className="px-6 py-4 font-medium text-gray-900 dark:text-white">
                                    {log.user}
                                </td>
                                <td className="px-6 py-4">
                                    <span className={`px-2 py-1 rounded-full text-xs font-semibold ${
                                        log.action === 'CRIAR' ? 'bg-green-100 text-green-800' :
                                        log.action === 'EDITAR' ? 'bg-blue-100 text-blue-800' :
                                        log.action === 'STATUS' ? 'bg-yellow-100 text-yellow-800' :
                                        'bg-gray-100 text-gray-800'
                                    }`}>
                                        {log.action}
                                    </span>
                                </td>
                                <td className="px-6 py-4">
                                    {log.details}
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        </div>
    );
};
