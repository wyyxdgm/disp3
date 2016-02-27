var fs = require("fs");

var path = require("path");
var libString = require("../lib/js/string");
var libArray = require("../lib/js/array");
var libObject = require("../lib/js/object");
var libFile = require("../lib/nodejs/file");
var sync = require("../lib/js/sync");
var utils =require("./utils");
var log = require("../lib/nodejs/log");

var tmpl = require("./tmpl");
module.exports = Disp;
function Disp(config, fn){
	var self = this;
	if(!fn) fn = function(err){
		if(err) throw err;
		else log.i("done");
	}
	self.callback = fn;
	self.global = {
		_isGlobal: true,
		_deps: {}
	};
	self.filemap = {};
	if(config)
		utils.extend(self, config);
	if(!self.projectDir)
		self.projectDir = path.resolve(".");
	if(!self.targetDir)
		self.targetDir = ".";
}

Disp.prototype.run = function(){
	var self = this;
	self.extendEnv();
	self.extendGlobal();
	self.readPrev();
	self.readArch();
	self.genProj(true);//pseudo run genProj to get filemap
	self.genProj();
	self.dispose();
}
Disp.prototype.extendEnv = function(){
	var self = this;
	self.env = {};
	self.env.nodeBin = process.argv.shift();
	self.env.dispBin = process.argv.shift();
	self.env.dispDir = path.resolve(__dirname + "/..");
	self.env.archDir = path.resolve(self.env.dispDir + "/arch");
	self.env.langDir = path.resolve(self.env.dispDir + "/lang");
}
Disp.prototype.readPrev = function(){
	var self = this;
	var prev = {};
	if(fs.existsSync(self.projectDir + "/disp.filelist.json"))
		prev.filelist = libFile.readJSON(self.projectDir + "/disp.filelist.json");
	else
		prev.filelist = {};
	log.v(prev);
	self.prev = prev;
}

Disp.prototype.extendGlobal = function(){
	var self = this;

	if(fs.existsSync(self.projectDir + "/disp.json") && !self.ignoreDispJson){
		var dispJson = libFile.readJSON(self.projectDir + "/disp.json");
		log.v("read json success");
		log.v(dispJson);

		utils.extend(self.global, dispJson);
	}
	if(!self.global.arch)
		self.global.arch = "raw";
	if(!self.global.impl)
		self.global.impl = "nodejs";
	log.v("global");
	log.v(self.global);
}


