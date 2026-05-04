
import React, { useMemo } from 'react';
import { Target, Trophy, Calendar, ChevronRight, BarChart3, AlertCircle } from 'lucide-react';
import { Goal, ProductionItem, VaseModel, Sector } from '../types';
import { Button, Card, cn } from './UI';

interface GoalProgressBarProps {
  goals: Goal[];
  productionItems: ProductionItem[];
  sector: Sector;
  userId: string;
  onClick: () => void;
}

export const GoalProgressBar: React.FC<GoalProgressBarProps> = ({ goals, productionItems, sector, userId, onClick }) => {
  const activeGoal = useMemo(() => {
    const now = Date.now();
    // Prefer Weekly goals, else Monthly, else Daily
    const userGoals = goals.filter(g => 
      g.employeeId === userId && 
      g.sector === sector &&
      g.startDate <= now && 
      g.endDate >= now
    );
    
    return userGoals.find(g => g.period === 'WEEKLY') || 
           userGoals.find(g => g.period === 'MONTHLY') || 
           userGoals.find(g => g.period === 'DAILY');
  }, [goals, userId, sector]);

  const progress = useMemo(() => {
    if (!activeGoal) return { total: 0, current: 0, percent: 0 };
    
    const itemsInPeriod = productionItems.filter(p => {
       const isUser = (sector === Sector.PRODUCTION && p.producedBy === userId) ||
                      (sector === Sector.FINISHING && p.finishedBy === userId) ||
                      (sector === Sector.PAINTING && p.paintedBy === userId);
       return isUser && p.updatedAt >= activeGoal.startDate && p.updatedAt <= activeGoal.endDate;
    });

    const current = itemsInPeriod.length;
    const percent = Math.min(100, Math.round((current / activeGoal.totalQuantityTarget) * 100));
    
    return { total: activeGoal.totalQuantityTarget, current, percent };
  }, [activeGoal, productionItems, sector, userId]);

  if (!activeGoal) {
    return (
       <button onClick={onClick} className="w-full bg-surface border border-outline-variant p-4 rounded-3xl flex items-center justify-between group active:scale-[0.98] transition-all">
          <div className="flex items-center gap-3">
             <div className="bg-surface-variant p-2 rounded-full text-on-surface-variant group-hover:bg-primary-container group-hover:text-on-primary-container transition-colors">
                <Target className="w-5 h-5" />
             </div>
             <div className="text-left">
                <p className="font-bold text-on-surface text-sm">Metas</p>
                <p className="text-xs text-on-surface-variant">Toque para ver detalhes</p>
             </div>
          </div>
          <ChevronRight className="w-5 h-5 text-on-surface-variant" />
       </button>
    );
  }

  return (
    <button onClick={onClick} className="w-full bg-surface border border-outline-variant p-5 rounded-3xl relative overflow-hidden group active:scale-[0.98] transition-all text-left">
       <div className="flex justify-between items-start mb-2 relative z-10">
          <div>
             <p className="text-xs font-bold text-on-surface-variant uppercase tracking-wider mb-0.5">Meta {activeGoal.period === 'WEEKLY' ? 'Semanal' : activeGoal.period === 'MONTHLY' ? 'Mensal' : 'Diária'}</p>
             <div className="flex items-baseline gap-1">
                <span className="text-2xl font-bold text-on-surface">{progress.current}</span>
                <span className="text-sm text-on-surface-variant font-medium">/ {progress.total}</span>
             </div>
          </div>
          <div className="bg-primary-container text-on-primary-container px-2 py-1 rounded-lg text-xs font-bold flex items-center gap-1">
             <Trophy className="w-3 h-3" />
             {progress.percent}%
          </div>
       </div>
       
       {/* Progress Bar Track */}
       <div className="w-full h-3 bg-surface-variant rounded-full overflow-hidden relative z-10">
          <div 
             className="h-full bg-primary transition-all duration-1000 ease-out rounded-full"
             style={{ width: `${progress.percent}%` }}
          />
       </div>

       {/* Decorative Background */}
       <div className="absolute right-0 top-0 bottom-0 w-24 bg-gradient-to-l from-primary-container/20 to-transparent pointer-events-none" />
    </button>
  );
};

interface GoalsDetailViewProps {
   onBack: () => void;
   goals: Goal[];
   productionItems: ProductionItem[];
   sector: Sector;
   userId: string;
   vaseModels: VaseModel[];
}

