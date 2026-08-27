/**
 * Card builders. Nothing in here writes to StudioDeals — this step of the
 * add-on reads, and only reads.
 */

function brandedCard() {
  return CardService.newCardBuilder();
}


function textButton(label, functionName) {
  return CardService.newTextButton()
    .setText(label)
    .setOnClickAction(CardService.newAction().setFunctionName(functionName));
}


function appLink(label, path) {
  return CardService.newTextButton()
    .setText(label)
    .setOpenLink(CardService.newOpenLink().setUrl(CONFIG.APP_BASE_URL + path));
}


// ---------------------------------------------------------------- sign in

function signInCard(errorMessage) {
  var section = CardService.newCardSection();

  if (errorMessage) {
    section.addWidget(
      CardService.newTextParagraph().setText('<b>' + truncate(errorMessage, 200) + '</b>'),
    );
  }

  section.addWidget(
    CardService.newTextParagraph().setText(
      'Sign in with your StudioDeals account. The add-on keeps a refresh ' +
        'token on this device only — your password is not stored.',
    ),
  );

  section.addWidget(
    CardService.newTextInput().setFieldName('email').setTitle('Email').setValue(myEmailAddress()),
  );

  // CardService has no masked input, so this field shows what you type.
  section.addWidget(
    CardService.newTextInput()
      .setFieldName('password')
      .setTitle('Password')
      .setHint('Not masked — CardService has no password field'),
  );

  section.addWidget(
    CardService.newButtonSet().addButton(
      textButton('Sign in', 'handleSignIn').setTextButtonStyle(CardService.TextButtonStyle.FILLED),
    ),
  );

  return brandedCard()
    .setHeader(CardService.newCardHeader().setTitle('StudioDeals'))
    .addSection(section)
    .build();
}


// ---------------------------------------------------------------- contact

function contactSection(contact, nowMs) {
  var section = CardService.newCardSection();

  section.addWidget(
    CardService.newDecoratedText()
      .setTopLabel('Organisation')
      .setText(contact.organisation_name || 'None')
      .setWrapText(true),
  );

  if (contact.role) {
    section.addWidget(CardService.newDecoratedText().setTopLabel('Role').setText(contact.role));
  }

  section.addWidget(
    CardService.newDecoratedText()
      .setTopLabel('Last contacted')
      .setText(describeLastContacted(contact.last_contacted_at, nowMs)),
  );

  var flags = [];
  if (contact.is_client) flags.push('Client');
  if (contact.is_stale) flags.push('Going cold');
  if (contact.is_primary) flags.push('Primary contact');
  if (flags.length) {
    section.addWidget(
      CardService.newDecoratedText().setTopLabel('Status').setText(flags.join(' · ')),
    );
  }

  var targetParams = {
    contactId: contact.id,
    organisationId: contact.organisation_id || '',
  };

  var buttons = CardService.newButtonSet()
    .addButton(
      CardService.newTextButton()
        .setText('File this email')
        .setTextButtonStyle(CardService.TextButtonStyle.FILLED)
        .setOnClickAction(
          CardService.newAction().setFunctionName('handleShowSave').setParameters(targetParams),
        ),
    )
    .addButton(
      CardService.newTextButton()
        .setText('Add task')
        .setOnClickAction(
          CardService.newAction().setFunctionName('handleShowTask').setParameters(targetParams),
        ),
    );
  if (CONFIG.APP_BASE_URL) {
    buttons.addButton(appLink('Open in StudioDeals', '/contacts/' + contact.id));
  }
  section.addWidget(buttons);

  return section;
}


// ------------------------------------------------------------------ filing

/**
 * Where to file it. The contact is settled by the time this card appears —
 * the only open question is whether the email belongs to a deal.
 */
