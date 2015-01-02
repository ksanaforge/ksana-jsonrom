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