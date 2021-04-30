const express = require('express');
const bcrypt = require('bcrypt');

const { connection } = require("./utils");
const { create_main_log_object } = require("./google.utils");

const saltRounds = 10;
const farmer = express.Router()

farmer.get("/view-status", (req, res) => {
 connection.query("SELECT root_folder FROM farmers", function(err, farmer){
		if (err) console.log(err);
		console.log(farmer);
	});

});

farmer.get ("/update", async (req, res) => {
	connection.query("SELECT * FROM farmers", async function(err, farmer){
		if (err) console.log(err);
		console.log(farmer);
		let await_farmers = farmer.map(function (item, index) {
			console.log(item);
			return new Promise (async function (resolve, reject){

				let status = await create_main_log_object('1gTpKQ1eFgI5iU5TT0_3A4NJUs4D2zD9w');
				let stat = status.map(function (folder){
					return new Promise (function (end, stop){
						connection.query("INSERT INTO status (farmer_id,file_name,file_id,status,frequency) VALUES (?,?,?,?,?)", [item.id, folder.file_name, folder.status, folder.frequency_ofSubmission], function (err){
							if (err) console.log(err);
							end();
						});
					});
				});
				await Promise.all(stat);
				resolve();
			});
		});
		await Promise.all(await_farmers);
	});
});

module.exports = farmer;