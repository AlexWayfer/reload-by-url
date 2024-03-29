# Reload by URL

Reload tabs by time interval when its URL matches.

## Description

Specify any URL (current open by default)
or even [path glob](https://en.wikipedia.org/wiki/Glob_(programming)) (its mask)
and a time interval.
Then extension will reload all tabs with matching URL by this interval.
If you closed a tab or navigated to another URL — the extension will not touch the tab.

Examples:

*   A site with recommendations like Twitch.
*   A feed/board/forum like Reddit.
*   An order/delivery page with tracking; if URL has order number — just use path glob.

## Installation

<a
	href="https://chrome.google.com/webstore/detail/reload-by-url/imgeaeicldbffknjklfhnmbemipkkcaf"
	target="_blank"
	rel="noopener"
	>
	<img
		src="chrome-webstore-button.png"
		alt="Available in the Chrome Web Store"
		height="70"
	/>
</a>

## Development

### Setup

1.  Install Node.js via [`nodenv`](https://github.com/nodenv/nodenv).
2.  Install [`pnpm`](https://pnpm.io/).
3.  Run `pnpm install`.

### Building

Be aware: there are no compiled styles and scripts in the git repository,
so you have to build them once via `pnpm run build`, or start watcher via `pnpm run watch`.

### Packing

`pnpm run pack` to pack the extension into ZIP-file.
Only necessary files will be packed.

We don't need for `.crx` and keys, Developer Dashboard now does it automatically.

## Credentials

*   [Main icon](https://www.flaticon.com/free-icon/sync_4340499)
*   [Loading icon](https://icons8.com/icon/XHchy08wwA71/loading-circle)
*   [GitHub icon](https://icons8.com/icon/set/github/material-outlined)
