const express = require('express');
const bcrypt = require('bcrypt');

const {
    connection,
    isLoggedIn
} = require("./utils");

const saltRounds = 10;

const router = express.Router();

router.get("/admin", isLoggedIn, (req, res) => {
	res.sendFile(__dirname + "/views/admin.html");
});

router.post("/make-farm", isLoggedIn, (req, res) => {
    let test = { farm_name: req.body.farmname, username: req.body.username, email: req.body.email, password: req.body.psw, root_folder: req.body["root-folder"] };
	bcrypt.hash(req.body.psw, saltRounds, function(err, hash) {
		test.password = hash;
		connection.query("INSERT INTO farmers (farm_name, username, email, password, root_folder) VALUES (?, ?, ?, ?, ?) ON DUPLICATE KEY UPDATE farm_name=VALUES(farm_name), username=VALUES(username), password=VALUES(password), root_folder=VALUES(root_folder)", Object.values(test), function (err) {
			if (err) console.log(err);
			res.redirect("/admin");
		});

	});
});

router.get("/create-admin", (req, res) => {
	let admin = {farm_name: "admin", username: "admin", email: "admin@gmail.com", password: "test", root_folder: "adminfolder", account_type: 1}
    bcrypt.hash(admin.password, saltRounds, function(err, hash) {
        admin.password = hash;
        console.log(hash);
        connection.query("INSERT INTO farmers (farm_name, username, email, password, root_folder, account_type) VALUES (?, ?, ?, ?, ?, ?)", Object.values(admin), function(err) {
            if (err) console.log(err);
        });
    });
});

router.get("/view-farms", isLoggedIn, (req, res) => {
    connection.query("SELECT * FROM farmers WHERE account_type=0", function(err, farmers) {
        if (err) console.log(err);
        let type = [];
        farmers.forEach(farm => {
            type.push({
                farm_name: farm.farm_name,
                email: farm.email,
                root_folder: farm.root_folder
            });
        });
        res.render('farm', {
            type
        });
    });
});

router.get("/delete-farm/:email", isLoggedIn, (req, res) => {
    connection.query("DELETE FROM farmers WHERE email=?", req.params.email, function(err, farmers) {
        if (err) console.log(err);
        res.redirect("/admin");
    });
});

module.exports = router;