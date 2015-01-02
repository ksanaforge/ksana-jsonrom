(function e(t,n,r){function s(o,u){if(!n[o]){if(!t[o]){var a=typeof require=="function"&&require;if(!u&&a)return a(o,!0);if(i)return i(o,!0);var f=new Error("Cannot find module '"+o+"'");throw f.code="MODULE_NOT_FOUND",f}var l=n[o]={exports:{}};t[o][0].call(l.exports,function(e){var n=t[o][1][e];return s(n?n:e)},l,l.exports,e,t,n,r)}return n[o].exports}var i=typeof require=="function"&&require;for(var o=0;o<r.length;o++)s(r[o]);return s})({"c:\\ksana2015\\node_modules\\ksana-jsonrom\\html5fs.js":[function(require,module,exports){
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
},{}],"c:\\ksana2015\\node_modules\\ksana-jsonrom\\index.js":[function(require,module,exports){
module.exports={
	open:require("./kdb")
}

},{"./kdb":"c:\\ksana2015\\node_modules\\ksana-jsonrom\\kdb.js"}],"c:\\ksana2015\\node_modules\\ksana-jsonrom\\kdb.js":[function(require,module,exports){
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

						if (r===undefined) {
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
		if (typeof process!="undefined") require("./kdb_sync")(this);
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

},{"./kdb_sync":"c:\\ksana2015\\node_modules\\ksana-jsonrom\\kdb_sync.js","./kdbfs":"c:\\ksana2015\\node_modules\\ksana-jsonrom\\kdbfs.js","./kdbfs_android":"c:\\ksana2015\\node_modules\\ksana-jsonrom\\kdbfs_android.js","./kdbfs_ios":"c:\\ksana2015\\node_modules\\ksana-jsonrom\\kdbfs_ios.js"}],"c:\\ksana2015\\node_modules\\ksana-jsonrom\\kdb_sync.js":[function(require,module,exports){
/*
  syncronize version of kdb, taken from yadb
*/
var Kfs=require('./kdbfs_sync');

var Sync=function(kdb) {
	var DT=kdb.DT;
	var kfs=Kfs(kdb.fs);
	var cur=0;
	/* loadxxx functions move file pointer */
	// load variable length int
	var loadVInt =function(blocksize,count) {
		if (count==0) return [];
		var o=kfs.readBuf_packedintSync(cur,blocksize,count,true);
		cur+=o.adv;
		return o.data;
	}
	var loadVInt1=function() {
		return loadVInt(6,1)[0];
	}
	//for postings
	var loadPInt =function(blocksize,count) {
		var o=kfs.readBuf_packedintSync(cur,blocksize,count,false);
		cur+=o.adv;
		return o.data;
	}
	// item can be any type (variable length)
	// maximum size of array is 1TB 2^40
	// structure:
	// signature,5 bytes offset, payload, itemlengths
	var loadArray = function(blocksize,lazy) {
		var lengthoffset=kfs.readUI8Sync(cur)*4294967296;
		lengthoffset+=kfs.readUI32Sync(cur+1);
		cur+=5;
		var dataoffset=cur;
		cur+=lengthoffset;
		var count=loadVInt1();
		var sz=loadVInt(count*6,count);
		var o=[];
		var endcur=cur;
		cur=dataoffset; 
		for (var i=0;i<count;i++) {
			if (lazy) { 
				//store the offset instead of loading from disk
				var offset=dataoffset;
				for (var i=0;i<sz.length;i++) {
				//prefix with a \0, impossible for normal string
					o[o.length]="\0"+offset.toString(16)
						   +"\0"+sz[i].toString(16);
					offset+=sz[i];
				}
			} else {			
				o[o.length]=load({blocksize:sz[i]});
			}
		}
		cur=endcur;
		return o;
	}		
	// item can be any type (variable length)
	// support lazy load
	// structure:
	// signature,5 bytes offset, payload, itemlengths, 
	//                    stringarray_signature, keys
	var loadObject = function(blocksize,lazy, keys) {
		var start=cur;
		var lengthoffset=kfs.readUI8Sync(cur)*4294967296;
		lengthoffset+=kfs.readUI32Sync(cur+1);cur+=5;
		var dataoffset=cur;
		cur+=lengthoffset;
		var count=loadVInt1();
		var lengths=loadVInt(count*6,count);
		var keyssize=blocksize-cur+start;	
		var K=load({blocksize:keyssize});
		var o={};
		var endcur=cur;
		
		if (lazy) { 
			//store the offset instead of loading from disk
			var offset=dataoffset;
			for (var i=0;i<lengths.length;i++) {
				//prefix with a \0, impossible for normal string
				o[K[i]]="\0"+offset.toString(16)
					   +"\0"+lengths[i].toString(16);
				offset+=lengths[i];
			}
		} else {
			cur=dataoffset; 
			for (var i=0;i<count;i++) {
				o[K[i]]=(load({blocksize:lengths[i]}));
			}
		}
		if (keys) K.map(function(r) { keys.push(r)});
		cur=endcur;
		return o;
	}		
	//item is same known type
	var loadStringArray=function(blocksize,encoding) {
		var o=kfs.readStringArraySync(cur,blocksize,encoding);
		cur+=blocksize;
		return o;
	}
	var loadIntegerArray=function(blocksize,unitsize) {
		var count=loadVInt1();
		var o=kfs.readFixedArraySync(cur,count,unitsize);
		cur+=count*unitsize;
		return o;
	}
	var loadBlob=function(blocksize) {
		var o=kfs.readBufSync(cur,blocksize);
		cur+=blocksize;
		return o;
	}	
	
	var load=function(opts) {
		opts=opts||{};
		var blocksize=opts.blocksize||kfs.size; 
		var signature=kfs.readSignatureSync(cur);
		cur+=kfs.signature_size;
		var datasize=blocksize-kfs.signature_size;
		//basic types
		if (signature===DT.int32) {
			cur+=4;
			return kfs.readI32Sync(cur-4);
		} else if (signature===DT.uint8) {
			cur++;
			return kfs.readUI8Sync(cur-1);
		} else if (signature===DT.utf8) {
			var c=cur;cur+=datasize;
			return kfs.readStringSync(c,datasize,'utf8');	
		} else if (signature===DT.ucs2) {
			var c=cur;cur+=datasize;
			return kfs.readStringSync(c,datasize,'ucs2');	
		} else if (signature===DT.bool) {
			cur++;
			return !!(kfs.readUI8Sync(cur-1));
		} else if (signature===DT.blob) {
			return loadBlob(datasize);
		}
		//variable length integers
		else if (signature===DT.vint) return loadVInt(datasize);
		else if (signature===DT.pint) return loadPInt(datasize);
		//simple array
		else if (signature===DT.utf8arr) return loadStringArray(datasize,'utf8');
		else if (signature===DT.ucs2arr) return loadStringArray(datasize,'ucs2');
		else if (signature===DT.uint8arr) return loadIntegerArray(datasize,1);
		else if (signature===DT.int32arr) return loadIntegerArray(datasize,4);
		//nested structure
		else if (signature===DT.array) return loadArray(datasize,opts.lazy);
		else if (signature===DT.object) {
			return loadObject(datasize,opts.lazy,opts.keys);
		}
		else throw 'unsupported type '+signature;
	}
	var reset=function() {
		cur=0;
		kdb.setCache(load({lazy:true}));
	}
	var getall=function() {
		var output={};
		var keys=getkeys();
		for (var i in keys) {
			output[keys[i]]= get([keys[i]],true);
		}
		return output;
		
	}
	var exists=function(path) {
		if (path.length==0) return true;
		var key=path.pop();
		get(path);
		if (!path.join('\0')) return (!!kdb.key()[key]);
		var keys=kdb.key()[path.join('\0')];
		path.push(key);//put it back
		if (keys) return (keys.indexOf(key)>-1);
		else return false;
	}
	var get=function(path,recursive) {
		recursive=recursive||false;
		if (!kdb.cache()) reset();

		if (typeof path=="string") path=[path];
		var o=kdb.cache();
		if (path.length==0 &&recursive) return getall();
		var pathnow="";
		for (var i=0;i<path.length;i++) {
			var r=o[path[i]] ;

			if (r===undefined) return undefined;
			if (parseInt(i)) pathnow+="\0";
			pathnow+=path[i];
			if (typeof r=='string' && r[0]=="\0") { //offset of data to be loaded
				var keys=[];
				var p=r.substring(1).split("\0").map(
					function(item){return parseInt(item,16)});
				cur=p[0];
				var lazy=!recursive || (i<path.length-1) ;
				o[path[i]]=load({lazy:lazy,blocksize:p[1],keys:keys});
				kdb.key()[pathnow]=keys;
				o=o[path[i]];
			} else {
				o=r; //already in cache
			}
		}
		return o;
	}
	// get all keys in given path
	var getkeys=function(path) {
		if (!path) path=[]
		get(path); // make sure it is loaded
		if (path && path.length) {
			return kdb.key()[path.join("\0")];
		} else {
			return Object.keys(kdb.cache()); 
			//top level, normally it is very small
		}
		
	}

	kdb.loadSync=load;
	kdb.keysSync=getkeys;
	kdb.getSync=get;   // get a field, load if needed
	kdb.existsSync=exists;
	return kdb;
}

if (module) module.exports=Sync;

},{"./kdbfs_sync":"c:\\ksana2015\\node_modules\\ksana-jsonrom\\kdbfs_sync.js"}],"c:\\ksana2015\\node_modules\\ksana-jsonrom\\kdbfs.js":[function(require,module,exports){
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
},{"./html5fs":"c:\\ksana2015\\node_modules\\ksana-jsonrom\\html5fs.js","buffer":false,"fs":false}],"c:\\ksana2015\\node_modules\\ksana-jsonrom\\kdbfs_android.js":[function(require,module,exports){
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
},{}],"c:\\ksana2015\\node_modules\\ksana-jsonrom\\kdbfs_ios.js":[function(require,module,exports){
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
},{}],"c:\\ksana2015\\node_modules\\ksana-jsonrom\\kdbfs_sync.js":[function(require,module,exports){
/* OS dependent file operation */
if (typeof nodeRequire=='undefined') var nodeRequire=(typeof ksana=="undefined")?require:ksana.require;

var fs=nodeRequire('fs');
var signature_size=1;

var unpack_int = function (ar, count , reset) {
   count=count||ar.length;
   /*
	if (typeof ijs_unpack_int == 'function') {
		var R = ijs_unpack_int(ar, count, reset)
		return R
	};
	*/
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
var Sync=function(kfs) {
	var handle=kfs.handle;

	var readSignature=function(pos) {
		var buf=new Buffer(signature_size);
		fs.readSync(handle,buf,0,signature_size,pos);
		var signature=buf.toString('utf8',0,signature_size);
		return signature;
	}
	var readString= function(pos,blocksize,encoding) {
		encoding=encoding||'utf8';
		var buffer=new Buffer(blocksize);
		fs.readSync(handle,buffer,0,blocksize,pos);
		return buffer.toString(encoding);
	}

	var readStringArray = function(pos,blocksize,encoding) {
		if (blocksize==0) return [];
		encoding=encoding||'utf8';
		var buffer=new Buffer(blocksize);
		fs.readSync(handle,buffer,0,blocksize,pos);
		var out=buffer.toString(encoding).split('\0');
		return out;
	}
	var readUI32=function(pos) {
		var buffer=new Buffer(4);
		fs.readSync(handle,buffer,0,4,pos);
		return buffer.readUInt32BE(0);
	}
	var readI32=function(pos) {
		var buffer=new Buffer(4);
		fs.readSync(handle,buffer,0,4,pos);
		return buffer.readInt32BE(0);
	}
	var readUI8=function(pos) {
		var buffer=new Buffer(1);
		fs.readSync(handle,buffer,0,1,pos);
		return buffer.readUInt8(0);
	}
	var readBuf=function(pos,blocksize) {
		var buf=new Buffer(blocksize);
		fs.readSync(handle,buf,0,blocksize,pos);
	
		return buf;
	}
	var readBuf_packedint=function(pos,blocksize,count,reset) {
		var buf=readBuf(pos,blocksize);
		return unpack_int(buf,count,reset);
	}
	// signature, itemcount, payload
	var readFixedArray = function(pos ,count, unitsize) {
		var func;
		
		if (unitsize* count>this.size && this.size)  {
			throw "array size exceed file size"
			return;
		}
		
		var items=new Buffer( unitsize* count);
		if (unitsize===1) {
			func=items.readUInt8;
		} else if (unitsize===2) {
			func=items.readUInt16BE;
		} else if (unitsize===4) {
			func=items.readUInt32BE;
		} else throw 'unsupported integer size';
		//console.log('itemcount',itemcount,'buffer',buffer);
		fs.readSync(handle,items,0,unitsize*count,pos);
		var out=[];
		for (var i = 0; i < items.length / unitsize; i++) {
			out.push( func.apply(items,[i*unitsize]) );
		}
		return out;
	}
	
	kfs.readSignatureSync=readSignature;
	kfs.readI32Sync=readI32;
	kfs.readUI32Sync=readUI32;
	kfs.readUI8Sync=readUI8;
	kfs.readBufSync=readBuf;
	kfs.readBuf_packedintSync=readBuf_packedint;
	kfs.readFixedArraySync=readFixedArray;
	kfs.readStringSync=readString;
	kfs.readStringArraySync=readStringArray;
	kfs.signature_sizeSync=signature_size;
	
	return kfs;
}
module.exports=Sync;

},{}]},{},["c:\\ksana2015\\node_modules\\ksana-jsonrom\\index.js"])
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbIi4uXFwuLlxcLi5cXFVzZXJzXFxjaGVhaHNoZW5cXEFwcERhdGFcXFJvYW1pbmdcXG5wbVxcbm9kZV9tb2R1bGVzXFxicm93c2VyaWZ5XFxub2RlX21vZHVsZXNcXGJyb3dzZXItcGFja1xcX3ByZWx1ZGUuanMiLCJodG1sNWZzLmpzIiwiaW5kZXguanMiLCJrZGIuanMiLCJrZGJfc3luYy5qcyIsImtkYmZzLmpzIiwia2RiZnNfYW5kcm9pZC5qcyIsImtkYmZzX2lvcy5qcyIsImtkYmZzX3N5bmMuanMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6IkFBQUE7QUNBQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUMvUEE7QUFDQTtBQUNBO0FBQ0E7O0FDSEE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUNuZkE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUNsT0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQ2pUQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDakhBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDbkhBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0EiLCJmaWxlIjoiZ2VuZXJhdGVkLmpzIiwic291cmNlUm9vdCI6IiIsInNvdXJjZXNDb250ZW50IjpbIihmdW5jdGlvbiBlKHQsbixyKXtmdW5jdGlvbiBzKG8sdSl7aWYoIW5bb10pe2lmKCF0W29dKXt2YXIgYT10eXBlb2YgcmVxdWlyZT09XCJmdW5jdGlvblwiJiZyZXF1aXJlO2lmKCF1JiZhKXJldHVybiBhKG8sITApO2lmKGkpcmV0dXJuIGkobywhMCk7dmFyIGY9bmV3IEVycm9yKFwiQ2Fubm90IGZpbmQgbW9kdWxlICdcIitvK1wiJ1wiKTt0aHJvdyBmLmNvZGU9XCJNT0RVTEVfTk9UX0ZPVU5EXCIsZn12YXIgbD1uW29dPXtleHBvcnRzOnt9fTt0W29dWzBdLmNhbGwobC5leHBvcnRzLGZ1bmN0aW9uKGUpe3ZhciBuPXRbb11bMV1bZV07cmV0dXJuIHMobj9uOmUpfSxsLGwuZXhwb3J0cyxlLHQsbixyKX1yZXR1cm4gbltvXS5leHBvcnRzfXZhciBpPXR5cGVvZiByZXF1aXJlPT1cImZ1bmN0aW9uXCImJnJlcXVpcmU7Zm9yKHZhciBvPTA7bzxyLmxlbmd0aDtvKyspcyhyW29dKTtyZXR1cm4gc30pIiwiLyogZW11bGF0ZSBmaWxlc3lzdGVtIG9uIGh0bWw1IGJyb3dzZXIgKi9cclxudmFyIHJlYWQ9ZnVuY3Rpb24oaGFuZGxlLGJ1ZmZlcixvZmZzZXQsbGVuZ3RoLHBvc2l0aW9uLGNiKSB7Ly9idWZmZXIgYW5kIG9mZnNldCBpcyBub3QgdXNlZFxyXG5cdHZhciB4aHIgPSBuZXcgWE1MSHR0cFJlcXVlc3QoKTtcclxuXHR4aHIub3BlbignR0VUJywgaGFuZGxlLnVybCAsIHRydWUpO1xyXG5cdHZhciByYW5nZT1bcG9zaXRpb24sbGVuZ3RoK3Bvc2l0aW9uLTFdO1xyXG5cdHhoci5zZXRSZXF1ZXN0SGVhZGVyKCdSYW5nZScsICdieXRlcz0nK3JhbmdlWzBdKyctJytyYW5nZVsxXSk7XHJcblx0eGhyLnJlc3BvbnNlVHlwZSA9ICdhcnJheWJ1ZmZlcic7XHJcblx0eGhyLnNlbmQoKTtcclxuXHR4aHIub25sb2FkID0gZnVuY3Rpb24oZSkge1xyXG5cdFx0dmFyIHRoYXQ9dGhpcztcclxuXHRcdHNldFRpbWVvdXQoZnVuY3Rpb24oKXtcclxuXHRcdFx0Y2IoMCx0aGF0LnJlc3BvbnNlLmJ5dGVMZW5ndGgsdGhhdC5yZXNwb25zZSk7XHJcblx0XHR9LDApO1xyXG5cdH07IFxyXG59XHJcbnZhciBjbG9zZT1mdW5jdGlvbihoYW5kbGUpIHt9XHJcbnZhciBmc3RhdFN5bmM9ZnVuY3Rpb24oaGFuZGxlKSB7XHJcblx0dGhyb3cgXCJub3QgaW1wbGVtZW50IHlldFwiO1xyXG59XHJcbnZhciBmc3RhdD1mdW5jdGlvbihoYW5kbGUsY2IpIHtcclxuXHR0aHJvdyBcIm5vdCBpbXBsZW1lbnQgeWV0XCI7XHJcbn1cclxudmFyIF9vcGVuPWZ1bmN0aW9uKGZuX3VybCxjYikge1xyXG5cdFx0dmFyIGhhbmRsZT17fTtcclxuXHRcdGlmIChmbl91cmwuaW5kZXhPZihcImZpbGVzeXN0ZW06XCIpPT0wKXtcclxuXHRcdFx0aGFuZGxlLnVybD1mbl91cmw7XHJcblx0XHRcdGhhbmRsZS5mbj1mbl91cmwuc3Vic3RyKCBmbl91cmwubGFzdEluZGV4T2YoXCIvXCIpKzEpO1xyXG5cdFx0fSBlbHNlIHtcclxuXHRcdFx0aGFuZGxlLmZuPWZuX3VybDtcclxuXHRcdFx0dmFyIHVybD1BUEkuZmlsZXMuZmlsdGVyKGZ1bmN0aW9uKGYpeyByZXR1cm4gKGZbMF09PWZuX3VybCl9KTtcclxuXHRcdFx0aWYgKHVybC5sZW5ndGgpIGhhbmRsZS51cmw9dXJsWzBdWzFdO1xyXG5cdFx0fVxyXG5cdFx0Y2IoaGFuZGxlKTtcclxufVxyXG52YXIgb3Blbj1mdW5jdGlvbihmbl91cmwsY2IpIHtcclxuXHRcdGlmICghQVBJLmluaXRpYWxpemVkKSB7aW5pdCgxMDI0KjEwMjQsZnVuY3Rpb24oKXtcclxuXHRcdFx0X29wZW4uYXBwbHkodGhpcyxbZm5fdXJsLGNiXSk7XHJcblx0XHR9LHRoaXMpfSBlbHNlIF9vcGVuLmFwcGx5KHRoaXMsW2ZuX3VybCxjYl0pO1xyXG59XHJcbnZhciBsb2FkPWZ1bmN0aW9uKGZpbGVuYW1lLG1vZGUsY2IpIHtcclxuXHRvcGVuKGZpbGVuYW1lLG1vZGUsY2IsdHJ1ZSk7XHJcbn1cclxudmFyIGdldF9oZWFkPWZ1bmN0aW9uKHVybCxmaWVsZCxjYil7XHJcblx0XHR2YXIgeGhyID0gbmV3IFhNTEh0dHBSZXF1ZXN0KCk7XHJcblx0XHR4aHIub3BlbihcIkhFQURcIiwgdXJsLCB0cnVlKTtcclxuXHRcdHhoci5vbnJlYWR5c3RhdGVjaGFuZ2UgPSBmdW5jdGlvbigpIHtcclxuXHRcdFx0XHRpZiAodGhpcy5yZWFkeVN0YXRlID09IHRoaXMuRE9ORSkge1xyXG5cdFx0XHRcdFx0Y2IoeGhyLmdldFJlc3BvbnNlSGVhZGVyKGZpZWxkKSk7XHJcblx0XHRcdFx0fSBlbHNlIHtcclxuXHRcdFx0XHRcdGlmICh0aGlzLnN0YXR1cyE9PTIwMCYmdGhpcy5zdGF0dXMhPT0yMDYpIHtcclxuXHRcdFx0XHRcdFx0Y2IoXCJcIik7XHJcblx0XHRcdFx0XHR9XHJcblx0XHRcdFx0fVxyXG5cdFx0fTtcclxuXHRcdHhoci5zZW5kKCk7XHRcclxufVxyXG52YXIgZ2V0X2RhdGU9ZnVuY3Rpb24odXJsLGNiKSB7XHJcblx0XHRnZXRfaGVhZCh1cmwsXCJMYXN0LU1vZGlmaWVkXCIsZnVuY3Rpb24odmFsdWUpe1xyXG5cdFx0XHRjYih2YWx1ZSk7XHJcblx0XHR9KTtcclxufVxyXG52YXIgIGdldERvd25sb2FkU2l6ZT1mdW5jdGlvbih1cmwsIGNiKSB7XHJcblx0XHRnZXRfaGVhZCh1cmwsXCJDb250ZW50LUxlbmd0aFwiLGZ1bmN0aW9uKHZhbHVlKXtcclxuXHRcdFx0Y2IocGFyc2VJbnQodmFsdWUpKTtcclxuXHRcdH0pO1xyXG59O1xyXG52YXIgY2hlY2tVcGRhdGU9ZnVuY3Rpb24odXJsLGZuLGNiKSB7XHJcblx0XHRpZiAoIXVybCkge1xyXG5cdFx0XHRjYihmYWxzZSk7XHJcblx0XHRcdHJldHVybjtcclxuXHRcdH1cclxuXHRcdGdldF9kYXRlKHVybCxmdW5jdGlvbihkKXtcclxuXHRcdFx0QVBJLmZzLnJvb3QuZ2V0RmlsZShmbiwge2NyZWF0ZTogZmFsc2UsIGV4Y2x1c2l2ZTogZmFsc2V9LCBmdW5jdGlvbihmaWxlRW50cnkpIHtcclxuXHRcdFx0XHRcdGZpbGVFbnRyeS5nZXRNZXRhZGF0YShmdW5jdGlvbihtZXRhZGF0YSl7XHJcblx0XHRcdFx0XHRcdHZhciBsb2NhbERhdGU9RGF0ZS5wYXJzZShtZXRhZGF0YS5tb2RpZmljYXRpb25UaW1lKTtcclxuXHRcdFx0XHRcdFx0dmFyIHVybERhdGU9RGF0ZS5wYXJzZShkKTtcclxuXHRcdFx0XHRcdFx0Y2IodXJsRGF0ZT5sb2NhbERhdGUpO1xyXG5cdFx0XHRcdFx0fSk7XHJcblx0XHR9LGZ1bmN0aW9uKCl7XHJcblx0XHRcdGNiKGZhbHNlKTtcclxuXHRcdH0pO1xyXG5cdH0pO1xyXG59XHJcbnZhciBkb3dubG9hZD1mdW5jdGlvbih1cmwsZm4sY2Isc3RhdHVzY2IsY29udGV4dCkge1xyXG5cdCB2YXIgdG90YWxzaXplPTAsYmF0Y2hlcz1udWxsLHdyaXR0ZW49MDtcclxuXHQgdmFyIGZpbGVFbnRyeT0wLCBmaWxlV3JpdGVyPTA7XHJcblx0IHZhciBjcmVhdGVCYXRjaGVzPWZ1bmN0aW9uKHNpemUpIHtcclxuXHRcdFx0dmFyIGJ5dGVzPTEwMjQqMTAyNCwgb3V0PVtdO1xyXG5cdFx0XHR2YXIgYj1NYXRoLmZsb29yKHNpemUgLyBieXRlcyk7XHJcblx0XHRcdHZhciBsYXN0PXNpemUgJWJ5dGVzO1xyXG5cdFx0XHRmb3IgKHZhciBpPTA7aTw9YjtpKyspIHtcclxuXHRcdFx0XHRvdXQucHVzaChpKmJ5dGVzKTtcclxuXHRcdFx0fVxyXG5cdFx0XHRvdXQucHVzaChiKmJ5dGVzK2xhc3QpO1xyXG5cdFx0XHRyZXR1cm4gb3V0O1xyXG5cdCB9XHJcblx0IHZhciBmaW5pc2g9ZnVuY3Rpb24oKSB7XHJcblx0XHRcdFx0IHJtKGZuLGZ1bmN0aW9uKCl7XHJcblx0XHRcdFx0XHRcdGZpbGVFbnRyeS5tb3ZlVG8oZmlsZUVudHJ5LmZpbGVzeXN0ZW0ucm9vdCwgZm4sZnVuY3Rpb24oKXtcclxuXHRcdFx0XHRcdFx0XHRzZXRUaW1lb3V0KCBjYi5iaW5kKGNvbnRleHQsZmFsc2UpICwgMCkgOyBcclxuXHRcdFx0XHRcdFx0fSxmdW5jdGlvbihlKXtcclxuXHRcdFx0XHRcdFx0XHRjb25zb2xlLmxvZyhcImZhaWxlZFwiLGUpXHJcblx0XHRcdFx0XHRcdH0pO1xyXG5cdFx0XHRcdCB9LHRoaXMpOyBcclxuXHQgfVxyXG5cdFx0dmFyIHRlbXBmbj1cInRlbXAua2RiXCI7XHJcblx0XHR2YXIgYmF0Y2g9ZnVuY3Rpb24oYikge1xyXG5cdFx0XHQgdmFyIGFib3J0PWZhbHNlO1xyXG5cdFx0XHQgdmFyIHhociA9IG5ldyBYTUxIdHRwUmVxdWVzdCgpO1xyXG5cdFx0XHQgdmFyIHJlcXVlc3R1cmw9dXJsK1wiP1wiK01hdGgucmFuZG9tKCk7XHJcblx0XHRcdCB4aHIub3BlbignZ2V0JywgcmVxdWVzdHVybCwgdHJ1ZSk7XHJcblx0XHRcdCB4aHIuc2V0UmVxdWVzdEhlYWRlcignUmFuZ2UnLCAnYnl0ZXM9JytiYXRjaGVzW2JdKyctJysoYmF0Y2hlc1tiKzFdLTEpKTtcclxuXHRcdFx0IHhoci5yZXNwb25zZVR5cGUgPSAnYmxvYic7ICAgIFxyXG5cdFx0XHQgeGhyLmFkZEV2ZW50TGlzdGVuZXIoJ2xvYWQnLCBmdW5jdGlvbigpIHtcclxuXHRcdFx0XHQgdmFyIGJsb2I9dGhpcy5yZXNwb25zZTtcclxuXHRcdFx0XHQgZmlsZUVudHJ5LmNyZWF0ZVdyaXRlcihmdW5jdGlvbihmaWxlV3JpdGVyKSB7XHJcblx0XHRcdFx0IGZpbGVXcml0ZXIuc2VlayhmaWxlV3JpdGVyLmxlbmd0aCk7XHJcblx0XHRcdFx0IGZpbGVXcml0ZXIud3JpdGUoYmxvYik7XHJcblx0XHRcdFx0IHdyaXR0ZW4rPWJsb2Iuc2l6ZTtcclxuXHRcdFx0XHQgZmlsZVdyaXRlci5vbndyaXRlZW5kID0gZnVuY3Rpb24oZSkge1xyXG5cdFx0XHRcdFx0IGlmIChzdGF0dXNjYikge1xyXG5cdFx0XHRcdFx0XHRcdGFib3J0PXN0YXR1c2NiLmFwcGx5KGNvbnRleHQsWyBmaWxlV3JpdGVyLmxlbmd0aCAvIHRvdGFsc2l6ZSx0b3RhbHNpemUgXSk7XHJcblx0XHRcdFx0XHRcdFx0aWYgKGFib3J0KSBzZXRUaW1lb3V0KCBjYi5iaW5kKGNvbnRleHQsZmFsc2UpICwgMCkgO1xyXG5cdFx0XHRcdFx0IH1cclxuXHRcdFx0XHRcdCBiKys7XHJcblx0XHRcdFx0XHQgaWYgKCFhYm9ydCkge1xyXG5cdFx0XHRcdFx0XHRcdGlmIChiPGJhdGNoZXMubGVuZ3RoLTEpIHNldFRpbWVvdXQoYmF0Y2guYmluZChjb250ZXh0LGIpLDApO1xyXG5cdFx0XHRcdFx0XHRcdGVsc2UgICAgICAgICAgICAgICAgICAgIGZpbmlzaCgpO1xyXG5cdFx0XHRcdFx0IH1cclxuXHRcdFx0XHQgfTtcclxuXHRcdFx0XHR9LCBjb25zb2xlLmVycm9yKTtcclxuXHRcdFx0IH0sZmFsc2UpO1xyXG5cdFx0XHQgeGhyLnNlbmQoKTtcclxuXHRcdH1cclxuXHJcblx0XHQgZ2V0RG93bmxvYWRTaXplKHVybCxmdW5jdGlvbihzaXplKXtcclxuXHRcdFx0IHRvdGFsc2l6ZT1zaXplO1xyXG5cdFx0XHQgaWYgKCFzaXplKSB7XHJcblx0XHRcdFx0XHRpZiAoY2IpIGNiLmFwcGx5KGNvbnRleHQsW2ZhbHNlXSk7XHJcblx0XHRcdCB9IGVsc2Ugey8vcmVhZHkgdG8gZG93bmxvYWRcclxuXHRcdFx0XHRybSh0ZW1wZm4sZnVuY3Rpb24oKXtcclxuXHRcdFx0XHRcdCBiYXRjaGVzPWNyZWF0ZUJhdGNoZXMoc2l6ZSk7XHJcblx0XHRcdFx0XHQgaWYgKHN0YXR1c2NiKSBzdGF0dXNjYi5hcHBseShjb250ZXh0LFsgMCwgdG90YWxzaXplIF0pO1xyXG5cdFx0XHRcdFx0IEFQSS5mcy5yb290LmdldEZpbGUodGVtcGZuLCB7Y3JlYXRlOiAxLCBleGNsdXNpdmU6IGZhbHNlfSwgZnVuY3Rpb24oX2ZpbGVFbnRyeSkge1xyXG5cdFx0XHRcdFx0XHRcdFx0ZmlsZUVudHJ5PV9maWxlRW50cnk7XHJcblx0XHRcdFx0XHRcdFx0YmF0Y2goMCk7XHJcblx0XHRcdFx0XHQgfSk7XHJcblx0XHRcdFx0fSx0aGlzKTtcclxuXHRcdFx0fVxyXG5cdFx0fSk7XHJcbn1cclxuXHJcbnZhciByZWFkRmlsZT1mdW5jdGlvbihmaWxlbmFtZSxjYixjb250ZXh0KSB7XHJcblx0QVBJLmZzLnJvb3QuZ2V0RmlsZShmaWxlbmFtZSwgZnVuY3Rpb24oZmlsZUVudHJ5KSB7XHJcblx0XHRcdHZhciByZWFkZXIgPSBuZXcgRmlsZVJlYWRlcigpO1xyXG5cdFx0XHRyZWFkZXIub25sb2FkZW5kID0gZnVuY3Rpb24oZSkge1xyXG5cdFx0XHRcdFx0aWYgKGNiKSBjYi5hcHBseShjYixbdGhpcy5yZXN1bHRdKTtcclxuXHRcdFx0XHR9OyAgICAgICAgICAgIFxyXG5cdFx0fSwgY29uc29sZS5lcnJvcik7XHJcbn1cclxudmFyIHdyaXRlRmlsZT1mdW5jdGlvbihmaWxlbmFtZSxidWYsY2IsY29udGV4dCl7XHJcblx0IEFQSS5mcy5yb290LmdldEZpbGUoZmlsZW5hbWUsIHtjcmVhdGU6IHRydWUsIGV4Y2x1c2l2ZTogdHJ1ZX0sIGZ1bmN0aW9uKGZpbGVFbnRyeSkge1xyXG5cdFx0XHRmaWxlRW50cnkuY3JlYXRlV3JpdGVyKGZ1bmN0aW9uKGZpbGVXcml0ZXIpIHtcclxuXHRcdFx0XHRmaWxlV3JpdGVyLndyaXRlKGJ1Zik7XHJcblx0XHRcdFx0ZmlsZVdyaXRlci5vbndyaXRlZW5kID0gZnVuY3Rpb24oZSkge1xyXG5cdFx0XHRcdFx0aWYgKGNiKSBjYi5hcHBseShjYixbYnVmLmJ5dGVMZW5ndGhdKTtcclxuXHRcdFx0XHR9OyAgICAgICAgICAgIFxyXG5cdFx0XHR9LCBjb25zb2xlLmVycm9yKTtcclxuXHRcdH0sIGNvbnNvbGUuZXJyb3IpO1xyXG59XHJcblxyXG52YXIgcmVhZGRpcj1mdW5jdGlvbihjYixjb250ZXh0KSB7XHJcblx0IHZhciBkaXJSZWFkZXIgPSBBUEkuZnMucm9vdC5jcmVhdGVSZWFkZXIoKTtcclxuXHQgdmFyIG91dD1bXSx0aGF0PXRoaXM7XHJcblx0XHRkaXJSZWFkZXIucmVhZEVudHJpZXMoZnVuY3Rpb24oZW50cmllcykge1xyXG5cdFx0XHRpZiAoZW50cmllcy5sZW5ndGgpIHtcclxuXHRcdFx0XHRcdGZvciAodmFyIGkgPSAwLCBlbnRyeTsgZW50cnkgPSBlbnRyaWVzW2ldOyArK2kpIHtcclxuXHRcdFx0XHRcdFx0aWYgKGVudHJ5LmlzRmlsZSkge1xyXG5cdFx0XHRcdFx0XHRcdG91dC5wdXNoKFtlbnRyeS5uYW1lLGVudHJ5LnRvVVJMID8gZW50cnkudG9VUkwoKSA6IGVudHJ5LnRvVVJJKCldKTtcclxuXHRcdFx0XHRcdFx0fVxyXG5cdFx0XHRcdFx0fVxyXG5cdFx0XHR9XHJcblx0XHRcdEFQSS5maWxlcz1vdXQ7XHJcblx0XHRcdGlmIChjYikgY2IuYXBwbHkoY29udGV4dCxbb3V0XSk7XHJcblx0XHR9LCBmdW5jdGlvbigpe1xyXG5cdFx0XHRpZiAoY2IpIGNiLmFwcGx5KGNvbnRleHQsW251bGxdKTtcclxuXHRcdH0pO1xyXG59XHJcbnZhciBnZXRGaWxlVVJMPWZ1bmN0aW9uKGZpbGVuYW1lKSB7XHJcblx0aWYgKCFBUEkuZmlsZXMgKSByZXR1cm4gbnVsbDtcclxuXHR2YXIgZmlsZT0gQVBJLmZpbGVzLmZpbHRlcihmdW5jdGlvbihmKXtyZXR1cm4gZlswXT09ZmlsZW5hbWV9KTtcclxuXHRpZiAoZmlsZS5sZW5ndGgpIHJldHVybiBmaWxlWzBdWzFdO1xyXG59XHJcbnZhciBybT1mdW5jdGlvbihmaWxlbmFtZSxjYixjb250ZXh0KSB7XHJcblx0IHZhciB1cmw9Z2V0RmlsZVVSTChmaWxlbmFtZSk7XHJcblx0IGlmICh1cmwpIHJtVVJMKHVybCxjYixjb250ZXh0KTtcclxuXHQgZWxzZSBpZiAoY2IpIGNiLmFwcGx5KGNvbnRleHQsW2ZhbHNlXSk7XHJcbn1cclxuXHJcbnZhciBybVVSTD1mdW5jdGlvbihmaWxlbmFtZSxjYixjb250ZXh0KSB7XHJcblx0XHR3ZWJraXRSZXNvbHZlTG9jYWxGaWxlU3lzdGVtVVJMKGZpbGVuYW1lLCBmdW5jdGlvbihmaWxlRW50cnkpIHtcclxuXHRcdFx0ZmlsZUVudHJ5LnJlbW92ZShmdW5jdGlvbigpIHtcclxuXHRcdFx0XHRpZiAoY2IpIGNiLmFwcGx5KGNvbnRleHQsW3RydWVdKTtcclxuXHRcdFx0fSwgY29uc29sZS5lcnJvcik7XHJcblx0XHR9LCAgZnVuY3Rpb24oZSl7XHJcblx0XHRcdGlmIChjYikgY2IuYXBwbHkoY29udGV4dCxbZmFsc2VdKTsvL25vIHN1Y2ggZmlsZVxyXG5cdFx0fSk7XHJcbn1cclxuZnVuY3Rpb24gZXJyb3JIYW5kbGVyKGUpIHtcclxuXHRjb25zb2xlLmVycm9yKCdFcnJvcjogJyArZS5uYW1lKyBcIiBcIitlLm1lc3NhZ2UpO1xyXG59XHJcbnZhciBpbml0ZnM9ZnVuY3Rpb24oZ3JhbnRlZEJ5dGVzLGNiLGNvbnRleHQpIHtcclxuXHR3ZWJraXRSZXF1ZXN0RmlsZVN5c3RlbShQRVJTSVNURU5ULCBncmFudGVkQnl0ZXMsICBmdW5jdGlvbihmcykge1xyXG5cdFx0QVBJLmZzPWZzO1xyXG5cdFx0QVBJLnF1b3RhPWdyYW50ZWRCeXRlcztcclxuXHRcdHJlYWRkaXIoZnVuY3Rpb24oKXtcclxuXHRcdFx0QVBJLmluaXRpYWxpemVkPXRydWU7XHJcblx0XHRcdGNiLmFwcGx5KGNvbnRleHQsW2dyYW50ZWRCeXRlcyxmc10pO1xyXG5cdFx0fSxjb250ZXh0KTtcclxuXHR9LCBlcnJvckhhbmRsZXIpO1xyXG59XHJcbnZhciBpbml0PWZ1bmN0aW9uKHF1b3RhLGNiLGNvbnRleHQpIHtcclxuXHRuYXZpZ2F0b3Iud2Via2l0UGVyc2lzdGVudFN0b3JhZ2UucmVxdWVzdFF1b3RhKHF1b3RhLCBcclxuXHRcdFx0ZnVuY3Rpb24oZ3JhbnRlZEJ5dGVzKSB7XHJcblx0XHRcdFx0aW5pdGZzKGdyYW50ZWRCeXRlcyxjYixjb250ZXh0KTtcclxuXHRcdH0sIGNvbnNvbGUuZXJyb3IgXHJcblx0KTtcclxufVxyXG52YXIgcXVlcnlRdW90YT1mdW5jdGlvbihjYixjb250ZXh0KSB7XHJcblx0XHR2YXIgdGhhdD10aGlzO1xyXG5cdFx0bmF2aWdhdG9yLndlYmtpdFBlcnNpc3RlbnRTdG9yYWdlLnF1ZXJ5VXNhZ2VBbmRRdW90YSggXHJcblx0XHQgZnVuY3Rpb24odXNhZ2UscXVvdGEpe1xyXG5cdFx0XHRcdGluaXRmcyhxdW90YSxmdW5jdGlvbigpe1xyXG5cdFx0XHRcdFx0Y2IuYXBwbHkoY29udGV4dCxbdXNhZ2UscXVvdGFdKTtcclxuXHRcdFx0XHR9LGNvbnRleHQpO1xyXG5cdFx0fSk7XHJcbn1cclxudmFyIEFQST17XHJcblx0bG9hZDpsb2FkXHJcblx0LG9wZW46b3BlblxyXG5cdCxyZWFkOnJlYWRcclxuXHQsZnN0YXRTeW5jOmZzdGF0U3luY1xyXG5cdCxmc3RhdDpmc3RhdCxjbG9zZTpjbG9zZVxyXG5cdCxpbml0OmluaXRcclxuXHQscmVhZGRpcjpyZWFkZGlyXHJcblx0LGNoZWNrVXBkYXRlOmNoZWNrVXBkYXRlXHJcblx0LHJtOnJtXHJcblx0LHJtVVJMOnJtVVJMXHJcblx0LGdldEZpbGVVUkw6Z2V0RmlsZVVSTFxyXG5cdCxnZXREb3dubG9hZFNpemU6Z2V0RG93bmxvYWRTaXplXHJcblx0LHdyaXRlRmlsZTp3cml0ZUZpbGVcclxuXHQscmVhZEZpbGU6cmVhZEZpbGVcclxuXHQsZG93bmxvYWQ6ZG93bmxvYWRcclxuXHQscXVlcnlRdW90YTpxdWVyeVF1b3RhXHJcbn1cclxuXHRtb2R1bGUuZXhwb3J0cz1BUEk7IiwibW9kdWxlLmV4cG9ydHM9e1xyXG5cdG9wZW46cmVxdWlyZShcIi4va2RiXCIpXHJcbn1cclxuIiwiLypcclxuXHRLREIgdmVyc2lvbiAzLjAgR1BMXHJcblx0eWFwY2hlYWhzaGVuQGdtYWlsLmNvbVxyXG5cdDIwMTMvMTIvMjhcclxuXHRhc3luY3Jvbml6ZSB2ZXJzaW9uIG9mIHlhZGJcclxuXHJcbiAgcmVtb3ZlIGRlcGVuZGVuY3kgb2YgUSwgdGhhbmtzIHRvXHJcbiAgaHR0cDovL3N0YWNrb3ZlcmZsb3cuY29tL3F1ZXN0aW9ucy80MjM0NjE5L2hvdy10by1hdm9pZC1sb25nLW5lc3Rpbmctb2YtYXN5bmNocm9ub3VzLWZ1bmN0aW9ucy1pbi1ub2RlLWpzXHJcblxyXG4gIDIwMTUvMS8yXHJcbiAgbW92ZWQgdG8ga3NhbmFmb3JnZS9rc2FuYS1qc29ucm9tXHJcbiAgYWRkIGVyciBpbiBjYWxsYmFjayBmb3Igbm9kZS5qcyBjb21wbGlhbnRcclxuKi9cclxudmFyIEtmcz1udWxsO1xyXG5cclxuaWYgKHR5cGVvZiBrc2FuYWdhcD09XCJ1bmRlZmluZWRcIikge1xyXG5cdEtmcz1yZXF1aXJlKCcuL2tkYmZzJyk7XHRcdFx0XHJcbn0gZWxzZSB7XHJcblx0aWYgKGtzYW5hZ2FwLnBsYXRmb3JtPT1cImlvc1wiKSB7XHJcblx0XHRLZnM9cmVxdWlyZShcIi4va2RiZnNfaW9zXCIpO1xyXG5cdH0gZWxzZSBpZiAoa3NhbmFnYXAucGxhdGZvcm09PVwibm9kZS13ZWJraXRcIikge1xyXG5cdFx0S2ZzPXJlcXVpcmUoXCIuL2tkYmZzXCIpO1xyXG5cdH0gZWxzZSBpZiAoa3NhbmFnYXAucGxhdGZvcm09PVwiY2hyb21lXCIpIHtcclxuXHRcdEtmcz1yZXF1aXJlKFwiLi9rZGJmc1wiKTtcclxuXHR9IGVsc2Uge1xyXG5cdFx0S2ZzPXJlcXVpcmUoXCIuL2tkYmZzX2FuZHJvaWRcIik7XHJcblx0fVxyXG5cdFx0XHJcbn1cclxuXHJcblxyXG52YXIgRFQ9e1xyXG5cdHVpbnQ4OicxJywgLy91bnNpZ25lZCAxIGJ5dGUgaW50ZWdlclxyXG5cdGludDMyOic0JywgLy8gc2lnbmVkIDQgYnl0ZXMgaW50ZWdlclxyXG5cdHV0Zjg6JzgnLCAgXHJcblx0dWNzMjonMicsXHJcblx0Ym9vbDonXicsIFxyXG5cdGJsb2I6JyYnLFxyXG5cdHV0ZjhhcnI6JyonLCAvL3NoaWZ0IG9mIDhcclxuXHR1Y3MyYXJyOidAJywgLy9zaGlmdCBvZiAyXHJcblx0dWludDhhcnI6JyEnLCAvL3NoaWZ0IG9mIDFcclxuXHRpbnQzMmFycjonJCcsIC8vc2hpZnQgb2YgNFxyXG5cdHZpbnQ6J2AnLFxyXG5cdHBpbnQ6J34nLFx0XHJcblxyXG5cdGFycmF5OidcXHUwMDFiJyxcclxuXHRvYmplY3Q6J1xcdTAwMWEnIFxyXG5cdC8veWRiIHN0YXJ0IHdpdGggb2JqZWN0IHNpZ25hdHVyZSxcclxuXHQvL3R5cGUgYSB5ZGIgaW4gY29tbWFuZCBwcm9tcHQgc2hvd3Mgbm90aGluZ1xyXG59XHJcbnZhciB2ZXJib3NlPTAsIHJlYWRMb2c9ZnVuY3Rpb24oKXt9O1xyXG52YXIgX3JlYWRMb2c9ZnVuY3Rpb24ocmVhZHR5cGUsYnl0ZXMpIHtcclxuXHRjb25zb2xlLmxvZyhyZWFkdHlwZSxieXRlcyxcImJ5dGVzXCIpO1xyXG59XHJcbmlmICh2ZXJib3NlKSByZWFkTG9nPV9yZWFkTG9nO1xyXG52YXIgc3Ryc2VwPVwiXFx1ZmZmZlwiO1xyXG52YXIgQ3JlYXRlPWZ1bmN0aW9uKHBhdGgsb3B0cyxjYikge1xyXG5cdC8qIGxvYWR4eHggZnVuY3Rpb25zIG1vdmUgZmlsZSBwb2ludGVyICovXHJcblx0Ly8gbG9hZCB2YXJpYWJsZSBsZW5ndGggaW50XHJcblx0aWYgKHR5cGVvZiBvcHRzPT1cImZ1bmN0aW9uXCIpIHtcclxuXHRcdGNiPW9wdHM7XHJcblx0XHRvcHRzPXt9O1xyXG5cdH1cclxuXHJcblx0XHJcblx0dmFyIGxvYWRWSW50ID1mdW5jdGlvbihvcHRzLGJsb2Nrc2l6ZSxjb3VudCxjYikge1xyXG5cdFx0Ly9pZiAoY291bnQ9PTApIHJldHVybiBbXTtcclxuXHRcdHZhciB0aGF0PXRoaXM7XHJcblxyXG5cdFx0dGhpcy5mcy5yZWFkQnVmX3BhY2tlZGludChvcHRzLmN1cixibG9ja3NpemUsY291bnQsdHJ1ZSxmdW5jdGlvbihvKXtcclxuXHRcdFx0Ly9jb25zb2xlLmxvZyhcInZpbnRcIik7XHJcblx0XHRcdG9wdHMuY3VyKz1vLmFkdjtcclxuXHRcdFx0Y2IuYXBwbHkodGhhdCxbby5kYXRhXSk7XHJcblx0XHR9KTtcclxuXHR9XHJcblx0dmFyIGxvYWRWSW50MT1mdW5jdGlvbihvcHRzLGNiKSB7XHJcblx0XHR2YXIgdGhhdD10aGlzO1xyXG5cdFx0bG9hZFZJbnQuYXBwbHkodGhpcyxbb3B0cyw2LDEsZnVuY3Rpb24oZGF0YSl7XHJcblx0XHRcdC8vY29uc29sZS5sb2coXCJ2aW50MVwiKTtcclxuXHRcdFx0Y2IuYXBwbHkodGhhdCxbZGF0YVswXV0pO1xyXG5cdFx0fV0pXHJcblx0fVxyXG5cdC8vZm9yIHBvc3RpbmdzXHJcblx0dmFyIGxvYWRQSW50ID1mdW5jdGlvbihvcHRzLGJsb2Nrc2l6ZSxjb3VudCxjYikge1xyXG5cdFx0dmFyIHRoYXQ9dGhpcztcclxuXHRcdHRoaXMuZnMucmVhZEJ1Zl9wYWNrZWRpbnQob3B0cy5jdXIsYmxvY2tzaXplLGNvdW50LGZhbHNlLGZ1bmN0aW9uKG8pe1xyXG5cdFx0XHQvL2NvbnNvbGUubG9nKFwicGludFwiKTtcclxuXHRcdFx0b3B0cy5jdXIrPW8uYWR2O1xyXG5cdFx0XHRjYi5hcHBseSh0aGF0LFtvLmRhdGFdKTtcclxuXHRcdH0pO1xyXG5cdH1cclxuXHQvLyBpdGVtIGNhbiBiZSBhbnkgdHlwZSAodmFyaWFibGUgbGVuZ3RoKVxyXG5cdC8vIG1heGltdW0gc2l6ZSBvZiBhcnJheSBpcyAxVEIgMl40MFxyXG5cdC8vIHN0cnVjdHVyZTpcclxuXHQvLyBzaWduYXR1cmUsNSBieXRlcyBvZmZzZXQsIHBheWxvYWQsIGl0ZW1sZW5ndGhzXHJcblx0dmFyIGdldEFycmF5TGVuZ3RoPWZ1bmN0aW9uKG9wdHMsY2IpIHtcclxuXHRcdHZhciB0aGF0PXRoaXM7XHJcblx0XHR2YXIgZGF0YW9mZnNldD0wO1xyXG5cclxuXHRcdHRoaXMuZnMucmVhZFVJOChvcHRzLmN1cixmdW5jdGlvbihsZW4pe1xyXG5cdFx0XHR2YXIgbGVuZ3Rob2Zmc2V0PWxlbio0Mjk0OTY3Mjk2O1xyXG5cdFx0XHRvcHRzLmN1cisrO1xyXG5cdFx0XHR0aGF0LmZzLnJlYWRVSTMyKG9wdHMuY3VyLGZ1bmN0aW9uKGxlbil7XHJcblx0XHRcdFx0b3B0cy5jdXIrPTQ7XHJcblx0XHRcdFx0ZGF0YW9mZnNldD1vcHRzLmN1cjsgLy9rZWVwIHRoaXNcclxuXHRcdFx0XHRsZW5ndGhvZmZzZXQrPWxlbjtcclxuXHRcdFx0XHRvcHRzLmN1cis9bGVuZ3Rob2Zmc2V0O1xyXG5cclxuXHRcdFx0XHRsb2FkVkludDEuYXBwbHkodGhhdCxbb3B0cyxmdW5jdGlvbihjb3VudCl7XHJcblx0XHRcdFx0XHRsb2FkVkludC5hcHBseSh0aGF0LFtvcHRzLGNvdW50KjYsY291bnQsZnVuY3Rpb24oc3ope1x0XHRcdFx0XHRcdFxyXG5cdFx0XHRcdFx0XHRjYih7Y291bnQ6Y291bnQsc3o6c3osb2Zmc2V0OmRhdGFvZmZzZXR9KTtcclxuXHRcdFx0XHRcdH1dKTtcclxuXHRcdFx0XHR9XSk7XHJcblx0XHRcdFx0XHJcblx0XHRcdH0pO1xyXG5cdFx0fSk7XHJcblx0fVxyXG5cclxuXHR2YXIgbG9hZEFycmF5ID0gZnVuY3Rpb24ob3B0cyxibG9ja3NpemUsY2IpIHtcclxuXHRcdHZhciB0aGF0PXRoaXM7XHJcblx0XHRnZXRBcnJheUxlbmd0aC5hcHBseSh0aGlzLFtvcHRzLGZ1bmN0aW9uKEwpe1xyXG5cdFx0XHRcdHZhciBvPVtdO1xyXG5cdFx0XHRcdHZhciBlbmRjdXI9b3B0cy5jdXI7XHJcblx0XHRcdFx0b3B0cy5jdXI9TC5vZmZzZXQ7XHJcblxyXG5cdFx0XHRcdGlmIChvcHRzLmxhenkpIHsgXHJcblx0XHRcdFx0XHRcdHZhciBvZmZzZXQ9TC5vZmZzZXQ7XHJcblx0XHRcdFx0XHRcdEwuc3oubWFwKGZ1bmN0aW9uKHN6KXtcclxuXHRcdFx0XHRcdFx0XHRvW28ubGVuZ3RoXT1zdHJzZXArb2Zmc2V0LnRvU3RyaW5nKDE2KVxyXG5cdFx0XHRcdFx0XHRcdFx0ICAgK3N0cnNlcCtzei50b1N0cmluZygxNik7XHJcblx0XHRcdFx0XHRcdFx0b2Zmc2V0Kz1zejtcclxuXHRcdFx0XHRcdFx0fSlcclxuXHRcdFx0XHR9IGVsc2Uge1xyXG5cdFx0XHRcdFx0dmFyIHRhc2txdWV1ZT1bXTtcclxuXHRcdFx0XHRcdGZvciAodmFyIGk9MDtpPEwuY291bnQ7aSsrKSB7XHJcblx0XHRcdFx0XHRcdHRhc2txdWV1ZS5wdXNoKFxyXG5cdFx0XHRcdFx0XHRcdChmdW5jdGlvbihzeil7XHJcblx0XHRcdFx0XHRcdFx0XHRyZXR1cm4gKFxyXG5cdFx0XHRcdFx0XHRcdFx0XHRmdW5jdGlvbihkYXRhKXtcclxuXHRcdFx0XHRcdFx0XHRcdFx0XHRpZiAodHlwZW9mIGRhdGE9PSdvYmplY3QnICYmIGRhdGEuX19lbXB0eSkge1xyXG5cdFx0XHRcdFx0XHRcdFx0XHRcdFx0IC8vbm90IHB1c2hpbmcgdGhlIGZpcnN0IGNhbGxcclxuXHRcdFx0XHRcdFx0XHRcdFx0XHR9XHRlbHNlIG8ucHVzaChkYXRhKTtcclxuXHRcdFx0XHRcdFx0XHRcdFx0XHRvcHRzLmJsb2Nrc2l6ZT1zejtcclxuXHRcdFx0XHRcdFx0XHRcdFx0XHRsb2FkLmFwcGx5KHRoYXQsW29wdHMsIHRhc2txdWV1ZS5zaGlmdCgpXSk7XHJcblx0XHRcdFx0XHRcdFx0XHRcdH1cclxuXHRcdFx0XHRcdFx0XHRcdCk7XHJcblx0XHRcdFx0XHRcdFx0fSkoTC5zeltpXSlcclxuXHRcdFx0XHRcdFx0KTtcclxuXHRcdFx0XHRcdH1cclxuXHRcdFx0XHRcdC8vbGFzdCBjYWxsIHRvIGNoaWxkIGxvYWRcclxuXHRcdFx0XHRcdHRhc2txdWV1ZS5wdXNoKGZ1bmN0aW9uKGRhdGEpe1xyXG5cdFx0XHRcdFx0XHRvLnB1c2goZGF0YSk7XHJcblx0XHRcdFx0XHRcdG9wdHMuY3VyPWVuZGN1cjtcclxuXHRcdFx0XHRcdFx0Y2IuYXBwbHkodGhhdCxbb10pO1xyXG5cdFx0XHRcdFx0fSk7XHJcblx0XHRcdFx0fVxyXG5cclxuXHRcdFx0XHRpZiAob3B0cy5sYXp5KSBjYi5hcHBseSh0aGF0LFtvXSk7XHJcblx0XHRcdFx0ZWxzZSB7XHJcblx0XHRcdFx0XHR0YXNrcXVldWUuc2hpZnQoKSh7X19lbXB0eTp0cnVlfSk7XHJcblx0XHRcdFx0fVxyXG5cdFx0XHR9XHJcblx0XHRdKVxyXG5cdH1cdFx0XHJcblx0Ly8gaXRlbSBjYW4gYmUgYW55IHR5cGUgKHZhcmlhYmxlIGxlbmd0aClcclxuXHQvLyBzdXBwb3J0IGxhenkgbG9hZFxyXG5cdC8vIHN0cnVjdHVyZTpcclxuXHQvLyBzaWduYXR1cmUsNSBieXRlcyBvZmZzZXQsIHBheWxvYWQsIGl0ZW1sZW5ndGhzLCBcclxuXHQvLyAgICAgICAgICAgICAgICAgICAgc3RyaW5nYXJyYXlfc2lnbmF0dXJlLCBrZXlzXHJcblx0dmFyIGxvYWRPYmplY3QgPSBmdW5jdGlvbihvcHRzLGJsb2Nrc2l6ZSxjYikge1xyXG5cdFx0dmFyIHRoYXQ9dGhpcztcclxuXHRcdHZhciBzdGFydD1vcHRzLmN1cjtcclxuXHRcdGdldEFycmF5TGVuZ3RoLmFwcGx5KHRoaXMsW29wdHMsZnVuY3Rpb24oTCkge1xyXG5cdFx0XHRvcHRzLmJsb2Nrc2l6ZT1ibG9ja3NpemUtb3B0cy5jdXIrc3RhcnQ7XHJcblx0XHRcdGxvYWQuYXBwbHkodGhhdCxbb3B0cyxmdW5jdGlvbihrZXlzKXsgLy9sb2FkIHRoZSBrZXlzXHJcblx0XHRcdFx0aWYgKG9wdHMua2V5cykgeyAvL2NhbGxlciBhc2sgZm9yIGtleXNcclxuXHRcdFx0XHRcdGtleXMubWFwKGZ1bmN0aW9uKGspIHsgb3B0cy5rZXlzLnB1c2goayl9KTtcclxuXHRcdFx0XHR9XHJcblxyXG5cdFx0XHRcdHZhciBvPXt9O1xyXG5cdFx0XHRcdHZhciBlbmRjdXI9b3B0cy5jdXI7XHJcblx0XHRcdFx0b3B0cy5jdXI9TC5vZmZzZXQ7XHJcblx0XHRcdFx0aWYgKG9wdHMubGF6eSkgeyBcclxuXHRcdFx0XHRcdHZhciBvZmZzZXQ9TC5vZmZzZXQ7XHJcblx0XHRcdFx0XHRmb3IgKHZhciBpPTA7aTxMLnN6Lmxlbmd0aDtpKyspIHtcclxuXHRcdFx0XHRcdFx0Ly9wcmVmaXggd2l0aCBhIFxcMCwgaW1wb3NzaWJsZSBmb3Igbm9ybWFsIHN0cmluZ1xyXG5cdFx0XHRcdFx0XHRvW2tleXNbaV1dPXN0cnNlcCtvZmZzZXQudG9TdHJpbmcoMTYpXHJcblx0XHRcdFx0XHRcdFx0ICAgK3N0cnNlcCtMLnN6W2ldLnRvU3RyaW5nKDE2KTtcclxuXHRcdFx0XHRcdFx0b2Zmc2V0Kz1MLnN6W2ldO1xyXG5cdFx0XHRcdFx0fVxyXG5cdFx0XHRcdH0gZWxzZSB7XHJcblx0XHRcdFx0XHR2YXIgdGFza3F1ZXVlPVtdO1xyXG5cdFx0XHRcdFx0Zm9yICh2YXIgaT0wO2k8TC5jb3VudDtpKyspIHtcclxuXHRcdFx0XHRcdFx0dGFza3F1ZXVlLnB1c2goXHJcblx0XHRcdFx0XHRcdFx0KGZ1bmN0aW9uKHN6LGtleSl7XHJcblx0XHRcdFx0XHRcdFx0XHRyZXR1cm4gKFxyXG5cdFx0XHRcdFx0XHRcdFx0XHRmdW5jdGlvbihkYXRhKXtcclxuXHRcdFx0XHRcdFx0XHRcdFx0XHRpZiAodHlwZW9mIGRhdGE9PSdvYmplY3QnICYmIGRhdGEuX19lbXB0eSkge1xyXG5cdFx0XHRcdFx0XHRcdFx0XHRcdFx0Ly9ub3Qgc2F2aW5nIHRoZSBmaXJzdCBjYWxsO1xyXG5cdFx0XHRcdFx0XHRcdFx0XHRcdH0gZWxzZSB7XHJcblx0XHRcdFx0XHRcdFx0XHRcdFx0XHRvW2tleV09ZGF0YTsgXHJcblx0XHRcdFx0XHRcdFx0XHRcdFx0fVxyXG5cdFx0XHRcdFx0XHRcdFx0XHRcdG9wdHMuYmxvY2tzaXplPXN6O1xyXG5cdFx0XHRcdFx0XHRcdFx0XHRcdGlmICh2ZXJib3NlKSByZWFkTG9nKFwia2V5XCIsa2V5KTtcclxuXHRcdFx0XHRcdFx0XHRcdFx0XHRsb2FkLmFwcGx5KHRoYXQsW29wdHMsIHRhc2txdWV1ZS5zaGlmdCgpXSk7XHJcblx0XHRcdFx0XHRcdFx0XHRcdH1cclxuXHRcdFx0XHRcdFx0XHRcdCk7XHJcblx0XHRcdFx0XHRcdFx0fSkoTC5zeltpXSxrZXlzW2ktMV0pXHJcblxyXG5cdFx0XHRcdFx0XHQpO1xyXG5cdFx0XHRcdFx0fVxyXG5cdFx0XHRcdFx0Ly9sYXN0IGNhbGwgdG8gY2hpbGQgbG9hZFxyXG5cdFx0XHRcdFx0dGFza3F1ZXVlLnB1c2goZnVuY3Rpb24oZGF0YSl7XHJcblx0XHRcdFx0XHRcdG9ba2V5c1trZXlzLmxlbmd0aC0xXV09ZGF0YTtcclxuXHRcdFx0XHRcdFx0b3B0cy5jdXI9ZW5kY3VyO1xyXG5cdFx0XHRcdFx0XHRjYi5hcHBseSh0aGF0LFtvXSk7XHJcblx0XHRcdFx0XHR9KTtcclxuXHRcdFx0XHR9XHJcblx0XHRcdFx0aWYgKG9wdHMubGF6eSkgY2IuYXBwbHkodGhhdCxbb10pO1xyXG5cdFx0XHRcdGVsc2Uge1xyXG5cdFx0XHRcdFx0dGFza3F1ZXVlLnNoaWZ0KCkoe19fZW1wdHk6dHJ1ZX0pO1xyXG5cdFx0XHRcdH1cclxuXHRcdFx0fV0pO1xyXG5cdFx0fV0pO1xyXG5cdH1cclxuXHJcblx0Ly9pdGVtIGlzIHNhbWUga25vd24gdHlwZVxyXG5cdHZhciBsb2FkU3RyaW5nQXJyYXk9ZnVuY3Rpb24ob3B0cyxibG9ja3NpemUsZW5jb2RpbmcsY2IpIHtcclxuXHRcdHZhciB0aGF0PXRoaXM7XHJcblx0XHR0aGlzLmZzLnJlYWRTdHJpbmdBcnJheShvcHRzLmN1cixibG9ja3NpemUsZW5jb2RpbmcsZnVuY3Rpb24obyl7XHJcblx0XHRcdG9wdHMuY3VyKz1ibG9ja3NpemU7XHJcblx0XHRcdGNiLmFwcGx5KHRoYXQsW29dKTtcclxuXHRcdH0pO1xyXG5cdH1cclxuXHR2YXIgbG9hZEludGVnZXJBcnJheT1mdW5jdGlvbihvcHRzLGJsb2Nrc2l6ZSx1bml0c2l6ZSxjYikge1xyXG5cdFx0dmFyIHRoYXQ9dGhpcztcclxuXHRcdGxvYWRWSW50MS5hcHBseSh0aGlzLFtvcHRzLGZ1bmN0aW9uKGNvdW50KXtcclxuXHRcdFx0dmFyIG89dGhhdC5mcy5yZWFkRml4ZWRBcnJheShvcHRzLmN1cixjb3VudCx1bml0c2l6ZSxmdW5jdGlvbihvKXtcclxuXHRcdFx0XHRvcHRzLmN1cis9Y291bnQqdW5pdHNpemU7XHJcblx0XHRcdFx0Y2IuYXBwbHkodGhhdCxbb10pO1xyXG5cdFx0XHR9KTtcclxuXHRcdH1dKTtcclxuXHR9XHJcblx0dmFyIGxvYWRCbG9iPWZ1bmN0aW9uKGJsb2Nrc2l6ZSxjYikge1xyXG5cdFx0dmFyIG89dGhpcy5mcy5yZWFkQnVmKHRoaXMuY3VyLGJsb2Nrc2l6ZSk7XHJcblx0XHR0aGlzLmN1cis9YmxvY2tzaXplO1xyXG5cdFx0cmV0dXJuIG87XHJcblx0fVx0XHJcblx0dmFyIGxvYWRieXNpZ25hdHVyZT1mdW5jdGlvbihvcHRzLHNpZ25hdHVyZSxjYikge1xyXG5cdFx0ICB2YXIgYmxvY2tzaXplPW9wdHMuYmxvY2tzaXplfHx0aGlzLmZzLnNpemU7IFxyXG5cdFx0XHRvcHRzLmN1cis9dGhpcy5mcy5zaWduYXR1cmVfc2l6ZTtcclxuXHRcdFx0dmFyIGRhdGFzaXplPWJsb2Nrc2l6ZS10aGlzLmZzLnNpZ25hdHVyZV9zaXplO1xyXG5cdFx0XHQvL2Jhc2ljIHR5cGVzXHJcblx0XHRcdGlmIChzaWduYXR1cmU9PT1EVC5pbnQzMikge1xyXG5cdFx0XHRcdG9wdHMuY3VyKz00O1xyXG5cdFx0XHRcdHRoaXMuZnMucmVhZEkzMihvcHRzLmN1ci00LGNiKTtcclxuXHRcdFx0fSBlbHNlIGlmIChzaWduYXR1cmU9PT1EVC51aW50OCkge1xyXG5cdFx0XHRcdG9wdHMuY3VyKys7XHJcblx0XHRcdFx0dGhpcy5mcy5yZWFkVUk4KG9wdHMuY3VyLTEsY2IpO1xyXG5cdFx0XHR9IGVsc2UgaWYgKHNpZ25hdHVyZT09PURULnV0ZjgpIHtcclxuXHRcdFx0XHR2YXIgYz1vcHRzLmN1cjtvcHRzLmN1cis9ZGF0YXNpemU7XHJcblx0XHRcdFx0dGhpcy5mcy5yZWFkU3RyaW5nKGMsZGF0YXNpemUsJ3V0ZjgnLGNiKTtcclxuXHRcdFx0fSBlbHNlIGlmIChzaWduYXR1cmU9PT1EVC51Y3MyKSB7XHJcblx0XHRcdFx0dmFyIGM9b3B0cy5jdXI7b3B0cy5jdXIrPWRhdGFzaXplO1xyXG5cdFx0XHRcdHRoaXMuZnMucmVhZFN0cmluZyhjLGRhdGFzaXplLCd1Y3MyJyxjYik7XHRcclxuXHRcdFx0fSBlbHNlIGlmIChzaWduYXR1cmU9PT1EVC5ib29sKSB7XHJcblx0XHRcdFx0b3B0cy5jdXIrKztcclxuXHRcdFx0XHR0aGlzLmZzLnJlYWRVSTgob3B0cy5jdXItMSxmdW5jdGlvbihkYXRhKXtjYighIWRhdGEpfSk7XHJcblx0XHRcdH0gZWxzZSBpZiAoc2lnbmF0dXJlPT09RFQuYmxvYikge1xyXG5cdFx0XHRcdGxvYWRCbG9iKGRhdGFzaXplLGNiKTtcclxuXHRcdFx0fVxyXG5cdFx0XHQvL3ZhcmlhYmxlIGxlbmd0aCBpbnRlZ2Vyc1xyXG5cdFx0XHRlbHNlIGlmIChzaWduYXR1cmU9PT1EVC52aW50KSB7XHJcblx0XHRcdFx0bG9hZFZJbnQuYXBwbHkodGhpcyxbb3B0cyxkYXRhc2l6ZSxkYXRhc2l6ZSxjYl0pO1xyXG5cdFx0XHR9XHJcblx0XHRcdGVsc2UgaWYgKHNpZ25hdHVyZT09PURULnBpbnQpIHtcclxuXHRcdFx0XHRsb2FkUEludC5hcHBseSh0aGlzLFtvcHRzLGRhdGFzaXplLGRhdGFzaXplLGNiXSk7XHJcblx0XHRcdH1cclxuXHRcdFx0Ly9zaW1wbGUgYXJyYXlcclxuXHRcdFx0ZWxzZSBpZiAoc2lnbmF0dXJlPT09RFQudXRmOGFycikge1xyXG5cdFx0XHRcdGxvYWRTdHJpbmdBcnJheS5hcHBseSh0aGlzLFtvcHRzLGRhdGFzaXplLCd1dGY4JyxjYl0pO1xyXG5cdFx0XHR9XHJcblx0XHRcdGVsc2UgaWYgKHNpZ25hdHVyZT09PURULnVjczJhcnIpIHtcclxuXHRcdFx0XHRsb2FkU3RyaW5nQXJyYXkuYXBwbHkodGhpcyxbb3B0cyxkYXRhc2l6ZSwndWNzMicsY2JdKTtcclxuXHRcdFx0fVxyXG5cdFx0XHRlbHNlIGlmIChzaWduYXR1cmU9PT1EVC51aW50OGFycikge1xyXG5cdFx0XHRcdGxvYWRJbnRlZ2VyQXJyYXkuYXBwbHkodGhpcyxbb3B0cyxkYXRhc2l6ZSwxLGNiXSk7XHJcblx0XHRcdH1cclxuXHRcdFx0ZWxzZSBpZiAoc2lnbmF0dXJlPT09RFQuaW50MzJhcnIpIHtcclxuXHRcdFx0XHRsb2FkSW50ZWdlckFycmF5LmFwcGx5KHRoaXMsW29wdHMsZGF0YXNpemUsNCxjYl0pO1xyXG5cdFx0XHR9XHJcblx0XHRcdC8vbmVzdGVkIHN0cnVjdHVyZVxyXG5cdFx0XHRlbHNlIGlmIChzaWduYXR1cmU9PT1EVC5hcnJheSkge1xyXG5cdFx0XHRcdGxvYWRBcnJheS5hcHBseSh0aGlzLFtvcHRzLGRhdGFzaXplLGNiXSk7XHJcblx0XHRcdH1cclxuXHRcdFx0ZWxzZSBpZiAoc2lnbmF0dXJlPT09RFQub2JqZWN0KSB7XHJcblx0XHRcdFx0bG9hZE9iamVjdC5hcHBseSh0aGlzLFtvcHRzLGRhdGFzaXplLGNiXSk7XHJcblx0XHRcdH1cclxuXHRcdFx0ZWxzZSB7XHJcblx0XHRcdFx0Y29uc29sZS5lcnJvcigndW5zdXBwb3J0ZWQgdHlwZScsc2lnbmF0dXJlLG9wdHMpXHJcblx0XHRcdFx0Y2IuYXBwbHkodGhpcyxbbnVsbF0pOy8vbWFrZSBzdXJlIGl0IHJldHVyblxyXG5cdFx0XHRcdC8vdGhyb3cgJ3Vuc3VwcG9ydGVkIHR5cGUgJytzaWduYXR1cmU7XHJcblx0XHRcdH1cclxuXHR9XHJcblxyXG5cdHZhciBsb2FkPWZ1bmN0aW9uKG9wdHMsY2IpIHtcclxuXHRcdG9wdHM9b3B0c3x8e307IC8vIHRoaXMgd2lsbCBzZXJ2ZWQgYXMgY29udGV4dCBmb3IgZW50aXJlIGxvYWQgcHJvY2VkdXJlXHJcblx0XHRvcHRzLmN1cj1vcHRzLmN1cnx8MDtcclxuXHRcdHZhciB0aGF0PXRoaXM7XHJcblx0XHR0aGlzLmZzLnJlYWRTaWduYXR1cmUob3B0cy5jdXIsIGZ1bmN0aW9uKHNpZ25hdHVyZSl7XHJcblx0XHRcdGxvYWRieXNpZ25hdHVyZS5hcHBseSh0aGF0LFtvcHRzLHNpZ25hdHVyZSxjYl0pXHJcblx0XHR9KTtcclxuXHRcdHJldHVybiB0aGlzO1xyXG5cdH1cclxuXHR2YXIgQ0FDSEU9bnVsbDtcclxuXHR2YXIgS0VZPXt9O1xyXG5cdHZhciBBRERSRVNTPXt9O1xyXG5cdHZhciByZXNldD1mdW5jdGlvbihjYikge1xyXG5cdFx0aWYgKCFDQUNIRSkge1xyXG5cdFx0XHRsb2FkLmFwcGx5KHRoaXMsW3tjdXI6MCxsYXp5OnRydWV9LGZ1bmN0aW9uKGRhdGEpe1xyXG5cdFx0XHRcdENBQ0hFPWRhdGE7XHJcblx0XHRcdFx0Y2IuY2FsbCh0aGlzKTtcclxuXHRcdFx0fV0pO1x0XHJcblx0XHR9IGVsc2Uge1xyXG5cdFx0XHRjYi5jYWxsKHRoaXMpO1xyXG5cdFx0fVxyXG5cdH1cclxuXHJcblx0dmFyIGV4aXN0cz1mdW5jdGlvbihwYXRoLGNiKSB7XHJcblx0XHRpZiAocGF0aC5sZW5ndGg9PTApIHJldHVybiB0cnVlO1xyXG5cdFx0dmFyIGtleT1wYXRoLnBvcCgpO1xyXG5cdFx0dmFyIHRoYXQ9dGhpcztcclxuXHRcdGdldC5hcHBseSh0aGlzLFtwYXRoLGZhbHNlLGZ1bmN0aW9uKGRhdGEpe1xyXG5cdFx0XHRpZiAoIXBhdGguam9pbihzdHJzZXApKSByZXR1cm4gKCEhS0VZW2tleV0pO1xyXG5cdFx0XHR2YXIga2V5cz1LRVlbcGF0aC5qb2luKHN0cnNlcCldO1xyXG5cdFx0XHRwYXRoLnB1c2goa2V5KTsvL3B1dCBpdCBiYWNrXHJcblx0XHRcdGlmIChrZXlzKSBjYi5hcHBseSh0aGF0LFtrZXlzLmluZGV4T2Yoa2V5KT4tMV0pO1xyXG5cdFx0XHRlbHNlIGNiLmFwcGx5KHRoYXQsW2ZhbHNlXSk7XHJcblx0XHR9XSk7XHJcblx0fVxyXG5cclxuXHR2YXIgZ2V0U3luYz1mdW5jdGlvbihwYXRoKSB7XHJcblx0XHRpZiAoIUNBQ0hFKSByZXR1cm4gdW5kZWZpbmVkO1x0XHJcblx0XHR2YXIgbz1DQUNIRTtcclxuXHRcdGZvciAodmFyIGk9MDtpPHBhdGgubGVuZ3RoO2krKykge1xyXG5cdFx0XHR2YXIgcj1vW3BhdGhbaV1dO1xyXG5cdFx0XHRpZiAodHlwZW9mIHI9PVwidW5kZWZpbmVkXCIpIHJldHVybiBudWxsO1xyXG5cdFx0XHRvPXI7XHJcblx0XHR9XHJcblx0XHRyZXR1cm4gbztcclxuXHR9XHJcblx0dmFyIGdldD1mdW5jdGlvbihwYXRoLG9wdHMsY2IpIHtcclxuXHRcdGlmICh0eXBlb2YgcGF0aD09J3VuZGVmaW5lZCcpIHBhdGg9W107XHJcblx0XHRpZiAodHlwZW9mIHBhdGg9PVwic3RyaW5nXCIpIHBhdGg9W3BhdGhdO1xyXG5cdFx0Ly9vcHRzLnJlY3Vyc2l2ZT0hIW9wdHMucmVjdXJzaXZlO1xyXG5cdFx0dmFyIHRoYXQ9dGhpcztcclxuXHRcdGlmICh0eXBlb2YgY2IhPSdmdW5jdGlvbicpIHJldHVybiBnZXRTeW5jKHBhdGgpO1xyXG5cclxuXHRcdHJlc2V0LmFwcGx5KHRoaXMsW2Z1bmN0aW9uKCl7XHJcblx0XHRcdHZhciBvPUNBQ0hFO1xyXG5cdFx0XHRpZiAocGF0aC5sZW5ndGg9PTApIHtcclxuXHRcdFx0XHRpZiAob3B0cy5hZGRyZXNzKSB7XHJcblx0XHRcdFx0XHRjYihbMCx0aGF0LmZzLnNpemVdKTtcclxuXHRcdFx0XHR9IGVsc2Uge1xyXG5cdFx0XHRcdFx0Y2IoT2JqZWN0LmtleXMoQ0FDSEUpKTtcdFxyXG5cdFx0XHRcdH1cclxuXHRcdFx0XHRyZXR1cm47XHJcblx0XHRcdH0gXHJcblx0XHRcdFxyXG5cdFx0XHR2YXIgcGF0aG5vdz1cIlwiLHRhc2txdWV1ZT1bXSxuZXdvcHRzPXt9LHI9bnVsbDtcclxuXHRcdFx0dmFyIGxhc3RrZXk9XCJcIjtcclxuXHJcblx0XHRcdGZvciAodmFyIGk9MDtpPHBhdGgubGVuZ3RoO2krKykge1xyXG5cdFx0XHRcdHZhciB0YXNrPShmdW5jdGlvbihrZXksayl7XHJcblxyXG5cdFx0XHRcdFx0cmV0dXJuIChmdW5jdGlvbihkYXRhKXtcclxuXHRcdFx0XHRcdFx0aWYgKCEodHlwZW9mIGRhdGE9PSdvYmplY3QnICYmIGRhdGEuX19lbXB0eSkpIHtcclxuXHRcdFx0XHRcdFx0XHRpZiAodHlwZW9mIG9bbGFzdGtleV09PSdzdHJpbmcnICYmIG9bbGFzdGtleV1bMF09PXN0cnNlcCkgb1tsYXN0a2V5XT17fTtcclxuXHRcdFx0XHRcdFx0XHRvW2xhc3RrZXldPWRhdGE7IFxyXG5cdFx0XHRcdFx0XHRcdG89b1tsYXN0a2V5XTtcclxuXHRcdFx0XHRcdFx0XHRyPWRhdGFba2V5XTtcclxuXHRcdFx0XHRcdFx0XHRLRVlbcGF0aG5vd109b3B0cy5rZXlzO1x0XHRcdFx0XHRcdFx0XHRcclxuXHRcdFx0XHRcdFx0fSBlbHNlIHtcclxuXHRcdFx0XHRcdFx0XHRkYXRhPW9ba2V5XTtcclxuXHRcdFx0XHRcdFx0XHRyPWRhdGE7XHJcblx0XHRcdFx0XHRcdH1cclxuXHJcblx0XHRcdFx0XHRcdGlmIChyPT09dW5kZWZpbmVkKSB7XHJcblx0XHRcdFx0XHRcdFx0dGFza3F1ZXVlPW51bGw7XHJcblx0XHRcdFx0XHRcdFx0Y2IuYXBwbHkodGhhdCxbcl0pOyAvL3JldHVybiBlbXB0eSB2YWx1ZVxyXG5cdFx0XHRcdFx0XHR9IGVsc2Uge1x0XHRcdFx0XHRcdFx0XHJcblx0XHRcdFx0XHRcdFx0aWYgKHBhcnNlSW50KGspKSBwYXRobm93Kz1zdHJzZXA7XHJcblx0XHRcdFx0XHRcdFx0cGF0aG5vdys9a2V5O1xyXG5cdFx0XHRcdFx0XHRcdGlmICh0eXBlb2Ygcj09J3N0cmluZycgJiYgclswXT09c3Ryc2VwKSB7IC8vb2Zmc2V0IG9mIGRhdGEgdG8gYmUgbG9hZGVkXHJcblx0XHRcdFx0XHRcdFx0XHR2YXIgcD1yLnN1YnN0cmluZygxKS5zcGxpdChzdHJzZXApLm1hcChmdW5jdGlvbihpdGVtKXtyZXR1cm4gcGFyc2VJbnQoaXRlbSwxNil9KTtcclxuXHRcdFx0XHRcdFx0XHRcdHZhciBjdXI9cFswXSxzej1wWzFdO1xyXG5cdFx0XHRcdFx0XHRcdFx0bmV3b3B0cy5sYXp5PSFvcHRzLnJlY3Vyc2l2ZSB8fCAoazxwYXRoLmxlbmd0aC0xKSA7XHJcblx0XHRcdFx0XHRcdFx0XHRuZXdvcHRzLmJsb2Nrc2l6ZT1zejtuZXdvcHRzLmN1cj1jdXIsbmV3b3B0cy5rZXlzPVtdO1xyXG5cdFx0XHRcdFx0XHRcdFx0bGFzdGtleT1rZXk7IC8vbG9hZCBpcyBzeW5jIGluIGFuZHJvaWRcclxuXHRcdFx0XHRcdFx0XHRcdGlmIChvcHRzLmFkZHJlc3MgJiYgdGFza3F1ZXVlLmxlbmd0aD09MSkge1xyXG5cdFx0XHRcdFx0XHRcdFx0XHRBRERSRVNTW3BhdGhub3ddPVtjdXIsc3pdO1xyXG5cdFx0XHRcdFx0XHRcdFx0XHR0YXNrcXVldWUuc2hpZnQoKShudWxsLEFERFJFU1NbcGF0aG5vd10pO1xyXG5cdFx0XHRcdFx0XHRcdFx0fSBlbHNlIHtcclxuXHRcdFx0XHRcdFx0XHRcdFx0bG9hZC5hcHBseSh0aGF0LFtuZXdvcHRzLCB0YXNrcXVldWUuc2hpZnQoKV0pO1xyXG5cdFx0XHRcdFx0XHRcdFx0fVxyXG5cdFx0XHRcdFx0XHRcdH0gZWxzZSB7XHJcblx0XHRcdFx0XHRcdFx0XHRpZiAob3B0cy5hZGRyZXNzICYmIHRhc2txdWV1ZS5sZW5ndGg9PTEpIHtcclxuXHRcdFx0XHRcdFx0XHRcdFx0dGFza3F1ZXVlLnNoaWZ0KCkobnVsbCxBRERSRVNTW3BhdGhub3ddKTtcclxuXHRcdFx0XHRcdFx0XHRcdH0gZWxzZSB7XHJcblx0XHRcdFx0XHRcdFx0XHRcdHRhc2txdWV1ZS5zaGlmdCgpLmFwcGx5KHRoYXQsW3JdKTtcclxuXHRcdFx0XHRcdFx0XHRcdH1cclxuXHRcdFx0XHRcdFx0XHR9XHJcblx0XHRcdFx0XHRcdH1cclxuXHRcdFx0XHRcdH0pXHJcblx0XHRcdFx0fSlcclxuXHRcdFx0XHQocGF0aFtpXSxpKTtcclxuXHRcdFx0XHRcclxuXHRcdFx0XHR0YXNrcXVldWUucHVzaCh0YXNrKTtcclxuXHRcdFx0fVxyXG5cclxuXHRcdFx0aWYgKHRhc2txdWV1ZS5sZW5ndGg9PTApIHtcclxuXHRcdFx0XHRjYi5hcHBseSh0aGF0LFtvXSk7XHJcblx0XHRcdH0gZWxzZSB7XHJcblx0XHRcdFx0Ly9sYXN0IGNhbGwgdG8gY2hpbGQgbG9hZFxyXG5cdFx0XHRcdHRhc2txdWV1ZS5wdXNoKGZ1bmN0aW9uKGRhdGEsY3Vyc3ope1xyXG5cdFx0XHRcdFx0aWYgKG9wdHMuYWRkcmVzcykge1xyXG5cdFx0XHRcdFx0XHRjYi5hcHBseSh0aGF0LFtjdXJzel0pO1xyXG5cdFx0XHRcdFx0fSBlbHNle1xyXG5cdFx0XHRcdFx0XHR2YXIga2V5PXBhdGhbcGF0aC5sZW5ndGgtMV07XHJcblx0XHRcdFx0XHRcdG9ba2V5XT1kYXRhOyBLRVlbcGF0aG5vd109b3B0cy5rZXlzO1xyXG5cdFx0XHRcdFx0XHRjYi5hcHBseSh0aGF0LFtkYXRhXSk7XHJcblx0XHRcdFx0XHR9XHJcblx0XHRcdFx0fSk7XHJcblx0XHRcdFx0dGFza3F1ZXVlLnNoaWZ0KCkoe19fZW1wdHk6dHJ1ZX0pO1x0XHRcdFxyXG5cdFx0XHR9XHJcblxyXG5cdFx0fV0pOyAvL3Jlc2V0XHJcblx0fVxyXG5cdC8vIGdldCBhbGwga2V5cyBpbiBnaXZlbiBwYXRoXHJcblx0dmFyIGdldGtleXM9ZnVuY3Rpb24ocGF0aCxjYikge1xyXG5cdFx0aWYgKCFwYXRoKSBwYXRoPVtdXHJcblx0XHR2YXIgdGhhdD10aGlzO1xyXG5cdFx0Z2V0LmFwcGx5KHRoaXMsW3BhdGgsZmFsc2UsZnVuY3Rpb24oKXtcclxuXHRcdFx0aWYgKHBhdGggJiYgcGF0aC5sZW5ndGgpIHtcclxuXHRcdFx0XHRjYi5hcHBseSh0aGF0LFtLRVlbcGF0aC5qb2luKHN0cnNlcCldXSk7XHJcblx0XHRcdH0gZWxzZSB7XHJcblx0XHRcdFx0Y2IuYXBwbHkodGhhdCxbT2JqZWN0LmtleXMoQ0FDSEUpXSk7IFxyXG5cdFx0XHRcdC8vdG9wIGxldmVsLCBub3JtYWxseSBpdCBpcyB2ZXJ5IHNtYWxsXHJcblx0XHRcdH1cclxuXHRcdH1dKTtcclxuXHR9XHJcblxyXG5cdHZhciBzZXR1cGFwaT1mdW5jdGlvbigpIHtcclxuXHRcdHRoaXMubG9hZD1sb2FkO1xyXG4vL1x0XHR0aGlzLmN1cj0wO1xyXG5cdFx0dGhpcy5jYWNoZT1mdW5jdGlvbigpIHtyZXR1cm4gQ0FDSEV9O1xyXG5cdFx0dGhpcy5rZXk9ZnVuY3Rpb24oKSB7cmV0dXJuIEtFWX07XHJcblx0XHR0aGlzLmZyZWU9ZnVuY3Rpb24oKSB7XHJcblx0XHRcdENBQ0hFPW51bGw7XHJcblx0XHRcdEtFWT1udWxsO1xyXG5cdFx0XHR0aGlzLmZzLmZyZWUoKTtcclxuXHRcdH1cclxuXHRcdHRoaXMuc2V0Q2FjaGU9ZnVuY3Rpb24oYykge0NBQ0hFPWN9O1xyXG5cdFx0dGhpcy5rZXlzPWdldGtleXM7XHJcblx0XHR0aGlzLmdldD1nZXQ7ICAgLy8gZ2V0IGEgZmllbGQsIGxvYWQgaWYgbmVlZGVkXHJcblx0XHR0aGlzLmV4aXN0cz1leGlzdHM7XHJcblx0XHR0aGlzLkRUPURUO1xyXG5cdFx0XHJcblx0XHQvL2luc3RhbGwgdGhlIHN5bmMgdmVyc2lvbiBmb3Igbm9kZVxyXG5cdFx0aWYgKHR5cGVvZiBwcm9jZXNzIT1cInVuZGVmaW5lZFwiKSByZXF1aXJlKFwiLi9rZGJfc3luY1wiKSh0aGlzKTtcclxuXHRcdC8vaWYgKGNiKSBzZXRUaW1lb3V0KGNiLmJpbmQodGhpcyksMCk7XHJcblx0XHR2YXIgdGhhdD10aGlzO1xyXG5cdFx0dmFyIGVycj0wO1xyXG5cdFx0aWYgKGNiKSB7XHJcblx0XHRcdHNldFRpbWVvdXQoZnVuY3Rpb24oKXtcclxuXHRcdFx0XHRjYihlcnIsdGhhdCk7XHRcclxuXHRcdFx0fSwwKTtcclxuXHRcdH1cclxuXHR9XHJcblx0dmFyIHRoYXQ9dGhpcztcclxuXHR2YXIga2ZzPW5ldyBLZnMocGF0aCxvcHRzLGZ1bmN0aW9uKGVycil7XHJcblx0XHRpZiAoZXJyKSB7XHJcblx0XHRcdHNldFRpbWVvdXQoZnVuY3Rpb24oKXtcclxuXHRcdFx0XHRjYihlcnIsMCk7XHJcblx0XHRcdH0sMCk7XHJcblx0XHRcdHJldHVybiBudWxsO1xyXG5cdFx0fSBlbHNlIHtcclxuXHRcdFx0dGhhdC5zaXplPXRoaXMuc2l6ZTtcclxuXHRcdFx0c2V0dXBhcGkuY2FsbCh0aGF0KTtcdFx0XHRcclxuXHRcdH1cclxuXHR9KTtcclxuXHR0aGlzLmZzPWtmcztcclxuXHRyZXR1cm4gdGhpcztcclxufVxyXG5cclxuQ3JlYXRlLmRhdGF0eXBlcz1EVDtcclxuXHJcbmlmIChtb2R1bGUpIG1vZHVsZS5leHBvcnRzPUNyZWF0ZTtcclxuLy9yZXR1cm4gQ3JlYXRlO1xyXG4iLCIvKlxyXG4gIHN5bmNyb25pemUgdmVyc2lvbiBvZiBrZGIsIHRha2VuIGZyb20geWFkYlxyXG4qL1xyXG52YXIgS2ZzPXJlcXVpcmUoJy4va2RiZnNfc3luYycpO1xyXG5cclxudmFyIFN5bmM9ZnVuY3Rpb24oa2RiKSB7XHJcblx0dmFyIERUPWtkYi5EVDtcclxuXHR2YXIga2ZzPUtmcyhrZGIuZnMpO1xyXG5cdHZhciBjdXI9MDtcclxuXHQvKiBsb2FkeHh4IGZ1bmN0aW9ucyBtb3ZlIGZpbGUgcG9pbnRlciAqL1xyXG5cdC8vIGxvYWQgdmFyaWFibGUgbGVuZ3RoIGludFxyXG5cdHZhciBsb2FkVkludCA9ZnVuY3Rpb24oYmxvY2tzaXplLGNvdW50KSB7XHJcblx0XHRpZiAoY291bnQ9PTApIHJldHVybiBbXTtcclxuXHRcdHZhciBvPWtmcy5yZWFkQnVmX3BhY2tlZGludFN5bmMoY3VyLGJsb2Nrc2l6ZSxjb3VudCx0cnVlKTtcclxuXHRcdGN1cis9by5hZHY7XHJcblx0XHRyZXR1cm4gby5kYXRhO1xyXG5cdH1cclxuXHR2YXIgbG9hZFZJbnQxPWZ1bmN0aW9uKCkge1xyXG5cdFx0cmV0dXJuIGxvYWRWSW50KDYsMSlbMF07XHJcblx0fVxyXG5cdC8vZm9yIHBvc3RpbmdzXHJcblx0dmFyIGxvYWRQSW50ID1mdW5jdGlvbihibG9ja3NpemUsY291bnQpIHtcclxuXHRcdHZhciBvPWtmcy5yZWFkQnVmX3BhY2tlZGludFN5bmMoY3VyLGJsb2Nrc2l6ZSxjb3VudCxmYWxzZSk7XHJcblx0XHRjdXIrPW8uYWR2O1xyXG5cdFx0cmV0dXJuIG8uZGF0YTtcclxuXHR9XHJcblx0Ly8gaXRlbSBjYW4gYmUgYW55IHR5cGUgKHZhcmlhYmxlIGxlbmd0aClcclxuXHQvLyBtYXhpbXVtIHNpemUgb2YgYXJyYXkgaXMgMVRCIDJeNDBcclxuXHQvLyBzdHJ1Y3R1cmU6XHJcblx0Ly8gc2lnbmF0dXJlLDUgYnl0ZXMgb2Zmc2V0LCBwYXlsb2FkLCBpdGVtbGVuZ3Roc1xyXG5cdHZhciBsb2FkQXJyYXkgPSBmdW5jdGlvbihibG9ja3NpemUsbGF6eSkge1xyXG5cdFx0dmFyIGxlbmd0aG9mZnNldD1rZnMucmVhZFVJOFN5bmMoY3VyKSo0Mjk0OTY3Mjk2O1xyXG5cdFx0bGVuZ3Rob2Zmc2V0Kz1rZnMucmVhZFVJMzJTeW5jKGN1cisxKTtcclxuXHRcdGN1cis9NTtcclxuXHRcdHZhciBkYXRhb2Zmc2V0PWN1cjtcclxuXHRcdGN1cis9bGVuZ3Rob2Zmc2V0O1xyXG5cdFx0dmFyIGNvdW50PWxvYWRWSW50MSgpO1xyXG5cdFx0dmFyIHN6PWxvYWRWSW50KGNvdW50KjYsY291bnQpO1xyXG5cdFx0dmFyIG89W107XHJcblx0XHR2YXIgZW5kY3VyPWN1cjtcclxuXHRcdGN1cj1kYXRhb2Zmc2V0OyBcclxuXHRcdGZvciAodmFyIGk9MDtpPGNvdW50O2krKykge1xyXG5cdFx0XHRpZiAobGF6eSkgeyBcclxuXHRcdFx0XHQvL3N0b3JlIHRoZSBvZmZzZXQgaW5zdGVhZCBvZiBsb2FkaW5nIGZyb20gZGlza1xyXG5cdFx0XHRcdHZhciBvZmZzZXQ9ZGF0YW9mZnNldDtcclxuXHRcdFx0XHRmb3IgKHZhciBpPTA7aTxzei5sZW5ndGg7aSsrKSB7XHJcblx0XHRcdFx0Ly9wcmVmaXggd2l0aCBhIFxcMCwgaW1wb3NzaWJsZSBmb3Igbm9ybWFsIHN0cmluZ1xyXG5cdFx0XHRcdFx0b1tvLmxlbmd0aF09XCJcXDBcIitvZmZzZXQudG9TdHJpbmcoMTYpXHJcblx0XHRcdFx0XHRcdCAgICtcIlxcMFwiK3N6W2ldLnRvU3RyaW5nKDE2KTtcclxuXHRcdFx0XHRcdG9mZnNldCs9c3pbaV07XHJcblx0XHRcdFx0fVxyXG5cdFx0XHR9IGVsc2Uge1x0XHRcdFxyXG5cdFx0XHRcdG9bby5sZW5ndGhdPWxvYWQoe2Jsb2Nrc2l6ZTpzeltpXX0pO1xyXG5cdFx0XHR9XHJcblx0XHR9XHJcblx0XHRjdXI9ZW5kY3VyO1xyXG5cdFx0cmV0dXJuIG87XHJcblx0fVx0XHRcclxuXHQvLyBpdGVtIGNhbiBiZSBhbnkgdHlwZSAodmFyaWFibGUgbGVuZ3RoKVxyXG5cdC8vIHN1cHBvcnQgbGF6eSBsb2FkXHJcblx0Ly8gc3RydWN0dXJlOlxyXG5cdC8vIHNpZ25hdHVyZSw1IGJ5dGVzIG9mZnNldCwgcGF5bG9hZCwgaXRlbWxlbmd0aHMsIFxyXG5cdC8vICAgICAgICAgICAgICAgICAgICBzdHJpbmdhcnJheV9zaWduYXR1cmUsIGtleXNcclxuXHR2YXIgbG9hZE9iamVjdCA9IGZ1bmN0aW9uKGJsb2Nrc2l6ZSxsYXp5LCBrZXlzKSB7XHJcblx0XHR2YXIgc3RhcnQ9Y3VyO1xyXG5cdFx0dmFyIGxlbmd0aG9mZnNldD1rZnMucmVhZFVJOFN5bmMoY3VyKSo0Mjk0OTY3Mjk2O1xyXG5cdFx0bGVuZ3Rob2Zmc2V0Kz1rZnMucmVhZFVJMzJTeW5jKGN1cisxKTtjdXIrPTU7XHJcblx0XHR2YXIgZGF0YW9mZnNldD1jdXI7XHJcblx0XHRjdXIrPWxlbmd0aG9mZnNldDtcclxuXHRcdHZhciBjb3VudD1sb2FkVkludDEoKTtcclxuXHRcdHZhciBsZW5ndGhzPWxvYWRWSW50KGNvdW50KjYsY291bnQpO1xyXG5cdFx0dmFyIGtleXNzaXplPWJsb2Nrc2l6ZS1jdXIrc3RhcnQ7XHRcclxuXHRcdHZhciBLPWxvYWQoe2Jsb2Nrc2l6ZTprZXlzc2l6ZX0pO1xyXG5cdFx0dmFyIG89e307XHJcblx0XHR2YXIgZW5kY3VyPWN1cjtcclxuXHRcdFxyXG5cdFx0aWYgKGxhenkpIHsgXHJcblx0XHRcdC8vc3RvcmUgdGhlIG9mZnNldCBpbnN0ZWFkIG9mIGxvYWRpbmcgZnJvbSBkaXNrXHJcblx0XHRcdHZhciBvZmZzZXQ9ZGF0YW9mZnNldDtcclxuXHRcdFx0Zm9yICh2YXIgaT0wO2k8bGVuZ3Rocy5sZW5ndGg7aSsrKSB7XHJcblx0XHRcdFx0Ly9wcmVmaXggd2l0aCBhIFxcMCwgaW1wb3NzaWJsZSBmb3Igbm9ybWFsIHN0cmluZ1xyXG5cdFx0XHRcdG9bS1tpXV09XCJcXDBcIitvZmZzZXQudG9TdHJpbmcoMTYpXHJcblx0XHRcdFx0XHQgICArXCJcXDBcIitsZW5ndGhzW2ldLnRvU3RyaW5nKDE2KTtcclxuXHRcdFx0XHRvZmZzZXQrPWxlbmd0aHNbaV07XHJcblx0XHRcdH1cclxuXHRcdH0gZWxzZSB7XHJcblx0XHRcdGN1cj1kYXRhb2Zmc2V0OyBcclxuXHRcdFx0Zm9yICh2YXIgaT0wO2k8Y291bnQ7aSsrKSB7XHJcblx0XHRcdFx0b1tLW2ldXT0obG9hZCh7YmxvY2tzaXplOmxlbmd0aHNbaV19KSk7XHJcblx0XHRcdH1cclxuXHRcdH1cclxuXHRcdGlmIChrZXlzKSBLLm1hcChmdW5jdGlvbihyKSB7IGtleXMucHVzaChyKX0pO1xyXG5cdFx0Y3VyPWVuZGN1cjtcclxuXHRcdHJldHVybiBvO1xyXG5cdH1cdFx0XHJcblx0Ly9pdGVtIGlzIHNhbWUga25vd24gdHlwZVxyXG5cdHZhciBsb2FkU3RyaW5nQXJyYXk9ZnVuY3Rpb24oYmxvY2tzaXplLGVuY29kaW5nKSB7XHJcblx0XHR2YXIgbz1rZnMucmVhZFN0cmluZ0FycmF5U3luYyhjdXIsYmxvY2tzaXplLGVuY29kaW5nKTtcclxuXHRcdGN1cis9YmxvY2tzaXplO1xyXG5cdFx0cmV0dXJuIG87XHJcblx0fVxyXG5cdHZhciBsb2FkSW50ZWdlckFycmF5PWZ1bmN0aW9uKGJsb2Nrc2l6ZSx1bml0c2l6ZSkge1xyXG5cdFx0dmFyIGNvdW50PWxvYWRWSW50MSgpO1xyXG5cdFx0dmFyIG89a2ZzLnJlYWRGaXhlZEFycmF5U3luYyhjdXIsY291bnQsdW5pdHNpemUpO1xyXG5cdFx0Y3VyKz1jb3VudCp1bml0c2l6ZTtcclxuXHRcdHJldHVybiBvO1xyXG5cdH1cclxuXHR2YXIgbG9hZEJsb2I9ZnVuY3Rpb24oYmxvY2tzaXplKSB7XHJcblx0XHR2YXIgbz1rZnMucmVhZEJ1ZlN5bmMoY3VyLGJsb2Nrc2l6ZSk7XHJcblx0XHRjdXIrPWJsb2Nrc2l6ZTtcclxuXHRcdHJldHVybiBvO1xyXG5cdH1cdFxyXG5cdFxyXG5cdHZhciBsb2FkPWZ1bmN0aW9uKG9wdHMpIHtcclxuXHRcdG9wdHM9b3B0c3x8e307XHJcblx0XHR2YXIgYmxvY2tzaXplPW9wdHMuYmxvY2tzaXplfHxrZnMuc2l6ZTsgXHJcblx0XHR2YXIgc2lnbmF0dXJlPWtmcy5yZWFkU2lnbmF0dXJlU3luYyhjdXIpO1xyXG5cdFx0Y3VyKz1rZnMuc2lnbmF0dXJlX3NpemU7XHJcblx0XHR2YXIgZGF0YXNpemU9YmxvY2tzaXplLWtmcy5zaWduYXR1cmVfc2l6ZTtcclxuXHRcdC8vYmFzaWMgdHlwZXNcclxuXHRcdGlmIChzaWduYXR1cmU9PT1EVC5pbnQzMikge1xyXG5cdFx0XHRjdXIrPTQ7XHJcblx0XHRcdHJldHVybiBrZnMucmVhZEkzMlN5bmMoY3VyLTQpO1xyXG5cdFx0fSBlbHNlIGlmIChzaWduYXR1cmU9PT1EVC51aW50OCkge1xyXG5cdFx0XHRjdXIrKztcclxuXHRcdFx0cmV0dXJuIGtmcy5yZWFkVUk4U3luYyhjdXItMSk7XHJcblx0XHR9IGVsc2UgaWYgKHNpZ25hdHVyZT09PURULnV0ZjgpIHtcclxuXHRcdFx0dmFyIGM9Y3VyO2N1cis9ZGF0YXNpemU7XHJcblx0XHRcdHJldHVybiBrZnMucmVhZFN0cmluZ1N5bmMoYyxkYXRhc2l6ZSwndXRmOCcpO1x0XHJcblx0XHR9IGVsc2UgaWYgKHNpZ25hdHVyZT09PURULnVjczIpIHtcclxuXHRcdFx0dmFyIGM9Y3VyO2N1cis9ZGF0YXNpemU7XHJcblx0XHRcdHJldHVybiBrZnMucmVhZFN0cmluZ1N5bmMoYyxkYXRhc2l6ZSwndWNzMicpO1x0XHJcblx0XHR9IGVsc2UgaWYgKHNpZ25hdHVyZT09PURULmJvb2wpIHtcclxuXHRcdFx0Y3VyKys7XHJcblx0XHRcdHJldHVybiAhIShrZnMucmVhZFVJOFN5bmMoY3VyLTEpKTtcclxuXHRcdH0gZWxzZSBpZiAoc2lnbmF0dXJlPT09RFQuYmxvYikge1xyXG5cdFx0XHRyZXR1cm4gbG9hZEJsb2IoZGF0YXNpemUpO1xyXG5cdFx0fVxyXG5cdFx0Ly92YXJpYWJsZSBsZW5ndGggaW50ZWdlcnNcclxuXHRcdGVsc2UgaWYgKHNpZ25hdHVyZT09PURULnZpbnQpIHJldHVybiBsb2FkVkludChkYXRhc2l6ZSk7XHJcblx0XHRlbHNlIGlmIChzaWduYXR1cmU9PT1EVC5waW50KSByZXR1cm4gbG9hZFBJbnQoZGF0YXNpemUpO1xyXG5cdFx0Ly9zaW1wbGUgYXJyYXlcclxuXHRcdGVsc2UgaWYgKHNpZ25hdHVyZT09PURULnV0ZjhhcnIpIHJldHVybiBsb2FkU3RyaW5nQXJyYXkoZGF0YXNpemUsJ3V0ZjgnKTtcclxuXHRcdGVsc2UgaWYgKHNpZ25hdHVyZT09PURULnVjczJhcnIpIHJldHVybiBsb2FkU3RyaW5nQXJyYXkoZGF0YXNpemUsJ3VjczInKTtcclxuXHRcdGVsc2UgaWYgKHNpZ25hdHVyZT09PURULnVpbnQ4YXJyKSByZXR1cm4gbG9hZEludGVnZXJBcnJheShkYXRhc2l6ZSwxKTtcclxuXHRcdGVsc2UgaWYgKHNpZ25hdHVyZT09PURULmludDMyYXJyKSByZXR1cm4gbG9hZEludGVnZXJBcnJheShkYXRhc2l6ZSw0KTtcclxuXHRcdC8vbmVzdGVkIHN0cnVjdHVyZVxyXG5cdFx0ZWxzZSBpZiAoc2lnbmF0dXJlPT09RFQuYXJyYXkpIHJldHVybiBsb2FkQXJyYXkoZGF0YXNpemUsb3B0cy5sYXp5KTtcclxuXHRcdGVsc2UgaWYgKHNpZ25hdHVyZT09PURULm9iamVjdCkge1xyXG5cdFx0XHRyZXR1cm4gbG9hZE9iamVjdChkYXRhc2l6ZSxvcHRzLmxhenksb3B0cy5rZXlzKTtcclxuXHRcdH1cclxuXHRcdGVsc2UgdGhyb3cgJ3Vuc3VwcG9ydGVkIHR5cGUgJytzaWduYXR1cmU7XHJcblx0fVxyXG5cdHZhciByZXNldD1mdW5jdGlvbigpIHtcclxuXHRcdGN1cj0wO1xyXG5cdFx0a2RiLnNldENhY2hlKGxvYWQoe2xhenk6dHJ1ZX0pKTtcclxuXHR9XHJcblx0dmFyIGdldGFsbD1mdW5jdGlvbigpIHtcclxuXHRcdHZhciBvdXRwdXQ9e307XHJcblx0XHR2YXIga2V5cz1nZXRrZXlzKCk7XHJcblx0XHRmb3IgKHZhciBpIGluIGtleXMpIHtcclxuXHRcdFx0b3V0cHV0W2tleXNbaV1dPSBnZXQoW2tleXNbaV1dLHRydWUpO1xyXG5cdFx0fVxyXG5cdFx0cmV0dXJuIG91dHB1dDtcclxuXHRcdFxyXG5cdH1cclxuXHR2YXIgZXhpc3RzPWZ1bmN0aW9uKHBhdGgpIHtcclxuXHRcdGlmIChwYXRoLmxlbmd0aD09MCkgcmV0dXJuIHRydWU7XHJcblx0XHR2YXIga2V5PXBhdGgucG9wKCk7XHJcblx0XHRnZXQocGF0aCk7XHJcblx0XHRpZiAoIXBhdGguam9pbignXFwwJykpIHJldHVybiAoISFrZGIua2V5KClba2V5XSk7XHJcblx0XHR2YXIga2V5cz1rZGIua2V5KClbcGF0aC5qb2luKCdcXDAnKV07XHJcblx0XHRwYXRoLnB1c2goa2V5KTsvL3B1dCBpdCBiYWNrXHJcblx0XHRpZiAoa2V5cykgcmV0dXJuIChrZXlzLmluZGV4T2Yoa2V5KT4tMSk7XHJcblx0XHRlbHNlIHJldHVybiBmYWxzZTtcclxuXHR9XHJcblx0dmFyIGdldD1mdW5jdGlvbihwYXRoLHJlY3Vyc2l2ZSkge1xyXG5cdFx0cmVjdXJzaXZlPXJlY3Vyc2l2ZXx8ZmFsc2U7XHJcblx0XHRpZiAoIWtkYi5jYWNoZSgpKSByZXNldCgpO1xyXG5cclxuXHRcdGlmICh0eXBlb2YgcGF0aD09XCJzdHJpbmdcIikgcGF0aD1bcGF0aF07XHJcblx0XHR2YXIgbz1rZGIuY2FjaGUoKTtcclxuXHRcdGlmIChwYXRoLmxlbmd0aD09MCAmJnJlY3Vyc2l2ZSkgcmV0dXJuIGdldGFsbCgpO1xyXG5cdFx0dmFyIHBhdGhub3c9XCJcIjtcclxuXHRcdGZvciAodmFyIGk9MDtpPHBhdGgubGVuZ3RoO2krKykge1xyXG5cdFx0XHR2YXIgcj1vW3BhdGhbaV1dIDtcclxuXHJcblx0XHRcdGlmIChyPT09dW5kZWZpbmVkKSByZXR1cm4gdW5kZWZpbmVkO1xyXG5cdFx0XHRpZiAocGFyc2VJbnQoaSkpIHBhdGhub3crPVwiXFwwXCI7XHJcblx0XHRcdHBhdGhub3crPXBhdGhbaV07XHJcblx0XHRcdGlmICh0eXBlb2Ygcj09J3N0cmluZycgJiYgclswXT09XCJcXDBcIikgeyAvL29mZnNldCBvZiBkYXRhIHRvIGJlIGxvYWRlZFxyXG5cdFx0XHRcdHZhciBrZXlzPVtdO1xyXG5cdFx0XHRcdHZhciBwPXIuc3Vic3RyaW5nKDEpLnNwbGl0KFwiXFwwXCIpLm1hcChcclxuXHRcdFx0XHRcdGZ1bmN0aW9uKGl0ZW0pe3JldHVybiBwYXJzZUludChpdGVtLDE2KX0pO1xyXG5cdFx0XHRcdGN1cj1wWzBdO1xyXG5cdFx0XHRcdHZhciBsYXp5PSFyZWN1cnNpdmUgfHwgKGk8cGF0aC5sZW5ndGgtMSkgO1xyXG5cdFx0XHRcdG9bcGF0aFtpXV09bG9hZCh7bGF6eTpsYXp5LGJsb2Nrc2l6ZTpwWzFdLGtleXM6a2V5c30pO1xyXG5cdFx0XHRcdGtkYi5rZXkoKVtwYXRobm93XT1rZXlzO1xyXG5cdFx0XHRcdG89b1twYXRoW2ldXTtcclxuXHRcdFx0fSBlbHNlIHtcclxuXHRcdFx0XHRvPXI7IC8vYWxyZWFkeSBpbiBjYWNoZVxyXG5cdFx0XHR9XHJcblx0XHR9XHJcblx0XHRyZXR1cm4gbztcclxuXHR9XHJcblx0Ly8gZ2V0IGFsbCBrZXlzIGluIGdpdmVuIHBhdGhcclxuXHR2YXIgZ2V0a2V5cz1mdW5jdGlvbihwYXRoKSB7XHJcblx0XHRpZiAoIXBhdGgpIHBhdGg9W11cclxuXHRcdGdldChwYXRoKTsgLy8gbWFrZSBzdXJlIGl0IGlzIGxvYWRlZFxyXG5cdFx0aWYgKHBhdGggJiYgcGF0aC5sZW5ndGgpIHtcclxuXHRcdFx0cmV0dXJuIGtkYi5rZXkoKVtwYXRoLmpvaW4oXCJcXDBcIildO1xyXG5cdFx0fSBlbHNlIHtcclxuXHRcdFx0cmV0dXJuIE9iamVjdC5rZXlzKGtkYi5jYWNoZSgpKTsgXHJcblx0XHRcdC8vdG9wIGxldmVsLCBub3JtYWxseSBpdCBpcyB2ZXJ5IHNtYWxsXHJcblx0XHR9XHJcblx0XHRcclxuXHR9XHJcblxyXG5cdGtkYi5sb2FkU3luYz1sb2FkO1xyXG5cdGtkYi5rZXlzU3luYz1nZXRrZXlzO1xyXG5cdGtkYi5nZXRTeW5jPWdldDsgICAvLyBnZXQgYSBmaWVsZCwgbG9hZCBpZiBuZWVkZWRcclxuXHRrZGIuZXhpc3RzU3luYz1leGlzdHM7XHJcblx0cmV0dXJuIGtkYjtcclxufVxyXG5cclxuaWYgKG1vZHVsZSkgbW9kdWxlLmV4cG9ydHM9U3luYztcclxuIiwiLyogbm9kZS5qcyBhbmQgaHRtbDUgZmlsZSBzeXN0ZW0gYWJzdHJhY3Rpb24gbGF5ZXIqL1xyXG50cnkge1xyXG5cdHZhciBmcz1yZXF1aXJlKFwiZnNcIik7XHJcblx0dmFyIEJ1ZmZlcj1yZXF1aXJlKFwiYnVmZmVyXCIpLkJ1ZmZlcjtcclxufSBjYXRjaCAoZSkge1xyXG5cdHZhciBmcz1yZXF1aXJlKCcuL2h0bWw1ZnMnKTtcclxuXHR2YXIgQnVmZmVyPWZ1bmN0aW9uKCl7IHJldHVybiBcIlwifTtcclxuXHR2YXIgaHRtbDVmcz10cnVlOyBcdFxyXG59XHJcbnZhciBzaWduYXR1cmVfc2l6ZT0xO1xyXG52YXIgdmVyYm9zZT0wLCByZWFkTG9nPWZ1bmN0aW9uKCl7fTtcclxudmFyIF9yZWFkTG9nPWZ1bmN0aW9uKHJlYWR0eXBlLGJ5dGVzKSB7XHJcblx0Y29uc29sZS5sb2cocmVhZHR5cGUsYnl0ZXMsXCJieXRlc1wiKTtcclxufVxyXG5pZiAodmVyYm9zZSkgcmVhZExvZz1fcmVhZExvZztcclxuXHJcbnZhciB1bnBhY2tfaW50ID0gZnVuY3Rpb24gKGFyLCBjb3VudCAsIHJlc2V0KSB7XHJcbiAgIGNvdW50PWNvdW50fHxhci5sZW5ndGg7XHJcbiAgdmFyIHIgPSBbXSwgaSA9IDAsIHYgPSAwO1xyXG4gIGRvIHtcclxuXHR2YXIgc2hpZnQgPSAwO1xyXG5cdGRvIHtcclxuXHQgIHYgKz0gKChhcltpXSAmIDB4N0YpIDw8IHNoaWZ0KTtcclxuXHQgIHNoaWZ0ICs9IDc7XHQgIFxyXG5cdH0gd2hpbGUgKGFyWysraV0gJiAweDgwKTtcclxuXHRyLnB1c2godik7IGlmIChyZXNldCkgdj0wO1xyXG5cdGNvdW50LS07XHJcbiAgfSB3aGlsZSAoaTxhci5sZW5ndGggJiYgY291bnQpO1xyXG4gIHJldHVybiB7ZGF0YTpyLCBhZHY6aSB9O1xyXG59XHJcbnZhciBPcGVuPWZ1bmN0aW9uKHBhdGgsb3B0cyxjYikge1xyXG5cdG9wdHM9b3B0c3x8e307XHJcblxyXG5cdHZhciByZWFkU2lnbmF0dXJlPWZ1bmN0aW9uKHBvcyxjYikge1xyXG5cdFx0dmFyIGJ1Zj1uZXcgQnVmZmVyKHNpZ25hdHVyZV9zaXplKTtcclxuXHRcdHZhciB0aGF0PXRoaXM7XHJcblx0XHRmcy5yZWFkKHRoaXMuaGFuZGxlLGJ1ZiwwLHNpZ25hdHVyZV9zaXplLHBvcyxmdW5jdGlvbihlcnIsbGVuLGJ1ZmZlcil7XHJcblx0XHRcdGlmIChodG1sNWZzKSB2YXIgc2lnbmF0dXJlPVN0cmluZy5mcm9tQ2hhckNvZGUoKG5ldyBVaW50OEFycmF5KGJ1ZmZlcikpWzBdKVxyXG5cdFx0XHRlbHNlIHZhciBzaWduYXR1cmU9YnVmZmVyLnRvU3RyaW5nKCd1dGY4JywwLHNpZ25hdHVyZV9zaXplKTtcclxuXHRcdFx0Y2IuYXBwbHkodGhhdCxbc2lnbmF0dXJlXSk7XHJcblx0XHR9KTtcclxuXHR9XHJcblxyXG5cdC8vdGhpcyBpcyBxdWl0ZSBzbG93XHJcblx0Ly93YWl0IGZvciBTdHJpbmdWaWV3ICtBcnJheUJ1ZmZlciB0byBzb2x2ZSB0aGUgcHJvYmxlbVxyXG5cdC8vaHR0cHM6Ly9ncm91cHMuZ29vZ2xlLmNvbS9hL2Nocm9taXVtLm9yZy9mb3J1bS8jIXRvcGljL2JsaW5rLWRldi95bGdpTllfWlNWMFxyXG5cdC8vaWYgdGhlIHN0cmluZyBpcyBhbHdheXMgdWNzMlxyXG5cdC8vY2FuIHVzZSBVaW50MTYgdG8gcmVhZCBpdC5cclxuXHQvL2h0dHA6Ly91cGRhdGVzLmh0bWw1cm9ja3MuY29tLzIwMTIvMDYvSG93LXRvLWNvbnZlcnQtQXJyYXlCdWZmZXItdG8tYW5kLWZyb20tU3RyaW5nXHJcblx0dmFyIGRlY29kZXV0ZjggPSBmdW5jdGlvbiAodXRmdGV4dCkge1xyXG5cdFx0dmFyIHN0cmluZyA9IFwiXCI7XHJcblx0XHR2YXIgaSA9IDA7XHJcblx0XHR2YXIgYz0wLGMxID0gMCwgYzIgPSAwICwgYzM9MDtcclxuXHRcdGZvciAodmFyIGk9MDtpPHV0ZnRleHQubGVuZ3RoO2krKykge1xyXG5cdFx0XHRpZiAodXRmdGV4dC5jaGFyQ29kZUF0KGkpPjEyNykgYnJlYWs7XHJcblx0XHR9XHJcblx0XHRpZiAoaT49dXRmdGV4dC5sZW5ndGgpIHJldHVybiB1dGZ0ZXh0O1xyXG5cclxuXHRcdHdoaWxlICggaSA8IHV0ZnRleHQubGVuZ3RoICkge1xyXG5cdFx0XHRjID0gdXRmdGV4dC5jaGFyQ29kZUF0KGkpO1xyXG5cdFx0XHRpZiAoYyA8IDEyOCkge1xyXG5cdFx0XHRcdHN0cmluZyArPSB1dGZ0ZXh0W2ldO1xyXG5cdFx0XHRcdGkrKztcclxuXHRcdFx0fSBlbHNlIGlmKChjID4gMTkxKSAmJiAoYyA8IDIyNCkpIHtcclxuXHRcdFx0XHRjMiA9IHV0ZnRleHQuY2hhckNvZGVBdChpKzEpO1xyXG5cdFx0XHRcdHN0cmluZyArPSBTdHJpbmcuZnJvbUNoYXJDb2RlKCgoYyAmIDMxKSA8PCA2KSB8IChjMiAmIDYzKSk7XHJcblx0XHRcdFx0aSArPSAyO1xyXG5cdFx0XHR9IGVsc2Uge1xyXG5cdFx0XHRcdGMyID0gdXRmdGV4dC5jaGFyQ29kZUF0KGkrMSk7XHJcblx0XHRcdFx0YzMgPSB1dGZ0ZXh0LmNoYXJDb2RlQXQoaSsyKTtcclxuXHRcdFx0XHRzdHJpbmcgKz0gU3RyaW5nLmZyb21DaGFyQ29kZSgoKGMgJiAxNSkgPDwgMTIpIHwgKChjMiAmIDYzKSA8PCA2KSB8IChjMyAmIDYzKSk7XHJcblx0XHRcdFx0aSArPSAzO1xyXG5cdFx0XHR9XHJcblx0XHR9XHJcblx0XHRyZXR1cm4gc3RyaW5nO1xyXG5cdH1cclxuXHJcblx0dmFyIHJlYWRTdHJpbmc9IGZ1bmN0aW9uKHBvcyxibG9ja3NpemUsZW5jb2RpbmcsY2IpIHtcclxuXHRcdGVuY29kaW5nPWVuY29kaW5nfHwndXRmOCc7XHJcblx0XHR2YXIgYnVmZmVyPW5ldyBCdWZmZXIoYmxvY2tzaXplKTtcclxuXHRcdHZhciB0aGF0PXRoaXM7XHJcblx0XHRmcy5yZWFkKHRoaXMuaGFuZGxlLGJ1ZmZlciwwLGJsb2Nrc2l6ZSxwb3MsZnVuY3Rpb24oZXJyLGxlbixidWZmZXIpe1xyXG5cdFx0XHRyZWFkTG9nKFwic3RyaW5nXCIsbGVuKTtcclxuXHRcdFx0aWYgKGh0bWw1ZnMpIHtcclxuXHRcdFx0XHRpZiAoZW5jb2Rpbmc9PSd1dGY4Jykge1xyXG5cdFx0XHRcdFx0dmFyIHN0cj1kZWNvZGV1dGY4KFN0cmluZy5mcm9tQ2hhckNvZGUuYXBwbHkobnVsbCwgbmV3IFVpbnQ4QXJyYXkoYnVmZmVyKSkpXHJcblx0XHRcdFx0fSBlbHNlIHsgLy91Y3MyIGlzIDMgdGltZXMgZmFzdGVyXHJcblx0XHRcdFx0XHR2YXIgc3RyPVN0cmluZy5mcm9tQ2hhckNvZGUuYXBwbHkobnVsbCwgbmV3IFVpbnQxNkFycmF5KGJ1ZmZlcikpXHRcclxuXHRcdFx0XHR9XHJcblx0XHRcdFx0XHJcblx0XHRcdFx0Y2IuYXBwbHkodGhhdCxbc3RyXSk7XHJcblx0XHRcdH0gXHJcblx0XHRcdGVsc2UgY2IuYXBwbHkodGhhdCxbYnVmZmVyLnRvU3RyaW5nKGVuY29kaW5nKV0pO1x0XHJcblx0XHR9KTtcclxuXHR9XHJcblxyXG5cdC8vd29yayBhcm91bmQgZm9yIGNocm9tZSBmcm9tQ2hhckNvZGUgY2Fubm90IGFjY2VwdCBodWdlIGFycmF5XHJcblx0Ly9odHRwczovL2NvZGUuZ29vZ2xlLmNvbS9wL2Nocm9taXVtL2lzc3Vlcy9kZXRhaWw/aWQ9NTY1ODhcclxuXHR2YXIgYnVmMnN0cmluZ2Fycj1mdW5jdGlvbihidWYsZW5jKSB7XHJcblx0XHRpZiAoZW5jPT1cInV0ZjhcIikgXHR2YXIgYXJyPW5ldyBVaW50OEFycmF5KGJ1Zik7XHJcblx0XHRlbHNlIHZhciBhcnI9bmV3IFVpbnQxNkFycmF5KGJ1Zik7XHJcblx0XHR2YXIgaT0wLGNvZGVzPVtdLG91dD1bXSxzPVwiXCI7XHJcblx0XHR3aGlsZSAoaTxhcnIubGVuZ3RoKSB7XHJcblx0XHRcdGlmIChhcnJbaV0pIHtcclxuXHRcdFx0XHRjb2Rlc1tjb2Rlcy5sZW5ndGhdPWFycltpXTtcclxuXHRcdFx0fSBlbHNlIHtcclxuXHRcdFx0XHRzPVN0cmluZy5mcm9tQ2hhckNvZGUuYXBwbHkobnVsbCxjb2Rlcyk7XHJcblx0XHRcdFx0aWYgKGVuYz09XCJ1dGY4XCIpIG91dFtvdXQubGVuZ3RoXT1kZWNvZGV1dGY4KHMpO1xyXG5cdFx0XHRcdGVsc2Ugb3V0W291dC5sZW5ndGhdPXM7XHJcblx0XHRcdFx0Y29kZXM9W107XHRcdFx0XHRcclxuXHRcdFx0fVxyXG5cdFx0XHRpKys7XHJcblx0XHR9XHJcblx0XHRcclxuXHRcdHM9U3RyaW5nLmZyb21DaGFyQ29kZS5hcHBseShudWxsLGNvZGVzKTtcclxuXHRcdGlmIChlbmM9PVwidXRmOFwiKSBvdXRbb3V0Lmxlbmd0aF09ZGVjb2RldXRmOChzKTtcclxuXHRcdGVsc2Ugb3V0W291dC5sZW5ndGhdPXM7XHJcblxyXG5cdFx0cmV0dXJuIG91dDtcclxuXHR9XHJcblx0dmFyIHJlYWRTdHJpbmdBcnJheSA9IGZ1bmN0aW9uKHBvcyxibG9ja3NpemUsZW5jb2RpbmcsY2IpIHtcclxuXHRcdHZhciB0aGF0PXRoaXMsb3V0PW51bGw7XHJcblx0XHRpZiAoYmxvY2tzaXplPT0wKSByZXR1cm4gW107XHJcblx0XHRlbmNvZGluZz1lbmNvZGluZ3x8J3V0ZjgnO1xyXG5cdFx0dmFyIGJ1ZmZlcj1uZXcgQnVmZmVyKGJsb2Nrc2l6ZSk7XHJcblx0XHRmcy5yZWFkKHRoaXMuaGFuZGxlLGJ1ZmZlciwwLGJsb2Nrc2l6ZSxwb3MsZnVuY3Rpb24oZXJyLGxlbixidWZmZXIpe1xyXG5cdFx0XHRpZiAoaHRtbDVmcykge1xyXG5cdFx0XHRcdHJlYWRMb2coXCJzdHJpbmdBcnJheVwiLGJ1ZmZlci5ieXRlTGVuZ3RoKTtcclxuXHJcblx0XHRcdFx0aWYgKGVuY29kaW5nPT0ndXRmOCcpIHtcclxuXHRcdFx0XHRcdG91dD1idWYyc3RyaW5nYXJyKGJ1ZmZlcixcInV0ZjhcIik7XHJcblx0XHRcdFx0fSBlbHNlIHsgLy91Y3MyIGlzIDMgdGltZXMgZmFzdGVyXHJcblx0XHRcdFx0XHRvdXQ9YnVmMnN0cmluZ2FycihidWZmZXIsXCJ1Y3MyXCIpO1xyXG5cdFx0XHRcdH1cclxuXHRcdFx0fSBlbHNlIHtcclxuXHRcdFx0XHRyZWFkTG9nKFwic3RyaW5nQXJyYXlcIixidWZmZXIubGVuZ3RoKTtcclxuXHRcdFx0XHRvdXQ9YnVmZmVyLnRvU3RyaW5nKGVuY29kaW5nKS5zcGxpdCgnXFwwJyk7XHJcblx0XHRcdH0gXHRcclxuXHRcdFx0Y2IuYXBwbHkodGhhdCxbb3V0XSk7XHJcblx0XHR9KTtcclxuXHR9XHJcblx0dmFyIHJlYWRVSTMyPWZ1bmN0aW9uKHBvcyxjYikge1xyXG5cdFx0dmFyIGJ1ZmZlcj1uZXcgQnVmZmVyKDQpO1xyXG5cdFx0dmFyIHRoYXQ9dGhpcztcclxuXHRcdGZzLnJlYWQodGhpcy5oYW5kbGUsYnVmZmVyLDAsNCxwb3MsZnVuY3Rpb24oZXJyLGxlbixidWZmZXIpe1xyXG5cdFx0XHRyZWFkTG9nKFwidWkzMlwiLGxlbik7XHJcblx0XHRcdGlmIChodG1sNWZzKXtcclxuXHRcdFx0XHQvL3Y9KG5ldyBVaW50MzJBcnJheShidWZmZXIpKVswXTtcclxuXHRcdFx0XHR2YXIgdj1uZXcgRGF0YVZpZXcoYnVmZmVyKS5nZXRVaW50MzIoMCwgZmFsc2UpXHJcblx0XHRcdFx0Y2Iodik7XHJcblx0XHRcdH1cclxuXHRcdFx0ZWxzZSBjYi5hcHBseSh0aGF0LFtidWZmZXIucmVhZEludDMyQkUoMCldKTtcdFxyXG5cdFx0fSk7XHRcdFxyXG5cdH1cclxuXHJcblx0dmFyIHJlYWRJMzI9ZnVuY3Rpb24ocG9zLGNiKSB7XHJcblx0XHR2YXIgYnVmZmVyPW5ldyBCdWZmZXIoNCk7XHJcblx0XHR2YXIgdGhhdD10aGlzO1xyXG5cdFx0ZnMucmVhZCh0aGlzLmhhbmRsZSxidWZmZXIsMCw0LHBvcyxmdW5jdGlvbihlcnIsbGVuLGJ1ZmZlcil7XHJcblx0XHRcdHJlYWRMb2coXCJpMzJcIixsZW4pO1xyXG5cdFx0XHRpZiAoaHRtbDVmcyl7XHJcblx0XHRcdFx0dmFyIHY9bmV3IERhdGFWaWV3KGJ1ZmZlcikuZ2V0SW50MzIoMCwgZmFsc2UpXHJcblx0XHRcdFx0Y2Iodik7XHJcblx0XHRcdH1cclxuXHRcdFx0ZWxzZSAgXHRjYi5hcHBseSh0aGF0LFtidWZmZXIucmVhZEludDMyQkUoMCldKTtcdFxyXG5cdFx0fSk7XHJcblx0fVxyXG5cdHZhciByZWFkVUk4PWZ1bmN0aW9uKHBvcyxjYikge1xyXG5cdFx0dmFyIGJ1ZmZlcj1uZXcgQnVmZmVyKDEpO1xyXG5cdFx0dmFyIHRoYXQ9dGhpcztcclxuXHJcblx0XHRmcy5yZWFkKHRoaXMuaGFuZGxlLGJ1ZmZlciwwLDEscG9zLGZ1bmN0aW9uKGVycixsZW4sYnVmZmVyKXtcclxuXHRcdFx0cmVhZExvZyhcInVpOFwiLGxlbik7XHJcblx0XHRcdGlmIChodG1sNWZzKWNiKCAobmV3IFVpbnQ4QXJyYXkoYnVmZmVyKSlbMF0pIDtcclxuXHRcdFx0ZWxzZSAgXHRcdFx0Y2IuYXBwbHkodGhhdCxbYnVmZmVyLnJlYWRVSW50OCgwKV0pO1x0XHJcblx0XHRcdFxyXG5cdFx0fSk7XHJcblx0fVxyXG5cdHZhciByZWFkQnVmPWZ1bmN0aW9uKHBvcyxibG9ja3NpemUsY2IpIHtcclxuXHRcdHZhciB0aGF0PXRoaXM7XHJcblx0XHR2YXIgYnVmPW5ldyBCdWZmZXIoYmxvY2tzaXplKTtcclxuXHRcdGZzLnJlYWQodGhpcy5oYW5kbGUsYnVmLDAsYmxvY2tzaXplLHBvcyxmdW5jdGlvbihlcnIsbGVuLGJ1ZmZlcil7XHJcblx0XHRcdHJlYWRMb2coXCJidWZcIixsZW4pO1xyXG5cdFx0XHR2YXIgYnVmZj1uZXcgVWludDhBcnJheShidWZmZXIpXHJcblx0XHRcdGNiLmFwcGx5KHRoYXQsW2J1ZmZdKTtcclxuXHRcdH0pO1xyXG5cdH1cclxuXHR2YXIgcmVhZEJ1Zl9wYWNrZWRpbnQ9ZnVuY3Rpb24ocG9zLGJsb2Nrc2l6ZSxjb3VudCxyZXNldCxjYikge1xyXG5cdFx0dmFyIHRoYXQ9dGhpcztcclxuXHRcdHJlYWRCdWYuYXBwbHkodGhpcyxbcG9zLGJsb2Nrc2l6ZSxmdW5jdGlvbihidWZmZXIpe1xyXG5cdFx0XHRjYi5hcHBseSh0aGF0LFt1bnBhY2tfaW50KGJ1ZmZlcixjb3VudCxyZXNldCldKTtcdFxyXG5cdFx0fV0pO1xyXG5cdFx0XHJcblx0fVxyXG5cdHZhciByZWFkRml4ZWRBcnJheV9odG1sNWZzPWZ1bmN0aW9uKHBvcyxjb3VudCx1bml0c2l6ZSxjYikge1xyXG5cdFx0dmFyIGZ1bmM9bnVsbDtcclxuXHRcdGlmICh1bml0c2l6ZT09PTEpIHtcclxuXHRcdFx0ZnVuYz0nZ2V0VWludDgnOy8vVWludDhBcnJheTtcclxuXHRcdH0gZWxzZSBpZiAodW5pdHNpemU9PT0yKSB7XHJcblx0XHRcdGZ1bmM9J2dldFVpbnQxNic7Ly9VaW50MTZBcnJheTtcclxuXHRcdH0gZWxzZSBpZiAodW5pdHNpemU9PT00KSB7XHJcblx0XHRcdGZ1bmM9J2dldFVpbnQzMic7Ly9VaW50MzJBcnJheTtcclxuXHRcdH0gZWxzZSB0aHJvdyAndW5zdXBwb3J0ZWQgaW50ZWdlciBzaXplJztcclxuXHJcblx0XHRmcy5yZWFkKHRoaXMuaGFuZGxlLG51bGwsMCx1bml0c2l6ZSpjb3VudCxwb3MsZnVuY3Rpb24oZXJyLGxlbixidWZmZXIpe1xyXG5cdFx0XHRyZWFkTG9nKFwiZml4IGFycmF5XCIsbGVuKTtcclxuXHRcdFx0dmFyIG91dD1bXTtcclxuXHRcdFx0aWYgKHVuaXRzaXplPT0xKSB7XHJcblx0XHRcdFx0b3V0PW5ldyBVaW50OEFycmF5KGJ1ZmZlcik7XHJcblx0XHRcdH0gZWxzZSB7XHJcblx0XHRcdFx0Zm9yICh2YXIgaSA9IDA7IGkgPCBsZW4gLyB1bml0c2l6ZTsgaSsrKSB7IC8vZW5kaWFuIHByb2JsZW1cclxuXHRcdFx0XHQvL1x0b3V0LnB1c2goIGZ1bmMoYnVmZmVyLGkqdW5pdHNpemUpKTtcclxuXHRcdFx0XHRcdG91dC5wdXNoKCB2PW5ldyBEYXRhVmlldyhidWZmZXIpW2Z1bmNdKGksZmFsc2UpICk7XHJcblx0XHRcdFx0fVxyXG5cdFx0XHR9XHJcblxyXG5cdFx0XHRjYi5hcHBseSh0aGF0LFtvdXRdKTtcclxuXHRcdH0pO1xyXG5cdH1cclxuXHQvLyBzaWduYXR1cmUsIGl0ZW1jb3VudCwgcGF5bG9hZFxyXG5cdHZhciByZWFkRml4ZWRBcnJheSA9IGZ1bmN0aW9uKHBvcyAsY291bnQsIHVuaXRzaXplLGNiKSB7XHJcblx0XHR2YXIgZnVuYz1udWxsO1xyXG5cdFx0dmFyIHRoYXQ9dGhpcztcclxuXHRcdFxyXG5cdFx0aWYgKHVuaXRzaXplKiBjb3VudD50aGlzLnNpemUgJiYgdGhpcy5zaXplKSAge1xyXG5cdFx0XHRjb25zb2xlLmxvZyhcImFycmF5IHNpemUgZXhjZWVkIGZpbGUgc2l6ZVwiLHRoaXMuc2l6ZSlcclxuXHRcdFx0cmV0dXJuO1xyXG5cdFx0fVxyXG5cdFx0XHJcblx0XHRpZiAoaHRtbDVmcykgcmV0dXJuIHJlYWRGaXhlZEFycmF5X2h0bWw1ZnMuYXBwbHkodGhpcyxbcG9zLGNvdW50LHVuaXRzaXplLGNiXSk7XHJcblxyXG5cdFx0dmFyIGl0ZW1zPW5ldyBCdWZmZXIoIHVuaXRzaXplKiBjb3VudCk7XHJcblx0XHRpZiAodW5pdHNpemU9PT0xKSB7XHJcblx0XHRcdGZ1bmM9aXRlbXMucmVhZFVJbnQ4O1xyXG5cdFx0fSBlbHNlIGlmICh1bml0c2l6ZT09PTIpIHtcclxuXHRcdFx0ZnVuYz1pdGVtcy5yZWFkVUludDE2QkU7XHJcblx0XHR9IGVsc2UgaWYgKHVuaXRzaXplPT09NCkge1xyXG5cdFx0XHRmdW5jPWl0ZW1zLnJlYWRVSW50MzJCRTtcclxuXHRcdH0gZWxzZSB0aHJvdyAndW5zdXBwb3J0ZWQgaW50ZWdlciBzaXplJztcclxuXHRcdC8vY29uc29sZS5sb2coJ2l0ZW1jb3VudCcsaXRlbWNvdW50LCdidWZmZXInLGJ1ZmZlcik7XHJcblxyXG5cdFx0ZnMucmVhZCh0aGlzLmhhbmRsZSxpdGVtcywwLHVuaXRzaXplKmNvdW50LHBvcyxmdW5jdGlvbihlcnIsbGVuLGJ1ZmZlcil7XHJcblx0XHRcdHJlYWRMb2coXCJmaXggYXJyYXlcIixsZW4pO1xyXG5cdFx0XHR2YXIgb3V0PVtdO1xyXG5cdFx0XHRmb3IgKHZhciBpID0gMDsgaSA8IGl0ZW1zLmxlbmd0aCAvIHVuaXRzaXplOyBpKyspIHtcclxuXHRcdFx0XHRvdXQucHVzaCggZnVuYy5hcHBseShpdGVtcyxbaSp1bml0c2l6ZV0pKTtcclxuXHRcdFx0fVxyXG5cdFx0XHRjYi5hcHBseSh0aGF0LFtvdXRdKTtcclxuXHRcdH0pO1xyXG5cdH1cclxuXHJcblx0dmFyIGZyZWU9ZnVuY3Rpb24oKSB7XHJcblx0XHQvL2NvbnNvbGUubG9nKCdjbG9zaW5nICcsaGFuZGxlKTtcclxuXHRcdGZzLmNsb3NlU3luYyh0aGlzLmhhbmRsZSk7XHJcblx0fVxyXG5cdHZhciBzZXR1cGFwaT1mdW5jdGlvbigpIHtcclxuXHRcdHZhciB0aGF0PXRoaXM7XHJcblx0XHR0aGlzLnJlYWRTaWduYXR1cmU9cmVhZFNpZ25hdHVyZTtcclxuXHRcdHRoaXMucmVhZEkzMj1yZWFkSTMyO1xyXG5cdFx0dGhpcy5yZWFkVUkzMj1yZWFkVUkzMjtcclxuXHRcdHRoaXMucmVhZFVJOD1yZWFkVUk4O1xyXG5cdFx0dGhpcy5yZWFkQnVmPXJlYWRCdWY7XHJcblx0XHR0aGlzLnJlYWRCdWZfcGFja2VkaW50PXJlYWRCdWZfcGFja2VkaW50O1xyXG5cdFx0dGhpcy5yZWFkRml4ZWRBcnJheT1yZWFkRml4ZWRBcnJheTtcclxuXHRcdHRoaXMucmVhZFN0cmluZz1yZWFkU3RyaW5nO1xyXG5cdFx0dGhpcy5yZWFkU3RyaW5nQXJyYXk9cmVhZFN0cmluZ0FycmF5O1xyXG5cdFx0dGhpcy5zaWduYXR1cmVfc2l6ZT1zaWduYXR1cmVfc2l6ZTtcclxuXHRcdHRoaXMuZnJlZT1mcmVlO1xyXG5cdFx0aWYgKGh0bWw1ZnMpIHtcclxuXHRcdFx0dmFyIGZuPXBhdGg7XHJcblx0XHRcdGlmIChwYXRoLmluZGV4T2YoXCJmaWxlc3lzdGVtOlwiKT09MCkgZm49cGF0aC5zdWJzdHIocGF0aC5sYXN0SW5kZXhPZihcIi9cIikpO1xyXG5cdFx0XHRmcy5mcy5yb290LmdldEZpbGUoZm4se30sZnVuY3Rpb24oZW50cnkpe1xyXG5cdFx0XHQgIGVudHJ5LmdldE1ldGFkYXRhKGZ1bmN0aW9uKG1ldGFkYXRhKSB7IFxyXG5cdFx0XHRcdHRoYXQuc2l6ZT1tZXRhZGF0YS5zaXplO1xyXG5cdFx0XHRcdGlmIChjYikgc2V0VGltZW91dChjYi5iaW5kKHRoYXQpLDApO1xyXG5cdFx0XHRcdH0pO1xyXG5cdFx0XHR9KTtcclxuXHRcdH0gZWxzZSB7XHJcblx0XHRcdHZhciBzdGF0PWZzLmZzdGF0U3luYyh0aGlzLmhhbmRsZSk7XHJcblx0XHRcdHRoaXMuc3RhdD1zdGF0O1xyXG5cdFx0XHR0aGlzLnNpemU9c3RhdC5zaXplO1x0XHRcclxuXHRcdFx0aWYgKGNiKVx0c2V0VGltZW91dChjYi5iaW5kKHRoaXMsMCksMCk7XHRcclxuXHRcdH1cclxuXHR9XHJcblxyXG5cdHZhciB0aGF0PXRoaXM7XHJcblx0aWYgKGh0bWw1ZnMpIHtcclxuXHRcdGZzLm9wZW4ocGF0aCxmdW5jdGlvbihoKXtcclxuXHRcdFx0dGhhdC5oYW5kbGU9aDtcclxuXHRcdFx0dGhhdC5odG1sNWZzPXRydWU7XHJcblx0XHRcdHNldHVwYXBpLmNhbGwodGhhdCk7XHJcblx0XHRcdHRoYXQub3BlbmVkPXRydWU7XHJcblx0XHR9KVxyXG5cdH0gZWxzZSB7XHJcblx0XHRpZiAoZnMuZXhpc3RzU3luYyhwYXRoKSl7XHJcblx0XHRcdHRoaXMuaGFuZGxlPWZzLm9wZW5TeW5jKHBhdGgsJ3InKTsvLyxmdW5jdGlvbihlcnIsaGFuZGxlKXtcclxuXHRcdFx0dGhpcy5vcGVuZWQ9dHJ1ZTtcclxuXHRcdFx0c2V0dXBhcGkuY2FsbCh0aGlzKTtcclxuXHRcdH0gZWxzZSB7XHJcblx0XHRcdGlmIChjYilcdHNldFRpbWVvdXQoY2IuYmluZChudWxsLFwiZmlsZSBub3QgZm91bmQ6XCIrcGF0aCksMCk7XHRcclxuXHRcdFx0cmV0dXJuIG51bGw7XHJcblx0XHR9XHJcblx0fVxyXG5cdHJldHVybiB0aGlzO1xyXG59XHJcbm1vZHVsZS5leHBvcnRzPU9wZW47IiwiLypcclxuICBKQVZBIGNhbiBvbmx5IHJldHVybiBOdW1iZXIgYW5kIFN0cmluZ1xyXG5cdGFycmF5IGFuZCBidWZmZXIgcmV0dXJuIGluIHN0cmluZyBmb3JtYXRcclxuXHRuZWVkIEpTT04ucGFyc2VcclxuKi9cclxudmFyIHZlcmJvc2U9MDtcclxuXHJcbnZhciByZWFkU2lnbmF0dXJlPWZ1bmN0aW9uKHBvcyxjYikge1xyXG5cdGlmICh2ZXJib3NlKSBjb25zb2xlLmRlYnVnKFwicmVhZCBzaWduYXR1cmVcIik7XHJcblx0dmFyIHNpZ25hdHVyZT1rZnMucmVhZFVURjhTdHJpbmcodGhpcy5oYW5kbGUscG9zLDEpO1xyXG5cdGlmICh2ZXJib3NlKSBjb25zb2xlLmRlYnVnKHNpZ25hdHVyZSxzaWduYXR1cmUuY2hhckNvZGVBdCgwKSk7XHJcblx0Y2IuYXBwbHkodGhpcyxbc2lnbmF0dXJlXSk7XHJcbn1cclxudmFyIHJlYWRJMzI9ZnVuY3Rpb24ocG9zLGNiKSB7XHJcblx0aWYgKHZlcmJvc2UpIGNvbnNvbGUuZGVidWcoXCJyZWFkIGkzMiBhdCBcIitwb3MpO1xyXG5cdHZhciBpMzI9a2ZzLnJlYWRJbnQzMih0aGlzLmhhbmRsZSxwb3MpO1xyXG5cdGlmICh2ZXJib3NlKSBjb25zb2xlLmRlYnVnKGkzMik7XHJcblx0Y2IuYXBwbHkodGhpcyxbaTMyXSk7XHRcclxufVxyXG52YXIgcmVhZFVJMzI9ZnVuY3Rpb24ocG9zLGNiKSB7XHJcblx0aWYgKHZlcmJvc2UpIGNvbnNvbGUuZGVidWcoXCJyZWFkIHVpMzIgYXQgXCIrcG9zKTtcclxuXHR2YXIgdWkzMj1rZnMucmVhZFVJbnQzMih0aGlzLmhhbmRsZSxwb3MpO1xyXG5cdGlmICh2ZXJib3NlKSBjb25zb2xlLmRlYnVnKHVpMzIpO1xyXG5cdGNiLmFwcGx5KHRoaXMsW3VpMzJdKTtcclxufVxyXG52YXIgcmVhZFVJOD1mdW5jdGlvbihwb3MsY2IpIHtcclxuXHRpZiAodmVyYm9zZSkgY29uc29sZS5kZWJ1ZyhcInJlYWQgdWk4IGF0IFwiK3Bvcyk7IFxyXG5cdHZhciB1aTg9a2ZzLnJlYWRVSW50OCh0aGlzLmhhbmRsZSxwb3MpO1xyXG5cdGlmICh2ZXJib3NlKSBjb25zb2xlLmRlYnVnKHVpOCk7XHJcblx0Y2IuYXBwbHkodGhpcyxbdWk4XSk7XHJcbn1cclxudmFyIHJlYWRCdWY9ZnVuY3Rpb24ocG9zLGJsb2Nrc2l6ZSxjYikge1xyXG5cdGlmICh2ZXJib3NlKSBjb25zb2xlLmRlYnVnKFwicmVhZCBidWZmZXIgYXQgXCIrcG9zKyBcIiBibG9ja3NpemUgXCIrYmxvY2tzaXplKTtcclxuXHR2YXIgYnVmPWtmcy5yZWFkQnVmKHRoaXMuaGFuZGxlLHBvcyxibG9ja3NpemUpO1xyXG5cdHZhciBidWZmPUpTT04ucGFyc2UoYnVmKTtcclxuXHRpZiAodmVyYm9zZSkgY29uc29sZS5kZWJ1ZyhcImJ1ZmZlciBsZW5ndGhcIitidWZmLmxlbmd0aCk7XHJcblx0Y2IuYXBwbHkodGhpcyxbYnVmZl0pO1x0XHJcbn1cclxudmFyIHJlYWRCdWZfcGFja2VkaW50PWZ1bmN0aW9uKHBvcyxibG9ja3NpemUsY291bnQscmVzZXQsY2IpIHtcclxuXHRpZiAodmVyYm9zZSkgY29uc29sZS5kZWJ1ZyhcInJlYWQgcGFja2VkIGludCBhdCBcIitwb3MrXCIgYmxvY2tzaXplIFwiK2Jsb2Nrc2l6ZStcIiBjb3VudCBcIitjb3VudCk7XHJcblx0dmFyIGJ1Zj1rZnMucmVhZEJ1Zl9wYWNrZWRpbnQodGhpcy5oYW5kbGUscG9zLGJsb2Nrc2l6ZSxjb3VudCxyZXNldCk7XHJcblx0dmFyIGFkdj1wYXJzZUludChidWYpO1xyXG5cdHZhciBidWZmPUpTT04ucGFyc2UoYnVmLnN1YnN0cihidWYuaW5kZXhPZihcIltcIikpKTtcclxuXHRpZiAodmVyYm9zZSkgY29uc29sZS5kZWJ1ZyhcInBhY2tlZEludCBsZW5ndGggXCIrYnVmZi5sZW5ndGgrXCIgZmlyc3QgaXRlbT1cIitidWZmWzBdKTtcclxuXHRjYi5hcHBseSh0aGlzLFt7ZGF0YTpidWZmLGFkdjphZHZ9XSk7XHRcclxufVxyXG5cclxuXHJcbnZhciByZWFkU3RyaW5nPSBmdW5jdGlvbihwb3MsYmxvY2tzaXplLGVuY29kaW5nLGNiKSB7XHJcblx0aWYgKHZlcmJvc2UpIGNvbnNvbGUuZGVidWcoXCJyZWFkc3RyaW5nIGF0IFwiK3BvcytcIiBibG9ja3NpemUgXCIgK2Jsb2Nrc2l6ZStcIiBlbmM6XCIrZW5jb2RpbmcpO1xyXG5cdGlmIChlbmNvZGluZz09XCJ1Y3MyXCIpIHtcclxuXHRcdHZhciBzdHI9a2ZzLnJlYWRVTEUxNlN0cmluZyh0aGlzLmhhbmRsZSxwb3MsYmxvY2tzaXplKTtcclxuXHR9IGVsc2Uge1xyXG5cdFx0dmFyIHN0cj1rZnMucmVhZFVURjhTdHJpbmcodGhpcy5oYW5kbGUscG9zLGJsb2Nrc2l6ZSk7XHRcclxuXHR9XHQgXHJcblx0aWYgKHZlcmJvc2UpIGNvbnNvbGUuZGVidWcoc3RyKTtcclxuXHRjYi5hcHBseSh0aGlzLFtzdHJdKTtcdFxyXG59XHJcblxyXG52YXIgcmVhZEZpeGVkQXJyYXkgPSBmdW5jdGlvbihwb3MgLGNvdW50LCB1bml0c2l6ZSxjYikge1xyXG5cdGlmICh2ZXJib3NlKSBjb25zb2xlLmRlYnVnKFwicmVhZCBmaXhlZCBhcnJheSBhdCBcIitwb3MrXCIgY291bnQgXCIrY291bnQrXCIgdW5pdHNpemUgXCIrdW5pdHNpemUpOyBcclxuXHR2YXIgYnVmPWtmcy5yZWFkRml4ZWRBcnJheSh0aGlzLmhhbmRsZSxwb3MsY291bnQsdW5pdHNpemUpO1xyXG5cdHZhciBidWZmPUpTT04ucGFyc2UoYnVmKTtcclxuXHRpZiAodmVyYm9zZSkgY29uc29sZS5kZWJ1ZyhcImFycmF5IGxlbmd0aFwiK2J1ZmYubGVuZ3RoKTtcclxuXHRjYi5hcHBseSh0aGlzLFtidWZmXSk7XHRcclxufVxyXG52YXIgcmVhZFN0cmluZ0FycmF5ID0gZnVuY3Rpb24ocG9zLGJsb2Nrc2l6ZSxlbmNvZGluZyxjYikge1xyXG5cdGlmICh2ZXJib3NlKSBjb25zb2xlLmxvZyhcInJlYWQgU3RyaW5nIGFycmF5IGF0IFwiK3BvcytcIiBibG9ja3NpemUgXCIrYmxvY2tzaXplICtcIiBlbmMgXCIrZW5jb2RpbmcpOyBcclxuXHRlbmNvZGluZyA9IGVuY29kaW5nfHxcInV0ZjhcIjtcclxuXHR2YXIgYnVmPWtmcy5yZWFkU3RyaW5nQXJyYXkodGhpcy5oYW5kbGUscG9zLGJsb2Nrc2l6ZSxlbmNvZGluZyk7XHJcblx0Ly92YXIgYnVmZj1KU09OLnBhcnNlKGJ1Zik7XHJcblx0aWYgKHZlcmJvc2UpIGNvbnNvbGUuZGVidWcoXCJyZWFkIHN0cmluZyBhcnJheVwiKTtcclxuXHR2YXIgYnVmZj1idWYuc3BsaXQoXCJcXHVmZmZmXCIpOyAvL2Nhbm5vdCByZXR1cm4gc3RyaW5nIHdpdGggMFxyXG5cdGlmICh2ZXJib3NlKSBjb25zb2xlLmRlYnVnKFwiYXJyYXkgbGVuZ3RoXCIrYnVmZi5sZW5ndGgpO1xyXG5cdGNiLmFwcGx5KHRoaXMsW2J1ZmZdKTtcdFxyXG59XHJcbnZhciBtZXJnZVBvc3RpbmdzPWZ1bmN0aW9uKHBvc2l0aW9ucyxjYikge1xyXG5cdHZhciBidWY9a2ZzLm1lcmdlUG9zdGluZ3ModGhpcy5oYW5kbGUsSlNPTi5zdHJpbmdpZnkocG9zaXRpb25zKSk7XHJcblx0aWYgKCFidWYgfHwgYnVmLmxlbmd0aD09MCkgcmV0dXJuIFtdO1xyXG5cdGVsc2UgcmV0dXJuIEpTT04ucGFyc2UoYnVmKTtcclxufVxyXG5cclxudmFyIGZyZWU9ZnVuY3Rpb24oKSB7XHJcblx0Ly9jb25zb2xlLmxvZygnY2xvc2luZyAnLGhhbmRsZSk7XHJcblx0a2ZzLmNsb3NlKHRoaXMuaGFuZGxlKTtcclxufVxyXG52YXIgT3Blbj1mdW5jdGlvbihwYXRoLG9wdHMsY2IpIHtcclxuXHRvcHRzPW9wdHN8fHt9O1xyXG5cdHZhciBzaWduYXR1cmVfc2l6ZT0xO1xyXG5cdHZhciBzZXR1cGFwaT1mdW5jdGlvbigpIHsgXHJcblx0XHR0aGlzLnJlYWRTaWduYXR1cmU9cmVhZFNpZ25hdHVyZTtcclxuXHRcdHRoaXMucmVhZEkzMj1yZWFkSTMyO1xyXG5cdFx0dGhpcy5yZWFkVUkzMj1yZWFkVUkzMjtcclxuXHRcdHRoaXMucmVhZFVJOD1yZWFkVUk4O1xyXG5cdFx0dGhpcy5yZWFkQnVmPXJlYWRCdWY7XHJcblx0XHR0aGlzLnJlYWRCdWZfcGFja2VkaW50PXJlYWRCdWZfcGFja2VkaW50O1xyXG5cdFx0dGhpcy5yZWFkRml4ZWRBcnJheT1yZWFkRml4ZWRBcnJheTtcclxuXHRcdHRoaXMucmVhZFN0cmluZz1yZWFkU3RyaW5nO1xyXG5cdFx0dGhpcy5yZWFkU3RyaW5nQXJyYXk9cmVhZFN0cmluZ0FycmF5O1xyXG5cdFx0dGhpcy5zaWduYXR1cmVfc2l6ZT1zaWduYXR1cmVfc2l6ZTtcclxuXHRcdHRoaXMubWVyZ2VQb3N0aW5ncz1tZXJnZVBvc3RpbmdzO1xyXG5cdFx0dGhpcy5mcmVlPWZyZWU7XHJcblx0XHR0aGlzLnNpemU9a2ZzLmdldEZpbGVTaXplKHRoaXMuaGFuZGxlKTtcclxuXHRcdGlmICh2ZXJib3NlKSBjb25zb2xlLmxvZyhcImZpbGVzaXplICBcIit0aGlzLnNpemUpO1xyXG5cdFx0aWYgKGNiKVx0Y2IuY2FsbCh0aGlzKTtcclxuXHR9XHJcblxyXG5cdHRoaXMuaGFuZGxlPWtmcy5vcGVuKHBhdGgpO1xyXG5cdHRoaXMub3BlbmVkPXRydWU7XHJcblx0c2V0dXBhcGkuY2FsbCh0aGlzKTtcclxuXHRyZXR1cm4gdGhpcztcclxufVxyXG5cclxubW9kdWxlLmV4cG9ydHM9T3BlbjsiLCIvKlxyXG4gIEpTQ29udGV4dCBjYW4gcmV0dXJuIGFsbCBKYXZhc2NyaXB0IHR5cGVzLlxyXG4qL1xyXG52YXIgdmVyYm9zZT0xO1xyXG5cclxudmFyIHJlYWRTaWduYXR1cmU9ZnVuY3Rpb24ocG9zLGNiKSB7XHJcblx0aWYgKHZlcmJvc2UpICBrc2FuYWdhcC5sb2coXCJyZWFkIHNpZ25hdHVyZSBhdCBcIitwb3MpO1xyXG5cdHZhciBzaWduYXR1cmU9a2ZzLnJlYWRVVEY4U3RyaW5nKHRoaXMuaGFuZGxlLHBvcywxKTtcclxuXHRpZiAodmVyYm9zZSkgIGtzYW5hZ2FwLmxvZyhzaWduYXR1cmUrXCIgXCIrc2lnbmF0dXJlLmNoYXJDb2RlQXQoMCkpO1xyXG5cdGNiLmFwcGx5KHRoaXMsW3NpZ25hdHVyZV0pO1xyXG59XHJcbnZhciByZWFkSTMyPWZ1bmN0aW9uKHBvcyxjYikge1xyXG5cdGlmICh2ZXJib3NlKSAga3NhbmFnYXAubG9nKFwicmVhZCBpMzIgYXQgXCIrcG9zKTtcclxuXHR2YXIgaTMyPWtmcy5yZWFkSW50MzIodGhpcy5oYW5kbGUscG9zKTtcclxuXHRpZiAodmVyYm9zZSkgIGtzYW5hZ2FwLmxvZyhpMzIpO1xyXG5cdGNiLmFwcGx5KHRoaXMsW2kzMl0pO1x0XHJcbn1cclxudmFyIHJlYWRVSTMyPWZ1bmN0aW9uKHBvcyxjYikge1xyXG5cdGlmICh2ZXJib3NlKSAga3NhbmFnYXAubG9nKFwicmVhZCB1aTMyIGF0IFwiK3Bvcyk7XHJcblx0dmFyIHVpMzI9a2ZzLnJlYWRVSW50MzIodGhpcy5oYW5kbGUscG9zKTtcclxuXHRpZiAodmVyYm9zZSkgIGtzYW5hZ2FwLmxvZyh1aTMyKTtcclxuXHRjYi5hcHBseSh0aGlzLFt1aTMyXSk7XHJcbn1cclxudmFyIHJlYWRVSTg9ZnVuY3Rpb24ocG9zLGNiKSB7XHJcblx0aWYgKHZlcmJvc2UpICBrc2FuYWdhcC5sb2coXCJyZWFkIHVpOCBhdCBcIitwb3MpOyBcclxuXHR2YXIgdWk4PWtmcy5yZWFkVUludDgodGhpcy5oYW5kbGUscG9zKTtcclxuXHRpZiAodmVyYm9zZSkgIGtzYW5hZ2FwLmxvZyh1aTgpO1xyXG5cdGNiLmFwcGx5KHRoaXMsW3VpOF0pO1xyXG59XHJcbnZhciByZWFkQnVmPWZ1bmN0aW9uKHBvcyxibG9ja3NpemUsY2IpIHtcclxuXHRpZiAodmVyYm9zZSkgIGtzYW5hZ2FwLmxvZyhcInJlYWQgYnVmZmVyIGF0IFwiK3Bvcyk7XHJcblx0dmFyIGJ1Zj1rZnMucmVhZEJ1Zih0aGlzLmhhbmRsZSxwb3MsYmxvY2tzaXplKTtcclxuXHRpZiAodmVyYm9zZSkgIGtzYW5hZ2FwLmxvZyhcImJ1ZmZlciBsZW5ndGhcIitidWYubGVuZ3RoKTtcclxuXHRjYi5hcHBseSh0aGlzLFtidWZdKTtcdFxyXG59XHJcbnZhciByZWFkQnVmX3BhY2tlZGludD1mdW5jdGlvbihwb3MsYmxvY2tzaXplLGNvdW50LHJlc2V0LGNiKSB7XHJcblx0aWYgKHZlcmJvc2UpICBrc2FuYWdhcC5sb2coXCJyZWFkIHBhY2tlZCBpbnQgZmFzdCwgYmxvY2tzaXplIFwiK2Jsb2Nrc2l6ZStcIiBhdCBcIitwb3MpO3ZhciB0PW5ldyBEYXRlKCk7XHJcblx0dmFyIGJ1Zj1rZnMucmVhZEJ1Zl9wYWNrZWRpbnQodGhpcy5oYW5kbGUscG9zLGJsb2Nrc2l6ZSxjb3VudCxyZXNldCk7XHJcblx0aWYgKHZlcmJvc2UpICBrc2FuYWdhcC5sb2coXCJyZXR1cm4gZnJvbSBwYWNrZWRpbnQsIHRpbWVcIiArIChuZXcgRGF0ZSgpLXQpKTtcclxuXHRpZiAodHlwZW9mIGJ1Zi5kYXRhPT1cInN0cmluZ1wiKSB7XHJcblx0XHRidWYuZGF0YT1ldmFsKFwiW1wiK2J1Zi5kYXRhLnN1YnN0cigwLGJ1Zi5kYXRhLmxlbmd0aC0xKStcIl1cIik7XHJcblx0fVxyXG5cdGlmICh2ZXJib3NlKSAga3NhbmFnYXAubG9nKFwidW5wYWNrZWQgbGVuZ3RoXCIrYnVmLmRhdGEubGVuZ3RoK1wiIHRpbWVcIiArIChuZXcgRGF0ZSgpLXQpICk7XHJcblx0Y2IuYXBwbHkodGhpcyxbYnVmXSk7XHJcbn1cclxuXHJcblxyXG52YXIgcmVhZFN0cmluZz0gZnVuY3Rpb24ocG9zLGJsb2Nrc2l6ZSxlbmNvZGluZyxjYikge1xyXG5cclxuXHRpZiAodmVyYm9zZSkgIGtzYW5hZ2FwLmxvZyhcInJlYWRzdHJpbmcgYXQgXCIrcG9zK1wiIGJsb2Nrc2l6ZSBcIitibG9ja3NpemUrXCIgXCIrZW5jb2RpbmcpO3ZhciB0PW5ldyBEYXRlKCk7XHJcblx0aWYgKGVuY29kaW5nPT1cInVjczJcIikge1xyXG5cdFx0dmFyIHN0cj1rZnMucmVhZFVMRTE2U3RyaW5nKHRoaXMuaGFuZGxlLHBvcyxibG9ja3NpemUpO1xyXG5cdH0gZWxzZSB7XHJcblx0XHR2YXIgc3RyPWtmcy5yZWFkVVRGOFN0cmluZyh0aGlzLmhhbmRsZSxwb3MsYmxvY2tzaXplKTtcdFxyXG5cdH1cclxuXHRpZiAodmVyYm9zZSkgIGtzYW5hZ2FwLmxvZyhzdHIrXCIgdGltZVwiKyhuZXcgRGF0ZSgpLXQpKTtcclxuXHRjYi5hcHBseSh0aGlzLFtzdHJdKTtcdFxyXG59XHJcblxyXG52YXIgcmVhZEZpeGVkQXJyYXkgPSBmdW5jdGlvbihwb3MgLGNvdW50LCB1bml0c2l6ZSxjYikge1xyXG5cdGlmICh2ZXJib3NlKSAga3NhbmFnYXAubG9nKFwicmVhZCBmaXhlZCBhcnJheSBhdCBcIitwb3MpOyB2YXIgdD1uZXcgRGF0ZSgpO1xyXG5cdHZhciBidWY9a2ZzLnJlYWRGaXhlZEFycmF5KHRoaXMuaGFuZGxlLHBvcyxjb3VudCx1bml0c2l6ZSk7XHJcblx0aWYgKHZlcmJvc2UpICBrc2FuYWdhcC5sb2coXCJhcnJheSBsZW5ndGggXCIrYnVmLmxlbmd0aCtcIiB0aW1lXCIrKG5ldyBEYXRlKCktdCkpO1xyXG5cdGNiLmFwcGx5KHRoaXMsW2J1Zl0pO1x0XHJcbn1cclxudmFyIHJlYWRTdHJpbmdBcnJheSA9IGZ1bmN0aW9uKHBvcyxibG9ja3NpemUsZW5jb2RpbmcsY2IpIHtcclxuXHQvL2lmICh2ZXJib3NlKSAga3NhbmFnYXAubG9nKFwicmVhZCBTdHJpbmcgYXJyYXkgXCIrYmxvY2tzaXplICtcIiBcIitlbmNvZGluZyk7IFxyXG5cdGVuY29kaW5nID0gZW5jb2Rpbmd8fFwidXRmOFwiO1xyXG5cdGlmICh2ZXJib3NlKSAga3NhbmFnYXAubG9nKFwicmVhZCBzdHJpbmcgYXJyYXkgYXQgXCIrcG9zKTt2YXIgdD1uZXcgRGF0ZSgpO1xyXG5cdHZhciBidWY9a2ZzLnJlYWRTdHJpbmdBcnJheSh0aGlzLmhhbmRsZSxwb3MsYmxvY2tzaXplLGVuY29kaW5nKTtcclxuXHRpZiAodHlwZW9mIGJ1Zj09XCJzdHJpbmdcIikgYnVmPWJ1Zi5zcGxpdChcIlxcMFwiKTtcclxuXHQvL3ZhciBidWZmPUpTT04ucGFyc2UoYnVmKTtcclxuXHQvL3ZhciBidWZmPWJ1Zi5zcGxpdChcIlxcdWZmZmZcIik7IC8vY2Fubm90IHJldHVybiBzdHJpbmcgd2l0aCAwXHJcblx0aWYgKHZlcmJvc2UpICBrc2FuYWdhcC5sb2coXCJzdHJpbmcgYXJyYXkgbGVuZ3RoXCIrYnVmLmxlbmd0aCtcIiB0aW1lXCIrKG5ldyBEYXRlKCktdCkpO1xyXG5cdGNiLmFwcGx5KHRoaXMsW2J1Zl0pO1xyXG59XHJcblxyXG52YXIgbWVyZ2VQb3N0aW5ncz1mdW5jdGlvbihwb3NpdGlvbnMpIHtcclxuXHR2YXIgYnVmPWtmcy5tZXJnZVBvc3RpbmdzKHRoaXMuaGFuZGxlLHBvc2l0aW9ucyk7XHJcblx0aWYgKHR5cGVvZiBidWY9PVwic3RyaW5nXCIpIHtcclxuXHRcdGJ1Zj1ldmFsKFwiW1wiK2J1Zi5zdWJzdHIoMCxidWYubGVuZ3RoLTEpK1wiXVwiKTtcclxuXHR9XHJcblx0cmV0dXJuIGJ1ZjtcclxufVxyXG52YXIgZnJlZT1mdW5jdGlvbigpIHtcclxuXHQvLy8vaWYgKHZlcmJvc2UpICBrc2FuYWdhcC5sb2coJ2Nsb3NpbmcgJyxoYW5kbGUpO1xyXG5cdGtmcy5jbG9zZSh0aGlzLmhhbmRsZSk7XHJcbn1cclxudmFyIE9wZW49ZnVuY3Rpb24ocGF0aCxvcHRzLGNiKSB7XHJcblx0b3B0cz1vcHRzfHx7fTtcclxuXHR2YXIgc2lnbmF0dXJlX3NpemU9MTtcclxuXHR2YXIgc2V0dXBhcGk9ZnVuY3Rpb24oKSB7IFxyXG5cdFx0dGhpcy5yZWFkU2lnbmF0dXJlPXJlYWRTaWduYXR1cmU7XHJcblx0XHR0aGlzLnJlYWRJMzI9cmVhZEkzMjtcclxuXHRcdHRoaXMucmVhZFVJMzI9cmVhZFVJMzI7XHJcblx0XHR0aGlzLnJlYWRVSTg9cmVhZFVJODtcclxuXHRcdHRoaXMucmVhZEJ1Zj1yZWFkQnVmO1xyXG5cdFx0dGhpcy5yZWFkQnVmX3BhY2tlZGludD1yZWFkQnVmX3BhY2tlZGludDtcclxuXHRcdHRoaXMucmVhZEZpeGVkQXJyYXk9cmVhZEZpeGVkQXJyYXk7XHJcblx0XHR0aGlzLnJlYWRTdHJpbmc9cmVhZFN0cmluZztcclxuXHRcdHRoaXMucmVhZFN0cmluZ0FycmF5PXJlYWRTdHJpbmdBcnJheTtcclxuXHRcdHRoaXMuc2lnbmF0dXJlX3NpemU9c2lnbmF0dXJlX3NpemU7XHJcblx0XHR0aGlzLm1lcmdlUG9zdGluZ3M9bWVyZ2VQb3N0aW5ncztcclxuXHRcdHRoaXMuZnJlZT1mcmVlO1xyXG5cdFx0dGhpcy5zaXplPWtmcy5nZXRGaWxlU2l6ZSh0aGlzLmhhbmRsZSk7XHJcblx0XHRpZiAodmVyYm9zZSkgIGtzYW5hZ2FwLmxvZyhcImZpbGVzaXplICBcIit0aGlzLnNpemUpO1xyXG5cdFx0aWYgKGNiKVx0Y2IuY2FsbCh0aGlzKTtcclxuXHR9XHJcblxyXG5cdHRoaXMuaGFuZGxlPWtmcy5vcGVuKHBhdGgpO1xyXG5cdHRoaXMub3BlbmVkPXRydWU7XHJcblx0c2V0dXBhcGkuY2FsbCh0aGlzKTtcclxuXHRyZXR1cm4gdGhpcztcclxufVxyXG5cclxubW9kdWxlLmV4cG9ydHM9T3BlbjsiLCIvKiBPUyBkZXBlbmRlbnQgZmlsZSBvcGVyYXRpb24gKi9cclxuaWYgKHR5cGVvZiBub2RlUmVxdWlyZT09J3VuZGVmaW5lZCcpIHZhciBub2RlUmVxdWlyZT0odHlwZW9mIGtzYW5hPT1cInVuZGVmaW5lZFwiKT9yZXF1aXJlOmtzYW5hLnJlcXVpcmU7XHJcblxyXG52YXIgZnM9bm9kZVJlcXVpcmUoJ2ZzJyk7XHJcbnZhciBzaWduYXR1cmVfc2l6ZT0xO1xyXG5cclxudmFyIHVucGFja19pbnQgPSBmdW5jdGlvbiAoYXIsIGNvdW50ICwgcmVzZXQpIHtcclxuICAgY291bnQ9Y291bnR8fGFyLmxlbmd0aDtcclxuICAgLypcclxuXHRpZiAodHlwZW9mIGlqc191bnBhY2tfaW50ID09ICdmdW5jdGlvbicpIHtcclxuXHRcdHZhciBSID0gaWpzX3VucGFja19pbnQoYXIsIGNvdW50LCByZXNldClcclxuXHRcdHJldHVybiBSXHJcblx0fTtcclxuXHQqL1xyXG4gIHZhciByID0gW10sIGkgPSAwLCB2ID0gMDtcclxuICBkbyB7XHJcblx0dmFyIHNoaWZ0ID0gMDtcclxuXHRkbyB7XHJcblx0ICB2ICs9ICgoYXJbaV0gJiAweDdGKSA8PCBzaGlmdCk7XHJcblx0ICBzaGlmdCArPSA3O1x0ICBcclxuXHR9IHdoaWxlIChhclsrK2ldICYgMHg4MCk7XHJcblx0ci5wdXNoKHYpOyBpZiAocmVzZXQpIHY9MDtcclxuXHRjb3VudC0tO1xyXG4gIH0gd2hpbGUgKGk8YXIubGVuZ3RoICYmIGNvdW50KTtcclxuICByZXR1cm4ge2RhdGE6ciwgYWR2OmkgfTtcclxufVxyXG52YXIgU3luYz1mdW5jdGlvbihrZnMpIHtcclxuXHR2YXIgaGFuZGxlPWtmcy5oYW5kbGU7XHJcblxyXG5cdHZhciByZWFkU2lnbmF0dXJlPWZ1bmN0aW9uKHBvcykge1xyXG5cdFx0dmFyIGJ1Zj1uZXcgQnVmZmVyKHNpZ25hdHVyZV9zaXplKTtcclxuXHRcdGZzLnJlYWRTeW5jKGhhbmRsZSxidWYsMCxzaWduYXR1cmVfc2l6ZSxwb3MpO1xyXG5cdFx0dmFyIHNpZ25hdHVyZT1idWYudG9TdHJpbmcoJ3V0ZjgnLDAsc2lnbmF0dXJlX3NpemUpO1xyXG5cdFx0cmV0dXJuIHNpZ25hdHVyZTtcclxuXHR9XHJcblx0dmFyIHJlYWRTdHJpbmc9IGZ1bmN0aW9uKHBvcyxibG9ja3NpemUsZW5jb2RpbmcpIHtcclxuXHRcdGVuY29kaW5nPWVuY29kaW5nfHwndXRmOCc7XHJcblx0XHR2YXIgYnVmZmVyPW5ldyBCdWZmZXIoYmxvY2tzaXplKTtcclxuXHRcdGZzLnJlYWRTeW5jKGhhbmRsZSxidWZmZXIsMCxibG9ja3NpemUscG9zKTtcclxuXHRcdHJldHVybiBidWZmZXIudG9TdHJpbmcoZW5jb2RpbmcpO1xyXG5cdH1cclxuXHJcblx0dmFyIHJlYWRTdHJpbmdBcnJheSA9IGZ1bmN0aW9uKHBvcyxibG9ja3NpemUsZW5jb2RpbmcpIHtcclxuXHRcdGlmIChibG9ja3NpemU9PTApIHJldHVybiBbXTtcclxuXHRcdGVuY29kaW5nPWVuY29kaW5nfHwndXRmOCc7XHJcblx0XHR2YXIgYnVmZmVyPW5ldyBCdWZmZXIoYmxvY2tzaXplKTtcclxuXHRcdGZzLnJlYWRTeW5jKGhhbmRsZSxidWZmZXIsMCxibG9ja3NpemUscG9zKTtcclxuXHRcdHZhciBvdXQ9YnVmZmVyLnRvU3RyaW5nKGVuY29kaW5nKS5zcGxpdCgnXFwwJyk7XHJcblx0XHRyZXR1cm4gb3V0O1xyXG5cdH1cclxuXHR2YXIgcmVhZFVJMzI9ZnVuY3Rpb24ocG9zKSB7XHJcblx0XHR2YXIgYnVmZmVyPW5ldyBCdWZmZXIoNCk7XHJcblx0XHRmcy5yZWFkU3luYyhoYW5kbGUsYnVmZmVyLDAsNCxwb3MpO1xyXG5cdFx0cmV0dXJuIGJ1ZmZlci5yZWFkVUludDMyQkUoMCk7XHJcblx0fVxyXG5cdHZhciByZWFkSTMyPWZ1bmN0aW9uKHBvcykge1xyXG5cdFx0dmFyIGJ1ZmZlcj1uZXcgQnVmZmVyKDQpO1xyXG5cdFx0ZnMucmVhZFN5bmMoaGFuZGxlLGJ1ZmZlciwwLDQscG9zKTtcclxuXHRcdHJldHVybiBidWZmZXIucmVhZEludDMyQkUoMCk7XHJcblx0fVxyXG5cdHZhciByZWFkVUk4PWZ1bmN0aW9uKHBvcykge1xyXG5cdFx0dmFyIGJ1ZmZlcj1uZXcgQnVmZmVyKDEpO1xyXG5cdFx0ZnMucmVhZFN5bmMoaGFuZGxlLGJ1ZmZlciwwLDEscG9zKTtcclxuXHRcdHJldHVybiBidWZmZXIucmVhZFVJbnQ4KDApO1xyXG5cdH1cclxuXHR2YXIgcmVhZEJ1Zj1mdW5jdGlvbihwb3MsYmxvY2tzaXplKSB7XHJcblx0XHR2YXIgYnVmPW5ldyBCdWZmZXIoYmxvY2tzaXplKTtcclxuXHRcdGZzLnJlYWRTeW5jKGhhbmRsZSxidWYsMCxibG9ja3NpemUscG9zKTtcclxuXHRcclxuXHRcdHJldHVybiBidWY7XHJcblx0fVxyXG5cdHZhciByZWFkQnVmX3BhY2tlZGludD1mdW5jdGlvbihwb3MsYmxvY2tzaXplLGNvdW50LHJlc2V0KSB7XHJcblx0XHR2YXIgYnVmPXJlYWRCdWYocG9zLGJsb2Nrc2l6ZSk7XHJcblx0XHRyZXR1cm4gdW5wYWNrX2ludChidWYsY291bnQscmVzZXQpO1xyXG5cdH1cclxuXHQvLyBzaWduYXR1cmUsIGl0ZW1jb3VudCwgcGF5bG9hZFxyXG5cdHZhciByZWFkRml4ZWRBcnJheSA9IGZ1bmN0aW9uKHBvcyAsY291bnQsIHVuaXRzaXplKSB7XHJcblx0XHR2YXIgZnVuYztcclxuXHRcdFxyXG5cdFx0aWYgKHVuaXRzaXplKiBjb3VudD50aGlzLnNpemUgJiYgdGhpcy5zaXplKSAge1xyXG5cdFx0XHR0aHJvdyBcImFycmF5IHNpemUgZXhjZWVkIGZpbGUgc2l6ZVwiXHJcblx0XHRcdHJldHVybjtcclxuXHRcdH1cclxuXHRcdFxyXG5cdFx0dmFyIGl0ZW1zPW5ldyBCdWZmZXIoIHVuaXRzaXplKiBjb3VudCk7XHJcblx0XHRpZiAodW5pdHNpemU9PT0xKSB7XHJcblx0XHRcdGZ1bmM9aXRlbXMucmVhZFVJbnQ4O1xyXG5cdFx0fSBlbHNlIGlmICh1bml0c2l6ZT09PTIpIHtcclxuXHRcdFx0ZnVuYz1pdGVtcy5yZWFkVUludDE2QkU7XHJcblx0XHR9IGVsc2UgaWYgKHVuaXRzaXplPT09NCkge1xyXG5cdFx0XHRmdW5jPWl0ZW1zLnJlYWRVSW50MzJCRTtcclxuXHRcdH0gZWxzZSB0aHJvdyAndW5zdXBwb3J0ZWQgaW50ZWdlciBzaXplJztcclxuXHRcdC8vY29uc29sZS5sb2coJ2l0ZW1jb3VudCcsaXRlbWNvdW50LCdidWZmZXInLGJ1ZmZlcik7XHJcblx0XHRmcy5yZWFkU3luYyhoYW5kbGUsaXRlbXMsMCx1bml0c2l6ZSpjb3VudCxwb3MpO1xyXG5cdFx0dmFyIG91dD1bXTtcclxuXHRcdGZvciAodmFyIGkgPSAwOyBpIDwgaXRlbXMubGVuZ3RoIC8gdW5pdHNpemU7IGkrKykge1xyXG5cdFx0XHRvdXQucHVzaCggZnVuYy5hcHBseShpdGVtcyxbaSp1bml0c2l6ZV0pICk7XHJcblx0XHR9XHJcblx0XHRyZXR1cm4gb3V0O1xyXG5cdH1cclxuXHRcclxuXHRrZnMucmVhZFNpZ25hdHVyZVN5bmM9cmVhZFNpZ25hdHVyZTtcclxuXHRrZnMucmVhZEkzMlN5bmM9cmVhZEkzMjtcclxuXHRrZnMucmVhZFVJMzJTeW5jPXJlYWRVSTMyO1xyXG5cdGtmcy5yZWFkVUk4U3luYz1yZWFkVUk4O1xyXG5cdGtmcy5yZWFkQnVmU3luYz1yZWFkQnVmO1xyXG5cdGtmcy5yZWFkQnVmX3BhY2tlZGludFN5bmM9cmVhZEJ1Zl9wYWNrZWRpbnQ7XHJcblx0a2ZzLnJlYWRGaXhlZEFycmF5U3luYz1yZWFkRml4ZWRBcnJheTtcclxuXHRrZnMucmVhZFN0cmluZ1N5bmM9cmVhZFN0cmluZztcclxuXHRrZnMucmVhZFN0cmluZ0FycmF5U3luYz1yZWFkU3RyaW5nQXJyYXk7XHJcblx0a2ZzLnNpZ25hdHVyZV9zaXplU3luYz1zaWduYXR1cmVfc2l6ZTtcclxuXHRcclxuXHRyZXR1cm4ga2ZzO1xyXG59XHJcbm1vZHVsZS5leHBvcnRzPVN5bmM7XHJcbiJdfQ==
