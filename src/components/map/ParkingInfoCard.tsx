import { Compass, Navigation, Bookmark, BookmarkCheck } from 'lucide-react';
import { ParkingSpot } from '../../types';

interface ParkingInfoCardProps {
  spot: ParkingSpot;
  isSaved: boolean;
  onStartNavigation: () => void;
  onToggleSave: () => void;
}

// 地圖下方泊位資訊卡（顯示運輸署開放數據泊位的真實屬性）。
// 進出場動畫由外層 MapTab 的 motion.div 包裝負責，本元件只負責內容。
export default function ParkingInfoCard({ spot, isSaved, onStartNavigation, onToggleSave }: ParkingInfoCardProps) {
  return (
    <div className="bg-white rounded-3xl shadow-2xl border border-zinc-100 p-4 font-sans">
      <div className="flex justify-between items-start">
        <div>
          <span className="text-[9px] bg-green-50 text-[#006b2c] border border-green-100 px-2 py-0.5 rounded font-black tracking-wider block w-max uppercase mb-1">
            運輸署開放數據
          </span>
          <h3 className="text-sm font-black text-zinc-900 tracking-tight leading-tight">{spot.name}</h3>
          <p className="text-[10px] text-zinc-400 mt-1 flex items-center font-bold">
            <Compass className="w-3.5 h-3.5 mr-1 text-[#006b2c] shrink-0" />
            {spot.distance} • {spot.type}
          </p>
          <p className="text-[8px] text-zinc-400 font-bold mt-0.5 tracking-tight">
            © 運輸署 (TD) 單車資訊開放數據 / CSDI
          </p>
        </div>
        <div className={`px-2.5 py-1 rounded-full flex items-center gap-1 border text-[10px] font-black ${
          spot.totalSlots === 0
            ? 'bg-rose-50 border-rose-100 text-rose-500'
            : 'bg-green-50 border-green-100 text-[#006b2c]'
        }`}>
          <span className="w-1.5 h-1.5 rounded-full bg-current" />
          <span>登記車位: {spot.totalSlots}</span>
        </div>
      </div>

      <div className="flex gap-2.5 mt-3 pt-2.5 border-t border-zinc-50">
        <button
          onClick={onStartNavigation}
          disabled={spot.availableSlots === 0}
          className={`flex-1 font-bold py-2.5 px-4 rounded-xl flex justify-center items-center gap-1.5 text-xs transition-colors cursor-pointer ${
            spot.availableSlots === 0
              ? 'bg-zinc-100 text-zinc-400 cursor-not-allowed'
              : 'bg-[#006b2c] hover:bg-[#005320] text-white shadow-md shadow-[#006b2c]/10'
          }`}
        >
          <Navigation className="w-3.5 h-3.5" />
          開始路線導航
        </button>

        <button
          onClick={onToggleSave}
          className="p-2.5 border border-zinc-200 text-zinc-500 hover:text-[#006b2c] hover:border-[#006b2c]/30 rounded-xl flex items-center justify-center transition-colors cursor-pointer"
          title={isSaved ? '取消收藏' : '收藏泊車區'}
        >
          {isSaved ? (
            <BookmarkCheck className="w-4 h-4 text-[#006b2c] fill-current" />
          ) : (
            <Bookmark className="w-4 h-4" />
          )}
        </button>
      </div>
    </div>
  );
}
