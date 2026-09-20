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
import { ProductionItem, Employee, VaseModel, PaymentRecord, Period, Goal, SystemLog, UserPreferences, ItemStatus } from '../types';
import { getCanonicalVaseModelId } from '../constants';
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
let debounceSyncTimer: any = null;

// Helper to determine if a value is defined
const isDefined = (val: any) => val !== undefined && val !== null;

// Lifecycle pipeline priority order: items cannot regress backwards in production flow
const STATUS_PIPELINE_ORDER: Record<string, number> = {
  [ItemStatus.DRAFT]: 0,
  [ItemStatus.PRODUCED]: 1,
  [ItemStatus.AWAITING_FINISHING]: 2,
  [ItemStatus.STOCK_NO_SHELL]: 2,
  [ItemStatus.AWAITING_PAINTING]: 3,
  [ItemStatus.FINISHED]: 4,
};

// Unique merge logic for ProductionItems (CRDT-style merge with strict pipeline preservation)
function mergeProductionItems(local: ProductionItem[], remote: ProductionItem[]): ProductionItem[] {
  const idMap = new Map<string, ProductionItem>();
  
  // Load remote items first
  remote.forEach(item => {
    idMap.set(item.id, item);
  });

  // Merge local items with pipeline-aware ordering
  local.forEach(item => {
    const existing = idMap.get(item.id);
    if (!existing) {
      idMap.set(item.id, item);
    } else {
      const localRank = STATUS_PIPELINE_ORDER[item.status] ?? 0;
      const remoteRank = STATUS_PIPELINE_ORDER[existing.status] ?? 0;

      // Rule 1: A vase that advanced in the pipeline (e.g. AWAITING_PAINTING) MUST NOT regress to an earlier status (e.g. AWAITING_FINISHING)
      if (localRank > remoteRank) {
        idMap.set(item.id, item);
      } else if (remoteRank > localRank) {
        // Remote has already advanced further, keep existing remote item
      } else {
        // Rule 2: Equal lifecycle rank -> keep local unless remote has a strictly higher timestamp
        const existingTime = existing.updatedAt || existing.createdAt || 0;
        const localTime = item.updatedAt || item.createdAt || 0;
        if (localTime >= existingTime) {
          idMap.set(item.id, item);
        }
      }
    }
  });

  // Secondary pass: Deduplicate by CIP if CIP is present to prevent duplicate physical vases in stock
  const cipMap = new Map<string, ProductionItem>();
  const nonCipItems: ProductionItem[] = [];

  for (const item of idMap.values()) {
    if (!item.cip) {
      nonCipItems.push(item);
      continue;
    }
    const existing = cipMap.get(item.cip);
    if (!existing) {
      cipMap.set(item.cip, item);
    } else {
      const existingRank = STATUS_PIPELINE_ORDER[existing.status] ?? 0;
      const currentRank = STATUS_PIPELINE_ORDER[item.status] ?? 0;
      if (currentRank > existingRank) {
        cipMap.set(item.cip, item);
      } else if (currentRank === existingRank) {
        const existingTime = existing.updatedAt || existing.createdAt || 0;
        const currentTime = item.updatedAt || item.createdAt || 0;
        if (currentTime >= existingTime) {
          cipMap.set(item.cip, item);
        }
      }
    }
  }

  return [...cipMap.values(), ...nonCipItems];
}

/**
 * Deduplica e mescla os modelos de vasos pela chave canônica natural (Nome + Tipo),
 * gerando e preservando IDs canônicos determinísticos e gerando um mapa de remapeamento
 * para atualizar referências em itens de produção sem perda de integridade.
 */
