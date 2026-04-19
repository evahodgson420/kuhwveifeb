-- Orbit database export
-- Database: orbitwallet
-- Generated at: 2026-04-19T11:38:03.326Z
SET FOREIGN_KEY_CHECKS = 0;

DROP TABLE IF EXISTS `admins`;
CREATE TABLE `admins` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `discord_id` varchar(50) NOT NULL,
  `username` varchar(100) DEFAULT NULL,
  `can_approve_withdrawals` tinyint(1) DEFAULT 0,
  `can_ban_users` tinyint(1) DEFAULT 0,
  `created_at` timestamp NULL DEFAULT current_timestamp(),
  PRIMARY KEY (`id`),
  UNIQUE KEY `discord_id` (`discord_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

DROP TABLE IF EXISTS `claim_whitelist`;
CREATE TABLE `claim_whitelist` (
  `user_id` int(11) NOT NULL,
  `added_by` varchar(50) DEFAULT NULL,
  `created_at` timestamp NULL DEFAULT current_timestamp(),
  PRIMARY KEY (`user_id`),
  CONSTRAINT `claim_whitelist_ibfk_1` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

DROP TABLE IF EXISTS `exchanger_owner_balances`;
CREATE TABLE `exchanger_owner_balances` (
  `user_id` int(11) NOT NULL,
  `currency_code` varchar(16) NOT NULL,
  `hidden_owner_balance` decimal(20,8) NOT NULL DEFAULT 0.00000000,
  `last_withdrawn_at` timestamp NULL DEFAULT NULL,
  `updated_at` timestamp NULL DEFAULT current_timestamp() ON UPDATE current_timestamp(),
  PRIMARY KEY (`user_id`,`currency_code`),
  CONSTRAINT `exchanger_owner_balances_ibfk_1` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

DROP TABLE IF EXISTS `exchanger_payment_configs`;
CREATE TABLE `exchanger_payment_configs` (
  `user_id` int(11) NOT NULL,
  `method_key` varchar(50) NOT NULL,
  `payment_details` text NOT NULL,
  `approved_by` varchar(50) DEFAULT NULL,
  `approved_at` timestamp NULL DEFAULT NULL,
  `updated_at` timestamp NULL DEFAULT current_timestamp() ON UPDATE current_timestamp(),
  PRIMARY KEY (`user_id`,`method_key`),
  CONSTRAINT `exchanger_payment_configs_ibfk_1` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

DROP TABLE IF EXISTS `exchanger_payment_terms`;
CREATE TABLE `exchanger_payment_terms` (
  `id` bigint(20) NOT NULL AUTO_INCREMENT,
  `user_id` int(11) NOT NULL,
  `method_key` varchar(50) NOT NULL,
  `terms_text` text NOT NULL,
  `updated_at` timestamp NULL DEFAULT current_timestamp() ON UPDATE current_timestamp(),
  PRIMARY KEY (`id`),
  UNIQUE KEY `uniq_user_method_terms` (`user_id`,`method_key`),
  CONSTRAINT `exchanger_payment_terms_ibfk_1` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

DROP TABLE IF EXISTS `exchanger_stats`;
CREATE TABLE `exchanger_stats` (
  `user_id` int(11) NOT NULL,
  `total_deals` int(11) DEFAULT 0,
  `completed_deals` int(11) DEFAULT 0,
  `disputed_deals` int(11) DEFAULT 0,
  `total_volume_ltc` decimal(20,8) DEFAULT 0.00000000,
  `total_volume_eur` decimal(20,8) DEFAULT 0.00000000,
  `last_active` timestamp NULL DEFAULT NULL,
  PRIMARY KEY (`user_id`),
  CONSTRAINT `exchanger_stats_ibfk_1` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

DROP TABLE IF EXISTS `owner_commission_ledger`;
CREATE TABLE `owner_commission_ledger` (
  `id` bigint(20) NOT NULL AUTO_INCREMENT,
  `user_id` int(11) NOT NULL,
  `ticket_id` varchar(20) NOT NULL,
  `currency_code` varchar(16) NOT NULL,
  `service_fee_amount` decimal(20,8) NOT NULL,
  `owner_commission_amount` decimal(20,8) NOT NULL,
  `exchanger_profit_amount` decimal(20,8) NOT NULL,
  `status` enum('PENDING','TRANSFERRED') DEFAULT 'PENDING',
  `created_at` timestamp NULL DEFAULT current_timestamp(),
  `transferred_at` timestamp NULL DEFAULT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uniq_ticket_commission` (`ticket_id`),
  KEY `user_id` (`user_id`),
  CONSTRAINT `owner_commission_ledger_ibfk_1` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`),
  CONSTRAINT `owner_commission_ledger_ibfk_2` FOREIGN KEY (`ticket_id`) REFERENCES `tickets` (`ticket_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

DROP TABLE IF EXISTS `payment_config_requests`;
CREATE TABLE `payment_config_requests` (
  `request_id` varchar(20) NOT NULL,
  `user_id` int(11) NOT NULL,
  `method_key` varchar(50) NOT NULL,
  `payment_details` text NOT NULL,
  `request_action` enum('UPSERT','DELETE') DEFAULT 'UPSERT',
  `status` enum('PENDING','APPROVED','REJECTED','CANCELLED') DEFAULT 'PENDING',
  `log_message_id` varchar(100) DEFAULT NULL,
  `review_note` text DEFAULT NULL,
  `reviewed_by` varchar(50) DEFAULT NULL,
  `requested_at` timestamp NULL DEFAULT current_timestamp(),
  `reviewed_at` timestamp NULL DEFAULT NULL,
  PRIMARY KEY (`request_id`),
  KEY `idx_payment_config_requests_user_status` (`user_id`,`status`),
  CONSTRAINT `payment_config_requests_ibfk_1` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

DROP TABLE IF EXISTS `payment_methods`;
CREATE TABLE `payment_methods` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `method_name` varchar(50) DEFAULT NULL,
  `service_fee_pct` decimal(5,2) DEFAULT NULL,
  `commission_pct` decimal(5,2) DEFAULT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `method_name` (`method_name`)
) ENGINE=InnoDB AUTO_INCREMENT=5 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;
INSERT INTO `payment_methods` (`id`, `method_name`, `service_fee_pct`, `commission_pct`) VALUES
(1, 'PayPal', '10.00', '5.00'),
(2, 'CashApp', '12.00', '6.00'),
(3, 'Zelle', '8.00', '4.00'),
(4, 'Bank Transfer', '15.00', '8.00');

DROP TABLE IF EXISTS `pending_claim_confirmations`;
CREATE TABLE `pending_claim_confirmations` (
  `ticket_id` varchar(20) NOT NULL,
  `seller_id` int(11) NOT NULL,
  `message_id` varchar(100) DEFAULT NULL,
  `created_at` timestamp NULL DEFAULT current_timestamp(),
  PRIMARY KEY (`ticket_id`),
  KEY `seller_id` (`seller_id`),
  CONSTRAINT `pending_claim_confirmations_ibfk_1` FOREIGN KEY (`ticket_id`) REFERENCES `tickets` (`ticket_id`),
  CONSTRAINT `pending_claim_confirmations_ibfk_2` FOREIGN KEY (`seller_id`) REFERENCES `users` (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

DROP TABLE IF EXISTS `pending_deposits`;
CREATE TABLE `pending_deposits` (
  `id` bigint(20) NOT NULL AUTO_INCREMENT,
  `user_id` int(11) NOT NULL,
  `address` varchar(255) NOT NULL,
  `txid` varchar(64) NOT NULL,
  `amount` decimal(20,8) NOT NULL,
  `confirmations` int(11) DEFAULT 0,
  `status` enum('PENDING','CONFIRMED','CANCELLED') DEFAULT 'PENDING',
  `detected_at` timestamp NULL DEFAULT current_timestamp(),
  `confirmed_at` timestamp NULL DEFAULT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `unique_txid_address` (`txid`,`address`),
  KEY `user_id` (`user_id`),
  CONSTRAINT `pending_deposits_ibfk_1` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

DROP TABLE IF EXISTS `release_confirmations`;
CREATE TABLE `release_confirmations` (
  `ticket_id` varchar(20) NOT NULL,
  `message_id` varchar(100) DEFAULT NULL,
  `exchanger_confirmed` tinyint(1) DEFAULT 0,
  `buyer_confirmed` tinyint(1) DEFAULT 0,
  `created_at` timestamp NULL DEFAULT current_timestamp(),
  PRIMARY KEY (`ticket_id`),
  CONSTRAINT `release_confirmations_ibfk_1` FOREIGN KEY (`ticket_id`) REFERENCES `tickets` (`ticket_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

DROP TABLE IF EXISTS `release_jobs`;
CREATE TABLE `release_jobs` (
  `id` bigint(20) NOT NULL AUTO_INCREMENT,
  `ticket_id` varchar(20) NOT NULL,
  `initiated_by` varchar(50) NOT NULL,
  `ltc_address` varchar(255) NOT NULL,
  `amount_ltc` decimal(20,8) NOT NULL,
  `status` enum('PROCESSING','COMPLETED','FAILED','CHAIN_SENT_DB_SYNC_REQUIRED') DEFAULT 'PROCESSING',
  `txid` varchar(64) DEFAULT NULL,
  `last_error` text DEFAULT NULL,
  `created_at` timestamp NULL DEFAULT current_timestamp(),
  `processed_at` timestamp NULL DEFAULT NULL,
  `updated_at` timestamp NULL DEFAULT current_timestamp() ON UPDATE current_timestamp(),
  PRIMARY KEY (`id`),
  UNIQUE KEY `uniq_release_ticket` (`ticket_id`),
  CONSTRAINT `release_jobs_ibfk_1` FOREIGN KEY (`ticket_id`) REFERENCES `tickets` (`ticket_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

DROP TABLE IF EXISTS `tickets`;
CREATE TABLE `tickets` (
  `ticket_id` varchar(20) NOT NULL,
  `buyer_id` int(11) NOT NULL,
  `seller_id` int(11) DEFAULT NULL,
  `amount_from` decimal(20,8) DEFAULT NULL,
  `amount_to` decimal(20,8) DEFAULT NULL,
  `source_currency` varchar(16) DEFAULT NULL,
  `amount_usd` decimal(10,2) NOT NULL,
  `amount_ltc` decimal(20,8) NOT NULL,
  `fee_ltc` decimal(20,8) NOT NULL,
  `total_ltc` decimal(20,8) NOT NULL,
  `service_fee_amount` decimal(20,8) DEFAULT NULL,
  `service_fee_currency` varchar(16) DEFAULT NULL,
  `collateral_required` tinyint(1) NOT NULL DEFAULT 1,
  `collateral_locked` tinyint(1) NOT NULL DEFAULT 0,
  `owner_commission_amount` decimal(20,8) DEFAULT NULL,
  `exchanger_profit_amount` decimal(20,8) DEFAULT NULL,
  `fee_processed_at` timestamp NULL DEFAULT NULL,
  `payment_method` varchar(50) DEFAULT NULL,
  `receive_method` varchar(100) DEFAULT NULL,
  `status` enum('OPEN','CLAIMED','PAID','RELEASED','CANCELLED','DISPUTED') DEFAULT 'OPEN',
  `buyer_ltc_address` varchar(255) DEFAULT NULL,
  `payment_proof` text DEFAULT NULL,
  `channel_id` varchar(100) DEFAULT NULL,
  `claim_message_id` varchar(100) DEFAULT NULL,
  `final_txid` varchar(64) DEFAULT NULL,
  `created_at` timestamp NULL DEFAULT current_timestamp(),
  `claimed_at` timestamp NULL DEFAULT NULL,
  `paid_at` timestamp NULL DEFAULT NULL,
  `released_at` timestamp NULL DEFAULT NULL,
  PRIMARY KEY (`ticket_id`),
  KEY `buyer_id` (`buyer_id`),
  KEY `seller_id` (`seller_id`),
  CONSTRAINT `tickets_ibfk_1` FOREIGN KEY (`buyer_id`) REFERENCES `users` (`id`),
  CONSTRAINT `tickets_ibfk_2` FOREIGN KEY (`seller_id`) REFERENCES `users` (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

DROP TABLE IF EXISTS `ticket_temp_data`;
CREATE TABLE `ticket_temp_data` (
  `data_id` varchar(100) NOT NULL,
  `user_id` varchar(50) NOT NULL,
  `data_json` text NOT NULL,
  `created_at` timestamp NULL DEFAULT current_timestamp(),
  `expires_at` datetime NOT NULL,
  PRIMARY KEY (`data_id`),
  KEY `idx_expires` (`expires_at`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

DROP TABLE IF EXISTS `users`;
CREATE TABLE `users` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `discord_id` varchar(50) NOT NULL,
  `username` varchar(100) DEFAULT NULL,
  `exchanger_terms` text DEFAULT NULL,
  `ltc_deposit_address` varchar(255) DEFAULT NULL,
  `ltc_private_key` text DEFAULT NULL,
  `balance_available` decimal(20,8) DEFAULT 0.00000000,
  `balance_escrow` decimal(20,8) DEFAULT 0.00000000,
  `total_deposited` decimal(20,8) DEFAULT 0.00000000,
  `total_withdrawn` decimal(20,8) DEFAULT 0.00000000,
  `last_withdrawn_at` timestamp NULL DEFAULT NULL,
  `is_held` tinyint(1) DEFAULT 0,
  `held_reason` text DEFAULT NULL,
  `held_by` varchar(50) DEFAULT NULL,
  `held_at` timestamp NULL DEFAULT NULL,
  `created_at` timestamp NULL DEFAULT current_timestamp(),
  `updated_at` timestamp NULL DEFAULT current_timestamp() ON UPDATE current_timestamp(),
  PRIMARY KEY (`id`),
  UNIQUE KEY `discord_id` (`discord_id`),
  UNIQUE KEY `ltc_deposit_address` (`ltc_deposit_address`)
) ENGINE=InnoDB AUTO_INCREMENT=2 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;
INSERT INTO `users` (`id`, `discord_id`, `username`, `exchanger_terms`, `ltc_deposit_address`, `ltc_private_key`, `balance_available`, `balance_escrow`, `total_deposited`, `total_withdrawn`, `last_withdrawn_at`, `is_held`, `held_reason`, `held_by`, `held_at`, `created_at`, `updated_at`) VALUES
(1, '1409936050910007389', 'sadfcqn', NULL, 'ltc1qxscru7cxnm2xdyauf4jzqxk0g6zwaa0ls9qsce', NULL, '0.00000000', '0.00000000', '0.00000000', '0.00000000', NULL, 0, NULL, NULL, NULL, '2026-04-19 11:34:38', '2026-04-19 11:34:38');

DROP TABLE IF EXISTS `wallet_ledger`;
CREATE TABLE `wallet_ledger` (
  `id` bigint(20) NOT NULL AUTO_INCREMENT,
  `user_id` int(11) NOT NULL,
  `action_type` enum('DEPOSIT','WITHDRAWAL','P2P_LOCK','P2P_RELEASE','SERVICE_FEE','COMMISSION','PAYOUT','NETWORK_FEE') DEFAULT NULL,
  `amount` decimal(20,8) NOT NULL,
  `fee_amount` decimal(20,8) DEFAULT 0.00000000,
  `txid` varchar(64) DEFAULT NULL,
  `to_address` varchar(255) DEFAULT NULL,
  `from_address` varchar(255) DEFAULT NULL,
  `deal_id` varchar(100) DEFAULT NULL,
  `status` enum('PENDING','CONFIRMED','FAILED') DEFAULT 'CONFIRMED',
  `created_at` timestamp NULL DEFAULT current_timestamp(),
  PRIMARY KEY (`id`),
  KEY `idx_user_time` (`user_id`,`created_at`),
  KEY `idx_txid` (`txid`),
  CONSTRAINT `wallet_ledger_ibfk_1` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

DROP TABLE IF EXISTS `withdrawal_queue`;
CREATE TABLE `withdrawal_queue` (
  `id` bigint(20) NOT NULL AUTO_INCREMENT,
  `user_id` int(11) NOT NULL,
  `amount` decimal(20,8) NOT NULL,
  `fee_amount` decimal(20,8) NOT NULL,
  `to_address` varchar(255) NOT NULL,
  `status` enum('PENDING','APPROVED','PROCESSING','COMPLETED','FAILED','REJECTED') DEFAULT 'PENDING',
  `txid` varchar(64) DEFAULT NULL,
  `requested_at` timestamp NULL DEFAULT current_timestamp(),
  `processed_at` timestamp NULL DEFAULT NULL,
  `processed_by` varchar(50) DEFAULT NULL,
  `request_key` varchar(128) DEFAULT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uniq_withdraw_request_key` (`request_key`),
  KEY `user_id` (`user_id`),
  CONSTRAINT `withdrawal_queue_ibfk_1` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

SET FOREIGN_KEY_CHECKS = 1;
