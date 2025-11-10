import React, { useMemo, useRef, useState } from "react";

// == Currency / number formatters
const VND = new Intl.NumberFormat("vi-VN", { style: "currency", currency: "VND" });
const GEN = new Intl.NumberFormat("vi-VN");

function parseNum(v) {
  if (v === "" || v === null || v === undefined) return 0;
  const n = typeof v === "number" ? v : Number(("" + v).replace(/,/g, "."));
  return Number.isFinite(n) ? n : 0;
}

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

// Tooltip label
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
          <span className="absolute z-10 hidden group-hover:block left-1/2 -translate-x-1/2 
                           bottom-[calc(100%+8px)] whitespace-pre-line px-3 py-2 rounded-md text-xs text-gray-800 bg-white
                           border shadow-md w-max max-w-[260px]">
            {hint}
            <span className="absolute -bottom-1 left-1/2 -translate-x-1/2 w-2 h-2 bg-white rotate-45 border-l border-b"></span>
          </span>
        </span>
      )}
    </div>
  );
}

function Field({ label, hint, required, children }) {
  return (
    <div>
      <InfoLabel label={label} hint={hint} required={required} />
      <div className="rounded-xl border border-gray-200 px-3 py-2 bg-white">{children}</div>
    </div>
  );
}

function Field_grey({ label, hint, required, children }) {
  return (
    <div>
      <InfoLabel label={label} hint={hint} required={required} />
      <div className="rounded-xl border border-gray-200 px-3 py-2 bg-gray-100">{children}</div>
    </div>
  );
}
const INPUT_BASE =
  "w-full bg-transparent border-0 outline-none focus:ring-0 placeholder-gray-400 text-gray-900";

