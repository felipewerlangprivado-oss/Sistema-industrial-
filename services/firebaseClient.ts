/**
 * Home Pots Manager - Cliente Oficial Firebase Firestore (Google Cloud)
 * 
 * Conexão nativa e segura para sincronização em tempo real e persistência industrial.
ī */

import { initializeApp, getApps, getApp, FirebaseApp } from 'firebase/app';
import { getFirestore, Firestore, setLogLevel } from 'firebase/firestore';
import firebaseConfig from '../firebase-applet-config.json';

// Configure Firestore SDK internal logger to silent to prevent SDK-level console error floods on quota or network backoff
setLogLevel('silent');

// Inicializa ou reutiliza a instância do Firebase
export const firebaseApp: FirebaseApp = !getApps().length 
  ? initializeApp(firebaseConfig) 
  : getApp();

// Conecta ao banco Firestore configurado no Google AI Studio
export const db: Firestore = firebaseConfig.firestoreDatabaseId
  ? getFirestore(firebaseApp, firebaseConfig.firestoreDatabaseId)
  : getFirestore(firebaseApp);

export { firebaseConfig };
