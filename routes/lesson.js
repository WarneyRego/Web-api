// Rotas para gerenciamento de lições
const express = require('express');
const router = express.Router();
const admin = require('firebase-admin');
const { authMiddleware } = require('../middleware/auth');

// Middleware de autenticação para todas as rotas
router.use(authMiddleware);

/**
 * @route   POST /api/lessons/progress
 * @desc    Salvar progresso da lição
 * @access  Private
 */
router.post('/progress', async (req, res) => {
  try {
    const userId = req.user.uid;
    const { lessonId, language, score, totalExercises, completed } = req.body;

    // Validação básica
    if (!lessonId || !language || typeof score !== 'number' || typeof totalExercises !== 'number') {
      return res.status(400).json({ error: 'Dados inválidos. Forneça lessonId, language, score e totalExercises.' });
    }

    // Obter referência do Firestore
    const db = admin.firestore();
    
    // Verificar se já existe progresso para esta lição
    const progressRef = db.collection('users').doc(userId).collection('progress').doc(`${language}_${lessonId}`);
    const progressDoc = await progressRef.get();
    
    // Calcular percentual de conclusão
    const completionPercentage = Math.round((score / totalExercises) * 100);
    
    // Determinar se está completo (pode ser baseado em um limite, como 80%)
    const isCompleted = completed || completionPercentage >= 80;
    
    // Dados a serem salvos/atualizados
    const progressData = {
      lessonId,
      language,
      score,
      totalExercises,
      completionPercentage,
      completed: isCompleted,
      lastUpdated: admin.firestore.FieldValue.serverTimestamp()
    };
    
    // Se já existe um registro, atualizar apenas se a pontuação for maior
    if (progressDoc.exists) {
      const existingData = progressDoc.data();
      
      // Só atualiza se a nova pontuação for maior que a antiga
      if (existingData.score < score) {
        await progressRef.update(progressData);
      }
    } else {
      // Caso não exista, criar novo registro
      progressData.createdAt = admin.firestore.FieldValue.serverTimestamp();
      await progressRef.set(progressData);
    }
    
    return res.status(200).json({ 
      message: 'Progresso salvo com sucesso',
      progress: {
        ...progressData,
        lastUpdated: new Date().toISOString(),
        createdAt: progressData.createdAt ? new Date().toISOString() : undefined
      } 
    });
    
  } catch (error) {
    console.error('Erro ao salvar progresso da lição:', error);
    return res.status(500).json({ error: 'Erro ao salvar progresso da lição' });
  }
});

/**
 * @route   POST /api/lessons/complete
 * @desc    Finalizar uma lição e registrar a pontuação
 * @access  Private
 */
