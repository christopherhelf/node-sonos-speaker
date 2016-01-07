var sonos = require('./device');
var async = require('async');
var util = require('util');

/**
 * Simple NodeSonos Wrapper
 * @param {String} volume [Default volume at which the voice should be played]
 * @param {Number} searchInterval [Default searchinterval at which we want to search for new devices]
 */
function AirSonos(volume, searchInterval) {
	this.devices = [];
	this.defaultVolume = volume || "30";
	this.defaultSearchInterval = searchInterval || 6000;
	this.defaultFadeTime = 0.75;
	this.defaultFadeStepTime = 0.25;
	this.defaultTrackReversion = 1.0;
}
 
/**
 * Search for devices and store them
 */
AirSonos.prototype.searchForDevices = function() {
	
	var self = this;
	this.search = new sonos.Search(self.defaultSearchInterval, function(err, device) {
		
		if (err) { return console.log(err); }
		console.log("Sonos Device ("+device.model+") found @ " + device.host + ":" + device.port);
		self.devices.push(device);

	});
}

/**
 * Plays a sound on all current devices
 * @param  {String} uri [URI to be played]
 * @param  {Function} cb [Function(err, result) to be called upon completion]
 */
AirSonos.prototype.play = function(uri, cb) {

	// Check if we have devices
	if(this.devices.length == 0) {
		return cb("No Sonos devices found");
	}
	
	var functions = {};

	for(var i=0; i<this.devices.length; i++) {
		var device = this.devices[i];
		functions[device.host + ":" + device.port] = this.createPlayFunction(this.devices[i], uri);
	}

	// Execute all functions in parallel
	async.parallel(functions, cb);
}


/**
 * Creates a function to be used in async which optionally fades out the current music,
 * plays the voice, and then fades the current song back in
 * @param  {Object} device [Device on which we want to play the voice]
 * @param  {String} uri [URI to be played]
 */
AirSonos.prototype.createPlayFunction = function(device, uri) {

	var self = this;

	return function(callback) {

		// Get State Information
		device.getState(function(err, results) {

			if(err) { return callback(err); }

			var state = results[0] == "playing" ? true : false; // Whether the device is currently playing
			var volume = results[1]; // Current volume
			var track = results[2]; // Current track
			var queuePosition = results[3]; // Current position in queue
			var queueLength = results[4]; // Current queue length
			var playMode = results[5]; // Current playmode
			var mediaInfo = results[6]; // Media Info
			var muted = results[7]; // Get muted info
			var nrtracks = parseInt(mediaInfo.NrTracks); // Nr of tracks in queue
			var currentURI = results[8]; // Current URI that's playing
			var currentURIMetaData = mediaInfo.CurrentURIMetaData; //Curent Metadata Info
			var position = track ? Math.max(parseInt(track.position)-self.defaultTrackReversion,0) : 0; // Position within the track, go back one second

			// Our list of functions we want to apply to the device
			var funcs = [];

			// If the song is playing, fade it out, stop it and set the volume to our targeted value,
			// otherwise simply adjust the volume
			if(state) {
				funcs.push({ name: 'muteStopAndSetVolume', args: [self.defaultFadeTime, self.defaultFadeStepTime, self.defaultVolume]} );
			} else {
				funcs.push({ name: 'setVolume', args: [self.defaultVolume]} )
			}

			// Disable mute if it was muted before
			if(muted) {
				funcs.push({ name: 'setMuted', args:[false]});
			}

			// We will temporarily set the playmode to normal, so we can play tracks in order
			funcs.push({ name: 'setPlayMode', args: ['NORMAL']});

			// Determine whether we are playing from a radio, or a playlist, also check for an empty queue
			var radio = (nrtracks == 1) || (queueLength == 0) ? true : false;
			
			if (radio) {
				// We are playing from a radio, there is no queue
				funcs.push( { name: 'play', args: [uri]}); // Play the voice
				funcs.push( { name: 'waitUntilPlayingIsFinished'}); // Wait until we finished playing
				if(muted) { funcs.push({ name: 'setMuted', args:[muted]}); } // Reset muted flag if necessary

				if (queueLength != 0) {
					// Here is a tricky part, this sometimes doesn't seem to work?
					if (currentURI.indexOf('x-sonos-spotify:spotify') !== -1) {

						var trackId = currentURI.replace("x-sonos-spotify:spotify%3atrack%3a", "");
						trackId = trackId.split("?")[0];
						funcs.push( { name: 'addSpotify', args: [trackId]});

					} else {
						funcs.push( { name: 'queueNext', args: [  { uri: currentURI, metadata: currentURIMetaData }]}); // Set to radio again
					}
				} else {
					funcs.push( { name: 'removeAllTracksFromQueue'}); //remove the voice from the queue again
				}

			} else {
				// We are playing from a queue
				funcs.push( { name: 'queue', args: [uri]}); // Queue the voice
				funcs.push( { name: 'changeTrack', args: [queueLength+1]}); // Change track to the newly added track
				funcs.push( { name: 'play'}); // Play the voice
				funcs.push( { name: 'waitUntilPlayingIsFinished'}); //Wait until we finished playing
				if(muted) { funcs.push({ name: 'setMuted', args:[muted]}); } // Reset muted flag if necessary
				
				funcs.push( { name: 'changeTrack', args: [queuePosition]}); // Change back to the original track
				funcs.push( { name: 'seek', args: [position]}); // Change back to the original position in the track
				funcs.push( { name: 'removeFromQueue', args: [queueLength+1]}); // Remove the voice from the queue

			}

			// Check if we played before
			if (state && queueLength != 0) {
				funcs.push({ name: 'setVolume', args: [0.0]} ); // Set the volume to zero
				funcs.push({ name: 'play'}); // Play
				funcs.push({ name: 'fadeTo', args: [volume, self.defaultFadeTime, self.defaultFadeStepTime]}); // Fade in
			} else {
				// Song wasn't played, simply set the volume
				funcs.push({ name: 'setVolume', args: [volume]} );
			}

			// Reset the play mode to the original value
			funcs.push({ name: 'setPlayMode', args: [playMode]});

			// Call all function in series
			device.applyFunctions('series', funcs, callback);

		})
	}

}

module.exports = AirSonos;