/*
  JSContext can return all Javascript types.
*/
var verbose=0,async=!!kfs.async;

var readSignature=function(pos,cb) {
	if (verbose)  ksanagap.log("read signature at "+pos);
	if (async) {
		var that=this;
		kfs.readUTF8String(this.handle,pos,1,function(signature){
			cb.call(that,signature);
		});
	} else {
		
		var signature=kfs.readUTF8String(this.handle,pos,1);
		if (verbose)  ksanagap.log(signature+" "+signature.charCodeAt(0));
		cb.apply(this,[signature]);
	}
}
var readI32=function(pos,cb) {
	if (async) {
		var that=this;
		kfs.readInt32(this.handle,pos,function(i32){
			cb.call(that,i32);
		});
	} else {	
		if (verbose)  ksanagap.log("read i32 at "+pos);
		var i32=kfs.readInt32(this.handle,pos);
		if (verbose)  ksanagap.log(i32);
		cb.apply(this,[i32]);	
	}
}
var readUI32=function(pos,cb) {
	if (async) {
		var that=this;
		kfs.readUInt32(this.handle,pos,function(ui32){
			cb.call(that,ui32);
		});
	} else {	
		if (verbose)  ksanagap.log("read ui32 at "+pos);
		var ui32=kfs.readUInt32(this.handle,pos);
		if (verbose)  ksanagap.log(ui32);
		cb.apply(this,[ui32]);
	}
}
var readUI8=function(pos,cb) {
	if (async) {
		var that=this;
		kfs.readUInt8(this.handle,pos,function(ui8){
			cb.call(that,ui8);
		});
	} else {
		if (verbose)  ksanagap.log("read ui8 at "+pos); 
		var ui8=kfs.readUInt8(this.handle,pos);
		if (verbose)  ksanagap.log(ui8);
		cb.apply(this,[ui8]);
	}
}
var readBuf=function(pos,blocksize,cb) {
	if (async) {
		var that=this;
		kfs.readBuf(this.handle,pos,blocksize,function(buf){
			cb.call(that,buf);
		});
	} else {

		if (verbose)  ksanagap.log("read buffer at "+pos);
		var buf=kfs.readBuf(this.handle,pos,blocksize);
		if (verbose)  ksanagap.log("buffer length"+buf.length);
		cb.apply(this,[buf]);	
	}
}
var readBuf_packedint=function(pos,blocksize,count,reset,cb) {
	if (async) {
		var that=this;
		kfs.readBuf_packedint(this.handle,pos,blocksize,count,reset,function(buf){
			if (typeof buf.data=="string") {
				buf.data=eval("["+buf.data.substr(0,buf.data.length-1)+"]");
			}			
			cb.call(that,buf);
		});
	} else {

		if (verbose)  ksanagap.log("read packed int fast, blocksize "+blocksize+" at "+pos);var t=new Date();
		var buf=kfs.readBuf_packedint(this.handle,pos,blocksize,count,reset);
		if (verbose)  ksanagap.log("return from packedint, time" + (new Date()-t));
		if (typeof buf.data=="string") {
			buf.data=eval("["+buf.data.substr(0,buf.data.length-1)+"]");
		}
		if (verbose)  ksanagap.log("unpacked length"+buf.data.length+" time" + (new Date()-t) );
		cb.apply(this,[buf]);
	}
}


var readString= function(pos,blocksize,encoding,cb) {
	if (verbose)  ksanagap.log("readstring at "+pos+" blocksize "+blocksize+" "+encoding);var t=new Date();
	if (encoding=="ucs2") {
		if (async) {
			var that=this;
			kfs.readULE16String(this.handle,pos,blocksize,function(str){
				cb.call(that,str);
			});
			return;
		} else {
			var str=kfs.readULE16String(this.handle,pos,blocksize);
		}
		
	} else {
		if (async) {
			var that=this;
			kfs.readUTF8String(this.handle,pos,blocksize,function(str){
				cb.call(that,str);
			});
			return;	
		} else {
			var str=kfs.readUTF8String(this.handle,pos,blocksize);	
		}
	}
	if (verbose)  ksanagap.log(str+" time"+(new Date()-t));
	cb.apply(this,[str]);	
}

var readFixedArray = function(pos ,count, unitsize,cb) {
	if (async) {
		var that=this;
		kfs.readFixedArray(this.handle,pos,count,unitsize,function(buf){
			cb.call(that,buf);
		});
	} else {

		if (verbose)  ksanagap.log("read fixed array at "+pos); var t=new Date();
		var buf=kfs.readFixedArray(this.handle,pos,count,unitsize);
		if (verbose)  ksanagap.log("array length "+buf.length+" time"+(new Date()-t));
		cb.apply(this,[buf]);		
	}

}
var readStringArray = function(pos,blocksize,encoding,cb) {
	//if (verbose)  ksanagap.log("read String array "+blocksize +" "+encoding); 
	encoding = encoding||"utf8";

	if (async) {
		var that=this;
		kfs.readStringArray(this.handle,pos,blocksize,encoding,function(buf){
			if (typeof buf=="string") buf=buf.split("\0");
			cb.call(that,buf);
		});
	} else {
		if (verbose)  ksanagap.log("read string array at "+pos);var t=new Date();
		var buf=kfs.readStringArray(this.handle,pos,blocksize,encoding);
		if (typeof buf=="string") buf=buf.split("\0");
		//var buff=JSON.parse(buf);
		//var buff=buf.split("\uffff"); //cannot return string with 0
		if (verbose)  ksanagap.log("string array length"+buf.length+" time"+(new Date()-t));
		cb.apply(this,[buf]);
	}
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
		if (kfs.getFileSize.length==1) {
			this.size=kfs.getFileSize(this.handle);	
		} else {
			var that=this;
			kfs.getFileSize(this.handle,function(size){
				that.size=size;
			});
		}
		
		if (cb)	cb.call(this);
	}

	if (kfs.open.length==1) {
		this.handle=kfs.open(path);
		this.opened=true;
		setupapi.call(this);
		return this;		
	} else { //react-native
		var that=this;
		kfs.open(path,function(handle){
			that.opened=true;
			that.handle=handle;
			setupapi.call(that);
		});
	}
}

module.exports=Open;