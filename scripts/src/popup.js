import {
	getAdded, completeDecodeURL, matchURL, getAllIntervals, timeUntilNextTimeout
} from './_common'

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
	return { minutes: Math.floor(interval / 60), seconds: interval % 60 }
}

const fillTimeSpan = (element, timeInSeconds) => {
	const timeObject = splitInterval(timeInSeconds)

	element.inSeconds = timeInSeconds
	element.textContent =
`\
${timeObject.minutes.toString().padStart(2, '0')}\
:\
${timeObject.seconds.toString().padStart(2, '0')}\
`
}

const initializeListAddedItem = (url, props, tabs, interval) => {
	console.debug(`initializeListAddedItem`)
	console.debug('interval = ', interval)

	// There is `DocumentFragment` without `firstElementChild`
	// https://developer.mozilla.org/en-US/docs/Web/HTML/Element/template#avoiding_documentfragment_pitfall
	const newItem = addedItemTemplate.content.firstElementChild.cloneNode(true)

	// Fill URL

	newItem.querySelector('.url').replaceChildren(...highlightURLparts(url))

	// Fill time interval

	const
		timeContainer = newItem.querySelector('.time'),
		leftTimeElement = timeContainer.querySelector('.left'),
		allTimeElement = timeContainer.querySelector('.all'),
		updateTimeElements = () => {
			if (leftTimeElement.inSeconds > 0) {
				fillTimeSpan(leftTimeElement, leftTimeElement.inSeconds - 1)
			} else {
				fillTimeSpan(leftTimeElement, allTimeElement.inSeconds - 1)
			}
		}

	fillTimeSpan(
		timeContainer.querySelector('.all'),
		props.interval
	)

	// console.debug(`timeUntilNextTimeout(interval) = ${timeUntilNextTimeout(interval)}`)

	fillTimeSpan(
		timeContainer.querySelector('.left'),
		interval ? Math.round(timeUntilNextTimeout(interval)) : props.interval
	)

	if (interval) {
		setTimeout(
			() => {
				// Call after the short timeout
				updateTimeElements()

				setInterval(updateTimeElements, 1000)
			},
			timeUntilNextTimeout(interval) % 1000
		)
	}

	// Highlight if current

	if (matchURL(currentTab.url, url)) newItem.classList.add('current')

	// Initialize current tabs list
	const
		tabsList = newItem.querySelector('ul.tabs'),
		tabTemplate = tabsList.querySelector('template.open-tab')

	for (const tab of tabs) {
		if (!matchURL(tab.url, url)) continue

		const
			tabElement = tabTemplate.content.firstElementChild.cloneNode(true),
			button = tabElement.querySelector('button'),
			buttonTitle = button.querySelector('.title')

		tabElement.tabID = tab.id

		buttonTitle.textContent = tab.title

		// It should be executed only at initialization
		if (tab.id == currentTab.id) button.disabled = true

		button.querySelector('img.favicon').src = tab.favIconUrl

		tabElement.addEventListener('click', () => {
			chrome.windows.update(tab.windowId, { focused: true })
			chrome.tabs.update(tab.id, { active: true })
		})

		tabsList.appendChild(tabElement)
	}

	// Handle "Disable" and "Enable" buttons

	const
		disableButton = newItem.querySelector('button.disable'),
		enableButton = newItem.querySelector('button.enable')

	if (!props.enabled) {
		newItem.classList.add('disabled')

		disableButton.classList.add('hidden')
		enableButton.classList.remove('hidden')
	}

	disableButton.addEventListener('click', async () => {
		const added = await getAdded()

		added[url].enabled = false

		chrome.storage.sync.set({ added })

		newItem.classList.add('disabled')

		disableButton.classList.add('hidden')
		enableButton.classList.remove('hidden')
	})

	enableButton.addEventListener('click', async () => {
		const added = await getAdded()

		added[url].enabled = true

		chrome.storage.sync.set({ added })

		newItem.classList.remove('disabled')

		enableButton.classList.add('hidden')
		disableButton.classList.remove('hidden')
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
			const
				added = await getAdded(),
				intervals = await getAllIntervals()

			delete added[url]
			delete intervals[url]

			chrome.storage.sync.set({ added })
			chrome.storage.local.set({ intervals })
		}
	})

	return newItem
}

const refreshListAdded = async () => {
	const
		addedEntries = Object.entries(await getAdded()),
		tabs = await chrome.tabs.query({}),
		intervals = await getAllIntervals()

	console.debug('refreshListAdded')
	console.debug('intervals = ', intervals)

	if (addedEntries.length == 0) {
		listAdded.replaceChildren()
		listAdded.classList.add('hidden')
		emptyListNotice.classList.remove('hidden')
	} else {
		// Replace new items data with Nodes
		const newItems =
			addedEntries
				.sort(([_aUrl, aProps], [_bUrl, bProps]) => bProps.addedAt - aProps.addedAt)
				.map(([url, props]) => {
					return initializeListAddedItem(url, props, tabs, intervals[url])
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
		const time = splitInterval(props.interval)

		newTimeFieldset.querySelector('input[name="minutes"]').value = time.minutes
		newTimeFieldset.querySelector('input[name="seconds"]').value = time.seconds
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

	for (const [key, value] of Object.entries(match.groups)) {
		if (!value) continue

		const element = document.createElement('span')

		element.classList.add(`url-${key}`)
		element.textContent = value

		parts.push(element)
	}

	return parts
}

// Listen for future updates of intervals

chrome.runtime.onMessage.addListener(async (request, _sender, _sendResponse) => {
	if (request.intervalsUpdated) {
		await refreshListAdded()
	}
})

// Initialize "New" form

fillFormNewInputs(currentTab.url, await getPropsByURL(currentTab.url))

newUrlInput.addEventListener('input', async event => {
	toggleNewButtons()
})

// Initialize "Added" list from storage

await refreshListAdded()

// "New" form submitting

formNew.addEventListener('submit', async event => {
	event.preventDefault()

	const
		formData = new FormData(formNew),
		newUrl = formData.get('url'),
		added = await getAdded()

	const newItem = added[newUrl] ??= {}

	added[newUrl].interval =
		parseInt(formData.get('minutes')) * 60 + parseInt(formData.get('seconds'))

	added[newUrl].addedAt ??= Date.now()

	added[newUrl].enabled = true

	chrome.storage.sync.set({ added })
})

chrome.tabs.onUpdated.addListener((tabID, changeInfo, tab) => {
	for (const tabElement of listAdded.querySelectorAll('li ul.tabs li')) {
		if (tabElement.tabID == tabID) {
			const faviconElement = tabElement.querySelector('img.favicon')

			switch (changeInfo.status) {
				case 'loading':
					faviconElement.src = chrome.runtime.getURL('images/icons/loading.gif')
					break
				case 'complete':
					faviconElement.src = tab.favIconUrl
					break
				default:
					if ('title' in changeInfo) {
						const titleElement = tabElement.querySelector('.title')

						titleElement.textContent = tab.title
					}
					break
			}
		}
	}
})
