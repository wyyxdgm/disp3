// Load required packages
var express = require('express');
var bodyParser = require('body-parser');
var libReq = require("../lib/req");
var libDate = require("../lib/date");
var libEncrypt = require("../lib/encrypt");
var libRandom = require("../lib/random");
var libRes = require("./response");
var sendErr = libRes.sendErr;
var sendFile = libRes.sendFile;
var sendJson = libRes.sendJson;
var EventEmitter = require('events').EventEmitter;
var emitter = new EventEmitter();
var coreDb = require("../core/db");
^^=require$$

// Create our Express application
var app = express();

app.use(bodyParser.urlencoded({
  extended: true
}));
app.use(bodyParser.json());

^^for(var key in statics){$$
app.use("^^=key$$", express.static(__dirname + '/^^=statics[key]$$'));
^^}$$


^^if(local.debug){$$
app.use(function(req, res, next){
//	console.log(Object.keys(req));
	var log = "\x1b[1;36m";
	var ip = req.headers['x-forwarded-for'] || req.connection.remoteAddress;
	log += req.method + " " + req.originalUrl + "  ip:" + ip + "  " + libDate.getSimple(new Date())+ "\n";
	if(req.method != "GET" && req.method != "DELETE"){
		var bodystr = JSON.stringify(req.body,undefined);
		if(bodystr != "{}")
			log+=JSON.stringify(req.body,undefined)+"\n";
	}
	log+=req.headers['user-agent'];
	log+="\x1b[0m";
	console.log(log);
	next();
});
^^}$$
^^=setting$$
^^function makeReq(json){
	var arr = [];
	for(var key in json){
		arr.push(key + ":" + json[key]);
	}
	return arr.join(",");
}$$
/////////////////////////////////
^^function makeController(api){
/*make controller*/$$
^^for(var j in api.controllers){
 var ctrl = api.controllers[j];
 var result= ctrl.result || "result";
$$
^^if(ctrl.vars){
 for(var key in ctrl.vars){
  var vars = ctrl.vars[key];
$$
var ^^=key$$ = ^^=vars$$;
^^}
 }
$$
^^switch(ctrl.type){ case "req":$$

libReq.^^=ctrl.method$$("^^=ctrl.url$$", {^^=makeReq(ctrl.data)$$}, function(err, ^^=result$$){ 
	if(err) return sendErr(res, err);

^^break;case "send":case "raw": $$

^^break;case "db":
 var method = ctrl.method;
$$
^^if(method == "update" || method == "bupdate" || method =="upsert" || method == "update2" || method == "bupdate2" || method == "sedate" || method == "sedate2"){
$$
coreDb.getModel("^^=ctrl.db$$").^^=ctrl.method$$(^^=ctrl.where$$, ^^=ctrl.set$$, function(err, ^^=result$$){
^^}else if(method == "bselect" || method == "bdelete" || method == "bcolect"){
$$
coreDb.getModel("^^=ctrl.db$$").^^=ctrl.method$$(^^=ctrl.where$$, ^^=ctrl.op||"{}"$$, function(err, ^^=result$$){
^^}else if(method == "select" || method == "delete"){
$$
coreDb.getModel("^^=ctrl.db$$").^^=ctrl.method$$(^^=ctrl.where$$, function(err, ^^=result$$){
^^}else if(method == "binsert" || method == "insert"){
$$
coreDb.getModel("^^=ctrl.db$$").^^=ctrl.method$$(^^=ctrl.doc$$, function(err, ^^=result$$){
^^}$$
	if(err) return sendErr(res, err);
^^break;}$$


^^//check
if(ctrl.check){for(var key in ctrl.check){var check = ctrl.check[key];$$
^^if(typeof check == "string"){$$
if(^^=key$$) return sendErr(res, "^^=check$$");
^^}else{$$
if(^^=key$$) return sendErr(res, "^^=check.message$$", "^^=check.code$$");
^^}$$
^^}}$$

^^//if
if(ctrl.if){
 for(var key in ctrl.if){
  var ifstr = ctrl.if[key];
$$
if(^^=key$$) return sendJson(res, "^^=ifstr$$");
^^
 }
}
$$

^^if(ctrl.do){$$
^^=ctrl.do$$
^^}$$
^^if(ctrl.send){$$
sendJson(res, ^^=ctrl.send$$);
^^}$$
^^if(ctrl.sendJson){$$
sendJson(res, ^^=JSON.stringify(ctrl.sendJson)$$);
^^}$$

^^}$$
	^^=local[api.name]$$
^^for(var j=api.controllers.length-1; j>=0; j--){var ctrl = api.controllers[j];$$
 ^^switch(ctrl.type){ 
  case "req":
  case "db":
 $$

});

 ^^break;default: $$
 ^^break;}$$
^^}
/* make controller done */$$

^^}$$
////////////////////////////////////////////

var auth = require("./auth").midware;
var auths = require("./auth").midwares;
var router = express.Router();
^^for(var i=0; i<withApis.length; i++){ 
	var api = global.proto.apis[withApis[i]];
	var paramsStr = "";
	for(var key in api.params){
		var param = api.params[key];
		if(param.isParams) paramsStr += "/:" + key;
	}
	var midwaresStr = "";
	for(var j in api.midwares){
		var midware= api.midwares[j];
		midwaresStr += midware + ", ";
	}
	
	switch(api.type){
		case "post":
		case "get":
/////////////////post//////////////////////////
$$
router.route('/^^=api.route$$^^=paramsStr$$').^^=api.type$$(^^=midwaresStr$$^^=api.controller || api.name$$);
^^///////////make function start//////////////////
if(!api.controller){$$
function ^^=api.name$$(req, res){

^^for(var key in api.params){var param = api.params[key];$$
^^if(param.isQuery){$$
var ^^=key$$ = req.query["^^=key$$"];
^^}else if(!param.isParams){$$
var ^^=key$$ = req.body["^^=key$$"];
^^}else{$$
var ^^=key$$ = req.params["^^=key$$"];
^^}$$
 ^^if(param.required){$$
if(!^^=key$$) return sendErr(res, "参数错误：没有^^=key$$");
 ^^}$$
^^}$$
^^makeController(api)$$
};
^^}
/////////////////make function end//////////////$$

^^
///////////////rest//////////////////////////////////
break; case "rest":$$
^^break;}$$
^^}$$
^^=methods$$
app.use('/api', router);

^^=apiblock$$

module.exports = app;
