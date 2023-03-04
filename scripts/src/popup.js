import { getAdded, completeDecodeURL, matchURL, getAllAlarmsAsObject } from './_common'

const [currentTab] = await chrome.tabs.query({
	active: true, lastFocusedWindow: true
})

const
	sectionAdded = document.querySelector('section.added'),
	listAdded = sectionAdded.querySelector('ul.added'),
	addedItemTemplate = sectionAdded.querySelector('template.added-item'),
	formItemTemplate = sectionAdded.querySelector('template.form-item'),
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

const initializeAddedItem = (url, props, tabs, alarm) => {
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

	fillTimeSpan(
		timeContainer.querySelector('.left'),
		alarm ? Math.round((alarm.scheduledTime - Date.now()) / 1000) : props.interval
	)

	if (alarm) {
		// NOTE: `alarm.scheduledTime` doesn't update at intervals and become negative

		setTimeout(
			() => {
				// Call after the short timeout
				updateTimeElements()

				setInterval(updateTimeElements, 1000)
			},
			(alarm.scheduledTime - Date.now()) % 1000
		)
	}

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
	})

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
	// TODO: Update

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

const initializeFormItem = (url, props) => {
	// There is `DocumentFragment` without `firstElementChild`
	// https://developer.mozilla.org/en-US/docs/Web/HTML/Element/template#avoiding_documentfragment_pitfall
	const newItem = formItemTemplate.content.firstElementChild.cloneNode(true)

	if (matchURL(currentTab.url, url)) newItem.classList.add('current')

	const
		form = newItem.querySelector('form'),
		urlInput = form.querySelector('input[name="url"]'),
		addButton = form.querySelector('button.add'),
		updateButton = form.querySelector('button.update')

	urlInput.value = completeDecodeURL(url)

	const toggleFormButtons = async () => {
		const
			currentProps = await getPropsByURL(urlInput.value),
			isPropsExist = Boolean(currentProps)

		addButton.classList.toggle('hidden', isPropsExist)
		updateButton.classList.toggle('hidden', !isPropsExist)
	}

	urlInput.addEventListener('input', async event => {
		toggleFormButtons()
	})

	const time = splitInterval(props.interval)

	form.querySelector('input[name="minutes"]').value = time.minutes
	form.querySelector('input[name="seconds"]').value = time.seconds

	form.addEventListener('submit', async event => {
		event.preventDefault()

		const
			formData = new FormData(form),
			newUrl = formData.get('url'),
			added = await getAdded()

		const newAdded = added[newUrl] ??= {}

		newAdded.interval =
			parseInt(formData.get('minutes')) * 60 + parseInt(formData.get('seconds'))

		newAdded.addedAt ??= Date.now()

		newAdded.enabled = true

		chrome.storage.sync.set({ added })
	})

	toggleFormButtons()

	return newItem
}

const refreshListAdded = async () => {
	const
		added = await getAdded(),
		tabs = await chrome.tabs.query({}),
		alarms = await getAllAlarmsAsObject()

	// Replace new items data with Nodes
	const newItems =
		Object.entries(added)
			.sort(([_aUrl, aProps], [_bUrl, bProps]) => bProps.addedAt - aProps.addedAt)
			.map(([url, props]) => {
				if (url == currentTab.url) {
					return initializeFormItem(url, props)
				} else {
					return initializeAddedItem(url, props, tabs, alarms[url])
				}
			})

	if (!added[currentTab.url]) {
		newItems.unshift(initializeFormItem(currentTab.url, { interval: 5 * 60 }))
	}

	listAdded.replaceChildren(...newItems)
}

const getPropsByURL = async (url) => {
	const added = await getAdded()

	return added[url]
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

// Listen for future updates of Alarms

chrome.runtime.onMessage.addListener(async (request, _sender, _sendResponse) => {
	if (request.alarmsUpdated) {
		await refreshListAdded()
	}
})

// Initialize "Added" list from storage

await refreshListAdded()

chrome.tabs.onUpdated.addListener((tabID, changeInfo, tab) => {
	listAdded.querySelectorAll('li ul.tabs li').forEach(tabElement => {
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
	})
})
