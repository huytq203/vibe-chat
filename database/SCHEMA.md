# Vibe Chat — Database Schema (MySQL 8)

> Tài liệu chi tiết cho schema trong `database/schema.sql`.
> Auth do **Keycloak** quản lý — DB này chỉ lưu **bản mirror** của user (không lưu password).

---

## 1. Tổng quan kiến trúc

```
                ┌──────────────┐
                │   Keycloak   │  ← OIDC/JWT (sub = keycloak_id)
                └──────┬───────┘
                       │ sync (login đầu tiên / webhook)
                       ▼
┌──────────────────────────────────────────────────────────────┐
│  users ─┬─ user_profiles                                      │
│         ├─ user_devices       (push token + E2E public key)   │
│         ├─ user_contacts      (friend list / phone book)      │
│         └─ user_blocks                                        │
│                                                               │
│  conversations ─┬─ conversation_members  (N-N user)           │
│                 ├─ conversation_keys     (envelope crypto)    │
│                 ├─ conversation_invite_links                  │
│                 └─ pinned_messages                            │
│                                                               │
│  messages ─┬─ message_attachments  (S3/MinIO key)             │
│            ├─ message_deliveries   (per-device delivery)      │
│            ├─ message_reads        (read receipt chi tiết)    │
│            ├─ message_reactions                               │
│            └─ message_mentions                                │
│                                                               │
│  audit_logs (log hành động nhạy cảm)                          │
└──────────────────────────────────────────────────────────────┘
```

**Quy ước chung:**

| Quy ước | Giá trị |
|---|---|
| Engine | InnoDB |
| Charset / Collate | `utf8mb4` / `utf8mb4_0900_ai_ci` |
| PK | `BIGINT UNSIGNED AUTO_INCREMENT` (ID nội bộ, không lộ ra ngoài) |
| Public ID | `uuid CHAR(36)` cho `conversations`, `messages` (FE/URL dùng cái này) |
| Soft delete | `deleted_at DATETIME(3) NULL` (không xoá cứng dữ liệu user-related) |
| Timestamps | `created_at`, `updated_at` (precision ms) |
| FK | `ON DELETE CASCADE` cho child trực thuộc, `SET NULL` cho ref lỏng |

---

## 2. Chiến lược mã hoá tin nhắn

> Mặc định **server-side encryption (SSE)** — server giữ key, mã hoá trước khi ghi DB. Có sẵn cấu trúc để nâng cấp **E2E** sau.

### 2.1. Envelope encryption (khuyến nghị)

```
KEK (Key Encryption Key)  ── giữ ở KMS (AWS KMS / HashiCorp Vault / Cloud KMS)
   │
   └── wrap ──► DEK (Data Encryption Key — per conversation)
                  │  lưu ở conversation_keys.encrypted_key (BLOB)
                  │
                  └── dùng AES-256-GCM mã hoá messages.content_ciphertext
```

- **DEK rotation:** mỗi 90 ngày (hoặc sau security incident) → tạo `conversation_keys` row mới với `key_version + 1`. Tin nhắn cũ giữ `key_version` cũ để decrypt được.
- **Tin nhắn lưu:** `content_ciphertext` (BLOB) + `content_iv` (12B GCM nonce) + `content_auth_tag` (16B). Mỗi message **PHẢI có IV riêng** (sinh ngẫu nhiên mỗi lần encrypt).
- **`content_preview`**: plaintext ngắn (≤150 char) cho push notification. Đặt `NULL` nếu bật E2E.
- **Attachment**: file gốc upload S3 đã mã hoá client-side hoặc dùng SSE-KMS của S3. Cột `encryption_key_id` + `encryption_iv` ở `message_attachments` để decrypt.

### 2.2. Khi nào lên E2E (tham khảo)

- `conversations.encryption_type = 'E2E'`.
- Mỗi `user_devices` có `public_key` (X25519). Server **không có** private key.
- DEK nhóm được wrap bằng public key của từng device member, lưu ở bảng phụ `member_device_keys` (nếu cần — thiết kế khi triển khai).
- Server chỉ relay ciphertext, không decrypt được → **không tạo được preview, không full-text search**.

---

## 3. Chi tiết từng bảng

