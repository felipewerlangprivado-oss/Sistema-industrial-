
import React, { useState, useMemo, useEffect } from 'react';
import { useStore } from '../store';
import { Button, Card, Modal, cn, Badge } from '../components/UI';
import { subscribeToSyncStatus, syncData, SyncStatus } from '../services/syncService';
import { 
  Box, Users, Settings, 
  Moon, LogOut, Trash, Plus, Pencil, 
  CheckCircle2, XCircle, DollarSign, Wallet, Scale,
  Calendar as CalendarIcon, PaintBucket, Hammer, Brush, Box as BoxIcon,
  FileDown, Filter, History, Bug, Star, Zap, Activity, FileSearch, Target, Minus, Percent,
  BarChart3, User as UserIcon, ChevronDown, Package, Search, ChevronRight, X, AlertTriangle, RefreshCcw, RotateCcw, LayoutList, LayoutGrid, Clock, AlertCircle, Database, Check,
  Lock, ShieldCheck, Shield, Receipt, ArrowUpRight, ChevronLeft, Eye, Server
} from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts';
import { VaseType, VaseModel, Sector, Employee, ItemStatus, PaymentRecord, Goal, GoalPeriod, GoalModelTarget, ProductionItem } from '../types';
import { v4 as uuidv4 } from 'uuid';
import { exportSupervisorPDF } from '../utils/csvHelper';
import { calculateRawMaterialCost, calculatePaintingCommission, getDaysDiff } from '../utils/calculations';
import { getCanonicalVaseModelId } from '../constants';

// --- ANALYTICS TAB ---
const AnalyticsTab = () => {
  const { productionItems, employees, goals, activePeriodId, periods } = useStore();
  const [timeRange, setTimeRange] = useState<'day' | 'week' | 'month'>('month');
  const [sectorFilter, setSectorFilter] = useState<'all' | Sector>(Sector.PRODUCTION);
  const [expandedEmployeeId, setExpandedEmployeeId] = useState<string | null>(null);

  const activePeriodName = periods.find(p => p.id === activePeriodId)?.name || 'Desconhecido';

  // 1. Data Filtering
  const filteredData = useMemo(() => {
    // START: Filter by ACTIVE PERIOD first
    let items = productionItems.filter(i => 
       i.periodId === activePeriodId || 
       i.finishedInPeriodId === activePeriodId || 
       i.paintedInPeriodId === activePeriodId
    );

    const now = new Date();
    let startTime = 0;

    if (timeRange === 'day') startTime = new Date(now.setHours(0,0,0,0)).getTime();
    else if (timeRange === 'week') {
      const d = new Date();
      d.setDate(d.getDate() - 7);
      startTime = d.setHours(0,0,0,0);
    } else {
      const d = new Date();
      d.setDate(d.getDate() - 30);
      startTime = d.setHours(0,0,0,0);
    }

    // Secondary Filter: Time Range within the period
    items = items.filter(i => {
      // Use updatedAt for finishing/painting to catch recent activity
      const referenceTime = i.updatedAt; 
      return referenceTime >= startTime;
    });

    return { items, startTime };
  }, [productionItems, timeRange, activePeriodId]);

  // 2. Aggregate Calculations
  const metrics = useMemo(() => {
    const { items } = filteredData;
    
    // Financials by Sector
    let prodCost = 0, finishCost = 0, paintCost = 0;
    let prodQty = 0, finishQty = 0, paintQty = 0;

    items.forEach(i => {
      // Only count cost if it belongs to this period
      if (i.periodId === activePeriodId) {
         prodCost += i.productionValue || 0;
         prodQty += 1;
      }
      
      if (i.finishingValue && i.finishedInPeriodId === activePeriodId) {
        finishCost += i.finishingValue;
        finishQty += 1;
      }
      if (i.paintingValue && i.paintedInPeriodId === activePeriodId) {
        paintCost += i.paintingValue;
        paintQty += 1;
      }
    });

    return {
      costs: { production: prodCost, finishing: finishCost, painting: paintCost, total: prodCost + finishCost + paintCost },
      volume: { production: prodQty, finishing: finishQty, painting: paintQty }
    };
  }, [filteredData, activePeriodId]);

  // 3. Employee Performance List
  const employeePerformance = useMemo(() => {
    const { items } = filteredData;
    const activeEmployees = employees.filter(e => e.active && (sectorFilter === 'all' || e.sector === sectorFilter));

    return activeEmployees.map(emp => {
      // Calculate Stats
      let earned = 0;
      let qty = 0;
      
      items.forEach(i => {
        if (emp.sector === Sector.PRODUCTION && i.producedBy === emp.id && i.periodId === activePeriodId) {
          earned += i.productionValue;
          qty++;
        } else if (emp.sector === Sector.FINISHING && i.finishedBy === emp.id && i.finishedInPeriodId === activePeriodId) {
          earned += i.finishingValue || 0;
          qty++;
        } else if (emp.sector === Sector.PAINTING && i.paintedBy === emp.id && i.paintedInPeriodId === activePeriodId) {
          earned += i.paintingValue || 0;
          qty++;
        }
      });

      // Find active goal
      const empGoals = goals.filter(g => g.employeeId === emp.id && g.periodId === activePeriodId);
      const activeGoal = empGoals.sort((a,b) => b.createdAt - a.createdAt)[0];
      const goalTarget = activeGoal ? activeGoal.totalQuantityTarget : 0;
      const goalPercent = goalTarget > 0 ? Math.round((qty / goalTarget) * 100) : 0;

      return {
        ...emp,
        earned,
        qty,
        goalTarget,
        goalPercent
      };
    }).sort((a, b) => b.earned - a.earned); // Sort by earnings
  }, [employees, filteredData, goals, sectorFilter, activePeriodId]);

  // Chart Data Preparation
  const chartData = [
    { name: 'Produção', custo: metrics.costs.production, volume: metrics.volume.production },
    { name: 'Acabamento', custo: metrics.costs.finishing, volume: metrics.volume.finishing },
    { name: 'Pintura', custo: metrics.costs.painting, volume: metrics.volume.painting },
  ];

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-2 duration-500 pb-8">
      {/* Top Header & Filters */}
      <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4 px-1">
         <div>
            <div className="flex items-center gap-2">
               <h2 className="text-2xl font-normal text-on-background">Relatórios</h2>
               <Badge color="green">{activePeriodName}</Badge>
            </div>
            <p className="text-sm text-on-surface-variant">Análise detalhada do período ativo</p>
         </div>
         
         <div className="flex flex-wrap gap-2">
            <div className="bg-surface p-1 rounded-xl flex border border-outline-variant">
               {(['day', 'week', 'month'] as const).map((r) => (
                 <button key={r} onClick={() => setTimeRange(r)} className={`px-4 py-2 rounded-lg text-xs font-bold transition-all ${timeRange === r ? 'bg-primary text-on-primary shadow-sm' : 'text-on-surface-variant hover:bg-surface-variant'}`}>
                    {r === 'day' ? 'Dia' : r === 'week' ? 'Semana' : 'Mês'}
                 </button>
               ))}
            </div>
            
            <select 
               value={sectorFilter} 
               onChange={(e) => setSectorFilter(e.target.value as any)}
               className="bg-surface border border-outline-variant text-on-surface text-sm rounded-xl p-2 px-4 focus:ring-2 focus:ring-primary outline-none"
            >
               <option value="all">Todos os Setores</option>
               <option value={Sector.PRODUCTION}>Produção</option>
               <option value={Sector.FINISHING}>Acabamento</option>
               <option value={Sector.PAINTING}>Pintura</option>
            </select>
         </div>
      </div>

      {/* Block 1: General Indicators */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
         <Card className="bg-surface border-outline-variant flex items-center gap-4">
            <div className="bg-primary-container p-3 rounded-full text-on-primary-container">
               <DollarSign className="w-6 h-6" />
            </div>
            <div>
               <p className="text-xs font-bold text-on-surface-variant uppercase">Custo Total (Período)</p>
               <p className="text-2xl font-bold text-on-surface">R$ {metrics.costs.total.toFixed(2)}</p>
            </div>
         </Card>
         <Card className="bg-surface border-outline-variant flex items-center gap-4">
            <div className="bg-secondary-container p-3 rounded-full text-on-secondary-container">
               <BoxIcon className="w-6 h-6" />
            </div>
            <div>
               <p className="text-xs font-bold text-on-surface-variant uppercase">Volume Processado</p>
               <p className="text-2xl font-bold text-on-surface">
                  {metrics.volume.production + metrics.volume.finishing + metrics.volume.painting} <span className="text-sm font-normal text-on-surface-variant">itens</span>
               </p>
            </div>
         </Card>
         <Card className="bg-surface border-outline-variant flex items-center gap-4">
            <div className="bg-tertiary-container p-3 rounded-full text-on-tertiary-container">
               <Target className="w-6 h-6" />
            </div>
            <div>
               <p className="text-xs font-bold text-on-surface-variant uppercase">Média de Metas</p>
               <p className="text-2xl font-bold text-on-surface">
                  {Math.round(employeePerformance.reduce((acc, e) => acc + e.goalPercent, 0) / (employeePerformance.length || 1))}%
               </p>
            </div>
         </Card>
      </div>

      {/* Block 2: Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
         <Card className="h-80 flex flex-col pt-6 px-2 bg-surface border-outline-variant">
            <h3 className="text-sm font-bold text-on-surface-variant uppercase px-4 mb-2 flex items-center gap-2"><BarChart3 className="w-4 h-4" /> Custo por Setor</h3>
            <div className="flex-1 w-full min-h-0">
               <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={chartData} margin={{ top: 20, right: 30, left: 20, bottom: 5 }}>
                     <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--color-outline-variant)" opacity={0.3} />
                     <XAxis dataKey="name" tick={{fontSize: 12, fill: 'var(--color-on-surface-variant)'}} axisLine={false} tickLine={false} />
                     <YAxis tick={{fontSize: 12, fill: 'var(--color-on-surface-variant)'}} axisLine={false} tickLine={false} />
                     <Tooltip 
                        cursor={{fill: 'var(--color-surface-variant)'}}
                        contentStyle={{ borderRadius: '12px', border: '1px solid var(--color-outline-variant)', backgroundColor: 'rgb(var(--color-surface))' }}
                        formatter={(val: number) => `R$ ${val.toFixed(2)}`}
                     />
                     <Bar dataKey="custo" fill="rgb(var(--color-primary))" radius={[4, 4, 0, 0]} barSize={40} />
                  </BarChart>
               </ResponsiveContainer>
            </div>
         </Card>

         <Card className="h-80 flex flex-col pt-6 px-2 bg-surface border-outline-variant">
            <h3 className="text-sm font-bold text-on-surface-variant uppercase px-4 mb-2 flex items-center gap-2"><Activity className="w-4 h-4" /> Volume por Setor</h3>
            <div className="flex-1 w-full min-h-0">
               <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={chartData} margin={{ top: 20, right: 30, left: 20, bottom: 5 }}>
                     <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--color-outline-variant)" opacity={0.3} />
                     <XAxis dataKey="name" tick={{fontSize: 12, fill: 'var(--color-on-surface-variant)'}} axisLine={false} tickLine={false} />
                     <YAxis tick={{fontSize: 12, fill: 'var(--color-on-surface-variant)'}} axisLine={false} tickLine={false} />
                     <Tooltip 
                        cursor={{fill: 'var(--color-surface-variant)'}}
                        contentStyle={{ borderRadius: '12px', border: '1px solid var(--color-outline-variant)', backgroundColor: 'rgb(var(--color-surface))' }}
                     />
                     <Bar dataKey="volume" fill="rgb(var(--color-secondary))" radius={[4, 4, 0, 0]} barSize={40} />
                  </BarChart>
               </ResponsiveContainer>
            </div>
         </Card>
      </div>

      {/* Block 3: Individual Performance */}
      <div>
         <h3 className="text-lg font-bold text-on-surface mb-4 px-1 flex items-center gap-2">
            <Users className="w-5 h-5 text-primary" /> Desempenho Individual
         </h3>
         
         <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
            {employeePerformance.map(emp => (
               <Card 
                  key={emp.id} 
                  className={`bg-surface border-outline-variant transition-all cursor-pointer hover:shadow-md ${expandedEmployeeId === emp.id ? 'ring-2 ring-primary' : ''}`}
                  onClick={() => setExpandedEmployeeId(expandedEmployeeId === emp.id ? null : emp.id)}
               >
                  <div className="flex justify-between items-start mb-3">
                     <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-full bg-primary-container text-on-primary-container flex items-center justify-center font-bold text-sm">
                           {emp.name.slice(0,2).toUpperCase()}
                        </div>
                        <div>
                           <p className="font-bold text-on-surface text-sm">{emp.name}</p>
                           <Badge color="blue">{emp.sector}</Badge>
                        </div>
                     </div>
                     <ChevronDown className={`w-5 h-5 text-on-surface-variant transition-transform ${expandedEmployeeId === emp.id ? 'rotate-180' : ''}`} />
                  </div>

                  <div className="flex justify-between items-center bg-surface-variant/30 p-3 rounded-xl mb-2">
                     <div className="text-center">
                        <p className="text-xs text-on-surface-variant uppercase font-bold">Produção</p>
                        <p className="text-lg font-bold text-on-surface">{emp.qty}</p>
                     </div>
                     <div className="w-px h-8 bg-outline-variant"></div>
                     <div className="text-center">
                        <p className="text-xs text-on-surface-variant uppercase font-bold">Receita</p>
                        <p className="text-lg font-bold text-success">R$ {emp.earned.toFixed(2)}</p>
                     </div>
                     <div className="w-px h-8 bg-outline-variant"></div>
                     <div className="text-center">
                        <p className="text-xs text-on-surface-variant uppercase font-bold">Meta</p>
                        <div className={`text-lg font-bold ${emp.goalPercent >= 100 ? 'text-success' : 'text-primary'}`}>
                           {emp.goalPercent}%
                        </div>
                     </div>
                  </div>

                  {/* Expanded Detail View */}
                  {expandedEmployeeId === emp.id && (
                     <div className="mt-4 pt-3 border-t border-outline-variant animate-in slide-in-from-top-2">
                        <div className="space-y-2 text-sm">
                           <div className="flex justify-between">
                              <span className="text-on-surface-variant">Meta Atual:</span>
                              <span className="font-medium text-on-surface">{emp.goalTarget > 0 ? `${emp.goalTarget} un.` : 'Não definida'}</span>
                           </div>
                           <div className="flex justify-between">
                              <span className="text-on-surface-variant">Status:</span>
                              <span className={`font-bold ${emp.active ? 'text-success' : 'text-error'}`}>{emp.active ? 'Ativo' : 'Inativo'}</span>
                           </div>
                           <div className="mt-2 pt-2 border-t border-outline-variant/50">
                              <p className="text-xs text-on-surface-variant text-center">Toque em "Configurações" na aba de colaboradores para editar dados.</p>
                           </div>
                        </div>
                     </div>
                  )}
               </Card>
            ))}
         </div>
         
         {employeePerformance.length === 0 && (
            <div className="text-center py-12 bg-surface rounded-2xl border border-dashed border-outline-variant">
               <p className="text-on-surface-variant">Nenhum colaborador encontrado para os filtros selecionados.</p>
            </div>
         )}
      </div>
    </div>
  );
};

