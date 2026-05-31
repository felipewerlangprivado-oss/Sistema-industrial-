import { supabase } from './supabaseClient';
import { useStore } from '../store';
import { ProductionItem, Employee, VaseModel, PaymentRecord, Period, Goal, SystemLog, UserPreferences } from '../types';

let isSyncing = false;
let lastSyncTimestamp = 0;
let hasSetupFailed = false;

// Helper to determine if a value is defined
const isDefined = (val: any) => val !== undefined && val !== null;

// Unique merge logic for ProductionItems (CRDT-style merge by ID, keeping the latest updatedAt)
function mergeProductionItems(local: ProductionItem[], remote: ProductionItem[]): ProductionItem[] {
  const map = new Map<string, ProductionItem>();
  
  // Load remote items first
  remote.forEach(item => {
    map.set(item.id, item);
  });

  // Merge local items, keeping the one with higher updatedAt
  local.forEach(item => {
    const existing = map.get(item.id);
    if (!existing) {
      map.set(item.id, item);
    } else {
      const existingTime = existing.updatedAt || existing.createdAt || 0;
      const localTime = item.updatedAt || item.createdAt || 0;
      if (localTime > existingTime) {
        map.set(item.id, item);
      }
    }
  });

  return Array.from(map.values());
}

// Merge list by ID simply (union-based, no updatedAt, but unique by ID)
function mergeListById<T extends { id: string }>(local: T[], remote: T[]): T[] {
  const map = new Map<string, T>();
  remote.forEach(item => map.set(item.id, item));
  local.forEach(item => {
    // If it exists locally, we keep local (highly likely local has the latest edits if local is active)
    if (!map.has(item.id)) {
      map.set(item.id, item);
    }
  });
  return Array.from(map.values());
}

export interface SyncStatus {
  status: 'IDLE' | 'SYNCING' | 'SUCCESS' | 'ERROR' | 'TABLE_MISSING';
  lastSynced: Date | null;
  errorMessage?: string;
}

// Callback listeners for UI status updates
const statusListeners = new Set<(status: SyncStatus) => void>();

export function subscribeToSyncStatus(listener: (status: SyncStatus) => void) {
  statusListeners.add(listener);
  // Initial fire
  listener(getSyncStatusState());
  return () => {
    statusListeners.delete(listener);
  };
}

let currentStatus: SyncStatus['status'] = 'IDLE';
let syncErrorMessage: string | undefined = undefined;
let realtimeChannel: ReturnType<typeof supabase.channel> | null = null;

function getSyncStatusState(): SyncStatus {
  return {
    status: currentStatus,
    lastSynced: lastSyncTimestamp ? new Date(lastSyncTimestamp) : null,
    errorMessage: syncErrorMessage,
  };
}

function updateSyncStatus(status: SyncStatus['status'], errorMsg?: string) {
  currentStatus = status;
  syncErrorMessage = errorMsg;
  const state = getSyncStatusState();
  statusListeners.forEach(listener => listener(state));
}

/**
 * Performs a bi-directional pull and push synchronization with Supabase.
 * It fetches the current remote database state, merges it with local state,
 * updates the local Zustand store, and uploads any updated records to Supabase.
 */
