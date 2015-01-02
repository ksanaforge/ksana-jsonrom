try {
	var KDB=require("../index");
} catch(e) {
	var KDB=require("./index"); //for running from index.html
}

KDB.open("sample.kdb",function(err,db){
	db.get(["meta"],{recursive:true},function(data){
		if (typeof document!="undefined") {
			var main=document.getElementById("main");
			if (main && data) main.value=JSON.stringify(data);
		} else {
			console.log(data);
		}
	});
});