router.post('/complete', async (req, res) => {
  try {
    // Verificar se req.user existe
    if (!req.user || !req.user.uid) {
      console.error('Erro: Usuário não autenticado ou ID de usuário não encontrado em req.user');
      return res.status(401).json({ error: 'Usuário não autenticado' });
    }

    const userId = req.user.uid;
    const { lessonId, language, score, totalExercises } = req.body;

    console.log('Dados recebidos para completar lição:', { 
      userId, 
      lessonId, 
      language, 
      score, 
      totalExercises,
      userEmail: req.user.email || 'não fornecido'
    });

    // Validação básica
    if (!lessonId || !language || typeof score !== 'number' || typeof totalExercises !== 'number') {
      console.error('Erro de validação:', { 
        lessonId, 
        language, 
        scoreType: typeof score, 
        totalExercisesType: typeof totalExercises 
      });
      return res.status(400).json({ 
        error: 'Dados inválidos. Forneça lessonId, language, score e totalExercises.' 
      });
    }

    // Obter referência do Firestore
    const db = admin.firestore();
    
    try {
      // Referência para o documento do usuário
      const userRef = db.collection('users').doc(userId);
      const userDoc = await userRef.get();
      
      // Verificar se o usuário existe
      if (!userDoc.exists) {
        console.log(`Usuário ${userId} não encontrado, criando documento básico`);
        try {
          await userRef.set({
            email: req.user.email || '',
            name: req.user.name || '',
            createdAt: admin.firestore.FieldValue.serverTimestamp(),
            points: 0,
            stats: {},
            updatedAt: admin.firestore.FieldValue.serverTimestamp()
          });
          console.log(`Documento de usuário criado com sucesso para ${userId}`);
        } catch (userCreateError) {
          console.error('Erro ao criar documento de usuário:', userCreateError);
          return res.status(500).json({ error: 'Erro ao criar perfil de usuário' });
        }
      }
      
      // Calcular percentual de conclusão
      const completionPercentage = Math.round((score / totalExercises) * 100);
      
      // Verificar se a lição foi completada (considerando 60% ou mais)
      const isCompleted = completionPercentage >= 60;
      
      // Referência para o progresso da lição
      const progressRef = userRef.collection('progress').doc(`${language}_${lessonId}`);
      
      try {
        // Buscar dados do progresso existente, se houver
        const progressDoc = await progressRef.get();
        
        // Dados do progresso atualizados
        const progressData = {
          lessonId,
          language,
          score,
          totalExercises,
          completionPercentage,
          completed: isCompleted,
          completedAt: isCompleted ? admin.firestore.FieldValue.serverTimestamp() : null,
          lastUpdated: admin.firestore.FieldValue.serverTimestamp()
        };
        
        // Buscar dados atualizados do usuário
        const userData = (await userRef.get()).data() || {};
        const stats = userData.stats || {};
        const points = userData.points || 0;
        
        // Calcular pontos a serem adicionados (1 ponto por resposta correta)
        const pointsToAdd = score;
        
        // Estatísticas atualizadas
        const updatedStats = {
          ...stats,
          completedLessons: (stats.completedLessons || 0) + (isCompleted ? 1 : 0),
          totalCorrectAnswers: (stats.totalCorrectAnswers || 0) + score,
          totalExercises: (stats.totalExercises || 0) + totalExercises,
          [language]: {
            ...(stats[language] || {}),
            completedLessons: ((stats[language] || {}).completedLessons || 0) + (isCompleted ? 1 : 0),
            correctAnswers: ((stats[language] || {}).correctAnswers || 0) + score
          }
        };
        
        console.log('Iniciando transação para salvar progresso...');
        
        try {
          // Usar uma transação para garantir a consistência dos dados
          await db.runTransaction(async (transaction) => {
            if (progressDoc.exists) {
              const existingData = progressDoc.data() || {};
              const existingScore = existingData.score || 0;
              
              console.log('Progresso existente:', {
                lessonId,
                existingScore,
                newScore: score,
                existingCompleted: existingData.completed,
                newCompleted: isCompleted,
                já_completou_antes: existingData.completed === true
              });
              
              // Verificar se a nova pontuação é maior ou se a lição ainda não foi marcada como concluída
              if (existingScore < score || !existingData.completed) {
                transaction.update(progressRef, progressData);
                console.log('Progresso atualizado na transação');
                
                // Só adicionar pontos se a pontuação for maior E a lição não estiver já marcada como completa
                if (existingScore < score && !existingData.completed) {
                  // Adicionar apenas a diferença de pontos
                  const additionalPoints = score - existingScore;
                  transaction.update(userRef, { 
                    stats: updatedStats,
                    points: points + additionalPoints,
                    updatedAt: admin.firestore.FieldValue.serverTimestamp()
                  });
                  console.log(`Adicionados ${additionalPoints} pontos para o usuário`);
                } else if (existingScore < score && existingData.completed) {
                  // Se a pontuação melhorou mas a lição já estava completa antes
                  // Atualizar estatísticas mas não adicionar pontos
                  transaction.update(userRef, { 
                    stats: updatedStats,
                    updatedAt: admin.firestore.FieldValue.serverTimestamp()
                  });
                  console.log('Pontuação melhorada, mas lição já estava completa. Sem pontos adicionais.');
                } else if (!existingData.completed && isCompleted) {
                  // Se agora está completa mas antes não estava, atualizar estatísticas e adicionar pontos
                  transaction.update(userRef, { 
                    stats: updatedStats,
                    points: points + score, // Adicionar todos os pontos da nova tentativa
                    updatedAt: admin.firestore.FieldValue.serverTimestamp()
                  });
                  console.log(`Lição completada pela primeira vez. Adicionados ${score} pontos.`);
                }
              } else {
                console.log('Nenhuma atualização necessária - pontuação não melhorada ou lição já completada');
              }
            } else {
              // Caso não exista, criar novo registro
              progressData.createdAt = admin.firestore.FieldValue.serverTimestamp();
              transaction.set(progressRef, progressData);
              console.log('Novo registro de progresso criado');
              
              // Adicionar pontos para nova lição
              transaction.update(userRef, { 
                stats: updatedStats,
                points: points + pointsToAdd,
                updatedAt: admin.firestore.FieldValue.serverTimestamp()
              });
              console.log(`Adicionados ${pointsToAdd} pontos para o usuário`);
            }
          });
          
          console.log('Transação concluída com sucesso');
          const finalUserData = (await userRef.get()).data();
          const finalProgress = (await progressRef.get()).data();
          
          console.log('Lição finalizada com sucesso para:', { 
            userId,
            lessonId, 
            language,
            pontuaçãoFinal: finalProgress?.score,
            pontosTotais: finalUserData?.points
          });
          
          // Calcular pontos ganhos nesta sessão
          const previousPoints = (points || 0); // Pontuação antes da atualização
          const currentPoints = finalUserData?.points || (points + pointsToAdd);
          const pointsGained = currentPoints - previousPoints;
          
          console.log('Cálculo de pontos:', {
            pontuaçãoAnterior: previousPoints,
            pontuaçãoAtual: currentPoints,
            pontosGanhos: pointsGained
          });
          
          return res.status(200).json({ 
            message: 'Lição finalizada com sucesso',
            progress: {
              ...progressData,
              completedAt: isCompleted ? new Date().toISOString() : null,
              lastUpdated: new Date().toISOString(),
            },
            isCompleted,
            points: currentPoints,
            previousPoints: previousPoints,
            pointsGained: pointsGained,
            stats: updatedStats
          });
        } catch (transactionError) {
          console.error('Erro na transação Firestore:', transactionError);
          return res.status(500).json({ 
            error: 'Erro ao processar transação no banco de dados',
            details: transactionError.message 
          });
        }
      } catch (progressError) {
        console.error('Erro ao buscar progresso existente:', progressError);
        return res.status(500).json({ 
          error: 'Erro ao verificar progresso existente',
          details: progressError.message
        });
      }
    } catch (userError) {
      console.error('Erro ao buscar usuário:', userError);
      return res.status(500).json({ 
        error: 'Erro ao verificar usuário',
        details: userError.message
      });
    }
  } catch (error) {
    console.error('Erro geral ao finalizar lição:', error);
    return res.status(500).json({ 
      error: 'Erro ao finalizar lição',
      details: error.message
    });
  }
});

