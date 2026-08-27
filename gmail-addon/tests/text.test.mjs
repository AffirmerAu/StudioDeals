/**
 * Runs Text.gs under Node. `node gmail-addon/tests/text.test.mjs`
 *
 * Text.gs has no Apps Script globals, so it evaluates as plain JavaScript and
 * hands its function declarations back through a Function wrapper. Nothing
 * else in the add-on can be tested off-platform.
 */
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const here = dirname(fileURLToPath(import.meta.url))
const src = readFileSync(join(here, '..', 'Text.gs'), 'utf8')

const T = new Function(
  src +
    '\nreturn { splitAddressList, parseAddress, parseAddressList, sameAddress,' +
    ' pickCounterparty, displayNameFor, describeLastContacted, truncate,' +
    ' formatCents, isQuoteBoundary, cleanBody, buildNote, describeFiling, activityRow,' +
    ' activitiesInThreadPath, openDealsPath, contactPath, stagesPath, urlSafe,' +
    ' isDuplicateError, emailDomain, splitDisplayName, organisationNameFromDomain,' +
    ' contactsByDomainPath, organisationsPath, dueAtFromPicker, contactRow, taskRow };',
)()

let passed = 0
const failures = []

function is(label, got, want) {
  const g = JSON.stringify(got)
  const w = JSON.stringify(want)
  if (g === w) {
    passed++
  } else {
    failures.push(`${label}\n      got  ${g}\n      want ${w}`)
  }
}

const ME = 'matt@affirmer.com.au'

// ---------- splitting ----------
is('a bare address', T.splitAddressList('jane@x.com'), ['jane@x.com'])
is(
  'a comma inside a quoted display name does not split',
  T.splitAddressList('"Cooper, Jane" <jane@x.com>, bob@y.com'),
  ['"Cooper, Jane" <jane@x.com>', 'bob@y.com'],
)
is('an empty header', T.splitAddressList(''), [])
is('a null header', T.splitAddressList(null), [])
is('trailing comma leaves no empty entry', T.splitAddressList('a@b.com, '), ['a@b.com'])

// ---------- parsing ----------
is('display name and angle brackets', T.parseAddress('Jane Cooper <Jane.Cooper@x.com>'), {
  name: 'Jane Cooper',
  email: 'Jane.Cooper@x.com',
})
is('quotes are stripped from the name', T.parseAddress('"Cooper, Jane" <jane@x.com>'), {
  name: 'Cooper, Jane',
  email: 'jane@x.com',
})
is('a bare address has no name', T.parseAddress('jane@x.com'), { name: '', email: 'jane@x.com' })
is('mailto: is dropped', T.parseAddress('Jane <mailto:jane@x.com>'), {
  name: 'Jane',
  email: 'jane@x.com',
})
is('something with no @ is not an address', T.parseAddress('Undisclosed recipients'), null)
is('an empty string is not an address', T.parseAddress(''), null)
is('parentheses survive in the name', T.parseAddress('Jane Cooper (Bluescope) <jane@x.com>'), {
  name: 'Jane Cooper (Bluescope)',
  email: 'jane@x.com',
})

// ---------- counterparty ----------
is(
  'an incoming email is with its sender',
  T.pickCounterparty({ from: 'Jane <jane@x.com>', to: ME, cc: '' }, ME),
  { name: 'Jane', email: 'jane@x.com' },
)
is(
  'an email I sent is with its recipient',
  T.pickCounterparty({ from: `Matt <${ME}>`, to: 'Jane <jane@x.com>', cc: '' }, ME),
  { name: 'Jane', email: 'jane@x.com' },
)
is(
  'my own address is skipped wherever it appears in To',
  T.pickCounterparty({ from: `Matt <${ME}>`, to: `${ME}, Jane <jane@x.com>`, cc: '' }, ME),
  { name: 'Jane', email: 'jane@x.com' },
)
is(
  'Cc is searched once To is exhausted',
  T.pickCounterparty({ from: `Matt <${ME}>`, to: ME, cc: 'Bob <bob@y.com>' }, ME),
  { name: 'Bob', email: 'bob@y.com' },
)
is(
  'case does not make me a stranger to myself',
  T.pickCounterparty({ from: 'Matt <MATT@Affirmer.com.au>', to: 'Jane <jane@x.com>', cc: '' }, ME),
  { name: 'Jane', email: 'jane@x.com' },
)
is(
  'an email to myself falls back to me rather than nothing',
  T.pickCounterparty({ from: `Matt <${ME}>`, to: ME, cc: '' }, ME),
  { name: 'Matt', email: ME },
)
is('a message with no addresses at all', T.pickCounterparty({ from: '', to: '', cc: '' }, ME), null)

