# API do Triolingo

API para autenticação e gerenciamento de usuários do aplicativo Triolingo, usando Firebase para autenticação.

## Configuração

1. Instale as dependências:
```bash
npm install
```

2. Configure as variáveis de ambiente:
Crie um arquivo `.env` na pasta raiz da API com o seguinte conteúdo:
```
PORT=3001
FIREBASE_CLIENT_EMAIL=sua-credencial-firebase@projeto.iam.gserviceaccount.com
FIREBASE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\nChave Privada Aqui\n-----END PRIVATE KEY-----\n"
```

3. Para obter as credenciais do Firebase:
   - Acesse o Console do Firebase (https://console.firebase.google.com/)
   - Selecione seu projeto > Configurações do projeto > Contas de serviço
   - Clique em "Gerar nova chave privada"

## Rotas Disponíveis

### Autenticação

- **POST /api/auth/register** - Registrar novo usuário
  ```json
  {
    "email": "usuario@email.com",
    "password": "senha123",
    "name": "Nome do Usuário"
  }
  ```

- **POST /api/auth/login** - Login de usuário
  ```json
  {
    "email": "usuario@email.com",
    "password": "senha123"
  }
  ```

- **POST /api/auth/logout** - Logout de usuário

### Usuário

- **GET /api/user/profile** - Obter perfil do usuário (requer autenticação)

- **POST /api/user/languages** - Atualizar idiomas de interesse (requer autenticação)
  ```json
  {
    "targetLanguages": ["english", "spanish", "french"]
  }
  ```

## Executando a API

Para iniciar o servidor em modo de desenvolvimento:
```bash
npm run dev
```

Para iniciar em produção:
```bash
npm start
``` 