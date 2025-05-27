const express = require('express');
const { 
  getAuth, 
  createUserWithEmailAndPassword, 
  signInWithEmailAndPassword, 
  signOut,
  updateProfile
} = require('firebase/auth');
const { auth, admin, firestore } = require('../config/firebase');
const { collection, doc, getDoc, setDoc, serverTimestamp, updateDoc } = require('firebase/firestore');

const router = express.Router();
router.post('/register', async (req, res) => {
  try {
    const { email, password, name } = req.body;
    
    if (!email || !password) {
      return res.status(400).json({ error: 'Email e senha são obrigatórios' });
    }

    console.log(`Tentando registrar novo usuário: ${email}`);

    const userCredential = await createUserWithEmailAndPassword(auth, email, password);
    const user = userCredential.user;
    
    console.log(`Usuário criado na autenticação: ${user.uid}`);
    
    if (name) {
      try {
        await updateProfile(user, {
          displayName: name
        });
        console.log(`Perfil atualizado para o usuário ${user.uid} com nome: ${name}`);
      } catch (profileError) {
        console.error('Erro ao atualizar perfil:', profileError);
      }
    }
    try {
      console.log(`Iniciando criação do documento no Firestore para o usuário ${user.uid}`);
      
      const userData = {
        uid: user.uid,
        email: user.email,
        name: name || '',
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
        points: 0,
        stats: {
          completedLessons: 0,
          totalCorrectAnswers: 0,
          totalExercises: 0
        }
      };
      
      console.log('Dados a serem salvos:', userData);
      
      const userDocRef = doc(firestore, 'users', user.uid);
      console.log('Referência do documento do usuário obtida');
      
      await setDoc(userDocRef, userData);
      console.log(`Documento do usuário criado no Firestore para ${user.uid}`);
      const userDoc = await getDoc(userDocRef);
      
      if (userDoc.exists()) {
        console.log(`Documento verificado no Firestore para ${user.uid}`);
        console.log('Dados do documento:', userDoc.data());
      } else {
        console.warn(`Documento do usuário não encontrado após criação para ${user.uid}`);
      }
    } catch (firestoreError) {
      console.error('Erro ao criar documento do usuário no Firestore:', firestoreError);
      console.error('Stack trace:', firestoreError.stack);
    }

    const token = await user.getIdToken();
    await user.reload();
    const updatedToken = await user.getIdToken(true);
    
    res.status(201).json({
      message: 'Usuário registrado com sucesso',
      user: {
        uid: user.uid,
        email: user.email,
        name: name || ''
      },
      token: updatedToken
    });
  } catch (error) {
    console.error('Erro no registro:', error);
    
    let errorMessage = 'Erro ao registrar usuário';
    if (error.code === 'auth/email-already-in-use') {
      errorMessage = 'Este email já está em uso';
    } else if (error.code === 'auth/weak-password') {
      errorMessage = 'A senha deve ter pelo menos 6 caracteres';
    }
    
    res.status(400).json({ error: errorMessage });
  }
});

router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    
    if (!email || !password) {
      return res.status(400).json({ error: 'Email e senha são obrigatórios' });
    }

    console.log(`Tentativa de login: ${email}`);
    const userCredential = await signInWithEmailAndPassword(auth, email, password);
    const user = userCredential.user;
    console.log(`Login bem-sucedido para usuário: ${user.uid}`);
    console.log('Informações do usuário após login:', {
      uid: user.uid,
      email: user.email,
      displayName: user.displayName
    });
    
    try {
      const userDocRef = doc(firestore, 'users', user.uid);
      const userDoc = await getDoc(userDocRef);
      if (!userDoc.exists()) {
        console.log(`Usuário ${user.uid} não tem documento no Firestore. Criando...`);
        
        const userData = {
          uid: user.uid,
          email: user.email,
          name: user.displayName || '',
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
        console.log(`Documento do usuário criado no Firestore para ${user.uid} durante login`);
        
        const newUserDoc = await getDoc(userDocRef);
        if (newUserDoc.exists()) {
          console.log(`Documento verificado no Firestore para ${user.uid}`);
          console.log('Dados do documento:', newUserDoc.data());
        }
      } else {
        console.log(`Documento do usuário encontrado no Firestore para ${user.uid}`);
        const userData = userDoc.data();
        console.log('Dados do documento:', userData);
        if ((!userData.name || userData.name === '') && user.displayName) {
          console.log(`Atualizando nome no Firestore para ${user.uid}: ${user.displayName}`);
          await updateDoc(userDocRef, { 
            name: user.displayName,
            updatedAt: serverTimestamp()
          });
        }
      }
    } catch (firestoreError) {
      console.error('Erro ao verificar/criar documento do usuário no Firestore:', firestoreError);
      console.error('Stack trace:', firestoreError.stack);
    }
    
    const token = await user.getIdToken();
    
    res.status(200).json({
      message: 'Login realizado com sucesso',
      user: {
        uid: user.uid,
        email: user.email,
        name: user.displayName || ''
      },
      token
    });
  } catch (error) {
    console.error('Erro no login:', error);
    
    let errorMessage = 'Credenciais inválidas';
    if (error.code === 'auth/user-not-found' || error.code === 'auth/wrong-password') {
      errorMessage = 'Email ou senha incorretos';
    }
    
    res.status(401).json({ error: errorMessage });
  }
});

router.post('/logout', async (req, res) => {
  try {
    await signOut(auth);
    res.status(200).json({ message: 'Logout realizado com sucesso' });
  } catch (error) {
    console.error('Erro no logout:', error);
    res.status(500).json({ error: 'Erro ao realizar logout' });
  }
});

module.exports = router; 