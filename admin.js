const express = require('express');
const bcrypt = require('bcrypt');

const {
    connection,
    isLoggedIn
} = require("./utils");
const {
    v4: uuidv4
} = require("uuid");

const saltRounds = 10;

const router = express.Router();

router.get("/admin", isLoggedIn, (req, res) => {
    connection.query("SELECT num FROM system_settings WHERE variable='admin allowance'", (err, num) => {
        if (err) console.error(err);
        num[0].num = num[0].num ? "checked" : "";
        res.render("admin", {
            checked: num[0].num
        });
    });
});

router.post("/make-farm", isLoggedIn, (req, res) => {
    let test = {
        farm_name: req.body.farmname,
        username: req.body.username,
        email: req.body.email,
        password: req.body.psw,
        root_folder: req.body.root_folder
    };
    bcrypt.hash(req.body.psw, saltRounds, function(err, hash) {
        test.password = hash;
        console.log("insert", test);
        connection.query("INSERT INTO farmers (farm_name, username, email, password, root_folder) VALUES (?, ?, ?, ?, ?)", Object.values(test), function(err) {
            if (err) {
                console.log("err?", err.errno, err);
                if (err.errno == 1062) return res.end("1062");
            } else {
                res.redirect("/admin");
            }
        });

    });
});

router.get("/toggle-create-admin/:on_off", isLoggedIn, (req, res) => {
    req.params.on_off = parseInt(req.params.on_off, 10);
    connection.query("UPDATE system_settings SET num=? WHERE variable='admin allowance'", req.params.on_off, (err) => {
        if (err) console.error(err);
        res.end();
    });
});

router.get("/create-admin", (req, res) => {
    connection.query("SELECT num FROM system_settings WHERE variable='admin allowance'", (err, num) => {
        if (err) {
            console.error(err);
            res.redirect("/");
        }
        if (num.length && num[0].num == 1) // return and don't allow creation of admin
            return res.redirect("/");
        let sub = uuidv4().substring(0, 6);
        let admin = {
            farm_name: "admin",
            username: "admin" + sub,
            email: "admin@gmail.com",
            password: "account" + sub,
            root_folder: "adminfolder",
            account_type: 1
        }
        let store_pass = admin.password;
        bcrypt.hash(admin.password, saltRounds, function(err, hash) {
            admin.password = hash;
            connection.query("INSERT INTO farmers (farm_name, username, email, password, root_folder, account_type) VALUES (?, ?, ?, ?, ?, ?) ON DUPLICATE KEY UPDATE password=VALUES(password)", Object.values(admin), function(err) {
                if (err) console.log(err);
                res.end("Complete - sign in with account: username-" + admin.username + " and password-" + store_pass);
            });
        });
    });
});

router.post("/change-password", isLoggedIn, (req, res) => {
    bcrypt.hash(req.body.password, saltRounds, function(err, hash) {
        if (err) console.error(err);
        connection.query("UPDATE farmers SET password=? WHERE username=?", [hash, req.body.username], (err) => {
            if (err) console.error(err);
            res.redirect("/admin");
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
        res.redirect("/view-farms");
    });
});

module.exports = router;