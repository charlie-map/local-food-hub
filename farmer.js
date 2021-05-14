require('dotenv').config({
	path: __dirname + '/.env'
});
const express = require('express');
const bcrypt = require('bcrypt');
const bodyParser = require('body-parser');
const fs = require('fs');
const path = require('path');

const {
	connection,
	isLoggedIn,
	frequency_ofSubmission,
	edit_dist,
	replace_string
} = require("./utils");
const {
	create_main_log_object
} = require("./google.utils");

const Sugar = require('sugar');

const saltRounds = 10;
const farmer = express.Router();
farmer.use(bodyParser.urlencoded({
	extended: true
}));

let frequencies_title = ["Daily", "Weekly", "Monthly", "Seasonal", "Annual", "On Incident", "As Needed",
	"Corrective Action", "Risk Assessment", "Preharvest", "Delivery Days"
];

function find_type(frequencies, stat_value) {
	let lowest = 1000,
		lowest_pos = 0,
		dist;
	frequencies.forEach((type, index) => {
		dist = edit_dist(type, stat_value);
		if (dist < lowest) {
			lowest = dist;
			lowest_pos = index;
		}
	});
	return frequencies[lowest_pos];
}

farmer.get("/view-status", isLoggedIn, (req, res) => {
	if (!req.query.username) return res.redirect("/");
	connection.query("SELECT farm_name, id FROM farmers WHERE username=?", req.query.username, function(err, farmer) {
		if (err) console.error(err);
		if (!farmer || !farmer.length) return res.redirect("/");
		// go into the status table and grab values from there
		connection.query("SELECT * FROM status WHERE farmer_id=?", farmer[0].id, (err, stati) => {
			if (err) console.error(err);
			let type = [],
				need_turnin = [];
			stati.forEach((stat) => {
				type[frequency_ofSubmission[stat.frequency]] = !type[frequency_ofSubmission[stat.frequency]] ? {
					titleoftype: find_type(frequencies_title, stat.frequency),
					row: []
				} : type[frequency_ofSubmission[stat.frequency]];
				type[frequency_ofSubmission[stat.frequency]].row.push({
					USERNAME: req.query.username,
					FILE_NAME: stat.file_name,
					FILE_ID: stat.file_id,
					FILE_URL: stat.file_type + "/" + stat.file_id,
					GOOGLE_URL: "https://docs.google.com/" + stat.file_type + "s/d/" + stat.file_id + "/edit",
					STATUS: stat.status == "true" && stat.ignore_notifier == 0 ? true : false
				});
				if (stat.status == "true" && stat.ignore_notifier == 0)
					need_turnin.push({
						USERNAME: req.query.username,
						FILE_NAME: stat.file_name,
						FILE_ID: stat.file_id,
						FILE_URL: stat.file_type + "/" + stat.file_id,
						STATUS: true
					});
			});
			res.render("index", {
				farm_name: farmer[0].farm_name.replace(/(^\w{1})|(\s+\w{1})/g, letter => letter.toUpperCase()),
				type,
				need_turnin,
				password_change: req.query["pw-changed"] ? "Your password has been changed!" : ""
			});
		});
	});
});

function ignore_file(username, file_id) {
	return new Promise((resolve, reject) => {
		connection.query("SELECT id FROM farmers WHERE username=?", username, (err, farm_id) => {
			if (err) reject(err);
			if (!farm_id.length) resolve(false);
			connection.query("UPDATE status SET ignore_notifier=1 WHERE farmer_id=? AND file_id=?", [farm_id[0].id, file_id], (err) => {
				if (err) reject(err);
				resolve(true);
			});
		});
	});
}

farmer.get("/check-off/:username/:file_id", isLoggedIn, async (req, res) => {
	let return_value = await ignore_file(req.params.username, req.params.file_id);
	if (return_value == true)
		res.redirect("/farm/view-status?username=" + req.params.username);
	else {
		console.log(return_value);
		res.redirect("/");
	}
});

farmer.post("/fill-out", isLoggedIn, async (req, res) => {
	let return_value = await ignore_file(req.body.username, req.body.file_id);
	if (return_value == true) { // direct to the google doc
		return res.end("https://docs.google.com/" + req.body.type + "s/d/" + req.body.file_id + "/edit");
	} else {
		console.log(return_value);
		res.redirect("/");
	}
});

