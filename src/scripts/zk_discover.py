from datetime import datetime
from typing import Any

try:
    from zk import ZK
except Exception as exc:  # pragma: no cover
    raise SystemExit("Python 'zk' kütüphanesi yüklü değil. Kurulum: pip install zk") from exc


DEVICE_IP = "192.168.0.139"
DEVICE_PORT = 4370


def safe_call(obj: Any, method_name: str, default: Any = None):
    method = getattr(obj, method_name, None)
    if callable(method):
        try:
            return method()
        except Exception:
            return default
    return default


def to_dict(obj: Any) -> dict:
    data = {}
    for attr in dir(obj):
        if attr.startswith("_"):
            continue
        try:
            value = getattr(obj, attr)
        except Exception:
            continue
        if callable(value):
            continue
        try:
            # Basic types only for display
            if isinstance(value, (str, int, float, bool)) or value is None:
                data[attr] = value
            elif isinstance(value, datetime):
                data[attr] = value.isoformat()
        except Exception:
            continue
    return data


def main():
    print("Connecting to device...", DEVICE_IP, DEVICE_PORT)
    zk = ZK(DEVICE_IP, port=DEVICE_PORT, timeout=10)
    conn = None
    try:
        conn = zk.connect()
        print("Connected.")

        # Device info (best-effort)
        print("\n== Device Info ==")
        print("serialnumber:", safe_call(conn, "get_serialnumber"))
        print("platform:", safe_call(conn, "get_platform"))
        print("firmware:", safe_call(conn, "get_firmware_version"))
        print("device_name:", safe_call(conn, "get_device_name"))
        print("os_version:", safe_call(conn, "get_osversion"))

        # Users
        print("\n== Users ==")
        users = conn.get_users() or []
        print("count:", len(users))
        for u in users[:5]:
            print(to_dict(u))

        # Attendance
        print("\n== Attendance ==")
        attendance = conn.get_attendance() or []
        print("count:", len(attendance))
        for a in attendance[:10]:
            print(to_dict(a))

        # Field aggregates
        statuses = set()
        punches = set()
        timestamps = []
        for a in attendance:
            if hasattr(a, "status"):
                statuses.add(getattr(a, "status"))
            if hasattr(a, "punch"):
                punches.add(getattr(a, "punch"))
            ts = getattr(a, "timestamp", None)
            if isinstance(ts, datetime):
                timestamps.append(ts)

        print("unique status values:", sorted(list(statuses)))
        print("unique punch values:", sorted(list(punches)))
        if timestamps:
            print("time range:", min(timestamps).isoformat(), "->", max(timestamps).isoformat())

    except Exception as e:  # pragma: no cover
        print("ERROR:", e)
    finally:
        if conn:
            try:
                conn.disconnect()
            except Exception:
                pass


if __name__ == "__main__":
    main()