export async function syncData(): Promise<boolean> {
  if (isSyncing) return false;
  isSyncing = true;
  updateSyncStatus('SYNCING');

  try {
    const store = useStore.getState();
    const envUrl = import.meta.env.VITE_SUPABASE_URL || '';
    const envKey = import.meta.env.VITE_SUPABASE_ANON_KEY || '';

    if (!envUrl || !envKey) {
      isSyncing = false;
      updateSyncStatus('ERROR', 'Supabase não configurado no arquivo de ambiente (.env).');
      return false;
    }

    // 1. Fetch remote data from homepots_sync table
    const { data: remoteRows, error: fetchError } = await supabase
      .from('homepots_sync')
      .select('*');

    if (fetchError) {
      // Check if table is missing (Postgres error code 42P01)
      if (fetchError.code === '42P01') {
        hasSetupFailed = true;
        isSyncing = false;
        updateSyncStatus('TABLE_MISSING', 'A tabela "homepots_sync" não existe no Supabase. Crie-a usando o script SQL.');
        return false;
      }
      throw fetchError;
    }

    hasSetupFailed = false;

    // Convert rows to key-value map
    const remoteData = new Map<string, any>();
    remoteRows?.forEach(row => {
      remoteData.set(row.key, row.value);
    });

    // 2. Extract local Zustand state
    const localPeriods = store.periods || [];
    const localEmployees = store.employees || [];
    const localVaseModels = store.vaseModels || [];
    const localProductionItems = store.productionItems || [];
    const localPayments = store.payments || [];
    const localDrafts = store.drafts || [];
    const localSystemLogs = store.systemLogs || [];
    const localGoals = store.goals || [];
    const localUserPreferences = store.userPreferences || {};
    
    const localConfigs = {
      rawMaterialCostPerKg: store.rawMaterialCostPerKg,
      paintingCommissionPercentage: store.paintingCommissionPercentage,
      supervisorPassword: store.supervisorPassword,
    };

    // 3. Extract remote state
    const remotePeriods = remoteData.get('periods') || [];
    const remoteEmployees = remoteData.get('employees') || [];
    const remoteVaseModels = remoteData.get('vaseModels') || [];
    const remoteProductionItems = remoteData.get('productionItems') || [];
    const remotePayments = remoteData.get('payments') || [];
    const remoteDrafts = remoteData.get('drafts') || [];
    const remoteSystemLogs = remoteData.get('systemLogs') || [];
    const remoteGoals = remoteData.get('goals') || [];
    const remoteUserPreferences = remoteData.get('userPreferences') || {};
    const remoteConfigs = remoteData.get('configs') || null;

    // 4. Merge lists bidirectionally
    const mergedPeriods = mergeListById(localPeriods, remotePeriods);
    const mergedEmployees = mergeListById(localEmployees, remoteEmployees);
    const mergedVaseModels = mergeListById(localVaseModels, remoteVaseModels);
    const mergedProductionItems = mergeProductionItems(localProductionItems, remoteProductionItems);
    const mergedPayments = mergeListById(localPayments, remotePayments);
    const mergedDrafts = localDrafts; // Keep drafts local-only
    const mergedSystemLogs = mergeListById(localSystemLogs, remoteSystemLogs);
    const mergedGoals = mergeListById(localGoals, remoteGoals);

    // Merge User Preferences Maps
    const mergedUserPreferences = { ...remoteUserPreferences, ...localUserPreferences };

    // Merge Configs (refer to latest if remote has configs, or keep local)
    const mergedConfigs = remoteConfigs ? { ...localConfigs, ...remoteConfigs } : localConfigs;

    // 5. Update local store state silently (blocking subscription loops during update)
    useStore.setState({
      periods: mergedPeriods,
      employees: mergedEmployees,
      vaseModels: mergedVaseModels,
      productionItems: mergedProductionItems,
      payments: mergedPayments,
      drafts: mergedDrafts,
      systemLogs: mergedSystemLogs,
      goals: mergedGoals,
      userPreferences: mergedUserPreferences,
      rawMaterialCostPerKg: mergedConfigs.rawMaterialCostPerKg,
      paintingCommissionPercentage: mergedConfigs.paintingCommissionPercentage,
      supervisorPassword: mergedConfigs.supervisorPassword,
      activePeriodId: store.activePeriodId || (mergedPeriods.find(p => p.status === 'ACTIVE')?.id || null)
    });

    // 6. Push merged state back to Supabase to keep remote 100% updated
    // We upload only the keys whose content is non-empty or updated
    const uploadPayload = [
      { key: 'periods', value: mergedPeriods },
      { key: 'employees', value: mergedEmployees },
      { key: 'vaseModels', value: mergedVaseModels },
      { key: 'productionItems', value: mergedProductionItems },
      { key: 'payments', value: mergedPayments },
      { key: 'drafts', value: mergedDrafts },
      { key: 'systemLogs', value: mergedSystemLogs },
      { key: 'goals', value: mergedGoals },
      { key: 'userPreferences', value: mergedUserPreferences },
      { key: 'configs', value: mergedConfigs }
    ];

    const { error: upsertError } = await supabase
      .from('homepots_sync')
      .upsert(uploadPayload, { onConflict: 'key' });

    if (upsertError) {
      throw upsertError;
    }

    lastSyncTimestamp = Date.now();
    updateSyncStatus('SUCCESS');
    isSyncing = false;
    return true;

  } catch (error: any) {
    console.error('Erro na sincronização de dados:', error);
    updateSyncStatus('ERROR', error.message || 'Erro deconhecido ao sincronizar.');
    isSyncing = false;
    return false;
  }
}

