import punycode from 'punycode'

const [currentTab] = await chrome.tabs.query({
	active: true, lastFocusedWindow: true
})

const
	formNew = document.querySelector('form.new'),
	newUrlInput = formNew.querySelector('*.url[contenteditable]'),
	newTimeFieldset = formNew.querySelector('fieldset[name="time"]'),
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

const splitInterval = interval => {
	return [Math.floor(interval / 60), interval % 60]
}

const completeDecodeURL = urlString => {
	const
		url = new URL(urlString),
		urlHostname = punycode.toUnicode(url.hostname),
		urlPort = url.port ? `:${url.port}` : '',
		urlFullPath = `${url.pathname}${url.search}${url.hash}`

	return decodeURI(`${url.protocol}//${urlHostname}${urlPort}${urlFullPath}`)
}

const matchURL = (url1, url2) => {
	return completeDecodeURL(url1) == completeDecodeURL(url2)
}

const initializeListAddedItem = (url, props) => {
	// There is `DocumentFragment` without `firstElementChild`
	// https://developer.mozilla.org/en-US/docs/Web/HTML/Element/template#avoiding_documentfragment_pitfall
	const newItem = addedItemTemplate.content.firstElementChild.cloneNode(true)

	// Fill URL

	newItem.querySelector('.url').replaceChildren(...highlightURLparts(url))

	// Fill time interval

	const [minutes, seconds] = splitInterval(props.interval)

	newItem.querySelector('.time').textContent =
		`${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`

	// Highlight if current

	// TODO: Support path globs
	if (matchURL(url, currentTab.url)) newItem.classList.add('current')

	// Handle "Edit" button

	newItem.querySelector('button.edit').addEventListener('click', async () => {
		const
			added = await getAdded(),
			props = added[url]

		// Fill "new" inputs

		fillFormNewInputs(url, props)

		// Delete old item

		delete added[url]

		chrome.storage.sync.set({ added })
	})

	// Handle "Remove" button

	newItem.querySelector('button.remove').addEventListener('click', async () => {
		if (window.confirm('Do you want to remove?')) {
			const added = await getAdded()

			delete added[url]

			chrome.storage.sync.set({ added })
		}
	})

	return newItem
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
				.sort(([_aUrl, aProps], [_bUrl, bProps]) => aProps.addedAt - bProps.addedAt)
				.map(([url, props]) => {
					return initializeListAddedItem(url, props)
				})

		listAdded.replaceChildren(...newItems)

		emptyListNotice.classList.add('hidden')
		listAdded.classList.remove('hidden')
	}

	toggleNewButtons()
}

const fillNewUrlInput = text => {
	newUrlInput.replaceChildren(...highlightURLparts(text))
}

const fillFormNewInputs = (url, props) => {
	// "New" form URL input

	fillNewUrlInput(completeDecodeURL(url))

	// "New" time inputs

	if (props) {
		const [minutes, seconds] = splitInterval(props.interval)

		newTimeFieldset.querySelector('input[name="minutes"]').value = minutes
		newTimeFieldset.querySelector('input[name="seconds"]').value = seconds
	}
}

const getNewUrlProps = async () => {
	const added = await getAdded()

	return added[newUrlInput.textContent]
}

const toggleNewButtons = async () => {
	const
		newUrlProps = await getNewUrlProps(),
		isPropsExist = Boolean(newUrlProps)

	addButton.classList.toggle('hidden', isPropsExist)
	updateButton.classList.toggle('hidden', !isPropsExist)
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

const getCaretPosition = () => {
	let caretRevCount = 0

	if (window.getSelection) {
		const
			selection = window.getSelection(),
			currentNode = selection.focusNode.parentNode
			caretRevCount = selection.focusOffset

		let previousNode = currentNode.previousSibling

		while (previousNode) {
			caretRevCount += previousNode.textContent.length
			previousNode = previousNode.previousSibling
		}
	}

	return caretRevCount
}

const setCaretPosition = (parentNode, position) => {
	let
		caretRevCount = position,
		nextNode = parentNode.firstElementChild // span

	while (nextNode.textContent.length < caretRevCount) {
		caretRevCount -= nextNode.textContent.length
		nextNode = nextNode.nextSibling
	}

	const
		range = document.createRange(),
		selection = window.getSelection()

	// `firstChild` because of `text` node inside `span`
	range.setStart(nextNode.firstChild, caretRevCount)
	range.collapse(true)

	selection.removeAllRanges()
	selection.addRange(range)
}

// Listen for future updates of "Added"

chrome.storage.onChanged.addListener((changes, _area) => {
	if ('added' in changes) {
		refreshListAdded(changes.added.newValue || {})
	}
})

// Initialize "New" form

fillFormNewInputs(currentTab.url, await getNewUrlProps())

newUrlInput.addEventListener('input', async event => {
	const caretPosition = getCaretPosition()
	fillNewUrlInput(newUrlInput.textContent)
	setCaretPosition(newUrlInput, caretPosition)

	toggleNewButtons()
})

// Initialize "Added" list from storage

refreshListAdded(await getAdded())

// "New" form submitting

formNew.addEventListener('submit', async event => {
	event.preventDefault()

	const
		formData = new FormData(formNew),
		added = await getAdded()

	const newItem = added[formData.get('url')] ??= {}

	added[formData.get('url')].interval =
		parseInt(formData.get('minutes')) * 60 + parseInt(formData.get('seconds'))

	added[formData.get('url')].addedAt ??= Date.now()

	chrome.storage.sync.set({ added })
})
