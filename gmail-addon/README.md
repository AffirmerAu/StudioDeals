# StudioDeals for Gmail

A Google Workspace add-on. Open an email and the sidebar tells you who the
sender is in StudioDeals — their organisation, when you last spoke, whether
they are going cold.

Filing an email writes one `crm.activities` row against a deal, or against
the contact alone — dated when the message was sent, carrying enough of the
body to recognise it later, and with the Gmail ids that make a second File It
a no-op instead of a duplicate.

Ticking **the whole thread** files every message in the conversation at once,
skipping any already held — so after a reply arrives, filing again costs one
row rather than the whole thread over again.

An unknown sender gets a **Create contact** card, and any known contact gets
**Add task**.

## Prerequisites

- `migrations/009_gmail_messages.sql` applied. The card calls
  `crm.find_contacts_by_email`, which that migration creates.
- The Apps Script API switched on at <https://script.google.com/home/usersettings>.
  `clasp` cannot do anything until it is, and the error says so.
- A Google Cloud project with the Gmail API enabled and its consent screen set
  to **Internal**, with its project number pasted into the Apps Script
  project's settings. Internal is what keeps this out of Google's OAuth
  verification review: the script's owner and its users are the same Workspace
  domain.

## Deploy

Every command below runs **from inside `gmail-addon/`**, in a clone of this
repository. `clasp` writes into the working directory and pushes what it finds
there, so running it anywhere else either fails on permissions or uploads the
wrong thing.

The Apps Script project already exists — its id is in `.clasp.json.example`,
so there is nothing to create:

    git clone https://github.com/AffirmerAu/StudioDeals.git
    cd StudioDeals/gmail-addon
    copy .clasp.json.example .clasp.json      # cp on macOS and Linux
    npx @google/clasp login
    npx @google/clasp push

Then in the Apps Script editor: **Deploy → Test deployments → Install**.
Reload Gmail and open any message.

Subsequent changes are `npx @google/clasp push` and a Gmail reload.

`.clasp.json` itself is gitignored, because `clasp` rewrites it as it goes and
adds the Cloud project id to it. The example holds the one value worth
keeping.

### If you ever do need a new script project

    npx @google/clasp create --type standalone --title "StudioDeals"

from inside `gmail-addon/`, then copy the new id into `.clasp.json.example`.
Running it from the wrong directory still creates the project on Google's side
before it fails locally — so check <https://script.google.com/home> for an
orphan before creating another one.

## Files

| File | |
|---|---|
| `appsscript.json` | manifest: scopes, contextual trigger, URL allowlist |
| `Config.gs` | Supabase URL, anon key, app URL, the debug flag |
| `Auth.gs` | sign-in, token storage, refresh |
| `Api.gs` | PostgREST over `UrlFetchApp` |
| `Text.gs` | pure helpers — the only testable part |
| `Message.gs` | everything that reads Gmail |
| `Cards.gs` | card builders |
| `Code.gs` | entry points Gmail calls by name |

`clasp` pushes exactly those eight files; `.claspignore` keeps `tests/` and
this README local.

## Tests

    node gmail-addon/tests/text.test.mjs      # addresses, dates, money, quoted history
    node gmail-addon/tests/wiring.test.mjs    # names, manifest, scopes, write invariants

`wiring.test.mjs` earns its place because Apps Script resolves everything by
name at runtime: a function named in the manifest or in `setFunctionName` that
does not exist fails only when someone clicks it. It also holds the line on
the things that must stay true — the narrow message scope, the `crm` schema,
no service-role key, no write paths before their step.

Neither test can reach CardService, the trigger event, or Supabase. Card
layout and the OAuth grant get found on deploy.

What the insert itself does get tested against is a real PostgreSQL 16 cluster
built from `migrations/`, using the exact column list read out of `Code.gs` —
so a typo there is a failure here rather than a 400 in the sidebar.

## Filing an email

One row per message, and never a second for the same one. Before writing, the
add-on asks StudioDeals which messages of the open thread it already holds —
by thread id, one equality filter that uses the index 009 added. The partial
unique index on `gmail_message_id` is the backstop, not the mechanism.

