module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();

  var cuKey = process.env.CLICKUP_API_KEY;
  var SPACE_ID = '901310794200';
  var headers = { 'Authorization': cuKey, 'Content-Type': 'application/json' };

  try {
    var rLists = await fetch('https://api.clickup.com/api/v2/space/' + SPACE_ID + '/list?archived=false', { headers: headers });
    var dataLists = await rLists.json();
    var lists = dataLists.lists || [];

    var debugLists = [];
    for (var i = 0; i < lists.length; i++) {
      var l = lists[i];
      var rTasks = await fetch('https://api.clickup.com/api/v2/list/' + l.id + '/task?include_closed=false&page=0&limit=10', { headers: headers });
      var dTasks = await rTasks.json();
      debugLists.push({
        lista_id: l.id,
        lista_nome: l.name,
        total_tarefas: (dTasks.tasks || []).length,
        exemplo: (dTasks.tasks || []).slice(0,3).map(function(t){
          return {
            nome: t.name,
            due: t.due_date,
            status: t.status && t.status.status,
            assignees: (t.assignees||[]).map(function(a){ return a.username; })
          };
        })
      });
    }

    return res.status(200).json({
      total_listas: lists.length,
      listas: debugLists
    });

  } catch(e) {
    return res.status(500).json({ error: e.message });
  }
};
