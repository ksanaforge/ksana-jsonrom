/* node.js and html5 file system abstraction layer*/
var fs,Buffer,html5fs;
const html5mode=function(){
	fs=require('./html5read');
	Buffer=function(){ return ""};
	html5fs=true; 	
}
try {
	fs=require("fs");
	Buffer=require("buffer").Buffer;
} catch (e) {
	html5mode();
}
if (typeof window !=="undefined" && window.node_modules && window.node_modules.fs) {
	fs=window.node_modules.fs;
	Buffer=window.node_modules.buffer.Buffer;
	console.log("fs by node webkit")
} else if (!fs.existsSync) {
	html5mode();
}

var signature_size=1;
var verbose=0, readLog=function(){};
var _readLog=function(readtype,bytes) {
	console.log(readtype,bytes);
}
if (verbose) readLog=_readLog;

var unpack_int = function (ar, count , reset) {
   count=count||ar.length;
  var r = []
  //var r=new Uint32Array(count);
  var i = 0, v = 0,n=0;
  do {
	var mul=1; //var shift = 0;

		do {
		  //v += ((ar[i] & 0x7F) << shift);
		  //shift += 7;	  
		//} while (ar[++i] & 0x80);

			v  = v + (ar[i] % 0x80) * mul;
			mul = mul * 128;
		} while (ar[++i] % 0x100 >= 0x80);
		r.push(v);


	//r[n++]=v;
		if (reset) v=0;
		count--;
  } while (i<ar.length && count);

  //var rr=r.subarray(0,n);
  return {data:r, adv:i };
}
var Open=function(path,opts,cb) {
	opts=opts||{};

	var readSignature=function(pos,cb) {
		var buf=(Buffer.alloc)?Buffer.alloc(signature_size):new Buffer(signature_size);
		
		var that=this;
		this.read(this.handle,buf,0,signature_size,pos,function(err,len,buffer){
			if (html5fs) var signature=String.fromCharCode((new Uint8Array(buffer))[0])
			else var signature=buffer.toString('utf8',0,signature_size);
			readLog("signature",signature.charCodeAt(0));
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

	var decodeule16buffer=function(buf) {
		if (typeof TextDecoder!=="undefined") {
			var decoder=new TextDecoder("utf-16le");
			return decoder.decode(buf)
		} else {
			return String.fromCharCode.apply(null, new Uint16Array(buf));
		}
	}
	var readString= function(pos,blocksize,encoding,cb) {
		encoding=encoding||'utf8';
		var buffer=new Buffer(blocksize);
		var that=this;
		this.read(this.handle,buffer,0,blocksize,pos,function(err,len,buffer){
			readLog("string",len);
			if (html5fs) {
				if (encoding=='utf8') {
					var str=decodeutf8(String.fromCharCode.apply(null, new Uint8Array(buffer)))
				} else { //ucs2 is 3 times faster
					var str=decodeule16buffer(buffer);
				}
				cb.apply(that,[str]);
			} 
			else cb.apply(that,[buffer.toString(encoding)]);	
		});
	}

	//work around for chrome fromCharCode cannot accept huge zarray
	//https://code.google.com/p/chromium/issues/detail?id=56588
	var buf2stringarr=function(buf,enc) {
		if (typeof TextDecoder!=="undefined") {
			//TextDecoder is two times faster
			if (enc==="ucs2") enc="utf-16le";
			var decoder=new TextDecoder(enc);
			return decoder.decode(buf).split("\0");
		} else{
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
	}
	var readStringArray = function(pos,blocksize,encoding,cb) {
		var that=this,out=null;
		if (blocksize==0) return [];
		encoding=encoding||'utf8';
		var buffer=new Buffer(blocksize);

		//if (blocksize>1000000) console.time("readstringarray");
		this.read(this.handle,buffer,0,blocksize,pos,function(err,len,buffer){
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
			//if (blocksize>1000000) console.timeEnd("readstringarray");
			cb.apply(that,[out]);
		});
	}
	var readUI32=function(pos,cb) {
		var buffer=new Buffer(4);
		var that=this;
		this.read(this.handle,buffer,0,4,pos,function(err,len,buffer){			
			if (html5fs){
				//v=(new Uint32Array(buffer))[0];
				var v=new DataView(buffer).getUint32(0, false)
				readLog("ui32",v);
				cb(v);
			}
			else cb.apply(that,[buffer.readInt32BE(0)]);	
		});		
	}

	var readI32=function(pos,cb) {
		var buffer=new Buffer(4);
		var that=this;
		this.read(this.handle,buffer,0,4,pos,function(err,len,buffer){
			
			if (html5fs){
				var v=new DataView(buffer).getInt32(0, false)
				readLog("i32",v);
				cb(v);
			}
			else  	cb.apply(that,[buffer.readInt32BE(0)]);	
		});
	}
	var readUI8=function(pos,cb) {
		var buffer=new Buffer(1);
		var that=this;

		this.read(this.handle,buffer,0,1,pos,function(err,len,buffer){
			
			if (html5fs){
				var v=(new Uint8Array(buffer))[0];
				readLog("ui8",v);
				cb(v) ;
			}
			else  			cb.apply(that,[buffer.readUInt8(0)]);	
			
		});
	}
	var readBuf=function(pos,blocksize,cb) {
		var that=this;
		var buf=new Buffer(blocksize);
		this.read(this.handle,buf,0,blocksize,pos,function(err,len,buffer){
			readLog("buf pos "+pos+' len '+len+' blocksize '+blocksize);
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

		this.read(this.handle,null,0,unitsize*count,pos,function(err,len,buffer){
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

		this.read(this.handle,items,0,unitsize*count,pos,function(err,len,buffer){
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
		this.read=fs.read;

		if (html5fs) {
			var fn=path;
			if (this.handle.file) {
				//local file
				fs.getFileSize(this.handle.file,function(size){
					that.size=size;
					if (cb) setTimeout(cb.bind(that),0);
				})
			} else if (fs&& fs.fs && fs.fs.root) {
				if (path.indexOf("filesystem:")==0) fn=path.substr(path.lastIndexOf("/"));
				//Google File system
				fs.fs.root.getFile(fn,{},function(entry){
				  entry.getMetadata(function(metadata) { 
					that.size=metadata.size;
					if (cb) setTimeout(cb.bind(that),0);
					});
				});				
			} else if (this.handle.url) {//use XHR
				fs.xhr_getFileSize(this.handle.url,function(err,size){
					if (err) {
						cb&&cb.call(that,"cannot open file");
					} else {
						that.size=size;
						that.read=fs.xhr_read;
						that.handle.filesize=size;//for xhr_read
						cb&& setTimeout(cb.bind(that),0);
					}
				})
			}
		} else {
			var stat=fs.fstatSync(this.handle);
			this.stat=stat;
			this.size=stat.size;		
			if (cb)	setTimeout(cb.bind(this,0),0);	
		}
	}

	var that=this;
	if (html5fs) {
		if (opts.webStorage){
			//local storage
		} else if (window && window.location.protocol.indexOf("http")>-1) {
			var slash=window.location.href.lastIndexOf("/");
			var approot=window.location.href.substr(0,slash+1);
			if (path.indexOf("/")>-1){
				approot=window.location.origin+"/";
			}
			path=approot+path;	
		}
		fs.open(path,function(h){
			if (!h) {
				cb("file not found:"+path);	
				return;
			} else {
				that.handle=h;
				that.html5fs=true;
				setupapi.call(that);
				that.opened=true;				
			}
		})
	} else {
		if (fs.existsSync && fs.existsSync(path)){
			this.handle=fs.openSync(path,'r');//,function(err,handle){
			this.opened=true;
			setupapi.call(this);
	  } else  {
			cb("file not found:"+path);	
			return null;
		}
	}
	return this;
}
module.exports=Open;