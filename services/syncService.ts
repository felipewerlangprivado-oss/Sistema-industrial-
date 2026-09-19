/**
 * Home Pots Manager - Serviço de Sincronização Nativa (Google Firebase Firestore)
 * 
 * Sincronização bidirecional em tempo real para o ecossistema fabril.
 * Inclui criptografia ponta a ponta (AES-256-GCM) para dados confidenciais (pagamentos, finanças e colaboradores).
 */

import { 
  collection, 
  doc, 
  getDocs, 
  writeBatch, 
  onSnapshot, 
  Unsubscribe 
} from 'firebase/firestore';
import { db } from './firebaseClient';
import { useStore } from '../store';
import { ProductionItem, Employee, VaseModel, PaymentRecord, Period, Goal, SystemLog, UserPreferences } from '../types';
import { 
  encryptPayload, 
  decryptPayload, 
  isEncryptedPayload, 
  SENSITIVE_PARTITION_KEYS 
} from './cryptoService';

let isSyncing = false;
let lastSyncTimestamp = 0;
let unsubscribeRealtime: Unsubscribe | null = null;
let syncIntervalId: any = null;
let onlineOfflineListenersInitialized = false;

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
    if (!map.has(item.id)) {
      map.set(item.id, item);
    }
  });
  return Array.from(map.values());
}

export interface SyncStatus {
  status: 'IDLE' | 'SYNCING' | 'SUCCESS' | 'ERROR' | 'OFFLINE';
  lastSynced: Date | null;
  errorMessage?: string;
  isEncrypted: boolean;
}

// Callback listeners for UI status updates
const statusListeners = new Set<(status: SyncStatus) => void>();

export function subscribeToSyncStatus(listener: (status: SyncStatus) => void) {
  statusListeners.add(listener);
  listener(getSyncStatusState());
  return () => {
    statusListeners.delete(listener);
  };
}

let currentStatus: SyncStatus['status'] = 'IDLE';
let syncErrorMessage: string | undefined = undefined;

function getSyncStatusState(): SyncStatus {
  return {
    status: currentStatus,
    lastSynced: lastSyncTimestamp ? new Date(lastSyncTimestamp) : null,
    errorMessage: syncErrorMessage,
    isEncrypted: true
  };
}

function updateSyncStatus(status: SyncStatus['status'], errorMsg?: string) {
  currentStatus = status;
  syncErrorMessage = errorMsg;
  const state = getSyncStatusState();
  statusListeners.forEach(listener => listener(state));
}

/**
 * Executa sincronização bidirecional completa com o Firebase Firestore nativo.
 * Partições confidenciais (pagamentos, colaboradores, taxas) são criptografadas com AES-256-GCM.
 */
