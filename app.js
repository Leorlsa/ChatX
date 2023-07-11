const express = require('express');
const path = require('path');
const bcrypt = require('bcrypt');
const { MongoClient } = require('mongodb');
const session = require('express-session');
const socketIO = require('socket.io');
const socketIOSession = require('socket.io-express-session');
const Filter = require('bad-words');

const filter = new Filter();
const app = express();
const server = app.listen(8080, () => {
  console.log('Servidor iniciado na porta 8080');
});
const io = socketIO(server);
const secretKey = 'A3h8mR2$J5!s';

// Configuração do middleware de sessão
const sessionMiddleware = session({
  secret: secretKey,
  resave: false,
  saveUninitialized: true,
  cookie: { secure: false } // Defina como "true" se estiver usando HTTPS
});

// Use o middleware de sessão na aplicação
app.use(sessionMiddleware);

// Configuração do Socket.IO 
io.use(socketIOSession(sessionMiddleware, {
  autoSave: true
}));

// Define o diretório de arquivos estáticos
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'public'));
app.use(express.static(path.join(__dirname, 'public')));
app.use('/css', express.static(path.join(__dirname, 'public/css')));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Conexão com o MongoDB
const url = 'mongodb://localhost:27017';
const dbName = 'chatX';

async function connectToMongo() {
  try {
    const client = new MongoClient(url);
    await client.connect();
    console.log('Conectado ao MongoDB');
    const db = client.db(dbName);
    return db;
  } catch (error) {
    console.error('Erro ao conectar ao MongoDB:', error);
    throw error;
  }
}

// Rota GET para o arquivo index.html
app.get('/', (req, res) => {
  const usuarioLogado = req.session.usuario ? req.session.usuario.usuario : null;
  res.render('index', { usuarioLogado });
});

// ...



// Rota GET para o arquivo de cadastro
app.get('/cadastro', (req, res) => {
  res.render('cadastro');
});

// Rota GET para o arquivo de login
app.get('/login', (req, res) => {
  const mensagem = req.query.mensagem || null;
  res.render('login', { mensagem });
});

// Rota GET para o arquivo do chat
// Rota GET para o arquivo do chat
app.get('/chat', (req, res) => {
  const categoria = req.session.categoria;
  res.render('chat', { categoria });
});

// Rota GET para obter informações do usuário
app.get('/usuario', (req, res) => {
  const usuario = req.session.usuario;
  if (usuario) {
    res.send(usuario.usuario); // Retorna o nome de usuário
  } else {
    res.status(401).send('Usuário não autenticado');
  }
});

// Rota GET para redirecionar para o chat específico da categoria
app.get('/chat/:categoria', async (req, res) => {
  const { categoria } = req.params;
  
  try {
    const db = await connectToMongo();
    
    const collection = db.collection('salas');
    // Busca o documento da sala com base na categoria
    const sala = await collection.findOne({ categoria });

    if (sala) {
      // Se a sala existe, retorne a página do chat correspondente
      const usuario = req.session.usuario; 
     
      res.render('chat', { usuario, categoria }); // Passa a categoria para o arquivo chat.ejs
      
    } else {
      // Se a sala não foi encontrada, retorne uma mensagem de erro
      res.status(404).send('Sala não encontrada');
    }
  } catch (error) {
    console.error('Erro ao buscar sala:', error);
    res.status(500).send('Ocorreu um erro ao buscar a sala');
  }
});

// Rota POST para o formulário de cadastro
app.post('/cadastro', async (req, res) => {
  const { usuario, senha } = req.body;

  try {
    const db = await connectToMongo();
    const collection = db.collection('usuarios');

    // Verifica se o usuário já está cadastrado
    const usuarioExistente = await collection.findOne({ usuario });

    // Define a variável mensagem com base na condição
    const mensagem = usuarioExistente ? 'Usuário já cadastrado' : '';

    if (usuarioExistente) {
      return res.render('cadastro', { mensagem }); // Corrigido: Passa a variável 'mensagem' para o template
    }

    // Gera o hash da senha usando o bcrypt
    const hash = await bcrypt.hash(senha, 10);

    // Cria um novo documento no banco de dados com os dados do formulário
    const novoUsuario = { usuario, senha: hash };
    const resultado = await collection.insertOne(novoUsuario);
    console.log('Novo usuário cadastrado:', resultado.insertedId);

    res.render('login', { mensagem: '' }); // Corrigido: Passa uma string vazia para a variável 'mensagem'
  } catch (error) {
    console.error('Erro ao cadastrar usuário:', error);
    res.status(500).send('Ocorreu um erro ao cadastrar o usuário');
  }
});

