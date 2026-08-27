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


/** How much of the body goes into the note. Context, not an archive. */
var BODY_EXCERPT_LIMIT = 500;


/** The one contact this address resolves to, re-read rather than carried
 *  across the action so the card never files against a stale record. */
function contactFor(contactId) {
  var rows = apiFetch(
    '/v_contacts_list?select=*&id=eq.' + encodeURIComponent(contactId) + '&limit=1',
    {},
  );
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
    var contactId = actionParam(event, 'contactId');
    var organisationId = actionParam(event, 'organisationId');
    var dealId = String(formValue(event, 'dealId') || '');

    var message = readOpenMessage(event);
    var held = findSavedMessageIds([message.id]);

    var target;
    if (dealId) {
      var deals = listOpenDeals(organisationId);
      target = 'the deal';
      for (var i = 0; i < deals.length; i++) {
        if (deals[i].id === dealId) target = deals[i].title;
      }
    } else {
      var contact = contactFor(contactId);
      target = [contact.first_name, contact.last_name].filter(Boolean).join(' ');
    }

    if (!held[message.id]) {
      insertActivities([
        {
          deal_id: dealId || null,
          contact_id: contactId,
          organisation_id: organisationId || null,
          type: 'email',
          subject: message.subject || null,
          notes: buildNote(message, readMessageBody(event), BODY_EXCERPT_LIMIT),
          occurred_at: message.dateIso,
          created_by: currentUserId(),
          gmail_message_id: message.id,
          gmail_thread_id: message.threadId || null,
        },
      ]);
    }

    var result = {
      alreadyHeld: !!held[message.id],
      target: target,
      dealId: dealId,
      contactId: contactId,
    };

    return CardService.newActionResponseBuilder()
      .setNavigation(CardService.newNavigation().updateCard(saveResultCard(result)))
      .setNotification(
        CardService.newNotification().setText(result.alreadyHeld ? 'Already filed' : 'Filed'),
      )
      .build();
  } catch (err) {
    return replaceWith(err.name === 'AuthRequiredError' ? signInCard(err.message) : errorCard(err));
  }
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
