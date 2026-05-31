
import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import { AppState, ItemStatus, Sector, VaseType, ProductionItem, ChangelogEntry, ChangeType, SystemLog, Goal, UserPreferences, Period, PaymentRecord } from './types';
import { INITIAL_EMPLOYEES, INITIAL_VASES, DEFAULT_SUPERVISOR_PASS } from './constants';
import { v4 as uuidv4 } from 'uuid';
import { calculatePaintingCommission, generateCIP, getYearDigit, getDayOfYear } from './utils/calculations';

// Initial Version Seed - Updated to 1.23.0
const INITIAL_VERSION = '1.23.0';

// Pre-populated history for fresh installs - FULL HISTORY KEPT
const INITIAL_CHANGELOG: ChangelogEntry[] = [
  {
    version: '1.23.0',
    date: Date.now(),
    type: 'FEATURE',
    description: 'Sincronização em tempo real (WebSockets) implementada. Necessário rodar o script SQL de migração atualizado no Supabase.'
  },
  {
    version: '1.22.0',
    date: Date.now(),
    type: 'FEATURE',
    description: 'Implementação da estrutura do Capacitor para empacotamento em app Android.'
  },
  {
    version: '1.21.0',
    date: Date.now(),
    type: 'FIX',
    description: 'Ajuste definitivo da configuração das variáveis do Supabase (URL e Chave) para conectar corretamente com o projeto.'
  },
  {
    version: '1.20.0',
    date: Date.now(),
    type: 'FEATURE',
    description: 'Ferramenta de diagnóstico de ambiente (.env + Supabase) no painel do supervisor.'
  },
  {
    version: '1.19.0',
    date: Date.now(),
    type: 'FEATURE',
    description: 'Implementação de verificação de variáveis Supabase no painel do supervisor.'
  },
  {
    version: '1.18.0',
    date: Date.now(),
    type: 'FEATURE',
    description: 'Integração inicial com Supabase configurada. Variáveis de ambiente adicionadas e cliente criado.'
  },
  {
    version: '1.17.0',
    date: Date.now(),
    type: 'FEATURE',
    description: 'Implementação de diagnóstico de conexão Supabase para o supervisor.'
  },
  {
    version: '1.16.0',
    date: Date.now(),
    type: 'FEATURE',
    description: 'Adicionado gerador de scripts SQL no painel do supervisor para auxiliar na atualização manual da estrutura do banco de dados Supabase.'
  },
  {
    version: '1.15.1',
    date: Date.now() - 86400000,
    type: 'FEATURE',
    description: 'Integração de base com Supabase: Conexão inicial com a nuvem configurada para permitir futura sincronização e login remoto.'
  },
  {
    version: '1.15.0',
    date: Date.now() - 172800000,
    type: 'MAJOR',
    description: 'Preparação do sistema para autenticação real e controle de acesso baseado em perfis (Colaborador/Supervisor), com associação automática de setor.'
  },
  {
    version: '1.14.1',
    date: Date.now() - 259200000,
    type: 'FIX',
    description: 'Correção de regressão no painel do supervisor: Restauração das abas de Configurações, Pagamentos, Modelos e Logs, mantendo os novos alertas de tempo de produção.'
  },
  {
    version: '1.14.0',
    date: Date.now() - 345600000,
    type: 'FEATURE',
    description: 'Implementado cálculo de tempo médio por setor e sistema de alertas para vasos parados, com visualização para colaboradores e supervisor.'
  },
  {
    version: '1.13.2',
    date: Date.now() - 432000000,
    type: 'IMPROVEMENT',
    description: 'Adicionados cards de status no estoque com contagem de vasos por setor (baseado em CIPs reais) e filtro rápido.'
  },
  {
    version: '1.13.1',
    date: Date.now() - 518400000,
    type: 'FIX',
    description: 'Correção da estrutura de estoque para modelo itemizado por CIP, restaurando controle físico real dos vasos e movendo o resumo por modelo para uma visão auxiliar.'
  },
  {
    version: '1.13.0',
    date: Date.now() - 604800000,
    type: 'MAJOR',
    description: 'Substituição do reset geral por sistema de períodos de produção, com preservação total de histórico e estoque.'
  },
  {
    version: '1.12.0',
    date: Date.now() - 691200000,
    type: 'FEATURE',
    description: 'Criação da aba Estoque no painel do supervisor, com rastreamento por CIP, status de produção e visão consolidada dos vasos.'
  },
  {
    version: '1.11.1',
    date: Date.now() - 777600000,
    type: 'FIX',
    description: 'Correção de bug no fluxo de vasos entre acabamento e pintura, garantindo transição correta, contabilidade precisa e manutenção do SIP/CIP original.'
  },
  {
    version: '1.11.0',
    date: Date.now() - 864000000,
    type: 'FEATURE',
    description: 'Exportação de dados atualizada para PDF, com relatórios específicos para colaboradores e supervisor, respeitando escopo por setor.'
  },
  {
    version: '1.10.1',
    date: Date.now() - 950400000,
    type: 'FIX',
    description: 'Refinamento na geração de CIP: Garantia de unicidade absoluta, cálculo baseado no último sequencial registrado (evitando duplicatas após exclusões) e bloqueio de regeneração em etapas posteriores.'
  },
  {
    version: '1.10.0',
    date: Date.now() - 1036800000,
    type: 'FEATURE',
    description: 'Implementado novo sistema oficial de identificação física de vasos (CIP) utilizando o padrão YDDDSS, permitindo rastreabilidade completa por data de fabricação e ordem de produção. O CIP passa a ser o identificador operacional padrão do sistema.'
  },
  {
    version: '1.9.0',
    date: Date.now() - 1123200000,
    type: 'FEATURE',
    description: 'Integração de relatórios analíticos e painel de desempenho individual no dashboard do supervisor, proporcionando uma visão completa e detalhada da produção e do desempenho.'
  },
  {
    version: '1.8.0',
    date: Date.now() - 1209600000,
    type: 'FEATURE',
    description: 'Adicionada a funcionalidade de ajuste do percentual de comissão de pintura no painel de configurações do supervisor, permitindo que o supervisor defina e atualize o percentual de comissão conforme necessário.'
  },
  {
    version: '1.7.1',
    date: Date.now() - 1296000000,
    type: 'FIX',
    description: 'Correção no cálculo de custo de matéria-prima: alterações no custo do traço agora recalculam automaticamente o custo de produção de todos os modelos de vasos.'
  },
  {
    version: '1.7.0',
    date: Date.now() - 1382400000,
    type: 'FEATURE',
    description: 'Adicionada tela de configurações do perfil do colaborador, com alternância de tema, visualização de dados do perfil, preferências de avisos e controle de exibição do dashboard.'
  },
  {
    version: '1.6.1',
    date: Date.now() - 1468800000,
    type: 'FIX',
    description: 'Ajuste de layout na tela de login: Correção de sobreposição entre o painel de avisos e o rodapé de versão.'
  },
  {
    version: '1.6.0',
    date: Date.now() - 1555200000,
    type: 'FEATURE',
    description: 'Implementação do sistema de metas produtivas com barra progressiva no painel dos colaboradores, tela dedicada de metas, gestão centralizada pelo supervisor e integração automática com produção por setor e por modelo de vaso.'
  },
  {
    version: '1.5.1',
    date: Date.now() - 1641600000,
    type: 'FIX',
    description: 'Correção de inconsistência no setor de pintura, garantindo sincronização entre produção, histórico, financeiro e implementação obrigatória de logs para todas as operações.'
  }
];

