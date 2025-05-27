const express = require('express');
const { authMiddleware } = require('../middleware/auth');
const { admin, firestore, database, databaseFunctions } = require('../config/firebase');
const { collection, doc, getDoc, setDoc, updateDoc, serverTimestamp } = require('firebase/firestore');
const { ref, get } = require('firebase/database');

const router = express.Router();

// Proteger todas as rotas neste router com o middleware de autenticação
router.use(authMiddleware);

// Obter perfil do usuário
router.get('/profile', async (req, res) => {
  try {
    const userId = req.user.uid;
    console.log(`Obtendo perfil para usuário: ${userId}`);
    console.log('Informações do usuário do token:', {
      uid: req.user.uid,
      email: req.user.email,
      name: req.user.name
    });
    
    const userDocRef = doc(firestore, 'users', userId);
    const userDoc = await getDoc(userDocRef);
    
    if (!userDoc.exists()) {
      console.log(`Documento não encontrado no Firestore para usuário: ${userId}`);
      
      // Retornar as informações básicas do token de autenticação
      return res.status(200).json({
        uid: userId,
        email: req.user.email,
        name: req.user.name || '',
        targetLanguages: []
      });
    }
    
    const userData = userDoc.data();
    console.log('Dados do documento Firestore:', userData);
    
    // Usar o nome do Firestore se disponível, caso contrário usar o do token
    const userName = (userData.name && userData.name !== '') 
      ? userData.name 
      : (req.user.name || '');
    
    // Se o nome está no token mas não no Firestore, atualizar o Firestore
    if ((!userData.name || userData.name === '') && req.user.name) {
      console.log(`Atualizando nome no Firestore para ${userId}: ${req.user.name}`);
      await updateDoc(userDocRef, { 
        name: req.user.name,
        updatedAt: serverTimestamp()
      });
    }
    
    res.status(200).json({
      uid: userId,
      email: req.user.email,
      name: userName,
      targetLanguages: userData.targetLanguages || []
    });
  } catch (error) {
    console.error('Erro ao buscar perfil do usuário:', error);
    res.status(500).json({ error: 'Erro ao buscar perfil do usuário' });
  }
});

// Obter idiomas de aprendizado do usuário
router.get('/learning-languages', async (req, res) => {
  try {
    const userId = req.user.uid;
    console.log(`Obtendo idiomas para usuário: ${userId}`);
    
    const userDocRef = doc(firestore, 'users', userId);
    const userDoc = await getDoc(userDocRef);
    
    if (!userDoc.exists()) {
      return res.status(404).json({ error: 'Usuário não encontrado' });
    }
    
    const userData = userDoc.data();
    const targetLanguages = userData.targetLanguages || [];
    
    res.status(200).json({
      targetLanguages
    });
  } catch (error) {
    console.error('Erro ao buscar idiomas de aprendizado:', error);
    res.status(500).json({ error: 'Erro ao buscar idiomas de aprendizado' });
  }
});

// Atualizar idiomas-alvo do usuário
router.post('/languages', async (req, res) => {
  try {
    const { targetLanguages } = req.body;
    const userId = req.user.uid;
    
    console.log(`Atualizando idiomas para usuário: ${userId}`, targetLanguages);
    
    if (!targetLanguages || !Array.isArray(targetLanguages)) {
      return res.status(400).json({ error: 'Idiomas-alvo devem ser fornecidos como um array' });
    }
    
    // Criar ou atualizar documento do usuário
    const userDocRef = doc(firestore, 'users', userId);
    
    // Primeiro, verificar se o documento existe
    const userDoc = await getDoc(userDocRef);
    const userData = {
      uid: userId, // Garantir que o UID esteja presente
      targetLanguages,
      email: req.user.email,
      name: req.user.name || '',
      updatedAt: serverTimestamp()
    };
    
    // Se o documento não existir, adicionar campos adicionais
    if (!userDoc.exists()) {
      userData.createdAt = serverTimestamp();
      userData.points = 0;
      userData.stats = {
        completedLessons: 0,
        totalCorrectAnswers: 0,
        totalExercises: 0
      };
    }
    
    console.log(`Salvando dados para usuário ${userId}:`, userData);
    
    await setDoc(userDocRef, userData, { merge: true });
    
    // Verificar se a atualização foi bem-sucedida
    const updatedDoc = await getDoc(userDocRef);
    if (updatedDoc.exists()) {
      console.log(`Dados atualizados com sucesso para usuário: ${userId}`);
      console.log('Dados do documento:', updatedDoc.data());
    }
    
    res.status(200).json({
      message: 'Idiomas-alvo atualizados com sucesso',
      targetLanguages
    });
  } catch (error) {
    console.error('Erro ao atualizar idiomas-alvo:', error);
    console.error('Stack trace:', error.stack);
    res.status(500).json({ error: 'Erro ao atualizar idiomas-alvo' });
  }
});

