# Contributing

Open an issue describing the problem, expected behavior, operating system, Node version, and `reelfetch doctor` output. Remove private URLs and personal information from logs.

For changes, use Node 22 or newer, run `npm ci`, `npm run check`, and `npm test`. Add focused tests for behavior changes. Keep platform commands as argument arrays, never shell strings. Do not add postinstall downloads or bundle third-party executables without reviewing their licenses.

Site extraction bugs often belong in yt-dlp; first update with `reelfetch setup` and check whether plain yt-dlp has the same problem.
