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
[X] AI-powered BSOD message generation via GEMINI.VXD
[X] Authentic Windows 98 visual experience
[X] DOS VGA font rendering with scanline effects
[X] Two-tier caching system (server + client)
[X] Hourly automatic content refresh
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
AI Engine               Google Gemini 2.5 Flash
Cache System            Vercel KV (Redis)
News Feed               Google News RSS
```

## INSTALLATION

To install HUMANITY26 on your local development environment:

```
C:\HUMANITY26> npm install
C:\HUMANITY26> vercel dev
```

## CONFIGURATION

The following environment variables must be set in SYSTEM.INI:

```
[HUMANITY26]
GOOGLE_AI_API_KEY=<Your Google Gemini API Key>
KV_REST_API_URL=<Vercel KV REST API URL>
KV_REST_API_TOKEN=<Vercel KV REST API Token>
CRON_SECRET=<Secret token for scheduled tasks>
```

## SCHEDULED TASKS

HUMANITY26 requires an external CRON.VXD driver to generate hourly content.
Without scheduled execution, users will receive a fallback BSOD message.

```
CRON CONFIGURATION (cron-job.org)
═════════════════════════════════
URL:        https://your-domain.vercel.app/api/generate
SCHEDULE:   0 * * * * (every hour at minute 0)
METHOD:     GET
HEADER:     Authorization: Bearer <CRON_SECRET value>
```

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
SOLUTION: Verify CRON.VXD is properly configured and executing hourly
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
