# Tempo

A mobile-first interval timer built with TypeScript, React, Vite and Lucide icons.

## Development

```sh
npm ci
npm run dev
```

```sh
npm test
npm run build
npm run preview
```

## Timers

Create a custom timer or select a preset, edit its rounds and intervals, and save it. Each round repeats independently; cycles repeat the entire timer. Saved timers support editing, duplication and deletion. Active timers support pause, resume, restart, skip and stop, and remain available while navigating the app.

- **Tabata:** a prepare-only round of 10 seconds, followed by a work/rest round of 20/60 seconds repeated 10 times; one cycle, 13:30 total.
- **Rounds:** a prepare-only round of 10 seconds, followed by a work/rest round of 10/20 seconds repeated once; one cycle, 00:40 total.

Preparation runs once per cycle, before the repeated work/rest round. These defaults apply to newly created presets; existing saved timers keep their edited structure.

Each interval has a name, duration, colour, Lucide icon, optional looping custom audio and a transition sound. The upcoming interval’s transition sound plays at the end of the preceding interval and finishes at the boundary. There is no transition cue at timer start or after the final interval. Pausing, restarting and skipping cancel pending cues; resuming schedules only notes that have not yet started. Short intervals omit notes that do not fit. Beeps is three 150 ms beeps with one second of silence between them. Loud Beep uses the same three-tone pattern and one-second silence gaps, with 300 ms tones and three times the gain at the same volume setting. Other transitions are Bell, Chime, Rise, Click and None.

Settings, timers, the active session and uploaded media are stored in local storage on this browser. Audio uploads are limited to 2 MB each, and the browser's storage quota also applies. Quota errors leave existing saved data intact. Uploaded media is checked for playback support before saving. Deleting a sound removes its timer references.

The countdown uses timestamps rather than tick counts. Reload restores the session paused, accounting for elapsed time up to the reload. Editing a saved timer does not change the active timer's snapshot. Screen wake lock is requested while running when enabled and supported. Browsers can suspend timers and audio when the screen locks or the app is backgrounded; elapsed time catches up on return, but audio delivery in the background is not guaranteed.

## GitHub Pages

The workflow in `.github/workflows/pages.yml` tests, builds and deploys on every push to `main`; it also supports manual dispatch. GitHub Pages must use **GitHub Actions** as its publishing source under repository **Settings → Pages**. The build uses relative asset paths, including for repository Pages URLs.

Deployment URL: https://clammet.github.io/timer/

Official setup references: [GitHub Pages workflows](https://docs.github.com/en/pages/getting-started-with-github-pages/using-custom-workflows-with-github-pages) and [Vite static deployment](https://vite.dev/guide/static-deploy.html).
