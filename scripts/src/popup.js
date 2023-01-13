import { getAdded, completeDecodeURL, matchURL } from './_common'

const [currentTab] = await chrome.tabs.query({
	active: true, lastFocusedWindow: true
})

const
	formNew = document.querySelector('form.new'),
	newUrlInput = formNew.querySelector('input[name="url"]'),
	newTimeFieldset = formNew.querySelector('fieldset[name="time"]'),
	addButton = formNew.querySelector('button.add'),
	updateButton = formNew.querySelector('button.update'),
	sectionAdded = document.querySelector('section.added'),
	listAdded = sectionAdded.querySelector('ul.added'),
	addedItemTemplate = sectionAdded.querySelector('template.added-item'),
	emptyListNotice = sectionAdded.querySelector('p.empty-list')

const splitInterval = interval => {
	return [Math.floor(interval / 60), interval % 60]
}

const initializeListAddedItem = (url, props, tabs) => {
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

	if (matchURL(currentTab.url, url)) newItem.classList.add('current')

	// Initialize current tabs list
	const
		tabsList = newItem.querySelector('ul.tabs'),
		tabTemplate = tabsList.querySelector('template.open-tab')

	tabs.forEach(tab => {
		if (!matchURL(tab.url, url)) return

		const
			tabElement = tabTemplate.content.firstElementChild.cloneNode(true),
			button = tabElement.querySelector('button')

		button.textContent = tab.title
		// It should be executed only at initialization
		if (tab.id == currentTab.id) button.disabled = true

		tabElement.addEventListener('click', () => {
			chrome.windows.update(tab.windowId, { focused: true })
			chrome.tabs.update(tab.id, { active: true })
		})

		tabsList.appendChild(tabElement)
	})

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

const refreshListAdded = async data => {
	const
		dataEntries = Object.entries(data),
		tabs = await chrome.tabs.query({})

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
					return initializeListAddedItem(url, props, tabs)
				})

		listAdded.replaceChildren(...newItems)

		emptyListNotice.classList.add('hidden')
		listAdded.classList.remove('hidden')
	}

	toggleNewButtons()
}

const fillFormNewInputs = (url, props) => {
	// "New" form URL input

	newUrlInput.value = completeDecodeURL(url)

	// "New" time inputs

	if (props) {
		const [minutes, seconds] = splitInterval(props.interval)

		newTimeFieldset.querySelector('input[name="minutes"]').value = minutes
		newTimeFieldset.querySelector('input[name="seconds"]').value = seconds
	}
}

const getPropsByURL = async (url = newUrlInput.value) => {
	const added = await getAdded()

	return added[url]
}

const toggleNewButtons = async () => {
	const
		newUrlProps = await getPropsByURL(),
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

// Listen for future updates of "Added"

chrome.storage.onChanged.addListener(async (changes, _area) => {
	if ('added' in changes) {
		await refreshListAdded(changes.added.newValue || {})
	}
})

// Initialize "New" form

fillFormNewInputs(currentTab.url, await getPropsByURL(currentTab.url))

newUrlInput.addEventListener('input', async event => {
	toggleNewButtons()
})

// Initialize "Added" list from storage

await refreshListAdded(await getAdded())

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
