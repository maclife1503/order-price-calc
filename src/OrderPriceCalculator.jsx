import React, { useMemo, useState } from "react";

// Version: layout simplified per request
// 1) Thông tin sản phẩm (tỷ giá, tổng JPY, số lượng, giá VND)
// 2) Kích thước, phí ship (kg, L/W/H, ship từ người bán ¥, ship Nhật–Việt, ship nội địa VN, phụ thu)
// 3) Kết quả (giá gốc, công mua, phụ thu, ship từ người bán (¥→VND), ship JPN–VN, ship nội địa VN)
// 4) Tổng thanh toán
// Công mua: nếu tổng < 25,000¥ → 500¥, ngược lại 2%

const VND = new Intl.NumberFormat("vi-VN", { style: "currency", currency: "VND" });
const GEN = new Intl.NumberFormat("vi-VN");

function parseNum(v) {
  if (v === "" || v === null || v === undefined) return 0;
  const n = typeof v === "number" ? v : Number(("" + v).replace(/,/g, "."));
  return Number.isFinite(n) ? n : 0;
}

export default function OrderPriceCalculator() {
  // 1) Thông tin sản phẩm
  const [rate, setRate] = useState(170); // Tỷ giá JPY → VND
  const [totalYen, setTotalYen] = useState(0); // Tổng giá trị đơn hàng (¥)
  const [qty, setQty] = useState(1); // Số lượng hàng đặt (thông tin tham khảo)

  // 2) Kích thước, phí ship
  const [weightKg, setWeightKg] = useState(0);
  const [lenCm, setLenCm] = useState(0);
  const [widCm, setWidCm] = useState(0);
  const [heiCm, setHeiCm] = useState(0);
  const [sellerShipYen, setSellerShipYen] = useState(0); // Phí ship từ người bán (¥)
  const [shipJPVN, setShipJPVN] = useState(0); // VND
  const [shipVN, setShipVN] = useState(0); // VND
  const [surchargeVND, setSurchargeVND] = useState(0); // Phụ thu (VND)

  const calc = useMemo(() => {
    const r = Math.max(0, parseNum(rate));
    const yenTotal = Math.max(0, parseNum(totalYen));

    // Giá gốc quy đổi
    const baseVND = yenTotal * r;

    // Công mua theo rule
    const serviceFeeJPY = yenTotal < 25000 ? 500 : yenTotal * 0.02;
    const serviceFeeVND = serviceFeeJPY * r;

    // Phí ship từ người bán (¥ → VND)
    const sellerShipVND = Math.max(0, parseNum(sellerShipYen)) * r;

    // Ship khác (đã ở VND)
    const shipJVN = Math.max(0, parseNum(shipJPVN));
    const shipLocal = Math.max(0, parseNum(shipVN));

    // Phụ thu (VND)
    const extra = Math.max(0, parseNum(surchargeVND));

    // Tổng thanh toán
    const total = baseVND + serviceFeeVND + extra + sellerShipVND + shipJVN + shipLocal;

    // Tính khối lượng quy đổi (tham khảo, KHÔNG cộng vào tổng nếu không dùng)
    const volWeight = (Math.max(0, parseNum(lenCm)) * Math.max(0, parseNum(widCm)) * Math.max(0, parseNum(heiCm))) / 6000; // gợi ý divisor 6000

    return {
      baseVND,
      serviceFeeJPY,
      serviceFeeVND,
      sellerShipVND,
      shipJVN,
      shipLocal,
      extra,
      total,
      r,
      yenTotal,
      qty: Math.max(1, parseNum(qty)),
      weightKg: Math.max(0, parseNum(weightKg)),
      volWeight,
    };
  }, [rate, totalYen, qty, sellerShipYen, shipJPVN, shipVN, surchargeVND, lenCm, widCm, heiCm, weightKg]);

  return (
    <div className="min-h-screen w-full bg-gradient-to-b from-white to-gray-50 text-gray-900">
      <div className="max-w-5xl mx-auto p-6 md:p-10">
        {/* 1) Thông tin sản phẩm */}
        <section className="bg-white rounded-2xl shadow-sm border p-5 md:p-6 mb-6">
          <h2 className="text-lg font-semibold mb-4">1) Thông tin sản phẩm</h2>
          <div className="grid grid-cols-2 md:grid-cols-6 gap-4">
            {/* 1.1 Tỷ giá */}
            <div className="col-span-2 md:col-span-2">
              <label className="block text-sm text-gray-600 mb-1">Tỷ giá (JPY → VND)</label>
              <input type="number" className="w-full rounded-xl border-gray-300 focus:ring-2 focus:ring-gray-800" value={rate} onChange={(e)=>setRate(parseNum(e.target.value))} />
            </div>
            {/* 1.2 Tổng giá trị đơn hàng (¥) */}
            <div className="col-span-2 md:col-span-2">
              <label className="block text-sm text-gray-600 mb-1">Tổng giá trị đơn hàng (¥)</label>
              <input type="number" className="w-full rounded-xl border-gray-300 focus:ring-2 focus:ring-gray-800" value={totalYen} onChange={(e)=>setTotalYen(parseNum(e.target.value))} />
            </div>
            {/* 1.3 Số lượng hàng đặt */}
            <div className="col-span-2 md:col-span-1">
              <label className="block text-sm text-gray-600 mb-1">Số lượng hàng đặt</label>
              <input type="number" min={1} className="w-full rounded-xl border-gray-300 focus:ring-2 focus:ring-gray-800" value={qty} onChange={(e)=>setQty(parseNum(e.target.value))} />
            </div>
            {/* 1.4 Giá VND (hiển thị) */}
            <div className="col-span-2 md:col-span-1">
              <label className="block text-sm text-gray-600 mb-1">Giá VND (ước tính)</label>
              <div className="w-full rounded-xl border bg-gray-50 px-3 py-2 text-sm">
                {VND.format(parseNum(totalYen) * parseNum(rate))}
              </div>
            </div>
          </div>
        </section>

        {/* 2) Kích thước, phí ship */}
        <section className="bg-white rounded-2xl shadow-sm border p-5 md:p-6 mb-6">
          <h2 className="text-lg font-semibold mb-4">2) Kích thước, phí ship</h2>
          <div className="grid grid-cols-2 md:grid-cols-6 gap-4">
            {/* 2.1–2.4 Kích thước & cân nặng */}
            <div className="col-span-2"><label className="block text-sm text-gray-600 mb-1">Cân nặng dự kiến (kg)</label><input type="number" className="w-full rounded-xl border-gray-300" value={weightKg} onChange={(e)=>setWeightKg(parseNum(e.target.value))}/></div>
            <div className="col-span-2"><label className="block text-sm text-gray-600 mb-1">Dài (cm)</label><input type="number" className="w-full rounded-xl border-gray-300" value={lenCm} onChange={(e)=>setLenCm(parseNum(e.target.value))}/></div>
            <div className="col-span-2"><label className="block text-sm text-gray-600 mb-1">Rộng (cm)</label><input type="number" className="w-full rounded-xl border-gray-300" value={widCm} onChange={(e)=>setWidCm(parseNum(e.target.value))}/></div>
            <div className="col-span-2"><label className="block text-sm text-gray-600 mb-1">Cao (cm)</label><input type="number" className="w-full rounded-xl border-gray-300" value={heiCm} onChange={(e)=>setHeiCm(parseNum(e.target.value))}/></div>

            {/* 2.5–2.7 Phí ship */}
            <div className="col-span-2"><label className="block text-sm text-gray-600 mb-1">Phí ship từ người bán (¥)</label><input type="number" className="w-full rounded-xl border-gray-300" value={sellerShipYen} onChange={(e)=>setSellerShipYen(parseNum(e.target.value))}/></div>
            <div className="col-span-2"><label className="block text-sm text-gray-600 mb-1">Phí ship Nhật–Việt (VND)</label><input type="number" className="w-full rounded-xl border-gray-300" value={shipJPVN} onChange={(e)=>setShipJPVN(parseNum(e.target.value))}/></div>
            <div className="col-span-2"><label className="block text-sm text-gray-600 mb-1">Phí ship nội địa Việt Nam (VND)</label><input type="number" className="w-full rounded-xl border-gray-300" value={shipVN} onChange={(e)=>setShipVN(parseNum(e.target.value))}/></div>

            {/* Phụ thu (không nằm trong danh sách mục 2 nhưng cần cho kết quả) */}
            <div className="col-span-2 md:col-span-2"><label className="block text-sm text-gray-600 mb-1">Phụ thu (VND)</label><input type="number" className="w-full rounded-xl border-gray-300" value={surchargeVND} onChange={(e)=>setSurchargeVND(parseNum(e.target.value))}/></div>
          </div>

          {/* Thông tin quy đổi khối lượng (tham khảo) */}
          <div className="mt-4 text-xs bg-gray-50 border rounded-xl p-3">
            <div className="flex justify-between"><span>Khối lượng quy đổi (L×W×H / 6000)</span><span>{GEN.format(calc.volWeight)} kg</span></div>
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
