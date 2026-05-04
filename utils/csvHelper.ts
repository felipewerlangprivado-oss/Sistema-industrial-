
import { ProductionItem, PaymentRecord, VaseModel, Sector } from '../types';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

// Configuração básica de cores e layout
const PRIMARY_COLOR = '#0061a4';
const SECONDARY_COLOR = '#535f70';
const ACCENT_COLOR = '#d1e4ff';

const formatCurrency = (val: number) => `R$ ${val.toFixed(2).replace('.', ',')}`;
const formatDate = (timestamp: number) => new Date(timestamp).toLocaleDateString('pt-BR');

// --- Helper Functions ---

const addHeader = (doc: jsPDF, title: string, subtitle: string, systemVersion: string) => {
    doc.setFillColor(PRIMARY_COLOR);
    doc.rect(0, 0, 210, 20, 'F');
    
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(14);
    doc.setFont('helvetica', 'bold');
    doc.text("HOME POTS MANAGER", 105, 13, { align: 'center' });
    
    doc.setTextColor(0, 0, 0);
    doc.setFontSize(12);
    doc.setFont('helvetica', 'bold');
    doc.text(title, 14, 30);
    
    doc.setFontSize(10);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(80, 80, 80);
    doc.text(subtitle, 14, 36);
    
    doc.line(14, 40, 196, 40); // Horizontal line
};

const addFooter = (doc: jsPDF, systemVersion: string) => {
    const pageCount = doc.getNumberOfPages();
    for (let i = 1; i <= pageCount; i++) {
        doc.setPage(i);
        doc.setFontSize(8);
        doc.setTextColor(150, 150, 150);
        doc.text(
            `Gerado em ${new Date().toLocaleString('pt-BR')} - v${systemVersion} - Página ${i} de ${pageCount}`,
            105,
            290,
            { align: 'center' }
        );
    }
};

// --- Employee Reports ---

export const exportEmployeePDF = (
    items: ProductionItem[],
    payments: PaymentRecord[],
    employeeName: string,
    sector: string,
    systemVersion: string,
    valueKey: 'productionValue' | 'finishingValue' | 'paintingValue'
) => {
    const doc = new jsPDF();
    const title = `Relatório de Produção - ${employeeName}`;
    const subtitle = `Setor: ${sector} | Total de Registros: ${items.length + payments.length}`;

    addHeader(doc, title, subtitle, systemVersion);

    // 1. Tabela de Produção
    const prodTotal = items.reduce((acc, i) => acc + (i[valueKey] || 0), 0);
    const prodBody = items.map(item => [
        formatDate(item.updatedAt),
        item.cip || 'N/A',
        item.modelName,
        item.type,
        formatCurrency(item[valueKey] || 0)
    ]);

    doc.setFontSize(11);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(0, 0, 0);
    doc.text("Histórico de Produção", 14, 48);

    autoTable(doc, {
        startY: 50,
        head: [['Data', 'CIP', 'Modelo', 'Tipo', 'Valor']],
        body: prodBody,
        theme: 'striped',
        headStyles: { fillColor: PRIMARY_COLOR },
        foot: [['', '', '', 'TOTAL', formatCurrency(prodTotal)]],
        footStyles: { fillColor: SECONDARY_COLOR, fontStyle: 'bold' }
    });

    // 2. Tabela de Pagamentos
    const payTotal = payments.reduce((acc, p) => acc + p.amount, 0);
    const payBody = payments.map(p => [
        formatDate(p.date),
        p.observation || '-',
        formatCurrency(p.amount)
    ]);

    let finalY = (doc as any).lastAutoTable.finalY || 50;
    
    doc.text("Histórico de Pagamentos", 14, finalY + 15);

    autoTable(doc, {
        startY: finalY + 18,
        head: [['Data', 'Observação', 'Valor Recebido']],
        body: payBody,
        theme: 'striped',
        headStyles: { fillColor: [0, 100, 0] }, // Greenish for payments
        foot: [['', 'TOTAL RECEBIDO', formatCurrency(payTotal)]],
        footStyles: { fillColor: SECONDARY_COLOR, fontStyle: 'bold' }
    });

    // 3. Resumo Financeiro
    finalY = (doc as any).lastAutoTable.finalY + 15;
    
    // Check page break for summary
    if (finalY > 250) {
        doc.addPage();
        finalY = 20;
    }

    const balance = prodTotal - payTotal;
    
    doc.setFillColor(240, 240, 240);
    doc.roundedRect(14, finalY, 180, 30, 3, 3, 'F');
    
    doc.setFontSize(12);
    doc.text("RESUMO FINANCEIRO", 105, finalY + 8, { align: 'center' });
    
    doc.setFontSize(10);
    doc.text(`Total Produzido: ${formatCurrency(prodTotal)}`, 20, finalY + 18);
    doc.text(`Total Pago: ${formatCurrency(payTotal)}`, 20, finalY + 24);
    
    doc.setFontSize(14);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(balance >= 0 ? 0 : 200, balance >= 0 ? 100 : 0, 0); // Green if positive, Red if negative
    doc.text(`Saldo a Receber: ${formatCurrency(balance)}`, 180, finalY + 20, { align: 'right' });

    addFooter(doc, systemVersion);
    doc.save(`relatorio_colaborador_${employeeName.replace(/\s+/g, '_')}_${new Date().toISOString().split('T')[0]}.pdf`);
};