### 3.1. `users` — Mirror từ Keycloak

| Cột | Mục đích |
|---|---|
| `id` | PK nội bộ (mọi FK trong DB này tham chiếu) |
| `keycloak_id` | `sub` của JWT — khoá đồng bộ với Keycloak |
| `username`, `email`, `phone` | Định danh — UNIQUE để search nhanh |
| `display_name`, `avatar_url` | Hiển thị UI |
| `status` | `ACTIVE`/`INACTIVE`/`BANNED`/`DELETED` — kiểm soát login |
| `last_seen_at`, `is_online` | Presence (cập nhật từ socket) |
| `deleted_at` | Soft delete — giữ tin nhắn cũ vẫn còn sender |

**Hoạt động:**
1. User login lần đầu qua Keycloak → backend nhận JWT → `findOrCreate({ keycloak_id })`.
2. Webhook Keycloak (`USER_UPDATE`/`DELETE`) → đồng bộ `email`/`status`.
3. KHÔNG bao giờ lưu password/credential ở đây.

### 3.2. `user_profiles` — Profile mở rộng

1-1 với `users`. Tách bảng để row `users` nhẹ (đọc nhiều, ít cần profile chi tiết).

| Cột | Vai trò |
|---|---|
| `bio`, `status_message`, `date_of_birth`, `gender` | Thông tin hiển thị |
| `language`, `timezone` | Localize UI + thông báo |
| `privacy_*` | Ai được xem `last_seen` / avatar / phone / được add vào group |
| `notification_enabled` | Bật/tắt push toàn cục |

### 3.3. `user_devices` — Quản lý thiết bị

Mỗi device có 1 row. Dùng cho:
- **Push notification:** `push_token` (FCM/APNs).
- **Multi-device sync:** mỗi device có session riêng (ví dụ web + mobile).
- **E2E:** `public_key` để wrap DEK cho device đó.

`is_active = 0` khi user logout / Keycloak revoke session. Cron job xoá device không active >90 ngày.

### 3.4. `user_contacts` — Danh bạ + Friend Request

| Status | Ý nghĩa |
|---|---|
| `PENDING` | Đã gửi lời mời, chờ xác nhận |
| `ACCEPTED` | Đã là bạn |
| `REJECTED` | Đã từ chối (giữ lại để không spam mời lại) |
| `BLOCKED` | Block lẫn nhau (xem thêm `user_blocks`) |

`source` cho biết kết bạn từ đâu (đề xuất, QR, số điện thoại…).

`UNIQUE (user_id, contact_user_id)` — 1 chiều. Khi A add B thì có 1 row; B accept thì cập nhật `status = ACCEPTED` + tạo row ngược chiều `(B → A, ACCEPTED)`.

### 3.5. `user_blocks`

Đơn giản: A block B → 1 row. Áp dụng vào logic gửi tin nhắn / xem profile / add group.

### 3.6. `conversations` — Cuộc hội thoại

3 loại:
- `DIRECT`: 1-1 chat. **Bắt buộc 2 thành viên**. Dùng `direct_key` chống tạo trùng.
- `GROUP`: Nhóm (≤ `max_members`, default 1000). Có `owner_id`, có thể đổi tên/avatar.
- `CHANNEL`: Broadcast — chỉ admin gửi, member nhận (dùng `MODERATOR` để cho phép comment).

**`direct_key`** sinh ở application layer:
```ts
const ids = [userIdA, userIdB].sort((a, b) => Number(a - b));
const directKey = sha256(`${ids[0]}:${ids[1]}`);  // hex 64 char
```
→ UNIQUE constraint đảm bảo không tạo 2 cuộc 1-1 trùng.

**Denormalized fields** (`member_count`, `message_count`, `last_message_id`, `last_message_at`) tăng tốc list inbox. Cập nhật trong **transaction** khi insert message/member.

### 3.7. `conversation_members` — Thành viên + Read State

