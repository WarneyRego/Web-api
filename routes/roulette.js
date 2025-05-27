const express = require('express');
const { authMiddleware } = require('../middleware/auth');
const { admin, firestore } = require('../config/firebase');
const { doc, getDoc, updateDoc, serverTimestamp } = require('firebase/firestore');

const router = express.Router();

// Proteger todas as rotas neste router com o middleware de autenticação
router.use(authMiddleware);

// Rota para fazer uma aposta na roleta
router.post('/bet', async (req, res) => {
  try {
    const { color, amount } = req.body;
    const userId = req.user.uid;
    
    console.log(`Usuário ${userId} apostando ${amount} pontos no ${color}`);
    
    // Validar cor
    if (color !== 'red' && color !== 'black') {
      return res.status(400).json({ error: 'Cor inválida. Escolha entre "red" ou "black"' });
    }
    
    // Validar quantidade de pontos
    if (!amount || typeof amount !== 'number' || amount <= 0) {
      return res.status(400).json({ error: 'Quantidade de pontos inválida' });
    }
    
    // Obter pontos atuais do usuário
    const userDocRef = doc(firestore, 'users', userId);
    const userDoc = await getDoc(userDocRef);
    
    if (!userDoc.exists()) {
      return res.status(404).json({ error: 'Usuário não encontrado' });
    }
    
    const userData = userDoc.data();
    const currentPoints = userData.points || 0;
    
    // Verificar se o usuário tem pontos suficientes
    if (currentPoints < amount) {
      return res.status(400).json({ 
        error: 'Pontos insuficientes para esta aposta',
        currentPoints
      });
    }
    
    // Gerar resultado aleatório (0: vermelho, 1: preto)
    const result = Math.floor(Math.random() * 2);
    const resultColor = result === 0 ? 'red' : 'black';
    const won = resultColor === color;
    
    // Calcular novos pontos
    const pointsWon = won ? amount : 0;
    const pointsLost = won ? 0 : amount;
    const newTotal = won ? currentPoints + amount : currentPoints - amount;
    
    // Atualizar pontos do usuário
    await updateDoc(userDocRef, {
      points: newTotal,
      updatedAt: serverTimestamp(),
      'stats.roulette': {
        totalBets: (userData.stats?.roulette?.totalBets || 0) + 1,
        totalWins: (userData.stats?.roulette?.totalWins || 0) + (won ? 1 : 0),
        totalLosses: (userData.stats?.roulette?.totalLosses || 0) + (won ? 0 : 1),
        pointsWon: (userData.stats?.roulette?.pointsWon || 0) + pointsWon,
        pointsLost: (userData.stats?.roulette?.pointsLost || 0) + pointsLost,
      }
    });
    
    // Retornar resultado
    res.status(200).json({
      success: won,
      message: won ? 'Você ganhou!' : 'Você perdeu!',
      betColor: color,
      resultColor,
      pointsWon,
      pointsLost,
      newTotal,
    });
    
  } catch (error) {
    console.error('Erro ao processar aposta:', error);
    res.status(500).json({ error: 'Erro ao processar aposta' });
  }
});

// Rota para obter histórico de apostas do usuário
router.get('/history', async (req, res) => {
  try {
    const userId = req.user.uid;
    
    // Obter estatísticas do usuário
    const userDocRef = doc(firestore, 'users', userId);
    const userDoc = await getDoc(userDocRef);
    
    if (!userDoc.exists()) {
      return res.status(404).json({ error: 'Usuário não encontrado' });
    }
    
    const userData = userDoc.data();
    const rouletteStats = userData.stats?.roulette || {
      totalBets: 0,
      totalWins: 0,
      totalLosses: 0,
      pointsWon: 0,
      pointsLost: 0,
    };
    
    res.status(200).json({
      stats: rouletteStats,
      currentPoints: userData.points || 0
    });
    
  } catch (error) {
    console.error('Erro ao obter histórico de apostas:', error);
    res.status(500).json({ error: 'Erro ao obter histórico de apostas' });
  }
});

module.exports = router; 