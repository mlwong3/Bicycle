import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Bike, Report } from './types';
import { INITIAL_BIKES, INITIAL_REPORTS } from './data';

import Onboarding from './components/Onboarding';
import MapTab from './components/MapTab';
import ReportTab from './components/ReportTab';
import NfcTab from './components/NfcTab';
import PersonalTab from './components/PersonalTab';
import MenuSidebar from './components/MenuSidebar';
import SettingsModal from './components/SettingsModal';

import { Menu, Settings, Map, AlertTriangle, Cpu, User, Share2, Award, LogOut } from 'lucide-react';

export default function App() {
  // --- LocalStorage Initialization ---
  const [hasCompletedOnboarding, setHasCompletedOnboarding] = useState<boolean>(() => {
    const saved = localStorage.getItem('hk_bike_onboarding_done');
    return saved === 'true';
  });

  const [bikes, setBikes] = useState<Bike[]>(() => {
    const saved = localStorage.getItem('hk_bike_registered_list');
    return saved ? JSON.parse(saved) : INITIAL_BIKES;
  });

  const [reports, setReports] = useState<Report[]>(() => {
    const saved = localStorage.getItem('hk_bike_reports_history');
    return saved ? JSON.parse(saved) : INITIAL_REPORTS;
  });

  const [savedParkingIds, setSavedParkingIds] = useState<string[]>(() => {
    const saved = localStorage.getItem('hk_bike_saved_parking_spots');
    return saved ? JSON.parse(saved) : ['parking-1']; // Preset park-1 saved
  });

  const [userScore, setUserScore] = useState<number>(() => {
    const saved = localStorage.getItem('hk_bike_user_green_score');
    return saved ? parseInt(saved, 10) : 450;
  });

  const [currentTab, setCurrentTab] = useState<string>(() => {
    const saved = localStorage.getItem('hk_bike_current_active_tab');
    return saved || 'report'; // Preset to 'report' as requested by picture 1
  });

  const [language, setLanguage] = useState<string>(() => {
    const saved = localStorage.getItem('hk_bike_display_language');
    return saved || 'zh';
  });

  // --- Sidebar & Settings states ---
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);

  // --- Persist state updates ---
  useEffect(() => {
    localStorage.setItem('hk_bike_onboarding_done', String(hasCompletedOnboarding));
  }, [hasCompletedOnboarding]);

  useEffect(() => {
    localStorage.setItem('hk_bike_registered_list', JSON.stringify(bikes));
  }, [bikes]);

  useEffect(() => {
    localStorage.setItem('hk_bike_reports_history', JSON.stringify(reports));
  }, [reports]);

  useEffect(() => {
    localStorage.setItem('hk_bike_saved_parking_spots', JSON.stringify(savedParkingIds));
  }, [savedParkingIds]);

  useEffect(() => {
    localStorage.setItem('hk_bike_user_green_score', String(userScore));
  }, [userScore]);

  useEffect(() => {
    localStorage.setItem('hk_bike_current_active_tab', currentTab);
  }, [currentTab]);

  useEffect(() => {
    localStorage.setItem('hk_bike_display_language', language);
  }, [language]);

  // --- Handlers ---
  const handleOnboardingComplete = () => {
    setHasCompletedOnboarding(true);
  };

  const handleAddBike = (newBikeData: Omit<Bike, 'id' | 'nfcBound'>) => {
    const newBike: Bike = {
      id: 'bike-' + Math.random().toString(36).substring(2, 9),
      model: newBikeData.model,
      frameNo: newBikeData.frameNo,
      ownerName: newBikeData.ownerName,
      nfcBound: true // Registered from NFC page are always bound
    };
    setBikes((prev) => [newBike, ...prev]);
    setUserScore((prev) => prev + 50); // +50 scores award
  };

  const handleUnbindBike = (id: string) => {
    setBikes((prev) => prev.filter(bike => bike.id !== id));
  };

  const handleAddReport = (newReportData: Omit<Report, 'id' | 'status' | 'date'>) => {
    const newReport: Report = {
      id: 'report-' + Math.random().toString(36).substring(2, 9),
      location: newReportData.location,
      description: newReportData.description,
      imageUrl: newReportData.imageUrl,
      status: 'pending',
      date: new Date().toISOString().split('T')[0]
    };
    setReports((prev) => [newReport, ...prev]);
    setUserScore((prev) => prev + 50); // Award score for reporting
  };

  const toggleSaveParking = (id: string) => {
    setSavedParkingIds((prev) => {
      if (prev.includes(id)) {
        return prev.filter(item => item !== id);
      } else {
        return [...prev, id];
      }
    });
  };

  const handleResetApplication = () => {
    localStorage.clear();
    setHasCompletedOnboarding(false);
    setBikes(INITIAL_BIKES);
    setReports(INITIAL_REPORTS);
    setSavedParkingIds(['parking-1']);
    setUserScore(450);
    setCurrentTab('report');
    setLanguage('zh');
  };

  // Switch tabs
  const handleSelectTab = (tab: string) => {
    setCurrentTab(tab);
  };

  // If onboarding hasn't completed, show walk-through sliders
  if (!hasCompletedOnboarding) {
    return <Onboarding onComplete={handleOnboardingComplete} />;
  }

  // --- UI Elements ---
  const currentTabName = () => {
    switch (currentTab) {
      case 'map': return language === 'zh' ? '地圖導航' : 'Map Route';
      case 'report': return language === 'zh' ? '單車管理' : 'Bike Manager';
      case 'nfc': return language === 'zh' ? '單車管理' : 'Bike Manager';
      case 'personal': return language === 'zh' ? '單車管理' : 'Bike Manager';
      default: return '單車管理';
    }
  };

  return (
    <div id="app-wrapper" className="h-screen w-screen bg-[#fcf9f8] text-zinc-800 antialiased font-sans flex flex-col md:flex-row overflow-hidden">
      
      {/* 2. Web Side Navigation (Hidden on Mobile) */}
      <nav id="web-side-navbar" className="hidden md:flex flex-col h-full w-80 rounded-r-2xl bg-white border-r border-zinc-200 shadow-xl z-40 shrink-0">
        <div className="p-6 flex items-center gap-4 border-b border-zinc-100">
          <div className="w-12 h-12 rounded-full overflow-hidden border-2 border-[#006b2c] bg-[#006b2c]/10 flex items-center justify-center">
            <img
              src="https://lh3.googleusercontent.com/aida-public/AB6AXuB2GAAAL_i2PXfsqLZhfn3lsWWF6-uK4QKsdNZXuI2kUvCtks39JCewGLAw-svhbdzIe6QpU5g26GcIg6BlkuPVCAIjF9CFcNYq4jYlsF6_0kYZPIVbMgIX0L0wael4Geq8nx2m_2HWe_i7AVVaKgeoFTjQqthcvbs2Pr5PDFoT61mDc_0-evvpZgpKSOEzomorvS7N9CnG0bloy9FSOh7SY8VOwsHMo_DlTXJx1XW-dHU2qH0VyZXiKXy3Nm0tq_xE1LL57K3grA8A"
              alt="User profile"
              referrerPolicy="no-referrer"
              className="w-full h-full object-cover"
            />
          </div>
          <div>
            <h2 className="font-bold text-sm text-zinc-900 leading-tight">單車愛好者</h2>
            <p className="text-[10px] text-zinc-400 font-bold mt-1">綠色騎士 Lv.3</p>
            <p className="font-bold text-[#006b2c] text-[10px] mt-0.5">綠色積分: {userScore}</p>
          </div>
        </div>

        {/* Vertical menus */}
        <div className="flex-1 flex flex-col p-4 space-y-1.5 overflow-y-auto">
          {[
            { id: 'map', name: '地圖導航', icon: Map },
            { id: 'report', name: '違規舉報與回收', icon: AlertTriangle },
            { id: 'nfc', name: 'NFC 登記保護', icon: Cpu },
            { id: 'personal', name: '個人中心 & 數據', icon: User },
          ].map((tab) => {
            const Icon = tab.icon;
            const isActive = currentTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => handleSelectTab(tab.id)}
                className={`flex items-center gap-3.5 px-4 py-3 rounded-xl transition-all font-bold text-xs cursor-pointer text-left ${
                  isActive
                    ? 'bg-[#006b2c] text-white shadow-lg shadow-[#006b2c]/15'
                    : 'text-zinc-600 hover:bg-[#006b2c]/5 hover:text-zinc-950'
                }`}
              >
                <Icon className={`w-4.5 h-4.5 shrink-0 ${isActive ? 'stroke-[2.5px]' : ''}`} />
                <span>{tab.name}</span>
              </button>
            );
          })}
        </div>

        <div className="p-6 border-t border-zinc-100 flex flex-col gap-2.5 text-[10px] text-zinc-400 font-bold">
          <button
            onClick={() => setIsSettingsOpen(true)}
            className="flex items-center gap-2 hover:text-[#006b2c] transition-colors text-left cursor-pointer"
          >
            <Settings className="w-4 h-4 text-zinc-400" />
            <span>設置及系統重設</span>
          </button>
          <button
            onClick={() => handleResetApplication()}
            className="flex items-center gap-2 text-rose-500 hover:text-rose-600 transition-colors text-left cursor-pointer"
          >
            <LogOut className="w-4 h-4" />
            <span>登出引導教學</span>
          </button>
        </div>
      </nav>

      {/* 3. Main Content Container Panel */}
      <main id="app-main-view" className="flex-1 flex flex-col h-full min-h-0 overflow-hidden relative">
        
        {/* Top App Bar (Visible on mobile as header, adaptive spacing on desktop) */}
        <header id="mobile-top-bar" className="w-full top-0 sticky bg-[#fcf9f8] border-b border-zinc-100 z-30 flex justify-between items-center px-5 py-3 shrink-0 select-none">
          <button
            id="menu-trigger-btn"
            onClick={() => setIsMenuOpen(true)}
            className="p-2 -ml-2 text-zinc-600 hover:bg-zinc-100 rounded-full transition-colors active:scale-95 cursor-pointer shrink-0"
            aria-label="打開菜單"
          >
            <Menu className="w-5.5 h-5.5" />
          </button>
          
          <h1 id="header-headline" className="font-bold text-[#006b2c] text-lg tracking-tight">
            {currentTabName()}
          </h1>

          <button
            id="settings-trigger-btn"
            onClick={() => setIsSettingsOpen(true)}
            className="p-2 -mr-2 text-zinc-600 hover:bg-zinc-100 rounded-full transition-colors active:scale-95 cursor-pointer shrink-0"
            aria-label="打開設置"
          >
            <Settings className="w-5.5 h-5.5" />
          </button>
        </header>

        {/* View Transition Frame */}
        <div id="main-view-scroll-viewport" className="flex-grow w-full relative bg-white flex flex-col min-h-0">
          <AnimatePresence mode="wait">
            <motion.div
              key={currentTab}
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -12 }}
              transition={{ duration: 0.25 }}
              className={`w-full h-full flex flex-col min-h-0 ${
                currentTab !== 'map' ? 'overflow-y-auto overflow-x-hidden' : 'overflow-hidden'
              }`}
            >
              {currentTab === 'map' && (
                <MapTab 
                  savedParkingIds={savedParkingIds} 
                  toggleSaveParking={toggleSaveParking} 
                />
              )}
              {currentTab === 'report' && (
                <ReportTab 
                  onAddReport={handleAddReport} 
                />
              )}
              {currentTab === 'nfc' && (
                <NfcTab 
                  onAddBike={handleAddBike} 
                  onSwitchToTab={handleSelectTab} 
                />
              )}
              {currentTab === 'personal' && (
                <PersonalTab 
                  bikes={bikes}
                  reports={reports}
                  savedParkingCount={savedParkingIds.length}
                  userScore={userScore}
                  onUnbindBike={handleUnbindBike}
                  onNavigateToTab={handleSelectTab}
                  language={language}
                  onChangeLanguage={setLanguage}
                />
              )}
            </motion.div>
          </AnimatePresence>
        </div>

        {/* 4. Mobile Bottom Tab Navigation (Floating fixed dock at bottom) */}
        <nav id="mobile-bottom-dock" className="md:hidden fixed bottom-0 left-0 right-0 z-45 bg-white border-t border-zinc-200/80 shadow-2xl flex justify-around items-center px-4 pb-4 pt-2 select-none">
          {[
            { id: 'map', name: '地圖', icon: Map },
            { id: 'report', name: '舉報', icon: AlertTriangle },
            { id: 'nfc', name: 'NFC', icon: Cpu },
            { id: 'personal', name: '個人', icon: User }
          ].map((tab) => {
            const Icon = tab.icon;
            const isActive = currentTab === tab.id;
            return (
              <button
                key={tab.id}
                id={`mobile-tab-btn-${tab.id}`}
                onClick={() => handleSelectTab(tab.id)}
                className={`flex flex-col items-center justify-center p-1 cursor-pointer transition-transform duration-200 active:scale-90 w-16 h-12 rounded-xl text-center group ${
                  isActive ? 'scale-100' : 'scale-95'
                }`}
              >
                <Icon className={`w-5 h-5 mb-1 shrink-0 ${
                  isActive 
                    ? 'text-[#006b2c] stroke-[2.5px] fill-[#006b2c]/10' 
                    : 'text-zinc-400 group-hover:text-zinc-600'
                }`} />
                <span className={`text-[9px] font-black tracking-wider block ${
                  isActive ? 'text-[#006b2c]' : 'text-zinc-400 group-hover:text-zinc-600'
                }`}>
                  {tab.name}
                </span>
              </button>
            );
          })}
        </nav>
      </main>

      {/* 5. Drawers / Overlays */}
      <AnimatePresence>
        {isMenuOpen && (
          <MenuSidebar
            isOpen={isMenuOpen}
            onClose={() => setIsMenuOpen(false)}
            activeTab={currentTab}
            onSelectTab={handleSelectTab}
            userScore={userScore}
          />
        )}
        {isSettingsOpen && (
          <SettingsModal
            isOpen={isSettingsOpen}
            onClose={() => setIsSettingsOpen(false)}
            onResetData={handleResetApplication}
          />
        )}
      </AnimatePresence>
    </div>
  );
}
