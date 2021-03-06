DROP DATABASE IF EXISTS foodhub;
CREATE DATABASE foodhub;

USE foodhub;

CREATE TABLE farmers (
	id INT AUTO_INCREMENT,
	farm_name VARCHAR(255) NOT NULL,
	username VARCHAR(255) NOT NULL,
	email VARCHAR(255) NOT NULL,
	password VARCHAR(60) NOT NULL,
	root_folder VARCHAR(255) NOT NULL,
	account_type TINYINT NOT NULL DEFAULT 0,
	PRIMARY KEY(id),
	UNIQUE KEY unique_farmer (username)
);

CREATE TABLE status (
	farmer_id INT,
	file_name VARCHAR(255) NOT NULL,
	file_id VARCHAR(255),
	status VARCHAR(255) NOT NULL DEFAULT 'unknown',
	file_type VARCHAR(255) NOT NULL DEFAULT 'form',
	frequency VARCHAR(255) NOT NULL DEFAULT 'daily',
	ignore_notifier TINYINT NOT NULL DEFAULT 0,
	FOREIGN KEY (`farmer_id`) REFERENCES farmers (`id`) ON DELETE CASCADE
);

CREATE TABLE uuid (
	farmer_id INT,
	token VARCHAR(255),
	expiry DATETIME,
	FOREIGN KEY (`farmer_id`) REFERENCES farmers (`id`) ON DELETE CASCADE
);

CREATE TABLE system_settings (
	variable VARCHAR(255) NOT NULL,
	string VARCHAR(255),
	num INT,
	UNIQUE KEY unique_setting (variable)
);

INSERT INTO system_settings (variable, num) VALUES ('admin allowance', 0);
INSERT INTO system_settings (variable, string) VALUES ('service account', 'foodboyr3@localfoodhub.iam.gserviceaccount.com');