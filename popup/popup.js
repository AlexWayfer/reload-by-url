const [currentTab] = await chrome.tabs.query({
	active: true, lastFocusedWindow: true
})

const newSection = document.querySelector('section.new')

newSection.querySelector('input.url').value = currentTab.url