// ---------- display ----------
is('a name is preferred', T.displayNameFor({ name: 'Jane Cooper', email: 'j@x.com' }), 'Jane Cooper')
is('the address stands in for a missing name', T.displayNameFor({ name: '', email: 'j@x.com' }), 'j@x.com')
is('nothing at all', T.displayNameFor(null), 'Unknown sender')

// ---------- last contacted ----------
const NOW = Date.parse('2026-08-27T02:00:00Z')
is('null is never', T.describeLastContacted(null, NOW), 'never')
is('unparseable is never', T.describeLastContacted('not a date', NOW), 'never')
is('earlier the same day', T.describeLastContacted('2026-08-27T00:30:00Z', NOW), 'today')
is('the day before', T.describeLastContacted('2026-08-26T23:59:00Z', NOW), 'yesterday')
is('a week', T.describeLastContacted('2026-08-20T02:00:00Z', NOW), '7 days ago')
is('two months', T.describeLastContacted('2026-06-20T02:00:00Z', NOW), '2 months ago')
is('three years', T.describeLastContacted('2023-08-27T02:00:00Z', NOW), '3 years ago')
is('a future date reads as today, not as a negative', T.describeLastContacted('2026-09-01T02:00:00Z', NOW), 'today')

// ---------- truncation ----------
is('short text is left alone', T.truncate('hello', 10), 'hello')
is('exactly the limit is left alone', T.truncate('hello', 5), 'hello')
is('longer text gets an ellipsis', T.truncate('hello world', 8), 'hello w…')
is('null truncates to nothing', T.truncate(null, 8), '')

// ---------- money ----------
is('whole thousands', T.formatCents(4200000), '$42,000')
is('under a thousand', T.formatCents(85000), '$850')
is('exactly a million', T.formatCents(100000000), '$1,000,000')
is('zero', T.formatCents(0), '$0')
is('cents round to the nearest dollar', T.formatCents(4249), '$42')
is('and round up', T.formatCents(4250), '$43')
is('negative', T.formatCents(-150000), '-$1,500')
is('null is nothing, not NaN', T.formatCents(null), '$0')

// ---------- quoted history ----------
is('a Gmail attribution ends the body', T.isQuoteBoundary('On Mon, 24 Aug 2026 at 17:06, Kieran Jessup <k@w.com.au> wrote:', ''), true)
is('a wrapped attribution ends it too', T.isQuoteBoundary('On Mon, 24 Aug 2026 at 17:06, Kieran Jessup', '<kieran@whittensgroup.com.au> wrote:'), true)
is('an Outlook original-message rule', T.isQuoteBoundary('-----Original Message-----', ''), true)
is('an Outlook divider', T.isQuoteBoundary('________________________________', ''), true)
is('a forwarded header needs its second line', T.isQuoteBoundary('From: Kieran Jessup', 'Sent: Monday, 24 August 2026'), true)
is('a bare From: line in prose does not', T.isQuoteBoundary('From: the top of the scaffold, you can see...', 'the whole site.'), false)
is('ordinary prose starting with On does not', T.isQuoteBoundary('On site next Tuesday, we will need three cameras.', 'Let me know.'), false)

is(
  'quoted lines are dropped and the history is cut',
  T.cleanBody(
    'Thanks Matt, that works.\n\nKieran\n\nOn Mon, 24 Aug 2026 at 09:00, Matt <matt@affirmer.com.au> wrote:\n> Are you free Thursday?\n> Matt',
  ),
  'Thanks Matt, that works.\n\nKieran',
)
is('runs of blank lines collapse', T.cleanBody('One\n\n\n\n\nTwo'), 'One\n\nTwo')
is('CRLF is normalised', T.cleanBody('One\r\nTwo\r\n'), 'One\nTwo')
is('surrounding whitespace goes, both ends', T.cleanBody('  Hello   \n   '), 'Hello')
is('an empty body stays empty', T.cleanBody(''), '')
is('a body that is only quoted history is empty', T.cleanBody('> everything\n> was quoted'), '')

