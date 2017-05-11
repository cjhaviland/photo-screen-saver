/*
 *  Copyright (c) 2015-2017, Michael A. Updike All rights reserved.
 *
 *  Redistribution and use in source and binary forms, with or without
 *  modification, are permitted provided that the following conditions are met:
 *
 *  Redistributions of source code must retain the above copyright notice,
 *  this list of conditions and the following disclaimer.
 *
 *  Redistributions in binary form must reproduce the above copyright notice,
 *  this list of conditions and the following disclaimer in the documentation
 *  and/or other materials provided with the distribution.
 *
 *  Neither the name of the copyright holder nor the names of its contributors
 *  may be used to endorse or promote products derived from this software
 *  without specific prior written permission.
 *
 *  THIS SOFTWARE IS PROVIDED BY THE COPYRIGHT HOLDERS AND CONTRIBUTORS "AS IS"
 *  AND ANY EXPRESS OR IMPLIED WARRANTIES, INCLUDING, BUT NOT LIMITED TO,
 *  THE IMPLIED WARRANTIES OF MERCHANTABILITY AND FITNESS FOR A PARTICULAR
 *  PURPOSE ARE DISCLAIMED. IN NO EVENT SHALL THE COPYRIGHT HOLDER OR
 *  CONTRIBUTORS BE LIABLE FOR ANY DIRECT, INDIRECT, INCIDENTAL, SPECIAL,
 *  EXEMPLARY, OR CONSEQUENTIAL DAMAGES (INCLUDING, BUT NOT LIMITED TO,
 *  PROCUREMENT OF SUBSTITUTE GOODS OR SERVICES; LOSS OF USE, DATA, OR PROFITS;
 *  OR BUSINESS INTERRUPTION) HOWEVER CAUSED AND ON ANY THEORY OF LIABILITY,
 *  WHETHER IN CONTRACT, STRICT LIABILITY, OR TORT (INCLUDING NEGLIGENCE OR
 *  OTHERWISE) ARISING IN ANY WAY OUT OF THE USE OF THIS SOFTWARE,
 *  EVEN IF ADVISED OF THE POSSIBILITY OF SUCH DAMAGE.
 */
(function() {
	'use strict';

	/**
	 * The background script for the extension.<br>
	 * @namespace app.Background
	 */

	/**
	 * Event: Fired when the extension is first installed,<br />
	 * when the extension is updated to a new version,<br />
	 * and when Chrome is updated to a new version.
	 * @see https://developer.chromse.com/extensions/runtime#event-onInstalled
	 * @param {object} details - type of event
	 * @private
	 * @memberOf app.Background
	 */
	function _onInstalled(details) {
		// create menus on the right click menu of the extension icon
		chrome.contextMenus.create({
			type: 'normal',
			id: 'ENABLE_MENU',
			title: app.Utils.localize('disable'),
			contexts: ['browser_action'],
		});
		chrome.contextMenus.create({
			type: 'separator',
			id: 'SEP_MENU',
			contexts: ['browser_action'],
		});

		if (details.reason === 'install') {
			app.BGUtils.initializeData();
			app.BGUtils.showOptionsTab();
		} else if (details.reason === 'update') {
			// extension updated
			app.BGUtils.updateData();
		}
	}

	/**
	 * Event: Fired when a profile that has this extension installed first
	 * starts up
	 * @see https://developer.chrome.com/extensions/runtime#event-onStartup
	 * @private
	 * @memberOf app.Background
	 */
	function _onStartup() {
		app.BGUtils.processState('all');
	}

	/**
	 * Event: Fired when a browser action icon is clicked.
	 * @see https://goo.gl/abVwKu
	 * @private
	 * @memberOf app.Background
	 */
	function _onIconClicked() {
		app.BGUtils.showOptionsTab();
	}

	/**
	 * Event: Fired when item in localStorage changes
	 * @see https://developer.mozilla.org/en-US/docs/Web/Events/storage
	 * @param {Event} event
	 * @param {string} event.key - storage item that changed
	 * @private
	 * @memberOf app.Background
	 */
	function _onStorageChanged(event) {
		app.BGUtils.processState(event.key);
	}

	/**
	 * Event: Fired when a context menu item is clicked.
	 * @see https://developer.chrome.com/extensions/contextMenus#event-onClicked
	 * @param {Object} info - info. on the clicked menu
	 * @param {Object} info.menuItemId - menu name
	 * @private
	 * @memberOf app.Background
	 */
	function _onMenuClicked(info) {
		if (info.menuItemId === 'ENABLE_MENU') {
			app.BGUtils.toggleEnabled();
		}
	}

	/**
	 * Event: Fired when a registered command is activated using
	 * a keyboard shortcut.
	 * @see https://developer.chrome.com/extensions/commands#event-onCommand
	 * @param {String} cmd
	 * @private
	 * @memberOf app.Background
	 */
	function _onKeyCommand(cmd) {
		if (cmd === 'toggle-enabled') {
			app.BGUtils.toggleEnabled();
		}
	}

	// noinspection JSUnusedLocalSymbols
	/**
	 * Event: Fired when a message is sent from either an extension process<br>
	 * (by runtime.sendMessage) or a content script (by tabs.sendMessage).
	 * @see https://developer.chrome.com/extensions/runtime#event-onMessage
	 * @param {object} request - details for the message
	 * @param {string} request.message - name of the message
	 * @param {object} sender - MessageSender object
	 * @param {function} response - function _to call once after processing
	 * @return {boolean} true if asynchronous
	 * @private
	 * @memberOf app.Background
	 */
	function _onChromeMessage(request, sender, response) {
		if (request.message === 'restoreDefaults') {
			app.BGUtils.restoreDefaults();
		}
		return false;
	}

	// listen for extension install or update
	chrome.runtime.onInstalled.addListener(_onInstalled);

	// listen for Chrome starting
	chrome.runtime.onStartup.addListener(_onStartup);

	// listen for click on the icon
	chrome.browserAction.onClicked.addListener(_onIconClicked);

	// listen for changes to the stored data
	addEventListener('storage', _onStorageChanged, false);

	// listen for chrome messages
	chrome.runtime.onMessage.addListener(_onChromeMessage);

	// listen for clicks on context menus
	chrome.contextMenus.onClicked.addListener(_onMenuClicked);

	// listen for special keyboard commands
	chrome.commands.onCommand.addListener(_onKeyCommand);
})();
