# StudioDeals for Gmail

A Google Workspace add-on. Open an email and the sidebar tells you who the
sender is in StudioDeals — their organisation, when you last spoke, whether
they are going cold.

This is step 2 of the build: the skeleton, auth, and one read-only card.
Nothing here writes to StudioDeals. Filing emails, creating contacts and
setting tasks come next.

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

    node gmail-addon/tests/text.test.mjs      # address parsing, dates
    node gmail-addon/tests/wiring.test.mjs    # names, manifest, scopes

`wiring.test.mjs` earns its place because Apps Script resolves everything by
name at runtime: a function named in the manifest or in `setFunctionName` that
does not exist fails only when someone clicks it. It also holds the line on
the things that must stay true — the narrow message scope, the `crm` schema,
no service-role key, no write paths before their step.

Neither test can reach CardService, the trigger event, or Supabase. Card
layout and the OAuth grant get found on deploy.

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
