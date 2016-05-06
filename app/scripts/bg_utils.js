/*
@@license
*/
/*exported bgUtils*/
var bgUtils = (function() {
	'use strict';

	// minutes in day
	var MIN_IN_DAY = 60 * 24;

	// milli-seconds in day
	var MSEC_IN_DAY = MIN_IN_DAY * 60 * 1000;

	// get time
	// value format: '00:00'
	function _getTime(value) {
		var date = new Date();

		date.setHours(parseInt(value.substr(0,2)));
		date.setMinutes(parseInt(value.substr(3,2)));
		date.setSeconds(0);
		date.setMilliseconds(0);
		return date.getTime();
	}

	// calculate delta in time from now in minutes on a 24 hr basis
	// value format: '00:00'
	function _getTimeDelta(value) {
		var curTime = Date.now();
		var time = _getTime(value);
		var delayMin = (time - curTime) / 1000 / 60;

		if (delayMin < 0) {
			delayMin = MIN_IN_DAY + delayMin;
		}
		return delayMin;
	}

	// is the current time between start and stop inclusive
	function _isInRange(start, stop) {
		var curTime = Date.now();
		var startTime = _getTime(start);
		var stopTime = _getTime(stop);
		var ret = false;

		if (start === stop) {
			return true;
		}

		if (stopTime > startTime) {
			if ((curTime >= startTime) && (curTime <= stopTime)) {
				ret = true;
			}
		} else {
			if ((curTime >= startTime) || (curTime <= stopTime)) {
				ret = true;
			}
		}
		return ret;
	}

	// determine if there is a fullscreen chrome window running on a display
	// callback function(isTrue)
	function _hasFullscreen(display, callback) {

		if (JSON.parse(localStorage.chromeFullscreen)) {
			chrome.windows.getAll({populate: false}, function(wins) {
				var win;
				var left = display ? display.bounds.left : 0;
				var top = display ? display.bounds.top : 0;
				for (var i = 0; i < wins.length; i++) {
					win = wins[i];
					if (win.state === 'fullscreen' && (!display || (win.top === top && win.left === left))) {
						callback(true);
						return;
					}
				}
				callback(false);
			});
		} else {
			callback(false);
		}
	}

	// open a screen saver window on the given display
	function _openScreenSaver(display) {
		_hasFullscreen(display, function(isTrue) {
			// don't display if there is a fullscreen window
			var left = display ? display.bounds.left : 0;
			var top = display ? display.bounds.top : 0;
			if (!isTrue) {
				if (myUtils.getChromeVersion() >= 44 && !display) {
					// Chrome supports fullscreen option on create since version 44
					chrome.windows.create({
						url: '/html/screensaver.html',
						focused: true,
						type: 'popup',
						state: 'fullscreen'
					});
				} else {
					chrome.windows.create({
						url: '/html/screensaver.html',
						left: left,
						top: top,
						width: 1,
						height: 1,
						focused: true,
						type: 'popup'
					}, function(win) {
						chrome.windows.update(win.id, {state: 'fullscreen'});
					});
				}
			}
		});
	}

	// open a screensaver on every display
	function _openScreenSavers() {
		chrome.system.display.getInfo(function(displayInfo) {
			if (displayInfo.length === 1) {
				_openScreenSaver(null);
			} else {
				for (var i = 0; i < displayInfo.length; i++) {
					_openScreenSaver(displayInfo[i]);
				}
			}
		});
	}

	// add alarm to set the text on the icon
	// always set badge text through this
	function _updateBadgeText() {
		// delay setting a little to make sure range check is good
		chrome.alarms.create('setBadgeText', {when: Date.now() + 250});
	}

	// create active period scheduling alarms
	// create a daily alarm to update live photostreams
	function _updateRepeatingAlarms() {
		var keepAwake = JSON.parse(localStorage.keepAwake);
		var aStart = JSON.parse(localStorage.activeStart);
		var aStop = JSON.parse(localStorage.activeStop);

		if (keepAwake && aStart !== aStop) {
			var startDelayMin = _getTimeDelta(aStart);
			var stopDelayMin = _getTimeDelta(aStop);

			chrome.alarms.create('activeStart', {
				delayInMinutes: startDelayMin,
				periodInMinutes: MIN_IN_DAY
			});
			chrome.alarms.create('activeStop',{
				delayInMinutes: stopDelayMin,
				periodInMinutes: MIN_IN_DAY
			});

			// if we are currently outside of the active range
			// then set inactive state
			if (!_isInRange(aStart, aStop)) {
				bgUtils.setInactiveState();
			}
		} else {
			chrome.alarms.clear('activeStart');
			chrome.alarms.clear('activeStop');
		}

		// Add daily alarm to update photo sources that request this
		chrome.alarms.get('updatePhotos', function(alarm) {
			if (!alarm) {
				chrome.alarms.create('updatePhotos', {
					when: Date.now() + MSEC_IN_DAY,
					periodInMinutes: MIN_IN_DAY
				});
			}
		});
	}

	// enabled state of screensaver
	// note: this does not effect the keep awake settings so you could
	// use the extension as a display keep awake scheduler without
	// using the screensaver
	function _processEnabled() {
		// update context menu text
		var label = JSON.parse(localStorage.enabled) ? 'Disable' : 'Enable';
		_updateBadgeText();
		chrome.contextMenus.update('ENABLE_MENU', {title: label}, function() {
			if (chrome.runtime.lastError) {
				console.log(chrome.runtime.lastError.message);
			}
		});
	}

	// power scheduling features
	function _processKeepAwake() {
		JSON.parse(localStorage.keepAwake) ? chrome.power.requestKeepAwake('display') : chrome.power.releaseKeepAwake();
		_updateRepeatingAlarms();
		_updateBadgeText();
	}

	// wait time for screensaver after machine is idle
	function _processIdleTime() {
		chrome.idle.setDetectionInterval(parseInt(localStorage.idleTime, 10) * 60);
	}

	return {

		MIN_IN_DAY: MIN_IN_DAY,

		MSEC_IN_DAY: MSEC_IN_DAY,

		// initialize the data in local storage
		initData: function() {
			// using local storage as a quick and dirty replacement for MVC
			// not using chrome.storage 'cause the async nature of it complicates things
			// just remember to use parse methods because all values are strings

			localStorage.version = '7';

			var VALS = {
				'enabled': 'true',
				'idleTime': '5', // minutes
				'transitionTime': '30', // seconds
				'skip': 'true',
				'shuffle': 'true',
				'photoSizing': '0',
				'photoTransition': '4',
				'showTime': '1', // 12 hr format default
				'showPhotog': 'true',
				'background': '"background:linear-gradient(to bottom, #3a3a3a, #b5bdc8)"',
				'keepAwake': 'false',
				'chromeFullscreen': 'true',
				'allDisplays': 'false',
				'activeStart': '"00:00"', // 24 hr time
				'activeStop': '"00:00"', // 24 hr time
				'allowSuspend': 'false',
				'useSpaceReddit': 'false',
				'useEarthReddit': 'false',
				'useAnimalReddit': 'false',
				'useEditors500px': 'false',
				'usePopular500px': 'false',
				'useYesterday500px': 'false',
				'useInterestingFlickr': 'false',
				'useChromecast': 'true',
				'useAuthors': 'false',
				'useGoogle': 'true',
				'albumSelections': '[]',
				'useFlickr': 'true',
				'useFlickrSelections': '[]',
				'use500px': 'true',
				'use500pxSelections': '[]',
				'useReddit': 'true',
				'useRedditSelections': '[]'
			};

			Object.keys(VALS).forEach(function(key) {
				if (!localStorage.getItem(key)) {
					localStorage.setItem(key, VALS[key]);
				}
			});

			// remove unused variables
			localStorage.removeItem('isPreview');
			localStorage.removeItem('windowID');
			localStorage.removeItem('useFavoriteFlickr');
		},

		// send message to the option tab to focus it.
		// if not found, create it
		showOptionsTab: function() {
			chrome.runtime.sendMessage({window: 'highlight'}, null, function(response) {
				if (!response) {
					// no one listening
					chrome.tabs.create({url: '../html/options.html'});
				}
			});
		},

		// return true if screensaver can be displayed
		isActive: function() {
			var enabled = JSON.parse(localStorage.enabled);
			var keepAwake = JSON.parse(localStorage.keepAwake);
			var aStart = JSON.parse(localStorage.activeStart);
			var aStop = JSON.parse(localStorage.activeStop);

			// do not display if screen saver is not enabled or
			// keepAwake scheduler is enabled and is in the inactive range
			return !(!enabled || (keepAwake && !_isInRange(aStart, aStop)));

		},

		// set state when the screensaver is in the active range
		setActiveState: function() {
			if (JSON.parse(localStorage.keepAwake)) {
				chrome.power.requestKeepAwake('display');
			}
			var interval = parseInt(localStorage.idleTime, 10) * 60;
			chrome.idle.queryState(interval, function(state) {
				// display screensaver if the idle time criteria is met
				if (state === 'idle') {
					bgUtils.displayScreenSaver();
				}
			});
			_updateBadgeText();
		},

		// set state when the screensaver is in the non-active range
		setInactiveState: function() {
			JSON.parse(localStorage.allowSuspend) ? chrome.power.releaseKeepAwake() :
				chrome.power.requestKeepAwake('system');
			bgUtils.closeScreenSavers();
			_updateBadgeText();
		},

		// toggle enabled state
		toggleEnabled: function() {
			localStorage.enabled = !JSON.parse(localStorage.enabled);
			// storage changed event not fired on same page as the change
			_processEnabled();
		},

		// process changes to localStorage settings
		processState: function(key) {
			// Map processing functions to localStorage values
			var STATE_MAP = {
				'enabled': _processEnabled,
				'keepAwake': _processKeepAwake,
				'activeStart': _processKeepAwake,
				'activeStop': _processKeepAwake,
				'allowSuspend': _processKeepAwake,
				'idleTime': _processIdleTime
			};
			var noop = function() {};
			var called = [];
			var fn;

			if (key === 'all') {
				Object.keys(STATE_MAP).forEach(function(ky) {
					fn = STATE_MAP[ky];
					if (called.indexOf(fn) === -1) {
						// track functions we have already called
						called.push(fn);
						return fn();
					}
				});
				// process photo SOURCES
				photoSources.processAll();
			} else {
				// individual change
				if (photoSources.contains(key)) {
					photoSources.process(key);
				} else {
					(STATE_MAP[key] || noop)();
				}
			}
		},

		// always request screensaver through this call
		displayScreenSaver: function(single) {
			if (!single && JSON.parse(localStorage.allDisplays)) {
				_openScreenSavers();
			} else {
				_openScreenSaver(null);
			}
		},

		// send message to the screen savers to close themselves
		closeScreenSavers: function() {
			chrome.runtime.sendMessage({window: 'close'});
		}

	};
})();
