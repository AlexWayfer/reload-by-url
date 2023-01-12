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
