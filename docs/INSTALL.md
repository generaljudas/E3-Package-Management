# Installing E3 Package Manager

This guide is for the person at the front desk, not for a developer. It shows
you exactly which warning you'll see, why it appears, and the two clicks that
get you past it.

**The short version:** the installers are free, open source, and safe, but they
are not yet *code-signed* — a paid certificate that tells Windows and macOS
"a known publisher made this." Until that's in place (it's on the
[roadmap](ROADMAP.md)), both operating systems will show a one-time warning.
That warning is about the missing certificate, not about anything the app does.

---

## 1. Download

Go to the **[latest release](https://github.com/generaljudas/E3-Package-Management/releases/latest)**
and, under **Assets**, download the file for your computer:

| Your computer | Download this |
|---|---|
| Windows 10 or 11 | `E3-Package-Manager-Setup-<version>.exe` |
| Mac with Apple Silicon (M1, M2, M3, M4…) | `E3-Package-Manager-<version>-arm64.dmg` |
| Linux | `E3-Package-Manager-<version>.AppImage` |

> **Intel Macs** are not covered by this release yet. If you need one, please
> [open an issue](https://github.com/generaljudas/E3-Package-Management/issues)
> so we know there's demand.

Your browser may add its own warning while downloading ("this file isn't
commonly downloaded"). In Edge, click the **⋯** next to the download → **Keep**
→ **Show more** → **Keep anyway**. In Chrome, open the downloads panel, click
the file's **⋮** menu → **Keep**. This is the same missing-certificate reason as
below.

---

## 2. Windows — getting past SmartScreen

Double-click the downloaded `.exe`. You'll see a blue full-window dialog:

```
┌──────────────────────────────────────────────────────────────┐
│  Windows protected your PC                                   │
│                                                              │
│  Microsoft Defender SmartScreen prevented an unrecognized    │
│  app from starting. Running this app might put your PC at    │
│  risk.                                                       │
│                                                              │
│  More info                                   ← click this    │
│                                                              │
│                                              [ Don't run ]   │
└──────────────────────────────────────────────────────────────┘
```

**Click 1 — "More info".** It's a small text link under the paragraph, not a
button. The dialog expands to show the file name and "Publisher: Unknown
publisher", and a new button appears:

```
┌──────────────────────────────────────────────────────────────┐
│  Windows protected your PC                                   │
│                                                              │
│  Microsoft Defender SmartScreen prevented an unrecognized    │
│  app from starting. Running this app might put your PC at    │
│  risk.                                                       │
│                                                              │
│  App:        E3-Package-Manager-Setup-1.0.0-beta.1.exe       │
│  Publisher:  Unknown publisher                               │
│                                                              │
│                          [ Run anyway ]      [ Don't run ]   │
└──────────────────────────────────────────────────────────────┘
```

**Click 2 — "Run anyway".**

If Windows then asks *"Do you want to allow this app from an unknown publisher
to make changes to your device?"* (the User Account Control prompt), click
**Yes**.

The installer opens. Accept the default install location (or choose your own),
click **Install**, then **Finish**. You'll get a desktop shortcut and a Start
menu entry named **E3 Package Manager**. SmartScreen will not ask again for
this version.

---

## 3. macOS — getting past Gatekeeper

Open the downloaded `.dmg` and drag **E3 Package Manager** into the
**Applications** folder, as usual. Then open it from Applications.

The first time, macOS refuses:

```
┌──────────────────────────────────────────────────┐
│  "E3 Package Manager" Not Opened                 │
│                                                  │
│  Apple could not verify "E3 Package Manager" is  │
│  free of malware that may harm your Mac or       │
│  compromise your privacy.                        │
│                                                  │
│            [ Done ]        [ Move to Trash ]     │
└──────────────────────────────────────────────────┘
```

**Click 1 — "Done"** (not Move to Trash).

**Click 2 — allow it in System Settings.** Open **System Settings → Privacy &
Security**, scroll down to the **Security** section. You'll see a line that
says *"E3 Package Manager" was blocked to protect your Mac* with an
**Open Anyway** button next to it. Click **Open Anyway**, confirm **Open
Anyway** again in the dialog that follows, and enter your password or Touch ID
if asked.

The app opens, and macOS won't ask again for this version.

> On macOS 13 (Ventura) and 14 (Sonoma) there's a shortcut: instead of System
> Settings, **right-click** (or Control-click) the app in Applications, choose
> **Open**, and click **Open** in the dialog. On macOS 15 (Sequoia) and later
> this shortcut was removed by Apple; use System Settings as described above.

---

## 4. Linux — AppImage

```bash
chmod +x E3-Package-Manager-*.AppImage
./E3-Package-Manager-*.AppImage
```

Or right-click the file → Properties → Permissions → "Allow executing file as
program", then double-click it. There is no security warning on Linux.

If nothing happens on Ubuntu 22.04 or newer, the AppImage runtime needs one
package: `sudo apt install libfuse2`.

---

## 5. First launch

The window opens on the **Package Intake** screen with 50 demo mailboxes and a
few demo tenants already loaded, so you can try it immediately: type `101` in
the mailbox search, press Enter, and scan or type a tracking number.

Nothing needs configuring. There's no server to start, no database to create,
and no account to make. The app talks only to itself — it never sends your
data anywhere.

To load your real mailbox list instead of the demo data, see the
[customer data migration script](../backend/scripts/README.md).

---

## 6. Where is my data?

Everything is in one file. Back it up by copying it while the app is closed.

| OS | Location |
|---|---|
| Windows | `%APPDATA%\E3 Package Manager\e3_package_manager.db` (paste that into the File Explorer address bar) |
| macOS | `~/Library/Application Support/E3 Package Manager/e3_package_manager.db` (in Finder: **Go → Go to Folder…**) |
| Linux | `~/.config/E3 Package Manager/e3_package_manager.db` |

You may also see `…db-wal` and `…db-shm` files beside it; copy all three
together, and only while the app is closed.

---

## 7. Updating

Download the new installer from the releases page and run it the same way;
your data file stays where it is and is picked up by the new version. The
SmartScreen / Gatekeeper warning will appear once more for the new version.

There's no automatic update yet — that's another roadmap item that depends on
code signing.

---

## 8. If something goes wrong

**"E3 Package Manager could not start — The local server did not respond
within 30 seconds"** or **"…exited unexpectedly"**
Something else on this computer is using port 3001. Close any other copy of
E3 Package Manager (only one can run at a time), then try again. If it keeps
happening, [open an issue](https://github.com/generaljudas/E3-Package-Management/issues)
and paste the exact dialog text.

**A blank white window**
Wait a few seconds — the first launch creates the database. If it stays blank
for more than a minute, quit and relaunch, then report it.

**Windows Firewall asks to allow the app**
It shouldn't — the app only listens on your own computer. If you see the
prompt anyway, **Cancel** is safe; the app works without network access.

**Anything else**
[Open an issue](https://github.com/generaljudas/E3-Package-Management/issues)
with your OS, the installer file name, what you did, and what you saw. A
screenshot of an error dialog is worth a lot.
