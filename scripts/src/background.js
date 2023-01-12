import { getAdded, findMinimalAdded } from './_common'

// Define global constants

const timers = {}

// Define functions

const addTimer = (tabID, interval) => {
	timers[tabID] = {
		interval: interval,
		intervalID: setInterval(() => {
			chrome.tabs.reload(tabID)
		}, interval * 1000)
	}
}

const removeTimer = tabID => {
	clearInterval(timers[tabID].intervalID)
	delete timers[tabID]
}

// Initialize timers at extension initialization

chrome.tabs.query({}, async tabs => {
	const added = await getAdded()

	tabs.forEach(tab => {
		const props = findMinimalAdded(tab.url, added)

		if (props) {
			addTimer(tab.id, props.interval)
		}
	})
})

// Listen for any URL change in existing tabs

chrome.tabs.onUpdated.addListener(async (tabID, changeInfo, tab) => {
	if (changeInfo.status === 'complete') {
		const
			added = await getAdded(),
			props = findMinimalAdded(tab.url, added)

		if (timers[tabID] && (!props || props.interval < timers[tabID].interval)) {
			removeTimer(tabID)
		}

		if ((props) && (!timers[tabID] || props.interval < timers[tabID].interval)) {
			addTimer(tabID, props.interval)
		}
	}
})

// Listen for tabs closing

chrome.tabs.onRemoved.addListener((tabID, removeInfo) => {
	removeTimer(tabID)
})

// Listen for future updates of "Added" in the storage

chrome.storage.onChanged.addListener((changes, _area) => {
	if ('added' in changes) {
		const newAdded = changes.added.newValue

		chrome.tabs.query({}, tabs => {
			tabs.forEach(tab => {
				const
					props = findMinimalAdded(tab.url, newAdded),
					existingTimer = timers[tab.id]

				if (props) {
					if (existingTimer) { // both exist
						if (existingTimer.interval != props.interval) { // changed interval
							removeTimer(tab.id)
							addTimer(tab.id, props.interval)
						}
					} else { // add new timer
						addTimer(tab.id, props.interval)
					}
				} else if (existingTimer) { // if no in `added` but active in `timers`
					removeTimer(tab.id)
				}
			})
		})
	}
})
