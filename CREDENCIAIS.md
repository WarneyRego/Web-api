# Configuração de Credenciais do Firebase

Para que o Triolingo possa salvar dados no Firestore real (em produção), você precisa configurar as credenciais do Firebase Admin SDK corretamente.

## Obtendo o arquivo de credenciais

1. Acesse o [Console do Firebase](https://console.firebase.google.com/)
2. Selecione seu projeto "triolingo-59713"
3. Vá para "Configurações do Projeto" (ícone de engrenagem no canto superior esquerdo)
4. Na aba "Contas de serviço", clique em "Gerar nova chave privada"
5. Salve o arquivo JSON baixado como `service-account.json` na pasta `api/` do projeto

## Estrutura do arquivo

O arquivo `service-account.json` deve ter uma estrutura similar a esta:

```json
{
  "type": "service_account",
  "project_id": "triolingo-59713",
  "private_key_id": "abc123...",
  "private_key": "-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----\n",
  "client_email": "firebase-adminsdk-xxxxx@triolingo-59713.iam.gserviceaccount.com",
  "client_id": "123456789",
  "auth_uri": "https://accounts.google.com/o/oauth2/auth",
  "token_uri": "https://oauth2.googleapis.com/token",
  "auth_provider_x509_cert_url": "https://www.googleapis.com/oauth2/v1/certs",
  "client_x509_cert_url": "https://www.googleapis.com/robot/v1/metadata/x509/firebase-adminsdk..."
}
```

## Configuração para hospedagem

Se você estiver hospedando em plataformas como Vercel, Heroku, etc., você pode configurar as credenciais como variáveis de ambiente em vez de usar o arquivo.

Para o Vercel, por exemplo, você pode configurar a seguinte variável de ambiente:

```
FIREBASE_SERVICE_ACCOUNT={"type":"service_account","project_id":"triolingo-59713",...}
```

E modificar o arquivo `api/config/firebase.js` para usar:

```javascript
if (process.env.FIREBASE_SERVICE_ACCOUNT) {
  const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
    databaseURL: `https://${firebaseConfig.projectId}.firebaseio.com`
  });
}
```

## Segurança

⚠️ **IMPORTANTE** ⚠️
- Nunca comite o arquivo `service-account.json` em repositórios públicos
- Adicione `service-account.json` ao seu `.gitignore`
- Proteja essas credenciais, pois elas dão acesso administrativo ao seu projeto Firebase 