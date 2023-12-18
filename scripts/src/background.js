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
	const
		intervals = await getAllIntervals(),
		newInterval = (intervals[URLmask] ??= {})

	newInterval.time = time
	// https://bugs.chromium.org/p/chromium/issues/detail?id=1472588
	newInterval.startAt = (new Date()).toString()
	newInterval.tabs = new Object()

	const allTabs = await chrome.tabs.query({})

	await allTabs.forEach(async (tab) => {
		if (matchURL(tab.url, URLmask)) {
			insertTabTimeout(tab, newInterval)
		}
	})

	console.debug(intervals)

	await chrome.storage.local.set({ intervals })
}

const clearTabTimeout = (timerID) => {
	return clearTimeout(timerID)
}

const clearInterval = async URLmask => {
	const intervals = await getAllIntervals()

	Object.entries(intervals[URLmask].tabs).forEach(([tabID, timerID]) => {
		chrome.scripting.executeScript({
			target : { tabId : tabID },
			func : clearTabTimeout,
			args : [timerID],
		})
	})
}

// Initialize intervals for existing `added` in storage

chrome.storage.sync.get({ added: {} }, result => {
	Object.entries(result.added).forEach(([URLmask, props]) => {
		if (!props.enabled) return

		createInterval(URLmask, props.interval)
	})
})

// Listen for future updates of "Added" in the storage

chrome.storage.onChanged.addListener(async (changes, _area) => {
	if ('added' in changes) {
		// `await` to add storage flag after all manipulations

		const
			newAdded = changes.added.newValue,
			existingIntervals = await getAllIntervals()

		if (newAdded) {
			await Object.entries(existingIntervals).forEach(async ([URLmask, existingInterval]) => {
				const addedItem = newAdded[URLmask]

				if (addedItem && addedItem.enabled) {
					if (existingInterval.time != addedItem.interval) { // changed interval
						await clearInterval(URLmask)
						await createInterval(URLmask, addedItem.interval)
					}
				} else {
					await clearInterval(URLmask)
				}
			})

			await Object.entries(newAdded).forEach(async ([URLmask, addedItem]) => {
				const existingInterval = existingIntervals[URLmask]

				if (!existingInterval && addedItem.enabled) {
					await createInterval(URLmask, addedItem.interval)
				}
			})
		} else {
			await chrome.storage.local.set({ intervals: {} })
		}

		// Now trigger the front-end update
		chrome.runtime.sendMessage({ intervalsUpdated: true })
	}
})

chrome.tabs.onUpdated.addListener(async (tabID, changeInfo, tab) => {
	const intervals = await getAllIntervals()

	Object.entries(intervals).forEach(([URLmask, interval]) => {
		if (changeInfo.status == 'loading' && matchURL(tab.url, URLmask)) {
			insertTabTimeout(tab, interval)
		}
	})
})
