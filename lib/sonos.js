var sonos = require('sonos');
var async = require('async');
var util = require('util');

// Simple airsonos wrapper
function AirSonos() {
	this.devices = [];
	this.defaultVolume = "50";
}

// Search for devices and store them
AirSonos.prototype.searchForDevices = function() {
	
	var self = this;
	sonos.search(function(device) {
		console.log("Sonos Device found");
		self.devices.push(device);
	});
}

// Play a sound
AirSonos.prototype.play = function(uri, cb) {

	// Check if we have devices
	if(this.devices.length == 0) {
		return cb("No Sonos devices found");
	}
	
	var functions = [];

	for(var i=0; i<this.devices.length; i++) {
		functions.push(this.createPlayFunction(this.devices[i], uri));
	}

	// Execute all functions in parallel
	async.parallel(functions, cb);
}

// Returns a song's current positon in the queue
AirSonos.prototype.getQueuePosition = function(device, callback) {

	var action = '"urn:schemas-upnp-org:service:AVTransport:1#GetPositionInfo"';
  	var body = '<u:GetPositionInfo xmlns:u="urn:schemas-upnp-org:service:AVTransport:1"><InstanceID>0</InstanceID><Channel>Master</Channel></u:GetPositionInfo>';
  	var responseTag = 'u:GetPositionInfoResponse';

  	return device.request('/MediaRenderer/AVTransport/Control', action, body, responseTag, function(err, data) {

  		if (err) return callback(err);
    	if ((!util.isArray(data)) || (data.length < 1)) return callback("invalid response");

    	var track = data[0].Track;
    	if ((!util.isArray(track))) return callback("invalid response");
    	if (track.length == 0) return callback(null, 1);
    	
    	track = parseInt(track[0]);
  		return callback(null, track);
  	});
}

// Returns the total queue length
AirSonos.prototype.getQueueLength = function(device, callback) {

  var opts = {
    BrowseFlag: 'BrowseDirectChildren',
    Filter: '',
    StartingIndex: '0',
    RequestedCount: '1',
    SortCriteria: '',
    ObjectID: 'Q:0'
  };
  
  var contentDirectory = new sonos.Services.ContentDirectory(device.host, device.port);

  return contentDirectory.Browse(opts, function(err, data){
  		if(err) return callback(err);

  		if(data && data.TotalMatches) {
  			return callback(null, { matches: parseInt(data.TotalMatches), updateID: data.UpdateID });
  		} else {
  			return callback(null, 0);
  		}
  });

}

// Plays a specific track at a queue position
AirSonos.prototype.seek = function(device, pos, callback) {
  
  var action, body;
  action = '"urn:schemas-upnp-org:service:AVTransport:1#Seek"';
  body = '<u:Seek xmlns:u="urn:schemas-upnp-org:service:AVTransport:1"><InstanceID>0</InstanceID><Unit>TRACK_NR</Unit><Target>' + pos + '</Target></u:Seek>';
  return device.request('/MediaRenderer/AVTransport/Control', action, body, 'u:SeekResponse', function(err, data) {
   
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


// Removes a track from the list
AirSonos.prototype.removeFromQueue = function(device, pos, updateID, callback) {

	var action = '"urn:schemas-upnp-org:service:AVTransport:1#RemoveTrackRangeFromQueue"';
  	var body = '<u:RemoveTrackRangeFromQueue xmlns:u="urn:schemas-upnp-org:service:AVTransport:1"><InstanceID>0</InstanceID><StartingIndex>'+pos+'</StartingIndex><NumberOfTracks>1</NumberOfTracks><UpdateID>0</UpdateID></u:RemoveTrackRangeFromQueue>';
  	var responseTag = 'u:RemoveTrackRangeFromQueueResponse';

  	return device.request('/MediaRenderer/AVTransport/Control', action, body, responseTag, function(err, data) {

  		if (err) {
  			return callback(err);
  		}
  		return callback(null, true);
  	});

}

// Function wrapper for async completion of playing songs
AirSonos.prototype.createPlayFunction = function(device, uri) {

	var defaultVolume = this.defaultVolume;
	var self = this;

	return function(callback) {

		// Get state, volume, current track, queue position, and length of the queue
		async.parallel({
		    state: function(cb) {
		    	device.getCurrentState(cb);
		    },
		    volume: function(cb) {
		    	device.getVolume(cb);
		    },
		    track: function(cb) {
		    	device.currentTrack(cb);
		    },
		    queuePosition: function(cb) {
		    	self.getQueuePosition(device, cb);
		    },
		    queueLength: function(cb) {
		    	self.getQueueLength(device, cb);
		    }
		},
		function(err, results) {

			if(err) {
				return callback(err, null);
			}

			// Track infos
			var state = results.state == "stopped" ? false : true;
			var volume = results.volume;
			var track = results.track;

			// Total queue length
			var queueLength = results.queueLength.matches;

			// UpdateID
			var updateID = results.queueLength.updateID;

			// Position in the queue
			var queuePosition = results.queuePosition;

			// Go back one second
			var position = track ? Math.max(parseInt(track.position)-1,0) : 0;

			//console.log("State: " + state + ", Volume: " + volume + ", Track: " + track + ", QueuePos: " + queuePosition + ", Position: " + position);

			async.series([
				
				// Stop the device's song if it was playing
				// TODO: Fadeout?
			    function(cb){
			        if(state) {
			        	device.stop(cb);
			        } else {
			        	cb(null, true);
			        }
			    },
			    // We always want to play voices at the same volume, set the volume
			    function(cb){
			        device.setVolume(defaultVolume, cb);
			    },
			    // Queue the voice
			    function(cb) {
			    	device.queue(uri, cb);
			    },
			    // Switch to the last item in the queue which should be the voice
			    function(cb) {
			    	self.seek(device, queueLength+1, cb);
			    },
			    // Play it
			    function(cb) {
			    	device.play(cb);
			    },
			    // Wait until we finished playing
			    function(cb) {

			    	var waitFunc = function() {
			    		setTimeout(function(){
			            	device.getCurrentState(function(err, playing) {

			            		// Convert playing state
			            		playing = playing == "playing" ? true : false;
			            		
			            		// Catch errors
			            		if(err) { return cb(err, null); }

			            		// If we are still playing, wait, else call the cb
			            		if(playing) {
			            			return waitFunc();
			            		} else {
			            			cb(null, true);
			            		}

			            	});
			        	}, 500);
			    	}
			    	waitFunc();
			    	
			    },
			    // Reset the volume
			    // TODO: FadeIn?
			    function(cb) {
			    	device.setVolume(volume, cb);
			    },
			    // Go back to the original track in case we were playing
			    function(cb) {
			    	if(state) {
			    		self.seek(device, queuePosition, cb);
			    	} else {
			    		cb(null, true);
			    	}
			    },
			    // Go to the position within the track in case we were playing
			    function(cb) {
			    	if(state) {
			    		device.seek(position,cb);
			    	} else {
			    		cb(null, true);
			    	}
			    },
			    // Play it in case we were playing before
			    function(cb) {
			    	if(state) {
			    		device.play(cb);
			    	} else {
			    		cb(null, true);
			    	}
			    },
			    // Remove the last item in the list
			    function(cb) {
			    	self.removeFromQueue(device, queueLength+1, updateID, cb);
			    }
			],
			// optional callback
			function(err, results){
			    if(err) {
			    	return callback(err, null);
			    }
			    return callback(null, results);
			});

			

		});
	}

}

module.exports = AirSonos;