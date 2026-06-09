module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();

  var cuKey = process.env.CLICKUP_API_KEY;
  var LIST_ID = '901320419867';
  var headers = { 'Authorization': cuKey, 'Content-Type': 'application/json' };

  var url = 'https://api.clickup.com/api/v2/list/' + LIST_ID + '/task?include_closed=false&page=0&limit=3';
  var r = await fetch(url, { headers: headers });
  var d = await r.json();

  return res.status(200).json({
    amostras: (d.tasks || []).map(function(t) {
      return {
        nome: t.name,
        due_date: t.due_date,
        assignees: (t.assignees || []).map(function(a) {
          return {
            id: a.id,
            username: a.username,
            email: a.email
          };
        })
      };
    })
  });
};
