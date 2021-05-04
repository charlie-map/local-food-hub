const express = require('express');
const bcrypt = require('bcrypt');

const { connection, isLoggedIn } = require("./utils");

const saltRounds = 10;

const router = express.Router()

router.post("/make-farm", isLoggedIn, (req, res) => {
	let test = {farm_name: req.body.farmname, email: req.body.username, password: req.body.psw, root_folder: req.body["root-folder"]}
	bcrypt.hash(req.body.psw, saltRounds, function(err, hash) {
		test.password = hash;
		connection.query("INSERT INTO farmers (farm_name, email, password, root_folder) VALUES (?, ?, ?, ?) ON DUPLICATE KEY UPDATE farm_name=VALUES(farm_name), password=VALUES(password), root_folder=VALUE(root_folder)", Object.values(test), function (err) {
			if (err) console.log(err);
			console.log("dun");
		});

	});
});

router.get("/view-farms", isLoggedIn, (req, res) => {
	console.log("Hi")
	connection.query("SELECT * FROM farmers", function(err, farmers){
		if (err) console.log(err);
		let row = [];
		farmers.forEach(farm => {
			row.push({ farm_name: farm.farm_name, email: farm.email, root_folder: farm.root_folder });
		});
		res.render('farms', {
			row
		});
	});
});

router.get("/delete-farm", isLoggedIn, (req,res) => {
	connection.query("DELETE FROM farmers WHERE email=?", req.body.email, function(err,farmers){
		if (err) console.log(err);
		res.end();
	});
});

module.exports = router;