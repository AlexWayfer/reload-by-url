import {
	matchURL, getAllIntervals, timeUntilNextTimeout
} from './_common'

// Define functions

const createTabTimeout = (timeInSeconds) => {
	return setTimeout(() => {
		location.reload()
	}, timeInSeconds * 1000)
}

const insertTabTimeout = async (tab, interval) => {
	await chrome.scripting.executeScript({
		target : { tabId : tab.id },
		func : createTabTimeout,
		args : [timeUntilNextTimeout(interval)],
	}, injectionResult => {
		// https://developer.chrome.com/docs/extensions/reference/scripting/#type-InjectionResult
		interval.tabs[tab.id] = injectionResult[0].result
	})
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
			insertTabTimeout(tab, newInterval)
		}
	}

	console.debug('intervals = ', intervals)

	await chrome.storage.local.set({ intervals })

	console.debug('createInterval done')
}

const clearTabTimeout = (timerID) => {
	return clearTimeout(timerID)
}

const removeInterval = async URLmask => {
	console.debug('removeInterval')

	const intervals = await getAllIntervals()

	for (const [tabID, timerID] of Object.entries(intervals[URLmask].tabs)) {
		await chrome.scripting.executeScript({
			target : { tabId : tabID },
			func : clearTabTimeout,
			args : [timerID],
		})
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

chrome.tabs.onUpdated.addListener(async (tabID, changeInfo, tab) => {
	const intervals = await getAllIntervals()

	for (const URLmask in intervals) {
		if (changeInfo.status == 'loading' && matchURL(tab.url, URLmask)) {
			insertTabTimeout(tab, intervals[URLmask])
		}
	}
})
