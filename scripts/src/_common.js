import punycode from 'punycode'
import minimatch from 'minimatch'

const getFromStorage = async (key, area) => {
	const found = await chrome.storage[area].get({ [key]: {} })
	// `.get` returns an object of found results with keys,
	// not a value of requested by one key
	return found[key]
}

export const getAdded = async () => {
	return getFromStorage('added', 'sync')
}

export const getAllIntervals = async () => {
	return getFromStorage('intervals', 'local')
}

export const completeDecodeURL = urlString => {
	const
		url = new URL(urlString),
		urlHostname = punycode.toUnicode(url.hostname),
		urlPort = url.port ? `:${url.port}` : '',
		urlFullPath = `${url.pathname}${url.search}${url.hash}`

	return decodeURI(`${url.protocol}//${urlHostname}${urlPort}${urlFullPath}`)
}

export const matchURL = (realURL, URLmask) => {
	return minimatch(completeDecodeURL(realURL), completeDecodeURL(URLmask))
}

export const timeUntilNextTimeout = interval => {
	// https://bugs.chromium.org/p/chromium/issues/detail?id=1472588
	return interval.time - (Date.now() - new Date(interval.startAt)) / 1000 % interval.time
}
