import React, { useState, useMemo } from 'react';
import { Modal } from './Modal';
import { Activity, User } from '../types';
import { exportActivitiesToExcel } from '../utils/exportUtils';
import { DocumentArrowUpIcon } from './icons/DocumentArrowUpIcon';

interface ExportModalProps {
    isOpen: boolean;
    onClose: () => void;
    filteredActivities: Activity[];
    allActivities: Activity[];
    customStatusLabels?: Record<string, string>;
    user?: User | null;
    currentIdMpFilter?: string;
    onExportSuccess?: (count: number, fileName: string) => void;
}

export const ExportModal: React.FC<ExportModalProps> = ({
    isOpen,
    onClose,
    filteredActivities,
    allActivities,
    customStatusLabels = {},
    user,
    currentIdMpFilter,
    onExportSuccess,
}) => {
    // Scope: 'filtered' | 'all' | 'specific_mp'
    const [scope, setScope] = useState<'filtered' | 'all' | 'specific_mp'>('filtered');
    const [selectedMpId, setSelectedMpId] = useState<string>(currentIdMpFilter || 'all');
    const [includeSummary, setIncludeSummary] = useState<boolean>(true);

    // List of distinct MP IDs
    const availableMpIds = useMemo(() => {
        const set = new Set<string>();
        allActivities.forEach(a => {
            if (a.idMp && a.idMp.trim()) {
                set.add(a.idMp.trim());
            }
        });
        return Array.from(set).sort();
    }, [allActivities]);

    // Initial file name builder
    const defaultFileName = useMemo(() => {
        const today = new Date();
        const dateStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
        let mpPart = 'Geral';
        if (scope === 'specific_mp' && selectedMpId !== 'all') {
            mpPart = selectedMpId.replace(/[^a-zA-Z0-9_-]/g, '_');
        } else if (currentIdMpFilter && currentIdMpFilter.trim()) {
            mpPart = currentIdMpFilter.replace(/[^a-zA-Z0-9_-]/g, '_');
        }
        return `Programacao_MP_${mpPart}_${dateStr}.xlsx`;
    }, [scope, selectedMpId, currentIdMpFilter]);

    const [customFileName, setCustomFileName] = useState<string>('');

    // Active file name to use
    const fileName = customFileName.trim() ? (customFileName.endsWith('.xlsx') ? customFileName : `${customFileName}.xlsx`) : defaultFileName;

    // Determine target activities based on chosen scope
    const activitiesToExport = useMemo(() => {
        if (scope === 'all') {
            return allActivities;
        }
        if (scope === 'specific_mp') {
            if (selectedMpId === 'all') return allActivities;
            return allActivities.filter(a => a.idMp === selectedMpId);
        }
        // default: filtered
        return filteredActivities;
    }, [scope, selectedMpId, filteredActivities, allActivities]);

    const handleExport = () => {
        if (activitiesToExport.length === 0) {
            alert('Nenhuma atividade disponível para exportação com os critérios selecionados.');
            return;
        }

        const success = exportActivitiesToExcel(activitiesToExport, {
            fileName,
            customStatusLabels,
            includeSummarySheet: includeSummary,
            programacaoId: scope === 'specific_mp' && selectedMpId !== 'all' ? selectedMpId : (currentIdMpFilter || undefined),
            userName: user?.name || user?.username || 'Administrador',
        });

        if (success) {
            if (onExportSuccess) {
                onExportSuccess(activitiesToExport.length, fileName);
            }
            onClose();
        }
    };

    if (!isOpen) return null;

    return (
        <Modal isOpen={isOpen} onClose={onClose} title="Exportar Programação para Excel">
            <div className="space-y-5 text-gray-800 dark:text-gray-100">
                {/* Header Banner */}
                <div className="flex items-center gap-3 p-3.5 bg-green-50 dark:bg-green-950/40 border border-green-200 dark:border-green-800/60 rounded-lg">
                    <div className="w-10 h-10 rounded-lg bg-green-600 text-white flex items-center justify-center shrink-0 shadow-xs">
                        <DocumentArrowUpIcon className="w-6 h-6" />
                    </div>
                    <div className="flex-1">
                        <div className="flex items-center gap-2">
                            <h3 className="text-sm font-bold text-green-900 dark:text-green-200">
                                Exportação Oficial de Programações (Excel .xlsx)
                            </h3>
                            <span className="text-[10px] uppercase font-extrabold px-1.5 py-0.5 rounded bg-green-200 dark:bg-green-800 text-green-800 dark:text-green-100">
                                Acesso ADMIN
                            </span>
                        </div>
                        <p className="text-xs text-green-700 dark:text-green-300/90 mt-0.5">
                            Gera um arquivo de planilha compatível com Microsoft Excel contendo todas as colunas de controle operacional, vínculos, datas e percentuais de avanço.
                        </p>
                    </div>
                </div>

                {/* Scope Selection */}
                <div>
                    <label className="block text-xs font-bold text-gray-700 dark:text-gray-300 uppercase tracking-wider mb-2">
                        Selecione o Escopo dos Dados a Exportar:
                    </label>
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                        <button
                            type="button"
                            onClick={() => setScope('filtered')}
                            className={`p-3 rounded-lg border text-left transition-all ${
                                scope === 'filtered'
                                    ? 'border-green-500 bg-green-50/60 dark:bg-green-950/30 ring-2 ring-green-500/20 shadow-xs'
                                    : 'border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 hover:bg-gray-50 dark:hover:bg-gray-700/50'
                            }`}
                        >
                            <div className="font-semibold text-xs text-gray-900 dark:text-gray-100 flex items-center justify-between">
                                <span>Filtros Atuais</span>
                                <span className="text-[11px] font-bold px-1.5 py-0.5 rounded bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300">
                                    {filteredActivities.length}
                                </span>
                            </div>
                            <p className="text-[11px] text-gray-500 dark:text-gray-400 mt-1">
                                Atividades que estão visíveis na tela com base nos filtros aplicados.
                            </p>
                        </button>

                        <button
                            type="button"
                            onClick={() => setScope('all')}
                            className={`p-3 rounded-lg border text-left transition-all ${
                                scope === 'all'
                                    ? 'border-green-500 bg-green-50/60 dark:bg-green-950/30 ring-2 ring-green-500/20 shadow-xs'
                                    : 'border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 hover:bg-gray-50 dark:hover:bg-gray-700/50'
                            }`}
                        >
                            <div className="font-semibold text-xs text-gray-900 dark:text-gray-100 flex items-center justify-between">
                                <span>Toda a Base</span>
                                <span className="text-[11px] font-bold px-1.5 py-0.5 rounded bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300">
                                    {allActivities.length}
                                </span>
                            </div>
                            <p className="text-[11px] text-gray-500 dark:text-gray-400 mt-1">
                                Todas as atividades cadastradas no sistema sem restrição de filtros.
                            </p>
                        </button>

                        <button
                            type="button"
                            onClick={() => setScope('specific_mp')}
                            className={`p-3 rounded-lg border text-left transition-all ${
                                scope === 'specific_mp'
                                    ? 'border-green-500 bg-green-50/60 dark:bg-green-950/30 ring-2 ring-green-500/20 shadow-xs'
                                    : 'border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 hover:bg-gray-50 dark:hover:bg-gray-700/50'
                            }`}
                        >
                            <div className="font-semibold text-xs text-gray-900 dark:text-gray-100 flex items-center justify-between">
                                <span>Por ID MP</span>
                                <span className="text-[11px] font-bold px-1.5 py-0.5 rounded bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300">
                                    {availableMpIds.length} MPs
                                </span>
                            </div>
                            <p className="text-[11px] text-gray-500 dark:text-gray-400 mt-1">
                                Filtrar e exportar apenas uma manutenção programada específica.
                            </p>
                        </button>
                    </div>
                </div>

                {/* Specific MP Dropdown (shown when specific_mp is selected) */}
                {scope === 'specific_mp' && (
                    <div className="p-3 bg-gray-50 dark:bg-gray-900/60 rounded-lg border border-gray-200 dark:border-gray-700">
                        <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1">
                            Selecione o ID da Manutenção Programada (MP):
                        </label>
                        <select
                            value={selectedMpId}
                            onChange={(e) => setSelectedMpId(e.target.value)}
                            className="w-full px-3 py-2 text-xs border rounded-md bg-white dark:bg-gray-800 border-gray-300 dark:border-gray-600 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-green-500"
                        >
                            <option value="all">Todas as Manutenções (Geral)</option>
                            {availableMpIds.map(idMp => {
                                const count = allActivities.filter(a => a.idMp === idMp).length;
                                return (
                                    <option key={idMp} value={idMp}>
                                        {idMp} ({count} atividades)
                                    </option>
                                );
                            })}
                        </select>
                    </div>
                )}

                {/* Details of export */}
                <div className="bg-gray-50 dark:bg-gray-900/40 p-3.5 rounded-lg border border-gray-200 dark:border-gray-700 space-y-2.5">
                    <div className="flex items-center justify-between text-xs">
                        <span className="text-gray-600 dark:text-gray-400">Total de Atividades Selecionadas:</span>
                        <span className="font-bold text-gray-900 dark:text-white px-2 py-0.5 bg-green-100 dark:bg-green-900/60 text-green-800 dark:text-green-200 rounded">
                            {activitiesToExport.length} atividade(s)
                        </span>
                    </div>

                    <div className="flex items-center justify-between text-xs">
                        <span className="text-gray-600 dark:text-gray-400">Colunas Exportadas na Planilha:</span>
                        <span className="font-semibold text-gray-700 dark:text-gray-300">
                            28 colunas completas
                        </span>
                    </div>

                    <div className="pt-2 border-t border-gray-200 dark:border-gray-700/60">
                        <label className="flex items-center gap-2 cursor-pointer">
                            <input
                                type="checkbox"
                                checked={includeSummary}
                                onChange={(e) => setIncludeSummary(e.target.checked)}
                                className="rounded text-green-600 focus:ring-green-500 w-4 h-4"
                            />
                            <span className="text-xs font-medium text-gray-700 dark:text-gray-300">
                                Incluir segunda aba com <strong>Resumo e Indicadores (KPIs)</strong> de status, turnos e empresas
                            </span>
                        </label>
                    </div>
                </div>

                {/* File Name input */}
                <div>
                    <label className="block text-xs font-bold text-gray-700 dark:text-gray-300 uppercase tracking-wider mb-1">
                        Nome do Arquivo de Destino:
                    </label>
                    <input
                        type="text"
                        value={customFileName || defaultFileName}
                        onChange={(e) => setCustomFileName(e.target.value)}
                        placeholder={defaultFileName}
                        className="w-full px-3 py-2 text-xs border rounded-md bg-white dark:bg-gray-800 border-gray-300 dark:border-gray-600 text-gray-900 dark:text-gray-100 font-mono focus:ring-2 focus:ring-green-500"
                    />
                </div>

                {/* Footer Buttons */}
                <div className="flex items-center justify-end gap-2 pt-3 border-t border-gray-200 dark:border-gray-700">
                    <button
                        type="button"
                        onClick={onClose}
                        className="px-4 py-2 text-xs font-semibold text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
                    >
                        Cancelar
                    </button>
                    <button
                        type="button"
                        onClick={handleExport}
                        disabled={activitiesToExport.length === 0}
                        className={`inline-flex items-center gap-2 px-5 py-2 text-xs font-bold rounded-lg shadow-sm text-white transition-all ${
                            activitiesToExport.length === 0
                                ? 'bg-gray-400 cursor-not-allowed opacity-60'
                                : 'bg-green-600 hover:bg-green-700 active:scale-98 cursor-pointer'
                        }`}
                    >
                        <DocumentArrowUpIcon className="w-4 h-4" />
                        <span>Baixar Arquivo Excel (.xlsx)</span>
                    </button>
                </div>
            </div>
        </Modal>
    );
};
