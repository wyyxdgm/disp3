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
		_isGlobal: true
	};
	self.fileMap = {};
	self.fileCount = 0;
	if(config)
		utils.extend(self, config);
	if(!self.projectDir)
		self.projectDir = path.resolve(".");
	if(!self.targetDir)
		self.targetDir = ".";
}

Disp.prototype.run = function(){
	var self = this;
	self.extendGlobal();
//	self.readPrev();
	self.genArch();
	self.genPlugin();
	self.dispose();
}
/*
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
*/
Disp.prototype.extendGlobal = function(){
	var self = this;
	if(!self.ignoreDispJson){
		if(fs.existsSync(self.projectDir + "/disp.json")){
			var dispJson = libFile.readJSON(self.projectDir + "/disp.json");
			log.v("read json success");
			log.v(dispJson);
			utils.extend(self.global, dispJson);
		}
		if(fs.existsSync(self.projectDir + "/disp")){
			libFile.forEachFile(self.projectDir + "/disp", function(f){
				if(!f.match(/\.json$/)) return;
				var tmpJson = libFile.readJSON(self.projectDir + "/disp/" + f);
				utils.extend(self.global, tmpJson);
			});
		}
	}
	self.global.nodeBin = process.argv.shift();
	self.global.dispBin = process.argv.shift();
	self.global.vendorDir = path.resolve(self.projectDir + "/../disp-vendor");
	self.global.dispDir = path.resolve(__dirname + "/..");
	self.global.archDir = path.resolve(self.global.dispDir + "/arch");
	self.global.pluginDir = path.resolve(self.global.dispDir + "/plugin");
	self.global.langDir = path.resolve(self.global.dispDir + "/lang");
	self.global.projectDir = self.projectDir;
	self.global.targetDir = self.targetDir;
	if(!self.global.baseDir) self.global.baseDir = self.projectDir;
	if(!self.global.arch)
		self.global.arch = "raw";
	if(!self.global.impl)
		self.global.impl = "basic";
	log.v("global");
	log.v(self.global);
}
Disp.prototype.genArch = function(){
	var self = this;
	//file struct
	var configFile = self.global.archDir + "/" + self.global.arch + "/" + self.global.impl;
	//global
	var configFile2 = self.global.archDir + "/" + self.global.arch;
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
	self.genProj(tmp, {
		src: configFile,
		target: ""
	});
}
Disp.prototype.genProj = function(filelist, config){
	var self = this;
	self.genProjSub(filelist, {
		src: config.src,
		target: config.target,
		isPseudo: true
	});
	self.genProjSub(filelist, {
		src: config.src,
		target: config.target
	});
}
Disp.prototype.genProjSub = function(filelist, config){
	var self = this;
  for (var orifilename in filelist){
    var partConfig = filelist[orifilename];
		if(libObject.isArray(partConfig)){
			for(var i in partConfig){
				self.genFilePre(path.join(config.target,orifilename), partConfig[i], config);
			}
		}else{
			self.genFilePre(path.join(config.target, orifilename), partConfig, config);
		}
  }
}
Disp.prototype.genFilePre = function(orifilename, partConfig, config){
	var self = this;
	if(orifilename.match(/\^\^.*\$\$/)){
		var env = self.getEnv(partConfig);
		var tfilename;
		if(typeof env != "object"){
			tfilename = tmpl.render(orifilename, {argv: env});
			var newPartConfig = libObject.copy1(partConfig);
			if(partConfig.name)
				newPartConfig.name = tmpl.render(partConfig.name, {argv: env});
			self.genFile(newPartConfig, tfilename, config);
		}else{
			for(var key in env){
				var localenv = {
					argv: key, 
					env: env[key],
					global: self.global
				}
				tfilename = tmpl.render(orifilename, localenv);
				var newPartConfig = libObject.copy1(partConfig);
				if(partConfig.name)
					newPartConfig.name = tmpl.render(partConfig.name, localenv);
				else
					newPartConfig.name = key;
				newPartConfig.env = env[key];
				env[key].argv = key;
				self.genFile(newPartConfig, tfilename, config);
			}
		}
	}else{
		self.genFile(partConfig, orifilename, config);
	}
}
Disp.prototype.genFile = function(partConfig, filename, config){
	var self = this;
	if(!partConfig.lang)
		partConfig.lang = "base";
	if(config.isPseudo){
		if(partConfig.name){
			self.fileMap[partConfig.name] = self.targetDir + "/" + filename;
		}
		return;
	}
	if(partConfig.arch){
		var dispConfig = {
			projectDir: path.resolve(filename),
			targetDir: filename,
			global: {
				arch: partConfig.arch
			}
		}
		if(partConfig.ignoreDispJson)
			dispConfig.ignoreDispJson = 1;
		if(partConfig.impl)
			dispConfig.global.impl = partConfig.impl;
		var tmpenv = self.getEnv(partConfig);
		for(var key in partConfig.global){
			dispConfig.global[key] = self.global[key];
		}
		if(tmpenv && !tmpenv._isGlobal)
			utils.extend(dispConfig.global, tmpenv);
		dispConfig.global.baseDir = self.projectDir;
		var newDisp = new Disp(dispConfig, self.callback);
		newDisp.run();
	}
	if(partConfig.sub){
		self.genProjSub(partConfig.sub, {
			src: config.src,
			target: filename,
			isPseudo: config.isPseudo
		});
	}
	if(partConfig.sub || partConfig.arch){
		return;
	}
	log.i(filename);
	/*todo sync*/
	/**/
  var str = "";
	var deps = {};
	self.eval({init: 1}, partConfig.lang, deps);
	if(partConfig.code || partConfig.content){
		var c;
		if(partConfig.code)
			c = partConfig.code;
		if(partConfig.content)
			c = self.global[partConfig.content];
		if(c){
			var tmpstr = self.eval(c, partConfig.lang, deps);
			if(tmpstr)
				str += tmpstr + "\n";
		}
  }
	var env = self.getEnv(partConfig);
	if(!env._isGlobal){
		env.main = str;
	}
	env.global = self.global;
	if(partConfig.raw){
		str += tmpl.render(partConfig.raw, env);
	}

	if(partConfig.tmpl || partConfig.src){
		tmpl.extendMethods("eval", function(json){
			return self.eval(json, partConfig.lang, deps);
		});
		var srcfile;
		if(partConfig.tmpl)
			srcfile = config.src + "/" + partConfig.tmpl;
		else if(partConfig.src)
			srcfile = self.projectDir + "/" + partConfig.src;

		env.deps = deps;
		str = tmpl.render({
			file: srcfile
		}, env);
		delete env.deps;
	}
/*
	parse deps 
*/

	var gdeps = {};
	self.expandDeps(deps, gdeps, partConfig);
	var parseDeps = [];
	var fileArgv = {};
	for(var key in gdeps){
		if(gdeps[key].isArgv){
			fileArgv[key] = gdeps[key];
		}else if(gdeps[key].files){
			for(var i in gdeps[key].files){
				var tmp = gdeps[key].files[i];
				if(gdeps[key].extended) tmp.extended = 1;
				tmp.name = key;
				parseDeps.push(tmp);
			}
		}else{
			parseDeps.push(gdeps[key]);
		}
	}
	var tfilename = self.targetDir + "/" + filename;

	str = self.eval({
		file: fileArgv,
		deps: parseDeps,
		main: str,
		fullpath: tfilename,
		lib: partConfig.lib,
		addExport: function(key, lib, reqconfig){
			self.addExport(key, lib, reqconfig);
		}
	}, partConfig.lang, {});

  libFile.mkdirpSync(path.dirname(tfilename)); //to be acc
  if(fs.existsSync(tfilename))
    fs.unlinkSync(tfilename);
	self.fileCount ++;
//  fs.writeFileSync(tfilename, str, {mode: 0444});
  fs.writeFileSync(tfilename, str, {mode: 0777});
}