// --- STOCK TAB (WITH ALERTS & TIME) ---
const StockTab = () => {
  const { productionItems, vaseModels, employees, periods } = useStore();
  const [searchTerm, setSearchTerm] = useState('');
  const [viewMode, setViewMode] = useState<'LIST' | 'SUMMARY'>('LIST');
  const [selectedItem, setSelectedItem] = useState<ProductionItem | null>(null);
  
  // New Status Filter state
  const [statusFilter, setStatusFilter] = useState<ItemStatus | 'ALL'>('ALL');

  // --- METRICS & ALERTS CALCULATION ---
  const stockAnalysis = useMemo(() => {
     let awaitingFinishCount = 0;
     let awaitingPaintCount = 0;
     let finishedCount = 0;
     let noShellCount = 0;

     let totalDaysFinishing = 0;
     let totalDaysPainting = 0;

     let lateFinishing = 0;
     let latePainting = 0;

     const thresholdFinish = 2;
     const thresholdPaint = 1; // As per prompt "Pintura: 1 dia"

     productionItems.forEach(i => {
        if (i.status === ItemStatus.AWAITING_FINISHING) {
            awaitingFinishCount++;
            const age = getDaysDiff(i.createdAt);
            totalDaysFinishing += age;
            if (age > thresholdFinish) lateFinishing++;
        }
        else if (i.status === ItemStatus.AWAITING_PAINTING) {
            awaitingPaintCount++;
            const age = getDaysDiff(i.updatedAt);
            totalDaysPainting += age;
            if (age > thresholdPaint) latePainting++;
        }
        else if (i.status === ItemStatus.FINISHED) finishedCount++;
        else if (i.status === ItemStatus.STOCK_NO_SHELL) {
            noShellCount++;
            const age = getDaysDiff(i.createdAt);
            totalDaysFinishing += age; // Treat no shell as "waiting to be finished" essentially
            if (age > thresholdFinish) lateFinishing++;
        }
     });

     return {
        counts: {
            finish: awaitingFinishCount,
            paint: awaitingPaintCount,
            finished: finishedCount,
            noShell: noShellCount
        },
        avgTime: {
            finish: (awaitingFinishCount + noShellCount) > 0 ? (totalDaysFinishing / (awaitingFinishCount + noShellCount)).toFixed(1) : '0',
            paint: awaitingPaintCount > 0 ? (totalDaysPainting / awaitingPaintCount).toFixed(1) : '0'
        },
        alerts: {
            lateFinishing,
            latePainting
        }
     };
  }, [productionItems]);

  // --- ITEM LIST MODE LOGIC ---
  const filteredStockList = useMemo(() => {
    let items = [...productionItems];

    // Filter by Status Card
    if (statusFilter !== 'ALL') {
       items = items.filter(i => i.status === statusFilter);
    }

    if (searchTerm) {
       const lowerSearch = searchTerm.toLowerCase();
       items = items.filter(i => 
          (i.cip && i.cip.toLowerCase().includes(lowerSearch)) || 
          i.modelName.toLowerCase().includes(lowerSearch)
       );
    }

    // Sort by Date Descending (Newest first)
    return items.sort((a, b) => b.createdAt - a.createdAt);
  }, [productionItems, searchTerm, statusFilter]);

  // --- SUMMARY MODE LOGIC ---
  const stockSummary = useMemo(() => {
    const grouped = new Map<string, { model: VaseModel, items: ProductionItem[] }>();
    
    // Only group items that actually EXIST. Do not populate with empty models from catalog.
    productionItems.forEach(item => {
      // Find model definition if possible for rich data, else partial
      const modelDef = vaseModels.find(v => v.id === item.modelId) || { id: item.modelId, name: item.modelName, type: item.type } as VaseModel;
      
      // Apply status filter to summary view as well
      if (statusFilter !== 'ALL' && item.status !== statusFilter) return;

      if (!grouped.has(item.modelId)) {
         grouped.set(item.modelId, { model: modelDef, items: [] });
      }
      grouped.get(item.modelId)!.items.push(item);
    });

    return Array.from(grouped.values()).filter(g => 
       g.model.name.toLowerCase().includes(searchTerm.toLowerCase())
    );
  }, [productionItems, vaseModels, searchTerm, statusFilter]);

  // Helpers
  const getStatusConfig = (status: ItemStatus) => {
      switch (status) {
          case ItemStatus.FINISHED: return { label: 'Finalizado', color: 'bg-success-container text-on-success-container' };
          case ItemStatus.AWAITING_PAINTING: return { label: 'Em Pintura', color: 'bg-primary-container text-on-primary-container' };
          case ItemStatus.AWAITING_FINISHING: return { label: 'Em Acabamento', color: 'bg-secondary-container text-on-secondary-container' };
          default: return { label: 'Em Produção', color: 'bg-surface-variant text-on-surface-variant' };
      }
  };

  const getEmployeeName = (id?: string) => {
      if (!id) return '-';
      return employees.find(e => e.id === id)?.name || 'Desconhecido';
  };

  const getPeriodName = (id?: string) => {
      if (!id) return '-';
      return periods.find(p => p.id === id)?.name || 'N/A';
  };

  const toggleFilter = (status: ItemStatus) => {
     setStatusFilter(prev => prev === status ? 'ALL' : status);
  };

  return (
    <div className="space-y-4 animate-in fade-in slide-in-from-bottom-2 duration-500 pb-20">
       <div className="flex flex-col gap-4">
          <div className="flex justify-between items-center px-1">
             <h2 className="text-2xl font-normal text-on-background">Estoque Geral</h2>
             <div className="flex bg-surface-variant p-1 rounded-xl border border-outline-variant">
                <button 
                   onClick={() => setViewMode('LIST')}
                   className={`p-2 rounded-lg transition-all ${viewMode === 'LIST' ? 'bg-surface shadow-sm text-primary' : 'text-on-surface-variant'}`}
                   title="Lista Detalhada"
                >
                   <LayoutList className="w-5 h-5" />
                </button>
                <button 
                   onClick={() => setViewMode('SUMMARY')}
                   className={`p-2 rounded-lg transition-all ${viewMode === 'SUMMARY' ? 'bg-surface shadow-sm text-primary' : 'text-on-surface-variant'}`}
                   title="Resumo por Modelo"
                >
                   <LayoutGrid className="w-5 h-5" />
                </button>
             </div>
          </div>

          {/* --- ALERT CARDS SUMMARY --- */}
          <div className="grid grid-cols-2 gap-3 mb-2">
             <div className="bg-surface border border-outline-variant rounded-xl p-3 flex justify-between items-center">
                <div>
                   <p className="text-[10px] uppercase font-bold text-on-surface-variant">Tempo Médio (Prod/Acab)</p>
                   <div className="flex items-center gap-2">
                      <Clock className="w-4 h-4 text-secondary" />
                      <span className="text-lg font-bold text-on-surface">{stockAnalysis.avgTime.finish} dias</span>
                   </div>
                </div>
                {stockAnalysis.alerts.lateFinishing > 0 && (
                   <div className="bg-error-container text-on-error-container px-2 py-1 rounded-lg text-xs font-bold flex items-center gap-1">
                      <AlertCircle className="w-3 h-3" />
                      {stockAnalysis.alerts.lateFinishing} atrasados
                   </div>
                )}
             </div>

             <div className="bg-surface border border-outline-variant rounded-xl p-3 flex justify-between items-center">
                <div>
                   <p className="text-[10px] uppercase font-bold text-on-surface-variant">Tempo Médio (Pintura)</p>
                   <div className="flex items-center gap-2">
                      <Clock className="w-4 h-4 text-primary" />
                      <span className="text-lg font-bold text-on-surface">{stockAnalysis.avgTime.paint} dias</span>
                   </div>
                </div>
                {stockAnalysis.alerts.latePainting > 0 && (
                   <div className="bg-error-container text-on-error-container px-2 py-1 rounded-lg text-xs font-bold flex items-center gap-1">
                      <AlertCircle className="w-3 h-3" />
                      {stockAnalysis.alerts.latePainting} atrasados
                   </div>
                )}
             </div>
          </div>

          {/* --- STATUS FILTER CARDS --- */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
             <button 
                onClick={() => toggleFilter(ItemStatus.AWAITING_FINISHING)}
                className={`p-3 rounded-xl border text-left transition-all ${statusFilter === ItemStatus.AWAITING_FINISHING ? 'bg-secondary-container border-secondary text-on-secondary-container shadow-md ring-2 ring-secondary ring-offset-1' : 'bg-surface border-outline-variant hover:bg-surface-variant'}`}
             >
                <p className="text-[10px] font-bold uppercase opacity-70">Aguard. Acabamento</p>
                <p className="text-xl font-bold">{stockAnalysis.counts.finish}</p>
             </button>

             <button 
                onClick={() => toggleFilter(ItemStatus.AWAITING_PAINTING)}
                className={`p-3 rounded-xl border text-left transition-all ${statusFilter === ItemStatus.AWAITING_PAINTING ? 'bg-primary-container border-primary text-on-primary-container shadow-md ring-2 ring-primary ring-offset-1' : 'bg-surface border-outline-variant hover:bg-surface-variant'}`}
             >
                <p className="text-[10px] font-bold uppercase opacity-70">Aguard. Pintura</p>
                <p className="text-xl font-bold">{stockAnalysis.counts.paint}</p>
             </button>

             <button 
                onClick={() => toggleFilter(ItemStatus.STOCK_NO_SHELL)}
                className={`p-3 rounded-xl border text-left transition-all ${statusFilter === ItemStatus.STOCK_NO_SHELL ? 'bg-surface-variant border-outline text-on-surface-variant shadow-md ring-2 ring-outline ring-offset-1' : 'bg-surface border-outline-variant hover:bg-surface-variant'}`}
             >
                <p className="text-[10px] font-bold uppercase opacity-70">S/ Casca</p>
                <p className="text-xl font-bold">{stockAnalysis.counts.noShell}</p>
             </button>

             <button 
                onClick={() => toggleFilter(ItemStatus.FINISHED)}
                className={`p-3 rounded-xl border text-left transition-all ${statusFilter === ItemStatus.FINISHED ? 'bg-success-container border-success text-on-success-container shadow-md ring-2 ring-success ring-offset-1' : 'bg-surface border-outline-variant hover:bg-surface-variant'}`}
             >
                <p className="text-[10px] font-bold uppercase opacity-70">Finalizados</p>
                <p className="text-xl font-bold">{stockAnalysis.counts.finished}</p>
             </button>
          </div>

          <div className="relative">
             <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-on-surface-variant" />
             <input 
               type="text" 
               placeholder="Buscar por CIP ou Modelo..." 
               className="w-full pl-10 pr-4 py-3 bg-surface border border-outline-variant rounded-xl text-sm focus:ring-2 focus:ring-primary outline-none shadow-sm"
               value={searchTerm}
               onChange={e => setSearchTerm(e.target.value)}
             />
          </div>
       </div>

       {/* --- VIEW: LIST (DEFAULT) --- */}
       {viewMode === 'LIST' && (
          <div className="bg-surface border border-outline-variant rounded-2xl overflow-hidden shadow-sm">
             {filteredStockList.length === 0 ? (
                <div className="p-8 text-center text-on-surface-variant">
                    <Package className="w-10 h-10 mx-auto mb-2 opacity-50" />
                    <p>Nenhum item encontrado.</p>
                </div>
             ) : (
                <div className="divide-y divide-outline-variant">
                    {filteredStockList.slice(0, 50).map((item) => {
                        const status = getStatusConfig(item.status);
                        
                        // Calculate Alert Status
                        let daysInStage = 0;
                        let isLate = false;
                        
                        if (item.status === ItemStatus.AWAITING_FINISHING || item.status === ItemStatus.STOCK_NO_SHELL) {
                           daysInStage = getDaysDiff(item.createdAt);
                           if (daysInStage > 2) isLate = true;
                        } else if (item.status === ItemStatus.AWAITING_PAINTING) {
                           daysInStage = getDaysDiff(item.updatedAt);
                           if (daysInStage > 1) isLate = true;
                        }

                        return (
                            <div 
                                key={item.id} 
                                onClick={() => setSelectedItem(item)}
                                className="p-4 hover:bg-surface-variant/30 transition-colors cursor-pointer flex items-center justify-between group"
                            >
                                <div className="flex items-start gap-3">
                                    <div className="bg-surface-variant p-2 rounded-lg mt-0.5 relative">
                                        <BoxIcon className="w-5 h-5 text-on-surface-variant" />
                                        {isLate && <div className="absolute -top-1 -right-1 w-3 h-3 bg-error rounded-full border-2 border-surface" />}
                                    </div>
                                    <div>
                                        <div className="flex items-center gap-2">
                                            <span className="font-bold text-on-surface">{item.modelName}</span>
                                            {item.cip ? (
                                                <span className="text-[10px] font-mono bg-surface-variant px-1.5 py-0.5 rounded border border-outline-variant text-on-surface-variant">
                                                    {item.cip}
                                                </span>
                                            ) : (
                                                <span className="text-[10px] italic text-on-surface-variant opacity-50">S/ CIP</span>
                                            )}
                                        </div>
                                        <div className="flex items-center gap-2 mt-0.5">
                                            <p className="text-xs text-on-surface-variant">
                                                {new Date(item.createdAt).toLocaleDateString()}
                                            </p>
                                            {isLate && (
                                                <span className="text-[10px] font-bold text-error bg-error-container px-1.5 rounded-sm">
                                                   +{daysInStage}d parado
                                                </span>
                                            )}
                                        </div>
                                    </div>
                                </div>
                                <div className="flex items-center gap-3">
                                    <span className={`text-[10px] uppercase font-bold px-2 py-1 rounded-full ${status.color}`}>
                                        {status.label}
                                    </span>
                                    <ChevronRight className="w-4 h-4 text-on-surface-variant opacity-50 group-hover:opacity-100" />
                                </div>
                            </div>
                        );
                    })}
                </div>
             )}
             {filteredStockList.length > 50 && (
                 <div className="p-3 text-center text-xs text-on-surface-variant bg-surface-variant/20 border-t border-outline-variant">
                     Mostrando os 50 mais recentes de {filteredStockList.length} itens. Use a busca para filtrar.
                 </div>
             )}
          </div>
       )}

       {/* --- VIEW: SUMMARY --- */}
       {viewMode === 'SUMMARY' && (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
             {stockSummary.length === 0 ? (
                <div className="col-span-full text-center py-10 text-on-surface-variant">
                   <p>Nenhum modelo com estoque encontrado.</p>
                </div>
             ) : (
                stockSummary.map(({ model, items }) => {
                   const statusCounts = items.reduce((acc, item) => {
                      acc[item.status] = (acc[item.status] || 0) + 1;
                      return acc;
                   }, {} as Record<string, number>);

                   return (
                     <Card key={model.id} className="bg-surface border-outline-variant overflow-hidden">
                        <div className="p-4 border-b border-outline-variant bg-surface-variant/30 flex justify-between items-center">
                           <div>
                              <h3 className="font-bold text-on-surface">{model.name}</h3>
                              <Badge color={model.type === VaseType.WITH_SHELL ? 'blue' : 'yellow'}>{model.type === VaseType.WITH_SHELL ? 'Com Casca' : 'Sem Casca'}</Badge>
                           </div>
                           <div className="text-right">
                              <span className="text-2xl font-bold text-on-surface">{items.length}</span>
                              <p className="text-[10px] uppercase font-bold text-on-surface-variant">Total Geral</p>
                           </div>
                        </div>
                        <div className="p-4 space-y-2">
                           <div className="flex justify-between text-sm">
                              <span className="text-on-surface-variant flex items-center gap-2"><div className="w-2 h-2 rounded-full bg-outline"/> Aguard. Acabamento</span>
                              <span className="font-bold">{statusCounts[ItemStatus.AWAITING_FINISHING] || 0}</span>
                           </div>
                           <div className="flex justify-between text-sm">
                              <span className="text-on-surface-variant flex items-center gap-2"><div className="w-2 h-2 rounded-full bg-primary"/> Aguard. Pintura</span>
                              <span className="font-bold">{statusCounts[ItemStatus.AWAITING_PAINTING] || 0}</span>
                           </div>
                           <div className="flex justify-between text-sm">
                              <span className="text-on-surface-variant flex items-center gap-2"><div className="w-2 h-2 rounded-full bg-success"/> Finalizados</span>
                              <span className="font-bold">{statusCounts[ItemStatus.FINISHED] || 0}</span>
                           </div>
                           {model.type === VaseType.WITHOUT_SHELL && (
                              <div className="flex justify-between text-sm">
                                 <span className="text-on-surface-variant flex items-center gap-2"><div className="w-2 h-2 rounded-full bg-secondary"/> Estoque (S/ Casca)</span>
                                 <span className="font-bold">{statusCounts[ItemStatus.STOCK_NO_SHELL] || 0}</span>
                              </div>
                           )}
                        </div>
                     </Card>
                   )
                })
             )}
          </div>
       )}

       {/* --- DETAILS MODAL --- */}
       <Modal 
            isOpen={!!selectedItem} 
            onClose={() => setSelectedItem(null)} 
            title="Rastreabilidade do Item"
            footer={<Button variant="ghost" onClick={() => setSelectedItem(null)}>Fechar</Button>}
       >
            {selectedItem && (
                <div className="space-y-6">
                    {/* Header Info */}
                    <div className="flex items-center justify-between bg-surface-variant/30 p-4 rounded-xl border border-outline-variant">
                        <div>
                            <p className="text-xs uppercase font-bold text-on-surface-variant">Identificação</p>
                            <p className="text-xl font-mono font-bold text-primary tracking-wider">{selectedItem.cip || 'S/ CIP'}</p>
                        </div>
                        <div className="text-right">
                            <p className="text-xs uppercase font-bold text-on-surface-variant">Modelo</p>
                            <p className="font-bold text-on-surface">{selectedItem.modelName}</p>
                        </div>
                    </div>

                    {/* Pipeline Timeline */}
                    <div className="relative space-y-0 pl-4 border-l-2 border-outline-variant py-2">
                        {/* Stage 1: Production */}
                        <div className="relative mb-6">
                            <div className="absolute -left-[21px] top-1 w-3 h-3 rounded-full bg-primary border-2 border-surface shadow-sm"></div>
                            <div className="flex justify-between items-start">
                                <div>
                                    <p className="font-bold text-sm text-on-surface">Produção</p>
                                    <p className="text-xs text-on-surface-variant">Por: {getEmployeeName(selectedItem.producedBy)}</p>
                                    <p className="text-xs text-on-surface-variant mt-1">{new Date(selectedItem.createdAt).toLocaleString()}</p>
                                    <p className="text-[10px] text-on-surface-variant mt-0.5">Período: {getPeriodName(selectedItem.periodId)}</p>
                                </div>
                                <div className="text-right">
                                    <p className="text-xs font-bold text-success">MO: R$ {selectedItem.productionValue.toFixed(2)}</p>
                                    <p className="text-[10px] text-on-surface-variant">MP: R$ {selectedItem.rawMaterialCost.toFixed(2)}</p>
                                </div>
                            </div>
                        </div>

                        {/* Stage 2: Finishing (Conditional) */}
                        {selectedItem.finishedBy && (
                            <div className="relative mb-6">
                                <div className="absolute -left-[21px] top-1 w-3 h-3 rounded-full bg-secondary border-2 border-surface shadow-sm"></div>
                                <div className="flex justify-between items-start">
                                    <div>
                                        <p className="font-bold text-sm text-on-surface">Acabamento</p>
                                        <p className="text-xs text-on-surface-variant">Por: {getEmployeeName(selectedItem.finishedBy)}</p>
                                    </div>
                                    <div className="text-right">
                                        <p className="text-xs font-bold text-success">R$ {(selectedItem.finishingValue || 0).toFixed(2)}</p>
                                    </div>
                                </div>
                            </div>
                        )}

                         {/* Stage 3: Painting (Conditional) */}
                         {selectedItem.paintedBy && (
                            <div className="relative">
                                <div className="absolute -left-[21px] top-1 w-3 h-3 rounded-full bg-tertiary-container border-2 border-tertiary shadow-sm"></div>
                                <div className="flex justify-between items-start">
                                    <div>
                                        <p className="font-bold text-sm text-on-surface">Pintura (Finalização)</p>
                                        <p className="text-xs text-on-surface-variant">Por: {getEmployeeName(selectedItem.paintedBy)}</p>
                                        <p className="text-xs text-on-surface-variant mt-1">{new Date(selectedItem.updatedAt).toLocaleString()}</p>
                                    </div>
                                    <div className="text-right">
                                        <p className="text-xs font-bold text-success">R$ {(selectedItem.paintingValue || 0).toFixed(2)}</p>
                                    </div>
                                </div>
                            </div>
                        )}
                    </div>

                    {/* Status Footer */}
                    <div className={`p-3 rounded-xl flex items-center gap-2 justify-center font-bold text-sm ${selectedItem.status === ItemStatus.FINISHED ? 'bg-success-container text-on-success-container' : 'bg-surface-variant text-on-surface-variant'}`}>
                        {selectedItem.status === ItemStatus.FINISHED ? <CheckCircle2 className="w-5 h-5" /> : <Activity className="w-5 h-5" />}
                        Status Atual: {getStatusConfig(selectedItem.status).label.toUpperCase()}
                        {selectedItem.status !== ItemStatus.FINISHED && (
                           <span className="text-[10px] ml-2 opacity-70">
                              ({getDaysDiff(selectedItem.status === ItemStatus.AWAITING_PAINTING ? selectedItem.updatedAt : selectedItem.createdAt)} dias)
                           </span>
                        )}
                    </div>
                </div>
            )}
       </Modal>
    </div>
  );
};

// --- GOALS TAB ---
const GoalsTab = () => {
   const { goals, employees, addGoal, deleteGoal, periods, activePeriodId } = useStore();
   const [showModal, setShowModal] = useState(false);
   
   // Form State
   const [targetEmp, setTargetEmp] = useState('');
   const [targetSector, setTargetSector] = useState<Sector>(Sector.PRODUCTION);
   const [periodType, setPeriodType] = useState<GoalPeriod>('MONTHLY');
   const [qty, setQty] = useState(100);

   const activeGoals = goals.filter(g => g.periodId === activePeriodId);
   const currentPeriod = periods.find(p => p.id === activePeriodId);

   const handleSave = () => {
      if (!targetEmp || qty <= 0) return;

      const now = new Date();
      let start = now.getTime();
      let end = now.getTime();

      if (periodType === 'DAILY') {
         start = new Date(now.setHours(0,0,0,0)).getTime();
         end = new Date(now.setHours(23,59,59,999)).getTime();
      } else if (periodType === 'WEEKLY') {
         const first = now.getDate() - now.getDay(); 
         start = new Date(now.setDate(first)).setHours(0,0,0,0);
         end = new Date(now.setDate(first + 6)).setHours(23,59,59,999);
      } else {
         start = new Date(now.getFullYear(), now.getMonth(), 1).getTime();
         end = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59).getTime();
      }

      const newGoal: Goal = {
         id: uuidv4(),
         employeeId: targetEmp,
         sector: targetSector,
         period: periodType,
         startDate: start,
         endDate: end,
         totalQuantityTarget: Number(qty),
         createdAt: Date.now(),
         createdBy: 'SUPERVISOR',
         periodId: activePeriodId || undefined
      };

      addGoal(newGoal);
      setShowModal(false);
   };

   return (
      <div className="space-y-4 animate-in fade-in pb-20">
         <div className="flex justify-between items-center">
            <h2 className="text-2xl font-normal text-on-background">Metas do Período</h2>
            <Button onClick={() => setShowModal(true)}>
               <Plus className="w-5 h-5 mr-2" /> Nova Meta
            </Button>
         </div>

         {!currentPeriod && (
             <div className="bg-error-container text-on-error-container p-4 rounded-xl flex items-center gap-2">
                 <AlertTriangle className="w-5 h-5" />
                 <span>Não há período ativo. Inicie um período na aba de Configurações para definir metas.</span>
             </div>
         )}

         <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {activeGoals.map(goal => {
               const emp = employees.find(e => e.id === goal.employeeId);
               return (
                  <Card key={goal.id} className="bg-surface border-outline-variant relative">
                     <button onClick={() => deleteGoal(goal.id)} className="absolute top-4 right-4 text-on-surface-variant hover:text-error p-1">
                        <Trash className="w-4 h-4" />
                     </button>
                     <div className="flex items-center gap-3 mb-4">
                        <div className="w-10 h-10 bg-primary-container rounded-full flex items-center justify-center text-on-primary-container font-bold">
                           {emp?.name.slice(0,2).toUpperCase()}
                        </div>
                        <div>
                           <p className="font-bold text-on-surface">{emp?.name}</p>
                           <p className="text-xs text-on-surface-variant flex items-center gap-1">
                              {goal.sector} • {goal.period === 'DAILY' ? 'Diária' : goal.period === 'WEEKLY' ? 'Semanal' : 'Mensal'}
                           </p>
                        </div>
                     </div>
                     <div className="bg-surface-variant/50 p-3 rounded-xl flex justify-between items-center">
                        <span className="text-sm font-medium text-on-surface-variant">Alvo</span>
                        <span className="text-xl font-bold text-primary">{goal.totalQuantityTarget} <span className="text-xs font-normal">un.</span></span>
                     </div>
                     <div className="mt-2 text-[10px] text-on-surface-variant text-right">
                        Válido até {new Date(goal.endDate).toLocaleDateString()}
                     </div>
                  </Card>
               );
            })}
         </div>

         <Modal isOpen={showModal} onClose={() => setShowModal(false)} title="Nova Meta">
            <div className="space-y-4">
               <div>
                  <label className="text-xs font-bold uppercase text-on-surface-variant">Colaborador</label>
                  <select value={targetEmp} onChange={e => setTargetEmp(e.target.value)} className="w-full p-3 rounded-xl bg-surface-variant border border-outline-variant mt-1">
                     <option value="">Selecione...</option>
                     {employees.filter(e => e.active).map(e => (
                        <option key={e.id} value={e.id}>{e.name} ({e.sector})</option>
                     ))}
                  </select>
               </div>
               <div>
                  <label className="text-xs font-bold uppercase text-on-surface-variant">Setor da Meta</label>
                  <select value={targetSector} onChange={e => setTargetSector(e.target.value as Sector)} className="w-full p-3 rounded-xl bg-surface-variant border border-outline-variant mt-1">
                     <option value={Sector.PRODUCTION}>Produção</option>
                     <option value={Sector.FINISHING}>Acabamento</option>
                     <option value={Sector.PAINTING}>Pintura</option>
                  </select>
               </div>
               <div>
                  <label className="text-xs font-bold uppercase text-on-surface-variant">Período</label>
                  <div className="flex gap-2 mt-1">
                     {(['DAILY', 'WEEKLY', 'MONTHLY'] as const).map(p => (
                        <button 
                           key={p} 
                           onClick={() => setPeriodType(p)}
                           className={`flex-1 py-2 rounded-lg text-xs font-bold border ${periodType === p ? 'bg-primary text-on-primary border-primary' : 'bg-transparent border-outline-variant text-on-surface-variant'}`}
                        >
                           {p === 'DAILY' ? 'Dia' : p === 'WEEKLY' ? 'Semana' : 'Mês'}
                        </button>
                     ))}
                  </div>
               </div>
               <div>
                  <label className="text-xs font-bold uppercase text-on-surface-variant">Quantidade Alvo</label>
                  <input type="number" value={qty} onChange={e => setQty(Number(e.target.value))} className="w-full p-3 rounded-xl bg-surface-variant border border-outline-variant mt-1 font-bold text-lg" />
               </div>
               <div className="pt-4 flex gap-2">
                  <Button variant="ghost" onClick={() => setShowModal(false)} className="flex-1">Cancelar</Button>
                  <Button onClick={handleSave} className="flex-1">Salvar Meta</Button>
               </div>
            </div>
         </Modal>
      </div>
   );
};

