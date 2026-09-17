import { Activity, ActivityStatus, Criticidade } from '../types';

export interface ExportExcelOptions {
    fileName?: string;
    customStatusLabels?: Record<string, string>;
    includeSummarySheet?: boolean;
    programacaoId?: string;
    userName?: string;
}

const getStatusLabelText = (status: ActivityStatus, customStatusLabels?: Record<string, string>): string => {
    if (customStatusLabels && customStatusLabels[status]) {
        return customStatusLabels[status];
    }
    switch (status) {
        case ActivityStatus.Open:
            return 'Aberto';
        case ActivityStatus.EmProgresso:
            return 'Em Andamento';
        case ActivityStatus.ExecutadoParcialmente:
            return 'Executado Parcialmente';
        case ActivityStatus.Closed:
            return 'Concluído';
        case ActivityStatus.NaoExecutado:
            return 'Não Executado';
        default:
            return String(status || '');
    }
};

const formatDateBR = (iso?: string | null): string => {
    if (!iso) return '';
    try {
        const d = new Date(iso);
        if (isNaN(d.getTime())) return '';
        const day = String(d.getDate()).padStart(2, '0');
        const month = String(d.getMonth() + 1).padStart(2, '0');
        const year = d.getFullYear();
        return `${day}/${month}/${year}`;
    } catch {
        return '';
    }
};

const formatTimeBR = (iso?: string | null): string => {
    if (!iso) return '';
    try {
        const d = new Date(iso);
        if (isNaN(d.getTime())) return '';
        const hours = String(d.getHours()).padStart(2, '0');
        const minutes = String(d.getMinutes()).padStart(2, '0');
        return `${hours}:${minutes}`;
    } catch {
        return '';
    }
};

