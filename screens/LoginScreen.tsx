
import React, { useState, useMemo } from 'react';
import { useStore } from '../store';
import { Sector, Employee } from '../types';
import { Button, Card, Modal } from '../components/UI';
import { Factory, Brush, PaintBucket, ShieldCheck, User, ArrowLeft, KeyRound, Settings, Info, Bug, Star, Zap, Activity, Search } from 'lucide-react';

const LoginScreen: React.FC = () => {
  const { setSector, loginUser, employees, supervisorPassword, systemVersion, changelog } = useStore();
  
  const [selectedSector, setSelectedSector] = useState<Sector | null>(null);
  const [selectedUser, setSelectedUser] = useState<Employee | null>(null);
  const [inputPassword, setInputPassword] = useState('');
  const [error, setError] = useState('');
  const [showChangelog, setShowChangelog] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');

  const handleSectorSelect = (sector: Sector) => {
    setSelectedSector(sector);
    setSearchTerm(''); // Reset search when changing sector
  };

  const handleUserSelect = (user: Employee) => {
    if (selectedSector === Sector.SUPERVISOR) {
      setSelectedUser(user);
    } else {
      // Automatic login for collaborators
      // Role and Sector are auto-assigned in store logic
      loginUser(user);
    }
  };

  const handleSupervisorLogin = () => {
    if (inputPassword === supervisorPassword) {
      if (selectedUser) {
        // Automatic assignment handles sector
        loginUser(selectedUser);
      }
    } else {
      setError('Senha incorreta');
    }
  };

  // Helper to render changelog icon and color
  const getTypeConfig = (type: string) => {
    switch(type) {
      case 'FIX': return { icon: <Bug className="w-4 h-4" />, color: 'bg-error-container text-on-error-container', label: 'Correção' };
      case 'FEATURE': return { icon: <Star className="w-4 h-4" />, color: 'bg-success-container text-on-success-container', label: 'Nova Função' };
      case 'IMPROVEMENT': return { icon: <Zap className="w-4 h-4" />, color: 'bg-primary-container text-on-primary-container', label: 'Melhoria' };
      case 'MAJOR': return { icon: <Activity className="w-4 h-4" />, color: 'bg-tertiary-container text-on-tertiary-container', label: 'Versão Principal' };
      default: return { icon: <Info className="w-4 h-4" />, color: 'bg-surface-variant text-on-surface-variant', label: 'Info' };
    }
  };

  // Step 1: Sector Selection
  if (!selectedSector) {
    return (
      <div className="min-h-screen bg-background flex flex-col items-center justify-center p-6 pb-24 relative">
        <div className="w-full max-w-md flex flex-col h-full justify-center">
          <div className="mb-10 text-center">
            <h1 className="text-3xl font-bold text-on-background mb-2">Home Pots</h1>
            <p className="text-on-surface-variant">Selecione seu setor de trabalho</p>
          </div>
          
          <div className="flex flex-col gap-4 w-full">
            {/* Main Sectors Stack */}
            <button 
              onClick={() => handleSectorSelect(Sector.PRODUCTION)}
              className="bg-primary-container text-on-primary-container w-full p-6 rounded-2xl shadow-sm border border-primary/10 flex items-center gap-4 transition-transform active:scale-[0.98]"
            >
               <div className="bg-surface/20 p-3 rounded-xl">
                 <Factory className="w-8 h-8" />
               </div>
               <div className="text-left">
                 <h2 className="text-xl font-bold">Produção</h2>
                 <p className="text-sm opacity-80">Moldagem e Estrutura</p>
               </div>
            </button>

            <button 
              onClick={() => handleSectorSelect(Sector.FINISHING)}
              className="bg-secondary-container text-on-secondary-container w-full p-6 rounded-2xl shadow-sm border border-secondary/10 flex items-center gap-4 transition-transform active:scale-[0.98]"
            >
               <div className="bg-surface/20 p-3 rounded-xl">
                 <Brush className="w-8 h-8" />
               </div>
               <div className="text-left">
                 <h2 className="text-xl font-bold">Acabamento</h2>
                 <p className="text-sm opacity-80">Lixamento e Preparo</p>
               </div>
            </button>

            <button 
              onClick={() => handleSectorSelect(Sector.PAINTING)}
              className="bg-surface-variant text-on-surface-variant w-full p-6 rounded-2xl shadow-sm border border-outline-variant/50 flex items-center gap-4 transition-transform active:scale-[0.98]"
            >
               <div className="bg-on-surface-variant/10 p-3 rounded-xl">
                 <PaintBucket className="w-8 h-8" />
               </div>
               <div className="text-left">
                 <h2 className="text-xl font-bold">Pintura</h2>
                 <p className="text-sm opacity-80">Coloração e Finalização</p>
               </div>
            </button>
          </div>

          <div className="mt-8 flex justify-center">
            <button 
              onClick={() => handleSectorSelect(Sector.SUPERVISOR)}
              className="flex items-center gap-2 text-on-surface-variant py-3 px-6 rounded-full hover:bg-surface-variant transition-colors"
            >
              <Settings className="w-5 h-5" />
              <span className="font-medium">Acesso do Supervisor</span>
            </button>
          </div>

          {/* New Info Area - Optional/Future use */}
          <div className="mt-8 w-full animate-in fade-in slide-in-from-bottom-4 duration-700 delay-200">
             <div className="bg-surface rounded-2xl p-5 border border-outline-variant shadow-sm flex items-start gap-4">
                <div className="bg-surface-variant text-on-surface-variant p-2.5 rounded-xl shrink-0">
                   <Info className="w-5 h-5" />
                </div>
                <div>
                   <h3 className="text-sm font-bold text-on-surface mb-1">Informações da Fábrica</h3>
                   <p className="text-xs text-on-surface-variant leading-relaxed">
                      Esta área será usada para avisos, comunicados e informações importantes.
                   </p>
                </div>
             </div>
          </div>
        </div>
        
        {/* Version Footer */}
        <div className="absolute bottom-4 flex flex-col items-center gap-1">
          <p className="text-xs font-medium text-on-surface-variant opacity-70">
            Versão {systemVersion}
          </p>
          <button onClick={() => setShowChangelog(true)} className="text-[10px] text-primary hover:underline font-medium">
             Ver novidades
          </button>
        </div>

        {/* Changelog Modal */}
        <Modal 
          isOpen={showChangelog} 
          onClose={() => setShowChangelog(false)} 
          title="Novidades do Sistema"
          footer={<Button variant="ghost" onClick={() => setShowChangelog(false)}>Fechar</Button>}
        >
           <div className="space-y-4">
              {changelog.length === 0 ? (
                <p className="text-on-surface-variant text-center py-4">Nenhum histórico registrado.</p>
              ) : (
                changelog.map((entry, idx) => {
                   const config = getTypeConfig(entry.type);
                   return (
                     <div key={idx} className="border-b border-outline-variant pb-4 last:border-0 last:pb-0">
                        <div className="flex justify-between items-start mb-1">
                           <div className="flex items-center gap-2">
                             <span className="font-bold text-lg text-on-surface">v{entry.version}</span>
                             <span className={`flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] uppercase font-bold ${config.color}`}>
                                {config.icon} {config.label}
                             </span>
                           </div>
                           <span className="text-xs text-on-surface-variant">{new Date(entry.date).toLocaleDateString()}</span>
                        </div>
                        <p className="text-sm text-on-surface-variant leading-relaxed">
                          {entry.description}
                        </p>
                     </div>
                   );
                })
              )}
           </div>
        </Modal>
      </div>
    );
  }

  // Step 2 & 3: Profile & Auth
  const sectorEmployees = employees.filter(e => 
    (e.sector === selectedSector || (selectedSector === Sector.SUPERVISOR && e.sector === Sector.SUPERVISOR))
    && (searchTerm === '' || e.name.toLowerCase().includes(searchTerm.toLowerCase()))
  );

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4 relative">
      <div className="w-full max-w-md">
        <div className="mb-6">
          <Button variant="ghost" size="sm" onClick={() => { setSelectedSector(null); setSelectedUser(null); setError(''); }}>
            <ArrowLeft className="mr-2 h-5 w-5" /> Voltar
          </Button>
        </div>

        <h2 className="text-3xl font-normal text-on-background mb-2">Identificação</h2>
        <p className="text-on-surface-variant mb-6">Quem é você em <span className="font-bold text-primary">{selectedSector}</span>?</p>

        {!selectedUser ? (
          <div className="flex flex-col gap-4">
            {/* Search Input - Simulates Identification Field */}
            <div className="relative">
               <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-on-surface-variant" />
               <input 
                 type="text" 
                 placeholder="Digite seu nome ou código..." 
                 className="w-full pl-12 pr-4 py-4 bg-surface border border-outline-variant rounded-xl focus:ring-2 focus:ring-primary outline-none shadow-sm text-lg"
                 value={searchTerm}
                 onChange={e => setSearchTerm(e.target.value)}
                 autoFocus
               />
            </div>

            <div className="space-y-3 max-h-[50vh] overflow-y-auto">
              {sectorEmployees.map(emp => (
                <div 
                  key={emp.id}
                  onClick={() => handleUserSelect(emp)}
                  className="bg-surface p-4 rounded-2xl shadow-sm border border-outline-variant flex items-center cursor-pointer hover:bg-surface-variant active:scale-[0.98] transition-all"
                >
                  <div className="w-12 h-12 bg-primary-container rounded-full flex items-center justify-center text-on-primary-container mr-4 font-bold">
                    {emp.name.slice(0,2).toUpperCase()}
                  </div>
                  <span className="text-lg font-medium text-on-surface">{emp.name}</span>
                </div>
              ))}
              {sectorEmployees.length === 0 && (
                <div className="text-center py-10 bg-surface rounded-2xl border border-outline-variant border-dashed">
                  <p className="text-on-surface-variant">Nenhum colaborador encontrado.</p>
                </div>
              )}
            </div>
          </div>
        ) : (
          <Card className="flex flex-col gap-6 p-8 bg-surface border border-outline-variant shadow-lg animate-in fade-in zoom-in-95">
            <div className="flex flex-col items-center mb-2">
               <div className="w-20 h-20 bg-primary-container rounded-full flex items-center justify-center text-on-primary-container mb-4">
                 <ShieldCheck className="w-10 h-10" />
               </div>
               <h3 className="text-2xl font-bold text-on-surface">{selectedUser.name}</h3>
               <p className="text-on-surface-variant">Acesso Restrito: Supervisor</p>
            </div>
            
            <div>
              <div className="relative">
                <KeyRound className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-on-surface-variant" />
                <input 
                  type="password"
                  className="w-full pl-12 pr-4 py-4 bg-surface border border-outline-variant rounded-xl focus:ring-2 focus:ring-primary focus:outline-none transition-all text-lg text-on-surface placeholder-on-surface-variant"
                  value={inputPassword}
                  onChange={(e) => { setInputPassword(e.target.value); setError(''); }}
                  placeholder="Senha de acesso"
                  autoFocus
                />
              </div>
              {error && <p className="text-error text-sm mt-2 ml-1 font-bold">{error}</p>}
            </div>

            <Button size="lg" onClick={handleSupervisorLogin} className="w-full">
              Entrar no Painel
            </Button>
            
            <Button variant="ghost" onClick={() => setSelectedUser(null)} className="w-full">
              Trocar Usuário
            </Button>
          </Card>
        )}
      </div>

      {/* Version Footer */}
      <div className="absolute bottom-4 flex flex-col items-center gap-1">
          <p className="text-xs font-medium text-on-surface-variant opacity-70">
            Versão {systemVersion}
          </p>
      </div>
    </div>
  );
};

export default LoginScreen;
