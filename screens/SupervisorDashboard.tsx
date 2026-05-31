
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
  BarChart3, User as UserIcon, ChevronDown, Package, Search, ChevronRight, X, AlertTriangle, RefreshCcw, LayoutList, LayoutGrid, Clock, AlertCircle, Database, Copy, Check
} from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts';
import { VaseType, VaseModel, Sector, Employee, ItemStatus, PaymentRecord, Goal, GoalPeriod, GoalModelTarget, ProductionItem } from '../types';
import { v4 as uuidv4 } from 'uuid';
import { exportSupervisorPDF } from '../utils/csvHelper';
import { calculateRawMaterialCost, calculatePaintingCommission, getDaysDiff } from '../utils/calculations';
import { CURRENT_DB_VERSION } from '../config/systemVersion';
import { generateMigrationSQL } from '../utils/generateMigrationSQL';

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
   const { vaseModels, addVaseModel, updateVaseModel, deleteVaseModel } = useStore();
   const [isModalOpen, setIsModalOpen] = useState(false);
   const [editingModel, setEditingModel] = useState<VaseModel | null>(null);

   const handleSave = (e: React.FormEvent<HTMLFormElement>) => {
      e.preventDefault();
      const formData = new FormData(e.currentTarget);
      
      const newModel: VaseModel = {
         id: editingModel ? editingModel.id : uuidv4(),
         name: String(formData.get('name')),
         type: String(formData.get('type')) as VaseType,
         weightKg: Number(formData.get('weightKg')),
         costProduction: Number(formData.get('costProduction')),
         costFinishing: Number(formData.get('costFinishing') || 0),
         priceSale: Number(formData.get('priceSale') || 0),
      };

      if (editingModel) updateVaseModel(newModel);
      else addVaseModel(newModel);
      
      setIsModalOpen(false);
      setEditingModel(null);
   };

   return (
      <div className="pb-20">
         <div className="flex justify-between items-center mb-6">
            <h2 className="text-2xl font-normal text-on-background">Modelos de Vasos</h2>
            <Button onClick={() => { setEditingModel(null); setIsModalOpen(true); }}>
               <Plus className="w-5 h-5 mr-2" /> Novo Modelo
            </Button>
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
const PaymentsTab = () => {
   const { payments, employees, addPayment, activePeriodId } = useStore();
   const [isModalOpen, setIsModalOpen] = useState(false);

   const handleSave = (e: React.FormEvent<HTMLFormElement>) => {
      e.preventDefault();
      const formData = new FormData(e.currentTarget);
      const empId = String(formData.get('employeeId'));
      const emp = employees.find(e => e.id === empId);

      if (!emp) return;
      
      const newPayment: PaymentRecord = {
         id: uuidv4(),
         employeeId: emp.id,
         employeeName: emp.name,
         sector: emp.sector,
         amount: Number(formData.get('amount')),
         date: new Date(String(formData.get('date')) + 'T12:00:00').getTime(),
         observation: String(formData.get('observation')),
         periodId: activePeriodId || undefined
      };

      addPayment(newPayment);
      setIsModalOpen(false);
   };

   // Sort by date descending
   const sortedPayments = [...payments].sort((a,b) => b.date - a.date);

   return (
      <div className="pb-20">
         <div className="flex justify-between items-center mb-6">
            <h2 className="text-2xl font-normal text-on-background">Pagamentos</h2>
            <Button onClick={() => setIsModalOpen(true)}>
               <Plus className="w-5 h-5 mr-2" /> Registrar Pagto.
            </Button>
         </div>

         <div className="space-y-3">
            {sortedPayments.map(pay => (
               <div key={pay.id} className="bg-surface border border-outline-variant p-4 rounded-xl flex justify-between items-center">
                  <div className="flex items-center gap-3">
                     <div className="bg-success-container p-2 rounded-full text-on-success-container">
                        <Wallet className="w-5 h-5" />
                     </div>
                     <div>
                        <p className="font-bold text-on-surface">{pay.employeeName}</p>
                        <p className="text-xs text-on-surface-variant">
                           {new Date(pay.date).toLocaleDateString()} • {pay.observation || 'Sem obs.'}
                        </p>
                     </div>
                  </div>
                  <span className="font-bold text-lg text-success">- R$ {pay.amount.toFixed(2)}</span>
               </div>
            ))}
            {sortedPayments.length === 0 && <p className="text-center text-on-surface-variant py-10">Nenhum pagamento registrado.</p>}
         </div>

         <Modal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} title="Novo Pagamento">
            <form onSubmit={handleSave} className="space-y-4">
               <div>
                  <label className="text-xs font-bold uppercase text-on-surface-variant">Colaborador</label>
                  <select name="employeeId" required className="w-full p-3 rounded-xl bg-surface-variant border border-outline-variant mt-1">
                     <option value="">Selecione...</option>
                     {employees.map(e => <option key={e.id} value={e.id}>{e.name} ({e.sector})</option>)}
                  </select>
               </div>
               <div>
                  <label className="text-xs font-bold uppercase text-on-surface-variant">Valor (R$)</label>
                  <input type="number" step="0.01" name="amount" required className="w-full p-3 rounded-xl bg-surface-variant border border-outline-variant mt-1 font-bold text-lg" />
               </div>
               <div>
                  <label className="text-xs font-bold uppercase text-on-surface-variant">Data</label>
                  <input type="date" name="date" defaultValue={new Date().toISOString().split('T')[0]} required className="w-full p-3 rounded-xl bg-surface-variant border border-outline-variant mt-1" />
               </div>
               <div>
                  <label className="text-xs font-bold uppercase text-on-surface-variant">Observação</label>
                  <input type="text" name="observation" placeholder="Ex: Vale, Adiantamento..." className="w-full p-3 rounded-xl bg-surface-variant border border-outline-variant mt-1" />
               </div>
               <div className="pt-4 flex gap-2">
                  <Button variant="ghost" type="button" onClick={() => setIsModalOpen(false)} className="flex-1">Cancelar</Button>
                  <Button type="submit" className="flex-1">Confirmar</Button>
               </div>
            </form>
         </Modal>
      </div>
   );
};