Disp.prototype.genPlugin = function(){
	var self = this;
	//file struct
	for(var plugin in self.global.plugins){
		var configFile = self.global.pluginDir + "/" + plugin;
		var tmp;
		try {
			tmp = require(configFile);
		}catch(e){
			self.callback(e);
		}
		self.genProj(tmp, {
			src: configFile,
			target: self.target || ""
		});
	}
}
Disp.prototype.dispose = function(){
	var self = this;
	log.i(self.fileCount + " files updated");
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


// simple methods
Disp.prototype.expandDeps = function(deps, gdeps, partConfig){
	var self = this;
	var lang = partConfig.lang;
	var vendors = self.eval({"vendor.json": 1}, lang);
	for(var key in deps){
		var vendorConfig = vendors[key];
		if(vendorConfig && vendorConfig.deps){
			self.expandDeps(vendorConfig.deps, gdeps, partConfig);
		}
		var langConfig = self.getDepConfig(key, lang);
		if(!partConfig.lib && langConfig && langConfig.deps){
			self.expandDeps(langConfig.deps, gdeps, partConfig);
		}
		if(!gdeps[key]){
			gdeps[key] = {};
		}
		if(!gdeps[key].extended){
			if(vendorConfig)
				utils.extend(gdeps[key], vendorConfig);
			if(langConfig)
				utils.extend(gdeps[key], langConfig);
			gdeps[key].extended = 1;
		}
		if(typeof deps[key] !="object")
			gdeps[key].val = deps[key];
		else
			utils.extend(gdeps[key], deps[key]);
	}
}
Disp.prototype.addExport = function(key, lib, reqconfig){
	var self = this;
	if(typeof lib == "string"){
		var name = lib;
		reqconfig.file = self.fileMap[name];
		reqconfig.sub = key;
		var toextend = {};
		toextend[name] = {Lexport: {}};
		toextend[name].Lexport[key]= {lib: key};
		utils.extend(self.global, toextend);
	}
}

var cache = {};
Disp.prototype.getDepConfig = function(key, lang){
	var self = this;
	var rtn = {};
//local file
	if(self.fileMap[key]){
		rtn.file = self.fileMap[key];
	}else{
//local lib			
		var evaljson = {};
		evaljson[key+".lib"] =1;
		var deps = {};
		if(self.eval(evaljson, lang, deps, true)){
			rtn.lib = key;
			rtn.deps = deps;
		}
//remote lib
		else {
			rtn.pkg = key;
		}
	}
	rtn.name = key;

	return rtn;
}
Disp.prototype.getLangDir = function(lang){
	var self = this;
	if(lang == "custom"){
		return self.projectDir + "/words";
	}else{
		return self.global.langDir + "/" + lang;
	}
}
Disp.prototype.getLangConfig = function(lang){
	var self = this;
	var configFile = self.getLangDir(lang);
	if(cache[lang])
		return cache[lang];
	var config = {};
	try {
		config = require(configFile);
	}catch(e){
		config = {};
	}
	cache[lang] = config;
	return config;
}

Disp.prototype.getLangFile = function(name, lang){
	var self = this;
	var langConfig = self.getLangConfig(lang);
	var file = self.getLangDir(lang) + "/" + name;
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
	if(json === undefined || json === null || json === "") return "";
	var type = typeof json;
	var str = "";
	var searchlang;
	if(lang.match(/@/)){
		var tmparr = lang.split("@");
		lang = tmparr[0];
		searchlang = tmparr[1];
	}else{
		searchlang = lang;
	}
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
		return json; // return raw if not expr
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
	if(!name) return "";
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
	var ms;
	if((ms = name.match(/\.(\S+)$/))){
		flags[ms[1]] = 1;
	}
//get config

	var file = self.getLangFile(name, searchlang);
	if(!file){
		if(isPseudo)
			return "";
		else
			return self.callback(lang + " " + name + " not exist");
	}
//begin eval
//	tmpl.extendMethods("eval", 
	var data = {
		name: name,
		argv: libObject.copy(json[name]),
		deps: deps,
		lang: lang,
		parent: json,
		global: self.global,
		extend: {
			"eval": function(json, lang2){
				if(lang2) return self.eval(json, lang2, deps);
				return self.eval(json, lang, deps);
			}
		}
	}
	
	var rtnstr = tmpl.render({file: file}, data);
	if(flags.lib && rtnstr && rtnstr[0] == "~"){
		try{
			var func;
			eval('func = {"function":{'+rtnstr.substr(1)+'}}');
			if(json.name) func.name = json.name;
			rtnstr = self.eval(func, lang, deps);
		}catch(e){
			log.e('func = {"function":{'+rtnstr.substr(1)+'}}');
		}
	}else if(flags.json){
		try{
			rtnstr = JSON.parse(rtnstr);
		}catch(e){
			JSON.parse(rtnstr);
			return self.callback("wrong json!");
		}
	}
	if(!isPseudo)
		return rtnstr;
	else
		return 1;
	
}
