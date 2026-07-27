exports.handler = async function () {
  var token  = process.env.NETLIFY_API_TOKEN;
  var formId = process.env.GALLERY_FORM_ID;

  if (!token || !formId) return respond([]);

  try {
    var res  = await fetch(
      'https://api.netlify.com/api/v1/forms/' + formId + '/submissions?per_page=100',
      { headers: { Authorization: 'Bearer ' + token } }
    );
    var subs = await res.json();

    if (!Array.isArray(subs)) return respond([]);

    var photos = subs
      .filter(function (s) { return s.data && s.data.image_url; })
      .map(function (s) {
        return {
          id:          s.id,
          url:         s.data.image_url,
          description: s.data.description || '',
          date:        s.created_at,
        };
      });

    return respond(photos);
  } catch (_) {
    return respond([]);
  }
};

function respond(body) {
  return {
    statusCode: 200,
    headers: {
      'Content-Type':  'application/json',
      'Cache-Control': 'public, s-maxage=120, max-age=60',
    },
    body: JSON.stringify(body),
  };
}
