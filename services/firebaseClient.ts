/**
 * Home Pots Manager - Cliente Oficial Firebase Firestore (Google Cloud)
 * 
 * Conexão nativa e segura para sincronização em tempo real e persistência industrial.
ī */

import { initializeApp, getApps, getApp, FirebaseApp } from 'firebase/app';
import { getFirestore, Firestore } from 'firebase/firestore';
import firebaseConfig from '../firebase-applet-config.json';

// Inicializa ou reutiliza a instância do Firebase
export const firebaseApp: FirebaseApp = !getApps().length 
  ? initializeApp(firebaseConfig) 
  : getApp();

// Conecta ao banco Firestore configurado no Google AI Studio
export const db: Firestore = firebaseConfig.firestoreDatabaseId
  ? getFirestore(firebaseApp, firebaseConfig.firestoreDatabaseId)
  : getFirestore(firebaseApp);

export { firebaseConfig };
