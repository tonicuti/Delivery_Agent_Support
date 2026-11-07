# Cài Node.js (Windows) — trước F0

Máy cần **Node.js LTS** + **npm** để chạy Vite/React trong `src/frontend`.

## Bản khuyến nghị

| Công cụ | Bản |
|---|---|
| Node.js | **22 LTS** (hoặc 20 LTS nếu công ty bắt buộc) |
| npm | đi kèm Node (11.x với Node 22) |

Không cần nvm/fnm cho MVP trừ khi bạn đã quen dùng version manager.

## Cách A — winget (nhanh, khuyến nghị)

Mở **PowerShell** (không cần Admin trừ khi winget báo thiếu quyền):

```powershell
winget install OpenJS.NodeJS.LTS --accept-package-agreements --accept-source-agreements
```

Đóng hết cửa sổ terminal/Cursor terminal cũ, mở terminal mới, rồi kiểm tra:

```powershell
node -v
npm -v
```

Kỳ vọng kiểu:

```text
v22.x.x
10.x.x   # hoặc 11.x tùy bản LTS
```

Nếu lệnh vẫn “not recognized”:

1. Đăng xuất / mở lại Cursor hoàn toàn (PATH chỉ cập nhật cho process mới).
2. Kiểm tra PATH có thư mục Node, thường là:
   - `C:\Program Files\nodejs\`
3. Trong PowerShell:

```powershell
$env:Path -split ';' | Select-String -Pattern 'nodejs'
```

## Cách B — installer chính thức

1. Vào https://nodejs.org  
2. Tải **LTS** (Windows Installer `.msi`)  
3. Next → giữ勾 **Add to PATH**  
4. Finish → **mở lại** terminal / Cursor  
5. Chạy `node -v` và `npm -v`

## Kiểm tra thêm (optional)

```powershell
node -e "console.log('ok', process.version)"
npm ping
```

`npm ping` cần mạng; nếu firewall chặn registry vẫn cài local được.

## Không làm

- Không cài Node chỉ trong WSL nếu bạn code frontend trên Windows path `F:\...` (dễ lệch quyền/path).
- Không dùng Node 16/18 đã EOL cho stack Vite mới.
- Không `npm install -g` lung tung trước khi scaffold F0.

## Sau khi cài xong

Quay lại [F0-scaffold.md](features/F0-scaffold.md) và [issue #6](https://github.com/tonicuti/Delivery_Agent_Support/issues/6).

Báo mentor: `node -v` / `npm -v` output → rồi mới bắt đầu scaffold.
