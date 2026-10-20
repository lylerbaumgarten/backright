# Third-party notices

Posture's own code is MIT-licensed (see `LICENSE`). It is built on, and ships with, the following open-source
components. Each remains under its own license.

## Electron — MIT
Copyright (c) Electron contributors, Copyright (c) 2013-2020 GitHub Inc.
https://www.electronjs.org · license text: the `LICENSE` file shipped with Electron.
Electron bundles Chromium and other components under their own licenses; their notices are in Electron's
`LICENSES.chromium.html`, which is included next to this file in the packaged app.

## MediaPipe Tasks Vision (`@mediapipe/tasks-vision`) — Apache License 2.0
Copyright Google LLC. https://github.com/google-ai-edge/mediapipe
The JavaScript bundle and WebAssembly runtime in `vendor/` are copied from this package at install time
(`npm run vendor`). Full license text: `LICENSES/Apache-2.0.txt`.

## MediaPipe Pose Landmarker model (BlazePose GHUM 3D, "lite") — Apache License 2.0
Google. Model card: https://storage.googleapis.com/mediapipe-assets/Model%20Card%20BlazePose%20GHUM%203D.pdf
(the card states "Licensed under Apache License, Version 2.0"). The `.task` file is downloaded from
https://storage.googleapis.com/mediapipe-models/ by `npm run vendor`; it is not stored in this repository.
Full license text: `LICENSES/Apache-2.0.txt`.

The model card lists "any form of surveillance or identity recognition" as out of scope. Posture runs entirely on your
own computer, uses the model only to estimate your own head and shoulder position, and does not identify anyone.
