-- StockIQ Relational Schema (MySQL 8 & MariaDB 10.11 compatible)
-- Character set: utf8mb4 (defaults to utf8mb4_0900_ai_ci on MySQL 8, utf8mb4_unicode_ci on MariaDB)
-- Storage Engine: InnoDB
-- Exact hand-written DDL equivalent to backend/app/models.py

SET FOREIGN_KEY_CHECKS = 0;

-- ----------------------------------------------------------------------------
-- 1. businesses
-- ----------------------------------------------------------------------------
DROP TABLE IF EXISTS `businesses`;
CREATE TABLE `businesses` (
    `id` INT NOT NULL AUTO_INCREMENT,
    `name` VARCHAR(150) NOT NULL,
    `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ----------------------------------------------------------------------------
-- 2. roles
-- ----------------------------------------------------------------------------
DROP TABLE IF EXISTS `roles`;
CREATE TABLE `roles` (
    `id` INT NOT NULL AUTO_INCREMENT,
    `name` VARCHAR(30) NOT NULL,
    PRIMARY KEY (`id`),
    UNIQUE KEY `uq_roles_name` (`name`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ----------------------------------------------------------------------------
-- 3. users
-- ----------------------------------------------------------------------------
DROP TABLE IF EXISTS `users`;
CREATE TABLE `users` (
    `id` INT NOT NULL AUTO_INCREMENT,
    `business_id` INT NOT NULL,
    `role_id` INT NOT NULL,
    `email` VARCHAR(255) NOT NULL,
    `full_name` VARCHAR(120) NOT NULL,
    `password_hash` VARCHAR(255) NOT NULL,
    `is_active` TINYINT(1) NOT NULL DEFAULT 1,
    `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (`id`),
    UNIQUE KEY `uq_users_email` (`email`),
    KEY `ix_users_business` (`business_id`),
    KEY `ix_users_role` (`role_id`),
    CONSTRAINT `fk_users_business` FOREIGN KEY (`business_id`) REFERENCES `businesses` (`id`),
    CONSTRAINT `fk_users_role` FOREIGN KEY (`role_id`) REFERENCES `roles` (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ----------------------------------------------------------------------------
-- 4. warehouses
-- ----------------------------------------------------------------------------
DROP TABLE IF EXISTS `warehouses`;
CREATE TABLE `warehouses` (
    `id` INT NOT NULL AUTO_INCREMENT,
    `business_id` INT NOT NULL,
    `name` VARCHAR(100) NOT NULL,
    `is_default` TINYINT(1) NOT NULL DEFAULT 0,
    PRIMARY KEY (`id`),
    CONSTRAINT `uq_warehouse_name` UNIQUE (`business_id`, `name`),
    CONSTRAINT `fk_warehouses_business` FOREIGN KEY (`business_id`) REFERENCES `businesses` (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

SET FOREIGN_KEY_CHECKS = 1;
