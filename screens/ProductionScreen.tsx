
import React, { useState, useMemo } from 'react';
import { useStore } from '../store';
import { VaseType, VaseModel, Draft, DraftItemContent, Sector } from '../types';
import { Button, Modal } from '../components/UI';
import { Plus, Minus, Check, ClipboardList, ArrowLeft, TrendingUp, Wallet, FileText, Trash2, Edit, Send, Calendar, Save, Settings, AlertCircle } from 'lucide-react';
import { v4 as uuidv4 } from 'uuid';
import HistoryModal from '../components/HistoryModal';
import { GoalProgressBar, GoalsDetailView } from '../components/GoalComponents';
import EmployeeSettingsScreen from '../components/EmployeeSettingsScreen';

type ViewMode = 'DASHBOARD' | 'REGISTER' | 'GOALS' | 'SETTINGS';

const ProductionScreen: React.FC = () => {
  const { vaseModels, addDraft, removeDraft, confirmDraft, drafts, currentUser, productionItems, payments, logout, goals, userPreferences, activePeriodId } = useStore();
  
  // View State
  const [viewMode, setViewMode] = useState<ViewMode>('DASHBOARD');
  
  // Register State
  const [draftItems, setDraftItems] = useState<{model: VaseModel, quantity: number}[]>([]);
  const [selectedType, setSelectedType] = useState<VaseType>(VaseType.WITH_SHELL);
  const [selectedDate, setSelectedDate] = useState<string>(new Date().toISOString().split('T')[0]);

  // Dashboard & Feedback State
  const [feedback, setFeedback] = useState<string | null>(null);
  const [errorFeedback, setErrorFeedback] = useState<string | null>(null);
  const [historyMode, setHistoryMode] = useState<'none' | 'items' | 'financial' | 'payments'>('none');

  // --- Calculations ---
  const today = new Date().toDateString();
  
  const myDrafts = useMemo(() => 
    drafts.filter(d => d.type === 'PRODUCTION' && d.userId === currentUser?.id)
          .sort((a,b) => b.createdAt - a.createdAt),
  [drafts, currentUser]);

  // Filter Items by User AND Active Period
  const myPeriodProduction = useMemo(() => 
    productionItems.filter(p => p.producedBy === currentUser?.id && p.periodId === activePeriodId),
  [productionItems, currentUser, activePeriodId]);

  // Filter Payments by User AND Active Period
  const myPeriodPayments = useMemo(() => 
    payments.filter(p => p.employeeId === currentUser?.id && p.periodId === activePeriodId),
  [payments, currentUser, activePeriodId]);

  const myTodaysProduction = myPeriodProduction.filter(p => 
    new Date(p.createdAt).toDateString() === today
  );
  
  const dailyTotalQty = myTodaysProduction.length;
  const dailyEarnings = myTodaysProduction.reduce((acc, item) => acc + (item.productionValue || 0), 0);

  const totalProducedValue = myPeriodProduction.reduce((acc, item) => acc + (item.productionValue || 0), 0);
  const totalReceivedValue = myPeriodPayments.reduce((acc, pay) => acc + pay.amount, 0);
  const currentBalance = totalProducedValue - totalReceivedValue;

  const availableModels = useMemo(() => {
    return vaseModels.filter(v => v.type === selectedType);
  }, [selectedType, vaseModels]);

  // --- Preferences Check ---
  const prefs = useMemo(() => {
     if (!currentUser) return null;
     // Default fallback if not set yet
     return userPreferences[currentUser.id] || {
        showFinancials: true,
        showProductionQty: true,
        showGoalsBar: true
     };
  }, [currentUser, userPreferences]);

  // --- Handlers ---

  const startNewProduction = () => {
    setDraftItems([]);
    setSelectedDate(new Date().toISOString().split('T')[0]);
    setViewMode('REGISTER');
  };

  const addToDraft = (model: VaseModel) => {
    setDraftItems(prev => {
      const existing = prev.find(i => i.model.id === model.id);
      if (existing) {
        return prev.map(i => i.model.id === model.id ? { ...i, quantity: i.quantity + 1 } : i);
      }
      return [...prev, { model, quantity: 1 }];
    });
  };

  const removeFromDraft = (modelId: string) => {
    setDraftItems(prev => {
      const existing = prev.find(i => i.model.id === modelId);
      if (existing && existing.quantity > 1) {
        return prev.map(i => i.model.id === modelId ? { ...i, quantity: i.quantity - 1 } : i);
      }
      return prev.filter(i => i.model.id !== modelId);
    });
  };

  const handleSaveAsDraft = () => {
    if (draftItems.length === 0 || !currentUser) return;
    
    const productionDate = new Date(selectedDate + 'T12:00:00').getTime();

    const productionData: DraftItemContent[] = draftItems.map(d => ({
       modelId: d.model.id,
       quantity: d.quantity
    }));

    const newDraft: Draft = {
       id: uuidv4(),
       type: 'PRODUCTION',
       sector: currentUser.sector as any,
       userId: currentUser.id,
       selectedDate: productionDate,
       createdAt: Date.now(),
       productionData: productionData
    };

    addDraft(newDraft);
    setFeedback('Rascunho salvo!');
    setTimeout(() => setFeedback(null), 2000);
    setViewMode('DASHBOARD');
  };

  const handleEditDraft = (draft: Draft) => {
    if (!draft.productionData) return;
    
    const reconstructed: {model: VaseModel, quantity: number}[] = [];
    draft.productionData.forEach(item => {
      const model = vaseModels.find(v => v.id === item.modelId);
      if (model) {
        reconstructed.push({ model, quantity: item.quantity });
      }
    });

    setDraftItems(reconstructed);
    setSelectedDate(new Date(draft.selectedDate).toISOString().split('T')[0]);
    
    if (reconstructed.length > 0) {
      setSelectedType(reconstructed[0].model.type);
    }
    
    removeDraft(draft.id); // Remove old draft to "update" it
    setViewMode('REGISTER');
  };

  const handleConfirmDraft = (draftId: string) => {
    try {
        confirmDraft(draftId);
        setFeedback('Produção confirmada!');
        setErrorFeedback(null);
        setTimeout(() => setFeedback(null), 2000);
    } catch (e: any) {
        console.error(e);
        setErrorFeedback(e.message || "Erro ao confirmar produção.");
        setTimeout(() => setErrorFeedback(null), 5000);
    }
  };

  // --- RENDERERS ---

  if (viewMode === 'SETTINGS') {
      return <EmployeeSettingsScreen onBack={() => setViewMode('DASHBOARD')} />;
  }

  if (viewMode === 'GOALS' && currentUser) {
     return (
        <GoalsDetailView 
           onBack={() => setViewMode('DASHBOARD')}
           goals={goals}
           productionItems={productionItems} // Goal view filters by period internally or uses periodId
           sector={Sector.PRODUCTION}
           userId={currentUser.id}
           vaseModels={vaseModels}
        />
     );
  }

  if (viewMode === 'REGISTER') {
    const totalItems = draftItems.reduce((a, b) => a + b.quantity, 0);
    const totalValue = draftItems.reduce((a, b) => a + (b.quantity * b.model.costProduction), 0);

    return (
      <div className="bg-background min-h-screen flex flex-col">
        {/* Header */}
        <div className="bg-surface p-4 sticky top-0 z-20 shadow-sm flex items-center justify-between border-b border-outline-variant">
          <Button variant="ghost" onClick={() => setViewMode('DASHBOARD')} className="text-on-surface-variant -ml-2">
            <ArrowLeft className="w-6 h-6 mr-1" /> Voltar
          </Button>
          <h1 className="text-lg font-medium text-on-surface">Nova Produção</h1>
          <div className="w-10"></div>
        </div>

        {/* Scrollable Content */}
        <div className="flex-1 p-4 pb-32 space-y-6">
          
          {/* Date Picker Card */}
          <div className="bg-surface p-4 rounded-2xl border border-outline-variant shadow-sm">
            <label className="text-xs font-bold text-on-surface-variant uppercase tracking-wider mb-2 flex items-center gap-2">
              <Calendar className="w-4 h-4" /> Data da Produção
            </label>
            <input 
              type="date" 
              className="w-full p-3 bg-surface-variant text-on-surface border border-outline-variant rounded-xl focus:outline-none focus:ring-2 focus:ring-primary text-lg"
              value={selectedDate}
              onChange={(e) => setSelectedDate(e.target.value)}
            />
          </div>

          {/* Type Selector */}
          <div className="flex bg-surface-variant p-1 rounded-xl border border-outline-variant">
            <button 
              onClick={() => setSelectedType(VaseType.WITH_SHELL)}
              className={`flex-1 py-3 px-4 rounded-lg text-sm font-bold transition-all ${
                selectedType === VaseType.WITH_SHELL 
                  ? 'bg-primary text-on-primary shadow-sm' 
                  : 'text-on-surface-variant hover:text-on-surface'
              }`}
            >
              Com Casca
            </button>
            <button 
              onClick={() => setSelectedType(VaseType.WITHOUT_SHELL)}
              className={`flex-1 py-3 px-4 rounded-lg text-sm font-bold transition-all ${
                selectedType === VaseType.WITHOUT_SHELL 
                  ? 'bg-secondary text-on-secondary shadow-sm' 
                  : 'text-on-surface-variant hover:text-on-surface'
              }`}
            >
              Sem Casca
            </button>
          </div>

          {/* Models List */}
          <div className="space-y-3">
            <p className="text-sm font-medium text-on-surface-variant ml-2 uppercase tracking-wide">Modelos Disponíveis</p>
            {availableModels.map(model => {
              const inDraft = draftItems.find(i => i.model.id === model.id)?.quantity || 0;
              return (
                <div key={model.id} className="bg-surface border border-outline-variant rounded-2xl p-4 flex items-center justify-between shadow-sm">
                  <div>
                    <p className="font-bold text-lg text-on-surface">{model.name}</p>
                    <p className="text-sm text-on-surface-variant mt-0.5">Mão de obra: <span className="font-bold text-success">R$ {model.costProduction.toFixed(2)}</span></p>
                  </div>

                  <div className="flex items-center gap-4">
                    <button 
                      onClick={() => removeFromDraft(model.id)}
                      disabled={inDraft === 0}
                      className="w-10 h-10 rounded-full bg-surface-variant border border-outline-variant flex items-center justify-center text-on-surface-variant disabled:opacity-30 active:scale-95 transition-all"
                    >
                      <Minus className="w-5 h-5" />
                    </button>
                    
                    <span className={`w-6 text-center text-xl font-bold ${inDraft > 0 ? 'text-primary' : 'text-on-surface-variant'}`}>
                      {inDraft}
                    </span>

                    <button 
                      onClick={() => addToDraft(model)}
                      className="w-10 h-10 rounded-full bg-primary-container border border-primary/20 flex items-center justify-center text-on-primary-container active:scale-95 transition-all hover:brightness-110"
                    >
                      <Plus className="w-5 h-5" />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Fixed Footer */}
        <div className="bg-surface border-t border-outline-variant p-4 fixed bottom-0 left-0 right-0 z-30 shadow-[0_-4px_20px_rgba(0,0,0,0.1)]">
           <div className="max-w-3xl mx-auto flex items-center justify-between gap-4">
              <div>
                 <p className="text-xs text-on-surface-variant uppercase font-bold">Resumo</p>
                 <div className="flex items-baseline gap-1">
                    <span className="text-2xl font-bold text-on-surface">{totalItems}</span>
                    <span className="text-sm text-on-surface-variant">itens</span>
                 </div>
                 <p className="text-xs text-success font-medium">Est. R$ {totalValue.toFixed(2)}</p>
              </div>
              
              <Button 
                onClick={handleSaveAsDraft} 
                disabled={totalItems === 0}
                className="flex-1 h-12 bg-secondary-container text-on-secondary-container rounded-xl font-bold text-base shadow-none"
              >
                 <Save className="w-5 h-5 mr-2" />
                 Adicionar ao Rascunho
              </Button>
           </div>
        </div>
      </div>
    );
  }

  // DASHBOARD VIEW
  return (
    <div className="pb-32 bg-background min-h-screen">
      {/* Top App Bar */}
      <div className="bg-surface p-4 sticky top-0 z-10 shadow-sm flex items-center justify-between border-b border-outline-variant">
         <Button variant="ghost" onClick={logout} className="text-on-surface-variant">
            <ArrowLeft className="w-6 h-6" />
         </Button>
         <h1 className="text-xl font-medium text-on-surface">Setor de Produção</h1>
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
              sector={Sector.PRODUCTION} 
              userId={currentUser.id} 
              onClick={() => setViewMode('GOALS')}
           />
        )}

        {/* Financial Dashboard - Solid Background */}
        {(prefs?.showFinancials || prefs?.showProductionQty) && (
          <div className="bg-primary rounded-3xl p-6 text-on-primary shadow-lg relative overflow-hidden">
            <div className="flex justify-between items-start mb-6 relative z-10">
              <div>
                <p className="text-on-primary font-medium opacity-90">Olá, {currentUser?.name}</p>
                <h2 className="text-2xl font-bold">Seu desempenho</h2>
              </div>
              <div className="bg-primary-container p-2 rounded-xl text-on-primary-container">
                <TrendingUp className="w-5 h-5" />
              </div>
            </div>
            
            <div className="grid grid-cols-2 gap-4 relative z-10">
              {/* Card 1: Daily Production (Conditional) */}
              {prefs?.showProductionQty && (
                <button 
                    onClick={() => setHistoryMode('items')}
                    className="bg-primary-container text-on-primary-container rounded-2xl p-4 active:scale-95 transition-all text-left group cursor-pointer ring-offset-2 focus:ring-2 ring-primary outline-none shadow-sm h-full flex flex-col justify-between"
                >
                    <div className="flex items-center gap-2 mb-1 opacity-80">
                      <ClipboardList className="w-4 h-4" />
                      <span className="text-sm font-medium">Hoje</span>
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
              
              {/* Card 2: Current Balance (Conditional) */}
              {prefs?.showFinancials && (
                <button 
                    onClick={() => setHistoryMode('financial')} 
                    className={`bg-primary-container text-on-primary-container rounded-2xl p-4 active:scale-95 transition-all text-left group cursor-pointer ring-offset-2 focus:ring-2 ring-primary outline-none shadow-sm h-full flex flex-col justify-between ${!prefs.showProductionQty ? 'col-span-2' : ''}`}
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
                <FileText className="w-5 h-5 text-secondary" />
                <h3 className="text-lg font-medium text-on-background">Rascunhos Pendentes</h3>
                <span className="bg-secondary-container text-on-secondary-container text-xs font-bold px-2 py-0.5 rounded-full">{myDrafts.length}</span>
             </div>
             
             <div className="space-y-3">
               {myDrafts.map(draft => {
                 const totalQty = draft.productionData?.reduce((a,b) => a + b.quantity, 0) || 0;
                 const draftDate = new Date(draft.selectedDate).toLocaleDateString();
                 
                 return (
                   <div key={draft.id} className="bg-surface border border-outline-variant p-5 rounded-2xl relative shadow-sm">
                      <div className="flex justify-between items-start mb-4">
                         <div>
                            <div className="flex items-center gap-2">
                               <p className="font-bold text-lg text-on-surface">Produção de {draftDate}</p>
                            </div>
                            <p className="text-xs text-on-surface-variant mt-0.5">Criado em {new Date(draft.createdAt).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}</p>
                         </div>
                         <div className="flex items-center gap-1">
                            <button onClick={() => handleEditDraft(draft)} className="p-2 text-on-surface-variant hover:text-primary hover:bg-primary-container rounded-full transition-colors" title="Editar">
                               <Edit className="w-5 h-5" />
                            </button>
                            <button onClick={() => removeDraft(draft.id)} className="p-2 text-on-surface-variant hover:text-error hover:bg-error-container rounded-full transition-colors" title="Excluir">
                               <Trash2 className="w-5 h-5" />
                            </button>
                         </div>
                      </div>
                      
                      <div className="flex flex-wrap gap-2 mb-5">
                         {draft.productionData?.map((item, idx) => {
                           const model = vaseModels.find(v => v.id === item.modelId);
                           if (!model) return null;
                           return (
                             <span key={idx} className="text-xs bg-surface-variant text-on-surface-variant font-medium px-3 py-1.5 rounded-lg border border-outline-variant">
                               {item.quantity}x {model.name}
                             </span>
                           )
                         })}
                      </div>

                      <Button onClick={() => handleConfirmDraft(draft.id)} variant="primary" className="w-full gap-2 h-12 text-base font-bold">
                         <Send className="w-5 h-5" /> Confirmar Produção
                      </Button>
                   </div>
                 );
               })}
             </div>
          </div>
        )}
      </div>

      {/* Floating Action Button - Opens New View */}
      <div className="fixed bottom-6 right-6 z-20">
        <Button 
           variant="fab" 
           size="lg" 
           onClick={startNewProduction}
           className="h-16 pl-6 pr-8 rounded-[24px] shadow-xl hover:shadow-2xl transition-all active:scale-95"
        >
          <Plus className="w-6 h-6 mr-3" />
          <span className="text-lg font-medium">Registrar Produção</span>
        </Button>
      </div>

      {/* Snackbar Feedback */}
      {feedback && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 animate-in slide-in-from-bottom fade-in duration-300 w-full px-4 flex justify-center">
           <div className="bg-on-surface text-surface px-6 py-4 rounded-2xl shadow-2xl flex items-center gap-3 border border-outline-variant">
              <Check className="w-5 h-5 text-success" />
              <span className="font-medium">{feedback}</span>
           </div>
        </div>
      )}

      {/* Error Feedback */}
      {errorFeedback && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 animate-in slide-in-from-bottom fade-in duration-300 w-full px-4 flex justify-center">
           <div className="bg-error-container text-on-error-container px-6 py-4 rounded-2xl shadow-2xl flex items-center gap-3 border border-error/20">
              <AlertCircle className="w-5 h-5 text-error" />
              <span className="font-medium text-sm">{errorFeedback}</span>
           </div>
        </div>
      )}

      {/* History Modal Logic */}
      {historyMode === 'financial' ? (
        <Modal isOpen={true} onClose={() => setHistoryMode('none')} title="Detalhes Financeiros" footer={
          <Button variant="ghost" onClick={() => setHistoryMode('none')}>Fechar</Button>
        }>
           <div className="space-y-3 py-2">
             <button onClick={() => setHistoryMode('items')} className="w-full p-4 rounded-2xl bg-surface border border-outline-variant flex justify-between items-center hover:bg-primary-container hover:text-on-primary-container transition-colors group">
               <div className="flex items-center gap-3">
                  <div className="bg-primary-container text-on-primary-container p-2 rounded-full group-hover:bg-primary group-hover:text-on-primary transition-colors"><ClipboardList className="w-5 h-5"/></div>
                  <div className="text-left">
                     <p className="font-bold">Histórico de Produção</p>
                     <p className="text-xs opacity-80">Veja tudo que você produziu</p>
                  </div>
               </div>
               <span className="font-bold text-primary group-hover:text-on-primary-container">R$ {totalProducedValue.toFixed(2)}</span>
             </button>

             <button onClick={() => setHistoryMode('payments')} className="w-full p-4 rounded-2xl bg-surface border border-outline-variant flex justify-between items-center hover:bg-success-container hover:text-on-success-container transition-colors group">
               <div className="flex items-center gap-3">
                  <div className="bg-success-container text-on-success-container p-2 rounded-full group-hover:bg-success group-hover:text-on-success transition-colors"><Wallet className="w-5 h-5"/></div>
                  <div className="text-left">
                     <p className="font-bold">Pagamentos Recebidos</p>
                     <p className="text-xs opacity-80">Extrato de valores pagos</p>
                  </div>
               </div>
               <span className="font-bold text-success group-hover:text-on-success-container">R$ {totalReceivedValue.toFixed(2)}</span>
             </button>

             <div className="mt-4 pt-4 border-t border-outline-variant flex justify-between items-center">
               <span className="text-on-surface-variant font-medium">Saldo a Receber</span>
               <span className="text-xl font-bold text-on-surface">R$ {currentBalance.toFixed(2)}</span>
             </div>
           </div>
        </Modal>
      ) : (
        <HistoryModal 
          isOpen={historyMode !== 'none'}
          onClose={() => setHistoryMode('none')}
          mode={historyMode === 'items' ? 'items' : historyMode === 'payments' ? 'payments' : 'financial'}
          items={myPeriodProduction}
          payments={myPeriodPayments}
          vaseModels={vaseModels}
          valueKey="productionValue"
          title={historyMode === 'items' ? 'Histórico de Produção' : historyMode === 'payments' ? 'Pagamentos Recebidos' : 'Extrato'}
        />
      )}
    </div>
  );
};

export default ProductionScreen;
