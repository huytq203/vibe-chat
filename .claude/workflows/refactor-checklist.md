# Workflow: Refactor

> Áp dụng khi: "refactor module X", "tối ưu code Y", "clean up".

## Triết lý

1. **Refactor không đổi behavior**. Có test trước khi refactor.
2. **Nhỏ + thường xuyên** > lớn + 1 lần.
3. **1 PR refactor = 1 mục đích**. Đừng trộn refactor + feature + fix bug.
4. **Đo trước khi tối ưu**. Profile chỉ ra hot spot rồi mới đụng.

## Smell → Action

| Smell | Action |
|---|---|
| Service > 300 dòng | Tách subservice theo use case |
| Method > 30 dòng | Tách helper / strategy |
| Tham số > 3 | Gộp thành DTO/Options object |
| Nested if > 3 cấp | Early return / guard clause |
| Magic number/string | Đưa vào `constants/` |
| `any` / `as unknown as` | Thay bằng type chính xác |
| Duplicate logic 3+ chỗ | Tách shared util/service |
| Try/catch nuốt lỗi | Re-throw có context |
| Circular dependency | Tách shared module thứ 3 |
| Controller chứa logic | Đẩy xuống service |
| Service truy cập DB | Đưa qua repository |
| N+1 query | Batch / `populate` / `include` |
| Hard-code env | Qua `ConfigService` |
| `console.log` | `Logger` |
| Test thiếu | Bổ sung TRƯỚC refactor |

## Quy trình

### Step 1: Bảo vệ bằng test

- Chạy `npm run test` — phải xanh.
- Coverage ≥ 70% cho phần sắp refactor. Thiếu → bổ sung test trước.
- Capture behavior hiện tại bằng integration test (snapshot response shape).

### Step 2: Xác định scope

- 1 file? 1 module? Cross-module?
- Liệt kê smell cụ thể (theo bảng trên).
- Ước tính: PR < 400 dòng diff. Lớn hơn → chia nhiều PR.

### Step 3: Refactor từng bước nhỏ

Mỗi commit nhỏ + test xanh:
1. Đổi tên (rename) trước.
2. Trích xuất method/class.
3. Đổi chữ ký (signature).
4. Đổi cấu trúc dữ liệu.
5. Đổi thiết kế (interface, abstraction).

### Step 4: Verify không đổi behavior

- `npm run test` xanh.
- `npm run build` không lỗi.
- E2E test xanh.
- (Nếu UI) smoke test thủ công.

### Step 5: PR description

```markdown
## Mục đích
Tách `MessagesService` (450 dòng) thành 3 service nhỏ.

## Lý do
- Vi phạm SRP: chứa logic gửi tin, gửi notification, audit cùng lúc.
- Khó test do nhiều dependency.

## Thay đổi
- `MessagesService` chỉ giữ CRUD + send.
- `MessageNotificationService` mới (push, email).
- `MessageAuditService` mới.

## Risk
- Thấp. Test 100% cover trước refactor.

## Rollback
- Revert PR — không có schema change.
```

## Checklist Definition of Done

- [ ] Behavior không đổi (test xanh, không thêm test bypass).
- [ ] Coverage không giảm (≥ trước refactor).
- [ ] Lint, build pass.
- [ ] PR < 400 dòng diff (hoặc đã chia).
- [ ] Không kèm feature/bugfix lẻ tẻ.
- [ ] Document quyết định lớn (nếu đổi pattern).
- [ ] Rollback plan rõ ràng trong PR.

## Cấm

- ❌ Refactor + feature trong 1 PR.
- ❌ Refactor không có test bảo vệ.
- ❌ "Big bang refactor" 2000 dòng diff.
- ❌ Đổi public API mà không thông báo FE.
- ❌ Refactor mà không đo perf trước/sau khi mục tiêu là perf.
