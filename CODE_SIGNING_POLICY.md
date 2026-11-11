# Code signing policy

Free code signing is applied for from [SignPath Foundation](https://signpath.org) (via [SignPath.io](https://signpath.io)). Until the application is approved, releases are not signed. After approval, this will read: "Free code signing provided by SignPath.io, certificate by SignPath Foundation."

This page describes how the Windows executables of **MarkNote** are built and signed.

## What is signed

Only the Windows executables produced from the source code in this repository:

- `MarkNote-<version>-portable.exe`
- `MarkNote-Setup-<version>.exe` (installer), if released

No third-party binaries are signed with this certificate.

## How releases are built

- Executables are built **only from the public source code** in https://github.com/Cphmartinus/marknote.
- Builds run in **GitHub Actions on GitHub-hosted runners** (`windows-latest`), using the workflow in `.github/workflows/build.yml` and `electron-builder`.
- Dependencies are installed from the public npm registry using the committed `package-lock.json`.
- Only builds of tagged releases from the `main` branch are submitted for signing.
- Signing requests are made by the build workflow through the SignPath GitHub integration. Nobody signs files by hand, and the signing key never leaves SignPath.

## Roles

| Role | Who | Responsibility |
| --- | --- | --- |
| Author / committer | Repository owner ([@Cphmartinus](https://github.com/Cphmartinus)) and accepted contributors | Write and review code |
| Reviewer | Repository owner | Reviews contributions before they are merged to `main` |
| Approver | Repository owner | Approves each signing request for a release |

At present the project has a single maintainer. Contributions from others are reviewed by the maintainer before they are merged.

## Security practices

- Accounts with write access to the repository and to SignPath must use **multi-factor authentication**.
- Releases are created only from reviewed code on `main`.
- The project does not contain malware, adware or code that collects data without the user's knowledge. See the [privacy policy](PRIVACY.md).
- If a signed release is found to be compromised, the affected version will be reported to SignPath so the certificate can be handled according to their procedures, and a fixed release will be published.

## Privacy

See [PRIVACY.md](PRIVACY.md).

## Reporting problems

Open an [issue](https://github.com/Cphmartinus/marknote/issues) in this repository.
