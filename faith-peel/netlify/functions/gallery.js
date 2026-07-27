exports.handler = async function () {
  var token  = process.env.NETLIFY_API_TOKEN;
  var formId = process.env.GALLERY_FORM_ID;

  if (!token || !formId) {
    return respond({ debug: 'missing env vars', hasToken: !!token, hasFormId: !!formId });
  }

  try {
    var res  = await fetch(
      'https://api.netlify.com/api/v1/forms/' + formId + '/submissions?per_page=100',
      { headers: { Authorization: 'Bearer ' + token } }
    );
    var subs = await res.json();

    if (!Array.isArray(subs)) {
      return respond({ debug: 'api error', response: subs });
    }

    var photos = subs
      .filter(function (s) { return s.data && s.data.image_url; })
      .map(function (s) {
        return {
          url:         s.data.image_url,
          description: s.data.description || '',
          date:        s.created_at,
        };
      });

    return respond(photos);
  } catch (e) {
    return respond({ debug: 'exception', error: e.message });
  }
};

function respond(body) {
  return {
    statusCode: 200,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  };
}
