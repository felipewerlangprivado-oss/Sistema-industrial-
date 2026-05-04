
import React, { useMemo } from 'react';
import { useStore } from '../store';
import { Button, Card, cn } from './UI';
import { 
    User, Moon, Sun, Bell, Layout, LogOut, ChevronLeft, 
    Shield, Briefcase, Calendar, CheckCircle, Info
} from 'lucide-react';
import { Sector } from '../types';

interface EmployeeSettingsScreenProps {
    onBack: () => void;
}

const EmployeeSettingsScreen: React.FC<EmployeeSettingsScreenProps> = ({ onBack }) => {
    const { currentUser, userPreferences, updateUserPreferences, logout, isDarkMode } = useStore();

    // Load user prefs or defaults
    const prefs = useMemo(() => {
        if (!currentUser) return null;
        return userPreferences[currentUser.id] || {
            userId: currentUser.id,
            darkMode: isDarkMode,
            notifySystem: true,
            notifyGoals: true,
            notifyPayments: true,
            showFinancials: true,
            showProductionQty: true,
            showGoalsBar: true,
        };
    }, [currentUser, userPreferences, isDarkMode]);

    if (!currentUser || !prefs) return null;

    const handleToggle = (key: keyof typeof prefs, value: boolean) => {
        updateUserPreferences(currentUser.id, { [key]: value });
    };

    const handleLogout = () => {
        logout();
    };

    return (
        <div className="bg-background min-h-screen flex flex-col animate-in slide-in-from-right duration-300">
            {/* Header */}
            <div className="bg-surface p-4 sticky top-0 z-20 shadow-sm flex items-center gap-4 border-b border-outline-variant">
                <Button variant="ghost" onClick={onBack} className="text-on-surface-variant -ml-2">
                    <ChevronLeft className="w-6 h-6" />
                </Button>
                <h1 className="text-xl font-medium text-on-surface">Configurações</h1>
            </div>

            <div className="flex-1 p-4 pb-12 space-y-6 overflow-y-auto">
                
                {/* 1. SEÇÃO APARÊNCIA */}
                <section className="space-y-2">
                    <h2 className="text-xs font-bold text-on-surface-variant uppercase tracking-wider px-1">Aparência</h2>
                    <Card className="flex items-center justify-between bg-surface border-outline-variant">
                        <div className="flex items-center gap-3">
                            <div className={`p-2 rounded-full ${prefs.darkMode ? 'bg-primary-container text-on-primary-container' : 'bg-surface-variant text-on-surface-variant'}`}>
                                {prefs.darkMode ? <Moon className="w-5 h-5" /> : <Sun className="w-5 h-5" />}
                            </div>
                            <div>
                                <p className="font-medium text-on-surface">Tema Escuro</p>
                                <p className="text-xs text-on-surface-variant">Ajustar visual do aplicativo</p>
                            </div>
                        </div>
                        <div 
                            onClick={() => handleToggle('darkMode', !prefs.darkMode)}
                            className={cn(
                                "w-12 h-7 rounded-full p-1 transition-colors cursor-pointer",
                                prefs.darkMode ? 'bg-primary' : 'bg-outline-variant'
                            )}
                        >
                            <div className={cn(
                                "w-5 h-5 bg-white rounded-full shadow-sm transition-transform duration-200",
                                prefs.darkMode ? 'translate-x-5' : 'translate-x-0'
                            )} />
                        </div>
                    </Card>
                </section>

                {/* 2. SEÇÃO PERFIL (READ ONLY) */}
                <section className="space-y-2">
                    <h2 className="text-xs font-bold text-on-surface-variant uppercase tracking-wider px-1">Meu Perfil</h2>
                    <Card className="bg-surface border-outline-variant space-y-4">
                        <div className="flex items-center gap-4 pb-4 border-b border-outline-variant">
                             <div className="w-14 h-14 bg-primary-container text-on-primary-container rounded-full flex items-center justify-center text-xl font-bold">
                                {currentUser.name.slice(0, 2).toUpperCase()}
                             </div>
                             <div>
                                <h3 className="font-bold text-lg text-on-surface">{currentUser.name}</h3>
                                <p className="text-sm text-on-surface-variant flex items-center gap-1">
                                    <Shield className="w-3 h-3" /> Colaborador
                                </p>
                             </div>
                        </div>
                        <div className="grid grid-cols-1 gap-3">
                             <div className="flex items-center justify-between">
                                 <div className="flex items-center gap-2 text-on-surface-variant">
                                     <Briefcase className="w-4 h-4" />
                                     <span className="text-sm">Setor</span>
                                 </div>
                                 <span className="font-medium text-on-surface bg-surface-variant px-2 py-0.5 rounded text-sm">{currentUser.sector}</span>
                             </div>
                             <div className="flex items-center justify-between">
                                 <div className="flex items-center gap-2 text-on-surface-variant">
                                     <CheckCircle className="w-4 h-4" />
                                     <span className="text-sm">Status</span>
                                 </div>
                                 <span className="font-bold text-success text-sm flex items-center gap-1">
                                     ● Ativo
                                 </span>
                             </div>
                             <div className="flex items-center justify-between">
                                 <div className="flex items-center gap-2 text-on-surface-variant">
                                     <Calendar className="w-4 h-4" />
                                     <span className="text-sm">Cadastro</span>
                                 </div>
                                 <span className="text-sm text-on-surface font-mono">
                                     {currentUser.joinedAt ? new Date(currentUser.joinedAt).toLocaleDateString() : 'N/A'}
                                 </span>
                             </div>
                        </div>
                        <div className="bg-surface-variant/30 p-3 rounded-xl flex gap-2 items-start text-xs text-on-surface-variant">
                             <Info className="w-4 h-4 shrink-0 mt-0.5" />
                             <p>Para alterar estes dados, entre em contato com seu supervisor.</p>
                        </div>
                    </Card>
                </section>

                {/* 3. SEÇÃO PREFERÊNCIAS DE AVISOS (UI ONLY) */}
                <section className="space-y-2">
                    <h2 className="text-xs font-bold text-on-surface-variant uppercase tracking-wider px-1">Notificações</h2>
                    <Card className="bg-surface border-outline-variant space-y-1 p-2">
                        {[
                            { key: 'notifySystem', label: 'Avisos do Sistema' },
                            { key: 'notifyGoals', label: 'Alertas de Metas' },
                            { key: 'notifyPayments', label: 'Pagamentos' }
                        ].map((item) => (
                            <div key={item.key} className="flex items-center justify-between p-3 rounded-xl hover:bg-surface-variant/30 transition-colors">
                                <div className="flex items-center gap-3">
                                    <Bell className="w-4 h-4 text-on-surface-variant" />
                                    <span className="text-sm font-medium text-on-surface">{item.label}</span>
                                </div>
                                <div 
                                    onClick={() => handleToggle(item.key as any, !prefs[item.key as keyof typeof prefs])}
                                    className={cn(
                                        "w-10 h-6 rounded-full p-0.5 transition-colors cursor-pointer relative",
                                        prefs[item.key as keyof typeof prefs] ? 'bg-primary' : 'bg-outline-variant'
                                    )}
                                >
                                    <div className={cn(
                                        "w-5 h-5 bg-white rounded-full shadow-sm transition-transform duration-200 absolute top-0.5",
                                        prefs[item.key as keyof typeof prefs] ? 'left-[18px]' : 'left-0.5'
                                    )} />
                                </div>
                            </div>
                        ))}
                    </Card>
                </section>

                 {/* 4. SEÇÃO PREFERÊNCIAS DO DASHBOARD */}
                 <section className="space-y-2">
                    <h2 className="text-xs font-bold text-on-surface-variant uppercase tracking-wider px-1">Painel Principal</h2>
                    <Card className="bg-surface border-outline-variant space-y-1 p-2">
                        {[
                            { key: 'showFinancials', label: 'Mostrar Valores (R$)' },
                            { key: 'showProductionQty', label: 'Mostrar Quantidade Produzida' },
                            { key: 'showGoalsBar', label: 'Barra de Metas' }
                        ].map((item) => (
                            <div key={item.key} className="flex items-center justify-between p-3 rounded-xl hover:bg-surface-variant/30 transition-colors">
                                <div className="flex items-center gap-3">
                                    <Layout className="w-4 h-4 text-on-surface-variant" />
                                    <span className="text-sm font-medium text-on-surface">{item.label}</span>
                                </div>
                                <div 
                                    onClick={() => handleToggle(item.key as any, !prefs[item.key as keyof typeof prefs])}
                                    className={cn(
                                        "w-10 h-6 rounded-full p-0.5 transition-colors cursor-pointer relative",
                                        prefs[item.key as keyof typeof prefs] ? 'bg-primary' : 'bg-outline-variant'
                                    )}
                                >
                                    <div className={cn(
                                        "w-5 h-5 bg-white rounded-full shadow-sm transition-transform duration-200 absolute top-0.5",
                                        prefs[item.key as keyof typeof prefs] ? 'left-[18px]' : 'left-0.5'
                                    )} />
                                </div>
                            </div>
                        ))}
                    </Card>
                </section>

                {/* 5. SEÇÃO SESSÃO */}
                <section className="pt-4">
                    <Button variant="danger" onClick={handleLogout} className="w-full bg-surface border border-error/30 text-error hover:bg-error-container hover:text-on-error-container shadow-sm">
                        <LogOut className="w-4 h-4 mr-2" />
                        Encerrar Sessão
                    </Button>
                    <p className="text-center text-xs text-on-surface-variant mt-4 opacity-60">
                        Home Pots Manager v1.7.0
                    </p>
                </section>
            </div>
        </div>
    );
};

export default EmployeeSettingsScreen;