// --- AUDIT TAB ---
const AuditTab = () => {
   const { systemLogs } = useStore();
   
   return (
      <div className="pb-20">
         <h2 className="text-2xl font-normal text-on-background mb-6">Logs do Sistema</h2>
         <div className="space-y-4">
            {systemLogs.slice(0, 100).map(log => (
               <div key={log.id} className="flex gap-4 p-3 border-b border-outline-variant last:border-0">
                  <div className="flex-1">
                     <div className="flex items-center gap-2 mb-1">
                        <span className="text-xs font-bold bg-surface-variant px-2 py-0.5 rounded text-on-surface-variant">{log.action}</span>
                        <span className="text-xs text-on-surface-variant">{new Date(log.timestamp).toLocaleString()}</span>
                     </div>
                     <p className="text-sm text-on-surface">{log.details}</p>
                     <p className="text-xs text-on-surface-variant mt-1">Por: <span className="font-medium">{log.actorName}</span></p>
                  </div>
                  {log.value && <div className="font-bold text-sm text-on-surface">R$ {log.value.toFixed(2)}</div>}
               </div>
            ))}
            {systemLogs.length === 0 && <p className="text-center text-on-surface-variant py-10">Nenhum registro de log.</p>}
         </div>
      </div>
   );
};

// --- UPDATES TAB ---
const UpdatesTab = () => {
   const { changelog } = useStore();
   
   return (
      <div className="pb-20">
         <h2 className="text-2xl font-normal text-on-background mb-6">Histórico de Versões</h2>
         <div className="space-y-6">
            {changelog.map((entry, idx) => (
               <div key={idx} className="relative pl-6 border-l-2 border-outline-variant">
                  <div className="absolute -left-[9px] top-0 w-4 h-4 rounded-full bg-primary border-4 border-background" />
                  <div className="mb-1 flex items-center gap-2">
                     <span className="font-bold text-lg text-on-surface">v{entry.version}</span>
                     <Badge color={entry.type === 'FIX' ? 'red' : entry.type === 'FEATURE' ? 'green' : 'blue'}>{entry.type}</Badge>
                  </div>
                  <p className="text-xs text-on-surface-variant mb-2">{new Date(entry.date).toLocaleDateString()}</p>
                  <p className="text-sm text-on-surface leading-relaxed">{entry.description}</p>
               </div>
            ))}
         </div>
      </div>
   );
};

