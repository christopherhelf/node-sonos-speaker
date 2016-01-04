// Some random port
var port = 9010;

// Required modules
var express 	= require('express');
var bodyParser 	= require('body-parser');
var ip 			= require('ip').address();
var fs 			= require('fs');

// Own modules
var say 		= require('./lib/say');
var _sonos 		= require('./lib/sonos');

// Start the search for sonos devices
var sonos = new _sonos();
sonos.searchForDevices();

// Create a simple webserver
var app = express();
app.set('port', port);
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({
  extended: true
})); 

// The only route, accepting a string ("text" key) in the POST-body
app.post('/speak', function(req, res) {
	
	var body = req.body;
	var text = body ? body.text : null;

	// Check for invalid texts
	if(!text || typeof text !== 'string' || text == "") {
		return res.status(400).send("Invalid Message sent");
	}

	// Get the path to the public folder where sound files are stored
	var path = __dirname + '/public';
	
	// Create the sound file
	say.speak(null, text, path, function(err, filename) {
		
		// Check for errors
		if (err) {
			return res.status(400).send(err);
		}

		// Create the URI
		var uri = "http://" + ip + ":" + port + "/" + filename;

		// Play the sound file on the SONOS devices
		sonos.play(uri, function(err, results) {

			// Delete the file after 10 seconds, just to be sure
			setTimeout(function(){
				fs.unlinkSync(path + "/" + filename);
			}, 10000);

			// Return success
			return res.json({ status: "OK" })
		});

	})

});

// Create a static route to the public folder
app.use(express.static('public'));

// Fire up the server
var server = app.listen(app.get('port'), function () {
  var host = ip;
  var port = server.address().port;
  console.log('Sonos Server listening at http://%s:%s', host, port);
});