
export enum Sector {
  PRODUCTION = 'Produção',
  FINISHING = 'Acabamento',
  PAINTING = 'Pintura',
  SUPERVISOR = 'Supervisor',
}

export enum VaseType {
  WITH_SHELL = 'Com Casca',
  WITHOUT_SHELL = 'Sem Casca',
}

export enum ItemStatus {
  DRAFT = 'Rascunho', // Local UI state mostly, but good to have
  PRODUCED = 'Produzido',
  STOCK_NO_SHELL = 'Estoque (Sem Casca)',
  AWAITING_FINISHING = 'Aguardando Acabamento',
  AWAITING_PAINTING = 'Aguardando Pintura',
  FINISHED = 'Finalizado',
}

export interface VaseModel {
  id: string;
  name: string;
  type: VaseType;
  weightKg: number; // New field for raw material calculation
  costProduction: number; // Labor cost for molding
  costFinishing?: number; // Only With Shell
  priceSale?: number; // Only With Shell
  // Commission is calculated dynamically (10% of sale price)
}

export type UserRole = 'colaborador' | 'supervisor';

export interface Employee {
  id: string;
  name: string;
  sector: Sector | 'General';
  role: UserRole; // Security Role
  active: boolean;
  joinedAt?: number; // Optional: When they were added
}

export interface PaymentRecord {
  id: string;
  employeeId: string;
  employeeName: string;
  sector: Sector | 'General';
  amount: number;
  date: number; // Timestamp
  observation?: string;
  periodId?: string; // Links payment to a specific accounting period
}

// --- PERIOD SYSTEM ---
export interface Period {
  id: string;
  name: string; // e.g., "Fev/2024" or "Ciclo 15"
  startDate: number;
  endDate?: number; // Null if active
  status: 'ACTIVE' | 'CLOSED';
  closedBy?: string; // Supervisor ID
}

export interface ProductionItem {
  id: string;
  cip?: string; // Código de Identificação de Produção (YDDDSS)
  modelId: string;
  modelName: string; // Denormalized for easier display if model is deleted
  type: VaseType;
  status: ItemStatus;
  createdAt: number; // Timestamp
  updatedAt: number; // Timestamp
  
  // Worker Tracking
  producedBy: string; // Employee ID
  finishedBy?: string; // Employee ID
  paintedBy?: string; // Employee ID

  // Period Tracking (For financial separation)
  periodId?: string; // Period when it was PRODUCED (Created)
  finishedInPeriodId?: string; // Period when it was FINISHED
  paintedInPeriodId?: string; // Period when it was PAINTED

  // Value Tracking (Frozen at moment of execution)
  productionValue: number; // How much the producer earned (Labor)
  rawMaterialCost: number; // Cost of raw material (weight * rate) at time of production
  finishingValue?: number; // How much the finisher earned
  paintingValue?: number;  // How much the painter earned
}

// --- USER PREFERENCES (NEW) ---
export interface UserPreferences {
  userId: string;
  darkMode: boolean;
  
  // Notification Toggles (UI Only for now)
  notifySystem: boolean;
  notifyGoals: boolean;
  notifyPayments: boolean;

  // Dashboard Visibility
  showFinancials: boolean;
  showProductionQty: boolean;
  showGoalsBar: boolean;
}

// --- LOGGING & AUDIT SYSTEM ---
export type AuditAction = 'PRODUCTION' | 'FINISHING' | 'PAINTING' | 'PAYMENT' | 'ADMIN_UPDATE' | 'GOAL_UPDATE' | 'SETTINGS_UPDATE' | 'LOGOUT' | 'PERIOD_CLOSE';

export interface SystemLog {
  id: string;
  timestamp: number;
  action: AuditAction;
  sector: Sector | 'System';
  actorId: string; // ID of the user performing the action
  actorName: string;
  targetId?: string; // ID of the employee affected (e.g. receiving payment)
  details: string; // Human readable summary
  value?: number; // Financial value involved
}

