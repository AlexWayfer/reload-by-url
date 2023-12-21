import punycode from 'punycode'
import { minimatch } from 'minimatch'

const getFromStorage = async (key, area) => {
	const found = await chrome.storage[area].get({ [key]: {} })
	// `.get` returns an object of found results with keys,
	// not a value of requested by one key
	return found[key]
}

export const getAdded = async () =>
	getFromStorage('added', 'sync')

export const getAllIntervals = async () =>
	getFromStorage('intervals', 'local')

export const completeDecodeURL = urlString => {
	const
		url = new URL(urlString),
		urlHostname = punycode.toUnicode(url.hostname),
		urlPort = url.port ? `:${url.port}` : '',
		urlFullPath = `${url.pathname}${url.search}${url.hash}`

	return decodeURI(`${url.protocol}//${urlHostname}${urlPort}${urlFullPath}`)
}

export const matchURL = (realURL, URLmask) =>
	minimatch(completeDecodeURL(realURL), completeDecodeURL(URLmask))

export const timeUntilNextTimeout = interval =>
	// console.debug('timeUntilNextTimeout')
	// console.debug('interval.startAt = ', interval.startAt)
	// console.debug('Date.now() = ', Date.now())
	// console.debug('past = ', (Date.now() - interval.startAt) / 1000)
	interval.time * 1000 - (Date.now() - interval.startAt) % (interval.time * 1000)
