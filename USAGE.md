# Guia de Uso da API do Triolingo

Este documento contém exemplos de como usar a API do Triolingo para integração com o frontend.

## Fluxo de Autenticação

### 1. Registro de Usuário

**Endpoint:** POST /api/auth/register

**Corpo da Requisição:**
```json
{
  "email": "usuario@email.com",
  "password": "senha123",
  "name": "Nome do Usuário"
}
```

**Resposta de Sucesso (201):**
```json
{
  "message": "Usuário registrado com sucesso",
  "user": {
    "uid": "abc123",
    "email": "usuario@email.com",
    "name": "Nome do Usuário"
  },
  "token": "eyJhbGciOiJSUzI1NiIsImtpZCI6IjFmODhiODE0MjE..."
}
```

### 2. Login de Usuário

**Endpoint:** POST /api/auth/login

**Corpo da Requisição:**
```json
{
  "email": "usuario@email.com",
  "password": "senha123"
}
```

**Resposta de Sucesso (200):**
```json
{
  "message": "Login realizado com sucesso",
  "user": {
    "uid": "abc123",
    "email": "usuario@email.com",
    "name": "Nome do Usuário"
  },
  "token": "eyJhbGciOiJSUzI1NiIsImtpZCI6IjFmODhiODE0MjE..."
}
```

### 3. Obter Perfil do Usuário

**Endpoint:** GET /api/user/profile

**Headers:**
```
Authorization: Bearer eyJhbGciOiJSUzI1NiIsImtpZCI6IjFmODhiODE0MjE...
```

**Resposta de Sucesso (200):**
```json
{
  "uid": "abc123",
  "email": "usuario@email.com",
  "name": "Nome do Usuário",
  "targetLanguages": ["english", "spanish"]
}
```

### 4. Obter Idiomas de Aprendizado do Usuário

**Endpoint:** GET /api/user/learning-languages

**Headers:**
```
Authorization: Bearer eyJhbGciOiJSUzI1NiIsImtpZCI6IjFmODhiODE0MjE...
```

**Resposta de Sucesso (200):**
```json
{
  "targetLanguages": ["english", "spanish"]
}
```

### 5. Atualizar Idiomas de Interesse

**Endpoint:** POST /api/user/languages

**Headers:**
```
Authorization: Bearer eyJhbGciOiJSUzI1NiIsImtpZCI6IjFmODhiODE0MjE...
```

**Corpo da Requisição:**
```json
{
  "targetLanguages": ["english", "spanish", "french"]
}
```

**Resposta de Sucesso (200):**
```json
{
  "message": "Idiomas-alvo atualizados com sucesso",
  "targetLanguages": ["english", "spanish", "french"]
}
```

### 6. Finalizar Lição

**Endpoint:** POST /api/lessons/complete

**Headers:**
```
Authorization: Bearer eyJhbGciOiJSUzI1NiIsImtpZCI6IjFmODhiODE0MjE...
```

**Corpo da Requisição:**
```json
{
  "lessonId": "lesson-1",
  "language": "english",
  "score": 8,
  "totalExercises": 10
}
```

**Resposta de Sucesso (200):**
```json
{
  "message": "Lição finalizada com sucesso",
  "progress": {
    "lessonId": "lesson-1",
    "language": "english",
    "score": 8,
    "totalExercises": 10,
    "completionPercentage": 80,
    "completed": true,
    "completedAt": "2023-10-15T14:30:45.123Z",
    "lastUpdated": "2023-10-15T14:30:45.123Z"
  },
  "isCompleted": true,
  "points": 108,
  "stats": {
    "completedLessons": 5,
    "totalCorrectAnswers": 42,
    "totalExercises": 50,
    "english": {
      "completedLessons": 3,
      "correctAnswers": 25
    }
  }
}
```

### 7. Logout de Usuário

**Endpoint:** POST /api/auth/logout

**Headers:**
```
Authorization: Bearer eyJhbGciOiJSUzI1NiIsImtpZCI6IjFmODhiODE0MjE...
```

**Resposta de Sucesso (200):**
```json
{
  "message": "Logout realizado com sucesso"
}
```

## Tratamento de Erros

A API retorna mensagens de erro claras nos seguintes formatos:

**Erro de Autenticação (401):**
```json
{
  "error": "Token inválido ou expirado"
}
```

**Erro de Validação (400):**
```json
{
  "error": "Email e senha são obrigatórios"
}
```

**Erro no Servidor (500):**
```json
{
  "error": "Erro ao buscar perfil do usuário"
}
```

## Exemplos em JavaScript/React

```javascript
// Função para registro
async function registerUser(email, password, name) {
  try {
    const response = await fetch('http://localhost:3001/api/auth/register', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ email, password, name }),
    });
    
    const data = await response.json();
    
    if (!response.ok) {
      throw new Error(data.error || 'Erro no registro');
    }
    
    // Salvar token no localStorage
    localStorage.setItem('token', data.token);
    
    return data;
  } catch (error) {
    console.error('Erro no registro:', error);
    throw error;
  }
}

// Função para login
async function loginUser(email, password) {
  try {
    const response = await fetch('http://localhost:3001/api/auth/login', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ email, password }),
    });
    
    const data = await response.json();
    
    if (!response.ok) {
      throw new Error(data.error || 'Erro no login');
    }
    
    // Salvar token no localStorage
    localStorage.setItem('token', data.token);
    
    return data;
  } catch (error) {
    console.error('Erro no login:', error);
    throw error;
  }
}

// Função para obter perfil
async function getUserProfile() {
  try {
    const token = localStorage.getItem('token');
    
    if (!token) {
      throw new Error('Usuário não autenticado');
    }
    
    const response = await fetch('http://localhost:3001/api/user/profile', {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${token}`,
      },
    });
    
    const data = await response.json();
    
    if (!response.ok) {
      throw new Error(data.error || 'Erro ao buscar perfil');
    }
    
    return data;
  } catch (error) {
    console.error('Erro ao buscar perfil:', error);
    throw error;
  }
}

// Função para obter idiomas de aprendizado
async function getUserLearningLanguages() {
  try {
    const token = localStorage.getItem('token');
    
    if (!token) {
      throw new Error('Usuário não autenticado');
    }
    
    const response = await fetch('http://localhost:3001/api/user/learning-languages', {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${token}`,
      },
    });
    
    const data = await response.json();
    
    if (!response.ok) {
      throw new Error(data.error || 'Erro ao buscar idiomas');
    }
    
    return data.targetLanguages;
  } catch (error) {
    console.error('Erro ao buscar idiomas de aprendizado:', error);
    throw error;
  }
}

// Função para finalizar uma lição
async function completeLesson(lessonId, language, score, totalExercises) {
  try {
    const token = localStorage.getItem('token');
    
    if (!token) {
      throw new Error('Usuário não autenticado');
    }
    
    const response = await fetch('http://localhost:3001/api/lessons/complete', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ 
        lessonId, 
        language, 
        score, 
        totalExercises 
      }),
    });
    
    const data = await response.json();
    
    if (!response.ok) {
      throw new Error(data.error || 'Erro ao finalizar lição');
    }
    
    return data;
  } catch (error) {
    console.error('Erro ao finalizar lição:', error);
    throw error;
  }
}
``` 