const express = require('express');
const bcrypt = require('bcrypt');
const bodyParser = require('body-parser')

const {
	connection,
	isLoggedIn,
	frequency_ofSubmission,
	edit_dist
} = require("./utils");
const {
	create_main_log_object
} = require("./google.utils");

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
	connection.query("SELECT farm_name, id FROM farmers WHERE username=?", req.query.username, function(err, farmer) {
		if (err) console.error(err);
		console.log(farmer);
		if (!farmer.length) return res.redirect("/");
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
					FILE_URL: "https://docs.google.com/" + stat.file_type + "s/d/" + stat.file_id + "/edit",
					STATUS: stat.status == "true" && stat.ignore_notifier == 0 ? true : false
				});
				if (stat.status == "true" && stat.ignore_notifier == 0)
					need_turnin.push({
						USERNAME: req.query.username,
						FILE_NAME: stat.file_name,
						FILE_ID: stat.file_name,
						FILE_URL: "https://docs.google.com/" + stat.file_type + "s/d/" + stat.file_id + "/edit",
						STATUS: true
					});
			});
			res.render("index", {
				farm_name: farmer[0].farm_name,
				type,
				need_turnin
			});
		});
	});
});

farmer.get("/check-off/:username/:file_id", isLoggedIn, (req, res) => {
	connection.query("SELECT id FROM farmers WHERE username=?", req.params.username, (err, farm_id) => {
		if (err) console.error(err);
		if (!farm_id.length) res.redirect("/");
		connection.query("UPDATE status SET ignore_notifier=1 WHERE farmer_id=? AND file_id=?", [farm_id[0].id, req.params.file_id], (err) => {
			if (err) console.error(err);
			res.redirect("/farm/view-status?username=" + req.params.username);
		});
	});
});

farmer.post("/reset-password", isLoggedIn, (req, res) => {
	console.log(req.body);
	bcrypt.hash(req.body.password, saltRounds, function(err, hash) {
		if (err) console.error(err);
		connection.query("UPDATE farmers SET password=? WHERE username=?", [hash, req.body.username], (err) => {
			if (err) console.error(err);
			res.redirect("/farm/view-status?username=" + req.params.username);
		});
	});
});

farmer.get("/update", async (req, res) => {
	connection.query("SELECT * FROM farmers WHERE account_type=0", async function(err, farmer) {
		if (err) console.log(err);
		let await_farmers = farmer.map(function(item, index) {
			return new Promise(async function(resolve, reject) {

				try {
					let status = await create_main_log_object(item.root_folder);
					let stat = status.map(function(folder) {
						return new Promise(function(end, stop) {
							connection.query("DELETE FROM status WHERE farmer_id=?", item.id, (err) => {
								if (err) console.error(err);
								folder.file_type = !folder.file_type ? "unknown" : folder.file_type;
								connection.query("INSERT INTO status (farmer_id, file_name, file_id, status, file_type, frequency) VALUES (?, ?, ?, ?, ?, ?)", [item.id, folder.file_name, folder.file_id, folder.status.toString(), folder.file_type, folder.frequency_ofSubmission], function(err) {
									if (err) console.log(err);
									end();
								});
							});
						});
					});
					await Promise.all(stat);
					resolve();
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