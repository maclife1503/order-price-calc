import React, { useEffect, useMemo, useState } from "react";

// Version: layout simplified per request
// 1) Thông tin sản phẩm (tỷ giá, tổng JPY, số lượng, giá VND)
// 2) Kích thước, phí ship (kg, L/W/H, ship từ người bán ¥, ship Nhật–Việt, ship nội địa VN, phụ thu)
// 3) Kết quả (giá gốc, công mua, phụ thu, ship từ người bán (¥→VND), ship JPN–VN, ship nội địa VN)
// 4) Tổng thanh toán
// Công mua:
//  - Nếu tổng ≤ 25,000¥: 1 đơn 500¥; 2–5 đơn 400¥/đơn; 6–10 đơn 300¥/đơn ( >10 vẫn 300¥/đơn )
//  - Nếu tổng > 25,000¥: 2%

const VND = new Intl.NumberFormat("vi-VN", { style: "currency", currency: "VND" });
const GEN = new Intl.NumberFormat("vi-VN");

function parseNum(v) {
  if (v === "" || v === null || v === undefined) return 0;
  const n = typeof v === "number" ? v : Number(("" + v).replace(/,/g, "."));
  return Number.isFinite(n) ? n : 0;
}

// Stepper (không bắt buộc dùng ở bản này, giữ để tái sử dụng)
function QtyStepper({ value, onChange, min = 0, max = 999 }) {
  const clamp = (v) => Math.min(max, Math.max(min, v | 0));
  const inc = () => onChange(clamp((value ?? 0) + 1));
  const dec = () => onChange(clamp((value ?? 0) - 1));

  return (
    <div className="inline-flex items-center gap-2">
      <span className="text-sm text-gray-600">SL:</span>

      <div className="inline-flex items-stretch w-fit rounded-2xl border border-gray-700 overflow-hidden">
        <div className="px-3 py-1.5 min-w-[3ch] text-center font-medium select-none">
          {value ?? 0}
        </div>

        <div className="flex flex-col divide-y divide-gray-300 border-l border-gray-700">
          <button
            type="button"
            aria-label="Tăng"
            onClick={inc}
            className="w-8 h-5 leading-none hover:bg-gray-100 active:scale-95"
          >
            ▲
          </button>
          <button
            type="button"
            aria-label="Giảm"
            onClick={dec}
            className="w-8 h-5 leading-none hover:bg-gray-100 active:scale-95"
          >
            ▼
          </button>
        </div>
      </div>
    </div>
  );
}

// Label có * (required) + icon ? có tooltip (tooltip hiển thị Ở TRÊN)
function InfoLabel({ label, hint, required }) {
  return (
    <div className="flex items-center gap-2 mb-1.5">
      <label className="text-sm font-medium text-gray-800">
        {required && <span className="text-red-500 mr-1">*</span>}
        {label}
      </label>

      {hint && (
        <span className="relative group inline-flex items-center justify-center 
                         w-5 h-5 rounded-full border border-gray-300 text-gray-500 text-xs cursor-default select-none">
          ?
          {/* tooltip: ở TRÊN icon */}
          <span className="absolute z-10 hidden group-hover:block left-1/2 -translate-x-1/2 
                           bottom-[calc(100%+8px)] whitespace-pre-line px-3 py-2 rounded-md text-xs text-gray-800 bg-white
                           border shadow-md w-max max-w-[260px]">
            {hint}
            {/* mũi tên nhỏ */}
            <span className="absolute -bottom-1 left-1/2 -translate-x-1/2 w-2 h-2 bg-white rotate-45 border-l border-b"></span>
          </span>
        </span>
      )}
    </div>
  );
}

// Khung field chuẩn như ảnh (bo tròn, border nhạt)
function Field({ label, hint, required, children }) {
  return (
    <div>
      <InfoLabel label={label} hint={hint} required={required} />
      <div className="rounded-xl border border-gray-200 px-3 py-2 bg-white">
        {children}
      </div>
    </div>
  );
}

// class input chung
const INPUT_BASE =
  "w-full bg-transparent border-0 outline-none focus:ring-0 placeholder-gray-400 text-gray-900";