export async function syncData(): Promise<boolean> {
  if (isSyncing) return false;

  // Se o dispositivo estiver estritamente sem internet
  if (typeof navigator !== 'undefined' && !navigator.onLine) {
    updateSyncStatus('OFFLINE', 'Dispositivo offline. Todos os dados estão salvos com segurança localmente.');
    return false;
  }

  isSyncing = true;
  updateSyncStatus('SYNCING');

  try {
    const syncCol = collection(db, 'homepots_sync');

    // 1. Busca dados da coleção no Firestore
    const snapshot = await getDocs(syncCol);
    const remoteData = new Map<string, any>();

    for (const docSnap of snapshot.docs) {
      const data = docSnap.data();
      const rawValue = data.value;
      const isEncrypted = data.encrypted || isEncryptedPayload(rawValue);

      if (isEncrypted) {
        try {
          const decrypted = await decryptPayload(rawValue);
          remoteData.set(docSnap.id, decrypted);
        } catch (decryptErr) {
          console.warn(`[Sync] Não foi possível decriptografar partição ${docSnap.id}:`, decryptErr);
          remoteData.set(docSnap.id, rawValue);
        }
      } else {
        remoteData.set(docSnap.id, rawValue);
      }
    }

    // 2. Estado Zustand local atual
    const latestStore = useStore.getState();

    const remotePeriods = remoteData.get('periods') as Period[] | undefined;
    const remoteEmployees = remoteData.get('employees') as Employee[] | undefined;
    const remoteVases = remoteData.get('vaseModels') as VaseModel[] | undefined;
    const remoteItems = remoteData.get('productionItems') as ProductionItem[] | undefined;
    const remotePayments = remoteData.get('payments') as PaymentRecord[] | undefined;
    const remoteDrafts = remoteData.get('drafts') as any[] | undefined;
    const remoteLogs = remoteData.get('systemLogs') as SystemLog[] | undefined;
    const remoteGoals = remoteData.get('goals') as Goal[] | undefined;
    const remotePrefs = remoteData.get('userPreferences') as Record<string, UserPreferences> | undefined;
    const remoteConfigs = remoteData.get('configs') as any | undefined;

    // 3. Mescla inteligente de dados (CRDT)
    const mergedPeriods = isDefined(remotePeriods) ? mergeListById(latestStore.periods, remotePeriods) : latestStore.periods;
    const mergedEmployees = isDefined(remoteEmployees) ? mergeListById(latestStore.employees, remoteEmployees) : latestStore.employees;
    const mergedVaseModels = isDefined(remoteVases) ? mergeListById(latestStore.vaseModels, remoteVases) : latestStore.vaseModels;
    const mergedProductionItems = isDefined(remoteItems) ? mergeProductionItems(latestStore.productionItems, remoteItems) : latestStore.productionItems;
    const mergedPayments = isDefined(remotePayments) ? mergeListById(latestStore.payments, remotePayments) : latestStore.payments;
    const mergedDrafts = isDefined(remoteDrafts) ? mergeListById(latestStore.drafts, remoteDrafts) : latestStore.drafts;
    const mergedGoals = isDefined(remoteGoals) ? mergeListById(latestStore.goals, remoteGoals) : latestStore.goals;

    const mergedLogs = isDefined(remoteLogs) 
      ? Array.from(new Map([...remoteLogs, ...latestStore.systemLogs].map(l => [l.id, l])).values())
          .sort((a, b) => b.timestamp - a.timestamp)
      : latestStore.systemLogs;

    const mergedUserPreferences = {
      ...(latestStore.userPreferences || {}),
      ...(remotePrefs || {})
    };

    const localConfigs = {
      rawMaterialCostPerKg: latestStore.rawMaterialCostPerKg,
      paintingCommissionPercentage: latestStore.paintingCommissionPercentage,
      supervisorPassword: latestStore.supervisorPassword
    };

    const mergedConfigs = remoteConfigs ? { ...localConfigs, ...remoteConfigs } : localConfigs;

    // 4. Atualiza a store local Zustand
    useStore.setState({
      periods: mergedPeriods,
      employees: mergedEmployees,
      vaseModels: mergedVaseModels,
      productionItems: mergedProductionItems,
      payments: mergedPayments,
      drafts: mergedDrafts,
      systemLogs: mergedLogs,
      goals: mergedGoals,
      userPreferences: mergedUserPreferences,
      rawMaterialCostPerKg: mergedConfigs.rawMaterialCostPerKg ?? latestStore.rawMaterialCostPerKg,
      paintingCommissionPercentage: mergedConfigs.paintingCommissionPercentage ?? latestStore.paintingCommissionPercentage,
      supervisorPassword: mergedConfigs.supervisorPassword ?? latestStore.supervisorPassword
    });

    // 5. Prepara envio protegido para o Firestore
    const partitions: { key: string; value: any }[] = [
      { key: 'periods', value: mergedPeriods },
      { key: 'employees', value: mergedEmployees },
      { key: 'vaseModels', value: mergedVaseModels },
      { key: 'productionItems', value: mergedProductionItems },
      { key: 'payments', value: mergedPayments },
      { key: 'drafts', value: mergedDrafts },
      { key: 'systemLogs', value: mergedLogs },
      { key: 'goals', value: mergedGoals },
      { key: 'userPreferences', value: mergedUserPreferences },
      { key: 'configs', value: mergedConfigs }
    ];

    const batch = writeBatch(db);
    const now = Date.now();

    for (const partition of partitions) {
      const isSensitive = SENSITIVE_PARTITION_KEYS.includes(partition.key);
      let payloadValue = partition.value;
      let isEncrypted = false;

      // Criptografia AES-256-GCM para dados sensíveis
      if (isSensitive) {
        payloadValue = await encryptPayload(partition.value);
        isEncrypted = true;
      }

      const docRef = doc(db, 'homepots_sync', partition.key);
      batch.set(docRef, {
        key: partition.key,
        value: payloadValue,
        updatedAt: now,
        encrypted: isEncrypted
      }, { merge: true });
    }

    await batch.commit();

    lastSyncTimestamp = Date.now();
    updateSyncStatus('SUCCESS');
    isSyncing = false;
    return true;

  } catch (error: any) {
    const errorMsg = error?.message || String(error);
    const isNetworkError = 
      error?.name === 'TypeError' || 
      errorMsg.includes('Failed to fetch') || 
      errorMsg.includes('unavailable') || 
      errorMsg.includes('NetworkError') || 
      errorMsg.includes('network') ||
      errorMsg.includes('offline') ||
      (typeof navigator !== 'undefined' && !navigator.onLine);

    if (isNetworkError) {
      console.warn('[HomePots Firebase] Modo offline ativo. Dados salvos com segurança no aparelho.');
      updateSyncStatus('OFFLINE', 'Dispositivo operando offline. Todas as alterações continuam salvas localmente.');
    } else {
      console.warn('[HomePots Firebase] Aviso na sincronização:', errorMsg);
      updateSyncStatus('ERROR', errorMsg || 'Erro na sincronização Firestore.');
    }
    isSyncing = false;
    return false;
  }
}

