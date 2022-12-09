import punycode from 'punycode'

const [currentTab] = await chrome.tabs.query({
	active: true, lastFocusedWindow: true
})

const
	formNew = document.querySelector('form.new'),
	newUrlInput = formNew.querySelector('input.url'),
	addButton = formNew.querySelector('button.add'),
	updateButton = formNew.querySelector('button.update'),
	sectionAdded = document.querySelector('section.added'),
	listAdded = sectionAdded.querySelector('ul.added'),
	addedItemTemplate = sectionAdded.querySelector('template.added-item'),
	emptyListNotice = sectionAdded.querySelector('p.empty-list')

const getAdded = async () => {
	const found = await chrome.storage.sync.get({ added: {} })
	// `.get` returns an object of found results with keys,
	// not a value of requested by one key
	return found.added
}

const refreshListAdded = data => {
	const dataEntries = Object.entries(data)

	if (dataEntries.length == 0) {
		listAdded.replaceChildren()
		listAdded.classList.add('hidden')
		emptyListNotice.classList.remove('hidden')
	} else {
		// Replace new items data with Nodes
		const newItems =
			dataEntries
				.sort(
					([_aUrl, aProps], [_bUrl, bProps]) => aProps.addedAt - bProps.addedAt
				)
				.map(([url, props]) => {
					const newItem = addedItemTemplate.content.cloneNode(true)

					newItem.querySelector('.url')
						.replaceChildren(...highlightURLparts(url))

					newItem.querySelector('button.remove')
						.addEventListener('click', async () => {
							if (window.confirm('Do you want to remove?')) {
								const added = await getAdded()

								delete added[url]

								chrome.storage.sync.set({ added })
							}
						})

					return newItem
				})

		listAdded.replaceChildren(...newItems)

		emptyListNotice.classList.add('hidden')
		listAdded.classList.remove('hidden')
	}

	toggleNewButtons()
}

const toggleNewButtons = async () => {
	const
		added = await getAdded(),
		isValueExists = added.hasOwnProperty(newUrlInput.value)

	addButton.classList.toggle('hidden', isValueExists)
	updateButton.classList.toggle('hidden', !isValueExists)
}

const completeDecodeURL = urlString => {
	const
		url = new URL(urlString),
		urlHostname = punycode.toUnicode(url.hostname),
		urlPort = url.port ? `:${url.port}` : '',
		urlFullPath = `${url.pathname}${url.search}${url.hash}`

	return decodeURI(`${url.protocol}//${urlHostname}${urlPort}${urlFullPath}`)
}

const urlRegex = /^(?<protocol>[\w\-*]*:\/\/)?(?<host>[^:\/]*)?(?<path>\/[^?]*)?(?<rest>\?.*)?$/

const highlightURLparts = urlString => {
	const match = urlString.match(urlRegex)

	const parts = []

	Object.entries(match.groups).forEach(([key, value]) => {
		if (!value) return

		const element = document.createElement('span')

		element.classList.add(`url-${key}`)
		element.textContent = value

		parts.push(element)
	})

	return parts
}

// Initialize "Added" list from storage

refreshListAdded(await getAdded())

// Listen for future updates of "Added"

chrome.storage.onChanged.addListener((changes, _area) => {
	if ('added' in changes) {
		refreshListAdded(changes.added.newValue || {})
	}
})

// "New" form URL input

newUrlInput.addEventListener('input', async event => {
	toggleNewButtons()
})

newUrlInput.value = completeDecodeURL(currentTab.url)

// "New" form submitting

formNew.addEventListener('submit', async event => {
	event.preventDefault()

	const added = await getAdded()
	added[newUrlInput.value] = {
		addedAt: Date.now()
	}

	chrome.storage.sync.set({ added })
})