// Background auto sync timer
let syncIntervalId: any = null;

export function startAutoSync(intervalMs = 15000) {
  if (syncIntervalId) {
    clearInterval(syncIntervalId);
  }
  
  if (realtimeChannel) {
    supabase.removeChannel(realtimeChannel);
  }
  
  // Run initial sync
  syncData().then((success) => {
    if (success && !hasSetupFailed) {
      // Setup Realtime Connection for instant updates
      realtimeChannel = supabase.channel('table-db-changes')
        .on(
          'postgres_changes',
          {
            event: '*',
            schema: 'public',
            table: 'homepots_sync'
          },
          (payload) => {
            // Trigger a sync when remote data changes
            console.log('Realtime change detected, syncing...', payload);
            syncData();
          }
        )
        .subscribe();
    }
  });

  // Set periodic sync as a fallback/safety measure
  syncIntervalId = setInterval(() => {
    syncData();
  }, intervalMs);
}

export function stopAutoSync() {
  if (syncIntervalId) {
    clearInterval(syncIntervalId);
    syncIntervalId = null;
  }
  if (realtimeChannel) {
    supabase.removeChannel(realtimeChannel);
    realtimeChannel = null;
  }
}

// Hook state listener update trigger
export function setupStoreListener() {
  // Subscribe to local Zustand changes to trigger quick background sync updates
  useStore.subscribe((state, prevState) => {
    // Avoid re-triggering sync if the store was updated by the sync process itself
    if (isSyncing || hasSetupFailed) return;

    // Detect if meaningful state arrays changed
    const periodsChanged = state.periods !== prevState.periods;
    const employeesChanged = state.employees !== prevState.employees;
    const vaseModelsChanged = state.vaseModels !== prevState.vaseModels;
    const itemsChanged = state.productionItems !== prevState.productionItems;
    const paymentsChanged = state.payments !== prevState.payments;
    const draftsChanged = state.drafts !== prevState.drafts;
    const goalsChanged = state.goals !== prevState.goals;
    const logsChanged = state.systemLogs !== prevState.systemLogs;
    const prefsChanged = state.userPreferences !== prevState.userPreferences;
    const ratesChanged = 
      state.rawMaterialCostPerKg !== prevState.rawMaterialCostPerKg || 
      state.paintingCommissionPercentage !== prevState.paintingCommissionPercentage ||
      state.supervisorPassword !== prevState.supervisorPassword;

    if (
      periodsChanged || 
      employeesChanged || 
      vaseModelsChanged || 
      itemsChanged || 
      paymentsChanged || 
      draftsChanged || 
      goalsChanged || 
      logsChanged ||
      prefsChanged ||
      ratesChanged
    ) {
      // Run quick deferred sync to batch edits
      setTimeout(() => {
        syncData();
      }, 500);
    }
  });
}
