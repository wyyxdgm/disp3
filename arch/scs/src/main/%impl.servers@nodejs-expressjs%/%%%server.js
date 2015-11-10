var log =require("../lib/log");
var libDate = require("../lib/date");
log.setOutfile("log/"+libDate.getDate(new Date()) + "-^^=name$$.log");
process.on('uncaughtException', function(err) {
  log.e(err.stack);
});
var app= require("./app");
var ^^=protocol$$ = require('^^=protocol$$');
var db = require("../db");
var sync =require("../lib/sync");
var fs = require("fs");
var server = ^^=protocol$$.createServer(app);
app.close = function(){
	server.close();
}
function prelisten(cb){
	var fnarr = [^^=addons.join(",")$$];
	sync.doAll(fnarr, cb);
}
db.connect(function(){
	prelisten(function(){
		server.listen(^^=port$$, function(){
			log.i('Express server listening on port: ^^=port$$, pid: '+process.pid);
			if(!fs.existsSync("pid"))
				fs.mkdirSync("pid");
			fs.writeFileSync("pid/^^=name$$", process.pid);
		});
	});
});



