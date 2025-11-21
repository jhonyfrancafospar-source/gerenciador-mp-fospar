
import React, { useState, useEffect } from 'react';
import { Modal } from './Modal';
import { ImportMapping } from '../types';

interface ImportMappingModalProps {
    isOpen: boolean;
    onClose: () => void;
    excelHeaders: string[];
    onConfirm: (mapping: ImportMapping) => void;
    initialMapping?: ImportMapping;
}

export const ImportMappingModal: React.FC<ImportMappingModalProps> = ({ isOpen, onClose, excelHeaders, onConfirm, initialMapping }) => {
    const defaultMapping: ImportMapping = {
        idMp: '',
        tag: '',
        descricao: '',
        responsavel: '',
        responsavelSeparator: '/',
        supervisor: '',
        area: '',
        turno: '',
        horaInicio: '',
        horaFim: '',
        duracao: '',
        criticidade: '',
    };

    const [mapping, setMapping] = useState<ImportMapping>(defaultMapping);

    const appFields: { key: keyof ImportMapping; label: string; help: string }[] = [
        { key: 'idMp', label: 'ID MP', help: 'Identificador da Manutenção (ex: MP GR 01-08)' },
        { key: 'tag', label: 'TAG', help: 'Tag do equipamento (ex: 601GR01)' },
        { key: 'descricao', label: 'Descrição', help: 'O que deve ser feito' },
        { key: 'responsavel', label: 'Responsável (Executante)', help: 'Quem vai executar (na planilha antiga: Efetivo)' },
        { key: 'supervisor', label: 'Supervisor', help: 'Responsável pela área/turno (na planilha antiga: Responsável)' },
        { key: 'area', label: 'Área', help: 'Localização (ex: Linha 01)' },
        { key: 'turno', label: 'Turno', help: 'A, B, C, D ou ADM' },
        { key: 'horaInicio', label: 'Hora Início', help: 'Horário planejado de início' },
        { key: 'horaFim', label: 'Hora Fim', help: 'Horário planejado de fim' },
        { key: 'duracao', label: 'Duração', help: 'Tempo estimado (opcional, substitui o cálculo automático)' },
        { key: 'criticidade', label: 'Criticidade', help: 'Normal, Alta, Urgente' },
    ];

    const separatorOptions = [
        { label: 'Barra (/)', value: '/' },
        { label: 'Vírgula (,)', value: ',' },
        { label: 'Ponto e Vírgula (;)', value: ';' },
        { label: 'E Comercial (&)', value: '&' },
        { label: 'Hífen (-)', value: '-' },
    ];

    const autoMap = () => {
        const newMapping = { ...defaultMapping };
        
        const findBestMatch = (keywords: string[]) => {
            return excelHeaders.find(h => {
                const lowerH = h.toLowerCase().trim();
                return keywords.some(k => lowerH.includes(k));
            }) || '';
        };

        newMapping.idMp = findBestMatch(['id mp', 'id da mp']);
        newMapping.tag = findBestMatch(['tag', 'equipamento']);
        newMapping.descricao = findBestMatch(['descrição', 'descricao', 'atividade']);
        newMapping.responsavel = findBestMatch(['efetivo', 'executante']); 
        newMapping.supervisor = findBestMatch(['responsável', 'responsavel', 'supervisor']);
        newMapping.area = findBestMatch(['área', 'area', 'setor']);
        newMapping.turno = findBestMatch(['turno']);
        newMapping.horaInicio = findBestMatch(['início', 'inicio', 'hora inicio']);
        newMapping.horaFim = findBestMatch(['fim', 'término', 'termino', 'hora fim']);
        newMapping.duracao = findBestMatch(['duração', 'duracao', 'tempo', 'estimado']);
        newMapping.criticidade = findBestMatch(['criticidade', 'prioridade']);

        setMapping(newMapping);
    };

    useEffect(() => {
        if (isOpen) {
            if (initialMapping) {
                setMapping(initialMapping);
            } else {
                autoMap();
            }
        } else {
            // Reset when closed to avoid stale state
            setMapping(defaultMapping);
        }
    }, [isOpen, excelHeaders, initialMapping]);

    const handleSubmit = () => {
        onConfirm(mapping);
    };

    return (
        <Modal isOpen={isOpen} onClose={onClose} title="Configurar Importação">
            <div className="space-y-4">
                <p className="text-sm text-gray-600 dark:text-gray-300">
                    Relacione as colunas encontradas no seu arquivo Excel com os campos do sistema.
                </p>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 max-h-[60vh] overflow-y-auto p-1">
                    {appFields.map((field) => {
                        if (field.key === 'responsavelSeparator') return null; // Rendered manually below

                        return (
                            <div key={field.key} className="flex flex-col">
                                <label className="text-xs font-bold text-gray-700 dark:text-gray-200 mb-1">
                                    {field.label}
                                </label>
                                <select
                                    value={mapping[field.key]}
                                    onChange={(e) => setMapping({ ...mapping, [field.key]: e.target.value })}
                                    className="p-2 border rounded-md text-sm bg-white dark:bg-gray-700 border-gray-300 dark:border-gray-600 text-gray-900 dark:text-white"
                                >
                                    <option value="" className="text-gray-500">-- Selecione a Coluna --</option>
                                    {excelHeaders.map((header) => (
                                        <option key={header} value={header}>
                                            {header}
                                        </option>
                                    ))}
                                </select>
                                
                                {/* Special Input for Separator below Responsavel */}
                                {field.key === 'responsavel' && (
                                    <div className="mt-2">
                                        <label className="text-[10px] font-bold text-gray-500 dark:text-gray-300 mb-0.5 block">
                                            Separador de Nomes (para cálculo HH)
                                        </label>
                                        <select
                                            value={mapping.responsavelSeparator}
                                            onChange={(e) => setMapping({ ...mapping, responsavelSeparator: e.target.value })}
                                            className="p-1.5 border rounded-md text-xs w-full bg-white dark:bg-gray-700 border-gray-300 dark:border-gray-600 text-gray-900 dark:text-white"
                                        >
                                            {separatorOptions.map(opt => (
                                                <option key={opt.value} value={opt.value}>{opt.label}</option>
                                            ))}
                                        </select>
                                    </div>
                                )}
                                
                                <span className="text-[10px] text-gray-500 dark:text-gray-400 mt-0.5">{field.help}</span>
                            </div>
                        );
                    })}
                </div>
                <div className="flex justify-end space-x-3 pt-4 border-t border-gray-200 dark:border-gray-700">
                    <button
                        onClick={autoMap}
                        className="px-4 py-2 text-sm bg-gray-200 hover:bg-gray-300 dark:bg-gray-600 dark:hover:bg-gray-500 text-gray-800 dark:text-white rounded-md transition-colors"
                    >
                        Sugerir Mapeamento
                    </button>
                    <button
                        onClick={handleSubmit}
                        className="px-4 py-2 text-sm bg-primary-600 hover:bg-primary-700 text-white rounded-md transition-colors"
                    >
                        Confirmar Importação
                    </button>
                </div>
            </div>
        </Modal>
    );
};
