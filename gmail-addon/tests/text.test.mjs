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
    ' formatCents, isQuoteBoundary, cleanBody, buildNote };',
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

// ---------- report ----------
for (const f of failures) console.error(`  FAIL  ${f}`)
console.log(`${passed} passed, ${failures.length} failed`)
process.exit(failures.length ? 1 : 0)
