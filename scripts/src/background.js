import {
	matchURL, getAllIntervals, timeUntilNextTimeout
} from './_common'

// Define functions

const createTabTimeout = async (tabId, interval) => {
	console.debug('createTabTimeout')

	const injectionResult = await chrome.scripting.executeScript({
		target: { tabId },
		func: (timeInSeconds) => {
			console.debug(`setTimeout ${timeInSeconds}`)

			timeoutID = setTimeout(() => {
				location.reload()
			}, timeInSeconds * 1000)

			console.debug('timeoutID = ', timeoutID)

			return timeoutID
		},
		args: [timeUntilNextTimeout(interval)],
	})

	// https://developer.chrome.com/docs/extensions/reference/scripting/#type-InjectionResult
	console.debug('injectionResult[0].result = ', injectionResult[0].result)
	interval.tabs[tabId] = injectionResult[0].result
}

const createInterval = async (URLmask, time) => {
	console.debug('createInterval')

	const
		intervals = await getAllIntervals(),
		newInterval = (intervals[URLmask] ??= {})

	newInterval.time = time
	// https://bugs.chromium.org/p/chromium/issues/detail?id=1472588
	newInterval.startAt = (new Date()).toString()
	newInterval.tabs = new Object()

	const allTabs = await chrome.tabs.query({})

	for (const tab of allTabs) {
		if (matchURL(tab.url, URLmask)) {
			await createTabTimeout(tab.id, newInterval)
		}
	}

	// console.debug('intervals = ', intervals)

	await chrome.storage.local.set({ intervals })

	// const newIntervals = await getAllIntervals()
	// console.debug('newIntervals = ', newIntervals)

	console.debug('createInterval done')
}

const removeTabTimeout = async (tabId, timeoutID) => {
	console.debug('removeTabTimeout')
	console.debug('tabId = ', tabId)
	console.debug('timeoutID = ', timeoutID)

	await chrome.scripting.executeScript({
		target: { tabId },
		func: (timeoutID) => {
			console.debug(`clearTimeout ${timeoutID}`)

			return clearTimeout(timeoutID)
		},
		args: [timeoutID]
	})
}

const removeInterval = async URLmask => {
	console.debug('removeInterval')

	const intervals = await getAllIntervals()

	// console.debug('intervals = ', intervals)

	for (let [tabId, timeoutID] of Object.entries(intervals[URLmask].tabs)) {
		await removeTabTimeout(parseInt(tabId), timeoutID)
	}

	delete intervals[URLmask]

	await chrome.storage.local.set({ intervals })
}

// Initialize intervals for existing `added` in storage

chrome.storage.sync.get({ added: {} }, result => {
	for (const [URLmask, props] of Object.entries(result.added)) {
		if (!props.enabled) continue

		createInterval(URLmask, props.interval)
	}
})

// Listen for future updates of "Added" in the storage

chrome.storage.onChanged.addListener(async (changes, _area) => {
	if ('added' in changes) {
		// `await` to add storage flag after all manipulations

		const newAdded = changes.added.newValue

		if (newAdded) {
			let existingIntervals = await getAllIntervals()

			for (const URLmask in existingIntervals) {
				const
					existingInterval = existingIntervals[URLmask],
					addedItem = newAdded[URLmask]

				if (addedItem && addedItem.enabled) {
					if (existingInterval.time != addedItem.interval) { // changed interval
						await removeInterval(URLmask)
						await createInterval(URLmask, addedItem.interval)
					}
				} else {
					await removeInterval(URLmask)
				}
			}

			// Refresh data after `removeInterval`
			existingIntervals = await getAllIntervals()

			for (const URLmask in newAdded) {
				const
					addedItem = newAdded[URLmask],
					existingInterval = existingIntervals[URLmask]

				if (!existingInterval && addedItem.enabled) {
					await createInterval(URLmask, addedItem.interval)
				}
			}
		} else {
			await chrome.storage.local.set({ intervals: {} })
		}

		// Now trigger the front-end update
		console.debug('sendMessage intervalsUpdated')
		chrome.runtime.sendMessage({ intervalsUpdated: true })
	}
})

chrome.tabs.onUpdated.addListener(async (tabId, changeInfo, tab) => {
	// console.debug('chrome.tabs.onUpdated')
	// console.debug('changeInfo.status = ', changeInfo.status)

	const intervals = await getAllIntervals()

	let intervalsUpdated = false

	for (const URLmask in intervals) {
		const interval = intervals[URLmask]

		if (changeInfo.status == 'loading') {
			if (matchURL(tab.url, URLmask)) {
				await createTabTimeout(tab.id, interval)

				intervalsUpdated = true

				// console.debug('interval.tabs = ', interval.tabs)
			} else {
				const timeoutID = interval.tabs[tabId]

				if (timeoutID) {
					await removeTabTimeout(tabId, timeoutID)

					intervalsUpdated = true
				}
			}
		}
	}

	if (intervalsUpdated) {
		// console.debug('intervals = ', intervals)
		await chrome.storage.local.set({ intervals })

		// const newIntervals = await getAllIntervals()
		// console.debug('newIntervals = ', newIntervals)
	}
})
