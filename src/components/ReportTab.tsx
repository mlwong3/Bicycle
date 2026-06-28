import React, { useState, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { RECYCLE_STATIONS, ECO_PARTNERS } from '../data';
import { RecycleStation, EcoPartner, Report } from '../types';
import { Camera, MapPin, Send, ChevronRight, Star, Info, X, Phone, CheckCircle, Navigation, Award } from 'lucide-react';

interface ReportTabProps {
  onAddReport: (newReport: Omit<Report, 'id' | 'status' | 'date'>) => void;
  onNotify: (message: string, tone?: 'success' | 'info' | 'warning' | 'error') => void;
}

export default function ReportTab({ onAddReport, onNotify }: ReportTabProps) {
  const [desc, setDesc] = useState('');
  const [locationStr, setLocationStr] = useState('香港仔海傍道 12 號');
  const [isLocating, setIsLocating] = useState(false);
  const [imgUrl, setImgUrl] = useState<string | null>(null);
  const [isSubmitSuccess, setIsSubmitSuccess] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  // Modals management
  const [selectedStation, setSelectedStation] = useState<RecycleStation | null>(null);
  const [selectedPartner, setSelectedPartner] = useState<EcoPartner | null>(null);
  const [showAllStations, setShowAllStations] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);

  // Mock locations list to alternate when user clicks GPS
  const GPS_LOCATIONS = [
    '沙田城門河源禾路單車徑段',
    '大圍港鐵站 A 出口自行車停放專區',
    '大埔墟近廣福邨單車天橋段',
    '香港仔海傍道 12 號 (目前位置)'
  ];
  const [locationIndex, setLocationIndex] = useState(0);

  const handleGetLocation = () => {
    setIsLocating(true);
    setTimeout(() => {
      const nextIndex = (locationIndex + 1) % GPS_LOCATIONS.length;
      setLocationIndex(nextIndex);
      setLocationStr(GPS_LOCATIONS[nextIndex]);
      setIsLocating(false);
    }, 1000);
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
    if (!desc.trim()) {
      onNotify('請填寫詳細描述後再提交舉報。', 'warning');
      return;
    }

    setSubmitting(true);
    setTimeout(() => {
      onAddReport({
        location: locationStr,
        description: desc,
        imageUrl: imgUrl || undefined
      });

      setSubmitting(false);
      setIsSubmitSuccess(true);
      setDesc('');
      setImgUrl(null);
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

          {/* Location Area */}
          <div className="space-y-1">
            <label id="location-label" className="text-xs font-bold text-zinc-500 block uppercase tracking-wider">目前位置</label>
            <div className="relative">
              <MapPin id="loc-pin-icon" className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[#006b2c] w-4.5 h-4.5" />
              <input
                id="location-display-input"
                type="text"
                value={locationStr}
                readOnly
                className="w-full bg-zinc-50 border border-zinc-100 rounded-xl py-3 pl-11 pr-20 text-xs font-medium text-zinc-800 outline-none focus:ring-0"
              />
              <button
                id="location-gps-btn"
                type="button"
                onClick={handleGetLocation}
                disabled={isLocating}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-xs font-bold bg-[#006b2c]/10 text-[#006b2c] hover:bg-[#006b2c]/20 py-1.5 px-3 rounded-lg transition-colors cursor-pointer"
              >
                {isLocating ? 'GPS 定位中' : 'GPS 定位'}
              </button>
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

      {/* SECTION 2: Recycle stations */}
      <section id="section-recycle-stations" className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 id="recycle-section-title" className="text-lg font-bold text-zinc-900 tracking-tight flex items-center gap-2">
            單車回收站
            <span className="text-[9px] bg-zinc-100 text-zinc-500 px-1.5 py-0.5 rounded font-bold">示範資料</span>
          </h2>
          <button
            id="recycle-showall-btn"
            onClick={() => setShowAllStations(true)}
            className="text-xs text-[#006b2c] font-bold flex items-center gap-1 hover:underline cursor-pointer"
          >
            查看全部 <ChevronRight className="w-4 h-4" />
          </button>
        </div>

        {/* Horizontal scroll lists for recycle stations */}
        <div id="recycle-list-scrollable" className="flex overflow-x-auto gap-4 pb-3 -mx-5 px-5 scrollbar-thin scrollbar-thumb-zinc-200 snap-x">
          {RECYCLE_STATIONS.map((station) => (
            <div
              key={station.id}
              id={`recycle-card-${station.id}`}
              className="min-w-[210px] max-w-[240px] bg-white rounded-xl p-4 border border-zinc-200/80 shadow-sm flex flex-col justify-between snap-start shrink-0"
            >
              <div className="flex items-center gap-3 mb-4">
                <div className="w-11 h-11 rounded-full overflow-hidden border border-zinc-100 flex-shrink-0 bg-zinc-50 flex items-center justify-center">
                  <img
                    src={station.logoUrl}
                    alt={station.logoAlt}
                    referrerPolicy="no-referrer"
                    className="w-9 h-9 object-contain"
                  />
                </div>
                <div>
                  <h3 className="text-xs font-bold text-zinc-900 line-clamp-1">{station.name}</h3>
                  <p className="text-[10px] text-zinc-500 font-medium flex items-center gap-1 mt-0.5">
                    <MapPin className="w-3 h-3 text-[#006b2c]" /> {station.distance}
                  </p>
                </div>
              </div>

              <button
                id={`contact-station-btn-${station.id}`}
                onClick={() => setSelectedStation(station)}
                className="w-full py-2 border-[1.5px] border-[#006b2c]/40 text-[#006b2c] hover:border-[#006b2c] hover:bg-[#006b2c]/5 font-bold text-xs rounded-lg transition-colors cursor-pointer text-center"
              >
                聯絡機構
              </button>
            </div>
          ))}
        </div>
      </section>

      {/* SECTION 3: Eco Partners */}
      <section id="section-eco-partners" className="space-y-3">
        <h2 id="partners-section-title" className="text-lg font-bold text-zinc-900 tracking-tight flex items-center gap-2">
          環保合作夥伴
          <span className="text-[9px] bg-zinc-100 text-zinc-500 px-1.5 py-0.5 rounded font-bold">示範資料</span>
        </h2>
        <div id="partners-list" className="space-y-4">
          {ECO_PARTNERS.map((partner) => (
            <div
              key={partner.id}
              id={`partner-card-${partner.id}`}
              className="bg-white rounded-2xl overflow-hidden border border-zinc-200/80 shadow-sm flex flex-col md:flex-row transition-all hover:border-[#006b2c]/30"
            >
              {/* Partner cover image */}
              <div className="md:w-1/3 h-36 md:h-auto relative bg-zinc-100 flex items-center justify-center flex-shrink-0">
                <img
                  src={partner.imageUrl}
                  alt={partner.imageAlt}
                  referrerPolicy="no-referrer"
                  className="w-full h-full object-cover"
                />
                <div className="absolute top-2 left-2 bg-[#006b2c] text-white text-[9px] font-bold px-2 py-1 rounded-full flex items-center gap-1 shadow-sm">
                  <Award className="w-3 h-3 shrink-0" /> 環保夥伴
                </div>
              </div>

              {/* Partner content section */}
              <div className="p-4 flex flex-col justify-between flex-1">
                <div>
                  <div className="flex justify-between items-start mb-1">
                    <h3 className="text-sm font-bold text-zinc-900 leading-snug">{partner.name}</h3>
                    <div className="flex items-center text-[#006b2c] gap-0.5">
                      <Star className="w-3.5 h-3.5 fill-current" />
                      <span className="text-xs font-bold">{partner.rating}</span>
                    </div>
                  </div>
                  <p className="text-xs text-zinc-500 line-clamp-2 mt-1">{partner.description}</p>
                </div>

                <div className="flex items-center justify-between mt-3 pt-3 border-t border-zinc-100">
                  <p className="text-xs text-zinc-500 font-medium flex items-center gap-1">
                    <MapPin className="w-3.5 h-3.5 text-[#006b2c]" /> {partner.distance}
                  </p>
                  <button
                    id={`view-partner-btn-${partner.id}`}
                    onClick={() => setSelectedPartner(partner)}
                    className="text-zinc-600 hover:text-[#006b2c] transition-colors font-bold text-xs flex items-center gap-1 cursor-pointer"
                  >
                    查看細節 <ChevronRight className="w-4 h-4" />
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* MODALS */}
      <AnimatePresence>
        {/* Recycle Station Contact Dialog */}
        {selectedStation && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="bg-white rounded-2xl p-5 shadow-2xl max-w-sm w-full border border-zinc-100"
            >
              <div className="flex justify-between items-start mb-4">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-zinc-50 flex items-center justify-center border border-zinc-100 overflow-hidden">
                    <img src={selectedStation.logoUrl} alt={selectedStation.logoAlt} referrerPolicy="no-referrer" className="w-8 h-8 object-contain" />
                  </div>
                  <div>
                    <h3 className="text-sm font-bold text-zinc-900">{selectedStation.name}</h3>
                    <p className="text-[10px] text-[#006b2c] font-bold">認證綠色單車回收機構</p>
                  </div>
                </div>
                <button onClick={() => setSelectedStation(null)} className="p-1 hover:bg-zinc-100 rounded-full transition-colors cursor-pointer text-zinc-400">
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="space-y-3.5 my-4 bg-zinc-50 p-4 rounded-xl text-xs text-zinc-600 leading-relaxed">
                <p>我們致力於將廢棄與閒置的舊單車，經由資深技師維修再造，捐贈給弱勢群體或推廣至市區社區共享，實現循環經濟。</p>
                <div className="flex items-center gap-2 font-bold text-[#006b2c] pt-2 border-t border-zinc-200/80">
                  <Phone className="w-4 h-4" /> 聯絡電話： {selectedStation.contactNo}
                </div>
              </div>

              <div className="flex gap-2">
                <button
                  onClick={() => {
                    onNotify(`已準備聯絡 ${selectedStation.name}（${selectedStation.contactNo}）。`, 'info');
                    setSelectedStation(null);
                  }}
                  className="flex-1 bg-[#006b2c] hover:bg-[#005320] text-white py-2.5 rounded-xl text-xs font-bold transition-colors cursor-pointer"
                >
                  致電機構
                </button>
                <button
                  onClick={() => setSelectedStation(null)}
                  className="flex-1 bg-zinc-100 hover:bg-zinc-200 text-zinc-700 py-2.5 rounded-xl text-xs font-bold transition-colors cursor-pointer"
                >
                  關閉
                </button>
              </div>
            </motion.div>
          </div>
        )}

        {/* Partners Details Dialog */}
        {selectedPartner && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="bg-white rounded-2xl p-5 shadow-2xl max-w-md w-full border border-zinc-100 max-h-[85vh] overflow-y-auto"
            >
              <div className="flex justify-between items-start mb-4">
                <h3 className="text-base font-bold text-zinc-900">{selectedPartner.name}</h3>
                <button onClick={() => setSelectedPartner(null)} className="p-1 hover:bg-zinc-100 rounded-full transition-colors cursor-pointer text-zinc-400">
                  <X className="w-5 h-5" />
                </button>
              </div>

              <img
                src={selectedPartner.imageUrl}
                alt={selectedPartner.imageAlt}
                referrerPolicy="no-referrer"
                className="w-full h-40 object-cover rounded-xl mb-4"
              />

              <div className="space-y-4 text-xs">
                <div>
                  <h4 className="font-bold text-zinc-400 uppercase tracking-wider mb-1 text-[11px]">商戶地址</h4>
                  <p className="text-zinc-700 font-medium">{selectedPartner.address}</p>
                </div>

                <div>
                  <h4 className="font-bold text-zinc-400 uppercase tracking-wider mb-1 text-[11px]">服務描述</h4>
                  <p className="text-zinc-600 leading-relaxed">{selectedPartner.description}</p>
                </div>

                <div>
                  <h4 className="font-bold text-zinc-400 uppercase tracking-wider mb-1.5 text-[11px]">提供之環保服務</h4>
                  <div className="flex flex-wrap gap-2">
                    {selectedPartner.services.map((service, i) => (
                      <span key={i} className="bg-[#006b2c]/10 text-[#006b2c] py-1.5 px-3 rounded-full font-bold">
                        {service}
                      </span>
                    ))}
                  </div>
                </div>

                <div className="bg-zinc-50 p-3 rounded-xl flex items-center gap-2.5">
                  <Award className="w-5 h-5 text-[#006b2c] shrink-0" />
                  <p className="text-zinc-500 font-medium">使用綠色騎士 App 舉報違規或回收成功後獲得的綠色積分，可於該概念店兌換各款維修保修券或精品單車配件！</p>
                </div>
              </div>

              <div className="flex gap-2.5 mt-5 pt-3 border-t border-zinc-100">
                <button
                  onClick={() => {
                    onNotify(`已規劃前往 ${selectedPartner.name} 的示範路線。`, 'success');
                    setSelectedPartner(null);
                  }}
                  className="flex-1 bg-[#006b2c] hover:bg-[#005320] text-white py-3 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 cursor-pointer shadow-sm"
                >
                  <Navigation className="w-4 h-4" /> 導航至商戶
                </button>
                <button
                  onClick={() => setSelectedPartner(null)}
                  className="px-6 bg-zinc-100 hover:bg-zinc-200 text-zinc-700 py-3 rounded-xl text-xs font-bold transition-colors cursor-pointer"
                >
                  關閉
                </button>
              </div>
            </motion.div>
          </div>
        )}

        {/* View All Stations dialog / recycling info */}
        {showAllStations && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="bg-white rounded-2xl p-5 shadow-2xl max-w-md w-full border border-zinc-100 max-h-[80vh] overflow-y-auto"
            >
              <div className="flex justify-between items-center mb-4">
                <h3 className="text-base font-bold text-zinc-900">綠色單車回收站點指南</h3>
                <button onClick={() => setShowAllStations(false)} className="p-1 hover:bg-zinc-100 rounded-full transition-colors cursor-pointer text-zinc-400">
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="space-y-4 text-xs text-zinc-600 leading-relaxed">
                <p>香港各區皆設有民間自發或環保團體支持的舊自行車回收中心，提供免費回收舊車或代客進行骨灰級改裝。這有助減緩城市固體廢物的壓力，支持本地綠色循環。</p>
                
                <div className="border border-zinc-100 rounded-xl overflow-hidden divide-y divide-zinc-100">
                  <div className="p-3 bg-zinc-50/50">
                    <p className="font-bold text-zinc-900">1. 香港綠色回收組織 (沙田總站)</p>
                    <p className="mt-0.5 text-zinc-500">香港沙田銀城街大瀝源工業園 A 區 12 號 (距離 0.8km)</p>
                  </div>
                  <div className="p-3 bg-zinc-50/50">
                    <p className="font-bold text-zinc-900">2. EcoBike HK (深水埗分店)</p>
                    <p className="mt-0.5 text-zinc-500">九龍深水埗荔枝角道 883 號地下 (距離 2.1km)</p>
                  </div>
                  <div className="p-3 bg-zinc-50/50">
                    <p className="font-bold text-zinc-900">3. 大埔單車再生工作室 (籌備中)</p>
                    <p className="mt-0.5 text-zinc-500">新界大埔大成街臨時市政市集 5 號鋪 (預計 7.5km)</p>
                  </div>
                </div>

                <div className="bg-[#006b2c]/5 text-[#006b2c] p-3 rounded-lg flex items-center gap-2">
                  <Info className="w-4.5 h-4.5 shrink-0" />
                  <p className="font-semibold text-[10px]">回收貼士：提交完整的車架和零件能更方便義工將其改造重生！</p>
                </div>
              </div>

              <div className="mt-5 text-right">
                <button
                  onClick={() => setShowAllStations(false)}
                  className="px-6 bg-[#006b2c] hover:bg-[#005320] text-white py-2.5 rounded-xl text-xs font-bold transition-colors cursor-pointer"
                >
                  我知道了
                </button>
              </div>
            </motion.div>
          </div>
        )}

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