// === NEW: Hàm tính công mua theo bậc thang theo SỐ LƯỢNG ===
function getServiceFeeJPY(yenTotal, qty) {
  const y = Math.max(0, parseNum(yenTotal));
  const q = Math.max(1, parseNum(qty));

  if (y <= 25000) {
    if (q <= 1) return 500;       // 1 đơn
    if (q <= 5) return 400 * q;   // 2–5 đơn
    if (q <= 10) return 300 * q;  // 6–10 đơn
    return 300 * q;               // >10: vẫn 300/đơn
  }
  // > 25,000¥ ⇒ 2%
  return y * 0.02;
}

export default function OrderPriceCalculator() {
  // 1) Thông tin sản phẩm
  const [rate, setRate] = useState(180); // Tỷ giá JPY → VND
  const [totalYen, setTotalYen] = useState(); // Tổng giá trị đơn hàng (¥)
  const [qty, setQty] = useState(); // Số lượng hàng đặt
  const evalExpr = (s) => {
    const safe = (s || "").replace(/[^0-9+\-*/().]/g, "");
    if (!safe) return "";
    try {
      const v = Function('"use strict";return(' + safe + ')')();
      return Number.isFinite(v) ? v : "";
    } catch { return ""; }
  };
  const [totalYenInput, setTotalYenInput] = useState("");

  // 2) Kích thước, phí ship
  const [weightKg, setWeightKg] = useState("");
  const [lenCm, setLenCm] = useState("");
  const [widCm, setWidCm] = useState("");
  const [heiCm, setHeiCm] = useState("");
  const [sellerShipYen, setSellerShipYen] = useState(); // Phí ship từ người bán (¥)
  const [shipJPVN, setShipJPVN] = useState(); // VND
  const [shipVN, setShipVN] = useState(); // VND
  const [surchargeVND, setSurchargeVND] = useState(); // Phụ thu (VND)

  const calc = useMemo(() => {
    const r = Math.max(0, parseNum(rate));
    const yenTotal = Math.max(0, parseNum(totalYen));

    // Giá gốc quy đổi (tham khảo)
    const baseVND = yenTotal * r;

    // Công mua theo bậc thang theo SỐ LƯỢNG (≤25k¥) / ngược lại 2%
    const serviceFeeJPY = getServiceFeeJPY(yenTotal, qty);
    const serviceFeeVND = serviceFeeJPY * r;

    // Giá VND (ước tính) = (Tổng ¥ + Công mua ¥) × tỷ giá
    const priceVND = (yenTotal + serviceFeeJPY) * r;

    // Phí ship từ người bán (¥ → VND)
    const sellerShipVND = Math.max(0, parseNum(sellerShipYen)) * r;

    // Ship khác (đã ở VND)
    const shipJVN = Math.max(0, parseNum(shipJPVN));
    const shipLocal = Math.max(0, parseNum(shipVN));

    // Phụ thu (VND)
    const extra = Math.max(0, parseNum(surchargeVND));

    // Tổng thanh toán = Giá VND mới + các phí VND
    const total = priceVND + extra + sellerShipVND + shipJVN + shipLocal;

    // Khối lượng quy đổi (tham khảo)
    const volWeight =
      (Math.max(0, parseNum(lenCm)) *
        Math.max(0, parseNum(widCm)) *
        Math.max(0, parseNum(heiCm))) / 6000;

    return {
      baseVND,
      serviceFeeJPY,
      serviceFeeVND,
      priceVND,
      sellerShipVND,
      shipJVN,
      shipLocal,
      extra,
      total,
      r,
      yenTotal,
      qty: Math.max(0, parseNum(qty)),
      weightKg: Math.max(0, parseNum(weightKg)),
      volWeight,
    };
  }, [rate, totalYen, qty, sellerShipYen, shipJPVN, shipVN, surchargeVND, lenCm, widCm, heiCm, weightKg]);

  return (
    <div className="min-h-screen w-full bg-gradient-to-b from-white to-gray-50 text-gray-900">
      <div className="max-w-5xl mx-auto p-6 md:p-10">
        {/* 1) Thông tin sản phẩm */}
        <section className="relative bg-white rounded-2xl shadow-sm border p-5 md:p-6 mb-6 pb-4">
          <h2 className="text-base font-semibold mb-4 ">1) Thông tin sản phẩm</h2>

          <div className="absolute top-3 right-4 text-sm text-gray-600">
            <div className="text-center text-gray-600">
              <div className="text-xs">{new Date().toLocaleDateString("vi-VN")}</div>
              <div className="text-xs font-medium">{GEN.format(rate)} VND / 1¥</div>
            </div>
          </div>

          {/* Hàng trên: Tổng (trái) + SL (phải). Hàng giữa (phải): Công mua. Hàng dưới: Giá VND full */}
          <div className="grid grid-cols-10 md:grid-cols-2 gap-4">
            {/* Tổng giá trị đơn hàng (¥) – trái */}
            <div className=" col-span-10 md:col-span-1">
              <Field
                label="Tổng đơn (¥)"
                required
                hint={"Bạn có thể làm phép cộng các đơn hàng ở ô này"}
              >
                <div className="text-xs text-gray-400 mb-1">
                  ~ {VND.format(calc.priceVND)}
                </div>

                <textarea
                  rows={1}
                  type="text"
                  inputMode="text" 
                  pattern="[0-9+\\-*/().]*"
                  className={INPUT_BASE + " resize-none overflow-hidden text-base font-medium"}
                  placeholder="vd: 1000+500*2"
                  value={totalYenInput}
                  onChange={(e) => {
                    e.target.style.height = "auto";
                    e.target.style.height = e.target.scrollHeight + "px";
                    const raw = e.target.value.replace(/^0+(?=\d)/, "");
                    setTotalYenInput(raw);
                    const v = evalExpr(raw);
                    setTotalYen(prev => (v === "" ? (prev ?? 0) : v));
                  }}
                />
              </Field>
            </div>
            
            {/* SL – phải (cùng hàng với Tổng) */}
            <div className="col-span-10 md:col-span-1">
              <Field
                label="SL"
                required
                hint="Trên 10 vui lòng liên hệ shop để đặt số lượng lớn."
              >
                <input
                  type="number"
                  min={1}
                  inputMode="numeric"
                  className={INPUT_BASE + "resize-none overflow-hidden text-base font-medium"}
                  
                  value={qty}
                  onChange={(e) => setQty(Math.max(0, parseNum(e.target.value)))}
                />
                {qty > 10 && (
                  <div className="mt-1 text-xs text-red-600">
                    Số lượng &gt; 10 — vui lòng liên hệ shop.
                  </div>
                )}
              </Field>
            </div>

            {/* Công mua – ngay dưới SL, vẫn ở cột phải */}
            <div className="col-span-10 md:col-span-1">
              <Field
                label="Công mua"
                hint={"càng mua nhiều càng rẻ\n≤ 25,000¥: 1 đơn 500¥; 2–5 đơn 400¥/đơn; 6–10 đơn 300¥/đơn.\n> 25,000¥: 2%."}
              >
                <div className="flex items-baseline gap-2">
                  <div className="text-lg font-semibold">{VND.format(calc.serviceFeeVND)}</div>
                  <div className="text-xs text-gray-500">({GEN.format(calc.serviceFeeJPY)}¥)</div>
                </div>
              </Field>
            </div>

            {/* Giá VND (ước tính) – luôn dưới cùng, full width */}
            <div className="col-span-10 md:col-span-1">
              <Field
                label="Giá VND (ước tính)"
                hint="(Tổng ¥ + Công mua ¥) × Tỷ giá. Chưa gồm ship/phụ thu."
              >
                <div className="text-lg font-semibold">
                  {VND.format(calc.priceVND)}
                </div>
              </Field>
            </div>
          </div>
        </section>

        {/* 2) Kích thước, phí ship */}
        <section className="bg-white rounded-2xl shadow-sm border p-5 md:p-6 mb-6">
          <h2 className="text-lg font-semibold mb-4">2) Kích thước, phí ship</h2>

          {/* Hàng 1: Cân nặng (full width) */}
          <div className="mb-4">
            <Field label="Cân nặng dự kiến (kg)" hint="Khối lượng thực tế ước tính của kiện hàng.">
              <div className="relative">
                <input
                  type="text"           // dùng text để không bị trình duyệt ép
                  inputMode="decimal"   // vẫn mở keypad số trên mobile
                  className={INPUT_BASE + " w-full pr-10"}  // chừa chỗ cho 'kg'
                  placeholder="Nhập số"
                  value={weightKg ?? ""}                     // cho phép hiển thị rỗng
                  onChange={(e) => {
                    // chỉ giữ số và dấu chấm, cho phép rỗng ""
                    const v = e.target.value.replace(/[^\d.]/g, "");
                    setWeightKg(v);
                  }}
                  onBlur={() => {
                    // khi rời ô: nếu có giá trị thì chuẩn hoá về số
                    if (weightKg !== "" && weightKg != null) {
                      setWeightKg(String(parseNum(weightKg)));
                    }
                  }}
                />
                <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-sm text-gray-400">
                  kg
                </span>
              </div>
            </Field>
          </div>
                   


          {/* Hàng 2: Dài – Rộng – Cao (luôn cùng 1 hàng, tự co giãn) */}
          <div className="mb-4">
            <div className="grid grid-cols-3 gap-4">
              <div className="min-w-0">
                {/* Dài (cm) – cho phép trống, có đơn vị trong ô */}
                <Field label="Dài" hint="Chiều dài thùng sau khi đóng gói.">
                  <div className="relative">
                    <input
                      type="text"              // dùng text để không bị ép hiển thị 0
                      inputMode="decimal"      // mobile vẫn bật keypad số
                      className={INPUT_BASE + " w-full pr-10"}
                      placeholder="Nhập số"
                      value={lenCm ?? ""}      // cho phép rỗng
                      onChange={(e) => {
                        const v = e.target.value.replace(/[^\d.]/g, ""); // chỉ giữ số & dấu chấm
                        setLenCm(v);             // KHÔNG parse ngay → tránh hiện 0 khi xoá hết
                      }}
                      onBlur={() => {
                        if (lenCm === "" || lenCm == null) return;
                        // chuẩn hoá khi rời ô (tùy chọn): "0012.0" -> "12"
                        setLenCm(String(parseNum(lenCm)));
                      }}
                    />
                    <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-sm text-gray-400">
                      cm
                    </span>
                  </div>
                </Field>

              </div>
              
              <div className="min-w-0">
                <Field label="Rộng" hint="Chiều rộng thùng sau khi đóng gói.">
                  <div className="relative">
                    <input
                      type="text"              // dùng text để không bị ép hiển thị 0
                      inputMode="decimal"      // mobile vẫn bật keypad số
                      className={INPUT_BASE + " w-full pr-10"}
                      placeholder="Nhập số"
                      value={widCm ?? ""}      // cho phép rỗng
                      onChange={(e) => {
                        const v = e.target.value.replace(/[^\d.]/g, ""); // chỉ giữ số & dấu chấm
                        setWidCm(v);             // KHÔNG parse ngay → tránh hiện 0 khi xoá hết
                      }}
                      onBlur={() => {
                        if (widCm === "" || widCm == null) return;
                        // chuẩn hoá khi rời ô (tùy chọn): "0012.0" -> "12"
                        setWidCm(String(parseNum(widCm)));
                      }}
                    />
                    <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-sm text-gray-400">
                      cm
                    </span>
                  </div>
                </Field>
              </div>

              <div className="min-w-0">
                <Field label="Cao" hint="Chiều cao thùng sau khi đóng gói.">
                  <div className="relative">
                    <input
                      type="text"              // dùng text để không bị ép hiển thị 0
                      inputMode="decimal"      // mobile vẫn bật keypad số
                      className={INPUT_BASE + " w-full pr-10"}
                      placeholder="Nhập số"
                      value={heiCm ?? ""}      // cho phép rỗng
                      onChange={(e) => {
                        const v = e.target.value.replace(/[^\d.]/g, ""); // chỉ giữ số & dấu chấm
                        setHeiCm(v);             // KHÔNG parse ngay → tránh hiện 0 khi xoá hết
                      }}
                      onBlur={() => {
                        if (heiCm === "" || heiCm == null) return;
                        // chuẩn hoá khi rời ô (tùy chọn): "0012.0" -> "12"
                        setHeiCm(String(parseNum(heiCm)));
                      }}
                    />
                    <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-sm text-gray-400">
                      cm
                    </span>
                  </div>
                </Field>
              </div>
            </div>
          </div>
                          

          {/* Các phí khác */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <Field label="Phí ship từ người bán (¥)" hint="Phí nội địa Nhật; sẽ quy đổi sang VND.">
                <input
                  type="number"
                  className={INPUT_BASE}
                  value={sellerShipYen}
                  onChange={(e)=>setSellerShipYen(parseNum(e.target.value))}
                />
              </Field>
            </div>
            <div>
              <Field label="Phí ship Nhật–Việt (VND)" hint="Cước quốc tế Nhật → Việt Nam.">
                <input
                  type="number"
                  className={INPUT_BASE}
                  value={shipJPVN}
                  onChange={(e)=>setShipJPVN(parseNum(e.target.value))}
                />
              </Field>
            </div>
            <div>
              <Field label="Phí ship nội địa Việt Nam (VND)" hint="Cước giao hàng trong nước.">
                <input
                  type="number"
                  className={INPUT_BASE}
                  value={shipVN}
                  onChange={(e)=>setShipVN(parseNum(e.target.value))}
                />
              </Field>
            </div>
            <div className="md:col-span-3">
              <Field label="Phụ thu (VND)" hint="Các khoản phát sinh thêm nếu có.">
                <input
                  type="number"
                  className={INPUT_BASE}
                  value={surchargeVND}
                  onChange={(e)=>setSurchargeVND(parseNum(e.target.value))}
                />
              </Field>
            </div>
          </div>

          <div className="mt-4 text-xs bg-gray-50 border rounded-xl p-3">
            <div className="flex justify-between">
              <span>Khối lượng quy đổi (L×W×H / 6000)</span>
              <span>{GEN.format(calc.volWeight)} kg</span>
            </div>
          </div>
        </section>


        {/* 3) Kết quả */}
        <section className="bg-white rounded-2xl shadow-sm border p-5 md:p-6 mb-6">
          <h2 className="text-lg font-semibold mb-4">3) Kết quả</h2>
          <div className="space-y-2 text-sm">
            <div className="flex justify-between"><span>1) Giá gốc</span><span>{VND.format(calc.baseVND)}</span></div>
            <div className="flex justify-between"><span>2) Công mua</span><span>{VND.format(calc.serviceFeeVND)} ({GEN.format(calc.serviceFeeJPY)}¥)</span></div>
            <div className="flex justify-between"><span>3) Phụ thu</span><span>{VND.format(calc.extra)}</span></div>
            <div className="flex justify-between"><span>4) Phí ship từ người bán (¥)</span><span>{GEN.format(parseNum(sellerShipYen))}¥ ({VND.format(calc.sellerShipVND)})</span></div>
            <div className="flex justify-between"><span>5) Phí ship Nhật–Việt</span><span>{VND.format(calc.shipJVN)}</span></div>
            <div className="flex justify-between"><span>6) Phí ship nội địa Việt Nam</span><span>{VND.format(calc.shipLocal)}</span></div>
          </div>
        </section>

        {/* 4) Tổng thanh toán */}
        <section className="bg-white rounded-2xl shadow-sm border p-5 md:p-6">
          <h2 className="text-lg font-semibold mb-4">4) Tổng thanh toán</h2>
          <div className="flex justify-between items-baseline">
            <div className="text-gray-900 font-semibold">TỔNG</div>
            <div className="text-2xl font-bold">{VND.format(calc.total)}</div>
          </div>
        </section>
      </div>
    </div>
  );
}