/**
 * @route   GET /api/lessons/progress
 * @desc    Obter progresso de todas as lições do usuário
 * @access  Private
 */
router.get('/progress', async (req, res) => {
  try {
    const userId = req.user.uid;
    const { language } = req.query;
    
    // Obter referência do Firestore
    const db = admin.firestore();
    
    // Referência à coleção de progresso do usuário
    let progressRef = db.collection('users').doc(userId).collection('progress');
    
    // Filtrar por idioma se especificado
    if (language) {
      progressRef = progressRef.where('language', '==', language);
    }
    
    // Buscar documentos
    const snapshot = await progressRef.get();
    
    if (snapshot.empty) {
      return res.status(200).json({ progress: [] });
    }
    
    // Mapear documentos para um array
    const progress = [];
    snapshot.forEach(doc => {
      progress.push({
        id: doc.id,
        ...doc.data(),
        lastUpdated: doc.data().lastUpdated ? doc.data().lastUpdated.toDate().toISOString() : null,
        createdAt: doc.data().createdAt ? doc.data().createdAt.toDate().toISOString() : null,
        completedAt: doc.data().completedAt ? doc.data().completedAt.toDate().toISOString() : null
      });
    });
    
    return res.status(200).json({ progress });
    
  } catch (error) {
    console.error('Erro ao obter progresso das lições:', error);
    return res.status(500).json({ error: 'Erro ao obter progresso das lições' });
  }
});

/**
 * @route   GET /api/lessons/recent-progress
 * @desc    Obter o progresso recente das lições do usuário, ordenado por data
 * @access  Private
 */
