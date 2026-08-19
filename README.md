```
╔══════════════════════════════════════════════════════════════════════════════╗
║                              HUMANITY26 v1.0                                 ║
║                     Blue Screen of Death Simulator                           ║
║                        Copyright (c) 2026 HUMANITY                           ║
╚══════════════════════════════════════════════════════════════════════════════╝
```

## DESCRIPTION

HUMANITY26.EXE is a Windows 98-style Blue Screen of Death simulator that generates satirical system error messages based on current world news headlines.

The application uses advanced AI drivers to process real-time news feeds and convert them into authentic-looking fatal exception errors, providing users with hourly commentary on the current state of human civilization.

```
SYSTEM REQUIREMENTS
═══════════════════
    - Modern web browser with JavaScript support
    - Internet connection for news feed processing
    - Keyboard for user interaction
```

## FEATURES

```
[X] AI-powered BSOD message generation via ZAI.VXD
[X] Authentic Windows 98 visual experience
[X] DOS VGA font rendering with scanline effects
[X] Two-tier caching system (server + client)
[X] Hourly automatic content refresh with backup monitoring
[X] Upstash-backed shell attempt rate limiting
[X] Interactive sarcastic message overlay
```

## USER INTERACTION

```
╔════════════════════════════════════════════════════════════╗
║  KEY            ACTION                                     ║
╠════════════════════════════════════════════════════════════╣
║  Any key        Display random sarcastic system message    ║
║  DELETE         Initiate system reboot sequence            ║
║  BACKSPACE      Initiate system reboot sequence            ║
╚════════════════════════════════════════════════════════════╝
```

## TECHNICAL SPECIFICATIONS

```
COMPONENT               DRIVER/MODULE
─────────────────────────────────────────────────
Frontend                HTML/CSS/JS (Vanilla)
Backend                 Vercel Serverless Functions
AI Engine               Z.AI GLM-5.3
Cache System            Upstash Redis
News Feed               Google News RSS
```

## INSTALLATION

To install HUMANITY26 on your local development environment:

```
C:\HUMANITY26> npm install
C:\HUMANITY26> vercel dev
```

## CONFIGURATION

The following environment variables are supported in SYSTEM.INI:

```
[HUMANITY26]
ZAI_API_KEY=<Your Z.AI API key>
ZAI_MODEL=<Optional model override; defaults to glm-5.3>
UPSTASH_REDIS_REST_URL=<Upstash Redis REST API URL>
UPSTASH_REDIS_REST_TOKEN=<Upstash Redis REST API Token>
CRON_SECRET=<Secret token for scheduled tasks>
MESSAGE_KEY=<64-character hexadecimal AES-256 key>
MESSAGE_COMBO=<Sorted lowercase letters for the shell easter egg>
RATE_LIMIT_SECRET=<Recommended independent random secret for client hashing>
```

## SCHEDULED TASKS

HUMANITY26 requires an external CRON.VXD driver to generate hourly content.
The generator retries transient Z.AI failures and serves the last known good BSOD
when the current hourly generation is unavailable. Without any successful cached
generation, users receive a short-lived fallback while the client retries.

```
CRON CONFIGURATION (cron-job.org)
═════════════════════════════════
URL:        https://your-domain.vercel.app/api/generate
SCHEDULE:   0 * * * * (every hour at minute 0)
METHOD:     GET
HEADER:     Authorization: Bearer <CRON_SECRET value>
```

Enable cron-job.org failure notifications after the first failed execution. Its
REST API requires a separate API key generated in the cron-job.org Console; this
credential is intentionally not stored in this repository.

`.github/workflows/hourly-generation.yml` runs a backup check at minute 5. When
the primary cron has succeeded it only reads the existing cache and causes no
extra model call. Otherwise it retries the generation request up to two additional times.
A persistent failure opens or updates a GitHub issue and a later recovery closes
it. Configure the repository Actions secret `CRON_SECRET` with the same value as
Vercel and set `BSOD_BASE_URL` to the production HTTPS origin.

## SECURITY

`/api/shell` permits 10 attempts per client in each 10-minute fixed window.
Client addresses supplied by Vercel's trusted proxy headers are HMAC-hashed
before the Upstash key is created, and Redis failures fail closed with HTTP 503
rather than bypassing the limit. `RATE_LIMIT_SECRET` falls back to `MESSAGE_KEY`
locally, but a dedicated production secret avoids coupling identity hashes to key
rotation. Legacy `KV_REST_API_URL` / `KV_REST_API_TOKEN` names remain supported.

## CONTINUOUS INTEGRATION

`.github/workflows/ci.yml` runs syntax checks, tests, and `npm audit` on pushes to
`main`/`dev` and on pull requests. Scheduled workflows become active only after
these files are pushed to the default branch.

## OBSERVABILITY

Successful model runs emit a content-free `BSOD generation succeeded` event, and
the hourly workflow validates freshness independently. Vercel Node 24 currently
emits one `DEP0169 url.parse()` warning on some cold Redis reads. Disabling
Vercel's automatic fetch instrumentation was tested in preview but did not remove
the warning, so tracing remains enabled and the warning is treated as non-fatal
platform/dependency noise.

## DEPLOYMENT

To deploy HUMANITY26 to production servers:

```
C:\HUMANITY26> vercel --prod
```

## TROUBLESHOOTING

```
PROBLEM: BSOD not displaying
SOLUTION: Check your internet connection and verify API keys

PROBLEM: Cache not updating
SOLUTION: Wait for hourly refresh or press DELETE to force reboot

PROBLEM: No sarcastic messages appearing
SOLUTION: Press any alphabetic key on your keyboard

PROBLEM: Showing "VPATIENCE.VXD" fallback message
SOLUTION: Verify CRON.VXD, ZAI_API_KEY, and the Upstash variables; inspect the cron HTTP status, GitHub monitor, and Vercel logs

PROBLEM: Shell returns HTTP 429
SOLUTION: Wait for the Retry-After interval before trying the secret combo again
```

## LICENSE

```
This software is provided under the MIT License.
See LICENSE file for details.

HUMANITY26 is not affiliated with Microsoft Corporation.
Windows 98 is a registered trademark of Microsoft Corporation.
```

```
═══════════════════════════════════════════════════════════════════════════════
        Thank you for using HUMANITY26. Press any key to continue...
═══════════════════════════════════════════════════════════════════════════════
```
