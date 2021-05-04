const express = require('express');
const bcrypt = require('bcrypt');

const { connection, isLoggedIn } = require("./utils");

const saltRounds = 10;

const router = express.Router()

router.get("/admin", isLoggedIn, (req, res) => {
	res.sendFile(__dirname + "/views/admin.html");
});

router.post("/make-farm", isLoggedIn, (req, res) => {
	let test = { farm_name: req.body.farmname, username: req.body.username, email: req.body.email, password: req.body.psw, root_folder: req.body["root-folder"] };
	bcrypt.hash(req.body.psw, saltRounds, function(err, hash) {
		test.password = test.password;
		console.log(test);
		connection.query("INSERT INTO farmers (farm_name, username, email, password, root_folder) VALUES (?, ?, ?, ?, ?) ON DUPLICATE KEY UPDATE farm_name=VALUES(farm_name), username=VALUES(username), password=VALUES(password), root_folder=VALUES(root_folder)", Object.values(test), function (err) {
			if (err) console.log(err);
			res.redirect("/admin");
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
		console.log(row);
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