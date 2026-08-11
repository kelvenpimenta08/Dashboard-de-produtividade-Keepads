module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Metodo nao permitido' });

  var cuKey = process.env.CLICKUP_API_KEY;
  if (!cuKey) return res.status(500).json({ error: 'Sem CLICKUP_API_KEY' });

  var body = req.body || {};
  var headers = { 'Authorization': cuKey, 'Content-Type': 'application/json' };
  var PREFIX = '[Nota interna · atraso] ';

  try {
    // ---- Enviar uma nota (vira comentario na tarefa) ----
    if (body.action === 'add') {
      if (!body.taskId || !body.texto) return res.status(400).json({ error: 'taskId e texto obrigatorios' });
      var r = await fetch('https://api.clickup.com/api/v2/task/' + encodeURIComponent(body.taskId) + '/comment', {
        method: 'POST',
        headers: headers,
        body: JSON.stringify({ comment_text: PREFIX + String(body.texto), notify_all: false })
      });
      if (!r.ok) {
        var errTxt = await r.text();
        return res.status(500).json({ error: 'ClickUp: ' + errTxt.slice(0, 200) });
      }
      return res.status(200).json({ ok: true });
    }

    // ---- Listar as notas ja registradas (ultima de cada tarefa) ----
    if (body.action === 'list') {
      var ids = Array.isArray(body.taskIds) ? body.taskIds.slice(0, 80) : [];
      var results = await Promise.all(ids.map(async function (id) {
        try {
          var rc = await fetch('https://api.clickup.com/api/v2/task/' + encodeURIComponent(id) + '/comment', { headers: headers });
          if (!rc.ok) return null;
          var d = await rc.json();
          var comments = d.comments || [];
          var best = null;
          for (var j = 0; j < comments.length; j++) {
            var txt = comments[j].comment_text || '';
            if (txt.indexOf(PREFIX) === 0) {
              var dt = parseInt(comments[j].date || '0');
              if (!best || dt >= best.dt) best = { dt: dt, texto: txt.slice(PREFIX.length) };
            }
          }
          return best ? { id: id, texto: best.texto } : null;
        } catch (e) { return null; }
      }));
      var notas = {};
      results.forEach(function (x) { if (x) notas[x.id] = x.texto; });
      return res.status(200).json({ notas: notas });
    }

    return res.status(400).json({ error: 'action invalida' });
  } catch (e) {
    return res.status(500).json({ error: e.message });
  }
};