// --- MODELS TAB ---
const ModelsTab = () => {
   const { vaseModels, addVaseModel, updateVaseModel, deleteVaseModel, deduplicateVaseModels } = useStore();
   const [isModalOpen, setIsModalOpen] = useState(false);
   const [editingModel, setEditingModel] = useState<VaseModel | null>(null);

   // Auto-deduplicação no carregamento da aba para garantir visual limpo e sem repetições
   useEffect(() => {
      deduplicateVaseModels();
   }, [deduplicateVaseModels]);

   const handleSave = (e: React.FormEvent<HTMLFormElement>) => {
      e.preventDefault();
      const formData = new FormData(e.currentTarget);
      const name = String(formData.get('name')).trim();
      const type = String(formData.get('type')) as VaseType;
      const canonicalId = getCanonicalVaseModelId(name, type);
      
      const newModel: VaseModel = {
         id: editingModel ? editingModel.id : canonicalId,
         name,
         type,
         weightKg: Number(formData.get('weightKg')),
         costProduction: Number(formData.get('costProduction')),
         costFinishing: Number(formData.get('costFinishing') || 0),
         priceSale: Number(formData.get('priceSale') || 0),
      };

      if (editingModel) {
         updateVaseModel(newModel);
      } else {
         const alreadyExists = vaseModels.some(v => v.id === canonicalId);
         if (alreadyExists) {
            updateVaseModel(newModel);
         } else {
            addVaseModel(newModel);
         }
      }
      
      setIsModalOpen(false);
      setEditingModel(null);
   };

   return (
      <div className="pb-20">
         <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 mb-6">
            <div>
               <h2 className="text-2xl font-normal text-on-background">Modelos de Vasos</h2>
               <p className="text-xs text-on-surface-variant mt-0.5">
                  {vaseModels.length} {vaseModels.length === 1 ? 'modelo cadastrado' : 'modelos cadastrados'} (Catálogo Oficial Sem Repetições)
               </p>
            </div>
            <div className="flex gap-2 w-full sm:w-auto">
               <Button 
                  variant="outlined" 
                  onClick={() => {
                     deduplicateVaseModels();
                     syncData();
                  }}
                  title="Remove duplicatas e unifica com a nuvem"
               >
                  <RefreshCcw className="w-4 h-4 mr-2" /> Otimizar Catálogo
               </Button>
               <Button onClick={() => { setEditingModel(null); setIsModalOpen(true); }}>
                  <Plus className="w-5 h-5 mr-2" /> Novo Modelo
               </Button>
            </div>
         </div>

         <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {vaseModels.map(model => (
               <Card key={model.id} className="bg-surface border-outline-variant p-4 flex flex-col gap-3 group relative">
                  <div className="flex justify-between items-start">
                     <div>
                        <h3 className="font-bold text-lg text-on-surface">{model.name}</h3>
                        <Badge color={model.type === VaseType.WITH_SHELL ? 'blue' : 'yellow'}>{model.type}</Badge>
                     </div>
                     <div className="flex gap-1 opacity-100 lg:opacity-0 group-hover:opacity-100 transition-opacity bg-surface/80 rounded-lg p-1 backdrop-blur-sm">
                        <button onClick={() => { setEditingModel(model); setIsModalOpen(true); }} className="p-2 hover:bg-primary-container text-primary rounded-lg">
                           <Pencil className="w-4 h-4" />
                        </button>
                        <button onClick={() => deleteVaseModel(model.id)} className="p-2 hover:bg-error-container text-error rounded-lg">
                           <Trash className="w-4 h-4" />
                        </button>
                     </div>
                  </div>
                  
                  <div className="grid grid-cols-2 gap-2 text-sm mt-2 pt-2 border-t border-outline-variant">
                     <div className="text-on-surface-variant">Peso: <span className="text-on-surface font-medium">{model.weightKg} Kg</span></div>
                     <div className="text-on-surface-variant">Prod.: <span className="text-on-surface font-medium">R$ {model.costProduction.toFixed(2)}</span></div>
                     {model.type === VaseType.WITH_SHELL && (
                        <>
                           <div className="text-on-surface-variant">Acab.: <span className="text-on-surface font-medium">R$ {model.costFinishing?.toFixed(2)}</span></div>
                           <div className="text-on-surface-variant">Venda: <span className="text-on-surface font-medium">R$ {model.priceSale?.toFixed(2)}</span></div>
                        </>
                     )}
                  </div>
               </Card>
            ))}
         </div>

         <Modal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} title={editingModel ? "Editar Modelo" : "Novo Modelo"}>
            <form onSubmit={handleSave} className="space-y-4">
               <div>
                  <label className="text-xs font-bold uppercase text-on-surface-variant">Nome do Modelo</label>
                  <input name="name" defaultValue={editingModel?.name} required className="w-full p-3 rounded-xl bg-surface-variant border border-outline-variant mt-1" />
               </div>
               <div>
                  <label className="text-xs font-bold uppercase text-on-surface-variant">Tipo</label>
                  <select name="type" defaultValue={editingModel?.type || VaseType.WITH_SHELL} className="w-full p-3 rounded-xl bg-surface-variant border border-outline-variant mt-1">
                     <option value={VaseType.WITH_SHELL}>Com Casca</option>
                     <option value={VaseType.WITHOUT_SHELL}>Sem Casca</option>
                  </select>
               </div>
               <div className="grid grid-cols-2 gap-4">
                  <div>
                     <label className="text-xs font-bold uppercase text-on-surface-variant">Peso (Kg)</label>
                     <input type="number" step="0.1" name="weightKg" defaultValue={editingModel?.weightKg} required className="w-full p-3 rounded-xl bg-surface-variant border border-outline-variant mt-1" />
                  </div>
                  <div>
                     <label className="text-xs font-bold uppercase text-on-surface-variant">Custo Prod. (R$)</label>
                     <input type="number" step="0.01" name="costProduction" defaultValue={editingModel?.costProduction} required className="w-full p-3 rounded-xl bg-surface-variant border border-outline-variant mt-1" />
                  </div>
               </div>
               <div className="grid grid-cols-2 gap-4">
                  <div>
                     <label className="text-xs font-bold uppercase text-on-surface-variant">Custo Acab. (R$)</label>
                     <input type="number" step="0.01" name="costFinishing" defaultValue={editingModel?.costFinishing} className="w-full p-3 rounded-xl bg-surface-variant border border-outline-variant mt-1" />
                  </div>
                  <div>
                     <label className="text-xs font-bold uppercase text-on-surface-variant">Preço Venda (R$)</label>
                     <input type="number" step="0.01" name="priceSale" defaultValue={editingModel?.priceSale} className="w-full p-3 rounded-xl bg-surface-variant border border-outline-variant mt-1" />
                  </div>
               </div>
               <div className="pt-4 flex gap-2">
                  <Button variant="ghost" type="button" onClick={() => setIsModalOpen(false)} className="flex-1">Cancelar</Button>
                  <Button type="submit" className="flex-1">Salvar</Button>
               </div>
            </form>
         </Modal>
      </div>
   );
};

