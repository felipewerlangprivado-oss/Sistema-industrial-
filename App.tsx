
import React, { useEffect, useRef } from 'react';
import { useStore } from './store';
import { Sector } from './types';
import LoginScreen from './screens/LoginScreen';
import ProductionScreen from './screens/ProductionScreen';
import ProcessingScreen from './screens/ProcessingScreen';
import SupervisorDashboard from './screens/SupervisorDashboard';
import InstallPWA from './components/InstallPWA';
import { startAutoSync, stopAutoSync, setupStoreListener } from './services/syncService';

const App: React.FC = () => {
  const { isDarkMode, currentUser, currentSector, registerSystemUpdate, systemVersion } = useStore();
  const initRef = useRef(false);

  // Initialize Supabase Sync on App Load
  useEffect(() => {
    setupStoreListener();
    startAutoSync(15000); // 15 seconds loop
    return () => {
      stopAutoSync();
    };
  }, []);

  useEffect(() => {
    if (isDarkMode) {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  }, [isDarkMode]);

  // AUTOMATIC VERSION CONTROL TRIGGER
  useEffect(() => {
    if (initRef.current) return;
    initRef.current = true;

    // Trigger update to 1.5.0 (Feature Update)
    if (systemVersion === '1.4.1') {
       registerSystemUpdate('FEATURE', 'Revisão geral da interface para eliminar sobreposição de elementos e ajuste do fluxo de registro de produção para telas dedicadas.');
    }
    
    // Trigger update to 1.5.1 (Fix Update)
    if (systemVersion === '1.5.0') {
      registerSystemUpdate('FIX', 'Correção de inconsistência no setor de pintura, garantindo sincronização entre produção, histórico, financeiro e implementação obrigatória de logs para todas as operações.');
    }

    // Trigger update to 1.6.0 (New Feature)
    if (systemVersion === '1.5.1') {
      registerSystemUpdate('FEATURE', 'Implementação do sistema de metas produtivas com barra progressiva no painel dos colaboradores, tela dedicada de metas, gestão centralizada pelo supervisor e integração automática com produção por setor e por modelo de vaso.');
    }

    // Trigger update to 1.6.1 (UI Fix)
    if (systemVersion === '1.6.0') {
      registerSystemUpdate('FIX', 'Ajuste de layout na tela de login: Correção de sobreposição entre o painel de avisos e o rodapé de versão.');
    }

    // Trigger update to 1.7.0 (New Feature)
    if (systemVersion === '1.6.1') {
      registerSystemUpdate('FEATURE', 'Adicionada tela de configurações do perfil do colaborador, com alternância de tema, visualização de dados do perfil, preferências de avisos e controle de exibição do dashboard.');
    }

    // Trigger update to 1.7.1 (Logic Fix)
    if (systemVersion === '1.7.0') {
      registerSystemUpdate('FIX', 'Correção no cálculo de custo de matéria-prima: alterações no custo do traço agora recalculam automaticamente o custo de produção de todos os modelos de vasos.');
    }

    // Trigger update to 1.8.0 (New Feature)
    if (systemVersion === '1.7.1') {
      registerSystemUpdate('FEATURE', 'Adicionada a funcionalidade de ajuste do percentual de comissão de pintura no painel de configurações do supervisor, permitindo que o supervisor defina e atualize o percentual de comissão conforme necessário.');
    }

    // Trigger update to 1.9.0 (New Feature)
    if (systemVersion === '1.8.0') {
      registerSystemUpdate('FEATURE', 'Integração de relatórios analíticos e painel de desempenho individual no dashboard do supervisor, proporcionando uma visão completa e detalhada da produção e do desempenho.');
    }

    // Trigger update to 1.10.0 (New Feature)
    if (systemVersion === '1.9.0') {
      registerSystemUpdate('FEATURE', 'Implementado novo sistema oficial de identificação física de vasos (CIP) utilizando o padrão YDDDSS, permitindo rastreabilidade completa por data de fabricação e ordem de produção.');
    }

    if (systemVersion === '1.16.0') {
      registerSystemUpdate('FEATURE', 'Implementação de diagnóstico de conexão Supabase para o supervisor.');
    }

    if (systemVersion === '1.17.0') {
      registerSystemUpdate('FEATURE', 'Integração inicial com Supabase configurada. Variáveis de ambiente adicionadas e cliente criado.');
    }

    if (systemVersion === '1.18.0') {
      registerSystemUpdate('FEATURE', 'Implementação de verificação de variáveis Supabase no painel do supervisor.');
    }

    if (systemVersion === '1.19.0') {
      registerSystemUpdate('FEATURE', 'Ferramenta de diagnóstico de ambiente (.env + Supabase) no painel do supervisor.');
    }

    if (systemVersion === '1.20.0') {
      registerSystemUpdate('FIX', 'Ajuste definitivo da configuração das variáveis do Supabase (URL e Chave) para conectar corretamente com o projeto.');
    }

    if (systemVersion === '1.21.0') {
      registerSystemUpdate('FEATURE', 'Implementação da estrutura do Capacitor para empacotamento em app Android.');
    }

    if (systemVersion === '1.22.0') {
      registerSystemUpdate('FEATURE', 'Sincronização em tempo real (WebSockets) implementada. Atualize o banco de dados rodando o novo Script SQL gerado.');
    }
  }, [systemVersion, registerSystemUpdate]);

  // Routing Logic based on State (Auth Guard)
  const renderScreen = () => {
    if (!currentUser || !currentSector) {
      return <LoginScreen />;
    }

    switch (currentSector) {
      case Sector.PRODUCTION:
        return <ProductionScreen />;
      case Sector.FINISHING:
        return <ProcessingScreen stage="finishing" />;
      case Sector.PAINTING:
        return <ProcessingScreen stage="painting" />;
      case Sector.SUPERVISOR:
        return <SupervisorDashboard />;
      default:
        return <LoginScreen />;
    }
  };

  return (
    <div className="min-h-screen bg-background text-on-background transition-colors duration-200">
      {renderScreen()}
      <InstallPWA />
    </div>
  );
};

export default App;
