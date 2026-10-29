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

  // Casa cada gestor pelo ID do ClickUp (estável, não muda em renomeações).
  // 'chaves' = nomes de usuário conhecidos, usados só como reserva.
  var MAPA = [
    { ids: [81979690],            chaves: ['Marcos Coelho'],                                  nome: 'Marcos Coelho' },
    { ids: [72724121],            chaves: ['Pedro Barreto', 'Pedro Augusto de Novaes Barreto'], nome: 'Pedro Augusto' },
    { ids: [82193728],            chaves: ['Tiago Ciribeli'],                                 nome: 'Tiago Ciribeli' },
    { ids: [106181981],           chaves: ['Alexandre Pires dias'],                           nome: 'Alexandre Pires' },
    { ids: [112047362, 72846863], chaves: ['Kelven Pimenta'],                                 nome: 'Kelven Pimenta' },
    { ids: [61035965],            chaves: ['Ana Clara Rayol'],                                nome: 'Ana Clara Rayol' },
    { ids: [82159134],            chaves: ['Enzo Paiva', 'Enzo Santos Paiva'],                nome: 'Enzo Santos Paiva' },
    { ids: [96203724],            chaves: ['Guilherme Vital'],                                nome: 'Guilherme Vital' }
  ];

  var GESTORES = ['Marcos Coelho','Pedro Augusto','Tiago Ciribeli','Alexandre Pires','Kelven Pimenta','Ana Clara Rayol','Enzo Santos Paiva','Guilherme Vital'];

  function mapAssignee(a) {
    if (!a) return null;
    for (var i = 0; i < MAPA.length; i++) {
      if (a.id != null && MAPA[i].ids.indexOf(a.id) !== -1) return MAPA[i].nome;
    }
    for (var j = 0; j < MAPA.length; j++) {
      if (a.username && MAPA[j].chaves.indexOf(a.username) !== -1) return MAPA[j].nome;
    }
    return null;
  }

  function getRange(periodo) {
    if (periodo === 'custom' && body.from && body.to) {
      var cf = new Date(body.from + 'T00:00:00');
      var ct = new Date(body.to + 'T23:59:59.999');
      return { from: cf.getTime(), to: ct.getTime() };
    }
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

  // Percorre todas as páginas de UMA busca, puxando várias páginas de uma vez
  // (em lotes). Como as 6 buscas também rodam em paralelo, períodos pesados
  // (mês/ano, com muitas tarefas feitas) deixam de estourar o tempo.
  async function paginar(buildUrl, onTask) {
    var BATCH = 5, MAXP = 40;
    var page = 0, done = false;
    while (!done && page <= MAXP) {
      var pages = [];
      for (var k = 0; k < BATCH && (page + k) <= MAXP; k++) pages.push(page + k);
      var datas = await Promise.all(pages.map(function(pp) {
        return fetch(buildUrl(pp), { headers: headers }).then(function(r) {
          if (!r.ok) {
            return r.text().catch(function(){ return ''; }).then(function(t) {
              throw new Error('ClickUp ' + r.status + (t ? (': ' + t.slice(0, 140)) : ''));
            });
          }
          return r.json();
        });
      }));
      for (var i = 0; i < datas.length; i++) {
        var tasks = (datas[i] && datas[i].tasks) || [];
        tasks.forEach(onTask);
        if (tasks.length < 100) { done = true; break; }
      }
      page += pages.length;
    }
  }

  function onPendente(task) {
    var status = task.status && task.status.status ? task.status.status.toLowerCase() : '';
    if (status === 'feito') return;
    if (!task.due_date) return;

    var due = parseInt(task.due_date);
    var tags = (task.tags || []).map(function(t){ return t.name; });
    var diasAtraso = Math.floor((hojeMs - due) / 86400000);
    var taskInfo = {
      id: task.id,
      nome: task.name,
      tags: tags,
      dueStr: new Date(due).toLocaleDateString('pt-BR',{day:'2-digit',month:'2-digit'}),
      diasAtraso: diasAtraso,
      url: task.url || ''
    };

    var tipo = due < hojeMs ? 'atrasado' : due < amanhaMs ? 'venceHoje' : 'noPrazo';

    (task.assignees || []).forEach(function(a) {
      var nome = mapAssignee(a);
      if (nome) addTask(nome, taskInfo, tipo);
    });
  }

  function onFeito(task) {
    var tags = (task.tags || []).map(function(t){ return t.name; });
    var taskInfo = {
      id: task.id,
      nome: task.name,
      tags: tags,
      dueStr: task.date_done ? new Date(parseInt(task.date_done)).toLocaleDateString('pt-BR',{day:'2-digit',month:'2-digit'}) : ''
    };
    (task.assignees || []).forEach(function(a) {
      var nome = mapAssignee(a);
      if (nome) addTask(nome, taskInfo, 'feito');
    });
  }

  try {
    var jobs = [];
    LISTAS.forEach(function(listId) {
      // Pendentes (tarefas abertas com prazo)
      jobs.push(paginar(function(p) {
        return 'https://api.clickup.com/api/v2/list/' + listId + '/task?include_closed=false&page=' + p + '&limit=100';
      }, onPendente));
      // Feitas no período
      jobs.push(paginar(function(p) {
        return 'https://api.clickup.com/api/v2/list/' + listId + '/task?statuses[]=feito&include_closed=true&date_done_gt=' + range.from + '&date_done_lt=' + range.to + '&page=' + p + '&limit=100';
      }, onFeito));
    });

    await Promise.all(jobs);

    return res.status(200).json({ gestores: resultado });

  } catch(e) {
    return res.status(500).json({ error: e.message });
  }
};
