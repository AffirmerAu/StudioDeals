/**
 * Supabase auth, done with plain HTTP.
 *
 * Sign in once with the password grant; keep only the refresh token, in
 * PropertiesService.getUserProperties() — per user, per script, invisible to
 * every other add-on. The password is used for exactly one request and is
 * never written anywhere. The hour-long access token lives in CacheService,
 * and is minted again from the refresh token whenever it is missing or close
 * to expiring.
 *
 * The result is that every PostgREST call carries the user's own JWT, so the
 * add-on has precisely the permissions that user has in the browser. There is
 * no second set of policies to keep in step, and no service-role key.
 */

var REFRESH_TOKEN_KEY = 'sb_refresh_token';
var ACCESS_TOKEN_KEY = 'sb_access_token';

/** Refresh this far before the token actually dies, so a slow card never
 *  races the expiry. */
var EXPIRY_MARGIN_SECONDS = 300;


/** Thrown when the caller needs to show the sign-in card instead of a result. */
function AuthRequiredError(message) {
  this.name = 'AuthRequiredError';
  this.message = message || 'Sign in to StudioDeals';
}
AuthRequiredError.prototype = Object.create(Error.prototype);


function tokenUrl(grantType) {
  return CONFIG.SUPABASE_URL + '/auth/v1/token?grant_type=' + grantType;
}


function postToken(grantType, payload) {
  var response = UrlFetchApp.fetch(tokenUrl(grantType), {
    method: 'post',
    contentType: 'application/json',
    headers: {
      apikey: CONFIG.SUPABASE_ANON_KEY,
      Authorization: 'Bearer ' + CONFIG.SUPABASE_ANON_KEY,
    },
    payload: JSON.stringify(payload),
    muteHttpExceptions: true,
  });

  var code = response.getResponseCode();
  var body = response.getContentText();

  if (code >= 200 && code < 300) return JSON.parse(body);

  var detail = body;
  try {
    var parsed = JSON.parse(body);
    detail = parsed.error_description || parsed.msg || parsed.message || body;
  } catch (ignored) {
    // Leave detail as the raw body — an HTML error page is still a clue.
  }
  throw new AuthRequiredError(detail);
}


/**
 * Stores the pair. Supabase rotates the refresh token on every use, so the
 * new one always has to be written back or the next refresh fails.
 */
function storeSession(session) {
  if (session.refresh_token) {
    PropertiesService.getUserProperties().setProperty(REFRESH_TOKEN_KEY, session.refresh_token);
  }
  if (session.access_token) {
    var lifetime = Number(session.expires_in || 3600) - EXPIRY_MARGIN_SECONDS;
    CacheService.getUserCache().put(
      ACCESS_TOKEN_KEY,
      session.access_token,
      Math.max(60, Math.min(21600, lifetime)),
    );
  }
}


function signIn(email, password) {
  var session = postToken('password', { email: email, password: password });
  storeSession(session);
  return session;
}


function signOut() {
  PropertiesService.getUserProperties().deleteProperty(REFRESH_TOKEN_KEY);
  CacheService.getUserCache().remove(ACCESS_TOKEN_KEY);
}


function hasStoredSession() {
  return !!PropertiesService.getUserProperties().getProperty(REFRESH_TOKEN_KEY);
}


/**
 * A usable access token, refreshing if the cache has none.
 *
 * The lock matters. Refresh tokens are single-use, so two card handlers
 * refreshing at once would leave one of them holding a token Supabase has
 * already retired — and the failure looks like a random sign-out days later.
 */
function getAccessToken(forceRefresh) {
  var cache = CacheService.getUserCache();

  if (!forceRefresh) {
    var cached = cache.get(ACCESS_TOKEN_KEY);
    if (cached) return cached;
  }

  var lock = LockService.getUserLock();
  lock.waitLock(15000);
  try {
    if (!forceRefresh) {
      var again = cache.get(ACCESS_TOKEN_KEY);
      if (again) return again;
    }

    var refreshToken = PropertiesService.getUserProperties().getProperty(REFRESH_TOKEN_KEY);
    if (!refreshToken) throw new AuthRequiredError('Sign in to StudioDeals');

    var session;
    try {
      session = postToken('refresh_token', { refresh_token: refreshToken });
    } catch (err) {
      // A refresh token Supabase will not honour is worse than none at all:
      // it makes every future call fail the same way. Clear it and ask.
      signOut();
      throw new AuthRequiredError('Your StudioDeals session expired. Sign in again.');
    }

    storeSession(session);
    return session.access_token;
  } finally {
    lock.releaseLock();
  }
}