function mergeAndDeduplicateVaseModels(local: VaseModel[], remote: VaseModel[]): {
  merged: VaseModel[];
  idRemap: Map<string, string>;
} {
  const idRemap = new Map<string, string>();
  const groupMap = new Map<string, VaseModel[]>();

  const allModels = [...(remote || []), ...(local || [])];
  for (const model of allModels) {
    if (!model || !model.name) continue;
    const key = `${model.name.trim().toLowerCase()}_${model.type}`;
    if (!groupMap.has(key)) {
      groupMap.set(key, []);
    }
    groupMap.get(key)!.push(model);
  }

  const merged: VaseModel[] = [];

  for (const models of groupMap.values()) {
    const sample = models[0];
    const canonicalId = getCanonicalVaseModelId(sample.name, sample.type);

    let bestModel: VaseModel = { ...sample, id: canonicalId };
    for (const m of models) {
      if ((m.costProduction && m.costProduction > 0) || (m.priceSale && m.priceSale > 0)) {
        bestModel = { ...m, id: canonicalId };
      }
    }

    for (const m of models) {
      if (m.id) {
        idRemap.set(m.id, canonicalId);
      }
    }

    merged.push(bestModel);
  }

  merged.sort((a, b) => a.name.localeCompare(b.name) || a.type.localeCompare(b.type));
  return { merged, idRemap };
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
  status: 'IDLE' | 'SYNCING' | 'SUCCESS' | 'ERROR' | 'OFFLINE' | 'QUOTA_EXCEEDED';
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
const QUOTA_STORAGE_KEY = 'homepots_firestore_quota_exceeded_timestamp';

function checkInitialQuota(): boolean {
  if (typeof localStorage === 'undefined') return false;
  const saved = localStorage.getItem(QUOTA_STORAGE_KEY);
  if (!saved) return false;
  const savedTime = parseInt(saved, 10);
  if (isNaN(savedTime)) return false;
  // If stored within the last 18 hours, respect the quota limit
  if (Date.now() - savedTime < 18 * 60 * 60 * 1000) {
    return true;
  }
  localStorage.removeItem(QUOTA_STORAGE_KEY);
  return false;
}

let isQuotaExceeded = checkInitialQuota();
let isApplyingRemoteUpdate = false;
let isStoreHydrating = true;
setTimeout(() => {
  isStoreHydrating = false;
}, 3500);
const dirtyPartitions = new Set<string>();

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
 * Otimizado com rastreamento de partições modificadas (Delta Sync) para economizar cota.
 * Partições confidenciais (pagamentos, colaboradores, taxas) são criptografadas com AES-256-GCM.
 */
export async function syncData(forceWriteAll = false, isManual = false): Promise<boolean> {
  if (isSyncing) return false;

  // Se a cota foi atingida e é uma chamada automática em segundo plano, não bombardeia o Firestore
  if (isQuotaExceeded && !isManual) {
    updateSyncStatus(
      'QUOTA_EXCEEDED',
      'Limite diário gratuito de gravações do Firestore atingido (20.000 gravações/dia). O sistema continua 100% operacional no modo local seguro.'
    );
    return false;
  }

  // Se o usuário clicou manualmente em sincronizar, tenta novamente limpando o estado de bloqueio
  if (isManual) {
    isQuotaExceeded = false;
    if (typeof localStorage !== 'undefined') {
      localStorage.removeItem(QUOTA_STORAGE_KEY);
    }
  }

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

    // 3. Mescla inteligente de dados (CRDT) com deduplicação canônica
    const mergedPeriods = isDefined(remotePeriods) ? mergeListById(latestStore.periods, remotePeriods) : latestStore.periods;
    const mergedEmployees = isDefined(remoteEmployees) ? mergeListById(latestStore.employees, remoteEmployees) : latestStore.employees;
    
    const { merged: mergedVaseModels, idRemap } = mergeAndDeduplicateVaseModels(
      latestStore.vaseModels || [],
      isDefined(remoteVases) ? remoteVases : []
    );

    let mergedProductionItems = isDefined(remoteItems) 
      ? mergeProductionItems(latestStore.productionItems, remoteItems) 
      : latestStore.productionItems;

    // Se identificadores antigos foram consolidados para o canônico, remapeia nos itens de produção
    if (idRemap.size > 0) {
      mergedProductionItems = mergedProductionItems.map(item => {
        const canonicalId = idRemap.get(item.modelId);
        if (canonicalId && canonicalId !== item.modelId) {
          return { ...item, modelId: canonicalId };
        }
        return item;
      });
    }

    const mergedPayments = isDefined(remotePayments) ? mergeListById(latestStore.payments, remotePayments) : latestStore.payments;
    
    // RASCUNHOS: Mantidos 100% locais ao aparelho do colaborador.
    const confirmedSet = new Set(latestStore.confirmedDraftIds || []);
    const mergedDrafts = (latestStore.drafts || []).filter(d => !confirmedSet.has(d.id));

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

    const currentActivePeriod = mergedPeriods.find(p => p.status === 'ACTIVE') || mergedPeriods[0];
    const resolvedActivePeriodId = latestStore.activePeriodId || currentActivePeriod?.id || null;

    // 4. Atualiza a store local Zustand sem disparar o ouvinte de envio para nuvem
    isApplyingRemoteUpdate = true;
    try {
      useStore.setState({
        periods: mergedPeriods,
        activePeriodId: resolvedActivePeriodId,
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
    } finally {
      isApplyingRemoteUpdate = false;
    }

    // 5. Envio delta protegido para o Firestore: grava SOMENTE partições modificadas para preservar a cota diária
    const partitions: { key: string; value: any }[] = [
      { key: 'periods', value: mergedPeriods },
      { key: 'employees', value: mergedEmployees },
      { key: 'vaseModels', value: mergedVaseModels },
      { key: 'productionItems', value: mergedProductionItems },
      { key: 'payments', value: mergedPayments },
      { key: 'drafts', value: [] },
      { key: 'systemLogs', value: mergedLogs },
      { key: 'goals', value: mergedGoals },
      { key: 'userPreferences', value: mergedUserPreferences },
      { key: 'configs', value: mergedConfigs }
    ];

    const partitionsToWrite = forceWriteAll 
      ? partitions 
      : partitions.filter(p => dirtyPartitions.has(p.key));

    if (partitionsToWrite.length > 0 && !isQuotaExceeded) {
      try {
        const batch = writeBatch(db);
        const now = Date.now();

        for (const partition of partitionsToWrite) {
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
        dirtyPartitions.clear();
        isQuotaExceeded = false;
        if (typeof localStorage !== 'undefined') {
          localStorage.removeItem(QUOTA_STORAGE_KEY);
        }
      } catch (writeErr: any) {
        const errMsg = writeErr?.message || String(writeErr);
        const isQuota = 
          writeErr?.code === 'resource-exhausted' || 
          errMsg.includes('resource-exhausted') || 
          errMsg.includes('Quota limit exceeded') ||
          errMsg.includes('Quota exceeded');

        if (isQuota) {
          isQuotaExceeded = true;
          if (typeof localStorage !== 'undefined') {
            localStorage.setItem(QUOTA_STORAGE_KEY, Date.now().toString());
          }
          console.warn('[HomePots Firebase] Cota diária gratuita atingida. Modo local seguro ativo.');
          updateSyncStatus(
            'QUOTA_EXCEEDED', 
            'Limite diário gratuito do Firestore atingido (20.000 gravações/dia). O sistema continua 100% funcional no modo local seguro. Dados salvos com integridade.'
          );
        } else {
          console.warn('[HomePots Firebase] Erro ao gravar lote no Firestore:', errMsg);
          updateSyncStatus('ERROR', errMsg);
        }
      }
    }

    lastSyncTimestamp = Date.now();
    if (!isQuotaExceeded) {
      updateSyncStatus('SUCCESS');
    }
    isSyncing = false;
    return true;

  } catch (error: any) {
    const errorMsg = error?.message || String(error);
    const isQuotaError = 
      error?.code === 'resource-exhausted' || 
      errorMsg.includes('resource-exhausted') || 
      errorMsg.includes('Quota limit exceeded') ||
      errorMsg.includes('Quota exceeded');

    if (isQuotaError) {
      isQuotaExceeded = true;
      if (typeof localStorage !== 'undefined') {
        localStorage.setItem(QUOTA_STORAGE_KEY, Date.now().toString());
      }
      console.warn('[HomePots Firebase] Cota diária gratuita atingida. Modo local seguro ativo.');
      updateSyncStatus(
        'QUOTA_EXCEEDED', 
        'Limite diário gratuito do Firestore atingido (20.000 gravações/dia). O sistema continua 100% funcional no modo local seguro. Dados salvos com integridade.'
      );
      isSyncing = false;
      return false;
    }

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
export function startAutoSync(intervalMs = 120000) {
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
      if (!isQuotaExceeded) {
        syncData();
      }
    });
    window.addEventListener('offline', () => {
      updateSyncStatus('OFFLINE', 'Dispositivo offline. Todos os dados continuam salvos localmente.');
    });
  }

  // Sincronização inicial inteligente
  syncData();

  // Ouvinte nativo em tempo real do Firestore (onSnapshot)
  try {
    const syncCol = collection(db, 'homepots_sync');
    unsubscribeRealtime = onSnapshot(
      syncCol,
      { includeMetadataChanges: false },
      async (snapshot) => {
        // Se a cota estiver excedida ou sincronizando localmente, ignora
        if (isQuotaExceeded || isSyncing || snapshot.empty) return;
        
        // Verifica se a mudança veio de outro aparelho (não local)
        const hasPendingWrites = snapshot.docs.some(docSnap => docSnap.metadata.hasPendingWrites);
        if (hasPendingWrites) return;

        console.log('[HomePots Firebase] Atualização remota detectada em tempo real.');
        // Executa sync somente para ler/mesclar dados remotos sem regravar desnecessariamente
        syncData(false);
      },
      (error: any) => {
        const msg = error?.message || '';
        const isQuota = error?.code === 'resource-exhausted' || msg.includes('Quota limit exceeded') || msg.includes('resource-exhausted');
        if (isQuota) {
          isQuotaExceeded = true;
          updateSyncStatus(
            'QUOTA_EXCEEDED', 
            'Limite diário gratuito de gravações do Firestore atingido (20.000 gravações/dia). O sistema continua 100% operacional no modo local seguro.'
          );
        } else {
          console.warn('[HomePots Firebase] Aviso do ouvinte em tempo real:', error.message);
        }
      }
    );
  } catch (err: any) {
    console.warn('[HomePots Firebase] Não foi possível iniciar ouvinte em tempo real:', err.message);
  }

  // Intervalo de verificação de integridade periódico (executa apenas se não estiver bloqueado por cota)
  syncIntervalId = setInterval(() => {
    if (typeof navigator !== 'undefined' && !navigator.onLine) {
      return;
    }
    if (isQuotaExceeded) {
      return;
    }
    syncData(false);
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
 * Rastreia exatamente quais partições foram modificadas para evitar gravações desnecessárias.
 */
export function setupStoreListener() {
  useStore.subscribe((state, prevState) => {
    if (isStoreHydrating || isSyncing || isApplyingRemoteUpdate) return;
    if (currentStatus === 'OFFLINE' && typeof navigator !== 'undefined' && !navigator.onLine) return;

    const periodsChanged = state.periods !== prevState.periods;
    const employeesChanged = state.employees !== prevState.employees;
    const vaseModelsChanged = state.vaseModels !== prevState.vaseModels;
    const itemsChanged = state.productionItems !== prevState.productionItems;
    const paymentsChanged = state.payments !== prevState.payments;
    const goalsChanged = state.goals !== prevState.goals;
    const logsChanged = state.systemLogs !== prevState.systemLogs;
    const prefsChanged = state.userPreferences !== prevState.userPreferences;
    const ratesChanged = 
      state.rawMaterialCostPerKg !== prevState.rawMaterialCostPerKg || 
      state.paintingCommissionPercentage !== prevState.paintingCommissionPercentage ||
      state.supervisorPassword !== prevState.supervisorPassword;

    if (periodsChanged) dirtyPartitions.add('periods');
    if (employeesChanged) dirtyPartitions.add('employees');
    if (vaseModelsChanged) dirtyPartitions.add('vaseModels');
    if (itemsChanged) dirtyPartitions.add('productionItems');
    if (paymentsChanged) dirtyPartitions.add('payments');
    if (goalsChanged) dirtyPartitions.add('goals');
    if (logsChanged) dirtyPartitions.add('systemLogs');
    if (prefsChanged) dirtyPartitions.add('userPreferences');
    if (ratesChanged) dirtyPartitions.add('configs');

    if (dirtyPartitions.size > 0 && !isQuotaExceeded) {
      // Dispara sincronização em lote com debouncing de 2.5s para agrupar edições e economizar cota
      if (debounceSyncTimer) {
        clearTimeout(debounceSyncTimer);
      }
      debounceSyncTimer = setTimeout(() => {
        debounceSyncTimer = null;
        syncData(false);
      }, 2500);
    }
  });
}
