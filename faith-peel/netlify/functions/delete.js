exports.handler = async function (event) {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: 'Method not allowed' };
  }

  var token = process.env.NETLIFY_API_TOKEN;
  if (!token) return { statusCode: 500, body: 'Not configured' };

  var id;
  try {
    id = JSON.parse(event.body).id;
  } catch (_) {
    return { statusCode: 400, body: 'Bad request' };
  }

  if (!id) return { statusCode: 400, body: 'Missing id' };

  var res = await fetch(
    'https://api.netlify.com/api/v1/submissions/' + id,
    { method: 'DELETE', headers: { Authorization: 'Bearer ' + token } }
  );

  return { statusCode: res.ok ? 200 : res.status, body: '' };
};