// ---------- the note ----------
const HEADERS = {
  from: 'Kieran Jessup <KieranJessup@whittensgroup.com.au>',
  to: 'matt@affirmer.com.au',
  cc: '',
  dateText: '24 Aug 2026, 5:06 pm',
}
is(
  'headers then a blank line then the excerpt',
  T.buildNote(HEADERS, 'Happy with the storyboard.', 500),
  'From: Kieran Jessup <KieranJessup@whittensgroup.com.au>\nTo: matt@affirmer.com.au\nDate: 24 Aug 2026, 5:06 pm\n\nHappy with the storyboard.',
)
is(
  'an empty Cc is omitted rather than left blank',
  T.buildNote(HEADERS, '', 500).includes('Cc:'),
  false,
)
is(
  'a Cc is kept when there is one',
  T.buildNote({ ...HEADERS, cc: 'james@affirmer.com.au' }, 'x', 500).includes('Cc: james@affirmer.com.au'),
  true,
)
is(
  'a long body is truncated with an ellipsis',
  T.buildNote(HEADERS, 'x'.repeat(600), 500).endsWith('x…'),
  true,
)
is(
  'a body with nothing left after cleaning leaves headers alone',
  T.buildNote(HEADERS, '> only quotes', 500),
  'From: Kieran Jessup <KieranJessup@whittensgroup.com.au>\nTo: matt@affirmer.com.au\nDate: 24 Aug 2026, 5:06 pm',
)

// ---------- what the card says it did ----------
is('one message', T.describeFiling(1, 0), '1 message filed.')
is('several', T.describeFiling(3, 0), '3 messages filed.')
is('some new, some held', T.describeFiling(1, 2), '1 message filed, 2 already held.')
is('one already held', T.describeFiling(0, 1), 'Already filed.')
is('all already held', T.describeFiling(0, 4), 'All 4 already filed.')
is('nothing at all', T.describeFiling(0, 0), 'Nothing to file.')

// ---------- the row that reaches the CRM ----------
const MSG = {
  id: '18f2a9c4b1',
  threadId: 'thread-a:r-7012497993290584413',
  subject: 'Re: Komms Essential Rules',
  from: 'Kieran Jessup <kieranjessup@whittensgroup.com.au>',
  to: 'matt@affirmer.com.au',
  cc: '',
  dateText: '17 Aug 2026, 11:39 am',
  dateIso: '2026-08-17T01:39:00.000Z',
  body: 'Hi Matt,\n\nLeave it with me.\n\nOn Mon, 17 Aug 2026, Matt wrote:\n> anything?',
}
const TARGET = {
  contactId: 'aaaa-1111',
  organisationId: 'bbbb-2222',
  dealId: 'dddd-3333',
  createdBy: 'user-9999',
}

const row = T.activityRow(MSG, TARGET)
is('it is always an email', row.type, 'email')
is('occurred_at is the message date, never now()', row.occurred_at, MSG.dateIso)
is('the gmail ids travel with it', [row.gmail_message_id, row.gmail_thread_id], [MSG.id, MSG.threadId])
is('a filed email has no due date', row.due_at, null)
is('the target is carried through', [row.deal_id, row.contact_id, row.organisation_id],
  [TARGET.dealId, TARGET.contactId, TARGET.organisationId])
is('the author is the token subject', row.created_by, TARGET.createdBy)
is('the quoted history did not make it into the note', row.notes.includes('anything?'), false)
is('but the message did', row.notes.includes('Leave it with me.'), true)
is(
  'a missing deal is null, not an empty string',
  T.activityRow(MSG, { ...TARGET, dealId: '' }).deal_id,
  null,
)
is(
  'a missing subject is null, not "(no subject)"',
  T.activityRow({ ...MSG, subject: '' }, TARGET).subject,
  null,
)
is(
  'every row has the same keys, whatever is missing',
  Object.keys(T.activityRow({ ...MSG, subject: '', cc: '' }, { ...TARGET, dealId: '' })),
  Object.keys(row),
)

