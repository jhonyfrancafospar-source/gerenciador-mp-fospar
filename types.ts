
export type ViewType = 'dashboard' | 'list' | 'board' | 'gantt' | 'report' | 'audit' | 'manpower' | 'calendar';

export type FilterType = {
    turno: string;
    responsavel: string;
    supervisor: string;
    // date removed
    idMp: string;
    onlyMyActivities: boolean;
};

export type SortType = 'default' | 'deadline';

export enum ActivityStatus {
    Open = 'OPEN',
    NaoExecutado = 'NÃO EXECUTADO',
    EmProgresso = 'EM PROGRESSO',
    ExecutadoParcialmente = 'EXECUTADO PARCIALMENTE',
    Closed = 'CLOSED',
}

export enum Criticidade {
    Baixa = 'baixa',
    Normal = 'normal',
    Alta = 'alta',
    Urgente = 'urgente',
}

export enum Recorrencia {
    Diario = 'Diário',
    Semanal = 'Semanal',
    Quinzenal = 'Quinzenal',
    Mensal = 'Mensal',
    Trimestral = 'Trimestral',
    Semestral = 'Semestral',
    NaoHa = 'Não há'
}

export interface Comment {
    id: string;
    user: string;
    text: string;
    timestamp: string;
}

export interface Attachment {
    id: string;
    name: string;
    type: 'image' | 'video' | 'file';
    url: string;
}

export interface AuditLogEntry {
    id: string;
    timestamp: string;
    user: string;
    action: string;
    details: string;
    entityId?: string;
}

export interface User {
    username: string;
    password: string;
    name: string; // Matches parts of 'responsavel' string
    role: 'admin' | 'user';
    profilePicture?: string;
    backgroundImage?: string;
}

export interface Activity {
    id: string;
    idMp?: string;
    tag: string;
    tipo: string;
    periodicidade: string | Recorrencia;
    area: string;
    descricao: string;
    jornada: string;
    turno: string;
    empresa: string;
    efetivo: string;
    responsavel: string;
    supervisor?: string;
    horaInicio: string; // ISO 8601 format
    horaFim: string; // ISO 8601 format
    horaInicioReal?: string; // ISO 8601 format
    horaFimReal?: string; // ISO 8601 format
    duracao: string; // e.g., "0:10"
    "r eletrico": boolean;
    labapet: boolean;
    criticidade: Criticidade;
    observacoes?: string;
    status: ActivityStatus;
    comments?: Comment[];
    attachments?: Attachment[];
    beforeImage?: Attachment;
    afterImage?: Attachment;
}

export interface ImportMapping {
    idMp: string;
    tag: string;
    descricao: string;
    responsavel: string; // The actual person doing it (mapped from Efetivo in previous logic, but now configurable)
    responsavelSeparator?: string; // Separator used in the responsavel column (e.g. /, ;, ,)
    supervisor: string; // Mapped from Responsavel in previous logic
    area: string;
    turno: string;
    data?: string; // Separate Date column
    horaInicio: string;
    horaFim: string;
    duracao: string; // Explicit duration mapping
    criticidade: string;
}

export interface ImportBatch {
    id: string; // timestamp
    date: string; // ISO string
    count: number;
    rawData: any[]; // The raw Excel JSON
    headers: string[];
    mapping: ImportMapping;
}