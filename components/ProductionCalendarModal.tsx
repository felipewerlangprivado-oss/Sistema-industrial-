import React, { useState, useMemo } from 'react';
import { Modal } from './UI';
import { ProductionItem, VaseModel, VaseType } from '../types';
import { ChevronLeft, ChevronRight, Calendar, Box, Hash, Clock, CheckCircle, Package } from 'lucide-react';

export type CalendarSectorStage = 'production' | 'finishing' | 'painting';

interface ProductionCalendarModalProps {
  isOpen: boolean;
  onClose: () => void;
  items: ProductionItem[];
  vaseModels: VaseModel[];
  userName?: string;
  showFinancials?: boolean;
  initialDate?: string; // YYYY-MM-DD
  stage?: CalendarSectorStage;
}

// Retorna 'YYYY-MM-DD' em horário local
const formatLocalDateKey = (timestamp: number | Date): string => {
  const d = new Date(timestamp);
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

const getItemTimestamp = (item: ProductionItem, stage: CalendarSectorStage): number => {
  if (stage === 'finishing') {
    return item.finishedAt || item.updatedAt || item.createdAt;
  }
  if (stage === 'painting') {
    return item.paintedAt || item.updatedAt || item.createdAt;
  }
  return item.createdAt;
};

const getItemValue = (item: ProductionItem, stage: CalendarSectorStage): number => {
  if (stage === 'finishing') {
    return item.finishingValue || 0;
  }
  if (stage === 'painting') {
    return item.paintingValue || 0;
  }
  return item.productionValue || 0;
};

const getStageInfo = (stage: CalendarSectorStage) => {
  switch (stage) {
    case 'finishing':
      return {
        title: 'Histórico de Acabamento',
        subtitle: 'ganho com acabamento',
        listLabel: 'Lista de Peças Finalizadas:',
        emptyTitle: 'Nenhum acabamento nesta data',
        emptyDesc: 'Toque nos dias marcados com o ponto verde no calendário para conferir os acabamentos realizados.',
        countTooltip: (n: number) => `${n} acabamento(s) realizado(s)`
      };
    case 'painting':
      return {
        title: 'Histórico de Pintura',
        subtitle: 'comissão de pintura',
        listLabel: 'Lista de Peças Pintadas:',
        emptyTitle: 'Nenhuma pintura nesta data',
        emptyDesc: 'Toque nos dias marcados com o ponto verde no calendário para conferir as pinturas realizadas.',
        countTooltip: (n: number) => `${n} vaso(s) pintado(s)`
      };
    default:
      return {
        title: 'Histórico de Produção',
        subtitle: 'ganho com moldagem',
        listLabel: 'Lista de Peças Produzidas:',
        emptyTitle: 'Nenhum vaso registrado nesta data',
        emptyDesc: 'Toque nos dias marcados com o ponto verde no calendário para conferir o que foi produzido.',
        countTooltip: (n: number) => `${n} vaso(s) produzido(s)`
      };
  }
};

export const ProductionCalendarModal: React.FC<ProductionCalendarModalProps> = ({
  isOpen,
  onClose,
  items,
  vaseModels,
  userName,
  showFinancials = true,
  initialDate,
  stage = 'production',
}) => {
  const todayKey = useMemo(() => formatLocalDateKey(new Date()), []);
  const [selectedDateKey, setSelectedDateKey] = useState<string>(initialDate || todayKey);
  const stageInfo = useMemo(() => getStageInfo(stage), [stage]);

  // Mês e ano atualmente visualizados no calendário
  const [viewDate, setViewDate] = useState<Date>(() => {
    if (initialDate) {
      const [y, m, d] = initialDate.split('-').map(Number);
      return new Date(y, m - 1, d || 1);
    }
    return new Date();
  });

  // Agrupa os itens do operador por data ('YYYY-MM-DD')
  const productionByDate = useMemo(() => {
    const map: Record<string, ProductionItem[]> = {};
    items.forEach(item => {
      const ts = getItemTimestamp(item, stage);
      const key = formatLocalDateKey(ts);
      if (!map[key]) {
        map[key] = [];
      }
      map[key].push(item);
    });
    return map;
  }, [items, stage]);

  // Navegação de mês
  const handlePrevMonth = () => {
    setViewDate(prev => new Date(prev.getFullYear(), prev.getMonth() - 1, 1));
  };

  const handleNextMonth = () => {
    setViewDate(prev => new Date(prev.getFullYear(), prev.getMonth() + 1, 1));
  };

  const handleGoToToday = () => {
    const now = new Date();
    setViewDate(new Date(now.getFullYear(), now.getMonth(), 1));
    setSelectedDateKey(todayKey);
  };

  // Informações do mês corrente
  const year = viewDate.getFullYear();
  const month = viewDate.getMonth();
  const monthName = viewDate.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' });

  // Dias do mês
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const firstDayIndex = new Date(year, month, 1).getDay(); // 0 = Domingo, 1 = Segunda...

  // Dias vazios no início para alinhamento
  const emptyDaysStart = Array.from({ length: firstDayIndex }, (_, i) => i);

  // Itens do dia selecionado
  const selectedDayItems = useMemo(() => {
    const list = productionByDate[selectedDateKey] || [];
    return [...list].sort((a, b) => getItemTimestamp(b, stage) - getItemTimestamp(a, stage));
  }, [productionByDate, selectedDateKey, stage]);

  // Resumo do dia selecionado
  const dayStats = useMemo(() => {
    const totalQty = selectedDayItems.length;
    const totalValue = selectedDayItems.reduce((acc, it) => acc + getItemValue(it, stage), 0);

    // Agrupamento por modelo
    const modelCounts: Record<string, { name: string; type: VaseType; count: number; value: number }> = {};
    selectedDayItems.forEach(it => {
      const model = vaseModels.find(m => m.id === it.modelId);
      const name = model?.name || it.modelName || 'Vaso';
      const type = model?.type || it.type;
      const key = `${name}__${type}`;
      if (!modelCounts[key]) {
        modelCounts[key] = { name, type, count: 0, value: 0 };
      }
      modelCounts[key].count += 1;
      modelCounts[key].value += getItemValue(it, stage);
    });

    return {
      totalQty,
      totalValue,
      modelSummary: Object.values(modelCounts).sort((a, b) => b.count - a.count),
    };
  }, [selectedDayItems, vaseModels, stage]);

  // Formatação legível da data selecionada
  const formattedSelectedDate = useMemo(() => {
    const [y, m, d] = selectedDateKey.split('-').map(Number);
    const dateObj = new Date(y, m - 1, d);
    return dateObj.toLocaleDateString('pt-BR', {
      weekday: 'long',
      day: '2-digit',
      month: 'long',
      year: 'numeric'
    });
  }, [selectedDateKey]);

  if (!isOpen) return null;

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={stageInfo.title}
      size="xl"
      className="p-0 overflow-hidden"
    >
      <div className="flex flex-col lg:grid lg:grid-cols-12 gap-6 -mt-2">
        {/* COLUNA ESQUERDA: O CALENDÁRIO */}
        <div className="lg:col-span-6 flex flex-col bg-surface-variant/30 rounded-2xl p-4 border border-outline-variant">
          {/* Navegação do Mês */}
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <Calendar className="w-5 h-5 text-primary" />
              <h3 className="font-bold text-on-surface capitalize text-base">
                {monthName}
              </h3>
            </div>
            
            <div className="flex items-center gap-1">
              <button
                type="button"
                onClick={handleGoToToday}
                className="px-2.5 py-1 text-xs font-semibold rounded-lg text-primary hover:bg-primary/10 border border-primary/20 mr-1 transition-colors"
              >
                Hoje
              </button>
              <button
                type="button"
                onClick={handlePrevMonth}
                className="p-1.5 rounded-lg text-on-surface-variant hover:bg-surface-variant transition-colors"
                title="Mês anterior"
              >
                <ChevronLeft className="w-5 h-5" />
              </button>
              <button
                type="button"
                onClick={handleNextMonth}
                className="p-1.5 rounded-lg text-on-surface-variant hover:bg-surface-variant transition-colors"
                title="Próximo mês"
              >
                <ChevronRight className="w-5 h-5" />
              </button>
            </div>
          </div>

          {/* Cabeçalho dos Dias da Semana */}
          <div className="grid grid-cols-7 text-center text-xs font-semibold text-on-surface-variant mb-2">
            <span>Dom</span>
            <span>Seg</span>
            <span>Ter</span>
            <span>Qua</span>
            <span>Qui</span>
            <span>Sex</span>
            <span>Sáb</span>
          </div>

          {/* Grade de Dias */}
          <div className="grid grid-cols-7 gap-1.5">
            {emptyDaysStart.map((_, idx) => (
              <div key={`empty-${idx}`} className="h-11 sm:h-12" />
            ))}

            {Array.from({ length: daysInMonth }, (_, i) => {
              const dayNum = i + 1;
              const dayKey = `${year}-${String(month + 1).padStart(2, '0')}-${String(dayNum).padStart(2, '0')}`;
              const dayItems = productionByDate[dayKey] || [];
              const hasProduction = dayItems.length > 0;
              const isSelected = selectedDateKey === dayKey;
              const isToday = todayKey === dayKey;

              return (
                <button
                  key={dayKey}
                  type="button"
                  onClick={() => setSelectedDateKey(dayKey)}
                  className={`relative h-11 sm:h-12 rounded-xl flex flex-col items-center justify-center transition-all cursor-pointer ${
                    isSelected
                      ? 'bg-primary text-on-primary font-bold shadow-md scale-105 z-10 ring-2 ring-primary ring-offset-1'
                      : isToday
                      ? 'border-2 border-primary text-primary font-bold hover:bg-surface-variant'
                      : hasProduction
                      ? 'bg-surface hover:bg-surface-variant text-on-surface border border-outline-variant shadow-xs'
                      : 'hover:bg-surface-variant/60 text-on-surface-variant/80'
                  }`}
                >
                  <span className="text-sm leading-tight">{dayNum}</span>

                  {/* Indicador visual: Ponto verde vibrante */}
                  {hasProduction && (
                    <div className="flex items-center gap-0.5 mt-0.5">
                      <span
                        className={`w-2 h-2 rounded-full transition-colors ${
                          isSelected ? 'bg-white ring-1 ring-black/20' : 'bg-emerald-500 animate-pulse'
                        }`}
                        title={stageInfo.countTooltip(dayItems.length)}
                      />
                      <span className={`text-[10px] font-semibold leading-none ${isSelected ? 'text-white/90' : 'text-emerald-700 dark:text-emerald-400'}`}>
                        {dayItems.length}
                      </span>
                    </div>
                  )}
                </button>
              );
            })}
          </div>

          {/* Legenda rápida */}
          <div className="mt-4 pt-3 border-t border-outline-variant/60 flex items-center justify-between text-xs text-on-surface-variant">
            <div className="flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 inline-block" />
              <span>Dias trabalhados</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full border-2 border-primary inline-block" />
              <span>Hoje</span>
            </div>
          </div>
        </div>

        {/* COLUNA DIREITA: DETALHAMENTO DO DIA SELECIONADO */}
        <div className="lg:col-span-6 flex flex-col">
          {/* Título da Data Selecionada */}
          <div className="border-b border-outline-variant pb-3 mb-3">
            <p className="text-xs uppercase tracking-wider text-on-surface-variant font-bold">Produção do dia</p>
            <h4 className="text-lg font-bold text-on-surface capitalize">
              {formattedSelectedDate}
            </h4>
          </div>

          {/* Cards de Resumo do Dia */}
          <div className="grid grid-cols-2 gap-3 mb-4">
            <div className="bg-surface border border-outline-variant rounded-xl p-3 shadow-xs">
              <p className="text-xs text-on-surface-variant font-medium">Total de Peças</p>
              <p className="text-2xl font-bold text-on-surface mt-0.5">{dayStats.totalQty}</p>
              <p className="text-[11px] text-on-surface-variant/80">peças registradas</p>
            </div>
            {showFinancials && (
              <div className="bg-surface border border-outline-variant rounded-xl p-3 shadow-xs">
                <p className="text-xs text-on-surface-variant font-medium">Valor do Dia</p>
                <p className="text-2xl font-bold text-emerald-600 dark:text-emerald-400 mt-0.5">
                  R$ {dayStats.totalValue.toFixed(2)}
                </p>
                <p className="text-[11px] text-on-surface-variant/80">{stageInfo.subtitle}</p>
              </div>
            )}
          </div>

          {/* Conteúdo: Lista ou Estado Vazio */}
          {selectedDayItems.length === 0 ? (
            <div className="bg-surface border border-dashed border-outline-variant rounded-2xl p-8 text-center flex-1 flex flex-col items-center justify-center">
              <div className="bg-surface-variant p-3 rounded-full text-on-surface-variant mb-2">
                <Package className="w-6 h-6 opacity-60" />
              </div>
              <p className="font-semibold text-on-surface text-sm">
                {stageInfo.emptyTitle}
              </p>
              <p className="text-xs text-on-surface-variant mt-1 max-w-xs">
                {stageInfo.emptyDesc}
              </p>
            </div>
          ) : (
            <div className="flex-1 flex flex-col min-h-0 space-y-3">
              {/* Resumo Agrupado por Modelo */}
              {dayStats.modelSummary.length > 0 && (
                <div className="bg-surface-variant/40 border border-outline-variant/60 rounded-xl p-3">
                  <p className="text-xs font-bold text-on-surface mb-2">Resumo por Modelo:</p>
                  <div className="flex flex-wrap gap-2">
                    {dayStats.modelSummary.map((item, idx) => (
                      <span
                        key={idx}
                        className="text-xs bg-surface border border-outline-variant px-2.5 py-1 rounded-lg font-medium text-on-surface flex items-center gap-1.5 shadow-xs"
                      >
                        <span className="font-bold text-primary">{item.count}x</span>
                        <span>{item.name}</span>
                        {showFinancials && (
                          <span className="text-emerald-600 dark:text-emerald-400 font-semibold text-[11px]">
                            (R$ {item.value.toFixed(2)})
                          </span>
                        )}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {/* Lista Detalhada das Peças com CIP e Status */}
              <div className="flex-1 overflow-y-auto max-h-[300px] space-y-2 pr-1">
                <p className="text-xs font-bold text-on-surface-variant">{stageInfo.listLabel}</p>
                {selectedDayItems.map((item) => {
                  const itemTime = new Date(getItemTimestamp(item, stage)).toLocaleTimeString([], {
                    hour: '2-digit',
                    minute: '2-digit',
                  });

                  let statusLabel = 'Aguardando Acabamento';
                  let statusColor = 'bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300 border-amber-200 dark:border-amber-800';

                  if (item.status === 'AWAITING_PAINTING') {
                    statusLabel = 'Aguardando Pintura';
                    statusColor = 'bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-300 border-blue-200 dark:border-blue-800';
                  } else if (item.status === 'FINISHED') {
                    statusLabel = 'Finalizado';
                    statusColor = 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800';
                  } else if (item.status === 'STOCK_NO_SHELL') {
                    statusLabel = 'Estoque Sem Casca';
                    statusColor = 'bg-slate-100 text-slate-800 dark:bg-slate-800 dark:text-slate-300 border-slate-200 dark:border-slate-700';
                  }

                  const earnedValue = getItemValue(item, stage);

                  return (
                    <div
                      key={item.id}
                      className="bg-surface border border-outline-variant rounded-xl p-3 shadow-xs flex items-center justify-between gap-3 hover:bg-surface-variant/30 transition-colors"
                    >
                      <div className="flex flex-col gap-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-semibold text-sm text-on-surface truncate">
                            {item.modelName}
                          </span>
                          {item.cip && (
                            <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-surface-variant text-on-surface-variant border border-outline-variant font-bold flex items-center gap-0.5">
                              <Hash className="w-2.5 h-2.5" /> {item.cip}
                            </span>
                          )}
                        </div>
                        <div className="flex items-center gap-2 text-xs text-on-surface-variant">
                          <span className="flex items-center gap-1">
                            <Clock className="w-3 h-3" /> {itemTime}
                          </span>
                          <span className={`px-2 py-0.5 rounded-full text-[10px] font-medium border ${statusColor}`}>
                            {statusLabel}
                          </span>
                        </div>
                      </div>

                      {showFinancials && (
                        <div className="text-right whitespace-nowrap">
                          <span className="text-sm font-bold text-emerald-600 dark:text-emerald-400">
                            + R$ {earnedValue.toFixed(2)}
                          </span>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      </div>
    </Modal>
  );
};
