/**
 * Utilitário de Mapeamento e Relação entre Supervisor e Turno
 *
 * Relação Operacional:
 * - Turno A: Supervisor Anderson Soares
 * - Turno B: Supervisor Rogério Lourenço
 * - Turno C: Yane Lisboa
 * - Turno D: Wilson Santana
 * - Turno ADM: Suelen Cordeiro ou Jhony França ou Luiz Jacon
 */

export interface ShiftInfo {
    id: string; // 'A' | 'B' | 'C' | 'D' | 'ADM'
    label: string;
    supervisores: string[];
    defaultSupervisor: string;
    description: string;
    shortSummary: string;
}

export const SHIFT_RELATIONS: Record<string, ShiftInfo> = {
    'A': {
        id: 'A',
        label: 'Turno A',
        supervisores: ['Anderson Soares'],
        defaultSupervisor: 'Anderson Soares',
        description: 'Turno A - Supervisor Anderson Soares',
        shortSummary: 'Anderson Soares',
    },
    'B': {
        id: 'B',
        label: 'Turno B',
        supervisores: ['Rogério Lourenço'],
        defaultSupervisor: 'Rogério Lourenço',
        description: 'Turno B - Supervisor Rogério Lourenço',
        shortSummary: 'Rogério Lourenço',
    },
    'C': {
        id: 'C',
        label: 'Turno C',
        supervisores: ['Yane Lisboa'],
        defaultSupervisor: 'Yane Lisboa',
        description: 'Turno C - Yane Lisboa',
        shortSummary: 'Yane Lisboa',
    },
    'D': {
        id: 'D',
        label: 'Turno D',
        supervisores: ['Wilson Santana'],
        defaultSupervisor: 'Wilson Santana',
        description: 'Turno D - Wilson Santana',
        shortSummary: 'Wilson Santana',
    },
    'ADM': {
        id: 'ADM',
        label: 'Turno ADM',
        supervisores: ['Suelen Cordeiro', 'Jhony França', 'Luiz Jacon'],
        defaultSupervisor: 'Suelen Cordeiro',
        description: 'Turno ADM - Suelen Cordeiro, Jhony França ou Luiz Jacon',
        shortSummary: 'Suelen C. / Jhony F. / Luiz J.',
    },
};

export const CANONICAL_SHIFTS = ['A', 'B', 'C', 'D', 'ADM'] as const;

export const ALL_CANONICAL_SUPERVISORS = [
    'Anderson Soares',
    'Rogério Lourenço',
    'Yane Lisboa',
    'Wilson Santana',
    'Suelen Cordeiro',
    'Jhony França',
    'Luiz Jacon',
] as const;

/**
 * Normaliza o nome do turno para os formatos padrão: 'A', 'B', 'C', 'D', 'ADM'.
 */
export const normalizeTurno = (rawTurno?: string | null): string => {
    if (!rawTurno) return '';
    const clean = rawTurno.trim().toUpperCase();

    if (clean === 'A' || clean === 'TURNO A' || clean === 'TURNO-A' || clean.startsWith('TURNO A')) return 'A';
    if (clean === 'B' || clean === 'TURNO B' || clean === 'TURNO-B' || clean.startsWith('TURNO B')) return 'B';
    if (clean === 'C' || clean === 'TURNO C' || clean === 'TURNO-C' || clean.startsWith('TURNO C')) return 'C';
    if (clean === 'D' || clean === 'TURNO D' || clean === 'TURNO-D' || clean.startsWith('TURNO D')) return 'D';
    if (
        clean === 'ADM' ||
        clean === 'ADM.' ||
        clean === 'ADMIN' ||
        clean === 'ADMINISTRATIVO' ||
        clean === 'TURNO ADM' ||
        clean === 'TURNO-ADM' ||
        clean.startsWith('TURNO ADM')
    ) {
        return 'ADM';
    }

    return rawTurno.trim();
};

/**
 * Normaliza o nome do supervisor com correspondência flexível aos 7 nomes cadastrados.
 */
export const normalizeSupervisor = (rawName?: string | null): string => {
    if (!rawName) return '';
    const clean = rawName
        .trim()
        .toLowerCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, ''); // remove accents for comparison

    if (clean.includes('anderson')) return 'Anderson Soares';
    if (clean.includes('rogerio') || clean.includes('lourenco')) return 'Rogério Lourenço';
    if (clean.includes('yane') || clean.includes('lisboa')) return 'Yane Lisboa';
    if (clean.includes('wilson') || clean.includes('santana')) return 'Wilson Santana';
    if (clean.includes('suelen') || clean.includes('cordeiro')) return 'Suelen Cordeiro';
    if (clean.includes('jhony') || clean.includes('johnny') || clean.includes('franca')) return 'Jhony França';
    if (clean.includes('luiz') || clean.includes('luis') || clean.includes('jacon')) return 'Luiz Jacon';

    return rawName.trim();
};

/**
 * Retorna a lista de supervisores válidos para um determinado turno.
 */
export const getSupervisoresForTurno = (rawTurno?: string | null): string[] => {
    const norm = normalizeTurno(rawTurno);
    return SHIFT_RELATIONS[norm]?.supervisores || [];
};

/**
 * Retorna o supervisor padrão ou sugerido para o turno.
 */
export const getDefaultSupervisorForTurno = (rawTurno?: string | null): string => {
    const norm = normalizeTurno(rawTurno);
    return SHIFT_RELATIONS[norm]?.defaultSupervisor || '';
};

/**
 * Retorna o turno correspondente a um supervisor dado.
 */
export const getTurnoForSupervisor = (rawSupervisor?: string | null): string | undefined => {
    if (!rawSupervisor) return undefined;
    const normalized = normalizeSupervisor(rawSupervisor);

    for (const [shiftId, info] of Object.entries(SHIFT_RELATIONS)) {
        if (info.supervisores.includes(normalized)) {
            return shiftId;
        }
    }
    return undefined;
};

/**
 * Formata o rótulo descritivo do turno com indicação do(s) supervisor(es).
 */
export const formatTurnoWithSupervisor = (turno: string): string => {
    const norm = normalizeTurno(turno);
    const info = SHIFT_RELATIONS[norm];
    if (!info) return turno === 'all' ? 'Turno: Todos' : `Turno ${turno}`;
    return `${info.label} (${info.shortSummary})`;
};

/**
 * Formata o rótulo do supervisor com indicação do turno.
 */
export const formatSupervisorWithTurno = (supervisor: string): string => {
    if (supervisor === 'all') return 'Sup: Todos';
    const normSup = normalizeSupervisor(supervisor);
    const turno = getTurnoForSupervisor(normSup);
    if (turno) {
        return `${normSup} (Turno ${turno})`;
    }
    return supervisor;
};

/**
 * Auto-preenche e concilia turno e supervisor mutuamente caso um esteja preenchido e o outro ausente.
 */
export const reconcileShiftAndSupervisor = (
    currentTurno?: string,
    currentSupervisor?: string
): { turno: string; supervisor: string } => {
    let turno = normalizeTurno(currentTurno);
    let supervisor = normalizeSupervisor(currentSupervisor);

    // Se temos supervisor mas não turno, deriva o turno
    if (!turno && supervisor) {
        const derivedTurno = getTurnoForSupervisor(supervisor);
        if (derivedTurno) turno = derivedTurno;
    }

    // Se temos turno mas não supervisor, preenche com o default do turno
    if (turno && !supervisor) {
        const defaultSup = getDefaultSupervisorForTurno(turno);
        if (defaultSup) supervisor = defaultSup;
    }

    return { turno, supervisor };
};
