import csv
import os
import argparse
from datetime import datetime, timedelta
from typing import List, Dict, Any

from supabase import create_client, Client

try:
	from dotenv import load_dotenv  # type: ignore
	# Proje kökündeki .env'yi yükle
	env_path = os.path.join(os.path.dirname(__file__), "..", ".env")
	load_dotenv(env_path)
except Exception:
	pass

SUPABASE_URL = os.getenv("SUPABASE_URL")
SUPABASE_SERVICE_KEY = os.getenv("SUPABASE_SERVICE_KEY")

if not SUPABASE_URL or not SUPABASE_SERVICE_KEY:
	raise RuntimeError("SUPABASE_URL veya SUPABASE_SERVICE_KEY tanımlı değil (.env kontrol edin)")

supabase: Client = create_client(SUPABASE_URL, SUPABASE_SERVICE_KEY)


def parse_datetime(value: str, date_format: str | None) -> datetime:
	"""CSV içindeki tarih metnini datetime'a çevirir."""
	value = (value or "").strip()
	if not value:
		raise ValueError("Boş tarih")
	if date_format:
		# Python strptime formatı beklenir
		return datetime.strptime(value, date_format)
	# Otomatik birkaç format dene (sık kullanılanlar)
	formats = [
		"%Y-%m-%d %H:%M:%S",
		"%Y-%m-%d %H:%M",
		"%d.%m.%Y %H:%M:%S",
		"%d.%m.%Y %H:%M",
		"%d/%m/%Y %H:%M:%S",
		"%d/%m/%Y %H:%M",
		"%Y/%m/%d %H:%M:%S",
		"%Y/%m/%d %H:%M",
	]
	last_error: Exception | None = None
	for fmt in formats:
		try:
			return datetime.strptime(value, fmt)
		except Exception as e:  # noqa: BLE001
			last_error = e
	raise last_error if last_error else ValueError(f"Tarih parse edilemedi: {value}")


def ensure_personel_exists(user_ids: List[int]) -> None:
	"""Eksik personel kayıtlarını basit placeholder ile oluşturur."""
	if not user_ids:
		return
	# Mevcutları sorgula
	existing = supabase.table("personel").select("kullanici_id").in_("kullanici_id", user_ids).execute()
	existing_ids = {row["kullanici_id"] for row in getattr(existing, "data", [])} if not getattr(existing, "error", None) else set()
	to_create = [uid for uid in user_ids if uid not in existing_ids]
	if not to_create:
		return
	payloads = [{
		"kullanici_id": uid,
		"isim": "Bilinmiyor",
		"soyisim": "",
		"ise_giris_tarihi": datetime.today().date().isoformat(),
	} for uid in to_create]
	res = supabase.table("personel").upsert(payloads).execute()
	if getattr(res, "error", None):
		print("Personel upsert hatası:", getattr(res, "error", None))


def insert_raw(records: List[Dict[str, Any]]) -> None:
	"""Ham tabloya (personel_giris_cikis) kayıt ekler; duplicate'ları atlar."""
	for rec in records:
		user_id = rec["kullanici_id"]
		ts: datetime = rec["timestamp"]
		timestamp = ts.strftime("%Y-%m-%d %H:%M:%S")
		# Duplicate kontrolü
		exists = supabase.table("personel_giris_cikis").select("id").eq("kullanici_id", user_id).eq("giris_tarihi", timestamp).limit(1).execute()
		if getattr(exists, "data", []):
			print(f"Zaten var, atlandı: {user_id} - {timestamp}")
			continue
		payload = {
			"kullanici_id": user_id,
			"isim": rec.get("isim") or None,
			"giris_tarihi": timestamp,
			"device_uid": rec.get("device_uid"),
			"status_code": rec.get("status_code"),
			"verify_method": rec.get("verify_method"),
		}
		res = supabase.table("personel_giris_cikis").insert(payload).execute()
		if getattr(res, "error", None):
			print("Ham insert hata:", getattr(res, "error", None))
		else:
			print("Ham eklendi:", payload)


def compute_workday_date(dt: datetime, day_start_hour: int) -> str:
	"""00-05 arası bir önceki güne say; aksi halde aynı gün."""
	if dt.hour < day_start_hour:
		wd = dt - timedelta(days=1)
	else:
		wd = dt
	return wd.date().isoformat()


