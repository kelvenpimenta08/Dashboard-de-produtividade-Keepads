module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Metodo nao permitido' });

  var cuKey = process.env.CLICKUP_API_KEY;
  if (!cuKey) return res.status(500).json({ error: 'Sem CLICKUP_API_KEY' });

  var body = req.body;
  var from = body.from;
  var to = body.to;
  if (!from || !to) return res.status(400).json({ error: 'from e to obrigatorios' });

  var LIST_ID = '901320419867';

  var NOMES = {
    'Marcos': 'Marcos Coelho',
    'Pedro': 'Pedro Augusto',
    'Tiago': 'Tiago Ciribeli',
    'Alexandre': 'Alexandre Pires',
    'Kelven': 'Kelven Pimenta',
    'Ana': 'Ana Clara Rayol'
  };

  var GESTORES = ['Marcos Coelho','Pedro Augusto','Tiago Ciribeli','Alexandre Pires','Kelven Pimenta','Ana Clara Rayol'];

  var pend = {};
  var done = {};
  GESTORES.forEach(function(g) { pend[g] = 0; done[g] = 0; });

  function mapNome(fullName) {
    if (!fullName) return null;
    var keys = Object.keys(NOMES);
    for (var i = 0; i < keys.length; i++) {
      if (fullName.toLowerCase().indexOf(keys[i].toLowerCase()) !== -1) {
        return NOMES[keys[i]];
      }
    }
    return null;
  }

  try {
    var headers = { 'Authorization': cuKey, 'Content-Type': 'application/json' };

    // Busca tarefas PENDENTES
    var urlPend = 'https://api.clickup.com/api/v2/list/' + LIST_ID + '/task?statuses[]=FAZER%20-%20ROTINA%20J%C3%81&include_closed=false&page=0&limit=100';
    var rPend = await fetch(urlPend, { headers: headers });
    var dataPend = await rPend.json();

    if (dataPend.tasks) {
      dataPend.tasks.forEach(function(task) {
        (task.assignees || []).forEach(function(a) {
          var nome = mapNome(a.username || a.email || '');
          if (nome) pend[nome] = (pend[nome] || 0) + 1;
        });
      });
    }

    // Busca tarefas CONCLUIDAS no periodo
    var fromMs = new Date(from).getTime();
    var toMs = new Date(to).getTime() + 86400000;
    var urlDone = 'https://api.clickup.com/api/v2/list/' + LIST_ID + '/task?statuses[]=FEITO&include_closed=true&date_done_gt=' + fromMs + '&date_done_lt=' + toMs + '&page=0&limit=100';
    var rDone = await fetch(urlDone, { headers: headers });
    var dataDone = await rDone.json();

    if (dataDone.tasks) {
      dataDone.tasks.forEach(function(task) {
        (task.assignees || []).forEach(function(a) {
          var nome = mapNome(a.username || a.email || '');
          if (nome) done[nome] = (done[nome] || 0) + 1;
        });
      });
    }

    return res.status(200).json({ pend: pend, done: done });

  } catch(e) {
    return res.status(500).json({ error: e.message });
  }
};
