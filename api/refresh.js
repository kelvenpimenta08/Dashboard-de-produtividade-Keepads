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
  var SPACE_ID = '901310794200';

  var NOMES = {
    'marcos': 'Marcos Coelho',
    'pedro': 'Pedro Augusto',
    'tiago': 'Tiago Ciribeli',
    'alexandre': 'Alexandre Pires',
    'kelven': 'Kelven Pimenta',
    'ana': 'Ana Clara Rayol'
  };

  var GESTORES = ['Marcos Coelho','Pedro Augusto','Tiago Ciribeli','Alexandre Pires','Kelven Pimenta','Ana Clara Rayol'];

  function mapNome(fullName) {
    if (!fullName) return null;
    var lower = fullName.toLowerCase();
    var keys = Object.keys(NOMES);
    for (var i = 0; i < keys.length; i++) {
      if (lower.indexOf(keys[i]) !== -1) return NOMES[keys[i]];
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

  // Estrutura de dados por gestor
  var resultado = {};
  GESTORES.forEach(function(g) {
    resultado[g] = {
      atrasado: [],
      venceHoje: [],
      feito: [],
      totalAtrasado: 0,
      totalVenceHoje: 0,
      totalFeito: 0
    };
  });

  try {
    // Busca todas as listas do space
    var rLists = await fetch('https://api.clickup.com/api/v2/space/' + SPACE_ID + '/list?archived=false', { headers: headers });
    var dataLists = await rLists.json();
    var lists = (dataLists.lists || []).map(function(l) { return l.id; });

    // Busca folders e listas dentro deles
    var rFolders = await fetch('https://api.clickup.com/api/v2/space/' + SPACE_ID + '/folder?archived=false', { headers: headers });
    var dataFolders = await rFolders.json();
    var folderPromises = (dataFolders.folders || []).map(function(f) {
      return fetch('https://api.clickup.com/api/v2/folder/' + f.id + '/list?archived=false', { headers: headers })
        .then(function(r) { return r.json(); })
        .then(function(d) { return (d.lists || []).map(function(l) { return l.id; }); });
    });
    var folderLists = await Promise.all(folderPromises);
    folderLists.forEach(function(fl) { lists = lists.concat(fl); });

    // Busca tarefas ABERTAS com due date (qualquer status exceto FEITO)
    var openPromises = lists.map(function(listId) {
      var url = 'https://api.clickup.com/api/v2/list/' + listId + '/task?include_closed=false&due_date_gt=0&page=0&limit=100';
      return fetch(url, { headers: headers })
        .then(function(r) { return r.json(); })
        .then(function(d) { return (d.tasks || []).filter(function(t) { return t.status && t.status.status && t.status.status.toUpperCase() !== 'FEITO'; }); })
        .catch(function() { return []; });
    });

    var allOpenArrays = await Promise.all(openPromises);
    var allOpen = [];
    allOpenArrays.forEach(function(arr) { allOpen = allOpen.concat(arr); });

    // Classifica tarefas abertas
    allOpen.forEach(function(task) {
      if (!task.due_date) return;
      var due = parseInt(task.due_date);
      var tags = (task.tags || []).map(function(t) { return t.name; });
      var taskInfo = {
        id: task.id,
        nome: task.name,
        tags: tags,
        due: due,
        dueStr: new Date(due).toLocaleDateString('pt-BR', {day:'2-digit', month:'2-digit'})
      };

      (task.assignees || []).forEach(function(a) {
        var nome = mapNome(a.username || a.email || '');
        if (!nome) return;
        if (due < hojeMs) {
          resultado[nome].atrasado.push(taskInfo);
          resultado[nome].totalAtrasado++;
        } else if (due >= hojeMs && due < amanhaMs) {
          resultado[nome].venceHoje.push(taskInfo);
          resultado[nome].totalVenceHoje++;
        }
      });
    });

    // Busca tarefas FEITAS no período
    var donePromises = lists.map(function(listId) {
      var url = 'https://api.clickup.com/api/v2/list/' + listId + '/task?statuses[]=FEITO&include_closed=true&date_done_gt=' + range.from + '&date_done_lt=' + range.to + '&page=0&limit=100';
      return fetch(url, { headers: headers })
        .then(function(r) { return r.json(); })
        .then(function(d) { return d.tasks || []; })
        .catch(function() { return []; });
    });

    var allDoneArrays = await Promise.all(donePromises);
    var allDone = [];
    allDoneArrays.forEach(function(arr) { allDone = allDone.concat(arr); });

    allDone.forEach(function(task) {
      var tags = (task.tags || []).map(function(t) { return t.name; });
      var taskInfo = {
        id: task.id,
        nome: task.name,
        tags: tags,
        dueStr: task.date_done ? new Date(parseInt(task.date_done)).toLocaleDateString('pt-BR', {day:'2-digit', month:'2-digit'}) : ''
      };
      (task.assignees || []).forEach(function(a) {
        var nome = mapNome(a.username || a.email || '');
        if (nome) {
          resultado[nome].feito.push(taskInfo);
          resultado[nome].totalFeito++;
        }
      });
    });

    return res.status(200).json({ gestores: resultado });

  } catch(e) {
    return res.status(500).json({ error: e.message });
  }
};
