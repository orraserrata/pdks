import time
import logging
from src.sync import main

# Log ayarları
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(levelname)s - %(message)s',
    handlers=[
        logging.FileHandler('logs/sync.log'),
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


