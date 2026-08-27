/**
 * Pure string helpers — no Apps Script globals anywhere in this file.
 *
 * That restriction is the point: it lets gmail-addon/tests run these under
 * Node, and while Google's domains are unreachable from the build side this
 * is the only part of the add-on that can be tested without a deploy.
 */


/**
 * Splits an address header on the commas that separate addresses, ignoring
 * the ones inside a quoted display name. `"Cooper, Jane" <jane@x>` is one
 * address, not two, and getting that wrong turns a colleague into a stranger.
 */
function splitAddressList(header) {
  var out = [];
  var buf = '';
  var inQuotes = false;
  var inAngles = false;
  var text = String(header == null ? '' : header);

  for (var i = 0; i < text.length; i++) {
    var ch = text.charAt(i);
    if (ch === '"' && text.charAt(i - 1) !== '\\') {
      inQuotes = !inQuotes;
    } else if (ch === '<' && !inQuotes) {
      inAngles = true;
    } else if (ch === '>' && !inQuotes) {
      inAngles = false;
    } else if (ch === ',' && !inQuotes && !inAngles) {
      out.push(buf);
      buf = '';
      continue;
    }
    buf += ch;
  }
  out.push(buf);

  var trimmed = [];
  for (var j = 0; j < out.length; j++) {
    var piece = out[j].trim();
    if (piece) trimmed.push(piece);
  }
  return trimmed;
}


/** `Jane Cooper <jane@x.com>` -> { name: 'Jane Cooper', email: 'jane@x.com' }. */
function parseAddress(raw) {
  var s = String(raw == null ? '' : raw).trim();
  if (!s) return null;

  var name = '';
  var email = s;

  var angled = s.match(/^([\s\S]*)<([^>]*)>[\s\S]*$/);
  if (angled) {
    name = angled[1].trim();
    email = angled[2].trim();
  }

  var quoted = name.match(/^"([\s\S]*)"$/);
  if (quoted) name = quoted[1].trim();

  email = email.replace(/^mailto:/i, '').trim();
  if (email.indexOf('@') === -1) return null;

  return { name: name, email: email };
}


function parseAddressList(header) {
  var pieces = splitAddressList(header);
  var out = [];
  for (var i = 0; i < pieces.length; i++) {
    var parsed = parseAddress(pieces[i]);
    if (parsed) out.push(parsed);
  }
  return out;
}


function sameAddress(a, b) {
  if (!a || !b) return false;
  return String(a).trim().toLowerCase() === String(b).trim().toLowerCase();
}


/**
 * Who the conversation is with — which is the sender, unless the sender is
 * you, in which case it is the first recipient who isn't.
 *
 * An email you sent only to yourself falls back to you rather than to
 * nothing, so the card always has an address to look up and say something
 * about.
 */
function pickCounterparty(headers, myEmail) {
  var from = parseAddressList(headers.from)[0] || null;
  if (from && !sameAddress(from.email, myEmail)) return from;

  var others = parseAddressList(headers.to).concat(parseAddressList(headers.cc));
  for (var i = 0; i < others.length; i++) {
    if (!sameAddress(others[i].email, myEmail)) return others[i];
  }
  return from;
}


/** The name to show when StudioDeals has never heard of the address. */
function displayNameFor(address) {
  if (!address) return 'Unknown sender';
  return address.name || address.email;
}


/**
 * "today" / "3 days ago" / "never" for contacts.last_contacted_at.
 *
 * Whole days apart in UTC, deliberately: the card wants "roughly how long",
 * and an hours-based calculation would call yesterday evening "today" for
 * half the morning.
 */
function describeLastContacted(iso, nowMs) {
  if (!iso) return 'never';

  var then = Date.parse(iso);
  if (isNaN(then)) return 'never';

  var DAY = 86400000;
  var days = Math.floor(nowMs / DAY) - Math.floor(then / DAY);

  if (days < 0) return 'today';
  if (days === 0) return 'today';
  if (days === 1) return 'yesterday';
  if (days < 61) return days + ' days ago';

  var months = Math.round(days / 30.44);
  if (months < 24) return months + ' months ago';
  return Math.round(days / 365.25) + ' years ago';
}


/** Keeps an error message short enough to read in a 300px sidebar. */
function truncate(text, limit) {
  var s = String(text == null ? '' : text);
  return s.length <= limit ? s : s.slice(0, limit - 1) + '…';
}


/**
 * Cents to "$42,000", the same shape the web app shows.
 *
 * Hand-rolled rather than Intl.NumberFormat, for two reasons: it stays
 * testable under Node with no dependence on which ICU data Apps Script
 * happens to ship, and money in this project is integer cents that must never
 * become a float on the way to a screen. Whole dollars only — en-AU renders
 * AUD with a bare $, so this matches formatCents in src/lib/format.ts.
 */
function formatCents(cents) {
  var value = Math.round(Number(cents || 0) / 100);
  var sign = value < 0 ? '-' : '';
  var digits = String(Math.abs(value));
  var grouped = '';
  for (var i = 0; i < digits.length; i++) {
    if (i > 0 && (digits.length - i) % 3 === 0) grouped += ',';
    grouped += digits.charAt(i);
  }
  return sign + '$' + grouped;
}


/**
 * True where the quoted history starts. Everything from here down is the
 * conversation the CRM already has, or is about to get from its own row.
 */
function isQuoteBoundary(line, next) {
  var following = String(next == null ? '' : next);

  if (/^\s*-{2,}\s*Original Message\s*-{2,}\s*$/i.test(line)) return true;
  if (/^\s*_{10,}\s*$/.test(line)) return true;
  if (/^\s*On\b.*\bwrote:\s*$/.test(line)) return true;

  // Gmail wraps a long attribution over two lines.
  if (/^\s*On\b/.test(line) && /\bwrote:\s*$/.test(following)) return true;

  // Outlook's forwarded header. Paired with the line below it, because a bare
  // "From:" appears in plenty of legitimate prose.
  if (/^\s*From:\s*\S/.test(line) && /^\s*(Sent|Date):\s*\S/.test(following)) return true;

  return false;
}


/** The readable part of a plain-text body: no quoted history, no ragged
 *  whitespace. */
function cleanBody(raw) {
  var lines = String(raw == null ? '' : raw).replace(/\r\n?/g, '\n').split('\n');
  var kept = [];

  for (var i = 0; i < lines.length; i++) {
    if (isQuoteBoundary(lines[i], lines[i + 1])) break;
    if (/^\s*>/.test(lines[i])) continue;
    kept.push(lines[i].replace(/\s+$/, ''));
  }

  return kept.join('\n').replace(/\n{3,}/g, '\n\n').trim();
}


/**
 * The activity note: who, when, and enough of what to recognise the thread a
 * year later. Not an archive — the email itself stays in Gmail, and the row
 * carries the ids that lead back to it.
 */
function buildNote(headers, body, limit) {
  var lines = ['From: ' + (headers.from || '—')];
  if (headers.to) lines.push('To: ' + headers.to);
  if (headers.cc) lines.push('Cc: ' + headers.cc);
  if (headers.dateText) lines.push('Date: ' + headers.dateText);

  var excerpt = truncate(cleanBody(body), limit);
  return excerpt ? lines.join('\n') + '\n\n' + excerpt : lines.join('\n');
}