// ---------- URLs UrlFetchApp will actually accept ----------
// The bug this guards: gmail_message_id=in.("a","b") was refused outright
// with "Invalid argument" — double quotes are not legal in a URL.
const REAL_THREAD = 'thread-a:r-7012497993290584413'
const REAL_MESSAGE = 'msg-a:r-5774944992509933697'

is(
  'the thread filter encodes its colon',
  T.activitiesInThreadPath(REAL_THREAD),
  '/activities?select=gmail_message_id&gmail_thread_id=eq.thread-a%3Ar-7012497993290584413',
)
is('and is URL-safe', T.urlSafe(T.activitiesInThreadPath(REAL_THREAD)), true)
is('the stages path is URL-safe', T.urlSafe(T.stagesPath()), true)
is('stages are ordered by position, never hardcoded',
  T.stagesPath().includes('order=position'), true)
is('a uuid organisation is URL-safe',
  T.urlSafe(T.openDealsPath('11111111-1111-1111-1111-111111111111')), true)
is('a uuid contact is URL-safe',
  T.urlSafe(T.contactPath('aaaaaaaa-0000-0000-0000-000000000001')), true)
is('no path quotes anything', [T.activitiesInThreadPath(REAL_MESSAGE), T.openDealsPath('x'), T.contactPath('y')]
  .some((p) => p.includes('"')), false)

// urlSafe has to be able to fail, or it is not a check.
is('a quote is not URL-safe', T.urlSafe('/activities?id=in.("a")'), false)
is('a space is not URL-safe', T.urlSafe('/activities?subject=eq.hello world'), false)
is('a bracket is not URL-safe', T.urlSafe('/activities?id=eq.[1]'), false)
is('an encoded quote is fine', T.urlSafe('/activities?id=eq.%22a%22'), true)

// ---------- telling a collision from a failure ----------
is('a 409 from PostgREST', T.isDuplicateError(new Error('StudioDeals 409: duplicate key value')), true)
is('the SQLSTATE alone', T.isDuplicateError(new Error('code 23505 on activities')), true)
is('a 400 is not a collision', T.isDuplicateError(new Error('StudioDeals 400: bad filter')), false)
is('a 401 is not a collision', T.isDuplicateError(new Error('StudioDeals 401: JWT expired')), false)
is(
  'a subject containing 409 does not look like one',
  T.isDuplicateError(new Error('StudioDeals 400: subject "Invoice 409" rejected')),
  false,
)
is('a plain string error', T.isDuplicateError('StudioDeals 409: duplicate'), true)
is('nothing at all', T.isDuplicateError(null), false)

// ---------- domains ----------
is('an ordinary address', T.emailDomain('kieranjessup@whittensgroup.com.au'), 'whittensgroup.com.au')
is('case is normalised', T.emailDomain('Kieran@Whittens.COM.AU'), 'whittens.com.au')
is('a plus tag does not confuse it', T.emailDomain('matt+crm@affirmer.com.au'), 'affirmer.com.au')
is('no @ means no domain', T.emailDomain('not an address'), '')
is('null means no domain', T.emailDomain(null), '')

// ---------- names ----------
is('a display name splits', T.splitDisplayName('Kieran Jessup', 'k@x.com'), { first: 'Kieran', last: 'Jessup' })
is('a middle name stays with the surname',
  T.splitDisplayName('Anna Maria Ferreira', 'a@x.com'), { first: 'Anna', last: 'Maria Ferreira' })
is('surname-first is un-inverted',
  T.splitDisplayName('Cooper, Jane', 'j@x.com'), { first: 'Jane', last: 'Cooper' })
is('one word is a first name', T.splitDisplayName('Kieran', 'k@x.com'), { first: 'Kieran', last: '' })
is('no display name falls back to the local part',
  T.splitDisplayName('', 'kieran.jessup@whittensgroup.com.au'), { first: 'Kieran', last: 'Jessup' })
is('underscores work too', T.splitDisplayName('', 'kieran_jessup@x.com'), { first: 'Kieran', last: 'Jessup' })
is('digits are dropped from a local part', T.splitDisplayName('', 'kieran.jessup2@x.com'),
  { first: 'Kieran', last: 'Jessup' })
is('an opaque local part is still a first name',
  T.splitDisplayName('', 'info@x.com'), { first: 'Info', last: '' })