// --- CONFIG TAB ---
const ConfigTab = () => {
  const { 
    productionItems, payments, employees, periods, activePeriodId, closePeriod, currentUser,
    rawMaterialCostPerKg, updateRawMaterialCostPerKg, 
    paintingCommissionPercentage, updatePaintingCommissionPercentage,
    isDarkMode, toggleTheme, logout, systemVersion 
  } = useStore();
  
  const [confirmClosePeriod, setConfirmClosePeriod] = useState(false);
  const [syncState, setSyncState] = useState<SyncStatus>({
     status: 'IDLE',
     lastSynced: null
  });

  useEffect(() => {
     const unsubscribe = subscribeToSyncStatus((status) => {
        setSyncState(status);
     });
     return () => unsubscribe();
  }, []);

  const handleManualSync = async () => {
     await syncData();
  };
  const [startDate, setStartDate] = useState(new Date().toISOString().split('T')[0]);
  const [endDate, setEndDate] = useState(new Date().toISOString().split('T')[0]);
  const [filterEmployeeId, setFilterEmployeeId] = useState<string>('');
  const [showSqlModal, setShowSqlModal] = useState(false);
  const [generatedSql, setGeneratedSql] = useState('');
  const [supabaseStatus, setSupabaseStatus] = useState<'IDLE' | 'TESTING' | 'CONNECTED' | 'NOT_CONFIGURED' | 'NO_CLIENT' | 'ERROR'>('IDLE');
  const [supabaseDetails, setSupabaseDetails] = useState({ url: '', hasKey: false, errorMsg: '' });

  const [envCheckStatus, setEnvCheckStatus] = useState<'IDLE' | 'CHECKING' | 'DONE'>('IDLE');
  const [envCheckResults, setEnvCheckResults] = useState<{
     url: { value: string, status: 'CORRECT' | 'INCORRECT' | 'NOT_CONFIGURED' },
     key: { value: string, status: 'CORRECT' | 'INCORRECT' | 'NOT_CONFIGURED' }
  }>({
     url: { value: '', status: 'NOT_CONFIGURED' },
     key: { value: '', status: 'NOT_CONFIGURED' }
  });

  const [diagStatus, setDiagStatus] = useState<'IDLE' | 'CHECKING' | 'DONE'>('IDLE');
  const [diagResults, setDiagResults] = useState({
     env: { mode: '', baseUrl: '', hasEnv: false },
     supabase: { url: '', hasUrl: false, urlValida: false, key: '', hasKey: false, keyValida: false },
     finalStatus: 'NÃO CONFIGURADO' as 'VITE NÃO CARREGOU .ENV' | 'VARIÁVEIS AUSENTES' | 'FORMATO INVÁLIDO' | 'CONFIGURAÇÃO OK' | 'NÃO CONFIGURADO'
  });

  const activePeriod = periods.find(p => p.id === activePeriodId);

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

  const handleGenerateSql = () => {
     // Defaulting fromVersion to 0 implies full initial creation or check
     const sql = generateMigrationSQL(0);
     setGeneratedSql(sql);
     setShowSqlModal(true);
  };

  const copyToClipboard = () => {
     navigator.clipboard.writeText(generatedSql);
     alert("Copiado para a área de transferência!");
  };

  const testSupabaseConnection = async () => {
    setSupabaseStatus('TESTING');
    try {
      const envUrl = import.meta.env.VITE_SUPABASE_URL || '';
      const envKey = import.meta.env.VITE_SUPABASE_ANON_KEY || '';
      
      setSupabaseDetails({ url: envUrl, hasKey: !!envKey, errorMsg: '' });

      if (!envUrl || !envKey) {
        setSupabaseStatus('NOT_CONFIGURED');
        return;
      }

      // Dynamically import to ensure we can catch if it fails
      const clientModule = await import('../services/supabaseClient').catch(() => null);
      
      if (!clientModule || !clientModule.supabase) {
        setSupabaseStatus('NO_CLIENT');
        return;
      }

      const { data, error } = await clientModule.supabase.auth.getSession();
      
      if (error) {
        setSupabaseDetails(prev => ({ ...prev, errorMsg: error.message }));
        setSupabaseStatus('ERROR');
      } else {
        setSupabaseStatus('CONNECTED');
      }
    } catch (err: any) {
      setSupabaseDetails(prev => ({ ...prev, errorMsg: err?.message || 'Erro desconhecido' }));
      setSupabaseStatus('ERROR');
    }
  };

  const handleVerifyEnv = () => {
      setEnvCheckStatus('CHECKING');
      setTimeout(() => {
          const url = (import.meta.env.VITE_SUPABASE_URL as string) || '';
          const key = (import.meta.env.VITE_SUPABASE_ANON_KEY as string) || '';

          const urlOk = url === "https://debhhucfesgemtxinvia.supabase.co";
          const keyOk = key === "sb_publishable_FotH1zQkHI8PptGPkgWWuQ_d7GU8Wbn";

          setEnvCheckResults({
              url: {
                  value: url,
                  status: url ? (urlOk ? 'CORRECT' : 'INCORRECT') : 'NOT_CONFIGURED'
              },
              key: {
                  value: key,
                  status: key ? (keyOk ? 'CORRECT' : 'INCORRECT') : 'NOT_CONFIGURED'
              }
          });
          setEnvCheckStatus('DONE');
      }, 500);
  };

  const handleRunDiagnostic = () => {
      setDiagStatus('CHECKING');
      setTimeout(() => {
          const viteEnv = import.meta.env;
          const mode = viteEnv.MODE || 'não identificado';
          const baseUrl = viteEnv.BASE_URL || 'não identificado';
          const hasEnv = Object.keys(viteEnv).length > 0;

          const urlValue = (viteEnv.VITE_SUPABASE_URL as string) || '';
          const keyValue = (viteEnv.VITE_SUPABASE_ANON_KEY as string) || '';

          const hasUrl = !!urlValue;
          const hasKey = !!keyValue;

          const urlValida = hasUrl && urlValue.includes("supabase.co");
          const keyValida = hasKey && keyValue.startsWith("sb_");

          let finalStatus: 'VITE NÃO CARREGOU .ENV' | 'VARIÁVEIS AUSENTES' | 'FORMATO INVÁLIDO' | 'CONFIGURAÇÃO OK' = 'VARIÁVEIS AUSENTES';
          if (!hasEnv) finalStatus = 'VITE NÃO CARREGOU .ENV';
          else if (!hasUrl || !hasKey) finalStatus = 'VARIÁVEIS AUSENTES';
          else if (!urlValida || !keyValida) finalStatus = 'FORMATO INVÁLIDO';
          else finalStatus = 'CONFIGURAÇÃO OK';

          setDiagResults({
              env: { mode, baseUrl, hasEnv },
              supabase: { url: urlValue, hasUrl, urlValida, key: keyValue, hasKey, keyValida },
              finalStatus
          });
          setDiagStatus('DONE');
      }, 500);
  };

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-2 duration-500">
      <h2 className="text-2xl font-normal text-on-background px-1">Configurações</h2>
      
      {/* PERIOD MANAGEMENT */}
      <Card className="p-5 border border-primary/30 bg-surface shadow-md">
         <div className="flex items-center gap-3 mb-4 text-primary">
           <div className="bg-primary-container p-2 rounded-full"><RefreshCcw className="w-5 h-5 text-on-primary-container" /></div>
           <div>
              <h3 className="font-bold text-on-surface">Gestão de Período</h3>
              <p className="text-xs text-on-surface-variant">Ciclo atual: <span className="font-bold">{activePeriod?.name}</span></p>
           </div>
         </div>
         
         <div className="bg-surface-variant/30 p-4 rounded-xl border border-outline-variant mb-4 text-sm text-on-surface-variant">
            <p>O fechamento do período irá:</p>
            <ul className="list-disc pl-5 mt-1 space-y-1">
               <li>Encerrar o ciclo de metas e pagamentos atual.</li>
               <li>Criar um novo período automaticamente.</li>
               <li><strong className="text-primary">Preservar</strong> todo o histórico e estoque.</li>
            </ul>
         </div>

         {!confirmClosePeriod ? (
            <Button onClick={() => setConfirmClosePeriod(true)} className="w-full h-12 bg-primary text-on-primary shadow-lg font-bold">
               Fechar Período Atual
            </Button>
         ) : (
            <div className="space-y-3 animate-in fade-in">
               <div className="p-3 bg-error-container text-on-error-container rounded-lg flex items-center gap-2">
                  <AlertTriangle className="w-5 h-5" />
                  <span className="text-xs font-bold">Tem certeza? Esta ação é irreversível.</span>
               </div>
               <div className="flex gap-2">
                  <Button variant="ghost" onClick={() => setConfirmClosePeriod(false)} className="flex-1">Cancelar</Button>
                  <Button variant="danger" onClick={handleClosePeriod} className="flex-1">Confirmar Fechamento</Button>
               </div>
            </div>
         )}
      </Card>

      <Card className="p-5 border border-outline-variant bg-surface">
         <div className="flex items-center gap-3 mb-4 text-secondary">
           <div className="bg-secondary-container p-2 rounded-full"><FileDown className="w-5 h-5 text-on-secondary-container" /></div>
           <h3 className="font-bold text-on-surface">Relatórios & Exportação (PDF)</h3>
         </div>
         <div className="space-y-4 bg-surface-variant p-4 rounded-xl border border-outline-variant">
            <div className="grid grid-cols-2 gap-3">
               <div>
                 <label className="text-xs font-bold text-on-surface-variant uppercase mb-1 block">Início</label>
                 <input type="date" value={startDate} onChange={e => setStartDate(e.target.value)} className="w-full p-2 rounded-lg border border-outline-variant bg-surface text-sm" />
               </div>
               <div>
                 <label className="text-xs font-bold text-on-surface-variant uppercase mb-1 block">Fim</label>
                 <input type="date" value={endDate} onChange={e => setEndDate(e.target.value)} className="w-full p-2 rounded-lg border border-outline-variant bg-surface text-sm" />
               </div>
            </div>
            <div>
               <label className="text-xs font-bold text-on-surface-variant uppercase mb-1 block">Filtrar por Colaborador (Opcional)</label>
               <select value={filterEmployeeId} onChange={e => setFilterEmployeeId(e.target.value)} className="w-full p-2 rounded-lg border border-outline-variant bg-surface text-sm">
                 <option value="">Todos</option>
                 {employees.map(e => <option key={e.id} value={e.id}>{e.name} - {e.sector}</option>)}
               </select>
            </div>
            <div className="grid grid-cols-2 gap-3 pt-2">
               <Button onClick={() => handleExportReport('production')} variant="secondary" className="text-xs h-10">Exportar Produção (PDF)</Button>
               <Button onClick={() => handleExportReport('financial')} variant="outline" className="text-xs h-10 border-primary text-primary hover:bg-primary-container">Exportar Finan. (PDF)</Button>
            </div>
         </div>
      </Card>

      {/* DB Migration Tools */}
      <Card className="p-5 border border-outline-variant bg-surface">
          <div className="flex items-center gap-3 mb-4 text-on-surface-variant">
             <div className="bg-surface-variant p-2 rounded-full"><Database className="w-5 h-5" /></div>
             <h3 className="font-bold text-on-surface">Banco de Dados (Supabase)</h3>
          </div>
          <p className="text-xs text-on-surface-variant mb-4">
             Gere scripts SQL para atualizar a estrutura do banco de dados na nuvem.
          </p>
          <Button onClick={handleGenerateSql} variant="outline" className="w-full border-outline-variant text-on-surface">
             Gerar Script de Migração
          </Button>

          <div className="mt-6 border-t border-outline-variant pt-4">
             <h4 className="text-sm font-bold text-on-surface mb-3">Status da Conexão com Supabase</h4>
             
             {supabaseStatus !== 'IDLE' && supabaseStatus !== 'TESTING' && (
                <div className={`p-3 rounded-lg mb-3 ${
                   supabaseStatus === 'CONNECTED' ? 'bg-success-container text-on-success-container' :
                   (supabaseStatus === 'NOT_CONFIGURED' || supabaseStatus === 'NO_CLIENT') ? 'bg-secondary-container text-on-secondary-container' :
                   'bg-error-container text-on-error-container'
                }`}>
                   <div className="flex items-center gap-2 font-bold mb-1">
                      {supabaseStatus === 'CONNECTED' && <><CheckCircle2 className="w-4 h-4" /> Conectado</>}
                      {supabaseStatus === 'NOT_CONFIGURED' && <><AlertTriangle className="w-4 h-4" /> Não configurado</>}
                      {supabaseStatus === 'NO_CLIENT' && <><AlertTriangle className="w-4 h-4" /> Cliente Não Criado</>}
                      {supabaseStatus === 'ERROR' && <><XCircle className="w-4 h-4" /> Erro de Conexão</>}
                   </div>
                   <div className="text-xs space-y-1 mt-2 opacity-90">
                      <p><strong>URL Detectada:</strong> {supabaseDetails.url || 'Nenhuma'}</p>
                      <p><strong>Chave (Anon Key):</strong> {supabaseDetails.hasKey ? 'Existe' : 'Ausente'}</p>
                      {supabaseDetails.errorMsg && <p className="mt-1"><strong>Erro:</strong> {supabaseDetails.errorMsg}</p>}
                   </div>
                </div>
             )}

             <Button 
                onClick={testSupabaseConnection} 
                variant="secondary" 
                className="w-full h-10 text-xs"
                disabled={supabaseStatus === 'TESTING'}
             >
                {supabaseStatus === 'TESTING' ? 'Testando...' : 'Testar Conexão'}
             </Button>
          </div>

          <div className="mt-6 border-t border-outline-variant pt-4">
             <h4 className="text-sm font-bold text-on-surface mb-3 flex items-center gap-2">
                 Verificação Supabase (Variáveis)
             </h4>
             <p className="text-xs text-on-surface-variant mb-4">
                 Verifica se a URL e a Chave pública (Anon Key) correspondem ao projeto esperado.
             </p>

             {envCheckStatus !== 'IDLE' && envCheckStatus !== 'CHECKING' && (
                 <div className="space-y-3 mb-4">
                     {/* URL Status */}
                     <div className={`p-3 rounded-lg border ${
                         envCheckResults.url.status === 'CORRECT' ? 'bg-success-container/20 border-success text-on-surface' :
                         envCheckResults.url.status === 'NOT_CONFIGURED' ? 'bg-secondary-container/20 border-secondary text-on-surface' :
                         'bg-error-container/20 border-error text-on-surface'
                     }`}>
                         <p className="text-xs font-bold uppercase mb-1">URL do Projeto</p>
                         <p className="text-sm font-mono break-all">{envCheckResults.url.value || 'Nenhuma'}</p>
                         <div className="flex items-center gap-1 mt-2 text-xs font-bold">
                             {envCheckResults.url.status === 'CORRECT' && <span className="text-success flex items-center gap-1"><CheckCircle2 className="w-3 h-3" /> Correto</span>}
                             {envCheckResults.url.status === 'INCORRECT' && <span className="text-error flex items-center gap-1"><XCircle className="w-3 h-3" /> Incorreto</span>}
                             {envCheckResults.url.status === 'NOT_CONFIGURED' && <span className="text-secondary flex items-center gap-1"><AlertTriangle className="w-3 h-3" /> Não configurado</span>}
                         </div>
                     </div>

                     {/* KEY Status */}
                     <div className={`p-3 rounded-lg border ${
                         envCheckResults.key.status === 'CORRECT' ? 'bg-success-container/20 border-success text-on-surface' :
                         envCheckResults.key.status === 'NOT_CONFIGURED' ? 'bg-secondary-container/20 border-secondary text-on-surface' :
                         'bg-error-container/20 border-error text-on-surface'
                     }`}>
                         <p className="text-xs font-bold uppercase mb-1">Chave Pública (Anon Key)</p>
                         <p className="text-sm font-mono break-all">
                             {envCheckResults.key.value 
                                 ? (envCheckResults.key.value.length > 10 
                                     ? `${envCheckResults.key.value.substring(0, 6)}...${envCheckResults.key.value.substring(envCheckResults.key.value.length - 4)}` 
                                     : envCheckResults.key.value)
                                 : 'Nenhuma'}
                         </p>
                         <div className="flex items-center gap-1 mt-2 text-xs font-bold">
                             {envCheckResults.key.status === 'CORRECT' && <span className="text-success flex items-center gap-1"><CheckCircle2 className="w-3 h-3" /> Correto</span>}
                             {envCheckResults.key.status === 'INCORRECT' && <span className="text-error flex items-center gap-1"><XCircle className="w-3 h-3" /> Incorreto</span>}
                             {envCheckResults.key.status === 'NOT_CONFIGURED' && <span className="text-secondary flex items-center gap-1"><AlertTriangle className="w-3 h-3" /> Não configurado</span>}
                         </div>
                     </div>
                 </div>
             )}

             <Button 
                onClick={handleVerifyEnv} 
                variant="outline" 
                className="w-full h-10 text-xs border-outline-variant text-on-surface"
                disabled={envCheckStatus === 'CHECKING'}
             >
                {envCheckStatus === 'CHECKING' ? 'Verificando...' : 'Verificar Configuração'}
             </Button>
          </div>

          <div className="mt-6 border-t border-outline-variant pt-4">
             <h4 className="text-sm font-bold text-on-surface mb-3 flex items-center gap-2">
                 Diagnóstico Supabase
             </h4>
             
             {diagStatus !== 'IDLE' && diagStatus !== 'CHECKING' && (
                 <div className="space-y-4 mb-4">
                     <div className="p-3 bg-surface-variant rounded-lg border border-outline-variant">
                         <h5 className="text-xs font-bold uppercase text-on-surface-variant mb-2">🧠 Ambiente Vite</h5>
                         <div className="text-sm space-y-1">
                             <p><strong>Mode:</strong> {diagResults.env.mode}</p>
                             <p><strong>BASE_URL:</strong> {diagResults.env.baseUrl}</p>
                             <p><strong>.env carregado?</strong> {diagResults.env.hasEnv ? 'Sim' : 'Não'}</p>
                         </div>
                     </div>

                     <div className="p-3 bg-surface-variant rounded-lg border border-outline-variant">
                         <h5 className="text-xs font-bold uppercase text-on-surface-variant mb-2">🔗 Supabase</h5>
                         <div className="text-sm space-y-2">
                             <div>
                                 <p className="text-xs font-bold text-on-surface-variant uppercase mb-1">URL</p>
                                 <p className="font-mono break-all">{diagResults.supabase.hasUrl ? diagResults.supabase.url : 'Não encontrado'}</p>
                                 <p className={`text-xs font-bold mt-1 ${diagResults.supabase.urlValida ? 'text-success' : 'text-error'}`}>
                                     Status: {diagResults.supabase.urlValida ? 'Formato Válido' : 'Formato Inválido / Ausente'}
                                 </p>
                             </div>
                             <div className="pt-2 border-t border-outline-variant/50">
                                 <p className="text-xs font-bold text-on-surface-variant uppercase mb-1">Chave</p>
                                 <p className="font-mono break-all">
                                     {diagResults.supabase.hasKey 
                                         ? (diagResults.supabase.key.length > 10 
                                             ? `${diagResults.supabase.key.substring(0, 6)}...${diagResults.supabase.key.substring(diagResults.supabase.key.length - 4)}` 
                                             : diagResults.supabase.key)
                                         : 'Não encontrado'}
                                 </p>
                                 <p className={`text-xs font-bold mt-1 ${diagResults.supabase.keyValida ? 'text-success' : 'text-error'}`}>
                                      Status: {diagResults.supabase.keyValida ? 'Formato Válido' : 'Formato Inválido / Ausente'}
                                 </p>
                             </div>
                         </div>
                     </div>

                     <div className={`p-4 rounded-lg flex flex-col items-center justify-center text-center border ${
                         diagResults.finalStatus === 'CONFIGURAÇÃO OK' ? 'bg-success-container/30 border-success text-success' :
                         diagResults.finalStatus === 'NÃO CONFIGURADO' ? 'bg-secondary-container/30 border-secondary text-secondary' :
                         'bg-error-container/30 border-error text-error'
                     }`}>
                         <h5 className="text-xs font-bold uppercase mb-1 text-on-surface">Status Geral</h5>
                         <p className="text-xl font-black">{diagResults.finalStatus}</p>
                     </div>
                 </div>
             )}

             <Button 
                onClick={handleRunDiagnostic} 
                variant="secondary" 
                className="w-full h-10 text-xs"
                disabled={diagStatus === 'CHECKING'}
             >
                {diagStatus === 'CHECKING' ? 'Executando...' : 'Executar Diagnóstico'}
             </Button>
          </div>
      </Card>

      {/* Cloud Sync Status */}
      <Card className="p-5 border border-outline-variant bg-surface">
          <div className="flex items-center gap-3 mb-4 text-primary">
             <div className="bg-primary-container p-2 rounded-full"><RefreshCcw className="w-5 h-5 text-on-primary-container" /></div>
             <h3 className="font-bold text-on-surface">Sincronização de Aparelhos (Nuvem)</h3>
          </div>
          <p className="text-xs text-on-surface-variant mb-4">
             O sistema sincroniza automaticamente dados de produção, históricos e logs entre vários aparelhos celulares em tempo real.
          </p>

          <div className="space-y-3 mb-4">
             <div className={`p-4 rounded-xl border flex flex-col gap-2 ${
                syncState.status === 'SUCCESS' ? 'bg-success-container/10 border-success text-on-surface' :
                syncState.status === 'SYNCING' ? 'bg-secondary-container/10 border-secondary text-on-surface' :
                syncState.status === 'TABLE_MISSING' ? 'bg-error-container/10 border-error text-on-surface' :
                syncState.status === 'ERROR' ? 'bg-error-container/10 border-error text-on-surface' :
                'bg-surface-variant border-outline-variant text-on-surface'
             }`}>
                <div className="flex items-center gap-3 font-bold text-sm">
                   <div className={`w-3 h-3 rounded-full animate-pulse shrink-0 ${
                      syncState.status === 'SUCCESS' ? 'bg-success' :
                      syncState.status === 'SYNCING' ? 'bg-warning' :
                      'bg-error'
                   }`} />
                   <span>
                      {syncState.status === 'IDLE' && 'Aguardando Sincronização'}
                      {syncState.status === 'SYNCING' && 'Sincronizando com a Nuvem...'}
                      {syncState.status === 'SUCCESS' && 'Sincronizado e Protegido'}
                      {syncState.status === 'ERROR' && 'Erro de Sincronização'}
                      {syncState.status === 'TABLE_MISSING' && 'Configuração de Tabelas Pendente'}
                   </span>
                </div>
                
                <div className="text-xs opacity-90 space-y-1 pl-6">
                   {syncState.lastSynced && (
                      <p><strong>Última Sincronização:</strong> {syncState.lastSynced.toLocaleTimeString()} em {syncState.lastSynced.toLocaleDateString()}</p>
                   )}
                   {syncState.errorMessage && (
                      <p className="text-error font-medium">{syncState.errorMessage}</p>
                   )}
                   {syncState.status === 'TABLE_MISSING' && (
                      <p className="text-error font-semibold mt-1">
                         Aviso: Por favor, clique em "Gerar Script de Migração" logo acima, copie o script gerado, acesse o painel de administração do seu Supabase, clique em "SQL Editor", cole o script e clique em "Run" para habilitar a sincronização automática.
                      </p>
                   )}
                </div>
             </div>
          </div>

          <Button 
             onClick={handleManualSync} 
             variant="outline" 
             className="w-full h-11 flex items-center justify-center gap-2 border-primary text-primary hover:bg-primary-container"
             disabled={syncState.status === 'SYNCING'}
          >
             <RefreshCcw className={`w-4 h-4 ${syncState.status === 'SYNCING' ? 'animate-spin' : ''}`} />
             {syncState.status === 'SYNCING' ? 'Sincronizando...' : 'Sincronizar Agora'}
          </Button>
      </Card>

      {/* Material & Commission Settings ... (Same as before) */}
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

      <Modal isOpen={showSqlModal} onClose={() => setShowSqlModal(false)} title="Script SQL">
          <div className="space-y-4">
             <div className="bg-surface-variant p-3 rounded-xl border border-outline-variant font-mono text-xs overflow-x-auto max-h-[300px]">
                <pre>{generatedSql || 'Nenhuma atualização necessária.'}</pre>
             </div>
             <Button onClick={copyToClipboard} className="w-full gap-2">
                <Copy className="w-4 h-4" /> Copiar SQL
             </Button>
             <p className="text-xs text-center text-on-surface-variant">Cole este script no Editor SQL do painel do Supabase.</p>
          </div>
      </Modal>
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
        {activeTab === 8 && <UpdatesTab />}
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
