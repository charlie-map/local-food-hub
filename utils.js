require('dotenv').config({
    path: __dirname + "/.env"
});
const mysql = require('mysql2');
const bcrypt = require('bcrypt');
const express = require('express');

const nodemail = require("nodemailer");
const sendmail = require("sendmail");

let transporter = nodemail.createTransport({
    sendmail: true,
    newline: 'unix',
    path: '/usr/sbin/sendmail'
});

// INTERNAL REPRASENTATION OF DAILY = 0, WEEKLY = 1, MONTHLY = 2, SEASONAL = 3, ANNUAL = 4, ONINCIDENT = 5, 
// ASNEEDED = 6, CORRECTIVEACTION = 7, RISKASSESMENT = 8, PREHARVEST = 9, DELIVERYDAYS = 10
const frequency_ofSubmission = {
    daily: 0, // a must submit
    daily_type: "Daily",
    weekly: 1, // must submit
    daily_type: "Weekly",
    monthly: 2, // must submit
    seasonal: 3, // must submit
    annual: 4, // must submit
    onincident: 5,
    asneeded: 6,
    correctiveaction: 7,
    riskassesment: 8,
    preharvest: 9, // must submit
    deliverydays: 10 // must submit
}

// To create user on table (after making database):
// CREATE USER 'foodhubuser'@'localhost' IDENTIFIED BY '0f28901b-2644-4109-ab06-21f55d49438f';
// GRANT ALL PRIVILEGES ON foodhub.* TO 'foodhubuser'@'localhost';
// FLUSH PRIVILEGES;

console.log(process.env.FOOD_USER);

let connection = mysql.createConnection({
    host: process.env.HOST,
    database: process.env.DATABASE,
    user: process.env.FOOD_USER,
    password: process.env.PASSWORD,
    insecureAuth: false
});

connection.connect((err) => {
    if (err) throw err;
});

function make_array(w1, w2) {
    let array = [];
    let columns_value = w1.length > w2.length ? w1.length : w2.length;
    let rows_value = w1.length > w2.length ? w2.length : w1.length;
    for (let y = 0; y < columns_value + 1; y++) { // build the columns based on w1 value
        array[y] = [];
        for (let x = 0; x < rows_value + 1; x++) { // build the rows based on the w2 value
            array[0][x] = x;
            array[y][0] = y;
            array[y][x] = 0;
        }
    }
    return array;
}

function printMultiArray(arr) {
    for (let y = 0; y < arr[0].length; y++) {
        for (let x = 0; x < arr.length; x++) {
            process.stdout.write(arr[x][y] + "\t");
        }
        process.stdout.write("\n");
    }
}

function isLoggedIn(req, res, next) {
    if (!req.cookies && !req.cookies.token) {
        res.redirect('/');
        return;
    }
    connection.query('SELECT * FROM uuid LEFT JOIN farmers ON uuid.farmer_id=id WHERE token=?;', [req.cookies.token], (err, row) => {
        if (err || row.length == 0 || !row[0].farmer_id) {
            res.redirect('/')
            return;
        }
        let expiry = new Date(row[0].expiry);
        let now = new Date();
        if (now > expiry) {
            res.redirect('/');
        } else {
            //updating the server each time they do *something* 
            let updateExpiry = new Date();
            updateExpiry.setSeconds(updateExpiry.getSeconds() + 3600);
            req.username = row[0].username;
            connection.query('UPDATE uuid SET expiry=? WHERE token=?', [updateExpiry, req.cookies.token], (err) => {
                if (err) console.log("error on update token", err);
                res.cookie("token", req.cookies.token, {
                    expires: new Date(updateExpiry)
                });
                next();
            });
        }
    });


}


function min(values) {
    let min = 100000;
    for (value in values) {
        min = values[value] < min ? values[value] : min;
    }
    return min
}

function edit_dist(w1, w2) {
    let array = make_array(w1, w2);
    w1 = " " + w1;
    w2 = " " + w2;
    for (let y = 1; y < array.length; y++) { // go through the rows
        for (let x = 1; x < array[0].length; x++) { // go through that full column
            let sub_add = w1[y] == w2[x] ? 0 : 1; // check for adding onto sub case
            // check the transpose case
            let transpose = array[y - 2] && array[y - 2][x - 2] ? array[y - 2][x - 2] : 10000;
            array[y][x] = (w1[x] == w2[y - 1] && w1[x - 1] == w2[y]) ? array[y][x] = min([sub_add + array[y - 1][x - 1], 1 + array[y][x - 1], 1 + array[y - 1][x], 1 + transpose]) : min([sub_add + array[y - 1][x - 1], 1 + array[y][x - 1], 1 + array[y - 1][x]]);
        }
    }
    return array[array.length - 1][array[0].length - 1];
}

function replace_string(to, subject, text, replacement) {
    if (!/^[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-zA-Z0-9-]+(?:\.[a-zA-Z0-9-]+)*$/.test(to)) return false;
    console.log("send mail", to, text, replacement);
    Object.keys(replacement).forEach((item, index) => {
        let string = "{{" + item.toUpperCase() + "}}";
        string = replacement[item] == "" ? " " + string : string;
        let replacer = new RegExp(string, "g");
        text = text.replace(replacer, replacement[item]);
    });
    console.log(text);
    return new Promise((transport_resolve, transport_reject) => {
        transporter.sendMail({
            from: '"Local Food Hub"<localfoodhub@cs.stab.org>',
            replyTo: process.env.LFH_EMAIL,
            to: to,
            subject: subject,
            html: text
        }, (err, info) => {
            if (err) {
                err.send_mail_info = info;
                transport_resolve(err);
            }
            transport_resolve(info);
        });
    });
}

const utilities = express.Router();

utilities.post("/test-connection", (req, res, next) => {
    if (req.body.code == process.env.DATABASE_CHECK_CODE) {
        console.log(new Date(), "System received database check");
        connection.query("SELECT variable FROM system_settings", function(err, value) {
            if (!err) {
                res.end("No error :)");
            }
            if (err) {
                connection = mysql.createConnection({
                    host: process.env.HOST,
                    database: process.env.DATABASE,
                    password: process.env.PASSWORD,
                    user: process.env.FOOD_USER,
                    insecureAuth: true
                });
                connection.connect((err) => {
                    if (err) throw err;
                    console.log("No restart error");
                    res.end("Mysql rebooted ;)");
                });
            }
        });
    } else {
        res.end("Incorrect code");
    }
});

module.exports = {
    edit_dist,
    isLoggedIn,
    bcrypt,
    connection,
    frequency_ofSubmission,
    replace_string,
    utilities
};