def upsert_pairs(pairs: List[Dict[str, Any]], day_start_hour: int) -> None:
	"""Düzenli tabloya (personel_giris_cikis_duzenli) insert/update uygular; admin_locked ise dokunmaz."""
	for p in pairs:
		workday_date = compute_workday_date(p["giris_tarihi"], day_start_hour)
		# Var mı?
		existing = supabase.table("personel_giris_cikis_duzenli").select("id, admin_locked").eq("kullanici_id", p["kullanici_id"]).eq("workday_date", workday_date).limit(1).execute()
		rows = getattr(existing, "data", []) if not getattr(existing, "error", None) else []
		if rows:
			row = rows[0]
			if row.get("admin_locked"):
				print("Kilitli gün, atlandı:", p["kullanici_id"], workday_date)
				continue
			res = supabase.table("personel_giris_cikis_duzenli").update({
				"giris_tarihi": p["giris_tarihi"].strftime("%Y-%m-%d %H:%M:%S"),
				"cikis_tarihi": p["cikis_tarihi"].strftime("%Y-%m-%d %H:%M:%S") if p.get("cikis_tarihi") else None,
				"admin_locked": False,
			}).eq("id", row["id"]).execute()
			if getattr(res, "error", None):
				print("Güncelleme hatası:", getattr(res, "error", None))
			else:
				print("Güncellendi:", p["kullanici_id"], workday_date)
		else:
			payload = {
				"kullanici_id": p["kullanici_id"],
				"giris_tarihi": p["giris_tarihi"].strftime("%Y-%m-%d %H:%M:%S"),
				"cikis_tarihi": p["cikis_tarihi"].strftime("%Y-%m-%d %H:%M:%S") if p.get("cikis_tarihi") else None,
				"workday_date": workday_date,
				"admin_locked": False,
			}
			res = supabase.table("personel_giris_cikis_duzenli").insert(payload).execute()
			if getattr(res, "error", None):
				print("Insert hatası:", getattr(res, "error", None))
			else:
				print("Eklendi:", p["kullanici_id"], workday_date)


def run_import(file_path: str, import_type: str, date_format: str | None, auto_create_personel: bool, day_start_hour: int) -> None:
	# CSV oku
	with open(file_path, "r", encoding="utf-8-sig") as f:
		reader = csv.DictReader(f)
		rows = list(reader)

	if not rows:
		print("CSV boş")
		return

	# Kullanıcı id'leri topla
	user_ids: List[int] = []
	for r in rows:
		uid = r.get("kullanici_id") or r.get("user_id")
		if uid is not None and str(uid).strip() != "":
			try:
				user_ids.append(int(str(uid).strip()))
			except Exception:  # noqa: BLE001
				pass
	user_ids = sorted(list(set(user_ids)))

	if auto_create_personel:
		ensure_personel_exists(user_ids)

	if import_type == "raw":
		records: List[Dict[str, Any]] = []
		for r in rows:
			uid_str = r.get("kullanici_id") or r.get("user_id")
			ts_str = r.get("giris_tarihi") or r.get("timestamp")
			if not uid_str or not ts_str:
				continue
			uid = int(str(uid_str).strip())
			ts = parse_datetime(str(ts_str), date_format)
			records.append({
				"kullanici_id": uid,
				"timestamp": ts,
				"isim": r.get("isim"),
				"device_uid": r.get("device_uid"),
				"status_code": r.get("status_code"),
				"verify_method": r.get("verify_method"),
			})
		insert_raw(records)
		print("Ham import tamamlandı.")

	elif import_type == "pairs":
		pairs: List[Dict[str, Any]] = []
		for r in rows:
			uid_str = r.get("kullanici_id") or r.get("user_id")
			giris_str = r.get("giris_tarihi") or r.get("giris") or r.get("entry")
			cikis_str = r.get("cikis_tarihi") or r.get("cikis") or r.get("exit")
			if not uid_str or not giris_str:
				continue
			uid = int(str(uid_str).strip())
			giris_dt = parse_datetime(str(giris_str), date_format)
			cikis_dt = parse_datetime(str(cikis_str), date_format) if (cikis_str and str(cikis_str).strip()) else None
			pairs.append({
				"kullanici_id": uid,
				"giris_tarihi": giris_dt,
				"cikis_tarihi": cikis_dt,
			})
		upsert_pairs(pairs, day_start_hour)
		print("Çift import tamamlandı.")

	else:
		raise ValueError("import_type 'raw' veya 'pairs' olmalı")


if __name__ == "__main__":
	parser = argparse.ArgumentParser(description="Eski yazılımdan CSV verilerini içe aktar")
	parser.add_argument("--file", required=True, help="CSV dosya yolu")
	parser.add_argument("--type", required=True, choices=["raw", "pairs"], help="CSV türü: raw (tekil okuma) veya pairs (giriş-çıkış)")
	parser.add_argument("--date-format", dest="date_format", default=None, help="Tarih formatı (örn: %d.%m.%Y %H:%M:%S). Boş bırakılırsa otomatik denenir")
	parser.add_argument("--no-auto-create-personel", dest="auto_create_personel", action="store_false", help="Eksik personel kayıtlarını otomatik oluşturma")
	parser.add_argument("--day-start-hour", dest="day_start_hour", type=int, default=int(os.getenv("SYNC_DAY_START_HOUR", "5")), help="İş günü başlangıç saati (varsayılan 5)")
	args = parser.parse_args()

	run_import(
		file_path=args.file,
		import_type=args.type,
		date_format=args.date_format,
		auto_create_personel=args.auto_create_personel,
		day_start_hour=args.day_start_hour,
	)