// Rota para verificar se o usuário existe no Firestore
router.get('/check-firestore', async (req, res) => {
  try {
    const userId = req.user.uid;
    console.log(`Verificando documento Firestore para usuário: ${userId}`);
    console.log('Informações do usuário do token:', {
      uid: req.user.uid,
      email: req.user.email,
      name: req.user.name
    });
    
    const userDocRef = doc(firestore, 'users', userId);
    const userDoc = await getDoc(userDocRef);
    
    if (!userDoc.exists()) {
      console.log(`Documento não encontrado para usuário: ${userId}`);
      
      // Criar documento de usuário se não existir
      const userData = {
        uid: userId, // Adicionar o UID explicitamente
        email: req.user.email || '',
        name: req.user.name || '',
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
        points: 0,
        stats: {
          completedLessons: 0,
          totalCorrectAnswers: 0,
          totalExercises: 0
        }
      };
      
      console.log(`Criando documento para usuário: ${userId}`);
      console.log('Dados a serem salvos:', userData);
      
      await setDoc(userDocRef, userData);
      console.log(`Documento criado com sucesso para: ${userId}`);
      
      // Verificar se o documento foi criado corretamente
      const newUserDoc = await getDoc(userDocRef);
      if (newUserDoc.exists()) {
        console.log('Dados do documento criado:', newUserDoc.data());
      }
      
      return res.status(201).json({
        message: 'Documento do usuário criado com sucesso',
        created: true,
        userData: {
          ...userData,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString()
        }
      });
    }
    
    const userData = userDoc.data();
    console.log(`Documento encontrado para usuário: ${userId}`);
    console.log('Dados do documento:', userData);
    
    // Se o nome está em branco no Firestore mas existe no token, atualizar o Firestore
    if ((!userData.name || userData.name === '') && req.user.name && req.user.name !== '') {
      console.log(`Atualizando nome no documento: de '${userData.name}' para '${req.user.name}'`);
      
      // Atualizar apenas o campo nome
      await updateDoc(userDocRef, {
        name: req.user.name,
        updatedAt: serverTimestamp()
      });
      
      // Atualizar o objeto userData para a resposta
      userData.name = req.user.name;
      userData.updatedAt = new Date();
      
      console.log('Documento atualizado com o nome do token');
    }
    
    return res.status(200).json({
      message: 'Documento do usuário encontrado',
      created: false,
      userData
    });
  } catch (error) {
    console.error('Erro ao verificar/criar documento do usuário:', error);
    console.error('Stack trace:', error.stack);
    res.status(500).json({ error: 'Erro ao verificar/criar documento do usuário' });
  }
});

// Rota para obter o ranking geral de usuários
router.get('/rankings/general', async (req, res) => {
  try {
    const { limit = 10 } = req.query;
    const maxLimit = parseInt(limit);
    
    if (isNaN(maxLimit) || maxLimit <= 0 || maxLimit > 50) {
      return res.status(400).json({ error: 'O limite deve ser um número entre 1 e 50' });
    }
    
    console.log(`Obtendo ranking geral, limite: ${maxLimit}`);
    
    // Obter referência do Firestore
    const db = admin.firestore();
    
    // Buscar todos os usuários ordenados por pontos
    const usersSnapshot = await db.collection('users')
      .orderBy('points', 'desc')
      .limit(maxLimit)
      .get();
    
    if (usersSnapshot.empty) {
      return res.status(200).json({ rankings: [] });
    }
    
    // Mapear documentos para um array, ocultando informações sensíveis
    const rankings = [];
    let position = 1;
    
    usersSnapshot.forEach(doc => {
      const userData = doc.data();
      rankings.push({
        position,
        uid: userData.uid,
        name: userData.name || 'Usuário Anônimo',
        points: userData.points || 0,
        stats: userData.stats || {
          completedLessons: 0,
          totalCorrectAnswers: 0,
          totalExercises: 0
        }
      });
      position++;
    });
    
    return res.status(200).json({ rankings });
    
  } catch (error) {
    console.error('Erro ao obter ranking geral:', error);
    return res.status(500).json({ error: 'Erro ao obter ranking de usuários' });
  }
});

