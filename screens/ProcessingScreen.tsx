
import React, { useState, useMemo } from 'react';
import { useStore } from '../store';
import { ItemStatus, Draft, Sector } from '../types';
import { Button } from '../components/UI';
import { Check, ArrowLeft, PaintBucket, Brush, TrendingUp, Wallet, Hammer, FileText, Trash2, Edit, Send, Calendar, Save, X, Settings, Clock, AlertTriangle } from 'lucide-react';
import HistoryModal from '../components/HistoryModal';
import { v4 as uuidv4 } from 'uuid';
import { GoalProgressBar, GoalsDetailView } from '../components/GoalComponents';
import EmployeeSettingsScreen from '../components/EmployeeSettingsScreen';
import { calculatePaintingCommission, getDaysDiff } from '../utils/calculations';

interface Props {
  stage: 'finishing' | 'painting';
}

type ViewMode = 'DASHBOARD' | 'REVIEW' | 'GOALS' | 'SETTINGS';

const ProcessingScreen: React.FC<Props> = ({ stage }) => {
  const { productionItems, addDraft, removeDraft, confirmDraft, drafts, currentUser, logout, vaseModels, payments, goals, userPreferences, paintingCommissionPercentage, activePeriodId } = useStore();
  
  // View State
  const [viewMode, setViewMode] = useState<ViewMode>('DASHBOARD');

  // Selection State
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [selectedDate, setSelectedDate] = useState<string>(new Date().toISOString().split('T')[0]);

  const [feedback, setFeedback] = useState<string | null>(null);
  const [historyMode, setHistoryMode] = useState<'none' | 'items' | 'financial' | 'payments'>('none');

  // --- Calculations ---
  const today = new Date().toDateString();

  const myDrafts = useMemo(() => {
    const draftType = stage === 'finishing' ? 'FINISHING' : 'PAINTING';
    return drafts.filter(d => d.type === draftType && d.userId === currentUser?.id)
          .sort((a,b) => b.createdAt - a.createdAt);
  }, [drafts, currentUser, stage]);

  const itemsInDrafts = useMemo(() => {
     const ids = new Set<string>();
     myDrafts.forEach(d => d.processingIds?.forEach(id => ids.add(id)));
     return ids;
  }, [myDrafts]);

  // Filter Completed Items by Active Period to reset counters
  const myPeriodItems = useMemo(() => productionItems.filter(p => {
    if (stage === 'finishing') return p.finishedBy === currentUser?.id && p.finishedInPeriodId === activePeriodId;
    if (stage === 'painting') return p.paintedBy === currentUser?.id && p.paintedInPeriodId === activePeriodId;
    return false;
  }), [productionItems, currentUser, stage, activePeriodId]);

  const myPeriodPayments = useMemo(() => 
    payments.filter(p => p.employeeId === currentUser?.id && p.periodId === activePeriodId),
  [payments, currentUser, activePeriodId]);

  const myTodaysItems = myPeriodItems.filter(p => 
     new Date(p.updatedAt).toDateString() === today
  );
  
  const dailyTotalQty = myTodaysItems.length;
  const dailyEarnings = myTodaysItems.reduce<number>((acc, item) => {
    if (stage === 'finishing') return acc + (item.finishingValue || 0);
    if (stage === 'painting') return acc + (item.paintingValue || 0);
    return acc;
  }, 0);

  const totalProducedValue = myPeriodItems.reduce<number>((acc, item) => {
     if (stage === 'finishing') return acc + (item.finishingValue || 0);
     if (stage === 'painting') return acc + (item.paintingValue || 0);
     return acc;
  }, 0);
  
  const totalReceivedValue = myPeriodPayments.reduce((acc, pay) => acc + pay.amount, 0);
  const currentBalance = totalProducedValue - totalReceivedValue;
  
  // Config
  const config = stage === 'finishing' ? {
    inputStatus: ItemStatus.AWAITING_FINISHING,
    title: 'Setor de Acabamento',
    icon: <Brush className="w-6 h-6 text-on-secondary-container" />,
    actionLabel: 'Confirmar Acabamento',
    emptyMsg: 'Sem vasos para acabamento.',
    themeColor: 'secondary',
    alertThreshold: 2 // Days
  } : {
    inputStatus: ItemStatus.AWAITING_PAINTING,
    title: 'Setor de Pintura',
    icon: <PaintBucket className="w-6 h-6 text-on-primary-container" />,
    actionLabel: 'Confirmar Pintura',
    emptyMsg: 'Sem vasos para pintura.',
    themeColor: 'primary',
    alertThreshold: 1 // Days
  };

  // Pending items are NOT filtered by period (work accumulates)
  const pendingItems = useMemo(() => {
    const list = productionItems.filter(i => 
      i.status === config.inputStatus && !itemsInDrafts.has(i.id)
    );
    
    // Sort by age (Older first - FIFO)
    return list.sort((a,b) => {
       const dateA = stage === 'finishing' ? a.createdAt : a.updatedAt;
       const dateB = stage === 'finishing' ? b.createdAt : b.updatedAt;
       return dateA - dateB;
    });
  }, [productionItems, config.inputStatus, itemsInDrafts, stage]);

  // Earnings for current selection
  const selectionEarnings = Array.from(selectedIds).reduce<number>((acc, id) => {
    const item = pendingItems.find(i => i.id === id);
    if (!item) return acc;
    const model = vaseModels.find(v => v.id === item.modelId);
    if (!model) return acc;

    if (stage === 'finishing') return acc + (model.costFinishing || 0);
    // Use dynamic commission percentage for estimates
    if (stage === 'painting') return acc + calculatePaintingCommission(model.priceSale || 0, paintingCommissionPercentage);
    return acc;
  }, 0);

  // Theme Classes
  const themeClasses = config.themeColor === 'secondary' ? {
     bg: 'bg-secondary',
     container: 'bg-secondary-container',
     text: 'text-secondary',
     border: 'border-secondary',
     onContainer: 'text-on-secondary-container',
     onBg: 'text-on-secondary'
  } : {
     bg: 'bg-primary',
     container: 'bg-primary-container',
     text: 'text-primary',
     border: 'border-primary',
     onContainer: 'text-on-primary-container',
     onBg: 'text-on-primary'
  };

  // --- Preferences Check ---
  const prefs = useMemo(() => {
     if (!currentUser) return null;
     return userPreferences[currentUser.id] || {
        showFinancials: true,
        showProductionQty: true,
        showGoalsBar: true
     };
  }, [currentUser, userPreferences]);

  // --- Handlers ---

  const toggleSelect = (id: string) => {
    const next = new Set(selectedIds);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setSelectedIds(next);
  };

  const proceedToReview = () => {
    if (selectedIds.size > 0) {
      setViewMode('REVIEW');
    }
  };

  const handleSaveAsDraft = () => {
    if (!currentUser) return;
    
    const processDate = new Date(selectedDate + 'T12:00:00').getTime();

    const newDraft: Draft = {
        id: uuidv4(),
        type: stage === 'finishing' ? 'FINISHING' : 'PAINTING',
        sector: currentUser.sector as any,
        userId: currentUser.id,
        selectedDate: processDate,
        createdAt: Date.now(),
        processingIds: Array.from(selectedIds)
    };

    addDraft(newDraft);

    setSelectedIds(new Set());
    setViewMode('DASHBOARD');
    setFeedback('Rascunho salvo!');
    setTimeout(() => setFeedback(null), 2000);
  };

  const handleEditDraft = (draft: Draft) => {
      removeDraft(draft.id);
      const restoredIds = new Set<string>(draft.processingIds);
      setSelectedIds(restoredIds);
      setSelectedDate(new Date(draft.selectedDate).toISOString().split('T')[0]);
      setViewMode('REVIEW'); // Jump straight to review when editing
  };

  const handleConfirmDraft = (draftId: string) => {
      confirmDraft(draftId);
      setFeedback('Processamento confirmado!');
      setSelectedIds(new Set()); // Ensure selection is cleared if we were viewing it
      setTimeout(() => setFeedback(null), 2000);
  };

  const getUnitValueDisplay = (modelId: string) => {
    const model = vaseModels.find(v => v.id === modelId);
    if (!model) return 'R$ 0.00';
    if (stage === 'finishing') return `R$ ${model.costFinishing?.toFixed(2)}`;
    // Use dynamic commission percentage for display
    if (stage === 'painting') return `R$ ${calculatePaintingCommission(model.priceSale || 0, paintingCommissionPercentage).toFixed(2)}`;
    return 'R$ 0.00';
  };

  // --- RENDERERS ---

  if (viewMode === 'SETTINGS') {
      return <EmployeeSettingsScreen onBack={() => setViewMode('DASHBOARD')} />;
  }

  // --- REVIEW VIEW ---
  if (viewMode === 'REVIEW') {
    return (
       <div className="bg-background min-h-screen flex flex-col">
          {/* Header */}
          <div className="bg-surface p-4 sticky top-0 z-20 shadow-sm flex items-center justify-between border-b border-outline-variant">
            <Button variant="ghost" onClick={() => setViewMode('DASHBOARD')} className="text-on-surface-variant -ml-2">
              <ArrowLeft className="w-6 h-6 mr-1" /> Voltar
            </Button>
            <h1 className="text-lg font-medium text-on-surface">Confirmar Serviço</h1>
            <div className="w-10"></div>
          </div>

          <div className="flex-1 p-4 pb-32 space-y-6">
             {/* Review Card */}
             <div className="bg-surface p-6 rounded-3xl border border-outline-variant shadow-sm text-center">
                <div className={`w-16 h-16 mx-auto rounded-full flex items-center justify-center mb-4 ${themeClasses.container} ${themeClasses.onContainer}`}>
                   {config.icon}
                </div>
                <h2 className="text-2xl font-bold text-on-surface mb-1">{selectedIds.size} Vasos</h2>
                <p className="text-on-surface-variant">Selecionados para {stage === 'finishing' ? 'Acabamento' : 'Pintura'}</p>
                
                <div className="mt-6 p-4 bg-surface-variant rounded-2xl border border-outline-variant flex justify-between items-center">
                   <span className="text-sm font-medium text-on-surface-variant uppercase tracking-wider">Valor Total</span>
                   <span className={`text-2xl font-bold ${stage === 'finishing' ? 'text-secondary' : 'text-primary'}`}>
                      R$ {selectionEarnings.toFixed(2)}
                   </span>
                </div>
             </div>

             {/* Date Picker */}
             <div className="bg-surface p-4 rounded-2xl border border-outline-variant shadow-sm">
                <label className="text-xs font-bold text-on-surface-variant uppercase tracking-wider mb-2 flex items-center gap-2">
                  <Calendar className="w-4 h-4" /> Data de Execução
                </label>
                <input 
                  type="date" 
                  className="w-full p-3 bg-surface-variant text-on-surface border border-outline-variant rounded-xl focus:outline-none focus:ring-2 focus:ring-primary text-lg"
                  value={selectedDate}
                  onChange={(e) => setSelectedDate(e.target.value)}
                />
             </div>

             {/* Warning */}
             <div className="bg-yellow-100 dark:bg-yellow-900/30 text-yellow-800 dark:text-yellow-200 p-4 rounded-2xl border border-yellow-200 dark:border-yellow-800 text-sm leading-relaxed">
               <p className="font-bold mb-1">Atenção</p>
               Este lote será salvo como <strong>Rascunho</strong>. Você precisará confirmá-lo na tela inicial para receber o pagamento.
             </div>
          </div>

          {/* Footer Action */}
          <div className="bg-surface border-t border-outline-variant p-4 fixed bottom-0 left-0 right-0 z-30 shadow-[0_-4px_20px_rgba(0,0,0,0.1)]">
             <div className="max-w-3xl mx-auto flex gap-3">
                <Button variant="ghost" onClick={() => setViewMode('DASHBOARD')} className="flex-1 h-12">
                   Cancelar
                </Button>
                <Button onClick={handleSaveAsDraft} className={`flex-[2] h-12 rounded-xl font-bold text-base ${themeClasses.bg} text-on-primary`}>
                   <Save className="w-5 h-5 mr-2" />
                   Salvar Rascunho
                </Button>
             </div>
          </div>
       </div>
    );
  }

  // --- GOALS VIEW ---
  if (viewMode === 'GOALS' && currentUser) {
     return (
        <GoalsDetailView 
           onBack={() => setViewMode('DASHBOARD')}
           goals={goals}
           productionItems={productionItems}
           sector={stage === 'finishing' ? Sector.FINISHING : Sector.PAINTING}
           userId={currentUser.id}
           vaseModels={vaseModels}
        />
     );
  }

  // --- DASHBOARD VIEW ---
  return (
    <div className="bg-background min-h-screen pb-32">
       {/* Top App Bar */}
       <div className="bg-surface p-4 sticky top-0 z-10 shadow-sm flex items-center justify-between border-b border-outline-variant">
         <div className="flex items-center gap-4">
             <Button variant="ghost" onClick={logout} className="text-on-surface-variant -ml-2">
                <ArrowLeft className="w-6 h-6" />
             </Button>
             <div className="flex items-center gap-3">
                <div className={`p-2 rounded-full ${themeClasses.container}`}>{config.icon}</div>
                <h1 className="text-xl font-medium text-on-surface">{config.title}</h1>
             </div>
         </div>
         <Button variant="ghost" onClick={() => setViewMode('SETTINGS')} className="text-on-surface-variant">
            <Settings className="w-6 h-6" />
         </Button>
      </div>
      
      <div className="p-4 max-w-3xl mx-auto space-y-6">

        {/* Goals Progress Bar (Conditional) */}
        {currentUser && prefs?.showGoalsBar && (
           <GoalProgressBar 
              goals={goals} 
              productionItems={productionItems} 
              sector={stage === 'finishing' ? Sector.FINISHING : Sector.PAINTING} 
              userId={currentUser.id} 
              onClick={() => setViewMode('GOALS')}
           />
        )}
        
        {/* Financial Dashboard (Conditional) */}
        {(prefs?.showFinancials || prefs?.showProductionQty) && (
            <div className={`${themeClasses.bg} rounded-3xl p-6 ${themeClasses.onBg} shadow-lg relative overflow-hidden`}>
            <div className="flex justify-between items-start mb-6 relative z-10">
                <div>
                <p className="opacity-90 font-medium">Olá, {currentUser?.name}</p>
                <h2 className="text-2xl font-bold">Produção do Dia</h2>
                </div>
                <div className={`${themeClasses.container} p-2 rounded-xl`}>
                <TrendingUp className={themeClasses.text} />
                </div>
            </div>
            <div className="grid grid-cols-2 gap-4 relative z-10">
                {prefs?.showProductionQty && (
                    <button 
                        onClick={() => setHistoryMode('items')}
                        className={`${themeClasses.container} ${themeClasses.onContainer} rounded-2xl p-4 active:scale-95 transition-all text-left group cursor-pointer ring-offset-2 focus:ring-2 ring-current outline-none shadow-sm h-full flex flex-col justify-between`}
                    >
                        <div className="flex items-center gap-2 mb-1 opacity-80">
                        <Hammer className="w-4 h-4" />
                        <span className="text-sm font-medium">Executados</span>
                        </div>
                        <div>
                            <div className="text-3xl font-bold group-hover:scale-105 transition-transform origin-left">{dailyTotalQty}</div>
                            {prefs?.showFinancials && (
                                <div className="text-xs opacity-90 mt-1 flex items-center font-medium">
                                R$ {dailyEarnings.toFixed(2)}
                                </div>
                            )}
                        </div>
                    </button>
                )}

                {prefs?.showFinancials && (
                    <button 
                        onClick={() => setHistoryMode('financial')}
                        className={`${themeClasses.container} ${themeClasses.onContainer} rounded-2xl p-4 active:scale-95 transition-all text-left group cursor-pointer ring-offset-2 focus:ring-2 ring-current outline-none shadow-sm h-full flex flex-col justify-between ${!prefs.showProductionQty ? 'col-span-2' : ''}`}
                    >
                        <div className="flex items-center gap-2 mb-1 opacity-80">
                        <Wallet className="w-4 h-4" />
                        <span className="text-sm font-medium">Saldo Atual</span>
                        </div>
                        <div>
                            <div className="text-3xl font-bold group-hover:scale-105 transition-transform origin-left">R$ {currentBalance.toFixed(2)}</div>
                            <div className="text-xs opacity-90 mt-1 flex items-center font-medium">
                            Clique para detalhes
                            </div>
                        </div>
                    </button>
                )}
            </div>
            </div>
        )}

        {/* --- DRAFTS SECTION --- */}
        {myDrafts.length > 0 && (
          <div className="animate-in slide-in-from-bottom-2 duration-500">
             <div className="flex items-center gap-2 mb-3 px-2">
                <FileText className={`w-5 h-5 ${themeClasses.text}`} />
                <h3 className="text-lg font-medium text-on-background">Rascunhos Pendentes</h3>
                <span className={`${themeClasses.container} ${themeClasses.onContainer} text-xs font-bold px-2 py-0.5 rounded-full`}>{myDrafts.length}</span>
             </div>
             
             <div className="space-y-3">
               {myDrafts.map(draft => {
                 const draftDate = new Date(draft.selectedDate).toLocaleDateString();
                 const count = draft.processingIds?.length || 0;
                 
                 return (
                   <div key={draft.id} className="bg-surface border border-outline-variant p-5 rounded-2xl relative shadow-sm">
                      <div className="flex justify-between items-start mb-4">
                         <div>
                            <div className="flex items-center gap-2">
                               <p className="font-bold text-lg text-on-surface">{count} Vasos em {draftDate}</p>
                            </div>
                            <p className="text-xs text-on-surface-variant mt-0.5">Criado em {new Date(draft.createdAt).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}</p>
                         </div>
                         <div className="flex items-center gap-1">
                            <button onClick={() => handleEditDraft(draft)} className="p-2 text-on-surface-variant hover:text-primary hover:bg-primary-container rounded-full transition-colors" title="Retomar seleção">
                               <Edit className="w-5 h-5" />
                            </button>
                            <button onClick={() => removeDraft(draft.id)} className="p-2 text-on-surface-variant hover:text-error hover:bg-error-container rounded-full transition-colors" title="Excluir">
                               <Trash2 className="w-5 h-5" />
                            </button>
                         </div>
                      </div>

                      <Button onClick={() => handleConfirmDraft(draft.id)} className={`w-full gap-2 h-12 text-base font-bold ${themeClasses.bg} ${themeClasses.onBg}`}>
                         <Send className="w-5 h-5" /> Confirmar {stage === 'finishing' ? 'Acabamento' : 'Pintura'}
                      </Button>
                   </div>
                 );
               })}
             </div>
          </div>
        )}

        {/* Pending Items List */}
        {pendingItems.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-on-surface-variant border border-dashed border-outline-variant rounded-2xl bg-surface">
             <div className="w-20 h-20 bg-surface-variant rounded-full flex items-center justify-center mb-4">
                <Check className="w-10 h-10 text-outline" />
             </div>
             <p className="font-medium text-lg">{config.emptyMsg}</p>
          </div>
        ) : (
          <div className="space-y-3">
            <p className="text-sm font-medium text-on-surface-variant ml-2 mb-2 uppercase tracking-wide">Disponível para trabalho ({pendingItems.length})</p>
            {pendingItems.map((item) => {
              const isSelected = selectedIds.has(item.id);
              
              // Time Alert Logic
              // For finishing, calculate from createdAt. For painting, from updatedAt.
              const referenceDate = stage === 'finishing' ? item.createdAt : item.updatedAt;
              const daysInQueue = getDaysDiff(referenceDate);
              const isLate = daysInQueue >= config.alertThreshold;
              const isWarning = daysInQueue >= (config.alertThreshold - 1) && !isLate;

              return (
                <div 
                  key={item.id}
                  onClick={() => toggleSelect(item.id)}
                  className={`
                    relative p-4 rounded-2xl border transition-all cursor-pointer flex justify-between items-center group
                    ${isSelected 
                      ? `${themeClasses.container} border-${config.themeColor} shadow-md ring-1 ring-${config.themeColor}` 
                      : 'border-outline-variant bg-surface shadow-sm hover:shadow-md hover:bg-surface-variant'}
                  `}
                >
                  <div className="flex flex-col gap-1">
                     <span className={`font-medium text-lg ${isSelected ? themeClasses.onContainer : 'text-on-surface'}`}>{item.modelName}</span>
                     <div className="flex items-center gap-2">
                        {item.cip && (
                           <span className="text-[10px] bg-surface-variant text-on-surface-variant px-1.5 py-0.5 rounded border border-outline-variant font-mono">
                              CIP: {item.cip}
                           </span>
                        )}
                        <span className="text-xs text-on-surface-variant font-mono">ID: {item.id.slice(0, 8)}</span>
                     </div>
                     <span className={`text-sm font-bold ${isSelected ? themeClasses.onContainer : themeClasses.text}`}>
                        + {getUnitValueDisplay(item.modelId)}
                     </span>
                  </div>
                  
                  <div className="flex flex-col items-end gap-2">
                     <div className={`
                        w-8 h-8 rounded-full flex items-center justify-center transition-all duration-300
                        ${isSelected ? `${themeClasses.bg} text-on-primary` : 'bg-surface-variant text-on-surface-variant'}
                     `}>
                        {isSelected && <Check className="w-5 h-5" />}
                     </div>
                     
                     {/* Time Alert Badge */}
                     {(isLate || isWarning) && !isSelected && (
                        <div className={`flex items-center gap-1 px-2 py-1 rounded-md text-[10px] font-bold uppercase ${isLate ? 'bg-error-container text-on-error-container' : 'bg-amber-100 text-amber-800'}`}>
                           <Clock className="w-3 h-3" />
                           {daysInQueue} dias
                        </div>
                     )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Bottom Floating Action Bar */}
      {selectedIds.size > 0 && (
         <div className="fixed bottom-6 left-4 right-4 z-20 max-w-2xl mx-auto animate-in slide-in-from-bottom-4">
            <div className="bg-surface p-4 rounded-3xl shadow-[0_8px_30px_rgb(0,0,0,0.12)] flex items-center justify-between gap-4 pl-6 pr-4 border border-outline-variant">
                <div className="flex flex-col">
                   <span className="text-on-surface-variant text-xs uppercase font-bold">Total estimado</span>
                   <div className="text-2xl font-bold text-success">
                     R$ {selectionEarnings.toFixed(2)}
                   </div>
                   <span className="text-xs text-on-surface-variant">{selectedIds.size} itens selecionados</span>
                </div>
                
                <div className="flex items-center gap-2">
                   <button 
                     onClick={() => setSelectedIds(new Set())}
                     className="p-3 rounded-xl hover:bg-surface-variant text-on-surface-variant transition-colors"
                   >
                      <X className="w-6 h-6" />
                   </button>
                   <Button 
                      onClick={proceedToReview} 
                      className={`${themeClasses.bg} ${themeClasses.onBg} rounded-xl px-6 h-12 shadow-none hover:brightness-110 font-bold`}
                   >
                      {config.actionLabel}
                   </Button>
                </div>
            </div>
         </div>
      )}
      
      {/* Snackbar Feedback */}
      {feedback && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 animate-in slide-in-from-bottom fade-in duration-300 w-full px-4 flex justify-center">
           <div className="bg-on-surface text-surface px-6 py-4 rounded-2xl shadow-2xl flex items-center gap-3 border border-outline-variant">
              <Check className="w-5 h-5 text-success" />
              <span className="font-medium">{feedback}</span>
           </div>
        </div>
      )}

      {/* History Modal */}
      <HistoryModal 
        isOpen={historyMode !== 'none'}
        onClose={() => setHistoryMode('none')}
        mode={historyMode === 'items' ? 'items' : historyMode === 'payments' ? 'payments' : 'financial'}
        items={myPeriodItems}
        payments={myPeriodPayments}
        vaseModels={vaseModels}
        valueKey={stage === 'finishing' ? 'finishingValue' : 'paintingValue'}
        title={historyMode === 'items' 
           ? `Histórico de Produção - ${config.title.replace('Setor de ', '')}`
           : historyMode === 'payments' 
              ? 'Pagamentos Recebidos' 
              : 'Extrato'}
      />
    </div>
  );
};

export default ProcessingScreen;
