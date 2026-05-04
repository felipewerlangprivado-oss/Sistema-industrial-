
import React, { useMemo } from 'react';
import { Modal, Badge, Button } from './UI';
import { ProductionItem, VaseModel, PaymentRecord, Sector } from '../types';
import { Calendar, DollarSign, Box, Wallet, Download, Hash } from 'lucide-react';
import { exportEmployeePDF } from '../utils/csvHelper'; // Renamed helper but file is same
import { useStore } from '../store';

interface HistoryModalProps {
  isOpen: boolean;
  onClose: () => void;
  mode: 'items' | 'financial' | 'payments';
  items: ProductionItem[]; // Production items
  payments?: PaymentRecord[]; // Payment records
  vaseModels: VaseModel[];
  valueKey: 'productionValue' | 'finishingValue' | 'paintingValue';
  title: string;
}

const HistoryModal: React.FC<HistoryModalProps> = ({ 
  isOpen, onClose, mode, items, payments = [], vaseModels, valueKey, title 
}) => {
  const { currentUser, systemVersion } = useStore();

  // Sort items by date descending
  const sortedItems = useMemo(() => {
    return [...items].sort((a, b) => b.updatedAt - a.updatedAt);
  }, [items]);

  // Sort payments by date descending
  const sortedPayments = useMemo(() => {
    return [...payments].sort((a, b) => b.date - a.date);
  }, [payments]);

  // Calculations
  const totalProduction = items.reduce((acc, curr) => acc + (curr[valueKey] || 0), 0);
  const totalPaid = payments.reduce((acc, curr) => acc + curr.amount, 0);

  // Group for financial view (Daily Production Summary)
  const financialData = useMemo(() => {
    const groups: Record<string, { date: string, count: number, total: number }> = {};
    
    sortedItems.forEach(item => {
      const date = new Date(item.updatedAt).toLocaleDateString('pt-BR');
      if (!groups[date]) {
        groups[date] = { date, count: 0, total: 0 };
      }
      groups[date].count += 1;
      groups[date].total += (item[valueKey] || 0);
    });

    return Object.values(groups).sort((a, b) => {
      const [d1, m1, y1] = a.date.split('/').map(Number);
      const [d2, m2, y2] = b.date.split('/').map(Number);
      return new Date(y2, m2 - 1, d2).getTime() - new Date(y1, m1 - 1, d1).getTime();
    });
  }, [sortedItems, valueKey]);

  // Determine Sector from ValueKey to restrict export
  const getSectorFromKey = (): Sector | undefined => {
    if (valueKey === 'productionValue') return Sector.PRODUCTION;
    if (valueKey === 'finishingValue') return Sector.FINISHING;
    if (valueKey === 'paintingValue') return Sector.PAINTING;
    return undefined;
  };
  
  const currentSector = getSectorFromKey();

  const handleExportPDF = () => {
    if (!currentUser) return;
    
    // We pass all data required for the PDF
    exportEmployeePDF(
        sortedItems,
        sortedPayments,
        currentUser.name,
        currentUser.sector,
        systemVersion,
        valueKey
    );
  };

  return (
    <Modal 
      isOpen={isOpen} 
      onClose={onClose} 
      title={title}
      footer={
        <div className="w-full flex flex-col gap-3">
           {currentSector && mode !== 'payments' && (
             <div className="text-xs text-center text-on-surface-variant bg-surface-variant/50 p-2 rounded-lg border border-outline-variant/50">
               Exportação restrita ao setor: <span className="font-bold text-primary">{currentSector.toUpperCase()}</span>
             </div>
           )}
           <div className="flex justify-end w-full">
             <Button variant="outline" size="sm" onClick={handleExportPDF} className="gap-2 border-outline-variant bg-surface w-full sm:w-auto text-on-surface hover:bg-surface-variant">
                <Download className="w-4 h-4" /> Exportar PDF
             </Button>
           </div>
        </div>
      }
    >
      <div className="space-y-4">
        {/* Header Summary - Solid Background */}
        <div className="bg-surface-variant p-4 rounded-2xl border border-outline-variant flex justify-between items-center text-on-surface-variant">
          {mode === 'payments' ? (
             <>
                <div>
                  <p className="text-xs uppercase font-bold">Total Recebido</p>
                  <p className="text-2xl font-bold text-success">R$ {totalPaid.toFixed(2)}</p>
                </div>
                <div className="text-right">
                  <p className="text-xs uppercase font-bold">Pagamentos</p>
                  <p className="text-xl font-medium text-on-surface">{payments.length}</p>
                </div>
             </>
          ) : (
            <>
              <div>
                 <p className="text-xs uppercase font-bold">Total Produzido</p>
                 <p className="text-2xl font-bold text-on-surface">R$ {totalProduction.toFixed(2)}</p>
              </div>
              <div className="text-right">
                 <p className="text-xs uppercase font-bold">Total Itens</p>
                 <p className="text-xl font-medium text-on-surface">{items.length}</p>
              </div>
            </>
          )}
        </div>

        <div className="relative">
          <div className="absolute inset-0 flex items-center" aria-hidden="true">
            <div className="w-full border-t border-outline-variant" />
          </div>
          <div className="relative flex justify-center">
            <span className="bg-surface px-2 text-xs text-on-surface-variant uppercase">
              {mode === 'items' && 'Detalhamento por Item'}
              {mode === 'financial' && 'Produção Diária'}
              {mode === 'payments' && 'Extrato de Pagamentos'}
            </span>
          </div>
        </div>

        {/* List Content */}
        <div className="space-y-2 max-h-[50vh] overflow-y-auto pr-1">
          
          {/* MODE: ITEMS */}
          {mode === 'items' && sortedItems.map(item => {
              const model = vaseModels.find(v => v.id === item.modelId) || { name: item.modelName };
              const date = new Date(item.updatedAt);
              return (
                <div key={item.id} className="flex flex-col p-3 bg-surface border border-outline-variant rounded-xl hover:bg-surface-variant transition-colors gap-2">
                  <div className="flex justify-between items-start">
                    <div className="flex items-start gap-3">
                        <div className="bg-primary-container p-2 rounded-full text-on-primary-container mt-1">
                        <Box className="w-4 h-4" />
                        </div>
                        <div>
                        <p className="font-medium text-on-surface">{item.modelName}</p>
                        <p className="text-xs text-on-surface-variant">
                            {date.toLocaleDateString('pt-BR')} • {date.toLocaleTimeString('pt-BR', {hour: '2-digit', minute:'2-digit'})}
                        </p>
                        <div className="flex items-center gap-2 mt-1">
                            <Badge color={item.type === 'Com Casca' ? 'blue' : 'yellow'}>{item.type}</Badge>
                            {item.cip && (
                                <span className="flex items-center gap-1 text-[10px] font-mono bg-on-surface-variant text-surface px-2 py-0.5 rounded-full">
                                    <Hash className="w-3 h-3" /> CIP: {item.cip}
                                </span>
                            )}
                        </div>
                        </div>
                    </div>
                    <div className="text-right">
                        <p className="font-bold text-success">+ R$ {(item[valueKey] || 0).toFixed(2)}</p>
                    </div>
                  </div>
                </div>
              );
          })}

          {/* MODE: FINANCIAL (Daily Summary) */}
          {mode === 'financial' && financialData.map((day, idx) => (
              <div key={idx} className="flex justify-between items-center p-4 bg-surface border border-outline-variant rounded-xl hover:bg-surface-variant transition-colors">
                 <div className="flex items-center gap-3">
                    <div className="bg-secondary-container p-2 rounded-full text-on-secondary-container">
                      <Calendar className="w-5 h-5" />
                    </div>
                    <div>
                      <p className="font-bold text-on-surface">{day.date}</p>
                      <p className="text-xs text-on-surface-variant">{day.count} itens processados</p>
                    </div>
                 </div>
                 <div className="text-right">
                    <p className="text-lg font-bold text-primary">R$ {day.total.toFixed(2)}</p>
                 </div>
              </div>
          ))}

          {/* MODE: PAYMENTS */}
          {mode === 'payments' && sortedPayments.map((payment) => (
              <div key={payment.id} className="flex justify-between items-center p-4 bg-surface border border-outline-variant rounded-xl hover:bg-surface-variant transition-colors">
                 <div className="flex items-center gap-3">
                    <div className="bg-success-container p-2 rounded-full text-on-success-container">
                      <Wallet className="w-5 h-5" />
                    </div>
                    <div>
                      <p className="font-bold text-on-surface">{new Date(payment.date).toLocaleDateString('pt-BR')}</p>
                      {payment.observation ? (
                        <p className="text-xs text-on-surface-variant italic max-w-[150px] truncate">"{payment.observation}"</p>
                      ) : (
                        <p className="text-xs text-on-surface-variant">Pagamento recebido</p>
                      )}
                    </div>
                 </div>
                 <div className="text-right">
                    <p className="text-lg font-bold text-success">- R$ {payment.amount.toFixed(2)}</p>
                 </div>
              </div>
          ))}

          {/* Empty State */}
          {((mode === 'items' && items.length === 0) || 
            (mode === 'financial' && items.length === 0) || 
            (mode === 'payments' && payments.length === 0)) && (
             <div className="text-center py-10 text-on-surface-variant">
               <p>Nenhum registro encontrado.</p>
             </div>
          )}
        </div>
      </div>
    </Modal>
  );
};

export default HistoryModal;
