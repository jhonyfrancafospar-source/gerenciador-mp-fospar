/**
 * Utilitários para detecção e cálculo de Feriados Nacionais (Brasil)
 * e Finais de Semana (Sábado e Domingo) no Gráfico de Gantt.
 */

export interface HolidayInfo {
    name: string;
    type: 'nacional' | 'facultativo' | 'personalizado';
    description?: string;
}

export interface DaySpecialInfo {
    date: Date;
    dayOfWeek: number; // 0 = Domingo, 6 = Sábado
    isSaturday: boolean;
    isSunday: boolean;
    isWeekend: boolean;
    isHoliday: boolean;
    isNonWorkingDay: boolean;
    holiday?: HolidayInfo;
    badgeLabel?: string;
    tooltip: string;
}

/**
 * Algoritmo de Meeus/Jones/Butcher para cálculo do Domingo de Páscoa (Calendário Gregoriano).
 */
export function calculateEasterDate(year: number): Date {
    const a = year % 19;
    const b = Math.floor(year / 100);
    const c = year % 100;
    const d = Math.floor(b / 4);
    const e = b % 4;
    const f = Math.floor((b + 8) / 25);
    const g = Math.floor((b - f + 1) / 3);
    const h = (19 * a + b - d - g + 15) % 30;
    const i = Math.floor(c / 4);
    const k = c % 4;
    const l = (32 + 2 * e + 2 * i - h - k) % 7;
    const m = Math.floor((a + 11 * h + 22 * l) / 451);
    const month = Math.floor((h + l - 7 * m + 114) / 31); // 3 = Março, 4 = Abril
    const day = ((h + l - 7 * m + 114) % 31) + 1;
    return new Date(year, month - 1, day);
}

/**
 * Cache de feriados por ano para performance máxima.
 */
const holidaysCacheByYear = new Map<number, Map<string, HolidayInfo>>();

/**
 * Retorna todos os feriados nacionais brasileiros (fixos e móveis) para um determinado ano.
 */
export function getHolidaysForYear(year: number): Map<string, HolidayInfo> {
    if (holidaysCacheByYear.has(year)) {
        return holidaysCacheByYear.get(year)!;
    }

    const holidays = new Map<string, HolidayInfo>();

    const addHoliday = (month1Based: number, day: number, name: string, type: 'nacional' | 'facultativo' = 'nacional', desc?: string) => {
        const key = `${String(month1Based).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
        holidays.set(key, { name, type, description: desc });
    };

    // 1. Feriados Nacionais Fixos (Brasil)
    addHoliday(1, 1, 'Ano Novo (Confraternização Universal)', 'nacional');
    addHoliday(4, 21, 'Tiradentes', 'nacional');
    addHoliday(5, 1, 'Dia do Trabalho', 'nacional');
    addHoliday(9, 7, 'Independência do Brasil', 'nacional');
    addHoliday(10, 12, 'Nossa Senhora Aparecida (Padroeira do Brasil)', 'nacional');
    addHoliday(11, 2, 'Finados', 'nacional');
    addHoliday(11, 15, 'Proclamação da República', 'nacional');
    // Lei nº 14.759/2023 tornou o Dia da Consciência Negra feriado nacional
    addHoliday(11, 20, 'Dia da Consciência Negra', 'nacional');
    addHoliday(12, 25, 'Natal', 'nacional');

    // 2. Feriados Móveis baseados na Páscoa
    const easter = calculateEasterDate(year);

    const addRelativeDays = (base: Date, daysDiff: number, name: string, type: 'nacional' | 'facultativo' = 'nacional', desc?: string) => {
        const target = new Date(base.getFullYear(), base.getMonth(), base.getDate() + daysDiff);
        addHoliday(target.getMonth() + 1, target.getDate(), name, type, desc);
    };

    // Carnaval (Segunda e Terça-feira)
    addRelativeDays(easter, -48, 'Carnaval (Segunda-feira)', 'facultativo');
    addRelativeDays(easter, -47, 'Carnaval (Terça-feira)', 'facultativo');
    addRelativeDays(easter, -46, 'Quarta-feira de Cinzas', 'facultativo');

    // Sexta-feira Santa (Paixão de Cristo) - Feriado Nacional (Lei Federal 9.093/1995)
    addRelativeDays(easter, -2, 'Sexta-feira Santa (Paixão de Cristo)', 'nacional');

    // Páscoa (Domingo)
    addRelativeDays(easter, 0, 'Páscoa', 'nacional');

    // Corpus Christi (Quinta-feira, 60 dias após a Páscoa)
    addRelativeDays(easter, 60, 'Corpus Christi', 'facultativo');

    holidaysCacheByYear.set(year, holidays);
    return holidays;
}

/**
 * Analisa uma data específica e retorna informações completas sobre fim de semana ou feriado.
 */
export function getDaySpecialInfo(date: Date): DaySpecialInfo {
    const year = date.getFullYear();
    const month = date.getMonth() + 1;
    const dayOfMonth = date.getDate();
    const dayOfWeek = date.getDay(); // 0 = Domingo, 6 = Sábado

    const isSaturday = dayOfWeek === 6;
    const isSunday = dayOfWeek === 0;
    const isWeekend = isSaturday || isSunday;

    const yearHolidays = getHolidaysForYear(year);
    const dateKey = `${String(month).padStart(2, '0')}-${String(dayOfMonth).padStart(2, '0')}`;
    const holiday = yearHolidays.get(dateKey);
    const isHoliday = !!holiday;

    let badgeLabel: string | undefined = undefined;
    let tooltip = '';

    if (isHoliday) {
        badgeLabel = `🎉 ${holiday.name}`;
        tooltip = `Feriado: ${holiday.name} (${String(dayOfMonth).padStart(2, '0')}/${String(month).padStart(2, '0')})`;
        if (isWeekend) {
            tooltip += ` - Cai em um ${isSaturday ? 'Sábado' : 'Domingo'}`;
        }
    } else if (isSaturday) {
        badgeLabel = 'Sábado';
        tooltip = `Sábado - Fim de semana (${String(dayOfMonth).padStart(2, '0')}/${String(month).padStart(2, '0')})`;
    } else if (isSunday) {
        badgeLabel = 'Domingo';
        tooltip = `Domingo - Fim de semana (${String(dayOfMonth).padStart(2, '0')}/${String(month).padStart(2, '0')})`;
    } else {
        tooltip = `${String(dayOfMonth).padStart(2, '0')}/${String(month).padStart(2, '0')}/${year}`;
    }

    return {
        date,
        dayOfWeek,
        isSaturday,
        isSunday,
        isWeekend,
        isHoliday,
        isNonWorkingDay: isWeekend || isHoliday,
        holiday,
        badgeLabel,
        tooltip
    };
}
