try {
	var KDB=require("../index");
} catch(e) {
	var KDB=require("./index"); //for running from index.html
}

KDB.open("sample.kdb",function(err,db){
	db.get(["meta"],{recursive:true},function(data){
		console.log(data)
	});
});