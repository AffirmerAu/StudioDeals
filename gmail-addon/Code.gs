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


/** The dropdown value that means "make one", rather than an id. */
var NEW_ORGANISATION = '__new__';

/** How far ahead a new task is dated before you change it. */
var DEFAULT_DUE_DAYS = 3;


/**
 * The date-time picker's value, in whichever shape the platform sends, along
 * with where it came from and what it said before interpretation.
 *
 * The raw number is carried because two different picks once stored the same
 * instant, which no interpretation of a correctly-read value can produce. When
 * a reading is impossible, stop reasoning about the formula and look at what
 * actually arrived.
 */
function dueAtValue(event) {
  var common = event && event.commonEventObject;

  // The zone the person is standing in, which is the one the clock face they
  // just read belongs to. The script's own zone stands in if the event is
  // quiet about it.
  var zone = (common && common.timeZone && common.timeZone.id) || null;

  if (common && common.formInputs && common.formInputs.dueAt) {
    var picked = common.formInputs.dueAt.dateTimeInput;
    if (picked && picked.msSinceEpoch != null) {
      return {
        iso: dueAtFromPicker(picked.msSinceEpoch, zone),
        raw: String(picked.msSinceEpoch),
        source: 'commonEventObject' + (picked.hasTime === false ? ' (date only)' : ''),
      };
    }
  }
  if (event && event.formInput && event.formInput.dueAt != null) {
    return {
      iso: dueAtFromPicker(event.formInput.dueAt, zone),
      raw: String(event.formInput.dueAt),
      source: 'formInput (legacy)',
    };
  }
  return { iso: null, raw: '—', source: 'nothing sent' };
}


// --------------------------------------------------------- create a contact

function handleShowCreateContact(event) {
  try {
    var email = actionParam(event, 'email');
    var domain = emailDomain(email);

    return CardService.newActionResponseBuilder()
      .setNavigation(
        CardService.newNavigation().pushCard(
          createContactCard({
            email: email,
            guess: splitDisplayName(actionParam(event, 'name'), email),
            organisations: organisationChoices(domain),
            suggestedOrganisation: organisationNameFromDomain(domain),
          }),
        ),
      )
      .build();
  } catch (err) {
    return replaceWith(err.name === 'AuthRequiredError' ? signInCard(err.message) : errorCard(err));
  }
}


function handleCreateContact(event) {
  try {
    var firstName = String(formValue(event, 'firstName')).trim();
    if (!firstName) {
      return replaceWith(errorCard(new Error('A first name is required.')));
    }

    var chosen = String(formValue(event, 'organisationId') || '');
    var organisationId = chosen === NEW_ORGANISATION ? '' : chosen;
    var organisationName = '';

    if (chosen === NEW_ORGANISATION) {
      var newName = String(formValue(event, 'newOrganisationName')).trim();
      if (!newName) {
        return replaceWith(errorCard(new Error('Name the new organisation, or pick None.')));
      }
      var created = createOrganisationNamed(newName);
      organisationId = created.id;
      organisationName = created.name;
    }

    var contact = createContactRow(
      contactRow({
        firstName: firstName,
        lastName: String(formValue(event, 'lastName')).trim(),
        role: String(formValue(event, 'role')).trim(),
        email: actionParam(event, 'email'),
        organisationId: organisationId,
      }),
    );

    var name = [contact.first_name, contact.last_name].filter(Boolean).join(' ');
    return CardService.newActionResponseBuilder()
      .setNavigation(
        CardService.newNavigation().updateCard(
          doneCard(
            'Contact created',
            [
              { label: 'Name', value: name },
              { label: 'Email', value: contact.email || '—' },
              { label: 'Organisation', value: organisationName || 'From the list' },
            ],
            { label: 'Open in StudioDeals', path: '/contacts/' + contact.id },
          ),
        ),
      )
      .setNotification(CardService.newNotification().setText(name + ' added'))
      .build();
  } catch (err) {
    return replaceWith(err.name === 'AuthRequiredError' ? signInCard(err.message) : errorCard(err));
  }
}


// ------------------------------------------------------------- add a task

function handleShowTask(event) {
  try {
    var contact = contactFor(actionParam(event, 'contactId'));
    var message = readOpenMessage(event);

    return CardService.newActionResponseBuilder()
      .setNavigation(
        CardService.newNavigation().pushCard(
          taskCard({
            contactId: contact.id,
            organisationId: contact.organisation_id || '',
            contactName: [contact.first_name, contact.last_name].filter(Boolean).join(' '),
            // The subject you are looking at is nearly always what the task is
            // about, and it is one tap to replace.
            suggestedSubject: message.subject ? 'Follow up: ' + message.subject : 'Follow up',
            defaultDueMs: Date.now() + DEFAULT_DUE_DAYS * 86400000,
            deals: listOpenDeals(contact.organisation_id),
          }),
        ),
      )
      .build();
  } catch (err) {
    return replaceWith(err.name === 'AuthRequiredError' ? signInCard(err.message) : errorCard(err));
  }
}


function handleAddTask(event) {
  try {
    var subject = String(formValue(event, 'subject')).trim();
    if (!subject) return replaceWith(errorCard(new Error('Give the task a name.')));

    var due = dueAtValue(event);
    if (!due.iso) {
      return replaceWith(errorCard(new Error('Pick a date and time. (' + due.source + ')')));
    }
    var dueAt = due.iso;

    var target = {
      contactId: actionParam(event, 'contactId'),
      organisationId: actionParam(event, 'organisationId'),
      dealId: String(formValue(event, 'dealId') || ''),
      createdBy: currentUserId(),
    };

    createTaskRow(
      taskRow(
        {
          subject: subject,
          notes: String(formValue(event, 'notes')).trim(),
          dueAt: dueAt,
          nowIso: new Date().toISOString(),
        },
        target,
      ),
    );

    return CardService.newActionResponseBuilder()
      .setNavigation(
        CardService.newNavigation().updateCard(
          doneCard(
            'Task added',
            taskResultLines(subject, dueAt, due),
            { label: 'Open tasks', path: '/tasks' },
          ),
        ),
      )
      .setNotification(CardService.newNotification().setText('Task added'))
      .build();
  } catch (err) {
    return replaceWith(err.name === 'AuthRequiredError' ? signInCard(err.message) : errorCard(err));
  }
}


/**
 * What the Task added card lists. Under DEBUG it also carries the raw picker
 * value and a handler timestamp, which together say whether a submission is
 * genuinely new or a stale card firing with the form state it was built with.
 */
function taskResultLines(subject, dueAt, due) {
  var lines = [
    { label: 'Task', value: subject },
    { label: 'Due', value: messageDateText(new Date(dueAt)) },
  ];
  if (CONFIG.DEBUG) {
    lines.push({ label: 'Picked (raw ms)', value: due.raw });
    lines.push({ label: 'Read from', value: due.source });
    lines.push({ label: 'Stored', value: dueAt });
    lines.push({ label: 'Handled at', value: messageDateText(new Date()) });
  }
  return lines;
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
