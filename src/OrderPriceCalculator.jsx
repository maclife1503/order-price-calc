import React, { useEffect, useMemo, useRef, useState } from "react";

// == Currency / number formatters
const VND = new Intl.NumberFormat("vi-VN", { style: "currency", currency: "VND" });
const GEN = new Intl.NumberFormat("vi-VN");

function parseNum(v) {
  if (v === "" || v === null || v === undefined) return 0;
  const n = typeof v === "number" ? v : Number(String(v).replace(/,/g, "."));
  return Number.isFinite(n) ? n : 0;
}

// === Hàm tính công mua tự động
function getServiceFeeJPY(yenTotal, qty) {
  const y = Math.max(0, parseNum(yenTotal));
  const q = Math.max(1, parseNum(qty));

  if (y <= 25000) {
    if (q <= 1) return 500;
    if (q <= 5) return 400 * q;
    if (q <= 10) return 300 * q;
    return 300 * q;
  }
  return y * 0.02;
}

function formatDateForTitle(dateStr) {
  if (!dateStr) return "";
  const d = new Date(dateStr);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleDateString("vi-VN");
}

function slugFilePart(text) {
  return String(text || "")
    .trim()
    .replace(/[\\/:*?"<>|]+/g, "")
    .replace(/\s+/g, " ");
}

function buildDocumentTitle({ quoteDate, quoteNo, customerName }) {
  const datePart = formatDateForTitle(quoteDate) || new Date().toLocaleDateString("vi-VN");
  const noPart = quoteNo ? `bảng báo giá số ${slugFilePart(quoteNo)}` : "bảng báo giá";
  const customerPart = customerName ? `, ${slugFilePart(customerName)}` : "";
  return `${datePart} ${noPart}${customerPart}`;
}

function shortenUrlDisplay(raw) {
  try {
    const url = new URL(raw);
    const host = url.hostname.replace(/^www\./, "");
    const path = url.pathname.length > 24 ? `${url.pathname.slice(0, 24)}...` : url.pathname;
    return `${host}${path || ""}`;
  } catch {
    const text = String(raw || "").trim();
    return text.length > 40 ? `${text.slice(0, 40)}...` : text;
  }
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
        <span
          className="relative group inline-flex items-center justify-center
                         w-5 h-5 rounded-full border border-gray-300 text-gray-500 text-xs cursor-default select-none"
        >
          ?
          <span
            className="absolute z-10 hidden group-hover:block left-1/2 -translate-x-1/2
                           bottom-[calc(100%+8px)] whitespace-pre-line px-3 py-2 rounded-md text-xs text-gray-800 bg-white
                           border shadow-md w-max max-w-[260px]"
          >
            {hint}
            <span className="absolute -bottom-1 left-1/2 -translate-x-1/2 w-2 h-2 bg-white rotate-45 border-l border-b"></span>
          </span>
        </span>
      )}
    </div>
  );
}

function Field({ label, hint, required, children, className = "" }) {
  return (
    <div className={`flex flex-col h-full w-full ${className}`}>
      <InfoLabel label={label} hint={hint} required={required} />
      <div className="flex-1 rounded-xl border border-gray-200 px-4 py-3 bg-white flex flex-col justify-center w-full">
        {children}
      </div>
    </div>
  );
}

function Field_grey({ label, hint, required, children, className = "" }) {
  return (
    <div className={`flex flex-col h-full w-full ${className}`}>
      <InfoLabel label={label} hint={hint} required={required} />
      <div className="flex-1 rounded-xl border border-gray-200 px-4 py-3 bg-gray-100 flex flex-col justify-center w-full">
        {children}
      </div>
    </div>
  );
}

const INPUT_BASE =
  "w-full bg-transparent border-0 outline-none focus:ring-0 placeholder-gray-400 text-gray-900";

