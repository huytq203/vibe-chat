# Workflow: Debug

> Áp dụng khi: "lỗi X", "không chạy", "500 error", "endpoint Y trả sai".

## Triết lý

> Tìm **root cause**, không vá triệu chứng. Mỗi bug fix = (1) test reproduce, (2) fix, (3) test xác nhận, (4) ghi note nếu non-obvious.

## Step 1 — Reproduce

- Hỏi user: bước cụ thể, request payload, response thực tế, response mong đợi.
- Reproduce trên local trước khi đoán.
- Nếu không reproduce được → log + theo dõi prod (cẩn thận PII).

## Step 2 — Khoanh vùng

| Triệu chứng | Khoanh vùng |
|---|---|
| 400 / Validation lỗi | DTO / ValidationPipe / Guard |
| 401 / 403 | JwtStrategy / RolesGuard / Token |
| 404 | Repository / soft-delete filter / route path |
| 409 | Unique index / concurrency |
| 500 | Service logic / external API / DB |
| Timeout | Query nặng / N+1 / external slow |
| Memory leak | EventEmitter listener / connection pool / closure giữ ref |
| WebSocket disconnect | Sticky session / heartbeat / proxy timeout |

## Step 3 — Đọc log

- Filter theo `requestId` (xem rules/09).
- Tìm `error` đầu tiên gần thời điểm lỗi → đọc stack trace.
- Đối chiếu với `path`, `method`, `userId`.

## Step 4 — Hypothesis

Trước khi sửa code, viết **giả thuyết**:
- "Bug do X vì Y. Nếu đúng, expect log/data như Z."

Sau đó **chứng minh** bằng:
- Thêm log tạm.
- Chạy lại + đối chiếu Z.
- Hoặc viết test reproduce → test fail.

## Step 5 — Fix

- Sửa **nguyên nhân**, không phải hệ quả.
- Nếu fix làm thay đổi public API → tham vấn user.
- Nếu fix có scope rộng → chia commit nhỏ.

## Step 6 — Test

- Viết test **reproduce bug** (test fail trước fix).
- Chạy test → giờ phải xanh.
- Chạy full suite — không vỡ chỗ khác.

## Step 7 — Document

- Commit message: `fix(<scope>): <root cause ngắn>` + body giải thích why.
- Nếu fix non-obvious (race condition, edge case) → comment trong code:
  ```ts
  // Lock theo userId để tránh race khi 2 request cùng tăng counter
  // (đã từng gây sai số trong incident 2026-04-30)
  ```

## Toolset hữu ích

| Tool | Khi nào |
|---|---|
| `node --inspect-brk` | Debug bằng Chrome DevTools |
| `npm run test:debug` | Debug 1 test cụ thể |
| `console.dir(obj, { depth: 5 })` | Inspect object sâu (chỉ dev) |
| `EXPLAIN` (SQL) / `.explain('executionStats')` (Mongo) | Query slow |
| `0x` / `clinic.js` | Profile CPU/memory |
| `tcpdump` / Wireshark | Lỗi network |

## Anti-pattern

| ❌ Sai | ✅ Đúng |
|---|---|
| Thêm try/catch để tránh crash | Tìm tại sao throw |
| `if (data) ...` để né undefined | Tìm tại sao data undefined |
| Restart service mỗi lần lỗi | Fix code |
| Disable test fail | Fix code (test fail = bug, không phải test sai) |
| Comment out code "tạm" | Xoá hoặc fix |

## Khi nào escalate?

- Bug đã 4+ giờ không tìm root cause → tạm thời mitigate (rollback / feature flag) + tag senior.
- Bug ảnh hưởng > 5% user → incident response, không debug 1 mình.
- Bug chỉ xảy ra trên prod → KHÔNG đoán, mở observability + reproduce trên staging.