| Field | Vai trò |
|---|---|
| `role` | `OWNER` (1 người), `ADMIN`, `MODERATOR`, `MEMBER` |
| `nickname` | Tên hiển thị riêng trong group (override `display_name`) |
| `last_read_message_id` + `unread_count` | Hiển thị badge "n tin chưa đọc" |
| `is_muted`, `muted_until` | Tắt thông báo (vĩnh viễn / tạm thời) |
| `is_pinned` | Ghim hội thoại lên top inbox |
| `is_archived` | Ẩn khỏi inbox chính |
| `status` | `ACTIVE` / `LEFT` (tự out) / `KICKED` / `BANNED` |

> **Lưu ý:** giữ row khi `LEFT/KICKED` (set `left_at`) để vẫn hiển thị tin nhắn cũ user đã gửi. KHÔNG xoá row.

### 3.8. `messages` — Tin nhắn (mã hoá)

**Flow tạo tin nhắn:**
```
1. Client gửi { conversationUuid, type, plaintext, replyTo? }
2. Server:
   a. Authz: kiểm sender ∈ conversation_members & status=ACTIVE
   b. Lấy DEK active của conversation từ conversation_keys
   c. Sinh IV ngẫu nhiên 12 byte
   d. ciphertext = AES-256-GCM(plaintext, DEK, IV) → ciphertext + authTag
   e. INSERT messages (...)
   f. UPDATE conversations SET last_message_id, last_message_at, message_count++
   g. UPDATE conversation_members SET unread_count++ WHERE user_id <> sender
   h. INSERT message_deliveries cho mọi device active của recipient
   i. Push qua WebSocket + FCM/APNs
```

**Cột quan trọng:**
- `uuid`: client sinh trước khi gửi → POST trùng UUID coi như đã xử lý (idempotent).
- `type`: chi phối render UI (text vs media vs system).
- `metadata` (JSON): không nhạy cảm — `{ width, height, duration, mimeType, location: { lat, lng } }`.
- `reply_to_message_id`, `forward_from_message_id`, `thread_id`: thread / reply.
- `deleted_for`:
  - `SENDER` → chỉ ẩn ở phía sender (xoá ở client của chính họ).
  - `EVERYONE` → ẩn cả 2 phía (Telegram-style "Delete for everyone").
- `is_edited`, `edited_at`: giữ lịch sử chỉnh (nếu cần audit, lưu thêm bảng `message_edits`).

**Indexes:**
- `(conversation_id, created_at DESC)` — query lịch sử chat (phổ biến nhất).
- `(sender_id, created_at DESC)` — admin search "tin của user X".

### 3.9. `message_attachments`

**KHÔNG lưu file binary** trong MySQL. Lưu `storage_provider` + `storage_key` → backend sinh pre-signed URL khi FE request.

**Bảo mật:**
- File mã hoá ở storage: dùng SSE-KMS (S3) hoặc client-side encrypt với key trong `encryption_key_id`.
- `checksum` (sha256) verify integrity sau khi tải về.

### 3.10. `message_deliveries`

Track **trạng thái gửi tới từng device**:

| Status | Ý nghĩa |
|---|---|
| `PENDING` | Đã insert, chưa đẩy queue |
| `SENT` | Đã đẩy WebSocket / push |
| `DELIVERED` | Device ACK đã nhận |
| `FAILED` | Push fail (token expired, …) → `error_code` |

Khi tất cả device user đều `DELIVERED` → có thể coi user "đã nhận tin" (icon tick xám).

### 3.11. `message_reads`

Read receipt chi tiết — biết chính xác **ai đã xem** tin nào lúc nào.

⚠️ **Trade-off scaling:**
- Group N người, M tin → bảng tăng `O(N*M)`.
- **Khuyến nghị:** với group >200 thành viên, KHÔNG insert `message_reads` cho mọi tin. Chỉ dùng `last_read_message_id` ở `conversation_members` (1 row update / user / event).
- DIRECT và group nhỏ vẫn dùng `message_reads` để hiển thị "Đã xem lúc HH:mm".

### 3.12. `message_reactions`

UNIQUE `(message_id, user_id, emoji)` — 1 user có thể react nhiều emoji khác nhau, nhưng không dup cùng emoji.

### 3.13. `message_mentions`

Lưu offset + length để FE highlight `@username` mà không phải parse lại text. Dùng để query "mention tới tôi" nhanh: `SELECT ... WHERE mentioned_user_id = ?`.

### 3.14. `pinned_messages`