function saveCard(context) {
  var contact = context.contact;
  var name = [contact.first_name, contact.last_name].filter(Boolean).join(' ');

  var picker = CardService.newSelectionInput()
    .setType(CardService.SelectionInputType.DROPDOWN)
    .setTitle('File against')
    .setFieldName('dealId');

  var deals = context.deals;
  // One open deal is almost always the right answer, so it starts selected.
  // Any other number and the contact alone is the safe default.
  var only = deals.length === 1;
  picker.addItem(name + ' only', '', !only);
  for (var i = 0; i < deals.length; i++) {
    picker.addItem(
      deals[i].title + ' · ' + deals[i].stage_label + ' · ' + formatCents(deals[i].value_cents),
      deals[i].id,
      only,
    );
  }

  var section = CardService.newCardSection()
    .addWidget(
      CardService.newDecoratedText()
        .setTopLabel('Subject')
        .setText(context.message.subject || '(no subject)')
        .setWrapText(true),
    )
    .addWidget(
      CardService.newDecoratedText().setTopLabel('Sent').setText(context.message.dateText),
    )
    .addWidget(picker);

  var thread = context.thread;
  if (thread.messages.length > 1) {
    section.addWidget(
      CardService.newSelectionInput()
        .setType(CardService.SelectionInputType.CHECK_BOX)
        .setFieldName('scope')
        .addItem('The whole thread — ' + thread.messages.length + ' messages', 'thread', false),
    );
    // Anything already filed is skipped on the way in, so ticking this a
    // second time after a reply arrives costs one row, not the whole thread.
    section.addWidget(
      CardService.newTextParagraph().setText('Messages already filed are skipped.'),
    );
  }

  if (thread.total > thread.messages.length) {
    section.addWidget(
      CardService.newTextParagraph().setText(
        '<b>' +
          thread.messages.length +
          ' of ' +
          thread.total +
          ' messages in this thread can be read.</b> The rest cannot be filed.',
      ),
    );
  }

  if (!deals.length) {
    section.addWidget(
      CardService.newTextParagraph().setText(
        'No open deals for ' + (contact.organisation_name || 'this organisation') + '.',
      ),
    );
  }

  section.addWidget(
    CardService.newButtonSet().addButton(
      CardService.newTextButton()
        .setText('File it')
        .setTextButtonStyle(CardService.TextButtonStyle.FILLED)
        .setOnClickAction(
          CardService.newAction().setFunctionName('handleSaveMessage').setParameters({
            contactId: contact.id,
            organisationId: contact.organisation_id || '',
          }),
        ),
    ),
  );

  return brandedCard()
    .setHeader(CardService.newCardHeader().setTitle('File this email').setSubtitle(name))
    .addSection(section)
    .build();
}


function saveResultCard(result) {
  var section = CardService.newCardSection()
    .addWidget(
      CardService.newDecoratedText()
        .setTopLabel('Filed against')
        .setText(result.target)
        .setWrapText(true),
    )
    .addWidget(CardService.newTextParagraph().setText(describeFiling(result.filed, result.skipped)))
    .addWidget(
      CardService.newTextParagraph().setText(
        result.filed
          ? 'Each one is on the timeline dated when it was sent, not when it was filed.'
          : 'Nothing was written twice.',
      ),
    );

  if (CONFIG.APP_BASE_URL && result.dealId) {
    section.addWidget(
      CardService.newButtonSet().addButton(appLink('Open the deal', '/deals/' + result.dealId)),
    );
  } else if (CONFIG.APP_BASE_URL && result.contactId) {
    section.addWidget(
      CardService.newButtonSet().addButton(appLink('Open the contact', '/contacts/' + result.contactId)),
    );
  }

  return brandedCard()
    .setHeader(CardService.newCardHeader().setTitle('StudioDeals'))
    .addSection(section)
    .build();
}


function unknownSenderSection(address) {
  var section = CardService.newCardSection();

  section.addWidget(
    CardService.newDecoratedText().setTopLabel('Email').setText(address.email).setWrapText(true),
  );
  section.addWidget(
    CardService.newTextParagraph().setText('Nobody in StudioDeals holds this address.'),
  );

  var buttons = CardService.newButtonSet().addButton(
    CardService.newTextButton()
      .setText('Create contact')
      .setTextButtonStyle(CardService.TextButtonStyle.FILLED)
      .setOnClickAction(
        CardService.newAction().setFunctionName('handleShowCreateContact').setParameters({
          email: address.email,
          name: address.name || '',
        }),
      ),
  );
  if (CONFIG.APP_BASE_URL) buttons.addButton(appLink('Open contacts', '/contacts'));
  section.addWidget(buttons);

  return section;
}


