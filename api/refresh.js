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
  var LIST_ID = '901320419867';

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
      to = new Date(from); to.setDate(from.getDate() + 6); to.setHours(23,59,59,999);
    } else if (periodo === 'mes') {
      from = new Date(now.getFullYear(), now.getMonth(), 1, 0,0,0,0);
      to = new Date(now.getFullYear(), now.getMonth()+1, 0, 23,59,59,999);
    } else {
      from = new Date(now.getFullYear(), 0, 1, 0,0,0,0);
      to = new Date(now.getFullYear(), 11, 31, 23,59,59,999);
    }
    return { from: from.getTime(), to: to.getTime() };
  }

  var hoje = new Date(); hoje.setHours(0,0,0,0);
  var hojeMs = hoje.getTime();
  var amanhaMs = hojeMs + 86400000;
  var range = getRange(periodo);
  var headers = { 'Authorization': cuKey, 'Content-Type': 'application/json' };

  var resultado = {};
  GESTORES.forEach(function(g) {
    resultado[g] = { atrasado:[], venceHoje:[], noPrazo:[], feito:[], totalAtrasado:0, totalVenceHoje:0, totalNoPrazo:0, totalFeito:0 };
  });

  function addTask(nome, taskInfo, tipo) {
    if (!resultado[nome]) return;
    resultado[nome][tipo].push(taskInfo);
    if (tipo==='atrasado') resultado[nome].totalAtrasado++;
    else if (tipo==='venceHoje') resultado[nome].totalVenceHoje++;
    else if (tipo==='noPrazo') resultado[nome].totalNoPrazo++;
    else if (tipo==='feito') resultado[nome].totalFeito++;
  }

  try {
    var allOpen = [];
    var page = 0;
    var hasMore = true;
    while (hasMore) {
      var url = 'https://api.clickup.com/api/v2/list/' + LIST_ID + '/task?include_closed=false&page=' + page + '&limit=100';
      var r = await fetch(url, { headers: headers });
      var d = await r.json();
      var tasks = d.tasks || [];
      allOpen = allOpen.concat(tasks);
      hasMore = tasks.length === 100;
      page++;
      if (page > 20) break;
    }

    allOpen.forEach(function(task) {
      var status = task.status && task.status.status ? task.status.status.toLowerCase() : '';
      if (status === 'feito') return;
      if (!task.due_date) return;

      var due = parseInt(task.due_date);
      var tags = (task.tags || []).map(function(t){ return t.name; });
      var taskInfo = {
        nome: task.name,
        tags: tags,
        dueStr: new Date(due).toLocaleDateString('pt-BR',{day:'2-digit',month:'2-digit'})
      };

      var tipo = due < hojeMs ? 'atrasado' : due < amanhaMs ? 'venceHoje' : 'noPrazo';

      (task.assignees || []).forEach(function(a) {
        var nome = mapNome(a.username || '');
        if (nome) addTask(nome, taskInfo, tipo);
      });
    });

    page = 0; hasMore = true;
    while (hasMore) {
      var urlDone = 'https://api.clickup.com/api/v2/list/' + LIST_ID + '/task?statuses[]=feito&include_closed=true&date_done_gt=' + range.from + '&date_done_lt=' + range.to + '&page=' + page + '&limit=100';
      var rDone = await fetch(urlDone, { headers: headers });
      var dDone = await rDone.json();
      var tasksDone = dDone.tasks || [];

      tasksDone.forEach(function(task) {
        var tags = (task.tags || []).map(function(t){ return t.name; });
        var taskInfo = {
          nome: task.name,
          tags: tags,
          dueStr: task.date_done ? new Date(parseInt(task.date_done)).toLocaleDateString('pt-BR',{day:'2-digit',month:'2-digit'}) : ''
        };
        (task.assignees || []).forEach(function(a) {
          var nome = mapNome(a.username || '');
          if (nome) addTask(nome, taskInfo, 'feito');
        });
      });

      hasMore = tasksDone.length === 100;
      page++;
      if (page > 20) break;
    }

    return res.status(200).json({ gestores: resultado });

  } catch(e) {
    return res.status(500).json({ error: e.message });
  }
};
