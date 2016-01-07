var sonos = require('sonos');
var _ = require('underscore');
var util = require('util');
var async = require('async');
var dgram = require('dgram');
var Device = sonos.Sonos;

/**
 * Returns the current track's position within the queue
 * @param  {Function} callback [Function(err, position) to be called upon success]
 */
Device.prototype.getQueuePosition = function(callback) {

	var action = '"urn:schemas-upnp-org:service:AVTransport:1#GetPositionInfo"';
  	var body = '<u:GetPositionInfo xmlns:u="urn:schemas-upnp-org:service:AVTransport:1"><InstanceID>0</InstanceID><Channel>Master</Channel></u:GetPositionInfo>';
  	var responseTag = 'u:GetPositionInfoResponse';

  	return this.request('/MediaRenderer/AVTransport/Control', action, body, responseTag, function(err, data) {

  		if (err) return callback(err);
    	if ((!util.isArray(data)) || (data.length < 1)) return callback("invalid response");

    	var track = data[0].Track;
    	if ((!util.isArray(track))) return callback("invalid response");
    	if (track.length == 0) return callback(null, 1);
    	
    	track = parseInt(track[0]);
  		return callback(null, track);
  	});
}

/**
 * Function that gets the current device's media info
 * @param  {Function} callback [Function(err, info) called upon completion]
 */
Device.prototype.getMediaInfo = function(callback) {

	var action = '"urn:schemas-upnp-org:service:AVTransport:1#GetMediaInfo"';
  	var body = '<u:GetMediaInfo xmlns:u="urn:schemas-upnp-org:service:AVTransport:1"><InstanceID>0</InstanceID><Channel>Master</Channel></u:GetMediaInfo>';
  	var responseTag = 'u:GetMediaInfoResponse';

  	return this.request('/MediaRenderer/AVTransport/Control', action, body, responseTag, function(err, data) {
  		if (err) return callback(err);
    	return callback(null, data[0]);
  	});
}

/**
 * Function that gets the current device's playmode
 * @param  {Function} callback [Function(err, playmode) called upon completion]
 */
Device.prototype.getPlayMode = function(callback) {

	var action = '"urn:schemas-upnp-org:service:AVTransport:1#GetTransportSettings"';
  	var body = '<u:GetTransportSettings xmlns:u="urn:schemas-upnp-org:service:AVTransport:1"><InstanceID>0</InstanceID><Channel>Master</Channel></u:GetTransportSettings>';
  	var responseTag = 'u:GetTransportSettingsResponse';

  	return this.request('/MediaRenderer/AVTransport/Control', action, body, responseTag, function(err, data) {
  		if (err) return callback(err);
  		if ((!util.isArray(data)) || (data.length < 1)) return callback("invalid response");
    	return callback(null, data[0].PlayMode[0]);
  	});
}

/**
 * Function that set's a device's playmode
 * @param {String} mode [The new playmode to be set, i.e. 'NORMAL']
 * @param {Function} callback [Function(err, success) to be called upon completion]
 */
Device.prototype.setPlayMode = function(mode, callback) {

	var action, body;
	action = '"urn:schemas-upnp-org:service:AVTransport:1"#SetPlayMode';
	body = '<u:SetPlayMode xmlns:u="urn:schemas-upnp-org:service:AVTransport:1"><InstanceID>0</InstanceID><NewPlayMode>'+mode+'</NewPlayMode></u:SetPlayMode>';

	return this.request('/MediaRenderer/AVTransport/Control', action, body, 'u:SetPlayModeResponse', function(err, data) {
		if (data[0].$['xmlns:u'] === 'urn:schemas-upnp-org:service:AVTransport:1') {
	      return callback(null, true);
	    } else {
	      return callback(new Error({
	        err: err,
	        data: data
	      }), false);
	    }
	});
}

/**
 * Wait until the current song has finished playing
 * @param  {Function} callback [Function(err,success) to be called when the device has stopped playing]
 */