// -------------------------------------------------------- creating a contact

function createContactCard(context) {
  var guess = context.guess;
  var section = CardService.newCardSection()
    .addWidget(
      CardService.newTextInput().setFieldName('firstName').setTitle('First name').setValue(guess.first),
    )
    .addWidget(
      CardService.newTextInput().setFieldName('lastName').setTitle('Last name').setValue(guess.last),
    )
    .addWidget(CardService.newTextInput().setFieldName('role').setTitle('Role'));

  var picker = CardService.newSelectionInput()
    .setType(CardService.SelectionInputType.DROPDOWN)
    .setTitle('Organisation')
    .setFieldName('organisationId');

  var choices = context.organisations;
  var matched = choices.length > 0 && choices[0].matched;

  picker.addItem('— Create a new organisation —', NEW_ORGANISATION, !matched);
  picker.addItem('— None —', '', false);
  for (var i = 0; i < choices.length; i++) {
    picker.addItem(
      choices[i].name + (choices[i].matched ? ' · same email domain' : ''),
      choices[i].id,
      // Only an organisation someone at this domain already belongs to is
      // safe to preselect. Anything else would be a guess dressed as an answer.
      i === 0 && matched,
    );
  }
  section.addWidget(picker);

  section.addWidget(
    CardService.newTextInput()
      .setFieldName('newOrganisationName')
      .setTitle('New organisation name')
      .setHint('Used only when the dropdown says Create a new organisation')
      .setValue(context.suggestedOrganisation),
  );

  section.addWidget(
    CardService.newDecoratedText().setTopLabel('Email').setText(context.email).setWrapText(true),
  );

  section.addWidget(
    CardService.newButtonSet().addButton(
      CardService.newTextButton()
        .setText('Create')
        .setTextButtonStyle(CardService.TextButtonStyle.FILLED)
        .setOnClickAction(
          CardService.newAction().setFunctionName('handleCreateContact').setParameters({
            email: context.email,
          }),
        ),
    ),
  );

  return brandedCard()
    .setHeader(CardService.newCardHeader().setTitle('New contact').setSubtitle(context.email))
    .addSection(section)
    .build();
}


// ------------------------------------------------------------------- a task

function taskCard(context) {
  var section = CardService.newCardSection()
    .addWidget(
      CardService.newTextInput()
        .setFieldName('subject')
        .setTitle('Task')
        .setValue(context.suggestedSubject),
    )
    .addWidget(
      CardService.newDateTimePicker()
        .setFieldName('dueAt')
        .setTitle('Due')
        .setValueInMsSinceEpoch(context.defaultDueMs),
    )
    .addWidget(CardService.newTextInput().setFieldName('notes').setTitle('Notes').setMultiline(true));

  var deals = context.deals;
  if (deals.length) {
    var picker = CardService.newSelectionInput()
      .setType(CardService.SelectionInputType.DROPDOWN)
      .setTitle('Against')
      .setFieldName('dealId');
    var only = deals.length === 1;
    picker.addItem(context.contactName + ' only', '', !only);
    for (var i = 0; i < deals.length; i++) {
      picker.addItem(deals[i].title + ' · ' + deals[i].stage_label, deals[i].id, only);
    }
    section.addWidget(picker);
  }

  section.addWidget(
    CardService.newButtonSet().addButton(
      CardService.newTextButton()
        .setText('Add task')
        .setTextButtonStyle(CardService.TextButtonStyle.FILLED)
        .setOnClickAction(
          CardService.newAction().setFunctionName('handleAddTask').setParameters({
            contactId: context.contactId,
            organisationId: context.organisationId,
          }),
        ),
    ),
  );

  return brandedCard()
    .setHeader(CardService.newCardHeader().setTitle('New task').setSubtitle(context.contactName))
    .addSection(section)
    .build();
}