// Rota para obter o ranking de usuários por idioma
router.get('/rankings/language/:language', async (req, res) => {
  try {
    const { language } = req.params;
    const { limit = 10 } = req.query;
    const maxLimit = parseInt(limit);
    
    if (isNaN(maxLimit) || maxLimit <= 0 || maxLimit > 50) {
      return res.status(400).json({ error: 'O limite deve ser um número entre 1 e 50' });
    }
    
    if (!language) {
      return res.status(400).json({ error: 'O idioma é obrigatório' });
    }
    
    console.log(`Obtendo ranking para o idioma: ${language}, limite: ${maxLimit}`);
    
    // Obter referência do Firestore
    const db = admin.firestore();
    
    // Buscar todos os usuários que têm estatísticas para o idioma especificado
    const usersSnapshot = await db.collection('users')
      .get();
    
    if (usersSnapshot.empty) {
      return res.status(200).json({ rankings: [] });
    }
    
    // Filtrar e ordenar usuários com base nas estatísticas do idioma
    let usersWithLanguageStats = [];
    
    usersSnapshot.forEach(doc => {
      const userData = doc.data();
      // Verificar se o usuário tem estatísticas para este idioma
      if (userData.stats && userData.stats[language]) {
        usersWithLanguageStats.push({
          uid: userData.uid,
          name: userData.name || 'Usuário Anônimo',
          languageStats: userData.stats[language],
          totalPoints: userData.stats[language].correctAnswers || 0, // Usar respostas corretas como pontuação do idioma
        });
      }
    });
    
    // Ordenar por pontos do idioma (respostas corretas)
    usersWithLanguageStats.sort((a, b) => b.totalPoints - a.totalPoints);
    
    // Limitar a quantidade de resultados
    usersWithLanguageStats = usersWithLanguageStats.slice(0, maxLimit);
    
    // Adicionar posição no ranking
    const rankings = usersWithLanguageStats.map((user, index) => ({
      position: index + 1,
      uid: user.uid,
      name: user.name,
      points: user.totalPoints,
      completedLessons: user.languageStats.completedLessons || 0
    }));
    
    return res.status(200).json({ 
      language,
      rankings 
    });
    
  } catch (error) {
    console.error(`Erro ao obter ranking para idioma ${req.params.language}:`, error);
    return res.status(500).json({ error: 'Erro ao obter ranking de usuários por idioma' });
  }
});

// Rota para atualizar status online do usuário
router.post('/online-status', async (req, res) => {
  try {
    const { isOnline } = req.body;
    const userId = req.user.uid;
    
    console.log(`Atualizando status online para usuário: ${userId}`, { isOnline });
    
    if (typeof isOnline !== 'boolean') {
      return res.status(400).json({ error: 'O status online deve ser um valor booleano' });
    }
    
    // Referência do documento do usuário no Firestore
    const userDocRef = doc(firestore, 'users', userId);
    
    // Verificar se o documento existe
    const userDoc = await getDoc(userDocRef);
    if (!userDoc.exists()) {
      console.log(`Documento não encontrado para usuário: ${userId}`);
      
      // Criar documento de usuário se não existir
      const userData = {
        uid: userId,
        email: req.user.email || '',
        name: req.user.name || '',
        isOnline: isOnline,
        lastActive: serverTimestamp(),
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
        points: 0,
        stats: {
          completedLessons: 0,
          totalCorrectAnswers: 0,
          totalExercises: 0
        }
      };
      
      await setDoc(userDocRef, userData);
      console.log(`Documento criado com status online para: ${userId}`);
      
      return res.status(201).json({
        message: 'Status online atualizado e documento do usuário criado',
        isOnline: isOnline
      });
    }
    
    // Verificar o status atual no Realtime Database, se disponível
    try {
      // Usar a API do Admin para Realtime Database
      const db = admin.database();
      const statusSnapshot = await db.ref(`status/${userId}`).get();
      
      if (statusSnapshot.exists()) {
        const rtdbStatus = statusSnapshot.val();
        console.log(`Status no Realtime Database:`, rtdbStatus);
        
        // Usar o status do Realtime Database se disponível
        isOnline = rtdbStatus.isOnline;
        
        console.log(`Usando status do Realtime Database: ${isOnline}`);
      } else {
        console.log(`Nenhum status encontrado no Realtime Database, usando o valor fornecido: ${isOnline}`);
      }
    } catch (dbError) {
      console.error('Erro ao verificar status no Realtime Database:', dbError);
      console.log(`Usando o valor fornecido: ${isOnline}`);
    }
    
    // Atualizar status online e lastActive no Firestore
    await updateDoc(userDocRef, { 
      isOnline: isOnline,
      lastActive: serverTimestamp(),
      updatedAt: serverTimestamp()
    });
    
    console.log(`Status online atualizado para usuário ${userId}: ${isOnline}`);
    
    res.status(200).json({
      message: 'Status online atualizado com sucesso',
      isOnline: isOnline
    });
  } catch (error) {
    console.error('Erro ao atualizar status online:', error);
    console.error('Stack trace:', error.stack);
    res.status(500).json({ error: 'Erro ao atualizar status online' });
  }
});

// Rota para obter pontos do usuário
router.get('/points', async (req, res) => {
  try {
    const userId = req.user.uid;
    
    console.log(`Obtendo pontos para usuário: ${userId}`);
    
    // Referência do documento do usuário no Firestore
    const userDocRef = doc(firestore, 'users', userId);
    
    // Verificar se o documento existe
    const userDoc = await getDoc(userDocRef);
    if (!userDoc.exists()) {
      console.log(`Documento não encontrado para usuário: ${userId}`);
      return res.status(200).json({ points: 0 });
    }
    
    const userData = userDoc.data();
    const points = userData.points || 0;
    
    console.log(`Pontos do usuário ${userId}: ${points}`);
    
    res.status(200).json({
      points: points
    });
  } catch (error) {
    console.error('Erro ao obter pontos do usuário:', error);
    res.status(500).json({ error: 'Erro ao obter pontos do usuário' });
  }
});

module.exports = router; 