export const exportActivitiesToExcel = (
    activities: Activity[],
    options: ExportExcelOptions = {}
): boolean => {
    const XLSX = (window as any).XLSX;
    if (!XLSX) {
        console.error('SheetJS (XLSX) library not loaded');
        alert('Erro: Biblioteca de exportação para Excel não está carregada. Recarregue a página e tente novamente.');
        return false;
    }

    if (!activities || activities.length === 0) {
        alert('Nenhuma atividade disponível para exportar.');
        return false;
    }

    try {
        const customStatusLabels = options.customStatusLabels || {};
        const userName = options.userName || 'Administrador';

        // 1. Prepare Main Sheet Data (Programação Detalhada)
        const rows = activities.map((act, index) => {
            const progressVal = act.status === ActivityStatus.Closed 
                ? 100 
                : (act.progresso !== undefined ? Number(act.progresso) : 0);

            return {
                'Seq': index + 1,
                'ID MP': act.idMp || '',
                'TAG': act.tag || '',
                'Descrição da Atividade': act.descricao || '',
                'Área': act.area || '',
                'Tipo': act.tipo || '',
                'Status': getStatusLabelText(act.status, customStatusLabels),
                'Avanço Físico (%)': progressVal,
                'Turno': act.turno || '',
                'Supervisor': act.supervisor || '',
                'Responsável': act.responsavel || '',
                'Empresa': act.empresa || '',
                'Efetivo': act.efetivo || '',
                'Jornada': act.jornada || '',
                'Data Início Planejada': formatDateBR(act.horaInicio),
                'Hora Início Planejada': formatTimeBR(act.horaInicio),
                'Data Fim Planejada': formatDateBR(act.horaFim),
                'Hora Fim Planejada': formatTimeBR(act.horaFim),
                'Duração': act.duracao || '',
                'Data Início Real': formatDateBR(act.horaInicioReal),
                'Hora Início Real': formatTimeBR(act.horaInicioReal),
                'Data Fim Real': formatDateBR(act.horaFimReal),
                'Hora Fim Real': formatTimeBR(act.horaFimReal),
                'Criticidade': (act.criticidade || Criticidade.Normal).toUpperCase(),
                'Predecessoras': (act.predecessoras && act.predecessoras.length > 0) ? act.predecessoras.join(', ') : '',
                'Sucessoras': (act.sucessoras && act.sucessoras.length > 0) ? act.sucessoras.join(', ') : '',
                'Periodicidade': act.periodicidade || '',
                'R. Elétrico': act['r eletrico'] ? 'Sim' : 'Não',
                'Labapet': act.labapet ? 'Sim' : 'Não',
                'Observações': act.observacoes || ''
            };
        });

        // Create workbook
        const workbook = XLSX.utils.book_new();

        // Create main worksheet
        const mainSheet = XLSX.utils.json_to_sheet(rows);

        // Auto-fit column widths
        if (rows.length > 0) {
            const colKeys = Object.keys(rows[0]);
            mainSheet['!cols'] = colKeys.map(key => {
                let maxLen = key.length;
                for (let i = 0; i < Math.min(rows.length, 100); i++) {
                    const val = (rows as any)[i][key];
                    const len = val !== null && val !== undefined ? String(val).length : 0;
                    if (len > maxLen) maxLen = len;
                }
                return { wch: Math.min(Math.max(maxLen + 3, 10), 55) };
            });
        }

        XLSX.utils.book_append_sheet(workbook, mainSheet, 'Programação');

        // 2. Summary & KPIs Sheet (if requested)
        if (options.includeSummarySheet !== false) {
            const total = activities.length;
            const completed = activities.filter(a => a.status === ActivityStatus.Closed).length;
            const inProgress = activities.filter(a => a.status === ActivityStatus.EmProgresso).length;
            const partial = activities.filter(a => a.status === ActivityStatus.ExecutadoParcialmente).length;
            const notExecuted = activities.filter(a => a.status === ActivityStatus.NaoExecutado).length;
            const open = activities.filter(a => a.status === ActivityStatus.Open).length;

            const totalProgress = activities.reduce((acc, a) => {
                const prog = a.status === ActivityStatus.Closed ? 100 : (a.progresso || 0);
                return acc + prog;
            }, 0);
            const avgProgress = total > 0 ? (totalProgress / total).toFixed(1) + '%' : '0%';

            // Shift breakdown
            const shiftCounts: Record<string, number> = {};
            activities.forEach(a => {
                const t = a.turno || 'Não Definido';
                shiftCounts[t] = (shiftCounts[t] || 0) + 1;
            });

            // Company breakdown
            const companyCounts: Record<string, number> = {};
            activities.forEach(a => {
                const emp = a.empresa || 'Não Definida';
                companyCounts[emp] = (companyCounts[emp] || 0) + 1;
            });

            const summaryAoa: any[][] = [
                ['RELATÓRIO DE PROGRAMAÇÃO DE ATIVIDADES - MP'],
                [''],
                ['Data de Exportação:', new Date().toLocaleString('pt-BR')],
                ['Exportado por:', userName],
                ['Filtro / ID MP:', options.programacaoId || 'Todas as Programações'],
                [''],
                ['RESUMO GERAL DE EXECUÇÃO', 'QUANTIDADE', 'PERCENTUAL'],
                ['Total de Atividades', total, '100%'],
                ['Concluídas', completed, total > 0 ? ((completed / total) * 100).toFixed(1) + '%' : '0%'],
                ['Em Andamento', inProgress, total > 0 ? ((inProgress / total) * 100).toFixed(1) + '%' : '0%'],
                ['Executadas Parcialmente', partial, total > 0 ? ((partial / total) * 100).toFixed(1) + '%' : '0%'],
                ['Abertas / Não Iniciadas', open, total > 0 ? ((open / total) * 100).toFixed(1) + '%' : '0%'],
                ['Não Executadas', notExecuted, total > 0 ? ((notExecuted / total) * 100).toFixed(1) + '%' : '0%'],
                ['Média Geral de Avanço Físico', avgProgress, ''],
                [''],
                ['DISTRIBUIÇÃO POR TURNO', 'QUANTIDADE'],
                ...Object.entries(shiftCounts).map(([shift, count]) => [shift, count]),
                [''],
                ['DISTRIBUIÇÃO POR EMPRESA', 'QUANTIDADE'],
                ...Object.entries(companyCounts).map(([company, count]) => [company, count]),
            ];

            const summarySheet = XLSX.utils.aoa_to_sheet(summaryAoa);
            summarySheet['!cols'] = [{ wch: 35 }, { wch: 20 }, { wch: 18 }];
            XLSX.utils.book_append_sheet(workbook, summarySheet, 'Resumo & Indicadores');
        }

        // Generate file name
        const now = new Date();
        const dateStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
        const mpSuffix = options.programacaoId ? `_${options.programacaoId.replace(/[^a-zA-Z0-9_-]/g, '_')}` : '';
        const defaultName = `Programacao_Atividades_MP${mpSuffix}_${dateStr}.xlsx`;
        const fileName = options.fileName || defaultName;

        // Write and trigger download
        XLSX.writeFile(workbook, fileName);
        return true;
    } catch (err) {
        console.error('Erro ao exportar arquivo Excel:', err);
        alert('Ocorreu um erro ao gerar o arquivo Excel.');
        return false;
    }
};
