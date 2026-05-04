# 07 — Security

## Nguyên tắc

> Security là **mặc định**, không phải tuỳ chọn. Mỗi feature mới phải qua security checklist trước khi merge.

## 🔴 R-SEC-01: Không hard-code secret

- Mọi secret/key qua `ConfigService` lấy từ `.env` (dev) / vault (prod).
- `.env` KHÔNG commit. `.env.example` commit (chỉ key, không value).
- Validate env qua Joi/Zod khi bootstrap.

## 🔴 R-SEC-02: Hash password

- `bcrypt` cost ≥ 12.
- Hash ngay khi nhận DTO, KHÔNG gửi plain qua các tầng dưới.
- KHÔNG bao giờ log password (kể cả debug).
- Compare bằng `bcrypt.compare`, không string compare.

## 🔴 R-SEC-03: JWT chuẩn

- 2 token: `accessToken` (15 phút) + `refreshToken` (7 ngày).
- `accessToken` JWT chứa `sub`, `email`, `role`, `iat`, `exp`.
- `refreshToken` random 64 byte, hash + lưu DB (revocable).
- Sign với RS256 (asymmetric) cho prod; HS256 chỉ dùng nội bộ.
- Logout = xoá refresh token DB + clear cookie.

```ts
// Header
Authorization: Bearer <accessToken>
```

## 🔴 R-SEC-04: RBAC qua decorator + Guard

```ts
@Roles('admin', 'moderator')
@UseGuards(JwtAuthGuard, RolesGuard)
@Delete(':id')
remove(@Param('id') id: string) {}
```

- Role enum trong `common/enums/role.enum.ts`.
- `RolesGuard` đọc metadata + so với `req.user.role`.
- KHÔNG check role bằng `if` trong service (centralize qua guard/policy).

## 🔴 R-SEC-05: Helmet + CORS + Rate limit

```ts
// main.ts
app.use(helmet());
app.enableCors({
  origin: configService.get('CORS_ORIGINS').split(','),
  credentials: true,
});
app.useGlobalGuards(app.get(ThrottlerGuard));
```

- CORS whitelist đọc từ env.
- Throttle: mặc định 10 req/s/IP. Login: 5 req/phút.

## 🔴 R-SEC-06: Input safety

- Mọi input qua DTO + class-validator (xem rules/06).
- Sanitize HTML cho field user nhập text (chống XSS).
- Mongo: dùng query builder, KHÔNG nhận object `$where` từ user.
- SQL: dùng ORM/parameterized query, KHÔNG concat string.
- File upload: whitelist mime type + giới hạn size + rename random.

## 🔴 R-SEC-07: Resource ownership check

```ts
async update(userId: string, messageId: string, dto: UpdateMessageDto) {
  const msg = await this.repo.findById(messageId);
  if (!msg) throw new NotFoundException({ code: 'MESSAGE_NOT_FOUND' });
  if (msg.authorId !== userId) {
    throw new ForbiddenException({ code: 'MESSAGE_NOT_OWNED' });
  }
  ...
}
```

→ Mọi mutation lên resource thuộc user phải kiểm tra ownership. KHÔNG tin `userId` từ body — luôn lấy từ JWT (`req.user.id`).

## 🔴 R-SEC-08: Không lộ thông tin

- Login fail → `Sai email hoặc mật khẩu` (không phân biệt email không tồn tại / sai password).
- 404 cho resource user không có quyền (thay vì 403, tránh enumeration).
- Error message tiếng Việt thân thiện, không lộ stack/path nội bộ.
- KHÔNG log: password, token, OTP, card number, raw cookie.

## 🟡 R-SEC-09: HTTPS only ở prod

- Cookie `Secure; HttpOnly; SameSite=Strict` cho refresh token.
- HSTS header.
- Trust proxy cho `X-Forwarded-For` đúng IP client.

## 🟡 R-SEC-10: Audit log

- Log action quan trọng: login, logout, password change, role change, delete account.
- Format: `{ actorId, action, target, ip, ua, timestamp, success }`.
- Lưu collection `audit_logs` riêng, không xoá.

## 🟡 R-SEC-11: 2FA / MFA

- Optional cho user thường, BẮT BUỘC cho admin.
- TOTP (RFC 6238) lưu secret encrypted.

## 🟡 R-SEC-12: Dependency scan

- `npm audit` + Dependabot/Renovate.
- Patch CVE level high/critical trong 7 ngày.

## OWASP Top 10 mapping

| OWASP | Phòng tránh ở đâu |
|---|---|
| A01 Broken Access Control | Guard + ownership check (R-SEC-04, R-SEC-07) |
| A02 Cryptographic Failures | Hash bcrypt, TLS, secret vault (R-SEC-02, R-SEC-09) |
| A03 Injection | DTO + parameterized query (R-SEC-06) |
| A04 Insecure Design | Rule này + threat modeling |
| A05 Security Misconfiguration | Helmet + CORS + env validate (R-SEC-05) |
| A06 Vulnerable Components | npm audit (R-SEC-12) |
| A07 Auth Failures | JWT + rate limit + lockout (R-SEC-03, R-SEC-05) |
| A08 Software Integrity | Lock package, signed commit |
| A09 Logging Failures | Audit log (R-SEC-10) + rule 09 |
| A10 SSRF | Whitelist URL khi gọi external (R-SEC-06) |

## Cấm

- ❌ Lưu password plain text / md5 / sha1.
- ❌ Truyền JWT qua URL query.
- ❌ `eval`, `new Function(...)` với input từ user.
- ❌ Trust `X-User-Id` header — luôn từ JWT verify.
- ❌ Disable CORS hoàn toàn (`origin: '*'` + `credentials: true`).