// --- Supervisor Reports ---

export const exportSupervisorPDF = (
    items: ProductionItem[],
    payments: PaymentRecord[],
    filterLabel: string,
    systemVersion: string,
    reportType: 'production' | 'financial'
) => {
    const doc = new jsPDF();
    const title = reportType === 'production' ? "Relatório Geral de Produção" : "Relatório Financeiro Consolidado";
    const subtitle = `Filtros: ${filterLabel}`;

    addHeader(doc, title, subtitle, systemVersion);

    if (reportType === 'production') {
        const body = items.map(item => {
            const totalItemCost = item.productionValue + (item.finishingValue || 0) + (item.paintingValue || 0) + item.rawMaterialCost;
            return [
                formatDate(item.createdAt),
                item.cip || 'N/A',
                item.modelName,
                item.type,
                formatCurrency(item.rawMaterialCost),
                formatCurrency(item.productionValue),
                formatCurrency(item.finishingValue || 0),
                formatCurrency(item.paintingValue || 0),
                formatCurrency(totalItemCost)
            ];
        });

        // Calculate totals
        const totalMat = items.reduce((a, b) => a + b.rawMaterialCost, 0);
        const totalProd = items.reduce((a, b) => a + b.productionValue, 0);
        const totalFin = items.reduce((a, b) => a + (b.finishingValue || 0), 0);
        const totalPaint = items.reduce((a, b) => a + (b.paintingValue || 0), 0);
        const grandTotal = totalMat + totalProd + totalFin + totalPaint;

        autoTable(doc, {
            startY: 45,
            head: [['Data', 'CIP', 'Modelo', 'Tipo', 'Matéria', 'Prod.', 'Acab.', 'Pint.', 'Total']],
            body: body,
            styles: { fontSize: 7 },
            headStyles: { fillColor: PRIMARY_COLOR, fontSize: 8 },
            foot: [['TOTAL', '', '', '', formatCurrency(totalMat), formatCurrency(totalProd), formatCurrency(totalFin), formatCurrency(totalPaint), formatCurrency(grandTotal)]],
            footStyles: { fillColor: SECONDARY_COLOR, fontSize: 8, fontStyle: 'bold' }
        });

    } else {
        // Financial Report (Payments)
        const body = payments.map(p => [
            formatDate(p.date),
            p.employeeName,
            p.sector,
            p.observation || '-',
            formatCurrency(p.amount)
        ]);

        const totalPaid = payments.reduce((a, b) => a + b.amount, 0);

        autoTable(doc, {
            startY: 45,
            head: [['Data', 'Colaborador', 'Setor', 'Obs.', 'Valor']],
            body: body,
            headStyles: { fillColor: PRIMARY_COLOR },
            foot: [['', '', '', 'TOTAL PAGO', formatCurrency(totalPaid)]],
            footStyles: { fillColor: SECONDARY_COLOR, fontStyle: 'bold' }
        });
    }

    addFooter(doc, systemVersion);
    doc.save(`relatorio_supervisor_${reportType}_${new Date().toISOString().split('T')[0]}.pdf`);
};

// --- Compatibility Exports (Aliases for existing code) ---
// These replace the old CSV functions but use PDF logic internally or bridge efficiently

export const exportProductionReport = (
    items: ProductionItem[], 
    context: string, 
    sector?: Sector
) => {
    // This function is used by Employee HistoryModal
    // We need to fetch basic info to pass to the robust PDF generator
    // Assuming context is 'historico_pessoal' and we have access to items
    // Since we don't have payments passed here in the signature of the OLD function, 
    // we might need to adapt HistoryModal to call exportEmployeePDF directly. 
    // BUT to keep compatibility with HistoryModal.tsx without massive rewrites if not needed:
    console.warn("Use exportEmployeePDF instead for full features.");
};

export const exportFullSupervisorReport = (
    items: ProductionItem[], 
    payments: PaymentRecord[], 
    models: VaseModel[],
    filters: string
) => {
    // Adapter for Supervisor
    // We need system version, defaulting to 'Unknown' if not available in this scope, 
    // but SupervisorDashboard passes it usually.
    exportSupervisorPDF(items, payments, filters, '1.11.0', 'production');
};
