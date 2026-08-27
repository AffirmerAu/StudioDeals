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

  var date = message.getDate();

  return {
    id: event.gmail.messageId,
    threadId: event.gmail.threadId,
    subject: message.getSubject(),
    from: message.getFrom(),
    to: message.getTo(),
    cc: message.getCc(),
    date: date,
    dateIso: date.toISOString(),
    dateText: messageDateText(date),
  };
}


/** The script timezone comes from appsscript.json, so this reads as Sydney
 *  time whichever machine pushed it. */
function messageDateText(date) {
  return Utilities.formatDate(date, Session.getScriptTimeZone(), 'd MMM yyyy, h:mm a');
}


/**
 * The body, fetched only when something is about to be filed. Every message
 * open would otherwise pay for text no card displays.
 */
function readMessageBody(event) {
  GmailApp.setCurrentMessageAccessToken(event.gmail.accessToken);
  return GmailApp.getMessageById(event.gmail.messageId).getPlainBody();
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
 * Asks the deployment a question the documentation cannot answer from here:
 * under the current-message scope, how much of the open thread can actually
 * be read?
 *
 * `readable` is the number of messages whose body came back. If it is 1 on a
 * thread of several, "Save whole thread" is not buildable without widening to
 * gmail.readonly — which is the whole mailbox, and a decision rather than a
 * detail. Shown in the Diagnostics section until the first deploy settles it.
 */
function probeThreadAccess(event) {
  try {
    GmailApp.setCurrentMessageAccessToken(event.gmail.accessToken);
    var messages = GmailApp.getMessageById(event.gmail.messageId).getThread().getMessages();

    var readable = 0;
    for (var i = 0; i < messages.length; i++) {
      try {
        messages[i].getPlainBody();
        readable++;
      } catch (ignored) {
        // This message is in the thread but not ours to read.
      }
    }
    return { total: messages.length, readable: readable, error: null };
  } catch (err) {
    return { total: 0, readable: 0, error: String(err && err.message ? err.message : err) };
  }
}