function doneCard(title, lines, link) {
  var section = CardService.newCardSection();
  for (var i = 0; i < lines.length; i++) {
    section.addWidget(
      CardService.newDecoratedText()
        .setTopLabel(lines[i].label)
        .setText(lines[i].value)
        .setWrapText(true),
    );
  }
  if (link && CONFIG.APP_BASE_URL) {
    section.addWidget(CardService.newButtonSet().addButton(appLink(link.label, link.path)));
  }
  return brandedCard()
    .setHeader(CardService.newCardHeader().setTitle(title))
    .addSection(section)
    .build();
}


function severalContactsSection(contacts) {
  var section = CardService.newCardSection().setHeader(
    contacts.length + ' contacts share this address',
  );

  for (var i = 0; i < contacts.length; i++) {
    var c = contacts[i];
    var name = [c.first_name, c.last_name].filter(Boolean).join(' ');
    section.addWidget(
      CardService.newDecoratedText()
        .setText(name)
        .setBottomLabel(c.organisation_name || 'No organisation')
        .setWrapText(true),
    );
  }

  section.addWidget(
    CardService.newTextParagraph().setText(
      'Merging duplicates lives in the web app, under Contacts.',
    ),
  );
  return section;
}


// ------------------------------------------------------------ diagnostics

function diagnosticsSection(context) {
  var section = CardService.newCardSection()
    .setHeader('Diagnostics')
    .setCollapsible(true)
    .setNumUncollapsibleWidgets(0);

  section.addWidget(
    CardService.newDecoratedText()
      .setTopLabel('Looked up')
      .setText(context.address ? context.address.email : 'no address found')
      .setWrapText(true),
  );

  var probe = context.threadProbe;
  section.addWidget(
    CardService.newDecoratedText()
      .setTopLabel('Thread access')
      .setText(
        probe.error
          ? 'error: ' + truncate(probe.error, 120)
          : probe.readable + ' of ' + probe.total + ' messages readable',
      )
      .setWrapText(true),
  );

  section.addWidget(
    CardService.newDecoratedText().setTopLabel('Thread id').setText(context.message.threadId || '—'),
  );

  section.addWidget(
    CardService.newButtonSet().addButton(textButton('Sign out', 'handleSignOut')),
  );

  return section;
}


// ------------------------------------------------------------------ cards

function messageCard(context) {
  var contacts = context.contacts;
  var nowMs = Date.now();

  var title;
  var subtitle;
  if (contacts.length === 1) {
    title = [contacts[0].first_name, contacts[0].last_name].filter(Boolean).join(' ');
    subtitle = contacts[0].organisation_name || contacts[0].email || '';
  } else {
    title = displayNameFor(context.address);
    subtitle = contacts.length ? contacts.length + ' matches' : 'Not in StudioDeals';
  }

  var card = brandedCard().setHeader(
    CardService.newCardHeader().setTitle(title).setSubtitle(subtitle),
  );

  if (!context.address) {
    card.addSection(
      CardService.newCardSection().addWidget(
        CardService.newTextParagraph().setText('No email address to look up on this message.'),
      ),
    );
  } else if (contacts.length === 0) {
    card.addSection(unknownSenderSection(context.address));
  } else if (contacts.length === 1) {
    card.addSection(contactSection(contacts[0], nowMs));
  } else {
    card.addSection(severalContactsSection(contacts));
  }

  if (CONFIG.DEBUG) card.addSection(diagnosticsSection(context));

  return card.build();
}


function errorCard(error) {
  var section = CardService.newCardSection()
    .addWidget(
      CardService.newTextParagraph().setText(
        truncate(String(error && error.message ? error.message : error), 400),
      ),
    )
    .addWidget(CardService.newButtonSet().addButton(textButton('Sign out', 'handleSignOut')));

  return brandedCard()
    .setHeader(CardService.newCardHeader().setTitle('StudioDeals').setSubtitle('Something failed'))
    .addSection(section)
    .build();
}