// === NEW: Modal hiển thị nội dung file bảng tính (CSV/TSV/TXT)
function SheetModal({ open, onClose, name, rows }) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50">
      <div className="absolute inset-0 bg-black/30" onClick={onClose} />
      <div className="absolute inset-x-4 md:inset-x-10 lg:inset-x-20 top-10 bottom-10 bg-white rounded-2xl shadow-xl border p-4 md:p-6 overflow-hidden">
        <div className="flex items-center justify-between gap-4 mb-4">
          <h3 className="text-base md:text-lg font-semibold">Bảng tính phí ship & phụ thu {!name ? "" : `– ${name}`}</h3>
          <button onClick={onClose} className="px-3 py-1.5 rounded-lg border hover:bg-gray-50">Đóng</button>
        </div>
        <div className="h-full overflow-auto border rounded-xl">
          <table className="min-w-full text-sm">
            <tbody>
              {rows && rows.length > 0 ? (
                rows.map((r, i) => (
                  <tr key={i} className={i % 2 ? "bg-gray-50" : "bg-white"}>
                    {r.map((c, j) => (
                      <td key={j} className="px-3 py-2 border-b whitespace-pre">{String(c)}</td>
                    ))}
                  </tr>
                ))
              ) : (
                <tr>
                  <td className="p-6 text-center text-gray-500">Không có dữ liệu hiển thị.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

// === NEW: Parser CSV/TSV đơn giản (không phụ thuộc thư viện)
function parseDelimited(text) {
  if (!text) return [];
  // Ưu tiên tách theo tab nếu thấy nhiều tab, nếu không thì theo dấu phẩy
  const useTab = (text.match(/\t/g) || []).length > (text.match(/,/g) || []).length;
  const sep = useTab ? "\t" : ",";
  const lines = text.replace(/\r\n/g, "\n").replace(/\r/g, "\n").split("\n");
  return lines.map((line) => {
    // Parser nhẹ: tôn trọng cặp dấu nháy đôi, cho phép dấu phân cách bên trong nháy
    const cells = [];
    let cur = "";
    let inQuotes = false;
    for (let i = 0; i < line.length; i++) {
      const ch = line[i];
      if (ch === '"') {
        if (inQuotes && line[i + 1] === '"') {
          cur += '"';
          i++; // skip escaped quote
        } else {
          inQuotes = !inQuotes;
        }
      } else if (ch === sep && !inQuotes) {
        cells.push(cur);
        cur = "";
      } else {
        cur += ch;
      }
    }
    cells.push(cur);
    return cells;
  });
}

// === Đường dẫn & hàm tải PDF phụ thu có sẵn trong project
const PDF_SURCHARGE_PATH = "/data/phu_thu.pdf";

async function handleOpenSurchargePDF() {
  // Mở tab mới, dùng viewer PDF mặc định của trình duyệt
  window.open(PDF_SURCHARGE_PATH, "_blank", "noopener,noreferrer");
}

export default function OrderPriceCalculator() {
  // 1) Thông tin sản phẩm
  const [rate, setRate] = useState(180);
  const [totalYen, setTotalYen] = useState();
  const [qty, setQty] = useState();
  const evalExpr = (s) => {
    const safe = (s || "").replace(/[^0-9+\-*/().]/g, "");
    if (!safe) return "";
    try {
      const v = Function('"use strict";return(' + safe + ')')();
      return Number.isFinite(v) ? v : "";
    } catch {
      return "";
    }
  };
  const [totalYenInput, setTotalYenInput] = useState("");

  // 2) Kích thước, phí ship
  const [weightKg, setWeightKg] = useState("");
  const [lenCm, setLenCm] = useState("");
  const [widCm, setWidCm] = useState("");
  const [heiCm, setHeiCm] = useState("");
  const [sellerShipYen, setSellerShipYen] = useState();
  const [shipJPVN, setShipJPVN] = useState();
  const [shipVN, setShipVN] = useState();
  const [surchargeVND, setSurchargeVND] = useState();

  // === NEW: State cho "Bảng tính phí ship & phụ thu"
  const fileRef = useRef(null);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [sheetName, setSheetName] = useState("");
  const [sheetRows, setSheetRows] = useState([]);

  const handleOpenSheet = () => {
    if (fileRef.current) fileRef.current.click();
  };

  const handleFileChange = async (e) => {
    const f = e.target.files?.[0];
    if (!f) return;
    setSheetName(f.name);

    // Chỉ đọc văn bản (csv/tsv/txt). Nếu muốn .xlsx → gợi ý dùng SheetJS.
    if (/\.(csv|tsv|txt)$/i.test(f.name)) {
      const text = await f.text();
      const rows = parseDelimited(text);
      setSheetRows(rows);
      setSheetOpen(true);
    } else {
      // fallback: thông báo nhanh
      alert("Tạm thời chỉ hỗ trợ CSV/TSV/TXT. Vui lòng xuất file .csv hoặc .tsv.");
      e.target.value = ""; // reset
    }
  };

  const calc = useMemo(() => {
    const r = Math.max(0, parseNum(rate));
    const yenTotal = Math.max(0, parseNum(totalYen));

    const baseVND = yenTotal * r;
    const serviceFeeJPY = getServiceFeeJPY(yenTotal, qty);
    const serviceFeeVND = serviceFeeJPY * r;
    const priceVND = (yenTotal + serviceFeeJPY) * r;

    const sellerShipVND = Math.max(0, parseNum(sellerShipYen)) * r;
    const shipJVN = Math.max(0, parseNum(shipJPVN));
    const shipLocal = Math.max(0, parseNum(shipVN));
    const extra = Math.max(0, parseNum(surchargeVND));

    const total = priceVND + extra + sellerShipVND + shipJVN + shipLocal;

    const volWeight =
      (Math.max(0, parseNum(lenCm)) *
        Math.max(0, parseNum(widCm)) *
        Math.max(0, parseNum(heiCm))) /
      6000;

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
      <input
        ref={fileRef}
        type="file"
        accept=".csv,.tsv,.txt"
        className="hidden"
        onChange={handleFileChange}
      />

      <SheetModal open={sheetOpen} onClose={() => setSheetOpen(false)} name={sheetName} rows={sheetRows} />

      <div className="max-w-5xl mx-auto p-6 md:p-10">
        {/* 1) Thông tin sản phẩm */}
        <section className="relative bg-white rounded-2xl shadow-sm border p-5 md:p-6 mb-6 pb-4">
          <h2 className="text-base font-semibold mb-4 ">THÔNG TIN SẢN PHẨM</h2>

          <div className="absolute top-3 right-4 text-sm text-gray-600">
            <div className="text-center text-gray-600">
              <div className="text-xs">{new Date().toLocaleDateString("vi-VN")}</div>
              <div className="text-xs font-medium">{GEN.format(rate)} VND / 1¥</div>
            </div>
          </div>

          <div className="grid grid-cols-10 md:grid-cols-2 gap-4">
            <div className=" col-span-10 md:col-span-1">
              <Field label="Tổng đơn (¥)" required hint={"Bạn có thể làm phép cộng các đơn hàng ở ô này"}>
                <div className="text-xs text-gray-400 mb-1">~ {VND.format(calc.priceVND)}</div>
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
                    setTotalYen((prev) => (v === "" ? prev ?? 0 : v));
                  }}
                />
              </Field>
            </div>

            <div className="col-span-10 md:col-span-1">
              <Field label="SL" required hint="Trên 10 vui lòng liên hệ shop để đặt số lượng lớn.">
                <input
                  type="number"
                  min={1}
                  inputMode="numeric"
                  className={INPUT_BASE + "resize-none overflow-hidden text-base font-medium"}
                  value={qty}
                  onChange={(e) => setQty(Math.max(0, parseNum(e.target.value)))}
                />
                {qty > 10 && (
                  <div className="mt-1 text-xs text-red-600">Số lượng &gt; 10 — vui lòng liên hệ shop.</div>
                )}
              </Field>
            </div>

            <div className="col-span-10 md:col-span-1">
              <Field_grey
                label="Công mua"
                hint={"càng mua nhiều càng rẻ\n≤ 25,000¥: 1 đơn 500¥; 2–5 đơn 400¥/đơn; 6–10 đơn 300¥/đơn.\n> 25,000¥: 2%."}
              >
                <div className="flex items-baseline gap-2">
                  <div className="text-lg font-semibold">{VND.format(calc.serviceFeeVND)}</div>
                  <div className="text-xs text-gray-500">({GEN.format(calc.serviceFeeJPY)}¥)</div>
                </div>
              </Field_grey>
            </div>

            <div className="col-span-10 md:col-span-1">
              <Field_grey label="Giá VND (ước tính)" hint="(Tổng ¥ + Công mua ¥) × Tỷ giá. Chưa gồm ship/phụ thu.">
                <div className="text-lg font-semibold">{VND.format(calc.priceVND)}</div>
              </Field_grey>
            </div>
          </div>
        </section>

        {/* 2) Kích thước, phí ship */}
        <section className="bg-white rounded-2xl shadow-sm border p-5 md:p-6 mb-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold">PHÍ SHIP</h2>

            <div className="flex items-center gap-2">
              {/* Nút tải PDF phụ thu về máy khách */}
              <button
                type="button"
                onClick={handleOpenSurchargePDF}
                className="inline-flex items-center gap-2 px-3 py-2 rounded-xl border border-gray-300 hover:bg-gray-50 text-xs"
                title="Tải phu_thu.pdf về máy của khách"
              >
                Bảng phụ thu
              </button>
            </div>
          </div>

          {/* Hàng 1: Cân nặng + Khối lượng quy đổi */}
          <div className="mb-4 grid grid-cols-2 gap-4">
            {/* Cột 1: Cân nặng dự kiến */}
            <Field label="Cân nặng dự kiến (kg)" hint="Khối lượng thực tế ước tính của kiện hàng.">
              <div className="relative">
                <input
                  type="text"
                  inputMode="decimal"
                  className={INPUT_BASE + "text-sm w-full pr-10"}
                  placeholder="Nhập số"
                  value={weightKg ?? ""}
                  onChange={(e) => {
                    const v = e.target.value.replace(/[^\d.]/g, "");
                    setWeightKg(v);
                  }}
                  onBlur={() => {
                    if (weightKg !== "" && weightKg != null) {
                      setWeightKg(String(parseNum(weightKg)));
                    }
                  }}
                />
                <span className="pointer-events-none absolute right-0 top-1/2 -translate-y-1/2 text-sm text-gray-400">
                  kg
                </span>
              </div>
            </Field>

            {/* Cột 2: Khối lượng quy đổi */}
            <Field_grey
              label="Khối lượng quy đổi"
              hint="(L×W×H / 6000)"
            >
              <div className="relative ">
                <input
                  type="text"
                  readOnly
                  className={INPUT_BASE + " text-sm w-full pr-10"}
                  placeholder="L×W×H / 6000"
                  value={calc.volWeight ? GEN.format(calc.volWeight) : ""}
                />
                <span className="pointer-events-none absolute right-0 top-1/2 -translate-y-1/2 text-sm text-gray-400 ">
                  kg
                </span>
              </div>
            </Field_grey>
          </div>



          {/* Dài – Rộng – Cao */}
          <div className="mb-4">
            <div className="grid grid-cols-3 gap-4">
              <div className="min-w-0">
                <Field label="Dài" required hint="Chiều dài thùng sau khi đóng gói.">
                  <div className="relative">
                    <input
                      type="text"
                      inputMode="decimal"
                      className={INPUT_BASE + " w-full pr-10"}

                      value={lenCm ?? ""}
                      onChange={(e) => setLenCm(e.target.value.replace(/[^\d.]/g, ""))}
                      onBlur={() => {
                        if (lenCm !== "" && lenCm != null) setLenCm(String(parseNum(lenCm)));
                      }}
                    />
                    <span className="pointer-events-none absolute right-0 top-1/2 -translate-y-1/2 text-sm text-gray-400">cm</span>
                  </div>
                </Field>
              </div>
              
              <div className="min-w-0">
                <Field label="Rộng" required hint="Chiều rộng thùng sau khi đóng gói.">
                  <div className="relative">
                    <input
                      type="text"
                      inputMode="decimal"
                      className={INPUT_BASE + " w-full pr-10"}
                      value={widCm ?? ""}
                      onChange={(e) => setWidCm(e.target.value.replace(/[^\d.]/g, ""))}
                      onBlur={() => {
                        if (widCm !== "" && widCm != null) setWidCm(String(parseNum(widCm)));
                      }}
                    />
                    <span className="pointer-events-none absolute right-0 top-1/2 -translate-y-1/2 text-sm text-gray-400">cm</span>
                  </div>
                </Field>
              </div>
              <div className="min-w-0">
                <Field label="Cao" required hint="Chiều cao thùng sau khi đóng gói.">
                  <div className="relative">
                    <input
                      type="text"
                      inputMode="decimal"
                      className={INPUT_BASE + " w-full pr-10"}
                      value={heiCm ?? ""}
                      onChange={(e) => setHeiCm(e.target.value.replace(/[^\d.]/g, ""))}
                      onBlur={() => {
                        if (heiCm !== "" && heiCm != null) setHeiCm(String(parseNum(heiCm)));
                      }}
                    />
                    <span className="pointer-events-none absolute right-0 top-1/2 -translate-y-1/2 text-sm text-gray-400">cm</span>
                  </div>
                </Field>
              </div>
            </div>
          </div>

          {/* Các phí khác */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <Field label="Phí ship từ người bán (¥)" hint="Phí nội địa Nhật; sẽ quy đổi sang VND.">
                <input type="number" className={INPUT_BASE} value={sellerShipYen} onChange={(e) => setSellerShipYen(parseNum(e.target.value))} />
              </Field>
            </div>
            <div>
              <Field label="Phí ship Nhật–Việt (VND)" hint="Cước quốc tế Nhật → Việt Nam.">
                <input type="number" className={INPUT_BASE} value={shipJPVN} onChange={(e) => setShipJPVN(parseNum(e.target.value))} />
              </Field>
            </div>
            <div>
              <Field label="Phí ship nội địa Việt Nam (VND)" hint="Cước giao hàng trong nước.">
                <input type="number" className={INPUT_BASE} value={shipVN} onChange={(e) => setShipVN(parseNum(e.target.value))} />
              </Field>
            </div>
            <div className="md:col-span-3">
              <Field label="Phụ thu (VND)" required hint="Các khoản phát sinh thêm nếu có.">
                <input type="number" className={INPUT_BASE} value={surchargeVND} onChange={(e) => setSurchargeVND(parseNum(e.target.value))} />
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
          <h2 className="text-lg font-semibold mb-4">KẾT QUẢ</h2>
          <div className="space-y-2 text-sm">
            <div className="flex justify-between"><span> Tổng đơn</span><span>{VND.format(calc.baseVND)}</span></div>
            <div className="flex justify-between"><span> Công mua</span><span>{VND.format(calc.serviceFeeVND)} ({GEN.format(calc.serviceFeeJPY)}¥)</span></div>
            <div className="flex justify-between"><span> Phụ thu</span><span>{VND.format(calc.extra)}</span></div>
            <div className="flex justify-between"><span> Phí ship từ người bán (¥)</span><span>{GEN.format(parseNum(sellerShipYen))}¥ ({VND.format(calc.sellerShipVND)})</span></div>
            <div className="flex justify-between"><span> Phí ship Nhật–Việt</span><span>{VND.format(calc.shipJVN)}</span></div>
            <div className="flex justify-between"><span> Phí ship nội địa Việt Nam</span><span>{VND.format(calc.shipLocal)}</span></div>
          </div>
        </section>

        {/* 4) Tổng thanh toán */}
        <section className="bg-white rounded-2xl shadow-sm border p-5 md:p-6">
          <h2 className="text-lg font-semibold mb-4">TỔNG THANH TOÁN</h2>
          <div className="flex justify-between items-baseline">
            <div className="text-gray-900 font-semibold">TỔNG</div>
            <div className="text-2xl font-bold">{VND.format(calc.total)}</div>
          </div>
        </section>
      </div>
    </div>
  );
}