Device.prototype.waitUntilPlayingIsFinished = function(callback) {
	var self = this;
	var waitFunc = function() {
		setTimeout(function(){
        	self.getCurrentState(function(err, playing) {
        		// Convert playing state
        		playing = playing == "playing" ? true : false;
        		// Catch errors
        		if(err) { return callback(err, null); }
        		// If we are still playing, wait, else call the cb
        		if(playing) {
        			return waitFunc();
        		} else {
        			callback(null, true);
        		}

        	});
    	}, 500);
	}
	waitFunc();
}

/**
 * Returns the total queue length
 * @param  {Function} callback [Function(err, number) the be called]
 */
Device.prototype.getQueueLength = function(callback) {

  var opts = {
    BrowseFlag: 'BrowseDirectChildren',
    Filter: '',
    StartingIndex: '0',
    RequestedCount: '1',
    SortCriteria: '',
    ObjectID: 'Q:0'
  };
  
  var contentDirectory = new sonos.Services.ContentDirectory(this.host, this.port);

  return contentDirectory.Browse(opts, function(err, data) {

  		if(err) return callback(err);

  		if(data && data.TotalMatches) {
  			return callback(null, parseInt(data.TotalMatches));
  		} else {
  			return callback(null, 0);
  		}
  });

}

/**
 * Plays a specific track at a queue position
 * @param  {Number} pos [The track number in the queue to be played]
 * @param  {Function} callback [Function(err, succeeded) to be called]
 */
Device.prototype.changeTrack = function(pos, callback) {
  
  var action, body;
  action = '"urn:schemas-upnp-org:service:AVTransport:1#Seek"';
  body = '<u:Seek xmlns:u="urn:schemas-upnp-org:service:AVTransport:1"><InstanceID>0</InstanceID><Unit>TRACK_NR</Unit><Target>' + pos + '</Target></u:Seek>';
  
  return this.request('/MediaRenderer/AVTransport/Control', action, body, 'u:SeekResponse', function(err, data) {
   
    if (err) return callback(err);

    if (data[0].$['xmlns:u'] === 'urn:schemas-upnp-org:service:AVTransport:1') {
      return callback(null, true);
    } else {
      return callback(new Error({
        err: err,
        data: data
      }), false);
    }
  });

};

/**
 * Removes a track from the list
 * @param  {Number} pos [The track number in the queue that should be removed]
 * @param  {Function} callback [Function(err,succeeded) to be called upon deletion]
 */
Device.prototype.removeFromQueue = function(pos, callback) {

	var action = '"urn:schemas-upnp-org:service:AVTransport:1#RemoveTrackRangeFromQueue"';
  	var body = '<u:RemoveTrackRangeFromQueue xmlns:u="urn:schemas-upnp-org:service:AVTransport:1"><InstanceID>0</InstanceID><StartingIndex>'+pos+'</StartingIndex><NumberOfTracks>1</NumberOfTracks><UpdateID>0</UpdateID></u:RemoveTrackRangeFromQueue>';
  	var responseTag = 'u:RemoveTrackRangeFromQueueResponse';

  	return this.request('/MediaRenderer/AVTransport/Control', action, body, responseTag, function(err, data) {
  		if (err) return callback(err);
  		return callback(null, true);
  	});

}

/**
 * Creates a function for adjusting volume of a device to be processed with async
 * @param  {Number} vol [the volume level, 0..100]
 * @param  {Number} timeout [timeout in milliseconds]
 * @return {Function} [Returns a function to be processed in async]
 */
Device.prototype.createSetVolumeFunction = function(vol, timeout) {
	var self = this;
	return function(cb) {
		setTimeout(function() {
			self.setVolume("" + vol, cb);
		}, timeout);
	}
}

/**
 * Adjusts a device's volume to a specified level via fading
 * @param  {Number} target [The target volume, a number between 0..100]
 * @param  {Number} seconds [How long the fading process should take in seconds]
 * @param  {Number} step [How long each step in adjusting the volume should take]
 * @param  {Function} callback [Function called after the full fading process completed]
 */
