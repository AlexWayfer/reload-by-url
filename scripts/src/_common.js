import punycode from 'punycode'
import minimatch from 'minimatch'

export const getAdded = async () => {
	const found = await chrome.storage.sync.get({ added: {} })
	// `.get` returns an object of found results with keys,
	// not a value of requested by one key
	return found.added
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

export const findMinimalAdded = (url, added) => {
	let result = null

	Object.entries(added).forEach(([URLmask, props]) => {
		if (!matchURL(url, URLmask)) return

		if (!result || result.interval > props.interval) result = props
	})

	return result
}
