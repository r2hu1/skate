import json, sys, os
os.environ["MPLBACKEND"] = "Agg"
import cv2
import numpy as np

CASCADES = [
    cv2.data.haarcascades + "haarcascade_frontalface_alt2.xml",
    cv2.data.haarcascades + "haarcascade_frontalface_default.xml",
    cv2.data.haarcascades + "haarcascade_profileface.xml",
]

def load_cascade(path):
    cc = cv2.CascadeClassifier(path)
    return cc if not cc.empty() else None

cascades = [load_cascade(p) for p in CASCADES]
cascades = [c for c in cascades if c is not None]

if not cascades:
    print(json.dumps({"error": "Failed to load any Haar cascades"}))
    sys.exit(1)


class NumpyEncoder(json.JSONEncoder):
    def default(self, obj):
        if isinstance(obj, (np.integer,)):
            return int(obj)
        if isinstance(obj, (np.floating,)):
            return float(obj)
        if isinstance(obj, np.bool_):
            return bool(obj)
        return super().default(obj)


def detect_faces(video_path: str, timestamps: list[float]) -> list[dict]:
    cap = cv2.VideoCapture(video_path)
    fps = cap.get(cv2.CAP_PROP_FPS)
    width = int(cap.get(cv2.CAP_PROP_FRAME_WIDTH))
    height = int(cap.get(cv2.CAP_PROP_FRAME_HEIGHT))

    seen: set[tuple[int, float, float]] = set()
    results = []

    for ts in timestamps:
        frame_idx = int(ts * fps)
        cap.set(cv2.CAP_PROP_POS_FRAMES, frame_idx)

        ret, frame = cap.read()
        if not ret:
            continue

        gray = cv2.cvtColor(frame, cv2.COLOR_BGR2GRAY)
        clahe = cv2.createCLAHE(clipLimit=2.0, tileGridSize=(8, 8))
        enhanced = clahe.apply(gray)

        best_dets = []
        for cascade in cascades:
            for sf, mn, ms in [(1.05, 3, (40, 40)), (1.1, 4, (60, 60)), (1.15, 5, (80, 80))]:
                dets = cascade.detectMultiScale(
                    enhanced,
                    scaleFactor=sf,
                    minNeighbors=mn,
                    minSize=ms,
                )
                best_dets.extend([(x, y, w, h, sf * mn) for (x, y, w, h) in dets])

        best_dets.sort(key=lambda d: d[4], reverse=True)

        added = 0
        for (x, y, w, h, _) in best_dets:
            cx = round(x + w / 2, 1)
            cy = round(y + h / 2, 1)
            key = (frame_idx, cx, cy)
            if key not in seen:
                seen.add(key)
                results.append({
                    "timestamp": round(ts, 2),
                    "centerX": cx,
                    "centerY": cy,
                    "width": round(w, 1),
                    "height": round(h, 1),
                })
                added += 1
                if added >= 3:
                    break

    cap.release()
    return results


if __name__ == "__main__":
    if len(sys.argv) < 3:
        print(json.dumps({"error": "Usage: face_detect.py <video_path> <timestamps_json>"}))
        sys.exit(1)

    video_path = sys.argv[1]
    timestamps = json.loads(sys.argv[2])

    if not isinstance(timestamps, list):
        print(json.dumps({"error": "timestamps must be a JSON array"}))
        sys.exit(1)

    try:
        faces = detect_faces(video_path, timestamps)
        print(json.dumps(faces, cls=NumpyEncoder))
    except Exception as e:
        print(json.dumps({"error": str(e)}))
        sys.exit(1)
