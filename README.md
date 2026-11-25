# Origin uBlock

**Chặn quảng cáo. Bảo vệ quyền riêng tư.** Extension Chromium Manifest V3, giao diện sáng/tối hiện đại, hỗ trợ tiếng Việt và tiếng Anh.

[Download / Tải bản build](https://github.com/lowji194/Origin-uBlock/releases) · [Build CI](https://github.com/lowji194/Origin-uBlock/actions) · [Issues](https://github.com/lowji194/Origin-uBlock/issues)

- Engine uBlock Origin Lite MV3 (Declarative Net Request), giữ nguyên chức năng lọc của upstream.
- Popup điều khiển bảo vệ theo website, ba mức lọc, truy cập nhanh bộ lọc, thống kê và nhật ký.
- Dashboard tổng quan, bật/tắt toàn cục có khôi phục ngoại lệ, bảo vệ riêng tư, danh sách ngoại lệ, quy tắc tùy chỉnh và cài đặt.
- Biểu đồ 7 ngày từ số đếm badge quan sát được (opt-in, cục bộ); nhật ký quy tắc khớp trong giới hạn API Chrome, không lưu URL.
- EasyList, EasyPrivacy, uBlock Filters và ABPVN công khai bật mặc định.
- Element picker, zapper, bộ lọc tùy chỉnh, ngoại lệ, sao lưu / khôi phục.
- Không có telemetry mới; thống kê tab chỉ hiển thị nếu API trình duyệt cung cấp số liệu.
- Không đóng gói bộ lọc VIP/Premium.

## Giao diện v1.1.0

![Dashboard thực tế trên Chrome](docs/origin/dashboard.png)

![Popup thực tế trên Chrome](docs/origin/popup.png)

Ảnh chụp từ phiên Chrome kiểm thử độc lập, không có số liệu thống kê giả.

## Cài đặt
Tải ZIP tại Releases, giải nén, mở `chrome://extensions`, bật Developer mode và chọn Load unpacked, chọn thư mục chứa manifest.json.

## Build / kiểm thử
Xem [ORIGIN.md](ORIGIN.md). Các bài smoke test dùng Chrome headless để xác nhận engine, giao diện popup, dashboard và chặn request thực tế.

## License / Attribution
Independent unofficial fork of [gorhill/uBlock](https://github.com/gorhill/uBlock), not affiliated with uBlock Origin. Copyright (c) Raymond Hill and upstream contributors. GPL-3.0; see [LICENSE.txt](LICENSE.txt), [upstream README](README.upstream.md) and upstream asset licenses.
