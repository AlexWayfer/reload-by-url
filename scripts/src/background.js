import { matchURL, getAllAlarmsAsObject } from './_common'

// Define functions

const createAlarm = (URLmask, interval) => {
	return chrome.alarms.create(
		URLmask,
		{
			periodInMinutes: interval / 60
		}
	)
}

const clearAlarm = URLmask => {
	return chrome.alarms.clear(URLmask)
}

// Initialize alarms for existing `added` in storage

chrome.storage.sync.get({ added: {} }, result => {
	Object.entries(result.added).forEach(([URLmask, props]) => {
		if (!props.enabled) return

		createAlarm(URLmask, props.interval)
	})
})

// Listen to Alarms

chrome.alarms.onAlarm.addListener(async alarm => {
	(await chrome.tabs.query({})).forEach(tab => {
		if (matchURL(tab.url, alarm.name)) {
			chrome.tabs.reload(tab.id)
		}
	})
})

// Listen for future updates of "Added" in the storage

chrome.storage.onChanged.addListener(async (changes, _area) => {
	console.debug('storage onChanged in background', _area, changes)
	if ('added' in changes) {
		// `await` to add storage flag after all manipulations

		const
			newAdded = changes.added.newValue,
			existingAlarms = await getAllAlarmsAsObject()

		if (newAdded) {
			await Object.entries(existingAlarms).forEach(async ([URLmask, existingAlarm]) => {
				const addedItem = newAdded[URLmask]

				if (addedItem && addedItem.enabled) {
					if ((existingAlarm.periodInMinutes * 60) != addedItem.interval) { // changed interval
						await clearAlarm(URLmask)
						await createAlarm(URLmask, addedItem.interval)
					}
				} else {
					await clearAlarm(URLmask)
				}
			})

			await Object.entries(newAdded).forEach(async ([URLmask, addedItem]) => {
				const existingAlarm = existingAlarms[URLmask]

				if (!existingAlarm && addedItem.enabled) {
					await createAlarm(URLmask, addedItem.interval)
				}
			})
		} else {
			await chrome.alarms.clearAll()
		}

		// Now trigger the front-end update
		console.debug('storage.local.set alarmsUpdated')
		chrome.storage.local.set({ alarmsUpdated: true })
	}
})