The first version of that read asked by message id, as
`gmail_message_id=in.("a","b")`, and `UrlFetchApp` refused the request outright
with `Invalid argument`: double quotes are not legal in a URL. Every request
path now lives in `Text.gs` and is asserted URL-safe, because nothing about a
card can be tested and a malformed URL is not the place to find that out.

If Gmail ever re-threads a conversation, a message filed under the old thread
id comes back under a new one and the thread read cannot see it. The unique
index refuses the whole batch; the writer catches that one error and retries
row by row, so the card still reports honest counts instead of failing.

`occurred_at` is the message's own date, so an email filed a week late lands
in the right place on the timeline rather than at the top of it. `type` is
`email`, which `crm.sync_last_contacted` counts as real contact — filing
refreshes the contact and clears the stale flag.

The thread id stored is the one `GmailApp` reports, never `event.gmail.threadId`.
The event carries Gmail's legacy form (`thread-a:r-7012497993290584413`) and
the two do not match, so mixing them would scatter one conversation across two
ids. There is a wiring assertion holding that line.

Whether the whole thread is readable at all was an open question: the narrow
scope is documented as granting access to the *current* message. It turns out
the siblings come through — measured on a real four-message thread, not
assumed — so `Save whole thread` needs no extra scope. `CONFIG.DEBUG` keeps
reporting it, because a deployment whose scope was later narrowed would say so
there first.

The note is `From` / `To` / `Cc` / `Date`, a blank line, and the first 500
characters of the body with quoted history removed. Context, not an archive:
the email stays in Gmail and the row carries the ids that lead back to it.

## Things worth knowing

**The password field is not masked.** CardService has no password input, so
what you type shows in the sidebar. It is typed once, sent straight to
Supabase and never stored. If that bothers you, Supabase's email OTP is a
small swap: a six-digit code instead of a password, and nothing to type twice.

**Only the refresh token is kept**, in `PropertiesService.getUserProperties()`
— per user, per script. The access token sits in `CacheService` for its hour
and is minted again as needed, under a `LockService` lock because Supabase
retires a refresh token the moment it is used.

**`CONFIG.DEBUG` adds a Diagnostics section** to every card. It reports how
many messages in the open thread the add-on can actually read, which is the
open question behind "Save whole thread" — if it says `1 of 4`, that feature
needs the whole-mailbox scope and becomes a decision rather than a detail.
Turn the flag off once it has answered.

**`CONFIG.APP_BASE_URL` is blank.** Fill in the deployed web app's URL and the
cards gain "Open in StudioDeals" links; leave it and they are omitted.

## Creating a contact

The name comes from Gmail's display name where there is one, and from the
local part of the address where there is not — `kieran.jessup@` becomes Kieran
Jessup, `Cooper, Jane` is un-inverted rather than read as two people. All of it
lands in editable fields before anything is written, because
`crm.contacts.first_name` is `NOT NULL` and a guess has to be correctable.

The organisation dropdown puts domain matches first: if anyone already in
StudioDeals has an address at that domain, the organisation is not a guess,
and only that case is preselected. Every other organisation follows by name,
so a client writing from a personal address is still one dropdown away. The
last option creates one, named from the domain as a starting point.

## Adding a task

The same row the web app's `createTask` writes — `type` `task`, a `due_at`, and
`occurred_at` set to when it was raised — so a task set from the sidebar is
indistinguishable on `/tasks`. Tasks are excluded from
`crm.recompute_last_contacted`, so setting a follow-up does not mark a client
as recently contacted.

**One thing to check on first use.** The date-time picker returns milliseconds
that ignore the timezone the person is standing in, and
`commonEventObject.timeZone.offset` is what closes the gap. Which direction
that correction runs could not be tested from the build side, so the card that
follows shows the time it settled on. If a task set for 5pm comes back saying
3am, the sign is wrong in `dueAtFromPicker` and it is a one-character fix.