Tách riêng để lấy danh sách pin nhanh (không scan messages). UNIQUE `(conversation_id, message_id)`.

### 3.15. `conversation_invite_links`

Link dạng `https://app/invite/<code>`. `max_uses` + `expires_at` + `is_revoked` để admin kiểm soát.

### 3.16. `conversation_keys` — Key mã hoá

Đã giải thích ở **Mục 2**. Ghi nhớ:
- 1 conversation có **nhiều key version**.
- Key cũ KHÔNG xoá (cần để decrypt tin cũ).
- Key version active = max(`key_version`) chưa expire.

### 3.17. `audit_logs`

Log hành động nhạy cảm: login, logout, đổi password ở Keycloak, tạo group, kick member, rotate key, xoá account. **Không xoá**, archive sang cold storage sau 1 năm.

---

## 4. Use cases & SQL mẫu

### 4.1. Lấy danh sách inbox của user (sorted by last message)

```sql
SELECT
  c.id, c.uuid, c.type, c.name, c.avatar_url,
  c.last_message_at, m.unread_count, m.is_pinned, m.is_muted
FROM conversation_members m
JOIN conversations c ON c.id = m.conversation_id
WHERE m.user_id = ?
  AND m.status = 'ACTIVE'
  AND m.is_archived = 0
  AND c.deleted_at IS NULL
ORDER BY m.is_pinned DESC, c.last_message_at DESC
LIMIT 30;
```

### 4.2. Lấy 30 tin nhắn gần nhất của 1 cuộc trò chuyện (trước khi decrypt)

```sql
SELECT id, uuid, sender_id, type,
       content_ciphertext, content_iv, content_auth_tag,
       encryption_key_id, encryption_key_version,
       reply_to_message_id, metadata, created_at,
       is_edited, edited_at, deleted_for
FROM messages
WHERE conversation_id = ?
  AND deleted_for <> 'EVERYONE'
  AND id < ?           -- cursor (id của tin cuối trang trước)
ORDER BY id DESC
LIMIT 30;
```

→ Service đọc `encryption_key_id` + `encryption_key_version` → fetch DEK từ `conversation_keys` → AES-GCM decrypt → trả response.

### 4.3. Tìm hoặc tạo direct conversation giữa 2 user

```ts
// Service layer
const ids = [userIdA, userIdB].sort();
const directKey = sha256(`${ids[0]}:${ids[1]}`);
let conv = await repo.findByDirectKey(directKey);
if (!conv) {
  conv = await repo.createDirect({ directKey, userIds: ids });
}
```

```sql
-- DDL đảm bảo: conversations có UNIQUE (direct_key)
SELECT id FROM conversations WHERE direct_key = ? LIMIT 1;
```

### 4.4. Cập nhật unread khi có tin mới

```sql
-- Trong transaction sau khi insert messages:
UPDATE conversation_members
SET unread_count = unread_count + 1
WHERE conversation_id = ?
  AND user_id <> ?       -- trừ sender
  AND status = 'ACTIVE';
```

### 4.5. Đánh dấu đã đọc tới message X

```sql
UPDATE conversation_members
SET last_read_message_id = ?,
    last_read_at = CURRENT_TIMESTAMP(3),
    unread_count = 0
WHERE conversation_id = ? AND user_id = ?;

-- (Optional, group nhỏ) ghi receipt chi tiết:
INSERT IGNORE INTO message_reads (message_id, user_id, conversation_id)
SELECT id, ?, ?
FROM messages
WHERE conversation_id = ?
  AND id > COALESCE(?, 0)
  AND id <= ?;
```

---

## 5. Index strategy

| Bảng | Index | Mục đích |
|---|---|---|
| `users` | `keycloak_id` UNIQUE | Lookup khi verify JWT |
| `users` | `email`, `phone`, `username` UNIQUE | Search user |
| `conversation_members` | `(user_id, status, is_archived)` | List inbox |
| `conversation_members` | `(conversation_id, status)` | List member của 1 group |
| `conversations` | `direct_key` UNIQUE | Dedupe DIRECT |
| `conversations` | `last_message_at DESC` | Sort inbox |
| `messages` | `(conversation_id, created_at DESC)` | Load lịch sử chat |
| `messages` | `(sender_id, created_at DESC)` | Search "tin của user X" |
| `message_reactions` | `(message_id, user_id, emoji)` UNIQUE | Toggle reaction |
| `message_mentions` | `mentioned_user_id` | "Mention tới tôi" |

