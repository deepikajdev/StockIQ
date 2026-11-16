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
-- 3. categories
-- ----------------------------------------------------------------------------
DROP TABLE IF EXISTS `categories`;
CREATE TABLE `categories` (
    `id` INT NOT NULL AUTO_INCREMENT,
    `business_id` INT NOT NULL,
    `name` VARCHAR(100) NOT NULL,
    PRIMARY KEY (`id`),
    CONSTRAINT `uq_category_name` UNIQUE (`business_id`, `name`),
    CONSTRAINT `fk_categories_business` FOREIGN KEY (`business_id`) REFERENCES `businesses` (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ----------------------------------------------------------------------------
-- 4. suppliers
-- ----------------------------------------------------------------------------
DROP TABLE IF EXISTS `suppliers`;
CREATE TABLE `suppliers` (
    `id` INT NOT NULL AUTO_INCREMENT,
    `business_id` INT NOT NULL,
    `name` VARCHAR(150) NOT NULL,
    `contact_name` VARCHAR(120) NULL,
    `email` VARCHAR(255) NULL,
    `phone` VARCHAR(40) NULL,
    `address` TEXT NULL,
    `is_active` TINYINT(1) NOT NULL DEFAULT 1,
    `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (`id`),
    CONSTRAINT `uq_supplier_name` UNIQUE (`business_id`, `name`),
    KEY `ix_suppliers_business` (`business_id`),
    CONSTRAINT `fk_suppliers_business` FOREIGN KEY (`business_id`) REFERENCES `businesses` (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ----------------------------------------------------------------------------
-- 5. users
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
-- 6. warehouses
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

-- ----------------------------------------------------------------------------
-- 7. products
-- ----------------------------------------------------------------------------
DROP TABLE IF EXISTS `products`;
CREATE TABLE `products` (
    `id` INT NOT NULL AUTO_INCREMENT,
    `business_id` INT NOT NULL,
    `category_id` INT NULL,
    `sku` VARCHAR(64) NOT NULL,
    `name` VARCHAR(200) NOT NULL,
    `unit` VARCHAR(20) NOT NULL DEFAULT 'pcs',
    `selling_price` DECIMAL(12, 2) NOT NULL,
    `cost_price` DECIMAL(12, 2) NOT NULL,
    `reorder_point` INT NOT NULL DEFAULT 0,
    `safety_stock` INT NOT NULL DEFAULT 0,
    `is_active` TINYINT(1) NOT NULL DEFAULT 1,
    `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    `updated_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (`id`),
    CONSTRAINT `uq_product_sku` UNIQUE (`business_id`, `sku`),
    CONSTRAINT `ck_product_prices` CHECK (`selling_price` >= 0 AND `cost_price` >= 0),
    CONSTRAINT `ck_product_reorder` CHECK (`reorder_point` >= 0 AND `safety_stock` >= 0),
    KEY `ix_products_business_active` (`business_id`, `is_active`),
    KEY `ix_products_category` (`category_id`),
    CONSTRAINT `fk_products_business` FOREIGN KEY (`business_id`) REFERENCES `businesses` (`id`),
    CONSTRAINT `fk_products_category` FOREIGN KEY (`category_id`) REFERENCES `categories` (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ----------------------------------------------------------------------------
-- 8. product_suppliers
-- ----------------------------------------------------------------------------
DROP TABLE IF EXISTS `product_suppliers`;
CREATE TABLE `product_suppliers` (
    `id` INT NOT NULL AUTO_INCREMENT,
    `product_id` INT NOT NULL,
    `supplier_id` INT NOT NULL,
    `unit_cost` DECIMAL(12, 2) NULL,
    `lead_time_days` INT NULL,
    `min_order_qty` INT NULL,
    `is_preferred` TINYINT(1) NOT NULL DEFAULT 0,
    PRIMARY KEY (`id`),
    CONSTRAINT `uq_product_supplier` UNIQUE (`product_id`, `supplier_id`),
    CONSTRAINT `ck_ps_lead` CHECK (`lead_time_days` IS NULL OR `lead_time_days` >= 0),
    CONSTRAINT `ck_ps_moq` CHECK (`min_order_qty` IS NULL OR `min_order_qty` > 0),
    KEY `ix_ps_supplier` (`supplier_id`),
    CONSTRAINT `fk_ps_product` FOREIGN KEY (`product_id`) REFERENCES `products` (`id`),
    CONSTRAINT `fk_ps_supplier` FOREIGN KEY (`supplier_id`) REFERENCES `suppliers` (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ----------------------------------------------------------------------------
-- 9. inventory
-- ----------------------------------------------------------------------------
DROP TABLE IF EXISTS `inventory`;
CREATE TABLE `inventory` (
    `id` INT NOT NULL AUTO_INCREMENT,
    `product_id` INT NOT NULL,
    `warehouse_id` INT NOT NULL,
    `quantity` INT NOT NULL DEFAULT 0,
    `updated_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (`id`),
    CONSTRAINT `uq_inventory_product_wh` UNIQUE (`product_id`, `warehouse_id`),
    CONSTRAINT `ck_inventory_non_negative` CHECK (`quantity` >= 0),
    KEY `ix_inventory_warehouse` (`warehouse_id`),
    CONSTRAINT `fk_inventory_product` FOREIGN KEY (`product_id`) REFERENCES `products` (`id`),
    CONSTRAINT `fk_inventory_warehouse` FOREIGN KEY (`warehouse_id`) REFERENCES `warehouses` (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ----------------------------------------------------------------------------
-- 10. purchases
-- ----------------------------------------------------------------------------
DROP TABLE IF EXISTS `purchases`;
CREATE TABLE `purchases` (
    `id` INT NOT NULL AUTO_INCREMENT,
    `business_id` INT NOT NULL,
    `supplier_id` INT NOT NULL,
    `warehouse_id` INT NOT NULL,
    `status` VARCHAR(20) NOT NULL DEFAULT 'draft',
    `order_date` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    `received_at` DATETIME NULL,
    `total_cost` DECIMAL(14, 2) NOT NULL DEFAULT 0.00,
    `notes` TEXT NULL,
    `created_by` INT NOT NULL,
    PRIMARY KEY (`id`),
    CONSTRAINT `ck_purchase_status` CHECK (`status` IN ('draft', 'received', 'cancelled')),
    KEY `ix_purchases_business_status` (`business_id`, `status`),
    KEY `ix_purchases_supplier` (`supplier_id`),
    KEY `ix_purchases_date` (`order_date`),
    KEY `ix_purchases_warehouse` (`warehouse_id`),
    KEY `ix_purchases_created_by` (`created_by`),
    CONSTRAINT `fk_purchases_business` FOREIGN KEY (`business_id`) REFERENCES `businesses` (`id`),
    CONSTRAINT `fk_purchases_supplier` FOREIGN KEY (`supplier_id`) REFERENCES `suppliers` (`id`),
    CONSTRAINT `fk_purchases_warehouse` FOREIGN KEY (`warehouse_id`) REFERENCES `warehouses` (`id`),
    CONSTRAINT `fk_purchases_user` FOREIGN KEY (`created_by`) REFERENCES `users` (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ----------------------------------------------------------------------------
-- 11. purchase_items
-- ----------------------------------------------------------------------------
DROP TABLE IF EXISTS `purchase_items`;
CREATE TABLE `purchase_items` (
    `id` INT NOT NULL AUTO_INCREMENT,
    `purchase_id` INT NOT NULL,
    `product_id` INT NOT NULL,
    `quantity` INT NOT NULL,
    `unit_cost` DECIMAL(12, 2) NOT NULL,
    PRIMARY KEY (`id`),
    CONSTRAINT `ck_pi_qty` CHECK (`quantity` > 0),
    CONSTRAINT `ck_pi_cost` CHECK (`unit_cost` >= 0),
    KEY `ix_pi_purchase` (`purchase_id`),
    KEY `ix_pi_product` (`product_id`),
    CONSTRAINT `fk_pi_purchase` FOREIGN KEY (`purchase_id`) REFERENCES `purchases` (`id`),
    CONSTRAINT `fk_pi_product` FOREIGN KEY (`product_id`) REFERENCES `products` (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ----------------------------------------------------------------------------
-- 12. sales
-- ----------------------------------------------------------------------------
DROP TABLE IF EXISTS `sales`;
CREATE TABLE `sales` (
    `id` INT NOT NULL AUTO_INCREMENT,
    `business_id` INT NOT NULL,
    `warehouse_id` INT NOT NULL,
    `status` VARCHAR(20) NOT NULL DEFAULT 'completed',
    `sold_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    `customer_name` VARCHAR(120) NULL,
    `total_amount` DECIMAL(14, 2) NOT NULL DEFAULT 0.00,
    `created_by` INT NOT NULL,
    PRIMARY KEY (`id`),
    CONSTRAINT `ck_sale_status` CHECK (`status` IN ('completed', 'cancelled')),
    KEY `ix_sales_business_date` (`business_id`, `sold_at`),
    KEY `ix_sales_status` (`status`),
    KEY `ix_sales_warehouse` (`warehouse_id`),
    KEY `ix_sales_created_by` (`created_by`),
    CONSTRAINT `fk_sales_business` FOREIGN KEY (`business_id`) REFERENCES `businesses` (`id`),
    CONSTRAINT `fk_sales_warehouse` FOREIGN KEY (`warehouse_id`) REFERENCES `warehouses` (`id`),
    CONSTRAINT `fk_sales_user` FOREIGN KEY (`created_by`) REFERENCES `users` (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ----------------------------------------------------------------------------
-- 13. sale_items
-- ----------------------------------------------------------------------------
DROP TABLE IF EXISTS `sale_items`;
CREATE TABLE `sale_items` (
    `id` INT NOT NULL AUTO_INCREMENT,
    `sale_id` INT NOT NULL,
    `product_id` INT NOT NULL,
    `quantity` INT NOT NULL,
    `unit_price` DECIMAL(12, 2) NOT NULL,
    `unit_cost` DECIMAL(12, 2) NOT NULL,
    PRIMARY KEY (`id`),
    CONSTRAINT `ck_si_qty` CHECK (`quantity` > 0),
    CONSTRAINT `ck_si_price` CHECK (`unit_price` >= 0),
    KEY `ix_si_sale` (`sale_id`),
    KEY `ix_si_product` (`product_id`),
    CONSTRAINT `fk_si_sale` FOREIGN KEY (`sale_id`) REFERENCES `sales` (`id`),
    CONSTRAINT `fk_si_product` FOREIGN KEY (`product_id`) REFERENCES `products` (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ----------------------------------------------------------------------------
-- 14. stock_movements (append-only ledger)
-- ----------------------------------------------------------------------------
DROP TABLE IF EXISTS `stock_movements`;
CREATE TABLE `stock_movements` (
    `id` INT NOT NULL AUTO_INCREMENT,
    `business_id` INT NOT NULL,
    `product_id` INT NOT NULL,
    `warehouse_id` INT NOT NULL,
    `movement_type` VARCHAR(30) NOT NULL,
    `quantity_change` INT NOT NULL,
    `quantity_before` INT NOT NULL,
    `quantity_after` INT NOT NULL,
    `reference_type` VARCHAR(20) NULL,
    `reference_id` INT NULL,
    `reason` VARCHAR(255) NULL,
    `user_id` INT NOT NULL,
    `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (`id`),
    CONSTRAINT `ck_sm_math` CHECK (`quantity_after` = `quantity_before` + `quantity_change`),
    CONSTRAINT `ck_sm_nonzero` CHECK (`quantity_change` <> 0),
    KEY `ix_sm_product_date` (`product_id`, `created_at`),
    KEY `ix_sm_business_date` (`business_id`, `created_at`),
    KEY `ix_sm_reference` (`reference_type`, `reference_id`),
    KEY `ix_sm_warehouse` (`warehouse_id`),
    KEY `ix_sm_user` (`user_id`),
    CONSTRAINT `fk_sm_business` FOREIGN KEY (`business_id`) REFERENCES `businesses` (`id`),
    CONSTRAINT `fk_sm_product` FOREIGN KEY (`product_id`) REFERENCES `products` (`id`),
    CONSTRAINT `fk_sm_warehouse` FOREIGN KEY (`warehouse_id`) REFERENCES `warehouses` (`id`),
    CONSTRAINT `fk_sm_user` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ----------------------------------------------------------------------------
-- 15. audit_logs
-- ----------------------------------------------------------------------------
DROP TABLE IF EXISTS `audit_logs`;
CREATE TABLE `audit_logs` (
    `id` INT NOT NULL AUTO_INCREMENT,
    `business_id` INT NOT NULL,
    `user_id` INT NULL,
    `action` VARCHAR(60) NOT NULL,
    `entity_type` VARCHAR(40) NOT NULL,
    `entity_id` INT NULL,
    `details` JSON NULL,
    `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (`id`),
    KEY `ix_audit_business_date` (`business_id`, `created_at`),
    KEY `ix_audit_user` (`user_id`),
    CONSTRAINT `fk_audit_business` FOREIGN KEY (`business_id`) REFERENCES `businesses` (`id`),
    CONSTRAINT `fk_audit_user` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

SET FOREIGN_KEY_CHECKS = 1;
