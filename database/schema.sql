-- =====================================================================
-- Vibe Chat — MySQL schema (chat messenger giống Zalo / Telegram / Messenger)
-- Engine: InnoDB | Charset: utf8mb4 | MySQL 8.0+
-- Auth provider: Keycloak (users.keycloak_id = sub trong JWT)
-- Encryption: server-side AES-256-GCM (mặc định) — có sẵn cấu trúc cho E2E
-- =====================================================================

SET NAMES utf8mb4;
SET FOREIGN_KEY_CHECKS = 0;

CREATE DATABASE IF NOT EXISTS `vibe_chat`
  CHARACTER SET utf8mb4
  COLLATE utf8mb4_0900_ai_ci;

USE `vibe_chat`;

-- =====================================================================
-- 1. USERS — đồng bộ từ Keycloak (1 user Keycloak = 1 row)
-- =====================================================================
CREATE TABLE IF NOT EXISTS `users` (
  `id`             BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  `keycloak_id`    CHAR(36)        NOT NULL COMMENT 'sub của JWT Keycloak',
  `username`       VARCHAR(50)     NOT NULL,
  `email`          VARCHAR(255)    DEFAULT NULL,
  `phone`          VARCHAR(20)     DEFAULT NULL,
  `display_name`   VARCHAR(100)    NOT NULL,
  `avatar_url`     VARCHAR(500)    DEFAULT NULL,
  `status`         ENUM('ACTIVE','INACTIVE','BANNED','DELETED') NOT NULL DEFAULT 'ACTIVE',
  `last_seen_at`   DATETIME(3)     DEFAULT NULL,
  `is_online`      TINYINT(1)      NOT NULL DEFAULT 0,
  `created_at`     DATETIME(3)     NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updated_at`     DATETIME(3)     NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  `deleted_at`     DATETIME(3)     DEFAULT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_users_keycloak_id` (`keycloak_id`),
  UNIQUE KEY `uk_users_username`    (`username`),
  UNIQUE KEY `uk_users_email`       (`email`),
  UNIQUE KEY `uk_users_phone`       (`phone`),
  KEY `idx_users_status`            (`status`),
  KEY `idx_users_last_seen`         (`last_seen_at`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci
  COMMENT='Người dùng — sync từ Keycloak';

-- =====================================================================
-- 2. USER_PROFILES — thông tin mở rộng + cấu hình privacy
-- =====================================================================
CREATE TABLE IF NOT EXISTS `user_profiles` (
  `user_id`               BIGINT UNSIGNED NOT NULL,
  `bio`                   VARCHAR(500)    DEFAULT NULL,
  `status_message`        VARCHAR(150)    DEFAULT NULL,
  `date_of_birth`         DATE            DEFAULT NULL,
  `gender`                ENUM('MALE','FEMALE','OTHER','UNDISCLOSED') DEFAULT 'UNDISCLOSED',
  `language`              CHAR(5)         NOT NULL DEFAULT 'vi-VN',
  `timezone`              VARCHAR(50)     NOT NULL DEFAULT 'Asia/Ho_Chi_Minh',
  `privacy_last_seen`     ENUM('EVERYONE','CONTACTS','NOBODY') NOT NULL DEFAULT 'EVERYONE',
  `privacy_profile_photo` ENUM('EVERYONE','CONTACTS','NOBODY') NOT NULL DEFAULT 'EVERYONE',
  `privacy_phone`         ENUM('EVERYONE','CONTACTS','NOBODY') NOT NULL DEFAULT 'CONTACTS',
  `privacy_add_to_groups` ENUM('EVERYONE','CONTACTS','NOBODY') NOT NULL DEFAULT 'EVERYONE',
  `notification_enabled`  TINYINT(1)      NOT NULL DEFAULT 1,
  `created_at`            DATETIME(3)     NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updated_at`            DATETIME(3)     NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  PRIMARY KEY (`user_id`),
  CONSTRAINT `fk_profiles_user`
    FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
  COMMENT='Profile mở rộng + privacy settings';

-- =====================================================================
-- 3. USER_DEVICES — thiết bị đã đăng nhập (push token + key E2E)
-- =====================================================================
CREATE TABLE IF NOT EXISTS `user_devices` (
  `id`              BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  `user_id`         BIGINT UNSIGNED NOT NULL,
  `device_uuid`     CHAR(36)        NOT NULL COMMENT 'UUID sinh client-side',
  `device_name`     VARCHAR(100)    DEFAULT NULL,
  `device_type`     ENUM('WEB','IOS','ANDROID','DESKTOP') NOT NULL,
  `push_token`      VARCHAR(500)    DEFAULT NULL COMMENT 'FCM/APNs token',
  `public_key`      TEXT            DEFAULT NULL COMMENT 'X25519/Curve25519 cho E2E (nullable nếu chỉ server-side)',
  `last_active_at`  DATETIME(3)     DEFAULT NULL,
  `ip_address`      VARCHAR(45)     DEFAULT NULL,
  `user_agent`      VARCHAR(500)    DEFAULT NULL,
  `is_active`       TINYINT(1)      NOT NULL DEFAULT 1,
  `created_at`      DATETIME(3)     NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updated_at`      DATETIME(3)     NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_devices_user_uuid` (`user_id`, `device_uuid`),
  KEY `idx_devices_user_active`     (`user_id`, `is_active`),
  CONSTRAINT `fk_devices_user`
    FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
  COMMENT='Thiết bị đăng nhập — push notification + E2E key';

-- =====================================================================
-- 4. USER_CONTACTS — danh bạ / friend list (kèm trạng thái kết bạn)
-- =====================================================================
CREATE TABLE IF NOT EXISTS `user_contacts` (
  `id`              BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  `user_id`         BIGINT UNSIGNED NOT NULL COMMENT 'Chủ sở hữu danh bạ',
  `contact_user_id` BIGINT UNSIGNED NOT NULL COMMENT 'User được add',
  `nickname`        VARCHAR(100)    DEFAULT NULL,
  `status`          ENUM('PENDING','ACCEPTED','BLOCKED','REJECTED') NOT NULL DEFAULT 'PENDING',
  `is_favorite`     TINYINT(1)      NOT NULL DEFAULT 0,
  `source`          ENUM('PHONE','SEARCH','QR','GROUP','LINK','SUGGEST') NOT NULL DEFAULT 'SEARCH',
  `created_at`      DATETIME(3)     NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `accepted_at`     DATETIME(3)     DEFAULT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_contacts_pair`   (`user_id`, `contact_user_id`),
  KEY `idx_contacts_user_status`  (`user_id`, `status`),
  KEY `idx_contacts_target`       (`contact_user_id`, `status`),
  CONSTRAINT `fk_contacts_owner`
    FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_contacts_target_user`
    FOREIGN KEY (`contact_user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE,
  CONSTRAINT `chk_contacts_not_self`
    CHECK (`user_id` <> `contact_user_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
  COMMENT='Danh bạ + friend request';

-- =====================================================================
-- 5. USER_BLOCKS — chặn người dùng
-- =====================================================================
CREATE TABLE IF NOT EXISTS `user_blocks` (
  `id`              BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  `user_id`         BIGINT UNSIGNED NOT NULL,
  `blocked_user_id` BIGINT UNSIGNED NOT NULL,
  `reason`          VARCHAR(255)    DEFAULT NULL,
  `created_at`      DATETIME(3)     NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_blocks_pair` (`user_id`, `blocked_user_id`),
  KEY `idx_blocks_target`     (`blocked_user_id`),
  CONSTRAINT `fk_blocks_user`
    FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_blocks_target`
    FOREIGN KEY (`blocked_user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE,
  CONSTRAINT `chk_blocks_not_self`
    CHECK (`user_id` <> `blocked_user_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
  COMMENT='Danh sách chặn';

-- =====================================================================
-- 6. CONVERSATIONS — DIRECT (1-1) | GROUP | CHANNEL (broadcast)
-- =====================================================================
CREATE TABLE IF NOT EXISTS `conversations` (
  `id`                   BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  `uuid`                 CHAR(36)        NOT NULL COMMENT 'Public id cho FE/URL',
  `type`                 ENUM('DIRECT','GROUP','CHANNEL') NOT NULL,
  `name`                 VARCHAR(150)    DEFAULT NULL COMMENT 'Bắt buộc với GROUP/CHANNEL',
  `description`          VARCHAR(500)    DEFAULT NULL,
  `avatar_url`           VARCHAR(500)    DEFAULT NULL,
  `owner_id`             BIGINT UNSIGNED DEFAULT NULL COMMENT 'Người tạo group',
  `encryption_type`      ENUM('NONE','SERVER','E2E') NOT NULL DEFAULT 'SERVER',
  `encryption_key_id`    VARCHAR(100)    DEFAULT NULL COMMENT 'Ref tới conversation_keys.key_id',
  `direct_key`           CHAR(64)        DEFAULT NULL
    COMMENT 'sha256(min(uid):max(uid)) — chỉ dùng cho DIRECT để chống tạo trùng',
  `is_public`            TINYINT(1)      NOT NULL DEFAULT 0,
  `max_members`          INT UNSIGNED    NOT NULL DEFAULT 1000,
  `member_count`         INT UNSIGNED    NOT NULL DEFAULT 0,
  `message_count`        BIGINT UNSIGNED NOT NULL DEFAULT 0,
  `last_message_id`      BIGINT UNSIGNED DEFAULT NULL,
  `last_message_at`      DATETIME(3)     DEFAULT NULL,
  `created_at`           DATETIME(3)     NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updated_at`           DATETIME(3)     NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  `deleted_at`           DATETIME(3)     DEFAULT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_conversations_uuid`        (`uuid`),
  UNIQUE KEY `uk_conversations_direct_key`  (`direct_key`),
  KEY `idx_conversations_type`              (`type`),
  KEY `idx_conversations_owner`             (`owner_id`),
  KEY `idx_conversations_last_message_at`   (`last_message_at` DESC),
  CONSTRAINT `fk_conversations_owner`
    FOREIGN KEY (`owner_id`) REFERENCES `users` (`id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
  COMMENT='Cuộc hội thoại (1-1, nhóm, kênh)';

-- =====================================================================
-- 7. CONVERSATION_MEMBERS — thành viên + role + read state
-- =====================================================================
CREATE TABLE IF NOT EXISTS `conversation_members` (
  `id`                     BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  `conversation_id`        BIGINT UNSIGNED NOT NULL,
  `user_id`                BIGINT UNSIGNED NOT NULL,
  `role`                   ENUM('OWNER','ADMIN','MODERATOR','MEMBER') NOT NULL DEFAULT 'MEMBER',
  `nickname`               VARCHAR(100)    DEFAULT NULL COMMENT 'Tên hiển thị riêng trong group',
  `last_read_message_id`   BIGINT UNSIGNED DEFAULT NULL,
  `last_read_at`           DATETIME(3)     DEFAULT NULL,
  `unread_count`           INT UNSIGNED    NOT NULL DEFAULT 0,
  `is_muted`               TINYINT(1)      NOT NULL DEFAULT 0,
  `muted_until`            DATETIME(3)     DEFAULT NULL,
  `is_pinned`              TINYINT(1)      NOT NULL DEFAULT 0,
  `is_archived`            TINYINT(1)      NOT NULL DEFAULT 0,
  `joined_at`              DATETIME(3)     NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `invited_by`             BIGINT UNSIGNED DEFAULT NULL,
  `left_at`                DATETIME(3)     DEFAULT NULL,
  `status`                 ENUM('ACTIVE','LEFT','KICKED','BANNED') NOT NULL DEFAULT 'ACTIVE',
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_members_conv_user`     (`conversation_id`, `user_id`),
  KEY `idx_members_user_status`         (`user_id`, `status`, `is_archived`),
  KEY `idx_members_conv_status`         (`conversation_id`, `status`),
  CONSTRAINT `fk_members_conversation`
    FOREIGN KEY (`conversation_id`) REFERENCES `conversations` (`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_members_user`
    FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
  COMMENT='Thành viên + read state + mute/pin';

-- =====================================================================
-- 8. MESSAGES — nội dung mã hoá AES-256-GCM
-- =====================================================================
CREATE TABLE IF NOT EXISTS `messages` (
  `id`                       BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  `uuid`                     CHAR(36)        NOT NULL COMMENT 'Client-generated — idempotency',
  `conversation_id`          BIGINT UNSIGNED NOT NULL,
  `sender_id`                BIGINT UNSIGNED NOT NULL,
  `type`                     ENUM('TEXT','IMAGE','VIDEO','AUDIO','FILE','STICKER','LOCATION','CONTACT','SYSTEM','CALL') NOT NULL DEFAULT 'TEXT',
  `content_ciphertext`       BLOB            DEFAULT NULL COMMENT 'AES-256-GCM ciphertext',
  `content_iv`               BINARY(12)      DEFAULT NULL COMMENT 'GCM IV/nonce 96-bit',
  `content_auth_tag`         BINARY(16)      DEFAULT NULL COMMENT 'GCM auth tag 128-bit',
  `encryption_key_id`        VARCHAR(100)    DEFAULT NULL COMMENT 'Ref conversation_keys',
  `encryption_key_version`   INT UNSIGNED    NOT NULL DEFAULT 1,
  `content_preview`          VARCHAR(150)    DEFAULT NULL
    COMMENT 'Preview plaintext (cho push notif). NULL nếu E2E.',
  `metadata`                 JSON            DEFAULT NULL
    COMMENT 'Thông tin không nhạy cảm: width/height/duration/mime/lat-long...',
  `reply_to_message_id`      BIGINT UNSIGNED DEFAULT NULL,
  `forward_from_message_id`  BIGINT UNSIGNED DEFAULT NULL,
  `thread_id`                BIGINT UNSIGNED DEFAULT NULL COMMENT 'Threading (root message id)',
  `is_edited`                TINYINT(1)      NOT NULL DEFAULT 0,
  `edited_at`                DATETIME(3)     DEFAULT NULL,
  `is_deleted`               TINYINT(1)      NOT NULL DEFAULT 0,
  `deleted_at`               DATETIME(3)     DEFAULT NULL,
  `deleted_for`              ENUM('NONE','SENDER','EVERYONE') NOT NULL DEFAULT 'NONE',
  `created_at`               DATETIME(3)     NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_messages_uuid`           (`uuid`),
  KEY `idx_messages_conv_created`         (`conversation_id`, `created_at` DESC),
  KEY `idx_messages_sender_created`       (`sender_id`, `created_at` DESC),
  KEY `idx_messages_reply_to`             (`reply_to_message_id`),
  KEY `idx_messages_thread`               (`thread_id`),
  CONSTRAINT `fk_messages_conversation`
    FOREIGN KEY (`conversation_id`) REFERENCES `conversations` (`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_messages_sender`
    FOREIGN KEY (`sender_id`) REFERENCES `users` (`id`),
  CONSTRAINT `fk_messages_reply_to`
    FOREIGN KEY (`reply_to_message_id`) REFERENCES `messages` (`id`) ON DELETE SET NULL,
  CONSTRAINT `fk_messages_forward_from`
    FOREIGN KEY (`forward_from_message_id`) REFERENCES `messages` (`id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
  COMMENT='Tin nhắn — content ciphertext AES-256-GCM';

-- Bổ sung FK conversations.last_message_id (sau khi messages tồn tại)
ALTER TABLE `conversations`
  ADD CONSTRAINT `fk_conversations_last_message`
  FOREIGN KEY (`last_message_id`) REFERENCES `messages` (`id`) ON DELETE SET NULL;

-- =====================================================================
-- 9. MESSAGE_ATTACHMENTS — file đính kèm (object storage S3/MinIO)
-- =====================================================================
CREATE TABLE IF NOT EXISTS `message_attachments` (
  `id`                BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  `message_id`        BIGINT UNSIGNED NOT NULL,
  `file_name`         VARCHAR(255)    NOT NULL,
  `file_size`         BIGINT UNSIGNED NOT NULL,
  `mime_type`         VARCHAR(100)    NOT NULL,
  `storage_provider`  ENUM('S3','MINIO','LOCAL','GCS','AZURE') NOT NULL DEFAULT 'S3',
  `storage_key`       VARCHAR(500)    NOT NULL COMMENT 'Object key (đường dẫn trong bucket)',
  `storage_bucket`    VARCHAR(100)    DEFAULT NULL,
  `thumbnail_key`     VARCHAR(500)    DEFAULT NULL,
  `width`             INT UNSIGNED    DEFAULT NULL,
  `height`            INT UNSIGNED    DEFAULT NULL,
  `duration`          INT UNSIGNED    DEFAULT NULL COMMENT 'Giây — cho audio/video',
  `encryption_key_id` VARCHAR(100)    DEFAULT NULL COMMENT 'Nếu file mã hoá tại storage',
  `encryption_iv`     BINARY(12)      DEFAULT NULL,
  `checksum`          CHAR(64)        DEFAULT NULL COMMENT 'sha256 file gốc',
  `created_at`        DATETIME(3)     NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (`id`),
  KEY `idx_attachments_message` (`message_id`),
  CONSTRAINT `fk_attachments_message`
    FOREIGN KEY (`message_id`) REFERENCES `messages` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
  COMMENT='File đính kèm — chỉ lưu metadata + key, file thật ở object storage';

-- =====================================================================
-- 10. MESSAGE_DELIVERIES — trạng thái gửi đến từng device
-- =====================================================================
CREATE TABLE IF NOT EXISTS `message_deliveries` (
  `message_id`    BIGINT UNSIGNED NOT NULL,
  `user_id`       BIGINT UNSIGNED NOT NULL,
  `device_id`     BIGINT UNSIGNED NOT NULL,
  `status`        ENUM('PENDING','SENT','DELIVERED','FAILED') NOT NULL DEFAULT 'PENDING',
  `delivered_at`  DATETIME(3)     DEFAULT NULL,
  `error_code`    VARCHAR(50)     DEFAULT NULL,
  PRIMARY KEY (`message_id`, `user_id`, `device_id`),
  KEY `idx_deliveries_user_status` (`user_id`, `status`),
  CONSTRAINT `fk_deliveries_message`
    FOREIGN KEY (`message_id`) REFERENCES `messages` (`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_deliveries_user`
    FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_deliveries_device`
    FOREIGN KEY (`device_id`) REFERENCES `user_devices` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
  COMMENT='Tracking gửi tin nhắn theo device';

-- =====================================================================
-- 11. MESSAGE_READS — read receipt chi tiết (ai đã xem)
-- Lưu ý: với group lớn (>200 thành viên) nên dùng last_read_message_id
-- ở conversation_members thay vì insert row cho mỗi recipient.
-- =====================================================================
CREATE TABLE IF NOT EXISTS `message_reads` (
  `message_id`       BIGINT UNSIGNED NOT NULL,
  `user_id`          BIGINT UNSIGNED NOT NULL,
  `conversation_id`  BIGINT UNSIGNED NOT NULL,
  `read_at`          DATETIME(3)     NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (`message_id`, `user_id`),
  KEY `idx_reads_user_conv` (`user_id`, `conversation_id`, `read_at`),
  CONSTRAINT `fk_reads_message`
    FOREIGN KEY (`message_id`) REFERENCES `messages` (`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_reads_user`
    FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
  COMMENT='Read receipt từng tin (dùng cho DIRECT hoặc group nhỏ)';

-- =====================================================================
-- 12. MESSAGE_REACTIONS — emoji reaction
-- =====================================================================
CREATE TABLE IF NOT EXISTS `message_reactions` (
  `id`           BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  `message_id`   BIGINT UNSIGNED NOT NULL,
  `user_id`      BIGINT UNSIGNED NOT NULL,
  `emoji`        VARCHAR(20)     NOT NULL COMMENT 'Unicode emoji hoặc shortcode',
  `created_at`   DATETIME(3)     NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_reactions_msg_user_emoji` (`message_id`, `user_id`, `emoji`),
  KEY `idx_reactions_message` (`message_id`),
  CONSTRAINT `fk_reactions_message`
    FOREIGN KEY (`message_id`) REFERENCES `messages` (`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_reactions_user`
    FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
  COMMENT='Reaction emoji trên tin nhắn';

-- =====================================================================
-- 13. MESSAGE_MENTIONS — @mention trong group
-- =====================================================================
CREATE TABLE IF NOT EXISTS `message_mentions` (
  `id`                  BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  `message_id`          BIGINT UNSIGNED NOT NULL,
  `mentioned_user_id`   BIGINT UNSIGNED NOT NULL,
  `start_offset`        INT UNSIGNED    DEFAULT NULL,
  `length`              INT UNSIGNED    DEFAULT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_mentions_msg_user` (`message_id`, `mentioned_user_id`),
  KEY `idx_mentions_user`           (`mentioned_user_id`),
  CONSTRAINT `fk_mentions_message`
    FOREIGN KEY (`message_id`) REFERENCES `messages` (`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_mentions_user`
    FOREIGN KEY (`mentioned_user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
  COMMENT='Mention @user trong tin nhắn';

-- =====================================================================
-- 14. PINNED_MESSAGES — tin ghim trong cuộc trò chuyện
-- =====================================================================
CREATE TABLE IF NOT EXISTS `pinned_messages` (
  `id`               BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  `conversation_id`  BIGINT UNSIGNED NOT NULL,
  `message_id`       BIGINT UNSIGNED NOT NULL,
  `pinned_by`        BIGINT UNSIGNED NOT NULL,
  `pinned_at`        DATETIME(3)     NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_pinned_conv_msg` (`conversation_id`, `message_id`),
  CONSTRAINT `fk_pinned_conversation`
    FOREIGN KEY (`conversation_id`) REFERENCES `conversations` (`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_pinned_message`
    FOREIGN KEY (`message_id`) REFERENCES `messages` (`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_pinned_by_user`
    FOREIGN KEY (`pinned_by`) REFERENCES `users` (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
  COMMENT='Tin nhắn ghim';

-- =====================================================================
-- 15. CONVERSATION_INVITE_LINKS — link mời vào group
-- =====================================================================
CREATE TABLE IF NOT EXISTS `conversation_invite_links` (
  `id`               BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  `conversation_id`  BIGINT UNSIGNED NOT NULL,
  `code`             VARCHAR(32)     NOT NULL COMMENT 'Random unique code dùng trong URL',
  `created_by`       BIGINT UNSIGNED NOT NULL,
  `max_uses`         INT UNSIGNED    DEFAULT NULL COMMENT 'NULL = không giới hạn',
  `used_count`       INT UNSIGNED    NOT NULL DEFAULT 0,
  `expires_at`       DATETIME(3)     DEFAULT NULL,
  `is_revoked`       TINYINT(1)      NOT NULL DEFAULT 0,
  `created_at`       DATETIME(3)     NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_invite_code` (`code`),
  KEY `idx_invite_conv`       (`conversation_id`),
  CONSTRAINT `fk_invite_conversation`
    FOREIGN KEY (`conversation_id`) REFERENCES `conversations` (`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_invite_creator`
    FOREIGN KEY (`created_by`) REFERENCES `users` (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
  COMMENT='Link mời vào group';

-- =====================================================================
-- 16. CONVERSATION_KEYS — key mã hoá theo cuộc hội thoại (envelope encryption)
-- Mỗi conversation có 1+ key, hỗ trợ key rotation.
-- =====================================================================
CREATE TABLE IF NOT EXISTS `conversation_keys` (
  `id`               BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  `conversation_id`  BIGINT UNSIGNED NOT NULL,
  `key_id`           VARCHAR(100)    NOT NULL COMMENT 'KMS key id hoặc internal id',
  `key_version`      INT UNSIGNED    NOT NULL DEFAULT 1,
  `encrypted_key`    BLOB            NOT NULL COMMENT 'DEK đã wrap bằng KEK (KMS)',
  `algorithm`        VARCHAR(50)     NOT NULL DEFAULT 'AES-256-GCM',
  `created_at`       DATETIME(3)     NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `rotated_at`       DATETIME(3)     DEFAULT NULL,
  `expires_at`       DATETIME(3)     DEFAULT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_conv_key_version` (`conversation_id`, `key_version`),
  KEY `idx_keys_key_id`            (`key_id`),
  CONSTRAINT `fk_keys_conversation`
    FOREIGN KEY (`conversation_id`) REFERENCES `conversations` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
  COMMENT='Khoá mã hoá per-conversation (envelope encryption + rotation)';

-- =====================================================================
-- 17. AUDIT_LOGS — log hành động nhạy cảm (security audit)
-- =====================================================================
CREATE TABLE IF NOT EXISTS `audit_logs` (
  `id`           BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  `actor_id`     BIGINT UNSIGNED DEFAULT NULL,
  `action`       VARCHAR(100)    NOT NULL COMMENT 'LOGIN, GROUP_CREATE, MEMBER_KICK, KEY_ROTATE...',
  `target_type`  VARCHAR(50)     DEFAULT NULL,
  `target_id`    VARCHAR(100)    DEFAULT NULL,
  `ip_address`   VARCHAR(45)     DEFAULT NULL,
  `user_agent`   VARCHAR(500)    DEFAULT NULL,
  `metadata`     JSON            DEFAULT NULL,
  `success`      TINYINT(1)      NOT NULL DEFAULT 1,
  `created_at`   DATETIME(3)     NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (`id`),
  KEY `idx_audit_actor_created` (`actor_id`, `created_at`),
  KEY `idx_audit_action`        (`action`, `created_at`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
  COMMENT='Audit log — KHÔNG xoá';

SET FOREIGN_KEY_CHECKS = 1;

-- =====================================================================
-- HƯỚNG DẪN PARTITIONING (production):
-- Bảng `messages` tăng nhanh → khi >50M row, partition theo RANGE created_at
-- (theo tháng) hoặc HASH conversation_id. Xem SCHEMA.md mục "Scale-out".
-- =====================================================================
