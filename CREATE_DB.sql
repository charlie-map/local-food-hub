DROP DATABASE IF EXISTS foodhub;
CREATE DATABASE foodhub;

USE foodhub;

CREATE TABLE farmers (
	id INT AUTO_INCREMENT,
	farm_name VARCHAR(255) NOT NULL,
	email VARCHAR(255) NOT NULL,
	password VARCHAR(60) NOT NULL,
	root_folder VARCHAR(255) NOT NULL,
	PRIMARY KEY(id)
);

CREATE TABLE status (
	farmer_id INT,
	file_name VARCHAR(255) NOT NULL,
	file_id VARCHAR(255),
	status VARCHAR(255) NOT NULL DEFAULT 'unknown',
	frequency VARCHAR(255) NOT NULL DEFAULT 'daily',
	FOREIGN KEY (`farmer_id`) REFERENCES farmers (`id`) ON DELETE CASCADE
);