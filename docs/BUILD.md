# Build AI Motion Designer

Allow roughly 2–3 hours. You should know JavaScript functions, arrays, objects, and terminal commands. You will complete three functions inside a supplied local application. No paid API request or voice credit is needed to finish.

## 1. Meet the finished build

One storyboard travels from a brief to an MP4. In our example, it explains next-token prediction: text pieces → model processing → a possible continuation → repetition. The pieces are explicitly illustrative, not the output of a particular tokenizer or a measured probability distribution.

HyperFrames turns HTML and a seekable animation timeline into frames. FFmpeg encodes the frames into a video. Gemini optionally drafts a JSON scene plan; it never writes executable code here. The same `compositionHTML` function drives the iframe preview and the exported file.

**Checkpoint:** explain the separate jobs of Gemini, GSAP, HyperFrames and FFmpeg. Gemini does not render the video.

## 2. Start your local workspace

Install Node.js 22.13+, FFmpeg including FFprobe, and Google Chrome. On macOS, Homebrew users can run `brew install ffmpeg`; install Node and Chrome from their official downloads. On Windows/Linux, install the same tools and ensure `node`, `ffmpeg`, and `ffprobe` run by name in your terminal. Then:

```sh
node --version
ffmpeg -version
ffprobe -version
npm ci
npm run setup
npm start
```

Open `http://localhost:3082`. Setup preserves an existing `.env.local`. If another app uses that port, edit `PORT` and restart; use the address this server prints. If Chrome is in a nonstandard location, set `CHROME_PATH` in `.env.local`.

In the completed reference, click **Explore an illustrative storyboard**. In the teaching starter, creating/listing projects works, but preview deliberately reports unfinished learner functions until step 5. Do not call Gemini until the prompt function is complete. An early full test run will fail by design.

**Checkpoint:** the app opens and the terminal stays running. Inspect `learner/`, `checkpoints/`, `lib/`, `ui/`, and `test/`.

## 3. Write the planning contract

Open `learner/storyboard.mjs`. Implement `storyboardPrompt(brief)`:

1. Reject nonstrings, briefs shorter than 12 characters, and briefs longer than 1800 characters.
2. Request `title` plus `scenes`. Every scene has `title`, `text`, `duration`, `kind`, and `labels`.
3. Restrict kinds to `tokens`, `pipeline`, and `compare`; ask for 3–5 scenes totaling no more than 45 seconds.
4. Ask for one accurate idea per scene. Ban invented measurements, quotes, code, HTML, shell commands and URLs.
5. Include the user's brief as content, without allowing it to override the contract.

```sh
npm run check:storyboard
```

Compare with `checkpoints/storyboard.mjs` only after trying. The provider separately supplies a response schema. `validatePlan` then checks actual text lengths, allowed kinds, durations and total length. A prompt is a request, not enforcement. The prompt targets 140 explanation characters; the editor allows up to 180 to leave room for a careful human correction. Preview and export share this limit.

**Checkpoint:** both prompt tests pass. Explain why schema-valid text can still be factually wrong.

**Optional live AI:** put your Gemini key in `.env.local`, restart, and click **Draft with Gemini** after entering a brief. This sends only the brief to Google. The attempt ledger increments before the request; errors are not retried. Validated identical drafts are cached. Inspect all facts yourself. Without a key, continue manually.

## 4. Connect the playhead

Open `learner/timeline.mjs`. Implement `sceneAtTime(scenes, seconds)`:

1. Reject an empty scene list and nonfinite playhead values.
2. Clamp negative time to zero.
3. Accumulate durations. At an exact boundary, select the next scene.
4. Return `index`, `start`, and `localTime`. Clamp after the end to the final scene's endpoint.

For durations `[3, 5]`, time `3` means scene index `1`, start `3`, local time `0`. Time `100` means scene index `1`, local time `5`.

```sh
npm run check:timeline
```

**Checkpoint:** both tests pass. The same calculation should still work after scenes are reordered.

## 5. Turn safe data into real motion

Open `learner/composition.mjs` and implement both functions:

- `escapeText(value)` replaces ampersands, angle brackets, double quotes and single quotes with HTML entities. Escape ampersands as part of a single character replacement so you do not double-escape other entities.
- `sequenceScenes(scenes)` validates 2–12 second durations and derives each `start` and `end` from a running cursor. Do not trust model-provided offsets.

```sh
npm run check:composition
```

Inspect `lib/composition.mjs`. It generates fixed DOM structures and registers a paused GSAP timeline at `window.__timelines.motion`, matching `data-composition-id="motion"`. The outer composition declares `1280 × 720` and total duration. Label content is escaped. No strings from Gemini are used as JavaScript, selectors or shell commands.

Restart the server after changing learner files. Open the example. Click scene 2, edit its title, change **Seconds** to `7`, and choose **Save & preview**. Play and seek. Reload the page and verify the title and duration persist. Try moving the scene earlier, then restore its sensible order.

**Checkpoint:** three composition tests pass; script-shaped text renders as text. The preview matches your saved edits.

## 6. Render and inspect a real MP4

Review the full explanation and every label. Select **Export MP4**. The server freezes the saved plan, writes a local composition, invokes the pinned HyperFrames CLI without a shell, and renders through Chrome and FFmpeg. Download the finished MP4 and watch it all the way through. Confirm title, scene order, timing, readable text and no accidental clipped content.

```sh
npm test
npm run test:export
```

The export check renders a short real composition and uses FFprobe to verify 1280 × 720 H.264 and three seconds. It does not prove your explanation is accurate; that is a separate review. Exporting the same saved composition reuses its existing local video. A changed plan receives a new content hash.

**Checkpoint:** all twelve tests and the real export check pass. Your downloaded video shows the same motion as the preview. No AI credits were used for rendering.

## 7. Make it your own, carefully

Replace the illustrative story with a concept you understand. Keep one idea per scene. Extend with a new declarative motion kind only after adding validation, its HTML template, deterministic timing and tests. Do not accept arbitrary model-generated JavaScript.

Good next features: a source-note field, an accessible transcript export, and separate authored color themes. Voice is a later extension: finalize words and timing, review duration, then require explicit generation and cache the result. This reference intentionally makes no speech calls.

**Checkpoint:** you can explain the trust boundary, what leaves the computer, and what would need authentication before hosting this app for other people.

## Recovery and troubleshooting

```sh
npm run restore -- storyboard
npm run restore -- timeline
npm run restore -- composition
```

Restore only the function you need. Every restore first saves your existing version in `.backups/`. Restart Node afterwards.

- **Unchanged page after editing code:** stop and restart `npm start`, refresh, and verify the printed port belongs to this folder.
- **Save rejected:** read the error; empty fields, labels over 24 characters, more than four labels, invalid durations and total duration over 60 seconds are rejected. Your unsaved text remains in the editor.
- **AI unavailable:** manual editing and exporting remain available. Confirm `.env.local`, restart, check your provider access and the daily limit. Do not repeatedly retry errors.
- **AI returned invalid JSON:** `.data/ai-cache/*.response.json` preserves the response. Diagnose before spending on another request.
- **Render failed:** check `.data/renders/<id>/render.log`; confirm FFmpeg, FFprobe, Chrome and the installed pinned dependencies. Do not publish the log without checking its contents.
- **Scene appears blank at a cut:** scrub just after the cut; transitions briefly fade between scenes. A long blank interval means a timing bug and must be fixed.
- **Edited in two tabs:** the server rejects a stale revision. Copy your desired text elsewhere, reload, and apply it to the current version.