/**
 * Inicia o ouvinte em tempo real e o ciclo de sincronização automática do Firestore
 */
export function startAutoSync(intervalMs = 20000) {
  if (syncIntervalId) {
    clearInterval(syncIntervalId);
  }

  if (unsubscribeRealtime) {
    unsubscribeRealtime();
    unsubscribeRealtime = null;
  }

  // Ouvintes de rede online/offline do navegador
  if (!onlineOfflineListenersInitialized && typeof window !== 'undefined') {
    onlineOfflineListenersInitialized = true;
    window.addEventListener('online', () => {
      console.log('[HomePots Firebase] Conexão restabelecida. Sincronizando com Firestore...');
      syncData();
    });
    window.addEventListener('offline', () => {
      updateSyncStatus('OFFLINE', 'Dispositivo offline. Todos os dados continuam salvos localmente.');
    });
  }

  // Sincronização inicial
  syncData();

  // Ouvinte nativo em tempo real do Firestore (onSnapshot)
  try {
    const syncCol = collection(db, 'homepots_sync');
    unsubscribeRealtime = onSnapshot(
      syncCol,
      { includeMetadataChanges: false },
      async (snapshot) => {
        // Ignora se estivermos no meio de um sync local para evitar loops
        if (isSyncing || snapshot.empty) return;
        
        // Verifica se a mudança veio de outro aparelho (não local)
        const hasPendingWrites = snapshot.docs.some(docSnap => docSnap.metadata.hasPendingWrites);
        if (hasPendingWrites) return;

        console.log('[HomePots Firebase] Atualização remota detectada em tempo real.');
        // Executa sync suave para mesclar os dados atualizados
        syncData();
      },
      (error) => {
        console.warn('[HomePots Firebase] Aviso do ouvinte em tempo real:', error.message);
      }
    );
  } catch (err: any) {
    console.warn('[HomePots Firebase] Não foi possível iniciar ouvinte em tempo real:', err.message);
  }

  // Intervalo de segurança periódico
  syncIntervalId = setInterval(() => {
    if (typeof navigator !== 'undefined' && !navigator.onLine) {
      return;
    }
    syncData();
  }, intervalMs);
}

export function stopAutoSync() {
  if (syncIntervalId) {
    clearInterval(syncIntervalId);
    syncIntervalId = null;
  }
  if (unsubscribeRealtime) {
    unsubscribeRealtime();
    unsubscribeRealtime = null;
  }
}

/**
 * Escuta alterações no Zustand local para disparar persistência em lote para o Firestore
 */
export function setupStoreListener() {
  useStore.subscribe((state, prevState) => {
    if (isSyncing) return;
    if (currentStatus === 'OFFLINE' && typeof navigator !== 'undefined' && !navigator.onLine) return;

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
      // Dispara sincronização em lote com debouncing de 800ms
      setTimeout(() => {
        syncData();
      }, 800);
    }
  });
}