Disp.prototype.readArch = function(){
	var self = this;
	//file struct
	var configFile = self.env.archDir + "/" + self.global.arch + "/" + self.global.impl;
	//global
	var configFile2 = self.env.archDir + "/" + self.global.arch;
	var tmp, tmp2;
	try {
		tmp = require(configFile);
	}catch(e){
		self.callback(e);
	}
	try {
		tmp2 = require(configFile2);
	}catch(e){
		self.callback(e);
	}
	if(tmp2){
		utils.append(self.global, tmp2);
	}

	log.v(tmp);
	self.filelist = tmp;
	self.fileroot = configFile;
}
Disp.prototype.genProj = function(isPseudo){
	var self = this;
	var filelist = self.filelist;
  for (var orifilename in filelist){
    var partConfig = filelist[orifilename];
		if(libObject.isArray(partConfig)){
			for(var i in partConfig){
				self.genFilePre(orifilename, partConfig[i], isPseudo);
			}
		}else{
			self.genFilePre(orifilename, partConfig, isPseudo);
		}
  }
}
Disp.prototype.dispose = function(){
	log.v("dispose success");
}
Disp.prototype.getEnv = function(partConfig){
	var self = this;
	var env;
	if(partConfig.env){
		env = partConfig.env;
	}else if(partConfig.envkey){
		env = libObject.getByKey(self.global, partConfig.envkey);
		partConfig.env = env;
	}else
		env = self.global;
	if(!env) env = {};
	return env;
}
Disp.prototype.genFilePre = function(orifilename, partConfig, isPseudo){
	var self = this;
	if(orifilename.match(/\^\^.*\$\$/)){
		var env = self.getEnv(partConfig);
		var tfilename;
		if(typeof env != "object"){
			tfilename = tmpl.render(orifilename, {argv: env});
			var newPartConfig = libObject.copy1(partConfig);
			if(partConfig.name)
				newPartConfig.name = tmpl.render(partConfig.name, {argv: env});
			self.genFile(newPartConfig, tfilename, isPseudo);
		}else{
			for(var key in env){
				var localenv = {
					argv: key, 
					env: env[key]
				}
				tfilename = tmpl.render(orifilename, localenv);
				var newPartConfig = libObject.copy1(partConfig);
				if(partConfig.name)
					newPartConfig.name = tmpl.render(partConfig.name, localenv);
				else
					newPartConfig.name = key;
				newPartConfig.env = env[key];
				self.genFile(newPartConfig, tfilename, isPseudo);
			}
		}
	}else{
		self.genFile(partConfig, orifilename, isPseudo);
	}
}
Disp.prototype.genFile = function(partConfig, filename, isPseudo){
	var self = this;
	if(isPseudo){
		if(partConfig.name){
			self.filemap[partConfig.name] = filename;
/*{
				filename: filename,
				env: self.getEnv(partConfig)
			}*/
		}

		return;
	}
	if(partConfig.arch){
		var config = {
			projectDir: path.resolve(filename),
			targetDir: filename,
			global: {
				arch: partConfig.arch
			}
		}
		if(partConfig.ignoreDispJson)
			config.ignoreDispJson = 1;
		if(partConfig.impl)
			config.global.impl = partConfig.impl;
		var tmpenv = self.getEnv(partConfig);
		
		if(tmpenv && !tmpenv._isGlobal)
			utils.extend(config.global, tmpenv);
		var newDisp = new Disp(config, self.callback);
		newDisp.run();
		return;
	}

	/*todo sync*/
	/**/
  var str = "";
	var deps = {};
	if(partConfig.code || partConfig.content){
		var c;
		if(partConfig.code)
			c = partConfig.code;
		if(partConfig.content)
			c = self.global[partConfig.content];
		if(c)
			str += self.eval(c, partConfig.lang, deps) + "\n";
  }
	var env = self.getEnv(partConfig);
	if(!env._isGlobal){
		env.global = self.global;
		env.main = str;
	}
	if(partConfig.raw){
		str += tmpl.render(partConfig.raw, env);
	}

	if(partConfig.tmpl || partConfig.src){
		tmpl.extendMethods("eval", function(json){
			return self.eval(json, partConfig.lang, deps);
		});
		var srcfile;
		if(partConfig.tmpl)
			srcfile = self.fileroot + "/" + partConfig.tmpl;
		else if(partConfig.src)
			srcfile = self.projectDir + "/" + partConfig.src;
		str = tmpl.render({
			file: srcfile
		}, env);
	}

/*
	parse deps
 
*/
	var parseDeps = self.getDepConfig(deps, partConfig.lang);
	str = self.eval({
		file: parseDeps, 
		main: str, 
		config: partConfig, 
		filemap: self.filemap
	}, partConfig.lang);
	// if has lib, require lib and add func to lib
/*
	var Lrequire = {};
	var methodSpace = {};
	for(var key in deps){
		//TODO mutilayer support
		if(typeof deps[key] == "string"){
			if(partConfig.lib){
				deps[key] = {
					type: deps[key],
					sub: key,
					file: self.filemap[partConfig.lib]
				};
				if(!self.global[partConfig.lib]) //init
					self.global[partConfig.lib] = {};
				var libContent = self.global[partConfig.lib];
				if(!libContent.Lexport)
					libContent.Lexport = {};
				if(!libContent.Lexport[key]) 
					libContent.Lexport[key] = {lib: key};
			}else{
				str = self.eval({
					lib: key, name: key
				}, partConfig.lang, deps) + str;
				continue;
			}
		}else if(typeof deps[key] != "object"){
			self.global._deps[key] = 1;
			deps[key] = {
				mod: key
			}
		}else if(deps[key].file){
			deps[key].file = self.filemap[deps[key].file];
		}
		Lrequire[key] = deps[key];
	}
	str = self.eval({Lrequire: Lrequire}, partConfig.lang, deps) + str;

*/
	//////////////////////////////
	var tfilename = self.targetDir + "/" + filename;
  libFile.mkdirpSync(path.dirname(tfilename)); //to be acc
  if(fs.existsSync(tfilename))
    fs.unlinkSync(tfilename);
  fs.writeFileSync(tfilename, str, {mode: 0444});
}

