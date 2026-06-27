import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Bike } from '../types';
import { Radio, ScanLine, CreditCard, ChevronRight, CheckCircle, ShieldAlert, Wifi, Info, RotateCw } from 'lucide-react';

interface NfcTabProps {
  onAddBike: (newBike: Omit<Bike, 'id' | 'nfcBound'>) => void;
  onSwitchToTab: (tab: string) => void;
}

export default function NfcTab({ onAddBike, onSwitchToTab }: NfcTabProps) {
  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [model, setModel] = useState('');
  const [frameNo, setFrameNo] = useState('');
  const [ownerName, setOwnerName] = useState('');
  const [scanning, setScanning] = useState(false);
  const [scanSuccess, setScanSuccess] = useState(false);
  const [isSubmitSuccess, setIsSubmitSuccess] = useState(false);

  const startNfcScan = () => {
    setScanning(true);
    setScanSuccess(false);

    setTimeout(() => {
      setScanning(false);
      setScanSuccess(true);
      setStep(2);
      
      // Auto fill mock data from physical tag!
      setModel('City Cruiser X1');
      setFrameNo('HK-CCX-' + Math.floor(10000 + Math.random() * 90000));
      setOwnerName('單車愛好者');
    }, 1800);
  };

  const handleQrScanMock = () => {
    alert('正在啟動相機掃描單車 QR Code / 條形碼...');
    setFrameNo('HK-FRAME-' + Math.floor(10000 + Math.random() * 90000));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!model.trim() || !frameNo.trim() || !ownerName.trim()) {
      alert('請填寫所有欄位資料！');
      return;
    }

    setStep(3);
    setTimeout(() => {
      onAddBike({
        model,
        frameNo,
        ownerName
      });
      setIsSubmitSuccess(true);
    }, 1200);
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
            className="w-full bg-[#006b2c] hover:bg-[#005320] text-white py-3.5 rounded-xl font-bold text-sm flex items-center justify-center gap-1.5 transition-all shadow-md shadow-[#006b2c]/10 active:scale-95 cursor-pointer"
          >
            <Wifi className="w-4 h-4 fill-current shrink-0" />
            確認登記並上傳數據庫
          </button>
        </div>
      </form>

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
              <p className="text-xs text-zinc-500 mb-4 leading-relaxed">
                車款 <strong>{model}</strong> 經與您的智慧貼紙 NFC 配對成功。目前已將設備寫入香港智能單車管理中心，防盜防丟警報已啟動。
              </p>

              <div className="bg-zinc-50 p-3 rounded-xl text-xs text-zinc-500 mb-6 text-left space-y-1 my-2">
                <p>• <strong>車架號：</strong> {frameNo}</p>
                <p>• <strong>持有者：</strong> {ownerName}</p>
                <p>• <strong>NFC 感應編碼：</strong> RFID-TAG-X998</p>
              </div>

              <button
                onClick={handleCompleteFlow}
                className="w-full bg-[#006b2c] hover:bg-[#005320] text-white py-32 rounded-xl text-xs font-bold transition-transform active:scale-95 cursor-pointer block"
              >
                前往我的單車清單
              </button>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
