import React, { useState, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { getCurrentPosition, isGeolocationSupported, type LatLng } from '../geolocation';
import { reverseGeocode } from '../mapbox';
import type { CitizenReportSubmission } from '../reportWorkflow';
import { Camera, MapPin, Send, CheckCircle, Award } from 'lucide-react';

interface ReportTabProps {
  onAddReport: (newReport: CitizenReportSubmission) => void;
  onNotify: (message: string, tone?: 'success' | 'info' | 'warning' | 'error') => void;
}

export default function ReportTab({ onAddReport, onNotify }: ReportTabProps) {
  const [desc, setDesc] = useState('');
  const [locationStr, setLocationStr] = useState('');
  const [locationCoords, setLocationCoords] = useState<LatLng | null>(null);
  const [locationSource, setLocationSource] = useState<'gps' | 'manual' | 'unknown'>('manual');
  const [citizenTags, setCitizenTags] = useState<string[]>([]);
  const [isLocating, setIsLocating] = useState(false);
  const [imgUrl, setImgUrl] = useState<string | null>(null);
  const [isSubmitSuccess, setIsSubmitSuccess] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);

  // 以真實 GPS 取得目前位置，並用 Mapbox 反向地理編碼轉成地址填入欄位
  const handleGetLocation = async () => {
    if (!isGeolocationSupported()) {
      onNotify('此裝置或瀏覽器不支援定位功能，請手動輸入位置。', 'warning');
      return;
    }
    setIsLocating(true);
    try {
      const pos = await getCurrentPosition();
      setLocationCoords(pos);
      setLocationSource('gps');
      const address = await reverseGeocode(pos);
      // 有地址用地址，否則退回經緯度
      setLocationStr(address || `緯度 ${pos.lat.toFixed(5)}, 經度 ${pos.lng.toFixed(5)}`);
      onNotify('已取得目前位置', 'success');
    } catch (err: any) {
      const denied = err && (err.code === 1 || err.message === 'NOT_SUPPORTED');
      onNotify(
        denied ? '定位被拒絕或不支援，請手動輸入位置。' : '定位失敗，請手動輸入位置。',
        'warning'
      );
    } finally {
      setIsLocating(false);
    }
  };

  const triggerUpload = () => {
    fileInputRef.current?.click();
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (event) => {
        if (event.target?.result) {
          setImgUrl(event.target.result as string);
        }
      };
      reader.readAsDataURL(file);
    }
  };

  // Preset fake uploaded bike damage image as fallback
  const handleFakeImageUpload = () => {
    if (!imgUrl) {
      // Set to a preset URL related to bicycle parking / problem
      setImgUrl('https://lh3.googleusercontent.com/aida-public/AB6AXuDAYCf6Xkf4n3qT8pMN7LJOvO0Tm8bTlqPgOgecV2SsNRtSf3bJYsNKe76k4CdtVbYqVorJLFz1C5vpFTdOIb1dr-04QHvGEDP8L9LAH9nYbs7P8UEuED875gMgD-GWiHfLtV639ROGYja9KtOkNLEsMPoc--7R60KwBmDFQqTvKrSXrfzrnhKM2GQjSCZMUcsT_CKvQ-y00-piszmb4s-eJgWQFIY5LKLhnk1tdOXnEoCRS_e3xfq-WDlk8y9lYVMyZ2Z5d_mFge_N');
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!locationStr.trim()) {
      onNotify('請輸入違規位置，或按「GPS 定位」。', 'warning');
      return;
    }
    if (!desc.trim()) {
      onNotify('請填寫詳細描述後再提交舉報。', 'warning');
      return;
    }

    setSubmitting(true);
    setTimeout(() => {
      onAddReport({
        location: locationStr,
        description: desc,
        citizenTags,
        locationSource,
        imageUrl: imgUrl || undefined,
        ...(locationCoords ? { lat: locationCoords.lat, lng: locationCoords.lng } : {}),
      });

      setSubmitting(false);
      setIsSubmitSuccess(true);
      setDesc('');
      setImgUrl(null);
      setLocationCoords(null);
      setCitizenTags([]);
      setLocationSource('manual');
      onNotify('舉報已提交，並已加入待核紀錄。', 'success');
    }, 1200);
  };

  return (
    <div id="reporttab-root" className="px-5 py-4 space-y-8 max-w-3xl mx-auto w-full font-sans text-zinc-800 pb-24 overflow-x-hidden">
      {/* SECTION 1: Report Form */}
      <section id="section-report-form" className="space-y-3">
        <h2 id="report-form-title" className="text-xl font-bold text-zinc-900 flex flex-wrap items-center justify-between gap-x-3 gap-y-1.5">
          <span className="shrink-0">違規舉報</span>
          <span className="text-[11px] font-medium bg-[#006b2c]/10 text-[#006b2c] py-1 px-2.5 rounded-full whitespace-nowrap">
            提供真實資訊獲得 50 積分
          </span>
        </h2>

        <form onSubmit={handleSubmit} className="bg-white rounded-2xl p-4 border border-zinc-200/80 shadow-sm space-y-4">
          {/* Image Upload Input Area */}
          <input
            id="report-file-input"
            ref={fileInputRef}
            type="file"
            accept="image/*"
            onChange={handleFileChange}
            className="hidden"
          />

          <div
            id="report-upload-box"
            onClick={imgUrl ? triggerUpload : handleFakeImageUpload}
            className="w-full h-36 border-2 border-dashed border-zinc-300 hover:border-[#006b2c] rounded-2xl flex flex-col items-center justify-center text-zinc-500 hover:bg-zinc-50 transition-all cursor-pointer relative overflow-hidden"
          >
            {imgUrl ? (
              <>
                <img
                  id="report-uploaded-preview"
                  src={imgUrl}
                  alt="違規照片預覽"
                  className="w-full h-full object-cover"
                />
                <div className="absolute inset-0 bg-black/40 flex items-center justify-center text-white text-xs font-bold gap-2">
                  <Camera className="w-4 h-4" />
                  點選以更換照片
                </div>
              </>
            ) : (
              <div className="text-center p-4">
                <Camera id="camera-upload-icon" className="w-8 h-8 text-zinc-400 mx-auto mb-2" />
                <span id="upload-instruction-text" className="text-xs font-bold text-zinc-600 block">上傳照片 / 拍照</span>
                <span className="text-[10px] text-zinc-400 mt-1 block">支持 JPG、PNG 格式</span>
              </div>
            )}
          </div>

          {/* Location Area（可手動輸入，或按 GPS 自動填入真實位置） */}
          <div className="space-y-1">
            <label id="location-label" className="text-xs font-bold text-zinc-500 block uppercase tracking-wider">違規位置</label>
            <div className="relative">
              <MapPin id="loc-pin-icon" className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[#006b2c] w-4.5 h-4.5" />
              <input
                id="location-display-input"
                type="text"
                value={locationStr}
                onChange={(e) => {
                  setLocationStr(e.target.value);
                  setLocationCoords(null);
                  setLocationSource('manual');
                }}
                placeholder="請手動輸入位置，或按右側「GPS 定位」"
                className="w-full bg-zinc-50 border border-zinc-200/80 rounded-xl py-3 pl-11 pr-24 text-xs font-medium text-zinc-800 placeholder:text-zinc-400 outline-none focus:ring-2 focus:ring-[#006b2c] focus:border-transparent transition-all"
              />
              <button
                id="location-gps-btn"
                type="button"
                onClick={handleGetLocation}
                disabled={isLocating}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-xs font-bold bg-[#006b2c]/10 text-[#006b2c] hover:bg-[#006b2c]/20 py-1.5 px-3 rounded-lg transition-colors cursor-pointer disabled:opacity-60"
              >
                {isLocating ? '定位中…' : 'GPS 定位'}
              </button>
            </div>
          </div>

          <div className="space-y-2">
            <label className="text-xs font-bold text-zinc-500 block uppercase tracking-wider">案件類別（可選）</label>
            <div className="flex flex-wrap gap-2">
              {[
                ['obstruction', '阻塞通道'],
                ['suspected_abandoned', '疑似棄置'],
                ['damaged_bicycle', '單車破損'],
                ['safety_hazard', '安全問題'],
              ].map(([value, label]) => {
                const selected = citizenTags.includes(value);
                return (
                  <button
                    type="button"
                    key={value}
                    onClick={() => setCitizenTags((current) => selected ? current.filter((tag) => tag !== value) : [...current, value])}
                    className={`rounded-full px-3 py-1.5 text-[11px] font-bold ${selected ? 'bg-[#006b2c] text-white' : 'bg-zinc-100 text-zinc-600 hover:bg-zinc-200'}`}
                  >
                    {label}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Description Area */}
          <div className="space-y-1">
            <label id="desc-label" className="text-xs font-bold text-zinc-500 block uppercase tracking-wider">詳細描述</label>
            <textarea
              id="desc-textarea"
              value={desc}
              onChange={(e) => setDesc(e.target.value)}
              placeholder="請描述違規情況或損壞細節... (例如：共享單車阻礙行人道、零件殘缺等)"
              rows={3}
              className="w-full bg-zinc-50 border border-zinc-200/80 rounded-xl p-3 text-xs text-zinc-800 placeholder:text-zinc-400 focus:outline-none focus:ring-2 focus:ring-[#006b2c] focus:border-transparent transition-all resize-none"
            ></textarea>
          </div>

          {/* Submit Button */}
          <button
            id="report-submit-btn"
            type="submit"
            disabled={submitting}
            className="w-full bg-[#006b2c] hover:bg-[#005320] text-white font-bold py-3.5 rounded-xl transition-all flex items-center justify-center gap-2 cursor-pointer shadow-md shadow-[#006b2c]/10 active:scale-95 disabled:bg-zinc-400"
          >
            {submitting ? (
              <span>處理中...</span>
            ) : (
              <>
                <span>提交舉報</span>
                <Send id="report-send-icon" className="w-4 h-4 ml-1" />
              </>
            )}
          </button>
        </form>
      </section>

      {/* MODALS */}
      <AnimatePresence>
        {/* Global Submit Success Overlay Alert */}
        {isSubmitSuccess && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
            <motion.div
              initial={{ scale: 0.85, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.85, opacity: 0 }}
              className="bg-white rounded-2xl p-6 shadow-2xl max-w-sm w-full border border-zinc-100 text-center"
            >
              <CheckCircle className="w-16 h-16 text-[#006b2c] mx-auto mb-3" />
              <h3 className="text-base font-bold text-zinc-950 mb-1">舉報提交成功！</h3>
              <p className="text-xs text-zinc-500 mb-4 leading-relaxed">
                感謝您對優美綠色騎行社區的付出！這筆資料已提交至香港單車工務組，核實後將會盡快跟進。
              </p>

              <div className="bg-[#006b2c]/10 border border-[#006b2c]/15 rounded-xl p-3 mb-5 inline-flex items-center gap-2 text-[#006b2c]">
                <Award className="w-5 h-5 block" />
                <span className="text-xs font-bold block">+50 綠色積分已存入您的帳戶！</span>
              </div>

              <button
                onClick={() => setIsSubmitSuccess(false)}
                className="w-full bg-[#006b2c] hover:bg-[#005320] text-white py-3 rounded-xl text-xs font-bold transition-colors cursor-pointer block"
              >
                關閉視窗
              </button>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
