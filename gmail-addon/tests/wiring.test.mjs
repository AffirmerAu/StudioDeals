/**
 * Structural checks over the .gs sources. `node gmail-addon/tests/wiring.test.mjs`
 *
 * Apps Script resolves every name at runtime, in one shared global scope, on
 * a platform this repo cannot reach. A function Gmail is told to call by name
 * — from the manifest, or from setFunctionName — that does not exist fails
 * only when a user clicks it. So the names get checked here instead.
 */
import { readFileSync, readdirSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const addon = join(dirname(fileURLToPath(import.meta.url)), '..')
const files = readdirSync(addon).filter((f) => f.endsWith('.gs'))
const sources = new Map(files.map((f) => [f, readFileSync(join(addon, f), 'utf8')]))
const all = [...sources.values()].join('\n')
const stripComments = (src) => src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/[^\n]*/g, '')
const code = stripComments(all)
const manifest = JSON.parse(readFileSync(join(addon, 'appsscript.json'), 'utf8'))

const failures = []
let passed = 0

function check(label, ok, detail) {
  if (ok) passed++
  else failures.push(`${label}${detail ? `\n      ${detail}` : ''}`)
}

// ---- what exists ----
const defined = new Set()
for (const src of sources.values()) {
  // Not anchored to the line start: a helper assigned to a local var inside
  // another function is still a name that has to resolve.
  for (const m of src.matchAll(/\bfunction\s+([A-Za-z0-9_$]+)\s*\(/g)) defined.add(m[1])
  for (const m of src.matchAll(/\bvar\s+([A-Za-z0-9_$]+)\s*=/g)) defined.add(m[1])
}

// ---- names Gmail calls by string ----
const byName = [
  manifest.addOns.common.homepageTrigger.runFunction,
  ...manifest.addOns.gmail.contextualTriggers.map((t) => t.onTriggerFunction),
  ...[...all.matchAll(/setFunctionName\(\s*'([^']+)'\s*\)/g)].map((m) => m[1]),
]
for (const name of new Set(byName)) {
  check(`Gmail calls ${name}() by name and it exists`, defined.has(name), `not defined in any .gs`)
}

// ---- every call resolves to something ----
// Anything on the platform, plus JS itself. A name here that is neither
// defined locally nor listed is almost certainly a typo.
const platform = new Set([
  'CardService', 'GmailApp', 'PropertiesService', 'CacheService', 'LockService',
  'Session', 'UrlFetchApp', 'Utilities', 'Logger', 'console',
  'JSON', 'Date', 'Math', 'Number', 'String', 'Object', 'Array', 'Error', 'Boolean',
  'isNaN', 'parseInt', 'parseFloat', 'Function', 'RegExp', 'encodeURIComponent',
  'if', 'for', 'while', 'switch', 'catch', 'return', 'typeof', 'function', 'new',
])
const unresolved = new Set()
for (const [file, src] of sources) {
  const body = stripComments(src)
  for (const m of body.matchAll(/(^|[^.\w$'"])([A-Za-z_$][A-Za-z0-9_$]*)\s*\(/g)) {
    const name = m[2]
    if (!defined.has(name) && !platform.has(name)) unresolved.add(`${name} (${file})`)
  }
}
check('every call resolves to a defined function or a platform global', unresolved.size === 0,
  [...unresolved].join(', '))

// ---- clasp pushes exactly the sources ----
const claspignore = readFileSync(join(addon, '.claspignore'), 'utf8')
const kept = new Set([...claspignore.matchAll(/^!(.+)$/gm)].map((m) => m[1].trim()))
for (const f of files) check(`.claspignore pushes ${f}`, kept.has(f), 'missing a ! line')
check('.claspignore pushes appsscript.json', kept.has('appsscript.json'))
check('.claspignore lists nothing that is gone',
  [...kept].every((k) => k === 'appsscript.json' || files.includes(k)),
  [...kept].filter((k) => k !== 'appsscript.json' && !files.includes(k)).join(', '))

// ---- the clasp config example stays usable ----
// .clasp.json is gitignored because clasp rewrites it, so a fresh clone has
// nothing to push with until this file is copied over it.
const example = JSON.parse(readFileSync(join(addon, '.clasp.json.example'), 'utf8'))
check('the example carries a script id', /^[A-Za-z0-9_-]{20,}$/.test(example.scriptId || ''),
  JSON.stringify(example.scriptId))
check('the example points clasp at this directory', example.rootDir === '.', example.rootDir)
check('.clasp.json is gitignored',
  readFileSync(join(addon, '..', '.gitignore'), 'utf8').includes('gmail-addon/.clasp.json'))
check('.claspignore keeps the example local', !kept.has('.clasp.json.example'))

// ---- the things that must never be true ----
// Against the code, not the comments — Config.gs says the words "service_role
// key" precisely to forbid it.
check('no service_role key anywhere', !/service_role/.test(code))
check('the schema is crm, not public', manifest && /SCHEMA:\s*'crm'/.test(sources.get('Config.gs')))
check('urlFetchWhitelist covers the Supabase host',
  manifest.urlFetchWhitelist.some((u) => sources.get('Config.gs').includes(u.replace(/\/$/, ''))),
  `whitelist ${JSON.stringify(manifest.urlFetchWhitelist)} does not match SUPABASE_URL`)
check('the message scope is the narrow one',
  manifest.oauthScopes.includes('https://www.googleapis.com/auth/gmail.addons.current.message.readonly') &&
  !manifest.oauthScopes.some((s) => s.endsWith('/auth/gmail.readonly')),
  JSON.stringify(manifest.oauthScopes))
// Filing emails is step 3, so writes exist now. What must stay true is that
// the only table written to is activities, and that every row carries the id
// that makes a second Save a no-op rather than a duplicate.
const writes = [...sources.get('Api.gs').matchAll(/apiFetch\(\s*'([^']+)'[^)]*method:\s*'post'/gs)]
  .map((m) => m[1].split('?')[0])
check('the only write path is /activities',
  writes.every((p) => p === '/activities' || p.startsWith('/rpc/')), writes.join(', '))
check('every filed row carries its gmail_message_id',
  /gmail_message_id:\s*message\.id/.test(sources.get('Text.gs')))
check('filing reads before it writes',
  sources.get('Code.gs').indexOf('findSavedMessageIds') <
    sources.get('Code.gs').indexOf('insertActivities'))
check('occurred_at is the message date, never now()',
  /occurred_at:\s*message\.dateIso/.test(sources.get('Text.gs')))
// The event's thread id is Gmail's legacy form and does not match the one
// GmailApp reports, so filing must never mix the two sources.
check('the stored thread id comes from GmailApp, not the event',
  !/gmail_thread_id[\s\S]{0,80}event\.gmail\.threadId/.test(all) &&
  /threadId:\s*threadId/.test(sources.get('Message.gs')))
check('Text.gs stays free of Apps Script globals, or Node cannot test it',
  !/\b(CardService|GmailApp|UrlFetchApp|PropertiesService|CacheService|LockService|Session|Utilities)\b/
    .test(stripComments(sources.get('Text.gs'))))
check('money is never parsed out of a string',
  !/parseFloat|Number\(.*\$/.test(sources.get('Text.gs')))

for (const f of failures) console.error(`  FAIL  ${f}`)
console.log(`${passed} passed, ${failures.length} failed`)
process.exit(failures.length ? 1 : 0)