// === Modal hiển thị nội dung file bảng tính
function SheetModal({ open, onClose, name, rows }) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50">
      <div className="absolute inset-0 bg-black/30" onClick={onClose} />
      <div className="absolute inset-x-4 md:inset-x-10 lg:inset-x-20 top-10 bottom-10 bg-white rounded-2xl shadow-xl border p-4 md:p-6 overflow-hidden">
        <div className="flex items-center justify-between gap-4 mb-2">
          <h3 className="text-base md:text-lg font-semibold">
            Bảng tính phí ship & phụ thu {!name ? "" : `– ${name}`}
          </h3>
          <button onClick={onClose} className="px-3 py-1.5 rounded-lg border hover:bg-gray-50">
            Đóng
          </button>
        </div>
        <div className="h-full overflow-auto border rounded-xl">
          <table className="min-w-full text-sm">
            <tbody>
              {rows && rows.length > 0 ? (
                rows.map((r, i) => (
                  <tr key={i} className={i % 2 ? "bg-gray-50" : "bg-white"}>
                    {r.map((c, j) => (
                      <td key={j} className="px-3 py-2 border-b whitespace-pre">
                        {String(c)}
                      </td>
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

// === Parser CSV/TSV
function parseDelimited(text) {
  if (!text) return [];
  const useTab = (text.match(/\t/g) || []).length > (text.match(/,/g) || []).length;
  const sep = useTab ? "\t" : ",";
  const lines = text.replace(/\r\n/g, "\n").replace(/\r/g, "\n").split("\n");

  return lines.map((line) => {
    const cells = [];
    let cur = "";
    let inQuotes = false;

    for (let i = 0; i < line.length; i++) {
      const ch = line[i];
      if (ch === '"') {
        if (inQuotes && line[i + 1] === '"') {
          cur += '"';
          i++;
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

const PDF_SURCHARGE_PATH = "/data/phu_thu.pdf";

async function handleOpenSurchargePDF() {
  window.open(PDF_SURCHARGE_PATH, "_blank", "noopener,noreferrer");
}

export default function OrderPriceCalculator() {
  // ===== 0) Thông tin báo giá / khách hàng
  const [quoteDate, setQuoteDate] = useState(() => {
    const d = new Date();
    const yyyy = d.getFullYear();
    const mm = String(d.getMonth() + 1).padStart(2, "0");
    const dd = String(d.getDate()).padStart(2, "0");
    return `${yyyy}-${mm}-${dd}`;
  });
  const [quoteNo, setQuoteNo] = useState(() => {
    const d = new Date();
    const yy = String(d.getFullYear()).slice(-2);
    const mm = String(d.getMonth() + 1).padStart(2, "0");
    const dd = String(d.getDate()).padStart(2, "0");
    const hh = String(d.getHours()).padStart(2, "0");
    const min = String(d.getMinutes()).padStart(2, "0");
    const ss = String(d.getSeconds()).padStart(2, "0");
    return `${yy}${mm}${dd}${hh}${min}${ss}`;
  });
  const [customerName, setCustomerName] = useState("");

  // ===== 1) Thông tin sản phẩm và Tỉ giá
  const [rate, setRate] = useState(() => {
    try {
      const cached = localStorage.getItem("order_calc_rate");
      return cached ? JSON.parse(cached).rate : 180;
    } catch (e) {
      return 180;
    }
  });
  const [lastFetched, setLastFetched] = useState(() => {
    try {
      const cached = localStorage.getItem("order_calc_rate");
      return cached ? JSON.parse(cached).timestamp : null;
    } catch (e) {
      return null;
    }
  });

  const [isFetchingRate, setIsFetchingRate] = useState(false);
  const CURRENCY_API_KEY = "cur_live_jun4pGkxNiwPm22TQtjO8G29mE4N0GTG2sIEhtlv";

  const fetchLatestRate = async (force = false) => {
    if (!CURRENCY_API_KEY) return;

    const now = Date.now();
    // Chỉ tự động fetch nếu dữ liệu cũ hơn 12 tiếng
    if (!force && lastFetched && now - lastFetched < 12 * 60 * 60 * 1000) {
      return;
    }

    setIsFetchingRate(true);
    try {
      const res = await fetch(
        `https://api.currencyapi.com/v3/latest?apikey=${CURRENCY_API_KEY}&currencies=VND&base_currency=JPY`
      );
      const json = await res.json();
      if (json.data && json.data.VND) {
        const rawRate = json.data.VND.value;
        const finalRate = Math.round(rawRate) + 10; // +10 như yêu cầu
        setRate(finalRate);
        setLastFetched(now);
        localStorage.setItem(
          "order_calc_rate",
          JSON.stringify({ rate: finalRate, timestamp: now })
        );
      }
    } catch (error) {
      console.error("Lỗi cập nhật tỉ giá:", error);
      if (force) alert("Không thể lấy tỉ giá mới. Vui lòng thử lại sau.");
    } finally {
      setIsFetchingRate(false);
    }
  };

  useEffect(() => {
    fetchLatestRate();
  }, []);
  const [totalYen, setTotalYen] = useState(0);
  const [qty, setQty] = useState(1);
  const [totalYenInput, setTotalYenInput] = useState("");

  // Công mua: auto / manual
  const [serviceFeeMode, setServiceFeeMode] = useState("auto");
  const [manualServiceFeeJPY, setManualServiceFeeJPY] = useState("");

  // Link sản phẩm
  const [productLinkInput, setProductLinkInput] = useState("");
  const [productLinks, setProductLinks] = useState([]);

  // ===== 2) Kích thước, phí ship
  const [weightKg, setWeightKg] = useState("");
  const [lenCm, setLenCm] = useState("");
  const [widCm, setWidCm] = useState("");
  const [heiCm, setHeiCm] = useState("");
  const [sellerShipYen, setSellerShipYen] = useState(0);
  const [shipJPVN, setShipJPVN] = useState(0);
  const [shipVN, setShipVN] = useState(0);
  const [surchargeVND, setSurchargeVND] = useState(0);

  // ===== 3) Cọc
  const [isDeposited, setIsDeposited] = useState(false);
  const [depositAmount, setDepositAmount] = useState(0);

  const evalExpr = (s) => {
    const safe = (s || "").replace(/[^0-9+\-*/().]/g, "");
    if (!safe) return "";
    try {
      const v = Function('"use strict";return(' + safe + ")")();
      return Number.isFinite(v) ? v : "";
    } catch {
      return "";
    }
  };

  useEffect(() => {
    const w = parseNum(weightKg);
    if (w > 0) {
      setShipJPVN(w * 190000);
    } else {
      setShipJPVN(0);
    }
  }, [weightKg]);

  useEffect(() => {
    const nextTitle = buildDocumentTitle({ quoteDate, quoteNo, customerName });
    document.title = nextTitle;
  }, [quoteDate, quoteNo, customerName]);

  // === State cho modal sheet
  const fileRef = useRef(null);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [sheetName, setSheetName] = useState("");
  const [sheetRows, setSheetRows] = useState([]);

  const handlePrint = () => {
    window.print();
  };

  const handleOpenSheet = () => {
    if (fileRef.current) fileRef.current.click();
  };

  const handleFileChange = async (e) => {
    const f = e.target.files?.[0];
    if (!f) return;
    setSheetName(f.name);

    if (/\.(csv|tsv|txt)$/i.test(f.name)) {
      const text = await f.text();
      const rows = parseDelimited(text);
      setSheetRows(rows);
      setSheetOpen(true);
    } else {
      alert("Tạm thời chỉ hỗ trợ CSV/TSV/TXT. Vui lòng xuất file .csv hoặc .tsv.");
      e.target.value = "";
    }
  };

  const addProductLink = async () => {
    const raw = String(productLinkInput || "").trim();
    if (!raw) return;

    const normalized = /^https?:\/\//i.test(raw) ? raw : `https://${raw}`;
    const newId = crypto.randomUUID();

    setProductLinks((prev) => {
      const existed = prev.some((item) => item.url === normalized);
      if (existed) return prev;

      return [
        ...prev,
        {
          id: newId,
          url: normalized,
          shortText: shortenUrlDisplay(normalized),
          priceYen: "",
          shipYen: "",
          imageUrl: "",
          isLoading: true,
        },
      ];
    });

    setProductLinkInput("");

    try {
      // Sử dụng proxy nội bộ thay vì Microlink
      const proxyBase = window.location.hostname === "localhost"
        ? "https://order-jp.netlify.app/.netlify/functions/get-metadata"
        : "/.netlify/functions/get-metadata";

      const res = await fetch(`${proxyBase}?url=${encodeURIComponent(normalized)}`);
      const json = await res.json();

      if (json && !json.error) {
        if (json.image) updateProductLink(newId, "imageUrl", json.image);
        if (json.title) updateProductLink(newId, "shortText", json.title);
      }
    } catch (err) {
      console.error("Scraper error:", err);
    } finally {
      updateProductLink(newId, "isLoading", false);
    }
  };

  const removeProductLink = (id) => {
    setProductLinks((prev) => prev.filter((item) => item.id !== id));
  };

  const updateProductLink = (id, field, value) => {
    setProductLinks((prev) =>
      prev.map((item) => (item.id === id ? { ...item, [field]: value } : item))
    );
  };

  useEffect(() => {
    if (productLinks.length > 0) {
      const pYen = productLinks.reduce((acc, item) => acc + Math.max(0, parseNum(item.priceYen)), 0);
      const sYen = productLinks.reduce((acc, item) => acc + Math.max(0, parseNum(item.shipYen)), 0);

      setTotalYenInput(String(pYen));
      setTotalYen(pYen);
      setSellerShipYen(sYen);
      setQty(productLinks.length);
    }
  }, [productLinks]);

  const calc = useMemo(() => {
    const r = Math.max(0, parseNum(rate));
    const yenTotal = Math.max(0, parseNum(totalYen));

    const baseVND = yenTotal * r;

    const autoServiceFeeJPY = getServiceFeeJPY(yenTotal, qty);
    const serviceFeeJPY =
      serviceFeeMode === "manual"
        ? Math.max(0, parseNum(manualServiceFeeJPY))
        : autoServiceFeeJPY;

    const serviceFeeVND = serviceFeeJPY * r;

    const sellerShipVND = Math.max(0, parseNum(sellerShipYen)) * r;
    const shipJVN = Math.max(0, parseNum(shipJPVN));
    const shipLocal = Math.max(0, parseNum(shipVN));
    const extra = Math.max(0, parseNum(surchargeVND));
    const deposited = isDeposited ? Math.max(0, parseNum(depositAmount)) : 0;

    // Giá hàng ước tính = giá SP + công mua + ship từ người bán
    const estimatedGoodsVND = baseVND + serviceFeeVND + sellerShipVND;

    // Tổng cuối cùng khi đã có đủ ship Nhật-Việt + ship nội địa VN + phụ thu
    const finalTotal = estimatedGoodsVND + shipJVN + shipLocal + extra;

    const remainingPayment = Math.max(0, finalTotal - deposited);

    const volWeight =
      (Math.max(0, parseNum(lenCm)) *
        Math.max(0, parseNum(widCm)) *
        Math.max(0, parseNum(heiCm))) /
      6000;

    return {
      r,
      yenTotal,
      qty: Math.max(0, parseNum(qty)),
      baseVND,
      autoServiceFeeJPY,
      serviceFeeJPY,
      serviceFeeVND,
      sellerShipVND,
      shipJVN,
      shipLocal,
      extra,
      estimatedGoodsVND,
      finalTotal,
      deposited,
      remainingPayment,
      weightKg: Math.max(0, parseNum(weightKg)),
      volWeight,
    };
  }, [
    rate,
    totalYen,
    qty,
    serviceFeeMode,
    manualServiceFeeJPY,
    sellerShipYen,
    shipJPVN,
    shipVN,
    surchargeVND,
    lenCm,
    widCm,
    heiCm,
    weightKg,
    isDeposited,
    depositAmount,
  ]);

  return (
    <div className="min-h-screen w-full bg-gradient-to-b from-white to-gray-50 text-gray-900 pb-10">
      {/* Thanh Tỉ giá nổi bật ở đầu trang */}
      <div className="bg-indigo-600 text-white py-2.5 px-4 shadow-md sticky top-0 z-[60]">
        <div className="max-w-5xl mx-auto flex flex-wrap justify-between items-center gap-2">
          <div className="flex items-center gap-3">
            <div className="bg-white/20 p-1 rounded-md">
              <svg className="w-4 h-4 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
              </svg>
            </div>
            <div className="flex flex-col sm:flex-row sm:items-baseline sm:gap-2">
              <span className="text-[10px] uppercase tracking-widest opacity-80 font-bold">Tỷ giá hôm nay:</span>
              <div className="flex items-baseline gap-1">
                <span className="text-lg font-bold tracking-tight">{GEN.format(rate)}</span>
                <span className="text-xs opacity-90 font-medium text-indigo-100">đ / 1¥</span>
              </div>
            </div>
          </div>
          {lastFetched && (
            <div className="flex items-center gap-2">
              <div className="text-right">
                <div className="text-[9px] opacity-70 uppercase leading-none">Cập nhật lần cuối</div>
                <div className="text-[10px] font-medium text-indigo-100">
                  {new Date(lastFetched).toLocaleString("vi-VN", { hour: '2-digit', minute: '2-digit', day: '2-digit', month: '2-digit' })}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
      <input
        ref={fileRef}
        type="file"
        accept=".csv,.tsv,.txt"
        className="hidden"
        onChange={handleFileChange}
      />

      <SheetModal
        open={sheetOpen}
        onClose={() => setSheetOpen(false)}
        name={sheetName}
        rows={sheetRows}
      />

      <div className="max-w-5xl mx-auto p-6 md:p-10 print:hidden">
        <div className="flex justify-end mb-4">
          <button
            type="button"
            onClick={handlePrint}
            className="px-3 py-2 rounded-xl border border-gray-300 text-sm hover:bg-gray-50"
          >
            In / Lưu PDF
          </button>
        </div>

        {/* THÔNG TIN BÁO GIÁ */}
        <section className="bg-white rounded-2xl shadow-sm border p-5 md:p-6 mb-6">
          <h2 className="text-base font-semibold mb-4">THÔNG TIN BÁO GIÁ</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Field label="Ngày báo giá" required>
              <input
                type="date"
                className={INPUT_BASE}
                value={quoteDate}
                onChange={(e) => setQuoteDate(e.target.value)}
              />
            </Field>

            <Field label="Số báo giá">
              <input
                type="text"
                className={INPUT_BASE}
                placeholder="VD: BG001"
                value={quoteNo}
                onChange={(e) => setQuoteNo(e.target.value)}
              />
            </Field>

            <Field label="Tên khách">
              <input
                type="text"
                className={INPUT_BASE}
                placeholder="Nhập tên khách"
                value={customerName}
                onChange={(e) => setCustomerName(e.target.value)}
              />
            </Field>

            <Field label="Tỉ giá (đ / 1¥)">
              <div className="relative">
                <input
                  type="number"
                  className={INPUT_BASE}
                  placeholder="VD: 180"
                  value={rate}
                  onChange={(e) => setRate(parseNum(e.target.value))}
                />
              </div>
            </Field>
          </div>
        </section>

        {/* THÔNG TIN SẢN PHẨM */}
        <section className="relative bg-white rounded-2xl shadow-sm border p-5 md:p-6 mb-6 pb-4">
          <h2 className="text-base font-semibold mb-2">THÔNG TIN SẢN PHẨM</h2>

          <div className="absolute top-3 right-4 text-sm text-gray-600">
            <div className="text-center text-gray-600">
              <div className="text-xs">{new Date().toLocaleDateString("vi-VN")}</div>
              <div className="text-xs font-medium">{GEN.format(rate)} đ / 1¥</div>
            </div>
          </div>

          {/* Link sản phẩm */}
          <div className="mb-4">
            <Field label="Link sản phẩm" hint="Nhập link rồi bấm thêm. Link sẽ hiển thị dạng rút gọn.">
              <div className="flex flex-col gap-3">
                <div className="flex gap-2">
                  <input
                    type="text"
                    className={INPUT_BASE}
                    placeholder="Dán link sản phẩm vào đây"
                    value={productLinkInput}
                    onChange={(e) => setProductLinkInput(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        e.preventDefault();
                        addProductLink();
                      }
                    }}
                  />
                  <button
                    type="button"
                    onClick={addProductLink}
                    className="shrink-0 px-3 py-2 rounded-lg border border-gray-300 hover:bg-gray-50 text-sm"
                  >
                    Thêm
                  </button>
                </div>

                {productLinks.length > 0 && (
                  <div className="space-y-2">
                    {productLinks.map((item, idx) => (
                      <div
                        key={item.id}
                        className="flex items-start justify-between gap-3 rounded-xl border border-gray-200 px-3 py-2"
                      >
                        <div className="min-w-0 flex-1 text-sm">
                          <div className="font-medium text-gray-700 mb-1">
                            Link sản phẩm {idx + 1}
                          </div>
                          <a
                            href={item.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-blue-600 hover:underline break-all block mb-2"
                          >
                            {item.shortText}
                          </a>
                          <div className="flex flex-col sm:flex-row sm:items-center gap-3 sm:gap-6 mt-3">
                            <div className="flex items-center gap-2 border-b border-gray-200 pb-1">
                              <span className="text-gray-500 text-xs whitespace-nowrap">Giá ¥:</span>
                              <input
                                type="number"
                                className="w-full sm:w-24 bg-transparent outline-none text-sm font-medium text-gray-900"
                                value={item.priceYen}
                                onChange={(e) => updateProductLink(item.id, "priceYen", e.target.value)}
                              />
                            </div>
                            <div className="flex items-center gap-2 border-b border-gray-200 pb-1">
                              <span className="text-gray-500 text-xs whitespace-nowrap">Ship ¥:</span>
                              <input
                                type="number"
                                className="w-full sm:w-24 bg-transparent outline-none text-sm font-medium text-gray-900"
                                value={item.shipYen}
                                onChange={(e) => updateProductLink(item.id, "shipYen", e.target.value)}
                              />
                            </div>
                          </div>
                        </div>

                        <button
                          type="button"
                          onClick={() => removeProductLink(item.id)}
                          className="shrink-0 px-3 py-1.5 rounded-lg border border-red-200 text-red-600 hover:bg-red-50 text-sm"
                        >
                          Xóa
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </Field>
          </div>

          <div className="grid grid-cols-10 md:grid-cols-2 gap-4">
            <div className="col-span-10 md:col-span-1">
              <Field
                label="Tổng đơn"
                required
                hint="Bạn có thể làm phép cộng các đơn hàng ở ô này"
              >
                <div className="text-xs text-gray-400 mb-1">~ {VND.format(calc.baseVND)}</div>

                <div className="relative">
                  <textarea
                    rows={1}
                    inputMode="text"
                    pattern="[0-9+\-*/().]*"
                    className={INPUT_BASE + " resize-none overflow-hidden text-base font-medium pr-8"}
                    placeholder="vd: 1000+500*2"
                    value={totalYenInput}
                    onChange={(e) => {
                      e.target.style.height = "auto";
                      e.target.style.height = e.target.scrollHeight + "px";
                      const raw = e.target.value.replace(/^0+(?=\d)/, "");
                      setTotalYenInput(raw);
                      const v = evalExpr(raw);
                      setTotalYen(v === "" ? 0 : v);
                    }}
                  />
                  <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-sm text-gray-400">
                    ¥
                  </span>
                </div>
              </Field>
            </div>

            <div className="col-span-10 md:col-span-1">
              <Field label="SL" required hint="Trên 10 vui lòng liên hệ shop để đặt số lượng lớn.">
                <input
                  type="number"
                  min={1}
                  inputMode="numeric"
                  className={INPUT_BASE + " resize-none overflow-hidden text-base font-medium"}
                  value={qty}
                  onChange={(e) => setQty(Math.max(0, parseNum(e.target.value)))}
                />
                {qty > 10 && (
                  <div className="mt-1 text-xs text-red-600">Số lượng &gt; 10 — vui lòng liên hệ shop.</div>
                )}
              </Field>
            </div>

            <div className="col-span-10 md:col-span-1">
              <Field label="Phí ship từ người bán (¥)" hint="Phí nội địa Nhật; sẽ quy đổi sang VND.">
                <div className="relative">
                  <input
                    type="number"
                    className={INPUT_BASE + " pr-10"}
                    value={sellerShipYen}
                    onChange={(e) => setSellerShipYen(parseNum(e.target.value))}
                  />
                  <span className="pointer-events-none absolute right-0 top-1/2 -translate-y-1/2 text-sm text-gray-400">
                    ¥
                  </span>
                </div>
              </Field>
            </div>

            <div className="col-span-10 md:col-span-1">
              <Field_grey
                label="Công mua"
                hint={"Có thể để tự động hoặc chỉnh tay.\n≤ 25,000¥: 1 đơn 500¥; 2–5 đơn 400¥/đơn; 6–10 đơn 300¥/đơn.\n> 25,000¥: 2%."}
              >
                <div className="flex flex-col gap-3">
                  <div className="flex flex-wrap items-center gap-3">
                    <label className="inline-flex items-center gap-2 text-sm">
                      <input
                        type="radio"
                        name="serviceFeeMode"
                        checked={serviceFeeMode === "auto"}
                        onChange={() => setServiceFeeMode("auto")}
                      />
                      Tự động
                    </label>
                    <label className="inline-flex items-center gap-2 text-sm">
                      <input
                        type="radio"
                        name="serviceFeeMode"
                        checked={serviceFeeMode === "manual"}
                        onChange={() => setServiceFeeMode("manual")}
                      />
                      Tự chỉnh
                    </label>
                  </div>

                  {serviceFeeMode === "manual" ? (
                    <div className="relative">
                      <input
                        type="number"
                        className={INPUT_BASE + " pr-8"}
                        value={manualServiceFeeJPY}
                        onChange={(e) => setManualServiceFeeJPY(e.target.value)}
                        placeholder="Nhập công mua"
                      />
                      <span className="pointer-events-none absolute right-0 top-1/2 -translate-y-1/2 text-sm text-gray-400">
                        ¥
                      </span>
                    </div>
                  ) : (
                    <div className="text-sm text-gray-500">
                      Tự động: {GEN.format(calc.autoServiceFeeJPY)}¥
                    </div>
                  )}

                  <div className="flex items-baseline gap-2">
                    <div className="text-lg font-semibold">{VND.format(calc.serviceFeeVND)}</div>
                    <div className="text-xs text-gray-500">({GEN.format(calc.serviceFeeJPY)}¥)</div>
                  </div>
                </div>
              </Field_grey>
            </div>

            <div className="col-span-10 md:col-span-1">
              <Field_grey
                label="Giá VND (ước tính)"
                hint="Giá sản phẩm + công mua + phí ship từ người bán. Chưa gồm ship Nhật-Việt và ship nội địa Việt Nam."
              >
                <div className="text-lg font-semibold">{VND.format(calc.estimatedGoodsVND)}</div>
              </Field_grey>
            </div>
          </div>
        </section>

        {/* PHÍ SHIP */}
        <section className="bg-white rounded-2xl shadow-sm border p-5 md:p-6 mb-6">
          <div className="flex items-center justify-between mb-2">
            <h2 className="text-lg font-semibold">PHÍ SHIP</h2>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={handleOpenSurchargePDF}
                className="inline-flex items-center gap-2 px-3 py-2 rounded-xl border border-gray-300 hover:bg-gray-50 text-xs"
                title="Mở bảng phụ thu"
              >
                Bảng phụ thu
              </button>

              <button
                type="button"
                onClick={handleOpenSheet}
                className="inline-flex items-center gap-2 px-3 py-2 rounded-xl border border-gray-300 hover:bg-gray-50 text-xs"
                title="Mở file CSV/TSV/TXT để xem"
              >
                Mở bảng tính
              </button>
            </div>
          </div>

          <div className="grid md:grid-cols-2 gap-4 mb-2">
            <div>
              <Field label="Phụ thu (VND)" hint="Các khoản phát sinh thêm nếu có.">
                <div className="relative">
                  <input
                    type="number"
                    className={INPUT_BASE + " pr-12"}
                    value={surchargeVND}
                    onChange={(e) => setSurchargeVND(parseNum(e.target.value))}
                  />
                  <span className="pointer-events-none absolute right-0 top-1/2 -translate-y-1/2 text-sm text-gray-400">
                    đ
                  </span>
                </div>
              </Field>
            </div>
          </div>

          <div className="mb-2 grid grid-cols-2 gap-4">
            <Field
              label="Cân nặng dự kiến"
              required
              hint="Khối lượng thực tế ước tính của kiện hàng. Thường gần bằng với khối lượng quy đổi."
            >
              <div className="relative">
                <input
                  type="text"
                  inputMode="decimal"
                  className={INPUT_BASE + " text-sm w-full pr-10"}
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

            <Field_grey label="Khối lượng quy đổi" hint="Quy đổi từ thể tích hộp">
              <div className="relative">
                <input
                  type="text"
                  readOnly
                  className={INPUT_BASE + " text-sm w-full pr-10"}
                  placeholder="L×W×H / 6000"
                  value={calc.volWeight ? GEN.format(calc.volWeight) : ""}
                />
                <span className="pointer-events-none absolute right-0 top-1/2 -translate-y-1/2 text-sm text-gray-400">
                  kg
                </span>
              </div>
            </Field_grey>
          </div>

          <div className="mb-2">
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
                    <span className="pointer-events-none absolute right-0 top-1/2 -translate-y-1/2 text-sm text-gray-400">
                      cm
                    </span>
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
                    <span className="pointer-events-none absolute right-0 top-1/2 -translate-y-1/2 text-sm text-gray-400">
                      cm
                    </span>
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
                    <span className="pointer-events-none absolute right-0 top-1/2 -translate-y-1/2 text-sm text-gray-400">
                      cm
                    </span>
                  </div>
                </Field>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <Field label="Phí ship Nhật–Việt" hint="Cước quốc tế Nhật → Việt Nam.">
                <div className="relative">
                  <input
                    type="number"
                    className={INPUT_BASE + " pr-12"}
                    value={shipJPVN}
                    onChange={(e) => setShipJPVN(parseNum(e.target.value))}
                  />
                  <span className="pointer-events-none absolute right-0 top-1/2 -translate-y-1/2 text-sm text-gray-400">
                    đ
                  </span>
                </div>
              </Field>
            </div>

            <div>
              <Field label="Phí ship nội địa Việt Nam" hint="Thanh toán khi nhận hàng">
                <div className="relative">
                  <input
                    type="number"
                    className={INPUT_BASE + " pr-12"}
                    value={shipVN}
                    onChange={(e) => setShipVN(parseNum(e.target.value))}
                  />
                  <span className="pointer-events-none absolute right-0 top-1/2 -translate-y-1/2 text-sm text-gray-400">
                    đ
                  </span>
                </div>
              </Field>
            </div>
          </div>
        </section>

        {/* CỌC */}
        <section className="bg-white rounded-2xl shadow-sm border p-5 md:p-6 mb-6">
          <h2 className="text-lg font-semibold mb-3">THÔNG TIN CỌC</h2>

          <div className="flex flex-col gap-4">
            <label className="inline-flex items-center gap-2 text-sm font-medium text-gray-800">
              <input
                type="checkbox"
                checked={isDeposited}
                onChange={(e) => setIsDeposited(e.target.checked)}
              />
              Đã cọc
            </label>

            {isDeposited && (
              <div className="max-w-md">
                <Field label="Số tiền đã cọc (VND)">
                  <div className="relative">
                    <input
                      type="number"
                      className={INPUT_BASE + " pr-12"}
                      value={depositAmount}
                      onChange={(e) => setDepositAmount(parseNum(e.target.value))}
                    />
                    <span className="pointer-events-none absolute right-0 top-1/2 -translate-y-1/2 text-sm text-gray-400">
                      đ
                    </span>
                  </div>
                </Field>
              </div>
            )}
          </div>
        </section>

        {/* KẾT QUẢ */}
        <section className="bg-white rounded-2xl shadow-sm border p-5 md:p-6 mb-6">
          <h2 className="text-lg font-semibold mb-2">KẾT QUẢ</h2>

          <div className="mb-3 rounded-xl bg-amber-50 border border-amber-200 px-4 py-3 text-sm text-amber-900">
            Vui lòng cọc giá hàng ước tính, giá trên đây chưa bao gồm phí ship Nhật-Việt và phí ship nội địa Việt Nam.
          </div>

          <div className="space-y-2 text-sm">
            <div className="flex justify-between">
              <span>Tổng đơn</span>
              <span>{VND.format(calc.baseVND)}</span>
            </div>

            <div className="flex justify-between">
              <span>Công mua</span>
              <span>
                {VND.format(calc.serviceFeeVND)} ({GEN.format(calc.serviceFeeJPY)}¥)
              </span>
            </div>

            <div className="flex justify-between">
              <span>Phí ship từ người bán (¥)</span>
              <span>
                {GEN.format(parseNum(sellerShipYen))}¥ ({VND.format(calc.sellerShipVND)})
              </span>
            </div>

            <div className="flex justify-between font-semibold border-t pt-2">
              <span>Giá VND (ước tính)</span>
              <span>{VND.format(calc.estimatedGoodsVND)}</span>
            </div>

            <div className="flex justify-between">
              <span>Phí ship Nhật–Việt</span>
              <span>{VND.format(calc.shipJVN)}</span>
            </div>

            <div className="flex justify-between">
              <span>Phí ship nội địa Việt Nam</span>
              <span>{VND.format(calc.shipLocal)}</span>
            </div>

            <div className="flex justify-between">
              <span>Phụ thu</span>
              <span>{VND.format(calc.extra)}</span>
            </div>

            {isDeposited && (
              <div className="flex justify-between text-green-700">
                <span>Đã cọc</span>
                <span>- {VND.format(calc.deposited)}</span>
              </div>
            )}
          </div>
        </section>

        {/* TỔNG THANH TOÁN */}
        <section className="bg-white rounded-2xl shadow-sm border p-5 md:p-6">
          <h2 className="text-lg font-semibold mb-4">TỔNG THANH TOÁN</h2>

          <div className="space-y-3">
            <div className="flex justify-between items-baseline">
              <div className="text-gray-900 font-semibold">Tổng cuối cùng</div>
              <div className="text-2xl font-bold">{VND.format(calc.finalTotal)}</div>
            </div>

            {isDeposited && (
              <div className="flex justify-between items-baseline border-t pt-3">
                <div className="text-gray-900 font-semibold">Còn lại cần thanh toán</div>
                <div className="text-xl font-bold text-red-600">{VND.format(calc.remainingPayment)}</div>
              </div>
            )}
          </div>
        </section>
      </div>

      {/* GIAO DIỆN IN PDF (DẠNG BẢNG EXCEL) */}
      <div className="hidden print:block w-full max-w-4xl mx-auto p-8 text-black bg-white">
        <div className="mb-6">
          <h1 className="text-2xl font-bold uppercase mb-4 tracking-wide border-b-2 border-gray-800 pb-2">
            Bảng Báo Giá / Hoá Đơn
          </h1>
          <div className="grid grid-cols-2 gap-4 text-sm mt-4">
            <div>
              <p><span className="font-semibold w-24 inline-block">Khách hàng:</span> {customerName || ".........................................."}</p>
              <p><span className="font-semibold w-24 inline-block">Ngày báo giá:</span> {quoteDate}</p>
              {(weightKg > 0 || lenCm || widCm || heiCm) && (
                <p>
                  <span className="font-semibold w-24 inline-block">Trọng lượng:</span>
                  {weightKg ? `${weightKg} kg` : "..."}
                </p>
              )}
            </div>
            <div>
              <p><span className="font-semibold w-24 inline-block">Số báo giá:</span> {quoteNo}</p>
              <p><span className="font-semibold w-24 inline-block">Tỷ giá:</span> {GEN.format(rate)} đ / 1¥</p>
              {(weightKg > 0 || lenCm || widCm || heiCm) && (
                <p>
                  <span className="font-semibold w-24 inline-block">Kích thước:</span>
                  {(lenCm || widCm || heiCm) ? `${lenCm || 0} x ${widCm || 0} x ${heiCm || 0} cm` : "..."}
                  {calc.volWeight > 0 && ` (Thể tích: ${GEN.format(calc.volWeight)}kg)`}
                </p>
              )}
            </div>
          </div>
        </div>

        <table className="w-full text-sm border-collapse border border-gray-800">
          <thead>
            <tr className="bg-gray-100">
              <th className="border border-gray-800 p-2 pl-3 text-center font-semibold w-12">STT</th>
              <th className="border border-gray-800 p-2 text-left font-semibold whitespace-nowrap">Nội dung</th>
              <th className="border border-gray-800 p-2 text-center font-semibold w-24">SL</th>
              <th className="border border-gray-800 p-2 text-right font-semibold w-36">
                Thành tiền <br /> (¥)
              </th>
              <th className="border border-gray-800 p-2 pr-3 text-right font-semibold w-36">
                Thành tiền <br /> (VNĐ)
              </th>
              <th className="border border-gray-800 p-2 text-left font-semibold w-32">Ghi chú</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td className="border border-gray-800 p-2 text-center">1</td>
              <td className="border border-gray-800 p-2 whitespace-nowrap">Tổng đơn</td>
              <td className="border border-gray-800 p-2 text-center">{qty} Đơn</td>
              <td className="border border-gray-800 p-2 text-right">{GEN.format(calc.yenTotal)}</td>
              <td className="border border-gray-800 p-2 pr-3 text-right font-medium">{VND.format(calc.baseVND)}</td>
              <td className="border border-gray-800 p-2 text-xs text-gray-600"></td>
            </tr>
            <tr>
              <td className="border border-gray-800 p-2 text-center">2</td>
              <td className="border border-gray-800 p-2 whitespace-nowrap">Công mua</td>
              <td className="border border-gray-800 p-2 text-center">-</td>
              <td className="border border-gray-800 p-2 text-right">{GEN.format(calc.serviceFeeJPY)}</td>
              <td className="border border-gray-800 p-2 pr-3 text-right font-medium">{VND.format(calc.serviceFeeVND)}</td>
              <td className="border border-gray-800 p-2 text-xs text-gray-600"></td>
            </tr>
            <tr>
              <td className="border border-gray-800 p-2 text-center">3</td>
              <td className="border border-gray-800 p-2 whitespace-nowrap">Phí ship nội địa Nhật</td>
              <td className="border border-gray-800 p-2 text-center">-</td>
              <td className="border border-gray-800 p-2 text-right">{GEN.format(parseNum(sellerShipYen))}</td>
              <td className="border border-gray-800 p-2 pr-3 text-right font-medium">{VND.format(calc.sellerShipVND)}</td>
              <td className="border border-gray-800 p-2 text-xs text-gray-600"></td>
            </tr>
            <tr className="bg-amber-50">
              <td colSpan={3} className="border border-gray-800 p-2 pr-4 text-right font-semibold whitespace-nowrap">
                GIÁ VND (ƯỚC TÍNH TẠI NHẬT)
              </td>
              <td className="border border-gray-800 p-2 text-right bg-gray-50">-</td>
              <td className="border border-gray-800 p-2 pr-3 text-right font-bold text-amber-900">{VND.format(calc.estimatedGoodsVND)}</td>
              <td className="border border-gray-800 p-2 text-xs text-gray-600 text-amber-900">1 + 2 + 3</td>
            </tr>
            <tr>
              <td className="border border-gray-800 p-2 text-center">4</td>
              <td className="border border-gray-800 p-2 whitespace-nowrap">Vận chuyển Nhật - Việt</td>
              <td className="border border-gray-800 p-2 text-center">{weightKg > 0 ? `${weightKg} Kg` : "-"}</td>
              <td className="border border-gray-800 p-2 text-right bg-gray-50">-</td>
              <td className="border border-gray-800 p-2 pr-3 text-right font-medium">{VND.format(calc.shipJVN)}</td>
              <td className="border border-gray-800 p-2 text-xs text-gray-600">190k/kg</td>
            </tr>
            <tr>
              <td className="border border-gray-800 p-2 text-center">5</td>
              <td className="border border-gray-800 p-2 whitespace-nowrap">Giao hàng nội địa Việt Nam</td>
              <td className="border border-gray-800 p-2 text-center">-</td>
              <td className="border border-gray-800 p-2 text-right bg-gray-50">-</td>
              <td className="border border-gray-800 p-2 pr-3 text-right font-medium">{VND.format(calc.shipLocal)}</td>
              <td className="border border-gray-800 p-2 text-xs text-gray-600"></td>
            </tr>
            <tr>
              <td className="border border-gray-800 p-2 text-center">6</td>
              <td className="border border-gray-800 p-2 whitespace-nowrap">Phụ thu khác</td>
              <td className="border border-gray-800 p-2 text-center">-</td>
              <td className="border border-gray-800 p-2 text-right bg-gray-50">-</td>
              <td className="border border-gray-800 p-2 pr-3 text-right font-medium">{VND.format(calc.extra)}</td>
              <td className="border border-gray-800 p-2 text-xs text-gray-600"></td>
            </tr>
          </tbody>
          <tfoot>
            <tr className="bg-gray-100 font-bold">
              <td colSpan={4} className="border border-gray-800 p-2 pr-4 text-right uppercase">
                TỔNG CỘNG CHUYẾN HÀNG
              </td>
              <td className="border border-gray-800 p-2 pr-3 text-right text-base text-black">
                {VND.format(calc.finalTotal)}
              </td>
              <td className="border border-gray-800"></td>
            </tr>
            {isDeposited && (
              <tr>
                <td colSpan={4} className="border border-gray-800 p-2 pr-4 text-right uppercase font-semibold">
                  Đã đặt cọc
                </td>
                <td className="border border-gray-800 p-2 pr-3 text-right text-base">
                  {VND.format(calc.deposited)}
                </td>
                <td className="border border-gray-800"></td>
              </tr>
            )}
            {isDeposited && (
              <tr className="bg-gray-100 font-bold">
                <td colSpan={4} className="border border-gray-800 p-2 pr-4 text-right uppercase">
                  CÒN LẠI CẦN THANH TOÁN
                </td>
                <td className="border border-gray-800 p-2 pr-3 text-right text-lg text-black">
                  {VND.format(calc.remainingPayment)}
                </td>
                <td className="border border-gray-800"></td>
              </tr>
            )}
          </tfoot>
        </table>

        {productLinks.length > 0 && (
          <div className="mt-8 page-break-inside-avoid">
            <h3 className="font-bold mb-2">Chi tiết Link Sản Phẩm đính kèm:</h3>
            <table className="w-full text-sm border-collapse border border-gray-800">
              <thead>
                <tr className="bg-gray-100">
                  <th className="border border-gray-800 p-2 text-center font-semibold w-12">STT</th>
                  <th className="border border-gray-800 p-2 text-left font-semibold">Link sản phẩm</th>
                  <th className="border border-gray-800 p-2 text-right font-semibold w-28">
                    Giá <br /> (¥)
                  </th>
                  <th className="border border-gray-800 p-2 text-right font-semibold w-32">
                    Phí ship <br /> (¥)
                  </th>
                </tr>
              </thead>
              <tbody>
                {productLinks.map((item, index) => (
                  <tr key={item.id}>
                    <td className="border border-gray-800 p-2 text-center">{index + 1}</td>
                    <td className="border border-gray-800 p-2 break-all text-xs text-blue-700">
                      {item.url}
                    </td>
                    <td className="border border-gray-800 p-2 text-right font-medium">
                      {item.priceYen ? GEN.format(parseNum(item.priceYen)) : "-"}
                    </td>
                    <td className="border border-gray-800 p-2 text-right font-medium">
                      {item.shipYen ? GEN.format(parseNum(item.shipYen)) : "-"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}