/**
 * Deployment constants.
 *
 * The anon key belongs in here in the clear. It is publishable, it already
 * ships inside the built web app and sits in .env.example, and on its own it
 * opens nothing: every crm table is `for all to authenticated`, so it is the
 * user's JWT that carries the authority. The service_role key must never
 * appear in this file or anywhere else in this repository.
 */
var CONFIG = {
  SUPABASE_URL: 'https://vfmjrcpemlvseczqvrsw.supabase.co',
  SUPABASE_ANON_KEY:
    'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZmbWpyY3BlbWx2c2VjenF2cnN3Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODc1NjA4NzMsImV4cCI6MjEwMzEzNjg3M30.2p585yRyLtvT8f1_fsRrUG7PiI7fSaHEfxLLQNejtSI',

  /**
   * Where the web app is deployed, with no trailing slash — fill this in and
   * the cards gain "Open in StudioDeals" links. Left blank they are simply
   * omitted, so the add-on works either way.
   */
  APP_BASE_URL: '',

  /**
   * Adds a Diagnostics section to every card: which address was looked up,
   * how the token stands, and whether this deployment can read the other
   * messages in an open thread. That last one decides whether "Save whole
   * thread" is buildable at all, so leave it on until the first deploy has
   * answered it.
   */
  DEBUG: true,

  /** All CRM tables live in the crm schema, never public. */
  SCHEMA: 'crm',
};
