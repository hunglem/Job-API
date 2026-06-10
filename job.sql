CREATE DATABASE IF NOT EXISTS job_database;
USE job_database;
CREATE TABLE IF NOT EXISTS users (
	id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
	name VARCHAR(255) NOT NULL,
	email VARCHAR(255) NOT NULL,
	password VARCHAR(255) NOT NULL,
	role ENUM('candidate', 'recruiter', 'admin') NOT NULL DEFAULT 'candidate',
	status ENUM('active', 'inactive') NOT NULL DEFAULT 'active',
	created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
	PRIMARY KEY (id),
	UNIQUE KEY uq_users_email (email)
);

CREATE TABLE IF NOT EXISTS jobs (
	id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
	title VARCHAR(255) NOT NULL,
	description TEXT NOT NULL,
	salary_min DECIMAL(12,2) NULL,
	salary_max DECIMAL(12,2) NULL,
	location VARCHAR(255) NULL,
	status ENUM('active', 'draft', 'closed') NOT NULL DEFAULT 'active',
	recruiter_id BIGINT UNSIGNED NOT NULL,
	PRIMARY KEY (id),
	KEY idx_jobs_recruiter_id (recruiter_id),
	CONSTRAINT fk_jobs_recruiter
		FOREIGN KEY (recruiter_id) REFERENCES users (id)
		ON DELETE RESTRICT
		ON UPDATE CASCADE
);

CREATE TABLE IF NOT EXISTS candidates (
	id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
	user_id BIGINT UNSIGNED NOT NULL,
	phone VARCHAR(30) NOT NULL,
	resume_url VARCHAR(2048) NOT NULL,
	PRIMARY KEY (id),
	UNIQUE KEY uq_candidates_user_id (user_id),
	CONSTRAINT fk_candidates_user
		FOREIGN KEY (user_id) REFERENCES users (id)
		ON DELETE CASCADE
		ON UPDATE CASCADE
) ;

CREATE TABLE IF NOT EXISTS applications (
	id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
	candidate_id BIGINT UNSIGNED NOT NULL,
	job_id BIGINT UNSIGNED NOT NULL,
	resume_id BIGINT UNSIGNED NOT NULL,
	cover_letter TEXT NULL,
	status ENUM('submitted', 'reviewed', 'interview', 'accepted', 'rejected') NOT NULL DEFAULT 'submitted',
	PRIMARY KEY (id),
	UNIQUE KEY uq_applications_candidate_job (candidate_id, job_id),
	KEY idx_applications_job_id (job_id),
	CONSTRAINT fk_applications_candidate
		FOREIGN KEY (candidate_id) REFERENCES candidates (id)
		ON DELETE CASCADE
		ON UPDATE CASCADE,
	CONSTRAINT fk_applications_job
		FOREIGN KEY (job_id) REFERENCES jobs (id)
		ON DELETE CASCADE
		ON UPDATE CASCADE
) ;

CREATE TABLE IF NOT EXISTS notifications (
	id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
	user_id BIGINT UNSIGNED NOT NULL,
	title VARCHAR(255) NOT NULL,
	content TEXT NOT NULL,
	is_read TINYINT(1) NOT NULL DEFAULT 0,
	PRIMARY KEY (id),
	KEY idx_notifications_user_id (user_id),
	KEY idx_notifications_is_read (is_read),
	CONSTRAINT fk_notifications_user
		FOREIGN KEY (user_id) REFERENCES users (id)
		ON DELETE CASCADE
		ON UPDATE CASCADE
) ;