---

## 6. Scale-out (khi cần)

### 6.1. Partitioning bảng `messages`

Khi `messages` >50M row, partition theo **RANGE COLUMNS(created_at)**:

```sql
ALTER TABLE messages
PARTITION BY RANGE COLUMNS(created_at) (
  PARTITION p2026_q1 VALUES LESS THAN ('2026-04-01'),
  PARTITION p2026_q2 VALUES LESS THAN ('2026-07-01'),
  PARTITION p2026_q3 VALUES LESS THAN ('2026-10-01'),
  PARTITION p_future VALUES LESS THAN MAXVALUE
);
```

> Lưu ý: với MySQL, partition key **phải nằm trong tất cả UNIQUE keys** → UNIQUE `uuid` cần đổi thành `(uuid, created_at)`.

### 6.2. Read replica

- Query lịch sử (`GET /messages?conversationId=...`) → read replica.
- Mutation (gửi tin) → primary.
- Đọc chính cuộc trò chuyện vừa gửi tin → primary (read-after-write consistency).

### 6.3. Cache (Redis)

- `inbox:{userId}` — sorted set (score = last_message_at).
- `conv:{convId}:members` — set user_id active.
- `presence:{userId}` — TTL 60s, refresh khi heartbeat WebSocket.
- `unread:{userId}:{convId}` — counter, sync về DB mỗi 30s.

### 6.4. Tách microservice (xa hơn)

Khi đủ tải và team đủ lớn:
- `messages-service` (write nặng) — có thể chuyển MongoDB / ScyllaDB.
- `presence-service` — Redis pub/sub.
- `media-service` — upload/transcode video.

---

## 7. Bảo mật & Compliance

| Vấn đề | Giải pháp |
|---|---|
| Password leak | KHÔNG lưu — Keycloak quản |
| Tin nhắn lộ ở DB | Mã hoá AES-256-GCM (mục 2), KEK ở KMS |
| File lộ ở S3 | SSE-KMS hoặc client-side encrypt |
| Search ciphertext | Không hỗ trợ (đánh đổi vì security). Nếu cần → encrypted search index riêng (Elasticsearch + searchable encryption) |
| GDPR — xoá user | Soft delete `users.status='DELETED'` + scrub PII (`email`, `phone` → NULL). Tin nhắn vẫn giữ với sender ẩn danh. |
| Audit | `audit_logs` ghi mọi action sensitive |
| Backup | Backup hàng ngày, encrypted, retention 30 ngày |

---

## 8. Migration & Versioning

- File này = **schema v1.0** (initial).
- Mọi thay đổi schema sau này → tạo file `database/migrations/<YYYYMMDD-HHmm>-<description>.sql`.
- Migration phải **idempotent** (`IF NOT EXISTS`, `IF EXISTS`) và **reversible** khi có thể (kèm `.down.sql`).
- KHÔNG bao giờ chạy `DROP TABLE` ở production mà không có backup + 2 người duyệt.

---

## 9. Cách import vào MySQL

```bash
# Tạo DB và import
mysql -u root -p < database/schema.sql

# Hoặc nếu DB đã tạo
mysql -u root -p vibe_chat < database/schema.sql

# Verify
mysql -u root -p vibe_chat -e "SHOW TABLES; SHOW TABLE STATUS WHERE Comment <> '';"
```

Yêu cầu:
- MySQL **8.0+** (cần `CHECK constraints`, `JSON`, `utf8mb4_0900_ai_ci`).
- User có quyền `CREATE`, `ALTER`, `INDEX`, `REFERENCES`.

---

## 10. Liên kết

- Rule DB nội bộ: [`.claude/rules/04-database.md`](../.claude/rules/04-database.md)
- Rule Security: [`.claude/rules/07-security.md`](../.claude/rules/07-security.md)
- Auth flow Keycloak: TODO — viết khi triển khai `auth` module.

**Phiên bản:** 1.0 — 2026-05-14
