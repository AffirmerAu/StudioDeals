/**
 * Everything that touches Gmail.
 *
 * The add-on holds gmail.addons.current.message.readonly, which is temporary
 * access to the one message on screen — not the mailbox, and not (as far as
 * anything I can check from the build side says) the rest of the thread. The
 * access token arrives on the event and has to be handed to GmailApp before
 * any read.
 */

function readOpenMessage(event) {
  GmailApp.setCurrentMessageAccessToken(event.gmail.accessToken);
  var message = GmailApp.getMessageById(event.gmail.messageId);

  return describeMessage(message, message.getThread().getId(), false);
}


/**
 * One message as the CRM wants it.
 *
 * The thread id comes from GmailApp rather than from event.gmail.threadId,
 * and that is deliberate. The event's id arrives in Gmail's legacy form,
 * which is not the id GmailApp reports for the same conversation — filing one
 * message from the event and its siblings from the thread would scatter a
 * single conversation across two ids. One source, always.
 *
 * getPlainBody() is the call that fails on a message this deployment is not
 * allowed to read, so `withBody` is what makes a message readable or not.
 */
function describeMessage(message, threadId, withBody) {
  var date = message.getDate();
  var described = {
    id: message.getId(),
    threadId: threadId,
    subject: message.getSubject(),
    from: message.getFrom(),
    to: message.getTo(),
    cc: message.getCc(),
    date: date,
    dateIso: date.toISOString(),
    dateText: messageDateText(date),
  };
  if (withBody) described.body = message.getPlainBody();
  return described;
}


/**
 * Every message in the open thread that this deployment can actually read,
 * oldest first.
 *
 * Under gmail.addons.current.message.readonly the siblings do come through —
 * measured, not assumed, by the Diagnostics probe on a real four-message
 * thread. `total` is kept alongside so a thread that ever does come back
 * partial says so instead of quietly filing less than it claims.
 */
function readThread(event) {
  GmailApp.setCurrentMessageAccessToken(event.gmail.accessToken);
  var thread = GmailApp.getMessageById(event.gmail.messageId).getThread();
  var threadId = thread.getId();
  var messages = thread.getMessages();

  var readable = [];
  for (var i = 0; i < messages.length; i++) {
    try {
      readable.push(describeMessage(messages[i], threadId, true));
    } catch (ignored) {
      // In the thread, but not ours to read.
    }
  }

  readable.sort(function (a, b) {
    return a.date - b.date;
  });

  return { threadId: threadId, total: messages.length, messages: readable };
}


/** The script timezone comes from appsscript.json, so this reads as Sydney
 *  time whichever machine pushed it. */
function messageDateText(date) {
  return Utilities.formatDate(date, Session.getScriptTimeZone(), 'd MMM yyyy, h:mm a');
}



/** The signed-in user's own address, so the card can tell which side of the
 *  conversation to look up. */
function myEmailAddress() {
  try {
    var active = Session.getActiveUser().getEmail();
    if (active) return active;
  } catch (ignored) {
    // Falls through — some contexts withhold the active user.
  }
  try {
    return Session.getEffectiveUser().getEmail() || '';
  } catch (ignored) {
    return '';
  }
}


/**
 * The Diagnostics line. Kept after it answered its question, because a
 * deployment whose scope is later narrowed would show it here first.
 */
function probeThreadAccess(event) {
  try {
    var thread = readThread(event);
    return { total: thread.total, readable: thread.messages.length, error: null };
  } catch (err) {
    return { total: 0, readable: 0, error: String(err && err.message ? err.message : err) };
  }
}


/** The format pickerWallClock emits, in the Java syntax Utilities speaks. */
var PICKER_WALL_FORMAT = "yyyy-MM-dd'T'HH:mm:ss";


/**
 * The instant a picked date and time actually names.
 *
 * Utilities.parseDate resolves the wall clock inside the given zone, using the
 * offset in force *on that date* — which matters, because the first version of
 * this subtracted commonEventObject.timeZone.offset, the offset in force
 * today. A task set in September for a date in November would have been an
 * hour out when Sydney moved to daylight time, and nothing would have said so.
 */
function dueAtFromPicker(msSinceEpoch, timeZoneId) {
  var wall = pickerWallClock(msSinceEpoch);
  if (!wall) return null;

  var zone = timeZoneId || Session.getScriptTimeZone();
  return Utilities.parseDate(wall, zone, PICKER_WALL_FORMAT).toISOString();
}
