/**
 * Entry points. Everything Gmail calls by name from appsscript.json lives
 * here, and nothing else does.
 */


/** Reads a form value, from either shape the platform might hand us. */
function formValue(event, name) {
  var common = event && event.commonEventObject;
  if (common && common.formInputs && common.formInputs[name]) {
    var input = common.formInputs[name].stringInputs;
    if (input && input.value && input.value.length) return input.value[0];
  }
  if (event && event.formInput && event.formInput[name] != null) return event.formInput[name];
  return '';
}


/** The sidebar with no message open. */
function onHomepage(event) {
  if (!hasStoredSession()) return signInCard(null);

  var section = CardService.newCardSection()
    .addWidget(
      CardService.newTextParagraph().setText(
        'Open an email and StudioDeals will show you who it is from.',
      ),
    )
    .addWidget(CardService.newButtonSet().addButton(textButton('Sign out', 'handleSignOut')));

  if (CONFIG.APP_BASE_URL) {
    section.addWidget(CardService.newButtonSet().addButton(appLink('Open StudioDeals', '/')));
  }

  return CardService.newCardBuilder()
    .setHeader(CardService.newCardHeader().setTitle('StudioDeals'))
    .addSection(section)
    .build();
}


/** The contextual trigger: fires every time a message is opened. */
function onGmailMessage(event) {
  if (!hasStoredSession()) return signInCard(null);

  try {
    return buildMessageCard(event);
  } catch (err) {
    if (err.name === 'AuthRequiredError') return signInCard(err.message);
    return errorCard(err);
  }
}


/**
 * Shared by the trigger and by the sign-in handler, so signing in lands you
 * on the card you were trying to reach rather than on a dead end.
 */
function buildMessageCard(event) {
  var message = readOpenMessage(event);
  var address = pickCounterparty(message, myEmailAddress());
  var contacts = address ? findContactsByEmail(address.email) : [];

  return messageCard({
    message: message,
    address: address,
    contacts: contacts,
    threadProbe: CONFIG.DEBUG ? probeThreadAccess(event) : { total: 0, readable: 0, error: null },
  });
}


function handleSignIn(event) {
  var email = String(formValue(event, 'email')).trim();
  var password = String(formValue(event, 'password'));

  if (!email || !password) {
    return replaceWith(signInCard('Enter both an email and a password.'));
  }

  try {
    signIn(email, password);
  } catch (err) {
    return replaceWith(signInCard(err.message));
  }

  var next;
  try {
    // A sign-in from the contextual card carries the message with it; one
    // from the homepage does not.
    next = event && event.gmail && event.gmail.messageId ? buildMessageCard(event) : onHomepage(event);
  } catch (err) {
    next = errorCard(err);
  }

  return CardService.newActionResponseBuilder()
    .setNavigation(CardService.newNavigation().updateCard(next))
    .setNotification(CardService.newNotification().setText('Signed in to StudioDeals'))
    .build();
}


/** An action parameter, from either shape the platform might hand us. */
function actionParam(event, name) {
  var common = event && event.commonEventObject;
  if (common && common.parameters && common.parameters[name] != null) return common.parameters[name];
  if (event && event.parameters && event.parameters[name] != null) return event.parameters[name];
  return '';
}


/** The one contact this address resolves to, re-read rather than carried
 *  across the action so the card never files against a stale record. */
function contactFor(contactId) {
  var rows = apiFetch(contactPath(contactId), {});
  if (!rows.length) throw new Error('That contact is no longer in StudioDeals.');
  return rows[0];
}


function handleShowSave(event) {
  try {
    var contact = contactFor(actionParam(event, 'contactId'));
    return CardService.newActionResponseBuilder()
      .setNavigation(
        CardService.newNavigation().pushCard(
          saveCard({
            message: readOpenMessage(event),
            thread: readThread(event),
            contact: contact,
            deals: listOpenDeals(contact.organisation_id),
          }),
        ),
      )
      .build();
  } catch (err) {
    return replaceWith(err.name === 'AuthRequiredError' ? signInCard(err.message) : errorCard(err));
  }
}


function handleSaveMessage(event) {
  try {
    var target = {
      contactId: actionParam(event, 'contactId'),
      organisationId: actionParam(event, 'organisationId'),
      dealId: String(formValue(event, 'dealId') || ''),
      createdBy: currentUserId(),
    };

    var thread = readThread(event);
    var wholeThread = String(formValue(event, 'scope') || '') === 'thread';

    var chosen = [];
    for (var i = 0; i < thread.messages.length; i++) {
      if (wholeThread || thread.messages[i].id === event.gmail.messageId) {
        chosen.push(thread.messages[i]);
      }
    }

    var held = findSavedMessageIds(thread.threadId);

    var rows = [];
    var skipped = 0;
    for (var k = 0; k < chosen.length; k++) {
      if (held[chosen[k].id]) skipped++;
      else rows.push(activityRow(chosen[k], target));
    }

    var written = fileActivities(rows);

    return CardService.newActionResponseBuilder()
      .setNavigation(
        CardService.newNavigation().updateCard(
          saveResultCard({
            filed: written.filed,
            skipped: skipped + written.duplicates,
            target: describeTarget(target),
            dealId: target.dealId,
            contactId: target.contactId,
          }),
        ),
      )
      .setNotification(
        CardService.newNotification().setText(
          describeFiling(written.filed, skipped + written.duplicates),
        ),
      )
      .build();
  } catch (err) {
    return replaceWith(err.name === 'AuthRequiredError' ? signInCard(err.message) : errorCard(err));
  }
}


/** What the result card calls the thing it filed against. */
function describeTarget(target) {
  if (target.dealId) {
    var deals = listOpenDeals(target.organisationId);
    for (var i = 0; i < deals.length; i++) {
      if (deals[i].id === target.dealId) return deals[i].title;
    }
    return 'the deal';
  }
  var contact = contactFor(target.contactId);
  return [contact.first_name, contact.last_name].filter(Boolean).join(' ');
}


function handleSignOut(event) {
  signOut();
  return CardService.newActionResponseBuilder()
    .setNavigation(CardService.newNavigation().updateCard(signInCard(null)))
    .setNotification(CardService.newNotification().setText('Signed out'))
    .build();
}


function replaceWith(card) {
  return CardService.newActionResponseBuilder()
    .setNavigation(CardService.newNavigation().updateCard(card))
    .build();
}
