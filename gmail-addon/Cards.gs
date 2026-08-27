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

  var buttons = CardService.newButtonSet().addButton(
    CardService.newTextButton()
      .setText('File this email')
      .setTextButtonStyle(CardService.TextButtonStyle.FILLED)
      .setOnClickAction(
        CardService.newAction().setFunctionName('handleShowSave').setParameters({
          contactId: contact.id,
          organisationId: contact.organisation_id || '',
        }),
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
        .setTopLabel(result.alreadyHeld ? 'Already filed' : 'Filed against')
        .setText(result.target)
        .setWrapText(true),
    )
    .addWidget(
      CardService.newTextParagraph().setText(
        result.alreadyHeld
          ? 'StudioDeals already had this message, so nothing was written twice.'
          : 'It is on the timeline now, dated when it was sent.',
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
    CardService.newTextParagraph().setText(
      'Nobody in StudioDeals holds this address. Adding contacts from the ' +
        'sidebar comes in a later step.',
    ),
  );

  if (CONFIG.APP_BASE_URL) {
    section.addWidget(CardService.newButtonSet().addButton(appLink('Open contacts', '/contacts')));
  }
  return section;
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
