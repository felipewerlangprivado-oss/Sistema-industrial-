
/**
 * Centraliza o cálculo do custo de matéria-prima (Custo do Traço) de um vaso.
 * 
 * Regra: Peso do Vaso (Kg) * Custo Global do Traço (R$/Kg)
 * 
 * @param weightKg Peso do modelo em Kg
 * @param costPerKg Custo atual do traço configurado no sistema
 * @returns O custo calculado da matéria-prima
 */
export const calculateRawMaterialCost = (weightKg: number, costPerKg: number): number => {
    if (weightKg <= 0 || costPerKg <= 0) return 0;
    return weightKg * costPerKg;
};

/**
 * Calcula a comissão de pintura baseada no preço de venda e percentual configurado.
 * 
 * Regra: Preço de Venda * (Porcentagem / 100)
 * 
 * @param salePrice Preço de venda do vaso
 * @param percentage Percentual de comissão (ex: 10 para 10%)
 * @returns O valor da comissão
 */
export const calculatePaintingCommission = (salePrice: number, percentage: number): number => {
    if (salePrice <= 0 || percentage < 0) return 0;
    return salePrice * (percentage / 100);
};

/**
 * Calcula o número de dias passados entre uma data e hoje (ou outra data de referência).
 * Retorna inteiro arredondado para baixo.
 */
export const getDaysDiff = (from: number, to: number = Date.now()): number => {
    const msPerDay = 1000 * 60 * 60 * 24;
    return Math.floor((to - from) / msPerDay);
};

// --- CIP GENERATION UTILS ---

/**
 * Obtém o último dígito do ano.
 * Ex: 2025 -> 5
 */
export const getYearDigit = (date: Date): string => {
    return date.getFullYear().toString().slice(-1);
};

/**
 * Obtém o dia do ano (001 a 366).
 */
export const getDayOfYear = (date: Date): string => {
    const start = new Date(date.getFullYear(), 0, 0);
    const diff = date.getTime() - start.getTime();
    const oneDay = 1000 * 60 * 60 * 24;
    const day = Math.floor(diff / oneDay);
    return day.toString().padStart(3, '0');
};

/**
 * Gera o Código de Identificação de Produção (CIP) no formato YDDDSS.
 * 
 * @param date Data de fabricação
 * @param sequence Sequencial do dia (0 a 99)
 * @returns Código formatado string (ex: 722100)
 */
export const generateCIP = (date: Date, sequence: number): string => {
    const y = getYearDigit(date);
    const ddd = getDayOfYear(date);
    const ss = sequence.toString().padStart(2, '0');
    
    return `${y}${ddd}${ss}`;
};