export const GoalsDetailView: React.FC<GoalsDetailViewProps> = ({ onBack, goals, productionItems, sector, userId, vaseModels }) => {
   // Filter Active Goals
   const activeGoals = useMemo(() => {
      const now = Date.now();
      return goals.filter(g => 
        g.employeeId === userId && 
        g.sector === sector &&
        g.startDate <= now && 
        g.endDate >= now
      ).sort((a, b) => {
         // Priority: Daily -> Weekly -> Monthly
         const p = { 'DAILY': 1, 'WEEKLY': 2, 'MONTHLY': 3 };
         return p[a.period] - p[b.period];
      });
   }, [goals, userId, sector]);

   const getProgress = (goal: Goal) => {
      const itemsInPeriod = productionItems.filter(p => {
         const isUser = (sector === Sector.PRODUCTION && p.producedBy === userId) ||
                        (sector === Sector.FINISHING && p.finishedBy === userId) ||
                        (sector === Sector.PAINTING && p.paintedBy === userId);
         return isUser && p.updatedAt >= goal.startDate && p.updatedAt <= goal.endDate;
      });
      return itemsInPeriod;
   };

   return (
      <div className="bg-background min-h-screen flex flex-col animate-in slide-in-from-right duration-300">
         {/* Header */}
         <div className="bg-surface p-4 sticky top-0 z-20 shadow-sm flex items-center gap-4 border-b border-outline-variant">
            <Button variant="ghost" onClick={onBack} className="text-on-surface-variant -ml-2">
               <ChevronRight className="w-6 h-6 rotate-180" />
            </Button>
            <h1 className="text-xl font-medium text-on-surface">Minhas Metas</h1>
         </div>

         <div className="p-4 space-y-6 flex-1 overflow-y-auto pb-24">
            {activeGoals.length === 0 ? (
               <div className="flex flex-col items-center justify-center py-20 text-on-surface-variant bg-surface rounded-3xl border border-dashed border-outline-variant">
                  <div className="w-16 h-16 bg-surface-variant rounded-full flex items-center justify-center mb-4">
                     <Target className="w-8 h-8 opacity-50" />
                  </div>
                  <p className="font-medium text-lg">Sem metas ativas</p>
                  <p className="text-sm opacity-70 mt-1 text-center px-6">Seu supervisor ainda não definiu metas para o período atual.</p>
               </div>
            ) : (
               activeGoals.map(goal => {
                  const items = getProgress(goal);
                  const current = items.length;
                  const percent = Math.min(100, Math.round((current / goal.totalQuantityTarget) * 100));
                  
                  return (
                     <div key={goal.id} className="bg-surface rounded-3xl border border-outline-variant shadow-sm overflow-hidden">
                        {/* Goal Header */}
                        <div className="p-5 bg-surface-variant/30 border-b border-outline-variant">
                           <div className="flex justify-between items-center mb-2">
                              <span className="bg-primary text-on-primary px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wide">
                                 {goal.period === 'DAILY' ? 'Diária' : goal.period === 'WEEKLY' ? 'Semanal' : 'Mensal'}
                              </span>
                              <div className="flex items-center gap-1 text-xs text-on-surface-variant font-medium">
                                 <Calendar className="w-3.5 h-3.5" />
                                 {new Date(goal.endDate).toLocaleDateString()}
                              </div>
                           </div>
                           <div className="flex items-end justify-between">
                              <div>
                                 <p className="text-3xl font-bold text-on-surface">{current}</p>
                                 <p className="text-xs text-on-surface-variant uppercase font-bold mt-1">Realizado</p>
                              </div>
                              <div className="text-right">
                                 <p className="text-xl font-bold text-on-surface-variant opacity-70">/ {goal.totalQuantityTarget}</p>
                                 <p className="text-xs text-on-surface-variant uppercase font-bold mt-1">Alvo</p>
                              </div>
                           </div>
                           <div className="mt-4 w-full h-4 bg-surface-variant rounded-full overflow-hidden">
                              <div className="h-full bg-primary transition-all duration-1000" style={{ width: `${percent}%` }} />
                           </div>
                        </div>

                        {/* Model Breakdown */}
                        {goal.modelTargets && goal.modelTargets.length > 0 && (
                           <div className="p-4 bg-surface">
                              <p className="text-xs font-bold text-on-surface-variant uppercase tracking-wider mb-3 flex items-center gap-2">
                                 <BarChart3 className="w-4 h-4" /> Detalhamento por Modelo
                              </p>
                              <div className="space-y-3">
                                 {goal.modelTargets.map((target, idx) => {
                                    const model = vaseModels.find(m => m.id === target.modelId);
                                    if (!model) return null;
                                    
                                    const modelCurrent = items.filter(i => i.modelId === target.modelId).length;
                                    const modelPercent = Math.min(100, Math.round((modelCurrent / target.targetQuantity) * 100));
                                    const isComplete = modelCurrent >= target.targetQuantity;

                                    return (
                                       <div key={idx} className="flex items-center gap-4">
                                          <div className="flex-1">
                                             <div className="flex justify-between text-sm mb-1">
                                                <span className="font-medium text-on-surface">{model.name}</span>
                                                <span className={isComplete ? "text-success font-bold" : "text-on-surface-variant"}>
                                                   {modelCurrent} / {target.targetQuantity}
                                                </span>
                                             </div>
                                             <div className="w-full h-2 bg-surface-variant rounded-full overflow-hidden">
                                                <div 
                                                   className={cn("h-full rounded-full", isComplete ? "bg-success" : "bg-secondary")} 
                                                   style={{ width: `${modelPercent}%` }} 
                                                />
                                             </div>
                                          </div>
                                       </div>
                                    );
                                 })}
                              </div>
                           </div>
                        )}
                        
                        {(!goal.modelTargets || goal.modelTargets.length === 0) && (
                           <div className="p-4 flex items-center gap-2 text-on-surface-variant text-sm bg-surface-variant/20">
                              <AlertCircle className="w-4 h-4" />
                              <span>Meta geral por quantidade total.</span>
                           </div>
                        )}
                     </div>
                  );
               })
            )}
         </div>
      </div>
   );
};