is('nothing usable still yields a first name, because the column is NOT NULL',
  T.splitDisplayName('', '').first.length > 0, true)

// ---------- organisation name from a domain ----------
is('the noise labels go', T.organisationNameFromDomain('whittensgroup.com.au'), 'Whittensgroup')
is('a noise word standing alone as a label does go',
  T.organisationNameFromDomain('whittens.group.au'), 'Whittens')
is('a hyphen becomes a space', T.organisationNameFromDomain('blue-scope.com.au'), 'Blue Scope')
is('a plain .com', T.organisationNameFromDomain('downer.com'), 'Downer')
is('a subdomain is kept', T.organisationNameFromDomain('safety.downer.com'), 'Safety Downer')
is('all-noise does not come back empty', T.organisationNameFromDomain('com.au'), 'Com')
is('nothing at all', T.organisationNameFromDomain(''), '')

// ---------- paths ----------
is('the domain lookup is URL-safe',
  T.urlSafe(T.contactsByDomainPath('whittensgroup.com.au')), true)
is('it only asks for contacts that have an organisation',
  T.contactsByDomainPath('x.com').includes('organisation_id=not.is.null'), true)
is('the organisations list is ordered by name',
  T.organisationsPath().includes('order=name'), true)

// ---------- the picker's timezone ----------
// 5pm on 27 August 2026 in Sydney is 07:00 UTC. The picker reports the wall
// time as though it were UTC, so the offset has to come back off.
const SYDNEY_OFFSET = 10 * 3600000
is('a Sydney afternoon lands at the right instant',
  T.dueAtFromPicker(Date.UTC(2026, 7, 27, 17, 0), SYDNEY_OFFSET), '2026-08-27T07:00:00.000Z')
is('no offset leaves the value alone',
  T.dueAtFromPicker(Date.UTC(2026, 7, 27, 17, 0), 0), '2026-08-27T17:00:00.000Z')
is('a missing offset is treated as zero',
  T.dueAtFromPicker(Date.UTC(2026, 7, 27, 17, 0), undefined), '2026-08-27T17:00:00.000Z')
is('nothing picked is null', T.dueAtFromPicker(null, SYDNEY_OFFSET), null)
is('an empty string is null, not 1970', T.dueAtFromPicker('', SYDNEY_OFFSET), null)
is('undefined is null too', T.dueAtFromPicker(undefined, SYDNEY_OFFSET), null)
is('rubbish is null', T.dueAtFromPicker('later', SYDNEY_OFFSET), null)

// ---------- the rows ----------
const newContact = T.contactRow({
  firstName: 'Kieran', lastName: 'Jessup', role: 'National HSE Manager',
  email: 'kieranjessup@whittensgroup.com.au', organisationId: 'o-1',
})
is('the contact carries what was typed',
  [newContact.first_name, newContact.last_name, newContact.role, newContact.organisation_id],
  ['Kieran', 'Jessup', 'National HSE Manager', 'o-1'])
is('blank fields are null, not empty strings',
  T.contactRow({ firstName: 'Kieran', lastName: '', role: '', email: '', organisationId: '' }),
  { organisation_id: null, first_name: 'Kieran', last_name: null, role: null, email: null,
    phone: null, notes: null })

const newTask = T.taskRow(
  { subject: 'Chase the KOMS decision', notes: '', dueAt: '2026-08-30T07:00:00.000Z',
    nowIso: '2026-08-27T02:00:00.000Z' },
  { contactId: 'c-1', organisationId: 'o-1', dealId: 'd-1', createdBy: 'u-1' },
)
is('a task is a task', newTask.type, 'task')
is('due is when it is due', newTask.due_at, '2026-08-30T07:00:00.000Z')
is('occurred_at is when it was raised', newTask.occurred_at, '2026-08-27T02:00:00.000Z')
is('a task carries no gmail ids', [newTask.gmail_message_id, newTask.gmail_thread_id], [null, null])
is('empty notes are null', newTask.notes, null)
is('a task and a filed email agree about their columns',
  Object.keys(newTask), Object.keys(row))

// ---------- report ----------
for (const f of failures) console.error(`  FAIL  ${f}`)
console.log(`${passed} passed, ${failures.length} failed`)
process.exit(failures.length ? 1 : 0)
