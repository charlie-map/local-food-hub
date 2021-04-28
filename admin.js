const express = require('express');
const bcrypt = require('bcrypt');
const saltRounds = 10;
const myPlaintextPassword = 'foodhub';
const someOtherPlaintextPassword = 'foody';

bcrypt.hash(myPlaintextPassword, saltRounds, function(err, hash) {
	console.log(hash);
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

router.post("/make-farm", (req, res) => {
	let test = {farm_name: "test", email: "tastfarm@gmail.com", password: "testpassword", root_folder: "testfarmfolder"}
	bcrypt.hash(test.password, saltRounds, function(err, hash) {
		test.password = hash;
		connection.query("INSERT INTO farmers (farm_name, email, password, root_folder) VALUES (?, ?, ?, ?)", Object.values(test), function (err) {
			if (err) console.log(err);
			console.log("dun");
		});

	});
});

module.exports = router;