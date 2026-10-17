# Audio assets

No audio ships with the project yet, so the experience is completely silent.
The five interactive hotspots stay in place and are ready to play sound once
the recordings are added.

To enable audio, place five files in this folder using these exact names:

- `blackbird.mp3`
- `woodpecker.mp3`
- `squirrel.mp3`
- `frog.mp3`
- `stream.mp3`

Then wire them up in `src/lib/audio.ts` — that module owns all playback and
cleanup. No other part of the app needs to change.

Audio must only play after a user clicks a hotspot. There is no background,
ambient, or autoplay audio in this project.