Device.prototype.fadeTo = function(target, seconds, step, callback) {

	var steps = seconds/step;
	var functions = [];
	var self = this;
	
	this.getVolume(function(err, vol) {

		if(err) {
			return callback(err, null);
		}

		vol = parseInt(vol);

		var diff = target - vol;
		var diffStep = diff/steps;
		var current = vol;

		for(var i=0; i<steps; i++) {
			var targetVol = Math.min(Math.max(0,current + i.toFixed(2)*diffStep),100);
			if (i == steps-1) {
				targetVol = target;
			}
			functions.push(self.createSetVolumeFunction(targetVol, step*1000));
		}

		async.series(functions, callback);

	});

}


/**
 * Fades the current song to zero volume if it's playing, stops it and then sets the volume to a specific level
 * @param {Number} seconds [Seconds for how long the fade should take]
 * @param {Number} step [Step in seconds on how long each fading step should take]
 * @param {Number} target [0..100 volume that should be set after the process]
 * @param {Function}
 */
Device.prototype.muteStopAndSetVolume = function(seconds, step, target, callback) {

	var self = this;

	// Get whether the device is playing
	self.getCurrentState(function(err, state) {

		if(err) return callback(err);

		// Switch to boolean
		var state = state == "playing" ? true : false;

		// If the device is playing, fade volume to zero, stop the song, then adjust volume
		if (state) {
			async.series([
				function(cb) {
					self.fadeTo(0, seconds, step, cb);
				},
				function(cb) {
					self.stop(cb);
				},
				function(cb) {
					self.setVolume(target, cb);
				}
			], callback);
		} else {
			// Device isn't playing, simply adjust volume
			self.setVolume(target, cb);
		}
	});

}

/**
 * Get the Current Tracks URI
 * @param  {Function} callback [Function(err, trackURI)]
 */
Device.prototype.currentTrackURI = function(callback) {

  var self = this;

  var action = '"urn:schemas-upnp-org:service:AVTransport:1#GetPositionInfo"';
  var body = '<u:GetPositionInfo xmlns:u="urn:schemas-upnp-org:service:AVTransport:1"><InstanceID>0</InstanceID><Channel>Master</Channel></u:GetPositionInfo>';
  var responseTag = 'u:GetPositionInfoResponse';

  return this.request('/MediaRenderer/AVTransport/Control', action, body, responseTag, function(err, data) {
    if (err) return callback(err);
    if ((!util.isArray(data)) || (data.length < 1)) return callback(null, null);
    return callback(null, data[0].TrackURI[0]);
  });
};

/**
 * Removes all tracks from a queue
 * @param  {Function(err,status) function to be called}
 */
Device.prototype.removeAllTracksFromQueue = function(callback) {

	var self = this;

	var action = '"urn:schemas-upnp-org:service:AVTransport:1#RemoveAllTracksFromQueue"';
	var body = '<u:RemoveAllTracksFromQueue xmlns:u="urn:schemas-upnp-org:service:AVTransport:1"><InstanceID>0</InstanceID><Channel>Master</Channel></u:RemoveAllTracksFromQueue>';
	var responseTag = 'u:RemoveAllTracksFromQueueResponse';

	return this.request('/MediaRenderer/AVTransport/Control', action, body, responseTag, function(err, data) {
		if (err) return callback(err);
		return callback(null, data);
	});
}

/**
 * Adds a spotify track to the queue
 * @param {String} track_id [The Spotify track's trackID]
 * @param {Function} callback [Function(err, playing) to be called upon completion]
 */
Device.prototype.addSpotify = function (track_id, callback) {
  var rand = '00030020'
  var uri = 'x-sonos-spotify:spotify%3atrack%3a' + track_id
  var meta = '<DIDL-Lite xmlns:dc="http://purl.org/dc/elements/1.1/" xmlns:upnp="urn:schemas-upnp-org:metadata-1-0/upnp/" xmlns:r="urn:schemas-rinconnetworks-com:metadata-1-0/" xmlns="urn:schemas-upnp-org:metadata-1-0/DIDL-Lite/"><item id="' + rand + 'spotify%3atrack%3a' + track_id + '" restricted="true"><dc:title></dc:title><upnp:class>object.item.audioItem.musicTrack</upnp:class><desc id="cdudn" nameSpace="urn:schemas-rinconnetworks-com:metadata-1-0/">SA_RINCON2311_X_#Svc2311-0-Token</desc></item></DIDL-Lite>'

  this.queueNext({
    uri: uri,
    metadata: meta
  }, callback)
}

