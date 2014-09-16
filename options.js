var useOldSounds = document.getElementById('use-old-sounds');

var setUseOldSounds = function(on) {
	useOldSounds.setAttribute('data-on', on);
	useOldSounds.setAttribute('value', 'Use old Lichess sounds (' + (on === 'true' ? 'on' : 'off') + ')');
	useOldSounds.style.backgroundColor = (on === 'true' ? 'rgb(100,200,60)' : '#fff');
	useOldSounds.style.color = (on === 'true' ? '#fff' : '#000');
};

chrome.storage.sync.get(['useOldSounds'], function(data) {
	setUseOldSounds(data.useOldSounds);
});

useOldSounds.addEventListener('click', function(event) {
	var on = this.getAttribute('data-on');

	if (on === 'true') setUseOldSounds('false');
	else setUseOldSounds('true');

	chrome.storage.sync.set({'useOldSounds': this.getAttribute('data-on')}, function() {
		var status = document.getElementById('status');
		status.innerText = 'You may need to refresh Lichess for your new preferences to take effect.';
		setTimeout(function() {
			status.innerText = '';
		}, 4000);
	});
});
