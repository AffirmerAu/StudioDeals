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


/** "3 filed", "1 filed, 2 already held", "nothing new to file". */
function describeFiling(filed, skipped) {
  if (!filed && !skipped) return 'Nothing to file.';
  if (!filed) return skipped === 1 ? 'Already filed.' : 'All ' + skipped + ' already filed.';

  var text = filed === 1 ? '1 message filed' : filed + ' messages filed';
  if (skipped) text += ', ' + skipped + ' already held';
  return text + '.';
}


/** How much of the body goes into the note. Context, not an archive. */
var BODY_EXCERPT_LIMIT = 500;


/** One activity row for one Gmail message, against the chosen target. */
function activityRow(message, target) {
  return {
    deal_id: target.dealId || null,
    contact_id: target.contactId,
    organisation_id: target.organisationId || null,
    type: 'email',
    subject: message.subject || null,
    notes: buildNote(message, message.body, BODY_EXCERPT_LIMIT),
    occurred_at: message.dateIso,
    due_at: null,
    created_by: target.createdBy,
    gmail_message_id: message.id,
    gmail_thread_id: message.threadId || null,
  };
}


/**
 * PostgREST paths, built in the one file Node can test.
 *
 * This exists because of a real failure: the dedupe read was first written as
 * `gmail_message_id=in.("a","b")`, and UrlFetchApp refused the whole request
 * with "Invalid argument" before it left the machine. Double quotes are not
 * legal in a URL. Nothing in a card-shaped test would have caught it, so URL
 * construction moved here, where urlSafe() below can assert on it.
 */

function activitiesInThreadPath(threadId) {
  return '/activities?select=gmail_message_id&gmail_thread_id=eq.' + encodeURIComponent(threadId);
}


function stagesPath() {
  return '/pipeline_stages?select=id,label,position,is_won,is_lost&order=position';
}


function openDealsPath(organisationId) {
  return (
    '/deals?select=id,title,value_cents,stage_id&organisation_id=eq.' +
    encodeURIComponent(organisationId) +
    '&order=board_position'
  );
}


function contactPath(contactId) {
  return '/v_contacts_list?select=*&id=eq.' + encodeURIComponent(contactId) + '&limit=1';
}


/**
 * Whether a path is one UrlFetchApp will accept: unreserved characters, the
 * sub-delims PostgREST needs for its own syntax, and percent escapes. No
 * quotes, no spaces, no brackets.
 */
function urlSafe(path) {
  return /^[A-Za-z0-9\-._~!$&'()*+,;=:@\/?%]*$/.test(String(path));
}


/**
 * Whether an error is the database refusing a message it already holds.
 *
 * Matched narrowly on purpose: "409" on its own would also match a subject
 * line, and this decides whether to swallow an error or show it.
 */
function isDuplicateError(error) {
  var message = String(error && error.message ? error.message : error);
  return /^StudioDeals 409:/.test(message) || /23505|duplicate key value/i.test(message);
}


// ------------------------------------------------- creating people and work

/** 'kieranjessup@whittensgroup.com.au' -> 'whittensgroup.com.au'. */
function emailDomain(address) {
  var at = String(address == null ? '' : address).lastIndexOf('@');
  return at === -1 ? '' : String(address).slice(at + 1).trim().toLowerCase();
}


/**
 * A first and last name for a new contact.
 *
 * Gmail's display name is the good source when there is one. When there is
 * not, the local part usually still carries the name — kieran.jessup, or
 * kieran_jessup — and a first name is required by crm.contacts, so something
 * has to be found. Whatever this guesses, the card shows it in editable
 * fields before anything is written.
 */
function splitDisplayName(name, email) {
  var display = String(name == null ? '' : name).trim();

  // "Cooper, Jane" is a surname-first display name, not two people.
  var commaed = display.match(/^([^,]+),\s*(.+)$/);
  if (commaed) return { first: commaed[2].trim(), last: commaed[1].trim() };

  if (!display) {
    var local = String(email == null ? '' : email).split('@')[0] || '';
    display = local
      .replace(/[._\-+]+/g, ' ')
      .replace(/\d+/g, '')
      .trim()
      .replace(/\b[a-z]/g, function (c) {
        return c.toUpperCase();
      });
  }

  var parts = display.split(/\s+/).filter(Boolean);
  if (!parts.length) return { first: String(email || 'Unknown'), last: '' };
  if (parts.length === 1) return { first: parts[0], last: '' };
  return { first: parts[0], last: parts.slice(1).join(' ') };
}


var DOMAIN_NOISE = ['com', 'net', 'org', 'gov', 'edu', 'co', 'au', 'nz', 'uk', 'group', 'mail'];

/** 'whittensgroup.com.au' -> 'Whittensgroup', as a starting point the card
 *  lets you edit. */
function organisationNameFromDomain(domain) {
  var labels = String(domain == null ? '' : domain).toLowerCase().split('.');

  var kept = [];
  for (var i = 0; i < labels.length; i++) {
    if (DOMAIN_NOISE.indexOf(labels[i]) === -1 && labels[i]) kept.push(labels[i]);
  }
  if (!kept.length) kept = labels.slice(0, 1);

  var words = kept.join(' ').split(/[-_\s]+/).filter(Boolean);
  for (var j = 0; j < words.length; j++) {
    words[j] = words[j].charAt(0).toUpperCase() + words[j].slice(1);
  }
  return words.join(' ');
}


function contactsByDomainPath(domain) {
  return (
    '/contacts?select=organisation_id,organisations(name)&organisation_id=not.is.null' +
    '&email=ilike.*@' +
    encodeURIComponent(domain) +
    '&limit=200'
  );
}


function organisationsPath() {
  return '/organisations?select=id,name&order=name&limit=500';
}


/**
 * When the date-time picker's value has to be read as an instant.
 *
 * The picker hands back milliseconds since epoch that ignore the timezone the
 * person is standing in, and commonEventObject.timeZone.offset is what closes
 * the gap. Get the sign wrong and a task due at 5pm lands at 3am, so the card
 * that follows shows the time it settled on — the first task you set will say
 * whether this is right.
 */
function dueAtFromPicker(msSinceEpoch, offsetMs) {
  // Not `Number(x)` on its own: Number(null) and Number('') are both 0, and a
  // task with no date picked would quietly land in January 1970.
  if (msSinceEpoch == null || msSinceEpoch === '') return null;

  var ms = Number(msSinceEpoch);
  if (!isFinite(ms)) return null;
  return new Date(ms - Number(offsetMs || 0)).toISOString();
}


/** The row a new contact becomes. */
function contactRow(draft) {
  return {
    organisation_id: draft.organisationId || null,
    first_name: draft.firstName,
    last_name: draft.lastName || null,
    role: draft.role || null,
    email: draft.email || null,
    phone: null,
    notes: null,
  };
}


/**
 * The row a task becomes — the same shape createTask writes in the web app,
 * so a task set from the sidebar is indistinguishable on /tasks.
 */
function taskRow(draft, target) {
  return {
    deal_id: target.dealId || null,
    contact_id: target.contactId || null,
    organisation_id: target.organisationId || null,
    type: 'task',
    subject: draft.subject || null,
    notes: draft.notes || null,
    occurred_at: draft.nowIso,
    due_at: draft.dueAt,
    created_by: target.createdBy,
    gmail_message_id: null,
    gmail_thread_id: null,
  };
}
