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


/**
 * The six pipeline stages, cached for the day.
 *
 * Read from crm.pipeline_stages and ordered by position, never hardcoded —
 * the same rule the web app follows. What counts as an open deal is whatever
 * the table says is neither won nor lost.
 */
var STAGES_CACHE_KEY = 'crm_stages';

function listStages() {
  var cache = CacheService.getUserCache();
  var cached = cache.get(STAGES_CACHE_KEY);
  if (cached) return JSON.parse(cached);

  var stages = apiFetch('/pipeline_stages?select=id,label,position,is_won,is_lost&order=position', {});
  cache.put(STAGES_CACHE_KEY, JSON.stringify(stages), 21600);
  return stages;
}


function stageById(stages, id) {
  for (var i = 0; i < stages.length; i++) {
    if (stages[i].id === id) return stages[i];
  }
  return null;
}


/**
 * An organisation's open deals, in board order.
 *
 * The filtering happens here rather than in the query because "open" is a
 * property of the stage, not the deal — expressing it in PostgREST would mean
 * an inner embed and a filter on the embedded table, for a list that is never
 * more than a handful of rows.
 */
function listOpenDeals(organisationId) {
  if (!organisationId) return [];

  var deals = apiFetch(
    '/deals?select=id,title,value_cents,stage_id&organisation_id=eq.' +
      encodeURIComponent(organisationId) +
      '&order=board_position',
    {},
  );
  var stages = listStages();

  var open = [];
  for (var i = 0; i < deals.length; i++) {
    var stage = stageById(stages, deals[i].stage_id);
    if (stage && !stage.is_won && !stage.is_lost) {
      deals[i].stage_label = stage.label;
      open.push(deals[i]);
    }
  }
  return open;
}


/**
 * Which of these Gmail messages StudioDeals already holds.
 *
 * The structural characters of the `in.` list stay raw while each id is
 * encoded on its own, so a thread id like `thread-f:1874387461069433417`
 * survives the trip without its colon breaking the filter.
 *
 * Reading before writing, rather than leaning on the unique index and
 * PostgREST's duplicate resolution: the index is partial, and a partial index
 * as a conflict target is exactly the combination this project has been
 * bitten by before. It also lets the card say "1 filed, 2 already held".
 */
function findSavedMessageIds(messageIds) {
  if (!messageIds.length) return {};

  var quoted = [];
  for (var i = 0; i < messageIds.length; i++) {
    quoted.push('"' + encodeURIComponent(messageIds[i]) + '"');
  }

  var rows = apiFetch(
    '/activities?select=gmail_message_id&gmail_message_id=in.(' + quoted.join(',') + ')',
    {},
  );

  var held = {};
  for (var j = 0; j < rows.length; j++) held[rows[j].gmail_message_id] = true;
  return held;
}


/** Writes the activity rows. Every object carries the same keys, because
 *  PostgREST rejects an array whose members disagree about their shape. */
function insertActivities(rows) {
  if (!rows.length) return [];
  return apiFetch('/activities', {
    method: 'post',
    payload: rows,
    prefer: 'return=representation',
  });
}
