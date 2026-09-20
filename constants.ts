
import { VaseModel, VaseType, Employee, Sector } from './types';

export const DEFAULT_SUPERVISOR_PASS = '1234';

export function getCanonicalVaseModelId(name: string, type: VaseType): string {
  const cleanName = name
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
  const typeSuffix = type === VaseType.WITH_SHELL ? 'with-shell' : 'no-shell';
  return `model-${cleanName}-${typeSuffix}`;
}

export const INITIAL_EMPLOYEES: Employee[] = [
  { id: '1', name: 'João Silva', sector: Sector.PRODUCTION, role: 'colaborador', active: true },
  { id: '2', name: 'Maria Santos', sector: Sector.FINISHING, role: 'colaborador', active: true },
  { id: '3', name: 'Carlos Oliveira', sector: Sector.PAINTING, role: 'colaborador', active: true },
  { id: '4', name: 'Ana Costa', sector: Sector.SUPERVISOR, role: 'supervisor', active: true },
  { id: '5', name: 'Pedro Souza', sector: Sector.PRODUCTION, role: 'colaborador', active: true },
  { id: '6', name: 'Fernanda Lima', sector: Sector.FINISHING, role: 'colaborador', active: true },
];

export const INITIAL_VASES: VaseModel[] = [
  // --- COM CASCA ---
  { id: getCanonicalVaseModelId('California P', VaseType.WITH_SHELL), name: 'California P', type: VaseType.WITH_SHELL, weightKg: 8, costProduction: 8.00, costFinishing: 7.20, priceSale: 200.00 },
  { id: getCanonicalVaseModelId('California M', VaseType.WITH_SHELL), name: 'California M', type: VaseType.WITH_SHELL, weightKg: 14, costProduction: 10.00, costFinishing: 9.00, priceSale: 250.00 },
  { id: getCanonicalVaseModelId('Bacia Lisa', VaseType.WITH_SHELL), name: 'Bacia Lisa', type: VaseType.WITH_SHELL, weightKg: 14, costProduction: 12.00, costFinishing: 10.80, priceSale: 300.00 },
  { id: getCanonicalVaseModelId('Jarro', VaseType.WITH_SHELL), name: 'Jarro', type: VaseType.WITH_SHELL, weightKg: 14, costProduction: 12.00, costFinishing: 10.80, priceSale: 300.00 },
  { id: getCanonicalVaseModelId('California G', VaseType.WITH_SHELL), name: 'California G', type: VaseType.WITH_SHELL, weightKg: 22, costProduction: 12.00, costFinishing: 10.80, priceSale: 300.00 },
  { id: getCanonicalVaseModelId('Jambo', VaseType.WITH_SHELL), name: 'Jambo', type: VaseType.WITH_SHELL, weightKg: 14, costProduction: 12.00, costFinishing: 10.80, priceSale: 300.00 },
  { id: getCanonicalVaseModelId('Manoel M', VaseType.WITH_SHELL), name: 'Manoel M', type: VaseType.WITH_SHELL, weightKg: 14, costProduction: 12.00, costFinishing: 10.80, priceSale: 300.00 },
  { id: getCanonicalVaseModelId('Mini Pot', VaseType.WITH_SHELL), name: 'Mini Pot', type: VaseType.WITH_SHELL, weightKg: 8, costProduction: 12.00, costFinishing: 10.80, priceSale: 300.00 },
  { id: getCanonicalVaseModelId('Slim M', VaseType.WITH_SHELL), name: 'Slim M', type: VaseType.WITH_SHELL, weightKg: 14, costProduction: 15.00, costFinishing: 13.50, priceSale: 375.00 },
  { id: getCanonicalVaseModelId('California GG', VaseType.WITH_SHELL), name: 'California GG', type: VaseType.WITH_SHELL, weightKg: 32, costProduction: 15.00, costFinishing: 13.50, priceSale: 375.00 },
  { id: getCanonicalVaseModelId('Home P', VaseType.WITH_SHELL), name: 'Home P', type: VaseType.WITH_SHELL, weightKg: 8, costProduction: 15.00, costFinishing: 13.50, priceSale: 375.00 },
  { id: getCanonicalVaseModelId('Mônaco M', VaseType.WITH_SHELL), name: 'Mônaco M', type: VaseType.WITH_SHELL, weightKg: 14, costProduction: 15.00, costFinishing: 13.50, priceSale: 375.00 },
  { id: getCanonicalVaseModelId('Vity', VaseType.WITH_SHELL), name: 'Vity', type: VaseType.WITH_SHELL, weightKg: 14, costProduction: 16.00, costFinishing: 14.40, priceSale: 400.00 },
  { id: getCanonicalVaseModelId('Dubai', VaseType.WITH_SHELL), name: 'Dubai', type: VaseType.WITH_SHELL, weightKg: 14, costProduction: 16.00, costFinishing: 14.40, priceSale: 400.00 },
  { id: getCanonicalVaseModelId('Cilindro', VaseType.WITH_SHELL), name: 'Cilindro', type: VaseType.WITH_SHELL, weightKg: 14, costProduction: 16.00, costFinishing: 14.40, priceSale: 400.00 },
  { id: getCanonicalVaseModelId('Paris', VaseType.WITH_SHELL), name: 'Paris', type: VaseType.WITH_SHELL, weightKg: 22, costProduction: 16.00, costFinishing: 14.40, priceSale: 400.00 },
  { id: getCanonicalVaseModelId('Bola M', VaseType.WITH_SHELL), name: 'Bola M', type: VaseType.WITH_SHELL, weightKg: 14, costProduction: 18.00, costFinishing: 16.20, priceSale: 500.00 },
  { id: getCanonicalVaseModelId('Home G', VaseType.WITH_SHELL), name: 'Home G', type: VaseType.WITH_SHELL, weightKg: 22, costProduction: 18.00, costFinishing: 16.20, priceSale: 500.00 },
  { id: getCanonicalVaseModelId('Bali', VaseType.WITH_SHELL), name: 'Bali', type: VaseType.WITH_SHELL, weightKg: 14, costProduction: 18.00, costFinishing: 16.20, priceSale: 500.00 },
  { id: getCanonicalVaseModelId('Mônaco G', VaseType.WITH_SHELL), name: 'Mônaco G', type: VaseType.WITH_SHELL, weightKg: 22, costProduction: 18.00, costFinishing: 16.20, priceSale: 500.00 },
  { id: getCanonicalVaseModelId('Áustria', VaseType.WITH_SHELL), name: 'Áustria', type: VaseType.WITH_SHELL, weightKg: 14, costProduction: 18.00, costFinishing: 16.20, priceSale: 500.00 },
  { id: getCanonicalVaseModelId('Slim G', VaseType.WITH_SHELL), name: 'Slim G', type: VaseType.WITH_SHELL, weightKg: 22, costProduction: 20.00, costFinishing: 18.00, priceSale: 600.00 },
  { id: getCanonicalVaseModelId('Roma', VaseType.WITH_SHELL), name: 'Roma', type: VaseType.WITH_SHELL, weightKg: 14, costProduction: 20.00, costFinishing: 18.00, priceSale: 600.00 },
  { id: getCanonicalVaseModelId('Georgia', VaseType.WITH_SHELL), name: 'Georgia', type: VaseType.WITH_SHELL, weightKg: 14, costProduction: 20.00, costFinishing: 18.00, priceSale: 600.00 },
  { id: getCanonicalVaseModelId('Moscou', VaseType.WITH_SHELL), name: 'Moscou', type: VaseType.WITH_SHELL, weightKg: 14, costProduction: 20.00, costFinishing: 18.00, priceSale: 600.00 },
  { id: getCanonicalVaseModelId('Portugal', VaseType.WITH_SHELL), name: 'Portugal', type: VaseType.WITH_SHELL, weightKg: 14, costProduction: 20.00, costFinishing: 18.00, priceSale: 600.00 },
  { id: getCanonicalVaseModelId('Heitor', VaseType.WITH_SHELL), name: 'Heitor', type: VaseType.WITH_SHELL, weightKg: 22, costProduction: 25.00, costFinishing: 22.50, priceSale: 800.00 },
  { id: getCanonicalVaseModelId('Veneza', VaseType.WITH_SHELL), name: 'Veneza', type: VaseType.WITH_SHELL, weightKg: 22, costProduction: 25.00, costFinishing: 22.50, priceSale: 800.00 },
  { id: getCanonicalVaseModelId('Granada', VaseType.WITH_SHELL), name: 'Granada', type: VaseType.WITH_SHELL, weightKg: 22, costProduction: 25.00, costFinishing: 22.50, priceSale: 800.00 },
  { id: getCanonicalVaseModelId('Apogeu', VaseType.WITH_SHELL), name: 'Apogeu', type: VaseType.WITH_SHELL, weightKg: 22, costProduction: 25.00, costFinishing: 22.50, priceSale: 800.00 },
  { id: getCanonicalVaseModelId('Ânfora 90cm', VaseType.WITH_SHELL), name: 'Ânfora 90cm', type: VaseType.WITH_SHELL, weightKg: 32, costProduction: 30.00, costFinishing: 27.00, priceSale: 1000.00 },
  { id: getCanonicalVaseModelId('Irã', VaseType.WITH_SHELL), name: 'Irã', type: VaseType.WITH_SHELL, weightKg: 22, costProduction: 35.00, costFinishing: 31.50, priceSale: 1000.00 },
  { id: getCanonicalVaseModelId('Madri', VaseType.WITH_SHELL), name: 'Madri', type: VaseType.WITH_SHELL, weightKg: 22, costProduction: 35.00, costFinishing: 31.50, priceSale: 1000.00 },
  { id: getCanonicalVaseModelId('Ânfora', VaseType.WITH_SHELL), name: 'Ânfora', type: VaseType.WITH_SHELL, weightKg: 32, costProduction: 50.00, costFinishing: 45.00, priceSale: 1250.00 },

  // --- SEM CASCA ---
  { id: getCanonicalVaseModelId('Vity', VaseType.WITHOUT_SHELL), name: 'Vity', type: VaseType.WITHOUT_SHELL, weightKg: 14, costProduction: 8.00 },
  { id: getCanonicalVaseModelId('Dubai', VaseType.WITHOUT_SHELL), name: 'Dubai', type: VaseType.WITHOUT_SHELL, weightKg: 14, costProduction: 8.00 },
  { id: getCanonicalVaseModelId('Bola M', VaseType.WITHOUT_SHELL), name: 'Bola M', type: VaseType.WITHOUT_SHELL, weightKg: 14, costProduction: 10.00 },
  { id: getCanonicalVaseModelId('Cilindro', VaseType.WITHOUT_SHELL), name: 'Cilindro', type: VaseType.WITHOUT_SHELL, weightKg: 14, costProduction: 8.00 },
  { id: getCanonicalVaseModelId('Paris', VaseType.WITHOUT_SHELL), name: 'Paris', type: VaseType.WITHOUT_SHELL, weightKg: 14, costProduction: 8.00 },
  { id: getCanonicalVaseModelId('Slim G', VaseType.WITHOUT_SHELL), name: 'Slim G', type: VaseType.WITHOUT_SHELL, weightKg: 22, costProduction: 10.00 },
  { id: getCanonicalVaseModelId('Slim M', VaseType.WITHOUT_SHELL), name: 'Slim M', type: VaseType.WITHOUT_SHELL, weightKg: 14, costProduction: 8.00 },
  { id: getCanonicalVaseModelId('Bacia Lisa', VaseType.WITHOUT_SHELL), name: 'Bacia Lisa', type: VaseType.WITHOUT_SHELL, weightKg: 14, costProduction: 6.00 },
  { id: getCanonicalVaseModelId('Irã', VaseType.WITHOUT_SHELL), name: 'Irã', type: VaseType.WITHOUT_SHELL, weightKg: 22, costProduction: 20.00 },
  { id: getCanonicalVaseModelId('Madri', VaseType.WITHOUT_SHELL), name: 'Madri', type: VaseType.WITHOUT_SHELL, weightKg: 22, costProduction: 15.00 },
  { id: getCanonicalVaseModelId('Ânfora', VaseType.WITHOUT_SHELL), name: 'Ânfora', type: VaseType.WITHOUT_SHELL, weightKg: 32, costProduction: 40.00 },
  { id: getCanonicalVaseModelId('Jarro', VaseType.WITHOUT_SHELL), name: 'Jarro', type: VaseType.WITHOUT_SHELL, weightKg: 14, costProduction: 5.00 },
  { id: getCanonicalVaseModelId('California GG', VaseType.WITHOUT_SHELL), name: 'California GG', type: VaseType.WITHOUT_SHELL, weightKg: 32, costProduction: 7.00 },
  { id: getCanonicalVaseModelId('California G', VaseType.WITHOUT_SHELL), name: 'California G', type: VaseType.WITHOUT_SHELL, weightKg: 22, costProduction: 6.00 },
  { id: getCanonicalVaseModelId('California M', VaseType.WITHOUT_SHELL), name: 'California M', type: VaseType.WITHOUT_SHELL, weightKg: 14, costProduction: 5.00 },
  { id: getCanonicalVaseModelId('California P', VaseType.WITHOUT_SHELL), name: 'California P', type: VaseType.WITHOUT_SHELL, weightKg: 8, costProduction: 4.00 },
  { id: getCanonicalVaseModelId('Jambo', VaseType.WITHOUT_SHELL), name: 'Jambo', type: VaseType.WITHOUT_SHELL, weightKg: 14, costProduction: 5.00 },
  { id: getCanonicalVaseModelId('Home G', VaseType.WITHOUT_SHELL), name: 'Home G', type: VaseType.WITHOUT_SHELL, weightKg: 22, costProduction: 10.00 },
  { id: getCanonicalVaseModelId('Home P', VaseType.WITHOUT_SHELL), name: 'Home P', type: VaseType.WITHOUT_SHELL, weightKg: 8, costProduction: 8.00 },
  { id: getCanonicalVaseModelId('Manoel M', VaseType.WITHOUT_SHELL), name: 'Manoel M', type: VaseType.WITHOUT_SHELL, weightKg: 14, costProduction: 5.00 },
  { id: getCanonicalVaseModelId('Roma', VaseType.WITHOUT_SHELL), name: 'Roma', type: VaseType.WITHOUT_SHELL, weightKg: 14, costProduction: 6.00 },
  { id: getCanonicalVaseModelId('Rubi', VaseType.WITHOUT_SHELL), name: 'Rubi', type: VaseType.WITHOUT_SHELL, weightKg: 14, costProduction: 8.00 },
  { id: getCanonicalVaseModelId('Colmeia G', VaseType.WITHOUT_SHELL), name: 'Colmeia G', type: VaseType.WITHOUT_SHELL, weightKg: 22, costProduction: 6.00 },
  { id: getCanonicalVaseModelId('Colmeia M', VaseType.WITHOUT_SHELL), name: 'Colmeia M', type: VaseType.WITHOUT_SHELL, weightKg: 14, costProduction: 4.00 },
  { id: getCanonicalVaseModelId('Bacia Diamante', VaseType.WITHOUT_SHELL), name: 'Bacia Diamante', type: VaseType.WITHOUT_SHELL, weightKg: 14, costProduction: 4.00 },
  { id: getCanonicalVaseModelId('Jardineira', VaseType.WITHOUT_SHELL), name: 'Jardineira', type: VaseType.WITHOUT_SHELL, weightKg: 14, costProduction: 8.00 },
  { id: getCanonicalVaseModelId('Romano', VaseType.WITHOUT_SHELL), name: 'Romano', type: VaseType.WITHOUT_SHELL, weightKg: 14, costProduction: 12.00 },
  { id: getCanonicalVaseModelId('Veneza', VaseType.WITHOUT_SHELL), name: 'Veneza', type: VaseType.WITHOUT_SHELL, weightKg: 22, costProduction: 15.00 },
  { id: getCanonicalVaseModelId('Bali', VaseType.WITHOUT_SHELL), name: 'Bali', type: VaseType.WITHOUT_SHELL, weightKg: 14, costProduction: 8.00 },
  { id: getCanonicalVaseModelId('Georgia', VaseType.WITHOUT_SHELL), name: 'Georgia', type: VaseType.WITHOUT_SHELL, weightKg: 14, costProduction: 8.00 },
  { id: getCanonicalVaseModelId('Veneza s/ borda', VaseType.WITHOUT_SHELL), name: 'Veneza s/ borda', type: VaseType.WITHOUT_SHELL, weightKg: 22, costProduction: 13.00 },
  { id: getCanonicalVaseModelId('Bacia Lisa P', VaseType.WITHOUT_SHELL), name: 'Bacia Lisa P', type: VaseType.WITHOUT_SHELL, weightKg: 8, costProduction: 4.00 },
  { id: getCanonicalVaseModelId('Bacia Vity', VaseType.WITHOUT_SHELL), name: 'Bacia Vity', type: VaseType.WITHOUT_SHELL, weightKg: 14, costProduction: 5.00 },
  { id: getCanonicalVaseModelId('Moscou', VaseType.WITHOUT_SHELL), name: 'Moscou', type: VaseType.WITHOUT_SHELL, weightKg: 14, costProduction: 10.00 },
  { id: getCanonicalVaseModelId('Pipoos G', VaseType.WITHOUT_SHELL), name: 'Pipoos G', type: VaseType.WITHOUT_SHELL, weightKg: 22, costProduction: 5.00 },
  { id: getCanonicalVaseModelId('Diamante G', VaseType.WITHOUT_SHELL), name: 'Diamante G', type: VaseType.WITHOUT_SHELL, weightKg: 22, costProduction: 6.00 },
  { id: getCanonicalVaseModelId('Granada', VaseType.WITHOUT_SHELL), name: 'Granada', type: VaseType.WITHOUT_SHELL, weightKg: 22, costProduction: 15.00 },
  { id: getCanonicalVaseModelId('Mônaco G', VaseType.WITHOUT_SHELL), name: 'Mônaco G', type: VaseType.WITHOUT_SHELL, weightKg: 22, costProduction: 8.00 },
  { id: getCanonicalVaseModelId('Mônaco M', VaseType.WITHOUT_SHELL), name: 'Mônaco M', type: VaseType.WITHOUT_SHELL, weightKg: 14, costProduction: 8.00 },
  { id: getCanonicalVaseModelId('Lótus', VaseType.WITHOUT_SHELL), name: 'Lótus', type: VaseType.WITHOUT_SHELL, weightKg: 14, costProduction: 5.00 },
  { id: getCanonicalVaseModelId('Ânfora 90cm', VaseType.WITHOUT_SHELL), name: 'Ânfora 90cm', type: VaseType.WITHOUT_SHELL, weightKg: 32, costProduction: 20.00 },
  { id: getCanonicalVaseModelId('Portugal', VaseType.WITHOUT_SHELL), name: 'Portugal', type: VaseType.WITHOUT_SHELL, weightKg: 14, costProduction: 15.00 },
  { id: getCanonicalVaseModelId('Áustria', VaseType.WITHOUT_SHELL), name: 'Áustria', type: VaseType.WITHOUT_SHELL, weightKg: 14, costProduction: 10.00 },
  { id: getCanonicalVaseModelId('Apogeu / Atlantis', VaseType.WITHOUT_SHELL), name: 'Apogeu / Atlantis', type: VaseType.WITHOUT_SHELL, weightKg: 22, costProduction: 15.00 },
  { id: getCanonicalVaseModelId('Zezo', VaseType.WITHOUT_SHELL), name: 'Zezo', type: VaseType.WITHOUT_SHELL, weightKg: 8, costProduction: 4.00 },
  { id: getCanonicalVaseModelId('Helena', VaseType.WITHOUT_SHELL), name: 'Helena', type: VaseType.WITHOUT_SHELL, weightKg: 14, costProduction: 16.00 },
  { id: getCanonicalVaseModelId('Heitor', VaseType.WITHOUT_SHELL), name: 'Heitor', type: VaseType.WITHOUT_SHELL, weightKg: 22, costProduction: 10.00 },
  { id: getCanonicalVaseModelId('Vitória G', VaseType.WITHOUT_SHELL), name: 'Vitória G', type: VaseType.WITHOUT_SHELL, weightKg: 22, costProduction: 6.00 },
  { id: getCanonicalVaseModelId('Vitória M', VaseType.WITHOUT_SHELL), name: 'Vitória M', type: VaseType.WITHOUT_SHELL, weightKg: 14, costProduction: 5.00 },
  { id: getCanonicalVaseModelId('Coluna Des. G', VaseType.WITHOUT_SHELL), name: 'Coluna Des. G', type: VaseType.WITHOUT_SHELL, weightKg: 22, costProduction: 10.00 },
  { id: getCanonicalVaseModelId('Coluna Des. P', VaseType.WITHOUT_SHELL), name: 'Coluna Des. P', type: VaseType.WITHOUT_SHELL, weightKg: 8, costProduction: 5.00 },
  { id: getCanonicalVaseModelId('Tacho', VaseType.WITHOUT_SHELL), name: 'Tacho', type: VaseType.WITHOUT_SHELL, weightKg: 14, costProduction: 5.00 },
  { id: getCanonicalVaseModelId('Mexicana', VaseType.WITHOUT_SHELL), name: 'Mexicana', type: VaseType.WITHOUT_SHELL, weightKg: 14, costProduction: 5.00 },
];
