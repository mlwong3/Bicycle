import { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Bike, Report } from '../types';
import { carbonSaved, CAR_CO2_PER_KM } from '../carbon';
import { 
  Plus, CheckCircle, AlertCircle, Trash2, Award, 
  MapPin, HelpCircle, ChevronRight, Bell,
  X, Compass, Heart, History, Flame, Mail, Send, Check
} from 'lucide-react';

interface PersonalTabProps {
  bikes: Bike[];
  reports: Report[];
  savedParkingCount: number;
  userScore: number;
  totalDistanceKm: number;
  onUnbindBike: (id: string) => void;
  onNavigateToTab: (tab: string) => void;
  onNotify: (message: string, tone?: 'success' | 'info' | 'warning' | 'error') => void;
}

export default function PersonalTab({
  bikes,
  reports,
  savedParkingCount,
  userScore,
  totalDistanceKm,
  onUnbindBike,
  onNavigateToTab,
  onNotify
}: PersonalTabProps) {
  const [selectedBike, setSelectedBike] = useState<Bike | null>(null);

  // Settings Modals
  const [showNotificationModal, setShowNotificationModal] = useState(false);
  const [showHelpModal, setShowHelpModal] = useState(false);

  // Help center states
  const [helpFeedback, setHelpFeedback] = useState('');
  const [feedbackSent, setFeedbackSent] = useState(false);

  // Notifications states
  const [notiPush, setNotiPush] = useState(true);
  const [notiMute, setNotiMute] = useState(false);

  const pendingReportsCount = reports.filter(r => r.status === 'pending').length;
  const resolvedReportsCount = reports.filter(r => r.status === 'resolved').length;

  // 減碳 = 累計騎乘距離 × 官方排放係數（取代原本捏造公式）
  const totalCarbonReduced = carbonSaved(totalDistanceKm).toFixed(1);

  return (
    <div id="personaltab-root" className="px-5 space-y-6 pt-1 max-w-3xl mx-auto font-sans text-zinc-800 pb-24">
      {/* 1. User Header */}
      <section id="user-header" className="flex items-center gap-4 py-2">
        <div className="relative">
          <img
            src="https://lh3.googleusercontent.com/aida-public/AB6AXuB2GAAAL_i2PXfsqLZhfn3lsWWF6-uK4QKsdNZXuI2kUvCtks39JCewGLAw-svhbdzIe6QpU5g26GcIg6BlkuPVCAIjF9CFcNYq4jYlsF6_0kYZPIVbMgIX0L0wael4Geq8nx2m_2HWe_i7AVVaKgeoFTjQqthcvbs2Pr5PDFoT61mDc_0-evvpZgpKSOEzomorvS7N9CnG0bloy9FSOh7SY8VOwsHMo_DlTXJx1XW-dHU2qH0VyZXiKXy3Nm0tq_xE1LL57K3grA8A"
            alt="用戶頭像"
            referrerPolicy="no-referrer"
            className="w-18 h-18 rounded-full object-cover border-2 border-[#006b2c] shadow-sm select-none"
          />
          <div className="absolute bottom-0 right-0 bg-[#006b2c] text-white rounded-full w-5.5 h-5.5 flex items-center justify-center border-2 border-white cursor-pointer hover:bg-[#005320]">
            <svg className="w-3 h-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
              <path d="M12 20h9"></path>
              <path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"></path>
            </svg>
          </div>
        </div>

        <div className="flex-1">
          <h2 id="profile-name" className="text-lg font-bold text-zinc-900 tracking-tight">單車愛好者</h2>
          <div className="flex flex-wrap items-center gap-2 mt-1.5">
            <div className="inline-flex items-center gap-1 bg-[#006b2c]/10 text-[#006b2c] px-3 py-1 rounded-full text-[10px] font-bold">
              <Award className="w-3.5 h-3.5 fill-current shrink-0" />
              <span>綠色騎士 Lv.3</span>
            </div>
            <div className="inline-flex items-center gap-1 bg-[#006b2c] text-white px-3 py-1 rounded-full text-[10px] font-bold shadow-sm">
              <span>綠色積分: {userScore}</span>
            </div>
          </div>
        </div>
      </section>

      {/* 2. My Bikes Category */}
      <section id="my-bikes-section" className="space-y-3">
        <div className="flex justify-between items-center mb-1">
          <h3 id="my-bikes-title" className="text-base font-bold text-zinc-950 tracking-tight">我的單車</h3>
          <span className="text-xs text-zinc-400 font-medium">{bikes.length} 台已登記</span>
        </div>

        {/* Horizontal scroll lists */}
        <div id="my-bikes-scrollable" className="flex overflow-x-auto gap-4 pb-2 -mx-5 px-5 scrollbar-thin scrollbar-thumb-zinc-200 snap-x">
          {bikes.map((bike) => (
            <div
              key={bike.id}
              id={`bike-p-card-${bike.id}`}
              onClick={() => setSelectedBike(bike)}
              className="min-w-[170px] max-w-[200px] bg-zinc-50 border border-zinc-200 hover:border-[#006b2c] rounded-xl p-4 snap-start shrink-0 relative group cursor-pointer transition-all hover:bg-[#006b2c]/5"
            >
              <div className="absolute top-4 right-4">
                {bike.nfcBound ? (
                  <CheckCircle className="text-[#006b2c] w-5 h-5 fill-[#006b2c]/10 shrink-0" />
                ) : (
                  <AlertCircle className="text-zinc-400 w-5 h-5 shrink-0" />
                )}
              </div>
              <svg className="w-10 h-10 text-zinc-400 group-hover:text-[#006b2c] transition-colors mb-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="5.5" cy="17.5" r="2.5"></circle>
                <circle cx="18.5" cy="17.5" r="2.5"></circle>
                <path d="M15 6h5a2 2 0 0 1 2 2v2"></path>
                <path d="M12 12H7.5L4 14.5"></path>
                <path d="M8.5 7.5L12 12"></path>
                <path d="M12 12v5.5"></path>
              </svg>
              <h4 className="font-bold text-sm text-zinc-900 leading-tight mb-1">{bike.model}</h4>
              <p className="text-[10px] text-zinc-400 font-semibold">{bike.nfcBound ? 'NFC 已綁定' : '未綁定 NFC'}</p>
            </div>
          ))}

          {/* Add Bike card */}
          <button
            id="register-bike-add-card"
            onClick={() => onNavigateToTab('nfc')}
            className="min-w-[170px] border-2 border-dashed border-zinc-200 hover:border-[#006b2c]/40 rounded-xl p-4 snap-start shrink-0 flex flex-col items-center justify-center gap-1.5 hover:bg-zinc-50 transition-all cursor-pointer"
          >
            <Plus className="w-8 h-8 text-[#006b2c]" />
            <span className="font-bold text-xs text-[#006b2c]">登記新單車</span>
          </button>
        </div>
      </section>

      {/* 3. Records Grid (Bento Grid) */}
      <section id="records-grid-section" className="space-y-3">
        <h3 id="bento-grid-title" className="text-base font-bold text-zinc-950 tracking-tight">我的收藏與紀錄</h3>
        <div id="bento-grid" className="grid grid-cols-2 gap-3.5">
          {/* Bento Item 1: Routes */}
          <div className="bg-zinc-50 rounded-2xl p-4 flex flex-col justify-between aspect-square border border-zinc-200/80 shadow-sm transition-all hover:bg-white hover:shadow-md">
            <div className="w-9 h-9 rounded-full bg-[#006b2c]/10 flex items-center justify-center text-[#006b2c] mb-2">
              <svg className="w-5 h-5 shrink-0" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7" />
              </svg>
            </div>
            <div>
              <h4 className="text-2xl font-black text-zinc-900 leading-none mb-1">12</h4>
              <p className="text-xs text-zinc-500 font-semibold">示範收藏路線</p>
            </div>
          </div>

          {/* Bento Item 2: Saved Parking (Real state synced) */}
          <div className="bg-zinc-50 rounded-2xl p-4 flex flex-col justify-between aspect-square border border-zinc-200/80 shadow-sm transition-all hover:bg-white hover:shadow-md">
            <div className="w-9 h-9 rounded-full bg-[#006b2c]/10 flex items-center justify-center text-[#006b2c] mb-2">
              <svg className="w-5 h-5 shrink-0" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
                <rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect>
                <path d="M9 17V7h4a3 3 0 0 1 0 6H9"></path>
              </svg>
            </div>
            <div>
              <h4 id="bento-parking-val" className="text-2xl font-black text-zinc-900 leading-none mb-1">{savedParkingCount}</h4>
              <p className="text-xs text-zinc-500 font-semibold">收藏泊位</p>
            </div>
          </div>

          {/* Bento Item 3: Reports Count (Real state synced) */}
          <div className="bg-zinc-50 rounded-2xl p-4 flex flex-col justify-between aspect-square border border-zinc-200/80 shadow-sm transition-all hover:bg-white hover:shadow-md">
            <div className="flex justify-between items-start mb-2">
              <div className="w-9 h-9 rounded-full bg-rose-50 flex items-center justify-center text-rose-500">
                <svg className="w-5 h-5 shrink-0" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                </svg>
              </div>
              {pendingReportsCount > 0 && (
                <span className="text-[9px] font-black text-rose-500 bg-rose-50 border border-rose-100 px-2 py-0.5 rounded-full">
                  {pendingReportsCount}件待核
                </span>
              )}
            </div>
            <div>
              <h4 id="bento-reports-val" className="text-2xl font-black text-zinc-900 leading-none mb-1">{reports.length}</h4>
              <p className="text-xs text-zinc-500 font-semibold">舉報紀錄 (已結辦 {resolvedReportsCount}件)</p>
            </div>
          </div>

          {/* Bento Item 4: Carbon Reduced (Real state synced) */}
          <div className="bg-[#006b2c] text-white rounded-2xl p-4 flex flex-col justify-between aspect-square border border-[#006b2c] shadow-[0_4px_16px_rgba(0,107,44,0.15)] relative overflow-hidden">
            <div className="absolute -right-4 -bottom-4 opacity-[0.12] pointer-events-none select-none">
              <svg className="w-24 h-24 stroke-current" fill="none" viewBox="0 0 24 24" strokeWidth="1">
                <path d="M12 2v20M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" />
              </svg>
            </div>
            <div className="w-9 h-9 rounded-full bg-white/20 flex items-center justify-center text-white mb-2 z-10">
              <svg className="w-5 h-5 shrink-0" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
                <path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5"></path>
              </svg>
            </div>
            <div className="z-10">
              <h4 id="bento-carbon-val" className="text-2xl font-black leading-none mb-1">{totalCarbonReduced} kg</h4>
              <p className="text-[10px] text-white/85 font-semibold leading-relaxed">
                減碳 CO₂ · 騎乘 {totalDistanceKm.toFixed(1)} km
              </p>
            </div>
          </div>
        </div>

        {/* 減碳計算方法與出處（誠實註腳） */}
        <p className="text-[10px] text-zinc-400 leading-relaxed px-1">
          減碳 = 騎乘距離 × {CAR_CO2_PER_KM.toFixed(2)} kg CO₂/km（以單車取代汽車）。係數依香港《溫室氣體排放量計算工具》無鉛汽油 2.360 kg/L、市區油耗 8 L/100km 估算；僅計 CO₂，未含微量 CH₄/N₂O，屬保守估計。
        </p>
      </section>

      {/* 4. Settings Card list buttons */}
      <section id="settings-list-section" className="bg-zinc-50 rounded-2xl border border-zinc-200/80 overflow-hidden mb-6">
        {/* Notifications Setting */}
        <button
          id="setting-noti-btn"
          onClick={() => setShowNotificationModal(true)}
          className="w-full flex items-center justify-between p-4 border-b border-zinc-100 hover:bg-[#006b2c]/5 transition-colors duration-200 cursor-pointer"
        >
          <div className="flex items-center gap-3">
            <Bell className="w-5 h-5 text-zinc-400 shrink-0" />
            <span className="text-xs font-bold text-zinc-900">通知設置</span>
          </div>
          <ChevronRight className="w-4 h-4 text-zinc-400" />
        </button>

        {/* Help setting */}
        <button
          id="setting-help-btn"
          onClick={() => setShowHelpModal(true)}
          className="w-full flex items-center justify-between p-4 hover:bg-[#006b2c]/5 transition-colors duration-200 cursor-pointer"
        >
          <div className="flex items-center gap-3">
            <HelpCircle className="w-5 h-5 text-zinc-400 shrink-0" />
            <span className="text-xs font-bold text-zinc-900">幫助與回饋</span>
          </div>
          <ChevronRight className="w-4 h-4 text-zinc-400" />
        </button>
      </section>

      {/* MODALS */}
      <AnimatePresence>
        {/* Bike Details Popup Dialog */}
        {selectedBike && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="bg-white rounded-2xl p-5 shadow-2xl max-w-sm w-full border border-zinc-100"
            >
              <div className="flex justify-between items-start mb-4">
                <div className="flex items-center gap-2">
                  <span className="bg-[#006b2c]/10 text-[#006b2c] p-2 rounded-xl">
                    <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <circle cx="5.5" cy="17.5" r="2.5"></circle>
                      <circle cx="18.5" cy="17.5" r="2.5"></circle>
                      <path d="M15 6h5a2 2 0 0 1 2 2v2"></path>
                    </svg>
                  </span>
                  <div>
                    <h3 className="text-sm font-bold text-zinc-900">{selectedBike.model}</h3>
                    <p className={`text-[9px] font-bold ${selectedBike.nfcBound ? 'text-[#006b2c]' : 'text-zinc-400'}`}>
                      {selectedBike.nfcBound ? '• NFC 晶片防盜已啟用' : 'NFC 未設定'}
                    </p>
                  </div>
                </div>
                <button onClick={() => setSelectedBike(null)} className="p-1 hover:bg-zinc-100 rounded-full transition-colors cursor-pointer text-zinc-400">
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="space-y-2 bg-zinc-50 p-4 rounded-xl text-xs font-medium text-zinc-600 mb-5 border border-zinc-100">
                <p>• <strong>登記名：</strong> {selectedBike.ownerName}</p>
                <p>• <strong>車架號：</strong> {selectedBike.frameNo}</p>
                <p>• <strong>感應金鑰：</strong> {selectedBike.nfcBound ? 'NFC-SEC-AA8281' : '未註冊'}</p>
                <p>• <strong>最近定位：</strong> 沙田公園 (200米內)</p>
              </div>

              <div className="flex gap-2">
                <button
                  onClick={() => {
                    onUnbindBike(selectedBike.id);
                    setSelectedBike(null);
                  }}
                  className="flex-1 bg-zinc-100 hover:bg-rose-50 text-rose-500 border border-zinc-200 hover:border-rose-100 py-3 rounded-xl text-xs font-bold transition-all cursor-pointer flex justify-center items-center gap-1.5"
                >
                  <Trash2 className="w-4 h-4" /> 解除綁定
                </button>
                <button
                  onClick={() => setSelectedBike(null)}
                  className="flex-1 bg-[#006b2c] hover:bg-[#005320] text-white py-3 rounded-xl text-xs font-bold transition-colors cursor-pointer"
                >
                  確認
                </button>
              </div>
            </motion.div>
          </div>
        )}

        {/* 2. Notification Setting Modal */}
        {showNotificationModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="bg-white rounded-2xl p-5 shadow-2xl max-w-sm w-full border border-zinc-100"
            >
              <div className="flex justify-between items-center mb-4">
                <h3 className="text-sm font-bold text-zinc-900">配置推播通知</h3>
                <button onClick={() => setShowNotificationModal(false)} className="p-1 hover:bg-zinc-100 rounded-full transition-colors cursor-pointer text-zinc-400">
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="space-y-4 text-xs font-medium text-zinc-600 mb-5">
                <div className="flex items-center justify-between p-3 bg-zinc-50 rounded-xl">
                  <div>
                    <p className="font-bold text-zinc-800 text-xs">啟用推播通知</p>
                    <p className="text-[10px] text-zinc-400 mt-0.5">當接收到舉報處理、被盜預警時提醒</p>
                  </div>
                  <input
                    type="checkbox"
                    checked={notiPush}
                    onChange={(e) => setNotiPush(e.target.checked)}
                    className="rounded text-[#006b2c] focus:ring-[#006b2c] w-4.5 h-4.5 border-zinc-200"
                  />
                </div>

                <div className="flex items-center justify-between p-3 bg-zinc-50 rounded-xl">
                  <div>
                    <p className="font-bold text-zinc-800 text-xs text-left">騎行語音免打擾</p>
                    <p className="text-[10px] text-zinc-400 mt-0.5 text-left">當行駛速度大於 15km/h 時自動靜音通知</p>
                  </div>
                  <input
                    type="checkbox"
                    checked={notiMute}
                    onChange={(e) => setNotiMute(e.target.checked)}
                    className="rounded text-[#006b2c] focus:ring-[#006b2c] w-4.5 h-4.5 border-zinc-200"
                  />
                </div>
              </div>

              <button
                onClick={() => setShowNotificationModal(false)}
                className="w-full bg-[#006b2c] hover:bg-[#005320] text-white py-3 rounded-xl text-xs font-bold transition-colors cursor-pointer"
              >
                儲存設置
              </button>
            </motion.div>
          </div>
        )}

        {/* 3. Help and Feedback Modal */}
        {showHelpModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="bg-white rounded-2xl p-5 shadow-2xl max-w-md w-full border border-zinc-100 max-h-[85vh] overflow-y-auto"
            >
              <div className="flex justify-between items-center mb-4">
                <h3 className="text-sm font-bold text-zinc-900">幫助與反映回饋</h3>
                <button onClick={() => {
                  setShowHelpModal(false);
                  setFeedbackSent(false);
                }} className="p-1 hover:bg-zinc-100 rounded-full transition-colors cursor-pointer text-zinc-400">
                  <X className="w-5 h-5" />
                </button>
              </div>

              {feedbackSent ? (
                <div className="text-center py-6 space-y-3">
                  <CheckCircle className="w-14 h-14 text-[#006b2c] mx-auto" />
                  <h4 className="text-sm font-bold text-zinc-950">回饋發送成功！</h4>
                  <p className="text-xs text-zinc-500 max-w-xs mx-auto">
                    感謝您的意見！我們會儘速由香港單車管理中心專員核閱，持續優化您的騎行體驗。
                  </p>
                  <button
                    onClick={() => {
                      setFeedbackSent(false);
                      setShowHelpModal(false);
                    }}
                    className="bg-[#006b2c] hover:bg-[#005320] text-white py-2.5 px-6 rounded-xl text-xs font-bold transition-colors cursor-pointer mt-2"
                  >
                    返回
                  </button>
                </div>
              ) : (
                <div className="space-y-4">
                  {/* FAQs list */}
                  <div>
                    <h4 className="text-xs font-bold text-zinc-400 uppercase tracking-wider mb-2 text-[10px]">常見問題 (FAQ)</h4>
                    <div className="space-y-2 text-xs divide-y divide-zinc-100">
                      <div className="py-2">
                        <p className="font-bold text-zinc-900">Q: 積分有何用處？</p>
                        <p className="mt-0.5 text-zinc-500 leading-relaxed">
                          可在「環保合作夥伴」(如 VELO概念店) 兌換折抵單車保養、打氣潤滑、或配件消費。
                        </p>
                      </div>
                      <div className="py-2.5">
                        <p className="font-bold text-zinc-900">Q: NFC 如何使用？</p>
                        <p className="mt-0.5 text-zinc-500 leading-relaxed">
                          將手機感應貼在車架或龍頭的專用智慧貼片上，即可寫入防盜與擁有權資料。
                        </p>
                      </div>
                    </div>
                  </div>

                  {/* Feedback form */}
                  <div className="space-y-1.5 pt-3 border-t border-zinc-100">
                    <h4 className="text-xs font-bold text-zinc-400 uppercase tracking-wider text-[10px]">意見反映與聯絡我們</h4>
                    <textarea
                      value={helpFeedback}
                      onChange={(e) => setHelpFeedback(e.target.value)}
                      placeholder="請填寫您想要呈報的任何建議或在使用時遇到的問題..."
                      rows={3}
                      className="w-full bg-zinc-50 border border-zinc-200 rounded-xl p-3 text-xs focus:ring-2 focus:ring-[#006b2c] outline-none"
                    />
                  </div>

                  <button
                    onClick={() => {
                      if (!helpFeedback.trim()) {
                        onNotify('請先填寫反映意見內容。', 'warning');
                        return;
                      }
                      setFeedbackSent(true);
                      setHelpFeedback('');
                    }}
                    className="w-full bg-[#006b2c] hover:bg-[#005320] text-white py-3 rounded-xl text-xs font-bold flex items-center justify-center gap-1 cursor-pointer"
                  >
                    <Send className="w-4 h-4 shrink-0" />
                    發送反映意見
                  </button>
                </div>
              )}
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
