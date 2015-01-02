(function e(t,n,r){function s(o,u){if(!n[o]){if(!t[o]){var a=typeof require=="function"&&require;if(!u&&a)return a(o,!0);if(i)return i(o,!0);var f=new Error("Cannot find module '"+o+"'");throw f.code="MODULE_NOT_FOUND",f}var l=n[o]={exports:{}};t[o][0].call(l.exports,function(e){var n=t[o][1][e];return s(n?n:e)},l,l.exports,e,t,n,r)}return n[o].exports}var i=typeof require=="function"&&require;for(var o=0;o<r.length;o++)s(r[o]);return s})({"C:\\ksana2015\\node_modules\\ksana-jsonrom\\html5fs.js":[function(require,module,exports){
/* emulate filesystem on html5 browser */
var read=function(handle,buffer,offset,length,position,cb) {//buffer and offset is not used
	var xhr = new XMLHttpRequest();
	xhr.open('GET', handle.url , true);
	var range=[position,length+position-1];
	xhr.setRequestHeader('Range', 'bytes='+range[0]+'-'+range[1]);
	xhr.responseType = 'arraybuffer';
	xhr.send();
	xhr.onload = function(e) {
		var that=this;
		setTimeout(function(){
			cb(0,that.response.byteLength,that.response);
		},0);
	}; 
}
var close=function(handle) {}
var fstatSync=function(handle) {
	throw "not implement yet";
}
var fstat=function(handle,cb) {
	throw "not implement yet";
}
var _open=function(fn_url,cb) {
		var handle={};
		if (fn_url.indexOf("filesystem:")==0){
			handle.url=fn_url;
			handle.fn=fn_url.substr( fn_url.lastIndexOf("/")+1);
		} else {
			handle.fn=fn_url;
			var url=API.files.filter(function(f){ return (f[0]==fn_url)});
			if (url.length) handle.url=url[0][1];
		}
		cb(handle);
}
var open=function(fn_url,cb) {
		if (!API.initialized) {init(1024*1024,function(){
			_open.apply(this,[fn_url,cb]);
		},this)} else _open.apply(this,[fn_url,cb]);
}
var load=function(filename,mode,cb) {
	open(filename,mode,cb,true);
}
var get_head=function(url,field,cb){
		var xhr = new XMLHttpRequest();
		xhr.open("HEAD", url, true);
		xhr.onreadystatechange = function() {
				if (this.readyState == this.DONE) {
					cb(xhr.getResponseHeader(field));
				} else {
					if (this.status!==200&&this.status!==206) {
						cb("");
					}
				}
		};
		xhr.send();	
}
var get_date=function(url,cb) {
		get_head(url,"Last-Modified",function(value){
			cb(value);
		});
}
var  getDownloadSize=function(url, cb) {
		get_head(url,"Content-Length",function(value){
			cb(parseInt(value));
		});
};
var checkUpdate=function(url,fn,cb) {
		if (!url) {
			cb(false);
			return;
		}
		get_date(url,function(d){
			API.fs.root.getFile(fn, {create: false, exclusive: false}, function(fileEntry) {
					fileEntry.getMetadata(function(metadata){
						var localDate=Date.parse(metadata.modificationTime);
						var urlDate=Date.parse(d);
						cb(urlDate>localDate);
					});
		},function(){
			cb(false);
		});
	});
}
var download=function(url,fn,cb,statuscb,context) {
	 var totalsize=0,batches=null,written=0;
	 var fileEntry=0, fileWriter=0;
	 var createBatches=function(size) {
			var bytes=1024*1024, out=[];
			var b=Math.floor(size / bytes);
			var last=size %bytes;
			for (var i=0;i<=b;i++) {
				out.push(i*bytes);
			}
			out.push(b*bytes+last);
			return out;
	 }
	 var finish=function() {
				 rm(fn,function(){
						fileEntry.moveTo(fileEntry.filesystem.root, fn,function(){
							setTimeout( cb.bind(context,false) , 0) ; 
						},function(e){
							console.log("failed",e)
						});
				 },this); 
	 }
		var tempfn="temp.kdb";
		var batch=function(b) {
			 var abort=false;
			 var xhr = new XMLHttpRequest();
			 var requesturl=url+"?"+Math.random();
			 xhr.open('get', requesturl, true);
			 xhr.setRequestHeader('Range', 'bytes='+batches[b]+'-'+(batches[b+1]-1));
			 xhr.responseType = 'blob';    
			 xhr.addEventListener('load', function() {
				 var blob=this.response;
				 fileEntry.createWriter(function(fileWriter) {
				 fileWriter.seek(fileWriter.length);
				 fileWriter.write(blob);
				 written+=blob.size;
				 fileWriter.onwriteend = function(e) {
					 if (statuscb) {
							abort=statuscb.apply(context,[ fileWriter.length / totalsize,totalsize ]);
							if (abort) setTimeout( cb.bind(context,false) , 0) ;
					 }
					 b++;
					 if (!abort) {
							if (b<batches.length-1) setTimeout(batch.bind(context,b),0);
							else                    finish();
					 }
				 };
				}, console.error);
			 },false);
			 xhr.send();
		}

		 getDownloadSize(url,function(size){
			 totalsize=size;
			 if (!size) {
					if (cb) cb.apply(context,[false]);
			 } else {//ready to download
				rm(tempfn,function(){
					 batches=createBatches(size);
					 if (statuscb) statuscb.apply(context,[ 0, totalsize ]);
					 API.fs.root.getFile(tempfn, {create: 1, exclusive: false}, function(_fileEntry) {
								fileEntry=_fileEntry;
							batch(0);
					 });
				},this);
			}
		});
}

var readFile=function(filename,cb,context) {
	API.fs.root.getFile(filename, function(fileEntry) {
			var reader = new FileReader();
			reader.onloadend = function(e) {
					if (cb) cb.apply(cb,[this.result]);
				};            
		}, console.error);
}
var writeFile=function(filename,buf,cb,context){
	 API.fs.root.getFile(filename, {create: true, exclusive: true}, function(fileEntry) {
			fileEntry.createWriter(function(fileWriter) {
				fileWriter.write(buf);
				fileWriter.onwriteend = function(e) {
					if (cb) cb.apply(cb,[buf.byteLength]);
				};            
			}, console.error);
		}, console.error);
}

var readdir=function(cb,context) {
	 var dirReader = API.fs.root.createReader();
	 var out=[],that=this;
		dirReader.readEntries(function(entries) {
			if (entries.length) {
					for (var i = 0, entry; entry = entries[i]; ++i) {
						if (entry.isFile) {
							out.push([entry.name,entry.toURL ? entry.toURL() : entry.toURI()]);
						}
					}
			}
			API.files=out;
			if (cb) cb.apply(context,[out]);
		}, function(){
			if (cb) cb.apply(context,[null]);
		});
}
var getFileURL=function(filename) {
	if (!API.files ) return null;
	var file= API.files.filter(function(f){return f[0]==filename});
	if (file.length) return file[0][1];
}
var rm=function(filename,cb,context) {
	 var url=getFileURL(filename);
	 if (url) rmURL(url,cb,context);
	 else if (cb) cb.apply(context,[false]);
}

var rmURL=function(filename,cb,context) {
		webkitResolveLocalFileSystemURL(filename, function(fileEntry) {
			fileEntry.remove(function() {
				if (cb) cb.apply(context,[true]);
			}, console.error);
		},  function(e){
			if (cb) cb.apply(context,[false]);//no such file
		});
}
function errorHandler(e) {
	console.error('Error: ' +e.name+ " "+e.message);
}
var initfs=function(grantedBytes,cb,context) {
	webkitRequestFileSystem(PERSISTENT, grantedBytes,  function(fs) {
		API.fs=fs;
		API.quota=grantedBytes;
		readdir(function(){
			API.initialized=true;
			cb.apply(context,[grantedBytes,fs]);
		},context);
	}, errorHandler);
}
var init=function(quota,cb,context) {
	navigator.webkitPersistentStorage.requestQuota(quota, 
			function(grantedBytes) {
				initfs(grantedBytes,cb,context);
		}, console.error 
	);
}
var queryQuota=function(cb,context) {
		var that=this;
		navigator.webkitPersistentStorage.queryUsageAndQuota( 
		 function(usage,quota){
				initfs(quota,function(){
					cb.apply(context,[usage,quota]);
				},context);
		});
}
var API={
	load:load
	,open:open
	,read:read
	,fstatSync:fstatSync
	,fstat:fstat,close:close
	,init:init
	,readdir:readdir
	,checkUpdate:checkUpdate
	,rm:rm
	,rmURL:rmURL
	,getFileURL:getFileURL
	,getDownloadSize:getDownloadSize
	,writeFile:writeFile
	,readFile:readFile
	,download:download
	,queryQuota:queryQuota
}
	module.exports=API;
},{}],"C:\\ksana2015\\node_modules\\ksana-jsonrom\\index.js":[function(require,module,exports){
module.exports={
	open:require("./kdb")
	,create:require("./kdbw")
	,html5fs:require("./html5fs")
}

},{"./html5fs":"C:\\ksana2015\\node_modules\\ksana-jsonrom\\html5fs.js","./kdb":"C:\\ksana2015\\node_modules\\ksana-jsonrom\\kdb.js","./kdbw":"C:\\ksana2015\\node_modules\\ksana-jsonrom\\kdbw.js"}],"C:\\ksana2015\\node_modules\\ksana-jsonrom\\kdb.js":[function(require,module,exports){
/*
	KDB version 3.0 GPL
	yapcheahshen@gmail.com
	2013/12/28
	asyncronize version of yadb

  remove dependency of Q, thanks to
  http://stackoverflow.com/questions/4234619/how-to-avoid-long-nesting-of-asynchronous-functions-in-node-js

  2015/1/2
  moved to ksanaforge/ksana-jsonrom
  add err in callback for node.js compliant
*/
var Kfs=null;

if (typeof ksanagap=="undefined") {
	Kfs=require('./kdbfs');			
} else {
	if (ksanagap.platform=="ios") {
		Kfs=require("./kdbfs_ios");
	} else if (ksanagap.platform=="node-webkit") {
		Kfs=require("./kdbfs");
	} else if (ksanagap.platform=="chrome") {
		Kfs=require("./kdbfs");
	} else {
		Kfs=require("./kdbfs_android");
	}
		
}


var DT={
	uint8:'1', //unsigned 1 byte integer
	int32:'4', // signed 4 bytes integer
	utf8:'8',  
	ucs2:'2',
	bool:'^', 
	blob:'&',
	utf8arr:'*', //shift of 8
	ucs2arr:'@', //shift of 2
	uint8arr:'!', //shift of 1
	int32arr:'$', //shift of 4
	vint:'`',
	pint:'~',	

	array:'\u001b',
	object:'\u001a' 
	//ydb start with object signature,
	//type a ydb in command prompt shows nothing
}
var verbose=0, readLog=function(){};
var _readLog=function(readtype,bytes) {
	console.log(readtype,bytes,"bytes");
}
if (verbose) readLog=_readLog;
var strsep="\uffff";
var Create=function(path,opts,cb) {
	/* loadxxx functions move file pointer */
	// load variable length int
	if (typeof opts=="function") {
		cb=opts;
		opts={};
	}

	
	var loadVInt =function(opts,blocksize,count,cb) {
		//if (count==0) return [];
		var that=this;

		this.fs.readBuf_packedint(opts.cur,blocksize,count,true,function(o){
			//console.log("vint");
			opts.cur+=o.adv;
			cb.apply(that,[o.data]);
		});
	}
	var loadVInt1=function(opts,cb) {
		var that=this;
		loadVInt.apply(this,[opts,6,1,function(data){
			//console.log("vint1");
			cb.apply(that,[data[0]]);
		}])
	}
	//for postings
	var loadPInt =function(opts,blocksize,count,cb) {
		var that=this;
		this.fs.readBuf_packedint(opts.cur,blocksize,count,false,function(o){
			//console.log("pint");
			opts.cur+=o.adv;
			cb.apply(that,[o.data]);
		});
	}
	// item can be any type (variable length)
	// maximum size of array is 1TB 2^40
	// structure:
	// signature,5 bytes offset, payload, itemlengths
	var getArrayLength=function(opts,cb) {
		var that=this;
		var dataoffset=0;

		this.fs.readUI8(opts.cur,function(len){
			var lengthoffset=len*4294967296;
			opts.cur++;
			that.fs.readUI32(opts.cur,function(len){
				opts.cur+=4;
				dataoffset=opts.cur; //keep this
				lengthoffset+=len;
				opts.cur+=lengthoffset;

				loadVInt1.apply(that,[opts,function(count){
					loadVInt.apply(that,[opts,count*6,count,function(sz){						
						cb({count:count,sz:sz,offset:dataoffset});
					}]);
				}]);
				
			});
		});
	}

	var loadArray = function(opts,blocksize,cb) {
		var that=this;
		getArrayLength.apply(this,[opts,function(L){
				var o=[];
				var endcur=opts.cur;
				opts.cur=L.offset;

				if (opts.lazy) { 
						var offset=L.offset;
						L.sz.map(function(sz){
							o[o.length]=strsep+offset.toString(16)
								   +strsep+sz.toString(16);
							offset+=sz;
						})
				} else {
					var taskqueue=[];
					for (var i=0;i<L.count;i++) {
						taskqueue.push(
							(function(sz){
								return (
									function(data){
										if (typeof data=='object' && data.__empty) {
											 //not pushing the first call
										}	else o.push(data);
										opts.blocksize=sz;
										load.apply(that,[opts, taskqueue.shift()]);
									}
								);
							})(L.sz[i])
						);
					}
					//last call to child load
					taskqueue.push(function(data){
						o.push(data);
						opts.cur=endcur;
						cb.apply(that,[o]);
					});
				}

				if (opts.lazy) cb.apply(that,[o]);
				else {
					taskqueue.shift()({__empty:true});
				}
			}
		])
	}		
	// item can be any type (variable length)
	// support lazy load
	// structure:
	// signature,5 bytes offset, payload, itemlengths, 
	//                    stringarray_signature, keys
	var loadObject = function(opts,blocksize,cb) {
		var that=this;
		var start=opts.cur;
		getArrayLength.apply(this,[opts,function(L) {
			opts.blocksize=blocksize-opts.cur+start;
			load.apply(that,[opts,function(keys){ //load the keys
				if (opts.keys) { //caller ask for keys
					keys.map(function(k) { opts.keys.push(k)});
				}

				var o={};
				var endcur=opts.cur;
				opts.cur=L.offset;
				if (opts.lazy) { 
					var offset=L.offset;
					for (var i=0;i<L.sz.length;i++) {
						//prefix with a \0, impossible for normal string
						o[keys[i]]=strsep+offset.toString(16)
							   +strsep+L.sz[i].toString(16);
						offset+=L.sz[i];
					}
				} else {
					var taskqueue=[];
					for (var i=0;i<L.count;i++) {
						taskqueue.push(
							(function(sz,key){
								return (
									function(data){
										if (typeof data=='object' && data.__empty) {
											//not saving the first call;
										} else {
											o[key]=data; 
										}
										opts.blocksize=sz;
										if (verbose) readLog("key",key);
										load.apply(that,[opts, taskqueue.shift()]);
									}
								);
							})(L.sz[i],keys[i-1])

						);
					}
					//last call to child load
					taskqueue.push(function(data){
						o[keys[keys.length-1]]=data;
						opts.cur=endcur;
						cb.apply(that,[o]);
					});
				}
				if (opts.lazy) cb.apply(that,[o]);
				else {
					taskqueue.shift()({__empty:true});
				}
			}]);
		}]);
	}

	//item is same known type
	var loadStringArray=function(opts,blocksize,encoding,cb) {
		var that=this;
		this.fs.readStringArray(opts.cur,blocksize,encoding,function(o){
			opts.cur+=blocksize;
			cb.apply(that,[o]);
		});
	}
	var loadIntegerArray=function(opts,blocksize,unitsize,cb) {
		var that=this;
		loadVInt1.apply(this,[opts,function(count){
			var o=that.fs.readFixedArray(opts.cur,count,unitsize,function(o){
				opts.cur+=count*unitsize;
				cb.apply(that,[o]);
			});
		}]);
	}
	var loadBlob=function(blocksize,cb) {
		var o=this.fs.readBuf(this.cur,blocksize);
		this.cur+=blocksize;
		return o;
	}	
	var loadbysignature=function(opts,signature,cb) {
		  var blocksize=opts.blocksize||this.fs.size; 
			opts.cur+=this.fs.signature_size;
			var datasize=blocksize-this.fs.signature_size;
			//basic types
			if (signature===DT.int32) {
				opts.cur+=4;
				this.fs.readI32(opts.cur-4,cb);
			} else if (signature===DT.uint8) {
				opts.cur++;
				this.fs.readUI8(opts.cur-1,cb);
			} else if (signature===DT.utf8) {
				var c=opts.cur;opts.cur+=datasize;
				this.fs.readString(c,datasize,'utf8',cb);
			} else if (signature===DT.ucs2) {
				var c=opts.cur;opts.cur+=datasize;
				this.fs.readString(c,datasize,'ucs2',cb);	
			} else if (signature===DT.bool) {
				opts.cur++;
				this.fs.readUI8(opts.cur-1,function(data){cb(!!data)});
			} else if (signature===DT.blob) {
				loadBlob(datasize,cb);
			}
			//variable length integers
			else if (signature===DT.vint) {
				loadVInt.apply(this,[opts,datasize,datasize,cb]);
			}
			else if (signature===DT.pint) {
				loadPInt.apply(this,[opts,datasize,datasize,cb]);
			}
			//simple array
			else if (signature===DT.utf8arr) {
				loadStringArray.apply(this,[opts,datasize,'utf8',cb]);
			}
			else if (signature===DT.ucs2arr) {
				loadStringArray.apply(this,[opts,datasize,'ucs2',cb]);
			}
			else if (signature===DT.uint8arr) {
				loadIntegerArray.apply(this,[opts,datasize,1,cb]);
			}
			else if (signature===DT.int32arr) {
				loadIntegerArray.apply(this,[opts,datasize,4,cb]);
			}
			//nested structure
			else if (signature===DT.array) {
				loadArray.apply(this,[opts,datasize,cb]);
			}
			else if (signature===DT.object) {
				loadObject.apply(this,[opts,datasize,cb]);
			}
			else {
				console.error('unsupported type',signature,opts)
				cb.apply(this,[null]);//make sure it return
				//throw 'unsupported type '+signature;
			}
	}

	var load=function(opts,cb) {
		opts=opts||{}; // this will served as context for entire load procedure
		opts.cur=opts.cur||0;
		var that=this;
		this.fs.readSignature(opts.cur, function(signature){
			loadbysignature.apply(that,[opts,signature,cb])
		});
		return this;
	}
	var CACHE=null;
	var KEY={};
	var ADDRESS={};
	var reset=function(cb) {
		if (!CACHE) {
			load.apply(this,[{cur:0,lazy:true},function(data){
				CACHE=data;
				cb.call(this);
			}]);	
		} else {
			cb.call(this);
		}
	}

	var exists=function(path,cb) {
		if (path.length==0) return true;
		var key=path.pop();
		var that=this;
		get.apply(this,[path,false,function(data){
			if (!path.join(strsep)) return (!!KEY[key]);
			var keys=KEY[path.join(strsep)];
			path.push(key);//put it back
			if (keys) cb.apply(that,[keys.indexOf(key)>-1]);
			else cb.apply(that,[false]);
		}]);
	}

	var getSync=function(path) {
		if (!CACHE) return undefined;	
		var o=CACHE;
		for (var i=0;i<path.length;i++) {
			var r=o[path[i]];
			if (typeof r=="undefined") return null;
			o=r;
		}
		return o;
	}
	var get=function(path,opts,cb) {
		if (typeof path=='undefined') path=[];
		if (typeof path=="string") path=[path];
		//opts.recursive=!!opts.recursive;
		if (typeof opts=="function") {
			cb=opts;node
			opts={};
		}
		var that=this;
		if (typeof cb!='function') return getSync(path);

		reset.apply(this,[function(){
			var o=CACHE;
			if (path.length==0) {
				if (opts.address) {
					cb([0,that.fs.size]);
				} else {
					cb(Object.keys(CACHE));	
				}
				return;
			} 
			
			var pathnow="",taskqueue=[],newopts={},r=null;
			var lastkey="";

			for (var i=0;i<path.length;i++) {
				var task=(function(key,k){

					return (function(data){
						if (!(typeof data=='object' && data.__empty)) {
							if (typeof o[lastkey]=='string' && o[lastkey][0]==strsep) o[lastkey]={};
							o[lastkey]=data; 
							o=o[lastkey];
							r=data[key];
							KEY[pathnow]=opts.keys;								
						} else {
							data=o[key];
							r=data;
						}

						if (typeof r==="undefined") {
							taskqueue=null;
							cb.apply(that,[r]); //return empty value
						} else {							
							if (parseInt(k)) pathnow+=strsep;
							pathnow+=key;
							if (typeof r=='string' && r[0]==strsep) { //offset of data to be loaded
								var p=r.substring(1).split(strsep).map(function(item){return parseInt(item,16)});
								var cur=p[0],sz=p[1];
								newopts.lazy=!opts.recursive || (k<path.length-1) ;
								newopts.blocksize=sz;newopts.cur=cur,newopts.keys=[];
								lastkey=key; //load is sync in android
								if (opts.address && taskqueue.length==1) {
									ADDRESS[pathnow]=[cur,sz];
									taskqueue.shift()(null,ADDRESS[pathnow]);
								} else {
									load.apply(that,[newopts, taskqueue.shift()]);
								}
							} else {
								if (opts.address && taskqueue.length==1) {
									taskqueue.shift()(null,ADDRESS[pathnow]);
								} else {
									taskqueue.shift().apply(that,[r]);
								}
							}
						}
					})
				})
				(path[i],i);
				
				taskqueue.push(task);
			}

			if (taskqueue.length==0) {
				cb.apply(that,[o]);
			} else {
				//last call to child load
				taskqueue.push(function(data,cursz){
					if (opts.address) {
						cb.apply(that,[cursz]);
					} else{
						var key=path[path.length-1];
						o[key]=data; KEY[pathnow]=opts.keys;
						cb.apply(that,[data]);
					}
				});
				taskqueue.shift()({__empty:true});			
			}

		}]); //reset
	}
	// get all keys in given path
	var getkeys=function(path,cb) {
		if (!path) path=[]
		var that=this;
		get.apply(this,[path,false,function(){
			if (path && path.length) {
				cb.apply(that,[KEY[path.join(strsep)]]);
			} else {
				cb.apply(that,[Object.keys(CACHE)]); 
				//top level, normally it is very small
			}
		}]);
	}

	var setupapi=function() {
		this.load=load;
//		this.cur=0;
		this.cache=function() {return CACHE};
		this.key=function() {return KEY};
		this.free=function() {
			CACHE=null;
			KEY=null;
			this.fs.free();
		}
		this.setCache=function(c) {CACHE=c};
		this.keys=getkeys;
		this.get=get;   // get a field, load if needed
		this.exists=exists;
		this.DT=DT;
		
		//install the sync version for node
		//if (typeof process!="undefined") require("./kdb_sync")(this);
		//if (cb) setTimeout(cb.bind(this),0);
		var that=this;
		var err=0;
		if (cb) {
			setTimeout(function(){
				cb(err,that);	
			},0);
		}
	}
	var that=this;
	var kfs=new Kfs(path,opts,function(err){
		if (err) {
			setTimeout(function(){
				cb(err,0);
			},0);
			return null;
		} else {
			that.size=this.size;
			setupapi.call(that);			
		}
	});
	this.fs=kfs;
	return this;
}

Create.datatypes=DT;

if (module) module.exports=Create;
//return Create;

},{"./kdbfs":"C:\\ksana2015\\node_modules\\ksana-jsonrom\\kdbfs.js","./kdbfs_android":"C:\\ksana2015\\node_modules\\ksana-jsonrom\\kdbfs_android.js","./kdbfs_ios":"C:\\ksana2015\\node_modules\\ksana-jsonrom\\kdbfs_ios.js"}],"C:\\ksana2015\\node_modules\\ksana-jsonrom\\kdbfs.js":[function(require,module,exports){
/* node.js and html5 file system abstraction layer*/
try {
	var fs=require("fs");
	var Buffer=require("buffer").Buffer;
} catch (e) {
	var fs=require('./html5fs');
	var Buffer=function(){ return ""};
	var html5fs=true; 	
}
var signature_size=1;
var verbose=0, readLog=function(){};
var _readLog=function(readtype,bytes) {
	console.log(readtype,bytes,"bytes");
}
if (verbose) readLog=_readLog;

var unpack_int = function (ar, count , reset) {
   count=count||ar.length;
  var r = [], i = 0, v = 0;
  do {
	var shift = 0;
	do {
	  v += ((ar[i] & 0x7F) << shift);
	  shift += 7;	  
	} while (ar[++i] & 0x80);
	r.push(v); if (reset) v=0;
	count--;
  } while (i<ar.length && count);
  return {data:r, adv:i };
}
var Open=function(path,opts,cb) {
	opts=opts||{};

	var readSignature=function(pos,cb) {
		var buf=new Buffer(signature_size);
		var that=this;
		fs.read(this.handle,buf,0,signature_size,pos,function(err,len,buffer){
			if (html5fs) var signature=String.fromCharCode((new Uint8Array(buffer))[0])
			else var signature=buffer.toString('utf8',0,signature_size);
			cb.apply(that,[signature]);
		});
	}

	//this is quite slow
	//wait for StringView +ArrayBuffer to solve the problem
	//https://groups.google.com/a/chromium.org/forum/#!topic/blink-dev/ylgiNY_ZSV0
	//if the string is always ucs2
	//can use Uint16 to read it.
	//http://updates.html5rocks.com/2012/06/How-to-convert-ArrayBuffer-to-and-from-String
	var decodeutf8 = function (utftext) {
		var string = "";
		var i = 0;
		var c=0,c1 = 0, c2 = 0 , c3=0;
		for (var i=0;i<utftext.length;i++) {
			if (utftext.charCodeAt(i)>127) break;
		}
		if (i>=utftext.length) return utftext;

		while ( i < utftext.length ) {
			c = utftext.charCodeAt(i);
			if (c < 128) {
				string += utftext[i];
				i++;
			} else if((c > 191) && (c < 224)) {
				c2 = utftext.charCodeAt(i+1);
				string += String.fromCharCode(((c & 31) << 6) | (c2 & 63));
				i += 2;
			} else {
				c2 = utftext.charCodeAt(i+1);
				c3 = utftext.charCodeAt(i+2);
				string += String.fromCharCode(((c & 15) << 12) | ((c2 & 63) << 6) | (c3 & 63));
				i += 3;
			}
		}
		return string;
	}

	var readString= function(pos,blocksize,encoding,cb) {
		encoding=encoding||'utf8';
		var buffer=new Buffer(blocksize);
		var that=this;
		fs.read(this.handle,buffer,0,blocksize,pos,function(err,len,buffer){
			readLog("string",len);
			if (html5fs) {
				if (encoding=='utf8') {
					var str=decodeutf8(String.fromCharCode.apply(null, new Uint8Array(buffer)))
				} else { //ucs2 is 3 times faster
					var str=String.fromCharCode.apply(null, new Uint16Array(buffer))	
				}
				
				cb.apply(that,[str]);
			} 
			else cb.apply(that,[buffer.toString(encoding)]);	
		});
	}

	//work around for chrome fromCharCode cannot accept huge array
	//https://code.google.com/p/chromium/issues/detail?id=56588
	var buf2stringarr=function(buf,enc) {
		if (enc=="utf8") 	var arr=new Uint8Array(buf);
		else var arr=new Uint16Array(buf);
		var i=0,codes=[],out=[],s="";
		while (i<arr.length) {
			if (arr[i]) {
				codes[codes.length]=arr[i];
			} else {
				s=String.fromCharCode.apply(null,codes);
				if (enc=="utf8") out[out.length]=decodeutf8(s);
				else out[out.length]=s;
				codes=[];				
			}
			i++;
		}
		
		s=String.fromCharCode.apply(null,codes);
		if (enc=="utf8") out[out.length]=decodeutf8(s);
		else out[out.length]=s;

		return out;
	}
	var readStringArray = function(pos,blocksize,encoding,cb) {
		var that=this,out=null;
		if (blocksize==0) return [];
		encoding=encoding||'utf8';
		var buffer=new Buffer(blocksize);
		fs.read(this.handle,buffer,0,blocksize,pos,function(err,len,buffer){
			if (html5fs) {
				readLog("stringArray",buffer.byteLength);

				if (encoding=='utf8') {
					out=buf2stringarr(buffer,"utf8");
				} else { //ucs2 is 3 times faster
					out=buf2stringarr(buffer,"ucs2");
				}
			} else {
				readLog("stringArray",buffer.length);
				out=buffer.toString(encoding).split('\0');
			} 	
			cb.apply(that,[out]);
		});
	}
	var readUI32=function(pos,cb) {
		var buffer=new Buffer(4);
		var that=this;
		fs.read(this.handle,buffer,0,4,pos,function(err,len,buffer){
			readLog("ui32",len);
			if (html5fs){
				//v=(new Uint32Array(buffer))[0];
				var v=new DataView(buffer).getUint32(0, false)
				cb(v);
			}
			else cb.apply(that,[buffer.readInt32BE(0)]);	
		});		
	}

	var readI32=function(pos,cb) {
		var buffer=new Buffer(4);
		var that=this;
		fs.read(this.handle,buffer,0,4,pos,function(err,len,buffer){
			readLog("i32",len);
			if (html5fs){
				var v=new DataView(buffer).getInt32(0, false)
				cb(v);
			}
			else  	cb.apply(that,[buffer.readInt32BE(0)]);	
		});
	}
	var readUI8=function(pos,cb) {
		var buffer=new Buffer(1);
		var that=this;

		fs.read(this.handle,buffer,0,1,pos,function(err,len,buffer){
			readLog("ui8",len);
			if (html5fs)cb( (new Uint8Array(buffer))[0]) ;
			else  			cb.apply(that,[buffer.readUInt8(0)]);	
			
		});
	}
	var readBuf=function(pos,blocksize,cb) {
		var that=this;
		var buf=new Buffer(blocksize);
		fs.read(this.handle,buf,0,blocksize,pos,function(err,len,buffer){
			readLog("buf",len);
			var buff=new Uint8Array(buffer)
			cb.apply(that,[buff]);
		});
	}
	var readBuf_packedint=function(pos,blocksize,count,reset,cb) {
		var that=this;
		readBuf.apply(this,[pos,blocksize,function(buffer){
			cb.apply(that,[unpack_int(buffer,count,reset)]);	
		}]);
		
	}
	var readFixedArray_html5fs=function(pos,count,unitsize,cb) {
		var func=null;
		if (unitsize===1) {
			func='getUint8';//Uint8Array;
		} else if (unitsize===2) {
			func='getUint16';//Uint16Array;
		} else if (unitsize===4) {
			func='getUint32';//Uint32Array;
		} else throw 'unsupported integer size';

		fs.read(this.handle,null,0,unitsize*count,pos,function(err,len,buffer){
			readLog("fix array",len);
			var out=[];
			if (unitsize==1) {
				out=new Uint8Array(buffer);
			} else {
				for (var i = 0; i < len / unitsize; i++) { //endian problem
				//	out.push( func(buffer,i*unitsize));
					out.push( v=new DataView(buffer)[func](i,false) );
				}
			}

			cb.apply(that,[out]);
		});
	}
	// signature, itemcount, payload
	var readFixedArray = function(pos ,count, unitsize,cb) {
		var func=null;
		var that=this;
		
		if (unitsize* count>this.size && this.size)  {
			console.log("array size exceed file size",this.size)
			return;
		}
		
		if (html5fs) return readFixedArray_html5fs.apply(this,[pos,count,unitsize,cb]);

		var items=new Buffer( unitsize* count);
		if (unitsize===1) {
			func=items.readUInt8;
		} else if (unitsize===2) {
			func=items.readUInt16BE;
		} else if (unitsize===4) {
			func=items.readUInt32BE;
		} else throw 'unsupported integer size';
		//console.log('itemcount',itemcount,'buffer',buffer);

		fs.read(this.handle,items,0,unitsize*count,pos,function(err,len,buffer){
			readLog("fix array",len);
			var out=[];
			for (var i = 0; i < items.length / unitsize; i++) {
				out.push( func.apply(items,[i*unitsize]));
			}
			cb.apply(that,[out]);
		});
	}

	var free=function() {
		//console.log('closing ',handle);
		fs.closeSync(this.handle);
	}
	var setupapi=function() {
		var that=this;
		this.readSignature=readSignature;
		this.readI32=readI32;
		this.readUI32=readUI32;
		this.readUI8=readUI8;
		this.readBuf=readBuf;
		this.readBuf_packedint=readBuf_packedint;
		this.readFixedArray=readFixedArray;
		this.readString=readString;
		this.readStringArray=readStringArray;
		this.signature_size=signature_size;
		this.free=free;
		if (html5fs) {
			var fn=path;
			if (path.indexOf("filesystem:")==0) fn=path.substr(path.lastIndexOf("/"));
			fs.fs.root.getFile(fn,{},function(entry){
			  entry.getMetadata(function(metadata) { 
				that.size=metadata.size;
				if (cb) setTimeout(cb.bind(that),0);
				});
			});
		} else {
			var stat=fs.fstatSync(this.handle);
			this.stat=stat;
			this.size=stat.size;		
			if (cb)	setTimeout(cb.bind(this,0),0);	
		}
	}

	var that=this;
	if (html5fs) {
		fs.open(path,function(h){
			that.handle=h;
			that.html5fs=true;
			setupapi.call(that);
			that.opened=true;
		})
	} else {
		if (fs.existsSync(path)){
			this.handle=fs.openSync(path,'r');//,function(err,handle){
			this.opened=true;
			setupapi.call(this);
		} else {
			if (cb)	setTimeout(cb.bind(null,"file not found:"+path),0);	
			return null;
		}
	}
	return this;
}
module.exports=Open;
},{"./html5fs":"C:\\ksana2015\\node_modules\\ksana-jsonrom\\html5fs.js","buffer":false,"fs":false}],"C:\\ksana2015\\node_modules\\ksana-jsonrom\\kdbfs_android.js":[function(require,module,exports){
/*
  JAVA can only return Number and String
	array and buffer return in string format
	need JSON.parse
*/
var verbose=0;

var readSignature=function(pos,cb) {
	if (verbose) console.debug("read signature");
	var signature=kfs.readUTF8String(this.handle,pos,1);
	if (verbose) console.debug(signature,signature.charCodeAt(0));
	cb.apply(this,[signature]);
}
var readI32=function(pos,cb) {
	if (verbose) console.debug("read i32 at "+pos);
	var i32=kfs.readInt32(this.handle,pos);
	if (verbose) console.debug(i32);
	cb.apply(this,[i32]);	
}
var readUI32=function(pos,cb) {
	if (verbose) console.debug("read ui32 at "+pos);
	var ui32=kfs.readUInt32(this.handle,pos);
	if (verbose) console.debug(ui32);
	cb.apply(this,[ui32]);
}
var readUI8=function(pos,cb) {
	if (verbose) console.debug("read ui8 at "+pos); 
	var ui8=kfs.readUInt8(this.handle,pos);
	if (verbose) console.debug(ui8);
	cb.apply(this,[ui8]);
}
var readBuf=function(pos,blocksize,cb) {
	if (verbose) console.debug("read buffer at "+pos+ " blocksize "+blocksize);
	var buf=kfs.readBuf(this.handle,pos,blocksize);
	var buff=JSON.parse(buf);
	if (verbose) console.debug("buffer length"+buff.length);
	cb.apply(this,[buff]);	
}
var readBuf_packedint=function(pos,blocksize,count,reset,cb) {
	if (verbose) console.debug("read packed int at "+pos+" blocksize "+blocksize+" count "+count);
	var buf=kfs.readBuf_packedint(this.handle,pos,blocksize,count,reset);
	var adv=parseInt(buf);
	var buff=JSON.parse(buf.substr(buf.indexOf("[")));
	if (verbose) console.debug("packedInt length "+buff.length+" first item="+buff[0]);
	cb.apply(this,[{data:buff,adv:adv}]);	
}


var readString= function(pos,blocksize,encoding,cb) {
	if (verbose) console.debug("readstring at "+pos+" blocksize " +blocksize+" enc:"+encoding);
	if (encoding=="ucs2") {
		var str=kfs.readULE16String(this.handle,pos,blocksize);
	} else {
		var str=kfs.readUTF8String(this.handle,pos,blocksize);	
	}	 
	if (verbose) console.debug(str);
	cb.apply(this,[str]);	
}

var readFixedArray = function(pos ,count, unitsize,cb) {
	if (verbose) console.debug("read fixed array at "+pos+" count "+count+" unitsize "+unitsize); 
	var buf=kfs.readFixedArray(this.handle,pos,count,unitsize);
	var buff=JSON.parse(buf);
	if (verbose) console.debug("array length"+buff.length);
	cb.apply(this,[buff]);	
}
var readStringArray = function(pos,blocksize,encoding,cb) {
	if (verbose) console.log("read String array at "+pos+" blocksize "+blocksize +" enc "+encoding); 
	encoding = encoding||"utf8";
	var buf=kfs.readStringArray(this.handle,pos,blocksize,encoding);
	//var buff=JSON.parse(buf);
	if (verbose) console.debug("read string array");
	var buff=buf.split("\uffff"); //cannot return string with 0
	if (verbose) console.debug("array length"+buff.length);
	cb.apply(this,[buff]);	
}
var mergePostings=function(positions,cb) {
	var buf=kfs.mergePostings(this.handle,JSON.stringify(positions));
	if (!buf || buf.length==0) return [];
	else return JSON.parse(buf);
}

var free=function() {
	//console.log('closing ',handle);
	kfs.close(this.handle);
}
var Open=function(path,opts,cb) {
	opts=opts||{};
	var signature_size=1;
	var setupapi=function() { 
		this.readSignature=readSignature;
		this.readI32=readI32;
		this.readUI32=readUI32;
		this.readUI8=readUI8;
		this.readBuf=readBuf;
		this.readBuf_packedint=readBuf_packedint;
		this.readFixedArray=readFixedArray;
		this.readString=readString;
		this.readStringArray=readStringArray;
		this.signature_size=signature_size;
		this.mergePostings=mergePostings;
		this.free=free;
		this.size=kfs.getFileSize(this.handle);
		if (verbose) console.log("filesize  "+this.size);
		if (cb)	cb.call(this);
	}

	this.handle=kfs.open(path);
	this.opened=true;
	setupapi.call(this);
	return this;
}

module.exports=Open;
},{}],"C:\\ksana2015\\node_modules\\ksana-jsonrom\\kdbfs_ios.js":[function(require,module,exports){
/*
  JSContext can return all Javascript types.
*/
var verbose=1;

var readSignature=function(pos,cb) {
	if (verbose)  ksanagap.log("read signature at "+pos);
	var signature=kfs.readUTF8String(this.handle,pos,1);
	if (verbose)  ksanagap.log(signature+" "+signature.charCodeAt(0));
	cb.apply(this,[signature]);
}
var readI32=function(pos,cb) {
	if (verbose)  ksanagap.log("read i32 at "+pos);
	var i32=kfs.readInt32(this.handle,pos);
	if (verbose)  ksanagap.log(i32);
	cb.apply(this,[i32]);	
}
var readUI32=function(pos,cb) {
	if (verbose)  ksanagap.log("read ui32 at "+pos);
	var ui32=kfs.readUInt32(this.handle,pos);
	if (verbose)  ksanagap.log(ui32);
	cb.apply(this,[ui32]);
}
var readUI8=function(pos,cb) {
	if (verbose)  ksanagap.log("read ui8 at "+pos); 
	var ui8=kfs.readUInt8(this.handle,pos);
	if (verbose)  ksanagap.log(ui8);
	cb.apply(this,[ui8]);
}
var readBuf=function(pos,blocksize,cb) {
	if (verbose)  ksanagap.log("read buffer at "+pos);
	var buf=kfs.readBuf(this.handle,pos,blocksize);
	if (verbose)  ksanagap.log("buffer length"+buf.length);
	cb.apply(this,[buf]);	
}
var readBuf_packedint=function(pos,blocksize,count,reset,cb) {
	if (verbose)  ksanagap.log("read packed int fast, blocksize "+blocksize+" at "+pos);var t=new Date();
	var buf=kfs.readBuf_packedint(this.handle,pos,blocksize,count,reset);
	if (verbose)  ksanagap.log("return from packedint, time" + (new Date()-t));
	if (typeof buf.data=="string") {
		buf.data=eval("["+buf.data.substr(0,buf.data.length-1)+"]");
	}
	if (verbose)  ksanagap.log("unpacked length"+buf.data.length+" time" + (new Date()-t) );
	cb.apply(this,[buf]);
}


var readString= function(pos,blocksize,encoding,cb) {

	if (verbose)  ksanagap.log("readstring at "+pos+" blocksize "+blocksize+" "+encoding);var t=new Date();
	if (encoding=="ucs2") {
		var str=kfs.readULE16String(this.handle,pos,blocksize);
	} else {
		var str=kfs.readUTF8String(this.handle,pos,blocksize);	
	}
	if (verbose)  ksanagap.log(str+" time"+(new Date()-t));
	cb.apply(this,[str]);	
}

var readFixedArray = function(pos ,count, unitsize,cb) {
	if (verbose)  ksanagap.log("read fixed array at "+pos); var t=new Date();
	var buf=kfs.readFixedArray(this.handle,pos,count,unitsize);
	if (verbose)  ksanagap.log("array length "+buf.length+" time"+(new Date()-t));
	cb.apply(this,[buf]);	
}
var readStringArray = function(pos,blocksize,encoding,cb) {
	//if (verbose)  ksanagap.log("read String array "+blocksize +" "+encoding); 
	encoding = encoding||"utf8";
	if (verbose)  ksanagap.log("read string array at "+pos);var t=new Date();
	var buf=kfs.readStringArray(this.handle,pos,blocksize,encoding);
	if (typeof buf=="string") buf=buf.split("\0");
	//var buff=JSON.parse(buf);
	//var buff=buf.split("\uffff"); //cannot return string with 0
	if (verbose)  ksanagap.log("string array length"+buf.length+" time"+(new Date()-t));
	cb.apply(this,[buf]);
}

var mergePostings=function(positions) {
	var buf=kfs.mergePostings(this.handle,positions);
	if (typeof buf=="string") {
		buf=eval("["+buf.substr(0,buf.length-1)+"]");
	}
	return buf;
}
var free=function() {
	////if (verbose)  ksanagap.log('closing ',handle);
	kfs.close(this.handle);
}
var Open=function(path,opts,cb) {
	opts=opts||{};
	var signature_size=1;
	var setupapi=function() { 
		this.readSignature=readSignature;
		this.readI32=readI32;
		this.readUI32=readUI32;
		this.readUI8=readUI8;
		this.readBuf=readBuf;
		this.readBuf_packedint=readBuf_packedint;
		this.readFixedArray=readFixedArray;
		this.readString=readString;
		this.readStringArray=readStringArray;
		this.signature_size=signature_size;
		this.mergePostings=mergePostings;
		this.free=free;
		this.size=kfs.getFileSize(this.handle);
		if (verbose)  ksanagap.log("filesize  "+this.size);
		if (cb)	cb.call(this);
	}

	this.handle=kfs.open(path);
	this.opened=true;
	setupapi.call(this);
	return this;
}

module.exports=Open;
},{}],"C:\\ksana2015\\node_modules\\ksana-jsonrom\\kdbw.js":[function(require,module,exports){
/*
  convert any json into a binary buffer
  the buffer can be saved with a single line of fs.writeFile
*/

var DT={
	uint8:'1', //unsigned 1 byte integer
	int32:'4', // signed 4 bytes integer
	utf8:'8',  
	ucs2:'2',
	bool:'^', 
	blob:'&',
	utf8arr:'*', //shift of 8
	ucs2arr:'@', //shift of 2
	uint8arr:'!', //shift of 1
	int32arr:'$', //shift of 4
	vint:'`',
	pint:'~',	

	array:'\u001b',
	object:'\u001a' 
	//ydb start with object signature,
	//type a ydb in command prompt shows nothing
}
var key_writing="";//for debugging
var pack_int = function (ar, savedelta) { // pack ar into
  if (!ar || ar.length === 0) return []; // empty array
  var r = [],
  i = 0,
  j = 0,
  delta = 0,
  prev = 0;
  
  do {
	delta = ar[i];
	if (savedelta) {
		delta -= prev;
	}
	if (delta < 0) {
	  console.trace('negative',prev,ar[i])
	  throw 'negetive';
	  break;
	}
	
	r[j++] = delta & 0x7f;
	delta >>= 7;
	while (delta > 0) {
	  r[j++] = (delta & 0x7f) | 0x80;
	  delta >>= 7;
	}
	prev = ar[i];
	i++;
  } while (i < ar.length);
  return r;
}
var Kfs=function(path,opts) {
	
	var handle=null;
	opts=opts||{};
	opts.size=opts.size||65536*2048; 
	console.log('kdb estimate size:',opts.size);
	var dbuf=new Buffer(opts.size);
	var cur=0;//dbuf cursor
	
	var writeSignature=function(value,pos) {
		dbuf.write(value,pos,value.length,'utf8');
		if (pos+value.length>cur) cur=pos+value.length;
		return value.length;
	}
	var writeOffset=function(value,pos) {
		dbuf.writeUInt8(Math.floor(value / (65536*65536)),pos);
		dbuf.writeUInt32BE( value & 0xFFFFFFFF,pos+1);
		if (pos+5>cur) cur=pos+5;
		return 5;
	}
	var writeString= function(value,pos,encoding) {
		encoding=encoding||'ucs2';
		if (value=="") throw "cannot write null string";
		if (encoding==='utf8')dbuf.write(DT.utf8,pos,1,'utf8');
		else if (encoding==='ucs2')dbuf.write(DT.ucs2,pos,1,'utf8');
		else throw 'unsupported encoding '+encoding;
			
		var len=Buffer.byteLength(value, encoding);
		dbuf.write(value,pos+1,len,encoding);
		
		if (pos+len+1>cur) cur=pos+len+1;
		return len+1; // signature
	}
	var writeStringArray = function(value,pos,encoding) {
		encoding=encoding||'ucs2';
		if (encoding==='utf8') dbuf.write(DT.utf8arr,pos,1,'utf8');
		else if (encoding==='ucs2')dbuf.write(DT.ucs2arr,pos,1,'utf8');
		else throw 'unsupported encoding '+encoding;
		
		var v=value.join('\0');
		var len=Buffer.byteLength(v, encoding);
		if (0===len) {
			throw "empty string array " + key_writing;
		}
		dbuf.write(v,pos+1,len,encoding);
		if (pos+len+1>cur) cur=pos+len+1;
		return len+1;
	}
	var writeI32=function(value,pos) {
		dbuf.write(DT.int32,pos,1,'utf8');
		dbuf.writeInt32BE(value,pos+1);
		if (pos+5>cur) cur=pos+5;
		return 5;
	}
	var writeUI8=function(value,pos) {
		dbuf.write(DT.uint8,pos,1,'utf8');
		dbuf.writeUInt8(value,pos+1);
		if (pos+2>cur) cur=pos+2;
		return 2;
	}
	var writeBool=function(value,pos) {
		dbuf.write(DT.bool,pos,1,'utf8');
		dbuf.writeUInt8(Number(value),pos+1);
		if (pos+2>cur) cur=pos+2;
		return 2;
	}		
	var writeBlob=function(value,pos) {
		dbuf.write(DT.blob,pos,1,'utf8');
		value.copy(dbuf, pos+1);
		var written=value.length+1;
		if (pos+written>cur) cur=pos+written;
		return written;
	}		
	/* no signature */
	var writeFixedArray = function(value,pos,unitsize) {
		//console.log('v.len',value.length,items.length,unitsize);
		if (unitsize===1) var func=dbuf.writeUInt8;
		else if (unitsize===4)var func=dbuf.writeInt32BE;
		else throw 'unsupported integer size';
		if (!value.length) {
			throw "empty fixed array "+key_writing;
		}
		for (var i = 0; i < value.length ; i++) {
			func.apply(dbuf,[value[i],i*unitsize+pos])
		}
		var len=unitsize*value.length;
		if (pos+len>cur) cur=pos+len;
		return len;
	}

	this.writeI32=writeI32;
	this.writeBool=writeBool;
	this.writeBlob=writeBlob;
	this.writeUI8=writeUI8;
	this.writeString=writeString;
	this.writeSignature=writeSignature;
	this.writeOffset=writeOffset; //5 bytes offset
	this.writeStringArray=writeStringArray;
	this.writeFixedArray=writeFixedArray;
	Object.defineProperty(this, "buf", {get : function(){ return dbuf; }});
	
	return this;
}

var Create=function(path,opts) {
	opts=opts||{};
	var kfs=new Kfs(path,opts);
	var cur=0;

	var handle={};
	
	//no signature
	var writeVInt =function(arr) {
		var o=pack_int(arr,false);
		kfs.writeFixedArray(o,cur,1);
		cur+=o.length;
	}
	var writeVInt1=function(value) {
		writeVInt([value]);
	}
	//for postings
	var writePInt =function(arr) {
		var o=pack_int(arr,true);
		kfs.writeFixedArray(o,cur,1);
		cur+=o.length;
	}
	
	var saveVInt = function(arr,key) {
		var start=cur;
		key_writing=key;
		cur+=kfs.writeSignature(DT.vint,cur);
		writeVInt(arr);
		var written = cur-start;
		pushitem(key,written);
		return written;		
	}
	var savePInt = function(arr,key) {
		var start=cur;
		key_writing=key;
		cur+=kfs.writeSignature(DT.pint,cur);
		writePInt(arr);
		var written = cur-start;
		pushitem(key,written);
		return written;	
	}

	
	var saveUI8 = function(value,key) {
		var written=kfs.writeUI8(value,cur);
		cur+=written;
		pushitem(key,written);
		return written;
	}
	var saveBool=function(value,key) {
		var written=kfs.writeBool(value,cur);
		cur+=written;
		pushitem(key,written);
		return written;
	}
	var saveI32 = function(value,key) {
		var written=kfs.writeI32(value,cur);
		cur+=written;
		pushitem(key,written);
		return written;
	}	
	var saveString = function(value,key,encoding) {
		encoding=encoding||stringencoding;
		key_writing=key;
		var written=kfs.writeString(value,cur,encoding);
		cur+=written;
		pushitem(key,written);
		return written;
	}
	var saveStringArray = function(arr,key,encoding) {
		encoding=encoding||stringencoding;
		key_writing=key;
		try {
			var written=kfs.writeStringArray(arr,cur,encoding);
		} catch(e) {
			throw e;
		}
		cur+=written;
		pushitem(key,written);
		return written;
	}
	
	var saveBlob = function(value,key) {
		key_writing=key;
		var written=kfs.writeBlob(value,cur);
		cur+=written;
		pushitem(key,written);
		return written;
	}

	var folders=[];
	var pushitem=function(key,written) {
		var folder=folders[folders.length-1];	
		if (!folder) return ;
		folder.itemslength.push(written);
		if (key) {
			if (!folder.keys) throw 'cannot have key in array';
			folder.keys.push(key);
		}
	}	
	var open = function(opt) {
		var start=cur;
		var key=opt.key || null;
		var type=opt.type||DT.array;
		cur+=kfs.writeSignature(type,cur);
		cur+=kfs.writeOffset(0x0,cur); // pre-alloc space for offset
		var folder={
			type:type, key:key,
			start:start,datastart:cur,
			itemslength:[] };
		if (type===DT.object) folder.keys=[];
		folders.push(folder);
	}
	var openObject = function(key) {
		open({type:DT.object,key:key});
	}
	var openArray = function(key) {
		open({type:DT.array,key:key});
	}
	var saveInts=function(arr,key,func) {
		func.apply(handle,[arr,key]);
	}
	var close = function(opt) {
		if (!folders.length) throw 'empty stack';
		var folder=folders.pop();
		//jump to lengths and keys
		kfs.writeOffset( cur-folder.datastart, folder.datastart-5);
		var itemcount=folder.itemslength.length;
		//save lengths
		writeVInt1(itemcount);
		writeVInt(folder.itemslength);
		
		if (folder.type===DT.object) {
			//use utf8 for keys
			cur+=kfs.writeStringArray(folder.keys,cur,'utf8');
		}
		written=cur-folder.start;
		pushitem(folder.key,written);
		return written;
	}
	
	
	var stringencoding='ucs2';
	var stringEncoding=function(newencoding) {
		if (newencoding) stringencoding=newencoding;
		else return stringencoding;
	}
	
	var allnumber_fast=function(arr) {
		if (arr.length<5) return allnumber(arr);
		if (typeof arr[0]=='number'
		    && Math.round(arr[0])==arr[0] && arr[0]>=0)
			return true;
		return false;
	}
	var allstring_fast=function(arr) {
		if (arr.length<5) return allstring(arr);
		if (typeof arr[0]=='string') return true;
		return false;
	}	
	var allnumber=function(arr) {
		for (var i=0;i<arr.length;i++) {
			if (typeof arr[i]!=='number') return false;
		}
		return true;
	}
	var allstring=function(arr) {
		for (var i=0;i<arr.length;i++) {
			if (typeof arr[i]!=='string') return false;
		}
		return true;
	}
	var getEncoding=function(key,encs) {
		var enc=encs[key];
		if (!enc) return null;
		if (enc=='delta' || enc=='posting') {
			return savePInt;
		} else if (enc=="variable") {
			return saveVInt;
		}
		return null;
	}
	var save=function(J,key,opts) {
		opts=opts||{};
		
		if (typeof J=="null" || typeof J=="undefined") {
			throw 'cannot save null value of ['+key+'] folders'+JSON.stringify(folders);
			return;
		}
		var type=J.constructor.name;
		if (type==='Object') {
			openObject(key);
			for (var i in J) {
				save(J[i],i,opts);
				if (opts.autodelete) delete J[i];
			}
			close();
		} else if (type==='Array') {
			if (allnumber_fast(J)) {
				if (J.sorted) { //number array is sorted
					saveInts(J,key,savePInt);	//posting delta format
				} else {
					saveInts(J,key,saveVInt);	
				}
			} else if (allstring_fast(J)) {
				saveStringArray(J,key);
			} else {
				openArray(key);
				for (var i=0;i<J.length;i++) {
					save(J[i],null,opts);
					if (opts.autodelete) delete J[i];
				}
				close();
			}
		} else if (type==='String') {
			saveString(J,key);
		} else if (type==='Number') {
			if (J>=0&&J<256) saveUI8(J,key);
			else saveI32(J,key);
		} else if (type==='Boolean') {
			saveBool(J,key);
		} else if (type==='Buffer') {
			saveBlob(J,key);
		} else {
			throw 'unsupported type '+type;
		}
	}
	
	var free=function() {
		while (folders.length) close();
		kfs.free();
	}
	var currentsize=function() {
		return cur;
	}

	Object.defineProperty(handle, "size", {get : function(){ return cur; }});

	var writeFile=function(fn,opts,cb) {
		if (typeof fs=="undefined") {
			var fs=opts.fs||require('fs');	
		}
		var totalbyte=handle.currentsize();
		var written=0,batch=0;
		
		if (typeof cb=="undefined" || typeof opts=="function") {
			cb=opts;
		}
		opts=opts||{};
		batchsize=opts.batchsize||1024*1024*16; //16 MB

		if (fs.existsSync(fn)) fs.unlinkSync(fn);

		var writeCb=function(total,written,cb,next) {
			return function(err) {
				if (err) throw "write error"+err;
				cb(total,written);
				batch++;
				next();
			}
		}

		var next=function() {
			if (batch<batches) {
				var bufstart=batchsize*batch;
				var bufend=bufstart+batchsize;
				if (bufend>totalbyte) bufend=totalbyte;
				var sliced=kfs.buf.slice(bufstart,bufend);
				written+=sliced.length;
				fs.appendFile(fn,sliced,writeCb(totalbyte,written, cb,next));
			}
		}
		var batches=1+Math.floor(handle.size/batchsize);
		next();
	}
	handle.free=free;
	handle.saveI32=saveI32;
	handle.saveUI8=saveUI8;
	handle.saveBool=saveBool;
	handle.saveString=saveString;
	handle.saveVInt=saveVInt;
	handle.savePInt=savePInt;
	handle.saveInts=saveInts;
	handle.saveBlob=saveBlob;
	handle.save=save;
	handle.openArray=openArray;
	handle.openObject=openObject;
	handle.stringEncoding=stringEncoding;
	//this.integerEncoding=integerEncoding;
	handle.close=close;
	handle.writeFile=writeFile;
	handle.currentsize=currentsize;
	return handle;
}

module.exports=Create;
},{"fs":false}]},{},["C:\\ksana2015\\node_modules\\ksana-jsonrom\\index.js"])
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbIi4uXFwuLlxcLi5cXFVzZXJzXFxjaGVhaHNoZW5cXEFwcERhdGFcXFJvYW1pbmdcXG5wbVxcbm9kZV9tb2R1bGVzXFxicm93c2VyaWZ5XFxub2RlX21vZHVsZXNcXGJyb3dzZXItcGFja1xcX3ByZWx1ZGUuanMiLCJodG1sNWZzLmpzIiwiaW5kZXguanMiLCJrZGIuanMiLCJrZGJmcy5qcyIsImtkYmZzX2FuZHJvaWQuanMiLCJrZGJmc19pb3MuanMiLCJrZGJ3LmpzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiJBQUFBO0FDQUE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDL1BBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUNMQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDdmZBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUNqVEE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQ2pIQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQ25IQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBIiwiZmlsZSI6ImdlbmVyYXRlZC5qcyIsInNvdXJjZVJvb3QiOiIiLCJzb3VyY2VzQ29udGVudCI6WyIoZnVuY3Rpb24gZSh0LG4scil7ZnVuY3Rpb24gcyhvLHUpe2lmKCFuW29dKXtpZighdFtvXSl7dmFyIGE9dHlwZW9mIHJlcXVpcmU9PVwiZnVuY3Rpb25cIiYmcmVxdWlyZTtpZighdSYmYSlyZXR1cm4gYShvLCEwKTtpZihpKXJldHVybiBpKG8sITApO3ZhciBmPW5ldyBFcnJvcihcIkNhbm5vdCBmaW5kIG1vZHVsZSAnXCIrbytcIidcIik7dGhyb3cgZi5jb2RlPVwiTU9EVUxFX05PVF9GT1VORFwiLGZ9dmFyIGw9bltvXT17ZXhwb3J0czp7fX07dFtvXVswXS5jYWxsKGwuZXhwb3J0cyxmdW5jdGlvbihlKXt2YXIgbj10W29dWzFdW2VdO3JldHVybiBzKG4/bjplKX0sbCxsLmV4cG9ydHMsZSx0LG4scil9cmV0dXJuIG5bb10uZXhwb3J0c312YXIgaT10eXBlb2YgcmVxdWlyZT09XCJmdW5jdGlvblwiJiZyZXF1aXJlO2Zvcih2YXIgbz0wO288ci5sZW5ndGg7bysrKXMocltvXSk7cmV0dXJuIHN9KSIsIi8qIGVtdWxhdGUgZmlsZXN5c3RlbSBvbiBodG1sNSBicm93c2VyICovXHJcbnZhciByZWFkPWZ1bmN0aW9uKGhhbmRsZSxidWZmZXIsb2Zmc2V0LGxlbmd0aCxwb3NpdGlvbixjYikgey8vYnVmZmVyIGFuZCBvZmZzZXQgaXMgbm90IHVzZWRcclxuXHR2YXIgeGhyID0gbmV3IFhNTEh0dHBSZXF1ZXN0KCk7XHJcblx0eGhyLm9wZW4oJ0dFVCcsIGhhbmRsZS51cmwgLCB0cnVlKTtcclxuXHR2YXIgcmFuZ2U9W3Bvc2l0aW9uLGxlbmd0aCtwb3NpdGlvbi0xXTtcclxuXHR4aHIuc2V0UmVxdWVzdEhlYWRlcignUmFuZ2UnLCAnYnl0ZXM9JytyYW5nZVswXSsnLScrcmFuZ2VbMV0pO1xyXG5cdHhoci5yZXNwb25zZVR5cGUgPSAnYXJyYXlidWZmZXInO1xyXG5cdHhoci5zZW5kKCk7XHJcblx0eGhyLm9ubG9hZCA9IGZ1bmN0aW9uKGUpIHtcclxuXHRcdHZhciB0aGF0PXRoaXM7XHJcblx0XHRzZXRUaW1lb3V0KGZ1bmN0aW9uKCl7XHJcblx0XHRcdGNiKDAsdGhhdC5yZXNwb25zZS5ieXRlTGVuZ3RoLHRoYXQucmVzcG9uc2UpO1xyXG5cdFx0fSwwKTtcclxuXHR9OyBcclxufVxyXG52YXIgY2xvc2U9ZnVuY3Rpb24oaGFuZGxlKSB7fVxyXG52YXIgZnN0YXRTeW5jPWZ1bmN0aW9uKGhhbmRsZSkge1xyXG5cdHRocm93IFwibm90IGltcGxlbWVudCB5ZXRcIjtcclxufVxyXG52YXIgZnN0YXQ9ZnVuY3Rpb24oaGFuZGxlLGNiKSB7XHJcblx0dGhyb3cgXCJub3QgaW1wbGVtZW50IHlldFwiO1xyXG59XHJcbnZhciBfb3Blbj1mdW5jdGlvbihmbl91cmwsY2IpIHtcclxuXHRcdHZhciBoYW5kbGU9e307XHJcblx0XHRpZiAoZm5fdXJsLmluZGV4T2YoXCJmaWxlc3lzdGVtOlwiKT09MCl7XHJcblx0XHRcdGhhbmRsZS51cmw9Zm5fdXJsO1xyXG5cdFx0XHRoYW5kbGUuZm49Zm5fdXJsLnN1YnN0ciggZm5fdXJsLmxhc3RJbmRleE9mKFwiL1wiKSsxKTtcclxuXHRcdH0gZWxzZSB7XHJcblx0XHRcdGhhbmRsZS5mbj1mbl91cmw7XHJcblx0XHRcdHZhciB1cmw9QVBJLmZpbGVzLmZpbHRlcihmdW5jdGlvbihmKXsgcmV0dXJuIChmWzBdPT1mbl91cmwpfSk7XHJcblx0XHRcdGlmICh1cmwubGVuZ3RoKSBoYW5kbGUudXJsPXVybFswXVsxXTtcclxuXHRcdH1cclxuXHRcdGNiKGhhbmRsZSk7XHJcbn1cclxudmFyIG9wZW49ZnVuY3Rpb24oZm5fdXJsLGNiKSB7XHJcblx0XHRpZiAoIUFQSS5pbml0aWFsaXplZCkge2luaXQoMTAyNCoxMDI0LGZ1bmN0aW9uKCl7XHJcblx0XHRcdF9vcGVuLmFwcGx5KHRoaXMsW2ZuX3VybCxjYl0pO1xyXG5cdFx0fSx0aGlzKX0gZWxzZSBfb3Blbi5hcHBseSh0aGlzLFtmbl91cmwsY2JdKTtcclxufVxyXG52YXIgbG9hZD1mdW5jdGlvbihmaWxlbmFtZSxtb2RlLGNiKSB7XHJcblx0b3BlbihmaWxlbmFtZSxtb2RlLGNiLHRydWUpO1xyXG59XHJcbnZhciBnZXRfaGVhZD1mdW5jdGlvbih1cmwsZmllbGQsY2Ipe1xyXG5cdFx0dmFyIHhociA9IG5ldyBYTUxIdHRwUmVxdWVzdCgpO1xyXG5cdFx0eGhyLm9wZW4oXCJIRUFEXCIsIHVybCwgdHJ1ZSk7XHJcblx0XHR4aHIub25yZWFkeXN0YXRlY2hhbmdlID0gZnVuY3Rpb24oKSB7XHJcblx0XHRcdFx0aWYgKHRoaXMucmVhZHlTdGF0ZSA9PSB0aGlzLkRPTkUpIHtcclxuXHRcdFx0XHRcdGNiKHhoci5nZXRSZXNwb25zZUhlYWRlcihmaWVsZCkpO1xyXG5cdFx0XHRcdH0gZWxzZSB7XHJcblx0XHRcdFx0XHRpZiAodGhpcy5zdGF0dXMhPT0yMDAmJnRoaXMuc3RhdHVzIT09MjA2KSB7XHJcblx0XHRcdFx0XHRcdGNiKFwiXCIpO1xyXG5cdFx0XHRcdFx0fVxyXG5cdFx0XHRcdH1cclxuXHRcdH07XHJcblx0XHR4aHIuc2VuZCgpO1x0XHJcbn1cclxudmFyIGdldF9kYXRlPWZ1bmN0aW9uKHVybCxjYikge1xyXG5cdFx0Z2V0X2hlYWQodXJsLFwiTGFzdC1Nb2RpZmllZFwiLGZ1bmN0aW9uKHZhbHVlKXtcclxuXHRcdFx0Y2IodmFsdWUpO1xyXG5cdFx0fSk7XHJcbn1cclxudmFyICBnZXREb3dubG9hZFNpemU9ZnVuY3Rpb24odXJsLCBjYikge1xyXG5cdFx0Z2V0X2hlYWQodXJsLFwiQ29udGVudC1MZW5ndGhcIixmdW5jdGlvbih2YWx1ZSl7XHJcblx0XHRcdGNiKHBhcnNlSW50KHZhbHVlKSk7XHJcblx0XHR9KTtcclxufTtcclxudmFyIGNoZWNrVXBkYXRlPWZ1bmN0aW9uKHVybCxmbixjYikge1xyXG5cdFx0aWYgKCF1cmwpIHtcclxuXHRcdFx0Y2IoZmFsc2UpO1xyXG5cdFx0XHRyZXR1cm47XHJcblx0XHR9XHJcblx0XHRnZXRfZGF0ZSh1cmwsZnVuY3Rpb24oZCl7XHJcblx0XHRcdEFQSS5mcy5yb290LmdldEZpbGUoZm4sIHtjcmVhdGU6IGZhbHNlLCBleGNsdXNpdmU6IGZhbHNlfSwgZnVuY3Rpb24oZmlsZUVudHJ5KSB7XHJcblx0XHRcdFx0XHRmaWxlRW50cnkuZ2V0TWV0YWRhdGEoZnVuY3Rpb24obWV0YWRhdGEpe1xyXG5cdFx0XHRcdFx0XHR2YXIgbG9jYWxEYXRlPURhdGUucGFyc2UobWV0YWRhdGEubW9kaWZpY2F0aW9uVGltZSk7XHJcblx0XHRcdFx0XHRcdHZhciB1cmxEYXRlPURhdGUucGFyc2UoZCk7XHJcblx0XHRcdFx0XHRcdGNiKHVybERhdGU+bG9jYWxEYXRlKTtcclxuXHRcdFx0XHRcdH0pO1xyXG5cdFx0fSxmdW5jdGlvbigpe1xyXG5cdFx0XHRjYihmYWxzZSk7XHJcblx0XHR9KTtcclxuXHR9KTtcclxufVxyXG52YXIgZG93bmxvYWQ9ZnVuY3Rpb24odXJsLGZuLGNiLHN0YXR1c2NiLGNvbnRleHQpIHtcclxuXHQgdmFyIHRvdGFsc2l6ZT0wLGJhdGNoZXM9bnVsbCx3cml0dGVuPTA7XHJcblx0IHZhciBmaWxlRW50cnk9MCwgZmlsZVdyaXRlcj0wO1xyXG5cdCB2YXIgY3JlYXRlQmF0Y2hlcz1mdW5jdGlvbihzaXplKSB7XHJcblx0XHRcdHZhciBieXRlcz0xMDI0KjEwMjQsIG91dD1bXTtcclxuXHRcdFx0dmFyIGI9TWF0aC5mbG9vcihzaXplIC8gYnl0ZXMpO1xyXG5cdFx0XHR2YXIgbGFzdD1zaXplICVieXRlcztcclxuXHRcdFx0Zm9yICh2YXIgaT0wO2k8PWI7aSsrKSB7XHJcblx0XHRcdFx0b3V0LnB1c2goaSpieXRlcyk7XHJcblx0XHRcdH1cclxuXHRcdFx0b3V0LnB1c2goYipieXRlcytsYXN0KTtcclxuXHRcdFx0cmV0dXJuIG91dDtcclxuXHQgfVxyXG5cdCB2YXIgZmluaXNoPWZ1bmN0aW9uKCkge1xyXG5cdFx0XHRcdCBybShmbixmdW5jdGlvbigpe1xyXG5cdFx0XHRcdFx0XHRmaWxlRW50cnkubW92ZVRvKGZpbGVFbnRyeS5maWxlc3lzdGVtLnJvb3QsIGZuLGZ1bmN0aW9uKCl7XHJcblx0XHRcdFx0XHRcdFx0c2V0VGltZW91dCggY2IuYmluZChjb250ZXh0LGZhbHNlKSAsIDApIDsgXHJcblx0XHRcdFx0XHRcdH0sZnVuY3Rpb24oZSl7XHJcblx0XHRcdFx0XHRcdFx0Y29uc29sZS5sb2coXCJmYWlsZWRcIixlKVxyXG5cdFx0XHRcdFx0XHR9KTtcclxuXHRcdFx0XHQgfSx0aGlzKTsgXHJcblx0IH1cclxuXHRcdHZhciB0ZW1wZm49XCJ0ZW1wLmtkYlwiO1xyXG5cdFx0dmFyIGJhdGNoPWZ1bmN0aW9uKGIpIHtcclxuXHRcdFx0IHZhciBhYm9ydD1mYWxzZTtcclxuXHRcdFx0IHZhciB4aHIgPSBuZXcgWE1MSHR0cFJlcXVlc3QoKTtcclxuXHRcdFx0IHZhciByZXF1ZXN0dXJsPXVybCtcIj9cIitNYXRoLnJhbmRvbSgpO1xyXG5cdFx0XHQgeGhyLm9wZW4oJ2dldCcsIHJlcXVlc3R1cmwsIHRydWUpO1xyXG5cdFx0XHQgeGhyLnNldFJlcXVlc3RIZWFkZXIoJ1JhbmdlJywgJ2J5dGVzPScrYmF0Y2hlc1tiXSsnLScrKGJhdGNoZXNbYisxXS0xKSk7XHJcblx0XHRcdCB4aHIucmVzcG9uc2VUeXBlID0gJ2Jsb2InOyAgICBcclxuXHRcdFx0IHhoci5hZGRFdmVudExpc3RlbmVyKCdsb2FkJywgZnVuY3Rpb24oKSB7XHJcblx0XHRcdFx0IHZhciBibG9iPXRoaXMucmVzcG9uc2U7XHJcblx0XHRcdFx0IGZpbGVFbnRyeS5jcmVhdGVXcml0ZXIoZnVuY3Rpb24oZmlsZVdyaXRlcikge1xyXG5cdFx0XHRcdCBmaWxlV3JpdGVyLnNlZWsoZmlsZVdyaXRlci5sZW5ndGgpO1xyXG5cdFx0XHRcdCBmaWxlV3JpdGVyLndyaXRlKGJsb2IpO1xyXG5cdFx0XHRcdCB3cml0dGVuKz1ibG9iLnNpemU7XHJcblx0XHRcdFx0IGZpbGVXcml0ZXIub253cml0ZWVuZCA9IGZ1bmN0aW9uKGUpIHtcclxuXHRcdFx0XHRcdCBpZiAoc3RhdHVzY2IpIHtcclxuXHRcdFx0XHRcdFx0XHRhYm9ydD1zdGF0dXNjYi5hcHBseShjb250ZXh0LFsgZmlsZVdyaXRlci5sZW5ndGggLyB0b3RhbHNpemUsdG90YWxzaXplIF0pO1xyXG5cdFx0XHRcdFx0XHRcdGlmIChhYm9ydCkgc2V0VGltZW91dCggY2IuYmluZChjb250ZXh0LGZhbHNlKSAsIDApIDtcclxuXHRcdFx0XHRcdCB9XHJcblx0XHRcdFx0XHQgYisrO1xyXG5cdFx0XHRcdFx0IGlmICghYWJvcnQpIHtcclxuXHRcdFx0XHRcdFx0XHRpZiAoYjxiYXRjaGVzLmxlbmd0aC0xKSBzZXRUaW1lb3V0KGJhdGNoLmJpbmQoY29udGV4dCxiKSwwKTtcclxuXHRcdFx0XHRcdFx0XHRlbHNlICAgICAgICAgICAgICAgICAgICBmaW5pc2goKTtcclxuXHRcdFx0XHRcdCB9XHJcblx0XHRcdFx0IH07XHJcblx0XHRcdFx0fSwgY29uc29sZS5lcnJvcik7XHJcblx0XHRcdCB9LGZhbHNlKTtcclxuXHRcdFx0IHhoci5zZW5kKCk7XHJcblx0XHR9XHJcblxyXG5cdFx0IGdldERvd25sb2FkU2l6ZSh1cmwsZnVuY3Rpb24oc2l6ZSl7XHJcblx0XHRcdCB0b3RhbHNpemU9c2l6ZTtcclxuXHRcdFx0IGlmICghc2l6ZSkge1xyXG5cdFx0XHRcdFx0aWYgKGNiKSBjYi5hcHBseShjb250ZXh0LFtmYWxzZV0pO1xyXG5cdFx0XHQgfSBlbHNlIHsvL3JlYWR5IHRvIGRvd25sb2FkXHJcblx0XHRcdFx0cm0odGVtcGZuLGZ1bmN0aW9uKCl7XHJcblx0XHRcdFx0XHQgYmF0Y2hlcz1jcmVhdGVCYXRjaGVzKHNpemUpO1xyXG5cdFx0XHRcdFx0IGlmIChzdGF0dXNjYikgc3RhdHVzY2IuYXBwbHkoY29udGV4dCxbIDAsIHRvdGFsc2l6ZSBdKTtcclxuXHRcdFx0XHRcdCBBUEkuZnMucm9vdC5nZXRGaWxlKHRlbXBmbiwge2NyZWF0ZTogMSwgZXhjbHVzaXZlOiBmYWxzZX0sIGZ1bmN0aW9uKF9maWxlRW50cnkpIHtcclxuXHRcdFx0XHRcdFx0XHRcdGZpbGVFbnRyeT1fZmlsZUVudHJ5O1xyXG5cdFx0XHRcdFx0XHRcdGJhdGNoKDApO1xyXG5cdFx0XHRcdFx0IH0pO1xyXG5cdFx0XHRcdH0sdGhpcyk7XHJcblx0XHRcdH1cclxuXHRcdH0pO1xyXG59XHJcblxyXG52YXIgcmVhZEZpbGU9ZnVuY3Rpb24oZmlsZW5hbWUsY2IsY29udGV4dCkge1xyXG5cdEFQSS5mcy5yb290LmdldEZpbGUoZmlsZW5hbWUsIGZ1bmN0aW9uKGZpbGVFbnRyeSkge1xyXG5cdFx0XHR2YXIgcmVhZGVyID0gbmV3IEZpbGVSZWFkZXIoKTtcclxuXHRcdFx0cmVhZGVyLm9ubG9hZGVuZCA9IGZ1bmN0aW9uKGUpIHtcclxuXHRcdFx0XHRcdGlmIChjYikgY2IuYXBwbHkoY2IsW3RoaXMucmVzdWx0XSk7XHJcblx0XHRcdFx0fTsgICAgICAgICAgICBcclxuXHRcdH0sIGNvbnNvbGUuZXJyb3IpO1xyXG59XHJcbnZhciB3cml0ZUZpbGU9ZnVuY3Rpb24oZmlsZW5hbWUsYnVmLGNiLGNvbnRleHQpe1xyXG5cdCBBUEkuZnMucm9vdC5nZXRGaWxlKGZpbGVuYW1lLCB7Y3JlYXRlOiB0cnVlLCBleGNsdXNpdmU6IHRydWV9LCBmdW5jdGlvbihmaWxlRW50cnkpIHtcclxuXHRcdFx0ZmlsZUVudHJ5LmNyZWF0ZVdyaXRlcihmdW5jdGlvbihmaWxlV3JpdGVyKSB7XHJcblx0XHRcdFx0ZmlsZVdyaXRlci53cml0ZShidWYpO1xyXG5cdFx0XHRcdGZpbGVXcml0ZXIub253cml0ZWVuZCA9IGZ1bmN0aW9uKGUpIHtcclxuXHRcdFx0XHRcdGlmIChjYikgY2IuYXBwbHkoY2IsW2J1Zi5ieXRlTGVuZ3RoXSk7XHJcblx0XHRcdFx0fTsgICAgICAgICAgICBcclxuXHRcdFx0fSwgY29uc29sZS5lcnJvcik7XHJcblx0XHR9LCBjb25zb2xlLmVycm9yKTtcclxufVxyXG5cclxudmFyIHJlYWRkaXI9ZnVuY3Rpb24oY2IsY29udGV4dCkge1xyXG5cdCB2YXIgZGlyUmVhZGVyID0gQVBJLmZzLnJvb3QuY3JlYXRlUmVhZGVyKCk7XHJcblx0IHZhciBvdXQ9W10sdGhhdD10aGlzO1xyXG5cdFx0ZGlyUmVhZGVyLnJlYWRFbnRyaWVzKGZ1bmN0aW9uKGVudHJpZXMpIHtcclxuXHRcdFx0aWYgKGVudHJpZXMubGVuZ3RoKSB7XHJcblx0XHRcdFx0XHRmb3IgKHZhciBpID0gMCwgZW50cnk7IGVudHJ5ID0gZW50cmllc1tpXTsgKytpKSB7XHJcblx0XHRcdFx0XHRcdGlmIChlbnRyeS5pc0ZpbGUpIHtcclxuXHRcdFx0XHRcdFx0XHRvdXQucHVzaChbZW50cnkubmFtZSxlbnRyeS50b1VSTCA/IGVudHJ5LnRvVVJMKCkgOiBlbnRyeS50b1VSSSgpXSk7XHJcblx0XHRcdFx0XHRcdH1cclxuXHRcdFx0XHRcdH1cclxuXHRcdFx0fVxyXG5cdFx0XHRBUEkuZmlsZXM9b3V0O1xyXG5cdFx0XHRpZiAoY2IpIGNiLmFwcGx5KGNvbnRleHQsW291dF0pO1xyXG5cdFx0fSwgZnVuY3Rpb24oKXtcclxuXHRcdFx0aWYgKGNiKSBjYi5hcHBseShjb250ZXh0LFtudWxsXSk7XHJcblx0XHR9KTtcclxufVxyXG52YXIgZ2V0RmlsZVVSTD1mdW5jdGlvbihmaWxlbmFtZSkge1xyXG5cdGlmICghQVBJLmZpbGVzICkgcmV0dXJuIG51bGw7XHJcblx0dmFyIGZpbGU9IEFQSS5maWxlcy5maWx0ZXIoZnVuY3Rpb24oZil7cmV0dXJuIGZbMF09PWZpbGVuYW1lfSk7XHJcblx0aWYgKGZpbGUubGVuZ3RoKSByZXR1cm4gZmlsZVswXVsxXTtcclxufVxyXG52YXIgcm09ZnVuY3Rpb24oZmlsZW5hbWUsY2IsY29udGV4dCkge1xyXG5cdCB2YXIgdXJsPWdldEZpbGVVUkwoZmlsZW5hbWUpO1xyXG5cdCBpZiAodXJsKSBybVVSTCh1cmwsY2IsY29udGV4dCk7XHJcblx0IGVsc2UgaWYgKGNiKSBjYi5hcHBseShjb250ZXh0LFtmYWxzZV0pO1xyXG59XHJcblxyXG52YXIgcm1VUkw9ZnVuY3Rpb24oZmlsZW5hbWUsY2IsY29udGV4dCkge1xyXG5cdFx0d2Via2l0UmVzb2x2ZUxvY2FsRmlsZVN5c3RlbVVSTChmaWxlbmFtZSwgZnVuY3Rpb24oZmlsZUVudHJ5KSB7XHJcblx0XHRcdGZpbGVFbnRyeS5yZW1vdmUoZnVuY3Rpb24oKSB7XHJcblx0XHRcdFx0aWYgKGNiKSBjYi5hcHBseShjb250ZXh0LFt0cnVlXSk7XHJcblx0XHRcdH0sIGNvbnNvbGUuZXJyb3IpO1xyXG5cdFx0fSwgIGZ1bmN0aW9uKGUpe1xyXG5cdFx0XHRpZiAoY2IpIGNiLmFwcGx5KGNvbnRleHQsW2ZhbHNlXSk7Ly9ubyBzdWNoIGZpbGVcclxuXHRcdH0pO1xyXG59XHJcbmZ1bmN0aW9uIGVycm9ySGFuZGxlcihlKSB7XHJcblx0Y29uc29sZS5lcnJvcignRXJyb3I6ICcgK2UubmFtZSsgXCIgXCIrZS5tZXNzYWdlKTtcclxufVxyXG52YXIgaW5pdGZzPWZ1bmN0aW9uKGdyYW50ZWRCeXRlcyxjYixjb250ZXh0KSB7XHJcblx0d2Via2l0UmVxdWVzdEZpbGVTeXN0ZW0oUEVSU0lTVEVOVCwgZ3JhbnRlZEJ5dGVzLCAgZnVuY3Rpb24oZnMpIHtcclxuXHRcdEFQSS5mcz1mcztcclxuXHRcdEFQSS5xdW90YT1ncmFudGVkQnl0ZXM7XHJcblx0XHRyZWFkZGlyKGZ1bmN0aW9uKCl7XHJcblx0XHRcdEFQSS5pbml0aWFsaXplZD10cnVlO1xyXG5cdFx0XHRjYi5hcHBseShjb250ZXh0LFtncmFudGVkQnl0ZXMsZnNdKTtcclxuXHRcdH0sY29udGV4dCk7XHJcblx0fSwgZXJyb3JIYW5kbGVyKTtcclxufVxyXG52YXIgaW5pdD1mdW5jdGlvbihxdW90YSxjYixjb250ZXh0KSB7XHJcblx0bmF2aWdhdG9yLndlYmtpdFBlcnNpc3RlbnRTdG9yYWdlLnJlcXVlc3RRdW90YShxdW90YSwgXHJcblx0XHRcdGZ1bmN0aW9uKGdyYW50ZWRCeXRlcykge1xyXG5cdFx0XHRcdGluaXRmcyhncmFudGVkQnl0ZXMsY2IsY29udGV4dCk7XHJcblx0XHR9LCBjb25zb2xlLmVycm9yIFxyXG5cdCk7XHJcbn1cclxudmFyIHF1ZXJ5UXVvdGE9ZnVuY3Rpb24oY2IsY29udGV4dCkge1xyXG5cdFx0dmFyIHRoYXQ9dGhpcztcclxuXHRcdG5hdmlnYXRvci53ZWJraXRQZXJzaXN0ZW50U3RvcmFnZS5xdWVyeVVzYWdlQW5kUXVvdGEoIFxyXG5cdFx0IGZ1bmN0aW9uKHVzYWdlLHF1b3RhKXtcclxuXHRcdFx0XHRpbml0ZnMocXVvdGEsZnVuY3Rpb24oKXtcclxuXHRcdFx0XHRcdGNiLmFwcGx5KGNvbnRleHQsW3VzYWdlLHF1b3RhXSk7XHJcblx0XHRcdFx0fSxjb250ZXh0KTtcclxuXHRcdH0pO1xyXG59XHJcbnZhciBBUEk9e1xyXG5cdGxvYWQ6bG9hZFxyXG5cdCxvcGVuOm9wZW5cclxuXHQscmVhZDpyZWFkXHJcblx0LGZzdGF0U3luYzpmc3RhdFN5bmNcclxuXHQsZnN0YXQ6ZnN0YXQsY2xvc2U6Y2xvc2VcclxuXHQsaW5pdDppbml0XHJcblx0LHJlYWRkaXI6cmVhZGRpclxyXG5cdCxjaGVja1VwZGF0ZTpjaGVja1VwZGF0ZVxyXG5cdCxybTpybVxyXG5cdCxybVVSTDpybVVSTFxyXG5cdCxnZXRGaWxlVVJMOmdldEZpbGVVUkxcclxuXHQsZ2V0RG93bmxvYWRTaXplOmdldERvd25sb2FkU2l6ZVxyXG5cdCx3cml0ZUZpbGU6d3JpdGVGaWxlXHJcblx0LHJlYWRGaWxlOnJlYWRGaWxlXHJcblx0LGRvd25sb2FkOmRvd25sb2FkXHJcblx0LHF1ZXJ5UXVvdGE6cXVlcnlRdW90YVxyXG59XHJcblx0bW9kdWxlLmV4cG9ydHM9QVBJOyIsIm1vZHVsZS5leHBvcnRzPXtcclxuXHRvcGVuOnJlcXVpcmUoXCIuL2tkYlwiKVxyXG5cdCxjcmVhdGU6cmVxdWlyZShcIi4va2Rid1wiKVxyXG5cdCxodG1sNWZzOnJlcXVpcmUoXCIuL2h0bWw1ZnNcIilcclxufVxyXG4iLCIvKlxyXG5cdEtEQiB2ZXJzaW9uIDMuMCBHUExcclxuXHR5YXBjaGVhaHNoZW5AZ21haWwuY29tXHJcblx0MjAxMy8xMi8yOFxyXG5cdGFzeW5jcm9uaXplIHZlcnNpb24gb2YgeWFkYlxyXG5cclxuICByZW1vdmUgZGVwZW5kZW5jeSBvZiBRLCB0aGFua3MgdG9cclxuICBodHRwOi8vc3RhY2tvdmVyZmxvdy5jb20vcXVlc3Rpb25zLzQyMzQ2MTkvaG93LXRvLWF2b2lkLWxvbmctbmVzdGluZy1vZi1hc3luY2hyb25vdXMtZnVuY3Rpb25zLWluLW5vZGUtanNcclxuXHJcbiAgMjAxNS8xLzJcclxuICBtb3ZlZCB0byBrc2FuYWZvcmdlL2tzYW5hLWpzb25yb21cclxuICBhZGQgZXJyIGluIGNhbGxiYWNrIGZvciBub2RlLmpzIGNvbXBsaWFudFxyXG4qL1xyXG52YXIgS2ZzPW51bGw7XHJcblxyXG5pZiAodHlwZW9mIGtzYW5hZ2FwPT1cInVuZGVmaW5lZFwiKSB7XHJcblx0S2ZzPXJlcXVpcmUoJy4va2RiZnMnKTtcdFx0XHRcclxufSBlbHNlIHtcclxuXHRpZiAoa3NhbmFnYXAucGxhdGZvcm09PVwiaW9zXCIpIHtcclxuXHRcdEtmcz1yZXF1aXJlKFwiLi9rZGJmc19pb3NcIik7XHJcblx0fSBlbHNlIGlmIChrc2FuYWdhcC5wbGF0Zm9ybT09XCJub2RlLXdlYmtpdFwiKSB7XHJcblx0XHRLZnM9cmVxdWlyZShcIi4va2RiZnNcIik7XHJcblx0fSBlbHNlIGlmIChrc2FuYWdhcC5wbGF0Zm9ybT09XCJjaHJvbWVcIikge1xyXG5cdFx0S2ZzPXJlcXVpcmUoXCIuL2tkYmZzXCIpO1xyXG5cdH0gZWxzZSB7XHJcblx0XHRLZnM9cmVxdWlyZShcIi4va2RiZnNfYW5kcm9pZFwiKTtcclxuXHR9XHJcblx0XHRcclxufVxyXG5cclxuXHJcbnZhciBEVD17XHJcblx0dWludDg6JzEnLCAvL3Vuc2lnbmVkIDEgYnl0ZSBpbnRlZ2VyXHJcblx0aW50MzI6JzQnLCAvLyBzaWduZWQgNCBieXRlcyBpbnRlZ2VyXHJcblx0dXRmODonOCcsICBcclxuXHR1Y3MyOicyJyxcclxuXHRib29sOideJywgXHJcblx0YmxvYjonJicsXHJcblx0dXRmOGFycjonKicsIC8vc2hpZnQgb2YgOFxyXG5cdHVjczJhcnI6J0AnLCAvL3NoaWZ0IG9mIDJcclxuXHR1aW50OGFycjonIScsIC8vc2hpZnQgb2YgMVxyXG5cdGludDMyYXJyOickJywgLy9zaGlmdCBvZiA0XHJcblx0dmludDonYCcsXHJcblx0cGludDonficsXHRcclxuXHJcblx0YXJyYXk6J1xcdTAwMWInLFxyXG5cdG9iamVjdDonXFx1MDAxYScgXHJcblx0Ly95ZGIgc3RhcnQgd2l0aCBvYmplY3Qgc2lnbmF0dXJlLFxyXG5cdC8vdHlwZSBhIHlkYiBpbiBjb21tYW5kIHByb21wdCBzaG93cyBub3RoaW5nXHJcbn1cclxudmFyIHZlcmJvc2U9MCwgcmVhZExvZz1mdW5jdGlvbigpe307XHJcbnZhciBfcmVhZExvZz1mdW5jdGlvbihyZWFkdHlwZSxieXRlcykge1xyXG5cdGNvbnNvbGUubG9nKHJlYWR0eXBlLGJ5dGVzLFwiYnl0ZXNcIik7XHJcbn1cclxuaWYgKHZlcmJvc2UpIHJlYWRMb2c9X3JlYWRMb2c7XHJcbnZhciBzdHJzZXA9XCJcXHVmZmZmXCI7XHJcbnZhciBDcmVhdGU9ZnVuY3Rpb24ocGF0aCxvcHRzLGNiKSB7XHJcblx0LyogbG9hZHh4eCBmdW5jdGlvbnMgbW92ZSBmaWxlIHBvaW50ZXIgKi9cclxuXHQvLyBsb2FkIHZhcmlhYmxlIGxlbmd0aCBpbnRcclxuXHRpZiAodHlwZW9mIG9wdHM9PVwiZnVuY3Rpb25cIikge1xyXG5cdFx0Y2I9b3B0cztcclxuXHRcdG9wdHM9e307XHJcblx0fVxyXG5cclxuXHRcclxuXHR2YXIgbG9hZFZJbnQgPWZ1bmN0aW9uKG9wdHMsYmxvY2tzaXplLGNvdW50LGNiKSB7XHJcblx0XHQvL2lmIChjb3VudD09MCkgcmV0dXJuIFtdO1xyXG5cdFx0dmFyIHRoYXQ9dGhpcztcclxuXHJcblx0XHR0aGlzLmZzLnJlYWRCdWZfcGFja2VkaW50KG9wdHMuY3VyLGJsb2Nrc2l6ZSxjb3VudCx0cnVlLGZ1bmN0aW9uKG8pe1xyXG5cdFx0XHQvL2NvbnNvbGUubG9nKFwidmludFwiKTtcclxuXHRcdFx0b3B0cy5jdXIrPW8uYWR2O1xyXG5cdFx0XHRjYi5hcHBseSh0aGF0LFtvLmRhdGFdKTtcclxuXHRcdH0pO1xyXG5cdH1cclxuXHR2YXIgbG9hZFZJbnQxPWZ1bmN0aW9uKG9wdHMsY2IpIHtcclxuXHRcdHZhciB0aGF0PXRoaXM7XHJcblx0XHRsb2FkVkludC5hcHBseSh0aGlzLFtvcHRzLDYsMSxmdW5jdGlvbihkYXRhKXtcclxuXHRcdFx0Ly9jb25zb2xlLmxvZyhcInZpbnQxXCIpO1xyXG5cdFx0XHRjYi5hcHBseSh0aGF0LFtkYXRhWzBdXSk7XHJcblx0XHR9XSlcclxuXHR9XHJcblx0Ly9mb3IgcG9zdGluZ3NcclxuXHR2YXIgbG9hZFBJbnQgPWZ1bmN0aW9uKG9wdHMsYmxvY2tzaXplLGNvdW50LGNiKSB7XHJcblx0XHR2YXIgdGhhdD10aGlzO1xyXG5cdFx0dGhpcy5mcy5yZWFkQnVmX3BhY2tlZGludChvcHRzLmN1cixibG9ja3NpemUsY291bnQsZmFsc2UsZnVuY3Rpb24obyl7XHJcblx0XHRcdC8vY29uc29sZS5sb2coXCJwaW50XCIpO1xyXG5cdFx0XHRvcHRzLmN1cis9by5hZHY7XHJcblx0XHRcdGNiLmFwcGx5KHRoYXQsW28uZGF0YV0pO1xyXG5cdFx0fSk7XHJcblx0fVxyXG5cdC8vIGl0ZW0gY2FuIGJlIGFueSB0eXBlICh2YXJpYWJsZSBsZW5ndGgpXHJcblx0Ly8gbWF4aW11bSBzaXplIG9mIGFycmF5IGlzIDFUQiAyXjQwXHJcblx0Ly8gc3RydWN0dXJlOlxyXG5cdC8vIHNpZ25hdHVyZSw1IGJ5dGVzIG9mZnNldCwgcGF5bG9hZCwgaXRlbWxlbmd0aHNcclxuXHR2YXIgZ2V0QXJyYXlMZW5ndGg9ZnVuY3Rpb24ob3B0cyxjYikge1xyXG5cdFx0dmFyIHRoYXQ9dGhpcztcclxuXHRcdHZhciBkYXRhb2Zmc2V0PTA7XHJcblxyXG5cdFx0dGhpcy5mcy5yZWFkVUk4KG9wdHMuY3VyLGZ1bmN0aW9uKGxlbil7XHJcblx0XHRcdHZhciBsZW5ndGhvZmZzZXQ9bGVuKjQyOTQ5NjcyOTY7XHJcblx0XHRcdG9wdHMuY3VyKys7XHJcblx0XHRcdHRoYXQuZnMucmVhZFVJMzIob3B0cy5jdXIsZnVuY3Rpb24obGVuKXtcclxuXHRcdFx0XHRvcHRzLmN1cis9NDtcclxuXHRcdFx0XHRkYXRhb2Zmc2V0PW9wdHMuY3VyOyAvL2tlZXAgdGhpc1xyXG5cdFx0XHRcdGxlbmd0aG9mZnNldCs9bGVuO1xyXG5cdFx0XHRcdG9wdHMuY3VyKz1sZW5ndGhvZmZzZXQ7XHJcblxyXG5cdFx0XHRcdGxvYWRWSW50MS5hcHBseSh0aGF0LFtvcHRzLGZ1bmN0aW9uKGNvdW50KXtcclxuXHRcdFx0XHRcdGxvYWRWSW50LmFwcGx5KHRoYXQsW29wdHMsY291bnQqNixjb3VudCxmdW5jdGlvbihzeil7XHRcdFx0XHRcdFx0XHJcblx0XHRcdFx0XHRcdGNiKHtjb3VudDpjb3VudCxzejpzeixvZmZzZXQ6ZGF0YW9mZnNldH0pO1xyXG5cdFx0XHRcdFx0fV0pO1xyXG5cdFx0XHRcdH1dKTtcclxuXHRcdFx0XHRcclxuXHRcdFx0fSk7XHJcblx0XHR9KTtcclxuXHR9XHJcblxyXG5cdHZhciBsb2FkQXJyYXkgPSBmdW5jdGlvbihvcHRzLGJsb2Nrc2l6ZSxjYikge1xyXG5cdFx0dmFyIHRoYXQ9dGhpcztcclxuXHRcdGdldEFycmF5TGVuZ3RoLmFwcGx5KHRoaXMsW29wdHMsZnVuY3Rpb24oTCl7XHJcblx0XHRcdFx0dmFyIG89W107XHJcblx0XHRcdFx0dmFyIGVuZGN1cj1vcHRzLmN1cjtcclxuXHRcdFx0XHRvcHRzLmN1cj1MLm9mZnNldDtcclxuXHJcblx0XHRcdFx0aWYgKG9wdHMubGF6eSkgeyBcclxuXHRcdFx0XHRcdFx0dmFyIG9mZnNldD1MLm9mZnNldDtcclxuXHRcdFx0XHRcdFx0TC5zei5tYXAoZnVuY3Rpb24oc3ope1xyXG5cdFx0XHRcdFx0XHRcdG9bby5sZW5ndGhdPXN0cnNlcCtvZmZzZXQudG9TdHJpbmcoMTYpXHJcblx0XHRcdFx0XHRcdFx0XHQgICArc3Ryc2VwK3N6LnRvU3RyaW5nKDE2KTtcclxuXHRcdFx0XHRcdFx0XHRvZmZzZXQrPXN6O1xyXG5cdFx0XHRcdFx0XHR9KVxyXG5cdFx0XHRcdH0gZWxzZSB7XHJcblx0XHRcdFx0XHR2YXIgdGFza3F1ZXVlPVtdO1xyXG5cdFx0XHRcdFx0Zm9yICh2YXIgaT0wO2k8TC5jb3VudDtpKyspIHtcclxuXHRcdFx0XHRcdFx0dGFza3F1ZXVlLnB1c2goXHJcblx0XHRcdFx0XHRcdFx0KGZ1bmN0aW9uKHN6KXtcclxuXHRcdFx0XHRcdFx0XHRcdHJldHVybiAoXHJcblx0XHRcdFx0XHRcdFx0XHRcdGZ1bmN0aW9uKGRhdGEpe1xyXG5cdFx0XHRcdFx0XHRcdFx0XHRcdGlmICh0eXBlb2YgZGF0YT09J29iamVjdCcgJiYgZGF0YS5fX2VtcHR5KSB7XHJcblx0XHRcdFx0XHRcdFx0XHRcdFx0XHQgLy9ub3QgcHVzaGluZyB0aGUgZmlyc3QgY2FsbFxyXG5cdFx0XHRcdFx0XHRcdFx0XHRcdH1cdGVsc2Ugby5wdXNoKGRhdGEpO1xyXG5cdFx0XHRcdFx0XHRcdFx0XHRcdG9wdHMuYmxvY2tzaXplPXN6O1xyXG5cdFx0XHRcdFx0XHRcdFx0XHRcdGxvYWQuYXBwbHkodGhhdCxbb3B0cywgdGFza3F1ZXVlLnNoaWZ0KCldKTtcclxuXHRcdFx0XHRcdFx0XHRcdFx0fVxyXG5cdFx0XHRcdFx0XHRcdFx0KTtcclxuXHRcdFx0XHRcdFx0XHR9KShMLnN6W2ldKVxyXG5cdFx0XHRcdFx0XHQpO1xyXG5cdFx0XHRcdFx0fVxyXG5cdFx0XHRcdFx0Ly9sYXN0IGNhbGwgdG8gY2hpbGQgbG9hZFxyXG5cdFx0XHRcdFx0dGFza3F1ZXVlLnB1c2goZnVuY3Rpb24oZGF0YSl7XHJcblx0XHRcdFx0XHRcdG8ucHVzaChkYXRhKTtcclxuXHRcdFx0XHRcdFx0b3B0cy5jdXI9ZW5kY3VyO1xyXG5cdFx0XHRcdFx0XHRjYi5hcHBseSh0aGF0LFtvXSk7XHJcblx0XHRcdFx0XHR9KTtcclxuXHRcdFx0XHR9XHJcblxyXG5cdFx0XHRcdGlmIChvcHRzLmxhenkpIGNiLmFwcGx5KHRoYXQsW29dKTtcclxuXHRcdFx0XHRlbHNlIHtcclxuXHRcdFx0XHRcdHRhc2txdWV1ZS5zaGlmdCgpKHtfX2VtcHR5OnRydWV9KTtcclxuXHRcdFx0XHR9XHJcblx0XHRcdH1cclxuXHRcdF0pXHJcblx0fVx0XHRcclxuXHQvLyBpdGVtIGNhbiBiZSBhbnkgdHlwZSAodmFyaWFibGUgbGVuZ3RoKVxyXG5cdC8vIHN1cHBvcnQgbGF6eSBsb2FkXHJcblx0Ly8gc3RydWN0dXJlOlxyXG5cdC8vIHNpZ25hdHVyZSw1IGJ5dGVzIG9mZnNldCwgcGF5bG9hZCwgaXRlbWxlbmd0aHMsIFxyXG5cdC8vICAgICAgICAgICAgICAgICAgICBzdHJpbmdhcnJheV9zaWduYXR1cmUsIGtleXNcclxuXHR2YXIgbG9hZE9iamVjdCA9IGZ1bmN0aW9uKG9wdHMsYmxvY2tzaXplLGNiKSB7XHJcblx0XHR2YXIgdGhhdD10aGlzO1xyXG5cdFx0dmFyIHN0YXJ0PW9wdHMuY3VyO1xyXG5cdFx0Z2V0QXJyYXlMZW5ndGguYXBwbHkodGhpcyxbb3B0cyxmdW5jdGlvbihMKSB7XHJcblx0XHRcdG9wdHMuYmxvY2tzaXplPWJsb2Nrc2l6ZS1vcHRzLmN1citzdGFydDtcclxuXHRcdFx0bG9hZC5hcHBseSh0aGF0LFtvcHRzLGZ1bmN0aW9uKGtleXMpeyAvL2xvYWQgdGhlIGtleXNcclxuXHRcdFx0XHRpZiAob3B0cy5rZXlzKSB7IC8vY2FsbGVyIGFzayBmb3Iga2V5c1xyXG5cdFx0XHRcdFx0a2V5cy5tYXAoZnVuY3Rpb24oaykgeyBvcHRzLmtleXMucHVzaChrKX0pO1xyXG5cdFx0XHRcdH1cclxuXHJcblx0XHRcdFx0dmFyIG89e307XHJcblx0XHRcdFx0dmFyIGVuZGN1cj1vcHRzLmN1cjtcclxuXHRcdFx0XHRvcHRzLmN1cj1MLm9mZnNldDtcclxuXHRcdFx0XHRpZiAob3B0cy5sYXp5KSB7IFxyXG5cdFx0XHRcdFx0dmFyIG9mZnNldD1MLm9mZnNldDtcclxuXHRcdFx0XHRcdGZvciAodmFyIGk9MDtpPEwuc3oubGVuZ3RoO2krKykge1xyXG5cdFx0XHRcdFx0XHQvL3ByZWZpeCB3aXRoIGEgXFwwLCBpbXBvc3NpYmxlIGZvciBub3JtYWwgc3RyaW5nXHJcblx0XHRcdFx0XHRcdG9ba2V5c1tpXV09c3Ryc2VwK29mZnNldC50b1N0cmluZygxNilcclxuXHRcdFx0XHRcdFx0XHQgICArc3Ryc2VwK0wuc3pbaV0udG9TdHJpbmcoMTYpO1xyXG5cdFx0XHRcdFx0XHRvZmZzZXQrPUwuc3pbaV07XHJcblx0XHRcdFx0XHR9XHJcblx0XHRcdFx0fSBlbHNlIHtcclxuXHRcdFx0XHRcdHZhciB0YXNrcXVldWU9W107XHJcblx0XHRcdFx0XHRmb3IgKHZhciBpPTA7aTxMLmNvdW50O2krKykge1xyXG5cdFx0XHRcdFx0XHR0YXNrcXVldWUucHVzaChcclxuXHRcdFx0XHRcdFx0XHQoZnVuY3Rpb24oc3osa2V5KXtcclxuXHRcdFx0XHRcdFx0XHRcdHJldHVybiAoXHJcblx0XHRcdFx0XHRcdFx0XHRcdGZ1bmN0aW9uKGRhdGEpe1xyXG5cdFx0XHRcdFx0XHRcdFx0XHRcdGlmICh0eXBlb2YgZGF0YT09J29iamVjdCcgJiYgZGF0YS5fX2VtcHR5KSB7XHJcblx0XHRcdFx0XHRcdFx0XHRcdFx0XHQvL25vdCBzYXZpbmcgdGhlIGZpcnN0IGNhbGw7XHJcblx0XHRcdFx0XHRcdFx0XHRcdFx0fSBlbHNlIHtcclxuXHRcdFx0XHRcdFx0XHRcdFx0XHRcdG9ba2V5XT1kYXRhOyBcclxuXHRcdFx0XHRcdFx0XHRcdFx0XHR9XHJcblx0XHRcdFx0XHRcdFx0XHRcdFx0b3B0cy5ibG9ja3NpemU9c3o7XHJcblx0XHRcdFx0XHRcdFx0XHRcdFx0aWYgKHZlcmJvc2UpIHJlYWRMb2coXCJrZXlcIixrZXkpO1xyXG5cdFx0XHRcdFx0XHRcdFx0XHRcdGxvYWQuYXBwbHkodGhhdCxbb3B0cywgdGFza3F1ZXVlLnNoaWZ0KCldKTtcclxuXHRcdFx0XHRcdFx0XHRcdFx0fVxyXG5cdFx0XHRcdFx0XHRcdFx0KTtcclxuXHRcdFx0XHRcdFx0XHR9KShMLnN6W2ldLGtleXNbaS0xXSlcclxuXHJcblx0XHRcdFx0XHRcdCk7XHJcblx0XHRcdFx0XHR9XHJcblx0XHRcdFx0XHQvL2xhc3QgY2FsbCB0byBjaGlsZCBsb2FkXHJcblx0XHRcdFx0XHR0YXNrcXVldWUucHVzaChmdW5jdGlvbihkYXRhKXtcclxuXHRcdFx0XHRcdFx0b1trZXlzW2tleXMubGVuZ3RoLTFdXT1kYXRhO1xyXG5cdFx0XHRcdFx0XHRvcHRzLmN1cj1lbmRjdXI7XHJcblx0XHRcdFx0XHRcdGNiLmFwcGx5KHRoYXQsW29dKTtcclxuXHRcdFx0XHRcdH0pO1xyXG5cdFx0XHRcdH1cclxuXHRcdFx0XHRpZiAob3B0cy5sYXp5KSBjYi5hcHBseSh0aGF0LFtvXSk7XHJcblx0XHRcdFx0ZWxzZSB7XHJcblx0XHRcdFx0XHR0YXNrcXVldWUuc2hpZnQoKSh7X19lbXB0eTp0cnVlfSk7XHJcblx0XHRcdFx0fVxyXG5cdFx0XHR9XSk7XHJcblx0XHR9XSk7XHJcblx0fVxyXG5cclxuXHQvL2l0ZW0gaXMgc2FtZSBrbm93biB0eXBlXHJcblx0dmFyIGxvYWRTdHJpbmdBcnJheT1mdW5jdGlvbihvcHRzLGJsb2Nrc2l6ZSxlbmNvZGluZyxjYikge1xyXG5cdFx0dmFyIHRoYXQ9dGhpcztcclxuXHRcdHRoaXMuZnMucmVhZFN0cmluZ0FycmF5KG9wdHMuY3VyLGJsb2Nrc2l6ZSxlbmNvZGluZyxmdW5jdGlvbihvKXtcclxuXHRcdFx0b3B0cy5jdXIrPWJsb2Nrc2l6ZTtcclxuXHRcdFx0Y2IuYXBwbHkodGhhdCxbb10pO1xyXG5cdFx0fSk7XHJcblx0fVxyXG5cdHZhciBsb2FkSW50ZWdlckFycmF5PWZ1bmN0aW9uKG9wdHMsYmxvY2tzaXplLHVuaXRzaXplLGNiKSB7XHJcblx0XHR2YXIgdGhhdD10aGlzO1xyXG5cdFx0bG9hZFZJbnQxLmFwcGx5KHRoaXMsW29wdHMsZnVuY3Rpb24oY291bnQpe1xyXG5cdFx0XHR2YXIgbz10aGF0LmZzLnJlYWRGaXhlZEFycmF5KG9wdHMuY3VyLGNvdW50LHVuaXRzaXplLGZ1bmN0aW9uKG8pe1xyXG5cdFx0XHRcdG9wdHMuY3VyKz1jb3VudCp1bml0c2l6ZTtcclxuXHRcdFx0XHRjYi5hcHBseSh0aGF0LFtvXSk7XHJcblx0XHRcdH0pO1xyXG5cdFx0fV0pO1xyXG5cdH1cclxuXHR2YXIgbG9hZEJsb2I9ZnVuY3Rpb24oYmxvY2tzaXplLGNiKSB7XHJcblx0XHR2YXIgbz10aGlzLmZzLnJlYWRCdWYodGhpcy5jdXIsYmxvY2tzaXplKTtcclxuXHRcdHRoaXMuY3VyKz1ibG9ja3NpemU7XHJcblx0XHRyZXR1cm4gbztcclxuXHR9XHRcclxuXHR2YXIgbG9hZGJ5c2lnbmF0dXJlPWZ1bmN0aW9uKG9wdHMsc2lnbmF0dXJlLGNiKSB7XHJcblx0XHQgIHZhciBibG9ja3NpemU9b3B0cy5ibG9ja3NpemV8fHRoaXMuZnMuc2l6ZTsgXHJcblx0XHRcdG9wdHMuY3VyKz10aGlzLmZzLnNpZ25hdHVyZV9zaXplO1xyXG5cdFx0XHR2YXIgZGF0YXNpemU9YmxvY2tzaXplLXRoaXMuZnMuc2lnbmF0dXJlX3NpemU7XHJcblx0XHRcdC8vYmFzaWMgdHlwZXNcclxuXHRcdFx0aWYgKHNpZ25hdHVyZT09PURULmludDMyKSB7XHJcblx0XHRcdFx0b3B0cy5jdXIrPTQ7XHJcblx0XHRcdFx0dGhpcy5mcy5yZWFkSTMyKG9wdHMuY3VyLTQsY2IpO1xyXG5cdFx0XHR9IGVsc2UgaWYgKHNpZ25hdHVyZT09PURULnVpbnQ4KSB7XHJcblx0XHRcdFx0b3B0cy5jdXIrKztcclxuXHRcdFx0XHR0aGlzLmZzLnJlYWRVSTgob3B0cy5jdXItMSxjYik7XHJcblx0XHRcdH0gZWxzZSBpZiAoc2lnbmF0dXJlPT09RFQudXRmOCkge1xyXG5cdFx0XHRcdHZhciBjPW9wdHMuY3VyO29wdHMuY3VyKz1kYXRhc2l6ZTtcclxuXHRcdFx0XHR0aGlzLmZzLnJlYWRTdHJpbmcoYyxkYXRhc2l6ZSwndXRmOCcsY2IpO1xyXG5cdFx0XHR9IGVsc2UgaWYgKHNpZ25hdHVyZT09PURULnVjczIpIHtcclxuXHRcdFx0XHR2YXIgYz1vcHRzLmN1cjtvcHRzLmN1cis9ZGF0YXNpemU7XHJcblx0XHRcdFx0dGhpcy5mcy5yZWFkU3RyaW5nKGMsZGF0YXNpemUsJ3VjczInLGNiKTtcdFxyXG5cdFx0XHR9IGVsc2UgaWYgKHNpZ25hdHVyZT09PURULmJvb2wpIHtcclxuXHRcdFx0XHRvcHRzLmN1cisrO1xyXG5cdFx0XHRcdHRoaXMuZnMucmVhZFVJOChvcHRzLmN1ci0xLGZ1bmN0aW9uKGRhdGEpe2NiKCEhZGF0YSl9KTtcclxuXHRcdFx0fSBlbHNlIGlmIChzaWduYXR1cmU9PT1EVC5ibG9iKSB7XHJcblx0XHRcdFx0bG9hZEJsb2IoZGF0YXNpemUsY2IpO1xyXG5cdFx0XHR9XHJcblx0XHRcdC8vdmFyaWFibGUgbGVuZ3RoIGludGVnZXJzXHJcblx0XHRcdGVsc2UgaWYgKHNpZ25hdHVyZT09PURULnZpbnQpIHtcclxuXHRcdFx0XHRsb2FkVkludC5hcHBseSh0aGlzLFtvcHRzLGRhdGFzaXplLGRhdGFzaXplLGNiXSk7XHJcblx0XHRcdH1cclxuXHRcdFx0ZWxzZSBpZiAoc2lnbmF0dXJlPT09RFQucGludCkge1xyXG5cdFx0XHRcdGxvYWRQSW50LmFwcGx5KHRoaXMsW29wdHMsZGF0YXNpemUsZGF0YXNpemUsY2JdKTtcclxuXHRcdFx0fVxyXG5cdFx0XHQvL3NpbXBsZSBhcnJheVxyXG5cdFx0XHRlbHNlIGlmIChzaWduYXR1cmU9PT1EVC51dGY4YXJyKSB7XHJcblx0XHRcdFx0bG9hZFN0cmluZ0FycmF5LmFwcGx5KHRoaXMsW29wdHMsZGF0YXNpemUsJ3V0ZjgnLGNiXSk7XHJcblx0XHRcdH1cclxuXHRcdFx0ZWxzZSBpZiAoc2lnbmF0dXJlPT09RFQudWNzMmFycikge1xyXG5cdFx0XHRcdGxvYWRTdHJpbmdBcnJheS5hcHBseSh0aGlzLFtvcHRzLGRhdGFzaXplLCd1Y3MyJyxjYl0pO1xyXG5cdFx0XHR9XHJcblx0XHRcdGVsc2UgaWYgKHNpZ25hdHVyZT09PURULnVpbnQ4YXJyKSB7XHJcblx0XHRcdFx0bG9hZEludGVnZXJBcnJheS5hcHBseSh0aGlzLFtvcHRzLGRhdGFzaXplLDEsY2JdKTtcclxuXHRcdFx0fVxyXG5cdFx0XHRlbHNlIGlmIChzaWduYXR1cmU9PT1EVC5pbnQzMmFycikge1xyXG5cdFx0XHRcdGxvYWRJbnRlZ2VyQXJyYXkuYXBwbHkodGhpcyxbb3B0cyxkYXRhc2l6ZSw0LGNiXSk7XHJcblx0XHRcdH1cclxuXHRcdFx0Ly9uZXN0ZWQgc3RydWN0dXJlXHJcblx0XHRcdGVsc2UgaWYgKHNpZ25hdHVyZT09PURULmFycmF5KSB7XHJcblx0XHRcdFx0bG9hZEFycmF5LmFwcGx5KHRoaXMsW29wdHMsZGF0YXNpemUsY2JdKTtcclxuXHRcdFx0fVxyXG5cdFx0XHRlbHNlIGlmIChzaWduYXR1cmU9PT1EVC5vYmplY3QpIHtcclxuXHRcdFx0XHRsb2FkT2JqZWN0LmFwcGx5KHRoaXMsW29wdHMsZGF0YXNpemUsY2JdKTtcclxuXHRcdFx0fVxyXG5cdFx0XHRlbHNlIHtcclxuXHRcdFx0XHRjb25zb2xlLmVycm9yKCd1bnN1cHBvcnRlZCB0eXBlJyxzaWduYXR1cmUsb3B0cylcclxuXHRcdFx0XHRjYi5hcHBseSh0aGlzLFtudWxsXSk7Ly9tYWtlIHN1cmUgaXQgcmV0dXJuXHJcblx0XHRcdFx0Ly90aHJvdyAndW5zdXBwb3J0ZWQgdHlwZSAnK3NpZ25hdHVyZTtcclxuXHRcdFx0fVxyXG5cdH1cclxuXHJcblx0dmFyIGxvYWQ9ZnVuY3Rpb24ob3B0cyxjYikge1xyXG5cdFx0b3B0cz1vcHRzfHx7fTsgLy8gdGhpcyB3aWxsIHNlcnZlZCBhcyBjb250ZXh0IGZvciBlbnRpcmUgbG9hZCBwcm9jZWR1cmVcclxuXHRcdG9wdHMuY3VyPW9wdHMuY3VyfHwwO1xyXG5cdFx0dmFyIHRoYXQ9dGhpcztcclxuXHRcdHRoaXMuZnMucmVhZFNpZ25hdHVyZShvcHRzLmN1ciwgZnVuY3Rpb24oc2lnbmF0dXJlKXtcclxuXHRcdFx0bG9hZGJ5c2lnbmF0dXJlLmFwcGx5KHRoYXQsW29wdHMsc2lnbmF0dXJlLGNiXSlcclxuXHRcdH0pO1xyXG5cdFx0cmV0dXJuIHRoaXM7XHJcblx0fVxyXG5cdHZhciBDQUNIRT1udWxsO1xyXG5cdHZhciBLRVk9e307XHJcblx0dmFyIEFERFJFU1M9e307XHJcblx0dmFyIHJlc2V0PWZ1bmN0aW9uKGNiKSB7XHJcblx0XHRpZiAoIUNBQ0hFKSB7XHJcblx0XHRcdGxvYWQuYXBwbHkodGhpcyxbe2N1cjowLGxhenk6dHJ1ZX0sZnVuY3Rpb24oZGF0YSl7XHJcblx0XHRcdFx0Q0FDSEU9ZGF0YTtcclxuXHRcdFx0XHRjYi5jYWxsKHRoaXMpO1xyXG5cdFx0XHR9XSk7XHRcclxuXHRcdH0gZWxzZSB7XHJcblx0XHRcdGNiLmNhbGwodGhpcyk7XHJcblx0XHR9XHJcblx0fVxyXG5cclxuXHR2YXIgZXhpc3RzPWZ1bmN0aW9uKHBhdGgsY2IpIHtcclxuXHRcdGlmIChwYXRoLmxlbmd0aD09MCkgcmV0dXJuIHRydWU7XHJcblx0XHR2YXIga2V5PXBhdGgucG9wKCk7XHJcblx0XHR2YXIgdGhhdD10aGlzO1xyXG5cdFx0Z2V0LmFwcGx5KHRoaXMsW3BhdGgsZmFsc2UsZnVuY3Rpb24oZGF0YSl7XHJcblx0XHRcdGlmICghcGF0aC5qb2luKHN0cnNlcCkpIHJldHVybiAoISFLRVlba2V5XSk7XHJcblx0XHRcdHZhciBrZXlzPUtFWVtwYXRoLmpvaW4oc3Ryc2VwKV07XHJcblx0XHRcdHBhdGgucHVzaChrZXkpOy8vcHV0IGl0IGJhY2tcclxuXHRcdFx0aWYgKGtleXMpIGNiLmFwcGx5KHRoYXQsW2tleXMuaW5kZXhPZihrZXkpPi0xXSk7XHJcblx0XHRcdGVsc2UgY2IuYXBwbHkodGhhdCxbZmFsc2VdKTtcclxuXHRcdH1dKTtcclxuXHR9XHJcblxyXG5cdHZhciBnZXRTeW5jPWZ1bmN0aW9uKHBhdGgpIHtcclxuXHRcdGlmICghQ0FDSEUpIHJldHVybiB1bmRlZmluZWQ7XHRcclxuXHRcdHZhciBvPUNBQ0hFO1xyXG5cdFx0Zm9yICh2YXIgaT0wO2k8cGF0aC5sZW5ndGg7aSsrKSB7XHJcblx0XHRcdHZhciByPW9bcGF0aFtpXV07XHJcblx0XHRcdGlmICh0eXBlb2Ygcj09XCJ1bmRlZmluZWRcIikgcmV0dXJuIG51bGw7XHJcblx0XHRcdG89cjtcclxuXHRcdH1cclxuXHRcdHJldHVybiBvO1xyXG5cdH1cclxuXHR2YXIgZ2V0PWZ1bmN0aW9uKHBhdGgsb3B0cyxjYikge1xyXG5cdFx0aWYgKHR5cGVvZiBwYXRoPT0ndW5kZWZpbmVkJykgcGF0aD1bXTtcclxuXHRcdGlmICh0eXBlb2YgcGF0aD09XCJzdHJpbmdcIikgcGF0aD1bcGF0aF07XHJcblx0XHQvL29wdHMucmVjdXJzaXZlPSEhb3B0cy5yZWN1cnNpdmU7XHJcblx0XHRpZiAodHlwZW9mIG9wdHM9PVwiZnVuY3Rpb25cIikge1xyXG5cdFx0XHRjYj1vcHRzO25vZGVcclxuXHRcdFx0b3B0cz17fTtcclxuXHRcdH1cclxuXHRcdHZhciB0aGF0PXRoaXM7XHJcblx0XHRpZiAodHlwZW9mIGNiIT0nZnVuY3Rpb24nKSByZXR1cm4gZ2V0U3luYyhwYXRoKTtcclxuXHJcblx0XHRyZXNldC5hcHBseSh0aGlzLFtmdW5jdGlvbigpe1xyXG5cdFx0XHR2YXIgbz1DQUNIRTtcclxuXHRcdFx0aWYgKHBhdGgubGVuZ3RoPT0wKSB7XHJcblx0XHRcdFx0aWYgKG9wdHMuYWRkcmVzcykge1xyXG5cdFx0XHRcdFx0Y2IoWzAsdGhhdC5mcy5zaXplXSk7XHJcblx0XHRcdFx0fSBlbHNlIHtcclxuXHRcdFx0XHRcdGNiKE9iamVjdC5rZXlzKENBQ0hFKSk7XHRcclxuXHRcdFx0XHR9XHJcblx0XHRcdFx0cmV0dXJuO1xyXG5cdFx0XHR9IFxyXG5cdFx0XHRcclxuXHRcdFx0dmFyIHBhdGhub3c9XCJcIix0YXNrcXVldWU9W10sbmV3b3B0cz17fSxyPW51bGw7XHJcblx0XHRcdHZhciBsYXN0a2V5PVwiXCI7XHJcblxyXG5cdFx0XHRmb3IgKHZhciBpPTA7aTxwYXRoLmxlbmd0aDtpKyspIHtcclxuXHRcdFx0XHR2YXIgdGFzaz0oZnVuY3Rpb24oa2V5LGspe1xyXG5cclxuXHRcdFx0XHRcdHJldHVybiAoZnVuY3Rpb24oZGF0YSl7XHJcblx0XHRcdFx0XHRcdGlmICghKHR5cGVvZiBkYXRhPT0nb2JqZWN0JyAmJiBkYXRhLl9fZW1wdHkpKSB7XHJcblx0XHRcdFx0XHRcdFx0aWYgKHR5cGVvZiBvW2xhc3RrZXldPT0nc3RyaW5nJyAmJiBvW2xhc3RrZXldWzBdPT1zdHJzZXApIG9bbGFzdGtleV09e307XHJcblx0XHRcdFx0XHRcdFx0b1tsYXN0a2V5XT1kYXRhOyBcclxuXHRcdFx0XHRcdFx0XHRvPW9bbGFzdGtleV07XHJcblx0XHRcdFx0XHRcdFx0cj1kYXRhW2tleV07XHJcblx0XHRcdFx0XHRcdFx0S0VZW3BhdGhub3ddPW9wdHMua2V5cztcdFx0XHRcdFx0XHRcdFx0XHJcblx0XHRcdFx0XHRcdH0gZWxzZSB7XHJcblx0XHRcdFx0XHRcdFx0ZGF0YT1vW2tleV07XHJcblx0XHRcdFx0XHRcdFx0cj1kYXRhO1xyXG5cdFx0XHRcdFx0XHR9XHJcblxyXG5cdFx0XHRcdFx0XHRpZiAodHlwZW9mIHI9PT1cInVuZGVmaW5lZFwiKSB7XHJcblx0XHRcdFx0XHRcdFx0dGFza3F1ZXVlPW51bGw7XHJcblx0XHRcdFx0XHRcdFx0Y2IuYXBwbHkodGhhdCxbcl0pOyAvL3JldHVybiBlbXB0eSB2YWx1ZVxyXG5cdFx0XHRcdFx0XHR9IGVsc2Uge1x0XHRcdFx0XHRcdFx0XHJcblx0XHRcdFx0XHRcdFx0aWYgKHBhcnNlSW50KGspKSBwYXRobm93Kz1zdHJzZXA7XHJcblx0XHRcdFx0XHRcdFx0cGF0aG5vdys9a2V5O1xyXG5cdFx0XHRcdFx0XHRcdGlmICh0eXBlb2Ygcj09J3N0cmluZycgJiYgclswXT09c3Ryc2VwKSB7IC8vb2Zmc2V0IG9mIGRhdGEgdG8gYmUgbG9hZGVkXHJcblx0XHRcdFx0XHRcdFx0XHR2YXIgcD1yLnN1YnN0cmluZygxKS5zcGxpdChzdHJzZXApLm1hcChmdW5jdGlvbihpdGVtKXtyZXR1cm4gcGFyc2VJbnQoaXRlbSwxNil9KTtcclxuXHRcdFx0XHRcdFx0XHRcdHZhciBjdXI9cFswXSxzej1wWzFdO1xyXG5cdFx0XHRcdFx0XHRcdFx0bmV3b3B0cy5sYXp5PSFvcHRzLnJlY3Vyc2l2ZSB8fCAoazxwYXRoLmxlbmd0aC0xKSA7XHJcblx0XHRcdFx0XHRcdFx0XHRuZXdvcHRzLmJsb2Nrc2l6ZT1zejtuZXdvcHRzLmN1cj1jdXIsbmV3b3B0cy5rZXlzPVtdO1xyXG5cdFx0XHRcdFx0XHRcdFx0bGFzdGtleT1rZXk7IC8vbG9hZCBpcyBzeW5jIGluIGFuZHJvaWRcclxuXHRcdFx0XHRcdFx0XHRcdGlmIChvcHRzLmFkZHJlc3MgJiYgdGFza3F1ZXVlLmxlbmd0aD09MSkge1xyXG5cdFx0XHRcdFx0XHRcdFx0XHRBRERSRVNTW3BhdGhub3ddPVtjdXIsc3pdO1xyXG5cdFx0XHRcdFx0XHRcdFx0XHR0YXNrcXVldWUuc2hpZnQoKShudWxsLEFERFJFU1NbcGF0aG5vd10pO1xyXG5cdFx0XHRcdFx0XHRcdFx0fSBlbHNlIHtcclxuXHRcdFx0XHRcdFx0XHRcdFx0bG9hZC5hcHBseSh0aGF0LFtuZXdvcHRzLCB0YXNrcXVldWUuc2hpZnQoKV0pO1xyXG5cdFx0XHRcdFx0XHRcdFx0fVxyXG5cdFx0XHRcdFx0XHRcdH0gZWxzZSB7XHJcblx0XHRcdFx0XHRcdFx0XHRpZiAob3B0cy5hZGRyZXNzICYmIHRhc2txdWV1ZS5sZW5ndGg9PTEpIHtcclxuXHRcdFx0XHRcdFx0XHRcdFx0dGFza3F1ZXVlLnNoaWZ0KCkobnVsbCxBRERSRVNTW3BhdGhub3ddKTtcclxuXHRcdFx0XHRcdFx0XHRcdH0gZWxzZSB7XHJcblx0XHRcdFx0XHRcdFx0XHRcdHRhc2txdWV1ZS5zaGlmdCgpLmFwcGx5KHRoYXQsW3JdKTtcclxuXHRcdFx0XHRcdFx0XHRcdH1cclxuXHRcdFx0XHRcdFx0XHR9XHJcblx0XHRcdFx0XHRcdH1cclxuXHRcdFx0XHRcdH0pXHJcblx0XHRcdFx0fSlcclxuXHRcdFx0XHQocGF0aFtpXSxpKTtcclxuXHRcdFx0XHRcclxuXHRcdFx0XHR0YXNrcXVldWUucHVzaCh0YXNrKTtcclxuXHRcdFx0fVxyXG5cclxuXHRcdFx0aWYgKHRhc2txdWV1ZS5sZW5ndGg9PTApIHtcclxuXHRcdFx0XHRjYi5hcHBseSh0aGF0LFtvXSk7XHJcblx0XHRcdH0gZWxzZSB7XHJcblx0XHRcdFx0Ly9sYXN0IGNhbGwgdG8gY2hpbGQgbG9hZFxyXG5cdFx0XHRcdHRhc2txdWV1ZS5wdXNoKGZ1bmN0aW9uKGRhdGEsY3Vyc3ope1xyXG5cdFx0XHRcdFx0aWYgKG9wdHMuYWRkcmVzcykge1xyXG5cdFx0XHRcdFx0XHRjYi5hcHBseSh0aGF0LFtjdXJzel0pO1xyXG5cdFx0XHRcdFx0fSBlbHNle1xyXG5cdFx0XHRcdFx0XHR2YXIga2V5PXBhdGhbcGF0aC5sZW5ndGgtMV07XHJcblx0XHRcdFx0XHRcdG9ba2V5XT1kYXRhOyBLRVlbcGF0aG5vd109b3B0cy5rZXlzO1xyXG5cdFx0XHRcdFx0XHRjYi5hcHBseSh0aGF0LFtkYXRhXSk7XHJcblx0XHRcdFx0XHR9XHJcblx0XHRcdFx0fSk7XHJcblx0XHRcdFx0dGFza3F1ZXVlLnNoaWZ0KCkoe19fZW1wdHk6dHJ1ZX0pO1x0XHRcdFxyXG5cdFx0XHR9XHJcblxyXG5cdFx0fV0pOyAvL3Jlc2V0XHJcblx0fVxyXG5cdC8vIGdldCBhbGwga2V5cyBpbiBnaXZlbiBwYXRoXHJcblx0dmFyIGdldGtleXM9ZnVuY3Rpb24ocGF0aCxjYikge1xyXG5cdFx0aWYgKCFwYXRoKSBwYXRoPVtdXHJcblx0XHR2YXIgdGhhdD10aGlzO1xyXG5cdFx0Z2V0LmFwcGx5KHRoaXMsW3BhdGgsZmFsc2UsZnVuY3Rpb24oKXtcclxuXHRcdFx0aWYgKHBhdGggJiYgcGF0aC5sZW5ndGgpIHtcclxuXHRcdFx0XHRjYi5hcHBseSh0aGF0LFtLRVlbcGF0aC5qb2luKHN0cnNlcCldXSk7XHJcblx0XHRcdH0gZWxzZSB7XHJcblx0XHRcdFx0Y2IuYXBwbHkodGhhdCxbT2JqZWN0LmtleXMoQ0FDSEUpXSk7IFxyXG5cdFx0XHRcdC8vdG9wIGxldmVsLCBub3JtYWxseSBpdCBpcyB2ZXJ5IHNtYWxsXHJcblx0XHRcdH1cclxuXHRcdH1dKTtcclxuXHR9XHJcblxyXG5cdHZhciBzZXR1cGFwaT1mdW5jdGlvbigpIHtcclxuXHRcdHRoaXMubG9hZD1sb2FkO1xyXG4vL1x0XHR0aGlzLmN1cj0wO1xyXG5cdFx0dGhpcy5jYWNoZT1mdW5jdGlvbigpIHtyZXR1cm4gQ0FDSEV9O1xyXG5cdFx0dGhpcy5rZXk9ZnVuY3Rpb24oKSB7cmV0dXJuIEtFWX07XHJcblx0XHR0aGlzLmZyZWU9ZnVuY3Rpb24oKSB7XHJcblx0XHRcdENBQ0hFPW51bGw7XHJcblx0XHRcdEtFWT1udWxsO1xyXG5cdFx0XHR0aGlzLmZzLmZyZWUoKTtcclxuXHRcdH1cclxuXHRcdHRoaXMuc2V0Q2FjaGU9ZnVuY3Rpb24oYykge0NBQ0hFPWN9O1xyXG5cdFx0dGhpcy5rZXlzPWdldGtleXM7XHJcblx0XHR0aGlzLmdldD1nZXQ7ICAgLy8gZ2V0IGEgZmllbGQsIGxvYWQgaWYgbmVlZGVkXHJcblx0XHR0aGlzLmV4aXN0cz1leGlzdHM7XHJcblx0XHR0aGlzLkRUPURUO1xyXG5cdFx0XHJcblx0XHQvL2luc3RhbGwgdGhlIHN5bmMgdmVyc2lvbiBmb3Igbm9kZVxyXG5cdFx0Ly9pZiAodHlwZW9mIHByb2Nlc3MhPVwidW5kZWZpbmVkXCIpIHJlcXVpcmUoXCIuL2tkYl9zeW5jXCIpKHRoaXMpO1xyXG5cdFx0Ly9pZiAoY2IpIHNldFRpbWVvdXQoY2IuYmluZCh0aGlzKSwwKTtcclxuXHRcdHZhciB0aGF0PXRoaXM7XHJcblx0XHR2YXIgZXJyPTA7XHJcblx0XHRpZiAoY2IpIHtcclxuXHRcdFx0c2V0VGltZW91dChmdW5jdGlvbigpe1xyXG5cdFx0XHRcdGNiKGVycix0aGF0KTtcdFxyXG5cdFx0XHR9LDApO1xyXG5cdFx0fVxyXG5cdH1cclxuXHR2YXIgdGhhdD10aGlzO1xyXG5cdHZhciBrZnM9bmV3IEtmcyhwYXRoLG9wdHMsZnVuY3Rpb24oZXJyKXtcclxuXHRcdGlmIChlcnIpIHtcclxuXHRcdFx0c2V0VGltZW91dChmdW5jdGlvbigpe1xyXG5cdFx0XHRcdGNiKGVyciwwKTtcclxuXHRcdFx0fSwwKTtcclxuXHRcdFx0cmV0dXJuIG51bGw7XHJcblx0XHR9IGVsc2Uge1xyXG5cdFx0XHR0aGF0LnNpemU9dGhpcy5zaXplO1xyXG5cdFx0XHRzZXR1cGFwaS5jYWxsKHRoYXQpO1x0XHRcdFxyXG5cdFx0fVxyXG5cdH0pO1xyXG5cdHRoaXMuZnM9a2ZzO1xyXG5cdHJldHVybiB0aGlzO1xyXG59XHJcblxyXG5DcmVhdGUuZGF0YXR5cGVzPURUO1xyXG5cclxuaWYgKG1vZHVsZSkgbW9kdWxlLmV4cG9ydHM9Q3JlYXRlO1xyXG4vL3JldHVybiBDcmVhdGU7XHJcbiIsIi8qIG5vZGUuanMgYW5kIGh0bWw1IGZpbGUgc3lzdGVtIGFic3RyYWN0aW9uIGxheWVyKi9cclxudHJ5IHtcclxuXHR2YXIgZnM9cmVxdWlyZShcImZzXCIpO1xyXG5cdHZhciBCdWZmZXI9cmVxdWlyZShcImJ1ZmZlclwiKS5CdWZmZXI7XHJcbn0gY2F0Y2ggKGUpIHtcclxuXHR2YXIgZnM9cmVxdWlyZSgnLi9odG1sNWZzJyk7XHJcblx0dmFyIEJ1ZmZlcj1mdW5jdGlvbigpeyByZXR1cm4gXCJcIn07XHJcblx0dmFyIGh0bWw1ZnM9dHJ1ZTsgXHRcclxufVxyXG52YXIgc2lnbmF0dXJlX3NpemU9MTtcclxudmFyIHZlcmJvc2U9MCwgcmVhZExvZz1mdW5jdGlvbigpe307XHJcbnZhciBfcmVhZExvZz1mdW5jdGlvbihyZWFkdHlwZSxieXRlcykge1xyXG5cdGNvbnNvbGUubG9nKHJlYWR0eXBlLGJ5dGVzLFwiYnl0ZXNcIik7XHJcbn1cclxuaWYgKHZlcmJvc2UpIHJlYWRMb2c9X3JlYWRMb2c7XHJcblxyXG52YXIgdW5wYWNrX2ludCA9IGZ1bmN0aW9uIChhciwgY291bnQgLCByZXNldCkge1xyXG4gICBjb3VudD1jb3VudHx8YXIubGVuZ3RoO1xyXG4gIHZhciByID0gW10sIGkgPSAwLCB2ID0gMDtcclxuICBkbyB7XHJcblx0dmFyIHNoaWZ0ID0gMDtcclxuXHRkbyB7XHJcblx0ICB2ICs9ICgoYXJbaV0gJiAweDdGKSA8PCBzaGlmdCk7XHJcblx0ICBzaGlmdCArPSA3O1x0ICBcclxuXHR9IHdoaWxlIChhclsrK2ldICYgMHg4MCk7XHJcblx0ci5wdXNoKHYpOyBpZiAocmVzZXQpIHY9MDtcclxuXHRjb3VudC0tO1xyXG4gIH0gd2hpbGUgKGk8YXIubGVuZ3RoICYmIGNvdW50KTtcclxuICByZXR1cm4ge2RhdGE6ciwgYWR2OmkgfTtcclxufVxyXG52YXIgT3Blbj1mdW5jdGlvbihwYXRoLG9wdHMsY2IpIHtcclxuXHRvcHRzPW9wdHN8fHt9O1xyXG5cclxuXHR2YXIgcmVhZFNpZ25hdHVyZT1mdW5jdGlvbihwb3MsY2IpIHtcclxuXHRcdHZhciBidWY9bmV3IEJ1ZmZlcihzaWduYXR1cmVfc2l6ZSk7XHJcblx0XHR2YXIgdGhhdD10aGlzO1xyXG5cdFx0ZnMucmVhZCh0aGlzLmhhbmRsZSxidWYsMCxzaWduYXR1cmVfc2l6ZSxwb3MsZnVuY3Rpb24oZXJyLGxlbixidWZmZXIpe1xyXG5cdFx0XHRpZiAoaHRtbDVmcykgdmFyIHNpZ25hdHVyZT1TdHJpbmcuZnJvbUNoYXJDb2RlKChuZXcgVWludDhBcnJheShidWZmZXIpKVswXSlcclxuXHRcdFx0ZWxzZSB2YXIgc2lnbmF0dXJlPWJ1ZmZlci50b1N0cmluZygndXRmOCcsMCxzaWduYXR1cmVfc2l6ZSk7XHJcblx0XHRcdGNiLmFwcGx5KHRoYXQsW3NpZ25hdHVyZV0pO1xyXG5cdFx0fSk7XHJcblx0fVxyXG5cclxuXHQvL3RoaXMgaXMgcXVpdGUgc2xvd1xyXG5cdC8vd2FpdCBmb3IgU3RyaW5nVmlldyArQXJyYXlCdWZmZXIgdG8gc29sdmUgdGhlIHByb2JsZW1cclxuXHQvL2h0dHBzOi8vZ3JvdXBzLmdvb2dsZS5jb20vYS9jaHJvbWl1bS5vcmcvZm9ydW0vIyF0b3BpYy9ibGluay1kZXYveWxnaU5ZX1pTVjBcclxuXHQvL2lmIHRoZSBzdHJpbmcgaXMgYWx3YXlzIHVjczJcclxuXHQvL2NhbiB1c2UgVWludDE2IHRvIHJlYWQgaXQuXHJcblx0Ly9odHRwOi8vdXBkYXRlcy5odG1sNXJvY2tzLmNvbS8yMDEyLzA2L0hvdy10by1jb252ZXJ0LUFycmF5QnVmZmVyLXRvLWFuZC1mcm9tLVN0cmluZ1xyXG5cdHZhciBkZWNvZGV1dGY4ID0gZnVuY3Rpb24gKHV0ZnRleHQpIHtcclxuXHRcdHZhciBzdHJpbmcgPSBcIlwiO1xyXG5cdFx0dmFyIGkgPSAwO1xyXG5cdFx0dmFyIGM9MCxjMSA9IDAsIGMyID0gMCAsIGMzPTA7XHJcblx0XHRmb3IgKHZhciBpPTA7aTx1dGZ0ZXh0Lmxlbmd0aDtpKyspIHtcclxuXHRcdFx0aWYgKHV0ZnRleHQuY2hhckNvZGVBdChpKT4xMjcpIGJyZWFrO1xyXG5cdFx0fVxyXG5cdFx0aWYgKGk+PXV0ZnRleHQubGVuZ3RoKSByZXR1cm4gdXRmdGV4dDtcclxuXHJcblx0XHR3aGlsZSAoIGkgPCB1dGZ0ZXh0Lmxlbmd0aCApIHtcclxuXHRcdFx0YyA9IHV0ZnRleHQuY2hhckNvZGVBdChpKTtcclxuXHRcdFx0aWYgKGMgPCAxMjgpIHtcclxuXHRcdFx0XHRzdHJpbmcgKz0gdXRmdGV4dFtpXTtcclxuXHRcdFx0XHRpKys7XHJcblx0XHRcdH0gZWxzZSBpZigoYyA+IDE5MSkgJiYgKGMgPCAyMjQpKSB7XHJcblx0XHRcdFx0YzIgPSB1dGZ0ZXh0LmNoYXJDb2RlQXQoaSsxKTtcclxuXHRcdFx0XHRzdHJpbmcgKz0gU3RyaW5nLmZyb21DaGFyQ29kZSgoKGMgJiAzMSkgPDwgNikgfCAoYzIgJiA2MykpO1xyXG5cdFx0XHRcdGkgKz0gMjtcclxuXHRcdFx0fSBlbHNlIHtcclxuXHRcdFx0XHRjMiA9IHV0ZnRleHQuY2hhckNvZGVBdChpKzEpO1xyXG5cdFx0XHRcdGMzID0gdXRmdGV4dC5jaGFyQ29kZUF0KGkrMik7XHJcblx0XHRcdFx0c3RyaW5nICs9IFN0cmluZy5mcm9tQ2hhckNvZGUoKChjICYgMTUpIDw8IDEyKSB8ICgoYzIgJiA2MykgPDwgNikgfCAoYzMgJiA2MykpO1xyXG5cdFx0XHRcdGkgKz0gMztcclxuXHRcdFx0fVxyXG5cdFx0fVxyXG5cdFx0cmV0dXJuIHN0cmluZztcclxuXHR9XHJcblxyXG5cdHZhciByZWFkU3RyaW5nPSBmdW5jdGlvbihwb3MsYmxvY2tzaXplLGVuY29kaW5nLGNiKSB7XHJcblx0XHRlbmNvZGluZz1lbmNvZGluZ3x8J3V0ZjgnO1xyXG5cdFx0dmFyIGJ1ZmZlcj1uZXcgQnVmZmVyKGJsb2Nrc2l6ZSk7XHJcblx0XHR2YXIgdGhhdD10aGlzO1xyXG5cdFx0ZnMucmVhZCh0aGlzLmhhbmRsZSxidWZmZXIsMCxibG9ja3NpemUscG9zLGZ1bmN0aW9uKGVycixsZW4sYnVmZmVyKXtcclxuXHRcdFx0cmVhZExvZyhcInN0cmluZ1wiLGxlbik7XHJcblx0XHRcdGlmIChodG1sNWZzKSB7XHJcblx0XHRcdFx0aWYgKGVuY29kaW5nPT0ndXRmOCcpIHtcclxuXHRcdFx0XHRcdHZhciBzdHI9ZGVjb2RldXRmOChTdHJpbmcuZnJvbUNoYXJDb2RlLmFwcGx5KG51bGwsIG5ldyBVaW50OEFycmF5KGJ1ZmZlcikpKVxyXG5cdFx0XHRcdH0gZWxzZSB7IC8vdWNzMiBpcyAzIHRpbWVzIGZhc3RlclxyXG5cdFx0XHRcdFx0dmFyIHN0cj1TdHJpbmcuZnJvbUNoYXJDb2RlLmFwcGx5KG51bGwsIG5ldyBVaW50MTZBcnJheShidWZmZXIpKVx0XHJcblx0XHRcdFx0fVxyXG5cdFx0XHRcdFxyXG5cdFx0XHRcdGNiLmFwcGx5KHRoYXQsW3N0cl0pO1xyXG5cdFx0XHR9IFxyXG5cdFx0XHRlbHNlIGNiLmFwcGx5KHRoYXQsW2J1ZmZlci50b1N0cmluZyhlbmNvZGluZyldKTtcdFxyXG5cdFx0fSk7XHJcblx0fVxyXG5cclxuXHQvL3dvcmsgYXJvdW5kIGZvciBjaHJvbWUgZnJvbUNoYXJDb2RlIGNhbm5vdCBhY2NlcHQgaHVnZSBhcnJheVxyXG5cdC8vaHR0cHM6Ly9jb2RlLmdvb2dsZS5jb20vcC9jaHJvbWl1bS9pc3N1ZXMvZGV0YWlsP2lkPTU2NTg4XHJcblx0dmFyIGJ1ZjJzdHJpbmdhcnI9ZnVuY3Rpb24oYnVmLGVuYykge1xyXG5cdFx0aWYgKGVuYz09XCJ1dGY4XCIpIFx0dmFyIGFycj1uZXcgVWludDhBcnJheShidWYpO1xyXG5cdFx0ZWxzZSB2YXIgYXJyPW5ldyBVaW50MTZBcnJheShidWYpO1xyXG5cdFx0dmFyIGk9MCxjb2Rlcz1bXSxvdXQ9W10scz1cIlwiO1xyXG5cdFx0d2hpbGUgKGk8YXJyLmxlbmd0aCkge1xyXG5cdFx0XHRpZiAoYXJyW2ldKSB7XHJcblx0XHRcdFx0Y29kZXNbY29kZXMubGVuZ3RoXT1hcnJbaV07XHJcblx0XHRcdH0gZWxzZSB7XHJcblx0XHRcdFx0cz1TdHJpbmcuZnJvbUNoYXJDb2RlLmFwcGx5KG51bGwsY29kZXMpO1xyXG5cdFx0XHRcdGlmIChlbmM9PVwidXRmOFwiKSBvdXRbb3V0Lmxlbmd0aF09ZGVjb2RldXRmOChzKTtcclxuXHRcdFx0XHRlbHNlIG91dFtvdXQubGVuZ3RoXT1zO1xyXG5cdFx0XHRcdGNvZGVzPVtdO1x0XHRcdFx0XHJcblx0XHRcdH1cclxuXHRcdFx0aSsrO1xyXG5cdFx0fVxyXG5cdFx0XHJcblx0XHRzPVN0cmluZy5mcm9tQ2hhckNvZGUuYXBwbHkobnVsbCxjb2Rlcyk7XHJcblx0XHRpZiAoZW5jPT1cInV0ZjhcIikgb3V0W291dC5sZW5ndGhdPWRlY29kZXV0Zjgocyk7XHJcblx0XHRlbHNlIG91dFtvdXQubGVuZ3RoXT1zO1xyXG5cclxuXHRcdHJldHVybiBvdXQ7XHJcblx0fVxyXG5cdHZhciByZWFkU3RyaW5nQXJyYXkgPSBmdW5jdGlvbihwb3MsYmxvY2tzaXplLGVuY29kaW5nLGNiKSB7XHJcblx0XHR2YXIgdGhhdD10aGlzLG91dD1udWxsO1xyXG5cdFx0aWYgKGJsb2Nrc2l6ZT09MCkgcmV0dXJuIFtdO1xyXG5cdFx0ZW5jb2Rpbmc9ZW5jb2Rpbmd8fCd1dGY4JztcclxuXHRcdHZhciBidWZmZXI9bmV3IEJ1ZmZlcihibG9ja3NpemUpO1xyXG5cdFx0ZnMucmVhZCh0aGlzLmhhbmRsZSxidWZmZXIsMCxibG9ja3NpemUscG9zLGZ1bmN0aW9uKGVycixsZW4sYnVmZmVyKXtcclxuXHRcdFx0aWYgKGh0bWw1ZnMpIHtcclxuXHRcdFx0XHRyZWFkTG9nKFwic3RyaW5nQXJyYXlcIixidWZmZXIuYnl0ZUxlbmd0aCk7XHJcblxyXG5cdFx0XHRcdGlmIChlbmNvZGluZz09J3V0ZjgnKSB7XHJcblx0XHRcdFx0XHRvdXQ9YnVmMnN0cmluZ2FycihidWZmZXIsXCJ1dGY4XCIpO1xyXG5cdFx0XHRcdH0gZWxzZSB7IC8vdWNzMiBpcyAzIHRpbWVzIGZhc3RlclxyXG5cdFx0XHRcdFx0b3V0PWJ1ZjJzdHJpbmdhcnIoYnVmZmVyLFwidWNzMlwiKTtcclxuXHRcdFx0XHR9XHJcblx0XHRcdH0gZWxzZSB7XHJcblx0XHRcdFx0cmVhZExvZyhcInN0cmluZ0FycmF5XCIsYnVmZmVyLmxlbmd0aCk7XHJcblx0XHRcdFx0b3V0PWJ1ZmZlci50b1N0cmluZyhlbmNvZGluZykuc3BsaXQoJ1xcMCcpO1xyXG5cdFx0XHR9IFx0XHJcblx0XHRcdGNiLmFwcGx5KHRoYXQsW291dF0pO1xyXG5cdFx0fSk7XHJcblx0fVxyXG5cdHZhciByZWFkVUkzMj1mdW5jdGlvbihwb3MsY2IpIHtcclxuXHRcdHZhciBidWZmZXI9bmV3IEJ1ZmZlcig0KTtcclxuXHRcdHZhciB0aGF0PXRoaXM7XHJcblx0XHRmcy5yZWFkKHRoaXMuaGFuZGxlLGJ1ZmZlciwwLDQscG9zLGZ1bmN0aW9uKGVycixsZW4sYnVmZmVyKXtcclxuXHRcdFx0cmVhZExvZyhcInVpMzJcIixsZW4pO1xyXG5cdFx0XHRpZiAoaHRtbDVmcyl7XHJcblx0XHRcdFx0Ly92PShuZXcgVWludDMyQXJyYXkoYnVmZmVyKSlbMF07XHJcblx0XHRcdFx0dmFyIHY9bmV3IERhdGFWaWV3KGJ1ZmZlcikuZ2V0VWludDMyKDAsIGZhbHNlKVxyXG5cdFx0XHRcdGNiKHYpO1xyXG5cdFx0XHR9XHJcblx0XHRcdGVsc2UgY2IuYXBwbHkodGhhdCxbYnVmZmVyLnJlYWRJbnQzMkJFKDApXSk7XHRcclxuXHRcdH0pO1x0XHRcclxuXHR9XHJcblxyXG5cdHZhciByZWFkSTMyPWZ1bmN0aW9uKHBvcyxjYikge1xyXG5cdFx0dmFyIGJ1ZmZlcj1uZXcgQnVmZmVyKDQpO1xyXG5cdFx0dmFyIHRoYXQ9dGhpcztcclxuXHRcdGZzLnJlYWQodGhpcy5oYW5kbGUsYnVmZmVyLDAsNCxwb3MsZnVuY3Rpb24oZXJyLGxlbixidWZmZXIpe1xyXG5cdFx0XHRyZWFkTG9nKFwiaTMyXCIsbGVuKTtcclxuXHRcdFx0aWYgKGh0bWw1ZnMpe1xyXG5cdFx0XHRcdHZhciB2PW5ldyBEYXRhVmlldyhidWZmZXIpLmdldEludDMyKDAsIGZhbHNlKVxyXG5cdFx0XHRcdGNiKHYpO1xyXG5cdFx0XHR9XHJcblx0XHRcdGVsc2UgIFx0Y2IuYXBwbHkodGhhdCxbYnVmZmVyLnJlYWRJbnQzMkJFKDApXSk7XHRcclxuXHRcdH0pO1xyXG5cdH1cclxuXHR2YXIgcmVhZFVJOD1mdW5jdGlvbihwb3MsY2IpIHtcclxuXHRcdHZhciBidWZmZXI9bmV3IEJ1ZmZlcigxKTtcclxuXHRcdHZhciB0aGF0PXRoaXM7XHJcblxyXG5cdFx0ZnMucmVhZCh0aGlzLmhhbmRsZSxidWZmZXIsMCwxLHBvcyxmdW5jdGlvbihlcnIsbGVuLGJ1ZmZlcil7XHJcblx0XHRcdHJlYWRMb2coXCJ1aThcIixsZW4pO1xyXG5cdFx0XHRpZiAoaHRtbDVmcyljYiggKG5ldyBVaW50OEFycmF5KGJ1ZmZlcikpWzBdKSA7XHJcblx0XHRcdGVsc2UgIFx0XHRcdGNiLmFwcGx5KHRoYXQsW2J1ZmZlci5yZWFkVUludDgoMCldKTtcdFxyXG5cdFx0XHRcclxuXHRcdH0pO1xyXG5cdH1cclxuXHR2YXIgcmVhZEJ1Zj1mdW5jdGlvbihwb3MsYmxvY2tzaXplLGNiKSB7XHJcblx0XHR2YXIgdGhhdD10aGlzO1xyXG5cdFx0dmFyIGJ1Zj1uZXcgQnVmZmVyKGJsb2Nrc2l6ZSk7XHJcblx0XHRmcy5yZWFkKHRoaXMuaGFuZGxlLGJ1ZiwwLGJsb2Nrc2l6ZSxwb3MsZnVuY3Rpb24oZXJyLGxlbixidWZmZXIpe1xyXG5cdFx0XHRyZWFkTG9nKFwiYnVmXCIsbGVuKTtcclxuXHRcdFx0dmFyIGJ1ZmY9bmV3IFVpbnQ4QXJyYXkoYnVmZmVyKVxyXG5cdFx0XHRjYi5hcHBseSh0aGF0LFtidWZmXSk7XHJcblx0XHR9KTtcclxuXHR9XHJcblx0dmFyIHJlYWRCdWZfcGFja2VkaW50PWZ1bmN0aW9uKHBvcyxibG9ja3NpemUsY291bnQscmVzZXQsY2IpIHtcclxuXHRcdHZhciB0aGF0PXRoaXM7XHJcblx0XHRyZWFkQnVmLmFwcGx5KHRoaXMsW3BvcyxibG9ja3NpemUsZnVuY3Rpb24oYnVmZmVyKXtcclxuXHRcdFx0Y2IuYXBwbHkodGhhdCxbdW5wYWNrX2ludChidWZmZXIsY291bnQscmVzZXQpXSk7XHRcclxuXHRcdH1dKTtcclxuXHRcdFxyXG5cdH1cclxuXHR2YXIgcmVhZEZpeGVkQXJyYXlfaHRtbDVmcz1mdW5jdGlvbihwb3MsY291bnQsdW5pdHNpemUsY2IpIHtcclxuXHRcdHZhciBmdW5jPW51bGw7XHJcblx0XHRpZiAodW5pdHNpemU9PT0xKSB7XHJcblx0XHRcdGZ1bmM9J2dldFVpbnQ4JzsvL1VpbnQ4QXJyYXk7XHJcblx0XHR9IGVsc2UgaWYgKHVuaXRzaXplPT09Mikge1xyXG5cdFx0XHRmdW5jPSdnZXRVaW50MTYnOy8vVWludDE2QXJyYXk7XHJcblx0XHR9IGVsc2UgaWYgKHVuaXRzaXplPT09NCkge1xyXG5cdFx0XHRmdW5jPSdnZXRVaW50MzInOy8vVWludDMyQXJyYXk7XHJcblx0XHR9IGVsc2UgdGhyb3cgJ3Vuc3VwcG9ydGVkIGludGVnZXIgc2l6ZSc7XHJcblxyXG5cdFx0ZnMucmVhZCh0aGlzLmhhbmRsZSxudWxsLDAsdW5pdHNpemUqY291bnQscG9zLGZ1bmN0aW9uKGVycixsZW4sYnVmZmVyKXtcclxuXHRcdFx0cmVhZExvZyhcImZpeCBhcnJheVwiLGxlbik7XHJcblx0XHRcdHZhciBvdXQ9W107XHJcblx0XHRcdGlmICh1bml0c2l6ZT09MSkge1xyXG5cdFx0XHRcdG91dD1uZXcgVWludDhBcnJheShidWZmZXIpO1xyXG5cdFx0XHR9IGVsc2Uge1xyXG5cdFx0XHRcdGZvciAodmFyIGkgPSAwOyBpIDwgbGVuIC8gdW5pdHNpemU7IGkrKykgeyAvL2VuZGlhbiBwcm9ibGVtXHJcblx0XHRcdFx0Ly9cdG91dC5wdXNoKCBmdW5jKGJ1ZmZlcixpKnVuaXRzaXplKSk7XHJcblx0XHRcdFx0XHRvdXQucHVzaCggdj1uZXcgRGF0YVZpZXcoYnVmZmVyKVtmdW5jXShpLGZhbHNlKSApO1xyXG5cdFx0XHRcdH1cclxuXHRcdFx0fVxyXG5cclxuXHRcdFx0Y2IuYXBwbHkodGhhdCxbb3V0XSk7XHJcblx0XHR9KTtcclxuXHR9XHJcblx0Ly8gc2lnbmF0dXJlLCBpdGVtY291bnQsIHBheWxvYWRcclxuXHR2YXIgcmVhZEZpeGVkQXJyYXkgPSBmdW5jdGlvbihwb3MgLGNvdW50LCB1bml0c2l6ZSxjYikge1xyXG5cdFx0dmFyIGZ1bmM9bnVsbDtcclxuXHRcdHZhciB0aGF0PXRoaXM7XHJcblx0XHRcclxuXHRcdGlmICh1bml0c2l6ZSogY291bnQ+dGhpcy5zaXplICYmIHRoaXMuc2l6ZSkgIHtcclxuXHRcdFx0Y29uc29sZS5sb2coXCJhcnJheSBzaXplIGV4Y2VlZCBmaWxlIHNpemVcIix0aGlzLnNpemUpXHJcblx0XHRcdHJldHVybjtcclxuXHRcdH1cclxuXHRcdFxyXG5cdFx0aWYgKGh0bWw1ZnMpIHJldHVybiByZWFkRml4ZWRBcnJheV9odG1sNWZzLmFwcGx5KHRoaXMsW3Bvcyxjb3VudCx1bml0c2l6ZSxjYl0pO1xyXG5cclxuXHRcdHZhciBpdGVtcz1uZXcgQnVmZmVyKCB1bml0c2l6ZSogY291bnQpO1xyXG5cdFx0aWYgKHVuaXRzaXplPT09MSkge1xyXG5cdFx0XHRmdW5jPWl0ZW1zLnJlYWRVSW50ODtcclxuXHRcdH0gZWxzZSBpZiAodW5pdHNpemU9PT0yKSB7XHJcblx0XHRcdGZ1bmM9aXRlbXMucmVhZFVJbnQxNkJFO1xyXG5cdFx0fSBlbHNlIGlmICh1bml0c2l6ZT09PTQpIHtcclxuXHRcdFx0ZnVuYz1pdGVtcy5yZWFkVUludDMyQkU7XHJcblx0XHR9IGVsc2UgdGhyb3cgJ3Vuc3VwcG9ydGVkIGludGVnZXIgc2l6ZSc7XHJcblx0XHQvL2NvbnNvbGUubG9nKCdpdGVtY291bnQnLGl0ZW1jb3VudCwnYnVmZmVyJyxidWZmZXIpO1xyXG5cclxuXHRcdGZzLnJlYWQodGhpcy5oYW5kbGUsaXRlbXMsMCx1bml0c2l6ZSpjb3VudCxwb3MsZnVuY3Rpb24oZXJyLGxlbixidWZmZXIpe1xyXG5cdFx0XHRyZWFkTG9nKFwiZml4IGFycmF5XCIsbGVuKTtcclxuXHRcdFx0dmFyIG91dD1bXTtcclxuXHRcdFx0Zm9yICh2YXIgaSA9IDA7IGkgPCBpdGVtcy5sZW5ndGggLyB1bml0c2l6ZTsgaSsrKSB7XHJcblx0XHRcdFx0b3V0LnB1c2goIGZ1bmMuYXBwbHkoaXRlbXMsW2kqdW5pdHNpemVdKSk7XHJcblx0XHRcdH1cclxuXHRcdFx0Y2IuYXBwbHkodGhhdCxbb3V0XSk7XHJcblx0XHR9KTtcclxuXHR9XHJcblxyXG5cdHZhciBmcmVlPWZ1bmN0aW9uKCkge1xyXG5cdFx0Ly9jb25zb2xlLmxvZygnY2xvc2luZyAnLGhhbmRsZSk7XHJcblx0XHRmcy5jbG9zZVN5bmModGhpcy5oYW5kbGUpO1xyXG5cdH1cclxuXHR2YXIgc2V0dXBhcGk9ZnVuY3Rpb24oKSB7XHJcblx0XHR2YXIgdGhhdD10aGlzO1xyXG5cdFx0dGhpcy5yZWFkU2lnbmF0dXJlPXJlYWRTaWduYXR1cmU7XHJcblx0XHR0aGlzLnJlYWRJMzI9cmVhZEkzMjtcclxuXHRcdHRoaXMucmVhZFVJMzI9cmVhZFVJMzI7XHJcblx0XHR0aGlzLnJlYWRVSTg9cmVhZFVJODtcclxuXHRcdHRoaXMucmVhZEJ1Zj1yZWFkQnVmO1xyXG5cdFx0dGhpcy5yZWFkQnVmX3BhY2tlZGludD1yZWFkQnVmX3BhY2tlZGludDtcclxuXHRcdHRoaXMucmVhZEZpeGVkQXJyYXk9cmVhZEZpeGVkQXJyYXk7XHJcblx0XHR0aGlzLnJlYWRTdHJpbmc9cmVhZFN0cmluZztcclxuXHRcdHRoaXMucmVhZFN0cmluZ0FycmF5PXJlYWRTdHJpbmdBcnJheTtcclxuXHRcdHRoaXMuc2lnbmF0dXJlX3NpemU9c2lnbmF0dXJlX3NpemU7XHJcblx0XHR0aGlzLmZyZWU9ZnJlZTtcclxuXHRcdGlmIChodG1sNWZzKSB7XHJcblx0XHRcdHZhciBmbj1wYXRoO1xyXG5cdFx0XHRpZiAocGF0aC5pbmRleE9mKFwiZmlsZXN5c3RlbTpcIik9PTApIGZuPXBhdGguc3Vic3RyKHBhdGgubGFzdEluZGV4T2YoXCIvXCIpKTtcclxuXHRcdFx0ZnMuZnMucm9vdC5nZXRGaWxlKGZuLHt9LGZ1bmN0aW9uKGVudHJ5KXtcclxuXHRcdFx0ICBlbnRyeS5nZXRNZXRhZGF0YShmdW5jdGlvbihtZXRhZGF0YSkgeyBcclxuXHRcdFx0XHR0aGF0LnNpemU9bWV0YWRhdGEuc2l6ZTtcclxuXHRcdFx0XHRpZiAoY2IpIHNldFRpbWVvdXQoY2IuYmluZCh0aGF0KSwwKTtcclxuXHRcdFx0XHR9KTtcclxuXHRcdFx0fSk7XHJcblx0XHR9IGVsc2Uge1xyXG5cdFx0XHR2YXIgc3RhdD1mcy5mc3RhdFN5bmModGhpcy5oYW5kbGUpO1xyXG5cdFx0XHR0aGlzLnN0YXQ9c3RhdDtcclxuXHRcdFx0dGhpcy5zaXplPXN0YXQuc2l6ZTtcdFx0XHJcblx0XHRcdGlmIChjYilcdHNldFRpbWVvdXQoY2IuYmluZCh0aGlzLDApLDApO1x0XHJcblx0XHR9XHJcblx0fVxyXG5cclxuXHR2YXIgdGhhdD10aGlzO1xyXG5cdGlmIChodG1sNWZzKSB7XHJcblx0XHRmcy5vcGVuKHBhdGgsZnVuY3Rpb24oaCl7XHJcblx0XHRcdHRoYXQuaGFuZGxlPWg7XHJcblx0XHRcdHRoYXQuaHRtbDVmcz10cnVlO1xyXG5cdFx0XHRzZXR1cGFwaS5jYWxsKHRoYXQpO1xyXG5cdFx0XHR0aGF0Lm9wZW5lZD10cnVlO1xyXG5cdFx0fSlcclxuXHR9IGVsc2Uge1xyXG5cdFx0aWYgKGZzLmV4aXN0c1N5bmMocGF0aCkpe1xyXG5cdFx0XHR0aGlzLmhhbmRsZT1mcy5vcGVuU3luYyhwYXRoLCdyJyk7Ly8sZnVuY3Rpb24oZXJyLGhhbmRsZSl7XHJcblx0XHRcdHRoaXMub3BlbmVkPXRydWU7XHJcblx0XHRcdHNldHVwYXBpLmNhbGwodGhpcyk7XHJcblx0XHR9IGVsc2Uge1xyXG5cdFx0XHRpZiAoY2IpXHRzZXRUaW1lb3V0KGNiLmJpbmQobnVsbCxcImZpbGUgbm90IGZvdW5kOlwiK3BhdGgpLDApO1x0XHJcblx0XHRcdHJldHVybiBudWxsO1xyXG5cdFx0fVxyXG5cdH1cclxuXHRyZXR1cm4gdGhpcztcclxufVxyXG5tb2R1bGUuZXhwb3J0cz1PcGVuOyIsIi8qXHJcbiAgSkFWQSBjYW4gb25seSByZXR1cm4gTnVtYmVyIGFuZCBTdHJpbmdcclxuXHRhcnJheSBhbmQgYnVmZmVyIHJldHVybiBpbiBzdHJpbmcgZm9ybWF0XHJcblx0bmVlZCBKU09OLnBhcnNlXHJcbiovXHJcbnZhciB2ZXJib3NlPTA7XHJcblxyXG52YXIgcmVhZFNpZ25hdHVyZT1mdW5jdGlvbihwb3MsY2IpIHtcclxuXHRpZiAodmVyYm9zZSkgY29uc29sZS5kZWJ1ZyhcInJlYWQgc2lnbmF0dXJlXCIpO1xyXG5cdHZhciBzaWduYXR1cmU9a2ZzLnJlYWRVVEY4U3RyaW5nKHRoaXMuaGFuZGxlLHBvcywxKTtcclxuXHRpZiAodmVyYm9zZSkgY29uc29sZS5kZWJ1ZyhzaWduYXR1cmUsc2lnbmF0dXJlLmNoYXJDb2RlQXQoMCkpO1xyXG5cdGNiLmFwcGx5KHRoaXMsW3NpZ25hdHVyZV0pO1xyXG59XHJcbnZhciByZWFkSTMyPWZ1bmN0aW9uKHBvcyxjYikge1xyXG5cdGlmICh2ZXJib3NlKSBjb25zb2xlLmRlYnVnKFwicmVhZCBpMzIgYXQgXCIrcG9zKTtcclxuXHR2YXIgaTMyPWtmcy5yZWFkSW50MzIodGhpcy5oYW5kbGUscG9zKTtcclxuXHRpZiAodmVyYm9zZSkgY29uc29sZS5kZWJ1ZyhpMzIpO1xyXG5cdGNiLmFwcGx5KHRoaXMsW2kzMl0pO1x0XHJcbn1cclxudmFyIHJlYWRVSTMyPWZ1bmN0aW9uKHBvcyxjYikge1xyXG5cdGlmICh2ZXJib3NlKSBjb25zb2xlLmRlYnVnKFwicmVhZCB1aTMyIGF0IFwiK3Bvcyk7XHJcblx0dmFyIHVpMzI9a2ZzLnJlYWRVSW50MzIodGhpcy5oYW5kbGUscG9zKTtcclxuXHRpZiAodmVyYm9zZSkgY29uc29sZS5kZWJ1Zyh1aTMyKTtcclxuXHRjYi5hcHBseSh0aGlzLFt1aTMyXSk7XHJcbn1cclxudmFyIHJlYWRVSTg9ZnVuY3Rpb24ocG9zLGNiKSB7XHJcblx0aWYgKHZlcmJvc2UpIGNvbnNvbGUuZGVidWcoXCJyZWFkIHVpOCBhdCBcIitwb3MpOyBcclxuXHR2YXIgdWk4PWtmcy5yZWFkVUludDgodGhpcy5oYW5kbGUscG9zKTtcclxuXHRpZiAodmVyYm9zZSkgY29uc29sZS5kZWJ1Zyh1aTgpO1xyXG5cdGNiLmFwcGx5KHRoaXMsW3VpOF0pO1xyXG59XHJcbnZhciByZWFkQnVmPWZ1bmN0aW9uKHBvcyxibG9ja3NpemUsY2IpIHtcclxuXHRpZiAodmVyYm9zZSkgY29uc29sZS5kZWJ1ZyhcInJlYWQgYnVmZmVyIGF0IFwiK3BvcysgXCIgYmxvY2tzaXplIFwiK2Jsb2Nrc2l6ZSk7XHJcblx0dmFyIGJ1Zj1rZnMucmVhZEJ1Zih0aGlzLmhhbmRsZSxwb3MsYmxvY2tzaXplKTtcclxuXHR2YXIgYnVmZj1KU09OLnBhcnNlKGJ1Zik7XHJcblx0aWYgKHZlcmJvc2UpIGNvbnNvbGUuZGVidWcoXCJidWZmZXIgbGVuZ3RoXCIrYnVmZi5sZW5ndGgpO1xyXG5cdGNiLmFwcGx5KHRoaXMsW2J1ZmZdKTtcdFxyXG59XHJcbnZhciByZWFkQnVmX3BhY2tlZGludD1mdW5jdGlvbihwb3MsYmxvY2tzaXplLGNvdW50LHJlc2V0LGNiKSB7XHJcblx0aWYgKHZlcmJvc2UpIGNvbnNvbGUuZGVidWcoXCJyZWFkIHBhY2tlZCBpbnQgYXQgXCIrcG9zK1wiIGJsb2Nrc2l6ZSBcIitibG9ja3NpemUrXCIgY291bnQgXCIrY291bnQpO1xyXG5cdHZhciBidWY9a2ZzLnJlYWRCdWZfcGFja2VkaW50KHRoaXMuaGFuZGxlLHBvcyxibG9ja3NpemUsY291bnQscmVzZXQpO1xyXG5cdHZhciBhZHY9cGFyc2VJbnQoYnVmKTtcclxuXHR2YXIgYnVmZj1KU09OLnBhcnNlKGJ1Zi5zdWJzdHIoYnVmLmluZGV4T2YoXCJbXCIpKSk7XHJcblx0aWYgKHZlcmJvc2UpIGNvbnNvbGUuZGVidWcoXCJwYWNrZWRJbnQgbGVuZ3RoIFwiK2J1ZmYubGVuZ3RoK1wiIGZpcnN0IGl0ZW09XCIrYnVmZlswXSk7XHJcblx0Y2IuYXBwbHkodGhpcyxbe2RhdGE6YnVmZixhZHY6YWR2fV0pO1x0XHJcbn1cclxuXHJcblxyXG52YXIgcmVhZFN0cmluZz0gZnVuY3Rpb24ocG9zLGJsb2Nrc2l6ZSxlbmNvZGluZyxjYikge1xyXG5cdGlmICh2ZXJib3NlKSBjb25zb2xlLmRlYnVnKFwicmVhZHN0cmluZyBhdCBcIitwb3MrXCIgYmxvY2tzaXplIFwiICtibG9ja3NpemUrXCIgZW5jOlwiK2VuY29kaW5nKTtcclxuXHRpZiAoZW5jb2Rpbmc9PVwidWNzMlwiKSB7XHJcblx0XHR2YXIgc3RyPWtmcy5yZWFkVUxFMTZTdHJpbmcodGhpcy5oYW5kbGUscG9zLGJsb2Nrc2l6ZSk7XHJcblx0fSBlbHNlIHtcclxuXHRcdHZhciBzdHI9a2ZzLnJlYWRVVEY4U3RyaW5nKHRoaXMuaGFuZGxlLHBvcyxibG9ja3NpemUpO1x0XHJcblx0fVx0IFxyXG5cdGlmICh2ZXJib3NlKSBjb25zb2xlLmRlYnVnKHN0cik7XHJcblx0Y2IuYXBwbHkodGhpcyxbc3RyXSk7XHRcclxufVxyXG5cclxudmFyIHJlYWRGaXhlZEFycmF5ID0gZnVuY3Rpb24ocG9zICxjb3VudCwgdW5pdHNpemUsY2IpIHtcclxuXHRpZiAodmVyYm9zZSkgY29uc29sZS5kZWJ1ZyhcInJlYWQgZml4ZWQgYXJyYXkgYXQgXCIrcG9zK1wiIGNvdW50IFwiK2NvdW50K1wiIHVuaXRzaXplIFwiK3VuaXRzaXplKTsgXHJcblx0dmFyIGJ1Zj1rZnMucmVhZEZpeGVkQXJyYXkodGhpcy5oYW5kbGUscG9zLGNvdW50LHVuaXRzaXplKTtcclxuXHR2YXIgYnVmZj1KU09OLnBhcnNlKGJ1Zik7XHJcblx0aWYgKHZlcmJvc2UpIGNvbnNvbGUuZGVidWcoXCJhcnJheSBsZW5ndGhcIitidWZmLmxlbmd0aCk7XHJcblx0Y2IuYXBwbHkodGhpcyxbYnVmZl0pO1x0XHJcbn1cclxudmFyIHJlYWRTdHJpbmdBcnJheSA9IGZ1bmN0aW9uKHBvcyxibG9ja3NpemUsZW5jb2RpbmcsY2IpIHtcclxuXHRpZiAodmVyYm9zZSkgY29uc29sZS5sb2coXCJyZWFkIFN0cmluZyBhcnJheSBhdCBcIitwb3MrXCIgYmxvY2tzaXplIFwiK2Jsb2Nrc2l6ZSArXCIgZW5jIFwiK2VuY29kaW5nKTsgXHJcblx0ZW5jb2RpbmcgPSBlbmNvZGluZ3x8XCJ1dGY4XCI7XHJcblx0dmFyIGJ1Zj1rZnMucmVhZFN0cmluZ0FycmF5KHRoaXMuaGFuZGxlLHBvcyxibG9ja3NpemUsZW5jb2RpbmcpO1xyXG5cdC8vdmFyIGJ1ZmY9SlNPTi5wYXJzZShidWYpO1xyXG5cdGlmICh2ZXJib3NlKSBjb25zb2xlLmRlYnVnKFwicmVhZCBzdHJpbmcgYXJyYXlcIik7XHJcblx0dmFyIGJ1ZmY9YnVmLnNwbGl0KFwiXFx1ZmZmZlwiKTsgLy9jYW5ub3QgcmV0dXJuIHN0cmluZyB3aXRoIDBcclxuXHRpZiAodmVyYm9zZSkgY29uc29sZS5kZWJ1ZyhcImFycmF5IGxlbmd0aFwiK2J1ZmYubGVuZ3RoKTtcclxuXHRjYi5hcHBseSh0aGlzLFtidWZmXSk7XHRcclxufVxyXG52YXIgbWVyZ2VQb3N0aW5ncz1mdW5jdGlvbihwb3NpdGlvbnMsY2IpIHtcclxuXHR2YXIgYnVmPWtmcy5tZXJnZVBvc3RpbmdzKHRoaXMuaGFuZGxlLEpTT04uc3RyaW5naWZ5KHBvc2l0aW9ucykpO1xyXG5cdGlmICghYnVmIHx8IGJ1Zi5sZW5ndGg9PTApIHJldHVybiBbXTtcclxuXHRlbHNlIHJldHVybiBKU09OLnBhcnNlKGJ1Zik7XHJcbn1cclxuXHJcbnZhciBmcmVlPWZ1bmN0aW9uKCkge1xyXG5cdC8vY29uc29sZS5sb2coJ2Nsb3NpbmcgJyxoYW5kbGUpO1xyXG5cdGtmcy5jbG9zZSh0aGlzLmhhbmRsZSk7XHJcbn1cclxudmFyIE9wZW49ZnVuY3Rpb24ocGF0aCxvcHRzLGNiKSB7XHJcblx0b3B0cz1vcHRzfHx7fTtcclxuXHR2YXIgc2lnbmF0dXJlX3NpemU9MTtcclxuXHR2YXIgc2V0dXBhcGk9ZnVuY3Rpb24oKSB7IFxyXG5cdFx0dGhpcy5yZWFkU2lnbmF0dXJlPXJlYWRTaWduYXR1cmU7XHJcblx0XHR0aGlzLnJlYWRJMzI9cmVhZEkzMjtcclxuXHRcdHRoaXMucmVhZFVJMzI9cmVhZFVJMzI7XHJcblx0XHR0aGlzLnJlYWRVSTg9cmVhZFVJODtcclxuXHRcdHRoaXMucmVhZEJ1Zj1yZWFkQnVmO1xyXG5cdFx0dGhpcy5yZWFkQnVmX3BhY2tlZGludD1yZWFkQnVmX3BhY2tlZGludDtcclxuXHRcdHRoaXMucmVhZEZpeGVkQXJyYXk9cmVhZEZpeGVkQXJyYXk7XHJcblx0XHR0aGlzLnJlYWRTdHJpbmc9cmVhZFN0cmluZztcclxuXHRcdHRoaXMucmVhZFN0cmluZ0FycmF5PXJlYWRTdHJpbmdBcnJheTtcclxuXHRcdHRoaXMuc2lnbmF0dXJlX3NpemU9c2lnbmF0dXJlX3NpemU7XHJcblx0XHR0aGlzLm1lcmdlUG9zdGluZ3M9bWVyZ2VQb3N0aW5ncztcclxuXHRcdHRoaXMuZnJlZT1mcmVlO1xyXG5cdFx0dGhpcy5zaXplPWtmcy5nZXRGaWxlU2l6ZSh0aGlzLmhhbmRsZSk7XHJcblx0XHRpZiAodmVyYm9zZSkgY29uc29sZS5sb2coXCJmaWxlc2l6ZSAgXCIrdGhpcy5zaXplKTtcclxuXHRcdGlmIChjYilcdGNiLmNhbGwodGhpcyk7XHJcblx0fVxyXG5cclxuXHR0aGlzLmhhbmRsZT1rZnMub3BlbihwYXRoKTtcclxuXHR0aGlzLm9wZW5lZD10cnVlO1xyXG5cdHNldHVwYXBpLmNhbGwodGhpcyk7XHJcblx0cmV0dXJuIHRoaXM7XHJcbn1cclxuXHJcbm1vZHVsZS5leHBvcnRzPU9wZW47IiwiLypcclxuICBKU0NvbnRleHQgY2FuIHJldHVybiBhbGwgSmF2YXNjcmlwdCB0eXBlcy5cclxuKi9cclxudmFyIHZlcmJvc2U9MTtcclxuXHJcbnZhciByZWFkU2lnbmF0dXJlPWZ1bmN0aW9uKHBvcyxjYikge1xyXG5cdGlmICh2ZXJib3NlKSAga3NhbmFnYXAubG9nKFwicmVhZCBzaWduYXR1cmUgYXQgXCIrcG9zKTtcclxuXHR2YXIgc2lnbmF0dXJlPWtmcy5yZWFkVVRGOFN0cmluZyh0aGlzLmhhbmRsZSxwb3MsMSk7XHJcblx0aWYgKHZlcmJvc2UpICBrc2FuYWdhcC5sb2coc2lnbmF0dXJlK1wiIFwiK3NpZ25hdHVyZS5jaGFyQ29kZUF0KDApKTtcclxuXHRjYi5hcHBseSh0aGlzLFtzaWduYXR1cmVdKTtcclxufVxyXG52YXIgcmVhZEkzMj1mdW5jdGlvbihwb3MsY2IpIHtcclxuXHRpZiAodmVyYm9zZSkgIGtzYW5hZ2FwLmxvZyhcInJlYWQgaTMyIGF0IFwiK3Bvcyk7XHJcblx0dmFyIGkzMj1rZnMucmVhZEludDMyKHRoaXMuaGFuZGxlLHBvcyk7XHJcblx0aWYgKHZlcmJvc2UpICBrc2FuYWdhcC5sb2coaTMyKTtcclxuXHRjYi5hcHBseSh0aGlzLFtpMzJdKTtcdFxyXG59XHJcbnZhciByZWFkVUkzMj1mdW5jdGlvbihwb3MsY2IpIHtcclxuXHRpZiAodmVyYm9zZSkgIGtzYW5hZ2FwLmxvZyhcInJlYWQgdWkzMiBhdCBcIitwb3MpO1xyXG5cdHZhciB1aTMyPWtmcy5yZWFkVUludDMyKHRoaXMuaGFuZGxlLHBvcyk7XHJcblx0aWYgKHZlcmJvc2UpICBrc2FuYWdhcC5sb2codWkzMik7XHJcblx0Y2IuYXBwbHkodGhpcyxbdWkzMl0pO1xyXG59XHJcbnZhciByZWFkVUk4PWZ1bmN0aW9uKHBvcyxjYikge1xyXG5cdGlmICh2ZXJib3NlKSAga3NhbmFnYXAubG9nKFwicmVhZCB1aTggYXQgXCIrcG9zKTsgXHJcblx0dmFyIHVpOD1rZnMucmVhZFVJbnQ4KHRoaXMuaGFuZGxlLHBvcyk7XHJcblx0aWYgKHZlcmJvc2UpICBrc2FuYWdhcC5sb2codWk4KTtcclxuXHRjYi5hcHBseSh0aGlzLFt1aThdKTtcclxufVxyXG52YXIgcmVhZEJ1Zj1mdW5jdGlvbihwb3MsYmxvY2tzaXplLGNiKSB7XHJcblx0aWYgKHZlcmJvc2UpICBrc2FuYWdhcC5sb2coXCJyZWFkIGJ1ZmZlciBhdCBcIitwb3MpO1xyXG5cdHZhciBidWY9a2ZzLnJlYWRCdWYodGhpcy5oYW5kbGUscG9zLGJsb2Nrc2l6ZSk7XHJcblx0aWYgKHZlcmJvc2UpICBrc2FuYWdhcC5sb2coXCJidWZmZXIgbGVuZ3RoXCIrYnVmLmxlbmd0aCk7XHJcblx0Y2IuYXBwbHkodGhpcyxbYnVmXSk7XHRcclxufVxyXG52YXIgcmVhZEJ1Zl9wYWNrZWRpbnQ9ZnVuY3Rpb24ocG9zLGJsb2Nrc2l6ZSxjb3VudCxyZXNldCxjYikge1xyXG5cdGlmICh2ZXJib3NlKSAga3NhbmFnYXAubG9nKFwicmVhZCBwYWNrZWQgaW50IGZhc3QsIGJsb2Nrc2l6ZSBcIitibG9ja3NpemUrXCIgYXQgXCIrcG9zKTt2YXIgdD1uZXcgRGF0ZSgpO1xyXG5cdHZhciBidWY9a2ZzLnJlYWRCdWZfcGFja2VkaW50KHRoaXMuaGFuZGxlLHBvcyxibG9ja3NpemUsY291bnQscmVzZXQpO1xyXG5cdGlmICh2ZXJib3NlKSAga3NhbmFnYXAubG9nKFwicmV0dXJuIGZyb20gcGFja2VkaW50LCB0aW1lXCIgKyAobmV3IERhdGUoKS10KSk7XHJcblx0aWYgKHR5cGVvZiBidWYuZGF0YT09XCJzdHJpbmdcIikge1xyXG5cdFx0YnVmLmRhdGE9ZXZhbChcIltcIitidWYuZGF0YS5zdWJzdHIoMCxidWYuZGF0YS5sZW5ndGgtMSkrXCJdXCIpO1xyXG5cdH1cclxuXHRpZiAodmVyYm9zZSkgIGtzYW5hZ2FwLmxvZyhcInVucGFja2VkIGxlbmd0aFwiK2J1Zi5kYXRhLmxlbmd0aCtcIiB0aW1lXCIgKyAobmV3IERhdGUoKS10KSApO1xyXG5cdGNiLmFwcGx5KHRoaXMsW2J1Zl0pO1xyXG59XHJcblxyXG5cclxudmFyIHJlYWRTdHJpbmc9IGZ1bmN0aW9uKHBvcyxibG9ja3NpemUsZW5jb2RpbmcsY2IpIHtcclxuXHJcblx0aWYgKHZlcmJvc2UpICBrc2FuYWdhcC5sb2coXCJyZWFkc3RyaW5nIGF0IFwiK3BvcytcIiBibG9ja3NpemUgXCIrYmxvY2tzaXplK1wiIFwiK2VuY29kaW5nKTt2YXIgdD1uZXcgRGF0ZSgpO1xyXG5cdGlmIChlbmNvZGluZz09XCJ1Y3MyXCIpIHtcclxuXHRcdHZhciBzdHI9a2ZzLnJlYWRVTEUxNlN0cmluZyh0aGlzLmhhbmRsZSxwb3MsYmxvY2tzaXplKTtcclxuXHR9IGVsc2Uge1xyXG5cdFx0dmFyIHN0cj1rZnMucmVhZFVURjhTdHJpbmcodGhpcy5oYW5kbGUscG9zLGJsb2Nrc2l6ZSk7XHRcclxuXHR9XHJcblx0aWYgKHZlcmJvc2UpICBrc2FuYWdhcC5sb2coc3RyK1wiIHRpbWVcIisobmV3IERhdGUoKS10KSk7XHJcblx0Y2IuYXBwbHkodGhpcyxbc3RyXSk7XHRcclxufVxyXG5cclxudmFyIHJlYWRGaXhlZEFycmF5ID0gZnVuY3Rpb24ocG9zICxjb3VudCwgdW5pdHNpemUsY2IpIHtcclxuXHRpZiAodmVyYm9zZSkgIGtzYW5hZ2FwLmxvZyhcInJlYWQgZml4ZWQgYXJyYXkgYXQgXCIrcG9zKTsgdmFyIHQ9bmV3IERhdGUoKTtcclxuXHR2YXIgYnVmPWtmcy5yZWFkRml4ZWRBcnJheSh0aGlzLmhhbmRsZSxwb3MsY291bnQsdW5pdHNpemUpO1xyXG5cdGlmICh2ZXJib3NlKSAga3NhbmFnYXAubG9nKFwiYXJyYXkgbGVuZ3RoIFwiK2J1Zi5sZW5ndGgrXCIgdGltZVwiKyhuZXcgRGF0ZSgpLXQpKTtcclxuXHRjYi5hcHBseSh0aGlzLFtidWZdKTtcdFxyXG59XHJcbnZhciByZWFkU3RyaW5nQXJyYXkgPSBmdW5jdGlvbihwb3MsYmxvY2tzaXplLGVuY29kaW5nLGNiKSB7XHJcblx0Ly9pZiAodmVyYm9zZSkgIGtzYW5hZ2FwLmxvZyhcInJlYWQgU3RyaW5nIGFycmF5IFwiK2Jsb2Nrc2l6ZSArXCIgXCIrZW5jb2RpbmcpOyBcclxuXHRlbmNvZGluZyA9IGVuY29kaW5nfHxcInV0ZjhcIjtcclxuXHRpZiAodmVyYm9zZSkgIGtzYW5hZ2FwLmxvZyhcInJlYWQgc3RyaW5nIGFycmF5IGF0IFwiK3Bvcyk7dmFyIHQ9bmV3IERhdGUoKTtcclxuXHR2YXIgYnVmPWtmcy5yZWFkU3RyaW5nQXJyYXkodGhpcy5oYW5kbGUscG9zLGJsb2Nrc2l6ZSxlbmNvZGluZyk7XHJcblx0aWYgKHR5cGVvZiBidWY9PVwic3RyaW5nXCIpIGJ1Zj1idWYuc3BsaXQoXCJcXDBcIik7XHJcblx0Ly92YXIgYnVmZj1KU09OLnBhcnNlKGJ1Zik7XHJcblx0Ly92YXIgYnVmZj1idWYuc3BsaXQoXCJcXHVmZmZmXCIpOyAvL2Nhbm5vdCByZXR1cm4gc3RyaW5nIHdpdGggMFxyXG5cdGlmICh2ZXJib3NlKSAga3NhbmFnYXAubG9nKFwic3RyaW5nIGFycmF5IGxlbmd0aFwiK2J1Zi5sZW5ndGgrXCIgdGltZVwiKyhuZXcgRGF0ZSgpLXQpKTtcclxuXHRjYi5hcHBseSh0aGlzLFtidWZdKTtcclxufVxyXG5cclxudmFyIG1lcmdlUG9zdGluZ3M9ZnVuY3Rpb24ocG9zaXRpb25zKSB7XHJcblx0dmFyIGJ1Zj1rZnMubWVyZ2VQb3N0aW5ncyh0aGlzLmhhbmRsZSxwb3NpdGlvbnMpO1xyXG5cdGlmICh0eXBlb2YgYnVmPT1cInN0cmluZ1wiKSB7XHJcblx0XHRidWY9ZXZhbChcIltcIitidWYuc3Vic3RyKDAsYnVmLmxlbmd0aC0xKStcIl1cIik7XHJcblx0fVxyXG5cdHJldHVybiBidWY7XHJcbn1cclxudmFyIGZyZWU9ZnVuY3Rpb24oKSB7XHJcblx0Ly8vL2lmICh2ZXJib3NlKSAga3NhbmFnYXAubG9nKCdjbG9zaW5nICcsaGFuZGxlKTtcclxuXHRrZnMuY2xvc2UodGhpcy5oYW5kbGUpO1xyXG59XHJcbnZhciBPcGVuPWZ1bmN0aW9uKHBhdGgsb3B0cyxjYikge1xyXG5cdG9wdHM9b3B0c3x8e307XHJcblx0dmFyIHNpZ25hdHVyZV9zaXplPTE7XHJcblx0dmFyIHNldHVwYXBpPWZ1bmN0aW9uKCkgeyBcclxuXHRcdHRoaXMucmVhZFNpZ25hdHVyZT1yZWFkU2lnbmF0dXJlO1xyXG5cdFx0dGhpcy5yZWFkSTMyPXJlYWRJMzI7XHJcblx0XHR0aGlzLnJlYWRVSTMyPXJlYWRVSTMyO1xyXG5cdFx0dGhpcy5yZWFkVUk4PXJlYWRVSTg7XHJcblx0XHR0aGlzLnJlYWRCdWY9cmVhZEJ1ZjtcclxuXHRcdHRoaXMucmVhZEJ1Zl9wYWNrZWRpbnQ9cmVhZEJ1Zl9wYWNrZWRpbnQ7XHJcblx0XHR0aGlzLnJlYWRGaXhlZEFycmF5PXJlYWRGaXhlZEFycmF5O1xyXG5cdFx0dGhpcy5yZWFkU3RyaW5nPXJlYWRTdHJpbmc7XHJcblx0XHR0aGlzLnJlYWRTdHJpbmdBcnJheT1yZWFkU3RyaW5nQXJyYXk7XHJcblx0XHR0aGlzLnNpZ25hdHVyZV9zaXplPXNpZ25hdHVyZV9zaXplO1xyXG5cdFx0dGhpcy5tZXJnZVBvc3RpbmdzPW1lcmdlUG9zdGluZ3M7XHJcblx0XHR0aGlzLmZyZWU9ZnJlZTtcclxuXHRcdHRoaXMuc2l6ZT1rZnMuZ2V0RmlsZVNpemUodGhpcy5oYW5kbGUpO1xyXG5cdFx0aWYgKHZlcmJvc2UpICBrc2FuYWdhcC5sb2coXCJmaWxlc2l6ZSAgXCIrdGhpcy5zaXplKTtcclxuXHRcdGlmIChjYilcdGNiLmNhbGwodGhpcyk7XHJcblx0fVxyXG5cclxuXHR0aGlzLmhhbmRsZT1rZnMub3BlbihwYXRoKTtcclxuXHR0aGlzLm9wZW5lZD10cnVlO1xyXG5cdHNldHVwYXBpLmNhbGwodGhpcyk7XHJcblx0cmV0dXJuIHRoaXM7XHJcbn1cclxuXHJcbm1vZHVsZS5leHBvcnRzPU9wZW47IiwiLypcclxuICBjb252ZXJ0IGFueSBqc29uIGludG8gYSBiaW5hcnkgYnVmZmVyXHJcbiAgdGhlIGJ1ZmZlciBjYW4gYmUgc2F2ZWQgd2l0aCBhIHNpbmdsZSBsaW5lIG9mIGZzLndyaXRlRmlsZVxyXG4qL1xyXG5cclxudmFyIERUPXtcclxuXHR1aW50ODonMScsIC8vdW5zaWduZWQgMSBieXRlIGludGVnZXJcclxuXHRpbnQzMjonNCcsIC8vIHNpZ25lZCA0IGJ5dGVzIGludGVnZXJcclxuXHR1dGY4Oic4JywgIFxyXG5cdHVjczI6JzInLFxyXG5cdGJvb2w6J14nLCBcclxuXHRibG9iOicmJyxcclxuXHR1dGY4YXJyOicqJywgLy9zaGlmdCBvZiA4XHJcblx0dWNzMmFycjonQCcsIC8vc2hpZnQgb2YgMlxyXG5cdHVpbnQ4YXJyOichJywgLy9zaGlmdCBvZiAxXHJcblx0aW50MzJhcnI6JyQnLCAvL3NoaWZ0IG9mIDRcclxuXHR2aW50OidgJyxcclxuXHRwaW50Oid+JyxcdFxyXG5cclxuXHRhcnJheTonXFx1MDAxYicsXHJcblx0b2JqZWN0OidcXHUwMDFhJyBcclxuXHQvL3lkYiBzdGFydCB3aXRoIG9iamVjdCBzaWduYXR1cmUsXHJcblx0Ly90eXBlIGEgeWRiIGluIGNvbW1hbmQgcHJvbXB0IHNob3dzIG5vdGhpbmdcclxufVxyXG52YXIga2V5X3dyaXRpbmc9XCJcIjsvL2ZvciBkZWJ1Z2dpbmdcclxudmFyIHBhY2tfaW50ID0gZnVuY3Rpb24gKGFyLCBzYXZlZGVsdGEpIHsgLy8gcGFjayBhciBpbnRvXHJcbiAgaWYgKCFhciB8fCBhci5sZW5ndGggPT09IDApIHJldHVybiBbXTsgLy8gZW1wdHkgYXJyYXlcclxuICB2YXIgciA9IFtdLFxyXG4gIGkgPSAwLFxyXG4gIGogPSAwLFxyXG4gIGRlbHRhID0gMCxcclxuICBwcmV2ID0gMDtcclxuICBcclxuICBkbyB7XHJcblx0ZGVsdGEgPSBhcltpXTtcclxuXHRpZiAoc2F2ZWRlbHRhKSB7XHJcblx0XHRkZWx0YSAtPSBwcmV2O1xyXG5cdH1cclxuXHRpZiAoZGVsdGEgPCAwKSB7XHJcblx0ICBjb25zb2xlLnRyYWNlKCduZWdhdGl2ZScscHJldixhcltpXSlcclxuXHQgIHRocm93ICduZWdldGl2ZSc7XHJcblx0ICBicmVhaztcclxuXHR9XHJcblx0XHJcblx0cltqKytdID0gZGVsdGEgJiAweDdmO1xyXG5cdGRlbHRhID4+PSA3O1xyXG5cdHdoaWxlIChkZWx0YSA+IDApIHtcclxuXHQgIHJbaisrXSA9IChkZWx0YSAmIDB4N2YpIHwgMHg4MDtcclxuXHQgIGRlbHRhID4+PSA3O1xyXG5cdH1cclxuXHRwcmV2ID0gYXJbaV07XHJcblx0aSsrO1xyXG4gIH0gd2hpbGUgKGkgPCBhci5sZW5ndGgpO1xyXG4gIHJldHVybiByO1xyXG59XHJcbnZhciBLZnM9ZnVuY3Rpb24ocGF0aCxvcHRzKSB7XHJcblx0XHJcblx0dmFyIGhhbmRsZT1udWxsO1xyXG5cdG9wdHM9b3B0c3x8e307XHJcblx0b3B0cy5zaXplPW9wdHMuc2l6ZXx8NjU1MzYqMjA0ODsgXHJcblx0Y29uc29sZS5sb2coJ2tkYiBlc3RpbWF0ZSBzaXplOicsb3B0cy5zaXplKTtcclxuXHR2YXIgZGJ1Zj1uZXcgQnVmZmVyKG9wdHMuc2l6ZSk7XHJcblx0dmFyIGN1cj0wOy8vZGJ1ZiBjdXJzb3JcclxuXHRcclxuXHR2YXIgd3JpdGVTaWduYXR1cmU9ZnVuY3Rpb24odmFsdWUscG9zKSB7XHJcblx0XHRkYnVmLndyaXRlKHZhbHVlLHBvcyx2YWx1ZS5sZW5ndGgsJ3V0ZjgnKTtcclxuXHRcdGlmIChwb3MrdmFsdWUubGVuZ3RoPmN1cikgY3VyPXBvcyt2YWx1ZS5sZW5ndGg7XHJcblx0XHRyZXR1cm4gdmFsdWUubGVuZ3RoO1xyXG5cdH1cclxuXHR2YXIgd3JpdGVPZmZzZXQ9ZnVuY3Rpb24odmFsdWUscG9zKSB7XHJcblx0XHRkYnVmLndyaXRlVUludDgoTWF0aC5mbG9vcih2YWx1ZSAvICg2NTUzNio2NTUzNikpLHBvcyk7XHJcblx0XHRkYnVmLndyaXRlVUludDMyQkUoIHZhbHVlICYgMHhGRkZGRkZGRixwb3MrMSk7XHJcblx0XHRpZiAocG9zKzU+Y3VyKSBjdXI9cG9zKzU7XHJcblx0XHRyZXR1cm4gNTtcclxuXHR9XHJcblx0dmFyIHdyaXRlU3RyaW5nPSBmdW5jdGlvbih2YWx1ZSxwb3MsZW5jb2RpbmcpIHtcclxuXHRcdGVuY29kaW5nPWVuY29kaW5nfHwndWNzMic7XHJcblx0XHRpZiAodmFsdWU9PVwiXCIpIHRocm93IFwiY2Fubm90IHdyaXRlIG51bGwgc3RyaW5nXCI7XHJcblx0XHRpZiAoZW5jb2Rpbmc9PT0ndXRmOCcpZGJ1Zi53cml0ZShEVC51dGY4LHBvcywxLCd1dGY4Jyk7XHJcblx0XHRlbHNlIGlmIChlbmNvZGluZz09PSd1Y3MyJylkYnVmLndyaXRlKERULnVjczIscG9zLDEsJ3V0ZjgnKTtcclxuXHRcdGVsc2UgdGhyb3cgJ3Vuc3VwcG9ydGVkIGVuY29kaW5nICcrZW5jb2Rpbmc7XHJcblx0XHRcdFxyXG5cdFx0dmFyIGxlbj1CdWZmZXIuYnl0ZUxlbmd0aCh2YWx1ZSwgZW5jb2RpbmcpO1xyXG5cdFx0ZGJ1Zi53cml0ZSh2YWx1ZSxwb3MrMSxsZW4sZW5jb2RpbmcpO1xyXG5cdFx0XHJcblx0XHRpZiAocG9zK2xlbisxPmN1cikgY3VyPXBvcytsZW4rMTtcclxuXHRcdHJldHVybiBsZW4rMTsgLy8gc2lnbmF0dXJlXHJcblx0fVxyXG5cdHZhciB3cml0ZVN0cmluZ0FycmF5ID0gZnVuY3Rpb24odmFsdWUscG9zLGVuY29kaW5nKSB7XHJcblx0XHRlbmNvZGluZz1lbmNvZGluZ3x8J3VjczInO1xyXG5cdFx0aWYgKGVuY29kaW5nPT09J3V0ZjgnKSBkYnVmLndyaXRlKERULnV0ZjhhcnIscG9zLDEsJ3V0ZjgnKTtcclxuXHRcdGVsc2UgaWYgKGVuY29kaW5nPT09J3VjczInKWRidWYud3JpdGUoRFQudWNzMmFycixwb3MsMSwndXRmOCcpO1xyXG5cdFx0ZWxzZSB0aHJvdyAndW5zdXBwb3J0ZWQgZW5jb2RpbmcgJytlbmNvZGluZztcclxuXHRcdFxyXG5cdFx0dmFyIHY9dmFsdWUuam9pbignXFwwJyk7XHJcblx0XHR2YXIgbGVuPUJ1ZmZlci5ieXRlTGVuZ3RoKHYsIGVuY29kaW5nKTtcclxuXHRcdGlmICgwPT09bGVuKSB7XHJcblx0XHRcdHRocm93IFwiZW1wdHkgc3RyaW5nIGFycmF5IFwiICsga2V5X3dyaXRpbmc7XHJcblx0XHR9XHJcblx0XHRkYnVmLndyaXRlKHYscG9zKzEsbGVuLGVuY29kaW5nKTtcclxuXHRcdGlmIChwb3MrbGVuKzE+Y3VyKSBjdXI9cG9zK2xlbisxO1xyXG5cdFx0cmV0dXJuIGxlbisxO1xyXG5cdH1cclxuXHR2YXIgd3JpdGVJMzI9ZnVuY3Rpb24odmFsdWUscG9zKSB7XHJcblx0XHRkYnVmLndyaXRlKERULmludDMyLHBvcywxLCd1dGY4Jyk7XHJcblx0XHRkYnVmLndyaXRlSW50MzJCRSh2YWx1ZSxwb3MrMSk7XHJcblx0XHRpZiAocG9zKzU+Y3VyKSBjdXI9cG9zKzU7XHJcblx0XHRyZXR1cm4gNTtcclxuXHR9XHJcblx0dmFyIHdyaXRlVUk4PWZ1bmN0aW9uKHZhbHVlLHBvcykge1xyXG5cdFx0ZGJ1Zi53cml0ZShEVC51aW50OCxwb3MsMSwndXRmOCcpO1xyXG5cdFx0ZGJ1Zi53cml0ZVVJbnQ4KHZhbHVlLHBvcysxKTtcclxuXHRcdGlmIChwb3MrMj5jdXIpIGN1cj1wb3MrMjtcclxuXHRcdHJldHVybiAyO1xyXG5cdH1cclxuXHR2YXIgd3JpdGVCb29sPWZ1bmN0aW9uKHZhbHVlLHBvcykge1xyXG5cdFx0ZGJ1Zi53cml0ZShEVC5ib29sLHBvcywxLCd1dGY4Jyk7XHJcblx0XHRkYnVmLndyaXRlVUludDgoTnVtYmVyKHZhbHVlKSxwb3MrMSk7XHJcblx0XHRpZiAocG9zKzI+Y3VyKSBjdXI9cG9zKzI7XHJcblx0XHRyZXR1cm4gMjtcclxuXHR9XHRcdFxyXG5cdHZhciB3cml0ZUJsb2I9ZnVuY3Rpb24odmFsdWUscG9zKSB7XHJcblx0XHRkYnVmLndyaXRlKERULmJsb2IscG9zLDEsJ3V0ZjgnKTtcclxuXHRcdHZhbHVlLmNvcHkoZGJ1ZiwgcG9zKzEpO1xyXG5cdFx0dmFyIHdyaXR0ZW49dmFsdWUubGVuZ3RoKzE7XHJcblx0XHRpZiAocG9zK3dyaXR0ZW4+Y3VyKSBjdXI9cG9zK3dyaXR0ZW47XHJcblx0XHRyZXR1cm4gd3JpdHRlbjtcclxuXHR9XHRcdFxyXG5cdC8qIG5vIHNpZ25hdHVyZSAqL1xyXG5cdHZhciB3cml0ZUZpeGVkQXJyYXkgPSBmdW5jdGlvbih2YWx1ZSxwb3MsdW5pdHNpemUpIHtcclxuXHRcdC8vY29uc29sZS5sb2coJ3YubGVuJyx2YWx1ZS5sZW5ndGgsaXRlbXMubGVuZ3RoLHVuaXRzaXplKTtcclxuXHRcdGlmICh1bml0c2l6ZT09PTEpIHZhciBmdW5jPWRidWYud3JpdGVVSW50ODtcclxuXHRcdGVsc2UgaWYgKHVuaXRzaXplPT09NCl2YXIgZnVuYz1kYnVmLndyaXRlSW50MzJCRTtcclxuXHRcdGVsc2UgdGhyb3cgJ3Vuc3VwcG9ydGVkIGludGVnZXIgc2l6ZSc7XHJcblx0XHRpZiAoIXZhbHVlLmxlbmd0aCkge1xyXG5cdFx0XHR0aHJvdyBcImVtcHR5IGZpeGVkIGFycmF5IFwiK2tleV93cml0aW5nO1xyXG5cdFx0fVxyXG5cdFx0Zm9yICh2YXIgaSA9IDA7IGkgPCB2YWx1ZS5sZW5ndGggOyBpKyspIHtcclxuXHRcdFx0ZnVuYy5hcHBseShkYnVmLFt2YWx1ZVtpXSxpKnVuaXRzaXplK3Bvc10pXHJcblx0XHR9XHJcblx0XHR2YXIgbGVuPXVuaXRzaXplKnZhbHVlLmxlbmd0aDtcclxuXHRcdGlmIChwb3MrbGVuPmN1cikgY3VyPXBvcytsZW47XHJcblx0XHRyZXR1cm4gbGVuO1xyXG5cdH1cclxuXHJcblx0dGhpcy53cml0ZUkzMj13cml0ZUkzMjtcclxuXHR0aGlzLndyaXRlQm9vbD13cml0ZUJvb2w7XHJcblx0dGhpcy53cml0ZUJsb2I9d3JpdGVCbG9iO1xyXG5cdHRoaXMud3JpdGVVSTg9d3JpdGVVSTg7XHJcblx0dGhpcy53cml0ZVN0cmluZz13cml0ZVN0cmluZztcclxuXHR0aGlzLndyaXRlU2lnbmF0dXJlPXdyaXRlU2lnbmF0dXJlO1xyXG5cdHRoaXMud3JpdGVPZmZzZXQ9d3JpdGVPZmZzZXQ7IC8vNSBieXRlcyBvZmZzZXRcclxuXHR0aGlzLndyaXRlU3RyaW5nQXJyYXk9d3JpdGVTdHJpbmdBcnJheTtcclxuXHR0aGlzLndyaXRlRml4ZWRBcnJheT13cml0ZUZpeGVkQXJyYXk7XHJcblx0T2JqZWN0LmRlZmluZVByb3BlcnR5KHRoaXMsIFwiYnVmXCIsIHtnZXQgOiBmdW5jdGlvbigpeyByZXR1cm4gZGJ1ZjsgfX0pO1xyXG5cdFxyXG5cdHJldHVybiB0aGlzO1xyXG59XHJcblxyXG52YXIgQ3JlYXRlPWZ1bmN0aW9uKHBhdGgsb3B0cykge1xyXG5cdG9wdHM9b3B0c3x8e307XHJcblx0dmFyIGtmcz1uZXcgS2ZzKHBhdGgsb3B0cyk7XHJcblx0dmFyIGN1cj0wO1xyXG5cclxuXHR2YXIgaGFuZGxlPXt9O1xyXG5cdFxyXG5cdC8vbm8gc2lnbmF0dXJlXHJcblx0dmFyIHdyaXRlVkludCA9ZnVuY3Rpb24oYXJyKSB7XHJcblx0XHR2YXIgbz1wYWNrX2ludChhcnIsZmFsc2UpO1xyXG5cdFx0a2ZzLndyaXRlRml4ZWRBcnJheShvLGN1ciwxKTtcclxuXHRcdGN1cis9by5sZW5ndGg7XHJcblx0fVxyXG5cdHZhciB3cml0ZVZJbnQxPWZ1bmN0aW9uKHZhbHVlKSB7XHJcblx0XHR3cml0ZVZJbnQoW3ZhbHVlXSk7XHJcblx0fVxyXG5cdC8vZm9yIHBvc3RpbmdzXHJcblx0dmFyIHdyaXRlUEludCA9ZnVuY3Rpb24oYXJyKSB7XHJcblx0XHR2YXIgbz1wYWNrX2ludChhcnIsdHJ1ZSk7XHJcblx0XHRrZnMud3JpdGVGaXhlZEFycmF5KG8sY3VyLDEpO1xyXG5cdFx0Y3VyKz1vLmxlbmd0aDtcclxuXHR9XHJcblx0XHJcblx0dmFyIHNhdmVWSW50ID0gZnVuY3Rpb24oYXJyLGtleSkge1xyXG5cdFx0dmFyIHN0YXJ0PWN1cjtcclxuXHRcdGtleV93cml0aW5nPWtleTtcclxuXHRcdGN1cis9a2ZzLndyaXRlU2lnbmF0dXJlKERULnZpbnQsY3VyKTtcclxuXHRcdHdyaXRlVkludChhcnIpO1xyXG5cdFx0dmFyIHdyaXR0ZW4gPSBjdXItc3RhcnQ7XHJcblx0XHRwdXNoaXRlbShrZXksd3JpdHRlbik7XHJcblx0XHRyZXR1cm4gd3JpdHRlbjtcdFx0XHJcblx0fVxyXG5cdHZhciBzYXZlUEludCA9IGZ1bmN0aW9uKGFycixrZXkpIHtcclxuXHRcdHZhciBzdGFydD1jdXI7XHJcblx0XHRrZXlfd3JpdGluZz1rZXk7XHJcblx0XHRjdXIrPWtmcy53cml0ZVNpZ25hdHVyZShEVC5waW50LGN1cik7XHJcblx0XHR3cml0ZVBJbnQoYXJyKTtcclxuXHRcdHZhciB3cml0dGVuID0gY3VyLXN0YXJ0O1xyXG5cdFx0cHVzaGl0ZW0oa2V5LHdyaXR0ZW4pO1xyXG5cdFx0cmV0dXJuIHdyaXR0ZW47XHRcclxuXHR9XHJcblxyXG5cdFxyXG5cdHZhciBzYXZlVUk4ID0gZnVuY3Rpb24odmFsdWUsa2V5KSB7XHJcblx0XHR2YXIgd3JpdHRlbj1rZnMud3JpdGVVSTgodmFsdWUsY3VyKTtcclxuXHRcdGN1cis9d3JpdHRlbjtcclxuXHRcdHB1c2hpdGVtKGtleSx3cml0dGVuKTtcclxuXHRcdHJldHVybiB3cml0dGVuO1xyXG5cdH1cclxuXHR2YXIgc2F2ZUJvb2w9ZnVuY3Rpb24odmFsdWUsa2V5KSB7XHJcblx0XHR2YXIgd3JpdHRlbj1rZnMud3JpdGVCb29sKHZhbHVlLGN1cik7XHJcblx0XHRjdXIrPXdyaXR0ZW47XHJcblx0XHRwdXNoaXRlbShrZXksd3JpdHRlbik7XHJcblx0XHRyZXR1cm4gd3JpdHRlbjtcclxuXHR9XHJcblx0dmFyIHNhdmVJMzIgPSBmdW5jdGlvbih2YWx1ZSxrZXkpIHtcclxuXHRcdHZhciB3cml0dGVuPWtmcy53cml0ZUkzMih2YWx1ZSxjdXIpO1xyXG5cdFx0Y3VyKz13cml0dGVuO1xyXG5cdFx0cHVzaGl0ZW0oa2V5LHdyaXR0ZW4pO1xyXG5cdFx0cmV0dXJuIHdyaXR0ZW47XHJcblx0fVx0XHJcblx0dmFyIHNhdmVTdHJpbmcgPSBmdW5jdGlvbih2YWx1ZSxrZXksZW5jb2RpbmcpIHtcclxuXHRcdGVuY29kaW5nPWVuY29kaW5nfHxzdHJpbmdlbmNvZGluZztcclxuXHRcdGtleV93cml0aW5nPWtleTtcclxuXHRcdHZhciB3cml0dGVuPWtmcy53cml0ZVN0cmluZyh2YWx1ZSxjdXIsZW5jb2RpbmcpO1xyXG5cdFx0Y3VyKz13cml0dGVuO1xyXG5cdFx0cHVzaGl0ZW0oa2V5LHdyaXR0ZW4pO1xyXG5cdFx0cmV0dXJuIHdyaXR0ZW47XHJcblx0fVxyXG5cdHZhciBzYXZlU3RyaW5nQXJyYXkgPSBmdW5jdGlvbihhcnIsa2V5LGVuY29kaW5nKSB7XHJcblx0XHRlbmNvZGluZz1lbmNvZGluZ3x8c3RyaW5nZW5jb2Rpbmc7XHJcblx0XHRrZXlfd3JpdGluZz1rZXk7XHJcblx0XHR0cnkge1xyXG5cdFx0XHR2YXIgd3JpdHRlbj1rZnMud3JpdGVTdHJpbmdBcnJheShhcnIsY3VyLGVuY29kaW5nKTtcclxuXHRcdH0gY2F0Y2goZSkge1xyXG5cdFx0XHR0aHJvdyBlO1xyXG5cdFx0fVxyXG5cdFx0Y3VyKz13cml0dGVuO1xyXG5cdFx0cHVzaGl0ZW0oa2V5LHdyaXR0ZW4pO1xyXG5cdFx0cmV0dXJuIHdyaXR0ZW47XHJcblx0fVxyXG5cdFxyXG5cdHZhciBzYXZlQmxvYiA9IGZ1bmN0aW9uKHZhbHVlLGtleSkge1xyXG5cdFx0a2V5X3dyaXRpbmc9a2V5O1xyXG5cdFx0dmFyIHdyaXR0ZW49a2ZzLndyaXRlQmxvYih2YWx1ZSxjdXIpO1xyXG5cdFx0Y3VyKz13cml0dGVuO1xyXG5cdFx0cHVzaGl0ZW0oa2V5LHdyaXR0ZW4pO1xyXG5cdFx0cmV0dXJuIHdyaXR0ZW47XHJcblx0fVxyXG5cclxuXHR2YXIgZm9sZGVycz1bXTtcclxuXHR2YXIgcHVzaGl0ZW09ZnVuY3Rpb24oa2V5LHdyaXR0ZW4pIHtcclxuXHRcdHZhciBmb2xkZXI9Zm9sZGVyc1tmb2xkZXJzLmxlbmd0aC0xXTtcdFxyXG5cdFx0aWYgKCFmb2xkZXIpIHJldHVybiA7XHJcblx0XHRmb2xkZXIuaXRlbXNsZW5ndGgucHVzaCh3cml0dGVuKTtcclxuXHRcdGlmIChrZXkpIHtcclxuXHRcdFx0aWYgKCFmb2xkZXIua2V5cykgdGhyb3cgJ2Nhbm5vdCBoYXZlIGtleSBpbiBhcnJheSc7XHJcblx0XHRcdGZvbGRlci5rZXlzLnB1c2goa2V5KTtcclxuXHRcdH1cclxuXHR9XHRcclxuXHR2YXIgb3BlbiA9IGZ1bmN0aW9uKG9wdCkge1xyXG5cdFx0dmFyIHN0YXJ0PWN1cjtcclxuXHRcdHZhciBrZXk9b3B0LmtleSB8fCBudWxsO1xyXG5cdFx0dmFyIHR5cGU9b3B0LnR5cGV8fERULmFycmF5O1xyXG5cdFx0Y3VyKz1rZnMud3JpdGVTaWduYXR1cmUodHlwZSxjdXIpO1xyXG5cdFx0Y3VyKz1rZnMud3JpdGVPZmZzZXQoMHgwLGN1cik7IC8vIHByZS1hbGxvYyBzcGFjZSBmb3Igb2Zmc2V0XHJcblx0XHR2YXIgZm9sZGVyPXtcclxuXHRcdFx0dHlwZTp0eXBlLCBrZXk6a2V5LFxyXG5cdFx0XHRzdGFydDpzdGFydCxkYXRhc3RhcnQ6Y3VyLFxyXG5cdFx0XHRpdGVtc2xlbmd0aDpbXSB9O1xyXG5cdFx0aWYgKHR5cGU9PT1EVC5vYmplY3QpIGZvbGRlci5rZXlzPVtdO1xyXG5cdFx0Zm9sZGVycy5wdXNoKGZvbGRlcik7XHJcblx0fVxyXG5cdHZhciBvcGVuT2JqZWN0ID0gZnVuY3Rpb24oa2V5KSB7XHJcblx0XHRvcGVuKHt0eXBlOkRULm9iamVjdCxrZXk6a2V5fSk7XHJcblx0fVxyXG5cdHZhciBvcGVuQXJyYXkgPSBmdW5jdGlvbihrZXkpIHtcclxuXHRcdG9wZW4oe3R5cGU6RFQuYXJyYXksa2V5OmtleX0pO1xyXG5cdH1cclxuXHR2YXIgc2F2ZUludHM9ZnVuY3Rpb24oYXJyLGtleSxmdW5jKSB7XHJcblx0XHRmdW5jLmFwcGx5KGhhbmRsZSxbYXJyLGtleV0pO1xyXG5cdH1cclxuXHR2YXIgY2xvc2UgPSBmdW5jdGlvbihvcHQpIHtcclxuXHRcdGlmICghZm9sZGVycy5sZW5ndGgpIHRocm93ICdlbXB0eSBzdGFjayc7XHJcblx0XHR2YXIgZm9sZGVyPWZvbGRlcnMucG9wKCk7XHJcblx0XHQvL2p1bXAgdG8gbGVuZ3RocyBhbmQga2V5c1xyXG5cdFx0a2ZzLndyaXRlT2Zmc2V0KCBjdXItZm9sZGVyLmRhdGFzdGFydCwgZm9sZGVyLmRhdGFzdGFydC01KTtcclxuXHRcdHZhciBpdGVtY291bnQ9Zm9sZGVyLml0ZW1zbGVuZ3RoLmxlbmd0aDtcclxuXHRcdC8vc2F2ZSBsZW5ndGhzXHJcblx0XHR3cml0ZVZJbnQxKGl0ZW1jb3VudCk7XHJcblx0XHR3cml0ZVZJbnQoZm9sZGVyLml0ZW1zbGVuZ3RoKTtcclxuXHRcdFxyXG5cdFx0aWYgKGZvbGRlci50eXBlPT09RFQub2JqZWN0KSB7XHJcblx0XHRcdC8vdXNlIHV0ZjggZm9yIGtleXNcclxuXHRcdFx0Y3VyKz1rZnMud3JpdGVTdHJpbmdBcnJheShmb2xkZXIua2V5cyxjdXIsJ3V0ZjgnKTtcclxuXHRcdH1cclxuXHRcdHdyaXR0ZW49Y3VyLWZvbGRlci5zdGFydDtcclxuXHRcdHB1c2hpdGVtKGZvbGRlci5rZXksd3JpdHRlbik7XHJcblx0XHRyZXR1cm4gd3JpdHRlbjtcclxuXHR9XHJcblx0XHJcblx0XHJcblx0dmFyIHN0cmluZ2VuY29kaW5nPSd1Y3MyJztcclxuXHR2YXIgc3RyaW5nRW5jb2Rpbmc9ZnVuY3Rpb24obmV3ZW5jb2RpbmcpIHtcclxuXHRcdGlmIChuZXdlbmNvZGluZykgc3RyaW5nZW5jb2Rpbmc9bmV3ZW5jb2Rpbmc7XHJcblx0XHRlbHNlIHJldHVybiBzdHJpbmdlbmNvZGluZztcclxuXHR9XHJcblx0XHJcblx0dmFyIGFsbG51bWJlcl9mYXN0PWZ1bmN0aW9uKGFycikge1xyXG5cdFx0aWYgKGFyci5sZW5ndGg8NSkgcmV0dXJuIGFsbG51bWJlcihhcnIpO1xyXG5cdFx0aWYgKHR5cGVvZiBhcnJbMF09PSdudW1iZXInXHJcblx0XHQgICAgJiYgTWF0aC5yb3VuZChhcnJbMF0pPT1hcnJbMF0gJiYgYXJyWzBdPj0wKVxyXG5cdFx0XHRyZXR1cm4gdHJ1ZTtcclxuXHRcdHJldHVybiBmYWxzZTtcclxuXHR9XHJcblx0dmFyIGFsbHN0cmluZ19mYXN0PWZ1bmN0aW9uKGFycikge1xyXG5cdFx0aWYgKGFyci5sZW5ndGg8NSkgcmV0dXJuIGFsbHN0cmluZyhhcnIpO1xyXG5cdFx0aWYgKHR5cGVvZiBhcnJbMF09PSdzdHJpbmcnKSByZXR1cm4gdHJ1ZTtcclxuXHRcdHJldHVybiBmYWxzZTtcclxuXHR9XHRcclxuXHR2YXIgYWxsbnVtYmVyPWZ1bmN0aW9uKGFycikge1xyXG5cdFx0Zm9yICh2YXIgaT0wO2k8YXJyLmxlbmd0aDtpKyspIHtcclxuXHRcdFx0aWYgKHR5cGVvZiBhcnJbaV0hPT0nbnVtYmVyJykgcmV0dXJuIGZhbHNlO1xyXG5cdFx0fVxyXG5cdFx0cmV0dXJuIHRydWU7XHJcblx0fVxyXG5cdHZhciBhbGxzdHJpbmc9ZnVuY3Rpb24oYXJyKSB7XHJcblx0XHRmb3IgKHZhciBpPTA7aTxhcnIubGVuZ3RoO2krKykge1xyXG5cdFx0XHRpZiAodHlwZW9mIGFycltpXSE9PSdzdHJpbmcnKSByZXR1cm4gZmFsc2U7XHJcblx0XHR9XHJcblx0XHRyZXR1cm4gdHJ1ZTtcclxuXHR9XHJcblx0dmFyIGdldEVuY29kaW5nPWZ1bmN0aW9uKGtleSxlbmNzKSB7XHJcblx0XHR2YXIgZW5jPWVuY3Nba2V5XTtcclxuXHRcdGlmICghZW5jKSByZXR1cm4gbnVsbDtcclxuXHRcdGlmIChlbmM9PSdkZWx0YScgfHwgZW5jPT0ncG9zdGluZycpIHtcclxuXHRcdFx0cmV0dXJuIHNhdmVQSW50O1xyXG5cdFx0fSBlbHNlIGlmIChlbmM9PVwidmFyaWFibGVcIikge1xyXG5cdFx0XHRyZXR1cm4gc2F2ZVZJbnQ7XHJcblx0XHR9XHJcblx0XHRyZXR1cm4gbnVsbDtcclxuXHR9XHJcblx0dmFyIHNhdmU9ZnVuY3Rpb24oSixrZXksb3B0cykge1xyXG5cdFx0b3B0cz1vcHRzfHx7fTtcclxuXHRcdFxyXG5cdFx0aWYgKHR5cGVvZiBKPT1cIm51bGxcIiB8fCB0eXBlb2YgSj09XCJ1bmRlZmluZWRcIikge1xyXG5cdFx0XHR0aHJvdyAnY2Fubm90IHNhdmUgbnVsbCB2YWx1ZSBvZiBbJytrZXkrJ10gZm9sZGVycycrSlNPTi5zdHJpbmdpZnkoZm9sZGVycyk7XHJcblx0XHRcdHJldHVybjtcclxuXHRcdH1cclxuXHRcdHZhciB0eXBlPUouY29uc3RydWN0b3IubmFtZTtcclxuXHRcdGlmICh0eXBlPT09J09iamVjdCcpIHtcclxuXHRcdFx0b3Blbk9iamVjdChrZXkpO1xyXG5cdFx0XHRmb3IgKHZhciBpIGluIEopIHtcclxuXHRcdFx0XHRzYXZlKEpbaV0saSxvcHRzKTtcclxuXHRcdFx0XHRpZiAob3B0cy5hdXRvZGVsZXRlKSBkZWxldGUgSltpXTtcclxuXHRcdFx0fVxyXG5cdFx0XHRjbG9zZSgpO1xyXG5cdFx0fSBlbHNlIGlmICh0eXBlPT09J0FycmF5Jykge1xyXG5cdFx0XHRpZiAoYWxsbnVtYmVyX2Zhc3QoSikpIHtcclxuXHRcdFx0XHRpZiAoSi5zb3J0ZWQpIHsgLy9udW1iZXIgYXJyYXkgaXMgc29ydGVkXHJcblx0XHRcdFx0XHRzYXZlSW50cyhKLGtleSxzYXZlUEludCk7XHQvL3Bvc3RpbmcgZGVsdGEgZm9ybWF0XHJcblx0XHRcdFx0fSBlbHNlIHtcclxuXHRcdFx0XHRcdHNhdmVJbnRzKEosa2V5LHNhdmVWSW50KTtcdFxyXG5cdFx0XHRcdH1cclxuXHRcdFx0fSBlbHNlIGlmIChhbGxzdHJpbmdfZmFzdChKKSkge1xyXG5cdFx0XHRcdHNhdmVTdHJpbmdBcnJheShKLGtleSk7XHJcblx0XHRcdH0gZWxzZSB7XHJcblx0XHRcdFx0b3BlbkFycmF5KGtleSk7XHJcblx0XHRcdFx0Zm9yICh2YXIgaT0wO2k8Si5sZW5ndGg7aSsrKSB7XHJcblx0XHRcdFx0XHRzYXZlKEpbaV0sbnVsbCxvcHRzKTtcclxuXHRcdFx0XHRcdGlmIChvcHRzLmF1dG9kZWxldGUpIGRlbGV0ZSBKW2ldO1xyXG5cdFx0XHRcdH1cclxuXHRcdFx0XHRjbG9zZSgpO1xyXG5cdFx0XHR9XHJcblx0XHR9IGVsc2UgaWYgKHR5cGU9PT0nU3RyaW5nJykge1xyXG5cdFx0XHRzYXZlU3RyaW5nKEosa2V5KTtcclxuXHRcdH0gZWxzZSBpZiAodHlwZT09PSdOdW1iZXInKSB7XHJcblx0XHRcdGlmIChKPj0wJiZKPDI1Nikgc2F2ZVVJOChKLGtleSk7XHJcblx0XHRcdGVsc2Ugc2F2ZUkzMihKLGtleSk7XHJcblx0XHR9IGVsc2UgaWYgKHR5cGU9PT0nQm9vbGVhbicpIHtcclxuXHRcdFx0c2F2ZUJvb2woSixrZXkpO1xyXG5cdFx0fSBlbHNlIGlmICh0eXBlPT09J0J1ZmZlcicpIHtcclxuXHRcdFx0c2F2ZUJsb2IoSixrZXkpO1xyXG5cdFx0fSBlbHNlIHtcclxuXHRcdFx0dGhyb3cgJ3Vuc3VwcG9ydGVkIHR5cGUgJyt0eXBlO1xyXG5cdFx0fVxyXG5cdH1cclxuXHRcclxuXHR2YXIgZnJlZT1mdW5jdGlvbigpIHtcclxuXHRcdHdoaWxlIChmb2xkZXJzLmxlbmd0aCkgY2xvc2UoKTtcclxuXHRcdGtmcy5mcmVlKCk7XHJcblx0fVxyXG5cdHZhciBjdXJyZW50c2l6ZT1mdW5jdGlvbigpIHtcclxuXHRcdHJldHVybiBjdXI7XHJcblx0fVxyXG5cclxuXHRPYmplY3QuZGVmaW5lUHJvcGVydHkoaGFuZGxlLCBcInNpemVcIiwge2dldCA6IGZ1bmN0aW9uKCl7IHJldHVybiBjdXI7IH19KTtcclxuXHJcblx0dmFyIHdyaXRlRmlsZT1mdW5jdGlvbihmbixvcHRzLGNiKSB7XHJcblx0XHRpZiAodHlwZW9mIGZzPT1cInVuZGVmaW5lZFwiKSB7XHJcblx0XHRcdHZhciBmcz1vcHRzLmZzfHxyZXF1aXJlKCdmcycpO1x0XHJcblx0XHR9XHJcblx0XHR2YXIgdG90YWxieXRlPWhhbmRsZS5jdXJyZW50c2l6ZSgpO1xyXG5cdFx0dmFyIHdyaXR0ZW49MCxiYXRjaD0wO1xyXG5cdFx0XHJcblx0XHRpZiAodHlwZW9mIGNiPT1cInVuZGVmaW5lZFwiIHx8IHR5cGVvZiBvcHRzPT1cImZ1bmN0aW9uXCIpIHtcclxuXHRcdFx0Y2I9b3B0cztcclxuXHRcdH1cclxuXHRcdG9wdHM9b3B0c3x8e307XHJcblx0XHRiYXRjaHNpemU9b3B0cy5iYXRjaHNpemV8fDEwMjQqMTAyNCoxNjsgLy8xNiBNQlxyXG5cclxuXHRcdGlmIChmcy5leGlzdHNTeW5jKGZuKSkgZnMudW5saW5rU3luYyhmbik7XHJcblxyXG5cdFx0dmFyIHdyaXRlQ2I9ZnVuY3Rpb24odG90YWwsd3JpdHRlbixjYixuZXh0KSB7XHJcblx0XHRcdHJldHVybiBmdW5jdGlvbihlcnIpIHtcclxuXHRcdFx0XHRpZiAoZXJyKSB0aHJvdyBcIndyaXRlIGVycm9yXCIrZXJyO1xyXG5cdFx0XHRcdGNiKHRvdGFsLHdyaXR0ZW4pO1xyXG5cdFx0XHRcdGJhdGNoKys7XHJcblx0XHRcdFx0bmV4dCgpO1xyXG5cdFx0XHR9XHJcblx0XHR9XHJcblxyXG5cdFx0dmFyIG5leHQ9ZnVuY3Rpb24oKSB7XHJcblx0XHRcdGlmIChiYXRjaDxiYXRjaGVzKSB7XHJcblx0XHRcdFx0dmFyIGJ1ZnN0YXJ0PWJhdGNoc2l6ZSpiYXRjaDtcclxuXHRcdFx0XHR2YXIgYnVmZW5kPWJ1ZnN0YXJ0K2JhdGNoc2l6ZTtcclxuXHRcdFx0XHRpZiAoYnVmZW5kPnRvdGFsYnl0ZSkgYnVmZW5kPXRvdGFsYnl0ZTtcclxuXHRcdFx0XHR2YXIgc2xpY2VkPWtmcy5idWYuc2xpY2UoYnVmc3RhcnQsYnVmZW5kKTtcclxuXHRcdFx0XHR3cml0dGVuKz1zbGljZWQubGVuZ3RoO1xyXG5cdFx0XHRcdGZzLmFwcGVuZEZpbGUoZm4sc2xpY2VkLHdyaXRlQ2IodG90YWxieXRlLHdyaXR0ZW4sIGNiLG5leHQpKTtcclxuXHRcdFx0fVxyXG5cdFx0fVxyXG5cdFx0dmFyIGJhdGNoZXM9MStNYXRoLmZsb29yKGhhbmRsZS5zaXplL2JhdGNoc2l6ZSk7XHJcblx0XHRuZXh0KCk7XHJcblx0fVxyXG5cdGhhbmRsZS5mcmVlPWZyZWU7XHJcblx0aGFuZGxlLnNhdmVJMzI9c2F2ZUkzMjtcclxuXHRoYW5kbGUuc2F2ZVVJOD1zYXZlVUk4O1xyXG5cdGhhbmRsZS5zYXZlQm9vbD1zYXZlQm9vbDtcclxuXHRoYW5kbGUuc2F2ZVN0cmluZz1zYXZlU3RyaW5nO1xyXG5cdGhhbmRsZS5zYXZlVkludD1zYXZlVkludDtcclxuXHRoYW5kbGUuc2F2ZVBJbnQ9c2F2ZVBJbnQ7XHJcblx0aGFuZGxlLnNhdmVJbnRzPXNhdmVJbnRzO1xyXG5cdGhhbmRsZS5zYXZlQmxvYj1zYXZlQmxvYjtcclxuXHRoYW5kbGUuc2F2ZT1zYXZlO1xyXG5cdGhhbmRsZS5vcGVuQXJyYXk9b3BlbkFycmF5O1xyXG5cdGhhbmRsZS5vcGVuT2JqZWN0PW9wZW5PYmplY3Q7XHJcblx0aGFuZGxlLnN0cmluZ0VuY29kaW5nPXN0cmluZ0VuY29kaW5nO1xyXG5cdC8vdGhpcy5pbnRlZ2VyRW5jb2Rpbmc9aW50ZWdlckVuY29kaW5nO1xyXG5cdGhhbmRsZS5jbG9zZT1jbG9zZTtcclxuXHRoYW5kbGUud3JpdGVGaWxlPXdyaXRlRmlsZTtcclxuXHRoYW5kbGUuY3VycmVudHNpemU9Y3VycmVudHNpemU7XHJcblx0cmV0dXJuIGhhbmRsZTtcclxufVxyXG5cclxubW9kdWxlLmV4cG9ydHM9Q3JlYXRlOyJdfQ==
