# Token Quota Compass

A GNOME Shell 50 extension showing local AI provider quota usage. It needs the separately installed [CodexBar CLI](https://github.com/steipete/CodexBar/blob/main/docs/cli.md). The menu shows hours and minutes until each reported quota reset, alongside the local reset time. This repository contains no provider logos; generic icons are shown by default.

## Install from this repository

Install CodexBar CLI and sign in to the providers you use. On Linux with Homebrew, `brew install steipete/tap/codexbar` is one option. Then clone this repository directly to the GNOME extension directory:

```sh
git clone https://github.com/PerfectBlueFeynman/token-quota-compass.git "$HOME/.local/share/gnome-shell/extensions/token-quota-compass@meleager.github.io"
glib-compile-schemas --strict "$HOME/.local/share/gnome-shell/extensions/token-quota-compass@meleager.github.io/schemas"
```

Claude usage requires a working Claude authentication source in CodexBar. If its card says the Claude source is unavailable, check `claude auth status` and run `claude auth login` if signed out.

Log out and back in, then enable `token-quota-compass@meleager.github.io` in GNOME Extensions or run `gnome-extensions enable token-quota-compass@meleager.github.io`. Open Settings to choose the panel position and sources. GNOME 50 is the version tested for this package.

To update later, run `git pull` in the cloned extension directory, then log out and back in.

## Restore logos on your own computer

Copy your existing `*-symbolic.svg` files privately into `media/logos/` in this checkout. The recognized provider filenames are listed in `LOGOS` at the top of `extension.js`. Copy the accompanying attribution file as `NOTICE`. Log out and back in to load the icons. Both `media/logos/` and `NOTICE` are excluded by `.gitignore`; keep them out of the public repository. Third-party logos need rights-holder permission before public redistribution.

This extension uses GPL-3.0-or-later. It is not yet approved for upload to extensions.gnome.org: maintainer review and UUID namespace ownership still need to be resolved.
