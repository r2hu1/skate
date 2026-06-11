import json, sys, os
os.environ["MPLBACKEND"] = "Agg"
import cv2
import numpy as np

CASCADE_PATH = cv2.data.haarcascades + "haarcascade_frontalface_default.xml"
face_cascade = cv2.CascadeClassifier(CASCADE_PATH)

if face_cascade.empty():
    print(json.dumps({"error": "Failed to load Haar cascade"}))
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

    results = []
    for ts in timestamps:
        frame_idx = int(ts * fps)
        cap.set(cv2.CAP_PROP_POS_FRAMES, frame_idx)

        ret, frame = cap.read()
        if not ret:
            continue

        gray = cv2.cvtColor(frame, cv2.COLOR_BGR2GRAY)
        detections = face_cascade.detectMultiScale(
            gray,
            scaleFactor=1.1,
            minNeighbors=5,
            minSize=(60, 60),
        )

        for (x, y, w, h) in detections:
            results.append({
                "timestamp": round(ts, 2),
                "centerX": round(x + w / 2, 1),
                "centerY": round(y + h / 2, 1),
                "width": round(w, 1),
                "height": round(h, 1),
            })

    cap.release()

    if not results:
        for ts in timestamps:
            results.append({
                "timestamp": round(ts, 2),
                "centerX": float(width) / 2,
                "centerY": float(height) / 2,
                "width": 0,
                "height": 0,
            })

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