// --- DRAFT SYSTEM TYPES ---
export type DraftType = 'PRODUCTION' | 'FINISHING' | 'PAINTING';

export interface DraftItemContent {
  modelId: string;
  quantity: number;
}

export interface Draft {
  id: string;
  type: DraftType;
  sector: Sector;
  userId: string;
  selectedDate: number; // The date selected by the user
  createdAt: number; // System timestamp
  
  // Data payload depends on type
  // Production: list of models and quantities
  productionData?: DraftItemContent[]; 
  
  // Processing: list of existing ProductionItem IDs
  processingIds?: string[]; 
}

// --- GOALS SYSTEM TYPES ---
export type GoalPeriod = 'DAILY' | 'WEEKLY' | 'MONTHLY';

export interface GoalModelTarget {
  modelId: string;
  targetQuantity: number;
}

export interface Goal {
  id: string;
  employeeId: string;
  sector: Sector;
  period: GoalPeriod;
  startDate: number; // Timestamp start of validity
  endDate: number;   // Timestamp end of validity
  
  totalQuantityTarget: number; // General quantity target
  modelTargets?: GoalModelTarget[]; // Specific targets
  
  createdAt: number;
  createdBy: string; // Supervisor ID
  periodId?: string; // Links goal to specific system period
}

// --- VERSION CONTROL TYPES ---
export type ChangeType = 'FIX' | 'FEATURE' | 'IMPROVEMENT' | 'MAJOR';

export interface ChangelogEntry {
  version: string;
  date: number; // Timestamp
  type: ChangeType;
  description: string;
}

export interface AppState {
  isDarkMode: boolean;
  supervisorPassword: string; // In real app, hash this.
  currentUser: Employee | null;
  currentSector: Sector | null;
  
  // System Versioning
  systemVersion: string;
  changelog: ChangelogEntry[];
  
  // Configs
  rawMaterialCostPerKg: number; // Default 0.26
  paintingCommissionPercentage: number; // Default 10 (represents 10%)

  // Data
  periods: Period[]; // History of periods
  activePeriodId: string | null; // Currently active period

  employees: Employee[];
  vaseModels: VaseModel[];
  productionItems: ProductionItem[];
  payments: PaymentRecord[];
  drafts: Draft[]; 
  systemLogs: SystemLog[];
  goals: Goal[];
  userPreferences: Record<string, UserPreferences>; // Map userId -> Prefs

  // Actions
  toggleTheme: () => void; // Global toggle (deprecated for user action, used for supervisor)
  setSector: (sector: Sector | null) => void;
  loginUser: (user: Employee) => void;
  logout: () => void;
  
  // Core Actions
  addProductionItems: (items: ProductionItem[]) => void;
  processStageItems: (itemIds: string[], workerId: string, stage: 'finishing' | 'painting', timestamp: number) => void;
  
  // Period Actions
  closePeriod: (supervisorId: string) => void;

  // Draft Actions
  addDraft: (draft: Draft) => void;
  removeDraft: (id: string) => void;
  confirmDraft: (draftId: string) => void;

  // Goal Actions
  addGoal: (goal: Goal) => void;
  deleteGoal: (id: string) => void;

  // Settings Actions
  updateUserPreferences: (userId: string, prefs: Partial<UserPreferences>) => void;

  // Supervisor Actions
  updateSupervisorPassword: (pass: string) => void;
  updateRawMaterialCostPerKg: (value: number) => void;
  updatePaintingCommissionPercentage: (value: number) => void;
  addVaseModel: (model: VaseModel) => void;
  updateVaseModel: (model: VaseModel) => void;
  deleteVaseModel: (id: string) => void;
  addEmployee: (emp: Employee) => void;
  updateEmployee: (emp: Employee) => void;
  addPayment: (payment: PaymentRecord) => void;
  resetData: () => void; // Deprecated but kept for type compatibility

  // Version Control Actions
  registerSystemUpdate: (type: ChangeType, description: string) => void;
}