farmer.post("/reset-password", isLoggedIn, (req, res) => {
	bcrypt.hash(req.body.password, saltRounds, function(err, hash) {
		if (err) console.error(err);
		connection.query("UPDATE farmers SET password=? WHERE username=?", [hash, req.body.username], (err) => {
			if (err) console.error(err);
			console.log("redirect");
			res.redirect("/farm/view-status?username=" + req.body.username + "&pw-changed=done");
		});
	});
});

farmer.get("/update", async (req, res) => {
	connection.query("SELECT * FROM farmers WHERE account_type=0", async function(err, farmer) {
		if (err) console.log(err);
		let await_farmers = farmer.map(function(item, index) {
			return new Promise(async function(resolve, reject) {

				try {
					/* Good dates for showing:
						new Date(2021, 4, 3)
						new Date(2021, 0, 4)
						new Date(1967, 7, 8)
					*/
					let text = fs.readFileSync(path.join(__dirname, "emailTemplate", "farmer_status")).toString()
					let date = process.env.DEMO ? new Date(2021, 4, 17) : new Date();
					let build_status = {};
					let status = await create_main_log_object(item.root_folder, date);
					// let status = [{
					// 	file_name: "test1",
					// 	file_id: "4989",
					// 	status: true,
					// 	ignore_notifier: 0,
					// 	file_type: "form",
					// 	frequency_ofSubmission: "daily",
					// 	turn_in_date: new Date(2021, 4, 12)
					// }, {
					// 	file_name: "test2",
					// 	file_id: "8484",
					// 	status: true,
					// 	ignore_notifier: 0,
					// 	file_type: "form",
					// 	frequency_ofSubmission: "weekly",
					// 	turn_in_date: new Date(2021, 4, 10)
					// }];
					if (!status || !status.length) return resolve();
					connection.query("DELETE FROM status WHERE farmer_id=?", item.id, async (err) => {
						if (err) console.error(err);
						let stat = status.map(function(folder) {
							// when we run through here, this would be the best spot to send the email:
							// have a link to their status page, a list of missing works

							if (folder.status && folder.ignore_notifier == 0) {
								let string_date = (new Date().getFullYear() != folder.turn_in_date.getFullYear() ||
									new Date().getMonth() != folder.turn_in_date.getMonth() || new Date().getDate() != folder.turn_in_date.getDate()) ?
								"awhile ago" : "due today";
								build_status = { ...build_status,
									...{
										[folder.file_name]: " - " + string_date
									}
								};
							}
							return new Promise(function(end, stop) {
								folder.file_type = !folder.file_type ? "unknown" : folder.file_type;
								connection.query("INSERT INTO status (farmer_id, file_name, file_id, status, file_type, frequency, ignore_notifier) VALUES (?, ?, ?, ?, ?, ?, ?)", [item.id, folder.file_name, folder.file_id, folder.status.toString(), folder.file_type, folder.frequency_ofSubmission, folder.ignore_notifier], function(err) {
									if (err) console.log(err);
									end();
								});
							});
						});
						await Promise.all(stat);
						let string_build = "";
						Object.keys(build_status).forEach((build) => {
							string_build += "\t" + build + build_status[build] + "\n";
						});

						let build_object = {
							farm_name: item.farm_name.replace(/(^\w{1})|(\s+\w{1})/g, letter => letter.toUpperCase()),
							account_name: item.username,
							curr_date: new Date(new Date().getFullYear(), new Date().getMonth(), new Date().getDate(), new Date().getHours(), new Date().getMinutes() - new Date().getTimezoneOffset()).toString().substring(0, 15),
							form_bool: Object.keys(build_status).length == 0 ? "no forms to fill out!" : Object.keys(build_status).length == 1 ?
								"one form to fill out:" : Object.keys(build_status).length + " forms to fill out:",
							status_url: process.env.FARM_URL,
							lfh_email: process.env.LFH_EMAIL,
							lfh_url: process.env.LFH_URL,
							all_forms: string_build
						}
						await replace_string(item.email, "Your Status Update", text, build_object);
						resolve();
					});
				} catch (error) {
					console.error(error);
					resolve();
				}
			});
		});
		await Promise.all(await_farmers);
		res.end();
	});
});

module.exports = farmer;
