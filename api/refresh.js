module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Metodo nao permitido' });

  var cuKey = process.env.CLICKUP_API_KEY;
  if (!cuKey) return res.status(500).json({ error: 'Sem CLICKUP_API_KEY' });

  var body = req.body;
  var periodo = body.periodo || 'semana';

  var LISTAS = ['901320419867', '901327187163', '901320419878'];

  var MAPA = [
    { chave: 'Marcos Coelho',                   nome: 'Marcos Coelho' },
    { chave: 'Pedro Augusto de Novaes Barreto', nome: 'Pedro Augusto' },
    { chave: 'Tiago Ciribeli',                  nome: 'Tiago Ciribeli' },
    { chave: 'Alexandre Pires dias',            nome: 'Alexandre Pires' },
    { chave: 'Kelven Pimenta',                  nome: 'Kelven Pimenta' },
    { chave: 'Ana Clara Rayol',                 nome: 'Ana Clara Rayol' }
  ];

  var GESTORES = ['Marcos Coelho','Pedro Augusto','Tiago Ciribeli','Alexandre Pires','Kelven Pimenta','Ana Clara Rayol'];

  function mapNome(fullName) {
    if (!fullName) return null;
    for (var i = 0; i < MAPA.length; i++) {
      if (fullName === MAPA[i].chave) return MAPA[i].nome;
    }
    return null;
  }

  function getRange(periodo) {
    var now = new Date();
    var from, to;
    if (periodo === 'semana') {
      var day = now.getDay();
      from = new Date(now); from.setDate(now.getDate() - day); from.setHours(0,0,0,0);
      to = new Date(from); to.setDate(from.getDate() +
