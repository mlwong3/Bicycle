import React, { useState, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Bike } from '../types';
import { writeBikeTag, readBikeTag, isNfcSupported, classifyNfcError, BikeTagData } from '../nfc';
import { Radio, ScanLine, CreditCard, ChevronRight, CheckCircle, ShieldAlert, Wifi, Info, RotateCw, ShieldCheck, X } from 'lucide-react';

// 寫入 NFC 標籤的 App 網址（私隱優先：標籤只存編號與此網址，不含個資）
const APP_URL = 'https://bicycle-ee76c.web.app';

interface NfcTabProps {
  onAddBike: (newBike: Omit<Bike, 'id' | 'nfcBound'>) => void;
  onSwitchToTab: (tab: string) => void;
  onNotify: (message: string, tone?: 'success' | 'info' | 'warning' | 'error') => void;
}

export default function NfcTab({ onAddBike, onSwitchToTab, onNotify }: NfcTabProps) {
  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [model, setModel] = useState('');
  const [frameNo, setFrameNo] = useState('');
  const [ownerName, setOwnerName] = useState('');
  const [scanning, setScanning] = useState(false);
  const [scanSuccess, setScanSuccess] = useState(false);
  const [isSubmitSuccess, setIsSubmitSuccess] = useState(false);
  const [writing, setWriting] = useState(false);
  const [nfcMode, setNfcMode] = useState<'real' | 'sim'>('sim');
  const [nfcTagId, setNfcTagId] = useState('QJ-NFC-DEMO');
  // 防盜驗證：感應標籤讀回的識別資料
  const [verifying, setVerifying] = useState(false);
  const [verifiedTag, setVerifiedTag] = useState<BikeTagData | null>(null);
  const verifyAbortRef = useRef<AbortController | null>(null);
  // 登記流程「掃描標籤」用的中止控制器（逾時或重新掃描時取消上一次）
  const registerScanAbortRef = useRef<AbortController | null>(null);

  const createDemoTagId = (value: string) =>
    `QJ-NFC-${value.trim().replace(/[^a-zA-Z0-9]/g, '').slice(-6) || Math.floor(100000 + Math.random() * 900000)}`;

  // 由車架編號產生單車識別碼（寫入標籤的 bikeId，對應帳戶記錄）
  const createBikeId = (value: string) =>
    `bike-${value.trim().toLowerCase().replace(/[^a-z0-9]/g, '') || Date.now().toString(36)}`;

  // Web NFC 沒有獨立的「請求權限」按鈕——scan()/write() 第一次呼叫時瀏覽器會自動彈出
  // 系統權限提示；此函式只在使用者已經拒絕過（下次不再彈窗）時，給出對應的修復步驟。
  const nfcErrorMessage = (err: unknown, action: '寫入' | '讀取'): string => {
    switch (classifyNfcError(err)) {
      case 'not-supported':
        return '此裝置不支援 Web NFC（僅 Android 版 Chrome 89+ 支援）。';
      case 'permission-denied':
        return `尚未取得 NFC ${action}權限（可能先前按過「拒絕」）。請點瀏覽器網址列左側鎖頭圖示 → 網站設定 → 找到「感應器 / NFC」→ 改為允許，並確認手機系統設定已開啟 NFC，然後重新整理頁面再試一次。`;
      case 'aborted':
        return '';
      default:
        // 顯示 nfc.ts 拋出的實際錯誤內容（例如「找不到符合格式的 JSON 記錄」），
        // 而不是一律用通用文字蓋掉，這樣才看得出確切失敗原因方便排查。
        return err instanceof Error && err.message ? err.message : `${action}失敗，請將手機貼近標籤再試一次。`;
    }
  };

  // 掃描標籤：真實讀取貼在單車上的 NFC 標籤，把 tagId/frameNo 自動填入下方表單
  // （型號、車主姓名依私隱優先設計不會寫在標籤上，仍需手動輸入）。
  // 不支援 Web NFC 的裝置（桌面 / iOS）才退回模擬填入，方便展示介面流程。
  const startNfcScan = async () => {
    setScanning(true);
    setScanSuccess(false);

    if (!isNfcSupported()) {
      setTimeout(() => {
        setScanning(false);
        setScanSuccess(true);
        setStep(2);
        setModel('City Cruiser X1');
        const frame = 'HK-CCX-' + Math.floor(10000 + Math.random() * 90000);
        setFrameNo(frame);
        setNfcTagId(createDemoTagId(frame));
        setOwnerName('單車愛好者');
        onNotify('此裝置不支援 Web NFC，已用模擬資料示範流程。', 'info');
      }, 1200);
      return;
    }

    registerScanAbortRef.current?.abort();
    const controller = new AbortController();
    registerScanAbortRef.current = controller;
    const timeoutId = window.setTimeout(() => controller.abort(), 10000); // 10 秒偵測不到即逾時

    try {
      const tag = await readBikeTag(controller.signal);
      window.clearTimeout(timeoutId);
      setScanning(false);
      setScanSuccess(true);
      setStep(2);
      setFrameNo(tag.frameNo);
      setNfcTagId(tag.tagId);
      onNotify('已讀取標籤資料，請補上單車型號與車主姓名後送出。', 'success');
    } catch (err) {
      window.clearTimeout(timeoutId);
      setScanning(false);
      const detail = nfcErrorMessage(err, '讀取');
      onNotify(detail || '未偵測到標籤資料，可能是全新空白標籤，請直接手動填寫下方欄位。', 'warning');
    }
  };

  const handleQrScanMock = () => {
    const frame = 'HK-FRAME-' + Math.floor(10000 + Math.random() * 90000);
    setFrameNo(frame);
    setNfcTagId(createDemoTagId(frame));
    onNotify('已以 QR / 條碼模擬方式填入車架編號。', 'info');
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!model.trim() || !frameNo.trim() || !ownerName.trim()) {
      onNotify('請先填寫單車型號、車架編號及車主姓名。', 'warning');
      return;
    }

    const tagId = nfcTagId || createDemoTagId(frameNo);
    // 寫入標籤的私隱優先資料（只含編號與網址，不含姓名 / 型號）
    const tagPayload: BikeTagData = { tagId, bikeId: createBikeId(frameNo), frameNo, appUrl: APP_URL };
    // 存入帳戶 / 雲端的完整記錄（型號、車主留在帳戶，不寫入實體標籤）
    const newBike = { model, frameNo, ownerName, nfcTagId: tagId };
    setStep(3);
    setWriting(true);

    try {
      // 嘗試真實 NFC 寫入（需 Android Chrome 89+、HTTPS、使用者手勢；
      // 第一次呼叫瀏覽器會自動彈出「允許使用 NFC？」的系統權限提示）
      await writeBikeTag(tagPayload);
      setNfcMode('real');
      onNotify('NFC 標籤已完成實體寫入。', 'success');
    } catch (err) {
      // 不支援、無權限或寫入失敗 → 退回模擬流程，但清楚告知原因（尤其是權限被拒的修復方法）
      await new Promise((resolve) => setTimeout(resolve, 1200));
      setNfcMode('sim');
      const detail = nfcErrorMessage(err, '寫入');
      onNotify(detail ? `${detail}（已改用模擬流程保留展示效果）` : '已改用模擬流程保留展示效果。', 'warning');
    }

    onAddBike(newBike);
    setWriting(false);
    setIsSubmitSuccess(true);
  };

  // 防盜驗證：感應實體標籤，讀回並顯示識別資料（真 NFC 讀取）
  const handleVerifyScan = async () => {
    setVerifying(true);
    verifyAbortRef.current?.abort();
    const controller = new AbortController();
    verifyAbortRef.current = controller;
    try {
      // 第一次呼叫會由瀏覽器自動彈出「允許使用 NFC？」的系統權限提示（需使用者手勢觸發，此按鈕點擊即滿足）
      const tag = await readBikeTag(controller.signal);
      setVerifiedTag(tag);
      onNotify('已讀取 NFC 標籤，車輛身分驗證成功。', 'success');
    } catch (err) {
      const detail = nfcErrorMessage(err, '讀取');
      if (detail) onNotify(detail, 'error');
    } finally {
      setVerifying(false);
    }
  };

  const handleCompleteFlow = () => {
    setIsSubmitSuccess(false);
    onSwitchToTab('personal'); // Directly forward user to Personal center to see updated bike lists
  };

  return (
    <div id="nfctab-root" className="px-5 py-6 max-w-2xl mx-auto w-full font-sans text-zinc-800 pb-24">
      {/* 1. Progress Step Indicators */}
      <div id="nfc-progress-indicator" className="flex items-center justify-between text-xs font-semibold text-zinc-400 mb-8 max-w-sm mx-auto">
        <div className={`flex flex-col items-center gap-1.5 transition-colors ${step >= 1 ? 'text-[#006b2c]' : ''}`}>
          <div className={`w-8 h-8 rounded-full flex items-center justify-center font-bold border transition-all ${
            step >= 1 ? 'bg-[#006b2c]/10 border-[#006b2c] text-[#006b2c]' : 'bg-zinc-50 border-zinc-200'
          }`}>
            1
          </div>
          <span>掃描標籤</span>
        </div>
        <div className={`flex-grow h-px mx-4 border-t-2 border-dashed ${step >= 2 ? 'border-[#006b2c]' : 'border-zinc-200'}`} />
        
        <div className={`flex flex-col items-center gap-1.5 transition-colors ${step >= 2 ? 'text-[#006b2c]' : ''}`}>
          <div className={`w-8 h-8 rounded-full flex items-center justify-center font-bold border transition-all ${
            step >= 2 ? 'bg-[#006b2c]/10 border-[#006b2c] text-[#006b2c]' : 'bg-zinc-50 border-zinc-200'
          }`}>
            2
          </div>
          <span>輸入資料</span>
        </div>
        <div className={`flex-grow h-px mx-4 border-t-2 border-dashed ${step >= 3 ? 'border-[#006b2c]' : 'border-zinc-200'}`} />

        <div className={`flex flex-col items-center gap-1.5 transition-colors ${step >= 3 ? 'text-[#006b2c]' : ''}`}>
          <div className={`w-8 h-8 rounded-full flex items-center justify-center font-bold border transition-all ${
            step >= 3 ? 'bg-[#006b2c]/10 border-[#006b2c] text-[#006b2c]' : 'bg-zinc-50 border-zinc-200'
          }`}>
            3
          </div>
          <span>上傳數據</span>
        </div>
      </div>

      {/* 2. Scanning Area */}
      <div id="nfc-scanning-section" className="flex flex-col items-center justify-center gap-4 py-4 text-center">
        <div 
          onClick={scanning ? undefined : startNfcScan}
          className="relative w-56 h-56 rounded-full bg-zinc-50 flex items-center justify-center border border-zinc-200 hover:border-[#006b2c] shadow-sm select-none cursor-pointer overflow-hidden group transition-all"
        >
          {/* NFC Graphic background */}
          <img
            src="https://lh3.googleusercontent.com/aida-public/AB6AXuDnF6cHk77_QD65MBb41iAukrv-mciayp7k2DopTJO9TXNoMIgfXzBDYwCNpjYSaljyGcNAfAvNQ7M37az6E0iMA7mano1WK_axHu0TmHIJwBy9QDGI5vu656m8RYD6Vfz8qt28CQswWEpbzDeqVvp2QV-KHX5RmECoV-is2M5ijfFzzgXQHNBNPwXwn1mvKi8_JP7V9Bo5y1DyvoKGnjjvyvX_Nf-tJ-tuTPb8R16Ey2BvB_imOIQpiFIuojIFQM4FdS9YYEF63pKk"
            alt="NFC感應設計圖示"
            referrerPolicy="no-referrer"
            className="w-full h-full object-cover mix-blend-multiply"
          />

          {/* Animation Wave ripple overlays */}
          {scanning ? (
            <div className="absolute inset-0 bg-[#006b2c]/15 flex flex-col items-center justify-center text-center backdrop-blur-[1px]">
              <RotateCw className="w-10 h-10 text-[#006b2c] animate-spin mb-2" />
              <p className="text-xs font-bold text-[#006b2c] tracking-wider animate-pulse">正在感應 NFC 貼紙...</p>
            </div>
          ) : scanSuccess ? (
            <div className="absolute inset-0 bg-[#006b2c]/20 flex flex-col items-center justify-center text-center">
              <CheckCircle className="w-12 h-12 text-[#006b2c] mb-1.5" />
              <p className="text-xs font-black text-[#006b2c] tracking-wider">標籤讀取成功！</p>
              <p className="text-[10px] text-[#006b2c]/80 mt-0.5">點選以重新感應</p>
            </div>
          ) : (
            <div className="absolute inset-0 bg-transparent flex items-center justify-center pointer-events-none rounded-full ring-4 ring-[#006b2c] ring-opacity-0 group-hover:ring-opacity-20 transition-all duration-300 animate-pulse" />
          )}
        </div>

        <div className="space-y-1">
          <p id="nfc-prompt-headline" className="font-bold text-[#006b2c] text-sm flex items-center justify-center gap-1">
            <Radio className="w-4 h-4 animate-pulse shrink-0" />
            點擊圓盤感應 / 手機靠近 NFC 貼紙
          </p>
          <p id="nfc-prompt-desc" className="text-zinc-400 text-xs py-1">
            透過 NFC 迅速為車架取得感應與註冊碼
          </p>
        </div>
      </div>

      {/* 3. Form input Fields */}
      <form onSubmit={handleSubmit} className="mt-4 bg-zinc-50 border border-zinc-200/80 p-5 rounded-2xl space-y-4">
        {/* Model */}
        <div className="flex flex-col gap-1.5">
          <label className="text-xs font-bold text-zinc-500 uppercase tracking-wider">單車型號</label>
          <div className="relative">
            <CreditCard className="absolute left-3.5 top-1/2 -translate-y-1/2 text-zinc-400 w-4 h-4" />
            <input
              type="text"
              value={model}
              onChange={(e) => {
                setModel(e.target.value);
                if (step === 1 && e.target.value) setStep(2);
              }}
              placeholder="例如: City Cruiser X1"
              className="w-full pl-10 pr-4 py-3 bg-white border border-zinc-200 rounded-xl text-xs font-medium focus:ring-2 focus:ring-[#006b2c] focus:border-transparent outline-none shadow-sm text-zinc-800 placeholder:text-zinc-300 transition-all"
            />
          </div>
        </div>

        {/* Frame Number */}
        <div className="flex flex-col gap-1.5">
          <label className="text-xs font-bold text-zinc-500 uppercase tracking-wider">車架編號</label>
          <div className="relative">
            <ScanLine className="absolute left-3.5 top-1/2 -translate-y-1/2 text-zinc-400 w-4 h-4" />
            <input
              type="text"
              value={frameNo}
              onChange={(e) => {
                setFrameNo(e.target.value);
                if (step === 1 && e.target.value) setStep(2);
              }}
              placeholder="掃描感應或自動填寫"
              className="w-full pl-10 pr-24 py-3 bg-white border border-zinc-200 rounded-xl text-xs font-medium focus:ring-2 focus:ring-[#006b2c] focus:border-transparent outline-none shadow-sm text-zinc-800 placeholder:text-zinc-300 transition-all"
            />
            <button
              type="button"
              onClick={handleQrScanMock}
              className="absolute right-2 top-1/2 -translate-y-1/2 text-xs font-bold bg-zinc-100 hover:bg-zinc-200 border border-zinc-200 text-zinc-600 px-2.5 py-1.5 rounded-lg transition-colors cursor-pointer"
            >
              掃描二維碼
            </button>
          </div>
        </div>

        {/* Owner Name */}
        <div className="flex flex-col gap-1.5">
          <label className="text-xs font-bold text-zinc-500 uppercase tracking-wider">車主姓名</label>
          <div className="relative">
            <svg className="absolute left-3.5 top-1/2 -translate-y-1/2 text-zinc-400 w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path>
              <circle cx="12" cy="7" r="4"></circle>
            </svg>
            <input
              type="text"
              value={ownerName}
              onChange={(e) => setOwnerName(e.target.value)}
              placeholder="登記姓名 (預設為當前帳戶)"
              className="w-full pl-10 pr-4 py-3 bg-white border border-zinc-200 rounded-xl text-xs font-medium focus:ring-2 focus:ring-[#006b2c] focus:border-transparent outline-none shadow-sm text-zinc-800 placeholder:text-zinc-300 transition-all"
            />
          </div>
        </div>

        {/* Action Button */}
        <div className="pt-2">
          <button
            type="submit"
            disabled={writing}
            className="w-full bg-[#006b2c] hover:bg-[#005320] text-white py-3.5 rounded-xl font-bold text-sm flex items-center justify-center gap-1.5 transition-all shadow-md shadow-[#006b2c]/10 active:scale-95 cursor-pointer disabled:bg-zinc-400"
          >
            <Wifi className="w-4 h-4 fill-current shrink-0" />
            {writing ? '正在寫入 NFC 標籤…' : '確認登記並上傳數據庫'}
          </button>
          <p className="text-[10px] text-zinc-400 text-center font-medium">
            {isNfcSupported()
              ? '本裝置支援 Web NFC，提交時請將手機靠近單車上的 NFC 標籤完成寫入。'
              : '本裝置不支援 Web NFC（僅 Android 版 Chrome），將以模擬方式示範。'}
          </p>
        </div>
      </form>

      {/* 防盜驗證：感應已寫入的實體標籤，讀回並顯示識別資料 */}
      <div className="mt-4 bg-white border border-zinc-200/80 p-4 rounded-2xl">
        <div className="flex items-center gap-2 mb-1">
          <ShieldCheck className="w-4 h-4 text-[#006b2c] shrink-0" />
          <h4 className="text-xs font-black text-zinc-700">防盜驗證・感應標籤讀取</h4>
        </div>
        <p className="text-[10px] text-zinc-400 leading-relaxed mb-3">
          懷疑單車被盜或想核對身分時，按此鈕並將手機貼近車上的 NFC 標籤，讀回標籤編號、車架號等識別資料。
        </p>
        <button
          type="button"
          onClick={handleVerifyScan}
          disabled={verifying}
          className="w-full border-2 border-[#006b2c] text-[#006b2c] hover:bg-[#006b2c]/5 py-2.5 rounded-xl font-bold text-xs flex items-center justify-center gap-1.5 transition-all active:scale-95 cursor-pointer disabled:opacity-50"
        >
          <ScanLine className={`w-4 h-4 shrink-0 ${verifying ? 'animate-pulse' : ''}`} />
          {verifying ? '感應中，請貼近標籤…' : '感應標籤・驗證單車身分'}
        </button>
      </div>

      {/* 4. Complete Flow Success Box Dialog */}
      <AnimatePresence>
        {isSubmitSuccess && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="bg-white rounded-2xl p-6 shadow-2xl max-w-sm w-full border border-zinc-100 text-center"
            >
              <CheckCircle className="w-16 h-16 text-[#006b2c] mx-auto mb-4" />
              <h3 className="text-base font-bold text-zinc-950 mb-1">感應登記成功！</h3>

              {/* 標示本次是真實 NFC 寫入還是模擬 */}
              <div className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-black mb-3 border ${
                nfcMode === 'real'
                  ? 'bg-[#006b2c]/10 text-[#006b2c] border-[#006b2c]/20'
                  : 'bg-amber-50 text-amber-600 border-amber-100'
              }`}>
                <Wifi className="w-3 h-3" />
                {nfcMode === 'real' ? '已透過裝置 NFC 實體寫入標籤' : '模擬寫入（此裝置不支援 Web NFC）'}
              </div>

              <p className="text-xs text-zinc-500 mb-4 leading-relaxed">
                {nfcMode === 'real' ? (
                  <>車款 <strong>{model}</strong> 的資料已實際寫入貼在單車上的 NFC 標籤，並登記至防盜防丟系統。</>
                ) : (
                  <>車款 <strong>{model}</strong> 已完成登記。本裝置不支援 Web NFC（僅 Android 版 Chrome 支援），故以模擬方式示範寫入流程。</>
                )}
              </p>

              <div className="bg-zinc-50 p-3 rounded-xl text-xs text-zinc-500 mb-3 text-left space-y-1 my-2">
                <p>• <strong>車架號：</strong> {frameNo}</p>
                <p>• <strong>持有者：</strong> {ownerName}</p>
                <p>• <strong>NFC 標籤編號：</strong> {nfcTagId}</p>
              </div>
              <div className="flex items-start gap-1.5 text-[10px] text-zinc-400 mb-6 text-left leading-relaxed">
                <Info className="w-3.5 h-3.5 shrink-0 mt-px text-[#006b2c]" />
                <span>私隱保護：NFC 標籤只寫入標籤編號、車架號與 App 網址，<strong>不含姓名</strong>；車主資料只保存在你的帳戶。</span>
              </div>

              <button
                onClick={handleCompleteFlow}
                className="w-full bg-[#006b2c] hover:bg-[#005320] text-white py-3 rounded-xl text-xs font-bold transition-transform active:scale-95 cursor-pointer block"
              >
                前往我的單車清單
              </button>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* 5. 防盜驗證讀取結果 */}
      <AnimatePresence>
        {verifiedTag && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="bg-white rounded-2xl p-6 shadow-2xl max-w-sm w-full border border-zinc-100 text-center relative"
            >
              <button
                onClick={() => setVerifiedTag(null)}
                className="absolute top-3 right-3 text-zinc-400 hover:text-zinc-600 cursor-pointer"
                aria-label="關閉"
              >
                <X className="w-4 h-4" />
              </button>
              <ShieldCheck className="w-16 h-16 text-[#006b2c] mx-auto mb-3" />
              <h3 className="text-base font-bold text-zinc-950 mb-1">標籤驗證成功</h3>
              <p className="text-xs text-zinc-500 mb-4 leading-relaxed">已從實體 NFC 標籤讀回以下識別資料。</p>

              <div className="bg-zinc-50 p-3 rounded-xl text-xs text-zinc-500 mb-6 text-left space-y-1">
                <p>• <strong>標籤編號：</strong> {verifiedTag.tagId}</p>
                <p>• <strong>單車識別碼：</strong> {verifiedTag.bikeId}</p>
                <p>• <strong>車架號：</strong> {verifiedTag.frameNo}</p>
                <p className="truncate">• <strong>App 網址：</strong> {verifiedTag.appUrl}</p>
              </div>

              <button
                onClick={() => setVerifiedTag(null)}
                className="w-full bg-[#006b2c] hover:bg-[#005320] text-white py-3 rounded-xl text-xs font-bold transition-transform active:scale-95 cursor-pointer block"
              >
                完成
              </button>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