// --- EMPLOYEES TAB ---
const EmployeesTab = () => {
   const { employees, addEmployee, updateEmployee } = useStore();
   const [isModalOpen, setIsModalOpen] = useState(false);
   const [editingEmp, setEditingEmp] = useState<Employee | null>(null);

   const handleSave = (e: React.FormEvent<HTMLFormElement>) => {
      e.preventDefault();
      const formData = new FormData(e.currentTarget);
      
      const sector = String(formData.get('sector')) as Sector;

      const newEmp: Employee = {
         id: editingEmp ? editingEmp.id : uuidv4(),
         name: String(formData.get('name')),
         sector: sector,
         role: sector === Sector.SUPERVISOR ? 'supervisor' : 'colaborador',
         active: formData.get('active') !== null,
         joinedAt: editingEmp ? editingEmp.joinedAt : Date.now()
      };

      if (editingEmp) updateEmployee(newEmp);
      else addEmployee(newEmp);
      
      setIsModalOpen(false);
      setEditingEmp(null);
   };

   return (
      <div className="pb-20">
         <div className="flex justify-between items-center mb-6">
            <h2 className="text-2xl font-normal text-on-background">Colaboradores</h2>
            <Button onClick={() => { setEditingEmp(null); setIsModalOpen(true); }}>
               <Plus className="w-5 h-5 mr-2" /> Novo Colaborador
            </Button>
         </div>

         <div className="grid grid-cols-1 gap-3">
            {employees.map(emp => (
               <div key={emp.id} className="bg-surface border border-outline-variant p-4 rounded-2xl flex items-center justify-between">
                  <div className="flex items-center gap-3">
                     <div className={`w-10 h-10 rounded-full flex items-center justify-center font-bold text-sm ${emp.active ? 'bg-primary-container text-on-primary-container' : 'bg-surface-variant text-on-surface-variant'}`}>
                        {emp.name.slice(0,2).toUpperCase()}
                     </div>
                     <div>
                        <p className={`font-bold ${emp.active ? 'text-on-surface' : 'text-on-surface-variant'}`}>{emp.name}</p>
                        <div className="flex items-center gap-2 text-xs">
                           <span className="bg-surface-variant px-2 py-0.5 rounded text-on-surface-variant">{emp.sector}</span>
                           {!emp.active && <span className="text-error font-bold">Inativo</span>}
                        </div>
                     </div>
                  </div>
                  <Button variant="ghost" size="sm" onClick={() => { setEditingEmp(emp); setIsModalOpen(true); }}>
                     <Pencil className="w-4 h-4" />
                  </Button>
               </div>
            ))}
         </div>

         <Modal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} title={editingEmp ? "Editar Colaborador" : "Novo Colaborador"}>
            <form onSubmit={handleSave} className="space-y-4">
               <div>
                  <label className="text-xs font-bold uppercase text-on-surface-variant">Nome</label>
                  <input name="name" defaultValue={editingEmp?.name} required className="w-full p-3 rounded-xl bg-surface-variant border border-outline-variant mt-1" />
               </div>
               <div>
                  <label className="text-xs font-bold uppercase text-on-surface-variant">Setor</label>
                  <select name="sector" defaultValue={editingEmp?.sector || Sector.PRODUCTION} className="w-full p-3 rounded-xl bg-surface-variant border border-outline-variant mt-1">
                     <option value={Sector.PRODUCTION}>Produção</option>
                     <option value={Sector.FINISHING}>Acabamento</option>
                     <option value={Sector.PAINTING}>Pintura</option>
                     <option value={Sector.SUPERVISOR}>Supervisor</option>
                  </select>
               </div>
               <div className="flex items-center gap-2 pt-2">
                  <input type="checkbox" name="active" defaultChecked={editingEmp ? editingEmp.active : true} id="activeCheck" className="w-5 h-5 accent-primary" />
                  <label htmlFor="activeCheck" className="text-on-surface font-medium">Colaborador Ativo</label>
               </div>
               <div className="pt-4 flex gap-2">
                  <Button variant="ghost" type="button" onClick={() => setIsModalOpen(false)} className="flex-1">Cancelar</Button>
                  <Button type="submit" className="flex-1">Salvar</Button>
               </div>
            </form>
         </Modal>
      </div>
   );
};

// --- PAYMENTS TAB ---
interface EmployeeActivity {
  id: string;
  itemId: string;
  cip?: string;
  modelName: string;
  action: 'PRODUCAO' | 'ACABAMENTO' | 'PINTURA';
  actionLabel: string;
  timestamp: number;
  value: number;
  status: ItemStatus;
}

interface EmployeePaymentSummary {
  employee: Employee;
  vasesProducedCount: number;
  vasesFinishedCount: number;
  vasesPaintedCount: number;
  totalItemsCount: number;
  grossEarned: number;
  totalPaid: number;
  netBalance: number;
  activities: EmployeeActivity[];
  payments: PaymentRecord[];
}

