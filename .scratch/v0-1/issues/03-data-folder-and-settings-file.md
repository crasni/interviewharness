# 03: Data folder renamed, and settings.json

**What to build:** The app's data lives in a folder named **InterviewHarness** in the normal place for each OS. On first launch, if only the old folder (named after the npm package) exists, its contents (rounds and browser storage) are copied over before any window opens, and the old folder is left in place. Room preferences move out of browser storage into a versioned **settings.json** in the data folder, owned by the main process: it's written atomically, retries on Windows when the file is locked, and a corrupt file means defaults plus a backup. The renderer reads and changes settings only through a narrow IPC surface (get all, change some, subscribe), and main validates every change. The first time the renderer finds v0.0 preferences in browser storage and an empty settings file, it sends them to main once and clears them.

**Blocked by:** None (can start immediately)

**Status:** done

- [x] `productName` is InterviewHarness, and the data folder uses that name on every OS
- [x] Upgrading from v0.0 copies the old folder's contents once; a second launch doesn't copy again; the test data folder override still works
- [x] settings.json has a version field and a migration path; unknown or invalid values fall back to defaults
- [x] Writes are atomic (temp file, then rename) with retries on EPERM/EBUSY; a corrupt file is backed up and replaced by defaults
- [x] The renderer has no direct file access; IPC validates every change
- [x] v0.0 preferences in browser storage are carried into settings.json once and then removed from browser storage
- [x] Unit tests against a temp folder cover atomic writes, a corrupt file and migration; end-to-end tests cover preferences surviving a restart and the v0.0 carry-over

Spec: `.scratch/v0-1/spec.md`.