const DEFAULT_USER_PREFS: Omit<UserPreferences, 'userId'> = {
  darkMode: false,
  notifySystem: true,
  notifyGoals: true,
  notifyPayments: true,
  showFinancials: true,
  showProductionQty: true,
  showGoalsBar: true,
};

// Helper to get active period
const getActivePeriod = (periods: Period[]) => periods.find(p => p.status === 'ACTIVE');

export const useStore = create<AppState>()(
  persist(
    (set, get) => ({
      isDarkMode: false,
      supervisorPassword: DEFAULT_SUPERVISOR_PASS,
      currentUser: null,
      currentSector: null,
      
      // Versioning Defaults
      systemVersion: INITIAL_VERSION,
      changelog: INITIAL_CHANGELOG,
      
      rawMaterialCostPerKg: 0.26,
      paintingCommissionPercentage: 10, // Default 10%

      // Data
      periods: [],
      activePeriodId: null,

      employees: INITIAL_EMPLOYEES,
      vaseModels: INITIAL_VASES,
      productionItems: [],
      payments: [],
      drafts: [],
      systemLogs: [],
      goals: [],
      userPreferences: {},

      toggleTheme: () => set((state) => ({ isDarkMode: !state.isDarkMode })),
      
      setSector: (sector) => set({ currentSector: sector }),
      
      loginUser: (user) => {
        const state = get();
        const userPrefs = state.userPreferences[user.id];
        
        // MIGRATION: Ensure a period exists on login if none exists
        if (state.periods.length === 0) {
           const initialPeriodId = uuidv4();
           const now = new Date();
           const name = `${now.toLocaleString('default', { month: 'short' })}/${now.getFullYear()} (Inicial)`;
           set({
             periods: [{
               id: initialPeriodId,
               name: name,
               startDate: Date.now(),
               status: 'ACTIVE'
             }],
             activePeriodId: initialPeriodId
           });
        }

        const themeToApply = userPrefs ? userPrefs.darkMode : false;

        // Auto-assign sector based on user role/sector
        // If user is Supervisor, they might need to access Supervisor Dashboard, but 'currentSector' acts as view context
        let sectorToSet = user.sector as Sector;
        if (user.role === 'supervisor') {
            sectorToSet = Sector.SUPERVISOR;
        }

        set({ 
          currentUser: user,
          currentSector: sectorToSet,
          isDarkMode: themeToApply
        });
      },
      
      logout: () => set((state) => {
        if (state.currentUser) {
           const newLog: SystemLog = {
            id: uuidv4(),
            timestamp: Date.now(),
            action: 'LOGOUT',
            sector: state.currentUser.sector as Sector,
            actorId: state.currentUser.id,
            actorName: state.currentUser.name,
            details: 'Sessão encerrada pelo usuário.',
          };
          return { currentUser: null, currentSector: null, systemLogs: [newLog, ...state.systemLogs] };
        }
        return { currentUser: null, currentSector: null };
      }),

      // --- PERIOD ACTIONS ---
      closePeriod: (supervisorId) => set((state) => {
        const activePeriod = state.periods.find(p => p.status === 'ACTIVE');
        if (!activePeriod) return state;

        const now = Date.now();
        const newPeriodId = uuidv4();
        const dateObj = new Date();
        // Generate next month name logic or simple sequential
        const nextName = `${dateObj.toLocaleString('default', { month: 'short' })}/${dateObj.getFullYear()} - #${state.periods.length + 1}`;

        const updatedPeriods = state.periods.map(p => 
          p.id === activePeriod.id 
            ? { ...p, status: 'CLOSED' as const, endDate: now, closedBy: supervisorId }
            : p
        );

        const newPeriod: Period = {
          id: newPeriodId,
          name: nextName,
          startDate: now,
          status: 'ACTIVE'
        };

        const newLog: SystemLog = {
          id: uuidv4(),
          timestamp: now,
          action: 'PERIOD_CLOSE',
          sector: Sector.SUPERVISOR,
          actorId: supervisorId,
          actorName: 'Supervisor',
          details: `Período ${activePeriod.name} fechado. Início de: ${newPeriod.name}`
        };

        return {
          periods: [...updatedPeriods, newPeriod],
          activePeriodId: newPeriodId,
          systemLogs: [newLog, ...state.systemLogs]
        };
      }),

      // --- SETTINGS ACTIONS ---
      updateUserPreferences: (userId, newPrefs) => set((state) => {
        const currentPrefs = state.userPreferences[userId] || { userId, ...DEFAULT_USER_PREFS };
        const updatedPrefs = { ...currentPrefs, ...newPrefs };
        
        const newLog: SystemLog = {
          id: uuidv4(),
          timestamp: Date.now(),
          action: 'SETTINGS_UPDATE',
          sector: state.currentUser?.sector as Sector || Sector.PRODUCTION,
          actorId: userId,
          actorName: state.currentUser?.name || 'User',
          details: 'Alteração nas configurações do perfil.',
        };

        let newIsDarkMode = state.isDarkMode;
        if (newPrefs.darkMode !== undefined) {
           newIsDarkMode = newPrefs.darkMode;
        }

        return {
          userPreferences: {
            ...state.userPreferences,
            [userId]: updatedPrefs
          },
          isDarkMode: newIsDarkMode,
          systemLogs: [newLog, ...state.systemLogs]
        };
      }),

      addProductionItems: (items) => set((state) => {
        // Ensure active period ID is attached
        const activeId = state.activePeriodId || (state.periods.find(p => p.status === 'ACTIVE')?.id);

        const hydratedItems = items.map(item => {
          const model = state.vaseModels.find(v => v.id === item.modelId);
          return {
            ...item,
            periodId: activeId, // Bind to current period
            productionValue: model ? model.costProduction : 0,
            rawMaterialCost: model ? (model.weightKg * state.rawMaterialCostPerKg) : 0
          };
        });

        const currentUser = state.currentUser;
        const totalValue = hydratedItems.reduce((acc, i) => acc + i.productionValue, 0);
        
        const newLog: SystemLog = {
          id: uuidv4(),
          timestamp: Date.now(),
          action: 'PRODUCTION',
          sector: Sector.PRODUCTION,
          actorId: currentUser?.id || 'system',
          actorName: currentUser?.name || 'Sistema',
          targetId: hydratedItems[0]?.producedBy,
          details: `Registro de produção: ${hydratedItems.length} itens.`,
          value: totalValue
        };

        return { 
          productionItems: [...state.productionItems, ...hydratedItems],
          systemLogs: [newLog, ...state.systemLogs]
        };
      }),

      processStageItems: (itemIds, workerId, stage, timestamp) => set((state) => {
        let totalProcessedValue = 0;
        const activeId = state.activePeriodId || (state.periods.find(p => p.status === 'ACTIVE')?.id);

        const updatedItems = state.productionItems.map((item) => {
          if (itemIds.includes(item.id)) {
            const model = state.vaseModels.find(v => v.id === item.modelId);
            
            // STRICT FLOW CONTROL: FINISHING -> PAINTING
            if (stage === 'finishing') {
              if (item.status !== ItemStatus.AWAITING_FINISHING) {
                 return item;
              }

              const val = model?.costFinishing || 0;
              totalProcessedValue += val;
              
              return {
                ...item, 
                status: ItemStatus.AWAITING_PAINTING, 
                updatedAt: timestamp,
                finishedBy: workerId,
                finishedInPeriodId: activeId, // Track when it was finished
                finishingValue: val
              };
            }
            
            // STRICT FLOW CONTROL: PAINTING -> FINISHED
            if (stage === 'painting') {
               if (item.status !== ItemStatus.AWAITING_PAINTING) {
                  return item;
               }

               const salePrice = model?.priceSale || 0;
               const commission = calculatePaintingCommission(salePrice, state.paintingCommissionPercentage);
               
               totalProcessedValue += commission;
               
               return {
                ...item, 
                status: ItemStatus.FINISHED, 
                updatedAt: timestamp,
                paintedBy: workerId,
                paintedInPeriodId: activeId, // Track when it was painted
                paintingValue: commission
              };
            }
          }
          return item;
        });

        const currentUser = state.currentUser;
        const actionType = stage === 'finishing' ? 'FINISHING' : 'PAINTING';
        const sector = stage === 'finishing' ? Sector.FINISHING : Sector.PAINTING;
        
        const newLog: SystemLog = {
          id: uuidv4(),
          timestamp: Date.now(),
          action: actionType,
          sector: sector,
          actorId: currentUser?.id || 'system',
          actorName: currentUser?.name || 'Sistema',
          targetId: workerId,
          details: `Processamento de ${itemIds.length} itens no setor ${sector}.`,
          value: totalProcessedValue
        };

        return { 
          productionItems: updatedItems,
          systemLogs: [newLog, ...state.systemLogs]
        };
      }),

      // --- DRAFT ACTIONS ---
      addDraft: (draft) => set((state) => ({ drafts: [draft, ...state.drafts] })),
      
      removeDraft: (id) => set((state) => ({ drafts: state.drafts.filter(d => d.id !== id) })),
      
      confirmDraft: (draftId) => {
        const state = get();
        const draft = state.drafts.find(d => d.id === draftId);
        if (!draft) return;

        // Ensure active period exists before confirming
        let activeId = state.activePeriodId;
        if (!activeId && state.periods.length === 0) {
           // Fallback init if empty (should be handled in login, but safe guard)
           const pid = uuidv4();
           set({ periods: [{ id: pid, name: 'Inicial', startDate: Date.now(), status: 'ACTIVE' }], activePeriodId: pid });
           activeId = pid;
        }

        if (draft.type === 'PRODUCTION' && draft.productionData) {
          const newItems: ProductionItem[] = [];
          
          const draftDate = new Date(draft.selectedDate);
          const yearDigit = getYearDigit(draftDate);
          const dayOfYear = getDayOfYear(draftDate);
          const cipPrefix = `${yearDigit}${dayOfYear}`;
          
          const usedSequences = state.productionItems
            .filter(item => item.cip && item.cip.startsWith(cipPrefix))
            .map(item => parseInt(item.cip!.slice(5), 10))
            .filter(n => !isNaN(n));

          let nextSequence = usedSequences.length > 0 ? Math.max(...usedSequences) + 1 : 0;

          for (const { modelId, quantity } of draft.productionData) {
            const model = state.vaseModels.find(v => v.id === modelId);
            if (model) {
               for (let i = 0; i < quantity; i++) {
                
                if (nextSequence > 99) {
                   throw new Error("Limite diário de produção (100 vasos) atingido para esta data. Impossível gerar novo CIP.");
                }

                const cip = `${cipPrefix}${nextSequence.toString().padStart(2, '0')}`;
                
                if (state.productionItems.some(item => item.cip === cip)) {
                    throw new Error(`Erro de unicidade: O CIP ${cip} já existe no sistema.`);
                }

                nextSequence++;

                newItems.push({
                  id: uuidv4(),
                  cip: cip,
                  modelId: model.id,
                  modelName: model.name,
                  type: model.type,
                  status: model.type === VaseType.WITH_SHELL ? ItemStatus.AWAITING_FINISHING : ItemStatus.STOCK_NO_SHELL,
                  createdAt: draft.selectedDate,
                  updatedAt: draft.selectedDate,
                  producedBy: draft.userId,
                  periodId: activeId || undefined, // Bind to active period
                  productionValue: 0,
                  rawMaterialCost: 0
                });
               }
            }
          }
          
          if (newItems.length > 0) {
            get().addProductionItems(newItems);
          }
        } else if ((draft.type === 'FINISHING' || draft.type === 'PAINTING') && draft.processingIds) {
           const stage = draft.type === 'FINISHING' ? 'finishing' : 'painting';
           get().processStageItems(draft.processingIds, draft.userId, stage, draft.selectedDate);
        }

        get().removeDraft(draftId);
      },

      // --- GOALS ACTIONS ---
      addGoal: (goal) => set((state) => {
        const currentUser = state.currentUser;
        const activeId = state.activePeriodId || (state.periods.find(p => p.status === 'ACTIVE')?.id);

        const newLog: SystemLog = {
          id: uuidv4(),
          timestamp: Date.now(),
          action: 'GOAL_UPDATE',
          sector: Sector.SUPERVISOR,
          actorId: currentUser?.id || 'system',
          actorName: currentUser?.name || 'Supervisor',
          targetId: goal.employeeId,
          details: `Meta ${goal.period} definida.`,
        };

        return {
          goals: [...state.goals, { ...goal, periodId: activeId }], // Bind goal to period
          systemLogs: [newLog, ...state.systemLogs]
        };
      }),

      deleteGoal: (id) => set((state) => {
        const goal = state.goals.find(g => g.id === id);
        const currentUser = state.currentUser;
        
        const newLog: SystemLog = {
          id: uuidv4(),
          timestamp: Date.now(),
          action: 'GOAL_UPDATE',
          sector: Sector.SUPERVISOR,
          actorId: currentUser?.id || 'system',
          actorName: currentUser?.name || 'Supervisor',
          targetId: goal?.employeeId,
          details: `Meta removida.`,
        };

        return {
          goals: state.goals.filter(g => g.id !== id),
          systemLogs: [newLog, ...state.systemLogs]
        };
      }),

      // --- SUPERVISOR ACTIONS ---
      updateSupervisorPassword: (pass) => set({ supervisorPassword: pass }),
      
      updateRawMaterialCostPerKg: (value) => set((state) => {
        const prev = state.rawMaterialCostPerKg;
        const currentUser = state.currentUser;
        
        const newLog: SystemLog = {
          id: uuidv4(),
          timestamp: Date.now(),
          action: 'ADMIN_UPDATE',
          sector: Sector.SUPERVISOR,
          actorId: currentUser?.id || 'system',
          actorName: currentUser?.name || 'Supervisor',
          details: `Custo do traço alterado de R$ ${prev.toFixed(2)} para R$ ${value.toFixed(2)}`,
        };

        return { 
           rawMaterialCostPerKg: value,
           systemLogs: [newLog, ...state.systemLogs]
        };
      }),

      updatePaintingCommissionPercentage: (value) => set((state) => {
        const prev = state.paintingCommissionPercentage;
        const currentUser = state.currentUser;

        const newLog: SystemLog = {
          id: uuidv4(),
          timestamp: Date.now(),
          action: 'ADMIN_UPDATE',
          sector: Sector.SUPERVISOR,
          actorId: currentUser?.id || 'system',
          actorName: currentUser?.name || 'Supervisor',
          details: `Comissão de pintura alterada de ${prev}% para ${value}%`,
        };

        return {
          paintingCommissionPercentage: value,
          systemLogs: [newLog, ...state.systemLogs]
        };
      }),

      addVaseModel: (model) => set((state) => ({ vaseModels: [...state.vaseModels, model] })),
      updateVaseModel: (model) => set((state) => ({
        vaseModels: state.vaseModels.map((v) => (v.id === model.id ? model : v))
      })),
      deleteVaseModel: (id) => set((state) => ({
        vaseModels: state.vaseModels.filter((v) => v.id !== id)
      })),
      addEmployee: (emp) => set((state) => ({ employees: [...state.employees, emp] })),
      updateEmployee: (emp) => set((state) => ({
        employees: state.employees.map((e) => (e.id === emp.id ? emp : e))
      })),
      addPayment: (payment) => set((state) => {
        const currentUser = state.currentUser;
        const activeId = state.activePeriodId || (state.periods.find(p => p.status === 'ACTIVE')?.id);

        const newLog: SystemLog = {
          id: uuidv4(),
          timestamp: Date.now(),
          action: 'PAYMENT',
          sector: Sector.SUPERVISOR,
          actorId: currentUser?.id || 'system',
          actorName: currentUser?.name || 'Supervisor',
          targetId: payment.employeeId,
          details: `Pagamento registrado para ${payment.employeeName}. Obs: ${payment.observation || '-'}`,
          value: payment.amount
        };

        return { 
          payments: [ { ...payment, periodId: activeId }, ...state.payments],
          systemLogs: [newLog, ...state.systemLogs]
        };
      }),

      // Deprecated in favor of Period System, but logic kept to clear local state if needed manually (dev)
      resetData: () => set({
        productionItems: [],
        payments: [],
        employees: INITIAL_EMPLOYEES,
        vaseModels: INITIAL_VASES,
        supervisorPassword: DEFAULT_SUPERVISOR_PASS,
        rawMaterialCostPerKg: 0.26,
        paintingCommissionPercentage: 10,
        drafts: [],
        systemLogs: [],
        goals: [],
        userPreferences: {},
        periods: [],
        activePeriodId: null,
        systemVersion: INITIAL_VERSION,
        changelog: INITIAL_CHANGELOG
      }),

      // --- VERSION CONTROL ACTIONS ---
      registerSystemUpdate: (type: ChangeType, description: string) => set((state) => {
        const parts = state.systemVersion.split('.').map(Number);
        if (parts.length !== 3) return state;

        let [major, minor, patch] = parts;

        switch (type) {
          case 'MAJOR': major++; minor = 0; patch = 0; break;
          case 'FEATURE': minor++; patch = 0; break;
          case 'IMPROVEMENT': case 'FIX': patch++; break;
        }

        const newVersion = `${major}.${minor}.${patch}`;

        const newEntry: ChangelogEntry = {
          version: newVersion,
          date: Date.now(),
          type,
          description
        };

        if (state.changelog.length > 0 && state.changelog[0].description === description) {
           return state;
        }

        return {
          systemVersion: newVersion,
          changelog: [newEntry, ...state.changelog]
        };
      })
    }),
    {
      name: 'home-pots-storage',
      storage: createJSONStorage(() => localStorage),
    }
  )
);