/**
 * Get state, volume, current track, queue position, and length of the queue
 * @param  {Function} callback [Function(err, results) called when finished getting parameters]
 */
Device.prototype.getState = function(callback) {

	var funcs = [
		{ name: 'getCurrentState'},
		{ name: 'getVolume'},
		{ name: 'currentTrack'},
		{ name: 'getQueuePosition'},
		{ name: 'getQueueLength'},
		{ name: 'getPlayMode'},
		{ name: 'getMediaInfo'},
		{ name: 'getMuted'},
		{ name: 'currentTrackURI'}
	];

	return this.applyFunctions('parallel', funcs, callback);
}

/**
 * Applies a number of functions to the device, either in series or parallel
 * An array item must have a name key, and an optional args parameter for applying arguments
 * @param  {String} type ['series' or 'parallel' string]
 * @param  {Array} funcs [Array containing the functions to be called and optional arguments { name: 'func', args: ['0', 1, 2]}]
 * @param  {Function} callback [Function(err, results) to be called upon completion]
 */
Device.prototype.applyFunctions = function(type, funcs, callback) {

	var functionsToBeApplied = [];
	var self = this;

	for(var i=0; i<funcs.length; i++) {

		var name = funcs[i].name;
		var arguments = funcs[i].args || [];

		var creator = function(name, fn, args) {
			return function(cb) {

				// Create another function so we can track where an error came from
				var callback = function(err, data) {
					if(err) {
						return cb({ name: name, err: err});
					} else {
						return cb(null, data);
					}
				};

				args.push(callback);
				if(typeof fn === 'function') {
					fn.apply(self, args);
				} else {
					callback(name + ' is not a function');
				}
			}
		};

		functionsToBeApplied.push(creator(name, self[name], arguments));
	}

	if(type == 'parallel') {
		async.parallel(functionsToBeApplied, callback);
	} else {
		async.series(functionsToBeApplied, callback);
	}
	
}

/**
 * Simple modified search for Sonos device with longer response time and continous search for 
 * new devices every 'interval' seconds
 * @param {Number} [interval] [How often we should search for new devices]
 * @param {Function} callback [Function(err, device) called whenever a new device was discovered]
 */
var Search = function Search(interval, callback) {

  var self = this;
  this.devices = [];
  this.searchInterval = interval;

  var params = [
  	'M-SEARCH * HTTP/1.1',
	'HOST: 239.255.255.250:1900',
	'MAN: ssdp:discover',
	'MX: 5',
	'ST: urn:schemas-upnp-org:device:ZonePlayer:1'
  ];

  var PLAYER_SEARCH = new Buffer(params.join('\r\n'));

  this.socket = dgram.createSocket('udp4', function(buffer, rinfo) {
    
    buffer = buffer.toString();

    if(buffer.match(/.+Sonos.+/)) {

      var modelCheck = buffer.match(/SERVER.*\((.*)\)/);
      var model = (modelCheck.length > 1 ? modelCheck[1] : null);

      // Check whether this device was already found
      if (_.indexOf(self.devices, rinfo.address) == -1) {
      		self.devices.push(rinfo.address);
      		var device = new Device(rinfo.address);
      		device.model = model;
      		callback(null, device);
      }

    }
  });

  this.socket.on('error', function(err) {
  	callback(err);
  });

  this.socket.bind(function() {
    
    // Broadcast flag
    self.socket.setBroadcast(true);
    
    // Continous search function
    var send = function() {
        self.socket.send(PLAYER_SEARCH, 0, PLAYER_SEARCH.length, 1900, '239.255.255.250');
        setTimeout(function() {
            send();
        }, self.searchInterval);
    };

    send();
    
  });

  return this;

};

module.exports.Device = Device;
module.exports.Search = Search;
