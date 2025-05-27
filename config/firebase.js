const { initializeApp } = require('firebase/app');
const { getAuth } = require('firebase/auth');
const { getFirestore, collection, doc, getDoc, setDoc, updateDoc, serverTimestamp } = require('firebase/firestore');
const { getDatabase, ref, onValue, onDisconnect, set } = require('firebase/database');
const admin = require('firebase-admin');
const fs = require('fs');
const path = require('path');
const firebaseConfig = {
  apiKey: "AIzaSyCFRYWHM2frCHFjxlQXrf2C4TGr0Gv8XDo",
  authDomain: "triolingo-59713.firebaseapp.com",
  projectId: "triolingo-59713",
  storageBucket: "triolingo-59713.firebasestorage.app",
  messagingSenderId: "512507991880",
  appId: "1:512507991880:web:49cf7c7392fad30815857d",
  databaseURL: "https://triolingo-59713-default-rtdb.firebaseio.com"
};

const firebaseApp = initializeApp(firebaseConfig);
const auth = getAuth(firebaseApp);
const firestore = getFirestore(firebaseApp);
const database = getDatabase(firebaseApp);

global.firestoreMockData = global.firestoreMockData || {};
const useAdminSDK = process.env.USE_ADMIN_SDK === 'true';

try {
  if (!admin.apps.length) {
    const serviceAccountPath = path.join(__dirname, '../service-account.json');
    
    if (fs.existsSync(serviceAccountPath)) {
      const serviceAccount = require(serviceAccountPath);
      
      admin.initializeApp({
        credential: admin.credential.cert(serviceAccount),
        databaseURL: `https://${firebaseConfig.projectId}.firebaseio.com`
      });
      console.log('Firebase Admin inicializado com credenciais do arquivo service-account.json');
    } else {
      console.error('Arquivo de credenciais não encontrado em:', serviceAccountPath);
      console.log('Tentando inicializar sem credenciais explícitas (modo limitado)');
      
      admin.initializeApp({
        projectId: firebaseConfig.projectId,
      });
    }
  }
  
  
  const firestoreAdapter = {
    collection: (path) => {
      console.log(`Acessando coleção: ${path}`);
      return {
        doc: (id) => {
          return {
            get: async () => {
              try {
                console.log(`Obtendo documento: ${path}/${id}`);
                const docRef = doc(firestore, path, id);
                const snapshot = await getDoc(docRef);
                
                return {
                  exists: snapshot.exists(),
                  data: () => snapshot.data() || {},
                  id: id
                };
              } catch (error) {
                console.error(`Erro ao obter documento ${path}/${id}:`, error);
                throw error;
              }
            },
            set: async (data, options) => {
              try {
                console.log(`Definindo documento: ${path}/${id}`, data);
                const docRef = doc(firestore, path, id);
                
                if (options && options.merge) {
                  // Mesclar com documento existente
                  await setDoc(docRef, data, { merge: true });
                } else {
                  // Substituir o documento
                  await setDoc(docRef, data);
                }
                
                return true;
              } catch (error) {
                console.error(`Erro ao definir documento ${path}/${id}:`, error);
                throw error;
              }
            },
            update: async (data) => {
              try {
                console.log(`Atualizando documento: ${path}/${id}`, data);
                const docRef = doc(firestore, path, id);
                await updateDoc(docRef, data);
                return true;
              } catch (error) {
                console.error(`Erro ao atualizar documento ${path}/${id}:`, error);
                throw error;
              }
            },
            collection: (subPath) => {
              const fullPath = `${path}/${id}/${subPath}`;
              return firestoreAdapter.collection(fullPath);
            }
          };
        }
      };
    },
    
    FieldValue: {
      serverTimestamp: () => serverTimestamp(),
      increment: (value) => ({ __increment: value }),
      arrayUnion: (...values) => ({ __arrayUnion: values })
    },
    runTransaction: async (updateFunction) => {
      console.log('Iniciando transação...');
      try {
        const transaction = {
          get: async (docRef) => await docRef.get(),
          set: async (docRef, data, options) => await docRef.set(data, options),
          update: async (docRef, data) => await docRef.update(data)
        };
        
        // Executar a função de atualização
        const result = await updateFunction(transaction);
        console.log('Transação concluída com sucesso');
        return result;
      } catch (error) {
        console.error('Erro na transação:', error);
        throw error;
      }
    }
  };
  
  // Substituir ou fornecer as funções do Admin Firestore com nossas funções adaptadoras
  if (!useAdminSDK) {
    console.log('Usando SDK do Cliente Firebase para operações Firestore');
    admin.firestore = () => firestoreAdapter;
    admin.firestore.FieldValue = firestoreAdapter.FieldValue;
  } else {
    console.log('Usando SDK Admin Firebase para operações Firestore');
  }
  
} catch (error) {
  console.error('Erro ao inicializar Firebase:', error);
  console.log('API funcionará apenas com autenticação client-side');
}

module.exports = {
  auth,
  admin,
  firebaseApp,
  firestore,
  database,
  databaseFunctions: {
    ref,
    onValue,
    onDisconnect,
    set
  }
}; 