router.get('/recent-progress', async (req, res) => {
  try {
    // Verificar se req.user existe
    if (!req.user || !req.user.uid) {
      console.error('Erro: Usuário não autenticado ou ID de usuário não encontrado em req.user');
      return res.status(401).json({ error: 'Usuário não autenticado' });
    }
    
    const userId = req.user.uid;
    const { limit = 5 } = req.query;
    
    console.log('Buscando progresso recente para usuário:', {
      userId,
      limit,
      userEmail: req.user.email || 'não fornecido'
    });
    
    const maxLimit = parseInt(limit);
    
    if (isNaN(maxLimit) || maxLimit <= 0) {
      console.warn('Limite inválido fornecido:', limit);
      return res.status(400).json({ error: 'O limite deve ser um número positivo' });
    }
    
    try {
      // Obter referência do Firestore
      const db = admin.firestore();
      
      // Verificar se o usuário existe
      const userDoc = await db.collection('users').doc(userId).get();
      if (!userDoc.exists) {
        console.warn(`Usuário ${userId} não encontrado ao buscar progresso recente`);
        return res.status(200).json({ progress: [] });
      }
      
      // Referência à coleção de progresso do usuário, ordenada por data de atualização decrescente
      let progressRef = db.collection('users')
                          .doc(userId)
                          .collection('progress')
                          .orderBy('lastUpdated', 'desc')
                          .limit(maxLimit);
      
      // Buscar documentos
      const snapshot = await progressRef.get();
      
      if (snapshot.empty) {
        console.log(`Nenhum progresso encontrado para o usuário ${userId}`);
        return res.status(200).json({ progress: [] });
      }
      
      // Mapear documentos para um array
      const progress = [];
      snapshot.forEach(doc => {
        const data = doc.data();
        try {
          progress.push({
            id: doc.id,
            ...data,
            lastUpdated: data.lastUpdated ? data.lastUpdated.toDate().toISOString() : null,
            createdAt: data.createdAt ? data.createdAt.toDate().toISOString() : null,
            completedAt: data.completedAt ? data.completedAt.toDate().toISOString() : null
          });
        } catch (docError) {
          console.error('Erro ao processar documento de progresso:', {
            docId: doc.id,
            error: docError.message
          });
          // Continua o loop mesmo com erro em um documento
        }
      });
      
      console.log(`Encontrados ${progress.length} registros de progresso recente para o usuário ${userId}`);
      
      return res.status(200).json({ progress });
    } catch (dbError) {
      console.error('Erro de banco de dados ao buscar progresso recente:', dbError);
      return res.status(500).json({ 
        error: 'Erro ao acessar banco de dados para buscar progresso',
        details: dbError.message
      });
    }
  } catch (error) {
    console.error('Erro geral ao obter progresso recente das lições:', error);
    return res.status(500).json({ 
      error: 'Erro ao obter progresso recente das lições',
      details: error.message
    });
  }
});

/**
 * @route   GET /api/lessons/progress/:lessonId
 * @desc    Obter progresso de uma lição específica
 * @access  Private
 */
router.get('/progress/:lessonId', async (req, res) => {
  try {
    const userId = req.user.uid;
    const { lessonId } = req.params;
    const { language } = req.query;
    
    if (!language) {
      return res.status(400).json({ error: 'O parâmetro language é obrigatório' });
    }
    
    // Obter referência do Firestore
    const db = admin.firestore();
    
    // Buscar documento
    const progressDoc = await db.collection('users')
      .doc(userId)
      .collection('progress')
      .doc(`${language}_${lessonId}`)
      .get();
    
    if (!progressDoc.exists) {
      return res.status(404).json({ error: 'Progresso não encontrado para esta lição' });
    }
    
    const progressData = progressDoc.data();
    
    return res.status(200).json({
      ...progressData,
      lastUpdated: progressData.lastUpdated ? progressData.lastUpdated.toDate().toISOString() : null,
      createdAt: progressData.createdAt ? progressData.createdAt.toDate().toISOString() : null
    });
    
  } catch (error) {
    console.error('Erro ao obter progresso da lição:', error);
    return res.status(500).json({ error: 'Erro ao obter progresso da lição' });
  }
});

module.exports = router; 