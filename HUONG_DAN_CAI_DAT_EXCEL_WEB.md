# HƯỚNG DẪN ĐƯA LÊN GITHUB PAGES & CÀI VÀO EXCEL WEB

---

## 📌 BƯỚC 1: Đẩy mã nguồn lên GitHub & Bật GitHub Pages

1. Đăng nhập vào [GitHub](https://github.com/) và tạo 1 **Repository mới** (ví dụ đặt tên là: `bang-chiet-khau`). Chọn chế độ **Public**.
2. Mở cửa sổ dòng lệnh (Terminal/cmd) tại thư mục `C:\Users\NVBL\Documents\antigravity\jolly-hubble` và chạy:
   ```bash
   git add .
   git commit -m "Khoi tao Excel Web Add-in"
   git branch -M main
   git remote add origin https://github.com/TEN_GITHUB_CUA_BAN/bang-chiet-khau.git
   git push -u origin main
   ```
3. Sau khi đẩy code lên xong:
   - Vào **Settings** của repository trên GitHub $\rightarrow$ Mục **Pages** (ở cột bên trái).
   - Tại phần **Branch**, chọn `main` và bấm **Save**.
   - Chờ 1 phút, bạn sẽ nhận được đường link GitHub Pages dạng:
     `https://TEN_GITHUB_CUA_BAN.github.io/bang-chiet-khau/`

---

## 📌 BƯỚC 2: Cập nhật đường link vào file `manifest.xml`

1. Mở file `manifest.xml` trong thư mục trên máy tính.
2. Tìm 2 chỗ có chứa `https://YOUR_GITHUB_USERNAME.github.io/YOUR_REPO_NAME/index.html` và thay bằng link GitHub Pages thực tế của bạn (ví dụ: `https://TEN_GITHUB_CUA_BAN.github.io/bang-chiet-khau/index.html`).
3. Lưu file `manifest.xml` lại.

---

## 📌 BƯỚC 3: Cài Add-in vào Excel Web (Dùng ngay)

1. Mở file Excel của bạn trên trình duyệt qua **Excel Web (Excel Online)**.
2. Trên thanh công cụ (Ribbon), chọn thẻ **Insert (Chèn)** $\rightarrow$ **Office Add-ins (Tiện ích bổ sung Office)**.
3. Chọn tab **MY ADD-INS (Tiện ích của tôi)** $\rightarrow$ Bấm vào dòng chữ **Upload My Add-in (Tải tiện ích của tôi lên)**.
4. Chọn file **`manifest.xml`** từ máy tính của bạn và bấm **Upload**.

---

## 🚀 KẾT QUẢ:
- Trên thanh công cụ Excel Web sẽ xuất hiện thẻ mới **"Xăng Dầu"** có nút **"Bảng Chiết Khấu"**.
- Bấm vào nút, bảng giao diện HTML sẽ xuất hiện ở thanh bên phải (Taskpane).
- Dữ liệu từ vùng `B7:R200` của Excel sẽ **tự động nạp trực tiếp vào giao diện HTML theo thời gian thực (Real-time)**!
