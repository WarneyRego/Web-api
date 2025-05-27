const { admin, auth } = require('../config/firebase');
const { getAuth } = require('firebase/auth');

const authMiddleware = async (req, res, next) => {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Token de autenticação não fornecido' });
  }

  const token = authHeader.split('Bearer ')[1];

  try {
    let decodedToken;
    try {
      decodedToken = await admin.auth().verifyIdToken(token);
      console.log('Token verificado com sucesso:', decodedToken.uid);
      
    
      if (!decodedToken.name && decodedToken.displayName) {
        decodedToken.name = decodedToken.displayName;
      }
      
    } catch (adminError) {
      console.warn('Erro ao verificar token com Firebase Admin:', adminError.message);
      
      if (process.env.NODE_ENV !== 'production') {
        try {
          const tokenParts = token.split('.');
          if (tokenParts.length === 3) {
            const payload = JSON.parse(Buffer.from(tokenParts[1], 'base64').toString());
            if (payload && payload.user_id) {
              decodedToken = {
                uid: payload.user_id,
                email: payload.email || 'usuario@example.com',
                name: payload.name || payload.displayName || ''
              };
              console.log('Token decodificado manualmente:', decodedToken);
            } else {
              throw new Error('Payload do token inválido');
            }
          } else {
            throw new Error('Formato do token inválido');
          }
        } catch (decodeError) {
          console.warn('Erro ao decodificar token manualmente:', decodeError);
          decodedToken = {
            uid: 'dev-user-id',
            email: 'dev@example.com',
            name: 'Usuário Desenvolvimento'
          };
          console.log('Usando usuário de desenvolvimento padrão');
        }
      } else {
        throw adminError; 
      }
    }
    
    if (!decodedToken.name) {
      decodedToken.name = '';
    }
    
    console.log('Informações do usuário após decodificação:', {
      uid: decodedToken.uid,
      email: decodedToken.email,
      name: decodedToken.name
    });
    
    req.user = decodedToken;
    next();
  } catch (error) {
    console.error('Erro ao verificar token:', error);
    res.status(401).json({ error: 'Token inválido ou expirado' });
  }
};

module.exports = { authMiddleware }; 