app.get('/logout', (req, res) => {
  // Remova as informações do usuário da sessão
  req.session.usuario = null;
  // Redirecione para a página de login ou qualquer outra página desejada
  res.redirect('/');
});
// Rota POST para o formulário de login
app.post('/login', async (req, res) => {
  const { username, password } = req.body;
  let mensagem = null;

  try {
    const db = await connectToMongo();
    const collection = db.collection('usuarios');

    const usuario = await collection.findOne({ usuario: username });

    if (usuario) {
      const senhaCorreta = await bcrypt.compare(password, usuario.senha);

      if (senhaCorreta) {
        req.session.usuario = usuario;
        const usuarioLogado = usuario.usuario;
        return res.render('index', { usuarioLogado });
      } else {
        mensagem = 'Senha incorreta';
      }
    } else {
      mensagem = 'Usuário não encontrado';
    }
  } catch (error) {
    console.error('Erro ao fazer login:', error);
    mensagem = 'Ocorreu um erro ao fazer login';
  }

  res.render('login', { mensagem });
});


io.use((socket, next) => {
  sessionMiddleware(socket.request, {}, next);
});

io.on('connection', async (socket) => {
  console.log('Novo cliente conectado');

  // No evento 'entrarSala'
  socket.on('entrarSala', (data) => {
    const { categoria } = data;

    // Lógica para adicionar o socket do cliente à sala correspondente
    socket.join(categoria);
    socket.emit('redirecionarChat', `/chat/${categoria}`);

    // Armazena a categoria na sessão do usuário
    socket.request.session.categoria = categoria;
  });
  socket.on('reentradaSala', async (categoria) => {
    socket.join(categoria);
    socket.emit('redirecionarChat', `/chat/${categoria}`);

    try {
      const db = await connectToMongo();
      const collection = db.collection('mensagens');
      // Busca as mensagens existentes do banco de dados
      const mensagens = await collection.find({ categoria }).toArray();
      // Envia as mensagens para o cliente
      socket.emit('mensagensExistentes', mensagens);
    } catch (error) {
      console.error('Erro ao obter mensagens do banco de dados:', error);
    }
  });

  // No evento 'enviarMensagem'
// No evento 'enviarMensagem'
socket.on('enviarMensagem', async (mensagem) => {
  // Verifica se socket.request e socket.request.session estão definidos
    // Verifica se socket.request e socket.request.session estão definidos
    if (!socket.request || !socket.request.session) {
      console.error('Sessão inválida');
      return;
    }
  
    // Verifica se o usuário está autenticado
    if (!socket.request.session.usuario) {
      console.error('Usuário não autenticado');
      socket.emit('redirecionarLogin'); // Emitir evento de redirecionamento para o cliente
      return;
    }

  const usuario = socket.request.session.usuario;
  const categoria = socket.request.session.categoria;
  
  
  const novaMensagem = {
    usuario: usuario.usuario,
    mensagem: mensagem,
    categoria: categoria
  };

  try {
    const db = await connectToMongo();
    const collection = db.collection('mensagens');
    // Insere a nova mensagem no banco de dados
    await collection.insertOne(novaMensagem);
    console.log('Evento "enviarMensagem" emitido:', novaMensagem);

    // Emite o evento "enviarMensagem" para os clientes na mesma sala
    io.to(socket.rooms[socket.id]).emit('enviarMensagem', novaMensagem);

    const mensagensAtualizadas = await collection.find({ categoria: categoria }).toArray();


    // Emite o evento 'mensagensExistentes' para atualizar as mensagens em tempo real para todos os clientes na mesma sala
    io.to(categoria).emit('mensagensExistentes', mensagensAtualizadas);

  } catch (error) {
    console.error('Erro ao inserir mensagem no banco de dados:', error);
  }
});

io.setMaxListeners(Infinity);
  // No evento 'obterMensagens'
  // No evento 'obterMensagens'
socket.on('obterMensagens', async () => {
  try {
    const db = await connectToMongo();
    const collection = db.collection('mensagens');
    
    // Filtra as mensagens pelo campo "categoria"
    const categoria = socket.request.session.categoria;
    const mensagens = await collection.find({ categoria }).limit(10).toArray();
    
    // Envia as mensagens filtradas para o cliente
    socket.emit('mensagensExistentes', mensagens);
  } catch (error) {
    console.error('Erro ao obter mensagens do banco de dados:', error);
  }
});

  socket.emit('obterMensagens');
  // Emite o evento 'mensagensExistentes' para o cliente atual
  io.on('mensagensExistentes', async (socket) => {
    // Obtém as mensagens existentes do banco de dados
    try {
      const db = await connectToMongo();
      const collection = db.collection('mensagens');
      const mensagens = await collection.find({}).limit(10).toArray();
      // Envia as mensagens para o cliente
      socket.emit('mensagensExistentes', mensagens);
    } catch (error) {
      console.error('Erro ao obter mensagens do banco de dados:', error);
    }
  });
}); 

// No evento 'mensagensExistentes'