// simple methods
var cache = {};
Disp.prototype.getDepConfig = function(deps, lang){
	var self = this;
	var rtndeps = {};
	for(var key in deps){
//local file
		if(self.filemap[key]){
			rtndeps[key] = {file: self.filemap[key]};
		}else{
//local lib			
			var evaljson = {};
			evaljson[key+".lib"] =1;
			if(self.eval(evaljson, lang, {}, true)){
				rtndeps[key] = {lib: key, type: deps[key]};
			}
//remote lib
			else rtndeps[key] = {pkg: key, version: deps[key]};
		}
	}
	return rtndeps;
}
Disp.prototype.getLangConfig = function(lang){
	var self = this;
	var configFile = self.env.langDir + "/" + lang;
	if(cache[lang])
		return cache[lang];
	var config = {};
	try {
		config = require(configFile);
	}catch(e){
		self.callback(e);
	}
	cache[lang] = config;
	return config;
}

Disp.prototype.getLangFile = function(name, lang){
	var self = this;
	var langConfig = self.getLangConfig(lang);
	var file = self.env.langDir + "/" + lang + "/" + name;
	var resultFile;
	if(fs.existsSync(file)){
		return file;
	}else{
		for(var key in langConfig.deps){
			var tmpfile = self.getLangFile(name, key);
			if(tmpfile)
				return tmpfile;
		}
	}
}

Disp.prototype.eval = function(json, lang, deps, isPseudo){
	var self = this;
	if(!json) return "";
	var type = typeof json;
	var str = "";
/*
	if(type === "string"){
		var tmp = {};
		tmp[json] = 1;
		json = tmp;
	}else if(type == "number"){
		return json;
	}else if(type == "object"){
*/
	if(type !== "object"){
		return json;
	}else{
		if(libObject.isArray(json)){
			var toextend = {};
			for(var i in json){
				if(!i.match(/\d+/)){
					toextend[i] = json[i];
					delete json[i];
				}
			}
			for(var i in json){
				json[i].index = i;
				utils.extend(json[i], toextend);
				str += self.eval(json[i], lang, deps) + "\n";
			}
			return str;
		}
	}
	var name = Object.keys(json)[0];
	if(name[0] == "L"){
		var toextendl = {};
		for(var key in json){
			if(key !== name)
				toextendl[key] = json[key];
		}
		for(var key in json[name]){
			var truename = name.substr(1);
			var tmpjson = {};
			tmpjson[truename] = json[name][key];
			tmpjson.name = key;
			utils.extend(tmpjson, toextendl);
			str += self.eval(tmpjson, lang, deps) + "\n";
		}
		return str;
	}

	log.v(json);
	var flags = {};
	if(name.match(/\.lib$/)){
		flags.lib = 1;
	}
//get config

	
	var file = self.getLangFile(name, lang);
	if(!file){
		if(isPseudo)
			return "";
		else
			return self.callback(lang + " " + name + " not exist");
	}
	if(isPseudo){
		return "1";
	}
//begin eval
	tmpl.extendMethods("eval", function(json, lang2){
		if(lang2) return self.eval(json, lang2, deps);
		return self.eval(json, lang, deps);
	});
	var data = {
		name: name,
		argv: json[name],
		deps: deps,
		parent: json,
		global: self.global
	}
	
	var rtnstr = tmpl.render({file: file}, data);
	if(flags.lib && rtnstr && rtnstr[0] == "~"){
		try{
			var func;
			eval('func = {"function":{'+rtnstr.substr(1)+'}}');
			if(json.name) func.name = json.name;
			return self.eval(func, lang, deps);
		}catch(e){
			log.e('func = {"function":{'+rtnstr.substr(1)+'}}');
		}
	}else{
		return rtnstr;
	}
}
