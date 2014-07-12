var express = require('express');
var path = require('path');
var favicon = require('static-favicon');
var logger = require('morgan');
var cookieParser = require('cookie-parser');
var bodyParser = require('body-parser');
var Bacon = require('baconjs');
var SerialPort = require('serialport').SerialPort;
var _ = require('lodash');

var sensor = new SerialPort('/dev/ttyUSB0', {
  baudrate: 9600,
  buffersize: 20
}, false);

var readings = [];

var routes = require('./routes/index');
var users = require('./routes/users');
var sqlite3 = require('sqlite3');
var db = new sqlite3.Database('atmos.sqlite3', function(err){

  sensor.open(function(){
    var buf = '';
    sensor.on('data', function(data){
      buf += data.toString();
      var split = buf.split('\n');
      if(split.length>1){
        buf = _.last(split);
        split = _.first(split,split.length-1);
        split.forEach(function(reading){
          reading = reading.replace(/\r/g,'');
          reading = reading.split('\t');
          reading = {
            humidity: +reading[0],
            temperature: +reading[1],
            heatIndex: +reading[2]
          };
          readings.push(reading);
          readings = _.last(readings, 30);
          db.run('insert into readings (time, humidity, temperature, heatIndex) values (?, ?, ?, ?);',[Math.floor(+new Date()/1e3),reading.humidity,reading.temperature,reading.heatIndex]);
        });
      }
    });
  });

});

var app = express();

// view engine setup
app.set('views', path.join(__dirname, 'views'));
app.set('view engine', 'jade');

app.use(favicon());
app.use(logger('dev'));
app.use(bodyParser.json());
app.use(bodyParser.urlencoded());
app.use(cookieParser());
app.use(express.static(path.join(__dirname, 'public')));

app.get('/readings', function(req, res){
  var ts = Math.floor((+new Date()-3600000)/1e3); // one hour ago
  db.all('select time, humidity, temperature, heatIndex from readings where time > ?;', [ts], function(err, rows){
    res.json(err||rows);
  });
});
app.use('/users', users);

/// catch 404 and forward to error handler
app.use(function(req, res, next) {
    var err = new Error('Not Found');
    err.status = 404;
    next(err);
});

/// error handlers

// development error handler
// will print stacktrace
if (app.get('env') === 'development') {
    app.use(function(err, req, res, next) {
        res.status(err.status || 500);
        res.render('error', {
            message: err.message,
            error: err
        });
    });
}

// production error handler
// no stacktraces leaked to user
app.use(function(err, req, res, next) {
    res.status(err.status || 500);
    res.render('error', {
        message: err.message,
        error: {}
    });
});


module.exports = app;
