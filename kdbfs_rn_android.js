/*
  binding for react native android
  JAVA can only return Number and String
	array and buffer return in string format
	need JSON.parse
*/
var kfs=require("react-native-android-kdb");

var verbose=0;

var readSignature=function(pos,cb) {
	if (verbose) console.debug("read signature");
	kfs.readUTF8String(this.handle,pos,1,function(signature){
		if (verbose) console.debug(signature,signature.charCodeAt(0));
		cb.apply(this,[signature]);	
	});
}
var readI32=function(pos,cb) {
	if (verbose) console.debug("read i32 at "+pos);
	kfs.readInt32(this.handle,pos,function(i32){
		if (verbose) console.debug(i32);
		cb.apply(this,[i32]);	
	});
}
var readUI32=function(pos,cb) {
	if (verbose) console.debug("read ui32 at "+pos);
	kfs.readUInt32(this.handle,pos,function(ui32){
		if (verbose) console.debug(ui32);
		cb.apply(this,[ui32]);
	});
}
var readUI8=function(pos,cb) {
	if (verbose) console.debug("read ui8 at "+pos); 
	kfs.readUInt8(this.handle,pos,function(ui8){
		if (verbose) console.debug(ui8);
		cb.apply(this,[ui8]);
	});
}
var readBuf=function(pos,blocksize,cb) {
	if (verbose) console.debug("read buffer at "+pos+ " blocksize "+blocksize);
	kfs.readBuf(this.handle,pos,blocksize,function(buff){
		//var buff=JSON.parse(buf);
		if (verbose) console.debug("buffer length"+buff.length);
		cb.apply(this,[buff]);
	});
}
var readBuf_packedint=function(pos,blocksize,count,reset,cb) {
	if (verbose) console.debug("read packed int at "+pos+" blocksize "+blocksize+" count "+count);
	kfs.readBuf_packedint(this.handle,pos,blocksize,count,reset,function(buf){
		var adv=parseInt(buf);
		var buff=JSON.parse(buf.substr(buf.indexOf("[")));
		if (verbose) console.debug("packedInt length "+buff.length+" first item="+buff[0]);
		cb.apply(this,[{data:buff,adv:adv}]);	
	});	
}


var readString= function(pos,blocksize,encoding,cb) {
	if (verbose) console.debug("readstring at "+pos+" blocksize " +blocksize+" enc:"+encoding);
	if (encoding=="ucs2") {
		var func=kfs.readULE16String;
	} else {
		var func=kfs.readUTF8String
	}	 
	func(this.handle,pos,blocksize,function(str){
		if (verbose) console.debug(str);
		cb.apply(this,[str]);	
	})
}

var readFixedArray = function(pos ,count, unitsize,cb) {
	if (verbose) console.debug("read fixed array at "+pos+" count "+count+" unitsize "+unitsize); 
	kfs.readFixedArray(this.handle,pos,count,unitsize,function(buf){
		var buff=JSON.parse(buf);
		if (verbose) console.debug("array length"+buff.length);
		cb.apply(this,[buff]);	
	});
}
var readStringArray = function(pos,blocksize,encoding,cb) {
	if (verbose) console.log("read String array at "+pos+" blocksize "+blocksize +" enc "+encoding); 
	encoding = encoding||"utf8";
	kfs.readStringArray(this.handle,pos,blocksize,encoding,function(buf){
		//var buff=JSON.parse(buf);
		if (verbose) console.debug("read string array");
		var buff=buf.split("\uffff"); //cannot return string with 0
		if (verbose) console.debug("array length"+buff.length);
		cb.apply(this,[buff]);			
	});
}
var mergePostings=function(positions,cb) {
	kfs.mergePostings(this.handle,JSON.stringify(positions),function(buf){
		if (!buf || buf.length==0) return cb([]);
		else return cb(JSON.parse(buf));
	});
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
		kfs.getFileSize(this.handle,function(size){
			this.size=size;
		}.bind(this));
		if (verbose) console.log("filesize  "+this.size);
		if (cb)	cb.call(this);
	}

	kfs.open(path,function(handle){
		this.handle=handle;
		this.opened=true;
		setupapi.call(this);
	}.bind(this));

	return this;
}

module.exports=Open;