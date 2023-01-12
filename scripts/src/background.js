import { matchURL } from './_common'

// Define functions

const createAlarm = (URLmask, interval) => {
	chrome.alarms.create(
		URLmask,
		{
			periodInMinutes: interval / 60
		}
	)
}

const clearAlarm = URLmask => {
	chrome.alarms.clear(URLmask)
}

// Initialize alarms for existing `added` in storage

chrome.storage.sync.get({ added: {} }, result => {
	Object.entries(result.added).forEach(([URLmask, props]) => {
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
	if ('added' in changes) {
		const
			newAdded = changes.added.newValue,
			existingAlarms =
				(await chrome.alarms.getAll())
					.reduce((result, alarm) => { result[alarm.name] = alarm; return result }, {})

		Object.entries(existingAlarms).forEach(([URLmask, existingAlarm]) => {
			const addedItem = newAdded[URLmask]

			if (addedItem) {
				if ((existingAlarm.periodInMinutes * 60) != addedItem.interval) { // changed interval
					clearAlarm(URLmask)
					createAlarm(URLmask, addedItem.interval)
				}
			} else {
				clearAlarm(URLmask)
			}
		})

		Object.entries(newAdded).forEach(([URLmask, addedItem]) => {
			const existingAlarm = existingAlarms[URLmask]

			if (!existingAlarm) {
				createAlarm(URLmask, addedItem.interval)
			}
		})
	}
})
