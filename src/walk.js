var fs = require("fs");
var path = require("path");
var libString = require("../lib/js/string");
var libArray = require("../lib/js/array");
var libObject = require("../lib/js/object");
var libFile = require("../lib/nodejs/file");
var tmpl = require("./tmpl");
var log = require("./log");

function walk(dir, tdir, env, genFileList){
	if(!fs.existsSync(dir)){
		log.e(dir + " is not exist");
		return false;
	}
	if(!tdir){
		log.e("no target dir");
		return false;
	}
	if(!env){
		log.e("no env");
		return false;
	}
	if(!genFileList){
		log.e("no generate file list for output");
		return false;
	}
	if(fs.existsSync(dir + "/.filelist.json"))
		if(!env.filelist){
			env.filelist = libFile.readJSON(dir + "/.filelist.json");			
		}else{
			log.e("multiple .filelist.json in workspace: " + dir + "/.filelist.json");
			return false;
		}
	

	// then iterate file
	return _walk(dir, tdir, env, genFileList, "", env);
};
function _walk(dir, tdir, env, genFileList, penvkey, globalenv){


	if(!penvkey) penvkey = "";
	if(env.project){
		var fsconfigs = env.project.fsconfigs;
		if(fsconfigs){
			var fsconfig;
			if(fsconfigs[dir]) fsconfig = fsconfigs[dir];
			if(fsconfigs[path.basename(dir)]) fsconfig = fsconfigs[path.basename(dir)];
			if(fsconfig){
				if(fsconfig.ignore)
					return true;
				if(fsconfig.mv){
					env.global = globalenv;
					tdir = path.dirname(tdir) + "/" + tmpl.render(fsconfig.mv, env);
				}
			}
		}
	}


 if(fs.existsSync(dir + "/disp-global.json"))
	 libObject.extend(globalenv, libFile.readJSON(dir + "/disp-global.json"));
 if(fs.existsSync(dir + "/disp-local.json"))
	 libObject.extend(env, libFile.readJSON(dir + "/disp-local.json"));
 if(fs.existsSync(dir + "/disp.json"))
	 libObject.extend(env, libFile.readJSON(dir + "/disp.json"));
	
	var files = fs.readdirSync(dir);
	for(var i=0; i<files.length; i++){
		var f = files[i];
		//ignore hidden file or editor backup files
		if(f == "." || f.match(/~$/) || f[0] == '#' || f.match(/^disp/)
			){
				continue;
			}

		var p = path.relative(".", dir + '/' + f);
		var t, rt;

		//check if is directory, _walk
		var	stat = fs.statSync(p);
		if(stat.isDirectory()){
			if((ms = f.match(/[^%]%([^%@]+)(?:@([^%@]+))?%/)) || 
				 (ms = f.match(/^%([^%@]+)(?:@([^%@]+))?%/))){
				var envkey = ms[1];
				var matchStr = ms[2];
				var envlist;
				if(envkey[0] == "~"){
					penvkey = "";
					envkey = envkey.substr(1);
					envlist = libObject.getByKey(globalenv, envkey);
				}
				else
					envlist = libObject.getByKey(env, envkey);
				if(typeof(envlist) != "object"){
					t = tdir + '/' + f.replace(/%([^%]+)%/, envlist);
					if(!_walk(p, t, env, genFileList, penvkey, globalenv)){
						log.e("walk " + p + " failed");
						return false;
					}
				}else{
					var enums;
					if(envlist.from){						
						enums = envlist;
						envlist = libObject.getByKey(globalenv, enums.from);
					}
					for(var name in envlist){
						if(enums && libArray.indexOf(enums, name)==-1)
							continue;
						if(matchStr && !matchEnv(envlist[name], matchStr))
							continue;
						
						t = tdir + '/' + f.replace(/%([^%]+)%/, name);
						var nenvkey;
						if(enums) nenvkey = enums.from + "." + name;
						else nenvkey = penvkey + "." + envkey + "." + name;
						if(!_walk(p, t, envlist[name], genFileList, nenvkey, globalenv)){
							log.e("walk " + p + " failed");
							return false;
						}
					}
				}
			}else{
				t = tdir + "/" + f;
				if(!_walk(p, t, env, genFileList, penvkey, globalenv)){
          log.e("walk " + p + " failed");
          return false;
        }
			}
			continue;
		}
		// check if the file is the generated file
		if(isGenFile(env.filelist, p)){
			log.v("skip "+ p);
			continue;
		}
		// check if the file should be ignored
		if(env.project){
			var fsconfigs = env.project.fsconfigs;
			if(fsconfigs && fsconfigs[p]){
				var fsconfig = fsconfigs[p];
				if(fsconfig.ignore)
					continue;
			}
		}
		// match filename
		var ms;
		if((ms = f.match(/%%%([^%]+)%/))){
// library copy
			var mss = ms[1].split("-");
			for(var k=0; k<mss.length; k++){
				var srcDir = path.resolve(__dirname + "/../lib/" + mss[k]);
				if(fs.existsSync(srcDir)){

					libFile.forEachFile(srcDir, function(f2){
						if(!f2.match(/~$/) && f2[0] != '#' ){
							rt = tdir + "/" + f2;
							genFileList[rt] = {
								"main": [path.resolve(srcDir + "/" + f2)]
							};
						}
					});
				}
			}
		}else if((ms = f.match(/[^%]%([^%@]+)(?:@([^%@]+))?%(?:%([a-zA-Z0-9]+)%)?/)) || 
			 (ms = f.match(/^%([^%@]+)(?:@([^%@]+))?%(?:%([a-zA-Z0-9]+)%)?/))){
// env change and part of
			var envkey = ms[1];
			var matchStr = ms[2];
			var key = ms[3];
			var envlist;
			if(envkey[0] == "~"){
				penvkey = "";
				envkey = envkey.substr(1);
				envlist = libObject.getByKey(globalenv, envkey);

			}
			else
				envlist = libObject.getByKey(env, envkey);

			if(!key) key = "main";

			if(typeof envlist != "object"){
				var name = envlist;
				t = tdir + '/' + f.replace(/%([^%@]+)(?:@([^%@]+))?%(?:%([a-zA-Z0-9]+)%)?/, name);
        rt = path.relative(".", t);
        if(!genFileList[rt]) genFileList[rt] = {};
				if(penvkey)
					genFileList[rt].env = penvkey;
        if(!genFileList[rt][key])
          genFileList[rt][key] = [];
        genFileList[rt][key].push(p);
			}else{
				var enums;
				if(envlist.from){
					enums = envlist;
					envlist = libObject.getByKey(globalenv, enums.from);
				}
				for(var name in envlist){
					if(enums && libArray.indexOf(enums, name)==-1)
						continue;
					if(matchStr && !matchEnv(envlist[name], matchStr))
						continue;

						t = tdir + '/' + f.replace(/%([^%@]+)(?:@([^%@]+))?%(?:%([a-zA-Z0-9]+)%)?/, name);
						rt = path.relative(".", t);
						if(!genFileList[rt]) genFileList[rt] = {};
						if(enums)
							genFileList[rt].env = enums.from + "." + name;
						else
							genFileList[rt].env = penvkey + "." + envkey+ "." + name;
						if(!genFileList[rt][key])
							genFileList[rt][key] = [];
						genFileList[rt][key].push(p);
					}
				
			}
		}else if((ms = f.match(/%%([a-zA-Z0-9\-_]+)%/))){
// part of
			var key = ms[1];

			t = tdir + '/' + f.replace(/%%[a-zA-Z0-9\-_]+%/, "");
			rt = path.relative(".", t);
			if(!genFileList[rt]) genFileList[rt] = {};
			if(penvkey)
				genFileList[rt].env = penvkey;
			if(!genFileList[rt][key])
				genFileList[rt][key] = [];
			genFileList[rt][key].push(p);

		}else if(dir != tdir){
			t = tdir + '/' + f;
			rt = path.relative(".", t);
			if(!genFileList[rt])
				genFileList[rt] = {src: p};
		}else{
			rt = path.relative(".", p);
			if(!genFileList[rt])
				genFileList[rt] = {self: 1};
		}
	};
	return true;
}

