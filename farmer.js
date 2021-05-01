const express = require('express');
const bcrypt = require('bcrypt');
const bodyParser = require('body-parser')

const {
	connection,
	frequency_ofSubmission
} = require("./utils");
const {
	create_main_log_object
} = require("./google.utils");

const saltRounds = 10;
const farmer = express.Router();
farmer.use(bodyParser.urlencoded({
	extended: true
}));

farmer.get("/view-status", (req, res) => {
	connection.query("SELECT id FROM farmers WHERE username=?", req.body.username, function(err, farmer) {
		if (err) console.error(err);
		// go into the status table and grab values from there
		connection.query("SELECT * FROM status WHERE farmer_id=?", farmer[0].id, (err, stati) => {
			if (err) console.error(err);
			let status = {
				type: []
			};
			stati.forEach((stat) => {
				status.type[frequency_ofSubmission[stat.status]].push({ ...{
						titleoftype: stat.status
					},
					...stat
				});
			});
			console.log(stati);
			res.render("index.html", {
				status
			});
		});
	});

});

farmer.get("/update", async (req, res) => {
	connection.query("SELECT * FROM farmers", async function(err, farmer) {
		if (err) console.log(err);
		console.log("RUNN THROUGH FARMER", farmer);
		let await_farmers = farmer.map(function(item, index) {
			console.log(item);
			return new Promise(async function(resolve, reject) {

				let status = await create_main_log_object('1gTpKQ1eFgI5iU5TT0_3A4NJUs4D2zD9w');
				let stat = status.map(function(folder) {
					return new Promise(function(end, stop) {
						connection.query("DELETE FROM status WHERE farmer_id=?", item.id, (err) => {
							if (err) console.error(err);
							connection.query("INSERT INTO status (farmer_id, file_name, file_id, status, frequency) VALUES (?, ?, ?, ?, ?)", [item.id, folder.file_name, folder.file_id, folder.status.toString(), folder.frequency_ofSubmission], function(err) {
								if (err) console.log(err);
								end();
							});
						});
					});
				});
				await Promise.all(stat);
				resolve();
			});
		});
		await Promise.all(await_farmers);
		res.end();
	});
});

module.exports = farmer;