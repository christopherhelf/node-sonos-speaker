'use strict';

var spawn = require('child_process').spawn, child;
var uuid = require('node-uuid');
var say = exports;
say.speaker = 'say';

exports.speak = function(voice, text, path, callback) {
  
  var commands, pipedData;

  // Create a random name
  var name = uuid.v1() + ".m4a";
  path = path + "/" + name;
  text = '"' + text + '"';

  // Only mac supported for now, choose sonos-friendly encoding
  if (process.platform === 'darwin') {
    if (!voice) {
      commands = [text, '-o', path, '--data-format=aac', '--file-format=mp4f'];
    } else {
      commands = ['-v', voice, text, '-o', path, '--data-format=aac', '--file-format=mp4f'];
    }
  } else {
    throw 'only macOSX supported for now';
    return;
  }

  // Run the shell command
  var childD = spawn(say.speaker, commands);
  childD.stdin.setEncoding('ascii');
  childD.stderr.setEncoding('ascii');

  // Call the callback when finished
  childD.addListener('exit', function (code, signal) {
    
    if (code === null || signal !== null) {
      callback('error code: '+ code + ', ' + 'signal: ' + signal);
    }

    callback(null, name);

  });
};