# Node-Sonos-Speaker

### Description

Based on the fantastic [node-sonos](https://github.com/bencevans/node-sonos) repository, this project outputs voice commands into all available Sonos speakers via a REST Api on a local network. The project currently only works on MacOSX via the `say` command, where it's output is piped into Sonos-compatible format and made available via a webserver. When music is currently played on a Sonos device, it is paused first, then the voice is played, and then resumed again. Volume is also adjusted according to a default level. 

Voice commands can be sent to the webserver via a `POST` request to the `/speak` route, which expects a text key containing a string with the text to be spoken. Further adjustments could be made on which Sonos device voices should be played etc. Probably another check should be made whether the playmode is put the repeat, as I'm currently checking whether the voice file has finished playing in regular intervals (maybe there's a better way?).

[Express](http://expressjs.com/) is used as webserver, and [node-sonos](https://github.com/bencevans/node-sonos) for commiting commands to Sonos devices.

### Usage

All that needs to be done is to install the node dependencies via `npm install`, and to make sure the public folder is writable. 

Then start via

	node index.js
	
You can check in the console whether Sonos devices were found.

Feel free to explore and experiment :)

### Licence

(MIT Licence)

    Copyright (c) 2016 Christopher Helf

    Permission is hereby granted, free of charge, to any person obtaining
    a copy of this software and associated documentation files (the
    "Software"), to deal in the Software without restriction, including
    without limitation the rights to use, copy, modify, merge, publish,
    distribute, sublicense, and/or sell copies of the Software, and to
    permit persons to whom the Software is furnished to do so, subject to
    the following conditions:

    The above copyright notice and this permission notice shall be
    included in all copies or substantial portions of the Software.

    THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND,
    EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF
    MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND
    NONINFRINGEMENT. IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE
    LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION
    OF CONTRACT, TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION
    WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.

