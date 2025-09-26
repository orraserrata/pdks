import win32serviceutil
import win32service
import win32event
import servicemanager
import sys
import os
import time
import logging
from src.sync import main

class PDKSSyncService(win32serviceutil.ServiceFramework):
    _svc_name_ = "PDKSSyncService"
    _svc_display_name_ = "PDKS Sync Service"
    _svc_description_ = "PDKS cihazından veri senkronizasyonu servisi"

    def __init__(self, args):
        win32serviceutil.ServiceFramework.__init__(self, args)
        self.hWaitStop = win32event.CreateEvent(None, 0, 0, None)
        
        # Çalışma dizinini ayarla
        script_dir = os.path.dirname(os.path.abspath(__file__))
        os.chdir(script_dir)
        
        # Log ayarları
        log_dir = os.path.join(script_dir, 'logs')
        os.makedirs(log_dir, exist_ok=True)
        
        logging.basicConfig(
            level=logging.INFO,
            format='%(asctime)s - %(levelname)s - %(message)s',
            handlers=[
                logging.FileHandler(os.path.join(log_dir, 'service.log')),
                logging.StreamHandler()
            ]
        )

    def SvcStop(self):
        self.ReportServiceStatus(win32service.SERVICE_STOP_PENDING)
        win32event.SetEvent(self.hWaitStop)

    def SvcDoRun(self):
        servicemanager.LogMsg(servicemanager.EVENTLOG_INFORMATION_TYPE,
                              servicemanager.PYS_SERVICE_STARTED,
                              (self._svc_name_, ''))
        self.main()

    def main(self):
        logging.info("PDKS Sync Service başlatıldı - 5 dakikada bir çalışacak")
        
        while True:
            # Servis durdurma sinyalini kontrol et
            rc = win32event.WaitForSingleObject(self.hWaitStop, 300000)  # 5 dakika = 300000 ms
            
            if rc == win32event.WAIT_OBJECT_0:
                # Servis durduruldu
                logging.info("PDKS Sync Service durduruldu")
                break
            
            # 5 dakika geçti, sync çalıştır
            try:
                logging.info("Sync başlatılıyor...")
                main()
                logging.info("Sync tamamlandı")
            except Exception as e:
                logging.error(f"Sync error: {e}")

if __name__ == '__main__':
    if len(sys.argv) == 1:
        servicemanager.Initialize()
        servicemanager.PrepareToHostSingle(PDKSSyncService)
        servicemanager.StartServiceCtrlDispatcher()
    else:
        win32serviceutil.HandleCommandLine(PDKSSyncService)


