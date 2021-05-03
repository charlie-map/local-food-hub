const express = require('express');
const bcrypt = require('bcrypt');

const { connection, isLoggedIn } = require("./utils");


const saltRounds = 10;
const myPlaintextPassword = 'foodhub';
const someOtherPlaintextPassword = 'foody';

bcrypt.hash(myPlaintextPassword, saltRounds, function(err, hash) {
	//console.log(hash);
    // Store hash in password DB.

// get hash from database password DB.
bcrypt.compare(myPlaintextPassword, hash, function(err, result) {
    // result == true
bcrypt.compare(someOtherPlaintextPassword, hash, function(err, result) {
    // result == false
});
});
});

const router = express.Router()

router.get("/make-farm", isLoggedIn, (req, res) => {
	let test = {farm_name: "test", email: "tastfarm@gmail.com", password: "testpassword", root_folder: "testfarmfolder"}
	bcrypt.hash(test.password, saltRounds, function(err, hash) {
		test.password = hash;
		connection.query("INSERT INTO farmers (farm_name, email, password, root_folder) VALUES (?, ?, ?, ?) ON DUPLICATE KEY UPDATE farm_name=VALUES(farm_name), password=VALUES(password), root_folder=VALUE(root_folder)", Object.values(test), function (err) {
			if (err) console.log(err);
			console.log("dun");
		});

	});
});

router.get("/view-farms", isLoggedIn, (req, res) => {
	connection.query("SELECT * FROM farmers", function(err, farmers){
		if (err) console.log(err);
		
	});
});

router.get("/delete-farm", isLoggedIn, (req,res) => {
	connection.query("DELETE FROM farmers WHERE email = 'tastfarm@gmail.com' ", function(err,farmers){
		if (err) console.log(err);
		console.log("yay");
	});

});

module.exports = router;