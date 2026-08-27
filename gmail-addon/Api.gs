/**
 * The PostgREST client, such as it is.
 *
 * One thing here is easy to get wrong and hard to diagnose: every StudioDeals
 * table lives in the `crm` schema, not `public`. The web app gets that from
 * supabase-js's `db: { schema: 'crm' }`; raw HTTP has to say so in a header,
 * and the header is different for reads and writes. Miss it and PostgREST
 * answers 404 for a table that plainly exists.
 *
 * Both headers go on every request. Each is ignored by the method it does not
 * apply to, and sending both removes a class of bug I cannot reproduce from
 * here to check.
 */

function apiHeaders(accessToken) {
  return {
    apikey: CONFIG.SUPABASE_ANON_KEY,
    Authorization: 'Bearer ' + accessToken,
    'Accept-Profile': CONFIG.SCHEMA,
    'Content-Profile': CONFIG.SCHEMA,
  };
}


/**
 * Sends the request, and retries exactly once on a 401 with a freshly minted
 * token — which covers the ordinary case of a token that expired between the
 * cache check and the call.
 */
function apiFetch(path, options) {
  var attempt = function (token) {
    var request = {
      method: options.method || 'get',
      headers: apiHeaders(token),
      muteHttpExceptions: true,
    };
    if (options.payload) {
      request.contentType = 'application/json';
      request.payload = JSON.stringify(options.payload);
    }
    if (options.prefer) request.headers.Prefer = options.prefer;
    return UrlFetchApp.fetch(CONFIG.SUPABASE_URL + '/rest/v1' + path, request);
  };

  var response = attempt(getAccessToken(false));
  if (response.getResponseCode() === 401) {
    response = attempt(getAccessToken(true));
  }

  var code = response.getResponseCode();
  var body = response.getContentText();

  if (code === 401 || code === 403) {
    throw new AuthRequiredError('StudioDeals refused the request. Sign in again.');
  }
  if (code < 200 || code >= 300) {
    var detail = body;
    try {
      var parsed = JSON.parse(body);
      detail = parsed.message || parsed.hint || parsed.details || body;
    } catch (ignored) {
      // Raw body it is.
    }
    throw new Error('StudioDeals ' + code + ': ' + truncate(detail, 300));
  }

  return body ? JSON.parse(body) : null;
}


/** Calls a function in the crm schema. Returns whatever it returns. */
function apiRpc(functionName, args) {
  return apiFetch('/rpc/' + functionName, { method: 'post', payload: args || {} });
}


/**
 * Every contact holding this address, most useful first.
 *
 * A function rather than ?email=ilike.<addr> because PostgREST cannot put
 * lower() on the column side of a filter, and lower(email) is exactly what
 * crm.contacts is indexed on — see migrations/009_gmail_messages.sql.
 */
function findContactsByEmail(address) {
  return apiRpc('find_contacts_by_email', { addr: address }) || [];
}
