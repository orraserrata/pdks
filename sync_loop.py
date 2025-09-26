import time
import logging
import os
import sys
from src.sync import main

# Çalışma dizinini proje kök dizinine ayarla
script_dir = os.path.dirname(os.path.abspath(__file__))
os.chdir(script_dir)

# Log klasörünü oluştur
log_dir = os.path.join(script_dir, 'logs')
os.makedirs(log_dir, exist_ok=True)

# Log ayarları
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(levelname)s - %(message)s',
    handlers=[
        logging.FileHandler(os.path.join(log_dir, 'sync.log')),
        logging.StreamHandler()
    ]
)

if __name__ == "__main__":
    logging.info("PDKS Sync başlatıldı - 5 dakikada bir çalışacak")
    while True:
        try:
            logging.info("Sync başlatılıyor...")
            main()
            logging.info("Sync tamamlandı")
        except Exception as e:
            logging.error(f"Loop error: {e}")
        
        logging.info("5 dakika bekleniyor...")
        time.sleep(300)  # 5 dakika = 300 saniye


