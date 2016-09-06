/*reduce xhr call by using cache chunk
each chunk is 32K by default.
*/

var Caches={ } //url: chunks
var chunksize=1024*32;

var inCache=function(cache,startchunk,endchunk){
	for (var i=startchunk;i<=endchunk;i++) {
		if (!cache[i]) return false;
	}
	return true;
}

var getCachedBuffer=function(cache,offset,length){
	var startchunk=Math.floor(offset/chunksize);
	var endchunk=Math.floor((offset+length)/chunksize);
	if (startchunk===endchunk) {
		var end=(offset+length)-startchunk*chunksize;
		if (end>=cache[startchunk].byteLength){
			end=cache[startchunk].byteLength;
		}
		return cache[startchunk].slice(offset-startchunk*chunksize,end);
	}

	var buffer=new Uint8Array(length);
	var now=0;
	for (var i=startchunk;i<=endchunk;i++) {
		var buf,b;
		if (i==startchunk) {
			b=new Uint8Array(cache[startchunk].slice(offset-startchunk*chunksize,cache[startchunk].byteLength));
			buffer.set(b,0);
			now=cache[startchunk].byteLength-(offset-startchunk*chunksize);
		}else if (i==endchunk) {
			var end=(offset+length)-endchunk*chunksize;
			if (end>=cache[endchunk].byteLength){
				end=cache[endchunk].byteLength;
			}
			b=new Uint8Array(cache[endchunk].slice(0,end));
			buffer.set(b,now);
		} else {
			//normally a read will not cross many chunk
			b=new Uint8Array(cache[i]);
			buffer.set(b,now);;
			now+=cache[i].byteLength;
		}
	}
	return buffer.buffer;
}

var xhr_read=function(handle,nop1,nop2,length,position,cb){
	if (!Caches[handle.url]){
		Caches[handle.url]=[];
	}
	var cache=Caches[handle.url];
	var startchunk=Math.floor(position/chunksize);
	var endchunk=Math.floor((position+length)/chunksize);

	if (inCache(cache,startchunk,endchunk)){
		setTimeout(function(){
			var b=getCachedBuffer(cache,position,length);
			cb(0,b.byteLength,b);
		},0);
		return;
	};

//TODO , optimize: not not read data already in cache
	read(handle,null,0,(endchunk-startchunk+1)*chunksize,startchunk*chunksize,

		function(err,bytes,buffer){
		for (var i=0;i<=endchunk-startchunk;i++) {
			var end=(i+1)*chunksize;
			if (end>=buffer.byteLength) end=buffer.byteLength;
			cache[i+startchunk]=buffer.slice(i*chunksize,end);
		}
		setTimeout(function(){
			var b=getCachedBuffer(cache,position,length);
			cb(0,b.byteLength,b);
		},0);
	});
}

var read=function(handle,buffer,offset,length,position,cb) {//buffer and offset is not used
	var xhr = new XMLHttpRequest();
	xhr.open('GET', handle.url+"?"+(new Date().getTime()), true);
	var range=[position,length+position-1];
	xhr.setRequestHeader('Range', 'bytes='+range[0]+'-'+range[1]);
	xhr.responseType = 'arraybuffer';
	xhr.onload = function(e) {
		var that=this;
		setTimeout(function(){
			cb(0,that.response.byteLength,that.response);
		},0);
	}; 
	xhr.send();	
}

module.exports={read,xhr_read};