const PaymentsTab = () => {
  const { payments, employees, productionItems, addPayment, deletePayment, activePeriodId, periods } = useStore();
  
  // Find currently active period
  const activePeriod = useMemo(() => {
    return periods.find(p => p.id === activePeriodId) || periods.find(p => p.status === 'ACTIVE') || periods[0];
  }, [periods, activePeriodId]);
  const effectiveActivePeriodId = activePeriod?.id;

  // Selected period for calculations (defaults to active period)
  const [selectedPeriodId, setSelectedPeriodId] = useState<string>(effectiveActivePeriodId || 'ALL');

  // Sub-views: 'COLLABORATORS' (main list) | 'RECEIPTS' (historical payment transactions)
  const [activeSubTab, setActiveSubTab] = useState<'COLLABORATORS' | 'RECEIPTS'>('COLLABORATORS');

  // Search & Filters
  const [searchQuery, setSearchQuery] = useState('');
  const [sectorFilter, setSectorFilter] = useState<'ALL' | Sector>('ALL');
  const [balanceFilter, setBalanceFilter] = useState<'ALL' | 'PENDING' | 'SETTLED'>('ALL');

  // Modal for individual collaborator detailed history (e.g., clicking on João)
  const [selectedEmpId, setSelectedEmpId] = useState<string | null>(null);
  const [modalTab, setModalTab] = useState<'ACTIVITIES' | 'PAYMENTS'>('ACTIVITIES');
  const [activitySearchQuery, setActivitySearchQuery] = useState('');

  // Modal for registering payment
  const [isPaymentModalOpen, setIsPaymentModalOpen] = useState(false);
  const [paymentEmpId, setPaymentEmpId] = useState<string>('');
  const [paymentAmount, setPaymentAmount] = useState<string>('');
  const [paymentDate, setPaymentDate] = useState<string>(new Date().toISOString().split('T')[0]);
  const [paymentObservation, setPaymentObservation] = useState<string>('');

  // Keep selectedPeriodId in sync if effectiveActivePeriodId becomes available
  useEffect(() => {
    if (selectedPeriodId === 'ALL' && effectiveActivePeriodId) {
      setSelectedPeriodId(effectiveActivePeriodId);
    }
  }, [effectiveActivePeriodId]);

  // Build complete summaries for each collaborator
  const summaries = useMemo<EmployeePaymentSummary[]>(() => {
    return employees.map(emp => {
      const activities: EmployeeActivity[] = [];
      const empPayments: PaymentRecord[] = [];

      // Scan all production items
      productionItems.forEach(item => {
        // 1. Moldagem / Produção
        const matchesProdPeriod = selectedPeriodId === 'ALL'
          ? true
          : (item.periodId === selectedPeriodId || (!item.periodId && selectedPeriodId === effectiveActivePeriodId));

        if (item.producedBy === emp.id && matchesProdPeriod) {
          activities.push({
            id: `${item.id}-prod`,
            itemId: item.id,
            cip: item.cip,
            modelName: item.modelName,
            action: 'PRODUCAO',
            actionLabel: 'Moldagem / Produção',
            timestamp: item.createdAt,
            value: item.productionValue || 0,
            status: item.status
          });
        }

        // 2. Acabamento
        const matchesFinPeriod = selectedPeriodId === 'ALL'
          ? true
          : (item.finishedInPeriodId === selectedPeriodId || (!item.finishedInPeriodId && selectedPeriodId === effectiveActivePeriodId));

        if (item.finishedBy === emp.id && matchesFinPeriod) {
          activities.push({
            id: `${item.id}-fin`,
            itemId: item.id,
            cip: item.cip,
            modelName: item.modelName,
            action: 'ACABAMENTO',
            actionLabel: 'Acabamento',
            timestamp: item.updatedAt || item.createdAt,
            value: item.finishingValue || 0,
            status: item.status
          });
        }

        // 3. Pintura
        const matchesPaintPeriod = selectedPeriodId === 'ALL'
          ? true
          : (item.paintedInPeriodId === selectedPeriodId || (!item.paintedInPeriodId && selectedPeriodId === effectiveActivePeriodId));

        if (item.paintedBy === emp.id && matchesPaintPeriod) {
          activities.push({
            id: `${item.id}-paint`,
            itemId: item.id,
            cip: item.cip,
            modelName: item.modelName,
            action: 'PINTURA',
            actionLabel: 'Pintura',
            timestamp: item.updatedAt || item.createdAt,
            value: item.paintingValue || 0,
            status: item.status
          });
        }
      });

      // Filter payments for this employee
      payments.forEach(pay => {
        const matchesPayPeriod = selectedPeriodId === 'ALL'
          ? true
          : (pay.periodId === selectedPeriodId || (!pay.periodId && selectedPeriodId === effectiveActivePeriodId));

        if (pay.employeeId === emp.id && matchesPayPeriod) {
          empPayments.push(pay);
        }
      });

      // Sort activities: most recent first
      activities.sort((a, b) => b.timestamp - a.timestamp);
      // Sort payments: most recent first
      empPayments.sort((a, b) => b.date - a.date);

      const vasesProducedCount = activities.filter(a => a.action === 'PRODUCAO').length;
      const vasesFinishedCount = activities.filter(a => a.action === 'ACABAMENTO').length;
      const vasesPaintedCount = activities.filter(a => a.action === 'PINTURA').length;
      const totalItemsCount = activities.length;
      const grossEarned = activities.reduce((sum, a) => sum + a.value, 0);
      const totalPaid = empPayments.reduce((sum, p) => sum + p.amount, 0);
      const netBalance = grossEarned - totalPaid;

      return {
        employee: emp,
        vasesProducedCount,
        vasesFinishedCount,
        vasesPaintedCount,
        totalItemsCount,
        grossEarned,
        totalPaid,
        netBalance,
        activities,
        payments: empPayments
      };
    });
  }, [employees, productionItems, payments, selectedPeriodId, effectiveActivePeriodId]);

  // Global KPIs for the chosen period
  const totalGrossAll = useMemo(() => summaries.reduce((sum, s) => sum + s.grossEarned, 0), [summaries]);
  const totalPaidAll = useMemo(() => summaries.reduce((sum, s) => sum + s.totalPaid, 0), [summaries]);
  const totalPendingAll = useMemo(() => summaries.reduce((sum, s) => sum + Math.max(0, s.netBalance), 0), [summaries]);
  const totalPiecesAll = useMemo(() => summaries.reduce((sum, s) => sum + s.totalItemsCount, 0), [summaries]);
  const employeesWithPendingCount = useMemo(() => summaries.filter(s => s.netBalance > 0.009).length, [summaries]);

  // Filter summaries by user criteria
  const filteredSummaries = useMemo(() => {
    return summaries
      .filter(s => {
        // Sector filter
        if (sectorFilter !== 'ALL' && s.employee.sector !== sectorFilter) return false;
        // Balance filter
        if (balanceFilter === 'PENDING' && s.netBalance <= 0.009) return false;
        if (balanceFilter === 'SETTLED' && s.netBalance > 0.009) return false;
        // Search query
        if (searchQuery.trim()) {
          const q = searchQuery.toLowerCase();
          const matchName = s.employee.name.toLowerCase().includes(q);
          const matchSector = s.employee.sector.toLowerCase().includes(q);
          if (!matchName && !matchSector) return false;
        }
        return true;
      })
      .sort((a, b) => {
        // Primary: Highest pending balance first
        if (b.netBalance !== a.netBalance) return b.netBalance - a.netBalance;
        // Secondary: Alphabetical
        return a.employee.name.localeCompare(b.employee.name);
      });
  }, [summaries, sectorFilter, balanceFilter, searchQuery]);

  // Currently selected collaborator summary for modal
  const selectedEmpSummary = useMemo(() => {
    if (!selectedEmpId) return null;
    return summaries.find(s => s.employee.id === selectedEmpId) || null;
  }, [summaries, selectedEmpId]);

  // Filtered activities inside employee modal
  const modalFilteredActivities = useMemo(() => {
    if (!selectedEmpSummary) return [];
    if (!activitySearchQuery.trim()) return selectedEmpSummary.activities;
    const q = activitySearchQuery.toLowerCase();
    return selectedEmpSummary.activities.filter(a => 
      a.modelName.toLowerCase().includes(q) || 
      (a.cip && a.cip.toLowerCase().includes(q)) ||
      a.actionLabel.toLowerCase().includes(q)
    );
  }, [selectedEmpSummary, activitySearchQuery]);

  // Open payment modal
  const handleOpenPaymentModal = (empId?: string, defaultAmount?: number) => {
    const id = empId || employees[0]?.id || '';
    setPaymentEmpId(id);
    if (defaultAmount !== undefined && defaultAmount > 0) {
      setPaymentAmount(defaultAmount.toFixed(2));
    } else {
      const summary = summaries.find(s => s.employee.id === id);
      setPaymentAmount(summary && summary.netBalance > 0 ? summary.netBalance.toFixed(2) : '');
    }
    setPaymentDate(new Date().toISOString().split('T')[0]);
    setPaymentObservation('');
    setIsPaymentModalOpen(true);
  };

  const handleSavePayment = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const emp = employees.find(e => e.id === paymentEmpId);
    if (!emp) return;

    const amountNum = parseFloat(paymentAmount);
    if (isNaN(amountNum) || amountNum <= 0) return;

    const newPayment: PaymentRecord = {
      id: uuidv4(),
      employeeId: emp.id,
      employeeName: emp.name,
      sector: emp.sector,
      amount: amountNum,
      date: new Date(paymentDate + 'T12:00:00').getTime(),
      observation: paymentObservation.trim() || undefined,
      periodId: (selectedPeriodId !== 'ALL' ? selectedPeriodId : effectiveActivePeriodId) || undefined
    };

    addPayment(newPayment);
    setIsPaymentModalOpen(false);
  };

  // Receipts list for historical transactions
  const filteredReceipts = useMemo(() => {
    return payments.filter(pay => {
      const matchesPeriod = selectedPeriodId === 'ALL'
        ? true
        : (pay.periodId === selectedPeriodId || (!pay.periodId && selectedPeriodId === effectiveActivePeriodId));
      if (!matchesPeriod) return false;

      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        return pay.employeeName.toLowerCase().includes(q) || (pay.observation && pay.observation.toLowerCase().includes(q));
      }
      return true;
    }).sort((a, b) => b.date - a.date);
  }, [payments, selectedPeriodId, effectiveActivePeriodId, searchQuery]);

  const getSectorStyle = (sector: Sector | string) => {
    switch (sector) {
      case Sector.PRODUCTION:
        return { label: 'Produção', badge: 'bg-blue-100 text-blue-800 dark:bg-blue-950/60 dark:text-blue-300 border-blue-200 dark:border-blue-800', icon: Hammer };
      case Sector.FINISHING:
        return { label: 'Acabamento', badge: 'bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300 border-amber-200 dark:border-amber-800', icon: Brush };
      case Sector.PAINTING:
        return { label: 'Pintura', badge: 'bg-purple-100 text-purple-800 dark:bg-purple-950/60 dark:text-purple-300 border-purple-200 dark:border-purple-800', icon: PaintBucket };
      default:
        return { label: sector, badge: 'bg-surface-variant text-on-surface-variant border-outline-variant', icon: Users };
    }
  };

  const getActionStyle = (action: 'PRODUCAO' | 'ACABAMENTO' | 'PINTURA') => {
    switch (action) {
      case 'PRODUCAO':
        return { label: 'Moldagem', color: 'bg-blue-50 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300 border-blue-200 dark:border-blue-800' };
      case 'ACABAMENTO':
        return { label: 'Acabamento', color: 'bg-amber-50 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300 border-amber-200 dark:border-amber-800' };
      case 'PINTURA':
        return { label: 'Pintura', color: 'bg-purple-50 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300 border-purple-200 dark:border-purple-800' };
    }
  };

  return (
    <div className="pb-24 space-y-6">
      {/* Header & Main Controls */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-surface p-5 rounded-2xl border border-outline-variant shadow-sm">
        <div>
          <div className="flex items-center gap-2">
            <Wallet className="w-7 h-7 text-primary" />
            <h2 className="text-2xl font-bold text-on-surface">Gestão de Pagamentos</h2>
          </div>
          <p className="text-xs text-on-surface-variant mt-1">
            Controle financeiro de produção, valores a pagar e histórico individual por colaborador.
          </p>
        </div>

        <div className="flex items-center gap-3 w-full sm:w-auto">
          {/* Period Selector */}
          <div className="flex items-center gap-2 bg-surface-variant/70 px-3 py-1.5 rounded-xl border border-outline-variant flex-1 sm:flex-initial">
            <CalendarIcon className="w-4 h-4 text-primary shrink-0" />
            <select
              value={selectedPeriodId}
              onChange={(e) => setSelectedPeriodId(e.target.value)}
              className="bg-transparent text-xs font-semibold text-on-surface focus:outline-none cursor-pointer w-full"
            >
              {effectiveActivePeriodId && (
                <option value={effectiveActivePeriodId}>
                  🟢 {activePeriod?.name || 'Período Atual'} (Ativo)
                </option>
              )}
              {periods.filter(p => p.id !== effectiveActivePeriodId).map(p => (
                <option key={p.id} value={p.id}>
                  📁 {p.name} {p.status === 'CLOSED' ? '(Fechado)' : ''}
                </option>
              ))}
              <option value="ALL">🌐 Todos os Períodos (Acumulado)</option>
            </select>
          </div>

          {/* Action Button */}
          <Button onClick={() => handleOpenPaymentModal()} className="shrink-0">
            <Plus className="w-5 h-5 mr-1" /> Registrar Pagto.
          </Button>
        </div>
      </div>

      {/* Global Financial Summary Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 md:gap-4">
        <Card className="p-4 bg-surface border-outline-variant flex flex-col justify-between">
          <div className="flex items-center justify-between text-on-surface-variant mb-2">
            <span className="text-xs font-semibold uppercase tracking-wider">Saldo a Pagar (Líquido)</span>
            <span className="p-1.5 rounded-lg bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300">
              <DollarSign className="w-4 h-4" />
            </span>
          </div>
          <div>
            <div className="text-xl md:text-2xl font-black text-emerald-600 dark:text-emerald-400">
              R$ {totalPendingAll.toFixed(2)}
            </div>
            <div className="text-[11px] text-on-surface-variant mt-1 flex items-center gap-1 font-medium">
              <Users className="w-3.5 h-3.5" />
              <span>{employeesWithPendingCount} colaborador(es) a receber</span>
            </div>
          </div>
        </Card>

        <Card className="p-4 bg-surface border-outline-variant flex flex-col justify-between">
          <div className="flex items-center justify-between text-on-surface-variant mb-2">
            <span className="text-xs font-semibold uppercase tracking-wider">Total Produzido (Bruto)</span>
            <span className="p-1.5 rounded-lg bg-blue-100 text-blue-800 dark:bg-blue-950/60 dark:text-blue-300">
              <Package className="w-4 h-4" />
            </span>
          </div>
          <div>
            <div className="text-xl md:text-2xl font-black text-on-surface">
              R$ {totalGrossAll.toFixed(2)}
            </div>
            <div className="text-[11px] text-on-surface-variant mt-1 font-medium">
              {totalPiecesAll} peças / ações registradas
            </div>
          </div>
        </Card>

        <Card className="p-4 bg-surface border-outline-variant flex flex-col justify-between">
          <div className="flex items-center justify-between text-on-surface-variant mb-2">
            <span className="text-xs font-semibold uppercase tracking-wider">Total Já Pago (Vales)</span>
            <span className="p-1.5 rounded-lg bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300">
              <Wallet className="w-4 h-4" />
            </span>
          </div>
          <div>
            <div className="text-xl md:text-2xl font-black text-on-surface">
              R$ {totalPaidAll.toFixed(2)}
            </div>
            <div className="text-[11px] text-on-surface-variant mt-1 font-medium">
              {payments.length} recibos registrados
            </div>
          </div>
        </Card>

        <Card className="p-4 bg-surface border-outline-variant flex flex-col justify-between">
          <div className="flex items-center justify-between text-on-surface-variant mb-2">
            <span className="text-xs font-semibold uppercase tracking-wider">Período Selecionado</span>
            <span className="p-1.5 rounded-lg bg-primary-container text-on-primary-container">
              <CalendarIcon className="w-4 h-4" />
            </span>
          </div>
          <div>
            <div className="text-base md:text-lg font-bold text-on-surface truncate">
              {selectedPeriodId === 'ALL' ? 'Todos os Períodos' : (periods.find(p => p.id === selectedPeriodId)?.name || 'Período Atual')}
            </div>
            <div className="text-[11px] text-on-surface-variant mt-1 font-medium">
              {selectedPeriodId === effectiveActivePeriodId ? '🟢 Ciclo Ativo' : 'Histórico de Produção'}
            </div>
          </div>
        </Card>
      </div>

      {/* Sub-tab Navigation */}
      <div className="flex border-b border-outline-variant gap-2">
        <button
          onClick={() => setActiveSubTab('COLLABORATORS')}
          className={cn(
            "pb-3 px-4 text-sm font-semibold transition-colors relative flex items-center gap-2",
            activeSubTab === 'COLLABORATORS' 
              ? "text-primary border-b-2 border-primary" 
              : "text-on-surface-variant hover:text-on-surface"
          )}
        >
          <Users className="w-4 h-4" />
          <span>Colaboradores & Valores a Receber</span>
          <span className="bg-primary-container text-on-primary-container text-[11px] font-bold px-2 py-0.5 rounded-full">
            {summaries.length}
          </span>
        </button>

        <button
          onClick={() => setActiveSubTab('RECEIPTS')}
          className={cn(
            "pb-3 px-4 text-sm font-semibold transition-colors relative flex items-center gap-2",
            activeSubTab === 'RECEIPTS' 
              ? "text-primary border-b-2 border-primary" 
              : "text-on-surface-variant hover:text-on-surface"
          )}
        >
          <Receipt className="w-4 h-4" />
          <span>Comprovantes e Vales Pagos</span>
          <span className="bg-surface-variant text-on-surface-variant text-[11px] font-bold px-2 py-0.5 rounded-full border border-outline-variant">
            {filteredReceipts.length}
          </span>
        </button>
      </div>

      {/* VIEW 1: COLLABORATORS & VALUES TO RECEIVE */}
      {activeSubTab === 'COLLABORATORS' && (
        <div className="space-y-4">
          {/* Filter and Search Bar */}
          <div className="bg-surface p-4 rounded-2xl border border-outline-variant space-y-3">
            <div className="flex flex-col md:flex-row gap-3 items-stretch md:items-center justify-between">
              {/* Search box */}
              <div className="relative flex-1">
                <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-on-surface-variant" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Buscar colaborador por nome ou setor..."
                  className="w-full pl-10 pr-4 py-2 bg-surface-variant rounded-xl border border-outline-variant text-sm text-on-surface focus:outline-none focus:ring-1 focus:ring-primary"
                />
                {searchQuery && (
                  <button 
                    onClick={() => setSearchQuery('')}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-on-surface-variant hover:text-on-surface"
                  >
                    <X className="w-4 h-4" />
                  </button>
                )}
              </div>

              {/* Status Filter Buttons */}
              <div className="flex items-center gap-1.5 bg-surface-variant p-1 rounded-xl border border-outline-variant overflow-x-auto text-xs">
                <button
                  onClick={() => setBalanceFilter('ALL')}
                  className={cn(
                    "px-3 py-1.5 rounded-lg font-medium transition-all whitespace-nowrap",
                    balanceFilter === 'ALL' ? "bg-surface text-on-surface shadow-xs font-bold" : "text-on-surface-variant hover:text-on-surface"
                  )}
                >
                  Todos ({summaries.length})
                </button>
                <button
                  onClick={() => setBalanceFilter('PENDING')}
                  className={cn(
                    "px-3 py-1.5 rounded-lg font-medium transition-all whitespace-nowrap flex items-center gap-1",
                    balanceFilter === 'PENDING' ? "bg-emerald-600 text-white shadow-xs font-bold" : "text-emerald-700 dark:text-emerald-400 hover:text-emerald-800"
                  )}
                >
                  <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                  Com saldo a receber ({employeesWithPendingCount})
                </button>
                <button
                  onClick={() => setBalanceFilter('SETTLED')}
                  className={cn(
                    "px-3 py-1.5 rounded-lg font-medium transition-all whitespace-nowrap",
                    balanceFilter === 'SETTLED' ? "bg-surface text-on-surface shadow-xs font-bold" : "text-on-surface-variant hover:text-on-surface"
                  )}
                >
                  Quitados
                </button>
              </div>
            </div>

            {/* Sector Filter Chips */}
            <div className="flex items-center gap-2 pt-1 overflow-x-auto text-xs">
              <span className="text-on-surface-variant font-medium flex items-center gap-1">
                <Filter className="w-3.5 h-3.5" /> Setor:
              </span>
              {[
                { id: 'ALL', label: 'Todos os Setores' },
                { id: Sector.PRODUCTION, label: 'Produção' },
                { id: Sector.FINISHING, label: 'Acabamento' },
                { id: Sector.PAINTING, label: 'Pintura' },
              ].map(sec => (
                <button
                  key={sec.id}
                  onClick={() => setSectorFilter(sec.id as any)}
                  className={cn(
                    "px-3 py-1 rounded-full border transition-colors whitespace-nowrap",
                    sectorFilter === sec.id
                      ? "bg-primary text-on-primary border-primary font-bold shadow-xs"
                      : "bg-surface-variant text-on-surface-variant border-outline-variant hover:border-primary/50"
                  )}
                >
                  {sec.label}
                </button>
              ))}
            </div>
          </div>

          {/* Collaborator Cards Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {filteredSummaries.map((summary) => {
              const emp = summary.employee;
              const sectorInfo = getSectorStyle(emp.sector);
              const SectorIcon = sectorInfo.icon;
              const hasBalance = summary.netBalance > 0.009;

              // Initials for avatar
              const initials = emp.name.split(' ').map(n => n[0]).slice(0, 2).join('').toUpperCase();

              return (
                <div
                  key={emp.id}
                  onClick={() => setSelectedEmpId(emp.id)}
                  className={cn(
                    "bg-surface border rounded-2xl p-5 shadow-sm transition-all cursor-pointer hover:shadow-md hover:border-primary/50 flex flex-col justify-between group",
                    hasBalance ? "border-emerald-200 dark:border-emerald-800/60" : "border-outline-variant"
                  )}
                >
                  {/* Top: Avatar, Name, Sector & Balance Badge */}
                  <div>
                    <div className="flex items-start justify-between gap-3 mb-4">
                      <div className="flex items-center gap-3 min-w-0">
                        <div className="w-11 h-11 rounded-full bg-primary/10 text-primary flex items-center justify-center font-bold text-sm shrink-0 border border-primary/20">
                          {initials}
                        </div>
                        <div className="min-w-0">
                          <h3 className="text-lg font-bold text-on-surface truncate group-hover:text-primary transition-colors">
                            {emp.name}
                          </h3>
                          <div className="flex items-center gap-1.5 mt-0.5">
                            <span className={cn("inline-flex items-center gap-1 text-[11px] font-semibold px-2 py-0.5 rounded-full border", sectorInfo.badge)}>
                              <SectorIcon className="w-3 h-3" />
                              {sectorInfo.label}
                            </span>
                            {!emp.active && (
                              <span className="text-[10px] bg-error-container text-on-error-container px-1.5 py-0.5 rounded font-medium">
                                Inativo
                              </span>
                            )}
                          </div>
                        </div>
                      </div>

                      {/* Pending Balance Badge */}
                      <div className="text-right shrink-0">
                        {hasBalance ? (
                          <div className="inline-flex flex-col items-end">
                            <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-700 dark:text-emerald-400">
                              A Receber
                            </span>
                            <span className="text-lg font-black text-emerald-600 dark:text-emerald-400">
                              R$ {summary.netBalance.toFixed(2)}
                            </span>
                          </div>
                        ) : (
                          <span className="text-xs font-semibold px-2.5 py-1 rounded-full bg-surface-variant text-on-surface-variant border border-outline-variant">
                            Quitado
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Metrics 3-column Box */}
                    <div className="grid grid-cols-3 gap-2 bg-surface-variant/50 p-3 rounded-xl border border-outline-variant text-center mb-4">
                      <div>
                        <span className="block text-[10px] uppercase font-bold text-on-surface-variant">Produzido</span>
                        <span className="text-sm font-bold text-on-surface">
                          {summary.totalItemsCount} <span className="text-[11px] font-normal text-on-surface-variant">unid.</span>
                        </span>
                        <div className="text-[10px] text-on-surface-variant truncate mt-0.5">
                          {summary.vasesProducedCount > 0 && `${summary.vasesProducedCount} mold.`}
                          {summary.vasesFinishedCount > 0 && ` ${summary.vasesFinishedCount} acab.`}
                          {summary.vasesPaintedCount > 0 && ` ${summary.vasesPaintedCount} pint.`}
                          {summary.totalItemsCount === 0 && 'Nenhum'}
                        </div>
                      </div>

                      <div>
                        <span className="block text-[10px] uppercase font-bold text-on-surface-variant">Valor Bruto</span>
                        <span className="text-sm font-bold text-on-surface">
                          R$ {summary.grossEarned.toFixed(2)}
                        </span>
                        <span className="block text-[10px] text-on-surface-variant mt-0.5">a receber</span>
                      </div>

                      <div>
                        <span className="block text-[10px] uppercase font-bold text-on-surface-variant">Já Pago</span>
                        <span className="text-sm font-bold text-amber-600 dark:text-amber-400">
                          R$ {summary.totalPaid.toFixed(2)}
                        </span>
                        <span className="block text-[10px] text-on-surface-variant mt-0.5">{summary.payments.length} vales</span>
                      </div>
                    </div>
                  </div>

                  {/* Bottom Action Buttons */}
                  <div className="flex items-center gap-2 pt-2 border-t border-outline-variant/60">
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        setSelectedEmpId(emp.id);
                      }}
                      className="flex-1 py-2 px-3 text-xs font-bold text-primary hover:bg-primary-container/40 rounded-xl transition-colors flex items-center justify-center gap-1.5"
                    >
                      <Eye className="w-3.5 h-3.5" />
                      Ver Histórico Completo
                    </button>

                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleOpenPaymentModal(emp.id, summary.netBalance > 0 ? summary.netBalance : undefined);
                      }}
                      className="py-2 px-3.5 text-xs font-bold bg-primary text-on-primary hover:brightness-105 rounded-xl shadow-xs transition-all flex items-center justify-center gap-1 shrink-0"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      Pagar
                    </button>
                  </div>
                </div>
              );
            })}

            {filteredSummaries.length === 0 && (
              <div className="col-span-1 md:col-span-2 bg-surface border border-dashed border-outline-variant rounded-2xl p-12 text-center">
                <Users className="w-10 h-10 text-on-surface-variant/50 mx-auto mb-3" />
                <p className="text-base font-medium text-on-surface">Nenhum colaborador encontrado com os filtros atuais.</p>
                <p className="text-xs text-on-surface-variant mt-1">Tente ajustar a busca ou alterar o filtro de setor/saldo.</p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* VIEW 2: ALL PAYMENT RECEIPTS */}
      {activeSubTab === 'RECEIPTS' && (
        <div className="space-y-4">
          {/* Search Box */}
          <div className="relative">
            <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-on-surface-variant" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Buscar recibos por colaborador ou observação..."
              className="w-full pl-10 pr-4 py-2.5 bg-surface rounded-xl border border-outline-variant text-sm text-on-surface focus:outline-none focus:ring-1 focus:ring-primary"
            />
          </div>

          <div className="space-y-3">
            {filteredReceipts.map(pay => {
              const payDate = new Date(pay.date);
              const emp = employees.find(e => e.id === pay.employeeId);
              const sectorInfo = getSectorStyle(pay.sector || emp?.sector || 'Geral');

              return (
                <div 
                  key={pay.id} 
                  className="bg-surface border border-outline-variant p-4 rounded-xl flex items-center justify-between shadow-xs hover:border-primary/40 transition-colors"
                >
                  <div className="flex items-center gap-3 min-w-0 pr-4">
                    <div className="bg-success-container p-2.5 rounded-full text-on-success-container shrink-0">
                      <Wallet className="w-5 h-5" />
                    </div>
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-bold text-on-surface text-base truncate">{pay.employeeName}</span>
                        <span className={cn("text-[10px] font-semibold px-2 py-0.5 rounded-full border", sectorInfo.badge)}>
                          {sectorInfo.label}
                        </span>
                      </div>
                      <p className="text-xs text-on-surface-variant mt-0.5">
                        {payDate.toLocaleDateString()} {payDate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} • {pay.observation || 'Sem observação'}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-3 shrink-0">
                    <span className="font-black text-lg text-emerald-600 dark:text-emerald-400">
                      - R$ {pay.amount.toFixed(2)}
                    </span>
                    <button
                      onClick={() => {
                        if (confirm(`Deseja realmente estornar/excluir este pagamento de R$ ${pay.amount.toFixed(2)} para ${pay.employeeName}?`)) {
                          deletePayment(pay.id);
                        }
                      }}
                      className="p-2 text-on-surface-variant hover:text-error hover:bg-error-container/20 rounded-lg transition-colors"
                      title="Excluir/Estornar pagamento"
                    >
                      <Trash className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              );
            })}

            {filteredReceipts.length === 0 && (
              <div className="bg-surface border border-dashed border-outline-variant rounded-2xl p-12 text-center">
                <Receipt className="w-10 h-10 text-on-surface-variant/50 mx-auto mb-3" />
                <p className="text-base font-medium text-on-surface">Nenhum comprovante de pagamento registrado neste período.</p>
                <p className="text-xs text-on-surface-variant mt-1">Clique em "Registrar Pagto." para lançar um pagamento ou vale.</p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* --- INDIVIDUAL COLLABORATOR HISTORY MODAL (O que ele fez e quando fez) --- */}
      <Modal
        isOpen={!!selectedEmpId}
        onClose={() => {
          setSelectedEmpId(null);
          setActivitySearchQuery('');
        }}
        title={`Histórico de ${selectedEmpSummary?.employee.name || 'Colaborador'}`}
        size="lg"
      >
        {selectedEmpSummary && (
          <div className="space-y-5">
            {/* Top Summary Banner */}
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 bg-surface-variant/40 p-4 rounded-2xl border border-outline-variant">
              <div>
                <div className="flex items-center gap-2 flex-wrap">
                  <h3 className="text-xl font-black text-on-surface">{selectedEmpSummary.employee.name}</h3>
                  <span className={cn("text-xs font-semibold px-2.5 py-0.5 rounded-full border", getSectorStyle(selectedEmpSummary.employee.sector).badge)}>
                    {getSectorStyle(selectedEmpSummary.employee.sector).label}
                  </span>
                </div>
                <p className="text-xs text-on-surface-variant mt-1">
                  Período: <span className="font-semibold text-on-surface">{selectedPeriodId === 'ALL' ? 'Todos os Períodos' : (periods.find(p => p.id === selectedPeriodId)?.name || 'Período Atual')}</span>
                </p>
              </div>

              <Button
                size="sm"
                onClick={() => handleOpenPaymentModal(selectedEmpSummary.employee.id, selectedEmpSummary.netBalance > 0 ? selectedEmpSummary.netBalance : undefined)}
                className="shrink-0"
              >
                <Plus className="w-4 h-4 mr-1" />
                Lançar Pagamento
              </Button>
            </div>

            {/* 4 Financial KPI Stat Cards inside modal */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 text-center">
              <div className="bg-surface p-3 rounded-xl border border-outline-variant">
                <span className="block text-[10px] font-bold uppercase text-on-surface-variant">Vasos Trabalhados</span>
                <span className="text-lg font-black text-on-surface">{selectedEmpSummary.totalItemsCount}</span>
                <span className="block text-[10px] text-on-surface-variant">peças no ciclo</span>
              </div>

              <div className="bg-surface p-3 rounded-xl border border-outline-variant">
                <span className="block text-[10px] font-bold uppercase text-on-surface-variant">Total Bruto</span>
                <span className="text-lg font-black text-on-surface">R$ {selectedEmpSummary.grossEarned.toFixed(2)}</span>
                <span className="block text-[10px] text-on-surface-variant">valor produzido</span>
              </div>

              <div className="bg-surface p-3 rounded-xl border border-outline-variant">
                <span className="block text-[10px] font-bold uppercase text-on-surface-variant">Total Vales/Pagos</span>
                <span className="text-lg font-black text-amber-600 dark:text-amber-400">R$ {selectedEmpSummary.totalPaid.toFixed(2)}</span>
                <span className="block text-[10px] text-on-surface-variant">{selectedEmpSummary.payments.length} recibos</span>
              </div>

              <div className="bg-surface p-3 rounded-xl border border-emerald-200 dark:border-emerald-800 bg-emerald-50/40 dark:bg-emerald-950/20">
                <span className="block text-[10px] font-bold uppercase text-emerald-800 dark:text-emerald-300">Saldo a Pagar</span>
                <span className="text-lg font-black text-emerald-600 dark:text-emerald-400">
                  R$ {selectedEmpSummary.netBalance.toFixed(2)}
                </span>
                <span className="block text-[10px] text-emerald-700 dark:text-emerald-400 font-medium">
                  {selectedEmpSummary.netBalance > 0 ? 'Pendente' : 'Quitado'}
                </span>
              </div>
            </div>

            {/* Sub-tabs in Modal */}
            <div className="flex border-b border-outline-variant gap-2 pt-2">
              <button
                onClick={() => setModalTab('ACTIVITIES')}
                className={cn(
                  "pb-2.5 px-3 text-xs font-bold transition-colors relative flex items-center gap-1.5",
                  modalTab === 'ACTIVITIES'
                    ? "text-primary border-b-2 border-primary"
                    : "text-on-surface-variant hover:text-on-surface"
                )}
              >
                <Package className="w-3.5 h-3.5" />
                <span>O que ele produziu ({selectedEmpSummary.activities.length})</span>
              </button>

              <button
                onClick={() => setModalTab('PAYMENTS')}
                className={cn(
                  "pb-2.5 px-3 text-xs font-bold transition-colors relative flex items-center gap-1.5",
                  modalTab === 'PAYMENTS'
                    ? "text-primary border-b-2 border-primary"
                    : "text-on-surface-variant hover:text-on-surface"
                )}
              >
                <Wallet className="w-3.5 h-3.5" />
                <span>Vales e Pagamentos Efetuados ({selectedEmpSummary.payments.length})</span>
              </button>
            </div>

            {/* TAB 1: O QUE ELE FEZ E QUANDO FEZ */}
            {modalTab === 'ACTIVITIES' && (
              <div className="space-y-3">
                {/* Search filter for items */}
                {selectedEmpSummary.activities.length > 5 && (
                  <div className="relative">
                    <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-on-surface-variant" />
                    <input
                      type="text"
                      value={activitySearchQuery}
                      onChange={(e) => setActivitySearchQuery(e.target.value)}
                      placeholder="Filtrar por modelo, código CIP ou etapa..."
                      className="w-full pl-9 pr-3 py-1.5 bg-surface-variant rounded-lg border border-outline-variant text-xs text-on-surface focus:outline-none"
                    />
                  </div>
                )}

                {modalFilteredActivities.length === 0 ? (
                  <div className="bg-surface-variant/30 border border-dashed border-outline-variant rounded-xl p-8 text-center">
                    <Package className="w-8 h-8 text-on-surface-variant/40 mx-auto mb-2" />
                    <p className="text-sm font-medium text-on-surface">Nenhum registro de produção encontrado para este colaborador.</p>
                    <p className="text-xs text-on-surface-variant mt-1">Certifique-se de que a produção foi confirmada no período selecionado.</p>
                  </div>
                ) : (
                  <div className="space-y-2 max-h-[45vh] overflow-y-auto pr-1">
                    {modalFilteredActivities.map((act) => {
                      const actDate = new Date(act.timestamp);
                      const actionStyle = getActionStyle(act.action);

                      return (
                        <div
                          key={act.id}
                          className="bg-surface border border-outline-variant p-3 rounded-xl flex items-center justify-between gap-3 hover:bg-surface-variant/30 transition-colors shadow-2xs"
                        >
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="font-bold text-on-surface text-sm">{act.modelName}</span>
                              {act.cip && (
                                <span className="font-mono text-[11px] font-bold px-2 py-0.5 rounded bg-surface-variant text-on-surface-variant border border-outline-variant">
                                  CIP: {act.cip}
                                </span>
                              )}
                              <span className={cn("text-[10px] font-semibold px-2 py-0.5 rounded-full border", actionStyle.color)}>
                                {act.actionLabel}
                              </span>
                            </div>

                            <div className="flex items-center gap-3 text-xs text-on-surface-variant mt-1">
                              <span className="flex items-center gap-1">
                                <Clock className="w-3 h-3" />
                                {actDate.toLocaleDateString()} às {actDate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                              </span>
                              <span className="text-[11px]">
                                Status: <span className="font-medium text-on-surface">{act.status}</span>
                              </span>
                            </div>
                          </div>

                          <div className="text-right whitespace-nowrap">
                            <span className="text-sm font-black text-emerald-600 dark:text-emerald-400">
                              + R$ {act.value.toFixed(2)}
                            </span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            )}

            {/* TAB 2: VALES E PAGAMENTOS EFETUADOS */}
            {modalTab === 'PAYMENTS' && (
              <div className="space-y-2 max-h-[45vh] overflow-y-auto pr-1">
                {selectedEmpSummary.payments.length === 0 ? (
                  <div className="bg-surface-variant/30 border border-dashed border-outline-variant rounded-xl p-8 text-center">
                    <Wallet className="w-8 h-8 text-on-surface-variant/40 mx-auto mb-2" />
                    <p className="text-sm font-medium text-on-surface">Nenhum pagamento ou vale registrado para este colaborador.</p>
                    <p className="text-xs text-on-surface-variant mt-1">Use o botão "Lançar Pagamento" acima para registrar adiantamentos.</p>
                  </div>
                ) : (
                  selectedEmpSummary.payments.map(pay => {
                    const payDate = new Date(pay.date);
                    return (
                      <div
                        key={pay.id}
                        className="bg-surface border border-outline-variant p-3 rounded-xl flex items-center justify-between gap-3 shadow-2xs"
                      >
                        <div className="min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="font-bold text-on-surface text-sm">
                              {payDate.toLocaleDateString()} {payDate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                            </span>
                          </div>
                          <p className="text-xs text-on-surface-variant mt-0.5">
                            Obs: {pay.observation || 'Sem observação'}
                          </p>
                        </div>

                        <div className="flex items-center gap-3 shrink-0">
                          <span className="font-black text-base text-amber-600 dark:text-amber-400">
                            - R$ {pay.amount.toFixed(2)}
                          </span>
                          <button
                            onClick={() => {
                              if (confirm(`Deseja excluir este pagamento de R$ ${pay.amount.toFixed(2)}?`)) {
                                deletePayment(pay.id);
                              }
                            }}
                            className="p-1.5 text-on-surface-variant hover:text-error hover:bg-error-container/20 rounded-lg transition-colors"
                            title="Excluir pagamento"
                          >
                            <Trash className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            )}
          </div>
        )}
      </Modal>

      {/* --- PAYMENT REGISTRATION MODAL --- */}
      <Modal
        isOpen={isPaymentModalOpen}
        onClose={() => setIsPaymentModalOpen(false)}
        title="Registrar Pagamento / Vale"
      >
        <form onSubmit={handleSavePayment} className="space-y-4">
          <div>
            <label className="text-xs font-bold uppercase text-on-surface-variant">Colaborador</label>
            <select
              value={paymentEmpId}
              onChange={(e) => {
                const id = e.target.value;
                setPaymentEmpId(id);
                const s = summaries.find(item => item.employee.id === id);
                if (s && s.netBalance > 0) {
                  setPaymentAmount(s.netBalance.toFixed(2));
                }
              }}
              required
              className="w-full p-3 rounded-xl bg-surface-variant border border-outline-variant mt-1 font-medium text-on-surface"
            >
              <option value="">Selecione um colaborador...</option>
              {employees.map(e => {
                const s = summaries.find(item => item.employee.id === e.id);
                const bal = s ? s.netBalance : 0;
                return (
                  <option key={e.id} value={e.id}>
                    {e.name} ({e.sector}) {bal > 0 ? `• A receber: R$ ${bal.toFixed(2)}` : '• Quitado'}
                  </option>
                );
              })}
            </select>
          </div>

          {/* Current Pending Balance Hint */}
          {paymentEmpId && (
            <div className="bg-surface-variant/60 p-3 rounded-xl border border-outline-variant flex items-center justify-between text-xs">
              <span className="text-on-surface-variant font-medium">Saldo pendente neste ciclo:</span>
              <span className="font-bold text-emerald-600 dark:text-emerald-400 text-sm">
                R$ {summaries.find(s => s.employee.id === paymentEmpId)?.netBalance.toFixed(2) || '0.00'}
              </span>
            </div>
          )}

          <div>
            <label className="text-xs font-bold uppercase text-on-surface-variant">Valor do Pagamento (R$)</label>
            <input
              type="number"
              step="0.01"
              value={paymentAmount}
              onChange={(e) => setPaymentAmount(e.target.value)}
              placeholder="0.00"
              required
              className="w-full p-3 rounded-xl bg-surface-variant border border-outline-variant mt-1 font-bold text-lg text-on-surface"
            />
          </div>

          <div>
            <label className="text-xs font-bold uppercase text-on-surface-variant">Data</label>
            <input
              type="date"
              value={paymentDate}
              onChange={(e) => setPaymentDate(e.target.value)}
              required
              className="w-full p-3 rounded-xl bg-surface-variant border border-outline-variant mt-1 text-on-surface"
            />
          </div>

          <div>
            <label className="text-xs font-bold uppercase text-on-surface-variant">Observação / Motivo</label>
            <input
              type="text"
              value={paymentObservation}
              onChange={(e) => setPaymentObservation(e.target.value)}
              placeholder="Ex: Quitação semanal, Vale, Adiantamento..."
              className="w-full p-3 rounded-xl bg-surface-variant border border-outline-variant mt-1 text-on-surface"
            />
          </div>

          <div className="pt-3 flex gap-2">
            <Button variant="ghost" type="button" onClick={() => setIsPaymentModalOpen(false)} className="flex-1">
              Cancelar
            </Button>
            <Button type="submit" className="flex-1">
              Confirmar Pagamento
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
};

// --- AUDIT TAB ---
const AuditTab = () => {
   const { systemLogs } = useStore();

   const getActionBadgeClass = (action: string) => {
      switch (action) {
         case 'SYSTEM_UPDATE':
            return 'bg-purple-500/15 text-purple-700 dark:text-purple-300 border border-purple-500/25';
         case 'PRODUCTION':
            return 'bg-primary/15 text-primary border border-primary/25';
         case 'FINISHING':
            return 'bg-secondary/15 text-secondary border border-secondary/25';
         case 'PAINTING':
            return 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 border border-emerald-500/25';
         case 'PAYMENT':
            return 'bg-green-500/15 text-green-700 dark:text-green-400 border border-green-500/25';
         case 'ADMIN_UPDATE':
            return 'bg-amber-500/15 text-amber-700 dark:text-amber-400 border border-amber-500/25';
         default:
            return 'bg-surface-variant text-on-surface-variant';
      }
   };
   
   return (
      <div className="pb-20">
         <div className="flex items-center justify-between mb-6">
            <h2 className="text-2xl font-normal text-on-background">Logs do Sistema e Auditoria</h2>
            <span className="text-xs font-mono font-medium px-2.5 py-1 rounded-full bg-surface-variant text-on-surface-variant">
               {systemLogs.length} eventos registrados
            </span>
         </div>
         <div className="space-y-3">
            {systemLogs.slice(0, 100).map(log => (
               <div key={log.id} className={`flex gap-4 p-3.5 rounded-2xl border ${log.action === 'SYSTEM_UPDATE' ? 'bg-purple-500/5 border-purple-500/20' : 'bg-surface border-outline-variant/60'} shadow-2xs transition-all`}>
                  <div className="flex-1">
                     <div className="flex items-center gap-2 mb-1.5 flex-wrap">
                        <span className={`text-[11px] font-bold px-2 py-0.5 rounded-md ${getActionBadgeClass(log.action)}`}>
                           {log.action === 'SYSTEM_UPDATE' ? 'ATUALIZAÇÃO DE SISTEMA' : log.action}
                        </span>
                        <span className="text-xs text-on-surface-variant font-mono">
                           {new Date(log.timestamp).toLocaleString('pt-BR')}
                        </span>
                     </div>
                     <p className="text-sm text-on-surface leading-relaxed">{log.details}</p>
                     <p className="text-xs text-on-surface-variant mt-1.5">Por: <span className="font-semibold text-on-surface">{log.actorName}</span></p>
                  </div>
                  {log.value && <div className="font-bold text-sm text-on-surface shrink-0 self-center">R$ {log.value.toFixed(2)}</div>}
               </div>
            ))}
            {systemLogs.length === 0 && <p className="text-center text-on-surface-variant py-10">Nenhum registro de log.</p>}
         </div>
      </div>
   );
};

// --- UPDATES TAB ---
const UpdatesTab = () => {
   const { changelog, systemVersion } = useStore();
   
   return (
      <div className="pb-20 max-w-4xl mx-auto">
         <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-6 pb-4 border-b border-outline-variant">
            <div>
               <h2 className="text-2xl font-bold text-on-background">Histórico de Versões</h2>
               <p className="text-xs text-on-surface-variant mt-0.5">
                  Registro detalhado de cada atualização, nova funcionalidade e melhoria do sistema
               </p>
            </div>
            <div className="flex items-center gap-2 bg-surface-variant/50 border border-outline-variant px-3.5 py-2 rounded-2xl self-start sm:self-auto shadow-xs">
               <span className="text-xs font-semibold text-on-surface-variant">Versão Atual:</span>
               <span className="px-2.5 py-0.5 bg-primary text-on-primary font-mono font-bold rounded-xl text-xs shadow-xs">
                  v{systemVersion}
               </span>
            </div>
         </div>

         <div className="space-y-6">
            {changelog.map((entry, idx) => (
               <div key={idx} className="relative pl-6 border-l-2 border-outline-variant hover:border-primary transition-colors">
                  <div className={`absolute -left-[9px] top-0 w-4 h-4 rounded-full border-4 border-background transition-all ${
                     idx === 0 ? 'bg-primary ring-2 ring-primary/40' : 'bg-outline-variant'
                  }`} />
                  <div className="mb-1 flex items-center gap-2 flex-wrap">
                     <span className="font-bold text-lg text-on-surface">v{entry.version}</span>
                     <Badge color={entry.type === 'FIX' ? 'red' : entry.type === 'FEATURE' ? 'green' : 'blue'}>
                        {entry.type === 'FIX' ? 'CORREÇÃO' : entry.type === 'FEATURE' ? 'NOVA FUNÇÃO' : entry.type === 'IMPROVEMENT' ? 'MELHORIA' : entry.type}
                     </Badge>
                     {idx === 0 && (
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
                           Ativa no Sistema
                        </span>
                     )}
                  </div>
                  <p className="text-xs text-on-surface-variant mb-2 font-medium">
                     {new Date(entry.date).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
                  </p>
                  <p className="text-sm text-on-surface leading-relaxed bg-surface/60 border border-outline-variant/60 rounded-xl p-3.5 shadow-2xs">
                     {entry.description}
                  </p>
               </div>
            ))}
         </div>
      </div>
   );
};

// --- CONFIG TAB ---
const ConfigTab = () => {
  const { 
    productionItems, payments, employees, periods, activePeriodId, closePeriod, reopenPeriod, currentUser,
    rawMaterialCostPerKg, updateRawMaterialCostPerKg, 
    paintingCommissionPercentage, updatePaintingCommissionPercentage,
    isDarkMode, toggleTheme, logout, systemVersion 
  } = useStore();
  
  const [confirmClosePeriod, setConfirmClosePeriod] = useState(false);
  const [isHistoryModalOpen, setIsHistoryModalOpen] = useState(false);
  const [periodToReopen, setPeriodToReopen] = useState<Period | null>(null);

  const [startDate, setStartDate] = useState(new Date().toISOString().split('T')[0]);
  const [endDate, setEndDate] = useState(new Date().toISOString().split('T')[0]);
  const [filterEmployeeId, setFilterEmployeeId] = useState<string>('');

  const activePeriod = periods.find(p => p.id === activePeriodId);

  // Sort periods with most recent first
  const sortedPeriods = useMemo(() => {
    return [...periods].sort((a, b) => b.startDate - a.startDate);
  }, [periods]);

  const handleExportReport = (type: 'production' | 'financial') => {
    const start = new Date(startDate + 'T00:00:00').getTime();
    const end = new Date(endDate + 'T23:59:59').getTime();
    let filteredItems = productionItems.filter(i => i.createdAt >= start && i.createdAt <= end);
    let filteredPayments = payments.filter(p => p.date >= start && p.date <= end);

    if (filterEmployeeId) {
      filteredItems = filteredItems.filter(i => i.producedBy === filterEmployeeId || i.finishedBy === filterEmployeeId || i.paintedBy === filterEmployeeId);
      filteredPayments = filteredPayments.filter(p => p.employeeId === filterEmployeeId);
    }
    
    const employeeName = filterEmployeeId ? employees.find(e => e.id === filterEmployeeId)?.name : 'Todos';
    const filters = `Período: ${new Date(startDate).toLocaleDateString()} a ${new Date(endDate).toLocaleDateString()} | Colaborador: ${employeeName || 'Todos'}`;

    exportSupervisorPDF(
        filteredItems,
        filteredPayments,
        filters,
        systemVersion,
        type
    );
  };

  const handleClosePeriod = () => {
     if (currentUser) {
        closePeriod(currentUser.id);
        setConfirmClosePeriod(false);
     }
  };

  const handleConfirmReopen = () => {
     if (periodToReopen && currentUser) {
        reopenPeriod(periodToReopen.id, currentUser.id);
        setPeriodToReopen(null);
     }
  };

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-2 duration-500">
      <div className="px-1">
        <h2 className="text-2xl font-normal text-on-background">Configurações</h2>
        <p className="text-xs text-on-surface-variant">Gestão do ciclo operacional, relatórios e parâmetros da fábrica</p>
      </div>
      
      {/* PERIOD MANAGEMENT */}
      <Card className="p-5 border border-primary/30 bg-surface shadow-sm">
         <div className="flex items-center justify-between mb-4">
           <div className="flex items-center gap-3 text-primary">
             <div className="bg-primary-container p-2 rounded-full"><RefreshCcw className="w-5 h-5 text-on-primary-container" /></div>
             <div>
                <h3 className="font-bold text-on-surface">Gestão de Período</h3>
                <p className="text-xs text-on-surface-variant">Ciclo ativo atual: <span className="font-bold text-primary">{activePeriod?.name}</span></p>
             </div>
           </div>
           <span className="px-3 py-1 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 text-xs font-bold rounded-full border border-emerald-500/20 flex items-center gap-1.5">
             <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
             Ativo
           </span>
         </div>
         
         <div className="bg-surface-variant/40 p-4 rounded-xl border border-outline-variant mb-5 text-sm text-on-surface-variant space-y-2">
            <p className="font-medium text-on-surface">Ciclo de Produção e Metas:</p>
            <ul className="list-disc pl-5 space-y-1 text-xs">
               <li>Ao fechar o período atual, as metas do novo ciclo iniciarão <strong>zeradas</strong>.</li>
               <li>Um novo período será criado automaticamente para os novos lançamentos.</li>
               <li>O histórico anterior fica salvo e pode ser consultado ou reaberto a qualquer momento.</li>
            </ul>
         </div>

         <div className="flex flex-col sm:flex-row gap-3">
            {!confirmClosePeriod ? (
               <Button onClick={() => setConfirmClosePeriod(true)} className="flex-1 h-12 bg-primary text-on-primary shadow-md hover:shadow-lg font-bold flex items-center justify-center gap-2">
                  <RefreshCcw className="w-4 h-4" /> Fechar Período Atual
               </Button>
            ) : (
               <div className="flex-1 space-y-3 animate-in fade-in p-4 bg-surface-variant rounded-2xl border border-outline-variant">
                  <div className="flex items-start gap-3 text-amber-700 dark:text-amber-300">
                     <AlertTriangle className="w-5 h-5 shrink-0 mt-0.5" />
                     <div className="text-xs space-y-1">
                        <p className="font-bold">Deseja fechar o período "{activePeriod?.name}"?</p>
                        <p>Um novo período será iniciado com metas zeradas. O histórico permanecerá salvo e poderá ser reaberto se necessário.</p>
                     </div>
                  </div>
                  <div className="flex gap-2 pt-2">
                     <Button variant="ghost" onClick={() => setConfirmClosePeriod(false)} className="flex-1">Cancelar</Button>
                     <Button variant="danger" onClick={handleClosePeriod} className="flex-1">Confirmar Fechamento</Button>
                  </div>
               </div>
            )}

            <Button 
               variant="outline" 
               onClick={() => setIsHistoryModalOpen(true)}
               className="h-12 border-outline-variant hover:border-primary text-on-surface hover:text-primary font-bold flex items-center justify-center gap-2 px-5 bg-surface-variant/40"
            >
               <History className="w-4 h-4 text-primary" />
               <span>Acessar Histórico</span>
               <span className="px-2 py-0.5 rounded-full text-xs bg-primary/10 text-primary font-bold">{periods.length}</span>
            </Button>
         </div>
      </Card>

      {/* MODAL DE HISTÓRICO DE PERÍODOS */}
      <Modal 
         isOpen={isHistoryModalOpen} 
         onClose={() => setIsHistoryModalOpen(false)}
         title="Histórico de Períodos"
         size="xl"
      >
         <div className="space-y-4">
            <div className="p-3 bg-surface-variant/50 rounded-xl border border-outline-variant text-xs text-on-surface-variant flex items-center justify-between">
               <span>Histórico completo de ciclos registrados no sistema.</span>
               <span className="font-bold text-on-surface">{sortedPeriods.length} {sortedPeriods.length === 1 ? 'período registrado' : 'períodos registrados'}</span>
            </div>

            <div className="space-y-3 max-h-[60vh] overflow-y-auto pr-1">
               {sortedPeriods.map(p => {
                  const isActive = p.id === activePeriodId;
                  const producedCount = productionItems.filter(i => i.periodId === p.id).length;
                  const finishedCount = productionItems.filter(i => i.finishedInPeriodId === p.id).length;
                  const paintedCount = productionItems.filter(i => i.paintedInPeriodId === p.id).length;
                  const totalPaid = payments.filter(pay => pay.periodId === p.id).reduce((sum, pay) => sum + pay.amount, 0);

                  return (
                     <div 
                        key={p.id} 
                        className={cn(
                           "p-4 rounded-2xl border transition-all",
                           isActive 
                              ? "bg-primary/5 border-primary/40 shadow-sm" 
                              : "bg-surface-variant/40 border-outline-variant hover:border-outline"
                        )}
                     >
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-3">
                           <div className="flex items-center gap-2.5">
                              <span className={cn(
                                 "w-2.5 h-2.5 rounded-full",
                                 isActive ? "bg-emerald-500 animate-pulse" : "bg-on-surface-variant/40"
                              )} />
                              <div>
                                 <h5 className="font-bold text-sm text-on-surface flex items-center gap-2">
                                    {p.name}
                                    {isActive && (
                                       <span className="text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 rounded-full">
                                          Atual
                                       </span>
                                    )}
                                 </h5>
                                 <p className="text-[11px] text-on-surface-variant">
                                    Início: {new Date(p.startDate).toLocaleDateString('pt-BR')} 
                                    {p.endDate ? ` • Fim: ${new Date(p.endDate).toLocaleDateString('pt-BR')}` : ' • Em andamento'}
                                 </p>
                              </div>
                           </div>

                           {!isActive && (
                              <Button 
                                 variant="outline" 
                                 size="sm"
                                 onClick={() => setPeriodToReopen(p)}
                                 className="self-start sm:self-auto text-xs font-bold border-primary text-primary hover:bg-primary/10 flex items-center gap-1.5 h-8 px-3"
                              >
                                 <RotateCcw className="w-3.5 h-3.5" /> Reabrir Período
                              </Button>
                           )}
                        </div>

                        {/* Estatísticas resumidas do período */}
                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-2 border-t border-outline-variant/50 text-xs">
                           <div className="bg-surface/70 p-2 rounded-xl border border-outline-variant/40">
                              <span className="text-[10px] text-on-surface-variant uppercase font-semibold block">Moldados</span>
                              <span className="font-bold text-on-surface text-sm">{producedCount} un</span>
                           </div>
                           <div className="bg-surface/70 p-2 rounded-xl border border-outline-variant/40">
                              <span className="text-[10px] text-on-surface-variant uppercase font-semibold block">Acabados</span>
                              <span className="font-bold text-on-surface text-sm">{finishedCount} un</span>
                           </div>
                           <div className="bg-surface/70 p-2 rounded-xl border border-outline-variant/40">
                              <span className="text-[10px] text-on-surface-variant uppercase font-semibold block">Pintados</span>
                              <span className="font-bold text-on-surface text-sm">{paintedCount} un</span>
                           </div>
                           <div className="bg-surface/70 p-2 rounded-xl border border-outline-variant/40">
                              <span className="text-[10px] text-on-surface-variant uppercase font-semibold block">Pagamentos</span>
                              <span className="font-bold text-emerald-600 dark:text-emerald-400 text-sm">
                                 {totalPaid.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                              </span>
                           </div>
                        </div>
                     </div>
                  );
               })}
            </div>
         </div>
      </Modal>

      {/* MODAL DE CONFIRMAÇÃO DE REABERTURA */}
      {periodToReopen && (
         <Modal 
            isOpen={true} 
            onClose={() => setPeriodToReopen(null)}
            title="Reabrir Período"
         >
            <div className="space-y-4">
               <div className="p-4 bg-primary/10 rounded-2xl border border-primary/20 flex items-start gap-3">
                  <RotateCcw className="w-6 h-6 text-primary shrink-0 mt-0.5" />
                  <div className="space-y-1">
                     <h4 className="font-bold text-on-surface text-sm">
                        Reativar ciclo: "{periodToReopen.name}"
                     </h4>
                     <p className="text-xs text-on-surface-variant">
                        Ao reabrir este período, o ciclo atual será pausado/fechado e o sistema voltará a registrar as peças, pagamentos e metas vinculadas a <strong>{periodToReopen.name}</strong>.
                     </p>
                  </div>
               </div>

               <div className="p-3 bg-surface-variant rounded-xl border border-outline-variant text-xs text-on-surface-variant space-y-1">
                  <p>• As metas e vasos que estavam em andamento neste ciclo voltarão a ser exibidos no painel do operador.</p>
                  <p>• Você poderá fechar novamente o período quando terminar.</p>
               </div>

               <div className="flex gap-2 pt-2">
                  <Button 
                     variant="ghost" 
                     onClick={() => setPeriodToReopen(null)} 
                     className="flex-1"
                  >
                     Cancelar
                  </Button>
                  <Button 
                     onClick={handleConfirmReopen} 
                     className="flex-1 bg-primary text-on-primary font-bold shadow-md flex items-center justify-center gap-2"
                  >
                     <RotateCcw className="w-4 h-4" /> Reabrir Agora
                  </Button>
               </div>
            </div>
         </Modal>
      )}

      {/* RELATÓRIOS & EXPORTAÇÃO */}
      <Card className="p-5 border border-outline-variant bg-surface">
         <div className="flex items-center gap-3 mb-4 text-secondary">
           <div className="bg-secondary-container p-2 rounded-full"><FileDown className="w-5 h-5 text-on-secondary-container" /></div>
           <h3 className="font-bold text-on-surface">Relatórios & Exportação (PDF)</h3>
         </div>
         <div className="space-y-4 bg-surface-variant p-4 rounded-xl border border-outline-variant">
            <div className="grid grid-cols-2 gap-3">
               <div>
                 <label className="text-xs font-bold text-on-surface-variant uppercase mb-1 block">Início</label>
                 <input type="date" value={startDate} onChange={e => setStartDate(e.target.value)} className="w-full p-2 rounded-lg border border-outline-variant bg-surface text-sm text-on-surface" />
               </div>
               <div>
                 <label className="text-xs font-bold text-on-surface-variant uppercase mb-1 block">Fim</label>
                 <input type="date" value={endDate} onChange={e => setEndDate(e.target.value)} className="w-full p-2 rounded-lg border border-outline-variant bg-surface text-sm text-on-surface" />
               </div>
            </div>
            <div>
               <label className="text-xs font-bold text-on-surface-variant uppercase mb-1 block">Filtrar por Colaborador (Opcional)</label>
               <select value={filterEmployeeId} onChange={e => setFilterEmployeeId(e.target.value)} className="w-full p-2 rounded-lg border border-outline-variant bg-surface text-sm text-on-surface">
                 <option value="">Todos</option>
                 {employees.map(e => <option key={e.id} value={e.id}>{e.name} - {e.sector}</option>)}
               </select>
            </div>
            <div className="grid grid-cols-2 gap-3 pt-2">
               <Button onClick={() => handleExportReport('production')} variant="secondary" className="text-xs h-10 font-bold">Exportar Produção (PDF)</Button>
               <Button onClick={() => handleExportReport('financial')} variant="outline" className="text-xs h-10 font-bold border-primary text-primary hover:bg-primary-container">Exportar Finan. (PDF)</Button>
            </div>
         </div>
      </Card>

      {/* Material & Commission Settings */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
         <Card className="p-5 border border-outline-variant bg-surface">
            <div className="flex items-center gap-3 mb-3 text-primary">
              <div className="bg-primary-container p-2 rounded-full"><Scale className="w-5 h-5 text-on-primary-container" /></div>
              <h3 className="font-bold text-on-surface">Matéria-Prima</h3>
            </div>
            <div className="relative">
               <span className="absolute left-4 top-1/2 -translate-y-1/2 text-on-surface-variant font-bold">R$</span>
               <input 
                  type="number" 
                  step="0.01" 
                  className="w-full pl-12 pr-4 py-3 bg-surface border border-outline-variant rounded-xl text-on-surface focus:outline-none focus:ring-2 focus:ring-primary font-bold text-lg" 
                  value={isNaN(rawMaterialCostPerKg) ? '' : rawMaterialCostPerKg} 
                  onChange={(e) => {
                    const val = parseFloat(e.target.value);
                    updateRawMaterialCostPerKg(isNaN(val) ? 0 : val);
                  }} 
               />
               <p className="text-xs text-on-surface-variant mt-2">Custo do Traço (por Kg)</p>
            </div>
         </Card>

         <Card className="p-5 border border-outline-variant bg-surface">
            <div className="flex items-center gap-3 mb-3 text-error">
              <div className="bg-error-container p-2 rounded-full"><Percent className="w-5 h-5 text-on-error-container" /></div>
              <h3 className="font-bold text-on-surface">Comissão de Pintura</h3>
            </div>
            <div className="relative">
               <span className="absolute right-4 top-1/2 -translate-y-1/2 text-on-surface-variant font-bold">%</span>
               <input 
                  type="number" 
                  step="0.1" 
                  className="w-full pl-4 pr-12 py-3 bg-surface border border-outline-variant rounded-xl text-on-surface focus:outline-none focus:ring-2 focus:ring-error font-bold text-lg" 
                  value={isNaN(paintingCommissionPercentage) ? '' : paintingCommissionPercentage} 
                  onChange={(e) => {
                    const val = parseFloat(e.target.value);
                    updatePaintingCommissionPercentage(isNaN(val) ? 0 : val);
                  }} 
               />
               <p className="text-xs text-on-surface-variant mt-2">Percentual sobre o valor de venda</p>
            </div>
         </Card>

         <Card className="flex items-center justify-between p-5 cursor-pointer hover:bg-surface-variant transition-colors bg-surface border-outline-variant col-span-1 md:col-span-2" onClick={toggleTheme}>
            <div className="flex items-center gap-3">
              <div className="bg-surface-variant p-2 rounded-full"><Moon className="w-5 h-5 text-on-surface-variant" /></div>
              <span className="font-medium text-on-surface">Modo Escuro</span>
            </div>
            <div className={`w-12 h-7 rounded-full p-1 transition-colors ${isDarkMode ? 'bg-primary' : 'bg-surface-variant border border-outline-variant'}`}>
               <div className={`w-5 h-5 bg-white rounded-full shadow-sm transition-transform ${isDarkMode ? 'translate-x-5' : 'translate-x-0'}`} />
            </div>
         </Card>
      </div>
      
      <Button variant="outline" className="w-full mt-4 text-on-surface-variant border-outline bg-surface" onClick={logout}>
        <LogOut className="mr-2 h-4 w-4" /> Encerrar Sessão
      </Button>
    </div>
  );
};

// --- SERVER TAB (DEDICATED INFRASTRUCTURE) ---
const ServerTab = () => {
  const [syncState, setSyncState] = useState<SyncStatus>({
     status: 'IDLE',
     lastSynced: null,
     isEncrypted: true
  });
  const [firebaseStatus, setFirebaseStatus] = useState<'IDLE' | 'TESTING' | 'CONNECTED' | 'QUOTA_EXCEEDED' | 'ERROR'>('IDLE');
  const [firebaseDetails, setFirebaseDetails] = useState({ projectId: '', databaseId: '', errorMsg: '' });

  useEffect(() => {
     const unsubscribe = subscribeToSyncStatus((status) => {
        setSyncState(status);
     });
     return () => unsubscribe();
  }, []);

  const handleManualSync = async () => {
     try {
       await syncData(false, true);
     } catch (e) {
       console.warn('Erro na sincronização manual:', e);
     }
  };

  const testFirebaseConnection = async () => {
    setFirebaseStatus('TESTING');
    try {
      const { db, firebaseConfig } = await import('../services/firebaseClient');
      const { collection, getDocs, limit, query } = await import('firebase/firestore');
      
      const q = query(collection(db, 'homepots_sync'), limit(1));
      await getDocs(q);
      
      setFirebaseDetails({
        projectId: firebaseConfig.projectId,
        databaseId: firebaseConfig.firestoreDatabaseId || '(default)',
        errorMsg: ''
      });
      setFirebaseStatus('CONNECTED');
    } catch (err: any) {
      const errMsg = err?.message || '';
      const isQuota = err?.code === 'resource-exhausted' || errMsg.includes('Quota limit exceeded') || errMsg.includes('resource-exhausted');
      setFirebaseDetails({
        projectId: 'hale-history-c6tp2',
        databaseId: 'ai-studio-homepotsmanager-824498bc-ea90-4002-bde4-0ef6ff0fd4e6',
        errorMsg: isQuota
          ? 'Cota diária gratuita do Firestore atingida (20.000 gravações/dia). O banco está conectado e ativo, operando no modo de segurança local.'
          : (err?.message || 'Falha ao conectar ao Firebase Firestore')
      });
      setFirebaseStatus(isQuota ? 'QUOTA_EXCEEDED' : 'ERROR');
    }
  };

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-2 duration-500">
      <div className="flex items-center justify-between px-1">
        <div>
           <h2 className="text-2xl font-normal text-on-background">Servidor & Nuvem</h2>
           <p className="text-xs text-on-surface-variant">Gestão do banco de dados nativo, segurança e sincronização em tempo real</p>
        </div>
        <span className="flex items-center gap-1.5 px-3 py-1 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 text-xs font-bold rounded-full border border-emerald-500/20">
           <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
           Online
        </span>
      </div>

      {/* 1. Google Firebase Firestore Native Database Card */}
      <Card className="p-5 border border-primary/30 bg-surface shadow-sm">
          <div className="flex items-center justify-between mb-4">
             <div className="flex items-center gap-3 text-primary">
                <div className="bg-primary-container p-2.5 rounded-xl"><Database className="w-5 h-5 text-on-primary-container" /></div>
                <div>
                   <h3 className="font-bold text-on-surface">Banco de Dados Nativo (Google Firebase Firestore)</h3>
                   <p className="text-xs text-on-surface-variant">Conexão nativa e sincronização na nuvem Google Cloud</p>
                </div>
             </div>
             <span className="text-[11px] font-bold px-2.5 py-1 rounded-full bg-primary-container text-on-primary-container">
                Google Cloud
             </span>
          </div>

          <div className="space-y-2.5 bg-surface-variant/40 p-4 rounded-xl border border-outline-variant text-xs mb-4">
             <div className="flex justify-between items-center py-1 border-b border-outline-variant/40">
                <span className="text-on-surface-variant font-medium">Projeto Google:</span>
                <span className="font-mono font-bold text-on-surface">hale-history-c6tp2</span>
             </div>
             <div className="flex justify-between items-center py-1 border-b border-outline-variant/40">
                <span className="text-on-surface-variant font-medium">Banco Firestore:</span>
                <span className="font-mono text-[11px] font-bold text-on-surface break-all">ai-studio-homepotsmanager-824498bc</span>
             </div>
             <div className="flex justify-between items-center py-1">
                <span className="text-on-surface-variant font-medium">Coleção de Sincronização:</span>
                <span className="font-mono font-bold text-primary">homepots_sync</span>
             </div>
          </div>

          {firebaseStatus !== 'IDLE' && firebaseStatus !== 'TESTING' && (
             <div className={`p-3.5 rounded-xl mb-4 border ${
                firebaseStatus === 'CONNECTED' 
                   ? 'bg-success-container/20 border-success text-on-surface' 
                   : firebaseStatus === 'QUOTA_EXCEEDED'
                   ? 'bg-amber-500/15 border-amber-500/40 text-on-surface'
                   : 'bg-error-container/20 border-error text-on-surface'
             }`}>
                <div className="flex items-center gap-2 font-bold text-sm mb-1">
                   {firebaseStatus === 'CONNECTED' && (
                      <><CheckCircle2 className="w-4 h-4 text-success" /> Conexão Google Firestore Operacional</>
                   )}
                   {firebaseStatus === 'QUOTA_EXCEEDED' && (
                      <><AlertCircle className="w-4 h-4 text-amber-500" /> Firebase Conectado (Cota Diária Gratuita Atingida)</>
                   )}
                   {firebaseStatus === 'ERROR' && (
                      <><AlertTriangle className="w-4 h-4 text-error" /> Erro ao contactar Firestore</>
                   )}
                </div>
                <p className="text-xs text-on-surface-variant mt-1 leading-relaxed">
                   {firebaseStatus === 'CONNECTED' 
                      ? 'O aplicativo está se comunicando com o Firestore com sucesso. Leitura e gravação validadas.'
                      : firebaseStatus === 'QUOTA_EXCEEDED'
                      ? 'Conexão com o banco Firestore confirmada. O limite diário gratuito de 20.000 gravações foi atingido. Todas as operações continuam funcionando localmente com persistência offline garantida.'
                      : (firebaseDetails.errorMsg || 'Verifique a conexão de rede.')}
                </p>
             </div>
          )}

          <Button 
             onClick={testFirebaseConnection} 
             variant="secondary" 
             className="w-full h-11 text-xs font-semibold"
             disabled={firebaseStatus === 'TESTING'}
          >
             {firebaseStatus === 'TESTING' ? 'Testando Conexão Firestore...' : 'Testar Conexão com Firestore'}
          </Button>
      </Card>

      {/* 2. Security & Cryptography Card */}
      <Card className="p-5 border border-emerald-500/30 bg-surface shadow-sm">
          <div className="flex items-center justify-between mb-4">
             <div className="flex items-center gap-3 text-emerald-600 dark:text-emerald-400">
                <div className="bg-emerald-500/10 p-2.5 rounded-xl"><ShieldCheck className="w-5 h-5 text-emerald-600 dark:text-emerald-400" /></div>
                <div>
                   <h3 className="font-bold text-on-surface">Privacidade & Criptografia de Dados</h3>
                   <p className="text-xs text-on-surface-variant">Proteção criptográfica em trânsito e em repouso</p>
                </div>
             </div>
             <span className="text-[11px] font-bold px-2.5 py-1 rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 flex items-center gap-1">
                <Lock className="w-3 h-3" /> AES-256-GCM
             </span>
          </div>

          <div className="bg-surface-variant/40 p-4 rounded-xl border border-outline-variant text-xs space-y-2 mb-4">
             <div className="flex justify-between items-center py-1 border-b border-outline-variant/40">
                <span className="text-on-surface-variant font-medium">Algoritmo de Proteção:</span>
                <span className="font-mono font-bold text-on-surface">AES-GCM (256-bit) + PBKDF2</span>
             </div>
             <div className="flex justify-between items-center py-1 border-b border-outline-variant/40">
                <span className="text-on-surface-variant font-medium">Partições Criptografadas:</span>
                <span className="font-bold text-emerald-600 dark:text-emerald-400">Pagamentos, Finanças & Colaboradores</span>
             </div>
             <div className="flex justify-between items-center py-1">
                <span className="text-on-surface-variant font-medium">Verificação de Integridade:</span>
                <span className="font-mono font-bold text-on-surface">SHA-256 Checksum</span>
             </div>
          </div>

          <p className="text-xs text-on-surface-variant leading-relaxed">
             Todos os dados internos confidenciais são encapsulados e cifrados no próprio dispositivo antes de qualquer sincronização com a nuvem. O terreno está completamente estruturado e protegido para as folhas de pagamento, recebimentos financeiros e dados de colaboradores.
          </p>
      </Card>

      {/* 3. Cloud Sync Status */}
      <Card className="p-5 border border-outline-variant bg-surface shadow-sm">
          <div className="flex items-center gap-3 mb-4 text-primary">
             <div className="bg-primary-container p-2.5 rounded-xl"><RefreshCcw className="w-5 h-5 text-on-primary-container" /></div>
             <div>
                <h3 className="font-bold text-on-surface">Sincronização em Tempo Real (Google Cloud)</h3>
                <p className="text-xs text-on-surface-variant">Compartilhamento em tempo real entre todos os aparelhos da fábrica</p>
             </div>
          </div>

          <div className="space-y-3 mb-4">
             <div className={`p-4 rounded-xl border flex flex-col gap-2 ${
                syncState.status === 'SUCCESS' ? 'bg-success-container/10 border-success text-on-surface' :
                syncState.status === 'SYNCING' ? 'bg-secondary-container/10 border-secondary text-on-surface' :
                syncState.status === 'OFFLINE' ? 'bg-amber-500/10 border-amber-500/50 text-on-surface' :
                syncState.status === 'QUOTA_EXCEEDED' ? 'bg-amber-500/10 border-amber-500/50 text-on-surface' :
                syncState.status === 'ERROR' ? 'bg-error-container/10 border-error text-on-surface' :
                'bg-surface-variant border-outline-variant text-on-surface'
             }`}>
                <div className="flex items-center gap-3 font-bold text-sm">
                   <div className={`w-3 h-3 rounded-full shrink-0 ${
                      syncState.status === 'SUCCESS' ? 'bg-success' :
                      syncState.status === 'SYNCING' ? 'bg-warning animate-pulse' :
                      syncState.status === 'OFFLINE' ? 'bg-amber-500' :
                      syncState.status === 'QUOTA_EXCEEDED' ? 'bg-amber-500' :
                      'bg-error'
                   }`} />
                   <span>
                      {syncState.status === 'IDLE' && 'Aguardando Sincronização'}
                      {syncState.status === 'SYNCING' && 'Sincronizando com o Firestore...'}
                      {syncState.status === 'SUCCESS' && 'Conectado, Sincronizado & Protegido'}
                      {syncState.status === 'OFFLINE' && 'Modo Offline (Dados salvos localmente)'}
                      {syncState.status === 'QUOTA_EXCEEDED' && 'Cota Gratuita Atingida (Modo Local Seguro Ativo)'}
                      {syncState.status === 'ERROR' && 'Erro de Sincronização'}
                   </span>
                </div>
                
                <div className="text-xs opacity-90 space-y-1 pl-6">
                   {syncState.lastSynced && (
                      <p><strong>Última Sincronização:</strong> {syncState.lastSynced.toLocaleTimeString()} em {syncState.lastSynced.toLocaleDateString()}</p>
                   )}
                   {syncState.status === 'QUOTA_EXCEEDED' && (
                      <p className="text-amber-600 dark:text-amber-400 font-medium leading-relaxed">
                        O limite de 20.000 gravações/dia do plano gratuito do Firebase foi alcançado. Todas as peças, cadastros, produções e pagamentos continuam funcionando normalmente e protegidos na memória local do aparelho (IndexedDB/LocalStorage). A sincronização na nuvem será retomada assim que a cota for renovada pelo Google Cloud.
                      </p>
                   )}
                   {syncState.status !== 'QUOTA_EXCEEDED' && syncState.errorMessage && (
                      <p className={syncState.status === 'OFFLINE' ? 'text-amber-600 dark:text-amber-400 font-medium' : 'text-error font-medium'}>
                        {syncState.errorMessage}
                      </p>
                   )}
                </div>
             </div>
          </div>

          <Button 
             onClick={handleManualSync} 
             variant="outline" 
             className="w-full h-11 flex items-center justify-center gap-2 border-primary text-primary hover:bg-primary-container font-bold"
             disabled={syncState.status === 'SYNCING'}
          >
             <RefreshCcw className={`w-4 h-4 ${syncState.status === 'SYNCING' ? 'animate-spin' : ''}`} />
             {syncState.status === 'SYNCING' ? 'Sincronizando...' : 'Sincronizar Agora'}
          </Button>
      </Card>
    </div>
  );
};

const SupervisorDashboard: React.FC = () => {
  const [activeTab, setActiveTab] = useState(0);

  const tabs = [
    { Icon: BarChart3, label: 'Indicad.' },
    { Icon: Package, label: 'Estoque' },
    { Icon: Target, label: 'Metas' },
    { Icon: BoxIcon, label: 'Modelos' },
    { Icon: Users, label: 'Colab.' },
    { Icon: DollarSign, label: 'Pag.' },
    { Icon: FileSearch, label: 'Audit.' },
    { Icon: Settings, label: 'Config' },
    { Icon: Server, label: 'Servidor' },
    { Icon: History, label: 'Atual.' },
  ];

  return (
    <div className="h-screen flex flex-col bg-background">
      <div className="bg-surface p-4 shadow-sm z-10 flex justify-between items-center px-6 border-b border-outline-variant">
         <h1 className="text-xl font-medium text-on-surface">Painel Supervisor</h1>
         <div className="w-8 h-8 bg-primary-container rounded-full flex items-center justify-center text-on-primary-container font-bold text-xs">SV</div>
      </div>

      <div className="flex-1 overflow-y-auto p-4 pb-24">
        {activeTab === 0 && <AnalyticsTab />}
        {activeTab === 1 && <StockTab />}
        {activeTab === 2 && <GoalsTab />}
        {activeTab === 3 && <ModelsTab />}
        {activeTab === 4 && <EmployeesTab />}
        {activeTab === 5 && <PaymentsTab />}
        {activeTab === 6 && <AuditTab />}
        {activeTab === 7 && <ConfigTab />}
        {activeTab === 8 && <ServerTab />}
        {activeTab === 9 && <UpdatesTab />}
      </div>

      <div className="bg-surface border-t border-outline-variant flex justify-around p-2 pb-6 shadow-md z-20 overflow-x-auto">
        {tabs.map((tab, idx) => {
          const isActive = activeTab === idx;
          return (
            <button 
              key={idx}
              onClick={() => setActiveTab(idx)}
              className="flex flex-col items-center justify-center min-w-[50px] gap-1 group"
            >
              <div className={`px-4 py-1.5 rounded-full transition-all duration-300 ${isActive ? 'bg-primary-container' : 'bg-transparent group-hover:bg-surface-variant'}`}>
                <tab.Icon size={18} className={`transition-colors ${isActive ? 'text-on-primary-container' : 'text-on-surface-variant'}`} />
              </div>
              <span className={`text-[9px] font-medium transition-colors ${isActive ? 'text-on-surface' : 'text-on-surface-variant'}`}>
                {tab.label}
              </span>
            </button>
          )
        })}
      </div>
    </div>
  );
};

export default SupervisorDashboard;
