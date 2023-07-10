# ChatX

O ChatX é um aplicativo de chat em tempo real desenvolvido em Node.js, Express.js, Socket.IO e MongoDB. Permite que os usuários se conectem em salas de chat com diferentes categorias e troquem mensagens instantaneamente.

## Funcionalidades

- Cadastro e autenticação de usuários
- Entrar em salas
- Envio e recebimento de mensagens em tempo real
- Exibição das últimas mensagens ao entrar em uma sala

## Tecnologias Utilizadas

- Node.js
- Express.js
- Socket.IO
- MongoDB

## Pré-requisitos

- Node.js (https://nodejs.org)
- MongoDB (https://www.mongodb.com)

## Instalação

1. Clone o repositório:
- git clone https://github.com/seu-usuario/chatx.git
  
2. Instale as dependências:
- cd chatx
- npm install

3. Configure o banco de dados MongoDB no arquivo `app.js`:
- const url = 'mongodb://localhost:27017';
- const dbName = 'chatX';

Execute o aplicativo:
npm start

Acesse o aplicativo no seu navegador em http://localhost:8080.