function isGenFile(list, file){
	if(!list) return null;
	var rpath = path.relative(".", file);
	return list[file];
}
function matchEnv(localenv, str, i){

	var tokens = str.split(",");
	if(!i) i=0;
	if(!tokens[i])
		return true;

	switch(tokens[i]){
		case "eq":
			if(tokens[i+1] === undefined || tokens[i+2] === undefined
				 || libObject.getByKey(localenv, tokens[i+1]) != tokens[i+2]){
				return false;
			}
			i+=3;
			break;
		case "ne":
			if(tokens[i+1] === undefined || tokens[i+2] === undefined
				 || libObject.getByKey(localenv, tokens[i+1]) === tokens[i+2]){
				return false;
			}
			i+=3;
			break;
		case "lt":
			i+=3;
			break;
		case "gt":
			i+=3;
			break;
		case "in":
			if(tokens[i+1] === undefined || tokens[i+2] === undefined 
				 || libArray.indexOf(libObject.getByKey(localenv, tokens[i+1]), 
														 tokens[i+2]) == -1){
				return false;
			}
			i+=3;
			break;
		case "ex":
			if(tokens[i+1] === undefined
				 || !libObject.getByKey(localenv, tokens[i+1])){
        return false;
      }
      i+=2;
			break;
		default: {
			if(localenv.type && localenv.type == tokens[i])
				i+=1;
			else if(localenv.mods && libArray.indexOf(localenv.mods, tokens[i]) != -1)
				i+=1;
			else
				return false;
		}
	}
	return matchEnv(localenv, str, i);
}

module.exports.walk = walk;
