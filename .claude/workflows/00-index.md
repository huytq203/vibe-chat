# Workflows — Mục lục

> Workflow là **quy trình từng bước** cho task lặp lại. Khi user yêu cầu task khớp với 1 workflow → bám đúng quy trình.

| File | Khi nào dùng |
|---|---|
| [add-new-module.md](./add-new-module.md) | User yêu cầu "tạo module X" / "thêm feature X" |
| [add-new-endpoint.md](./add-new-endpoint.md) | User yêu cầu "thêm endpoint Y vào module X" |
| [add-database-migration.md](./add-database-migration.md) | Đổi schema DB (thêm field, đổi type, thêm index) |
| [refactor-checklist.md](./refactor-checklist.md) | User yêu cầu refactor / cải thiện code |
| [debug-guide.md](./debug-guide.md) | User báo bug / lỗi runtime |

## Cách dùng workflow

1. Đọc workflow tương ứng từ đầu đến cuối **TRƯỚC** khi sinh code.
2. Báo cho user biết bạn đang theo workflow nào (1 dòng).
3. Đi theo step, mỗi step có **deliverable** rõ ràng.
4. Cuối workflow → checklist Definition of Done.
